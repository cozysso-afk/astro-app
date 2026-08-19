from datetime import datetime, time as dt_time, timedelta

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

@media (max-width: 640px) {
    .metric-grid { grid-template-columns: 1fr; }
    .ast-card { padding: 16px; }
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
    "Sun": "sun",
    "Moon": "moon",
    "Mercury": "mercury",
    "Venus": "venus",
    "Mars": "mars",
    "Jupiter": "jupiter barycenter",
    "Saturn": "saturn barycenter",
    "Uranus": "uranus barycenter",
    "Neptune": "neptune barycenter",
    "Pluto": "pluto barycenter",
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
    target = eph[PLANET_KEYS[body_name]]
    apparent = earth.at(time_obj).observe(target).apparent()
    _, lon, _ = apparent.frame_latlon(ecliptic_frame)
    return float(lon.degrees % 360.0)


def get_tropical_ecliptic_lons(body_name, time_objs):
    target = eph[PLANET_KEYS[body_name]]
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
# 10. SIDEBAR INPUT
# ============================================================
with st.sidebar:
    st.header("⚙️ 사용자 맞춤 설정")
    user_name = st.text_input("성함 (호칭)", value="다현")

    st.subheader("📍 출생 정보 (Natal)")
    birth_date = st.date_input("출생일", datetime(2000, 8, 19))
    birth_time = st.time_input("출생 시간", dt_time(14, 30), step=60)
    lat = st.number_input("출생지 위도(N)", value=37.5665, format="%.6f")
    lon = st.number_input("출생지 경도(E)", value=126.9780, format="%.6f")

    st.markdown("---")
    st.subheader("📅 운세 조회 시점")
    now_kst = datetime.now(KST)
    query_date = st.date_input("조회 일자", now_kst.date())
    query_time = st.time_input("조회 기준 시각", now_kst.time().replace(second=0, microsecond=0), step=60)

# Build aware datetimes
birth_dt_kst = KST.localize(datetime.combine(birth_date, birth_time))
birth_dt_utc = birth_dt_kst.astimezone(UTC)
query_dt_kst = KST.localize(datetime.combine(query_date, query_time))
query_dt_utc = query_dt_kst.astimezone(UTC)

t_birth = sf_time(birth_dt_utc)
t_query = sf_time(query_dt_utc)

# ============================================================
# 11. NATAL / TRANSIT CALCULATION
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

# ============================================================
# 12. UI TABS
# ============================================================
tabs = st.tabs([
    "📜 일일 정밀 리포트",
    "⏱️ 트랜짓 오버레이",
    "🔄 정밀 리턴",
    "⚙️ 차트 검증",
])

# ------------------------------------------------------------
# TAB 1 — DAILY REPORT
# ------------------------------------------------------------
with tabs[0]:
    st.markdown(f"### 🌙 {query_date.strftime('%Y년 %m월 %d일')} {user_name}님 정밀 운세")

    moon_sign, moon_deg, _ = get_sign_and_degree(transit_lons["Moon"])
    moon_whole_house = whole_sign_house(transit_lons["Moon"], natal_houses["asc"])
    moon_placidus_house = cusp_house(transit_lons["Moon"], natal_houses["placidus_cusps"])

    st.markdown(
        f"""
        <div class="ast-card">
            <div class="ast-title">🪐 계산 기준</div>
            <div class="small-note">
                기준 시각: <strong>{query_dt_kst.strftime('%Y-%m-%d %H:%M KST')}</strong><br>
                Ephemeris: <strong>{EPHEMERIS_USED}</strong> · Tropical true ecliptic/equinox of date<br>
                Primary house: <strong>Whole Sign</strong> · Secondary: <strong>Placidus</strong><br>
                오늘 달: <strong>{moon_sign} {moon_deg:.2f}°</strong> · Whole Sign <strong>{moon_whole_house}H</strong>
                · Placidus <strong>{moon_placidus_house}H</strong>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    metric_html = '<div class="ast-card"><div class="ast-title">📊 분야별 활성도 / 우호도</div><div class="metric-grid">'
    for topic in ["연애", "연락", "금전", "학업", "컨디션", "투자심리"]:
        result = topic_results[topic]
        icon = TOPIC_SPECS[topic]["icon"]
        metric_html += f"""
        <div class="metric-box">
            <div class="metric-label">{icon} {topic}</div>
            <div class="metric-score">활성 {result['activation']} · 우호 {result['favorability']}</div>
            <div class="small-note">{interpret_topic_score(result)}</div>
        </div>
        """
    metric_html += "</div></div>"
    st.markdown(metric_html, unsafe_allow_html=True)

    st.caption(
        "※ 활성도는 '관련 주제가 얼마나 강하게 건드려지는지', 우호도는 '그 활성 신호의 상대적 부드러움/마찰 정도'입니다. "
        "점성술의 과학적 예측확률이 아니라 앱 내부의 공개형 해석 점수입니다."
    )

    with st.expander("🔎 왜 이 점수가 나왔는지 근거 보기"):
        topic_choice = st.selectbox("근거를 볼 분야", list(TOPIC_SPECS.keys()), key="topic_evidence")
        result = topic_results[topic_choice]
        st.write(
            f"**{topic_choice} — 활성 {result['activation']}/100 · 우호 {result['favorability']}/100**"
        )
        if result["evidence"]:
            for ev in result["evidence"][:10]:
                st.write(f"• {ev['text']}  | 기여도 {ev['score']:.3f}")
        else:
            st.info("현재 오브/하우스 기준에서 해당 분야에 기여하는 강한 신호가 없습니다.")

    st.markdown("#### ⏰ 오늘의 실제 Moon Exact Trigger")
    daily_events = find_daily_moon_events(query_date, natal_points_for_daily)
    if daily_events:
        for ev in daily_events[:12]:
            target_ko = PLANET_KO.get(ev["target"], ev["target"])
            st.markdown(
                f"""
                <div class="event-pill">
                    <strong>{ev['time'].strftime('%H:%M:%S')} KST</strong> · Moon {ev['aspect']} Natal {target_ko}
                </div>
                """,
                unsafe_allow_html=True,
            )
    else:
        st.info("오늘 00:00~24:00 KST 사이에 설정된 네이탈 핵심 포인트와 정확히 맞물리는 Moon 메이저 애스펙트가 없습니다.")

    st.warning(
        "📈 투자심리 점수와 Moon trigger는 매수·매도·익절 신호가 아닙니다. 실제 투자 판단은 가격·수급·실적·리스크 기준을 우선하세요."
    )

# ------------------------------------------------------------
# TAB 2 — TRANSIT OVERLAY
# ------------------------------------------------------------
with tabs[1]:
    st.markdown("### ⏱️ 트랜짓 → 네이탈 활성 애스펙트")
    st.write(f"기준 시각: **{query_dt_kst.strftime('%Y-%m-%d %H:%M:%S KST')}**")

    table = []
    for rec in transit_records:
        table.append({
            "레이어": rec["layer"],
            "트랜짓": rec["transit"],
            "네이탈": rec["target"],
            "애스펙트": rec["name"],
            "오브": f"{rec['orb']:.2f}°",
            "상태": rec["motion"],
            "운동": f"{rec['direction']} ({rec['speed']:+.3f}°/day)",
            "Whole": f"{rec['whole_house']}H",
            "Placidus": f"{rec['placidus_house']}H" if rec["placidus_house"] else "-",
        })

    if table:
        st.dataframe(table, use_container_width=True, hide_index=True)
    else:
        st.info(f"현재 {MAX_ORB}° 이내의 메이저 트랜짓 애스펙트가 없습니다.")

    st.markdown("#### 행성별 현재 운동")
    motion_table = []
    for body, snap in snapshots.items():
        sign, deg, _ = get_sign_and_degree(snap["lon"])
        motion_table.append({
            "행성": body,
            "위치": f"{sign} {deg:.2f}°",
            "속도": f"{snap['speed']:+.4f}°/day",
            "방향": snap["direction"],
            "Whole": f"{whole_sign_house(snap['lon'], natal_houses['asc'])}H",
            "Placidus": f"{cusp_house(snap['lon'], natal_houses['placidus_cusps'])}H",
        })
    st.dataframe(motion_table, use_container_width=True, hide_index=True)

# ------------------------------------------------------------
# TAB 3 — RETURNS
# ------------------------------------------------------------
with tabs[2]:
    st.markdown("### 🔄 정밀 Return Solver")
    st.write(
        "고정 주기를 더하는 방식이 아니라, 트랜짓 천체가 네이탈 황경과 실제로 다시 일치하는 longitude crossing을 먼저 bracket한 뒤 Brent 방식으로 정밀화합니다."
    )

    return_body = st.selectbox("리턴 천체", ["Moon", "Sun", "Mercury", "Venus", "Mars"])

    if st.button("정밀 리턴 계산", type="primary"):
        with st.spinner("회귀점을 탐색하고 있습니다..."):
            st.session_state["return_result"] = {
                "body": return_body,
                "data": find_returns_near(return_body, natal_lons[return_body], query_dt_utc),
            }

    stored = st.session_state.get("return_result")
    if stored and stored["body"] == return_body:
        rr = stored["data"]
        prev_kst = rr["previous"].astimezone(KST) if rr["previous"] else None
        next_kst = rr["next"].astimezone(KST) if rr["next"] else None

        c1, c2 = st.columns(2)
        with c1:
            st.metric("직전 Return", prev_kst.strftime("%Y-%m-%d %H:%M:%S") if prev_kst else "탐색 범위 내 없음")
        with c2:
            st.metric("다음 Return", next_kst.strftime("%Y-%m-%d %H:%M:%S") if next_kst else "탐색 범위 내 없음")

        st.caption(
            f"기준 네이탈 {return_body} 황경: {natal_lons[return_body]:.6f}° · "
            f"탐색 범위 ±{RETURN_CONFIG[return_body]['window_days']}일"
        )

# ------------------------------------------------------------
# TAB 4 — VALIDATION
# ------------------------------------------------------------
with tabs[3]:
    st.markdown("### ⚙️ 차트 데이터 검증")

    asc_sign, asc_deg, _ = get_sign_and_degree(natal_houses["asc"])
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
        n_sign, n_deg, _ = get_sign_and_degree(natal_lons[body])
        t_sign, t_deg, _ = get_sign_and_degree(transit_lons[body])
        chart_data.append({
            "천체": body,
            "네이탈 Tropical": f"{natal_lons[body]:.6f}° ({n_sign} {n_deg:.4f}°)",
            "트랜짓 Tropical": f"{transit_lons[body]:.6f}° ({t_sign} {t_deg:.4f}°)",
        })
    st.dataframe(chart_data, use_container_width=True, hide_index=True)

    st.markdown("#### Whole Sign / Placidus 커스프")
    cusp_table = []
    for i in range(12):
        ws = natal_houses["whole_cusps"][i]
        pc = natal_houses["placidus_cusps"][i]
        ws_sign, ws_deg, _ = get_sign_and_degree(ws)
        pc_sign, pc_deg, _ = get_sign_and_degree(pc)
        cusp_table.append({
            "House": i + 1,
            "Whole Sign": f"{ws_sign} {ws_deg:.2f}°",
            "Placidus": f"{pc_sign} {pc_deg:.2f}°",
        })
    st.dataframe(cusp_table, use_container_width=True, hide_index=True)

    st.markdown("#### 엔진 상태")
    status_items = [
        f"Ephemeris: {EPHEMERIS_USED}",
        "Planet longitude: geocentric apparent + true ecliptic/equinox of date",
        "Time: KST input → timezone-aware UTC → Skyfield timescale",
        "ASC/MC/Vertex + Placidus: Swiss Ephemeris house geometry",
        "Whole Sign: ASC sign = 1H, 30° sign houses",
        "Applying/Separating: past/future orb derivative (retrograde 자동 반영)",
        "Return: target crossing bracket → Brent refinement",
        "Daily scoring: long / medium / daily layer + orb + motion + house + ruler weighting",
    ]
    for item in status_items:
        st.write(f"✅ {item}")

    if EPHEMERIS_FALLBACK_REASON:
        st.warning(
            "DE440s 로드에 실패해 DE421로 fallback했습니다. 검증용으로 원인을 확인하세요: "
            + EPHEMERIS_FALLBACK_REASON
        )

    with st.expander("📐 점수 로직 원칙"):
        st.write(
            "활성도는 오브, Applying/Separating, 애스펙트 강도, 트랜짓/네이탈 포인트 중요도, "
            "Whole Sign 하우스, Placidus 중첩, 관련 하우스 룰러, 장기·중기·일일 레이어 중첩을 합산합니다."
        )
        st.write(
            "우호도는 애스펙트 형태와 행성 성격을 이용한 상대적 휴리스틱입니다. "
            "활성도가 높다는 사실과 좋은 날이라는 판단은 분리되어 있습니다."
        )
        st.write(
            "Vertex와 Part of Fortune은 보조 계산값으로만 표시하며, 투자 매매 신호나 객관적 사건 확률로 사용하지 않습니다."
        )
