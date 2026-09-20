from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    path.write_text(text.replace(old, new, 1))


def replace_between(path: Path, start: str, end: str, new: str, label: str) -> None:
    text = path.read_text()
    if text.count(start) != 1 or text.count(end) != 1:
        raise RuntimeError(f"{label}: non-unique boundary")
    i = text.index(start)
    j = text.index(end, i)
    path.write_text(text[:i] + new + text[j:])


api = ROOT / "api/main.py"
rr = ROOT / "relationship_return_v1.py"
ci = ROOT / ".github/workflows/calculation-audit-ci.yml"
test = ROOT / "tests/test_return_relocation_v27.py"

replace_once(
    api,
    '''        return self\n\n\nclass RelationshipProfile(BaseModel):\n''',
    '''        return self\n\n\nclass ForecastLocationInterval(ForecastLocation):\n    start_utc: datetime\n    end_utc: datetime\n\n    @model_validator(mode="after")\n    def validate_interval(self):\n        if self.start_utc.tzinfo is None or self.start_utc.utcoffset() is None:\n            raise ValueError("forecast_location_timeline start_utc must be timezone-aware")\n        if self.end_utc.tzinfo is None or self.end_utc.utcoffset() is None:\n            raise ValueError("forecast_location_timeline end_utc must be timezone-aware")\n        self.start_utc = self.start_utc.astimezone(timezone.utc)\n        self.end_utc = self.end_utc.astimezone(timezone.utc)\n        if self.end_utc <= self.start_utc:\n            raise ValueError("forecast_location_timeline end_utc must be after start_utc")\n        return self\n\n\nclass RelationshipProfile(BaseModel):\n''',
    "api timeline model",
)
replace_once(
    api,
    '''    forecast_location: ForecastLocation | None = None\n\n    @model_validator(mode="after")\n''',
    '''    forecast_location: ForecastLocation | None = None\n    forecast_location_timeline: list[ForecastLocationInterval] = Field(default_factory=list)\n\n    @model_validator(mode="after")\n''',
    "api timeline field",
)
replace_once(
    api,
    '''            fold=self.timezone_fold,\n        )\n        return self\n\n    def engine_payload(self) -> dict:\n''',
    '''            fold=self.timezone_fold,\n        )\n        timeline = sorted(self.forecast_location_timeline, key=lambda entry: entry.start_utc)\n        for previous, current in zip(timeline, timeline[1:]):\n            if current.start_utc < previous.end_utc:\n                raise ValueError("forecast_location_timeline intervals must not overlap")\n        self.forecast_location_timeline = timeline\n        return self\n\n    def engine_payload(self) -> dict:\n''',
    "api overlap validator",
)
replace_once(
    api,
    '''            "forecast_location": self.forecast_location.model_dump() if self.forecast_location else None,\n        }\n''',
    '''            "forecast_location": self.forecast_location.model_dump() if self.forecast_location else None,\n            "forecast_location_timeline": [entry.model_dump() for entry in self.forecast_location_timeline],\n        }\n''',
    "api timeline payload",
)

replace_once(
    rr,
    'ENGINE_VERSION = "relationship-return-v2.1-five-body-relocation-provenance"',
    'ENGINE_VERSION = "relationship-return-v2.2-five-body-relocation-timeline"',
    "return engine version",
)

