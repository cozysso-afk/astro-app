import calendar
from datetime import date, datetime, time as dt_time, timedelta

import numpy as np
import pytz
import streamlit as st
import streamlit.components.v1 as components
import swisseph as swe
from PIL import Image
from pathlib import Path
from scipy.optimize import brentq
from skyfield.api import load, wgs84
from skyfield.framelib import ecliptic_frame

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
    initial_sidebar_state="expanded",
)

# iOS '홈 화면에 추가'가 Streamlit 기본 아이콘을 잡지 않도록 parent document의
# favicon / apple-touch-icon을 사용자가 만든 icon.PNG로 명시한다.
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
        let theme = head.querySelector("meta[name='apple-mobile-web-app-title']");
        if (!theme) {{ theme = d.createElement('meta'); theme.name = 'apple-mobile-web-app-title'; head.appendChild(theme); }}
        theme.content = '별빛의 운명';
      }} catch (e) {{ console.warn('iOS icon injection skipped', e); }}
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
    font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif;
    color: #2D3142;
}

.stApp {
    background: linear-gradient(135deg, #FFF5F7 0%, #F5F0FA 50%, #F0F7F7 100%);
    background-attachment: fixed;
}

.ast-card {
    background: rgba(255, 255, 255, 0.82);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-radius: 18px;
    padding: 20px;
    border: 1px solid rgba(255, 255, 255, 0.92);
    box-shadow: 0 8px 24px rgba(180, 150, 190, 0.12);
    margin-bottom: 16px;
}

.ast-title {
    font-family: 'Cinzel', 'Pretendard', serif;
    font-size: 1.15rem;
    font-weight: 800;
    color: #4A3E56;
    margin-bottom: 12px;
}

.metric-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
}

.metric-box {
    background: rgba(255,255,255,0.62);
    border: 1px solid rgba(196,178,205,0.35);
    border-radius: 14px;
    padding: 13px;
}

.metric-label {
    font-size: 0.88rem;
    font-weight: 700;
    color: #5A5062;
}

.metric-score {
    font-family: 'Cinzel', 'Pretendard', serif;
    font-size: 1.18rem;
    font-weight: 800;
    color: #9A7B38;
    margin-top: 4px;
}

.small-note {
    color: #706879;
    font-size: 0.82rem;
    line-height: 1.55;
}

.event-pill {
    background: rgba(255,255,255,0.64);
    border-left: 4px solid rgba(154,123,56,0.65);
    padding: 10px 12px;
    border-radius: 8px;
    margin: 8px 0;
    font-size: 0.9rem;
}

/* 모바일에서 탭이 사라져 보이지 않도록 가로 스크롤 허용 */
.stTabs [data-baseweb="tab-list"] {
    overflow-x: auto;
    flex-wrap: nowrap;
    justify-content: flex-start;
    gap: 4px;
    background: rgba(255,255,255,0.62);
    border-radius: 16px;
    padding: 5px;
    scrollbar-width: none;
}
.stTabs [data-baseweb="tab-list"]::-webkit-scrollbar { display: none; }
.stTabs [data-baseweb="tab"] {
    flex: 0 0 auto;
    white-space: nowrap;
    border-radius: 11px;
    padding: 7px 11px;
}
.stTabs [aria-selected="true"] {
    background: linear-gradient(135deg, rgba(247,201,221,0.85), rgba(221,211,247,0.90)) !important;
    color: #4A3E56 !important;
    font-weight: 800 !important;
}

.profile-strip {
    background: rgba(255,255,255,0.76);
    border: 1px solid rgba(211,190,220,0.52);
    border-radius: 15px;
    padding: 11px 13px;
    margin-bottom: 12px;
    font-size: 0.86rem;
    line-height: 1.55;
}

