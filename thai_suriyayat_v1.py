# -*- coding: utf-8 -*-
"""Thai Suriyayat (สุริยยาตร์) 10-planet position calculator.

Scope of this module is intentionally narrow:
- Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, Thai Ketu, Uranus.
- Exact Suriyayat ecliptic position in arcminutes/sign/degree/minute.
- NO Lagna/Ascendant. The public reference implementation uses Thailand
  province-specific time offsets, which must not be reused for Korean/world
  birthplaces without an independently validated global-coordinate method.
- NO Western score blending or event probability.

Algorithm provenance:
- Python port of the MIT-licensed calculations published in
  kongesque/thai-astrology, commit dc4ddaf95df72f66a9367e2f6e0d243d2354f793.
- Independent validation vectors are taken from myhora.com's Thai Suriyayat
  table (24:00 Bangkok local mean time, UTC+06:42). Product tests require the
  port to stay within 4 arcminutes of those published vectors.

The helper functions deliberately emulate JavaScript Math.trunc/Math.round and
remainder semantics because seemingly tiny rounding differences can move a
traditional integer-table result by several arcminutes.
"""

from __future__ import annotations

import math
from datetime import date, datetime, time as dt_time, timedelta, timezone
from typing import Callable

ENGINE_VERSION = "thai-suriyayat-10planet-v1.0-candidate"
SOURCE_COMMIT = "dc4ddaf95df72f66a9367e2f6e0d243d2354f793"
BANGKOK_LMT = timezone(timedelta(hours=6, minutes=42))

SIGNS = [
    ("Aries", "เมษ", "양자리"),
    ("Taurus", "พฤษภ", "황소자리"),
    ("Gemini", "มิถุน", "쌍둥이자리"),
    ("Cancer", "กรกฎ", "게자리"),
    ("Leo", "สิงห์", "사자자리"),
    ("Virgo", "กันย์", "처녀자리"),
    ("Libra", "ตุล", "천칭자리"),
    ("Scorpio", "พิจิก", "전갈자리"),
    ("Sagittarius", "ธนู", "사수자리"),
    ("Capricorn", "มกร", "염소자리"),
    ("Aquarius", "กุมภ์", "물병자리"),
    ("Pisces", "มีน", "물고기자리"),
]

PLANET_META = {
    "sun": ("อาทิตย์", "Sun", "태양"),
    "moon": ("จันทร์", "Moon", "달"),
    "mars": ("อังคาร", "Mars", "화성"),
    "mercury": ("พุธ", "Mercury", "수성"),
    "jupiter": ("พฤหัสบดี", "Jupiter", "목성"),
    "venus": ("ศุกร์", "Venus", "금성"),
    "saturn": ("เสาร์", "Saturn", "토성"),
    "rahu": ("ราหู", "Rahu", "라후"),
    "ketu": ("เกตุ", "Thai Ketu", "태국 게투"),
    "uranus": ("มฤตยู", "Uranus", "천왕성"),
}

_QUADRANT_ADJUST_TABLE = {0: 0, 1: 244, 2: 427, 3: 488}


def _js_trunc(value: float) -> int:
    return math.trunc(value)


def _js_round(value: float) -> int:
    # JavaScript Math.round(x) is floor(x + 0.5), including negative ties.
    return math.floor(float(value) + 0.5)


def _js_mod(value: float, divisor: float) -> float:
    # JavaScript remainder keeps the sign of the dividend.
    return value - _js_trunc(value / divisor) * divisor


def _wrap21600(value: float) -> float:
    mod_value = _js_mod(value, 21600)
    return mod_value if mod_value >= 0 else mod_value + 21600