resolver = '''def _coerce_utc(value: Any, label: str) -> datetime:\n    if isinstance(value, datetime):\n        parsed = value\n    elif isinstance(value, str):\n        try:\n            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))\n        except ValueError as exc:\n            raise ValueError(f"{label} must be an ISO-8601 datetime") from exc\n    else:\n        raise ValueError(f"{label} must be a datetime or ISO-8601 string")\n    if parsed.tzinfo is None or parsed.utcoffset() is None:\n        raise ValueError(f"{label} must be timezone-aware")\n    return parsed.astimezone(timezone.utc)\n\n\ndef _normalize_forecast_timeline(profile: dict[str, Any]) -> list[dict[str, Any]]:\n    raw_timeline = profile.get("forecast_location_timeline") or []\n    if not isinstance(raw_timeline, list):\n        raise ValueError("forecast_location_timeline must be an array")\n    normalized: list[dict[str, Any]] = []\n    for index, raw in enumerate(raw_timeline):\n        if not isinstance(raw, dict):\n            raise ValueError("forecast_location_timeline entries must be objects")\n        start = _coerce_utc(raw.get("start_utc"), f"forecast_location_timeline[{index}].start_utc")\n        end = _coerce_utc(raw.get("end_utc"), f"forecast_location_timeline[{index}].end_utc")\n        if end <= start:\n            raise ValueError("forecast_location_timeline end_utc must be after start_utc")\n        normalized.append({**raw, "start_utc": start, "end_utc": end, "timeline_index": index})\n    normalized.sort(key=lambda entry: entry["start_utc"])\n    for previous, current in zip(normalized, normalized[1:]):\n        if current["start_utc"] < previous["end_utc"]:\n            raise ValueError("forecast_location_timeline intervals must not overlap")\n    return normalized\n\n\ndef _build_return_location(\n    raw: dict[str, Any], birth_resolution, *, source: str, timeline_index: int | None = None\n) -> dict[str, Any]:\n    if not isinstance(raw, dict):\n        raise ValueError("forecast location must be an object")\n    try:\n        lat = float(raw["latitude"])\n        lon = float(raw["longitude"])\n    except (KeyError, TypeError, ValueError) as exc:\n        raise ValueError("forecast location requires numeric latitude/longitude") from exc\n    if not math.isfinite(lat) or not -90 <= lat <= 90:\n        raise ValueError("forecast location latitude must be finite and between -90 and 90")\n    if not math.isfinite(lon) or not -180 <= lon <= 180:\n        raise ValueError("forecast location longitude must be finite and between -180 and 180")\n    zone_name = str(raw.get("timezone_id") or "").strip()\n    if not zone_name:\n        raise TimezoneResolutionError("forecast location timezone_id is required")\n    try:\n        zone = ZoneInfo(zone_name)\n    except ZoneInfoNotFoundError as exc:\n        raise TimezoneResolutionError(f"unknown forecast location timezone_id: {zone_name}") from exc\n    calendar_basis = (\n        "forecast_location_timeline_timezone"\n        if source == "forecast_location_timeline"\n        else "forecast_location_timezone"\n    )\n    provenance = {\n        "source": source,\n        "timezone_id": zone_name,\n        "coordinates_available": True,\n        "place_id_present": bool(raw.get("place_id")),\n        "calendar_timezone_basis": calendar_basis,\n        "angles_policy": (\n            "timeline_location_when_birth_time_exact"\n            if source == "forecast_location_timeline"\n            else "forecast_location_when_birth_time_exact"\n        ),\n    }\n    if timeline_index is not None:\n        provenance["timeline_index"] = timeline_index\n    return {\n        "latitude": lat,\n        "longitude": lon,\n        "tzinfo": zone,\n        "angles_available": True,\n        "source": source,\n        "calendar_timezone_basis": calendar_basis,\n        "provenance": provenance,\n    }\n\n\ndef _unavailable_return_location(birth_resolution) -> dict[str, Any]:\n    return {\n        "latitude": None,\n        "longitude": None,\n        "tzinfo": birth_resolution.tzinfo,\n        "angles_available": False,\n        "source": "unavailable",\n        "calendar_timezone_basis": "birth_timezone_fallback",\n        "provenance": {\n            "source": "unavailable",\n            "timezone_id": getattr(birth_resolution.tzinfo, "key", None),\n            "coordinates_available": False,\n            "place_id_present": False,\n            "calendar_timezone_basis": "birth_timezone_fallback",\n            "angles_policy": "omitted_without_forecast_location",\n        },\n    }\n\n\ndef _resolve_return_location(\n    profile: dict[str, Any], birth_resolution, *, instant: datetime | str | None = None,\n    timeline: list[dict[str, Any]] | None = None,\n) -> dict[str, Any]:\n    """Resolve event-specific return geometry with half-open timeline intervals.\n\n    Priority is timeline match -> static forecast_location -> no-angle birth-timezone\n    calendar fallback.  Birthplace coordinates are never used as a location proxy.\n    """\n    normalized = _normalize_forecast_timeline(profile) if timeline is None else timeline\n    if instant is not None and normalized:\n        target = _coerce_utc(instant, "return instant")\n        for entry in normalized:\n            if entry["start_utc"] <= target < entry["end_utc"]:\n                return _build_return_location(\n                    entry, birth_resolution, source="forecast_location_timeline",\n                    timeline_index=int(entry["timeline_index"]),\n                )\n    raw = profile.get("forecast_location")\n    if raw is not None:\n        return _build_return_location(raw, birth_resolution, source="forecast_location")\n    return _unavailable_return_location(birth_resolution)\n\n\ndef _return_location_policy_provenance(\n    profile: dict[str, Any], birth_resolution, timeline: list[dict[str, Any]]\n) -> dict[str, Any]:\n    if not timeline:\n        return _resolve_return_location(profile, birth_resolution, timeline=[])["provenance"]\n    return {\n        "source": "forecast_location_timeline",\n        "timeline_interval_count": len(timeline),\n        "static_fallback_available": profile.get("forecast_location") is not None,\n        "coordinates_available": "event_dependent",\n        "place_id_present": any(bool(entry.get("place_id")) for entry in timeline),\n        "calendar_timezone_basis": "timeline_match_then_static_forecast_location_then_birth_timezone",\n        "angles_policy": "event_specific_timeline_then_static_fallback_when_birth_time_exact; omitted otherwise",\n    }\n\n\n'''
replace_between(
    rr,
    "def _resolve_return_location(profile: dict[str, Any], birth_resolution) -> dict[str, Any]:\n",
    "def _attach_return_geometry(\n",
    resolver,
    "return location resolver",
)

