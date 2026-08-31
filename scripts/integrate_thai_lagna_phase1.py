from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"[{label}] expected 1 match, got {count}")
    return text.replace(old, new, 1)


thai_path = Path("thai_astrology_v2.py")
int_path = Path("integrated_fortune_v1.py")
thai = thai_path.read_text(encoding="utf-8")
integ = int_path.read_text(encoding="utf-8")

thai = replace_once(
    thai,
    "from thai_suriyayat_v1 import ENGINE_VERSION as SURIYAYAT_ENGINE_VERSION, SOURCE_COMMIT as SURIYAYAT_SOURCE_COMMIT, calculate_positions_for_instant\n",
    "from thai_suriyayat_v1 import ENGINE_VERSION as SURIYAYAT_ENGINE_VERSION, SOURCE_COMMIT as SURIYAYAT_SOURCE_COMMIT, calculate_positions_for_instant\nfrom thai_lagna_v1 import ENGINE_VERSION as LAGNA_RESEARCH_ENGINE_VERSION, build_suriyayat_lagna_research\n",
    "lagna import",
)
thai = replace_once(
    thai,
    'ENGINE_VERSION = "thai-mahathaksa-taksajorn-suriyayat-v2.1"',
    'ENGINE_VERSION = "thai-mahathaksa-taksajorn-suriyayat-v2.2-lagna-research"',
    "thai engine version",
)

thai = replace_once(
    thai,
    """def _suriyayat_layer(
    birth_date: date,
    birth_time: dt_time,
    start_date: date,
    end_date: date,
    utc_offset_hours: float,
) -> dict[str, Any]:
""",
    """def _suriyayat_layer(
    birth_date: date,
    birth_time: dt_time,
    start_date: date,
    end_date: date,
    utc_offset_hours: float,
    latitude: float | None,
    longitude: float | None,
) -> dict[str, Any]:
""",
    "suriyayat signature",
)

thai = replace_once(
    thai,
    """    end_snapshot = start_snapshot if end_date == start_date else calculate_positions_for_instant(end_instant)
    return {
""",
    """    end_snapshot = start_snapshot if end_date == start_date else calculate_positions_for_instant(end_instant)
    lagna_research = build_suriyayat_lagna_research(
        birth_date=birth_date,
        birth_time=birth_time,
        latitude=latitude,
        longitude=longitude,
        utc_offset_hours=utc_offset_hours,
    )
    return {
""",
    "lagna research calculation",
)

thai = replace_once(
    thai,
    """        "lagna": {
            "available": False,
            "reason": "Global-coordinate Suriyayat Lagna is not independently validated; Thailand province-offset lookup is not reused for Korean/world birthplaces.",
        },
        "interpretation_status": "planetary_position_facts_only",
""",
    """        "lagna": {
            "available": False,
            "reason": "Global-coordinate Suriyayat Lagna is still research-only. Candidate methods are exposed separately and are not used for houses, dignity, scoring, or Gemini interpretation.",
        },
        "lagna_research": lagna_research,
        "interpretation_status": "planetary_position_facts_plus_noninterpreted_lagna_research",
""",
    "lagna output separation",
)

thai = replace_once(
    thai,
    """def build_thai_fortune(
    birth_date: date,
    birth_time: dt_time,
    start_date: date,
    end_date: date,
    utc_offset_hours: float = 9.0,
) -> dict[str, Any]:
""",
    """def build_thai_fortune(
    birth_date: date,
    birth_time: dt_time,
    start_date: date,
    end_date: date,
    utc_offset_hours: float = 9.0,
    latitude: float | None = None,
    longitude: float | None = None,
) -> dict[str, Any]:
""",
    "thai fortune signature",
)

thai = replace_once(
    thai,
    "    suriyayat = _suriyayat_layer(birth_date, birth_time, start_date, end_date, utc_offset_hours)\n",
    "    suriyayat = _suriyayat_layer(birth_date, birth_time, start_date, end_date, utc_offset_hours, latitude, longitude)\n",
    "suriyayat coords",
)

thai = replace_once(
    thai,
    '            "suriyayat_lagna": "not_implemented",\n',
    '            "suriyayat_lagna": "research_only_not_promoted",\n            "suriyayat_lagna_research_engine": LAGNA_RESEARCH_ENGINE_VERSION,\n',
    "lagna reliability",
)

thai = replace_once(
    thai,
    '            "global-coordinate Suriyayat Lagna",\n',
    '            "validated/promoted global-coordinate Suriyayat Lagna",\n',
    "not calculated lagna wording",
)

integ = replace_once(
    integ,
    'ENGINE_VERSION = "integrated-fortune-v2.9-suriyayat-position-layer"',
    'ENGINE_VERSION = "integrated-fortune-v2.10-thai-lagna-research"',
    "integrated engine version",
)

integ = replace_once(
    integ,
    """def _thai_payload(birth_date: date, birth_time: dt_time, start_date: date, end_date: date, utc_offset_hours: float):
    return build_thai_fortune(birth_date, birth_time, start_date, end_date, utc_offset_hours=utc_offset_hours)
""",
    """def _thai_payload(
    birth_date: date,
    birth_time: dt_time,
    start_date: date,
    end_date: date,
    latitude: float,
    longitude: float,
    utc_offset_hours: float,
):
    return build_thai_fortune(
        birth_date,
        birth_time,
        start_date,
        end_date,
        utc_offset_hours=utc_offset_hours,
        latitude=latitude,
        longitude=longitude,
    )
""",
    "integrated thai payload",
)

integ = replace_once(
    integ,
    "    thai = _thai_payload(birth_date, birth_time, start_date, end_date, utc_offset_hours)\n",
    "    thai = _thai_payload(birth_date, birth_time, start_date, end_date, latitude, longitude, utc_offset_hours)\n",
    "integrated thai coords",
)

required_thai = [
    "lagna_research = build_suriyayat_lagna_research(",
    '"lagna_research": lagna_research',
    '"available": False',
    '"research_only_not_promoted"',
]
for token in required_thai:
    if token not in thai:
        raise SystemExit(f"missing Thai token: {token}")
required_integrated = [
    "integrated-fortune-v2.10-thai-lagna-research",
    "latitude=latitude",
    "longitude=longitude",
]
for token in required_integrated:
    if token not in integ:
        raise SystemExit(f"missing integrated token: {token}")

thai_path.write_text(thai, encoding="utf-8")
int_path.write_text(integ, encoding="utf-8")
