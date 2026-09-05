from pydantic import ValidationError

from api.horary_prashna_v1 import HoraryPrashnaClassifyRequest, classify_horary_prashna_question


def test_classify_api_returns_router_policy_and_browser_location_context():
    request = HoraryPrashnaClassifyRequest(
        question="차 키가 집 안, 차 안, 평소 들고 다니는 가방 중 어디에 있을 가능성이 가장 강할까?",
        question_time_local="2026-09-05T16:30:00",
        latitude=34.7604,
        longitude=127.6622,
        utc_offset_hours=9,
        gender="female",
        location_source="browser_geolocation",
        accuracy_meters=18.5,
    )
    result = classify_horary_prashna_question(request)
    assert result["ok"] is True
    assert result["primary_type"] == "LOST_ITEM"
    assert result["policy_id"] == "H_LOST_ITEM"
    assert result["context"]["location_ready"] is True
    assert result["context"]["location_source"] == "browser_geolocation"
    assert result["context"]["question_time_local"] == "2026-09-05T16:30:00"
    assert result["context"]["question_time_utc"] == "2026-09-05T07:30:00+00:00"
    assert result["policy_preview"]["western"]
    assert result["policy_preview"]["prashna"]
    assert result["next_stage"] == "classification_only_no_chart_judgement"


def test_classify_api_allows_question_without_location_but_marks_not_ready():
    result = classify_horary_prashna_question(
        HoraryPrashnaClassifyRequest(question="이번 시험에 합격할 수 있을까?")
    )
    assert result["primary_type"] == "EXAM_EDUCATION"
    assert result["context"]["location_ready"] is False
    assert result["context"]["question_time_utc"] is None


def test_classify_api_rejects_partial_or_fake_location_source_contract():
    try:
        HoraryPrashnaClassifyRequest(question="지갑 어디 있어?", latitude=34.7)
    except ValidationError:
        pass
    else:
        raise AssertionError("partial coordinates must be rejected")

    try:
        HoraryPrashnaClassifyRequest(question="지갑 어디 있어?", location_source="browser_geolocation")
    except ValidationError:
        pass
    else:
        raise AssertionError("browser location source without coordinates must be rejected")