replace_once(
    rr,
    '''    event["location_basis"] = (\n        "forecast_location"\n        if return_location["source"] == "forecast_location"\n        else "unavailable; forecast_location_not_supplied"\n    )\n''',
    '''    event["location_basis"] = (\n        return_location["source"]\n        if return_location["source"] in {"forecast_location", "forecast_location_timeline"}\n        else "unavailable; forecast_location_not_supplied"\n    )\n''',
    "event location basis",
)
replace_once(
    rr,
    '''    return_location = _resolve_return_location(profile, birth_resolution)\n    local_tz = return_location["tzinfo"]\n    solar_birth_utc = _birth_utc(profile, noon_proxy=True)\n''',
    '''    timeline = _normalize_forecast_timeline(profile)\n\n    def event_location(instant: datetime | str) -> dict[str, Any]:\n        return _resolve_return_location(\n            profile, birth_resolution, instant=instant, timeline=timeline\n        )\n\n    solar_birth_utc = _birth_utc(profile, noon_proxy=True)\n''',
    "person timeline setup",
)
replace_once(
    rr,
    '"local_date": _local_iso_date(return_dt, local_tz),',
    '"local_date": _local_iso_date(return_dt, event_location(return_dt)["tzinfo"]),',
    "solar event local date",
)
replace_once(
    rr,
    '"local_date": _local_iso_date(return_dt, local_tz),',
    '"local_date": _local_iso_date(return_dt, event_location(return_dt)["tzinfo"]),',
    "lunar event local date",
)
replace_once(
    rr,
    '"local_date": _local_iso_date(instant, local_tz), "orb": item["orb"],',
    '"local_date": _local_iso_date(instant, event_location(instant)["tzinfo"]), "orb": item["orb"],',
    "planetary event local date",
)
replace_once(
    rr,
    '''    for event in solar_events + lunar_events + [e for v in planetary.values() for e in v["events"]]:\n        _attach_return_geometry(event, profile, reliability, return_location)\n''',
    '''    for event in solar_events + lunar_events + [e for v in planetary.values() for e in v["events"]]:\n        _attach_return_geometry(\n            event, profile, reliability, event_location(event["exact_utc"])\n        )\n''',
    "event geometry location",
)
replace_once(
    rr,
    '''        "return_location_provenance": return_location["provenance"],\n''',
    '''        "return_location_provenance": _return_location_policy_provenance(\n            profile, birth_resolution, timeline\n        ),\n''',
    "top-level location provenance",
)

replace_once(
    ci,
    "      - 'tests/test_return_relocation_v26.py'\n",
    "      - 'tests/test_return_relocation_v26.py'\n      - 'tests/test_return_relocation_v27.py'\n",
    "ci v27 path",
)
replace_once(
    ci,
    "            tests/test_return_relocation_v26.py \\\n",
    "            tests/test_return_relocation_v26.py \\\n            tests/test_return_relocation_v27.py \\\n",
    "ci v27 test",
)

