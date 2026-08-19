import calendar
from datetime import date, datetime, time as dt_time, timedelta

import numpy as np
import pytz
import streamlit as st
import swisseph as swe
from scipy.optimize import brentq
from skyfield.api import load, wgs84
from skyfield.framelib import ecliptic_frame

# ============================================================
# 0. PAGE / DESIGN
# ============================================================
st.set_page_config(
    page_title="별빛의 운명 - 고정밀 점성술",
    page_icon="✨",
    layout="centered",
    initial_sidebar_state="expanded",
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
                <span class="small-note">{action_advice(key, score)}</span>
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

    summary_items = [
        ("💰 수익실현 적합도", "수익실현"),
        ("🎯 신규진입 안정성", "신규진입"),
        ("⚠️ 투자 과열주의", "투자주의"),
        ("📚 학업·시험", "학업"),
        ("💌 연락·재회", "연락"),
        ("💖 연애", "연애"),
    ]
    summary_html = '<div class="ast-card"><div class="ast-title">📊 핵심 지표</div>'
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
    st.markdown("### 📅 7일 주간 타이밍")
    week_rows = cached_period_scores(
        query_date.isoformat(), 7, period_reference_time.isoformat(), natal_packed, houses_packed
    )

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
        })
    st.dataframe(week_table, use_container_width=True, hide_index=True)

    c1, c2 = st.columns(2)
    with c1:
        st.markdown("#### 📈 수익실현 TOP 3")
        for rank, row in enumerate(top_period_days(week_rows, "수익실현"), start=1):
            st.write(f"**{rank}위 {row['label']}** · {row['수익실현']}/100")
    with c2:
        st.markdown("#### 💌 연락 TOP 3")
        for rank, row in enumerate(top_period_days(week_rows, "연락"), start=1):
            st.write(f"**{rank}위 {row['label']}** · {row['연락']}/100")

    c3, c4 = st.columns(2)
    with c3:
        st.markdown("#### 📚 공부 TOP 3")
        for rank, row in enumerate(top_period_days(week_rows, "학업"), start=1):
            st.write(f"**{rank}위 {row['label']}** · {row['학업']}/100")
    with c4:
        st.markdown("#### ⚠️ 투자주의 TOP 3")
        for rank, row in enumerate(top_period_days(week_rows, "투자주의"), start=1):
            st.write(f"**{rank}위 {row['label']}** · {row['투자주의']}/100")

    st.caption(f"각 날짜를 {period_reference_time.strftime('%H:%M')} KST 기준으로 같은 조건에서 비교했습니다.")

    if st.button("이번 주 TOP 날짜의 세부 시간까지 계산", key="weekly_precision_button"):
        with st.spinner("주간 골든타임을 30분 단위로 계산하는 중..."):
            weekly_detail = {"investment": [], "contact": [], "study": []}

            for row in top_period_days(week_rows, "수익실현"):
                scan = cached_intraday_scan(
                    row["date"].isoformat(), "09:00:00", "15:30:00", 30, natal_packed, houses_packed
                )
                windows = rolling_top_windows(scan, "수익실현", window_slots=2, top_n=1)
                if windows:
                    weekly_detail["investment"].append((row, windows[0]))

            for row in top_period_days(week_rows, "연락"):
                scan = cached_intraday_scan(
                    row["date"].isoformat(), "18:00:00", "23:30:00", 30, natal_packed, houses_packed
                )
                windows = rolling_top_windows(scan, "연락", window_slots=2, top_n=1)
                if windows:
                    weekly_detail["contact"].append((row, windows[0]))

            for row in top_period_days(week_rows, "학업"):
                scan = cached_intraday_scan(
                    row["date"].isoformat(), "08:00:00", "22:00:00", 60, natal_packed, houses_packed
                )
                windows = rolling_top_windows(scan, "학업", window_slots=2, top_n=1)
                if windows:
                    weekly_detail["study"].append((row, windows[0]))

            st.session_state["weekly_detail"] = weekly_detail

    weekly_detail = st.session_state.get("weekly_detail")
    if weekly_detail:
        st.markdown("#### 🏆 이번 주 계산형 골든타임")
        for title, key, css in [
            ("📈 수익실현", "investment", ""),
            ("💌 연락", "contact", "love"),
            ("📚 공부", "study", "study"),
        ]:
            st.markdown(f"**{title}**")
            for row, window in weekly_detail.get(key, []):
                st.markdown(
                    f'<div class="window-card {css}"><strong>{row["label"]} · {format_window(window)}</strong><br>상대지수 {window["score"]}/100</div>',
                    unsafe_allow_html=True,
                )

# ------------------------------------------------------------
# TAB 3 — MONTHLY
# ------------------------------------------------------------
with tabs[2]:
    st.markdown(f"### 🌕 {query_date.year}년 {query_date.month}월 월간 리포트")
    month_first = date(query_date.year, query_date.month, 1)
    month_days = calendar.monthrange(query_date.year, query_date.month)[1]

    if st.button("이번 달 전체 날짜 계산", type="primary", key="monthly_calculate_button"):
        with st.spinner("월간 흐름을 날짜별로 계산하는 중..."):
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
        avg_keys = ["수익실현", "신규진입", "투자주의", "학업", "연락", "연애"]
        avg_values = {key: round(sum(row[key] for row in month_rows) / len(month_rows)) for key in avg_keys}

        st.markdown(
            f"""
            <div class="ast-card">
                <div class="ast-title">📊 월간 평균 상대지수</div>
                <div class="small-note">
                    수익실현 {avg_values['수익실현']} · 신규진입 {avg_values['신규진입']} · 투자주의 {avg_values['투자주의']}<br>
                    공부 {avg_values['학업']} · 연락 {avg_values['연락']} · 연애 {avg_values['연애']}
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )

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
            })
        st.dataframe(month_table, use_container_width=True, hide_index=True, height=420)

        for title, key, reverse in [
            ("💰 수익실현 우호일 TOP 5", "수익실현", True),
            ("💌 연락 활성일 TOP 5", "연락", True),
            ("📚 공부 우호일 TOP 5", "학업", True),
            ("⚠️ 투자 과열주의일 TOP 5", "투자주의", True),
        ]:
            st.markdown(f"#### {title}")
            text = " · ".join(
                f"{row['label']} {row[key]}" for row in top_period_days(month_rows, key, top_n=5, reverse=reverse)
            )
            st.write(text)

        if st.button("이번 달 루나리턴 계산", key="monthly_lunar_return_button"):
            with st.spinner("루나리턴을 정밀 탐색하는 중..."):
                center_kst = KST.localize(datetime.combine(query_date, dt_time(12, 0)))
                st.session_state["monthly_lunar_return"] = find_returns_near(
                    "Moon", natal_lons["Moon"], center_kst.astimezone(UTC)
                )
        lunar_return = st.session_state.get("monthly_lunar_return")
        if lunar_return:
            prev_kst = lunar_return["previous"].astimezone(KST) if lunar_return["previous"] else None
            next_kst = lunar_return["next"].astimezone(KST) if lunar_return["next"] else None
            st.write(
                "**직전 루나리턴:** "
                + (prev_kst.strftime("%Y-%m-%d %H:%M:%S KST") if prev_kst else "없음")
            )
            st.write(
                "**다음 루나리턴:** "
                + (next_kst.strftime("%Y-%m-%d %H:%M:%S KST") if next_kst else "없음")
            )
    else:
        st.info("‘이번 달 전체 날짜 계산’을 누르면 월간 TOP 날짜와 월간 평균을 만듭니다.")

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
