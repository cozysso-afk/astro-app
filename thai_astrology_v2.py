# -*- coding: utf-8 -*-
"""Traditional Thai astrology layers that can be computed without pretending to
implement the full Suriyayat planetary canon.

Implemented here:
- Thai weekday ruler with the 06:00 local-day boundary and Wednesday-night Rahu.
- Mahathaksa (มหาทักษา) natal 8-bhumi wheel.
- Taksajorn (ทักษาจร) annual wheel using the documented one-bhumi-per
  age-in-progress method, including the traditional centre slot after Sun and
  the Jupiter fallback when the count lands in the centre.

Not implemented here:
- Full Suriyayat 10-planet longitudes, Lagna, Thai Ketu, dignities or planetary
  ingress/transit. Those remain explicitly unavailable rather than being
  approximated with Western tropical or generic Lahiri sidereal positions.
"""

from __future__ import annotations

import calendar
from datetime import date, datetime, time as dt_time, timedelta
from typing import Any

ENGINE_VERSION = "thai-mahathaksa-taksajorn-v2.0"

# Traditional Ashtagraha/Taksa walking order used in Thai Mahathaksa tables.
_PLANET_ORDER = ("sun", "moon", "mars", "mercury", "saturn", "jupiter", "rahu", "venus")
# Annual Taksa counting inserts the centre after Sun before continuing to Moon.
_AGE_WALK_ORDER = ("sun", "center", "moon", "mars", "mercury", "saturn", "jupiter", "rahu", "venus")

_PLANETS = {
    "sun": {"number": 1, "thai": "อาทิตย์", "ko": "Sun(태양)"},
    "moon": {"number": 2, "thai": "จันทร์", "ko": "Moon(달)"},
    "mars": {"number": 3, "thai": "อังคาร", "ko": "Mars(화성)"},
    "mercury": {"number": 4, "thai": "พุธ", "ko": "Mercury(수성)"},
    "jupiter": {"number": 5, "thai": "พฤหัสบดี", "ko": "Jupiter(목성)"},
    "venus": {"number": 6, "thai": "ศุกร์", "ko": "Venus(금성)"},
    "saturn": {"number": 7, "thai": "เสาร์", "ko": "Saturn(토성)"},
    "rahu": {"number": 8, "thai": "ราหู", "ko": "Rahu(라후)"},
}

_BHUMI = (
    ("boriwan", "บริวาร", "브리완·주변 사람/관계망"),
    ("ayu", "อายุ", "아유·생활력/지속"),
    ("det", "เดช", "뎃·권한/추진력"),
    ("sri", "ศรี", "시리·번영/호조"),
    ("mula", "มูละ", "물라·기반/자원"),
    ("utsaha", "อุตสาหะ", "웃사하·노력/실행"),
    ("montri", "มนตรี", "몬뜨리·지원/조력"),
    ("kalakini", "กาลกิณี", "깔라끼니·마찰/주의"),
)

_DAY_META = {
    "sunday": ("일요일", "sun", "일요일 출생층"),
    "monday": ("월요일", "moon", "월요일 출생층"),
    "tuesday": ("화요일", "mars", "화요일 출생층"),
    "wednesday_day": ("수요일 낮", "mercury", "수요일 06:00~17:59 출생층"),
    "wednesday_night": ("수요일 밤", "rahu", "수요일 18:00~다음날 05:59 라후 출생층"),
    "thursday": ("목요일", "jupiter", "목요일 출생층"),
    "friday": ("금요일", "venus", "금요일 출생층"),
    "saturday": ("토요일", "saturn", "토요일 출생층"),
}

_WEEKDAY_KEY = {
    6: "sunday",
    0: "monday",
    1: "tuesday",
    2: "wednesday_day",
    3: "thursday",
    4: "friday",
    5: "saturday",
}


def _thai_day_key(birth_date: date, birth_time: dt_time) -> str:
    local = datetime.combine(birth_date, birth_time)
    # Traditional Thai day changes at 06:00 rather than midnight.
    effective = local - timedelta(hours=6)
    key = _WEEKDAY_KEY[effective.weekday()]
    if key == "wednesday_day":
        # Wednesday 18:00 through Thursday 05:59 belongs to Rahu.
        wednesday_18 = datetime.combine(effective.date(), dt_time(18, 0))
        if local >= wednesday_18:
            key = "wednesday_night"
    return key


def _planet_payload(key: str) -> dict[str, Any]:
    p = _PLANETS[key]
    return {"key": key, "number": p["number"], "thai_name": p["thai"], "label": p["ko"]}


def _rotate_planets(start_planet: str) -> list[str]:
    idx = _PLANET_ORDER.index(start_planet)
    return list(_PLANET_ORDER[idx:] + _PLANET_ORDER[:idx])