def _calculate_base_values(month_th: int, year_be: int, day: int, hour: int, minute: int) -> dict:
    if not isinstance(month_th, int) or month_th < 1 or month_th > 12:
        raise ValueError("month_th must be 1..12")
    year_ad = int(year_be) - 543
    julian_year = year_ad if month_th > 2 else year_ad - 1
    julian_month = month_th + 1 if month_th > 2 else month_th + 13
    century_component = math.floor(julian_year * 0.01)
    julian_day_base = (
        math.floor(julian_year * 365.25)
        + math.floor(julian_month * 30.6)
        + int(day)
        + 1720997
        - century_component
        + math.floor(century_component * 0.25)
    )
    if hour < 12:
        julian_day_integer = julian_day_base - 1
        fractional_day_base = hour / 24 - 0.5 + 1.5
    else:
        julian_day_integer = julian_day_base
        fractional_day_base = hour / 24 - 0.5
    # Preserve the upstream formula exactly, including its unusual minute term.
    fractional_day_offset = (hour / 60 + minute) / 60 / 60 / 24
    fractional_julian_day = fractional_day_base + fractional_day_offset
    julian_day = julian_day_integer + fractional_julian_day
    relative_julian_day = _js_round(julian_day - 1954167.5)
    time_of_day_hours = hour + minute / 60
    relative_year_from_1181 = int(year_be) - 1181
    solar_calendar_ceiling = math.ceil((292207 * relative_year_from_1181 + 373) / 800)
    solar_equation_correction = (
        relative_year_from_1181 * 0.25875
        + _js_trunc(relative_year_from_1181 / 100 + 0.38)
        - _js_trunc(relative_year_from_1181 / 4 + 0.5)
        - _js_trunc(relative_year_from_1181 / 400 + 0.595)
        - 5.53375
    )
    solar_correction_days = _js_trunc(solar_equation_correction)
    solar_correction_hours = _js_trunc((solar_equation_correction - solar_correction_days) * 24)
    solar_correction_minutes = _js_trunc(
        ((solar_equation_correction - solar_correction_days) * 24 - solar_correction_hours) * 60
    )
    current_time_minutes = hour * 60 + minute / 60
    solar_correction_minutes_total = solar_correction_hours * 60 + solar_correction_minutes / 60
    solar_correction_comparison = 1 if current_time_minutes > solar_correction_minutes_total else 2
    if relative_julian_day < solar_calendar_ceiling or (
        relative_julian_day == solar_calendar_ceiling and solar_correction_comparison == 2
    ):
        solar_cycle_year = relative_year_from_1181 - 1
    else:
        solar_cycle_year = relative_year_from_1181
    solar_cycle_position = _js_mod(
        (relative_julian_day - 1) * 800 + _js_trunc((time_of_day_hours * 800) / 24) - 373,
        292207,
    )
    solar_cycle_remainder = _js_mod(solar_cycle_position, 24350)
    solar_cycle_turns = math.floor(solar_cycle_position / 24350)
    solar_cycle_degrees = math.floor(solar_cycle_remainder / 811)
    solar_cycle_degree_remainder = _js_mod(solar_cycle_remainder, 811)
    solar_cycle_minutes = math.floor(solar_cycle_degree_remainder / 14) - 3
    solar_mean_longitude_raw = solar_cycle_turns * 1800 + solar_cycle_degrees * 60 + solar_cycle_minutes
    solar_longitude_mean = _wrap21600(solar_mean_longitude_raw)
    solar_longitude_corrected = _wrap21600(solar_longitude_mean - 23)
    solar_cycle_base_offset = solar_cycle_year - 610 if solar_cycle_position >= 364 else solar_cycle_year - 611
    solar_cycle_base_minutes = solar_cycle_base_offset * 21600 + solar_longitude_corrected
    return {
        "relative_julian_day": relative_julian_day,
        "time_of_day_hours": time_of_day_hours,
        "solar_cycle_base_minutes": solar_cycle_base_minutes,
        "solar_longitude_corrected": solar_longitude_corrected,
        "solar_longitude_mean": solar_longitude_mean,
    }


def _describe_quadrant(value: float):
    normalized = _wrap21600(value)
    quadrant_index = math.floor(normalized / 5400) + 1
    direction_multiplier = -1 if quadrant_index in (1, 2) else 1
    if quadrant_index == 1:
        arc = normalized
    elif quadrant_index == 2:
        arc = 10800 - normalized
    elif quadrant_index == 3:
        arc = normalized - 10800
    else:
        arc = 21600 - normalized
    return quadrant_index, arc, direction_multiplier


