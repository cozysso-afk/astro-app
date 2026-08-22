import base64
import calendar
import hashlib
import hmac
import html
import json
import math
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, time as dt_time, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import pytz
import streamlit as st
import streamlit.components.v1 as components
import swisseph as swe
from PIL import Image
from scipy.optimize import brentq
from skyfield.api import load, wgs84
from skyfield.framelib import ecliptic_frame

try:
    import exchange_calendars as xcals
except Exception:
    xcals = None


# ============================================================
# 0. PAGE / DESIGN
# ============================================================
APP_DIR = Path(__file__).resolve().parent
ICON_PATH = APP_DIR / "icon.PNG"
ICON_URL = "https://raw.githubusercontent.com/cozysso-afk/astro-app/main/icon.PNG"

try:
    PAGE_ICON = Image.open(ICON_PATH)
except Exception:
    PAGE_ICON = "✨"

st.set_page_config(
    page_title="별빛의 운명 - 고정밀 점성술",
    page_icon=PAGE_ICON,
    layout="centered",
    initial_sidebar_state="collapsed",
)

# config.toml이 없어도 상단 개발자 도구를 최소화합니다.
try:
    st.set_option("client.toolbarMode", "minimal")
except Exception:
    pass

# iOS 홈 화면 아이콘 + Streamlit 관리자 오버레이 best-effort 숨김.
# Manage app 숨김은 Streamlit 공식 API가 아니므로 DOM 변경 시 다시 보일 수 있습니다.
components.html(
    f"""
    <script>
    (() => {{
      try {{
        const d = window.parent.document;
        const head = d.head;
        const upsert = (rel, href, sizes='') => {{
          let el = head.querySelector(`link[rel='${{rel}}']`);
          if (!el) {{ el = d.createElement('link'); el.rel = rel; head.appendChild(el); }}
          el.href = href;
          if (sizes) el.sizes = sizes;
        }};
        upsert('icon', '{ICON_URL}');
        upsert('shortcut icon', '{ICON_URL}');
        upsert('apple-touch-icon', '{ICON_URL}', '180x180');

        let title = head.querySelector("meta[name='apple-mobile-web-app-title']");
        if (!title) {{ title = d.createElement('meta'); title.name = 'apple-mobile-web-app-title'; head.appendChild(title); }}
        title.content = '별빛의 운명';

        // Streamlit Community Cloud의 앱 관리자/상단 툴바를 최대한 숨긴다.
        // 공식 API가 아닌 DOM 정리이므로 Streamlit이 구조를 바꾸면 다시 보일 수 있다.
        const cleanupStyleId = 'astro-streamlit-chrome-cleanup';
        if (!head.querySelector('#' + cleanupStyleId)) {{
          const style = d.createElement('style');
          style.id = cleanupStyleId;
          style.textContent = `
            [data-testid="stAppDeployButton"],
            [data-testid="stToolbar"],
            [data-testid="stDecoration"],
            header[data-testid="stHeader"] {{ display:none !important; visibility:hidden !important; }}
            #MainMenu {{ display:none !important; }}
          `;
          head.appendChild(style);
        }}

        const hideManage = () => {{
          // 알려진 test id는 텍스트 검사 없이 바로 숨김.
          d.querySelectorAll('[data-testid="stAppDeployButton"], [data-testid="stToolbar"], header[data-testid="stHeader"]').forEach(el => {{
            el.style.setProperty('display', 'none', 'important');
            el.style.setProperty('visibility', 'hidden', 'important');
          }});

          // Streamlit 버전에 따라 Manage app이 별도 fixed/sticky wrapper로 렌더될 수 있어
          // 텍스트를 가진 leaf element를 찾고 가장 가까운 고정형 조상까지 숨긴다.
          d.querySelectorAll('button, a, div, span, [role="button"]').forEach(el => {{
            const txt = (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase();
            if (!txt || txt.length > 40 || !txt.includes('manage app')) return;
            let node = el;
            let candidate = el;
            for (let i = 0; i < 8 && node; i++, node = node.parentElement) {{
              candidate = node;
              const testId = (node.getAttribute && node.getAttribute('data-testid')) || '';
              const cs = window.parent.getComputedStyle ? window.parent.getComputedStyle(node) : null;
              const pos = cs ? cs.position : '';
              if (testId === 'stAppDeployButton' || pos === 'fixed' || pos === 'sticky') {{
                candidate = node;
                break;
              }}
            }}
            candidate.style.setProperty('display', 'none', 'important');
            candidate.style.setProperty('visibility', 'hidden', 'important');
          }});
        }};
        hideManage();
        const observer = new MutationObserver(hideManage);
        observer.observe(d.body, {{ childList: true, subtree: true, characterData: true }});
        window.parent.setInterval(hideManage, 1200);
      }} catch (e) {{ console.warn('UI cleanup skipped', e); }}
    }})();
    </script>
    """,
    height=0,
    width=0,
)

CUSTOM_CSS = """
<style>
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;800&family=Cormorant+Garamond:wght@500;700&display=swap');

html, body, [class*="css"] {
    font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
    color: #2D3142;
}
.stApp {
    background: linear-gradient(135deg, #FFF5F7 0%, #F5F0FA 50%, #F0F7F7 100%);
    background-attachment: fixed;
}
.block-container { padding-top: 1.15rem; padding-bottom: 4rem; }
#MainMenu { visibility: hidden; }
footer { visibility: hidden; }
header [data-testid="stToolbar"] { opacity: .18; }

.top-nav {
    text-align:center; color:#8B7697; font-size:.72rem; letter-spacing:.16em;
    margin-bottom:.25rem;
}
.ast-card {
    background: rgba(255,255,255,.86);
    border: 1px solid rgba(207,190,218,.45);
    border-radius: 18px;
    padding: 16px 17px;
    box-shadow: 0 8px 24px rgba(180,150,190,.10);
    margin-bottom: 12px;
}
.ast-title { font-weight: 800; color:#4A3E56; font-size:1.02rem; margin-bottom:7px; }
.ast-body { color:#5F5767; line-height:1.72; font-size:.92rem; }
.ast-sub { color:#83788B; font-size:.80rem; line-height:1.55; }
.profile-strip {
    background:rgba(255,255,255,.72); border:1px solid rgba(211,190,220,.50);
    border-radius:15px; padding:10px 12px; margin-bottom:10px; font-size:.83rem; line-height:1.55;
}
.score-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; margin:8px 0 14px; }
.score-card { background:rgba(255,255,255,.80); border:1px solid rgba(202,185,214,.42); border-radius:14px; padding:12px; }
.score-name { font-size:.82rem; font-weight:800; color:#53475E; }
.score-num { font-family:'Cinzel','Pretendard',serif; font-weight:800; font-size:1.14rem; color:#8C7033; margin-top:3px; }
.score-band { font-size:.72rem; color:#897C91; margin-top:1px; }
.topic-head { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
.topic-score { white-space:nowrap; font-weight:800; color:#8C7033; }
.event-pill { background:rgba(255,255,255,.67); border-left:4px solid rgba(154,123,56,.58); padding:9px 11px; border-radius:9px; margin:7px 0; font-size:.86rem; line-height:1.58; }
.window-card { background:rgba(255,255,255,.75); border:1px solid rgba(196,178,205,.40); border-left:4px solid rgba(154,123,56,.72); border-radius:11px; padding:11px 12px; margin:8px 0; line-height:1.58; font-size:.87rem; }
.window-card.risk { border-left-color:rgba(210,105,105,.78); }
.window-card.love { border-left-color:rgba(201,92,135,.78); }
.window-card.study { border-left-color:rgba(75,113,160,.78); }
.market-closed { border-left:4px solid #A6A0AC; }
.section-kicker { color:#8A7A92; font-size:.77rem; font-weight:700; letter-spacing:.03em; margin:4px 0 8px; }
.period-range { background:rgba(255,255,255,.68); border-radius:13px; padding:10px 12px; margin:5px 0 12px; color:#665C70; font-size:.86rem; }

.timing-strip { margin-top:10px; padding:9px 11px; border-radius:10px; background:rgba(244,239,249,.78); color:#655A70; font-size:.80rem; line-height:1.55; }
.decision-strip { margin-top:8px; padding:9px 11px; border-radius:10px; background:rgba(255,247,250,.88); border-left:3px solid rgba(201,92,135,.52); color:#5D5364; font-size:.82rem; line-height:1.55; }
.ai-overview { background:linear-gradient(135deg,rgba(255,255,255,.92),rgba(247,241,252,.92)); border:1px solid rgba(175,146,198,.40); border-radius:16px; padding:14px 15px; margin:8px 0 14px; box-shadow:0 8px 24px rgba(154,123,175,.08); }
.ai-head { font-weight:800; color:#51405F; margin-bottom:7px; }
.ai-body { color:#62576A; font-size:.88rem; line-height:1.72; }
.ai-topic { margin-top:9px; padding:9px 11px; border-radius:10px; background:rgba(247,243,251,.78); border-left:3px solid rgba(141,113,160,.52); color:#5F5567; font-size:.82rem; line-height:1.60; }
.ai-chip { display:inline-block; padding:3px 7px; margin:2px 4px 2px 0; border-radius:999px; background:rgba(238,229,245,.88); color:#6B5977; font-size:.73rem; font-weight:700; }
.astro-note { background:rgba(255,255,255,.62); border:1px solid rgba(202,185,214,.32); border-radius:12px; padding:9px 11px; margin:6px 0 12px; color:#6B6073; font-size:.80rem; line-height:1.55; }

.stTabs [data-baseweb="tab-list"] { overflow-x:auto; flex-wrap:nowrap; justify-content:flex-start; gap:4px; background:rgba(255,255,255,.62); border-radius:16px; padding:5px; scrollbar-width:none; }
.stTabs [data-baseweb="tab-list"]::-webkit-scrollbar { display:none; }
.stTabs [data-baseweb="tab"] { flex:0 0 auto; white-space:nowrap; border-radius:11px; padding:7px 11px; }
.stTabs [aria-selected="true"] { background:linear-gradient(135deg, rgba(247,201,221,.85), rgba(221,211,247,.90)) !important; color:#4A3E56 !important; font-weight:800 !important; }

@media (max-width:640px) {
    .block-container { padding-left: .9rem; padding-right: .9rem; padding-top:.7rem; }
    .score-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
    .ast-card { padding:14px 14px; border-radius:16px; }
    .ast-body { font-size:.89rem; line-height:1.68; }
    .stTabs [data-baseweb="tab"] { font-size:.80rem; padding:6px 9px; }
}
</style>
"""
st.markdown(CUSTOM_CSS, unsafe_allow_html=True)

# ============================================================
# 0-B. PRIVATE PIN LOCK / 30-DAY REMEMBER-ME (FIRST-PARTY COOKIE)
# ============================================================
# V5.2의 extra_streamlit_components CookieManager는 Streamlit 컴포넌트 iframe
# 내부에서 쿠키를 다뤄 iOS Safari/PWA에서 재접속 시 읽지 못하는 경우가 있었습니다.
# V5.2.1부터는 실제 앱 도메인의 first-party cookie를 window.parent.document에
# 기록하고, 새 Streamlit 세션에서는 st.context.cookies로 읽습니다.
REMEMBER_COOKIE_NAME = "astro_remember_v2"
LEGACY_REMEMBER_COOKIE_NAME = "astro_remember_v1"
REMEMBER_DAYS = 30
REMEMBER_TOKEN_AUDIENCE = "cozysso-astro-app"


def _secret_text(key, default=""):
    try:
        value = st.secrets.get(key, default)
    except Exception:
        value = default
    return str(value).strip()


def _configured_app_pin():
    return _secret_text("APP_PIN", "")


def _remember_secret():
    return _secret_text("REMEMBER_ME_SECRET", "")


def _b64url_encode(raw):
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64url_decode(value):
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode((value + padding).encode("ascii"))


def _pin_fingerprint(pin):
    # PIN 원문은 쿠키에 저장하지 않음. PIN이 바뀌면 기존 자동로그인도 자동 무효화.
    return hashlib.sha256(pin.encode("utf-8")).hexdigest()[:20]


