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


def relationship_payload(mode: str):
    return {
        "user": profile_payload(),
        "counterpart": profile_payload(),
        "start_date": "2026-09-01",
        "end_date": "2026-09-07",
        "relationship_status": "single",
        "analysis_mode": mode,
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
            "relationship_engine_used": False,
        }

    monkeypatch.setattr(api_main, "build_personal_love_forecast", fake_engine)

    response = client.post("/v1/love/personal", json=request_payload())
    assert response.status_code == 200, response.text
    assert response.json()["analysis_mode"] == "personal_love_forecast"
    assert response.json()["result"]["analysis_mode"] == "personal_love_forecast"
    assert response.json()["interpretation_policy"]["counterpart_data_allowed"] is False
    assert captured[-1] == "personal_love_forecast"

    response = client.post("/v1/love/new-relationship", json=request_payload())
    assert response.status_code == 200, response.text
    assert response.json()["analysis_mode"] == "new_relationship"
    assert response.json()["result"]["analysis_mode"] == "new_relationship"
    assert response.json()["interpretation_policy"]["reunion_inference_allowed"] is False
    assert captured[-1] == "new_relationship"


def test_personal_routes_real_engine_never_enters_ai_interpretation_path(monkeypatch):
    def fail_if_ai_called(*args, **kwargs):
        raise AssertionError("personal love calculation must not invoke AI interpretation")

    monkeypatch.setattr(api_main, "interpret_integrated_fortune", fail_if_ai_called)
    payload = request_payload()
    payload["end_date"] = payload["start_date"]

    for route in ("/v1/love/personal", "/v1/love/new-relationship"):
        response = client.post(route, json=payload)
        assert response.status_code == 200, (route, response.text)
        result = response.json()["result"]
        assert result["engine"] == api_main.PERSONAL_LOVE_ENGINE_VERSION
        assert result["source_scope"] == "single_person_only"
        assert result["counterpart_used"] is False
        assert result["relationship_engine_used"] is False


def test_personal_routes_reject_counterpart_payload():
    payload = request_payload()
    payload["counterpart"] = {"present": True}
    response = client.post("/v1/love/new-relationship", json=payload)
    assert response.status_code == 422


def test_personal_routes_reject_counterpart_inside_profile():
    payload = request_payload()
    payload["profile"]["counterpart"] = {"present": True}
    response = client.post("/v1/love/new-relationship", json=payload)
    assert response.status_code == 422


def test_personal_routes_reject_other_two_person_relationship_fields():
    for field, value in (
        ("relationship_status", "dating"),
        ("reunion", True),
        ("partner", {"present": True}),
    ):
        payload = request_payload()
        payload[field] = value
        response = client.post("/v1/love/personal", json=payload)
        assert response.status_code == 422, (field, response.text)

        nested = request_payload()
        nested["profile"][field] = value
        response = client.post("/v1/love/new-relationship", json=nested)
        assert response.status_code == 422, (field, response.text)


def test_personal_routes_reject_mode_and_relationship_shape_smuggling():
    for field, value in (
        ("analysis_mode", "reunion"),
        ("user", profile_payload()),
        ("known_person", {"name": "X"}),
        ("synastry", {"enabled": True}),
    ):
        payload = request_payload()
        payload[field] = value
        response = client.post("/v1/love/personal", json=payload)
        assert response.status_code == 422, (field, response.text)

        nested = request_payload()
        nested["profile"][field] = value
        response = client.post("/v1/love/new-relationship", json=nested)
        assert response.status_code == 422, (field, response.text)


def test_relationship_route_rejects_both_personal_love_modes():
    for mode in ("personal_love_forecast", "new_relationship"):
        response = client.post("/v1/relationship/western", json=relationship_payload(mode))
        assert response.status_code == 422, (mode, response.text)


def test_personal_period_validation_is_422_at_http_contract():
    reversed_range = request_payload()
    reversed_range["start_date"] = "2026-09-08"
    reversed_range["end_date"] = "2026-09-07"
    response = client.post("/v1/love/personal", json=reversed_range)
    assert response.status_code == 422
    assert "end_date" in response.text

    too_long = request_payload()
    too_long["start_date"] = "2026-01-01"
    too_long["end_date"] = "2027-01-02"
    response = client.post("/v1/love/new-relationship", json=too_long)
    assert response.status_code == 422
    assert "366 days" in response.text


def test_personal_time_known_true_requires_birth_time():
    payload = request_payload()
    payload["profile"]["birth_time"] = None
    payload["profile"]["time_known"] = True
    response = client.post("/v1/love/personal", json=payload)
    assert response.status_code == 422
    assert "birth_time" in response.text


def test_unknown_birth_time_stays_single_person_and_cannot_converge():
    payload = request_payload()
    payload["start_date"] = "2026-09-01"
    payload["end_date"] = "2026-09-01"
    payload["profile"].update(
        {
            "birth_time": None,
            "time_known": False,
            "time_source": "unknown",
            "time_confidence": "unknown",
            "latitude": None,
            "longitude": None,
        }
    )
    response = client.post("/v1/love/new-relationship", json=payload)
    assert response.status_code == 200, response.text
    body = response.json()
    result = body["result"]
    assert body["analysis_mode"] == "new_relationship"
    assert result["source_scope"] == "single_person_only"
    assert result["counterpart_used"] is False
    assert result["relationship_engine_used"] is False
    assert result["static_structure"]["time_reliability"]["status"] == "unknown"
    assert result["static_structure"]["moon"] is None
    assert result["static_structure"]["house_angle_layers_enabled"] is False
    assert result["timing"]["secondary_progression"]["birth_time_policy"]["convergence_eligible"] is False
    assert result["timing"]["convergence"] == []


def test_personal_meta_exposes_runtime_engine_and_both_routes():
    response = client.get("/v1/meta")
    assert response.status_code == 200
    body = response.json()
    assert body["personal_love_engine"] == api_main.PERSONAL_LOVE_ENGINE_VERSION
    assert "love/personal" in body["routes"]
    assert "love/new-relationship" in body["routes"]


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
            "relationship_engine_used": False,
        },
    )
    response = client.post("/v1/love/personal", json=request_payload())
    assert response.status_code == 200
    policy = response.json()["interpretation_policy"]
    assert policy["counterpart_required"] is False
    assert policy["counterpart_data_allowed"] is False
    assert policy["reunion_inference_allowed"] is False
    assert policy["event_probability"] == "not_calculated"