def _lookup_quadrant_adjustment(quadrant_arc_minutes: float) -> int:
    base_index = math.floor(quadrant_arc_minutes / 1800)
    lower = _QUADRANT_ADJUST_TABLE[base_index % 4]
    upper = _QUADRANT_ADJUST_TABLE[(base_index + 1) % 4]
    interpolation_factor = quadrant_arc_minutes / 1800 - base_index
    interpolated = interpolation_factor * (upper - lower) + lower
    return _js_round(interpolated * 60)


def _secondary_adjustment_parameters(value: float):
    normalized = _wrap21600(value)
    quadrant_index = math.floor(normalized / 5400) + 1
    if quadrant_index == 1:
        secondary_arc = 5400 - normalized
    elif quadrant_index == 2:
        secondary_arc = normalized - 5400
    elif quadrant_index == 3:
        secondary_arc = 16200 - normalized
    else:
        secondary_arc = normalized - 16200
    base_index = math.floor(secondary_arc / 1800)
    lower = _QUADRANT_ADJUST_TABLE[base_index % 4]
    upper = _QUADRANT_ADJUST_TABLE[(base_index + 1) % 4]
    interpolation_factor = secondary_arc / 1800 - base_index
    interpolated_adjustment = _js_round(interpolation_factor * (upper - lower) + lower + 0.5)
    half_adjustment = math.floor(interpolated_adjustment / 2)
    secondary_direction = 1 if quadrant_index in (1, 4) else -1
    return half_adjustment, secondary_direction, interpolated_adjustment


def _apply_planetary_adjustments(initial_pos: float, base_calc_val: float, *, primary_offset_baseline: float, primary_denominator_base: float, secondary_scale_factor: float) -> float:
    primary_offset = initial_pos - primary_offset_baseline
    _, primary_arc, primary_direction = _describe_quadrant(primary_offset)
    primary_table = _lookup_quadrant_adjustment(primary_arc)
    primary_half, primary_secondary_direction, _ = _secondary_adjustment_parameters(_wrap21600(primary_offset))
    primary_denominator = primary_denominator_base + primary_half * primary_secondary_direction
    primary_adjustment = _js_round((primary_table * 60) / primary_denominator) if primary_denominator != 0 else 0
    after_primary = initial_pos + primary_adjustment * primary_direction

    secondary_offset = _wrap21600(after_primary) - base_calc_val
    _, secondary_arc, secondary_direction = _describe_quadrant(secondary_offset)
    secondary_table = _lookup_quadrant_adjustment(secondary_arc)
    rounded_secondary = _js_round(_js_round(secondary_table / 60) / 3)
    scaled_primary_denominator = _js_round(primary_denominator * secondary_scale_factor)
    secondary_numerator_base = rounded_secondary + scaled_primary_denominator
    _, interpolation_direction, secondary_interpolated = _secondary_adjustment_parameters(_wrap21600(secondary_offset))
    secondary_denominator = secondary_numerator_base + secondary_interpolated * interpolation_direction
    secondary_adjustment = _js_round((secondary_table * 60) / secondary_denominator) if secondary_denominator != 0 else 0
    final_pos = _wrap21600(after_primary) + secondary_adjustment * secondary_direction
    return _wrap21600(final_pos)


def _sun_arcmin(month_th: int, year_be: int, day: int, hour: int, minute: int) -> int:
    g = {0: 0.0, 1: 35.0, 2: 67.0, 3: 94.0, 4: 116.0, 5: 129.0, 6: 134.0}
    base = _calculate_base_values(month_th, year_be, day, hour, minute)
    mean = base["solar_longitude_mean"]
    anomaly = _wrap21600(mean - 4800)
    q = math.floor(_js_trunc(anomaly / 5400)) + 1
    direction = -1 if q in (1, 2) else 1
    if q == 1:
        arc = anomaly
    elif q == 2:
        arc = 10800 - anomaly
    elif q == 3:
        arc = anomaly - 10800
    else:
        arc = 21600 - anomaly
    floor_i = math.floor(_js_trunc(arc / 900))
    ceil_i = floor_i + 1
    lo = g.get(floor_i, g[6])
    hi = g.get(ceil_i, g[6])
    factor = arc / 900 - floor_i
    adjustment = math.floor(_js_trunc(factor * (hi - lo) + lo))
    return int(_wrap21600(mean + adjustment * direction))