def _make_remember_token(pin, signing_secret, now_ts=None):
    now_ts = int(time.time() if now_ts is None else now_ts)
    payload = {
        "aud": REMEMBER_TOKEN_AUDIENCE,
        "v": 2,
        "iat": now_ts,
        "exp": now_ts + REMEMBER_DAYS * 86400,
        "pin_fp": _pin_fingerprint(pin),
        "nonce": secrets.token_urlsafe(12),
    }
    payload_bytes = json.dumps(
        payload,
        ensure_ascii=True,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    signature = hmac.new(
        signing_secret.encode("utf-8"),
        payload_bytes,
        hashlib.sha256,
    ).digest()
    return f"{_b64url_encode(payload_bytes)}.{_b64url_encode(signature)}"


def _verify_remember_token(token, pin, signing_secret, now_ts=None):
    if not token or not signing_secret or len(signing_secret) < 32:
        return False
    try:
        payload_part, sig_part = token.split(".", 1)
        payload_bytes = _b64url_decode(payload_part)
        supplied_sig = _b64url_decode(sig_part)
        expected_sig = hmac.new(
            signing_secret.encode("utf-8"),
            payload_bytes,
            hashlib.sha256,
        ).digest()
        if not hmac.compare_digest(supplied_sig, expected_sig):
            return False

        payload = json.loads(payload_bytes.decode("utf-8"))
        now_ts = int(time.time() if now_ts is None else now_ts)

        if payload.get("aud") != REMEMBER_TOKEN_AUDIENCE:
            return False
        if payload.get("v") != 2:
            return False
        if payload.get("pin_fp") != _pin_fingerprint(pin):
            return False

        iat = int(payload.get("iat", 0))
        exp = int(payload.get("exp", 0))
        if iat <= 0 or exp <= iat:
            return False
        # 클라이언트/서버 시계 오차는 5분까지만 허용.
        if iat > now_ts + 300:
            return False
        if exp <= now_ts:
            return False
        if exp - iat > (REMEMBER_DAYS * 86400 + 300):
            return False
        return True
    except Exception:
        return False


def _request_cookie(name):
    """새 브라우저 세션의 최초 요청에 포함된 first-party cookie를 읽습니다."""
    try:
        cookies = st.context.cookies
        value = cookies.get(name, "")
        return str(value or "").strip()
    except Exception:
        return ""


def _emit_cookie_write(token):
    """실제 Streamlit 앱 문서(parent)에 30일 first-party cookie를 기록합니다."""
    cookie_name_js = json.dumps(REMEMBER_COOKIE_NAME)
    legacy_name_js = json.dumps(LEGACY_REMEMBER_COOKIE_NAME)
    token_js = json.dumps(token)
    max_age = REMEMBER_DAYS * 86400
    components.html(
        f"""
        <script>
        (() => {{
          try {{
            const d = window.parent.document;
            const name = {cookie_name_js};
            const legacy = {legacy_name_js};
            const token = {token_js};
            d.cookie = legacy + '=; Path=/; Max-Age=0; SameSite=Lax; Secure';
            d.cookie = name + '=' + token + '; Path=/; Max-Age={max_age}; SameSite=Lax; Secure';
          }} catch (e) {{
            console.warn('remember-cookie write skipped', e);
          }}
        }})();
        </script>
        """,
        height=0,
        width=0,
    )


def _emit_cookie_delete(reload_after=False):
    """현재/구버전 자동로그인 쿠키를 모두 지웁니다."""
    cookie_name_js = json.dumps(REMEMBER_COOKIE_NAME)
    legacy_name_js = json.dumps(LEGACY_REMEMBER_COOKIE_NAME)
    reload_js = "window.parent.setTimeout(() => window.parent.location.reload(), 180);" if reload_after else ""
    components.html(
        f"""
        <script>
        (() => {{
          try {{
            const d = window.parent.document;
            const name = {cookie_name_js};
            const legacy = {legacy_name_js};
            d.cookie = name + '=; Path=/; Max-Age=0; SameSite=Lax; Secure';
            d.cookie = legacy + '=; Path=/; Max-Age=0; SameSite=Lax; Secure';
            {reload_js}
          }} catch (e) {{
            console.warn('remember-cookie delete skipped', e);
          }}
        }})();
        </script>
        """,
        height=0,
        width=0,
    )


def _flush_pending_cookie_write():
    token = str(st.session_state.pop("_astro_pending_remember_token", "") or "").strip()
    if not token:
        return
    _emit_cookie_write(token)
    st.session_state["_astro_remember_cookie_written"] = True


def _try_cookie_unlock(configured_pin, signing_secret):
    if not configured_pin or not signing_secret or len(signing_secret) < 32:
        return False

    token = _request_cookie(REMEMBER_COOKIE_NAME)
    if not token:
        return False

    if _verify_remember_token(token, configured_pin, signing_secret):
        st.session_state["_astro_unlocked"] = True
        st.session_state["_astro_unlocked_via_cookie"] = True
        st.session_state["_astro_remember_cookie_written"] = True
        return True

    # 만료/변조/PIN 변경 토큰은 브라우저에서도 제거.
    _emit_cookie_delete(reload_after=False)
    return False


def require_app_unlock():
    if st.session_state.get("_astro_unlocked", False):
        # PIN 인증 직후 다음 렌더에서 쿠키를 기록해 st.rerun과 JS 실행의 경합을 피함.
        _flush_pending_cookie_write()
        return

    configured_pin = _configured_app_pin()
    signing_secret = _remember_secret()

    if _try_cookie_unlock(configured_pin, signing_secret):
        return

    st.markdown("<div style='text-align:center;font-size:2.4rem;margin-top:7vh'>🌙</div>", unsafe_allow_html=True)
    st.markdown("<h2 style='text-align:center;color:#4A3E56'>별빛의 운명</h2>", unsafe_allow_html=True)
    st.caption("개인 운세 데이터 보호를 위해 PIN을 입력해 주세요.")

    if not configured_pin:
        st.warning("Streamlit Secrets에 APP_PIN을 먼저 설정해 주세요.")
        st.code('APP_PIN = "6자리 이상 PIN"', language="toml")
        st.stop()
    if len(configured_pin) < 6:
        st.error("APP_PIN은 6자리 이상으로 설정해 주세요.")
        st.stop()

    remember_enabled = hasattr(st, "context") and len(signing_secret) >= 32
    if not remember_enabled:
        st.info(
            "📱 30일 로그인 유지를 쓰려면 최신 Streamlit과 Secrets의 "
            "REMEMBER_ME_SECRET(32자 이상)이 필요해."
        )

    now = time.time()
    blocked_until = float(st.session_state.get("_astro_lock_until", 0.0) or 0.0)
    if now < blocked_until:
        st.error(f"PIN 입력 실패가 누적되어 약 {int(blocked_until-now)+1}초 동안 잠겼습니다.")
        st.stop()

    with st.form("astro_private_pin_form", clear_on_submit=True):
        entered_pin = st.text_input(
            "PIN",
            type="password",
            label_visibility="collapsed",
            placeholder="PIN 입력",
        )
        remember_device = st.checkbox(
            f"이 기기에서 {REMEMBER_DAYS}일 동안 로그인 유지",
            value=True,
            disabled=not remember_enabled,
            help="개인 기기에서만 사용해. 공용 기기에서는 체크를 꺼두는 게 좋아.",
        )
        submitted = st.form_submit_button("🌙 별빛의 운명 열기", use_container_width=True)

    if submitted:
        if hmac.compare_digest(entered_pin.strip(), configured_pin):
            st.session_state["_astro_unlocked"] = True
            st.session_state["_astro_pin_failures"] = 0
            st.session_state["_astro_lock_until"] = 0.0
            st.session_state["_astro_unlocked_via_cookie"] = False
            st.session_state["_astro_remember_cookie_written"] = False

            if remember_device and remember_enabled:
                token = _make_remember_token(configured_pin, signing_secret)
                st.session_state["_astro_pending_remember_token"] = token
            else:
                st.session_state.pop("_astro_pending_remember_token", None)
            st.rerun()
        else:
            failures = int(st.session_state.get("_astro_pin_failures", 0)) + 1
            if failures >= 5:
                st.session_state["_astro_pin_failures"] = 0
                st.session_state["_astro_lock_until"] = time.time() + 30
                st.error("PIN을 5회 틀려 30초 동안 잠겼습니다.")
            else:
                st.session_state["_astro_pin_failures"] = failures
                st.error(f"PIN이 맞지 않습니다. 잠기기까지 {5-failures}회 남았습니다.")
    st.stop()


require_app_unlock()

with st.sidebar:
    if st.session_state.get("_astro_unlocked_via_cookie", False) or st.session_state.get("_astro_remember_cookie_written", False):
        st.caption("✅ 이 기기 30일 자동 로그인 사용 중")
    if st.button("🔒 이 기기에서 로그아웃", use_container_width=True):
        st.session_state["_astro_unlocked"] = False
        st.session_state["_astro_unlocked_via_cookie"] = False
        st.session_state["_astro_remember_cookie_written"] = False
        st.session_state.pop("_astro_pending_remember_token", None)
        # st.context.cookies는 현재 요청의 스냅샷이므로 즉시 rerun하면 옛 쿠키가 다시 읽힐 수 있음.
        # 먼저 브라우저 쿠키를 지운 뒤 전체 페이지를 재로딩해서 새 요청을 시작한다.
        _emit_cookie_delete(reload_after=True)
        st.stop()

# ============================================================
# 1. CONSTANTS
# ============================================================
KST = pytz.timezone("Asia/Seoul")
UTC = pytz.UTC
WEEKDAY_KO = ["월", "화", "수", "목", "금", "토", "일"]
SIGNS_KO = ["양자리","황소자리","쌍둥이자리","게자리","사자자리","처녀자리","천칭자리","전갈자리","사수자리","염소자리","물병자리","물고기자리"]

PLANET_KEYS = {
    "Sun": ("sun",), "Moon": ("moon",),
    "Mercury": ("mercury", "mercury barycenter"),
    "Venus": ("venus", "venus barycenter"),
    "Mars": ("mars", "mars barycenter"),
    "Jupiter": ("jupiter", "jupiter barycenter"),
    "Saturn": ("saturn", "saturn barycenter"),
    "Uranus": ("uranus", "uranus barycenter"),
    "Neptune": ("neptune", "neptune barycenter"),
    "Pluto": ("pluto", "pluto barycenter"),
}
PLANET_KO = {"Sun":"태양","Moon":"달","Mercury":"수성","Venus":"금성","Mars":"화성","Jupiter":"목성","Saturn":"토성","Uranus":"천왕성","Neptune":"해왕성","Pluto":"명왕성","ASC":"ASC","MC":"MC","Vertex":"Vertex","PoF":"행운점"}

KOREA_BIRTHPLACES = {
    "전라남도 여수시": (34.7604,127.6622), "전라남도 순천시": (34.9507,127.4872), "전라남도 광양시": (34.9407,127.6959),
    "광주광역시": (35.1595,126.8526), "전북특별자치도 전주시": (35.8242,127.1480), "전북특별자치도 군산시": (35.9677,126.7366),
    "서울특별시": (37.5665,126.9780), "부산광역시": (35.1796,129.0756), "대구광역시": (35.8714,128.6014),
    "인천광역시": (37.4563,126.7052), "대전광역시": (36.3504,127.3845), "울산광역시": (35.5384,129.3114),
    "세종특별자치시": (36.4800,127.2890), "경기도 수원시": (37.2636,127.0286), "경기도 성남시": (37.4200,127.1265),
    "경기도 고양시": (37.6584,126.8320), "경기도 용인시": (37.2411,127.1776), "강원특별자치도 춘천시": (37.8813,127.7300),
    "강원특별자치도 강릉시": (37.7519,128.8761), "충청북도 청주시": (36.6424,127.4890), "충청남도 천안시": (36.8151,127.1139),
    "충청남도 공주시": (36.4465,127.1190), "경상북도 포항시": (36.0190,129.3435), "경상북도 경주시": (35.8562,129.2247),
    "경상남도 창원시": (35.2279,128.6811), "경상남도 진주시": (35.1800,128.1076), "경상남도 통영시": (34.8544,128.4332),
    "제주특별자치도 제주시": (33.4996,126.5312), "제주특별자치도 서귀포시": (33.2541,126.5601),
}

TRADITIONAL_RULER_BY_SIGN = {0:"Mars",1:"Venus",2:"Mercury",3:"Moon",4:"Sun",5:"Mercury",6:"Venus",7:"Mars",8:"Jupiter",9:"Saturn",10:"Saturn",11:"Jupiter"}

ASPECTS = {
    "합": {"angle":0.0,"activation":1.00,"polarity":0.00},
    "육십분위": {"angle":60.0,"activation":0.72,"polarity":0.55},
    "사분위": {"angle":90.0,"activation":0.90,"polarity":-0.55},
    "삼분위": {"angle":120.0,"activation":0.82,"polarity":0.65},
    "충": {"angle":180.0,"activation":1.00,"polarity":-0.45},
}
EXACT_ORB = 0.02
LAYER_BY_TRANSIT = {"Moon":"일일","Sun":"중기","Mercury":"중기","Venus":"중기","Mars":"중기","Jupiter":"장기","Saturn":"장기","Uranus":"장기","Neptune":"장기","Pluto":"장기"}
PLANET_TONE = {"Sun":0.15,"Moon":0.05,"Mercury":0.00,"Venus":0.45,"Mars":-0.25,"Jupiter":0.50,"Saturn":-0.45,"Uranus":-0.15,"Neptune":-0.10,"Pluto":-0.25,"ASC":0.0,"MC":0.0}

# Whole Sign = 주 기준, Placidus = 독립 보조 신호.
TOPIC_SPECS = {
    "금전": {"icon":"💵","targets":{"Venus":1.0,"Jupiter":.90,"Mercury":.65,"Saturn":.50,"Moon":.25,"MC":.30},"transits":{"Venus":1.0,"Jupiter":.95,"Mercury":.70,"Saturn":.55,"Mars":.40,"Moon":.35,"Uranus":.35},"houses":{2:1.0,8:.70,11:.80,10:.30},"ruler_houses":[2,8,11]},
    "투자심리": {"icon":"📈","targets":{"Mercury":.90,"Mars":.80,"Jupiter":.75,"Saturn":.70,"Uranus":.65,"Moon":.40},"transits":{"Mercury":.90,"Mars":.85,"Jupiter":.80,"Saturn":.75,"Uranus":.75,"Moon":.55,"Venus":.45},"houses":{2:.95,5:.80,8:.75,11:.85},"ruler_houses":[2,5,8,11]},
    "학업": {"icon":"📚","targets":{"Mercury":1.0,"Saturn":.80,"Sun":.55,"Mars":.45,"Moon":.35,"MC":.25},"transits":{"Mercury":1.0,"Saturn":.75,"Mars":.55,"Sun":.50,"Moon":.45,"Jupiter":.35},"houses":{3:1.0,6:.80,9:1.0,10:.30},"ruler_houses":[3,6,9]},
    "시험": {"icon":"📝","targets":{"Mercury":1.0,"Jupiter":.80,"Saturn":.85,"Mars":.55,"Moon":.45,"Sun":.45,"MC":.45},"transits":{"Mercury":1.0,"Jupiter":.75,"Saturn":.85,"Mars":.60,"Moon":.55,"Sun":.40},"houses":{3:.85,6:.65,9:1.0,10:.75},"ruler_houses":[3,9,10]},
    "직장": {"icon":"💼","targets":{"MC":1.0,"Sun":.85,"Saturn":.90,"Mercury":.70,"Jupiter":.70,"Mars":.55,"Moon":.30},"transits":{"Saturn":.90,"Jupiter":.85,"Sun":.70,"Mercury":.70,"Mars":.65,"Uranus":.45,"Moon":.30},"houses":{6:.90,10:1.0,2:.45,11:.40},"ruler_houses":[6,10]},
    "이직": {"icon":"🚪","targets":{"MC":1.0,"Jupiter":.90,"Uranus":.90,"Mercury":.70,"Saturn":.65,"Venus":.55,"Sun":.45},"transits":{"Jupiter":.95,"Uranus":1.0,"Mercury":.75,"Saturn":.70,"Venus":.60,"Sun":.45,"Mars":.40},"houses":{6:.55,10:1.0,2:.55,9:.65,11:.75},"ruler_houses":[6,10,11]},
    "연애": {"icon":"💖","targets":{"Venus":1.0,"Moon":.85,"Mars":.65,"Sun":.45,"Mercury":.35,"ASC":.45},"transits":{"Venus":1.0,"Moon":.85,"Mars":.65,"Mercury":.50,"Jupiter":.55,"Saturn":.35,"Sun":.35},"houses":{5:1.0,7:1.0,1:.35,8:.40},"ruler_houses":[5,7]},
    "연락": {"icon":"💌","targets":{"Mercury":1.0,"Venus":.70,"Moon":.60,"Sun":.30,"ASC":.30},"transits":{"Mercury":1.0,"Moon":.85,"Venus":.70,"Mars":.35,"Jupiter":.30,"Saturn":.25,"Uranus":.35},"houses":{3:1.0,7:.85,1:.25,11:.30},"ruler_houses":[3,7]},
    "재회": {"icon":"🔄","targets":{"Mercury":.90,"Venus":1.0,"Moon":.80,"Saturn":.65,"Pluto":.55,"ASC":.25},"transits":{"Mercury":.90,"Venus":1.0,"Moon":.75,"Saturn":.65,"Jupiter":.45,"Uranus":.45,"Pluto":.55},"houses":{3:.65,5:.80,7:1.0,8:.45,12:.40},"ruler_houses":[5,7,12]},
    "소식": {"icon":"📨","targets":{"Mercury":1.0,"Moon":.65,"Jupiter":.60,"Uranus":.60,"MC":.45,"Sun":.30},"transits":{"Mercury":1.0,"Moon":.80,"Jupiter":.60,"Uranus":.65,"Saturn":.35,"Sun":.30},"houses":{3:1.0,9:.70,10:.70,11:.70},"ruler_houses":[3,9,10,11]},
    "컨디션": {"icon":"🌿","targets":{"Moon":1.0,"Sun":.85,"Mars":.55,"Saturn":.55,"ASC":.80},"transits":{"Moon":1.0,"Sun":.60,"Mars":.65,"Saturn":.65,"Neptune":.35,"Jupiter":.25},"houses":{1:1.0,6:.90,12:.80},"ruler_houses":[1,6,12]},
}

DISPLAY_LABELS = {"금전":"일반 금전운","학업":"공부운","시험":"시험운","직장":"직장운","이직":"이직운","연애":"연애운","연락":"연락운","재회":"재회·과거인연","소식":"소식·문서운","컨디션":"건강·컨디션운"}

RETURN_CONFIG = {"Moon":{"window_days":35,"step_hours":1.0},"Sun":{"window_days":370,"step_hours":12.0},"Mercury":{"window_days":400,"step_hours":6.0},"Venus":{"window_days":450,"step_hours":12.0},"Mars":{"window_days":800,"step_hours":12.0}}

# ============================================================
# 2. EPHEMERIS / TIME
# ============================================================
@st.cache_resource
def load_ephemeris():
    ts_local = load.timescale()
    try:
        eph_local = load("de440s.bsp")
        return ts_local, eph_local, "DE440s", None
    except Exception as exc:
        eph_local = load("de421.bsp")
        return ts_local, eph_local, "DE421 (fallback)", str(exc)


ts, eph, EPHEMERIS_USED, EPHEMERIS_FALLBACK_REASON = load_ephemeris()
earth = eph["earth"]


def resolve_planet_targets():
    targets, used = {}, {}
    for body, candidates in PLANET_KEYS.items():
        last_error = None
        for candidate in candidates:
            try:
                targets[body] = eph[candidate]
                used[body] = candidate
                break
            except (KeyError, ValueError) as exc:
                last_error = exc
        else:
            raise KeyError(f"{EPHEMERIS_USED}에서 {body} target을 찾지 못했습니다: {last_error}")
    return targets, used


BODY_TARGETS, BODY_TARGET_KEYS = resolve_planet_targets()


def sf_time(dt_aware):
    return ts.from_datetime(dt_aware.astimezone(UTC))


def to_jd_ut(dt_utc):
    dt_utc = dt_utc.astimezone(UTC)
    hour = dt_utc.hour + dt_utc.minute/60 + dt_utc.second/3600 + dt_utc.microsecond/3_600_000_000
    return swe.julday(dt_utc.year, dt_utc.month, dt_utc.day, hour, swe.GREG_CAL)


def get_tropical_ecliptic_lon(body_name, time_obj):
    apparent = earth.at(time_obj).observe(BODY_TARGETS[body_name]).apparent()
    _, lon, _ = apparent.frame_latlon(ecliptic_frame)
    return float(lon.degrees % 360.0)


def get_tropical_ecliptic_lons(body_name, time_objs):
    apparent = earth.at(time_objs).observe(BODY_TARGETS[body_name]).apparent()
    _, lon, _ = apparent.frame_latlon(ecliptic_frame)
    return np.mod(np.asarray(lon.degrees, dtype=float), 360.0)


def get_sign_and_degree(lon):
    lon = lon % 360.0
    return SIGNS_KO[int(lon//30)], lon % 30.0, int(lon//30)


def circular_delta(a,b):
    return (a-b+180.0)%360.0-180.0


def circular_delta_array(a,b):
    return (np.asarray(a)-b+180.0)%360.0-180.0


def angular_separation(a,b):
    return abs(circular_delta(a,b))

# ============================================================
# 3. HOUSES / ANGLES
# ============================================================
def compute_houses(dt_utc, latitude, longitude):
    jd_ut = to_jd_ut(dt_utc)
    placidus_cusps, ascmc = swe.houses_ex(jd_ut, float(latitude), float(longitude), b"P", 0)
    asc, mc, vertex = float(ascmc[0]%360), float(ascmc[1]%360), float(ascmc[3]%360)
    asc_sign = int(asc//30)
    whole_cusps = [float(((asc_sign+i)%12)*30.0) for i in range(12)]
    return {"jd_ut":jd_ut,"asc":asc,"mc":mc,"vertex":vertex,"whole_cusps":whole_cusps,"placidus_cusps":[float(x%360) for x in placidus_cusps]}


def whole_sign_house(lon, natal_asc_lon):
    return (int((lon%360)//30) - int((natal_asc_lon%360)//30)) % 12 + 1


def cusp_house(lon, cusps):
    lon %= 360.0
    for i in range(12):
        start, end = cusps[i]%360.0, cusps[(i+1)%12]%360.0
        span, pos = (end-start)%360.0, (lon-start)%360.0
        if span > 0 and pos < span:
            return i+1
    return None


def house_ruler(house_no, natal_asc_lon):
    asc_sign = int((natal_asc_lon%360)//30)
    return TRADITIONAL_RULER_BY_SIGN[(asc_sign + house_no - 1)%12]


def sun_altitude_degrees(dt_utc, latitude, longitude):
    observer = earth + wgs84.latlon(latitude_degrees=float(latitude), longitude_degrees=float(longitude))
    apparent = observer.at(sf_time(dt_utc)).observe(eph["sun"]).apparent()
    alt, _, _ = apparent.altaz()
    return float(alt.degrees)


def is_day_chart(dt_utc, latitude, longitude):
    return sun_altitude_degrees(dt_utc, latitude, longitude) > 0.0


def calculate_pof(asc_lon, sun_lon, moon_lon, day_chart):
    return (asc_lon + moon_lon - sun_lon) % 360 if day_chart else (asc_lon + sun_lon - moon_lon) % 360

# ============================================================
# 4. ASPECT ENGINE
# ============================================================
def max_orb_for(body, aspect_name):
    # 지나치게 넓은 단일 오브 대신 이동 속도/애스펙트 중요도에 따라 제한.
    if body == "Moon":
        base = 2.6
    elif body in {"Sun","Mercury","Venus","Mars"}:
        base = 3.0
    else:
        base = 2.5
    if aspect_name in {"합","충"}:
        base += 0.35
    return base


def orb_weight(orb, max_orb):
    if orb <= .40: return 1.0
    if orb <= .90: return .86
    if orb <= 1.60: return .68
    if orb <= 2.30: return .50
    if orb <= max_orb: return .32
    return 0.0


def motion_window_hours(body):
    if body == "Moon": return .25
    if body in {"Sun","Mercury","Venus","Mars"}: return 1.0
    return 6.0


def planet_snapshot(body, query_dt_utc):
    h = motion_window_hours(body)
    past, future = query_dt_utc - timedelta(hours=h), query_dt_utc + timedelta(hours=h)
    lon_now = get_tropical_ecliptic_lon(body, sf_time(query_dt_utc))
    lon_past = get_tropical_ecliptic_lon(body, sf_time(past))
    lon_future = get_tropical_ecliptic_lon(body, sf_time(future))
    speed = circular_delta(lon_future, lon_past) / ((2*h)/24.0)
    direction = "순행" if speed > .002 else "역행" if speed < -.002 else "정지권"
    return {"lon":lon_now,"past_lon":lon_past,"future_lon":lon_future,"speed":speed,"direction":direction}


def analyze_aspect_from_snapshot(body, snapshot, natal_lon):
    candidates = []
    for name, spec in ASPECTS.items():
        orb = abs(angular_separation(snapshot["lon"], natal_lon) - spec["angle"])
        max_orb = max_orb_for(body, name)
        if orb > max_orb:
            continue
        orb_past = abs(angular_separation(snapshot["past_lon"], natal_lon)-spec["angle"])
        orb_future = abs(angular_separation(snapshot["future_lon"], natal_lon)-spec["angle"])
        if orb <= EXACT_ORB:
            motion, motion_mult = "정확(Exact)", 1.15
        else:
            slope = orb_future - orb_past
            if slope < -1e-5: motion, motion_mult = "적용(Applying)", 1.08
            elif slope > 1e-5: motion, motion_mult = "분리(Separating)", .92
            else: motion, motion_mult = "변화 미미", 1.0
        candidates.append({"name":name,"angle":spec["angle"],"orb":orb,"orb_weight":orb_weight(orb,max_orb),"motion":motion,"motion_mult":motion_mult,"activation_mult":spec["activation"],"base_polarity":spec["polarity"]})
    return min(candidates, key=lambda x:x["orb"]) if candidates else None


def build_transit_records_subset(query_dt_utc, natal_lons, natal_houses, bodies):
    natal_core = dict(natal_lons)
    natal_core["ASC"], natal_core["MC"] = natal_houses["asc"], natal_houses["mc"]
    snapshots = {body:planet_snapshot(body, query_dt_utc) for body in bodies}
    records = []
    for body, snap in snapshots.items():
        w_house = whole_sign_house(snap["lon"], natal_houses["asc"])
        p_house = cusp_house(snap["lon"], natal_houses["placidus_cusps"])
        for target, target_lon in natal_core.items():
            asp = analyze_aspect_from_snapshot(body, snap, target_lon)
            if asp:
                records.append({"layer":LAYER_BY_TRANSIT[body],"transit":body,"target":target,"whole_house":w_house,"placidus_house":p_house,"speed":snap["speed"],"direction":snap["direction"],**asp})
    records.sort(key=lambda r:(r["orb"],-r["orb_weight"]))
    return snapshots, records


def build_transit_records(query_dt_utc, natal_lons, natal_houses):
    return build_transit_records_subset(query_dt_utc, natal_lons, natal_houses, list(PLANET_KEYS))

# ============================================================
# 5. TOPIC SCORING
# ============================================================
def clamp(x, low=0.0, high=100.0):
    return max(low, min(high, x))


def aspect_polarity(record):
    base = record["base_polarity"]
    transit_tone = PLANET_TONE.get(record["transit"],0.0)
    target_tone = PLANET_TONE.get(record["target"],0.0)
    if record["name"] == "합":
        value = .70*transit_tone + .30*target_tone
    else:
        value = .75*base + .30*transit_tone + .10*target_tone
    return max(-1.0,min(1.0,value))


def target_weight_for_topic(spec, target, natal_asc_lon):
    weight = spec["targets"].get(target,0.0)
    if target in PLANET_KEYS:
        rulers = {house_ruler(h,natal_asc_lon) for h in spec["ruler_houses"]}
        if target in rulers:
            weight += .18
    return weight


def direction_modifier(topic, body, direction):
    # 역행은 '무조건 나쁨'이 아니라 재검토/과거 재활성 여부에 따라 다르게 처리.
    if direction == "정지권":
        return 1.06, 0.0
    if direction != "역행":
        return 1.0, 0.0
    if topic == "재회" and body in {"Mercury","Venus"}:
        return 1.10, -0.02
    if topic in {"연락","소식"} and body == "Mercury":
        return 1.02, -0.07
    if topic in {"직장","이직","시험","학업"} and body == "Mercury":
        return .98, -0.05
    return 1.0, -0.02


def score_topic(topic_name, transit_records, snapshots, natal_houses):
    spec = TOPIC_SPECS[topic_name]
    raw_activation = 0.0
    polarity_num = 0.0
    polarity_den = 0.0
    evidences = []
    layers = set()

    for rec in transit_records:
        transit_w = spec["transits"].get(rec["transit"],0.0)
        target_w = target_weight_for_topic(spec, rec["target"], natal_houses["asc"])
        if transit_w <= 0 or target_w <= 0:
            continue
        dir_mult, dir_pol = direction_modifier(topic_name, rec["transit"], rec["direction"])
        contribution = rec["orb_weight"]*rec["motion_mult"]*rec["activation_mult"]*transit_w*target_w*dir_mult
        if contribution <= 0:
            continue
        pol = max(-1.0,min(1.0,aspect_polarity(rec)+dir_pol))
        raw_activation += contribution
        polarity_num += contribution*pol
        polarity_den += contribution
        layers.add(rec["layer"])
        evidences.append({"kind":"aspect","score":contribution,"polarity":pol,"transit":rec["transit"],"target":rec["target"],"aspect":rec["name"],"orb":rec["orb"],"motion":rec["motion"],"direction":rec["direction"]})

    # Whole Sign 주 가중치 + Placidus 독립 보조 가중치.
    for body, snap in snapshots.items():
        transit_w = spec["transits"].get(body,0.0)
        if transit_w <= 0:
            continue
        w_house = whole_sign_house(snap["lon"], natal_houses["asc"])
        p_house = cusp_house(snap["lon"], natal_houses["placidus_cusps"])
        w_weight = spec["houses"].get(w_house,0.0)
        p_weight = spec["houses"].get(p_house,0.0) if p_house else 0.0
        house_contrib = .22*transit_w*w_weight + .09*transit_w*p_weight
        if house_contrib <= 0:
            continue
        raw_activation += house_contrib
        layers.add(LAYER_BY_TRANSIT[body])
        evidences.append({"kind":"house","score":house_contrib,"polarity":0.0,"transit":body,"whole_house":w_house,"placidus_house":p_house,"whole_relevant":bool(w_weight),"placidus_relevant":bool(p_weight)})

    strong_count = sum(1 for e in evidences if e["kind"]=="aspect" and e["score"]>=.50)
    stacking_bonus = min(7.0, max(0,len(layers)-1)*2.0 + min(3,strong_count)*.8)
    activation = clamp(raw_activation*18.0 + stacking_bonus)
    if polarity_den:
        favorability = clamp(50.0 + (polarity_num/polarity_den)*40.0)
    else:
        favorability = 50.0
    evidences.sort(key=lambda x:x["score"], reverse=True)
    return {"topic":topic_name,"activation":int(round(activation)),"favorability":int(round(favorability)),"layers":sorted(layers),"evidence":evidences}


def blend_topic(result, activation_weight=.46):
    return int(round(clamp(activation_weight*result["activation"] + (1-activation_weight)*result["favorability"])))


def derived_action_scores(topic_results):
    money, invest = topic_results["금전"], topic_results["투자심리"]
    overheat = max(0.0, invest["activation"]-invest["favorability"])
    realize = clamp(.40*money["activation"] + .40*money["favorability"] + .20*(100-.70*overheat))
    entry = clamp(.25*money["activation"] + .35*money["favorability"] + .15*invest["activation"] + .25*invest["favorability"] - .25*overheat)
    risk = clamp(.55*invest["activation"] + .45*(100-invest["favorability"]) + .15*overheat)
    out = {k:blend_topic(v) for k,v in topic_results.items() if k != "투자심리"}
    out.update({"수익실현":int(round(realize)),"신규진입":int(round(entry)),"투자주의":int(round(risk))})
    return out


def context_at_kst(dt_kst, natal_lons, natal_houses):
    snapshots, records = build_transit_records(dt_kst.astimezone(UTC), natal_lons, natal_houses)
    topic_results = {topic:score_topic(topic,records,snapshots,natal_houses) for topic in TOPIC_SPECS}
    return {"dt":dt_kst,"snapshots":snapshots,"records":records,"topics":topic_results,"actions":derived_action_scores(topic_results)}

# ============================================================
# 6. MARKET CALENDAR
# ============================================================
@st.cache_resource
def get_krx_calendar():
    if xcals is None:
        return None
    try:
        return xcals.get_calendar("XKRX")
    except Exception:
        return None


KRX = get_krx_calendar()


def is_krx_session(day_value):
    if KRX is None:
        # 라이브러리 로드 실패 시 주말은 확실히 휴장. 공휴일 정확성은 검증 탭에서 경고.
        return day_value.weekday() < 5
    try:
        return bool(KRX.is_session(pd.Timestamp(day_value.isoformat())))
    except Exception:
        return day_value.weekday() < 5


def krx_sessions_in_range(start_date, end_date):
    return [d for d in (start_date + timedelta(days=i) for i in range((end_date-start_date).days+1)) if is_krx_session(d)]


def next_krx_session(after_date, max_days=14):
    for i in range(1,int(max_days)+1):
        candidate=after_date+timedelta(days=i)
        if is_krx_session(candidate):
            return candidate
    return None

# ============================================================
# 7. SCANS / PERIOD AGGREGATION
# ============================================================
def pack_natal_lons(natal_lons):
    return tuple((body,float(natal_lons[body])) for body in PLANET_KEYS)


def unpack_natal_lons(packed):
    return {body:float(v) for body,v in packed}


def pack_houses(houses):
    return (float(houses["asc"]),float(houses["mc"]),float(houses["vertex"]),tuple(float(x) for x in houses["whole_cusps"]),tuple(float(x) for x in houses["placidus_cusps"]))


def unpack_houses(packed):
    asc,mc,vertex,whole,placidus=packed
    return {"asc":asc,"mc":mc,"vertex":vertex,"whole_cusps":list(whole),"placidus_cusps":list(placidus)}


def make_kst_time_points(day_value,start_time,end_time,step_minutes):
    start_dt=KST.localize(datetime.combine(day_value,start_time)); end_dt=KST.localize(datetime.combine(day_value,end_time))
    points=[]; cur=start_dt; step=timedelta(minutes=step_minutes)
    while cur<=end_dt:
        points.append(cur); cur += step
    return points


def scan_intraday(day_value,start_time,end_time,step_minutes,natal_lons,natal_houses):
    points=make_kst_time_points(day_value,start_time,end_time,step_minutes)
    if not points: return []
    midpoint=points[len(points)//2]
    static_bodies=["Jupiter","Saturn","Uranus","Neptune","Pluto"]
    dynamic_bodies=["Sun","Moon","Mercury","Venus","Mars"]
    static_snapshots, static_records = build_transit_records_subset(midpoint.astimezone(UTC),natal_lons,natal_houses,static_bodies)
    rows=[]
    for point in points:
        dyn_snap,dyn_rec=build_transit_records_subset(point.astimezone(UTC),natal_lons,natal_houses,dynamic_bodies)
        snapshots={**static_snapshots,**dyn_snap}; records=static_records+dyn_rec
        topics={topic:score_topic(topic,records,snapshots,natal_houses) for topic in TOPIC_SPECS}
        rows.append({"dt":point,**derived_action_scores(topics),"topics":topics})
    return rows


@st.cache_data(ttl=21600, show_spinner=False)
def cached_intraday_scan(day_iso,start_hm,end_hm,step_minutes,natal_packed,houses_packed):
    return scan_intraday(date.fromisoformat(day_iso),dt_time.fromisoformat(start_hm),dt_time.fromisoformat(end_hm),int(step_minutes),unpack_natal_lons(natal_packed),unpack_houses(houses_packed))


def rows_avg(rows,key):
    vals=[r.get(key) for r in rows if isinstance(r.get(key),(int,float)) and not pd.isna(r.get(key))]
    return int(round(sum(vals)/len(vals))) if vals else None


def row_topic_evidence(rows, topic):
    # 하루 여러 샘플 중 기여도가 큰 근거를 합쳐 중복 제거.
    pool=[]
    for row in rows:
        result=row.get("topics",{}).get(topic)
        if result:
            pool.extend(result.get("evidence",[])[:5])
    seen=set(); out=[]
    for e in sorted(pool,key=lambda x:x.get("score",0),reverse=True):
        if e.get("kind")=="aspect": key=("a",e.get("transit"),e.get("target"),e.get("aspect"),e.get("motion"))
        else: key=("h",e.get("transit"),e.get("whole_house"),e.get("placidus_house"))
        if key in seen: continue
        seen.add(key); out.append(e)
        if len(out)>=6: break
    return out




def aggregate_topic_result(rows, topic):
    results=[row.get("topics",{}).get(topic) for row in rows]
    results=[r for r in results if r]
    if not results:
        return {"topic":topic,"activation":0,"favorability":50,"layers":[],"evidence":[]}
    activation=int(round(sum(r["activation"] for r in results)/len(results)))
    favorability=int(round(sum(r["favorability"] for r in results)/len(results)))
    layers=sorted({layer for r in results for layer in r.get("layers",[])})
    return {"topic":topic,"activation":activation,"favorability":favorability,"layers":layers,"evidence":row_topic_evidence(rows,topic)}

def daily_aggregate(day_value,natal_packed,houses_packed,life_step=120,market_step=60):
    # 주/월 비교용: 하루 한 시각이 아니라 여러 시각 샘플을 평균.
    life=cached_intraday_scan(day_value.isoformat(),"08:00:00","22:00:00",life_step,natal_packed,houses_packed)
    market=[]
    if is_krx_session(day_value):
        market=cached_intraday_scan(day_value.isoformat(),"09:00:00","15:30:00",market_step,natal_packed,houses_packed)
    keys=["금전","학업","시험","직장","이직","연애","연락","재회","소식","컨디션"]
    row={"date":day_value,"label":f"{day_value.month}/{day_value.day}({WEEKDAY_KO[day_value.weekday()]})","market_open":bool(market)}
    for key in keys: row[key]=rows_avg(life,key)
    for key in ["수익실현","신규진입","투자주의"]: row[key]=rows_avg(market,key) if market else None
    return row


@st.cache_data(ttl=21600, show_spinner=False)
def cached_period_scores(start_iso,day_count,natal_packed,houses_packed):
    start=date.fromisoformat(start_iso)
    return [daily_aggregate(start+timedelta(days=i),natal_packed,houses_packed) for i in range(int(day_count))]


def period_values(rows,key):
    return [r[key] for r in rows if isinstance(r.get(key),(int,float)) and not pd.isna(r.get(key))]


def period_avg(rows,key):
    vals=period_values(rows,key)
    return int(round(sum(vals)/len(vals))) if vals else None


def period_extreme(rows,key,highest=True):
    valid=[r for r in rows if isinstance(r.get(key),(int,float)) and not pd.isna(r.get(key))]
    if not valid: return None
    return (max if highest else min)(valid,key=lambda r:r[key])


def top_period_days(rows,key,top_n=3,reverse=True):
    valid=[r for r in rows if isinstance(r.get(key),(int,float)) and not pd.isna(r.get(key))]
    return sorted(valid,key=lambda r:r[key],reverse=reverse)[:top_n]


def rolling_top_windows(rows,key,window_slots=3,top_n=2):
    if not rows: return []
    window_slots=max(1,min(window_slots,len(rows)))
    step=rows[1]["dt"]-rows[0]["dt"] if len(rows)>1 else timedelta(minutes=30)
    candidates=[]
    for i in range(len(rows)-window_slots+1):
        vals=[rows[j].get(key) for j in range(i,i+window_slots)]
        if any(v is None for v in vals): continue
        candidates.append({"start_idx":i,"end_idx":i+window_slots-1,"start":rows[i]["dt"],"end":rows[i+window_slots-1]["dt"]+step,"score":int(round(sum(vals)/len(vals))),"center_row":rows[i+window_slots//2]})
    candidates.sort(key=lambda x:x["score"],reverse=True)
    selected=[]
    for c in candidates:
        if any(not(c["end_idx"]<s["start_idx"]-1 or c["start_idx"]>s["end_idx"]+1) for s in selected): continue
        selected.append(c)
        if len(selected)>=top_n: break
    return selected


def rolling_bottom_windows(rows,key,window_slots=3,top_n=1):
    """낮은 점수 구간. 일상 분야에서는 '덜 유리한/주의' 시간대용."""
    if not rows: return []
    window_slots=max(1,min(window_slots,len(rows)))
    step=rows[1]["dt"]-rows[0]["dt"] if len(rows)>1 else timedelta(minutes=30)
    candidates=[]
    for i in range(len(rows)-window_slots+1):
        vals=[rows[j].get(key) for j in range(i,i+window_slots)]
        if any(v is None for v in vals): continue
        candidates.append({"start_idx":i,"end_idx":i+window_slots-1,"start":rows[i]["dt"],"end":rows[i+window_slots-1]["dt"]+step,"score":int(round(sum(vals)/len(vals))),"center_row":rows[i+window_slots//2]})
    candidates.sort(key=lambda x:x["score"])
    selected=[]
    for c in candidates:
        if any(not(c["end_idx"]<s["start_idx"]-1 or c["start_idx"]>s["end_idx"]+1) for s in selected): continue
        selected.append(c)
        if len(selected)>=top_n: break
    return selected


TOPIC_TIMING_HOURS = {
    "금전":(7,23), "학업":(6,24), "시험":(6,24), "직장":(8,21), "이직":(7,23),
    "연애":(0,24), "연락":(0,24), "재회":(0,24), "소식":(7,23), "컨디션":(0,24),
}


def topic_timing_data(rows,key,window_slots=3):
    """하루 안에서 같은 분야끼리 비교한 좋은 구간/덜 유리한 구간/피크.
    직장·금전 같은 분야는 실제 활용 가능한 활동 시간으로 제한하고, 관계·연락은 24시간을 본다.
    """
    start_h,end_h=TOPIC_TIMING_HOURS.get(key,(0,24))
    rows=[r for r in rows if start_h <= r["dt"].hour < end_h]
    valid=[(i,r.get(key)) for i,r in enumerate(rows) if isinstance(r.get(key),(int,float)) and not pd.isna(r.get(key))]
    if not valid:
        return None
    scores=[v for _,v in valid]
    bests=rolling_top_windows(rows,key,window_slots,1)
    lows=rolling_bottom_windows(rows,key,window_slots,1)
    best=bests[0] if bests else None
    low=lows[0] if lows else None
    peak_row=None; low_row=None
    if best:
        subset=rows[best["start_idx"]:best["end_idx"]+1]
        peak_row=max(subset,key=lambda r:r.get(key,-10**9))
    if low:
        subset=rows[low["start_idx"]:low["end_idx"]+1]
        low_row=min(subset,key=lambda r:r.get(key,10**9))
    return {
        "best":best,
        "low":low,
        "peak_row":peak_row,
        "low_row":low_row,
        "spread":int(round(max(scores)-min(scores))),
        "day_max":int(round(max(scores))),
        "day_min":int(round(min(scores))),
    }


def investment_prep_rows(rows):
    """휴장일용 비매매 준비 지수. 실제 거래 신호와 분리한다."""
    out=[]
    for row in rows:
        if not (7 <= row["dt"].hour < 24):
            continue
        money=row.get("금전"); risk=row.get("투자주의"); news=row.get("소식")
        if not all(isinstance(v,(int,float)) for v in (money,risk,news)):
            continue
        # 돈 판단 + 정보 정리 + 과열 억제를 묶은 '준비/검토' 참고값.
        prep=clamp(.45*money + .20*news + .35*(100-risk))
        out.append({"dt":row["dt"],"투자준비":int(round(prep)),"투자주의":int(round(risk))})
    return out

# ============================================================
# 8. HUMAN READABLE INTERPRETATION · V5.3 TIMING + ACTION
# ============================================================
def score_band(score):
    """사용자용 강도 라벨. 40점대가 갑자기 '보통'으로 보이지 않도록 세분화."""
    if score is None: return "해당 없음"
    if score>=82:return "매우 강함"
    if score>=70:return "강함"
    if score>=60:return "보통 이상"
    if score>=50:return "보통"
    if score>=40:return "다소 약함"
    if score>=30:return "약함"
    return "매우 약함"


def score_level(score):
    if score is None:return "none"
    if score>=70:return "strong"
    if score>=60:return "upper"
    if score>=50:return "mid"
    if score>=40:return "lower"
    return "weak"


# 메인 본문은 천문학 내부 용어 대신 '그래서 현실에서 무엇을 뜻하는지'를 바로 말한다.
TOPIC_STATE_COPY = {
    "금전": {
        "strong":"돈과 관련된 선택을 정리하거나 실제 결정을 내리기 좋은 흐름이야.",
        "upper":"예산·구매·상환처럼 돈과 관련된 결정을 구체적으로 비교하기 괜찮은 날이야.",
        "mid":"큰 금전 변화보다는 평소 수입·지출을 얼마나 잘 관리하느냐가 중요한 날이야.",
        "lower":"돈이 크게 풀리는 날이라기보다 지출과 예산을 보수적으로 관리하는 쪽이 유리해.",
        "weak":"큰 수입이나 뜻밖의 금전 호재를 기대하기보다는 새는 돈을 막는 쪽이 더 중요한 날이야.",
    },
    "학업": {
        "strong":"이해한 내용을 빠르게 연결하고 기억에서 꺼내 쓰는 흐름이 좋은 편이야.",
        "upper":"집중과 이해가 비교적 잘 붙어서 난도 있는 공부를 밀어볼 만한 날이야.",
        "mid":"공부가 아주 잘 풀리는 날도, 완전히 막히는 날도 아니야. 과제 선택에 따라 효율 차이가 커.",
        "lower":"새 범위를 빠르게 넓히기보다 이미 본 내용을 회수하고 정리하는 쪽이 효율적이야.",
        "weak":"집중이 저절로 붙는 날은 아니야. 진도를 욕심내기보다 짧은 회독·암기 확인·오답 정리가 더 남아.",
    },
    "시험": {
        "strong":"실전에서 문제를 판단하고 준비한 내용을 꺼내 쓰는 흐름이 강한 편이야.",
        "upper":"시험·모의고사에서 준비한 실력을 비교적 안정적으로 꺼내기 좋은 흐름이야.",
        "mid":"시험운 자체가 결과를 끌어주기보다 준비도와 시간 관리가 그대로 성적에 반영되기 쉬워.",
        "lower":"실전에서는 아는 문제도 서두르거나 시간 배분이 꼬이면 점수를 잃기 쉬운 날이야.",
        "weak":"운이 실수를 덮어주는 날은 아니야. 어려운 문제보다 확실히 맞힐 문제부터 점수를 확보하는 전략이 중요해.",
    },
    "직장": {
        "strong":"업무 성과나 존재감을 드러내고 중요한 일을 진전시키기 좋은 흐름이야.",
        "upper":"업무 처리와 평가 흐름이 비교적 받쳐줘서 중요한 과제를 앞에 두기 좋아.",
        "mid":"직장에서 큰 변화보다는 맡은 일을 얼마나 정확하게 처리하느냐가 더 중요한 날이야.",
        "lower":"새 일을 벌이기보다 업무 범위·마감·책임을 분명히 해두는 게 유리해.",
        "weak":"직장 쪽에서 일이 술술 풀리는 날은 아니야. 불필요한 충돌을 줄이고 해야 할 일만 정확히 끝내는 편이 낫다.",
    },
    "이직": {
        "strong":"새 직장·직무·환경으로 움직일 기회를 구체적으로 잡아볼 만한 흐름이야.",
        "upper":"지원·면접·조건 비교처럼 이직을 실제 행동으로 옮기기 괜찮은 시기야.",
        "mid":"이직 생각은 현실적으로 검토할 수 있지만, 지금 당장 옮겨야 한다고 단정할 정도는 아니야.",
        "lower":"움직임 자체보다 선택지를 모으고 조건을 비교하는 준비 단계에 가까운 흐름이야.",
        "weak":"새 기회가 선명하게 열리는 날은 아니야. 퇴사 결정보다 공고 탐색·서류 정비·정보 수집이 더 맞아.",
    },
    "연애": {
        "strong":"호감·만남·감정 교류가 실제 관계 진전으로 이어지기 좋은 흐름이야.",
        "upper":"상대와의 분위기를 부드럽게 만들거나 자연스럽게 가까워지기 괜찮은 날이야.",
        "mid":"관계가 크게 진전되기보다 현재 분위기와 서로의 반응을 확인하는 날에 가까워.",
        "lower":"연애 쪽에서 큰 진전이나 극적인 변화가 강하게 잡히는 날은 아니야.",
        "weak":"새로운 감정 변화나 관계 진전 신호는 약한 편이야. 억지로 분위기를 만들기보다 상대의 실제 반응을 보는 게 정확해.",
    },
    "연락": {
        "strong":"메시지·전화·대화처럼 실제 접촉이 오가고 대화가 이어지기 좋은 흐름이야.",
        "upper":"연락을 시작하거나 끊긴 대화를 다시 이어보기 비교적 괜찮은 날이야.",
        "mid":"연락이 아예 막힌 날은 아니지만, 먼저 접점이 생겨야 흐름이 이어지는 쪽이야.",
        "lower":"먼저 연락이 오가거나 대화가 급진전될 신호는 강하지 않은 편이야.",
        "weak":"연락 자체의 움직임이 약한 날이야. 답이 늦거나 대화가 짧게 끝나도 의미를 크게 부여하지 않는 게 좋아.",
    },
    "재회": {
        "strong":"과거 인연·미완결 감정이 다시 움직이거나 실제 접점으로 이어질 여지가 강해지는 흐름이야.",
        "upper":"과거 관계를 다시 떠올리거나 재접촉 가능성을 살펴볼 만한 흐름이 살아 있어.",
        "mid":"과거 인연 테마는 어느 정도 움직이지만 실제 재접촉까지 이어진다고 단정하기는 어려워.",
        "lower":"과거 인연이 다시 떠오를 수는 있어도 관계가 실제로 다시 움직이는 힘은 아직 약한 편이야.",
        "weak":"과거 관계가 실제 재접촉이나 재결합 쪽으로 움직이는 신호는 뚜렷하지 않아.",
    },
    "소식": {
        "strong":"결과 통보·메일·문서·예상 밖 정보처럼 외부에서 들어오는 소식이 활발해질 수 있는 흐름이야.",
        "upper":"기다리던 답이나 문서가 움직일 가능성을 체크해볼 만한 날이야.",
        "mid":"소식이 올 수도 있지만 시점이나 내용이 크게 두드러지는 날은 아니야.",
        "lower":"기다리던 결과나 연락이 빠르게 들어오는 흐름은 약한 편이야.",
        "weak":"새 소식이 확 들어오는 날이라기보다 기존 일정·메일·문서를 다시 확인하는 쪽이 더 필요한 날이야.",
    },
    "컨디션": {
        "strong":"활력과 회복 리듬이 비교적 잘 받쳐줘서 중요한 일을 앞쪽에 배치하기 좋은 날이야.",
        "upper":"몸과 집중력이 비교적 잘 따라와서 일정 소화력이 괜찮은 편이야.",
        "mid":"컨디션이 크게 치솟거나 무너지기보다 관리한 만큼 유지되는 날이야.",
        "lower":"에너지가 넉넉한 날은 아니야. 일정 사이에 쉬는 시간을 남겨야 후반까지 버틸 수 있어.",
        "weak":"무리해서 밀어붙이기보다 회복을 우선해야 하는 흐름이야. 중요한 판단과 과한 일정은 피곤해지기 전에 끝내는 게 좋아.",
    },
}


def topic_favorability_note(topic, result):
    """활성도와 우호도가 엇갈릴 때 그 차이를 분야별 현실 언어로 설명."""
    a, f = result["activation"], result["favorability"]
    if f >= 62 and a < 45:
        notes = {
            "금전":"큰 변화는 적어도 실제 돈 관련 일이 생기면 비교적 무리 없이 정리될 가능성이 있어.",
            "학업":"집중이 자동으로 올라오진 않아도 일단 시작하면 이해 자체는 비교적 매끄러운 편이야.",
            "시험":"시험 이벤트의 힘은 약해도 실제 응시 상황에서는 지나친 압박보다 안정감이 더 나을 수 있어.",
            "직장":"큰 성과 이벤트는 적어도 평소 업무는 비교적 마찰 없이 처리하기 쉬운 편이야.",
            "이직":"기회 자체는 적어도 들어오는 제안이나 공고가 있다면 조건을 차분히 검토하기 좋아.",
            "연애":"큰 진전은 적어도 실제 만남이나 대화가 생기면 분위기는 비교적 부드럽게 흘러갈 수 있어.",
            "연락":"연락 빈도는 높지 않아도 대화가 시작되면 말이 크게 꼬이지 않고 이어질 가능성이 있어.",
            "재회":"과거 인연의 움직임은 약해도 실제 접점이 생긴다면 감정적으로 크게 부딪히는 흐름은 덜해.",
            "소식":"소식 자체는 많지 않아도 들어오는 정보는 비교적 정리된 형태일 가능성이 있어.",
            "컨디션":"활력이 높진 않아도 몸 상태가 크게 요동치기보다는 안정적으로 관리되는 쪽이야.",
        }
        return notes.get(topic,"")
    if f <= 42:
        notes = {
            "금전":"돈과 관련된 판단에서 만족감과 현실 조건이 어긋날 수 있으니 즉흥 결제나 큰 지출은 한 번 더 확인해.",
            "학업":"공부를 시작해도 헷갈림이나 피로감이 끼기 쉬워서 속도보다 정확도를 챙기는 편이 낫다.",
            "시험":"실전에서는 조급함·오독·시간 배분 실수가 끼어들 여지가 있어. 검산 루틴을 미리 정해두는 게 좋아.",
            "직장":"업무가 움직여도 말이 엇갈리거나 부담이 커질 수 있으니 기록과 책임 범위를 분명히 해두는 게 좋아.",
            "이직":"이직 생각이나 기회가 생겨도 조건 만족도까지 높다는 뜻은 아니야. 연봉·업무·거리·안정성을 따로 비교해.",
            "연애":"감정은 움직여도 분위기가 편하지 않을 수 있어. 상대 반응을 재촉하거나 한 번의 반응으로 관계를 단정하지 마.",
            "연락":"접점이 생겨도 답장 속도나 말의 뉘앙스가 기대와 다를 수 있어. 짧고 명확하게 소통하는 게 낫다.",
            "재회":"과거 감정이 다시 건드려지는 것과 좋은 방향의 재결합은 다른 문제야. 그리움만으로 재회 신호로 단정하지 마.",
            "소식":"소식이 와도 수정·지연·조건 변경이 붙을 수 있으니 문서와 날짜를 재확인해.",
            "컨디션":"할 일은 있어도 몸이 편하게 따라주지 않을 수 있어. 활동량보다 회복과 수면 리듬을 우선해.",
        }
        return notes.get(topic,"")
    return ""


def topic_action(topic, score):
    level = score_level(score)
    low = level in {"weak","lower"}
    if topic=="금전": return "오늘 할 일은 예정 지출·자동결제·예산을 확인하고, 큰 결제는 하루 정도 더 비교해보는 거야." if low else "예산·상환·구매 조건을 숫자로 비교해서 결정하면 좋아."
    if topic=="학업": return "새 진도 하나를 억지로 늘리기보다 회독·암기 테스트·오답 중 하나를 확실히 끝내." if low else "집중이 필요한 새 내용이나 문제풀이를 컨디션 좋은 시간대에 먼저 배치해."
    if topic=="시험": return "쉬운 문제부터 점수를 확보하고, 시간 체크 지점과 마킹 순서를 미리 고정해." if low else "실전 감각을 써먹기 좋은 날이니 시간 제한을 둔 모의풀이와 검산까지 한 세트로 해봐."
    if topic=="직장": return "업무 우선순위·마감·담당 범위를 문서로 남기고 불필요한 감정 대응은 줄여." if low else "중요 업무나 보고를 앞에 두되, 일까지 과하게 떠안지는 마."
    if topic=="이직": return "당장 퇴사 결론보다 공고 저장·조건 비교·이력서 보완처럼 되돌릴 수 있는 행동부터 해." if low else "지원·면접·조건 협상처럼 실제 선택지를 늘리는 행동으로 옮겨볼 만해."
    if topic=="연애": return "관계를 정의하려 하기보다 상대가 대화를 이어가는지, 만나려는 의지가 있는지 같은 실제 행동을 봐." if low else "호감 표현이나 만남 제안은 가볍고 자연스럽게 해도 좋아. 상대의 후속 반응까지 함께 봐."
    if topic=="연락": return "연락한다면 길게 설명하지 말고 답하기 쉬운 한두 문장으로 보내고, 반응이 없으면 재촉하지 마." if low else "연락을 시작하거나 이어가기 괜찮아. 다만 답을 정해놓고 상대 반응을 끌어내려 하진 마."
    if topic=="재회": return "특정 상대가 연락한다고 보는 점수는 아니야. 실제 행동 신호가 없으면 과거 생각이 난다는 것과 재회를 구분해." if low else "과거 인연과 접점이 생기면 말보다 후속 행동이 이어지는지 확인해. 그게 재회 가능성을 가르는 핵심이야."
    if topic=="소식": return "메일함·문자·기관 공지·마감일을 직접 확인하고, 기다리는 결과는 지연 가능성까지 감안해." if low else "중요 알림을 놓치지 않게 확인하고, 들어온 정보는 날짜·조건까지 바로 검토해."
    if topic=="컨디션": return "일정을 촘촘하게 잡지 말고 식사·수분·휴식 시간을 먼저 확보해. 이 점수는 질병 진단이 아니야." if low else "체력이 남아 있을 때 중요한 일을 먼저 끝내고, 괜찮다고 밤까지 무리하진 마."
    return "실제 상황을 우선해서 활용해."


def cross_topic_note(topic, all_scores):
    """서로 의미가 겹치는 분야는 조합으로 읽어 단일 점수 오해를 줄임."""
    if not all_scores:
        return ""
    s = all_scores
    if topic=="재회":
        r, c = s.get("재회"), s.get("연락")
        if r is None or c is None:return ""
        if r>=60 and c<45:return "과거 인연 테마는 살아 있어도 연락운이 낮아서, 생각이나 미련의 재활성화가 실제 연락 행동으로 바로 이어지지 않을 수 있어."
        if r>=60 and c>=60:return "재회·과거인연과 연락운이 같이 올라와서, 과거 관계 테마와 실제 접촉 가능성이 동시에 움직이는 조합이야."
        if r<45 and c>=60:return "연락운은 더 높지만 재회 신호는 약해. 연락이 생겨도 반드시 과거 인연의 재등장이라고 해석할 근거는 약한 편이야."
    if topic=="연락":
        c, r, l = s.get("연락"), s.get("재회"), s.get("연애")
        if c is None:return ""
        if c>=60 and r>=60:return "연락운과 과거인연 흐름이 함께 높아서, 일반적인 연락보다 과거 관계가 다시 접점으로 들어오는 가능성을 함께 봐야 해."
        if c>=60 and (r or 0)<45:return "연락운은 살아 있지만 재회운은 낮아서, 연락 이벤트가 생겨도 특정 과거 인연과 연결해 단정하진 않는 게 맞아."
        if c<45 and (l or 0)>=60:return "감정·호감 흐름에 비해 실제 연락 움직임은 약해. 마음이 있어도 표현이나 접촉이 늦을 수 있는 조합이야."
    if topic=="연애":
        l, c = s.get("연애"), s.get("연락")
        if l is None or c is None:return ""
        if l>=60 and c<45:return "호감이나 감정 흐름에 비해 연락운이 약해서, 감정이 있어도 표현이나 접촉 빈도는 따라오지 않을 수 있어."
        if l<45 and c>=60:return "연락은 오갈 수 있어도 연애운은 약해. 대화가 생긴다는 것과 관계가 깊어진다는 것은 따로 봐야 해."
    if topic=="시험":
        e, study, cond = s.get("시험"), s.get("학업"), s.get("컨디션")
        if e is None:return ""
        if e<50 and (study or 0)>=55:return "공부 흐름보다 실전 수행 쪽이 약해. 아는 내용을 늘리는 것보다 시간 제한 안에서 꺼내 쓰는 연습이 더 필요해."
        if e>=60 and (cond or 100)<40:return "시험 수행 흐름은 괜찮아도 컨디션이 약하면 체감이 깎일 수 있어. 수면과 식사 관리가 점수 활용의 전제야."
    if topic=="학업":
        study, cond = s.get("학업"), s.get("컨디션")
        if study is not None and study>=60 and (cond or 100)<40:return "공부운은 괜찮아도 컨디션이 약해 오래 버티기 어렵다. 긴 시간보다 집중 구간을 짧게 나눠 써."
    if topic=="이직":
        move, work = s.get("이직"), s.get("직장")
        if move is None or work is None:return ""
        if move>=60 and work<45:return "현재 직장 흐름보다 이동 쪽이 상대적으로 살아 있어. 불만 때문에 즉시 퇴사하기보다 실제 대안의 조건을 확인하는 게 중요해."
        if move<45 and work>=60:return "이직운보다 현재 직장운이 더 받쳐줘. 당장 이동보다 지금 자리에서 성과·조건을 개선하는 선택도 같이 볼 만해."
    if topic=="소식":
        news, contact = s.get("소식"), s.get("연락")
        if news is not None and news>=60 and (contact or 0)<45:return "사적인 연락운은 약해도 문서·기관·결과 통보 같은 공식적인 소식 흐름은 따로 살아 있을 수 있어."
    return ""


def evidence_to_korean(e):
    if e.get("kind")=="aspect":
        t=PLANET_KO.get(e.get("transit"),e.get("transit")); target=PLANET_KO.get(e.get("target"),e.get("target"))
        direction=e.get("direction",""); motion=e.get("motion","")
        return f"{t}가 네이탈 {target}과 {e.get('aspect')} · 오브 {e.get('orb',0):.2f}° · {motion} · {direction}"
    t=PLANET_KO.get(e.get("transit"),e.get("transit")); w=e.get("whole_house"); p=e.get("placidus_house")
    if e.get("whole_relevant") and e.get("placidus_relevant"):
        return f"{t}가 Whole Sign {w}H와 Placidus {p}H에서 해당 테마를 동시에 자극"
    if e.get("whole_relevant"):
        return f"{t}가 Whole Sign {w}H에서 해당 테마를 활성"
    return f"{t}가 Placidus {p}H에서 보조 신호를 형성"


def topic_decision_note(topic, score, timing=None):
    """관계/연락/소식 분야에서 사용자가 바로 행동으로 옮길 수 있는 한 줄 결론."""
    if score is None:
        return ""
    best_text=""
    if timing and timing.get("best"):
        b=timing["best"]
        best_text=f" 가능하면 {b['start'].strftime('%H:%M')}~{b['end'].strftime('%H:%M')} KST 쪽이 상대적으로 낫다."
    if topic=="연락":
        if score>=60:return "먼저 연락해도 돼? → 가볍게 시작해도 괜찮아."+best_text
        if score>=45:return "먼저 연락해도 돼? → 목적이 분명하면 짧게 한 번 정도는 괜찮아."+best_text
        return "먼저 연락해도 돼? → 특별히 해야 할 이유가 없다면 기다리는 편이 낫다. 꼭 보내야 한다면 답하기 쉬운 한두 문장만 보내."+best_text
    if topic=="연애":
        if score>=60:return "만남·호감 표현을 해도 돼? → 자연스럽게 제안해볼 만해. 다만 후속 반응까지 확인해."+best_text
        if score>=45:return "관계를 밀어도 돼? → 가벼운 만남·대화는 괜찮지만 확답이나 관계 정의는 서두르지 마."+best_text
        return "관계를 밀어도 돼? → 고백·확답 요구보다 상대의 자발적인 행동을 보는 편이 낫다."+best_text
    if topic=="재회":
        if score>=60:return "재회 쪽으로 움직여도 돼? → 접점이 생기면 대화는 가능하지만, 말보다 실제 후속 행동을 기준으로 봐."+best_text
        if score>=45:return "재회 확인을 위해 먼저 움직여도 돼? → 확인성 연락보다 자연스러운 접점이 생기는지 먼저 보는 게 낫다."+best_text
        return "재회를 확인하려 먼저 연락해도 돼? → 지금 점수만으로는 권하지 않아. 그리움과 실제 재접촉 신호를 분리해서 봐."+best_text
    if topic=="소식":
        if score>=60:return "기다리는 결과를 확인해도 돼? → 메일·문자·기관 공지를 적극적으로 확인해볼 만해."+best_text
        if score>=45:return "확인 문의해도 돼? → 약속된 확인일이 지났다면 짧고 명확하게 문의하는 건 괜찮아."+best_text
        return "확인 문의해도 돼? → 마감이나 약속된 날짜 전이라면 재촉보다 일정·스팸함·문서 상태를 먼저 확인해."+best_text
    return ""


def topic_narrative(topic, score, result, evidences=None, all_scores=None):
    level = score_level(score)
    opening = TOPIC_STATE_COPY[topic][level]
    favor = topic_favorability_note(topic, result)
    cross = cross_topic_note(topic, all_scores)
    action = topic_action(topic, score)
    return " ".join(part for part in [opening, favor, cross, action] if part)


def render_topic_card(topic, score, result, evidences, key_prefix, all_scores=None, timing_rows=None, ai_note=""):
    icon=TOPIC_SPECS[topic]["icon"]; label=DISPLAY_LABELS[topic]
    timing=topic_timing_data(timing_rows,topic,3) if timing_rows else None
    timing_html=""
    if timing and timing.get("best"):
        b=timing["best"]; peak=timing.get("peak_row"); low=timing.get("low")
        peak_text=f" · 피크 {peak['dt'].strftime('%H:%M')} ({peak.get(topic)}/100)" if peak else ""
        if timing.get("spread",0)<4:
            timing_html=(f"<div class='timing-strip'>⏰ 하루 안 시간대 차이는 크지 않아. "
                         f"상대적으로 나은 구간 <strong>{b['start'].strftime('%H:%M')}~{b['end'].strftime('%H:%M')}</strong>{peak_text}</div>")
        else:
            low_text=f" · 덜 유리한 구간 <strong>{low['start'].strftime('%H:%M')}~{low['end'].strftime('%H:%M')}</strong>" if low else ""
            timing_html=(f"<div class='timing-strip'>⏰ 상대적으로 좋은 구간 <strong>{b['start'].strftime('%H:%M')}~{b['end'].strftime('%H:%M')}</strong>{peak_text}{low_text} KST</div>")
    decision=topic_decision_note(topic,score,timing)
    decision_html=f"<div class='decision-strip'><strong>{decision}</strong></div>" if decision else ""
    ai_html=f"<div class='ai-topic'><strong>✨ AI 해설</strong><br>{html.escape(ai_note)}</div>" if ai_note else ""
    st.markdown(f"<div class='ast-card'><div class='topic-head'><div class='ast-title'>{icon} {label}</div><div class='topic-score'>{score}/100 · {score_band(score)}</div></div><div class='ast-body'>{topic_narrative(topic,score,result,evidences,all_scores)}</div>{timing_html}{decision_html}{ai_html}</div>",unsafe_allow_html=True)
    with st.expander(f"왜 이렇게 나왔어? · {label}"):
        st.write(f"관련 테마가 얼마나 움직이는지(활성도) **{result['activation']}/100** · 움직일 때 얼마나 부드럽게 풀리는지(우호도) **{result['favorability']}/100**")
        if timing and timing.get("best"):
            b=timing["best"]; p=timing.get("peak_row"); low=timing.get("low"); lr=timing.get("low_row")
            ptxt=f" · 피크 **{p['dt']:%H:%M} {p.get(topic)}/100**" if p else ""
            st.write(f"⏰ 하루 안 상대 비교: 좋은 구간 **{b['start']:%H:%M}~{b['end']:%H:%M} KST**{ptxt}")
            if low and timing.get("spread",0)>=4:
                ltxt=f" · 저점 **{lr['dt']:%H:%M} {lr.get(topic)}/100**" if lr else ""
                st.write(f"⚠️ 덜 유리한 구간 **{low['start']:%H:%M}~{low['end']:%H:%M} KST**{ltxt}")
            if p:
                peak_result=p.get("topics",{}).get(topic,{})
                peak_evidence=peak_result.get("evidence",[])[:2]
                if peak_evidence:
                    st.caption("피크 시간대를 만든 주요 근거")
                    for e in peak_evidence: st.write("• "+evidence_to_korean(e))
        slow=[e for e in (evidences or []) if e.get("transit") in {"Jupiter","Saturn","Uranus","Neptune","Pluto"}]
        if slow:
            st.caption("장기 배경 · 하루 타이밍보다 느리게 지속되는 신호")
            for e in slow[:2]: st.write("• "+evidence_to_korean(e))
        if evidences:
            st.caption("주요 계산 근거 · 아래는 설명용 천문/점성 데이터입니다.")
            for e in evidences[:6]: st.write("• "+evidence_to_korean(e))
        else:
            st.caption("강한 단일 애스펙트보다 여러 약한 하우스·배경 신호의 합산 영향이 중심입니다.")

def format_window(w):
    return f"{w['start'].strftime('%H:%M')} ~ {w['end'].strftime('%H:%M')} KST"


def render_windows(title, windows, key, css_class=""):
    st.markdown(f"#### {title}")
    if not windows:
        st.info("계산 가능한 구간이 없습니다.")
        return
    for i,w in enumerate(windows,1):
        st.markdown(f"<div class='window-card {css_class}'><strong>{i}위 · {format_window(w)}</strong><br>{key} 상대지수 <strong>{w['score']}/100</strong> · {score_band(w['score'])}</div>",unsafe_allow_html=True)


def period_topic_text(rows,key):
    avg=period_avg(rows,key); best=period_extreme(rows,key,True); worst=period_extreme(rows,key,False)
    if avg is None:return "해당 기간에 계산할 수 있는 데이터가 없습니다."
    band=score_band(avg)

    if key=="투자주의":
        return (
            f"기간 평균 <strong>{avg}/100 · {band}</strong>. "
            f"과열·충동매매 위험이 가장 높은 거래일은 <strong>{best['label']} {best[key]}/100</strong>, "
            f"가장 낮은 거래일은 <strong>{worst['label']} {worst[key]}/100</strong>이야. "
            "점수가 높을수록 좋은 날이 아니라 주문 크기·추격·계획 변경을 더 경계해야 하는 날로 봐."
        )
    if key in {"수익실현","신규진입"}:
        noun="수익실현" if key=="수익실현" else "신규진입"
        return (
            f"거래일 기준 {noun} 상대지수 평균은 <strong>{avg}/100 · {band}</strong>. "
            f"상대지수가 가장 높은 거래일은 <strong>{best['label']} {best[key]}/100</strong>, "
            f"가장 낮은 거래일은 <strong>{worst['label']} {worst[key]}/100</strong>이야. "
            "실제 매매는 이 순위보다 가격·수급·거래량·손절 기준을 먼저 확인해야 해."
        )

    intro = {
        "금전":"큰 돈의 변화보다 지출·예산·현금흐름을 어떻게 관리하느냐가 중요한 기간",
        "학업":"공부량 자체보다 집중이 잘 붙는 날에 난도 있는 과제를 몰아주는 게 효율적인 기간",
        "시험":"시험·모의고사에서는 준비한 내용을 실전에서 꺼내는 힘과 실수 관리가 중요한 기간",
        "직장":"업무 성과와 마찰이 날짜별로 달라질 수 있어 중요한 보고·결정의 타이밍을 골라 쓰는 기간",
        "이직":"이직을 확정하기보다 공고 탐색·지원·면접·조건 비교의 타이밍 차이를 보는 기간",
        "연애":"관계가 크게 움직이는 날과 조용한 날의 차이를 보면서 실제 만남과 반응을 확인하는 기간",
        "연락":"연락 빈도와 대화가 이어지는 힘이 날짜마다 달라질 수 있는 기간",
        "재회":"과거 인연·미완결 관계 테마가 다시 활성화되는 날을 보되 특정 상대의 행동 예측과는 구분해야 하는 기간",
        "소식":"결과 통보·메일·문서·기관 공지처럼 외부에서 들어오는 정보 흐름을 확인하는 기간",
        "컨디션":"활력과 회복 리듬의 차이를 보고 중요한 일정을 배치하는 기간",
    }
    best_word = {
        "금전":"돈 관리가 상대적으로 수월한 날", "학업":"공부 흐름이 상대적으로 잘 붙는 날",
        "시험":"실전 수행 흐름이 상대적으로 나은 날", "직장":"업무 흐름이 상대적으로 나은 날",
        "이직":"이동·지원 흐름이 상대적으로 살아나는 날", "연애":"관계 흐름이 상대적으로 살아나는 날",
        "연락":"연락·대화 흐름이 상대적으로 살아나는 날", "재회":"과거인연 테마가 상대적으로 강해지는 날",
        "소식":"소식·문서 흐름이 상대적으로 살아나는 날", "컨디션":"몸과 집중력이 상대적으로 잘 받쳐주는 날",
    }
    weak_word = {
        "금전":"돈 판단을 더 보수적으로 볼 날", "학업":"공부 강도를 낮추는 게 나은 날",
        "시험":"실수·시간관리를 더 챙길 날", "직장":"마찰과 업무 부담을 더 조심할 날",
        "이직":"결정보다 탐색에 머무는 게 나은 날", "연애":"관계 결론을 서두르지 않을 날",
        "연락":"연락 결과를 기대하지 않는 게 나은 날", "재회":"재회 의미를 크게 부여하지 않을 날",
        "소식":"지연·변경 가능성을 감안할 날", "컨디션":"회복 여백을 더 크게 잡을 날",
    }
    return (
        f"기간 평균 <strong>{avg}/100 · {band}</strong>. {intro.get(key,'날짜별 차이를 보는 기간')}이야. "
        f"{best_word.get(key,'상대적으로 나은 날')}은 <strong>{best['label']} {best[key]}/100</strong>, "
        f"{weak_word.get(key,'상대적으로 약한 날')}은 <strong>{worst['label']} {worst[key]}/100</strong>이야. "
        "이 날짜 순위는 같은 분야 안에서 비교한 상대값으로 봐."
    )


# ============================================================
# 8-B. AI INTERPRETER · V6.1
# ============================================================
AI_INTERPRETER_VERSION = "v6.1.0"
AI_SUPPORTED_MODELS = {
    "gemini-3.7-flash": "Gemini 3.7 Flash · 정밀 우선",
    "gemini-3.6-flash": "Gemini 3.6 Flash · 빠른 해설",
}
AI_DEFAULT_MODEL = "gemini-3.7-flash"
AI_FALLBACK_MODEL = "gemini-3.6-flash"
AI_DEFAULT_THINKING_LEVEL = "medium"
AI_ALLOWED_THINKING_LEVELS = {"low", "medium", "high"}
AI_MAX_OUTPUT_TOKENS = 16384
AI_TOPIC_ORDER = ["금전","학업","시험","직장","이직","연애","연락","재회","소식","컨디션"]


def _ai_api_key():
    return _secret_text("GEMINI_API_KEY", "")


def _ai_model():
    configured = _secret_text("GEMINI_MODEL", AI_DEFAULT_MODEL) or AI_DEFAULT_MODEL
    return configured if configured in AI_SUPPORTED_MODELS else AI_DEFAULT_MODEL


def _ai_thinking_level():
    configured = (_secret_text("GEMINI_THINKING_LEVEL", AI_DEFAULT_THINKING_LEVEL) or AI_DEFAULT_THINKING_LEVEL).lower()
    return configured if configured in AI_ALLOWED_THINKING_LEVELS else AI_DEFAULT_THINKING_LEVEL


def _clean_ai_text(value, max_chars=1200):
    if not isinstance(value, str):
        return ""
    value=" ".join(value.replace("\x00", " ").split()).strip()
    return value[:max_chars]


def _compact_evidence(e):
    """AI에는 계산 근거만 전달. 이름·생년월일·출생지·원시 네이탈 좌표는 보내지 않는다."""
    if not isinstance(e, dict):
        return None
    if e.get("kind")=="aspect":
        return {
            "kind":"aspect",
            "transit":e.get("transit"),
            "target":e.get("target"),
            "aspect":e.get("aspect"),
            "orb":round(float(e.get("orb",0.0)),2),
            "motion":e.get("motion",""),
            "direction":e.get("direction",""),
            "layer":e.get("layer",LAYER_BY_TRANSIT.get(e.get("transit"),"")),
        }
    return {
        "kind":"house",
        "transit":e.get("transit"),
        "whole_house":e.get("whole_house"),
        "placidus_house":e.get("placidus_house"),
        "whole_relevant":bool(e.get("whole_relevant")),
        "placidus_relevant":bool(e.get("placidus_relevant")),
        "layer":e.get("layer",LAYER_BY_TRANSIT.get(e.get("transit"),"")),
    }


def _timing_payload(rows, topic):
    timing=topic_timing_data(rows,topic,3) if rows else None
    if not timing:
        return None
    out={"spread":timing.get("spread")}
    b=timing.get("best"); low=timing.get("low"); peak=timing.get("peak_row"); low_row=timing.get("low_row")
    if b:
        out["best_window"]={"start":b["start"].strftime("%H:%M"),"end":b["end"].strftime("%H:%M"),"score":b.get("score")}
    if peak:
        out["peak"]={"time":peak["dt"].strftime("%H:%M"),"score":peak.get(topic)}
    if low:
        out["low_window"]={"start":low["start"].strftime("%H:%M"),"end":low["end"].strftime("%H:%M"),"score":low.get("score")}
    if low_row:
        out["low_point"]={"time":low_row["dt"].strftime("%H:%M"),"score":low_row.get(topic)}
    return out


def build_ai_daily_payload(query_date, daily_scores, topic_results, timing_rows, market_rows, moon_ingresses):
    topics={}
    for topic in AI_TOPIC_ORDER:
        result=topic_results.get(topic,{})
        evidence=[]
        for e in result.get("evidence",[])[:6]:
            c=_compact_evidence(e)
            if c: evidence.append(c)
        topics[topic]={
            "score":daily_scores.get(topic),
            "band":score_band(daily_scores.get(topic)),
            "activation":result.get("activation"),
            "favorability":result.get("favorability"),
            "timing":_timing_payload(timing_rows,topic),
            "evidence":evidence,
        }

    market={"krx_open":bool(market_rows)}
    if market_rows:
        for key in ["수익실현","신규진입","투자주의"]:
            market[key]={
                "score":rows_avg(market_rows,key),
                "best_windows":[
                    {"start":w["start"].strftime("%H:%M"),"end":w["end"].strftime("%H:%M"),"score":w["score"]}
                    for w in rolling_top_windows(market_rows,key,3,2)
                ],
            }
    else:
        nxt=next_krx_session(query_date)
        market["next_krx_session"]=nxt.isoformat() if nxt else None

    moon_events=[]
    for ts,sign in (moon_ingresses or []):
        try: t=datetime.fromisoformat(ts).strftime("%H:%M")
        except Exception: t=str(ts)
        moon_events.append({"time":t,"sign":sign})

    return {
        "version":AI_INTERPRETER_VERSION,
        "date":query_date.isoformat(),
        "weekday":WEEKDAY_KO[query_date.weekday()],
        "method_note":"점수는 앱의 점성술 상대지수이며 확률이 아니다. 일일 대표점수는 07:00~23:30 KST 다중시각 평균, 시간대 탐색은 00:00~23:30 KST.",
        "moon_ingresses":moon_events,
        "topics":topics,
        "market":market,
    }


AI_SYSTEM_PROMPT = """너는 '별빛의 운명' 앱의 점성술 해설자다. 계산자가 아니라 해석자다.
반드시 제공된 JSON 계산 데이터만 사용하고, 없는 행성 위치·애스펙트·하우스·시간·사건을 절대로 만들어내지 마라.
점수는 현실 사건의 확률이 아니라 앱 내부의 상대 점성술 지수다. activation은 테마가 얼마나 움직이는지, favorability는 움직일 때 얼마나 부드럽게 풀리는지로 구분해서 읽어라.
여러 분야를 교차해서 해석하되 숫자가 비슷하다는 이유만으로 인과관계를 만들지 마라.
연애·연락·재회에서는 특정 사람이 연락한다, 돌아온다, 마음이 있다처럼 타인의 의도나 미래 행동을 단정하지 마라. 실제 행동 신호와 감정 테마를 구분하라.
컨디션은 질병·진단·치료 예측을 하지 말고 활동 리듬과 휴식 조언만 하라.
투자는 가격·수익률·매수/매도 성공을 예측하지 마라. KRX 휴장일이면 장중 매매 해설을 만들지 말고 준비·복기 관점으로만 말하라.
한국어 반말로 자연스럽고 구체적으로 쓰되, '좋을 수 있어', '루틴을 우선', '사건성 신호' 같은 뭉뚱그린 상투어를 반복하지 마라.
각 분야에서 가능하면 점수·활성도·우호도·시간대·실제 근거를 연결해서 '그래서 오늘 어떻게 읽고 무엇을 할지'를 말하라.
근거가 약하면 약하다고 분명히 말하고, 점성술 해석임을 벗어나 과학적 사실처럼 표현하지 마라.
출력은 JSON만 반환하라."""


AI_OUTPUT_SHAPE = {
    "headline":"오늘 흐름을 18자 안팎으로 요약한 제목",
    "overall":"오늘 전체 흐름을 3~5문장으로 종합. 서로 다른 분야를 비교할 때는 절대 원점수를 단순 서열화하지 말 것.",
    "priorities":["오늘 가장 실용적인 행동 1","행동 2","행동 3"],
    "relationship":"연애·연락·재회를 교차해 2~4문장으로 해석",
    "work_study":"학업·시험·직장·이직을 교차해 2~4문장으로 해석",
    "money_news":"금전·소식, 필요하면 투자 데이터를 엮어 2~4문장으로 해석",
    "condition":"컨디션을 1~3문장으로 해석. 의료 진단 금지",
    "topic_notes":{topic:"해당 분야를 기존 규칙문보다 더 구체적으로 2~4문장 해설" for topic in AI_TOPIC_ORDER},
    "limits":"이번 해설에서 단정하면 안 되는 부분 또는 근거가 약한 부분을 1~2문장으로 명시",
}


def _validate_ai_output(obj):
    if not isinstance(obj,dict):
        return None
    out={
        "headline":_clean_ai_text(obj.get("headline"),120),
        "overall":_clean_ai_text(obj.get("overall"),1800),
        "relationship":_clean_ai_text(obj.get("relationship"),1200),
        "work_study":_clean_ai_text(obj.get("work_study"),1200),
        "money_news":_clean_ai_text(obj.get("money_news"),1200),
        "condition":_clean_ai_text(obj.get("condition"),900),
        "limits":_clean_ai_text(obj.get("limits"),900),
    }
    priorities=obj.get("priorities",[])
    out["priorities"]=[_clean_ai_text(x,240) for x in priorities[:3] if _clean_ai_text(x,240)] if isinstance(priorities,list) else []
    notes=obj.get("topic_notes",{})
    out["topic_notes"]={}
    if isinstance(notes,dict):
        for topic in AI_TOPIC_ORDER:
            txt=_clean_ai_text(notes.get(topic),1100)
            if txt: out["topic_notes"][topic]=txt
    if not out["overall"] and not out["topic_notes"]:
        return None
    return out


def _call_gemini_once(payload_json, model_name, thinking_level, api_key):
    model_name=(model_name or AI_DEFAULT_MODEL).strip()
    safe_model=urllib.parse.quote(model_name,safe="-._")
    url=f"https://generativelanguage.googleapis.com/v1beta/models/{safe_model}:generateContent"
    user_prompt=(
        "아래 계산 JSON을 해석해. JSON 안에 없는 근거는 만들지 마. "
        "다음 출력 형태의 키를 그대로 사용하고 topic_notes에는 10개 분야를 가능하면 모두 채워.\n\n"
        "OUTPUT_SHAPE:\n"+json.dumps(AI_OUTPUT_SHAPE,ensure_ascii=False,separators=(",",":"))+"\n\n"
        "CALCULATED_DATA:\n"+payload_json
    )
    body={
        "systemInstruction":{"parts":[{"text":AI_SYSTEM_PROMPT}]},
        "contents":[{"role":"user","parts":[{"text":user_prompt}]}],
        "generationConfig":{
            "maxOutputTokens":AI_MAX_OUTPUT_TOKENS,
            "responseMimeType":"application/json",
            "thinkingConfig":{"thinkingLevel":thinking_level},
        },
    }
    req=urllib.request.Request(
        url,
        data=json.dumps(body,ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type":"application/json","x-goog-api-key":api_key},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req,timeout=55) as resp:
            raw=json.loads(resp.read().decode("utf-8"))
        parts=raw.get("candidates",[{}])[0].get("content",{}).get("parts",[])
        text="".join(p.get("text","") for p in parts if isinstance(p,dict) and not p.get("thought")).strip()
        if not text:
            text="".join(p.get("text","") for p in parts if isinstance(p,dict)).strip()
        if text.startswith("```"):
            text=text.strip("`").strip()
            if text.lower().startswith("json"): text=text[4:].lstrip()
        parsed=json.loads(text)
        valid=_validate_ai_output(parsed)
        if not valid:
            return {"ok":False,"error":"AI 응답 형식 검증에 실패했어.","error_code":"invalid_output","model":model_name}
        return {"ok":True,"data":valid,"model":model_name}
    except urllib.error.HTTPError as exc:
        try:
            detail=exc.read().decode("utf-8")[:700]
        except Exception:
            detail=""
        if exc.code==429:
            msg="Gemini API 사용량 한도 또는 요청 제한에 도달했어. 잠시 뒤 다시 열면 돼."
        elif exc.code in {401,403}:
            msg="Gemini API 키 권한이나 결제 프로젝트 연결 상태를 확인해줘."
        elif exc.code==404:
            msg=f"{model_name} 모델을 이 API 키/프로젝트에서 사용할 수 없는 것 같아."
        elif exc.code>=500:
            msg="Gemini 서버가 일시적으로 불안정해."
        else:
            msg=f"Gemini API 오류({exc.code})"
        return {"ok":False,"error":msg,"detail":detail,"error_code":exc.code,"model":model_name}
    except Exception as exc:
        return {
            "ok":False,
            "error":f"AI 해설 호출 실패: {type(exc).__name__}",
            "error_code":type(exc).__name__,
            "model":model_name,
        }


@st.cache_data(ttl=86400, show_spinner=False)
def cached_ai_daily_interpretation(payload_json, preferred_model, thinking_level, key_fingerprint):
    # key_fingerprint는 캐시 무효화용. 실제 키는 payload/캐시에 넣지 않는다.
    api_key=_ai_api_key()
    if not api_key:
        return {"ok":False,"error":"GEMINI_API_KEY가 설정되지 않았어."}

    preferred_model = preferred_model if preferred_model in AI_SUPPORTED_MODELS else AI_DEFAULT_MODEL
    thinking_level = thinking_level if thinking_level in AI_ALLOWED_THINKING_LEVELS else AI_DEFAULT_THINKING_LEVEL

    primary=_call_gemini_once(payload_json,preferred_model,thinking_level,api_key)
    if primary.get("ok"):
        primary["preferred_model"]=preferred_model
        primary["thinking_level"]=thinking_level
        primary["used_fallback"]=False
        return primary

    # 사용자가 3.7을 선택했을 때만 3.6으로 자동 대체.
    # 인증/권한 오류는 모델을 바꿔도 해결되지 않으므로 재시도하지 않는다.
    can_fallback=(
        preferred_model=="gemini-3.7-flash"
        and AI_FALLBACK_MODEL!=preferred_model
        and primary.get("error_code") not in {401,403}
    )
    if can_fallback:
        fallback=_call_gemini_once(payload_json,AI_FALLBACK_MODEL,thinking_level,api_key)
        if fallback.get("ok"):
            fallback["preferred_model"]=preferred_model
            fallback["thinking_level"]=thinking_level
            fallback["used_fallback"]=True
            fallback["fallback_from"]=preferred_model
            return fallback
        return {
            "ok":False,
            "error":primary.get("error","AI 해설 호출 실패"),
            "primary_error":primary,
            "fallback_error":fallback,
            "preferred_model":preferred_model,
            "thinking_level":thinking_level,
        }

    primary["preferred_model"]=preferred_model
    primary["thinking_level"]=thinking_level
    primary["used_fallback"]=False
    return primary


def get_ai_daily_interpretation(payload, preferred_model=None):
    api_key=_ai_api_key()
    if not api_key:
        return {"ok":False,"missing_key":True,"error":"GEMINI_API_KEY가 설정되지 않았어."}
    model=preferred_model if preferred_model in AI_SUPPORTED_MODELS else _ai_model()
    thinking_level=_ai_thinking_level()
    key_fp=hashlib.sha256(api_key.encode("utf-8")).hexdigest()[:12]
    payload_json=json.dumps(payload,ensure_ascii=False,separators=(",",":"),sort_keys=True)
    return cached_ai_daily_interpretation(payload_json,model,thinking_level,key_fp)


def render_ai_overview(ai_result):
    if not ai_result or not ai_result.get("ok"):
        if ai_result and ai_result.get("missing_key"):
            st.info("✨ AI 정밀해설은 준비되어 있어. Streamlit Secrets에 GEMINI_API_KEY를 추가하면 켜져.")
        elif ai_result and ai_result.get("error"):
            st.caption("✨ AI 정밀해설은 이번에 불러오지 못했어. 기존 계산·규칙 해설은 정상 동작해. · "+ai_result.get("error",""))
        return None
    data=ai_result["data"]
    headline=html.escape(data.get("headline") or "AI 정밀 종합해설")
    overall=html.escape(data.get("overall", ""))
    chips="".join(f"<span class='ai-chip'>{html.escape(x)}</span>" for x in data.get("priorities",[]))
    sections=[]
    for label,key in [("💖 관계","relationship"),("📚 공부·진로","work_study"),("💵 돈·소식","money_news"),("🌿 컨디션","condition")]:
        text=data.get(key,"")
        if text: sections.append(f"<div class='ai-topic'><strong>{label}</strong><br>{html.escape(text)}</div>")
    st.markdown(
        f"<div class='ai-overview'><div class='ai-head'>✨ AI 정밀해설 · {headline}</div><div class='ai-body'>{overall}</div>"
        f"<div style='margin-top:8px'>{chips}</div>{''.join(sections)}</div>",
        unsafe_allow_html=True,
    )
    with st.expander("AI 해설 기준 · 개인정보/한계"):
        st.write("AI는 운세 점수나 천체를 새로 계산하지 않고, 앱이 계산한 숫자·시간대·애스펙트·하우스 근거만 해석합니다.")
        st.write("AI 요청에는 이름·생년월일·출생시간·출생지 원문·PIN을 보내지 않습니다. 필요한 파생 점성 데이터만 전달합니다.")
        st.write("AI가 만든 문장은 점성술적 해석이며 사건 확률, 특정인의 의도, 의료 진단, 주가 방향을 의미하지 않습니다.")
        if data.get("limits"): st.caption("이번 해설의 한계 · "+data["limits"])
        model_caption="모델 · "+str(ai_result.get("model",AI_DEFAULT_MODEL))
        if ai_result.get("used_fallback"):
            model_caption+=f" · {ai_result.get('fallback_from')} 실패 후 자동 대체"
        model_caption+=f" · thinking {ai_result.get('thinking_level',AI_DEFAULT_THINKING_LEVEL)}"
        st.caption(model_caption)
    return data

# ============================================================
# 9. RETURN / DAILY MOON EVENTS
# ============================================================
@st.cache_data(ttl=21600, show_spinner=False)
def cached_moon_ingresses(day_iso):
    """KST 하루 안 Moon 별자리 이동 시각을 약 1분 이내로 좁힌다. 개인 점수와는 별도인 전체 하늘 맥락."""
    day_value=date.fromisoformat(day_iso)
    start=KST.localize(datetime.combine(day_value,dt_time(0,0)))
    end=start+timedelta(days=1)
    points=[]; cur=start
    while cur<=end:
        points.append(cur); cur+=timedelta(minutes=30)

    sf_points=ts.from_datetimes([p.astimezone(UTC) for p in points])
    moon_lons=get_tropical_ecliptic_lons("Moon",sf_points)
    sign_indices=[int((float(lon)%360)//30) for lon in moon_lons]

    def sign_idx(dt_kst):
        lon=get_tropical_ecliptic_lon("Moon",sf_time(dt_kst.astimezone(UTC)))
        return int((lon%360)//30)

    events=[]
    prev=points[0]; prev_idx=sign_indices[0]
    for cur,cur_idx in zip(points[1:],sign_indices[1:]):
        if cur_idx!=prev_idx:
            lo,hi=prev,cur; lo_idx=prev_idx
            for _ in range(12):
                mid=lo+(hi-lo)/2
                if sign_idx(mid)==lo_idx: lo=mid
                else: hi=mid
            event_dt=hi.replace(second=0,microsecond=0)
            new_idx=sign_idx(hi)
            events.append((event_dt.isoformat(),SIGNS_KO[new_idx]))
        prev,prev_idx=cur,cur_idx
    return events

def make_sample_datetimes(start_dt_utc,end_dt_utc,step_hours):
    out=[]; cur=start_dt_utc.astimezone(UTC); end=end_dt_utc.astimezone(UTC); step=timedelta(hours=step_hours)
    while cur<end: out.append(cur); cur+=step
    if not out or out[-1]!=end: out.append(end)
    return out


def refine_longitude_crossing(body,target_lon,left_dt,right_dt):
    left_t,right_t=sf_time(left_dt),sf_time(right_dt)
    def objective(tt_jd): return circular_delta(get_tropical_ecliptic_lon(body,ts.tt_jd(tt_jd)),target_lon)
    fl,fr=objective(left_t.tt),objective(right_t.tt)
    if max(abs(fl),abs(fr))>60:return None
    if abs(fl)<1e-10:return left_dt.astimezone(UTC)
    if abs(fr)<1e-10:return right_dt.astimezone(UTC)
    if fl*fr>0:return None
    root=brentq(objective,left_t.tt,right_t.tt,xtol=1e-9,maxiter=100)
    return ts.tt_jd(root).utc_datetime().replace(tzinfo=UTC)


def find_longitude_crossings(body,target_lon,start_dt_utc,end_dt_utc,step_hours):
    samples=make_sample_datetimes(start_dt_utc,end_dt_utc,step_hours); times=ts.from_datetimes(samples)
    vals=circular_delta_array(get_tropical_ecliptic_lons(body,times),target_lon); roots=[]
    for i in range(len(samples)-1):
        a,b=float(vals[i]),float(vals[i+1])
        if max(abs(a),abs(b))>60: continue
        if a==0 or b==0 or a*b<0:
            root=refine_longitude_crossing(body,target_lon,samples[i],samples[i+1])
            if root is not None and (not roots or abs((root-roots[-1]).total_seconds())>30): roots.append(root)
    return roots


def find_returns_near(body,natal_lon,center_dt_utc):
    cfg=RETURN_CONFIG[body]; start=center_dt_utc-timedelta(days=cfg["window_days"]); end=center_dt_utc+timedelta(days=cfg["window_days"])
    roots=find_longitude_crossings(body,natal_lon,start,end,cfg["step_hours"])
    prev=[r for r in roots if r<=center_dt_utc]; fut=[r for r in roots if r>center_dt_utc]
    return {"previous":max(prev) if prev else None,"next":min(fut) if fut else None,"all":roots}

# ============================================================
# 10. PROFILE / QUERY INPUTS
# ============================================================
def _profile_date_default():
    try:return date.fromisoformat(_secret_text("PROFILE_BIRTH_DATE","2000-01-01"))
    except ValueError:return date(2000,1,1)


def _profile_time_default():
    try:return dt_time.fromisoformat(_secret_text("PROFILE_BIRTH_TIME","12:00"))
    except ValueError:return dt_time(12,0)


def _profile_place_default():
    raw=_secret_text("PROFILE_BIRTH_PLACE","서울특별시")
    return raw if raw in KOREA_BIRTHPLACES else "서울특별시"


PROFILE_NAME_DEFAULT=_secret_text("PROFILE_NAME","사용자") or "사용자"
PROFILE_BIRTH_DATE_DEFAULT=_profile_date_default(); PROFILE_BIRTH_TIME_DEFAULT=_profile_time_default(); PROFILE_BIRTH_PLACE_DEFAULT=_profile_place_default()

now_kst=datetime.now(KST)
today_kst=now_kst.date()

st.markdown('<div class="top-nav">✦ ASTROLOGY · HOROSCOPE · PRIVATE ✦</div>',unsafe_allow_html=True)
st.title("🌙 별빛의 운명")
st.caption(f"{EPHEMERIS_USED} · Tropical · Whole Sign 주 기준 · Placidus 보조")

with st.expander("👤 출생정보 수정", expanded=False):
    user_name=st.text_input("성함 또는 호칭",value=PROFILE_NAME_DEFAULT,key="profile_name")
    birth_date=st.date_input("출생일",PROFILE_BIRTH_DATE_DEFAULT,key="profile_birth_date")
    birth_time=st.time_input("출생 시간",PROFILE_BIRTH_TIME_DEFAULT,step=60,key="profile_birth_time")
    places=list(KOREA_BIRTHPLACES)+["직접 좌표 입력(고급)"]
    birth_place=st.selectbox("출생 지역",places,index=places.index(PROFILE_BIRTH_PLACE_DEFAULT),key="profile_birth_place")
    if birth_place=="직접 좌표 입력(고급)":
        lat=st.number_input("출생지 위도(N)",value=34.7604,format="%.6f",key="_direct_lat"); lon=st.number_input("출생지 경도(E)",value=127.6622,format="%.6f",key="_direct_lon"); place_label="직접 좌표"
    else:
        lat,lon=KOREA_BIRTHPLACES[birth_place]; place_label=birth_place
# 날짜는 오늘 자동. 사용자가 원할 때만 바꾼다.
query_date=st.date_input("📅 일일/주간 시작 날짜", value=today_kst, key="profile_query_date", help="앱을 열면 오늘 날짜가 자동 선택됩니다. 다른 날짜 운세를 보고 싶을 때만 바꾸세요.")
query_ref_time=now_kst.time().replace(second=0,microsecond=0) if query_date==today_kst else dt_time(12,0)
query_dt_kst=KST.localize(datetime.combine(query_date,query_ref_time)); query_dt_utc=query_dt_kst.astimezone(UTC)

birth_dt_kst=KST.localize(datetime.combine(birth_date,birth_time)); birth_dt_utc=birth_dt_kst.astimezone(UTC)
t_birth=sf_time(birth_dt_utc)

try:
    natal_houses=compute_houses(birth_dt_utc,lat,lon)
except Exception as exc:
    st.error(f"ASC/하우스 계산 실패: {exc}"); st.stop()

natal_lons={body:get_tropical_ecliptic_lon(body,t_birth) for body in PLANET_KEYS}
birth_is_day=is_day_chart(birth_dt_utc,lat,lon)
pof_lon=calculate_pof(natal_houses["asc"],natal_lons["Sun"],natal_lons["Moon"],birth_is_day)
natal_packed=pack_natal_lons(natal_lons); houses_packed=pack_houses(natal_houses)

asc_sign,asc_deg,_=get_sign_and_degree(natal_houses["asc"])
st.markdown(f"<div class='profile-strip'><strong>{user_name}</strong> · {birth_date:%Y.%m.%d} {birth_time:%H:%M} · {place_label}<br>ASC <strong>{asc_sign} {asc_deg:.2f}°</strong></div>",unsafe_allow_html=True)

# ============================================================
# 11. TABS
# ============================================================
main_view=st.radio("메뉴",["🌙 일일","📅 주간","🌕 월간","🔬 정밀분석"],horizontal=True,label_visibility="collapsed",key="main_view")

# ------------------------------------------------------------
# DAILY
# ------------------------------------------------------------
if main_view=="🌙 일일":
    st.markdown(f"### 🌙 {query_date:%Y년 %m월 %d일}({WEEKDAY_KO[query_date.weekday()]}) 일일 리포트")
    if query_date==today_kst: st.caption("앱을 열었을 때 오늘 날짜를 자동으로 계산합니다. 기준 시각 입력은 필요 없습니다.")
    else: st.caption("선택한 날짜의 하루 전체 흐름을 여러 시간대로 나눠 계산합니다.")

    moon_ingresses=cached_moon_ingresses(query_date.isoformat())
    if moon_ingresses:
        moon_text=" · ".join(f"{datetime.fromisoformat(ts).strftime('%H:%M')} {sign} 진입" for ts,sign in moon_ingresses)
        st.markdown(f"<div class='astro-note'>🌙 <strong>오늘 달의 별자리 전환</strong> · {moon_text}<br>이건 모두에게 공통인 하늘의 분위기 변화이고, 개인 운세 점수는 네이탈 트랜짓·하우스 계산을 우선해.</div>",unsafe_allow_html=True)

    with st.spinner("하루 전체 흐름을 계산하는 중..."):
        # 기존 일일 점수(07:00~23:30)는 그대로 유지하고, 새벽 00:00~06:30은 시간대 탐색에만 추가한다.
        life_rows=cached_intraday_scan(query_date.isoformat(),"07:00:00","23:30:00",30,natal_packed,houses_packed)
        early_rows=cached_intraday_scan(query_date.isoformat(),"00:00:00","06:30:00",30,natal_packed,houses_packed)
        timing_rows=early_rows+life_rows
        market_rows=cached_intraday_scan(query_date.isoformat(),"09:00:00","15:30:00",15,natal_packed,houses_packed) if is_krx_session(query_date) else []

    daily_scores={k:rows_avg(life_rows,k) for k in ["금전","학업","시험","직장","이직","연애","연락","재회","소식","컨디션"]}
    st.markdown("<div class='section-kicker'>오늘의 분야별 지수 · 서로 다른 분야의 원점수를 단순 순위화하지 않습니다</div>",unsafe_allow_html=True)
    grid="<div class='score-grid'>"
    for key in ["금전","학업","시험","직장","이직","연애","연락","재회","소식","컨디션"]:
        score=daily_scores[key]
        grid+=f"<div class='score-card'><div class='score-name'>{TOPIC_SPECS[key]['icon']} {DISPLAY_LABELS[key]}</div><div class='score-num'>{score}</div><div class='score-band'>{score_band(score)}</div></div>"
    grid+="</div>"; st.markdown(grid,unsafe_allow_html=True)
    st.caption("점수 라벨: 30~39 약함 · 40~49 다소 약함 · 50~59 보통 · 60~69 보통 이상 · 70~81 강함 · 82 이상 매우 강함")

    # V6.1: 기존 계산 결과를 한 번에 AI 해설층으로 넘긴다. AI는 숫자를 다시 계산하지 않는다.
    daily_topic_results={topic:aggregate_topic_result(life_rows,topic) for topic in AI_TOPIC_ORDER}
    ai_payload=build_ai_daily_payload(query_date,daily_scores,daily_topic_results,timing_rows,market_rows,moon_ingresses)

    configured_ai_model=_ai_model()
    ai_model_options=list(AI_SUPPORTED_MODELS.keys())
    ai_model_index=ai_model_options.index(configured_ai_model) if configured_ai_model in ai_model_options else 0
    selected_ai_model=st.selectbox(
        "✨ AI 해설 모델",
        ai_model_options,
        index=ai_model_index,
        format_func=lambda m: AI_SUPPORTED_MODELS[m],
        help="3.7 Flash는 정밀 해설 기본값이고, 호출 실패 시 3.6 Flash로 자동 대체돼. 3.6을 직접 고르면 3.6만 사용해.",
        key="ai_daily_model_choice",
    )
    with st.spinner(f"✨ {AI_SUPPORTED_MODELS[selected_ai_model]}가 계산 근거를 종합 해석하는 중..."):
        ai_result=get_ai_daily_interpretation(ai_payload,selected_ai_model)
    ai_data=render_ai_overview(ai_result) or {}
    ai_topic_notes=ai_data.get("topic_notes",{}) if isinstance(ai_data,dict) else {}

    st.markdown("#### 💵 돈 · 공부 · 진로")
    for topic in ["금전","학업","시험","직장","이직"]:
        result=daily_topic_results[topic]
        render_topic_card(topic,daily_scores[topic],result,result["evidence"],"daily",daily_scores,timing_rows,ai_topic_notes.get(topic,""))

    st.markdown("#### 💖 관계 · 연락 · 소식")
    for topic in ["연애","연락","재회","소식"]:
        result=daily_topic_results[topic]
        render_topic_card(topic,daily_scores[topic],result,result["evidence"],"daily",daily_scores,timing_rows,ai_topic_notes.get(topic,""))

    st.markdown("#### 🌿 컨디션")
    result=daily_topic_results["컨디션"]
    render_topic_card("컨디션",daily_scores["컨디션"],result,result["evidence"],"daily",daily_scores,timing_rows,ai_topic_notes.get("컨디션",""))
    st.caption("컨디션·회복 지수는 점성술상의 활동 리듬 참고값이며 질병·진단·치료 예측이 아닙니다.")

    st.markdown("#### 📈 주식·투자")
    if not market_rows:
        nxt=next_krx_session(query_date)
        nxt_text=f" · 다음 KRX 거래일 <strong>{nxt:%m/%d}({WEEKDAY_KO[nxt.weekday()]})</strong>" if nxt else ""
        st.markdown(f"<div class='ast-card market-closed'><div class='ast-title'>📵 국내 증시 휴장</div><div class='ast-body'>대주주님, 오늘은 KRX 거래일이 아니므로 <strong>신규진입·수익실현·장중 매매 지수는 산출·표시하지 않습니다.</strong>{nxt_text}<br>대신 아래 시간대는 실제 주문 시간이 아니라 <strong>매매일지 복기·보유종목 기준 정리·관심종목 조사</strong> 같은 준비 작업용 상대값입니다.</div></div>",unsafe_allow_html=True)
        prep_rows=investment_prep_rows(timing_rows)
        prep_w=rolling_top_windows(prep_rows,"투자준비",3,2)
        prep_risk=rolling_top_windows(prep_rows,"투자주의",3,1)
        render_windows("🗂️ 휴장일 투자 준비·검토 시간대",prep_w,"투자준비")
        st.markdown("<div class='event-pill'><strong>휴장일에 해둘 일</strong> · 지난 거래일 매매일지 복기 → 보유종목 익절·손절 기준을 숫자로 적기 → 관심종목 후보를 줄이고 다음 거래일 주문 조건을 미리 정리해두세요.</div>",unsafe_allow_html=True)
        render_windows("⚠️ 과열·확증편향 주의 시간대",prep_risk,"투자주의","risk")
        st.caption("휴장일 준비 지수는 금전 판단·정보 정리·과열 억제를 묶은 점성술 상대값이며 매매 수익확률이나 가격 방향 예측이 아닙니다.")
    else:
        realize=rows_avg(market_rows,"수익실현"); entry=rows_avg(market_rows,"신규진입"); risk=rows_avg(market_rows,"투자주의")
        st.markdown(f"<div class='ast-card'><div class='ast-title'>📈 오늘의 투자 지수</div><div class='ast-body'>수익실현 <strong>{realize}/100</strong> · 신규진입 <strong>{entry}/100</strong> · 과열주의 <strong>{risk}/100</strong><br>점성술 내부 상대지수일 뿐 실제 가격 방향이나 수익확률은 아닙니다.</div></div>",unsafe_allow_html=True)
        realize_w=rolling_top_windows(market_rows,"수익실현",3,2); entry_w=rolling_top_windows(market_rows,"신규진입",3,2); risk_w=rolling_top_windows(market_rows,"투자주의",3,2)
        render_windows("💰 수익실현 상대 우호 시간대",realize_w,"수익실현")
        render_windows("🎯 신규진입 상대 우호 시간대",entry_w,"신규진입")
        render_windows("⚠️ 과열·뇌동매매 주의 시간대",risk_w,"투자주의","risk")
        st.warning("대주주님, 투자 지수보다 실제 가격·수급·거래량·손절 기준이 우선입니다.")

    with st.expander("🪐 계산 기준 보기"):
        noon=life_rows[len(life_rows)//2]
        moon_lon=noon["topics"] and get_tropical_ecliptic_lon("Moon",sf_time(noon["dt"].astimezone(UTC)))
        moon_sign,moon_deg,_=get_sign_and_degree(moon_lon)
        st.write(f"Ephemeris: **{EPHEMERIS_USED}**")
        st.write("Tropical · true ecliptic/equinox of date · Whole Sign 주 기준 + Placidus 보조")
        st.write(f"대표 시각 달: **{moon_sign} {moon_deg:.2f}°**")
        st.write("일일 대표점수는 기존과 동일하게 07:00~23:30 KST 다중 시각 평균이며, 시간대 탐색만 00:00~23:30까지 확장합니다.")

# ------------------------------------------------------------
# WEEKLY
# ------------------------------------------------------------
elif main_view=="📅 주간":
    week_end=query_date+timedelta(days=6)
    st.markdown("### 📅 7일 주간 정밀 리포트")
    week_sessions=krx_sessions_in_range(query_date,week_end)
    st.markdown(f"<div class='period-range'><strong>{query_date:%Y.%m.%d}({WEEKDAY_KO[query_date.weekday()]}) ~ {week_end:%m.%d}({WEEKDAY_KO[week_end.weekday()]})</strong><br>선택일 기준 7일 전망 · KRX 거래일 <strong>{len(week_sessions)}일</strong></div>",unsafe_allow_html=True)
    with st.spinner("7일을 날짜별 다중 시각으로 계산하는 중..."):
        week_rows=cached_period_scores(query_date.isoformat(),7,natal_packed,houses_packed)

    st.markdown("#### 🧭 분야별 주간 흐름")
    for key in ["금전","학업","시험","직장","이직","연애","연락","재회","소식","컨디션"]:
        st.markdown(f"<div class='ast-card'><div class='ast-title'>{TOPIC_SPECS[key]['icon']} {DISPLAY_LABELS[key]}</div><div class='ast-body'>{period_topic_text(week_rows,key)}</div></div>",unsafe_allow_html=True)

    st.markdown("#### 📈 주식·투자 · 거래일만 집계")
    if week_sessions:
        for key,label in [("수익실현","수익실현"),("신규진입","신규진입"),("투자주의","과열주의")]:
            st.markdown(f"<div class='event-pill'><strong>{label}</strong> · {period_topic_text(week_rows,key)}</div>",unsafe_allow_html=True)
    else:
        st.info("이 7일 범위에는 KRX 거래일이 없습니다.")

    st.markdown("#### 📆 하루씩 보면")
    for row in week_rows:
        trade=" · 📵 휴장" if not row["market_open"] else " · 📈 거래일"
        st.markdown(f"<div class='event-pill'><strong>{row['label']}</strong>{trade}<br>시험 {row['시험']} · 공부 {row['학업']} · 직장 {row['직장']} · 이직 {row['이직']} · 연애 {row['연애']} · 연락 {row['연락']} · 소식 {row['소식']} · 컨디션 {row['컨디션']}</div>",unsafe_allow_html=True)

    with st.expander("📊 주간 숫자표 보기 · 검산용"):
        st.dataframe(pd.DataFrame(week_rows)[["label","market_open","금전","학업","시험","직장","이직","연애","연락","재회","소식","컨디션","수익실현","신규진입","투자주의"]],use_container_width=True,hide_index=True)
        st.caption("투자 항목의 빈칸은 휴장일이며 평균에서 제외됩니다.")

# ------------------------------------------------------------
# MONTHLY
# ------------------------------------------------------------
elif main_view=="🌕 월간":
    st.markdown("### 🌕 월간 정밀 리포트")
    if "monthly_year" not in st.session_state: st.session_state["monthly_year"]=query_date.year
    if "monthly_month" not in st.session_state: st.session_state["monthly_month"]=query_date.month

    c1,c2=st.columns(2)
    with c1:
        month_year=st.selectbox("연도",list(range(query_date.year-3,query_date.year+5)),index=list(range(query_date.year-3,query_date.year+5)).index(st.session_state["monthly_year"]),key="monthly_year_select")
    with c2:
        month_month=st.selectbox("월",list(range(1,13)),index=st.session_state["monthly_month"]-1,key="monthly_month_select")
    st.session_state["monthly_year"],st.session_state["monthly_month"]=month_year,month_month
    month_first=date(month_year,month_month,1); month_days=calendar.monthrange(month_year,month_month)[1]; month_last=date(month_year,month_month,month_days)
    sessions=krx_sessions_in_range(month_first,month_last)
    st.markdown(f"<div class='period-range'><strong>{month_year}년 {month_month}월</strong> · {month_days}일 · KRX 거래일 <strong>{len(sessions)}일</strong></div>",unsafe_allow_html=True)

    calc=st.button("🌕 선택한 달 전체 흐름 계산",type="primary",use_container_width=True,key="monthly_calc")
    monthly_key=(month_year,month_month,natal_packed,houses_packed)
    if calc:
        with st.spinner("월간을 날짜별 다중 시각으로 계산하는 중..."):
            st.session_state["monthly_rows_v5"]=cached_period_scores(month_first.isoformat(),month_days,natal_packed,houses_packed)
            st.session_state["monthly_rows_key_v5"]=monthly_key
    month_rows=st.session_state.get("monthly_rows_v5") if st.session_state.get("monthly_rows_key_v5")==monthly_key else None

    if month_rows:
        st.markdown("#### 🧭 분야별 월간 흐름")
        for key in ["금전","학업","시험","직장","이직","연애","연락","재회","소식","컨디션"]:
            st.markdown(f"<div class='ast-card'><div class='ast-title'>{TOPIC_SPECS[key]['icon']} {DISPLAY_LABELS[key]}</div><div class='ast-body'>{period_topic_text(month_rows,key)}</div></div>",unsafe_allow_html=True)
        st.markdown("#### 📈 월간 주식·투자 · 거래일만 집계")
        for key,label in [("수익실현","수익실현"),("신규진입","신규진입"),("투자주의","과열주의")]:
            st.markdown(f"<div class='event-pill'><strong>{label}</strong> · {period_topic_text(month_rows,key)}</div>",unsafe_allow_html=True)

        st.markdown("#### 🏆 분야별 TOP 날짜")
        top_topic=st.selectbox("분야",["시험","학업","직장","이직","연애","연락","재회","소식","금전","컨디션","수익실현","신규진입"],key="monthly_top_topic")
        tops=top_period_days(month_rows,top_topic,5)
        if tops:
            for i,row in enumerate(tops,1): st.write(f"{i}. **{row['label']}** · {row[top_topic]}/100")
        else: st.info("해당 분야의 계산 가능한 날짜가 없습니다.")

        with st.expander("📊 월간 숫자표 보기 · 검산용"):
            st.dataframe(pd.DataFrame(month_rows),use_container_width=True,hide_index=True,height=430)
            st.caption("주식 관련 빈칸은 KRX 휴장일로, 월간 평균에서 제외됩니다.")
    else:
        st.info("연도와 월을 고른 뒤 ‘선택한 달 전체 흐름 계산’을 눌러줘.")

# ------------------------------------------------------------
# PRECISION / TRANSITS / RETURNS / VALIDATION
# ------------------------------------------------------------
elif main_view=="🔬 정밀분석":
    detail_view=st.radio("정밀분석 메뉴",["⏰ 시간대","🪐 트랜짓","🔄 리턴","⚙️ 검증"],horizontal=True,label_visibility="collapsed",key="detail_view")
    if detail_view=="⏰ 시간대":
        st.markdown("### ⏰ 선택 날짜 정밀 시간대")
        life_topic=st.selectbox("일상 분야",["시험","학업","직장","이직","연애","연락","재회","소식","금전","컨디션"],key="precision_topic")
        with st.spinner("30분 단위로 계산하는 중..."):
            precision_rows=cached_intraday_scan(query_date.isoformat(),"00:00:00","23:30:00",30,natal_packed,houses_packed)
        render_windows(f"{TOPIC_SPECS[life_topic]['icon']} {DISPLAY_LABELS[life_topic]} TOP 시간대",rolling_top_windows(precision_rows,life_topic,3,3),life_topic)
        render_windows(f"⚠️ {DISPLAY_LABELS[life_topic]} 상대적으로 덜 유리한 시간대",rolling_bottom_windows(precision_rows,life_topic,3,2),life_topic,"risk")
        if is_krx_session(query_date):
            mrows=cached_intraday_scan(query_date.isoformat(),"09:00:00","15:30:00",15,natal_packed,houses_packed)
            render_windows("📈 수익실현 TOP 시간대",rolling_top_windows(mrows,"수익실현",3,3),"수익실현")
        else: st.info("선택 날짜는 KRX 휴장일이라 장중 투자 시간대를 계산하지 않습니다.")

    elif detail_view=="🪐 트랜짓":
        st.markdown("### 🪐 트랜짓 → 네이탈")
        snapshots,records=build_transit_records(query_dt_utc,natal_lons,natal_houses)
        table=[]
        for r in records:
            table.append({"레이어":r["layer"],"트랜짓":PLANET_KO.get(r["transit"],r["transit"]),"네이탈":PLANET_KO.get(r["target"],r["target"]),"애스펙트":r["name"],"오브":round(r["orb"],2),"상태":r["motion"],"운동":r["direction"],"Whole":r["whole_house"],"Placidus":r["placidus_house"]})
        st.dataframe(pd.DataFrame(table),use_container_width=True,hide_index=True)

    elif detail_view=="🔄 리턴":
        st.markdown("### 🔄 정밀 Return Solver")
        body=st.selectbox("리턴 천체",["Moon","Sun","Mercury","Venus","Mars"],key="return_body")
        if st.button("정밀 리턴 계산",key="return_calc"):
            with st.spinner("회귀점 탐색 중..."):
                st.session_state["return_result_v5"]=(body,find_returns_near(body,natal_lons[body],query_dt_utc))
        stored=st.session_state.get("return_result_v5")
        if stored and stored[0]==body:
            result=stored[1]; prev=result["previous"].astimezone(KST) if result["previous"] else None; nxt=result["next"].astimezone(KST) if result["next"] else None
            st.write("직전:",prev.strftime("%Y-%m-%d %H:%M:%S KST") if prev else "없음")
            st.write("다음:",nxt.strftime("%Y-%m-%d %H:%M:%S KST") if nxt else "없음")

    elif detail_view=="⚙️ 검증":
        st.markdown("### ⚙️ 엔진 검증")
        mc_sign,mc_deg,_=get_sign_and_degree(natal_houses["mc"]); vx_sign,vx_deg,_=get_sign_and_degree(natal_houses["vertex"]); pof_sign,pof_deg,_=get_sign_and_degree(pof_lon)
        st.write(f"ASC **{asc_sign} {asc_deg:.4f}°** · MC **{mc_sign} {mc_deg:.4f}°** · Vertex **{vx_sign} {vx_deg:.4f}°**")
        st.write(f"Sect: **{'주간 차트' if birth_is_day else '야간 차트'}** · Part of Fortune **{pof_sign} {pof_deg:.4f}°**")
        st.write("✅ 일일 대표값: 하루 다중시각 평균")
        st.write("✅ 주간/월간: 날짜별 다중시각 평균 → 기간 집계")
        st.write("✅ Whole Sign 주 가중치 + Placidus 독립 보조 가중치")
        st.write("✅ Applying/Separating + 순행/역행/정지권 반영")
        st.write("✅ 분야별 가변 오브")
        st.write("✅ KRX 휴장일 투자 지수 = N/A, 평균 제외")
        st.write(f"✅ 2026-08-22 KRX 세션 여부: **{is_krx_session(date(2026,8,22))}** (정상값 False)")
        if KRX is None:
            st.warning("exchange_calendars를 불러오지 못해 평일/주말 fallback을 사용 중입니다. requirements.txt 설치 상태를 확인해 주세요.")
        else:
            st.success("XKRX 거래소 캘린더 연결 정상")
        if EPHEMERIS_FALLBACK_REASON: st.warning("DE440s 로드 실패로 DE421 fallback: "+EPHEMERIS_FALLBACK_REASON)
        st.caption("점수는 점성술 해석을 일관되게 만들기 위한 내부 지수이며 사실·사건·수익률의 확률값이 아닙니다.")
