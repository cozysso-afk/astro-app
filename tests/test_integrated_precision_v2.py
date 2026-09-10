from __future__ import annotations

from datetime import date, time

from fastapi.testclient import TestClient

import api.main as api_main
import integrated_fortune_precision_v2 as precision_v2

client = TestClient(api_main.app)


def _precision(status="exact"):
    if status == "exact":
        return precision_v2.build_precision_contract({
            "time_available": True, "time_exact": True, "status": "exact",
            "time_source": "official_record", "time_confidence": "exact",
        })
    return precision_v2.build_precision_contract({
        "time_available": True, "time_exact": False, "status": "provisional",
        "time_source": "family_memory", "time_confidence": "medium",
    })


def _request(**profile_overrides):
    profile = {
        "name": "User", "birth_date": "1991-03-21", "birth_time": "07:26:00",
        "time_known": True, "time_source": "official_record", "time_confidence": "exact",
        "latitude": 34.7604, "longitude": 127.6622, "utc_offset_hours": 9.0, "gender": "female",
    }
    profile.update(profile_overrides)
    return {"profile": profile, "start_date": "2026-09-10", "end_date": "2026-09-10"}


def test_precision_contract_exact_and_provisional_are_fail_closed():
    exact = _precision("exact")
    provisional = _precision("provisional")
    assert exact["scoring_mode"] == "full_exact"
    assert exact["allow_angles_houses_scoring"] is True
    assert provisional["scoring_mode"] == "planet_only_provisional"
    assert provisional["allow_natal_moon_scoring"] is False
    assert provisional["allow_intraday_timing"] is False


def test_exact_wrapper_delegates_without_mutating_legacy_nested_shape(monkeypatch):
    legacy_result = {
        "ok": True, "engine": "legacy-engine", "period": {"start":"x","end":"y"},
        "western": {"natal": {"asc": 1.0, "mc": 2.0, "house_system": {"used":"Placidus"}}},
        "saju": {"ok": True}, "thai": {"ok": True},
    }
    monkeypatch.setattr(precision_v2.legacy, "build_integrated_fortune", lambda **_: legacy_result.copy())
    out = precision_v2.build_integrated_fortune_precision_v2(
        birth_date=date(1991,3,21), birth_time=time(7,26), latitude=34.7, longitude=127.6,
        utc_offset_hours=9, gender="female", start_date=date(2026,9,10), end_date=date(2026,9,10), precision=_precision("exact"),
    )
    assert out["engine"] == "legacy-engine"
    assert out["western"]["natal"] == legacy_result["western"]["natal"]
    assert set(out["western"]["natal"]) == {"asc", "mc", "house_system"}
    assert out["precision"]["status"] == "exact"


def test_planet_only_selection_excludes_natal_moon_angles_and_keeps_transit_moon():
    assert "Moon" not in precision_v2._ROBUST_NATAL_BODIES
    assert "ASC" not in precision_v2._ROBUST_NATAL_BODIES
    assert "MC" not in precision_v2._ROBUST_NATAL_BODIES
    records = [
        {"layer":"일일","transit":"Moon","target":"Venus","orb_weight":1.0,"motion_mult":1.0,"activation_mult":1.0,"direction":"순행","base_polarity":0.5,"name":"삼분위","orb":0.2,"motion":"적용"},
    ]
    result = precision_v2._score_topic_planet_only("연애", records)
    assert any(e["transit"] == "Moon" and e["target"] == "Venus" for e in result["evidence"])
    assert all(e["kind"] == "aspect" for e in result["evidence"])


def test_integrated_routes_reject_legacy_client_without_provenance():
    payload = _request()
    for key in ("time_known", "time_source", "time_confidence"):
        payload["profile"].pop(key, None)
    response = client.post("/v1/fortune/integrated", json=payload)
    assert response.status_code == 409, response.text


def test_integrated_sync_passes_precision_contract(monkeypatch):
    captured = {}
    def fake(**kwargs):
        captured.update(kwargs)
        return {"ok":True,"engine":"stub","period":{"start":"2026-09-10","end":"2026-09-10","day_count":1,"month_segments":1},"precision":kwargs["precision"],"western":{},"saju":{},"thai":{}}
    monkeypatch.setattr(api_main, "build_integrated_fortune_precision_v2", fake)
    response = client.post("/v1/fortune/integrated", json=_request(time_source="family_memory", time_confidence="medium"))
    assert response.status_code == 200, response.text
    assert captured["precision"]["status"] == "provisional"
    assert captured["precision"]["allow_angles_houses_scoring"] is False


def test_async_dedupe_key_includes_precision_mode():
    base = {"birth_date": date(1991,3,21), "birth_time": time(7,26), "start_date": date(2026,9,10), "end_date": date(2026,9,10)}
    assert api_main._calc_request_key({**base,"precision":_precision("exact")}) != api_main._calc_request_key({**base,"precision":_precision("provisional")})


def test_time_known_true_without_birth_time_is_422_before_personal_love_normalization():
    payload = {
        "profile": {"name":"User","birth_date":"1991-03-21","birth_time":None,"time_known":True,"time_source":"official_record","time_confidence":"exact","latitude":34.7604,"longitude":127.6622,"utc_offset_hours":9.0},
        "start_date":"2026-09-10","end_date":"2026-09-10",
    }
    response = client.post("/v1/love/personal", json=payload)
    assert response.status_code == 422, response.text
    assert "birth_time" in response.text
