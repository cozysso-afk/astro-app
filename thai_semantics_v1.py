# -*- coding: utf-8 -*-
"""Research-only semantic vocabulary for Thai astrology facts.

Phase 2-D1 translates already-validated structural facts into conservative
semantic domains. It still does NOT perform a horoscope judgement.

Allowed here:
- neutral topic domains for the 12 Thai houses;
- broad functional direction for the four basic standards
  (Kaset/Pra/Ucca/Nicha), based on cross-source agreement.

Intentionally excluded:
- event prediction;
- percent/point scores;
- automatic benefic/malefic synthesis;
- advanced-standard ranking;
- aspect meanings;
- medical, financial, relationship, or other concrete outcome claims;
- Gemini interpretation.
"""

from __future__ import annotations

from typing import Any, Mapping

ENGINE_VERSION = "thai-semantics-research-v1.0-conservative-domains"

# Neutral cross-source topic vocabulary. These are domains, not predictions.
HOUSE_DOMAINS = {
    1: {"key": "tanu", "thai": "ตนุ", "domains": ("self", "identity", "appearance", "condition")},
    2: {"key": "kutumba", "thai": "กฎุมพะ", "domains": ("money", "assets", "income", "resources")},
    3: {"key": "sahajja", "thai": "สหัชชะ", "domains": ("siblings", "peers", "communication", "nearby_travel")},
    4: {"key": "bandhu", "thai": "พันธุ", "domains": ("home", "family", "property", "vehicles")},
    5: {"key": "putta", "thai": "ปุตตะ", "domains": ("children", "dependents", "creation", "new_ventures")},
    6: {"key": "ari", "thai": "อริ", "domains": ("obstacles", "competition", "debts", "conflict", "condition_challenges")},
    7: {"key": "patni", "thai": "ปัตนิ", "domains": ("partner", "spouse", "partnership", "counterparty")},
    8: {"key": "marana", "thai": "มรณะ", "domains": ("endings", "loss", "inheritance", "separation", "deep_change")},
    9: {"key": "subha", "thai": "ศุภะ", "domains": ("higher_education", "long_travel", "beliefs", "mentors", "support")},
    10: {"key": "kamma", "thai": "กัมมะ", "domains": ("work", "career", "duties", "status")},
    11: {"key": "labha", "thai": "ลาภะ", "domains": ("gains", "benefits", "networks", "groups")},
    12: {"key": "vinasa", "thai": "วินาศ", "domains": ("hidden_matters", "loss", "isolation", "withdrawal", "far_away")},
}

# Broad functional direction only. These words do not imply an event outcome.
BASIC_STATUS_SEMANTICS = {
    "kaset": {
        "thai": "เกษตร",
        "functional_direction": "stable_strong",
        "keywords": ("stable", "enduring", "own_sign_function"),
    },
    "pra": {
        "thai": "ประ",
        "functional_direction": "unstable_reduced",
        "keywords": ("less_stable", "less_enduring", "reduced_function"),
    },
    "ucca": {
        "thai": "อุจ",
        "functional_direction": "elevated_strong",
        "keywords": ("elevated", "powerful", "strong_function"),
    },
    "nicha": {
        "thai": "นิจ",
        "functional_direction": "weakened",
        "keywords": ("weakened", "reduced_power", "limited_function"),
    },
}


def house_semantics(house_number: int) -> dict[str, Any]:
    number = int(house_number)
    if number not in HOUSE_DOMAINS:
        raise ValueError("house_number must be within 1..12")
    row = HOUSE_DOMAINS[number]
    return {
        "house_number": number,
        "house_name_key": row["key"],
        "house_name_thai": row["thai"],
        "domains": list(row["domains"]),
        "prediction": None,
        "score": None,
    }


def basic_status_semantics(status_key: str) -> dict[str, Any] | None:
    row = BASIC_STATUS_SEMANTICS.get(str(status_key))
    if row is None:
        return None
    return {
        "status_key": str(status_key),
        "thai": row["thai"],
        "functional_direction": row["functional_direction"],
        "keywords": list(row["keywords"]),
        "prediction": None,
        "score": None,
    }


def build_semantics_research(
    *,
    houses_research: Mapping[str, Any] | None,
    dignities_research: Mapping[str, Any] | None,
) -> dict[str, Any]:
    house_rows: list[dict[str, Any]] = []
    if isinstance(houses_research, Mapping) and houses_research.get("available"):
        for row in houses_research.get("houses") or []:
            if isinstance(row, Mapping):
                house_rows.append(house_semantics(int(row["house_number"])))

    planet_rows: dict[str, dict[str, Any]] = {}
    if isinstance(dignities_research, Mapping) and dignities_research.get("available"):
        for key, planet in (dignities_research.get("planets") or {}).items():
            if not isinstance(planet, Mapping):
                continue
            basic = []
            for status in planet.get("statuses") or []:
                if not isinstance(status, Mapping):
                    continue
                semantics = basic_status_semantics(str(status.get("key") or ""))
                if semantics:
                    basic.append(semantics)
            planet_rows[str(key)] = {
                "basic_status_semantics": basic,
                "advanced_standard_semantics": [],
                "combined_judgement": None,
                "prediction": None,
                "score": None,
            }

    return {
        "available": bool(house_rows or planet_rows),
        "research_only": True,
        "engine": ENGINE_VERSION,
        "house_domains": house_rows,
        "planet_status_semantics": planet_rows,
        "source_consensus": {
            "house_domains": "cross-source conservative overlap only",
            "basic_status_direction": "Kaset/Ucca stronger or more complete; Pra/Nicha reduced or weakened",
            "advanced_standards": "facts validated, interpretation intentionally pending",
            "aspects": "geometry validated, interpretation intentionally pending",
        },
        "promotion_gate": {
            "neutral_house_domains_validated": True,
            "basic_status_direction_validated": True,
            "advanced_standard_meanings_validated": False,
            "aspect_pair_meanings_validated": False,
            "combined_judgement_validated": False,
            "scores_allowed": False,
            "event_judgement_allowed": False,
            "gemini_interpretation_allowed": False,
        },
        "policy": "Semantic vocabulary only. Do not infer concrete events, probability, health diagnoses, investment outcomes, relationship outcomes, or a net good/bad score.",
    }
