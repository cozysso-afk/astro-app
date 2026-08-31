from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"[{label}] expected 1 match, got {count}")
    return text.replace(old, new, 1)


p = Path("thai_lagna_v1.py")
s = p.read_text(encoding="utf-8")

s = replace_once(
    s,
    "It provides two independently inspectable candidates:",
    "It provides three independently inspectable candidates:",
    "doc candidate count",
)
s = replace_once(
    s,
    """2) astronomical_suriyayat_sidereal
   Latitude/longitude-aware astronomical cross-check.""",
    """2) common_anto_actual_sunrise_lmt
   Traditional common Antoanatee using the astronomical local sunrise for the
   birthplace, with the same optional Local Mean Time correction. The sunrise
   definition is Swiss Ephemeris CALC_RISE default (upper limb + refraction),
   selected by independent MyHora comparison.

3) astronomical_suriyayat_sidereal
   Latitude/longitude-aware astronomical cross-check.""",
    "doc actual sunrise",
)
s = replace_once(
    s,
    'ENGINE_VERSION = "thai-suriyayat-lagna-research-v1.1-bangkok-7vector"',
    'ENGINE_VERSION = "thai-suriyayat-lagna-research-v1.2-actual-sunrise"',
    "engine version",
)
s = replace_once(
    s,
    '    "common_lmt": {"max_error_arcmin": 15.695, "mean_error_arcmin": 6.03},\n    "astronomical_crosscheck":',
    '    "common_lmt": {"max_error_arcmin": 15.695, "mean_error_arcmin": 6.03},\n    "actual_sunrise": {"status": "validated_5vector_stats_pending"},\n    "astronomical_crosscheck":',
    "validation placeholder",
)
s = replace_once(
    s,
    '    "note": "Bangkok references span 249 years. Korea/world coordinates compute without Thailand province tables, but an independent non-Thailand reference corpus is still required before promotion.",',
    '    "note": "Bangkok references span 249 years. The actual-sunrise common method is separately validated against MyHora. Korea/world coordinates compute without Thailand province tables, but an independent non-Thailand reference corpus is still required before promotion.",',
    "validation note",
)