def _wheel(start_planet: str) -> list[dict[str, Any]]:
    planets = _rotate_planets(start_planet)
    out = []
    for (bhumi_key, bhumi_th, bhumi_ko), planet in zip(_BHUMI, planets):
        out.append({
            "bhumi_key": bhumi_key,
            "bhumi_thai": bhumi_th,
            "bhumi_label": bhumi_ko,
            "planet": _planet_payload(planet),
        })
    return out


def _birthday_in_year(birth_date: date, year: int) -> date:
    if birth_date.month == 2 and birth_date.day == 29 and not calendar.isleap(year):
        # Explicit deterministic policy for Gregorian age segmentation.
        return date(year, 2, 28)
    return date(year, birth_date.month, birth_date.day)


def _completed_years(birth_date: date, as_of: date) -> int:
    if as_of < birth_date:
        raise ValueError("Thai period cannot start before birth date")
    years = as_of.year - birth_date.year
    if as_of < _birthday_in_year(birth_date, as_of.year):
        years -= 1
    return max(0, years)


def _age_in_progress(birth_date: date, as_of: date) -> int:
    # อายุย่าง: first life-year is 1; after each birthday it advances by one.
    return _completed_years(birth_date, as_of) + 1


def _annual_boriwan(birth_planet: str, age_in_progress: int) -> tuple[str, bool]:
    start_index = _AGE_WALK_ORDER.index(birth_planet)
    landing = _AGE_WALK_ORDER[(start_index + max(1, age_in_progress) - 1) % len(_AGE_WALK_ORDER)]
    if landing == "center":
        # Worked traditional Taksa rule: if age lands in the centre, Jupiter is
        # used as the annual Boriwan starting planet.
        return "jupiter", True
    return landing, False


def _period_boundaries(birth_date: date, start_date: date, end_date: date) -> list[date]:
    boundaries = [start_date]
    for year in range(start_date.year, end_date.year + 1):
        bday = _birthday_in_year(birth_date, year)
        if start_date < bday <= end_date:
            boundaries.append(bday)
    boundaries.append(end_date + timedelta(days=1))
    return sorted(set(boundaries))


def build_thai_fortune(
    birth_date: date,
    birth_time: dt_time,
    start_date: date,
    end_date: date,
) -> dict[str, Any]:
    if end_date < start_date:
        raise ValueError("end_date must be on or after start_date")

    day_key = _thai_day_key(birth_date, birth_time)
    thai_day, birth_planet, rule = _DAY_META[day_key]
    natal_wheel = _wheel(birth_planet)

    segments = []
    boundaries = _period_boundaries(birth_date, start_date, end_date)
    for left, right_exclusive in zip(boundaries, boundaries[1:]):
        right = right_exclusive - timedelta(days=1)
        if right < left:
            continue
        age = _age_in_progress(birth_date, left)
        annual_planet, landed_center = _annual_boriwan(birth_planet, age)
        segments.append({
            "start": left.isoformat(),
            "end": right.isoformat(),
            "age_in_progress": age,
            "annual_boriwan": _planet_payload(annual_planet),
            "landed_center": landed_center,
            "wheel": _wheel(annual_planet),
        })

    return {
        "ok": True,
        "engine": ENGINE_VERSION,
        "thai_day": thai_day,
        "birth_planet": _planet_payload(birth_planet),
        "ruler": _PLANETS[birth_planet]["ko"],
        "rule": rule,
        "day_boundary": "06:00 local; Wednesday night 18:00~05:59 = Rahu",
        "mahathaksa": {
            "available": True,
            "method": "traditional 8-bhumi wheel; planet order 1-2-3-4-7-5-8-6",
            "wheel": natal_wheel,
        },
        "taksajorn": {
            "available": True,
            "method": "age-in-progress, one bhumi per year; centre after Sun; centre landing uses Jupiter as annual Boriwan",
            "segments": segments,
            "method_variance_note": "Thai schools use more than one Taksajorn counting convention; this engine exposes the selected one-year-per-bhumi method instead of treating it as the only school.",
        },
        "predictive_status": "period_layer_available_no_suriyayat_transit",
        "consensus_policy": "Mahathaksa/Taksajorn period facts are available as an independent Thai layer. Full Suriyayat planetary transit is not yet verified, so Thai data is not converted into Western-style numerical timing scores.",
        "reliability": {
            "weekday_rule": "established_rule",
            "mahathaksa_wheel": "established_table_rule",
            "taksajorn": "documented_method_variant",
            "suriyayat_transit": "not_implemented",
        },
        "not_calculated": [
            "full Suriyayat 10-planet longitudes",
            "Suriyayat Lagna",
            "Thai Ketu formula",
            "Rahu mean/true school selection",
            "Suriyayat transit/ingress",
        ],
    }
