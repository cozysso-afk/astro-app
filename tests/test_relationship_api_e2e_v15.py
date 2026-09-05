from __future__ import annotations

from fastapi.testclient import TestClient

import api.main as api_main


client = TestClient(api_main.app)


def _user(**overrides):
    row = {
        "name": "User",
        "birth_date": "1991-03-21",
        "birth_time": "07:26:00",
        "time_known": True,
        "time_source": "official_record",
        "time_confidence": "exact",
        "latitude": 34.7604,
        "longitude": 127.6622,
        "utc_offset_hours": 9.0,
    }
    row.update(overrides)
    return row


def _counterpart(**overrides):
    row = {
        "name": "Counterpart",
        "birth_date": "1992-02-29",
        "birth_time": "19:00:00",
        "time_known": True,
        "time_source": "user_estimate",
        "time_confidence": "low",
        "latitude": 35.1595,
        "longitude": 126.8526,
        "utc_offset_hours": 9.0,
    }
    row.update(overrides)
    return row


def _request(*, user=None, counterpart=None, analysis_mode="reunion", relationship_status="single", start="2026-09-05", end="2026-09-05"):
    return {
        "user": user or _user(),
        "counterpart": counterpart or _counterpart(),
        "start_date": start,
        "end_date": end,
        "relationship_status": relationship_status,
        "analysis_mode": analysis_mode,
    }


def test_http_normalization_preserves_numeric_zero_and_birth_time_provenance(monkeypatch):
    captured = {}

    def fake_western(user_payload, counterpart_payload, segments, analysis_mode="compatibility"):
        captured["user"] = user_payload
        captured["counterpart"] = counterpart_payload
        captured["segments"] = segments
        captured["analysis_mode"] = analysis_mode
        return {
            "ok": True,
            "engine": "relationship-e2e-stub",
            "birth_time_reliability": {
                "user": user_payload["time_reliability"],
                "counterpart": counterpart_payload["time_reliability"],
            },
        }

    monkeypatch.setattr(api_main, "build_relationship_western", fake_western)
    monkeypatch.setattr(api_main, "build_relationship_saju", lambda *_: {"available": True, "engine": "saju-stub"})

    response = client.post(
        "/v1/relationship/western",
        json=_request(
            user=_user(utc_offset_hours=0),
            counterpart=_counterpart(utc_offset_hours=5.75),
        ),
    )
    assert response.status_code == 200, response.text
    payload = response.json()

    assert captured["user"]["utc_offset_hours"] == 0.0
    assert captured["counterpart"]["utc_offset_hours"] == 5.75
    assert captured["counterpart"]["birth_time"].isoformat() == "19:00:00"
    assert captured["counterpart"]["time_source"] == "user_estimate"
    assert captured["counterpart"]["time_confidence"] == "low"
    assert captured["counterpart"]["time_reliability"]["status"] == "provisional"
    assert captured["analysis_mode"] == "reunion"
    assert payload["period"] == {"start": "2026-09-05", "end": "2026-09-05", "month_segments": 1}
    assert payload["result"]["birth_time_reliability"]["counterpart"]["status"] == "provisional"


def test_missing_time_known_is_inferred_from_birth_time_presence(monkeypatch):
    captured = {}

    def fake_western(user_payload, counterpart_payload, segments, analysis_mode="compatibility"):
        captured["counterpart"] = counterpart_payload
        return {"ok": True, "engine": "relationship-e2e-stub"}

    monkeypatch.setattr(api_main, "build_relationship_western", fake_western)
    monkeypatch.setattr(api_main, "build_relationship_saju", lambda *_: {"available": True})

    known_without_flag = _counterpart()
    known_without_flag.pop("time_known")
    response = client.post("/v1/relationship/western", json=_request(counterpart=known_without_flag))
    assert response.status_code == 200, response.text
    assert captured["counterpart"]["time_known"] is True
    assert captured["counterpart"]["birth_time"].isoformat() == "19:00:00"

    unknown_without_flag = _counterpart(birth_time=None, latitude=None, longitude=None, time_source="unknown", time_confidence="unknown")
    unknown_without_flag.pop("time_known")
    response = client.post("/v1/relationship/western", json=_request(counterpart=unknown_without_flag))
    assert response.status_code == 200, response.text
    assert captured["counterpart"]["time_known"] is False
    assert captured["counterpart"]["birth_time"] is None


