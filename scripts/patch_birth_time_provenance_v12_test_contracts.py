from pathlib import Path


def once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if text.count(old) != 1:
        raise SystemExit(f"{path}: expected one match, got {text.count(old)}: {old[:100]!r}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")


once(
    "tests/test_saju_calculation_gold_v1.py",
    '''        "time_known": True,
        "longitude": 120.0,
''',
    '''        "time_known": True,
        "time_source": "official_record",
        "time_confidence": "exact",
        "longitude": 120.0,
''',
)

once(
    "tests/test_saju_natal_boundary_v5.py",
    '''            "time_known": True,
        }
''',
    '''            "time_known": True,
            "time_source": "official_record",
            "time_confidence": "exact",
        }
''',
)

text_path = Path("tests/test_saju_natal_boundary_v5.py")
text = text_path.read_text(encoding="utf-8")
old = 'assert before["precision"] == "legal_time_no_longitude"\n    assert after["precision"] == "legal_time_no_longitude"'
new = 'assert before["precision"] == "exact_clock_no_longitude"\n    assert after["precision"] == "exact_clock_no_longitude"'
if text.count(old) != 1:
    raise SystemExit("tests/test_saju_natal_boundary_v5.py: precision expectation anchor mismatch")
text_path.write_text(text.replace(old, new, 1), encoding="utf-8")

print("V12 Saju exact fixtures now declare official_record + exact")
