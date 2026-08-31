# -*- coding: utf-8 -*-
"""Research-only Thai planet archetypes and traditional paired-planet classes.

Phase 2-E1 records cross-source stable vocabulary for the traditional eight
planets without turning it into a horoscope judgement.

Important invariants:
- pair classes are MULTI-LABEL; one pair may belong to more than one class;
- Moon-Jupiter (2-5) is both คู่ธาตุ and คู่ศัตรู in the documented Thai tables;
- pair membership is not itself a good/bad event prediction;
- pair tags are attached only to already-detected Thai sign relations;
- Ketu/Uranus are not forced into the traditional eight-planet pair table;
- no numeric strength, net score, event judgement, or Gemini permission.
"""

from __future__ import annotations

from typing import Any, Mapping

ENGINE_VERSION = "thai-planet-pairs-research-v1.0-multilabel"

PLANET_ARCHETYPES = {
    "sun": {
        "number": 1,
        "thai": "อาทิตย์",
        "domains": ("authority", "honor", "leadership", "status", "visibility"),
    },
    "moon": {
        "number": 2,
        "thai": "จันทร์",
        "domains": ("emotion", "care", "adaptation", "appearance", "change"),
    },
    "mars": {
        "number": 3,
        "thai": "อังคาร",
        "domains": ("courage", "action", "competition", "force", "conflict"),
    },
    "mercury": {
        "number": 4,
        "thai": "พุธ",
        "domains": ("intellect", "communication", "commerce", "language", "analysis"),
    },
    "jupiter": {
        "number": 5,
        "thai": "พฤหัสบดี",
        "domains": ("knowledge", "ethics", "guidance", "teachers", "counsel"),
    },
    "venus": {
        "number": 6,
        "thai": "ศุกร์",
        "domains": ("love", "art", "pleasure", "beauty", "finance"),
    },
    "saturn": {
        "number": 7,
        "thai": "เสาร์",
        "domains": ("patience", "delay", "obstacles", "endurance", "land"),
    },
    "rahu": {
        "number": 8,
        "thai": "ราหู",
        "domains": ("desire", "secrecy", "foreign_matters", "risk", "adaptability"),
    },
}

# Stable Thai pair tables repeatedly reproduced across Thai references.
PAIR_TABLES = {
    "friend": {
        "thai": "คู่มิตร",
        "pairs": (("sun", "jupiter"), ("moon", "mercury"), ("mars", "venus"), ("saturn", "rahu")),
        "functional_domain": "affinity_trust_support",
    },
    "enemy": {
        "thai": "คู่ศัตรู",
        "pairs": (("sun", "mars"), ("moon", "jupiter"), ("mercury", "rahu"), ("venus", "saturn")),
        "functional_domain": "friction_tension_conflict",
    },
    "element": {
        "thai": "คู่ธาตุ",
        "pairs": (("sun", "saturn"), ("moon", "jupiter"), ("mars", "rahu"), ("mercury", "venus")),
        "functional_domain": "persistence_stability_continuity",
    },
    "equal_power": {
        "thai": "คู่สมพล",
        "pairs": (("sun", "venus"), ("moon", "rahu"), ("mars", "jupiter"), ("mercury", "saturn")),
        "functional_domain": "capacity_influence_skill_function",
    },
}


def _normalize_planet(key: str) -> str:
    normalized = str(key).strip().lower()
    if normalized not in PLANET_ARCHETYPES:
        raise ValueError(f"unsupported traditional pair planet: {key!r}")
    return normalized


def _pair_token(first: str, second: str) -> frozenset[str]:
    a = _normalize_planet(first)
    b = _normalize_planet(second)
    if a == b:
        raise ValueError("paired planets must be distinct")
    return frozenset((a, b))


def planet_archetype(key: str) -> dict[str, Any]:
    normalized = _normalize_planet(key)
    row = PLANET_ARCHETYPES[normalized]
    return {
        "key": normalized,
        "number": row["number"],
        "thai": row["thai"],
        "domains": list(row["domains"]),
        "prediction": None,
        "score": None,
    }


def classify_pair(first: str, second: str) -> list[str]:
    token = _pair_token(first, second)
    labels: list[str] = []
    for class_key, table in PAIR_TABLES.items():
        if any(token == frozenset(pair) for pair in table["pairs"]):
            labels.append(class_key)
    return labels


def pair_relationship(first: str, second: str) -> dict[str, Any]:
    a = _normalize_planet(first)
    b = _normalize_planet(second)
    classes = classify_pair(a, b)
    return {
        "first": a,
        "second": b,
        "classifications": [
            {
                "key": class_key,
                "thai": PAIR_TABLES[class_key]["thai"],
                "functional_domain": PAIR_TABLES[class_key]["functional_domain"],
                "valence": "context_dependent",
                "prediction": None,
                "score": None,
            }
            for class_key in classes
        ],
        "multi_label": len(classes) > 1,
        "combined_judgement": None,
        "prediction": None,
        "score": None,
    }


def build_planet_pair_research(aspects_research: Mapping[str, Any] | None) -> dict[str, Any]:
    active: list[dict[str, Any]] = []
    if isinstance(aspects_research, Mapping) and aspects_research.get("available"):
        for relation_row in aspects_research.get("relations") or []:
            if not isinstance(relation_row, Mapping):
                continue
            first = str(relation_row.get("first") or "")
            second = str(relation_row.get("second") or "")
            if first not in PLANET_ARCHETYPES or second not in PLANET_ARCHETYPES:
                continue
            pair = pair_relationship(first, second)
            if not pair["classifications"]:
                continue
            relation = relation_row.get("relation") if isinstance(relation_row.get("relation"), Mapping) else {}
            pair["sign_relation"] = {
                "key": relation.get("key"),
                "thai": relation.get("thai"),
                "basis": relation.get("basis"),
            }
            active.append(pair)

    return {
        "available": True,
        "research_only": True,
        "engine": ENGINE_VERSION,
        "planet_archetypes": {key: planet_archetype(key) for key in PLANET_ARCHETYPES},
        "pair_tables": {
            class_key: {
                "thai": table["thai"],
                "pairs": [list(pair) for pair in table["pairs"]],
                "functional_domain": table["functional_domain"],
                "valence": "context_dependent",
            }
            for class_key, table in PAIR_TABLES.items()
        },
        "active_natal_pair_tags": active,
        "source_consensus": {
            "planet_archetypes": "conservative overlap across Thai planet-meaning references",
            "pair_membership": "cross-source stable for friend/enemy/element/equal-power tables",
            "pair_valence": "context dependent; pair class alone does not determine outcome",
            "overlap_rule": "preserve every matching class; do not collapse Moon-Jupiter 2-5",
        },
        "promotion_gate": {
            "planet_archetype_vocabulary_validated": True,
            "pair_membership_tables_validated": True,
            "multi_label_overlap_preserved": True,
            "pair_net_valence_allowed": False,
            "pair_strength_score_allowed": False,
            "combined_judgement_allowed": False,
            "event_judgement_allowed": False,
            "gemini_interpretation_allowed": False,
        },
        "policy": "Traditional eight-planet vocabulary and pair-class tags only. A pair class may describe a mode of interaction, never a guaranteed good/bad event.",
    }
