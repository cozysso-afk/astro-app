from relationship_evidence_contract_v1 import build_reunion_evidence_contract


def _aspect(a, aspect, b, orb, tone="supportive"):
    return {
        "a": a,
        "aspect": aspect,
        "b": b,
        "orb": orb,
        "tone": tone,
        "layer_priority": 2,
        "event_probability": "not_calculated",
    }


def test_contract_separates_directions_and_tracks_monthly_phase():
    months = [
        {
            "calendar_month": "2026-09",
            "representative_date": "2026-09-15",
            "progressed_synastry": {
                "available": True,
                "user_progressed_to_partner_natal": [_aspect("Venus", "sextile", "Sun", 0.40)],
                "partner_progressed_to_user_natal": [_aspect("Mercury", "conjunction", "Sun", 0.30)],
                "progressed_to_progressed": [_aspect("Venus", "sextile", "Sun", 0.20)],
            },
            "progressed_composite": {
                "available": True,
                "to_natal_composite_aspects": [_aspect("Moon", "square", "Mercury", 0.60, "challenging")],
            },
            "progressed_house_overlays": {
                "available": True,
                "user_progressed_in_counterpart": {
                    "relationship_houses": [
                        {"planet": "Venus", "whole_house": 7, "quadrant_house": 7, "quadrant_system": "P"}
                    ]
                },
                "counterpart_progressed_in_user": {
                    "relationship_houses": [
                        {"planet": "Mercury", "whole_house": 12, "quadrant_house": 12, "quadrant_system": "P"}
                    ]
                },
            },
        },
        {
            "calendar_month": "2026-10",
            "representative_date": "2026-10-15",
            "progressed_synastry": {
                "available": True,
                "user_progressed_to_partner_natal": [_aspect("Venus", "sextile", "Sun", 0.20)],
                "partner_progressed_to_user_natal": [_aspect("Mercury", "conjunction", "Sun", 0.10)],
                "progressed_to_progressed": [_aspect("Venus", "sextile", "Sun", 0.01)],
            },
            "progressed_composite": {
                "available": True,
                "to_natal_composite_aspects": [_aspect("Moon", "square", "Mercury", 0.80, "challenging")],
            },
            "progressed_house_overlays": {"available": False},
        },
    ]

    out = build_reunion_evidence_contract(months)
    assert out["available"] is True
    assert out["version"] == "reunion-evidence-contract-v1"

    evidence = out["evidence"]
    user_venus = next(
        row
        for row in evidence
        if row["direction"] == "user_to_counterpart"
        and row["a"] == "Venus"
        and row["reference_date"] == "2026-09-15"
    )
    assert user_venus["phase"] == "applying"
    assert user_venus["target_house"]["whole_house"] == 7
    assert "affection_attraction" in user_venus["relationship_domains"]
    assert "contact_recontact" in user_venus["stage_hints"]

    counterpart_mercury = next(
        row
        for row in evidence
        if row["direction"] == "counterpart_to_user"
        and row["a"] == "Mercury"
        and row["reference_date"] == "2026-09-15"
    )
    assert counterpart_mercury["target_house"]["whole_house"] == 12
    assert "communication" in counterpart_mercury["relationship_domains"]

    exact_shared = next(
        row
        for row in evidence
        if row["direction"] == "shared" and row["reference_date"] == "2026-10-15"
    )
    assert exact_shared["phase"] == "exact"
    assert exact_shared["exact_at"] == "2026-10-15"

    relationship_row = next(
        row
        for row in evidence
        if row["direction"] == "relationship_itself" and row["reference_date"] == "2026-09-15"
    )
    assert relationship_row["phase"] == "separating"
    assert "communication" in relationship_row["relationship_domains"]


def test_contract_does_not_invent_exact_date_from_monthly_sampling():
    months = [
        {
            "calendar_month": "2026-09",
            "representative_date": "2026-09-15",
            "progressed_synastry": {
                "available": True,
                "user_progressed_to_partner_natal": [_aspect("Mercury", "conjunction", "Sun", 0.35)],
                "partner_progressed_to_user_natal": [],
                "progressed_to_progressed": [],
            },
            "progressed_composite": {"available": False},
        },
        {
            "calendar_month": "2026-10",
            "representative_date": "2026-10-15",
            "progressed_synastry": {
                "available": True,
                "user_progressed_to_partner_natal": [_aspect("Mercury", "conjunction", "Sun", 0.15)],
                "partner_progressed_to_user_natal": [],
                "progressed_to_progressed": [],
            },
            "progressed_composite": {"available": False},
        },
    ]
    row = build_reunion_evidence_contract(months)["evidence"][0]
    assert row["phase"] == "applying"
    assert row["exact_at"] is None
    assert row["exact_at_basis"] == "not_resolved_from_monthly_sampling"
