from integrated_fortune_v1 import _daily_score_payload


def test_daily_score_payload_preserves_scores_and_adds_real_contrast():
    evidence = {
        "kind": "aspect", "transit": "Mercury", "target": "Jupiter",
        "aspect": "trine", "motion": "Applying", "source_topics": ["학업"],
        "polarity": 0.7, "contribution": 4.0,
    }
    rows = [
        {"date": "2026-10-07", "label": "10/7(수)", "학업": 40, "연락": 65, "_evidence": [evidence]},
        {"date": "2026-10-08", "label": "10/8(목)", "학업": 70, "연락": 55, "_evidence": [evidence, evidence]},
    ]

    payload = _daily_score_payload(rows, ["학업", "연락"])

    assert [day["scores"] for day in payload] == [
        {"학업": 40.0, "연락": 65.0},
        {"학업": 70.0, "연락": 55.0},
    ]
    assert payload[0]["contrast"]["previous_day_delta"] == {"학업": None, "연락": None}
    assert payload[1]["contrast"]["previous_day_delta"] == {"학업": 30.0, "연락": -10.0}
    assert payload[0]["contrast"]["period_mean_delta"] == {"학업": -15.0, "연락": 5.0}
    assert payload[1]["contrast"]["dominant_topics"] == ["학업", "연락"]
    assert payload[1]["contrast"]["dominant_evidence"] == [evidence]
