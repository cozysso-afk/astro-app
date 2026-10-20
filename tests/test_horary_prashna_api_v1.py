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


def test_chart_analysis_uses_actual_time_location_and_two_distinct_systems():
    payload = {
        **base_payload(),
        "question": "오늘 약속한 사람과의 만남이 예정대로 성사될까? 지연될까?",
        "latitude": 37.5665, "longitude": 126.9780,
        "location_source": "manual",
    }
    res = client.post("/v1/horary-prashna/analyze", json=payload)
    assert res.status_code == 200, res.text
    result = res.json()
    assert result["ok"] is True
    assert result["next_stage"] == "chart_evidence_v1_interpretation_limited"
    report = result["analysis"]
    assert report["julian_day_ut"] > 2400000
    assert report["western"]["house_system"] in ("Placidus", "Porphyry")
    assert report["western"]["querent_lord"] in {
        "Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"
    }
    assert report["western"]["moon"]
    assert report["prashna"]["ayanamsa"] == "Lahiri"
    assert report["prashna"]["lagna"]
    assert report["prashna"]["moon_bhava"] in range(1,13)
    assert report["synthesis"]["limitations"]
    assert "확정" in report["synthesis"]["conclusion"] or "부족" in report["synthesis"]["conclusion"]


def test_chart_analysis_rejects_missing_location_and_clarification_without_guessing():
    missing = client.post("/v1/horary-prashna/analyze",json={
        **base_payload(), "question":"이 만남이 예정대로 이루어질까?"
    })
    assert missing.status_code == 422
    assert "위도" in missing.json()["detail"]
    vague = client.post("/v1/horary-prashna/analyze",json={
        **base_payload(), "question":"이거 잘 될까?",
        "latitude":34.7,"longitude":127.7,"location_source":"manual"
    })
    assert vague.status_code == 422
    assert "모호" in vague.json()["detail"]


def test_chart_analysis_changes_with_question_time_and_keeps_classifier_unchanged():
    payload={
        **base_payload(),
        "question":"오늘 만나기로 한 사람과의 약속은 성사될까?",
        "latitude":37.5665,"longitude":126.9780,"location_source":"manual"
    }
    a=client.post("/v1/horary-prashna/analyze",json=payload)
    b=client.post("/v1/horary-prashna/analyze",json={
        **payload,"question_time_local":"2026-10-07T04:30:00"
    })
    assert a.status_code == 200,a.text
    assert b.status_code == 200,b.text
    aa=a.json()["analysis"];bb=b.json()["analysis"]
    assert aa["western"]["ascendant"] != bb["western"]["ascendant"] or aa["western"]["moon"] != bb["western"]["moon"]
    assert aa["prashna"]["lagna"] != bb["prashna"]["lagna"] or aa["prashna"]["moon"] != bb["prashna"]["moon"]
    still=client.post("/v1/horary-prashna/classify",json=payload)
    assert still.status_code == 200
    assert "analysis" not in still.json()

def test_chart_aspects_distinguish_applying_ease_and_applying_tension():
    from horary_prashna_chart_v1 import _aspects
    a={"id":"Moon","longitude":0.0,"speed":1.0}
    good={"id":"Venus","longitude":125.0,"speed":0.0}
    caution={"id":"Saturn","longitude":95.0,"speed":0.0}
    moving_away={"id":"Moon","longitude":0.0,"speed":-1.0}
    easing=_aspects(a,good,"달-금성")
    tension=_aspects(a,caution,"달-토성")
    separating=_aspects(moving_away,good,"달-금성")
    assert easing[0]["applying"] is True
    assert easing[0]["quality"] == "완화"
    assert tension[0]["applying"] is True
    assert tension[0]["quality"] == "긴장"
    assert separating[0]["applying"] is False