def _uranus_arcmin(m, y, d, h, mi):
    b = _calculate_base_values(m, y, d, h, mi)
    mean = _js_mod(math.floor(_js_trunc(b["solar_cycle_base_minutes"] / 84)) + math.floor(b["solar_cycle_base_minutes"] / 7224) + 16277, 21600)
    return int(_apply_planetary_adjustments(mean, b["solar_longitude_corrected"], primary_offset_baseline=7440, primary_denominator_base=38640, secondary_scale_factor=3/7))


def _ketu_arcmin(m, y, d, h, mi):
    b = _calculate_base_values(m, y, d, h, mi)
    cycle = _js_mod(b["relative_julian_day"] - 1 - 344, 679)
    normalized = _js_trunc(((cycle + b["time_of_day_hours"] / 24) * 21600) / 679)
    within = _js_mod(normalized, 21600)
    return int(_wrap21600(21600 - within))


def _rahu_arcmin(m, y, d, h, mi):
    b = _calculate_base_values(m, y, d, h, mi)
    primary = math.floor(b["solar_cycle_base_minutes"] / 20)
    secondary = math.floor(b["solar_cycle_base_minutes"] / 265)
    wrapped = _js_mod(primary + secondary, 21600)
    return int(_wrap21600(15150 - wrapped))


def _saturn_arcmin(m, y, d, h, mi):
    b = _calculate_base_values(m, y, d, h, mi)
    primary = math.floor(_js_trunc(b["solar_cycle_base_minutes"] / 30))
    secondary = math.floor((b["solar_cycle_base_minutes"] * 6) / 10000)
    mean = _js_mod(primary + secondary + 11944, 21600)
    return int(_apply_planetary_adjustments(mean, b["solar_longitude_corrected"], primary_offset_baseline=14820, primary_denominator_base=3780, secondary_scale_factor=7/6))


def _venus_arcmin(m, y, d, h, mi):
    b = _calculate_base_values(m, y, d, h, mi)
    base_cycle = b["solar_cycle_base_minutes"]
    primary_cycle = math.floor(_js_trunc((base_cycle * 5) / 3))
    secondary_cycle = math.floor((base_cycle * 10) / 243)
    mean = _js_mod(primary_cycle - secondary_cycle + 10944, 21600)
    primary_offset = b["solar_longitude_corrected"] - 4800
    _, primary_arc, primary_direction = _describe_quadrant(primary_offset)
    primary_table = _lookup_quadrant_adjustment(primary_arc)
    primary_half, primary_secondary_direction, _ = _secondary_adjustment_parameters(_wrap21600(primary_offset))
    primary_denominator = 19200 + primary_half * primary_secondary_direction
    primary_adjustment = _js_round((primary_table * 60) / primary_denominator) if primary_denominator else 0
    after_primary = b["solar_longitude_corrected"] + primary_adjustment * primary_direction
    secondary_offset = _wrap21600(after_primary) - mean
    _, secondary_arc, secondary_direction = _describe_quadrant(secondary_offset)
    secondary_table = _lookup_quadrant_adjustment(secondary_arc)
    rounded_secondary = _js_round(_js_round(secondary_table / 60) / 3)
    secondary_numerator_base = rounded_secondary + 60 * 11
    _, interpolation_direction, secondary_interpolated = _secondary_adjustment_parameters(_wrap21600(secondary_offset))
    secondary_denominator = secondary_numerator_base + secondary_interpolated * interpolation_direction
    secondary_adjustment = _js_round((secondary_table * 60) / secondary_denominator) if secondary_denominator else 0
    return int(_wrap21600(_wrap21600(after_primary) + secondary_adjustment * secondary_direction))


