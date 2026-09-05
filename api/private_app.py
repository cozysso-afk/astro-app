from __future__ import annotations

import asyncio
import hashlib
import json
import os
import threading
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request as UrlRequest, urlopen

from fastapi import Request
from fastapi.responses import JSONResponse

try:
    from .main import app
except ImportError:  # Render runs with api/ as the working directory.
    from main import app

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://dbynfabwfcakxayyggzi.supabase.co").rstrip("/")
SUPABASE_PUBLISHABLE_KEY = os.getenv(
    "SUPABASE_PUBLISHABLE_KEY",
    "sb_publishable_IEf9R9oJ5kbn513DdeqODQ_DwLeF35r",
).strip()
_AUTH_CACHE_TTL_SECONDS = 45
_auth_cache: dict[str, tuple[float, dict]] = {}
_auth_cache_lock = threading.Lock()
_HIDDEN_SCHEMA_PATHS = {"/openapi.json", "/docs", "/docs/", "/docs/oauth2-redirect", "/redoc", "/redoc/"}


def _json_request(url: str, token: str) -> object:
    request = UrlRequest(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "apikey": SUPABASE_PUBLISHABLE_KEY,
            "Accept": "application/json",
        },
        method="GET",
    )
    with urlopen(request, timeout=4) as response:  # noqa: S310 - fixed Supabase project origin
        return json.loads(response.read().decode("utf-8"))


def _verify_app_access(token: str) -> dict:
    if not token:
        raise PermissionError("missing_token")
    if not SUPABASE_URL or not SUPABASE_PUBLISHABLE_KEY:
        raise RuntimeError("auth_not_configured")

    cache_key = hashlib.sha256(token.encode("utf-8")).hexdigest()
    now = time.time()
    with _auth_cache_lock:
        cached = _auth_cache.get(cache_key)
        if cached and cached[0] > now:
            return cached[1]

    try:
        user_payload = _json_request(f"{SUPABASE_URL}/auth/v1/user", token)
    except HTTPError as exc:
        if exc.code in (401, 403):
            raise PermissionError("invalid_token") from exc
        raise RuntimeError("auth_service_error") from exc
    except (URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise RuntimeError("auth_service_error") from exc

    if not isinstance(user_payload, dict):
        raise PermissionError("invalid_token")
    email = str(user_payload.get("email") or "").strip().lower()
    user_id = str(user_payload.get("id") or "").strip()
    is_anonymous = bool(user_payload.get("is_anonymous"))
    if not email or not user_id or is_anonymous:
        raise PermissionError("email_auth_required")

    access_url = (
        f"{SUPABASE_URL}/rest/v1/app_access"
        f"?select=email,role&email=eq.{quote(email, safe='')}&enabled=eq.true&limit=1"
    )
    try:
        rows = _json_request(access_url, token)
    except HTTPError as exc:
        if exc.code in (401, 403):
            raise PermissionError("access_denied") from exc
        raise RuntimeError("access_table_unavailable") from exc
    except (URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise RuntimeError("access_service_error") from exc

    if not isinstance(rows, list) or not rows:
        raise PermissionError("access_denied")
    row = rows[0] if isinstance(rows[0], dict) else {}
    access = {
        "allowed": True,
        "user_id": user_id,
        "email": email,
        "role": str(row.get("role") or "member"),
    }
    with _auth_cache_lock:
        _auth_cache[cache_key] = (now + _AUTH_CACHE_TTL_SECONDS, access)
        if len(_auth_cache) > 256:
            stale = [key for key, value in _auth_cache.items() if value[0] <= now]
            for key in stale:
                _auth_cache.pop(key, None)
    return access


def _bearer_token(request: Request) -> str:
    value = request.headers.get("authorization", "").strip()
    if not value.lower().startswith("bearer "):
        return ""
    return value[7:].strip()


@app.middleware("http")
async def private_app_access_guard(request: Request, call_next):
    path = request.url.path
    if path in _HIDDEN_SCHEMA_PATHS:
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    if request.method == "OPTIONS" or not path.startswith("/v1/"):
        return await call_next(request)

    token = _bearer_token(request)
    if not token:
        return JSONResponse(status_code=401, content={"detail": "이메일 로그인이 필요해."})

    try:
        access = await asyncio.to_thread(_verify_app_access, token)
    except PermissionError:
        return JSONResponse(status_code=403, content={"detail": "이 계정에는 앱 접근 권한이 없어."})
    except RuntimeError:
        return JSONResponse(status_code=503, content={"detail": "앱 접근 권한을 확인하지 못했어. 안전을 위해 요청을 차단했어."})

    request.state.app_access = access
    return await call_next(request)


@app.get("/v1/auth/me")
def private_auth_me(request: Request) -> dict:
    access = getattr(request.state, "app_access", None)
    if not isinstance(access, dict) or access.get("allowed") is not True:
        return {"allowed": False}
    return {
        "allowed": True,
        "email": access.get("email"),
        "role": access.get("role"),
    }
