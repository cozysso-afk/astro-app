from datetime import date, time

from pydantic import ValidationError

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
    assert result["policy"]["marriage_probability"] is True
    assert result["policy"]["spouse_archetype_prediction"] is True
    assert result["policy"]["specific_identity_claims"] is False
    assert set(result["relationship_houses"]) == {"4", "5", "7", "8"}
    assert result["relationship_houses"]["7"]["whole_ruler"]
    assert result["relationship_houses"]["7"]["placidus_ruler"]
    assert set(result["relationship_planets"]) == {"Moon", "Venus", "Mars", "Jupiter", "Saturn"}
    assert result["period"]["day_count"] == 27
    assert result["timing"]["top_days"]
    assert all("date" in row and "activation" in row for row in result["timing"]["top_days"])
    forecast = result["forecast"]
    assert 0 <= forecast["marriage_probability_percent"] <= 100
    assert forecast["label"] in {"매우 강함", "강함", "중간 이상", "보통", "낮음"}
    assert forecast["strong_windows"]
    assert "통계적" in forecast["probability_note"]
    spouse = result["spouse_archetype"]
    assert spouse["appearance_hints"]
    assert spouse["personality_hints"]
    assert spouse["career_clusters"]
    assert spouse["meeting_route"]
    assert spouse["identity_clues"]
    assert "실제 이름" in spouse["precision_note"]


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


# Temporary integration bridge for V16 validation against the current main gate.
def test_v16_personal_love_is_single_person_and_separate_from_reunion():
    from personal_love_forecast_v1 import build_personal_love_forecast

    profile = {
        "birth_date": date(1990, 1, 15),
        "birth_time": time(10, 20),
        "time_known": True,
        "time_source": "official_record",
        "time_confidence": "exact",
        "latitude": 37.5,
        "longitude": 127.0,
        "utc_offset_hours": 9.0,
    }
    result = build_personal_love_forecast(
        profile,
        start_date=date(2026, 9, 1),
        end_date=date(2026, 9, 2),
        mode="new_relationship",
    )
    assert result["source_scope"] == "single_person_only"
    assert result["counterpart_used"] is False
    assert result["relationship_engine_used"] is False
    assert result["static_structure"]["fifth_house"] is not None
    assert result["static_structure"]["seventh_house"] is not None
    assert result["static_structure"]["dsc"] is not None
    assert "overall_score" not in result["timing"]
    assert result["interpretation_policy"]["reunion_inference_allowed"] is False
    assert result["interpretation_policy"]["event_probability"] == "not_calculated"


def test_v16_personal_love_request_schema_rejects_counterpart():
    from api.main import PersonalLoveRequest

    payload = {
        "profile": {
            "birth_date": "1990-01-15",
            "birth_time": "10:20:00",
            "time_known": True,
            "time_source": "official_record",
            "time_confidence": "exact",
            "latitude": 37.5,
            "longitude": 127.0,
            "utc_offset_hours": 9,
        },
        "start_date": "2026-09-01",
        "end_date": "2026-09-02",
        "counterpart": {"present": True},
    }
    try:
        PersonalLoveRequest.model_validate(payload)
    except ValidationError:
        pass
    else:
        raise AssertionError("personal love request must reject counterpart data")
