from __future__ import annotations

from collections import defaultdict
from typing import Any

CONTRACT_VERSION = "reunion-evidence-contract-v1"
NEAR_EXACT_ORB = 0.02


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _num(value: Any, default: float = 99.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _signature(source_path: str, aspect: dict[str, Any]) -> str:
    return "|".join(
        [
            source_path,
            str(aspect.get("a") or ""),
            str(aspect.get("aspect") or ""),
            str(aspect.get("b") or ""),
        ]
    )


def _domains(aspect: dict[str, Any]) -> list[str]:
    points = {str(aspect.get("a") or ""), str(aspect.get("b") or "")}
    domains: list[str] = []
    rules = (
        ("communication", {"Mercury"}),
        ("emotion", {"Moon"}),
        ("affection_attraction", {"Venus"}),
        ("action_desire", {"Mars"}),
        ("identity_direction", {"Sun", "True Node"}),
        ("commitment_structure", {"Saturn", "Jupiter", "DSC", "IC"}),
        ("intensity_transformation", {"Pluto"}),
        ("instability_uncertainty", {"Uranus", "Neptune"}),
        ("visibility_status", {"ASC", "MC"}),
    )
    for label, members in rules:
        if points & members:
            domains.append(label)
    return domains or ["general_relationship"]


def _stage_hints(aspect: dict[str, Any]) -> list[str]:
    points = {str(aspect.get("a") or ""), str(aspect.get("b") or "")}
    out: list[str] = []
    if points & {"Moon", "Venus", "Sun", "Mars", "Pluto", "Neptune"}:
        out.append("emotional_reactivation")
    if points & {"Mercury", "Venus", "Sun", "Mars"}:
        out.append("contact_recontact")
    if points & {"Venus", "Mars", "Mercury", "Sun", "Moon", "ASC", "DSC"}:
        out.append("in_person_meeting")
    if points & {"Saturn", "Jupiter", "Sun", "Venus", "Mercury", "True Node", "DSC", "IC"}:
        out.append("relationship_rebuilding")
    return out


def _house_index(month: dict[str, Any], direction: str) -> dict[str, dict[str, Any]]:
    block = month.get("progressed_house_overlays") or {}
    if direction == "user_to_counterpart":
        rows = ((block.get("user_progressed_in_counterpart") or {}).get("relationship_houses") or [])
    elif direction == "counterpart_to_user":
        rows = ((block.get("counterpart_progressed_in_user") or {}).get("relationship_houses") or [])
    else:
        rows = []
    return {str(row.get("planet") or ""): row for row in rows if isinstance(row, dict)}


def _sources(month: dict[str, Any]) -> list[tuple[str, str, list[dict[str, Any]]]]:
    ps = month.get("progressed_synastry") or {}
    pc = month.get("progressed_composite") or {}
    out: list[tuple[str, str, list[dict[str, Any]]]] = []
    if ps.get("available"):
        out.extend(
            [
                ("progressed_synastry.user_to_counterpart", "user_to_counterpart", _as_list(ps.get("user_progressed_to_partner_natal"))),
                ("progressed_synastry.counterpart_to_user", "counterpart_to_user", _as_list(ps.get("partner_progressed_to_user_natal"))),
                ("progressed_synastry.progressed_to_progressed", "shared", _as_list(ps.get("progressed_to_progressed"))),
            ]
        )
    if pc.get("available"):
        out.append(
            (
                "progressed_composite.to_natal_composite",
                "relationship_itself",
                _as_list(pc.get("to_natal_composite_aspects")),
            )
        )
    return out


def _phase(rows: list[dict[str, Any]], index: int) -> tuple[str, str]:
    current = _num(rows[index].get("orb"))
    if current <= NEAR_EXACT_ORB:
        return "exact", "sampled_near_exact"
    previous = _num(rows[index - 1].get("orb")) if index > 0 else None
    following = _num(rows[index + 1].get("orb")) if index + 1 < len(rows) else None
    if following is not None:
        delta = following - current
    elif previous is not None:
        delta = current - previous
    else:
        return "indeterminate", "single_month_sample"
    if abs(delta) <= 0.01:
        return "indeterminate", "monthly_orb_trend_flat"
    return ("applying" if delta < 0 else "separating"), "monthly_orb_trend"


def build_reunion_evidence_contract(months: list[dict[str, Any]]) -> dict[str, Any]:
    raw: list[dict[str, Any]] = []
    for month in months:
        reference_date = str(month.get("representative_date") or "")
        calendar_month = str(month.get("calendar_month") or reference_date[:7])
        for source_path, direction, aspects in _sources(month):
            houses = _house_index(month, direction)
            for aspect in aspects:
                if not isinstance(aspect, dict):
                    continue
                item = dict(aspect)
                item.update(
                    {
                        "source_path": source_path,
                        "direction": direction,
                        "calendar_month": calendar_month,
                        "reference_date": reference_date,
                        "relationship_domains": _domains(aspect),
                        "stage_hints": _stage_hints(aspect),
                        "event_probability": "not_calculated",
                    }
                )
                house = houses.get(str(aspect.get("a") or ""))
                if house:
                    item["target_house"] = {
                        "whole_house": house.get("whole_house"),
                        "quadrant_house": house.get("quadrant_house", house.get("placidus_house", house.get("house"))),
                        "quadrant_system": house.get("quadrant_system"),
                    }
                raw.append(item)

    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in raw:
        grouped[_signature(str(item["source_path"]), item)].append(item)

    evidence: list[dict[str, Any]] = []
    for rows in grouped.values():
        rows.sort(key=lambda row: str(row.get("reference_date") or ""))
        for index, item in enumerate(rows):
            phase, phase_basis = _phase(rows, index)
            row = dict(item)
            row["phase"] = phase
            row["phase_basis"] = phase_basis
            row["exact_at"] = row.get("reference_date") if phase == "exact" else None
            row["exact_at_basis"] = "sampled_near_exact" if phase == "exact" else "not_resolved_from_monthly_sampling"
            evidence.append(row)

    direction_order = {"counterpart_to_user": 0, "user_to_counterpart": 1, "shared": 2, "relationship_itself": 3}
    evidence.sort(
        key=lambda row: (
            str(row.get("reference_date") or ""),
            direction_order.get(str(row.get("direction") or ""), 9),
            _num(row.get("orb")),
            int(row.get("layer_priority") or 9),
        )
    )
    return {
        "version": CONTRACT_VERSION,
        "available": bool(evidence),
        "evidence": evidence,
        "policy": {
            "direction": "user_to_counterpart, counterpart_to_user, shared progressed-to-progressed, and relationship_itself are separate interpretation layers",
            "phase": "applying/separating is derived from adjacent monthly orb trend; exact is emitted only for a sampled orb <= 0.02 degrees",
            "exact_date": "monthly secondary progression samples do not manufacture an exact event date; unresolved exact_at remains null",
            "houses": "progressed planet house overlays use the counterpart natal house frame and inherit birth-time precision limits",
            "stages": "stage_hints are interpretation tags only; they do not auto-promote emotion to contact, meeting, or rebuilding",
            "probability": "no evidence row is an event probability or proof of another person's private feelings",
        },
    }
