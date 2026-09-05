from __future__ import annotations

from fastapi.testclient import TestClient

import api.main as api_main


client = TestClient(api_main.app)


def profile_payload():
    return {
        "name": "U",
        "birth_date": "1990-01-15",
        "birth_time": "10:20:00",
        "time_known": True,
        "time_source": "official_record",
        "time_confidence": "exact",
        "latitude": 37.5,
        "longitude": 127.0,
        "utc_offset_hours": 9,
    }


def request_payload():
    return {
        "profile": profile_payload(),
        "start_date": "2026-09-01",
        "end_date": "2026-09-07",
    }


def test_personal_routes_force_distinct_single_person_modes(monkeypatch):
    captured = []

    def fake_engine(profile, *, start_date, end_date, mode):
        captured.append(mode)
        return {
            "ok": True,
            "engine": "personal-love-stub",
            "analysis_mode": mode,
            "source_scope": "single_person_only",
            "counterpart_used": False,
        }

    monkeypatch.setattr(api_main, "build_personal_love_forecast", fake_engine)

    response = client.post("/v1/love/personal", json=request_payload())
    assert response.status_code == 200, response.text
    assert response.json()["analysis_mode"] == "personal_love_forecast"
    assert response.json()["interpretation_policy"]["counterpart_data_allowed"] is False
    assert captured[-1] == "personal_love_forecast"

    response = client.post("/v1/love/new-relationship", json=request_payload())
    assert response.status_code == 200, response.text
    assert response.json()["analysis_mode"] == "new_relationship"
    assert response.json()["interpretation_policy"]["reunion_inference_allowed"] is False
    assert captured[-1] == "new_relationship"


def test_personal_routes_reject_counterpart_payload():
    payload = request_payload()
    payload["counterpart"] = {"present": True}
    response = client.post("/v1/love/new-relationship", json=payload)
    assert response.status_code == 422


def test_relationship_route_rejects_personal_love_mode():
    payload = {
        "user": profile_payload(),
        "counterpart": profile_payload(),
        "start_date": "2026-09-01",
        "end_date": "2026-09-07",
        "relationship_status": "single",
        "analysis_mode": "new_relationship",
    }
    response = client.post("/v1/relationship/western", json=payload)
    assert response.status_code == 422


def test_personal_route_policy_explicitly_disallows_reunion(monkeypatch):
    monkeypatch.setattr(
        api_main,
        "build_personal_love_forecast",
        lambda profile, *, start_date, end_date, mode: {
            "ok": True,
            "engine": "personal-love-stub",
            "analysis_mode": mode,
            "source_scope": "single_person_only",
            "counterpart_used": False,
        },
    )
    response = client.post("/v1/love/personal", json=request_payload())
    assert response.status_code == 200
    policy = response.json()["interpretation_policy"]
    assert policy["counterpart_required"] is False
    assert policy["counterpart_data_allowed"] is False
    assert policy["reunion_inference_allowed"] is False
    assert policy["event_probability"] == "not_calculated"
