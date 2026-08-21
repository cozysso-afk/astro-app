import calendar
import hmac
import math
import time
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
# 0-B. PRIVATE PIN LOCK / SECRET PROFILE DEFAULTS
# ============================================================
def _secret_text(key, default=""):
    try:
        value = st.secrets.get(key, default)
    except Exception:
        value = default
    return str(value).strip()


def _configured_app_pin():
    return _secret_text("APP_PIN", "")


def require_app_unlock():
    if st.session_state.get("_astro_unlocked", False):
        return

    configured_pin = _configured_app_pin()
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

    now = time.time()
    blocked_until = float(st.session_state.get("_astro_lock_until", 0.0) or 0.0)
    if now < blocked_until:
        st.error(f"PIN 입력 실패가 누적되어 약 {int(blocked_until-now)+1}초 동안 잠겼습니다.")
        st.stop()

    with st.form("astro_private_pin_form", clear_on_submit=True):
        entered_pin = st.text_input("PIN", type="password", label_visibility="collapsed", placeholder="PIN 입력")
        submitted = st.form_submit_button("🌙 별빛의 운명 열기", use_container_width=True)
    if submitted:
        if hmac.compare_digest(entered_pin.strip(), configured_pin):
            st.session_state["_astro_unlocked"] = True
            st.session_state["_astro_pin_failures"] = 0
            st.session_state["_astro_lock_until"] = 0.0
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
    if st.button("🔒 앱 다시 잠그기", use_container_width=True):
        st.session_state["_astro_unlocked"] = False
        st.rerun()

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

# ============================================================
# 8. HUMAN READABLE INTERPRETATION · V5.1 NATURAL LANGUAGE
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


def topic_narrative(topic, score, result, evidences=None, all_scores=None):
    level = score_level(score)
    opening = TOPIC_STATE_COPY[topic][level]
    favor = topic_favorability_note(topic, result)
    cross = cross_topic_note(topic, all_scores)
    action = topic_action(topic, score)
    return " ".join(part for part in [opening, favor, cross, action] if part)


def render_topic_card(topic, score, result, evidences, key_prefix, all_scores=None):
    icon=TOPIC_SPECS[topic]["icon"]; label=DISPLAY_LABELS[topic]
    st.markdown(f"<div class='ast-card'><div class='topic-head'><div class='ast-title'>{icon} {label}</div><div class='topic-score'>{score}/100 · {score_band(score)}</div></div><div class='ast-body'>{topic_narrative(topic,score,result,evidences,all_scores)}</div></div>",unsafe_allow_html=True)
    with st.expander(f"왜 이렇게 나왔어? · {label}"):
        st.write(f"관련 테마가 얼마나 움직이는지(활성도) **{result['activation']}/100** · 움직일 때 얼마나 부드럽게 풀리는지(우호도) **{result['favorability']}/100**")
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
# 9. RETURN / DAILY MOON EVENTS
# ============================================================
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

    with st.spinner("하루 전체 흐름을 계산하는 중..."):
        life_rows=cached_intraday_scan(query_date.isoformat(),"07:00:00","23:30:00",30,natal_packed,houses_packed)
        market_rows=cached_intraday_scan(query_date.isoformat(),"09:00:00","15:30:00",15,natal_packed,houses_packed) if is_krx_session(query_date) else []

    daily_scores={k:rows_avg(life_rows,k) for k in ["금전","학업","시험","직장","이직","연애","연락","재회","소식","컨디션"]}
    st.markdown("<div class='section-kicker'>오늘의 분야별 지수 · 서로 다른 분야의 원점수를 단순 순위화하지 않습니다</div>",unsafe_allow_html=True)
    grid="<div class='score-grid'>"
    for key in ["금전","학업","시험","직장","이직","연애","연락","재회","소식","컨디션"]:
        score=daily_scores[key]
        grid+=f"<div class='score-card'><div class='score-name'>{TOPIC_SPECS[key]['icon']} {DISPLAY_LABELS[key]}</div><div class='score-num'>{score}</div><div class='score-band'>{score_band(score)}</div></div>"
    grid+="</div>"; st.markdown(grid,unsafe_allow_html=True)
    st.caption("점수 라벨: 30~39 약함 · 40~49 다소 약함 · 50~59 보통 · 60~69 보통 이상 · 70~81 강함 · 82 이상 매우 강함")

    st.markdown("#### 💵 돈 · 공부 · 진로")
    for topic in ["금전","학업","시험","직장","이직"]:
        result=aggregate_topic_result(life_rows,topic)
        render_topic_card(topic,daily_scores[topic],result,result["evidence"],"daily",daily_scores)

    st.markdown("#### 💖 관계 · 연락 · 소식")
    for topic in ["연애","연락","재회","소식"]:
        result=aggregate_topic_result(life_rows,topic)
        render_topic_card(topic,daily_scores[topic],result,result["evidence"],"daily",daily_scores)

    st.markdown("#### 🌿 컨디션")
    result=aggregate_topic_result(life_rows,"컨디션")
    render_topic_card("컨디션",daily_scores["컨디션"],result,result["evidence"],"daily",daily_scores)
    st.caption("컨디션·회복 지수는 점성술상의 활동 리듬 참고값이며 질병·진단·치료 예측이 아닙니다.")

    st.markdown("#### 📈 주식·투자")
    if not market_rows:
        st.markdown("<div class='ast-card market-closed'><div class='ast-title'>📵 국내 증시 휴장</div><div class='ast-body'>오늘은 KRX 거래일이 아니므로 <strong>신규진입·수익실현·장중 추천시간 점수를 계산하지 않습니다.</strong> 0점으로 넣지도 않아서 주간·월간 투자 평균을 왜곡하지 않아. 보유 종목 점검·관심종목 정리·다음 거래일 계획용으로만 써.</div></div>",unsafe_allow_html=True)
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
        st.write("일일 대표값은 한 시각 스냅샷이 아니라 07:00~23:30 다중 시각 스캔 평균입니다.")

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
            precision_rows=cached_intraday_scan(query_date.isoformat(),"07:00:00","23:30:00",30,natal_packed,houses_packed)
        render_windows(f"{TOPIC_SPECS[life_topic]['icon']} {DISPLAY_LABELS[life_topic]} TOP 시간대",rolling_top_windows(precision_rows,life_topic,3,3),life_topic)
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
