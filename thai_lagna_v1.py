# -*- coding: utf-8 -*-
"""Research-only Suriyayat Lagna candidates.

This module deliberately does NOT promote a Thai Lagna into production
interpretation yet.  It provides three independently inspectable candidates:

1) common_anto_0600_lmt
   Traditional อันโตนาทีสามัญ (common Antoanatee) using the fixed 12-sign
   rising-duration table, 06:00 anchor, and longitude-based Local Mean Time
   correction.  This is the globally portable form of the common Thai dial
   method because it depends on legal UTC offset + longitude, not a Thailand
   province lookup table.

2) common_anto_actual_sunrise_lmt
   Traditional common Antoanatee using the astronomical local sunrise for the
   birthplace, with the same optional Local Mean Time correction. The sunrise
   definition is Swiss Ephemeris CALC_RISE default (upper limb + refraction),
   selected by independent MyHora comparison.

3) astronomical_suriyayat_sidereal
   Latitude/longitude-aware astronomical cross-check.  Swiss Ephemeris gives
   the physical tropical Ascendant; the result is mapped into the Suriyayat
   fixed-zodiac frame using the difference between the tropical Sun and the
   independently calculated Suriyayat Sun at the same physical instant.
   This is a validation aid, not yet a canonical traditional Thai rule.

Promotion policy:
- No candidate is exposed as `lagna.available=True` until a broad independent
  reference corpus passes across dates, latitudes, longitudes and sign
  boundaries.
- No house, dignity, aspect judgement or Gemini interpretation may depend on
  these research values before promotion.

Reference concepts used for validation:
- MyHora Thai Ascendant help: common Antoanatee, LMT correction, local
  Antoanatee and sidereal-time methods are distinct selectable methods.
- MyHora common dial explanation: Sun position is aligned with sunrise/06:00,
  then elapsed time is walked through the Antoanatee sign-duration table.
- kongesque/thai-astrology MIT implementation (commit
  dc4ddaf95df72f66a9367e2f6e0d243d2354f793) provides the same common
  Antoanatee sign-duration table and dial algorithm for Thailand provinces.
"""

from __future__ import annotations

from datetime import date, datetime, time as dt_time, timedelta, timezone
from typing import Any

import swisseph as swe

from thai_suriyayat_v1 import calculate_positions_for_instant

ENGINE_VERSION = "thai-suriyayat-lagna-research-v1.2-actual-sunrise"

VALIDATION = {
    "status": "bangkok_era_spanning_validated_global_pending",
    "reference": "MyHora Bangkok Suriyayat Lagna",
    "vectors": 7,
    "year_span": "1777-2026",
    "coordinates": {"latitude": 13.752555, "longitude": 100.494066, "utc_offset_hours": 7.0},
    "common_0600": {"max_error_arcmin": 15.75, "mean_error_arcmin": 5.791},
    "common_lmt": {"max_error_arcmin": 15.695, "mean_error_arcmin": 6.03},
    "actual_sunrise": {"vectors": 5, "year_span": "1777-2026", "max_error_arcmin": 8.500, "mean_error_arcmin": 2.708, "lmt_max_error_arcmin": 8.445, "lmt_mean_error_arcmin": 2.623},
    "astronomical_crosscheck": {"max_error_arcmin": 33.957, "mean_error_arcmin": 16.219},
    "global_coordinates_compute_supported": True,
    "global_coordinates_independently_validated": False,
    "note": "Bangkok references span 249 years. The actual-sunrise common method is separately validated against MyHora. Korea/world coordinates compute without Thailand province tables, but an independent non-Thailand reference corpus is still required before promotion.",
}

# Traditional common Antoanatee durations in civil minutes.
# Aries..Pisces; total = 1440 minutes.
COMMON_SIGN_DURATIONS_MINUTES = (
    120.0, 96.0, 72.0, 120.0, 144.0, 168.0,
    168.0, 144.0, 120.0, 72.0, 96.0, 120.0,
)