def _jupiter_arcmin(m, y, d, h, mi):
    b = _calculate_base_values(m, y, d, h, mi)
    primary = math.floor(_js_trunc(b["solar_cycle_base_minutes"] / 12))
    secondary = math.floor(b["solar_cycle_base_minutes"] / 1032)
    mean = _js_mod(primary + secondary + 14297, 21600)
    return int(_apply_planetary_adjustments(mean, b["solar_longitude_corrected"], primary_offset_baseline=10320, primary_denominator_base=5520, secondary_scale_factor=3/7))


def _mercury_arcmin(m, y, d, h, mi):
    b = _calculate_base_values(m, y, d, h, mi)
    base_cycle = b["solar_cycle_base_minutes"]
    primary_cycle = math.floor(_js_trunc((base_cycle * 7) / 46))
    secondary_cycle = math.floor(base_cycle * 4)
    mean = _js_mod(primary_cycle + secondary_cycle + 10642, 21600)
    primary_offset = b["solar_longitude_corrected"] - 13200
    _, primary_arc, primary_direction = _describe_quadrant(primary_offset)
    primary_table = _lookup_quadrant_adjustment(primary_arc)
    primary_half, primary_secondary_direction, _ = _secondary_adjustment_parameters(_wrap21600(primary_offset))
    primary_denominator = 6000 + primary_half * primary_secondary_direction
    primary_adjustment = _js_round((primary_table * 60) / primary_denominator) if primary_denominator else 0
    after_primary = b["solar_longitude_corrected"] + primary_adjustment * primary_direction
    secondary_offset = _wrap21600(after_primary) - mean
    _, secondary_arc, secondary_direction = _describe_quadrant(secondary_offset)
    secondary_table = _lookup_quadrant_adjustment(secondary_arc)
    rounded_secondary = _js_round(_js_round(secondary_table / 60) / 3)
    secondary_numerator_base = rounded_secondary + 60 * 21
    _, interpolation_direction, secondary_interpolated = _secondary_adjustment_parameters(_wrap21600(secondary_offset))
    secondary_denominator = secondary_numerator_base + secondary_interpolated * interpolation_direction
    secondary_adjustment = _js_round((secondary_table * 60) / secondary_denominator) if secondary_denominator else 0
    return int(_wrap21600(_wrap21600(after_primary) + secondary_adjustment * secondary_direction))


def _mars_arcmin(m, y, d, h, mi):
    b = _calculate_base_values(m, y, d, h, mi)
    primary = math.floor(_js_trunc(b["solar_cycle_base_minutes"] / 2))
    secondary = math.floor((b["solar_cycle_base_minutes"] * 16) / 505)
    mean = _js_mod(primary + secondary + 5420, 21600)
    return int(_apply_planetary_adjustments(mean, b["solar_longitude_corrected"], primary_offset_baseline=7620, primary_denominator_base=2700, secondary_scale_factor=4/15))


def _moon_arcmin(m, y, d, h, mi):
    g = {0: 0.0, 1: 77.0, 2: 148.0, 3: 209.0, 4: 256.0, 5: 286.0, 6: 296.0}
    b = _calculate_base_values(m, y, d, h, mi)
    rjd = b["relative_julian_day"]
    tod = b["time_of_day_hours"]
    lunar_mean_cycle = _js_mod((rjd - 1) * 703 + 650 + _js_trunc((tod * 703) / 24), 20760)
    quotient = math.floor(lunar_mean_cycle / 692)
    remainder = _js_mod(lunar_mean_cycle, 692)
    mean_estimate = quotient * 720 + _js_trunc(1.04 * remainder) - 40 + b["solar_longitude_mean"]
    mean = _wrap21600(mean_estimate)
    anomaly_cycle = _js_mod(rjd - 1 - 621, 3232)
    anomaly = _js_trunc(((anomaly_cycle + tod / 24) / 3232) * 21600) + 2
    difference = _wrap21600(mean - _wrap21600(anomaly))
    q = math.floor(_js_trunc(difference / 5400)) + 1
    direction = -1 if q in (1, 2) else 1
    if q == 1:
        arc = difference
    elif q == 2:
        arc = 10800 - difference
    elif q == 3:
        arc = difference - 10800
    else:
        arc = 21600 - difference
    floor_i = math.floor(_js_trunc(arc / 900))
    ceil_i = floor_i + 1
    lo = g.get(floor_i, g[6])
    hi = g.get(ceil_i, g[6])
    factor = arc / 900 - floor_i
    adjustment = math.floor(_js_trunc(factor * (hi - lo) + lo))
    return int(_wrap21600(mean + adjustment * direction))