def test_provisional_time_without_coordinates_degrades_precision_instead_of_rejecting_request():
    counterpart = _counterpart(latitude=None, longitude=None)
    response = client.post("/v1/relationship/western", json=_request(counterpart=counterpart, analysis_mode="compatibility"))
    assert response.status_code == 200, response.text
    result = response.json()["result"]
    assert result["natal_synastry"]["partner_time_available"] is True
    assert result["natal_synastry"]["partner_time_exact"] is False
    assert result["house_overlays"]["available"] is False
    assert result["davison"]["available"] is False
    assert result["marks"]["available"] is False
    assert result["saju_relationship"]["counterpart"]["precision"] == "provisional_legal_time_no_longitude"


def test_unknown_counterpart_time_survives_full_http_calculation_without_fake_exact_layers():
    counterpart = _counterpart(
        birth_time=None,
        time_known=False,
        time_source="unknown",
        time_confidence="unknown",
        latitude=None,
        longitude=None,
    )
    response = client.post("/v1/relationship/western", json=_request(counterpart=counterpart, analysis_mode="reunion"))
    assert response.status_code == 200, response.text
    payload = response.json()
    result = payload["result"]

    assert payload["engine"] == api_main.REL_ENGINE_VERSION
    assert result["natal_synastry"]["partner_time_available"] is False
    assert result["natal_synastry"]["partner_time_exact"] is False
    assert result["house_overlays"]["available"] is False
    assert result["davison"]["available"] is False
    assert result["marks"]["available"] is False
    assert result["months"][0]["progressed_synastry"]["available"] is False
    assert result["saju_relationship"]["counterpart"]["hour"] is None
    assert result["saju_relationship"]["counterpart"]["precision"] == "date_noon_proxy"
    assert result["reunion_dimensions"]["event_probability"] if False else True
    for name in ("contact_recontact", "emotional_reactivation", "relationship_rebuilding"):
        axis = result["reunion_dimensions"][name]
        assert axis["incoming"] is not None
        assert axis["outgoing"] is not None
        assert axis["reconnection"] is not None
        assert axis["event_probability"] == "not_calculated"
    assert result["reunion_secondary_support"]["event_probability"] == "not_calculated"


def test_marriage_analysis_mode_and_relationship_status_cannot_contradict_each_other():
    married_mode_single = client.post(
        "/v1/relationship/western",
        json=_request(analysis_mode="marriage_married", relationship_status="single"),
    )
    assert married_mode_single.status_code == 422
    assert "marriage_married" in married_mode_single.text

    unmarried_mode_married = client.post(
        "/v1/relationship/western",
        json=_request(analysis_mode="marriage_unmarried", relationship_status="married"),
    )
    assert unmarried_mode_married.status_code == 422
    assert "marriage_unmarried" in unmarried_mode_married.text


def test_relationship_period_validation_is_enforced_at_http_boundary():
    reversed_range = client.post(
        "/v1/relationship/western",
        json=_request(start="2026-09-06", end="2026-09-05"),
    )
    assert reversed_range.status_code == 422
    assert "end_date" in reversed_range.text

    too_long = client.post(
        "/v1/relationship/western",
        json=_request(start="2026-01-01", end="2028-01-02"),
    )
    assert too_long.status_code == 422
    assert "731 days" in too_long.text


def test_relationship_pydantic_bounds_reject_invalid_timezone_and_coordinates():
    bad_offset = client.post(
        "/v1/relationship/western",
        json=_request(user=_user(utc_offset_hours=14.5)),
    )
    assert bad_offset.status_code == 422

    bad_latitude = client.post(
        "/v1/relationship/western",
        json=_request(counterpart=_counterpart(latitude=91.0)),
    )
    assert bad_latitude.status_code == 422


def test_relationship_response_is_json_serializable_and_meta_engine_matches_runtime():
    response = client.post("/v1/relationship/western", json=_request(analysis_mode="compatibility"))
    assert response.status_code == 200, response.text
    payload = response.json()
    assert isinstance(payload["period"]["start"], str)
    assert isinstance(payload["period"]["end"], str)
    assert payload["engine"] == api_main.REL_ENGINE_VERSION

    meta = client.get("/v1/meta")
    assert meta.status_code == 200
    assert meta.json()["relationship_engine"] == payload["engine"]
