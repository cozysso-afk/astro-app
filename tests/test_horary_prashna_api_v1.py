from __future__ import annotations

from fastapi.testclient import TestClient

import api.main as api_main


client = TestClient(api_main.app)


def base_payload() -> dict:
    return {
        "question": "차 키가 집 안, 차 안, 평소 들고 다니는 가방 중 어디에 있을 가능성이 가장 강할까?",
        "question_time_local": "2026-10-06T16:30:00",
        "utc_offset_hours": 9,
        "timezone_id": "Asia/Seoul",
    }


def test_classifier_api_normalizes_time_and_preserves_location_contract():
    payload = {
        **base_payload(),
        "latitude": 34.7604,
        "longitude": 127.6622,
        "location_source": "browser_geolocation",
        "accuracy_meters": 18.5,
    }
    response = client.post("/v1/horary-prashna/classify", json=payload)
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["ok"] is True
    assert result["primary_type"] == "LOST_ITEM"
    assert result["context"] == {
        "question_time_local": "2026-10-06T16:30:00",
        "question_time_utc": "2026-10-06T07:30:00+00:00",
        "latitude": 34.7604,
        "longitude": 127.6622,
        "utc_offset_hours": 9.0,
        "timezone_id": "Asia/Seoul",
        "gender": None,
        "location_source": "browser_geolocation",
        "accuracy_meters": 18.5,
        "location_ready": True,
    }
    assert result["next_stage"] == "classification_only_no_chart_judgement"
    assert result["policy_preview"]["western"]
    assert result["policy_preview"]["prashna"]


def test_classifier_api_allows_manual_coordinates_and_no_location():
    manual = {
        **base_payload(),
        "latitude": 37.5665,
        "longitude": 126.978,
        "location_source": "manual",
    }
    response = client.post("/v1/horary-prashna/classify", json=manual)
    assert response.status_code == 200, response.text
    assert response.json()["context"]["location_source"] == "manual"
    assert response.json()["context"]["location_ready"] is True

    response = client.post("/v1/horary-prashna/classify", json=base_payload())
    assert response.status_code == 200, response.text
    assert response.json()["context"]["location_ready"] is False


def test_classifier_api_returns_clarification_and_policy_risk():
    vague = {**base_payload(), "question": "이거 잘 될까?"}
    response = client.post("/v1/horary-prashna/classify", json=vague)
    assert response.status_code == 200, response.text
    assert response.json()["needs_clarification"] is True

    health = {**base_payload(), "question": "요즘 피로가 회복되는 시기는 언제일까?"}
    response = client.post("/v1/horary-prashna/classify", json=health)
    assert response.status_code == 200, response.text
    assert response.json()["risk_profile"] == "medical_non_diagnostic"


def test_classifier_api_rejects_invalid_request_contracts():
    cases = []

    missing_time = base_payload()
    missing_time.pop("question_time_local")
    cases.append(missing_time)

    partial_coordinates = {**base_payload(), "latitude": 37.5, "location_source": "manual"}
    cases.append(partial_coordinates)

    hidden_source = {**base_payload(), "latitude": 37.5, "longitude": 127.0}
    cases.append(hidden_source)

    fake_browser_source = {**base_payload(), "location_source": "browser_geolocation"}
    cases.append(fake_browser_source)

    manual_accuracy = {
        **base_payload(),
        "latitude": 37.5,
        "longitude": 127.0,
        "location_source": "manual",
        "accuracy_meters": 10,
    }
    cases.append(manual_accuracy)

    for payload in cases:
        response = client.post("/v1/horary-prashna/classify", json=payload)
        assert response.status_code == 422, response.text
