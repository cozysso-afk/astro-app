from __future__ import annotations

from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    p.write_text(text.replace(old, new, 1))


# API: additive per-person forecast/current location. No UI change.
replace_once(
    "api/main.py",
    "class RelationshipProfile(BaseModel):\n",
    '''class ForecastLocation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    place_id: str | None = None
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    timezone_id: str

    @model_validator(mode="after")
    def validate_timezone(self):
        resolve_local_datetime(
            date(2000, 1, 1), dt_time(12, 0),
            timezone_id=self.timezone_id,
            utc_offset_hours=None,
        )
        return self


class RelationshipProfile(BaseModel):
''',
    "forecast location model",
)
replace_once(
    "api/main.py",
    "    timezone_fold: int | None = Field(default=None, ge=0, le=1)\n",
    "    timezone_fold: int | None = Field(default=None, ge=0, le=1)\n    forecast_location: ForecastLocation | None = None\n",
    "profile forecast location field",
)
replace_once(
    "api/main.py",
    '            "timezone_fold": self.timezone_fold,\n',
    '            "timezone_fold": self.timezone_fold,\n            "forecast_location": self.forecast_location.model_dump() if self.forecast_location else None,\n',
    "profile engine payload location",
)

# Return engine: exact crossing remains UTC/planetary. Angles/houses require an explicit forecast location.
replace_once(
    "relationship_return_v1.py",
    "from datetime import date, datetime, time as dt_time, timedelta, timezone\nfrom typing import Any\n",
    "from datetime import date, datetime, time as dt_time, timedelta, timezone\nimport math\nfrom typing import Any\nfrom zoneinfo import ZoneInfo, ZoneInfoNotFoundError\n",
    "return imports",
)
replace_once(
    "relationship_return_v1.py",
    "from timezone_provenance_v1 import resolve_profile_birth_datetime\n",
    "from timezone_provenance_v1 import TimezoneResolutionError, resolve_profile_birth_datetime\n",
    "timezone error import",
)
replace_once(
    "relationship_return_v1.py",
    'ENGINE_VERSION = "relationship-return-v2-five-body-exact-crossings"\n',
    'ENGINE_VERSION = "relationship-return-v2.1-five-body-relocation-provenance"\n',
    "return engine version",
)