_CALCULATORS: dict[str, Callable[[int, int, int, int, int], int]] = {
    "sun": _sun_arcmin,
    "moon": _moon_arcmin,
    "mars": _mars_arcmin,
    "mercury": _mercury_arcmin,
    "jupiter": _jupiter_arcmin,
    "venus": _venus_arcmin,
    "saturn": _saturn_arcmin,
    "rahu": _rahu_arcmin,
    "ketu": _ketu_arcmin,
    "uranus": _uranus_arcmin,
}


def calculate_positions_civil(*, year_ad: int, month: int, day: int, hour: int, minute: int) -> dict[str, int]:
    """Calculate raw Suriyayat arcminutes for a Bangkok-LMT civil timestamp.

    This low-level API mirrors the source formula. For an actual birth/transit
    instant in another timezone, use calculate_positions_for_instant().
    """
    year_be = int(year_ad) + 543
    return {
        key: int(calc(int(month), year_be, int(day), int(hour), int(minute)))
        for key, calc in _CALCULATORS.items()
    }


def _pack_position(key: str, arcmin: int) -> dict:
    arcmin = int(arcmin) % 21600
    sign_index = arcmin // 1800
    within = arcmin % 1800
    degree = within // 60
    minute = within % 60
    en, th, ko = SIGNS[sign_index]
    planet_th, planet_en, planet_ko = PLANET_META[key]
    return {
        "key": key,
        "planet_en": planet_en,
        "planet_th": planet_th,
        "planet_ko": planet_ko,
        "arcmin": arcmin,
        "longitude_deg": round(arcmin / 60.0, 6),
        "sign_index": sign_index,
        "sign_en": en,
        "sign_th": th,
        "sign_ko": ko,
        "degree": degree,
        "minute": minute,
        "display": f"{ko} {degree}°{minute:02d}′",
    }


def calculate_positions_for_instant(value: datetime) -> dict:
    """Calculate 10 Suriyayat planet positions for a physical instant.

    The instant is converted to Bangkok historical local mean time UTC+06:42,
    the basis used by the independent myhora Suriyayat tables. Seconds are
    truncated because the traditional integer formula and published tables are
    minute-granularity.
    """
    if value.tzinfo is None:
        raise ValueError("timezone-aware datetime required")
    reference = value.astimezone(BANGKOK_LMT)
    raw = calculate_positions_civil(
        year_ad=reference.year,
        month=reference.month,
        day=reference.day,
        hour=reference.hour,
        minute=reference.minute,
    )
    return {
        "engine": ENGINE_VERSION,
        "source_commit": SOURCE_COMMIT,
        "time_basis": "Bangkok historical local mean time UTC+06:42",
        "instant": value.isoformat(timespec="seconds"),
        "suriyayat_reference_time": reference.isoformat(timespec="minutes"),
        "positions": {key: _pack_position(key, raw[key]) for key in _CALCULATORS},
        "lagna": {
            "available": False,
            "reason": "Global-coordinate Suriyayat Lagna is not yet independently validated; Thailand province-offset lookup is not reused outside Thailand.",
        },
        "policy": "10-planet traditional position facts only; no Western-score blending and no event probability.",
    }


def snapshot_for_local_date(day_value: date, *, local_hour: int = 12, utc_offset_hours: float = 9.0) -> dict:
    tz = timezone(timedelta(hours=float(utc_offset_hours)))
    value = datetime.combine(day_value, dt_time(int(local_hour), 0), tzinfo=tz)
    return calculate_positions_for_instant(value)