SIGNS = (
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
)


def _wrap360(value: float) -> float:
    return float(value) % 360.0


def angular_delta_deg(a: float, b: float) -> float:
    """Signed shortest difference a-b in degrees, range [-180, 180)."""
    return ((_wrap360(a) - _wrap360(b) + 180.0) % 360.0) - 180.0


def _pack_longitude(longitude_deg: float) -> dict[str, Any]:
    longitude_deg = _wrap360(longitude_deg)
    total_arcmin = longitude_deg * 60.0
    sign_index = int(total_arcmin // 1800.0) % 12
    within_arcmin = total_arcmin - sign_index * 1800.0
    degree = int(within_arcmin // 60.0)
    minute_float = within_arcmin - degree * 60.0
    minute = int(minute_float)
    second = int(round((minute_float - minute) * 60.0))
    if second >= 60:
        minute += 1
        second -= 60
    if minute >= 60:
        degree += 1
        minute -= 60
    if degree >= 30:
        sign_index = (sign_index + 1) % 12
        degree -= 30
    en, th, ko = SIGNS[sign_index]
    return {
        "longitude_deg": round(longitude_deg, 6),
        "sign_index": sign_index,
        "sign_en": en,
        "sign_th": th,
        "sign_ko": ko,
        "degree": degree,
        "minute": minute,
        "second": second,
        "display": f"{ko} {degree}°{minute:02d}′{second:02d}″",
    }


def local_mean_time_correction_minutes(longitude: float, utc_offset_hours: float) -> float:
    """Legal local time -> Local Mean Time correction.

    Earth rotates 15° per hour, therefore 1° longitude difference from the
    legal timezone's standard meridian corresponds to 4 civil minutes.
    """
    standard_meridian = 15.0 * float(utc_offset_hours)
    return 4.0 * (float(longitude) - standard_meridian)


def _local_datetime(birth_date: date, birth_time: dt_time, utc_offset_hours: float) -> datetime:
    tz = timezone(timedelta(hours=float(utc_offset_hours)))
    return datetime.combine(birth_date, birth_time, tzinfo=tz)


def _suriyayat_sun_longitude(local_instant: datetime) -> float:
    snapshot = calculate_positions_for_instant(local_instant)
    sun = (snapshot.get("positions") or {}).get("sun") or {}
    value = sun.get("longitude_deg")
    if value is None:
        raise ValueError("Suriyayat Sun longitude is unavailable")
    return _wrap360(float(value))


def calculate_common_anto_0600(
    *,
    birth_date: date,
    birth_time: dt_time,
    longitude: float,
    utc_offset_hours: float,
    adjust_local_mean_time: bool,
) -> dict[str, Any]:
    """Traditional common Antoanatee 06:00 dial candidate.

    The longitude correction replaces the Thailand province-offset table with
    the general formula 4*(longitude - 15*UTC_offset) minutes, so the same
    explicit method can be tested for any legal timezone/longitude pair.
    Latitude is intentionally not used because common Antoanatee is a fixed
    duration table; latitude-aware methods are a distinct Thai method family.
    """
    local_instant = _local_datetime(birth_date, birth_time, utc_offset_hours)
    sun_longitude = _suriyayat_sun_longitude(local_instant)
    sun_arcmin = sun_longitude * 60.0
    sun_sign = int(sun_arcmin // 1800.0) % 12
    sun_within_deg = (sun_arcmin - sun_sign * 1800.0) / 60.0

    minutes_before_sun_sign = sum(COMMON_SIGN_DURATIONS_MINUTES[:sun_sign])
    sun_sign_duration = COMMON_SIGN_DURATIONS_MINUTES[sun_sign]
    sun_progression_minutes = sun_sign_duration * (sun_within_deg / 30.0)
    zodiac_progression_at_anchor = minutes_before_sun_sign + sun_progression_minutes

    legal_clock_minutes = (
        birth_time.hour * 60.0
        + birth_time.minute
        + birth_time.second / 60.0
        + birth_time.microsecond / 60_000_000.0
    )
    lmt_correction = local_mean_time_correction_minutes(longitude, utc_offset_hours)
    working_clock_minutes = legal_clock_minutes + (lmt_correction if adjust_local_mean_time else 0.0)
    elapsed_since_0600 = (working_clock_minutes - 360.0) % 1440.0
    ascensional_minute = (zodiac_progression_at_anchor + elapsed_since_0600) % 1440.0

    cumulative = 0.0
    sign_index = 0
    degree_in_sign = 0.0
    for index, duration in enumerate(COMMON_SIGN_DURATIONS_MINUTES):
        end = cumulative + duration
        if cumulative <= ascensional_minute < end or index == 11:
            sign_index = index
            minutes_into_sign = max(0.0, ascensional_minute - cumulative)
            degree_in_sign = (minutes_into_sign * 30.0) / duration
            break
        cumulative = end

    longitude_deg = sign_index * 30.0 + degree_in_sign
    packed = _pack_longitude(longitude_deg)
    return {
        "available": True,
        "research_only": True,
        "engine": ENGINE_VERSION,
        "method": "common_anto_0600_lmt" if adjust_local_mean_time else "common_anto_0600_legal_time",
        "method_thai": "อันโตนาทีสามัญ อาทิตย์อุทัย 06:00น. ปรับเวลาท้องถิ่น" if adjust_local_mean_time else "อันโตนาทีสามัญ อาทิตย์อุทัย 06:00น.",
        "latitude_used": False,
        "longitude_used": True,
        "utc_offset_hours": float(utc_offset_hours),
        "standard_meridian_deg": round(15.0 * float(utc_offset_hours), 6),
        "local_mean_time_correction_minutes": round(lmt_correction, 6),
        "legal_clock_minutes": round(legal_clock_minutes, 6),
        "working_clock_minutes": round(working_clock_minutes, 6),
        "sun_longitude_deg": round(sun_longitude, 6),
        **packed,
        "policy": "Research candidate only; fixed common Antoanatee durations, no latitude-derived rising-time correction.",
    }



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

def _julian_ut(local_instant: datetime) -> float:
    utc = local_instant.astimezone(timezone.utc)
    hour = utc.hour + utc.minute / 60.0 + utc.second / 3600.0 + utc.microsecond / 3_600_000_000.0
    return float(swe.julday(utc.year, utc.month, utc.day, hour, swe.GREG_CAL))


def calculate_astronomical_suriyayat_candidate(
    *,
    birth_date: date,
    birth_time: dt_time,
    latitude: float,
    longitude: float,
    utc_offset_hours: float,
) -> dict[str, Any]:
    """Latitude-aware astronomical cross-check mapped to the Suriyayat frame.

    This is intentionally a *cross-check*, not yet a promoted Thai rule.  The
    physical Ascendant is calculated in the tropical frame by Swiss Ephemeris.
    The same instant's tropical Sun minus Suriyayat Sun supplies a local frame
    offset that maps the ecliptic intersection into Suriyayat zodiac degrees.
    """
    latitude = float(latitude)
    longitude = float(longitude)
    if not -90.0 <= latitude <= 90.0:
        raise ValueError("latitude must be within -90..90")
    if not -180.0 <= longitude <= 180.0:
        raise ValueError("longitude must be within -180..180")

    local_instant = _local_datetime(birth_date, birth_time, utc_offset_hours)
    jd_ut = _julian_ut(local_instant)
    # Whole-sign house flag keeps this call independent of Placidus polar
    # fallbacks; ascmc[0] is the physical tropical Ascendant.
    _cusps, ascmc = swe.houses_ex(jd_ut, latitude, longitude, b"W", 0)
    tropical_asc = _wrap360(float(ascmc[0]))
    tropical_sun = _wrap360(float(swe.calc_ut(jd_ut, swe.SUN, swe.FLG_SWIEPH)[0][0]))
    suriyayat_sun = _suriyayat_sun_longitude(local_instant)
    frame_offset = _wrap360(tropical_sun - suriyayat_sun)
    suriyayat_asc = _wrap360(tropical_asc - frame_offset)

    return {
        "available": True,
        "research_only": True,
        "engine": ENGINE_VERSION,
        "method": "astronomical_suriyayat_sidereal_crosscheck",
        "latitude_used": True,
        "longitude_used": True,
        "latitude": round(latitude, 6),
        "longitude": round(longitude, 6),
        "utc_offset_hours": float(utc_offset_hours),
        "julian_ut": round(jd_ut, 8),
        "tropical_ascendant_deg": round(tropical_asc, 6),
        "tropical_sun_deg": round(tropical_sun, 6),
        "suriyayat_sun_deg": round(suriyayat_sun, 6),
        "suriyayat_frame_offset_deg": round(frame_offset, 6),
        **_pack_longitude(suriyayat_asc),
        "policy": "Astronomical validation cross-check only; dynamic Sun-frame mapping is not yet canonical Thai Lagna.",
    }


def build_suriyayat_lagna_research(
    *,
    birth_date: date,
    birth_time: dt_time,
    latitude: float | None,
    longitude: float | None,
    utc_offset_hours: float,
) -> dict[str, Any]:
    """Return research candidates without promoting a product Lagna."""
    if latitude is None or longitude is None:
        return {
            "available": False,
            "research_only": True,
            "engine": ENGINE_VERSION,
            "promotion_status": "blocked_missing_coordinates",
            "reason": "latitude and longitude are required for the world-coordinate Lagna research layer",
        }

    common_legal = calculate_common_anto_0600(
        birth_date=birth_date,
        birth_time=birth_time,
        longitude=float(longitude),
        utc_offset_hours=utc_offset_hours,
        adjust_local_mean_time=False,
    )
    common_lmt = calculate_common_anto_0600(
        birth_date=birth_date,
        birth_time=birth_time,
        longitude=float(longitude),
        utc_offset_hours=utc_offset_hours,
        adjust_local_mean_time=True,
    )
    actual_sunrise_legal = calculate_common_anto_actual_sunrise(
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

    return {
        "available": True,
        "research_only": True,
        "engine": ENGINE_VERSION,
        "promotion_status": "research_only_not_for_interpretation",
        "selected_traditional_candidate": "common_anto_0600_lmt",
        "validated_secondary_traditional_candidate": "common_anto_actual_sunrise_lmt",
        "validation": VALIDATION,
        "common_anto_0600_legal_time": common_legal,
        "common_anto_0600_lmt": common_lmt,
        "common_anto_actual_sunrise_legal_time": actual_sunrise_legal,
        "common_anto_actual_sunrise_lmt": actual_sunrise_lmt,
        "astronomical_suriyayat_sidereal_crosscheck": astronomical,
        "candidate_delta_deg": round(delta, 6),
        "candidate_delta_arcmin": round(delta * 60.0, 3),
        "boundary_risk": bool(delta >= 5.0 or common_lmt["sign_index"] != astronomical["sign_index"]),
        "promotion_gate": {
            "completed": [
                "era-spanning independent MyHora Bangkok corpus (7 vectors, 1777-2026)",
                "documented common Antoanatee 06:00 + LMT method",
                "actual-local-sunrise common Antoanatee candidate against independent MyHora references",
                "world-coordinate computation without Thailand province lookup",
            ],
            "required": [
                "independent non-Thailand reference corpus across multiple latitudes/longitudes/timezones",
                "sign-boundary stress cases against independent references",
            ],
            "houses_allowed": False,
            "dignities_allowed": False,
            "gemini_interpretation_allowed": False,
        },
    }