helper = r'''

def _resolve_return_location(profile: dict[str, Any], birth_resolution) -> dict[str, Any]:
    """Resolve the location used only for return local-date/angle/house geometry.

    A supplied forecast location is an explicit location proxy for the forecast
    period.  Without one, planetary returns remain valid but no ASC/house
    geometry is admitted; birthplace is never silently treated as current
    residence.  Birth timezone remains only a calendar-label fallback.
    """
    raw = profile.get("forecast_location")
    if raw is None:
        return {
            "latitude": None,
            "longitude": None,
            "tzinfo": birth_resolution.tzinfo,
            "angles_available": False,
            "source": "unavailable",
            "calendar_timezone_basis": "birth_timezone_fallback",
            "provenance": {
                "source": "unavailable",
                "timezone_id": getattr(birth_resolution.tzinfo, "key", None),
                "coordinates_available": False,
                "place_id_present": False,
                "calendar_timezone_basis": "birth_timezone_fallback",
                "angles_policy": "omitted_without_forecast_location",
            },
        }
    if not isinstance(raw, dict):
        raise ValueError("forecast_location must be an object")
    try:
        lat = float(raw["latitude"])
        lon = float(raw["longitude"])
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError("forecast_location requires numeric latitude/longitude") from exc
    if not math.isfinite(lat) or not -90 <= lat <= 90:
        raise ValueError("forecast_location latitude must be finite and between -90 and 90")
    if not math.isfinite(lon) or not -180 <= lon <= 180:
        raise ValueError("forecast_location longitude must be finite and between -180 and 180")
    zone_name = str(raw.get("timezone_id") or "").strip()
    if not zone_name:
        raise TimezoneResolutionError("forecast_location timezone_id is required")
    try:
        zone = ZoneInfo(zone_name)
    except ZoneInfoNotFoundError as exc:
        raise TimezoneResolutionError(f"unknown forecast_location timezone_id: {zone_name}") from exc
    return {
        "latitude": lat,
        "longitude": lon,
        "tzinfo": zone,
        "angles_available": True,
        "source": "forecast_location",
        "calendar_timezone_basis": "forecast_location_timezone",
        "provenance": {
            "source": "forecast_location",
            "timezone_id": zone_name,
            "coordinates_available": True,
            "place_id_present": bool(raw.get("place_id")),
            "calendar_timezone_basis": "forecast_location_timezone",
            "angles_policy": "forecast_location_when_birth_time_exact",
        },
    }


def _attach_return_geometry(
    event: dict[str, Any], profile: dict[str, Any], reliability: dict[str, Any], return_location: dict[str, Any]
) -> None:
    from relationship_western_v1 import _chart_from_jd, _whole_sign_house, _house_of_longitude

    jd = _jd(datetime.fromisoformat(event["exact_utc"]))
    admit_angles = bool(reliability["time_exact"] and return_location["angles_available"])
    chart = _chart_from_jd(
        jd,
        return_location["latitude"] if admit_angles else None,
        return_location["longitude"] if admit_angles else None,
    )
    angles = chart["angles"] if admit_angles else {}
    event["angles"] = angles
    event["positions"] = {k: v["lon"] for k, v in chart["positions"].items()}
    event["house_activations"] = [
        {
            "planet": k,
            "whole_sign": _whole_sign_house(angles["ASC"], v["lon"]),
            "quadrant": _house_of_longitude(angles["cusps"], v["lon"]),
        }
        for k, v in chart["positions"].items()
        if angles and k in {"Moon", "Mercury", "Venus", "Mars"}
    ]
    provenance = dict(return_location["provenance"])
    provenance["angles_admitted"] = admit_angles
    provenance["angle_reason"] = (
        "forecast_location_and_exact_birth_time"
        if admit_angles
        else "birth_time_not_exact"
        if return_location["angles_available"]
        else "forecast_location_not_supplied"
    )
    event["return_location_provenance"] = provenance
    event["location_basis"] = (
        "forecast_location"
        if return_location["source"] == "forecast_location"
        else "unavailable; forecast_location_not_supplied"
    )
'''
replace_once(
    "relationship_return_v1.py",
    "\ndef _person_return_context(profile: dict[str, Any], start_date: date, end_date: date, label: str) -> dict[str, Any]:\n",
    helper + "\n\ndef _person_return_context(profile: dict[str, Any], start_date: date, end_date: date, label: str) -> dict[str, Any]:\n",
    "return location helpers",
)
replace_once(
    "relationship_return_v1.py",
    "    local_tz = birth_resolution.tzinfo\n",
    "    return_location = _resolve_return_location(profile, birth_resolution)\n    local_tz = return_location[\"tzinfo\"]\n",
    "return local timezone selection",
)
old_geometry = '''    # Keep exact UTC cycle boundaries and separated house systems. Birthplace is
    # the explicit return-location fallback; it is not a claimed current residence.
    from relationship_western_v1 import _chart_from_jd, _whole_sign_house, _house_of_longitude
    for event in solar_events + lunar_events + [e for v in planetary.values() for e in v["events"]]:
        jd = _jd(datetime.fromisoformat(event["exact_utc"]))
        chart = _chart_from_jd(jd, profile.get("latitude"), profile.get("longitude"))
        angles = chart["angles"]
        event["angles"] = angles if reliability["time_exact"] else {}
        event["location_basis"] = "entered_birthplace; current return location unavailable"
        event["positions"] = {k: v["lon"] for k, v in chart["positions"].items()}
        event["house_activations"] = [
            {"planet": k, "whole_sign": _whole_sign_house(angles["ASC"], v["lon"]),
             "quadrant": _house_of_longitude(angles["cusps"], v["lon"])}
            for k,v in chart["positions"].items()
            if angles and reliability["time_exact"] and k in {"Moon", "Mercury", "Venus", "Mars"}
        ]
'''
new_geometry = '''    # Return planetary positions are location-independent.  ASC/houses are
    # admitted only with an explicit forecast/current-location proxy; birthplace
    # is not silently treated as the person's location at the return instant.
    for event in solar_events + lunar_events + [e for v in planetary.values() for e in v["events"]]:
        _attach_return_geometry(event, profile, reliability, return_location)
'''
replace_once("relationship_return_v1.py", old_geometry, new_geometry, "return geometry policy")
replace_once(
    "relationship_return_v1.py",
    '        "timezone_provenance": birth_resolution.provenance(),\n',
    '        "timezone_provenance": birth_resolution.provenance(),\n        "return_location_provenance": return_location["provenance"],\n',
    "return location context provenance",
)

# Calculation Audit must own the new fixture.
replace_once(
    ".github/workflows/calculation-audit-ci.yml",
    "      - 'tests/test_timezone_provenance_v25.py'\n",
    "      - 'tests/test_timezone_provenance_v25.py'\n      - 'tests/test_return_relocation_v26.py'\n",
    "workflow path filter",
)
replace_once(
    ".github/workflows/calculation-audit-ci.yml",
    "            tests/test_timezone_provenance_v25.py \\\n",
    "            tests/test_timezone_provenance_v25.py \\\n            tests/test_return_relocation_v26.py \\\n",
    "workflow pytest list",
)