marker = "\ndef _julian_ut(local_instant: datetime) -> float:\n"
block = r'''

def _common_longitude_from_sun_and_elapsed(sun_longitude: float, elapsed_minutes: float) -> float:
    sun_arcmin = _wrap360(sun_longitude) * 60.0
    sun_sign = int(sun_arcmin // 1800.0) % 12
    sun_within_deg = (sun_arcmin - sun_sign * 1800.0) / 60.0
    anchor = (
        sum(COMMON_SIGN_DURATIONS_MINUTES[:sun_sign])
        + COMMON_SIGN_DURATIONS_MINUTES[sun_sign] * (sun_within_deg / 30.0)
    )
    target = (anchor + float(elapsed_minutes)) % 1440.0
    cumulative = 0.0
    for index, duration in enumerate(COMMON_SIGN_DURATIONS_MINUTES):
        end = cumulative + duration
        if cumulative <= target < end or index == 11:
            degree_in_sign = ((target - cumulative) * 30.0) / duration
            return _wrap360(index * 30.0 + degree_in_sign)
        cumulative = end
    raise RuntimeError("common Antoanatee duration table did not resolve")


def _datetime_from_julian_ut(jd_ut: float) -> datetime:
    year, month, day, hour_float = swe.revjul(float(jd_ut), swe.GREG_CAL)
    seconds = int(round(hour_float * 3600.0))
    base = datetime(year, month, day, tzinfo=timezone.utc)
    return base + timedelta(seconds=seconds)


def _actual_sunrise_local(
    *,
    birth_date: date,
    latitude: float,
    longitude: float,
    utc_offset_hours: float,
) -> datetime | None:
    latitude = float(latitude)
    longitude = float(longitude)
    if not -90.0 <= latitude <= 90.0:
        raise ValueError("latitude must be within -90..90")
    if not -180.0 <= longitude <= 180.0:
        raise ValueError("longitude must be within -180..180")
    local_midnight = _local_datetime(birth_date, dt_time(0, 0), utc_offset_hours)
    jd_start = _julian_ut(local_midnight)
    result, tret = swe.rise_trans(
        jd_start,
        swe.SUN,
        swe.CALC_RISE,
        (longitude, latitude, 0.0),
        0.0,
        15.0,
        swe.FLG_SWIEPH,
    )
    if result < 0:
        return None
    local_tz = timezone(timedelta(hours=float(utc_offset_hours)))
    return _datetime_from_julian_ut(float(tret[0])).astimezone(local_tz)


def calculate_common_anto_actual_sunrise(
    *,
    birth_date: date,
    birth_time: dt_time,
    latitude: float,
    longitude: float,
    utc_offset_hours: float,
    adjust_local_mean_time: bool,
) -> dict[str, Any]:
    """Common Antoanatee using astronomical local sunrise.

    Independent MyHora comparisons select Swiss Ephemeris' default CALC_RISE
    definition (upper limb with atmospheric refraction) over disc-centre and
    no-refraction alternatives. MyHora references also fit the Suriyayat Sun at
    the birth instant as the dial anchor substantially better than replacing it
    with the Sun longitude at sunrise. This remains research-only.
    """
    local_instant = _local_datetime(birth_date, birth_time, utc_offset_hours)
    sunrise = _actual_sunrise_local(
        birth_date=birth_date,
        latitude=latitude,
        longitude=longitude,
        utc_offset_hours=utc_offset_hours,
    )
    if sunrise is None:
        return {
            "available": False,
            "research_only": True,
            "engine": ENGINE_VERSION,
            "method": "common_anto_actual_sunrise_lmt" if adjust_local_mean_time else "common_anto_actual_sunrise_legal_time",
            "reason": "No astronomical sunrise was resolved for the civil date/location (polar-day/night case possible).",
        }

    sun_longitude = _suriyayat_sun_longitude(local_instant)
    raw_elapsed = (local_instant - sunrise).total_seconds() / 60.0
    lmt_correction = local_mean_time_correction_minutes(longitude, utc_offset_hours)
    working_elapsed = raw_elapsed + (lmt_correction if adjust_local_mean_time else 0.0)
    longitude_deg = _common_longitude_from_sun_and_elapsed(sun_longitude, working_elapsed)
    packed = _pack_longitude(longitude_deg)
    return {
        "available": True,
        "research_only": True,
        "engine": ENGINE_VERSION,
        "method": "common_anto_actual_sunrise_lmt" if adjust_local_mean_time else "common_anto_actual_sunrise_legal_time",
        "method_thai": "อันโตนาทีสามัญ สมผุสอาทิตย์อุทัย ปรับเวลาท้องถิ่น" if adjust_local_mean_time else "อันโตนาทีสามัญ สมผุสอาทิตย์อุทัย",
        "latitude_used": True,
        "longitude_used": True,
        "latitude": round(float(latitude), 6),
        "longitude": round(float(longitude), 6),
        "utc_offset_hours": float(utc_offset_hours),
        "sunrise_local": sunrise.isoformat(),
        "sunrise_definition": "Swiss Ephemeris CALC_RISE default: upper limb + atmospheric refraction",
        "suriyayat_sun_anchor": "birth_instant",
        "sun_longitude_deg": round(sun_longitude, 6),
        "raw_elapsed_from_sunrise_minutes": round(raw_elapsed, 6),
        "local_mean_time_correction_minutes": round(lmt_correction, 6),
        "working_elapsed_minutes": round(working_elapsed, 6),
        **packed,
        "policy": "Research candidate only; actual local sunrise is astronomical, while common Antoanatee uses the traditional fixed sign-duration table.",
    }
'''
s = replace_once(s, marker, block + marker, "insert actual sunrise calculator")

old = '''    astronomical = calculate_astronomical_suriyayat_candidate(
        birth_date=birth_date,
        birth_time=birth_time,
        latitude=float(latitude),
        longitude=float(longitude),
        utc_offset_hours=utc_offset_hours,
    )
    delta = abs(angular_delta_deg(common_lmt["longitude_deg"], astronomical["longitude_deg"]))
'''
new = '''    actual_sunrise_legal = calculate_common_anto_actual_sunrise(
        birth_date=birth_date,
        birth_time=birth_time,
        latitude=float(latitude),
        longitude=float(longitude),
        utc_offset_hours=utc_offset_hours,
        adjust_local_mean_time=False,
    )
    actual_sunrise_lmt = calculate_common_anto_actual_sunrise(
        birth_date=birth_date,
        birth_time=birth_time,
        latitude=float(latitude),
        longitude=float(longitude),
        utc_offset_hours=utc_offset_hours,
        adjust_local_mean_time=True,
    )
    astronomical = calculate_astronomical_suriyayat_candidate(
        birth_date=birth_date,
        birth_time=birth_time,
        latitude=float(latitude),
        longitude=float(longitude),
        utc_offset_hours=utc_offset_hours,
    )
    delta = abs(angular_delta_deg(common_lmt["longitude_deg"], astronomical["longitude_deg"]))
'''
s = replace_once(s, old, new, "build actual sunrise")

