import csv
import gzip
import io
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta
from urllib.parse import urlencode
from zoneinfo import ZoneInfo

KST = ZoneInfo("Asia/Seoul")
ONESIGNAL_ENDPOINT = "https://api.onesignal.com/notifications?c=push"
ONESIGNAL_EXPORT_ENDPOINT = "https://api.onesignal.com/players/csv_export"
LAUNCHER_URL = "https://cozysso-afk.github.io/astro-app/"
WEB_PUSH_DEVICE_TYPES = {5, 7, 17}  # ChromePush / SafariPush variants

SCHEDULE_TO_KIND = {
    "0 23 * * *": "daily",   # 08:00 KST
    "0 12 * * 0": "weekly",  # Sunday 21:00 KST
    "0 11 * * *": "monthly", # 20:00 KST; last-day guard below
}


def next_month(year: int, month: int):
    return (year + 1, 1) if month == 12 else (year, month + 1)


def resolve_kind():
    explicit = (os.getenv("ASTRO_PUSH_KIND") or "").strip().lower()
    if explicit in {"daily", "weekly", "monthly"}:
        return explicit
    schedule = (os.getenv("GITHUB_EVENT_SCHEDULE") or "").strip()
    return SCHEDULE_TO_KIND.get(schedule, "")


def build_message(kind: str, now_kst: datetime):
    params = {"from": "push", "kind": kind}
    if kind == "daily":
        target_date = now_kst.date()
        params["date"] = target_date.isoformat()
        title = "🌙 오늘의 별빛 운세"
        body = "오늘의 정밀 일일운세와 AI 해설을 확인해봐."
        name = f"astro-daily-{target_date:%Y-%m-%d}"
    elif kind == "weekly":
        target_date = now_kst.date() + timedelta(days=1)
        params["date"] = target_date.isoformat()
        title = "📅 다음 주 별빛 운세"
        body = "월요일부터 7일 흐름과 분야별 주간 AI 해설을 확인할 시간이야."
        name = f"astro-weekly-{target_date:%Y-%m-%d}"
    elif kind == "monthly":
        tomorrow = now_kst.date() + timedelta(days=1)
        if tomorrow.month == now_kst.month:
            return None
        year, month = next_month(now_kst.year, now_kst.month)
        params.update({"year": str(year), "month": str(month)})
        title = f"🌕 {month}월 별빛 운세"
        body = "새달의 월간 흐름과 분야별 AI 해설을 미리 확인해봐."
        name = f"astro-monthly-{year:04d}-{month:02d}"
    else:
        raise ValueError(f"Unknown push kind: {kind}")

    return {
        "title": title,
        "body": body,
        "name": name,
        "url": LAUNCHER_URL + "?" + urlencode(params),
    }


def _auth_headers(api_key: str):
    return {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": f"Key {api_key}",
    }


def _request_json(url: str, api_key: str, method="GET", payload=None, timeout=45):
    data = None
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method, headers=_auth_headers(api_key))
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            raw = response.read().decode("utf-8", errors="replace")
            try:
                parsed = json.loads(raw) if raw else {}
            except Exception:
                parsed = {"raw": raw}
            return response.status, parsed
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(raw) if raw else {}
        except Exception:
            parsed = {"raw": raw}
        return exc.code, parsed


def _notification_succeeded(status: int, data) -> bool:
    if not (200 <= status < 300) or not isinstance(data, dict):
        return False
    if data.get("errors"):
        return False
    return bool(str(data.get("id") or "").strip())


def _download_export_rows(csv_url: str):
    last_error = None
    for attempt in range(6):
        try:
            with urllib.request.urlopen(csv_url, timeout=45) as response:
                blob = response.read()
            try:
                text = gzip.decompress(blob).decode("utf-8-sig", errors="replace")
            except OSError:
                text = blob.decode("utf-8-sig", errors="replace")
            return list(csv.DictReader(io.StringIO(text)))
        except Exception as exc:
            last_error = exc
            if attempt < 5:
                time.sleep(2 + attempt)
    raise RuntimeError(f"Could not download OneSignal subscription export: {last_error}")


def _active_web_subscription_ids(app_id: str, api_key: str):
    # Device-level IDs remain private: discover active Web Push subscriptions at
    # send time and never persist or print them. This also survives PWA reinstalls.
    query = urlencode({"app_id": app_id})
    status, data = _request_json(
        ONESIGNAL_EXPORT_ENDPOINT + "?" + query,
        api_key,
        method="POST",
        payload={"extra_fields": ["notification_types"]},
        timeout=60,
    )
    if not (200 <= status < 300) or not isinstance(data, dict) or not data.get("csv_file_url"):
        raise RuntimeError(f"OneSignal subscription export failed (HTTP {status})")

    rows = _download_export_rows(str(data["csv_file_url"]))
    active = []
    for row in rows:
        try:
            device_type = int(str(row.get("device_type", "")).strip())
        except Exception:
            continue
        if device_type not in WEB_PUSH_DEVICE_TYPES:
            continue

        invalid = str(row.get("invalid_identifier", "")).strip().lower()
        if invalid in {"t", "true", "1", "yes"}:
            continue

        raw_types = str(row.get("notification_types", "")).strip()
        if raw_types:
            try:
                if int(float(raw_types)) <= 0:
                    continue
            except Exception:
                pass

        subscription_id = str(row.get("id") or row.get("subscription_id") or "").strip()
        if subscription_id:
            active.append(subscription_id)
    return list(dict.fromkeys(active))


def _base_payload(app_id: str, message, kind: str):
    return {
        "app_id": app_id,
        "target_channel": "push",
        "name": message["name"],
        "headings": {"en": message["title"]},
        "contents": {"en": message["body"]},
        "url": message["url"],
        "data": {"astro_kind": kind},
    }


def _send_payload(api_key: str, payload):
    status, data = _request_json(
        ONESIGNAL_ENDPOINT,
        api_key,
        method="POST",
        payload=payload,
        timeout=45,
    )
    safe = dict(data) if isinstance(data, dict) else {"response": str(data)}
    safe.pop("recipients", None)
    print(f"OneSignal HTTP {status}: {json.dumps(safe, ensure_ascii=False)}")
    return status, data


def main():
    app_id = (os.getenv("ONESIGNAL_APP_ID") or "").strip()
    api_key = (os.getenv("ONESIGNAL_APP_API_KEY") or "").strip()
    if not app_id or not api_key:
        print("OneSignal secrets are not configured yet; skipping push without failing the workflow.")
        return 0

    kind = resolve_kind()
    if not kind:
        print("Could not resolve push kind; skipping.")
        return 0

    now_kst = datetime.now(KST)
    message = build_message(kind, now_kst)
    if message is None:
        print("Monthly schedule fired on a non-last day; skipping.")
        return 0

    try:
        subscription_ids = _active_web_subscription_ids(app_id, api_key)
    except Exception as exc:
        print(f"OneSignal subscription discovery failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1

    print(f"Active OneSignal web push subscriptions discovered: {len(subscription_ids)}")
    if not subscription_ids:
        print("No active web push subscription is currently messageable. Re-open the installed home-screen app and re-enable notifications.", file=sys.stderr)
        return 1

    payload = _base_payload(app_id, message, kind)
    payload["include_subscription_ids"] = subscription_ids
    status, data = _send_payload(api_key, payload)
    if not _notification_succeeded(status, data):
        print("OneSignal direct subscription push was not accepted as deliverable.", file=sys.stderr)
        return 1

    print(f"OneSignal push accepted for {len(subscription_ids)} active web subscription(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
