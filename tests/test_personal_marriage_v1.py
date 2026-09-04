from datetime import date, time

from personal_marriage_v1 import build_personal_marriage


def test_personal_marriage_is_single_person_and_deterministic():
    result = build_personal_marriage(
        birth_date=date(1991, 3, 21),
        birth_time=time(7, 26),
        latitude=34.7604,
        longitude=127.6622,
        utc_offset_hours=9.0,
        start_date=date(2026, 9, 4),
        end_date=date(2026, 9, 30),
    )
    assert result["ok"] is True
    assert result["mode"] == "personal_unmarried"
    assert result["policy"]["counterpart_required"] is False
    assert result["policy"]["marriage_probability"] is False
    assert result["policy"]["spouse_identity_prediction"] is False
    assert set(result["relationship_houses"]) == {"4", "5", "7", "8"}
    assert result["relationship_houses"]["7"]["whole_ruler"]
    assert result["relationship_houses"]["7"]["placidus_ruler"]
    assert set(result["relationship_planets"]) == {"Moon", "Venus", "Mars", "Jupiter", "Saturn"}
    assert result["period"]["day_count"] == 27
    assert result["timing"]["top_days"]
    assert all("date" in row and "activation" in row for row in result["timing"]["top_days"])
    text = str(result)
    assert "marriage_probability': True" not in text
    assert "spouse_identity_prediction': True" not in text


def test_personal_marriage_never_accepts_more_than_one_year():
    try:
        build_personal_marriage(
            birth_date=date(1991, 3, 21), birth_time=time(7, 26), latitude=34.7604, longitude=127.6622,
            utc_offset_hours=9.0, start_date=date(2026, 1, 1), end_date=date(2027, 1, 2),
        )
    except ValueError as exc:
        assert "366 days" in str(exc)
    else:
        raise AssertionError("expected one-year range guard")