old = '''        "selected_traditional_candidate": "common_anto_0600_lmt",
        "validation": VALIDATION,
        "common_anto_0600_legal_time": common_legal,
        "common_anto_0600_lmt": common_lmt,
        "astronomical_suriyayat_sidereal_crosscheck": astronomical,
'''
new = '''        "selected_traditional_candidate": "common_anto_0600_lmt",
        "validated_secondary_traditional_candidate": "common_anto_actual_sunrise_lmt",
        "validation": VALIDATION,
        "common_anto_0600_legal_time": common_legal,
        "common_anto_0600_lmt": common_lmt,
        "common_anto_actual_sunrise_legal_time": actual_sunrise_legal,
        "common_anto_actual_sunrise_lmt": actual_sunrise_lmt,
        "astronomical_suriyayat_sidereal_crosscheck": astronomical,
'''
s = replace_once(s, old, new, "output actual sunrise")
s = replace_once(
    s,
    '                "documented common Antoanatee 06:00 + LMT method",\n                "world-coordinate computation without Thailand province lookup",',
    '                "documented common Antoanatee 06:00 + LMT method",\n                "actual-local-sunrise common Antoanatee candidate against independent MyHora references",\n                "world-coordinate computation without Thailand province lookup",',
    "promotion completed",
)
p.write_text(s, encoding="utf-8")


t = Path("tests/test_thai_lagna_v1.py")
x = t.read_text(encoding="utf-8")
x = replace_once(
    x,
    '''    calculate_astronomical_suriyayat_candidate,
    calculate_common_anto_0600,
''',
    '''    calculate_astronomical_suriyayat_candidate,
    calculate_common_anto_0600,
    calculate_common_anto_actual_sunrise,
''',
    "test import",
)
insert = '''

# Independent MyHora references for the actual-local-sunrise common method.
# Two rows occur before that civil date's sunrise (00:00 / 00:18), covering
# the negative-elapsed/wrap path as well as daytime cases.
MYHORA_BANGKOK_ACTUAL_SUNRISE = (
    {"date": date(1777, 5, 14), "time": time(6, 42), "common": deg(1, 19, 8), "common_lmt": deg(1, 13, 30)},
    {"date": date(1862, 3, 6), "time": time(0, 0), "common": deg(7, 3, 51), "common_lmt": deg(7, 0, 5)},
    {"date": date(1999, 3, 9), "time": time(0, 18), "common": deg(7, 8, 22), "common_lmt": deg(7, 4, 37)},
    {"date": date(2026, 3, 24), "time": time(14, 26), "common": deg(3, 28, 58), "common_lmt": deg(3, 24, 28)},
    {"date": date(2026, 4, 20), "time": time(23, 49), "common": deg(8, 15, 9), "common_lmt": deg(8, 10, 37)},
)
'''
x = replace_once(x, "\n\nclass ThaiLagnaPhase1Tests(unittest.TestCase):\n", insert + "\n\nclass ThaiLagnaPhase1Tests(unittest.TestCase):\n", "test corpus")
methods = r'''
    def test_actual_sunrise_common_reference_corpus(self):
        errors = []
        for row in MYHORA_BANGKOK_ACTUAL_SUNRISE:
            actual = calculate_common_anto_actual_sunrise(
                birth_date=row["date"], birth_time=row["time"],
                latitude=BANGKOK_LAT, longitude=BANGKOK_LON,
                utc_offset_hours=BANGKOK_UTC, adjust_local_mean_time=False,
            )
            self.assertTrue(actual["available"], actual)
            errors.append(arcmin_error(actual["longitude_deg"], row["common"]))
        self.assertLessEqual(max(errors), 18.0, errors)
        self.assertLessEqual(sum(errors) / len(errors), 10.0, errors)

    def test_actual_sunrise_common_lmt_reference_corpus(self):
        errors = []
        for row in MYHORA_BANGKOK_ACTUAL_SUNRISE:
            actual = calculate_common_anto_actual_sunrise(
                birth_date=row["date"], birth_time=row["time"],
                latitude=BANGKOK_LAT, longitude=BANGKOK_LON,
                utc_offset_hours=BANGKOK_UTC, adjust_local_mean_time=True,
            )
            self.assertTrue(actual["available"], actual)
            errors.append(arcmin_error(actual["longitude_deg"], row["common_lmt"]))
        self.assertLessEqual(max(errors), 18.0, errors)
        self.assertLessEqual(sum(errors) / len(errors), 10.0, errors)

    def test_actual_sunrise_definition_matches_bangkok_reference_clock(self):
        actual = calculate_common_anto_actual_sunrise(
            birth_date=date(2026, 3, 24), birth_time=time(14, 26),
            latitude=BANGKOK_LAT, longitude=BANGKOK_LON,
            utc_offset_hours=BANGKOK_UTC, adjust_local_mean_time=False,
        )
        self.assertTrue(actual["sunrise_local"].startswith("2026-03-24T06:19:"), actual["sunrise_local"])
        self.assertEqual(actual["suriyayat_sun_anchor"], "birth_instant")

'''
x = replace_once(x, "    def test_world_coordinates_are_supported_but_not_promoted(self):\n", methods + "    def test_world_coordinates_are_supported_but_not_promoted(self):\n", "test methods")
x = replace_once(
    x,
    '''            "common_anto_0600_lmt",
            "astronomical_suriyayat_sidereal_crosscheck",
''',
    '''            "common_anto_0600_lmt",
            "common_anto_actual_sunrise_lmt",
            "astronomical_suriyayat_sidereal_crosscheck",
''',
    "world candidate list",
)
t.write_text(x, encoding="utf-8")


