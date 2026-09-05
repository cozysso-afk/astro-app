from __future__ import annotations

from typing import Any

DIMENSIONS = ("contact_recontact", "emotional_reactivation", "relationship_rebuilding")

ASPECT_WEIGHTS = {
    "conjunction": 1.00,
    "opposition": 0.95,
    "square": 0.92,
    "trine": 0.82,
    "sextile": 0.76,
    "quincunx": 0.68,
}

# These are product-interpretation weights, not empirical event probabilities.
# They separate three questions that must never be collapsed into one reunion score.
TRANSIT_WEIGHTS = {
    "contact_recontact": {
        "Sun": 0.45, "Mercury": 1.00, "Venus": 0.85, "Mars": 0.65,
        "Jupiter": 0.35, "Saturn": 0.15, "Uranus": 0.55, "Neptune": 0.20, "Pluto": 0.25,
    },
    "emotional_reactivation": {
        "Sun": 0.60, "Mercury": 0.30, "Venus": 1.00, "Mars": 0.75,
        "Jupiter": 0.55, "Saturn": 0.35, "Uranus": 0.45, "Neptune": 0.75, "Pluto": 0.90,
    },
    "relationship_rebuilding": {
        "Sun": 0.25, "Mercury": 0.35, "Venus": 0.40, "Mars": 0.15,
        "Jupiter": 0.95, "Saturn": 1.00, "Uranus": 0.20, "Neptune": 0.20, "Pluto": 0.45,
    },
}

TARGET_WEIGHTS = {
    "contact_recontact": {
        "Sun": 0.65, "Moon": 0.50, "Mercury": 1.00, "Venus": 0.80, "Mars": 0.55,
        "Jupiter": 0.30, "Saturn": 0.30, "Uranus": 0.35, "Neptune": 0.30, "Pluto": 0.40,
        "True Node": 0.35, "ASC": 0.45, "DSC": 0.75, "MC": 0.25, "IC": 0.25,
    },
    "emotional_reactivation": {
        "Sun": 0.80, "Moon": 1.00, "Mercury": 0.30, "Venus": 1.00, "Mars": 0.75,
        "Jupiter": 0.45, "Saturn": 0.45, "Uranus": 0.40, "Neptune": 0.80, "Pluto": 0.90,
        "True Node": 0.50, "ASC": 0.50, "DSC": 0.75, "MC": 0.20, "IC": 0.55,
    },
    "relationship_rebuilding": {
        "Sun": 0.75, "Moon": 0.55, "Mercury": 0.70, "Venus": 0.80, "Mars": 0.35,
        "Jupiter": 0.80, "Saturn": 1.00, "Uranus": 0.30, "Neptune": 0.30, "Pluto": 0.55,
        "True Node": 0.55, "ASC": 0.35, "DSC": 0.80, "MC": 0.35, "IC": 0.65,
    },
}

SECONDARY_POINTS = {
    "contact_recontact": {"Mercury", "Venus", "Sun", "Mars"},
    "emotional_reactivation": {"Moon", "Venus", "Sun", "Mars", "Pluto", "Neptune"},
    "relationship_rebuilding": {"Saturn", "Jupiter", "Sun", "Venus", "Mercury", "True Node"},
}

DIMENSION_LABELS = {
    "contact_recontact": "연락·재접촉 활성",
    "emotional_reactivation": "감정·관계 재활성",
    "relationship_rebuilding": "관계 재구축 지원층",
}


def _transit_orb_limit(planet: str) -> float:
    return 1.4 if planet in {"Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"} else 1.0


def score_transit_hit(hit: dict[str, Any], dimension: str) -> float:
    if dimension not in DIMENSIONS:
        raise ValueError(f"unsupported reunion dimension: {dimension}")
    transit = str(hit.get("transit") or "")
    target = str(hit.get("target") or "")
    aspect = str(hit.get("aspect") or "")
    orb = max(0.0, float(hit.get("orb") or 0.0))
    limit = _transit_orb_limit(transit)
    if orb > limit:
        return 0.0
    transit_weight = TRANSIT_WEIGHTS[dimension].get(transit, 0.0)
    target_weight = TARGET_WEIGHTS[dimension].get(target, 0.20)
    aspect_weight = ASPECT_WEIGHTS.get(aspect, 0.0)
    orb_factor = max(0.0, 1.0 - orb / limit)
    return round(100.0 * transit_weight * target_weight * aspect_weight * orb_factor, 1)