.score-line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    border-bottom: 1px solid rgba(210,195,220,0.30);
    padding: 9px 0;
}
.score-line:last-child { border-bottom: 0; }
.score-name { font-weight: 750; }
.score-stars { color: #A27E37; letter-spacing: 1px; white-space: nowrap; }
.score-value { color: #655C6E; font-size: 0.82rem; white-space: nowrap; }

.window-card {
    background: rgba(255,255,255,0.74);
    border: 1px solid rgba(196,178,205,0.40);
    border-left: 4px solid rgba(154,123,56,0.72);
    border-radius: 11px;
    padding: 11px 12px;
    margin: 8px 0;
    line-height: 1.55;
    font-size: 0.88rem;
}
.window-card.risk { border-left-color: rgba(210,105,105,0.78); }
.window-card.love { border-left-color: rgba(201,92,135,0.78); }
.window-card.study { border-left-color: rgba(75,113,160,0.78); }

.daily-brief-card {
    border: 1px solid rgba(190,160,210,.50);
    background: rgba(255,255,255,.90);
}
.brief-section {
    margin-top: 10px;
    padding: 12px 13px;
    border-radius: 13px;
    background: rgba(255,255,255,.55);
    border: 1px solid rgba(205,188,218,.34);
}
.brief-section:first-of-type { margin-top: 0; }
.brief-section-title {
    display: block;
    font-weight: 800;
    color: #4A3E56;
    margin-bottom: 6px;
    font-size: .94rem;
}
.brief-conclusion {
    margin-top: 12px;
    padding: 12px 13px;
    border-radius: 13px;
    background: rgba(193,166,220,.11);
    border: 1px solid rgba(193,166,220,.24);
    color: #51475A;
}

@media (max-width: 640px) {
    .metric-grid { grid-template-columns: 1fr; }
    .ast-card { padding: 15px; border-radius: 16px; }
    .stTabs [data-baseweb="tab"] { font-size: 0.80rem; padding: 6px 9px; }
}
</style>
"""
st.markdown(CUSTOM_CSS, unsafe_allow_html=True)

# ============================================================
# 1. CONSTANTS
# ============================================================
KST = pytz.timezone("Asia/Seoul")
UTC = pytz.UTC

SIGNS_KO = [
    "양자리", "황소자리", "쌍둥이자리", "게자리", "사자자리", "처녀자리",
    "천칭자리", "전갈자리", "사수자리", "염소자리", "물병자리", "물고기자리",
]

PLANET_KEYS = {
    # DE440s에는 일부 행성의 center target이 없고 barycenter만 있는 경우가 있어
    # 후보를 순서대로 시도해 커널별 차이를 안전하게 흡수한다.
    "Sun": ("sun",),
    "Moon": ("moon",),
    "Mercury": ("mercury", "mercury barycenter"),
    "Venus": ("venus", "venus barycenter"),
    "Mars": ("mars", "mars barycenter"),
    "Jupiter": ("jupiter", "jupiter barycenter"),
    "Saturn": ("saturn", "saturn barycenter"),
    "Uranus": ("uranus", "uranus barycenter"),
    "Neptune": ("neptune", "neptune barycenter"),
    "Pluto": ("pluto", "pluto barycenter"),
}

# 개인용 앱에서 위도/경도를 직접 칠 필요가 없도록 만든 국내 주요 출생지 목록.
# 좌표는 도시 중심부의 대표 좌표이며, 아주 정밀한 출생지 좌표를 알고 있다면
# 아래 '직접 좌표 입력(고급)' 옵션으로 덮어쓸 수 있다.
KOREA_BIRTHPLACES = {
    "전라남도 여수시": (34.7604, 127.6622),
    "전라남도 순천시": (34.9507, 127.4872),
    "전라남도 광양시": (34.9407, 127.6959),
    "광주광역시": (35.1595, 126.8526),
    "전라북도 전주시": (35.8242, 127.1480),
    "전라북도 군산시": (35.9677, 126.7366),
    "서울특별시": (37.5665, 126.9780),
    "부산광역시": (35.1796, 129.0756),
    "대구광역시": (35.8714, 128.6014),
    "인천광역시": (37.4563, 126.7052),
    "대전광역시": (36.3504, 127.3845),
    "울산광역시": (35.5384, 129.3114),
    "세종특별자치시": (36.4800, 127.2890),
    "경기도 수원시": (37.2636, 127.0286),
    "경기도 성남시": (37.4200, 127.1265),
    "경기도 고양시": (37.6584, 126.8320),
    "경기도 용인시": (37.2411, 127.1776),
    "강원특별자치도 춘천시": (37.8813, 127.7300),
    "강원특별자치도 강릉시": (37.7519, 128.8761),
    "충청북도 청주시": (36.6424, 127.4890),
    "충청남도 천안시": (36.8151, 127.1139),
    "충청남도 공주시": (36.4465, 127.1190),
    "경상북도 포항시": (36.0190, 129.3435),
    "경상북도 경주시": (35.8562, 129.2247),
    "경상남도 창원시": (35.2279, 128.6811),
    "경상남도 진주시": (35.1800, 128.1076),
    "경상남도 통영시": (34.8544, 128.4332),
    "제주특별자치도 제주시": (33.4996, 126.5312),
    "제주특별자치도 서귀포시": (33.2541, 126.5601),
}

PLANET_KO = {
    "Sun": "태양", "Moon": "달", "Mercury": "수성", "Venus": "금성", "Mars": "화성",
    "Jupiter": "목성", "Saturn": "토성", "Uranus": "천왕성", "Neptune": "해왕성", "Pluto": "명왕성",
    "ASC": "ASC", "MC": "MC",
}

# 전통적 Whole Sign 하우스 룰러를 1차 기준으로 사용
TRADITIONAL_RULER_BY_SIGN = {
    0: "Mars",      # Aries
    1: "Venus",     # Taurus
    2: "Mercury",   # Gemini
    3: "Moon",      # Cancer
    4: "Sun",       # Leo
    5: "Mercury",   # Virgo
    6: "Venus",     # Libra
    7: "Mars",      # Scorpio
    8: "Jupiter",   # Sagittarius
    9: "Saturn",    # Capricorn
    10: "Saturn",   # Aquarius
    11: "Jupiter",  # Pisces
}

ASPECTS = {
    "합": {"angle": 0.0, "activation": 1.00, "polarity": 0.00},
    "육십분위": {"angle": 60.0, "activation": 0.72, "polarity": 0.55},
    "사분위": {"angle": 90.0, "activation": 0.90, "polarity": -0.55},
    "삼분위": {"angle": 120.0, "activation": 0.82, "polarity": 0.65},
    "충": {"angle": 180.0, "activation": 1.00, "polarity": -0.45},
}
MAX_ORB = 3.2
EXACT_ORB = 0.01

LAYER_BY_TRANSIT = {
    "Moon": "일일",
    "Sun": "중기", "Mercury": "중기", "Venus": "중기", "Mars": "중기",
    "Jupiter": "장기", "Saturn": "장기", "Uranus": "장기", "Neptune": "장기", "Pluto": "장기",
}

PLANET_TONE = {
    "Sun": 0.15,
    "Moon": 0.05,
    "Mercury": 0.00,
    "Venus": 0.45,
    "Mars": -0.25,
    "Jupiter": 0.50,
    "Saturn": -0.45,
    "Uranus": -0.15,
    "Neptune": -0.10,
    "Pluto": -0.25,
    "ASC": 0.00,
    "MC": 0.00,
}

# 이 점수표는 고전 점성술의 '공식 수학식'이 아니라,
# 해석을 일관되게 만들기 위한 앱 내부의 투명한 휴리스틱이다.
TOPIC_SPECS = {
    "연애": {
        "icon": "💖",
        "targets": {"Venus": 1.00, "Moon": 0.85, "Mars": 0.65, "Sun": 0.45, "Mercury": 0.35, "ASC": 0.45},
        "transits": {"Venus": 1.00, "Moon": 0.85, "Mars": 0.65, "Mercury": 0.50, "Jupiter": 0.55, "Saturn": 0.35, "Sun": 0.35},
        "houses": {5: 1.00, 7: 1.00, 1: 0.35, 8: 0.40},
        "ruler_houses": [5, 7],
    },
    "연락": {
        "icon": "💌",
        "targets": {"Mercury": 1.00, "Venus": 0.70, "Moon": 0.60, "Sun": 0.30, "ASC": 0.30},
        "transits": {"Mercury": 1.00, "Moon": 0.85, "Venus": 0.70, "Mars": 0.35, "Jupiter": 0.30, "Saturn": 0.25},
        "houses": {3: 1.00, 7: 0.85, 1: 0.25, 11: 0.30},
        "ruler_houses": [3, 7],
    },
    "금전": {
        "icon": "💵",
        "targets": {"Venus": 1.00, "Jupiter": 0.85, "Mercury": 0.60, "Saturn": 0.45, "Moon": 0.25, "MC": 0.30},
        "transits": {"Venus": 0.95, "Jupiter": 0.90, "Mercury": 0.70, "Saturn": 0.55, "Mars": 0.40, "Moon": 0.35, "Uranus": 0.35},
        "houses": {2: 1.00, 8: 0.75, 11: 0.85, 10: 0.35},
        "ruler_houses": [2, 8, 11],
    },
    "학업": {
        "icon": "📚",
        "targets": {"Mercury": 1.00, "Saturn": 0.80, "Sun": 0.55, "Mars": 0.45, "Moon": 0.35, "MC": 0.25},
        "transits": {"Mercury": 1.00, "Saturn": 0.75, "Mars": 0.55, "Sun": 0.50, "Moon": 0.45, "Jupiter": 0.35},
        "houses": {3: 1.00, 6: 0.80, 9: 1.00, 10: 0.30},
        "ruler_houses": [3, 6, 9],
    },
    "컨디션": {
        "icon": "🌿",
        "targets": {"Moon": 1.00, "Sun": 0.85, "Mars": 0.55, "Saturn": 0.55, "ASC": 0.80},
        "transits": {"Moon": 1.00, "Sun": 0.60, "Mars": 0.65, "Saturn": 0.65, "Neptune": 0.35, "Jupiter": 0.25},
        "houses": {1: 1.00, 6: 0.90, 12: 0.80},
        "ruler_houses": [1, 6, 12],
    },
    "투자심리": {
        "icon": "📈",
        "targets": {"Mercury": 0.90, "Mars": 0.80, "Jupiter": 0.75, "Saturn": 0.65, "Uranus": 0.60, "Moon": 0.40},
        "transits": {"Mercury": 0.90, "Mars": 0.85, "Jupiter": 0.80, "Saturn": 0.70, "Uranus": 0.70, "Moon": 0.55, "Venus": 0.45},
        "houses": {2: 0.95, 5: 0.80, 8: 0.75, 11: 0.85},
        "ruler_houses": [2, 5, 8, 11],
    },
}

RETURN_CONFIG = {
    "Moon": {"window_days": 35, "step_hours": 1.0},
    "Sun": {"window_days": 370, "step_hours": 12.0},
    "Mercury": {"window_days": 400, "step_hours": 6.0},
    "Venus": {"window_days": 450, "step_hours": 12.0},
    "Mars": {"window_days": 500, "step_hours": 12.0},
}

# ============================================================
# 2. EPHEMERIS / TIME
# ============================================================
@st.cache_resource
def load_ephemeris():
    ts_local = load.timescale()
    try:
        eph_local = load("de440s.bsp")
        used = "DE440s"
        fallback_reason = None
    except Exception as exc:
        eph_local = load("de421.bsp")
        used = "DE421 (fallback)"
        fallback_reason = str(exc)
    return ts_local, eph_local, used, fallback_reason


ts, eph, EPHEMERIS_USED, EPHEMERIS_FALLBACK_REASON = load_ephemeris()
earth = eph["earth"]


def resolve_planet_targets():
    """Resolve the first body key actually present in the loaded SPK kernel."""
    targets = {}
    used_keys = {}
    for body, candidates in PLANET_KEYS.items():
        last_error = None
        for candidate in candidates:
            try:
                targets[body] = eph[candidate]
                used_keys[body] = candidate
                break
            except (KeyError, ValueError) as exc:
                last_error = exc
        else:
            raise KeyError(
                f"{EPHEMERIS_USED}에서 {body} target을 찾지 못했습니다. "
                f"시도한 키: {candidates}. 마지막 오류: {last_error}"
            )
    return targets, used_keys


BODY_TARGETS, BODY_TARGET_KEYS = resolve_planet_targets()


def sf_time(dt_aware):
    """Timezone-aware datetime -> Skyfield Time."""
    return ts.from_datetime(dt_aware.astimezone(UTC))


def to_jd_ut(dt_utc):
    dt_utc = dt_utc.astimezone(UTC)
    hour = (
        dt_utc.hour
        + dt_utc.minute / 60.0
        + dt_utc.second / 3600.0
        + dt_utc.microsecond / 3_600_000_000.0
    )
    return swe.julday(dt_utc.year, dt_utc.month, dt_utc.day, hour, swe.GREG_CAL)

# ============================================================
# 3. LONGITUDE / ZODIAC
# ============================================================
def get_tropical_ecliptic_lon(body_name, time_obj):
    """Geocentric apparent longitude in true ecliptic/equinox of date."""
    target = BODY_TARGETS[body_name]
    apparent = earth.at(time_obj).observe(target).apparent()
    _, lon, _ = apparent.frame_latlon(ecliptic_frame)
    return float(lon.degrees % 360.0)


def get_tropical_ecliptic_lons(body_name, time_objs):
    target = BODY_TARGETS[body_name]
    apparent = earth.at(time_objs).observe(target).apparent()
    _, lon, _ = apparent.frame_latlon(ecliptic_frame)
    return np.mod(np.asarray(lon.degrees, dtype=float), 360.0)


def get_sign_and_degree(lon):
    lon = lon % 360.0
    sign_idx = int(lon // 30)
    return SIGNS_KO[sign_idx], lon % 30.0, sign_idx


def circular_delta(a, b):
    """Signed shortest delta a-b in [-180, 180)."""
    return (a - b + 180.0) % 360.0 - 180.0


def circular_delta_array(a, b):
    return (np.asarray(a) - b + 180.0) % 360.0 - 180.0


def angular_separation(a, b):
    return abs(circular_delta(a, b))

# ============================================================
# 4. HOUSES / ASC / MC / VERTEX / SECT / POF
# ============================================================
def compute_houses(dt_utc, latitude, longitude):
    """
    Swiss Ephemeris house geometry only.
    Planetary longitudes remain Skyfield/JPL based.
    Primary system: Whole Sign. Secondary reference: Placidus.
    """
    jd_ut = to_jd_ut(dt_utc)
    placidus_cusps, ascmc = swe.houses_ex(jd_ut, float(latitude), float(longitude), b"P", 0)

    asc = float(ascmc[0] % 360.0)
    mc = float(ascmc[1] % 360.0)
    vertex = float(ascmc[3] % 360.0)

    asc_sign = int(asc // 30)
    whole_cusps = [float(((asc_sign + i) % 12) * 30.0) for i in range(12)]

    return {
        "jd_ut": jd_ut,
        "asc": asc,
        "mc": mc,
        "vertex": vertex,
        "whole_cusps": whole_cusps,
        "placidus_cusps": [float(x % 360.0) for x in placidus_cusps],
    }


def whole_sign_house(lon, natal_asc_lon):
    asc_sign = int((natal_asc_lon % 360.0) // 30)
    sign = int((lon % 360.0) // 30)
    return (sign - asc_sign) % 12 + 1


def cusp_house(lon, cusps):
    """Assign longitude to an ordered zodiacal cusp array."""
    lon = lon % 360.0
    for i in range(12):
        start = cusps[i] % 360.0
        end = cusps[(i + 1) % 12] % 360.0
        span = (end - start) % 360.0
        pos = (lon - start) % 360.0
        if span > 0 and pos < span:
            return i + 1
    return None


def house_ruler(house_no, natal_asc_lon):
    asc_sign = int((natal_asc_lon % 360.0) // 30)
    house_sign = (asc_sign + house_no - 1) % 12
    return TRADITIONAL_RULER_BY_SIGN[house_sign]


def sun_altitude_degrees(dt_utc, latitude, longitude):
    observer = earth + wgs84.latlon(
        latitude_degrees=float(latitude),
        longitude_degrees=float(longitude),
    )
    t = sf_time(dt_utc)
    apparent = observer.at(t).observe(eph["sun"]).apparent()
    alt, _, _ = apparent.altaz()
    return float(alt.degrees)


def is_day_chart(dt_utc, latitude, longitude):
    return sun_altitude_degrees(dt_utc, latitude, longitude) > 0.0


def calculate_pof(asc_lon, sun_lon, moon_lon, day_chart):
    # Day: ASC + Moon - Sun / Night: ASC + Sun - Moon
    if day_chart:
        return (asc_lon + moon_lon - sun_lon) % 360.0
    return (asc_lon + sun_lon - moon_lon) % 360.0

# ============================================================
# 5. ASPECT ENGINE / APPLYING-SEPARATING / SPEED
# ============================================================
def orb_to_aspect(transit_lon, natal_lon, aspect_angle):
    sep = angular_separation(transit_lon, natal_lon)
    return abs(sep - aspect_angle)


def orb_weight(orb):
    if orb <= 0.5:
        return 1.00
    if orb <= 1.0:
        return 0.85
    if orb <= 2.0:
        return 0.65
    if orb <= MAX_ORB:
        return 0.40
    return 0.0


def motion_window_hours(body):
    if body == "Moon":
        return 0.25
    if body in {"Sun", "Mercury", "Venus", "Mars"}:
        return 1.0
    return 6.0


def planet_snapshot(body, query_dt_utc):
    h = motion_window_hours(body)
    dt_past = query_dt_utc - timedelta(hours=h)
    dt_future = query_dt_utc + timedelta(hours=h)

    lon_now = get_tropical_ecliptic_lon(body, sf_time(query_dt_utc))
    lon_past = get_tropical_ecliptic_lon(body, sf_time(dt_past))
    lon_future = get_tropical_ecliptic_lon(body, sf_time(dt_future))

    elapsed_days = (2.0 * h) / 24.0
    speed = circular_delta(lon_future, lon_past) / elapsed_days

    if speed > 0.002:
        direction = "순행"
    elif speed < -0.002:
        direction = "역행"
    else:
        direction = "정지권"

    return {
        "lon": lon_now,
        "past_lon": lon_past,
        "future_lon": lon_future,
        "speed": speed,
        "direction": direction,
    }


def analyze_aspect_from_snapshot(snapshot, natal_lon):
    candidates = []
    for name, spec in ASPECTS.items():
        orb_now = orb_to_aspect(snapshot["lon"], natal_lon, spec["angle"])
        if orb_now <= MAX_ORB:
            orb_past = orb_to_aspect(snapshot["past_lon"], natal_lon, spec["angle"])
            orb_future = orb_to_aspect(snapshot["future_lon"], natal_lon, spec["angle"])

            if orb_now <= EXACT_ORB:
                motion = "정확(Exact)"
                motion_mult = 1.15
            else:
                slope = orb_future - orb_past
                if slope < -1e-5:
                    motion = "적용(Applying)"
                    motion_mult = 1.08
                elif slope > 1e-5:
                    motion = "분리(Separating)"
                    motion_mult = 0.92
                else:
                    motion = "변화 미미"
                    motion_mult = 1.00

            candidates.append({
                "name": name,
                "angle": spec["angle"],
                "orb": orb_now,
                "orb_weight": orb_weight(orb_now),
                "motion": motion,
                "motion_mult": motion_mult,
                "activation_mult": spec["activation"],
                "base_polarity": spec["polarity"],
            })

    if not candidates:
        return None
    return min(candidates, key=lambda x: x["orb"])

# ============================================================
# 6. TRANSIT RECORDS
# ============================================================
def build_transit_records(query_dt_utc, natal_lons, natal_houses):
    natal_core_points = dict(natal_lons)
    natal_core_points["ASC"] = natal_houses["asc"]
    natal_core_points["MC"] = natal_houses["mc"]

    snapshots = {body: planet_snapshot(body, query_dt_utc) for body in PLANET_KEYS}
    records = []

    for body, snap in snapshots.items():
        whole_house = whole_sign_house(snap["lon"], natal_houses["asc"])
        placidus_house = cusp_house(snap["lon"], natal_houses["placidus_cusps"])

        for target, target_lon in natal_core_points.items():
            asp = analyze_aspect_from_snapshot(snap, target_lon)
            if asp:
                records.append({
                    "layer": LAYER_BY_TRANSIT[body],
                    "transit": body,
                    "target": target,
                    "transit_lon": snap["lon"],
                    "target_lon": target_lon,
                    "whole_house": whole_house,
                    "placidus_house": placidus_house,
                    "speed": snap["speed"],
                    "direction": snap["direction"],
                    **asp,
                })

    records.sort(key=lambda r: (r["orb"], -r["orb_weight"]))
    return snapshots, records

# ============================================================
# 7. TRANSPARENT TOPIC SCORING
# ============================================================
def clamp(x, low, high):
    return max(low, min(high, x))


def aspect_polarity(record):
    base = record["base_polarity"]
    transit_tone = PLANET_TONE.get(record["transit"], 0.0)
    target_tone = PLANET_TONE.get(record["target"], 0.0)

    if record["name"] == "합":
        value = 0.70 * transit_tone + 0.30 * target_tone
    else:
        value = 0.75 * base + 0.30 * transit_tone + 0.10 * target_tone
    return clamp(value, -1.0, 1.0)


def target_weight_for_topic(topic_spec, target, natal_asc_lon):
    weight = topic_spec["targets"].get(target, 0.0)
    if target in PLANET_KEYS:
        rulers = {house_ruler(h, natal_asc_lon) for h in topic_spec["ruler_houses"]}
        if target in rulers:
            weight += 0.20
    return weight


def score_topic(topic_name, transit_records, snapshots, natal_houses):
    spec = TOPIC_SPECS[topic_name]
    raw_activation = 0.0
    polarity_num = 0.0
    polarity_den = 0.0
    evidences = []
    layers = set()

    # A) Aspect contributions
    for rec in transit_records:
        transit_w = spec["transits"].get(rec["transit"], 0.0)
        target_w = target_weight_for_topic(spec, rec["target"], natal_houses["asc"])
        if transit_w <= 0 or target_w <= 0:
            continue

        contribution = (
            rec["orb_weight"]
            * rec["motion_mult"]
            * rec["activation_mult"]
            * transit_w
            * target_w
        )
        if contribution <= 0:
            continue

        pol = aspect_polarity(rec)
        raw_activation += contribution
        polarity_num += contribution * pol
        polarity_den += contribution
        layers.add(rec["layer"])

        evidences.append({
            "kind": "aspect",
            "score": contribution,
            "polarity": pol,
            "text": (
                f"[{rec['layer']}] Transit {rec['transit']} {rec['name']} Natal {rec['target']} "
                f"· orb {rec['orb']:.2f}° · {rec['motion']}"
            ),
        })

    # B) Whole Sign primary house activation + Placidus secondary overlap
    for body, snap in snapshots.items():
        transit_w = spec["transits"].get(body, 0.0)
        if transit_w <= 0:
            continue

        w_house = whole_sign_house(snap["lon"], natal_houses["asc"])
        p_house = cusp_house(snap["lon"], natal_houses["placidus_cusps"])
        house_w = spec["houses"].get(w_house, 0.0)
        if house_w <= 0:
            continue

        contribution = 0.23 * transit_w * house_w
        overlap = p_house in spec["houses"]
        if overlap:
            contribution *= 1.12

        raw_activation += contribution
        layers.add(LAYER_BY_TRANSIT[body])
        evidences.append({
            "kind": "house",
            "score": contribution,
            "polarity": 0.0,
            "text": (
                f"[{LAYER_BY_TRANSIT[body]}] Transit {body} Whole Sign {w_house}H"
                + (f" / Placidus {p_house}H 중첩" if overlap else "")
            ),
        })

    # C) Signal stacking bonus: long + medium + daily layers repeating same topic
    stacking_bonus = max(0, len(layers) - 1) * 5.0
    activation = clamp(raw_activation * 19.0 + stacking_bonus, 0.0, 100.0)

    if polarity_den > 0:
        avg_pol = polarity_num / polarity_den
        favorability = clamp(50.0 + avg_pol * 42.0, 0.0, 100.0)
    else:
        favorability = 50.0

    evidences.sort(key=lambda x: x["score"], reverse=True)
    return {
        "topic": topic_name,
        "activation": int(round(activation)),
        "favorability": int(round(favorability)),
        "layers": sorted(layers),
        "evidence": evidences,
    }


def interpret_topic_score(result):
    a = result["activation"]
    f = result["favorability"]
    if a >= 75 and f >= 62:
        return "관련 테마가 강하게 활성화되고, 흐름도 비교적 우호적인 편"
    if a >= 75 and f <= 42:
        return "관련 테마는 강하게 움직이지만 압박·마찰·과잉 반응 주의"
    if a >= 75:
        return "관련 테마가 강하게 활성화되는 날. 좋고 나쁨보다 사건성이 큼"
    if a >= 55 and f >= 62:
        return "중간 이상 활성화 + 비교적 부드러운 흐름"
    if a >= 55 and f <= 42:
        return "중간 이상 활성화되지만 무리한 판단은 피하는 편이 나음"
    if a >= 35:
        return "보통 수준의 활성화. 단일 신호보다 실제 상황을 우선"
    return "두드러진 활성 신호가 적은 편"

# ============================================================
# 8. ROOT FINDING WITHOUT 180° WRAP FALSE ROOTS
# ============================================================
def make_sample_datetimes(start_dt_utc, end_dt_utc, step_hours):
    out = []
    cursor = start_dt_utc.astimezone(UTC)
    end = end_dt_utc.astimezone(UTC)
    step = timedelta(hours=step_hours)
    while cursor < end:
        out.append(cursor)
        cursor += step
    if not out or out[-1] != end:
        out.append(end)
    return out


def refine_longitude_crossing(body, target_lon, left_dt, right_dt):
    left_t = sf_time(left_dt)
    right_t = sf_time(right_dt)

    def objective(tt_jd):
        t_eval = ts.tt_jd(tt_jd)
        lon = get_tropical_ecliptic_lon(body, t_eval)
        return circular_delta(lon, target_lon)

    f_left = objective(left_t.tt)
    f_right = objective(right_t.tt)

    # Reject wrap discontinuity near +/-180°. A real target crossing bracket is near 0°.
    if max(abs(f_left), abs(f_right)) > 60.0:
        return None
    if abs(f_left) < 1e-10:
        return left_dt.astimezone(UTC)
    if abs(f_right) < 1e-10:
        return right_dt.astimezone(UTC)
    if f_left * f_right > 0:
        return None

    root_tt = brentq(objective, left_t.tt, right_t.tt, xtol=1e-9, maxiter=100)
    return ts.tt_jd(root_tt).utc_datetime().replace(tzinfo=UTC)


def find_longitude_crossings(body, target_lon, start_dt_utc, end_dt_utc, step_hours):
    samples = make_sample_datetimes(start_dt_utc, end_dt_utc, step_hours)
    times = ts.from_datetimes(samples)
    lons = get_tropical_ecliptic_lons(body, times)
    vals = circular_delta_array(lons, target_lon)

    roots = []
    for i in range(len(samples) - 1):
        a = float(vals[i])
        b = float(vals[i + 1])
        if max(abs(a), abs(b)) > 60.0:
            continue
        if a == 0.0 or b == 0.0 or a * b < 0:
            root = refine_longitude_crossing(body, target_lon, samples[i], samples[i + 1])
            if root is not None:
                if not roots or abs((root - roots[-1]).total_seconds()) > 30:
                    roots.append(root)
    return roots


def find_returns_near(body, natal_lon, center_dt_utc):
    cfg = RETURN_CONFIG[body]
    start = center_dt_utc - timedelta(days=cfg["window_days"])
    end = center_dt_utc + timedelta(days=cfg["window_days"])
    roots = find_longitude_crossings(body, natal_lon, start, end, cfg["step_hours"])

    previous = [r for r in roots if r <= center_dt_utc]
    future = [r for r in roots if r > center_dt_utc]
    return {
        "previous": max(previous) if previous else None,
        "next": min(future) if future else None,
        "all": roots,
    }

# ============================================================
# 9. EXACT DAILY MOON TRIGGERS
# ============================================================
def unique_target_longitudes(base_lon, aspect_angle):
    vals = {(base_lon + aspect_angle) % 360.0, (base_lon - aspect_angle) % 360.0}
    return list(vals)


def find_daily_moon_events(query_date, natal_points):
    start_kst = KST.localize(datetime.combine(query_date, dt_time(0, 0, 0)))
    end_kst = start_kst + timedelta(days=1)
    start_utc = start_kst.astimezone(UTC)
    end_utc = end_kst.astimezone(UTC)

    samples = make_sample_datetimes(start_utc, end_utc, 0.5)
    times = ts.from_datetimes(samples)
    moon_lons = get_tropical_ecliptic_lons("Moon", times)

    events = []
    seen = set()

    for target_name, base_lon in natal_points.items():
        for aspect_name, spec in ASPECTS.items():
            for target_lon in unique_target_longitudes(base_lon, spec["angle"]):
                vals = circular_delta_array(moon_lons, target_lon)
                for i in range(len(samples) - 1):
                    a = float(vals[i])
                    b = float(vals[i + 1])
                    if max(abs(a), abs(b)) > 20.0:
                        continue
                    if a == 0.0 or b == 0.0 or a * b < 0:
                        root = refine_longitude_crossing("Moon", target_lon, samples[i], samples[i + 1])
                        if root is None:
                            continue
                        local = root.astimezone(KST)
                        if local.date() != query_date:
                            continue
                        key = (target_name, aspect_name, round(root.timestamp() / 60.0))
                        if key in seen:
                            continue
                        seen.add(key)
                        events.append({
                            "time": local,
                            "target": target_name,
                            "aspect": aspect_name,
                        })

    events.sort(key=lambda x: x["time"])
    return events


# ============================================================
# 10. PERIOD / INTRADAY ANALYSIS HELPERS
# ============================================================
def pack_natal_lons(natal_lons):
    return tuple((body, float(natal_lons[body])) for body in PLANET_KEYS)


def unpack_natal_lons(packed):
    return {body: float(value) for body, value in packed}


def pack_houses(houses):
    return (
        float(houses["asc"]),
        float(houses["mc"]),
        float(houses["vertex"]),
        tuple(float(x) for x in houses["whole_cusps"]),
        tuple(float(x) for x in houses["placidus_cusps"]),
    )


def unpack_houses(packed):
    asc, mc, vertex, whole_cusps, placidus_cusps = packed
    return {
        "asc": float(asc),
        "mc": float(mc),
        "vertex": float(vertex),
        "whole_cusps": list(whole_cusps),
        "placidus_cusps": list(placidus_cusps),
    }


def build_transit_records_subset(query_dt_utc, natal_lons, natal_houses, bodies):
    """Intraday scan helper: calculate only selected moving bodies."""
    natal_core_points = dict(natal_lons)
    natal_core_points["ASC"] = natal_houses["asc"]
    natal_core_points["MC"] = natal_houses["mc"]

    snapshots = {body: planet_snapshot(body, query_dt_utc) for body in bodies}
    records = []
    for body, snap in snapshots.items():
        whole_house_no = whole_sign_house(snap["lon"], natal_houses["asc"])
        placidus_house_no = cusp_house(snap["lon"], natal_houses["placidus_cusps"])
        for target, target_lon in natal_core_points.items():
            asp = analyze_aspect_from_snapshot(snap, target_lon)
            if asp:
                records.append({
                    "layer": LAYER_BY_TRANSIT[body],
                    "transit": body,
                    "target": target,
                    "transit_lon": snap["lon"],
                    "target_lon": target_lon,
                    "whole_house": whole_house_no,
                    "placidus_house": placidus_house_no,
                    "speed": snap["speed"],
                    "direction": snap["direction"],
                    **asp,
                })
    return snapshots, records


def derived_action_scores(topic_results):
    """
    Convert transparent topic scores into practical display indices.
    These are internal comparative indices, not probabilities or price forecasts.
    """
    money = topic_results["금전"]
    invest = topic_results["투자심리"]
    study = topic_results["학업"]
    contact = topic_results["연락"]
    love = topic_results["연애"]
    condition = topic_results["컨디션"]

    overheat = max(0.0, invest["activation"] - invest["favorability"])

    realize = clamp(
        0.40 * money["activation"]
        + 0.40 * money["favorability"]
        + 0.20 * (100.0 - 0.70 * overheat),
        0.0,
        100.0,
    )
    entry = clamp(
        0.25 * money["activation"]
        + 0.35 * money["favorability"]
        + 0.15 * invest["activation"]
        + 0.25 * invest["favorability"]
        - 0.25 * overheat,
        0.0,
        100.0,
    )
    investment_risk = clamp(
        0.55 * invest["activation"]
        + 0.45 * (100.0 - invest["favorability"])
        + 0.15 * overheat,
        0.0,
        100.0,
    )

    def blend(result, activation_weight=0.45):
        return clamp(
            activation_weight * result["activation"]
            + (1.0 - activation_weight) * result["favorability"],
            0.0,
            100.0,
        )

    return {
        "수익실현": int(round(realize)),
        "신규진입": int(round(entry)),
        "투자주의": int(round(investment_risk)),
        "금전": int(round(blend(money))),
        "학업": int(round(blend(study))),
        "연락": int(round(blend(contact))),
        "연애": int(round(blend(love))),
        "컨디션": int(round(blend(condition))),
    }


def score_to_stars(score):
    if score >= 85:
        filled = 5
    elif score >= 70:
        filled = 4
    elif score >= 55:
        filled = 3
    elif score >= 40:
        filled = 2
    elif score >= 25:
        filled = 1
    else:
        filled = 0
    return "✦" * filled + "✧" * (5 - filled)


def score_band(score):
    if score >= 80:
        return "매우 강함"
    if score >= 68:
        return "강함"
    if score >= 55:
        return "보통 이상"
    if score >= 40:
        return "보통"
    return "약함"


def action_advice(name, score):
    if name == "수익실현":
        if score >= 70:
            return "기존 수익권 포지션의 분할확정·비중조절을 검토하기 좋은 상대 구간"
        if score >= 55:
            return "익절 후보를 점검하되 가격·저항대 조건이 먼저"
        return "점성술상 뚜렷한 익절 우호 신호가 약함"
    if name == "신규진입":
        if score >= 70:
            return "신규진입 검토 여지는 있으나 차트·수급 확인이 필수"
        if score >= 55:
            return "선별 진입만 가능, 추격매수는 금지"
        return "관망 또는 소액 분할 접근이 더 보수적"
    if name == "투자주의":
        if score >= 70:
            return "과열·충동·손절 원칙 이탈 경계"
        if score >= 55:
            return "판단 흔들림 가능성 있어 주문 전 재확인"
        return "상대적으로 과열 신호가 낮은 편"
    if score >= 70:
        return "관련 활동에 힘을 싣기 좋은 상대 구간"
    if score >= 55:
        return "무난하게 활용 가능한 구간"
    return "큰 기대보다 루틴 유지가 나은 구간"


def context_at_kst(dt_kst, natal_lons, natal_houses):
    dt_utc = dt_kst.astimezone(UTC)
    snapshots, records = build_transit_records(dt_utc, natal_lons, natal_houses)
    topic_results = {
        topic: score_topic(topic, records, snapshots, natal_houses)
        for topic in TOPIC_SPECS
    }
    return {
        "dt": dt_kst,
        "snapshots": snapshots,
        "records": records,
        "topics": topic_results,
        "actions": derived_action_scores(topic_results),
    }


def make_kst_time_points(day_value, start_time, end_time, step_minutes):
    start_dt = KST.localize(datetime.combine(day_value, start_time))
    end_dt = KST.localize(datetime.combine(day_value, end_time))
    if end_dt < start_dt:
        end_dt += timedelta(days=1)

    points = []
    cursor = start_dt
    step = timedelta(minutes=step_minutes)
    while cursor <= end_dt:
        points.append(cursor)
        cursor += step
    return points


def scan_intraday(day_value, start_time, end_time, step_minutes, natal_lons, natal_houses):
    """
    Fast but still precise intraday scan.
    Moon/Mercury/Venus/Mars are recalculated at every slot.
    Sun and slow planets are fixed at the midpoint of the scan to reduce latency.
    """
    points = make_kst_time_points(day_value, start_time, end_time, step_minutes)
    if not points:
        return []

    midpoint = points[len(points) // 2]
    static_bodies = ["Sun", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"]
    dynamic_bodies = ["Moon", "Mercury", "Venus", "Mars"]

    static_snapshots, static_records = build_transit_records_subset(
        midpoint.astimezone(UTC), natal_lons, natal_houses, static_bodies
    )

    rows = []
    for point in points:
        dynamic_snapshots, dynamic_records = build_transit_records_subset(
            point.astimezone(UTC), natal_lons, natal_houses, dynamic_bodies
        )
        snapshots = {**static_snapshots, **dynamic_snapshots}
        records = static_records + dynamic_records
        topic_results = {
            topic: score_topic(topic, records, snapshots, natal_houses)
            for topic in TOPIC_SPECS
        }
        actions = derived_action_scores(topic_results)
        rows.append({
            "dt": point,
            **actions,
            "topics": topic_results,
        })
    return rows


def rolling_top_windows(rows, key, window_slots=3, top_n=3):
    if not rows:
        return []
    window_slots = max(1, min(window_slots, len(rows)))
    if len(rows) >= 2:
        step = rows[1]["dt"] - rows[0]["dt"]
    else:
        step = timedelta(minutes=30)

    candidates = []
    for start_idx in range(0, len(rows) - window_slots + 1):
        end_idx = start_idx + window_slots - 1
        values = [rows[i][key] for i in range(start_idx, end_idx + 1)]
        avg = sum(values) / len(values)
        center_idx = start_idx + window_slots // 2
        candidates.append({
            "start_idx": start_idx,
            "end_idx": end_idx,
            "start": rows[start_idx]["dt"],
            "end": rows[end_idx]["dt"] + step,
            "score": int(round(avg)),
            "center_row": rows[center_idx],
        })

    candidates.sort(key=lambda x: x["score"], reverse=True)
    selected = []
    for candidate in candidates:
        overlaps = any(
            not (
                candidate["end_idx"] < chosen["start_idx"] - 1
                or candidate["start_idx"] > chosen["end_idx"] + 1
            )
            for chosen in selected
        )
        if overlaps:
            continue
        selected.append(candidate)
        if len(selected) >= top_n:
            break
    return selected


def period_daily_scores(start_date, day_count, reference_time, natal_lons, natal_houses):
    rows = []
    weekday_ko = ["월", "화", "수", "목", "금", "토", "일"]
    for offset in range(day_count):
        day_value = start_date + timedelta(days=offset)
        dt_kst = KST.localize(datetime.combine(day_value, reference_time))
        context = context_at_kst(dt_kst, natal_lons, natal_houses)
        actions = context["actions"]
        rows.append({
            "date": day_value,
            "label": f"{day_value.month}/{day_value.day}({weekday_ko[day_value.weekday()]})",
            **actions,
        })
    return rows


def top_period_days(rows, key, top_n=3, reverse=True):
    return sorted(rows, key=lambda row: row[key], reverse=reverse)[:top_n]


def format_window(window):
    return (
        f"{window['start'].strftime('%H:%M')} ~ {window['end'].strftime('%H:%M')} KST"
    )


def window_narrative(key, window):
    """숫자만 나열하지 않고, 해당 시간대의 활용법을 짧은 문장으로 설명한다."""
    score = window["score"]
    center = window.get("center_row") or {}
    realize = center.get("수익실현", 0)
    entry = center.get("신규진입", 0)
    risk = center.get("투자주의", 0)
    contact = center.get("연락", 0)
    love = center.get("연애", 0)
    study = center.get("학업", 0)

    if key == "수익실현":
        if risk >= 65:
            return (
                "수익을 챙길 힘은 있지만 과열 신호도 같이 올라오는 구간이야. "
                "욕심내서 목표가를 더 올리기보다 분할 익절·예약 주문처럼 미리 정한 기준을 지키는 쪽이 잘 맞아."
            )
        if realize >= entry + 7:
            return (
                "새로 들어가기보다는 이미 가진 포지션을 정리하고 결과를 확정하는 쪽이 상대적으로 더 선명해. "
                "저항대나 목표가에 닿았다면 일부라도 수익을 잠그는 선택을 먼저 검토해봐."
            )
        return (
            "수익실현 신호가 비교적 살아 있는 구간이야. 다만 점수만 보고 매도하지 말고, "
            "가격·거래량·목표가가 같이 맞을 때 분할로 대응하는 게 좋아."
        )
    if key == "신규진입":
        if risk >= 65:
            return (
                "진입 신호와 과열 신호가 겹쳐 있어 좋은 자리처럼 보여도 추격매수는 불리할 수 있어. "
                "한 번에 크게 들어가기보다 눌림 확인이나 소액 분할 접근이 더 안전해."
            )
        if entry >= realize + 6:
            return (
                "정리보다 새 포지션을 탐색하는 쪽이 상대적으로 우세한 구간이야. "
                "다만 지지선 확인 뒤 작은 비중으로 시작하고, 무효화 가격을 먼저 정해두는 게 핵심이야."
            )
        return (
            "진입 여건은 무난하지만 압도적인 구간은 아니야. 관심 종목을 좁혀 두고 "
            "가격 조건이 충족될 때만 들어가는 식으로 선택적으로 쓰는 편이 좋아."
        )
    if key == "투자주의":
        if score >= 70:
            return (
                "판단이 급해지거나 이미 오른 가격을 뒤쫓기 쉬운 경고 구간이야. "
                "신규 주문은 한 템포 늦추고, 손절·익절 기준을 다시 읽은 뒤 실행하는 게 좋아."
            )
        if score >= 55:
            return (
                "큰 경고까지는 아니지만 충동적인 주문이 끼어들 수 있는 시간대야. "
                "수량을 줄이거나 주문 전 1회 재확인 규칙을 두면 실수를 줄이는 데 도움이 돼."
            )
        return "과열 위험은 상대적으로 낮은 편이지만, 실제 매매에서는 가격·수급·손절 기준이 항상 우선이야."
    if key == "연락":
        if contact >= 65:
            return (
                "대화의 문을 열거나 답장을 이어가기 좋은 흐름이 상대적으로 살아 있어. "
                "무거운 결론을 요구하기보다 가볍고 구체적인 한 문장으로 시작하는 쪽이 자연스러워."
            )
        if love >= contact + 7:
            return "감정은 움직여도 표현이 바로 따라오지는 않을 수 있는 구간이야. 먼저 분위기를 읽고 압박 없는 방식으로 접근해봐."
        return "연락을 밀어붙이기보다는 상대 반응을 확인하며 속도를 맞추는 편이 더 어울리는 시간대야."
    if key == "학업":
        if study >= 65:
            return "집중력을 써먹기 좋은 구간이야. 새 내용을 넓게 벌리기보다 문제풀이·암기 회수처럼 성과가 남는 공부를 배치해봐."
        return "긴 몰입보다는 짧은 회독·오답 정리처럼 부담이 적은 과제를 넣는 편이 효율적이야."
    return action_advice(key, score)


def render_windows(title, windows, key, css_class=""):
    st.markdown(f"#### {title}")
    if not windows:
        st.info("계산 가능한 구간이 없습니다.")
        return
    for idx, window in enumerate(windows, start=1):
        score = window["score"]
        st.markdown(
            f"""
            <div class="window-card {css_class}">
                <strong>{idx}위 · {format_window(window)}</strong><br>
                {key} 상대지수 <strong>{score}/100</strong> · {score_band(score)}<br>
                <span class="small-note">{window_narrative(key, window)}</span>
            </div>
            """,
            unsafe_allow_html=True,
        )


@st.cache_data(ttl=21600, show_spinner=False)
def cached_intraday_scan(day_iso, start_hm, end_hm, step_minutes, natal_packed, houses_packed):
    day_value = date.fromisoformat(day_iso)
    start_time = dt_time.fromisoformat(start_hm)
    end_time = dt_time.fromisoformat(end_hm)
    return scan_intraday(
        day_value,
        start_time,
        end_time,
        int(step_minutes),
        unpack_natal_lons(natal_packed),
        unpack_houses(houses_packed),
    )


@st.cache_data(ttl=21600, show_spinner=False)
def cached_period_scores(start_iso, day_count, ref_hm, natal_packed, houses_packed):
    return period_daily_scores(
        date.fromisoformat(start_iso),
        int(day_count),
        dt_time.fromisoformat(ref_hm),
        unpack_natal_lons(natal_packed),
        unpack_houses(houses_packed),
    )


# ============================================================
# 10-B. HUMAN-READABLE WEEKLY / MONTHLY NARRATIVE LAYER
# ============================================================
PERIOD_LABELS = {
    "수익실현": "수익실현",
    "신규진입": "신규진입",
    "투자주의": "투자 과열주의",
    "금전": "금전",
    "학업": "공부·시험",
    "연락": "연락·재회",
    "연애": "연애·관계",
    "컨디션": "컨디션",
}


def period_avg(rows, key):
    if not rows:
        return 0
    return int(round(sum(row.get(key, 0) for row in rows) / len(rows)))


def period_extreme(rows, key, highest=True):
    if not rows:
        return None
    return max(rows, key=lambda row: row.get(key, 0)) if highest else min(rows, key=lambda row: row.get(key, 0))


def period_trend(rows, key):
    """Compare the first and last thirds. Returns a human-readable trend."""
    if len(rows) < 3:
        return "큰 방향성 판단 보류"
    chunk = max(1, len(rows) // 3)
    first = period_avg(rows[:chunk], key)
    last = period_avg(rows[-chunk:], key)
    delta = last - first
    if delta >= 10:
        return f"후반으로 갈수록 뚜렷하게 상승(+{delta})"
    if delta >= 5:
        return f"후반으로 갈수록 완만하게 상승(+{delta})"
    if delta <= -10:
        return f"초반 우세 후 후반 둔화({delta})"
    if delta <= -5:
        return f"후반으로 갈수록 소폭 둔화({delta})"
    return "기간 내 큰 방향 변화 없이 비슷한 수준"


def period_range_text(rows, key):
    if not rows:
        return "데이터 없음"
    vals = [row.get(key, 0) for row in rows]
    return f"평균 {period_avg(rows, key)} · 범위 {min(vals)}~{max(vals)}"


def lead_day_advice(row, lead):
    score = row.get(lead, 0)
    if lead == "수익실현":
        return "보유 포지션이 있다면 목표가·저항대를 확인하고 분할 익절 후보일로 쓰기 좋아."
    if lead == "신규진입":
        return "관심 종목을 미리 추려두고 지지 확인 뒤 작은 비중으로 접근하는 날로 쓰는 편이 좋아."
    if lead == "연락":
        return "연락을 한다면 결론을 재촉하기보다 가볍고 구체적인 말로 대화의 문을 여는 쪽이 잘 맞아."
    if lead == "연애":
        return "관계를 판단하기보다 실제 만남·대화에서 서로의 반응을 확인하는 데 시간을 쓰는 편이 좋아."
    if lead == "학업":
        return "새 범위를 넓히기보다 문제풀이·암기 회수·오답처럼 점수로 연결되는 공부를 우선 배치해봐."
    if lead == "컨디션":
        return "해야 할 일을 몰아넣기보다 몸이 잘 따라오는 시간에 중요한 일정을 먼저 처리하는 게 좋아."
    return f"{PERIOD_LABELS.get(lead, lead)} 점수 {score}은 상대 비교값이니 실제 상황과 같이 봐."


def rows_avg(rows, key):
    if not rows:
        return 0
    return int(round(sum(row.get(key, 0) for row in rows) / len(rows)))


def first_window_text(windows):
    if not windows:
        return None
    return format_window(windows[0])


def _slice_intraday(rows, start_hour, end_hour):
    """Return intraday rows whose local hour is in [start_hour, end_hour)."""
    return [row for row in rows if start_hour <= row["dt"].hour < end_hour]


def _daypart_brief(rows, label):
    """Human-readable morning/afternoon/evening brief based on the scan itself."""
    if not rows:
        return f"<strong>{label}</strong> · 계산 구간이 없습니다."

    keys = ["학업", "연락", "연애", "컨디션"]
    avgs = {key: rows_avg(rows, key) for key in keys}
    ordered = sorted(keys, key=lambda key: avgs[key], reverse=True)
    lead, second, low = ordered[0], ordered[1], ordered[-1]
    lead_score = avgs[lead]
    second_score = avgs[second]

    if lead_score >= 65:
        tone = (
            f"<strong>{PERIOD_LABELS[lead]}</strong>이 {lead_score}/100으로 확실히 앞섭니다. "
            f"{PERIOD_LABELS[second]} {second_score}/100도 받쳐주므로, "
            "중요한 일을 이 시간대에 몰아주는 편이 좋습니다."
        )
    elif lead_score >= 52:
        tone = (
            f"<strong>{PERIOD_LABELS[lead]}</strong> {lead_score}/100이 상대적으로 가장 낫고 "
            f"{PERIOD_LABELS[second]} {second_score}/100이 뒤를 받칩니다. "
            "큰 승부보다는 한 가지 목표를 정해 처리하기 좋은 구간입니다."
        )
    else:
        tone = (
            f"전체 점수가 높게 치고 나가지는 않습니다. 그중 <strong>{PERIOD_LABELS[lead]}</strong>이 "
            f"{lead_score}/100으로 가장 낫고, {PERIOD_LABELS[low]}은 힘이 덜 실립니다. "
            "결과를 억지로 만들기보다 루틴과 정리를 우선하세요."
        )

    if lead == "학업":
        action = "문제풀이·오답·암기 회수처럼 결과가 남는 공부를 먼저 두세요."
    elif lead == "연락":
        action = "연락이 필요하다면 길게 설명하기보다 가볍고 구체적인 한마디가 잘 맞습니다."
    elif lead == "연애":
        action = "관계를 정의하기보다 실제 반응과 분위기를 관찰하는 쪽이 유리합니다."
    else:
        action = "몸이 따라오는 만큼만 움직이고, 일정 사이에 회복 여백을 남겨두세요."

    return f"<strong>{label}</strong> · {tone} {action}"


def daily_full_brief_html(
    market_rows,
    life_rows,
    realize_windows,
    entry_windows,
    risk_windows,
    study_windows,
    contact_windows,
):
    """ChatGPT 예약 브리핑처럼 '숫자 -> 흐름 -> 행동' 순서로 하루를 설명."""
    day = {
        "수익실현": rows_avg(market_rows, "수익실현"),
        "신규진입": rows_avg(market_rows, "신규진입"),
        "투자주의": rows_avg(market_rows, "투자주의"),
        "학업": rows_avg(life_rows, "학업"),
        "연락": rows_avg(life_rows, "연락"),
        "연애": rows_avg(life_rows, "연애"),
        "컨디션": rows_avg(life_rows, "컨디션"),
    }

    positive = ["수익실현", "신규진입", "학업", "연락", "연애", "컨디션"]
    ordered = sorted(positive, key=lambda key: day[key], reverse=True)
    lead, second, low = ordered[0], ordered[1], ordered[-1]
    lead_gap = day[lead] - day[second]

    if day[lead] >= 68 and lead_gap >= 7:
        opening = (
            f"오늘은 여러 분야를 동시에 벌이기보다 <strong>{PERIOD_LABELS[lead]}</strong>에 힘을 모으는 편이 좋습니다. "
            f"하루 평균 {day[lead]}/100으로 다른 분야보다 한 단계 앞서고, "
            f"{PERIOD_LABELS[second]}이 {day[second]}/100으로 뒤를 받칩니다. "
            f"반대로 {PERIOD_LABELS[low]}은 {day[low]}/100으로 상대적으로 힘이 약합니다."
        )
    elif day[lead] >= 55:
        opening = (
            f"오늘은 <strong>{PERIOD_LABELS[lead]}</strong>과 <strong>{PERIOD_LABELS[second]}</strong>이 중심축입니다. "
            f"각각 {day[lead]}/100, {day[second]}/100으로 아주 강한 날이라기보다 "
            "좋은 시간대를 골라 움직였을 때 체감이 올라가는 타입입니다. "
            f"{PERIOD_LABELS[low]}은 {day[low]}/100이라 무리해서 성과를 만들 필요는 없습니다."
        )
    else:
        opening = (
            "오늘은 한 분야가 압도적으로 치고 나가는 날은 아닙니다. "
            f"그래도 <strong>{PERIOD_LABELS[lead]}</strong>이 {day[lead]}/100으로 가장 낫고, "
            f"{PERIOD_LABELS[low]}은 {day[low]}/100으로 낮습니다. "
            "일정을 늘리기보다 이미 정해둔 우선순위를 정확하게 끝내는 쪽이 더 잘 맞습니다."
        )

    if day["컨디션"] < 42:
        opening += " 컨디션 점수도 낮은 편이라, 중요한 판단은 피곤해지기 전에 끝내는 게 좋습니다."
    elif day["컨디션"] >= 62:
        opening += " 컨디션은 비교적 받쳐주는 편이라, 미뤄둔 중요한 일을 처리하기 좋습니다."

    morning = _daypart_brief(_slice_intraday(life_rows, 7, 12), "오전 07~12시")
    afternoon = _daypart_brief(_slice_intraday(life_rows, 12, 18), "오후 12~18시")
    evening = _daypart_brief(_slice_intraday(life_rows, 18, 24), "저녁 18~23시")

    realize = day["수익실현"]
    entry = day["신규진입"]
    risk = day["투자주의"]
    realize_time = first_window_text(realize_windows)
    entry_time = first_window_text(entry_windows)
    risk_time = first_window_text(risk_windows)

    if realize >= entry + 6:
        invest_head = "오늘 투자 흐름은 <strong>신규진입보다 수익실현·보유관리</strong> 쪽이 한발 앞섭니다."
        invest_action = (
            f"수익실현 평균 {realize}/100, 신규진입 {entry}/100입니다. "
            + (
                f"보유 종목이 수익권이라면 <strong>{realize_time}</strong> 전후를 "
                "목표가·저항대 확인과 분할 확정 후보 구간으로 먼저 보세요. "
                if realize_time
                else "보유 종목의 목표가·저항대가 맞는 경우에만 분할 확정을 검토하세요. "
            )
            + "새 포지션을 만들기 위해 조건을 낮추는 것보다는 이미 가진 포지션을 계획대로 관리하는 쪽이 더 자연스럽습니다."
        )
    elif entry >= realize + 6:
        invest_head = "오늘 투자 흐름은 <strong>보유 정리보다 신규진입 탐색</strong> 쪽이 조금 더 살아 있습니다."
        invest_action = (
            f"신규진입 평균 {entry}/100, 수익실현 {realize}/100입니다. "
            + (
                f"후보 구간은 <strong>{entry_time}</strong> 전후지만, "
                "지지·수급이 실제로 확인되는 종목만 작은 비중으로 접근하는 게 좋습니다. "
                if entry_time
                else "관심 종목을 좁혀두고 실제 가격 지지가 확인될 때만 작은 비중으로 접근하세요. "
            )
            + "점수가 좋다는 이유만으로 추격하거나 손절 기준을 넓히지는 마세요."
        )
    else:
        invest_head = "오늘 투자 흐름은 <strong>수익실현과 신규진입의 우열이 뚜렷하지 않습니다.</strong>"
        invest_action = (
            f"수익실현 {realize}/100, 신규진입 {entry}/100으로 차이가 작습니다. "
            "이런 날은 매매 횟수를 늘리기보다 보유 종목의 가격 조건이 정확히 맞을 때만 대응하는 편이 낫습니다. "
            "현금 비중을 유지하는 것도 충분히 하나의 선택입니다."
        )

    if risk >= 68:
        invest_risk = (
            f"특히 과열주의가 <strong>{risk}/100</strong>으로 높습니다. "
            + (f"<strong>{risk_time}</strong> 전후에는 " if risk_time else "")
            + "‘지금 아니면 못 산다’는 식의 조급함이 개입하기 쉬우니 주문 전에 수량·손절가·무효화 조건을 먼저 적어두세요."
        )
    elif risk >= 55:
        invest_risk = (
            f"과열주의는 {risk}/100으로 중간 이상입니다. 첫 주문을 작게 하고, "
            "계획에 없던 물타기·불타기만 막아도 오늘의 실수 가능성을 크게 줄일 수 있습니다."
        )
    else:
        invest_risk = (
            f"과열주의는 {risk}/100으로 상대적으로 낮습니다. 그래도 점성술 점수는 매매 신호가 아니라 "
            "보조 지표이므로 가격·수급·거래량·손절 기준이 항상 우선입니다."
        )

    contact = day["연락"]
    love = day["연애"]
    contact_time = first_window_text(contact_windows)
    if contact >= love + 5:
        relation = (
            f"관계 쪽은 <strong>감정 결론을 내기보다 접점을 만드는 것</strong>이 더 낫습니다. "
            f"연락 {contact}/100, 연애 {love}/100이고"
            + (f", <strong>{contact_time}</strong> 전후가 연락 후보 시간으로 가장 자연스럽습니다. " if contact_time else ". ")
            + "메시지는 길게 설명하거나 답을 재촉하기보다 상대가 부담 없이 답할 수 있는 구체적인 한마디가 잘 맞습니다. "
            "반응이 미지근하면 그 자리에서 의미를 확대해석하지 말고 다음 반응을 기다리세요."
        )
    elif love >= contact + 5:
        relation = (
            f"관계 쪽은 연락 횟수보다 <strong>감정의 온도와 실제 반응</strong>을 읽는 게 중요합니다. "
            f"연애 {love}/100, 연락 {contact}/100입니다. "
            "오늘 대화가 생긴다면 관계를 정의하려 들기보다 말투·답장 속도·후속 질문처럼 실제 반응을 관찰하세요. "
            "좋은 분위기가 와도 한 번의 반응만으로 결론을 내리지 않는 게 좋습니다."
        )
    else:
        relation = (
            f"연락 {contact}/100, 연애 {love}/100으로 두 흐름이 비슷합니다. "
            "큰 고백이나 관계 정의보다 <strong>작은 반응 확인</strong>이 더 어울립니다. "
            + (f"움직인다면 <strong>{contact_time}</strong> 전후에 " if contact_time else "먼저 움직인다면 ")
            + "가벼운 접점을 만들고, 상대의 후속 반응이 이어지는지를 보는 방식이 좋습니다."
        )

    study = day["학업"]
    condition = day["컨디션"]
    study_time = first_window_text(study_windows)
    if study >= 62:
        study_text = (
            f"공부·시험은 <strong>{study}/100</strong>으로 오늘 활용 가치가 있습니다. "
            + (f"<strong>{study_time}</strong> 전후에 " if study_time else "")
            + "새로운 범위를 넓히기보다 문제풀이, 오답 회수, 암기 테스트처럼 결과가 눈에 보이는 작업을 먼저 넣으세요. "
            "집중이 올라왔을 때 가장 점수로 연결되는 과목을 잡는 게 효율적입니다."
        )
    elif study >= 45:
        study_text = (
            f"공부·시험은 {study}/100으로 보통입니다. 오래 앉아 있는 것보다 30~50분 단위로 끊고, "
            "오늘 반드시 끝낼 범위를 작게 정하는 방식이 더 잘 맞습니다. "
            "새 진도와 복습을 동시에 욕심내기보다 하나를 끝내고 다음으로 넘어가세요."
        )
    else:
        study_text = (
            f"공부·시험은 {study}/100으로 강한 날은 아닙니다. 어려운 새 범위를 늘리기보다 "
            "복습·정리·암기 유지처럼 실수를 줄이는 공부를 우선하세요. "
            "공부량보다 회수율을 챙기는 날로 쓰는 편이 좋습니다."
        )

    if condition >= 62:
        condition_text = (
            f"컨디션은 {condition}/100으로 비교적 받쳐줍니다. 미뤄둔 중요한 일은 체력이 남아 있을 때 먼저 처리하세요."
        )
    elif condition < 42:
        condition_text = (
            f"컨디션은 {condition}/100으로 낮습니다. 피곤한 상태에서 결론을 내리기보다 식사·수분·짧은 휴식을 일정에 넣는 게 필요합니다."
        )
    else:
        condition_text = (
            f"컨디션은 {condition}/100으로 무난합니다. 몰아서 버티기보다 일정한 속도로 가면 하루 후반까지 유지하기 좋습니다."
        )

    actions = []
    if lead == "수익실현":
        actions.append("① 보유 수익권 종목의 목표가·저항대부터 확인하기")
    elif lead == "신규진입":
        actions.append("① 관심 종목을 좁히고 지지 확인 뒤 작은 비중만 검토하기")
    elif lead == "연락":
        actions.append("① 연락이 필요하면 짧고 구체적인 한마디로 접점 만들기")
    elif lead == "연애":
        actions.append("① 관계의 결론보다 상대의 실제 반응과 온도 확인하기")
    elif lead == "학업":
        actions.append("① 점수로 이어지는 문제풀이·오답·암기 회수 먼저 하기")
    else:
        actions.append("① 몸이 잘 따라오는 시간에 가장 중요한 일정부터 처리하기")

    if risk >= 55:
        actions.append("② 투자 주문 전 수량·손절가·무효화 조건을 먼저 적기")
    else:
        actions.append("② 오늘 가장 좋은 시간대 한 곳에 중요한 일을 집중하기")

    if day[low] < 45:
        actions.append(f"③ {PERIOD_LABELS[low]}은 억지로 성과를 만들지 말고 최소 목표만 지키기")
    else:
        actions.append("③ 저녁에는 결과를 늘리기보다 오늘 한 일을 정리하고 내일 우선순위 잡기")

    if risk >= 68:
        one_line = (
            f"오늘의 결론은 <strong>{PERIOD_LABELS[lead]}에는 힘을 쓰되, 투자에서는 속도보다 기준을 지키는 것</strong>입니다."
        )
    elif day[lead] >= 60:
        one_line = (
            f"오늘의 결론은 <strong>{PERIOD_LABELS[lead]}에 우선순위를 두고 좋은 시간대에 중요한 한 가지를 끝내는 것</strong>입니다."
        )
    else:
        one_line = (
            "오늘의 결론은 <strong>크게 벌이기보다 잘 되는 분야만 골라 움직이고, 나머지는 루틴을 지키는 것</strong>입니다."
        )

    html = f"""
<div class="ast-card daily-brief-card">
  <div class="ast-title" style="font-size:1.22rem;">🌙 오늘 브리핑 · 하루를 이렇게 쓰세요</div>
  <div class="small-note" style="font-size:0.95rem; line-height:1.82;">
    <div class="brief-section"><span class="brief-section-title">✨ 한눈에 보면</span>{opening}</div>
    <div class="brief-section"><span class="brief-section-title">🕰️ 시간 흐름</span>{morning}<br>{afternoon}<br>{evening}</div>
    <div class="brief-section"><span class="brief-section-title">💰 투자 브리핑</span>{invest_head} {invest_action}<br>{invest_risk}</div>
    <div class="brief-section"><span class="brief-section-title">💌 연락·연애 브리핑</span>{relation}</div>
    <div class="brief-section"><span class="brief-section-title">📚 공부·컨디션 브리핑</span>{study_text} {condition_text}</div>
    <div class="brief-section"><span class="brief-section-title">✅ 오늘 해둘 것</span>{"<br>".join(actions)}</div>
    <div class="brief-conclusion">{one_line}</div>
  </div>
</div>
"""
    # Streamlit Markdown은 HTML 블록 안의 빈 줄/들여쓰기를 코드블록으로 오해할 수 있다.
    # 줄바꿈과 앞쪽 공백을 제거해 iOS에서도 <strong>/<br>가 문자 그대로 노출되지 않게 한다.
    return "".join(line.strip() for line in html.splitlines())


def weekly_overview_text(rows):
    positive_keys = ["수익실현", "신규진입", "학업", "연락", "연애", "컨디션"]
    avgs = {key: period_avg(rows, key) for key in positive_keys}
    lead_key = max(avgs, key=avgs.get)
    lead_day = period_extreme(rows, lead_key, True)
    risk_day = period_extreme(rows, "투자주의", True)
    risk_avg = period_avg(rows, "투자주의")

    parts = [
        f"이번 7일의 중심축은 <strong>{PERIOD_LABELS[lead_key]}</strong>이야. "
        f"주간 평균은 <strong>{avgs[lead_key]}/100</strong>, 가장 힘이 모이는 날은 "
        f"<strong>{lead_day['label']} {lead_day[lead_key]}/100</strong>이야. "
        f"{lead_day_advice(lead_day, lead_key)}"
    ]
    if risk_day:
        if risk_day["투자주의"] >= 70:
            parts.append(
                f"투자에서는 <strong>{risk_day['label']}</strong>의 과열주의가 "
                f"<strong>{risk_day['투자주의']}/100</strong>까지 올라가. 좋은 점수가 같이 보여도 추격·몰빵보다 "
                "주문 크기를 줄이고 기준을 다시 확인하는 날로 보는 게 좋아."
            )
        elif risk_avg >= 55:
            parts.append("주중 투자심리는 약간 들뜰 수 있어. 진입 기회 찾기와 별개로 손절·수량 기준을 먼저 고정해두는 편이 좋아.")
        else:
            parts.append("주간 과열 신호는 아주 강하지 않아. 그래도 투자 파트는 실제 가격·수급·손절 기준을 우선해서 써야 해.")
    return " ".join(parts)


def weekly_topic_text(rows, key, risk=False):
    best = period_extreme(rows, key, True)
    worst = period_extreme(rows, key, False)
    avg = period_avg(rows, key)
    trend = period_trend(rows, key)
    label = PERIOD_LABELS[key]
    if not best or not worst:
        return "데이터가 부족해."

    if risk:
        if best[key] >= 70:
            return (
                f"{label} 평균은 <strong>{avg}/100</strong>. 가장 조심할 날은 "
                f"<strong>{best['label']} {best[key]}/100</strong>이고, {trend}. "
                "이 날은 ‘기회가 없어야 한다’는 뜻보다, 판단 속도가 빨라질 수 있으니 주문 횟수·수량을 평소보다 보수적으로 두라는 신호로 읽는 게 좋아."
            )
        return (
            f"{label} 평균은 <strong>{avg}/100</strong>, 최고치는 <strong>{best['label']} {best[key]}/100</strong>. "
            f"{trend}. 극단적 경고는 적지만 계획 밖의 추격 주문만 피하면 돼."
        )

    if avg >= 68:
        tone = "주간 전체적으로 힘이 꾸준히 실리는 편"
    elif avg >= 55:
        tone = "쓸 만한 구간이 분명히 있는 편"
    elif avg >= 40:
        tone = "날짜 선택에 따라 체감 차이가 나는 보통 흐름"
    else:
        tone = "강하게 밀어붙이기보다 준비·관찰이 나은 흐름"

    advice = lead_day_advice(best, key)
    return (
        f"{label}는 평균 <strong>{avg}/100</strong>으로 {tone}이야. "
        f"가장 좋은 날은 <strong>{best['label']} {best[key]}/100</strong>, 가장 약한 날은 "
        f"<strong>{worst['label']} {worst[key]}/100</strong>. {trend}. "
        f"특히 {best['label']}에는 {advice}"
    )


def daily_period_one_liner(row):
    candidates = ["수익실현", "신규진입", "학업", "연락", "연애", "컨디션"]
    ordered = sorted(candidates, key=lambda k: row.get(k, 0), reverse=True)
    lead, second = ordered[0], ordered[1]
    risk = row.get("투자주의", 0)
    gap = row[lead] - row[second]

    if gap >= 10:
        shape = f"<strong>{PERIOD_LABELS[lead]}</strong>이 다른 분야보다 확실히 앞서는 날"
    elif gap >= 5:
        shape = f"<strong>{PERIOD_LABELS[lead]}</strong>이 한 단계 앞서는 날"
    else:
        shape = f"<strong>{PERIOD_LABELS[lead]}</strong>과 {PERIOD_LABELS[second]}이 비슷하게 움직이는 날"

    text = (
        f"<strong>{row['label']}</strong> · {shape}. "
        f"{PERIOD_LABELS[lead]} {row[lead]}/100, {PERIOD_LABELS[second]} {row[second]}/100. "
        f"{lead_day_advice(row, lead)}"
    )
    if risk >= 70:
        text += f" <strong>⚠️ 투자 과열주의 {risk}/100</strong>이라 매매는 평소보다 한 단계 더 보수적으로."
    elif risk >= 58:
        text += f" 투자 과열주의 {risk}/100이므로 주문 전 수량·손절가를 한 번 더 확인해."
    return text


def segment_rows(rows, parts=3):
    if not rows:
        return []
    n = len(rows)
    if parts == 3:
        a = max(1, min(10, n))
        b = max(a, min(20, n))
        return [rows[:a], rows[a:b], rows[b:]]
    step = max(1, n // parts)
    return [rows[i:i+step] for i in range(0, n, step)]


def segment_summary(rows, label):
    if not rows:
        return f"<strong>{label}</strong> · 해당 구간 없음"
    keys = ["수익실현", "신규진입", "학업", "연락", "연애", "컨디션"]
    avgs = {k: period_avg(rows, k) for k in keys}
    lead = max(avgs, key=avgs.get)
    best = period_extreme(rows, lead, True)
    risk = period_avg(rows, "투자주의")
    start = rows[0]["label"]
    end = rows[-1]["label"]
    extra = lead_day_advice(best, lead)
    caution = ""
    if risk >= 68:
        caution = f" 투자과열 평균 <strong>{risk}</strong>이라 매매는 수량을 줄이고 기준 확인을 우선해."
    elif risk >= 55:
        caution = f" 투자과열 평균 <strong>{risk}</strong>이라 계획 밖 주문만 조심해."
    return (
        f"<strong>{label} ({start}~{end})</strong> · 중심 테마는 "
        f"<strong>{PERIOD_LABELS[lead]} {avgs[lead]}/100</strong>. {period_trend(rows, lead)}. "
        f"이 구간에서는 {extra}{caution}"
    )


def monthly_overview_text(rows):
    keys = ["수익실현", "신규진입", "학업", "연락", "연애", "컨디션"]
    avgs = {k: period_avg(rows, k) for k in keys}
    lead = max(avgs, key=avgs.get)
    best = period_extreme(rows, lead, True)
    risk = period_extreme(rows, "투자주의", True)
    text = (
        f"이번 달은 한 숫자보다 <strong>월초→월중→월말의 이동</strong>을 보는 게 중요해. "
        f"전체 평균에서는 <strong>{PERIOD_LABELS[lead]} {avgs[lead]}/100</strong>이 가장 강하고, "
        f"최고점은 <strong>{best['label']} {best[lead]}/100</strong>이야. "
        f"{lead_day_advice(best, lead)}"
    )
    if risk:
        text += (
            f" 투자 과열 신호의 월간 최고점은 <strong>{risk['label']} {risk['투자주의']}/100</strong>. "
            "그 날은 좋은 신호가 함께 있어도 실제 주문은 가격·수급·손절 기준을 먼저 확인해."
        )
    return text


def monthly_topic_text(rows, key, risk=False):
    best = period_extreme(rows, key, True)
    worst = period_extreme(rows, key, False)
    avg = period_avg(rows, key)
    if not best or not worst:
        return "데이터가 부족해."
    if risk:
        return (
            f"월간 평균 <strong>{avg}/100</strong>. 가장 경계할 날짜는 "
            f"<strong>{best['label']} {best[key]}/100</strong>이고, {period_trend(rows, key)}. "
            "높은 날에는 ‘매매 금지’라기보다 추격·과대수량·계획 변경을 피하는 날로 활용해."
        )
    return (
        f"월간 평균 <strong>{avg}/100</strong> · {period_trend(rows, key)}. "
        f"가장 힘이 실리는 날은 <strong>{best['label']} {best[key]}/100</strong>, "
        f"가장 잔잔한 날은 <strong>{worst['label']} {worst[key]}/100</strong>. "
        f"피크 날짜에는 {lead_day_advice(best, key)}"
    )


def top_bottom_text(rows, key, top_n=3):
    top = top_period_days(rows, key, top_n=top_n, reverse=True)
    low = top_period_days(rows, key, top_n=top_n, reverse=False)
    top_text = ", ".join(f"{r['label']} {r[key]}" for r in top)
    low_text = ", ".join(f"{r['label']} {r[key]}" for r in low)
    return top_text, low_text

# ============================================================
# 11. VISIBLE PROFILE / QUERY INPUTS
# ============================================================
st.markdown('<div class="top-nav">✦ ASTROLOGY · HOROSCOPE · PRIVATE ✦</div>', unsafe_allow_html=True)
st.title("🌙 별빛의 운명")
st.caption("DE440s 기반 · Tropical · Whole Sign 주 기준 · Placidus 보조")

# 모바일에서 사이드바가 자동으로 접히는 문제를 피하기 위해 입력창을 본문 최상단에 둔다.
with st.expander("👤 출생정보 · 조회날짜 입력/수정", expanded=True):
    user_name = st.text_input("성함 또는 호칭", value="다현", key="profile_name")
    birth_date = st.date_input("출생일", datetime(1991, 3, 21), key="profile_birth_date")
    birth_time = st.time_input("출생 시간", dt_time(7, 26), step=60, key="profile_birth_time")

    place_options = list(KOREA_BIRTHPLACES.keys()) + ["직접 좌표 입력(고급)"]
    birth_place = st.selectbox(
        "출생 지역",
        place_options,
        index=place_options.index("전라남도 여수시"),
        help="도시를 고르면 좌표가 자동 적용됩니다.",
        key="profile_birth_place",
    )
    if birth_place == "직접 좌표 입력(고급)":
        lat = st.number_input("출생지 위도(N)", value=34.7604, format="%.6f", key="profile_lat")
        lon = st.number_input("출생지 경도(E)", value=127.6622, format="%.6f", key="profile_lon")
        place_label = "직접 좌표"
    else:
        lat, lon = KOREA_BIRTHPLACES[birth_place]
        place_label = birth_place
        st.caption(f"📍 자동 좌표: {lat:.4f}°N, {lon:.4f}°E")

    st.markdown("---")
    now_kst = datetime.now(KST)
    query_date = st.date_input("운세 조회 날짜", now_kst.date(), key="profile_query_date")
    query_time = st.time_input(
        "일일 리포트 기준 시각",
        now_kst.time().replace(second=0, microsecond=0),
        step=60,
        key="profile_query_time",
    )
    period_reference_time = st.time_input(
        "주간·월간 일별 비교 기준 시각",
        dt_time(12, 0),
        step=60,
        help="각 날짜를 같은 시각에 비교해야 순위가 일관됩니다.",
        key="period_reference_time",
    )

birth_dt_kst = KST.localize(datetime.combine(birth_date, birth_time))
birth_dt_utc = birth_dt_kst.astimezone(UTC)
query_dt_kst = KST.localize(datetime.combine(query_date, query_time))
query_dt_utc = query_dt_kst.astimezone(UTC)

t_birth = sf_time(birth_dt_utc)
t_query = sf_time(query_dt_utc)

# ============================================================
# 12. NATAL / TRANSIT CORE CALCULATION
# ============================================================
try:
    natal_houses = compute_houses(birth_dt_utc, lat, lon)
except Exception as exc:
    st.error(f"ASC/하우스 계산에 실패했습니다: {exc}")
    st.stop()

natal_lons = {body: get_tropical_ecliptic_lon(body, t_birth) for body in PLANET_KEYS}
transit_lons = {body: get_tropical_ecliptic_lon(body, t_query) for body in PLANET_KEYS}
birth_is_day = is_day_chart(birth_dt_utc, lat, lon)
pof_lon = calculate_pof(
    natal_houses["asc"],
    natal_lons["Sun"],
    natal_lons["Moon"],
    birth_is_day,
)

snapshots, transit_records = build_transit_records(query_dt_utc, natal_lons, natal_houses)
topic_results = {
    topic: score_topic(topic, transit_records, snapshots, natal_houses)
    for topic in TOPIC_SPECS
}
action_scores = derived_action_scores(topic_results)

natal_points_for_daily = {
    "Sun": natal_lons["Sun"],
    "Moon": natal_lons["Moon"],
    "Mercury": natal_lons["Mercury"],
    "Venus": natal_lons["Venus"],
    "Mars": natal_lons["Mars"],
    "Jupiter": natal_lons["Jupiter"],
    "Saturn": natal_lons["Saturn"],
    "ASC": natal_houses["asc"],
    "MC": natal_houses["mc"],
}

natal_packed = pack_natal_lons(natal_lons)
houses_packed = pack_houses(natal_houses)

asc_sign, asc_deg, _ = get_sign_and_degree(natal_houses["asc"])
st.markdown(
    f"""
    <div class="profile-strip">
        <strong>{user_name}</strong> · {birth_date.strftime('%Y.%m.%d')} {birth_time.strftime('%H:%M')}
        · {place_label}<br>
        ASC <strong>{asc_sign} {asc_deg:.2f}°</strong> · 조회 <strong>{query_dt_kst.strftime('%Y.%m.%d %H:%M KST')}</strong>
    </div>
    """,
    unsafe_allow_html=True,
)

# ============================================================
# 13. FULL FEATURE TABS
# ============================================================
tabs = st.tabs([
    "📜 일일",
    "📅 주간",
    "🌕 월간",
    "📈 정밀 시간대",
    "⏱️ 트랜짓",
    "🔄 리턴",
    "⚙️ 검증",
])

# ------------------------------------------------------------
# TAB 1 — DAILY
# ------------------------------------------------------------
with tabs[0]:
    st.markdown(f"### 🌙 {query_date.strftime('%Y년 %m월 %d일')} {user_name} 일일 정밀 리포트")

    moon_sign, moon_deg, _ = get_sign_and_degree(transit_lons["Moon"])
    moon_whole_house = whole_sign_house(transit_lons["Moon"], natal_houses["asc"])
    moon_placidus_house = cusp_house(transit_lons["Moon"], natal_houses["placidus_cusps"])

    st.markdown(
        f"""
        <div class="ast-card">
            <div class="ast-title">🪐 오늘의 계산 기준</div>
            <div class="small-note">
                Ephemeris <strong>{EPHEMERIS_USED}</strong> · Tropical true ecliptic/equinox of date<br>
                오늘 달 <strong>{moon_sign} {moon_deg:.2f}°</strong> · Whole Sign <strong>{moon_whole_house}H</strong>
                · Placidus <strong>{moon_placidus_house}H</strong><br>
                활성도와 우호도를 분리하고, 장기·중기·일일 레이어 중첩을 반영합니다.
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # 하루 전체 스캔을 먼저 계산해, 숫자표보다 "오늘 브리핑"을 앞에 보여줍니다.
    # 실제 계산 기반 인트라데이 구간
    with st.spinner("오늘의 정밀 시간대를 계산하는 중..."):
        market_rows = cached_intraday_scan(
            query_date.isoformat(), "09:00:00", "15:30:00", 15, natal_packed, houses_packed
        )
        life_rows = cached_intraday_scan(
            query_date.isoformat(), "07:00:00", "23:30:00", 30, natal_packed, houses_packed
        )

    realize_windows = rolling_top_windows(market_rows, "수익실현", window_slots=3, top_n=2)
    entry_windows = rolling_top_windows(market_rows, "신규진입", window_slots=3, top_n=2)
    risk_windows = rolling_top_windows(market_rows, "투자주의", window_slots=3, top_n=2)
    study_windows = rolling_top_windows(life_rows, "학업", window_slots=3, top_n=2)
    contact_windows = rolling_top_windows(life_rows, "연락", window_slots=3, top_n=2)

    # 예약 브리핑처럼: 하루 전체 스캔을 숫자가 아니라 행동 문장으로 먼저 요약
    st.markdown(
        daily_full_brief_html(
            market_rows, life_rows,
            realize_windows, entry_windows, risk_windows,
            study_windows, contact_windows,
        ),
        unsafe_allow_html=True,
    )


    summary_items = [
        ("💰 수익실현 적합도", "수익실현"),
        ("🎯 신규진입 안정성", "신규진입"),
        ("⚠️ 투자 과열주의", "투자주의"),
        ("📚 학업·시험", "학업"),
        ("💌 연락·재회", "연락"),
        ("💖 연애", "연애"),
    ]
    summary_html = '<div class="ast-card"><div class="ast-title">📊 조회시각 핵심 지표</div><div class="small-note" style="margin-bottom:8px;">아래 점수는 현재 조회시각의 스냅샷이고, ‘하루 총평’은 하루 전체 시간대 스캔을 따로 종합합니다.</div>'
    for label, key in summary_items:
        score = action_scores[key]
        summary_html += (
            f'<div class="score-line"><span class="score-name">{label}</span>'
            f'<span class="score-stars">{score_to_stars(score)}</span>'
            f'<span class="score-value">{score}/100 · {score_band(score)}</span></div>'
        )
    summary_html += '</div>'
    st.markdown(summary_html, unsafe_allow_html=True)

    with st.expander("🔎 분야별 활성도·우호도 및 점수 근거"):
        topic_choice = st.selectbox("근거를 볼 분야", list(TOPIC_SPECS.keys()), key="daily_topic_evidence")
        result = topic_results[topic_choice]
        st.write(f"**{topic_choice}: 활성 {result['activation']}/100 · 우호 {result['favorability']}/100**")
        st.caption(interpret_topic_score(result))
        for evidence in result["evidence"][:12]:
            st.write(f"• {evidence['text']} | 기여도 {evidence['score']:.3f}")

    st.markdown("#### ⏰ 오늘의 추천 시간대 · 상세")
    render_windows("💰 수익실현 우호 시간대", realize_windows, "수익실현")
    render_windows("🎯 신규진입 상대 우호 시간대", entry_windows, "신규진입")
    render_windows("⚠️ 뇌동매매·과열 주의 시간대", risk_windows, "투자주의", css_class="risk")
    render_windows("📚 공부 집중 상대 우호 시간대", study_windows, "학업", css_class="study")
    render_windows("💌 연락·관계 활성 시간대", contact_windows, "연락", css_class="love")

    st.markdown("#### 🌙 오늘의 정확한 Moon 메이저 트리거")
    daily_events = find_daily_moon_events(query_date, natal_points_for_daily)
    if daily_events:
        for event in daily_events[:16]:
            target_ko = PLANET_KO.get(event["target"], event["target"])
            st.markdown(
                f'<div class="event-pill"><strong>{event["time"].strftime("%H:%M:%S")} KST</strong> · Moon {event["aspect"]} Natal {target_ko}</div>',
                unsafe_allow_html=True,
            )
    else:
        st.info("오늘 설정된 네이탈 핵심 포인트와 정확히 일치하는 Moon 메이저 애스펙트가 없습니다.")

    st.warning(
        "대주주님, 위 시간대는 실제 수익확률이나 종목 방향 예측이 아니라 점성술 내부의 상대 활성·우호 지수입니다. "
        "매매는 가격·수급·거래량·손절 기준이 우선입니다."
    )

# ------------------------------------------------------------
# TAB 2 — WEEKLY
# ------------------------------------------------------------
with tabs[1]:
    st.markdown("### 📅 7일 주간 정밀 리포트")
    week_rows = cached_period_scores(
        query_date.isoformat(), 7, period_reference_time.isoformat(), natal_packed, houses_packed
    )

    st.markdown(
        f"""
        <div class="ast-card">
            <div class="ast-title">🌗 이번 주 총평</div>
            <div class="small-note" style="font-size:0.92rem; line-height:1.75;">
                {weekly_overview_text(week_rows)}
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    st.markdown("#### 🧭 분야별 주간 흐름")
    weekly_cards = [
        ("💰 투자·금전", "수익실현", False),
        ("🎯 신규진입", "신규진입", False),
        ("⚠️ 투자 과열주의", "투자주의", True),
        ("💌 연락·재회", "연락", False),
        ("💖 연애·관계", "연애", False),
        ("📚 공부·시험", "학업", False),
        ("🌿 컨디션", "컨디션", False),
    ]
    for title, key, is_risk in weekly_cards:
        st.markdown(
            f"""
            <div class="ast-card" style="padding:15px 17px;">
                <div class="ast-title" style="font-size:1rem; margin-bottom:7px;">{title}</div>
                <div class="small-note" style="font-size:0.88rem; line-height:1.7;">
                    {weekly_topic_text(week_rows, key, risk=is_risk)}
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    st.markdown("#### 📆 하루씩 보면")
    for row in week_rows:
        st.markdown(
            f'<div class="event-pill">{daily_period_one_liner(row)}</div>',
            unsafe_allow_html=True,
        )

    with st.expander("📊 주간 숫자표 보기 · 검산용"):
        week_table = []
        for row in week_rows:
            week_table.append({
                "날짜": row["label"],
                "수익실현": row["수익실현"],
                "신규진입": row["신규진입"],
                "투자주의": row["투자주의"],
                "공부": row["학업"],
                "연락": row["연락"],
                "연애": row["연애"],
                "컨디션": row["컨디션"],
            })
        st.dataframe(week_table, use_container_width=True, hide_index=True)
        st.caption(f"각 날짜를 {period_reference_time.strftime('%H:%M')} KST 기준으로 같은 조건에서 비교했습니다.")

    st.markdown("#### 🏆 이번 주 핵심 날짜")
    c1, c2 = st.columns(2)
    with c1:
        st.markdown("**📈 수익실현 TOP 3**")
        for rank, row in enumerate(top_period_days(week_rows, "수익실현"), start=1):
            st.write(f"{rank}. **{row['label']}** · {row['수익실현']}/100")
        st.markdown("**📚 공부 TOP 3**")
        for rank, row in enumerate(top_period_days(week_rows, "학업"), start=1):
            st.write(f"{rank}. **{row['label']}** · {row['학업']}/100")
    with c2:
        st.markdown("**💌 연락 TOP 3**")
        for rank, row in enumerate(top_period_days(week_rows, "연락"), start=1):
            st.write(f"{rank}. **{row['label']}** · {row['연락']}/100")
        st.markdown("**⚠️ 투자주의 TOP 3**")
        for rank, row in enumerate(top_period_days(week_rows, "투자주의"), start=1):
            st.write(f"{rank}. **{row['label']}** · {row['투자주의']}/100")

    if st.button("⏰ TOP 날짜의 세부 시간까지 계산", key="weekly_precision_button", use_container_width=True):
        with st.spinner("주간 골든타임을 실제 천체 위치로 다시 계산하는 중..."):
            weekly_detail = {"investment": [], "entry": [], "contact": [], "study": []}

            for row in top_period_days(week_rows, "수익실현"):
                scan = cached_intraday_scan(
                    row["date"].isoformat(), "09:00:00", "15:30:00", 15, natal_packed, houses_packed
                )
                windows = rolling_top_windows(scan, "수익실현", window_slots=3, top_n=1)
                if windows:
                    weekly_detail["investment"].append((row, windows[0]))

            for row in top_period_days(week_rows, "신규진입"):
                scan = cached_intraday_scan(
                    row["date"].isoformat(), "09:00:00", "15:30:00", 15, natal_packed, houses_packed
                )
                windows = rolling_top_windows(scan, "신규진입", window_slots=3, top_n=1)
                if windows:
                    weekly_detail["entry"].append((row, windows[0]))

            for row in top_period_days(week_rows, "연락"):
                scan = cached_intraday_scan(
                    row["date"].isoformat(), "17:00:00", "23:30:00", 30, natal_packed, houses_packed
                )
                windows = rolling_top_windows(scan, "연락", window_slots=3, top_n=1)
                if windows:
                    weekly_detail["contact"].append((row, windows[0]))

            for row in top_period_days(week_rows, "학업"):
                scan = cached_intraday_scan(
                    row["date"].isoformat(), "07:00:00", "23:00:00", 30, natal_packed, houses_packed
                )
                windows = rolling_top_windows(scan, "학업", window_slots=3, top_n=1)
                if windows:
                    weekly_detail["study"].append((row, windows[0]))

            st.session_state["weekly_detail"] = weekly_detail
            st.session_state["weekly_detail_key"] = (query_date.isoformat(), natal_packed, houses_packed)

    weekly_detail_key = (query_date.isoformat(), natal_packed, houses_packed)
    weekly_detail = (
        st.session_state.get("weekly_detail")
        if st.session_state.get("weekly_detail_key") == weekly_detail_key
        else None
    )
    if weekly_detail:
        st.markdown("#### ⏰ 이번 주 계산형 골든타임")
        for title, key, css, score_key in [
            ("📈 수익실현", "investment", "", "수익실현"),
            ("🎯 신규진입", "entry", "", "신규진입"),
            ("💌 연락", "contact", "love", "연락"),
            ("📚 공부", "study", "study", "학업"),
        ]:
            st.markdown(f"**{title}**")
            for row, window in weekly_detail.get(key, []):
                st.markdown(
                    f'''<div class="window-card {css}">
                        <strong>{row["label"]} · {format_window(window)}</strong><br>
                        상대지수 <strong>{window["score"]}/100</strong> · {score_band(window["score"])}<br>
                        <span class="small-note">{window_narrative(score_key, window)}</span>
                    </div>''',
                    unsafe_allow_html=True,
                )

    st.caption(
        "주간 문장은 날짜별 계산값을 규칙 기반으로 요약한 것이고, 숫자표는 검산용입니다. "
        "특히 투자 파트는 실제 수익확률이 아니라 상대적인 심리·활성 지수입니다."
    )

# ------------------------------------------------------------
# TAB 3 — MONTHLY
# ------------------------------------------------------------
with tabs[2]:
    st.markdown(f"### 🌕 {query_date.year}년 {query_date.month}월 월간 정밀 리포트")
    month_first = date(query_date.year, query_date.month, 1)
    month_days = calendar.monthrange(query_date.year, query_date.month)[1]

    if st.button("🌕 이번 달 전체 흐름 계산", type="primary", key="monthly_calculate_button", use_container_width=True):
        with st.spinner("월초·월중·월말 흐름과 핵심 날짜를 계산하는 중..."):
            st.session_state["monthly_rows"] = cached_period_scores(
                month_first.isoformat(), month_days, period_reference_time.isoformat(), natal_packed, houses_packed
            )
            st.session_state["monthly_key"] = (
                month_first.isoformat(), period_reference_time.isoformat(), natal_packed, houses_packed
            )

    expected_monthly_key = (
        month_first.isoformat(), period_reference_time.isoformat(), natal_packed, houses_packed
    )
    month_rows = st.session_state.get("monthly_rows") if st.session_state.get("monthly_key") == expected_monthly_key else None

    if month_rows:
        avg_keys = ["수익실현", "신규진입", "투자주의", "학업", "연락", "연애", "컨디션"]
        avg_values = {key: period_avg(month_rows, key) for key in avg_keys}

        st.markdown(
            f"""
            <div class="ast-card">
                <div class="ast-title">🌌 이번 달 총평</div>
                <div class="small-note" style="font-size:0.92rem; line-height:1.8;">
                    {monthly_overview_text(month_rows)}
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )

        st.markdown("#### 🌒 월초 · 🌓 월중 · 🌔 월말")
        segments = segment_rows(month_rows, 3)
        segment_names = ["월초", "월중", "월말"]
        for name, seg in zip(segment_names, segments):
            st.markdown(
                f'<div class="event-pill">{segment_summary(seg, name)}</div>',
                unsafe_allow_html=True,
            )

        st.markdown("#### 🧭 분야별 월간 해석")
        monthly_interpretations = [
            ("💰 투자·수익실현", "수익실현", False),
            ("🎯 신규진입", "신규진입", False),
            ("⚠️ 과열·뇌동매매 주의", "투자주의", True),
            ("💌 연락·재회", "연락", False),
            ("💖 연애·관계", "연애", False),
            ("📚 공부·시험", "학업", False),
            ("🌿 컨디션", "컨디션", False),
        ]
        for title, key, is_risk in monthly_interpretations:
            best = period_extreme(month_rows, key, True)
            worst = period_extreme(month_rows, key, False)
            avg = avg_values[key]
            body = monthly_topic_text(month_rows, key, risk=is_risk)
            st.markdown(
                f"""
                <div class="ast-card" style="padding:15px 17px;">
                    <div class="ast-title" style="font-size:1rem; margin-bottom:7px;">{title}</div>
                    <div class="small-note" style="font-size:0.88rem; line-height:1.7;">{body}</div>
                </div>
                """,
                unsafe_allow_html=True,
            )

        st.markdown("#### 🏆 이번 달 핵심 날짜")
        c1, c2 = st.columns(2)
        with c1:
            for title, key in [
                ("💰 수익실현 TOP 5", "수익실현"),
                ("📚 공부 TOP 5", "학업"),
                ("💖 연애 TOP 5", "연애"),
            ]:
                st.markdown(f"**{title}**")
                for row in top_period_days(month_rows, key, top_n=5):
                    st.write(f"• {row['label']} · {row[key]}/100")
        with c2:
            for title, key in [
                ("💌 연락 TOP 5", "연락"),
                ("🎯 신규진입 TOP 5", "신규진입"),
                ("⚠️ 투자주의 TOP 5", "투자주의"),
            ]:
                st.markdown(f"**{title}**")
                for row in top_period_days(month_rows, key, top_n=5):
                    st.write(f"• {row['label']} · {row[key]}/100")

        st.markdown("#### 📌 날짜별 한줄 리포트")
        monthly_day_filter = st.selectbox(
            "한줄 리포트 범위",
            ["전체", "월초(1~10일)", "월중(11~20일)", "월말(21일~)"],
            key="monthly_day_filter",
        )
        if monthly_day_filter == "월초(1~10일)":
            visible_month_rows = segments[0] if len(segments) > 0 else []
        elif monthly_day_filter == "월중(11~20일)":
            visible_month_rows = segments[1] if len(segments) > 1 else []
        elif monthly_day_filter == "월말(21일~)":
            visible_month_rows = segments[2] if len(segments) > 2 else []
        else:
            visible_month_rows = month_rows

        for row in visible_month_rows:
            st.markdown(f'<div class="event-pill">{daily_period_one_liner(row)}</div>', unsafe_allow_html=True)

        with st.expander("🔎 특정 날짜의 실제 트랜짓 근거 보기"):
            selected_label = st.selectbox(
                "날짜 선택",
                [row["label"] for row in month_rows],
                index=min(max(query_date.day - 1, 0), len(month_rows) - 1),
                key="monthly_evidence_date",
            )
            selected_row = next(row for row in month_rows if row["label"] == selected_label)
            selected_topic = st.selectbox(
                "분야 선택",
                ["금전", "투자심리", "연락", "연애", "학업", "컨디션"],
                key="monthly_evidence_topic",
            )
            selected_dt_kst = KST.localize(datetime.combine(selected_row["date"], period_reference_time))
            selected_context = context_at_kst(selected_dt_kst, natal_lons, natal_houses)
            selected_result = selected_context["topics"][selected_topic]
            st.write(
                f"**{selected_label} {selected_topic}** · 활성 {selected_result['activation']}/100 · "
                f"우호 {selected_result['favorability']}/100"
            )
            st.caption(interpret_topic_score(selected_result))
            if selected_result["evidence"]:
                for evidence in selected_result["evidence"][:12]:
                    st.write(f"• {evidence['text']} | 기여도 {evidence['score']:.3f}")
            else:
                st.info("설정된 오브/하우스 기준에서 두드러진 근거 신호가 적습니다.")

        with st.expander("📊 월간 숫자표 보기 · 검산용"):
            month_table = []
            for row in month_rows:
                month_table.append({
                    "날짜": row["label"],
                    "수익실현": row["수익실현"],
                    "신규진입": row["신규진입"],
                    "투자주의": row["투자주의"],
                    "공부": row["학업"],
                    "연락": row["연락"],
                    "연애": row["연애"],
                    "컨디션": row["컨디션"],
                })
            st.dataframe(month_table, use_container_width=True, hide_index=True, height=420)

        if st.button("🌙 이번 달 루나리턴 계산", key="monthly_lunar_return_button", use_container_width=True):
            with st.spinner("루나리턴을 정밀 탐색하는 중..."):
                center_kst = KST.localize(datetime.combine(query_date, dt_time(12, 0)))
                st.session_state["monthly_lunar_return"] = find_returns_near(
                    "Moon", natal_lons["Moon"], center_kst.astimezone(UTC)
                )
                st.session_state["monthly_lunar_key"] = (query_date.year, query_date.month, natal_lons["Moon"])

        lunar_key = (query_date.year, query_date.month, natal_lons["Moon"])
        lunar_return = st.session_state.get("monthly_lunar_return") if st.session_state.get("monthly_lunar_key") == lunar_key else None
        if lunar_return:
            prev_kst = lunar_return["previous"].astimezone(KST) if lunar_return["previous"] else None
            next_kst = lunar_return["next"].astimezone(KST) if lunar_return["next"] else None
            st.markdown(
                f"""
                <div class="ast-card">
                    <div class="ast-title">🌙 Lunar Return</div>
                    <div class="small-note">
                        직전: <strong>{prev_kst.strftime('%Y-%m-%d %H:%M:%S KST') if prev_kst else '탐색 범위 내 없음'}</strong><br>
                        다음: <strong>{next_kst.strftime('%Y-%m-%d %H:%M:%S KST') if next_kst else '탐색 범위 내 없음'}</strong>
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )

        st.caption(
            "월간 문장은 날짜별 계산값을 월초·월중·월말로 집계한 규칙 기반 해석입니다. "
            "숫자는 확률이 아니며, 근거 펼쳐보기에서 실제 트랜짓을 확인할 수 있습니다."
        )
    else:
        st.info("위의 ‘이번 달 전체 흐름 계산’을 누르면 월초·월중·월말 해석, 핵심 날짜, 날짜별 한줄 리포트를 만듭니다.")

# ------------------------------------------------------------
# TAB 4 — PRECISE TIME WINDOWS
# ------------------------------------------------------------
with tabs[3]:
    st.markdown("### 📈 정밀 시간대 분석")
    st.caption(
        "고정 문구가 아니라 선택 날짜를 실제로 스캔합니다. 기본은 투자 15분, 일상 30분 간격입니다."
    )

    market_start = st.time_input("투자 분석 시작", dt_time(9, 0), step=900, key="market_start")
    market_end = st.time_input("투자 분석 종료", dt_time(15, 30), step=900, key="market_end")
    market_step = st.select_slider("투자 스캔 간격(분)", options=[5, 10, 15, 30], value=15, key="market_step")

    with st.spinner("선택 시간 범위를 계산하는 중..."):
        custom_market_rows = cached_intraday_scan(
            query_date.isoformat(), market_start.isoformat(), market_end.isoformat(), market_step,
            natal_packed, houses_packed
        )

    custom_table = []
    for row in custom_market_rows:
        custom_table.append({
            "시각": row["dt"].strftime("%H:%M"),
            "수익실현": row["수익실현"],
            "신규진입": row["신규진입"],
            "투자주의": row["투자주의"],
            "금전": row["금전"],
        })
    st.dataframe(custom_table, use_container_width=True, hide_index=True, height=420)

    window_slots = max(1, round(45 / market_step))
    render_windows(
        "💰 선택 범위 수익실현 TOP 3",
        rolling_top_windows(custom_market_rows, "수익실현", window_slots=window_slots, top_n=3),
        "수익실현",
    )
    render_windows(
        "🎯 선택 범위 신규진입 TOP 3",
        rolling_top_windows(custom_market_rows, "신규진입", window_slots=window_slots, top_n=3),
        "신규진입",
    )
    render_windows(
        "⚠️ 선택 범위 과열주의 TOP 3",
        rolling_top_windows(custom_market_rows, "투자주의", window_slots=window_slots, top_n=3),
        "투자주의",
        css_class="risk",
    )

    with st.expander("📐 시간대 점수 공식"):
        st.write("수익실현 지수 = 금전 활성 40% + 금전 우호 40% + 과열 페널티 보정 20%")
        st.write("신규진입 지수 = 금전 활성·우호 + 투자심리 활성·우호 - 과열 차이 페널티")
        st.write("투자주의 지수 = 투자심리 활성 + 낮은 우호도 + 활성/우호 괴리")
        st.write("이는 점성술 내부 비교지수이며 실제 수익률·상승확률이 아닙니다.")

# ------------------------------------------------------------
# TAB 5 — TRANSIT OVERLAY
# ------------------------------------------------------------
with tabs[4]:
    st.markdown("### ⏱️ 트랜짓 → 네이탈 활성 애스펙트")
    st.write(f"기준 시각: **{query_dt_kst.strftime('%Y-%m-%d %H:%M:%S KST')}**")

    transit_table = []
    for record in transit_records:
        transit_table.append({
            "레이어": record["layer"],
            "트랜짓": record["transit"],
            "네이탈": record["target"],
            "애스펙트": record["name"],
            "오브": f"{record['orb']:.2f}°",
            "상태": record["motion"],
            "운동": f"{record['direction']} ({record['speed']:+.3f}°/day)",
            "Whole": f"{record['whole_house']}H",
            "Placidus": f"{record['placidus_house']}H" if record["placidus_house"] else "-",
        })
    st.dataframe(transit_table, use_container_width=True, hide_index=True)

    st.markdown("#### 행성별 현재 운동")
    motion_table = []
    for body, snapshot in snapshots.items():
        sign, degree, _ = get_sign_and_degree(snapshot["lon"])
        motion_table.append({
            "행성": body,
            "위치": f"{sign} {degree:.2f}°",
            "속도": f"{snapshot['speed']:+.4f}°/day",
            "방향": snapshot["direction"],
            "Whole": f"{whole_sign_house(snapshot['lon'], natal_houses['asc'])}H",
            "Placidus": f"{cusp_house(snapshot['lon'], natal_houses['placidus_cusps'])}H",
        })
    st.dataframe(motion_table, use_container_width=True, hide_index=True)

# ------------------------------------------------------------
# TAB 6 — RETURNS
# ------------------------------------------------------------
with tabs[5]:
    st.markdown("### 🔄 정밀 Return Solver")
    st.write(
        "고정 주기를 더하지 않고 실제 longitude crossing을 먼저 bracket한 뒤 Brent 방식으로 정밀화합니다."
    )
    return_body = st.selectbox("리턴 천체", ["Moon", "Sun", "Mercury", "Venus", "Mars"], key="return_body")

    if st.button("정밀 리턴 계산", type="primary", key="return_calculate"):
        with st.spinner("회귀점을 탐색하고 있습니다..."):
            st.session_state["return_result_v3"] = {
                "body": return_body,
                "data": find_returns_near(return_body, natal_lons[return_body], query_dt_utc),
            }

    stored = st.session_state.get("return_result_v3")
    if stored and stored["body"] == return_body:
        result = stored["data"]
        prev_kst = result["previous"].astimezone(KST) if result["previous"] else None
        next_kst = result["next"].astimezone(KST) if result["next"] else None
        c1, c2 = st.columns(2)
        with c1:
            st.metric("직전 Return", prev_kst.strftime("%Y-%m-%d %H:%M:%S") if prev_kst else "탐색 범위 내 없음")
        with c2:
            st.metric("다음 Return", next_kst.strftime("%Y-%m-%d %H:%M:%S") if next_kst else "탐색 범위 내 없음")
        st.caption(f"네이탈 {return_body} 황경 {natal_lons[return_body]:.6f}°")

# ------------------------------------------------------------
# TAB 7 — VALIDATION
# ------------------------------------------------------------
with tabs[6]:
    st.markdown("### ⚙️ 차트 데이터 검증")
    mc_sign, mc_deg, _ = get_sign_and_degree(natal_houses["mc"])
    vertex_sign, vertex_deg, _ = get_sign_and_degree(natal_houses["vertex"])
    pof_sign, pof_deg, _ = get_sign_and_degree(pof_lon)

    st.markdown(
        f"""
        <div class="ast-card">
            <div class="ast-title">🧭 각도점 / Sect</div>
            <div class="small-note">
                ASC: <strong>{asc_sign} {asc_deg:.4f}°</strong> ({natal_houses['asc']:.6f}°)<br>
                MC: <strong>{mc_sign} {mc_deg:.4f}°</strong> ({natal_houses['mc']:.6f}°)<br>
                Vertex: <strong>{vertex_sign} {vertex_deg:.4f}°</strong> ({natal_houses['vertex']:.6f}°)<br>
                Sect: <strong>{'주간 차트' if birth_is_day else '야간 차트'}</strong><br>
                Part of Fortune: <strong>{pof_sign} {pof_deg:.4f}°</strong> ({pof_lon:.6f}°)
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    chart_data = []
    for body in PLANET_KEYS:
        natal_sign, natal_degree, _ = get_sign_and_degree(natal_lons[body])
        transit_sign, transit_degree, _ = get_sign_and_degree(transit_lons[body])
        chart_data.append({
            "천체": body,
            "네이탈 Tropical": f"{natal_lons[body]:.6f}° ({natal_sign} {natal_degree:.4f}°)",
            "트랜짓 Tropical": f"{transit_lons[body]:.6f}° ({transit_sign} {transit_degree:.4f}°)",
        })
    st.dataframe(chart_data, use_container_width=True, hide_index=True)

    st.markdown("#### Whole Sign / Placidus 커스프")
    cusp_table = []
    for idx in range(12):
        ws = natal_houses["whole_cusps"][idx]
        pc = natal_houses["placidus_cusps"][idx]
        ws_sign, ws_degree, _ = get_sign_and_degree(ws)
        pc_sign, pc_degree, _ = get_sign_and_degree(pc)
        cusp_table.append({
            "House": idx + 1,
            "Whole Sign": f"{ws_sign} {ws_degree:.2f}°",
            "Placidus": f"{pc_sign} {pc_degree:.2f}°",
        })
    st.dataframe(cusp_table, use_container_width=True, hide_index=True)

    st.markdown("#### 엔진 상태")
    status_items = [
        f"Ephemeris: {EPHEMERIS_USED}",
        f"SPK target: Mars → {BODY_TARGET_KEYS['Mars']}",
        "Planet longitude: geocentric apparent + true ecliptic/equinox of date",
        "Time: KST input → timezone-aware UTC → Skyfield timescale",
        "ASC/MC/Vertex + Placidus: Swiss Ephemeris house geometry",
        "Whole Sign: ASC sign = 1H",
        "Applying/Separating: past/future orb derivative",
        "Return: crossing bracket → Brent refinement",
        "Daily/weekly/monthly scoring: long + medium + daily layer + house/ruler weighting",
        "Intraday: Moon/Mercury/Venus/Mars recalculated each slot",
    ]
    for item in status_items:
        st.write(f"✅ {item}")

    if EPHEMERIS_FALLBACK_REASON:
        st.warning("DE440s 로드 실패로 DE421 fallback: " + EPHEMERIS_FALLBACK_REASON)

    with st.expander("📐 한계와 해석 원칙"):
        st.write("활성도는 사건성, 우호도는 부드러움/마찰 정도이며 둘은 별개입니다.")
        st.write("주간·월간 순위는 같은 기준 시각에서 날짜를 비교한 상대 순위입니다.")
        st.write("투자 시간대 지수는 실제 가격 방향·수익률·체결 성공 확률을 예측하지 않습니다.")