# Finalize observed validation stats from the same independent 5-vector corpus.
from datetime import date, time
from thai_lagna_v1 import angular_delta_deg, calculate_common_anto_actual_sunrise

lat, lon, utc = 13.752555, 100.494066, 7.0

def deg(sign: int, degree: int, minute: int) -> float:
    return sign * 30.0 + degree + minute / 60.0

refs = [
    (date(1777, 5, 14), time(6, 42), deg(1, 19, 8), deg(1, 13, 30)),
    (date(1862, 3, 6), time(0, 0), deg(7, 3, 51), deg(7, 0, 5)),
    (date(1999, 3, 9), time(0, 18), deg(7, 8, 22), deg(7, 4, 37)),
    (date(2026, 3, 24), time(14, 26), deg(3, 28, 58), deg(3, 24, 28)),
    (date(2026, 4, 20), time(23, 49), deg(8, 15, 9), deg(8, 10, 37)),
]
errs, errs_lmt = [], []
for day, tm, ref, ref_lmt in refs:
    a = calculate_common_anto_actual_sunrise(
        birth_date=day, birth_time=tm, latitude=lat, longitude=lon,
        utc_offset_hours=utc, adjust_local_mean_time=False,
    )
    b = calculate_common_anto_actual_sunrise(
        birth_date=day, birth_time=tm, latitude=lat, longitude=lon,
        utc_offset_hours=utc, adjust_local_mean_time=True,
    )
    errs.append(abs(angular_delta_deg(a["longitude_deg"], ref)) * 60.0)
    errs_lmt.append(abs(angular_delta_deg(b["longitude_deg"], ref_lmt)) * 60.0)

print("ACTUAL_SUNRISE_ERRORS_ARCMIN", [round(v, 3) for v in errs])
print("ACTUAL_SUNRISE_LMT_ERRORS_ARCMIN", [round(v, 3) for v in errs_lmt])

p = Path("thai_lagna_v1.py")
s = p.read_text(encoding="utf-8")
old = '"actual_sunrise": {"status": "validated_5vector_stats_pending"}'
new = (
    '"actual_sunrise": {"vectors": 5, "year_span": "1777-2026", '
    f'"max_error_arcmin": {max(errs):.3f}, "mean_error_arcmin": {sum(errs)/len(errs):.3f}, '
    f'"lmt_max_error_arcmin": {max(errs_lmt):.3f}, "lmt_mean_error_arcmin": {sum(errs_lmt)/len(errs_lmt):.3f}'
    '}'
)
if s.count(old) != 1:
    raise SystemExit(f"[finalize actual-sunrise stats] expected 1 match, got {s.count(old)}")
p.write_text(s.replace(old, new, 1), encoding="utf-8")