def dimension_side_score(hits: list[dict[str, Any]], dimension: str) -> tuple[float, list[dict[str, Any]]]:
    evidence = []
    for hit in hits:
        score = score_transit_hit(hit, dimension)
        if score <= 0:
            continue
        row = dict(hit)
        row.update({
            "dimension": dimension,
            "dimension_score": score,
            "event_probability": "not_calculated",
        })
        evidence.append(row)
    evidence.sort(key=lambda row: (-float(row["dimension_score"]), float(row.get("orb") or 99.0)))
    top = evidence[:4]
    score = round(min(100.0, sum(float(row["dimension_score"]) for row in top) / 2.35), 1) if top else 0.0
    return score, evidence[:8]


def daily_dimension_scores(
    user_hits: list[dict[str, Any]],
    counterpart_hits: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    output: dict[str, dict[str, Any]] = {}
    for dimension in DIMENSIONS:
        user_score, user_evidence = dimension_side_score(user_hits, dimension)
        counterpart_score, counterpart_evidence = dimension_side_score(counterpart_hits, dimension)
        shared_bonus = 8.0 if user_score >= 35.0 and counterpart_score >= 35.0 else 0.0
        combined = round(min(100.0, user_score * 0.45 + counterpart_score * 0.55 + shared_bonus), 1)
        output[dimension] = {
            "label": DIMENSION_LABELS[dimension],
            "score": combined,
            "user_score": user_score,
            "counterpart_score": counterpart_score,
            "shared_activation": bool(user_score >= 25.0 and counterpart_score >= 25.0),
            "user_evidence": user_evidence[:4],
            "counterpart_evidence": counterpart_evidence[:4],
            "event_probability": "not_calculated",
        }
    return output


def secondary_dimension_match(aspect: dict[str, Any], dimension: str) -> bool:
    if dimension not in DIMENSIONS:
        raise ValueError(f"unsupported reunion dimension: {dimension}")
    points = SECONDARY_POINTS[dimension]
    return str(aspect.get("a") or "") in points or str(aspect.get("b") or "") in points


def secondary_support(month_row: dict[str, Any]) -> dict[str, Any]:
    sources: list[tuple[str, list[dict[str, Any]]]] = []
    progressed = month_row.get("progressed_synastry") or {}
    if progressed.get("available"):
        for key in (
            "user_progressed_to_partner_natal",
            "partner_progressed_to_user_natal",
            "progressed_to_progressed",
        ):
            sources.append((f"progressed_synastry.{key}", list(progressed.get(key) or [])))
    composite = month_row.get("progressed_composite") or {}
    if composite.get("available"):
        sources.append(("progressed_composite.to_natal_composite", list(composite.get("to_natal_composite_aspects") or [])))

    result: dict[str, Any] = {}
    for dimension in DIMENSIONS:
        evidence = []
        layer_names = set()
        for layer, aspects in sources:
            matched = [dict(aspect, layer=layer) for aspect in aspects if secondary_dimension_match(aspect, dimension)]
            if matched:
                layer_names.add(layer.split(".")[0])
                evidence.extend(matched)
        evidence.sort(key=lambda row: (float(row.get("orb") or 99.0), int(row.get("layer_priority") or 9)))
        result[dimension] = {
            "label": DIMENSION_LABELS[dimension],
            "evidence": evidence[:8],
            "independent_primary_layers": sorted(layer_names),
            "independent_layer_count": len(layer_names),
            "convergence": len(layer_names) >= 2,
            "score": None,
            "policy": "secondary progression evidence is kept separate from transit activation; no mixed reunion score is calculated",
            "event_probability": "not_calculated",
        }
    return result
