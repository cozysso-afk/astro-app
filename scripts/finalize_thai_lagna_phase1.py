from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"[{label}] expected 1 match, got {count}")
    return text.replace(old, new, 1)


lagna_path = Path("thai_lagna_v1.py")
thai_path = Path("thai_astrology_v2.py")
lagna = lagna_path.read_text(encoding="utf-8")
thai = thai_path.read_text(encoding="utf-8")

lagna = replace_once(
    lagna,
    'ENGINE_VERSION = "thai-suriyayat-lagna-research-v1.0"\n',
    '''ENGINE_VERSION = "thai-suriyayat-lagna-research-v1.1-bangkok-7vector"\n\nVALIDATION = {\n    "status": "bangkok_era_spanning_validated_global_pending",\n    "reference": "MyHora Bangkok Suriyayat Lagna",\n    "vectors": 7,\n    "year_span": "1777-2026",\n    "coordinates": {"latitude": 13.752555, "longitude": 100.494066, "utc_offset_hours": 7.0},\n    "common_0600": {"max_error_arcmin": 15.75, "mean_error_arcmin": 5.791},\n    "common_lmt": {"max_error_arcmin": 15.695, "mean_error_arcmin": 6.03},\n    "astronomical_crosscheck": {"max_error_arcmin": 33.957, "mean_error_arcmin": 16.219},\n    "global_coordinates_compute_supported": True,\n    "global_coordinates_independently_validated": False,\n    "note": "Bangkok references span 249 years. Korea/world coordinates compute without Thailand province tables, but an independent non-Thailand reference corpus is still required before promotion.",\n}\n''',
    "validation metadata",
)

lagna = replace_once(
    lagna,
    '        "selected_traditional_candidate": "common_anto_0600_lmt",\n',
    '        "selected_traditional_candidate": "common_anto_0600_lmt",\n        "validation": VALIDATION,\n',
    "validation output",
)

lagna = replace_once(
    lagna,
    '''            "required": [\n                "independent reference corpus across multiple dates",\n                "multiple latitudes/longitudes/timezones",\n                "sign-boundary stress cases",\n                "documented selected Thai Lagna school",\n            ],''',
    '''            "completed": [\n                "era-spanning independent MyHora Bangkok corpus (7 vectors, 1777-2026)",\n                "documented common Antoanatee 06:00 + LMT method",\n                "world-coordinate computation without Thailand province lookup",\n            ],\n            "required": [\n                "independent non-Thailand reference corpus across multiple latitudes/longitudes/timezones",\n                "sign-boundary stress cases against independent references",\n            ],''',
    "promotion gate",
)

thai = replace_once(
    thai,
    '''Not implemented here:\n- Global-coordinate Suriyayat Lagna, houses/dignities/aspect judgement, exact\n  ingress scanner, or event-probability conversion.\n''',
    '''Not promoted here:\n- Global-coordinate Suriyayat Lagna is available only as a non-interpreted\n  research candidate. Houses/dignities/aspect judgement, exact ingress scanner,\n  and event-probability conversion remain disabled.\n''',
    "Thai module docstring",
)

for token in [
    '"vectors": 7',
    '"year_span": "1777-2026"',
    '"global_coordinates_independently_validated": False',
    '"validation": VALIDATION',
    'independent non-Thailand reference corpus',
]:
    if token not in lagna:
        raise SystemExit(f"missing final Lagna token: {token}")
if "research candidate" not in thai or "Houses/dignities/aspect judgement" not in thai:
    raise SystemExit("Thai docstring finalization missing")

lagna_path.write_text(lagna, encoding="utf-8")
thai_path.write_text(thai, encoding="utf-8")
