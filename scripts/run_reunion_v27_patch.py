from __future__ import annotations

from pathlib import Path

patcher = Path(__file__).with_name("apply_reunion_v27_patch.py")
source = patcher.read_text()
old = '''    count = text.count(old)\n    if count != 1:\n        raise RuntimeError(f"{label}: expected exactly one match, found {count}")\n    path.write_text(text.replace(old, new, 1))\n'''
new = '''    count = text.count(old)\n    expected = 2 if label == "solar event local date" else 1\n    if count != expected:\n        raise RuntimeError(f"{label}: expected exactly {expected} match(es), found {count}")\n    path.write_text(text.replace(old, new, 1))\n'''
if source.count(old) != 1:
    raise RuntimeError("replace_once adapter: guarded source shape changed")
source = source.replace(old, new, 1)
exec(compile(source, str(patcher), "exec"), {"__file__": str(patcher), "__name__": "__main__"})

# Post-patch hardening: keep provenance field types stable.
rr_path = patcher.parents[1] / "relationship_return_v1.py"
rr_text = rr_path.read_text()
old_provenance = '        "coordinates_available": "event_dependent",\n'
new_provenance = '        "coordinates_available": True,\n        "event_dependent": True,\n'
if rr_text.count(old_provenance) != 1:
    raise RuntimeError("timeline policy provenance shape changed")
rr_path.write_text(rr_text.replace(old_provenance, new_provenance, 1))

# Strengthen the location-invariance regression: same UTC instant, two locations.
test_path = patcher.parents[1] / "tests/test_return_relocation_v27.py"
test_text = test_path.read_text()
start = "def test_timeline_location_changes_geometry_not_planetary_positions_and_hides_coordinates():\n"
end = "def test_top_level_timeline_provenance_is_policy_only():\n"
if test_text.count(start) != 1 or test_text.count(end) != 1:
    raise RuntimeError("v2.7 location-invariance test boundaries changed")
i = test_text.index(start)
j = test_text.index(end, i)
replacement = '''def test_timeline_location_changes_geometry_not_planetary_positions_and_hides_coordinates():
    profile = _profile()
    birth = resolve_profile_birth_datetime(profile)
    instant = "2026-09-20T12:00:00+00:00"
    ny = rr._build_return_location(
        {"latitude": 40.7128, "longitude": -74.006, "timezone_id": "America/New_York"},
        birth, source="forecast_location_timeline", timeline_index=0,
    )
    tokyo = rr._build_return_location(
        {"latitude": 35.6762, "longitude": 139.6503, "timezone_id": "Asia/Tokyo"},
        birth, source="forecast_location_timeline", timeline_index=1,
    )
    a = {"exact_utc": instant}
    b = {"exact_utc": instant}
    rr._attach_return_geometry(a, profile, {"time_exact": True}, ny)
    rr._attach_return_geometry(b, profile, {"time_exact": True}, tokyo)
    assert a["positions"] == b["positions"]
    assert a["angles"]["ASC"] != b["angles"]["ASC"]
    for event in (a, b):
        provenance = event["return_location_provenance"]
        assert provenance["source"] == "forecast_location_timeline"
        assert "latitude" not in provenance and "longitude" not in provenance


'''
test_path.write_text(test_text[:i] + replacement + test_text[j:])