TEST = r'''from __future__ import annotations

from datetime import date, datetime, time, timezone

import pytest
from pydantic import ValidationError

from api.main import RelationshipProfile
import relationship_return_v1 as rr
from timezone_provenance_v1 import TimezoneResolutionError, resolve_profile_birth_datetime


def _profile(**overrides):
    profile = {
        "birth_date": date(1991, 3, 21),
        "birth_time": time(7, 26),
        "time_known": True,
        "time_source": "official_record",
        "time_confidence": "exact",
        "latitude": 37.5665,
        "longitude": 126.978,
        "utc_offset_hours": 9.0,
        "timezone_id": "Asia/Seoul",
    }
    profile.update(overrides)
    return profile


def test_api_forecast_location_is_optional_additive_and_preserved():
    model = RelationshipProfile(
        **_profile(),
        forecast_location={
            "place_id": "synthetic-nyc",
            "latitude": 40.7128,
            "longitude": -74.006,
            "timezone_id": "America/New_York",
        },
    )
    payload = model.engine_payload()
    assert payload["forecast_location"]["timezone_id"] == "America/New_York"
    assert payload["forecast_location"]["latitude"] == 40.7128


def test_api_forecast_location_rejects_invalid_zone():
    with pytest.raises((ValidationError, TimezoneResolutionError)):
        RelationshipProfile(
            **_profile(),
            forecast_location={
                "latitude": 40.7128,
                "longitude": -74.006,
                "timezone_id": "Mars/Olympus",
            },
        )


def test_missing_forecast_location_never_reuses_birthplace_for_return_angles():
    profile = _profile()
    birth = resolve_profile_birth_datetime(profile)
    location = rr._resolve_return_location(profile, birth)
    assert location["source"] == "unavailable"
    assert location["latitude"] is None and location["longitude"] is None

    event = {"exact_utc": "2026-09-20T00:00:00+00:00"}
    reliability = {"time_exact": True}
    rr._attach_return_geometry(event, profile, reliability, location)
    assert event["angles"] == {}
    assert event["house_activations"] == []
    assert event["location_basis"].startswith("unavailable")
    assert event["return_location_provenance"]["angles_admitted"] is False


def test_explicit_forecast_location_drives_angles_and_houses():
    profile = _profile(
        forecast_location={
            "place_id": "synthetic-nyc",
            "latitude": 40.7128,
            "longitude": -74.006,
            "timezone_id": "America/New_York",
        }
    )
    birth = resolve_profile_birth_datetime(profile)
    location = rr._resolve_return_location(profile, birth)
    event = {"exact_utc": "2026-09-20T00:00:00+00:00"}
    rr._attach_return_geometry(event, profile, {"time_exact": True}, location)
    assert location["source"] == "forecast_location"
    assert event["angles"].get("ASC") is not None
    assert len(event["house_activations"]) == 4
    assert event["return_location_provenance"]["angles_admitted"] is True
    assert "latitude" not in event["return_location_provenance"]
    assert "longitude" not in event["return_location_provenance"]


def test_forecast_location_changes_geometry_not_planetary_positions():
    birth_profile = _profile()
    ny_profile = _profile(
        forecast_location={
            "latitude": 40.7128,
            "longitude": -74.006,
            "timezone_id": "America/New_York",
        }
    )
    birth = resolve_profile_birth_datetime(birth_profile)
    no_location = rr._resolve_return_location(birth_profile, birth)
    ny_location = rr._resolve_return_location(ny_profile, birth)
    base = {"exact_utc": "2026-09-20T00:00:00+00:00"}
    a, b = dict(base), dict(base)
    rr._attach_return_geometry(a, birth_profile, {"time_exact": True}, no_location)
    rr._attach_return_geometry(b, ny_profile, {"time_exact": True}, ny_location)
    assert a["positions"] == b["positions"]
    assert a["angles"] == {}
    assert b["angles"]


def test_forecast_timezone_controls_return_local_calendar_date():
    profile = _profile(
        forecast_location={
            "latitude": 40.7128,
            "longitude": -74.006,
            "timezone_id": "America/New_York",
        }
    )
    birth = resolve_profile_birth_datetime(profile)
    location = rr._resolve_return_location(profile, birth)
    instant = datetime(2026, 1, 1, 2, 0, tzinfo=timezone.utc)
    assert rr._local_iso_date(instant, location["tzinfo"]) == "2025-12-31"


def test_forecast_location_angles_still_require_exact_birth_time():
    profile = _profile(
        forecast_location={
            "latitude": 40.7128,
            "longitude": -74.006,
            "timezone_id": "America/New_York",
        }
    )
    birth = resolve_profile_birth_datetime(profile)
    location = rr._resolve_return_location(profile, birth)
    event = {"exact_utc": "2026-09-20T00:00:00+00:00"}
    rr._attach_return_geometry(event, profile, {"time_exact": False}, location)
    assert event["angles"] == {}
    assert event["house_activations"] == []
    assert event["return_location_provenance"]["angle_reason"] == "birth_time_not_exact"
'''
Path("tests/test_return_relocation_v26.py").write_text(TEST)

print("v2.6 guarded patch applied")