if test.exists():
    raise RuntimeError("v2.7 test file already exists")
test.write_text('''from __future__ import annotations\n\nfrom datetime import date, datetime, time, timezone\n\nimport pytest\nfrom pydantic import ValidationError\n\nfrom api.main import RelationshipProfile\nimport relationship_return_v1 as rr\nfrom timezone_provenance_v1 import resolve_profile_birth_datetime\n\n\ndef _profile(**overrides):\n    profile = {\n        "birth_date": date(1991, 3, 21),\n        "birth_time": time(7, 26),\n        "time_known": True,\n        "time_source": "official_record",\n        "time_confidence": "exact",\n        "latitude": 37.5665,\n        "longitude": 126.978,\n        "utc_offset_hours": 9.0,\n        "timezone_id": "Asia/Seoul",\n    }\n    profile.update(overrides)\n    return profile\n\n\ndef _interval(start, end, zone="America/New_York", lat=40.7128, lon=-74.006):\n    return {\n        "start_utc": start,\n        "end_utc": end,\n        "latitude": lat,\n        "longitude": lon,\n        "timezone_id": zone,\n    }\n\n\ndef test_api_timeline_is_additive_normalized_and_preserved():\n    model = RelationshipProfile(\n        **_profile(),\n        forecast_location_timeline=[_interval(\n            "2026-09-20T09:00:00+09:00",\n            "2026-09-21T09:00:00+09:00",\n        )],\n    )\n    payload = model.engine_payload()\n    row = payload["forecast_location_timeline"][0]\n    assert row["start_utc"] == datetime(2026, 9, 20, 0, 0, tzinfo=timezone.utc)\n    assert row["end_utc"] == datetime(2026, 9, 21, 0, 0, tzinfo=timezone.utc)\n\n\ndef test_api_timeline_rejects_naive_and_reversed_intervals():\n    with pytest.raises(ValidationError):\n        RelationshipProfile(\n            **_profile(),\n            forecast_location_timeline=[_interval(\n                datetime(2026, 9, 20, 0, 0),\n                datetime(2026, 9, 21, 0, 0, tzinfo=timezone.utc),\n            )],\n        )\n    with pytest.raises(ValidationError):\n        RelationshipProfile(\n            **_profile(),\n            forecast_location_timeline=[_interval(\n                "2026-09-21T00:00:00+00:00",\n                "2026-09-20T00:00:00+00:00",\n            )],\n        )\n\n\ndef test_api_timeline_rejects_overlap_but_allows_adjacent():\n    with pytest.raises(ValidationError):\n        RelationshipProfile(\n            **_profile(),\n            forecast_location_timeline=[\n                _interval("2026-09-20T00:00:00+00:00", "2026-09-22T00:00:00+00:00"),\n                _interval("2026-09-21T00:00:00+00:00", "2026-09-23T00:00:00+00:00"),\n            ],\n        )\n    model = RelationshipProfile(\n        **_profile(),\n        forecast_location_timeline=[\n            _interval("2026-09-20T00:00:00+00:00", "2026-09-21T00:00:00+00:00"),\n            _interval(\n                "2026-09-21T00:00:00+00:00", "2026-09-22T00:00:00+00:00",\n                zone="Asia/Tokyo", lat=35.6762, lon=139.6503,\n            ),\n        ],\n    )\n    assert len(model.forecast_location_timeline) == 2\n\n\ndef test_timeline_match_overrides_static_and_end_is_half_open():\n    profile = _profile(\n        forecast_location={\n            "latitude": 51.5074, "longitude": -0.1278, "timezone_id": "Europe/London"\n        },\n        forecast_location_timeline=[_interval(\n            "2026-09-20T00:00:00+00:00", "2026-09-21T00:00:00+00:00"\n        )],\n    )\n    birth = resolve_profile_birth_datetime(profile)\n    timeline = rr._normalize_forecast_timeline(profile)\n    inside = rr._resolve_return_location(\n        profile, birth, instant="2026-09-20T12:00:00+00:00", timeline=timeline\n    )\n    at_end = rr._resolve_return_location(\n        profile, birth, instant="2026-09-21T00:00:00+00:00", timeline=timeline\n    )\n    assert inside["source"] == "forecast_location_timeline"\n    assert inside["provenance"]["timeline_index"] == 0\n    assert inside["provenance"]["timezone_id"] == "America/New_York"\n    assert at_end["source"] == "forecast_location"\n    assert at_end["provenance"]["timezone_id"] == "Europe/London"\n\n\ndef test_outside_timeline_without_static_omits_angles_and_houses():\n    profile = _profile(\n        forecast_location_timeline=[_interval(\n            "2026-09-20T00:00:00+00:00", "2026-09-21T00:00:00+00:00"\n        )]\n    )\n    birth = resolve_profile_birth_datetime(profile)\n    timeline = rr._normalize_forecast_timeline(profile)\n    location = rr._resolve_return_location(\n        profile, birth, instant="2026-09-22T00:00:00+00:00", timeline=timeline\n    )\n    event = {"exact_utc": "2026-09-22T00:00:00+00:00"}\n    rr._attach_return_geometry(event, profile, {"time_exact": True}, location)\n    assert location["source"] == "unavailable"\n    assert event["angles"] == {}\n    assert event["house_activations"] == []\n\n\ndef test_timeline_timezone_controls_event_calendar_date():\n    profile = _profile(\n        forecast_location_timeline=[_interval(\n            "2026-01-01T00:00:00+00:00", "2026-01-02T00:00:00+00:00"\n        )]\n    )\n    birth = resolve_profile_birth_datetime(profile)\n    timeline = rr._normalize_forecast_timeline(profile)\n    instant = datetime(2026, 1, 1, 2, 0, tzinfo=timezone.utc)\n    location = rr._resolve_return_location(profile, birth, instant=instant, timeline=timeline)\n    assert rr._local_iso_date(instant, location["tzinfo"]) == "2025-12-31"\n\n\ndef test_timeline_location_changes_geometry_not_planetary_positions_and_hides_coordinates():\n    profile = _profile(\n        forecast_location_timeline=[\n            _interval(\n                "2026-09-20T00:00:00+00:00", "2026-09-21T00:00:00+00:00",\n                zone="America/New_York", lat=40.7128, lon=-74.006,\n            ),\n            _interval(\n                "2026-09-21T00:00:00+00:00", "2026-09-22T00:00:00+00:00",\n                zone="Asia/Tokyo", lat=35.6762, lon=139.6503,\n            ),\n        ]\n    )\n    birth = resolve_profile_birth_datetime(profile)\n    timeline = rr._normalize_forecast_timeline(profile)\n    a = {"exact_utc": "2026-09-20T12:00:00+00:00"}\n    b = {"exact_utc": "2026-09-21T12:00:00+00:00"}\n    loc_a = rr._resolve_return_location(profile, birth, instant=a["exact_utc"], timeline=timeline)\n    loc_b = rr._resolve_return_location(profile, birth, instant=b["exact_utc"], timeline=timeline)\n    rr._attach_return_geometry(a, profile, {"time_exact": True}, loc_a)\n    rr._attach_return_geometry(b, profile, {"time_exact": True}, loc_b)\n    assert a["positions"] != {} and b["positions"] != {}\n    assert a["angles"]["ASC"] != b["angles"]["ASC"]\n    for event in (a, b):\n        provenance = event["return_location_provenance"]\n        assert provenance["source"] == "forecast_location_timeline"\n        assert "latitude" not in provenance and "longitude" not in provenance\n\n\ndef test_top_level_timeline_provenance_is_policy_only():\n    profile = _profile(\n        forecast_location_timeline=[_interval(\n            "2026-09-20T00:00:00+00:00", "2026-09-21T00:00:00+00:00"\n        )]\n    )\n    birth = resolve_profile_birth_datetime(profile)\n    timeline = rr._normalize_forecast_timeline(profile)\n    provenance = rr._return_location_policy_provenance(profile, birth, timeline)\n    assert provenance["source"] == "forecast_location_timeline"\n    assert provenance["timeline_interval_count"] == 1\n    assert "latitude" not in provenance and "longitude" not in provenance\n''')

print("v2.7 relocation timeline patch applied")
