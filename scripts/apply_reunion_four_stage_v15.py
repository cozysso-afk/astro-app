from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def write(path, text):
    (ROOT / path).write_text(text, encoding='utf-8')


def once(text, old, new, label):
    n = text.count(old)
    if n != 1:
        raise RuntimeError(f'{label}: expected exactly one match, got {n}')
    return text.replace(old, new, 1)


def sub_once(text, pattern, repl, label, flags=0):
    out, n = re.subn(pattern, repl, text, count=1, flags=flags)
    if n != 1:
        raise RuntimeError(f'{label}: expected exactly one regex match, got {n}')
    return out


# 1) Canonical four-stage reunion dimensions.
reunion_dimension = r'''from __future__ import annotations

from typing import Any

# Product semantics: these four stages are deliberately orthogonal.
# Emotional activation must never be auto-promoted to contact, contact to a meeting,
# or a meeting to relationship rebuilding/reunion.
DIMENSIONS = (
    "emotional_reactivation",
    "contact_recontact",
    "in_person_meeting",
    "relationship_rebuilding",
)
FAST_TRIGGER_PLANETS = {"Sun", "Mercury", "Venus", "Mars"}

ASPECT_WEIGHTS = {
    "conjunction": 1.00,
    "opposition": 0.95,
    "square": 0.92,
    "trine": 0.82,
    "sextile": 0.76,
    "quincunx": 0.68,
}

# Product-interpretation weights only; never empirical event probabilities.
TRANSIT_WEIGHTS = {
    "emotional_reactivation": {
        "Sun": 0.60, "Mercury": 0.30, "Venus": 1.00, "Mars": 0.75,
        "Jupiter": 0.55, "Saturn": 0.35, "Uranus": 0.45, "Neptune": 0.75, "Pluto": 0.90,
    },
    "contact_recontact": {
        "Sun": 0.45, "Mercury": 1.00, "Venus": 0.85, "Mars": 0.65,
        "Jupiter": 0.35, "Saturn": 0.15, "Uranus": 0.55, "Neptune": 0.20, "Pluto": 0.25,
    },
    "in_person_meeting": {
        "Sun": 0.65, "Mercury": 0.70, "Venus": 0.95, "Mars": 0.95,
        "Jupiter": 0.50, "Saturn": 0.20, "Uranus": 0.55, "Neptune": 0.20, "Pluto": 0.30,
    },
    "relationship_rebuilding": {
        "Sun": 0.35, "Mercury": 0.45, "Venus": 0.70, "Mars": 0.30,
        "Jupiter": 0.95, "Saturn": 1.00, "Uranus": 0.20, "Neptune": 0.20, "Pluto": 0.45,
    },
}

TARGET_WEIGHTS = {
    "emotional_reactivation": {
        "Sun": 0.80, "Moon": 1.00, "Mercury": 0.30, "Venus": 1.00, "Mars": 0.75,
        "Jupiter": 0.45, "Saturn": 0.45, "Uranus": 0.40, "Neptune": 0.80, "Pluto": 0.90,
        "True Node": 0.50, "ASC": 0.50, "DSC": 0.75, "MC": 0.20, "IC": 0.55,
    },
    "contact_recontact": {
        "Sun": 0.65, "Moon": 0.50, "Mercury": 1.00, "Venus": 0.80, "Mars": 0.55,
        "Jupiter": 0.30, "Saturn": 0.30, "Uranus": 0.35, "Neptune": 0.30, "Pluto": 0.40,
        "True Node": 0.35, "ASC": 0.45, "DSC": 0.75, "MC": 0.25, "IC": 0.25,
    },
    "in_person_meeting": {
        "Sun": 0.70, "Moon": 0.65, "Mercury": 0.65, "Venus": 0.90, "Mars": 0.85,
        "Jupiter": 0.45, "Saturn": 0.25, "Uranus": 0.40, "Neptune": 0.25, "Pluto": 0.40,
        "True Node": 0.40, "ASC": 0.75, "DSC": 1.00, "MC": 0.20, "IC": 0.35,
    },
    "relationship_rebuilding": {
        "Sun": 0.75, "Moon": 0.55, "Mercury": 0.70, "Venus": 0.80, "Mars": 0.35,
        "Jupiter": 0.80, "Saturn": 1.00, "Uranus": 0.30, "Neptune": 0.30, "Pluto": 0.55,
        "True Node": 0.55, "ASC": 0.35, "DSC": 0.80, "MC": 0.35, "IC": 0.65,
    },
}

SECONDARY_POINTS = {
    "emotional_reactivation": {"Moon", "Venus", "Sun", "Mars", "Pluto", "Neptune"},
    "contact_recontact": {"Mercury", "Venus", "Sun", "Mars"},
    "in_person_meeting": {"Venus", "Mars", "Mercury", "Sun", "Moon", "ASC", "DSC"},
    "relationship_rebuilding": {"Saturn", "Jupiter", "Sun", "Venus", "Mercury", "True Node", "DSC", "IC"},
}

DIMENSION_LABELS = {
    "emotional_reactivation": "감정 활성",
    "contact_recontact": "연락·재접촉",
    "in_person_meeting": "실제 만남",
    "relationship_rebuilding": "관계 재결합",
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


def fast_trigger_evidence(hits: list[dict[str, Any]], dimension: str, minimum_score: float = 12.0) -> list[dict[str, Any]]:
    """Return fast-body evidence that is strong enough to justify a calendar-date candidate."""
    rows = []
    for hit in hits:
        if str(hit.get("transit") or "") not in FAST_TRIGGER_PLANETS:
            continue
        score = score_transit_hit(hit, dimension)
        if score < minimum_score:
            continue
        row = dict(hit)
        row["dimension_score"] = score
        row["exact_date_trigger"] = True
        row["event_probability"] = "not_calculated"
        rows.append(row)
    rows.sort(key=lambda row: (-float(row["dimension_score"]), float(row.get("orb") or 99.0)))
    return rows[:6]


def daily_dimension_scores(
    user_hits: list[dict[str, Any]],
    counterpart_hits: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    output: dict[str, dict[str, Any]] = {}
    for dimension in DIMENSIONS:
        user_score, user_evidence = dimension_side_score(user_hits, dimension)
        counterpart_score, counterpart_evidence = dimension_side_score(counterpart_hits, dimension)
        user_fast = fast_trigger_evidence(user_hits, dimension)
        counterpart_fast = fast_trigger_evidence(counterpart_hits, dimension)
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
            "fast_trigger": bool(user_fast or counterpart_fast),
            "fast_evidence": (counterpart_fast[:2] + user_fast[:2])[:4],
            "exact_date_basis": "fast_transit_trigger" if (user_fast or counterpart_fast) else "period_only",
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
            "period_role": "background_window_only",
            "exact_date_eligible": False,
            "policy": "secondary progression is period/background evidence only; it cannot create an exact calendar date without a fast transit trigger",
            "event_probability": "not_calculated",
        }
    return result
'''
write('reunion_dimension_v1.py', reunion_dimension)


# 2) Western relationship calculation: safe side activation, fast-trigger dates, return context, cross-system windows.
p = 'relationship_western_v1.py'
s = read(p)
s = once(s, 'from reunion_dimension_v1 import DIMENSIONS, daily_dimension_scores, secondary_support',
         'from reunion_dimension_v1 import DIMENSIONS, FAST_TRIGGER_PLANETS, daily_dimension_scores, secondary_support', 'western import')
s = once(s, 'ENGINE_VERSION = "relationship-western-v1.12-provisional-entered-time"',
         'ENGINE_VERSION = "relationship-western-v1.13-four-stage-gated-dates"', 'western version')

old = '''def _relationship_timing_stat(rows, key, label):\n    points = [\n        {"date": row["date"], "label": label, "score": float(row[key])}\n        for row in rows if isinstance(row.get(key), (int, float))\n    ]\n    if not points:\n        return None\n    avg = sum(point["score"] for point in points) / len(points)\n\n    def spaced(source, reverse, limit):\n        ordered = sorted(source, key=lambda x: x["score"], reverse=reverse)\n        selected = []\n        for point in ordered:\n            day = date.fromisoformat(point["date"])\n            if any(abs((day - date.fromisoformat(existing["date"])).days) <= 1 for existing in selected):\n                continue\n            selected.append({**point, "score": round(point["score"], 1)})\n            if len(selected) >= limit:\n                break\n        return selected\n\n    return {\n        "average": round(avg, 1),\n        "band": _relationship_timing_band(avg),\n        "spread": round(max(point["score"] for point in points) - min(point["score"] for point in points), 1),\n        "best_days": spaced(points, True, 7),\n        "caution_days": spaced(points, False, 5),\n    }\n'''
new = '''def _relationship_timing_stat(rows, key, label, date_gate_key=None):\n    points = [\n        {"date": row["date"], "label": label, "score": float(row[key]), "date_eligible": bool(row.get(date_gate_key)) if date_gate_key else True}\n        for row in rows if isinstance(row.get(key), (int, float))\n    ]\n    if not points:\n        return None\n    avg = sum(point["score"] for point in points) / len(points)\n    date_points = [point for point in points if point["date_eligible"]]\n\n    def spaced(source, reverse, limit):\n        ordered = sorted(source, key=lambda x: x["score"], reverse=reverse)\n        selected = []\n        for point in ordered:\n            day = date.fromisoformat(point["date"])\n            if any(abs((day - date.fromisoformat(existing["date"])).days) <= 1 for existing in selected):\n                continue\n            selected.append({"date": point["date"], "label": point["label"], "score": round(point["score"], 1)})\n            if len(selected) >= limit:\n                break\n        return selected\n\n    return {\n        "average": round(avg, 1),\n        "band": _relationship_timing_band(avg),\n        "spread": round(max(point["score"] for point in points) - min(point["score"] for point in points), 1),\n        "best_days": spaced(date_points, True, 7),\n        "caution_days": spaced(date_points, False, 5),\n        "exact_date_policy": "fast_trigger_required" if date_gate_key else "not_gated",\n    }\n'''
s = once(s, old, new, 'timing stat gate')

s = sub_once(s, r'def _relationship_directional_context\(rows, start_date, end_date\):.*?\n\n\ndef _dimension_timing_stat', r'''def _relationship_directional_context(rows, start_date, end_date):
    counterpart_label = "상대측 차트 활성도 · 상대가 먼저 연락한다는 뜻 아님"
    user_label = "내측 차트 활성도 · 내가 먼저 연락한다는 뜻 아님"
    reconnection_label = "두 차트 동시 재접점 활성도 · 실제 재회 확률 아님"
    months = {}
    for row in rows:
        months.setdefault(row["date"][:7], []).append(row)
    monthly = []
    for month_key, month_rows in sorted(months.items()):
        monthly.append({
            "calendar_month": month_key,
            "start": month_rows[0]["date"],
            "end": month_rows[-1]["date"],
            "incoming": _relationship_timing_stat(month_rows, "counterpart_score", counterpart_label, "date_trigger_eligible"),
            "outgoing": _relationship_timing_stat(month_rows, "user_score", user_label, "date_trigger_eligible"),
            "reconnection": _relationship_timing_stat(month_rows, "score", reconnection_label, "date_trigger_eligible"),
        })
    return {
        "period": {"start": start_date.isoformat(), "end": end_date.isoformat()},
        "incoming": _relationship_timing_stat(rows, "counterpart_score", counterpart_label, "date_trigger_eligible"),
        "outgoing": _relationship_timing_stat(rows, "user_score", user_label, "date_trigger_eligible"),
        "reconnection": _relationship_timing_stat(rows, "score", reconnection_label, "date_trigger_eligible"),
        "months": monthly,
        "source": "two-person relationship transit engine",
        "initiative_gate": {"available": False, "verdict": "undetermined", "reason": "side activation alone is not an action-direction indicator"},
        "policy": "incoming/outgoing are legacy field names for counterpart-side/user-side chart activation only. Never translate counterpart activation into 'counterpart contacts first' or user activation into 'user contacts first' without an independent directional action gate.",
    }


def _dimension_timing_stat''', 'directional context', flags=re.S)

s = sub_once(s, r'def _dimension_timing_stat\(rows, dimension, score_key, label\):.*?\n\n\ndef _reunion_dimension_context', r'''def _dimension_timing_stat(rows, dimension, score_key, label):
    adapted = []
    for row in rows:
        data = (row.get("dimensions") or {}).get(dimension) or {}
        value = data.get(score_key)
        if isinstance(value, (int, float)):
            adapted.append({"date": row["date"], "value": float(value), "stage_fast_trigger": bool(data.get("fast_trigger"))})
    return _relationship_timing_stat(adapted, "value", label, "stage_fast_trigger") if adapted else None


def _reunion_dimension_context''', 'dimension timing gate', flags=re.S)

s = sub_once(s, r'def _reunion_dimension_context\(rows, start_date, end_date\):.*?\n\n\ndef _build_reunion_transits', r'''def _reunion_dimension_context(rows, start_date, end_date):
    labels = {
        "emotional_reactivation": "감정 활성지수 · 실제 속마음/사건 확률 아님",
        "contact_recontact": "연락·재접촉 활성지수 · 사건 발생 확률 아님",
        "in_person_meeting": "실제 만남 활성지수 · 만남 발생 확률 아님",
        "relationship_rebuilding": "관계 재결합 지원 활성지수 · 실제 재결합/장기지속 확률 아님",
    }
    months = {}
    for row in rows:
        months.setdefault(row["date"][:7], []).append(row)

    result = {}
    for dimension in DIMENSIONS:
        monthly = []
        for month_key, month_rows in sorted(months.items()):
            monthly.append({
                "calendar_month": month_key,
                "start": month_rows[0]["date"],
                "end": month_rows[-1]["date"],
                "incoming": _dimension_timing_stat(month_rows, dimension, "counterpart_score", labels[dimension]),
                "outgoing": _dimension_timing_stat(month_rows, dimension, "user_score", labels[dimension]),
                "reconnection": _dimension_timing_stat(month_rows, dimension, "score", labels[dimension]),
            })
        ranked = sorted(rows, key=lambda row: -float(((row.get("dimensions") or {}).get(dimension) or {}).get("score") or 0.0))
        top_evidence = []
        for row in ranked:
            data = (row.get("dimensions") or {}).get(dimension) or {}
            if float(data.get("score") or 0.0) <= 0 or not data.get("fast_trigger"):
                continue
            day = date.fromisoformat(row["date"])
            if any(abs((day - date.fromisoformat(existing["date"])).days) <= 1 for existing in top_evidence):
                continue
            top_evidence.append({
                "date": row["date"],
                "score": data.get("score", 0.0),
                "user_score": data.get("user_score", 0.0),
                "counterpart_score": data.get("counterpart_score", 0.0),
                "user_evidence": list(data.get("user_evidence") or [])[:2],
                "counterpart_evidence": list(data.get("counterpart_evidence") or [])[:2],
                "fast_evidence": list(data.get("fast_evidence") or [])[:3],
                "exact_date_basis": "fast_transit_trigger",
                "event_probability": "not_calculated",
            })
            if len(top_evidence) >= 8:
                break
        result[dimension] = {
            "incoming": _dimension_timing_stat(rows, dimension, "counterpart_score", labels[dimension]),
            "outgoing": _dimension_timing_stat(rows, dimension, "user_score", labels[dimension]),
            "reconnection": _dimension_timing_stat(rows, dimension, "score", labels[dimension]),
            "months": monthly,
            "top_evidence": top_evidence,
            "event_probability": "not_calculated",
        }
    return {
        **result,
        "period": {"start": start_date.isoformat(), "end": end_date.isoformat()},
        "stage_order": list(DIMENSIONS),
        "policy": "emotion, contact/recontact, in-person meeting, and relationship rebuilding/reunion are orthogonal activation stages. No stage auto-escalates into the next. Legacy incoming/outgoing fields are side activation only, not who acts first. Exact dates require a fast transit trigger; no overall reunion score or event probability is calculated.",
    }


def _build_reunion_transits''', 'four-stage context', flags=re.S)

s = sub_once(s, r'def _build_reunion_transits\(user_natal, cp_natal, start_date, end_date, utc_offset_hours\):.*?\n\n\ndef _norm', r'''def _build_reunion_transits(user_natal, cp_natal, start_date, end_date, utc_offset_hours):
    rows = []
    cursor = start_date
    while cursor <= end_date:
        target_utc = _local_noon_utc(cursor, utc_offset_hours)
        transit_chart = _chart_from_jd(_jd_from_utc(target_utc), include_moon=False, include_angles=False)
        user_hits = _transit_hits(transit_chart, user_natal, "user")
        cp_hits = _transit_hits(transit_chart, cp_natal, "counterpart")
        user_score = _side_trigger_score(user_hits)
        cp_score = _side_trigger_score(cp_hits)
        shared_bonus = 8.0 if user_score >= 35 and cp_score >= 35 else 0.0
        combined = round(min(100.0, user_score * .45 + cp_score * .55 + shared_bonus), 1)
        dimensions = daily_dimension_scores(user_hits, cp_hits)
        all_hits = cp_hits + user_hits
        return_hits = [
            dict(hit, return_type=f"{hit.get('transit')}_natal_return", independence_group="daily_transit_same_phenomenon", independent_bonus_eligible=False)
            for hit in all_hits
            if hit.get("transit") in FAST_TRIGGER_PLANETS and hit.get("transit") == hit.get("target") and hit.get("aspect") == "conjunction"
        ]
        rows.append({
            "date": cursor.isoformat(),
            "score": combined,
            "user_score": user_score,
            "counterpart_score": cp_score,
            "shared_activation": bool(user_score >= 25 and cp_score >= 25),
            "date_trigger_eligible": any(bool(x.get("fast_trigger")) for x in dimensions.values()),
            "hits": all_hits[:6],
            "return_hits": return_hits[:4],
            "dimensions": dimensions,
        })
        cursor += timedelta(days=1)

    eligible_rows = [row for row in rows if row.get("date_trigger_eligible")]
    ranked = sorted(eligible_rows, key=lambda x: (-x["score"], x["date"]))
    top_days = []
    for row in ranked:
        d = date.fromisoformat(row["date"])
        if any(abs((d - date.fromisoformat(existing["date"])).days) <= 1 for existing in top_days):
            continue
        top_days.append(row)
        if len(top_days) >= 18:
            break

    months = {}
    for row in rows:
        key = row["date"][:7]
        months.setdefault(key, []).append(row)
    top_months = []
    for key, month_rows in months.items():
        trigger_rows = [x for x in month_rows if x.get("date_trigger_eligible")]
        if not trigger_rows:
            continue
        strongest = sorted(trigger_rows, key=lambda x: x["score"], reverse=True)[:5]
        score = round(sum(x["score"] for x in strongest) / max(1, len(strongest)), 1)
        top_months.append({"calendar_month": key, "score": score, "top_dates": [x["date"] for x in strongest[:3]], "exact_date_basis": "fast_transit_trigger"})
    top_months.sort(key=lambda x: (-x["score"], x["calendar_month"]))
    return {
        "available": True,
        "period": {"start": start_date.isoformat(), "end": end_date.isoformat()},
        "policy": "daily transits to both natal charts; exact-date candidates require a fast Sun/Mercury/Venus/Mars trigger. Slow or progression evidence alone remains period-level context and never creates a date.",
        "top_days": top_days,
        "top_months": top_months[:12],
        "return_support": {
            "policy": "planetary return is a labeled transit-to-same-natal-planet conjunction. Because it is the same astronomical phenomenon as the daily transit, it is context only and never counted as an independent convergence bonus.",
            "days": [{"date": row["date"], "hits": row.get("return_hits", [])} for row in rows if row.get("return_hits")][:18],
        },
        "directional_context": _relationship_directional_context(rows, start_date, end_date),
        "dimensions": _reunion_dimension_context(rows, start_date, end_date),
    }


def _build_reunion_timing_windows(transit_layer, secondary_packet):
    if not isinstance(transit_layer, dict) or not transit_layer.get("available"):
        return {"windows": [], "policy": "no daily transit layer; no exact dates", "event_probability": "not_calculated"}
    secondary_by_month = {
        str(row.get("calendar_month")): (row.get("dimensions") or {})
        for row in (secondary_packet or {}).get("months", []) if isinstance(row, dict)
    }
    windows = []
    for day in transit_layer.get("top_days") or []:
        month_support = secondary_by_month.get(str(day.get("date", ""))[:7], {})
        for stage in DIMENSIONS:
            stage_data = (day.get("dimensions") or {}).get(stage) or {}
            if not stage_data.get("fast_trigger") or float(stage_data.get("score") or 0.0) <= 0:
                continue
            secondary = month_support.get(stage) or {}
            progression_supported = bool(secondary.get("evidence"))
            families = ["daily_transit"] + (["secondary_progression"] if progression_supported else [])
            rank_weight = round(float(stage_data.get("score") or 0.0) + (8.0 if progression_supported else 0.0), 1)
            windows.append({
                "date": day.get("date"),
                "stage": stage,
                "label": stage_data.get("label"),
                "activation": round(float(stage_data.get("score") or 0.0), 1),
                "rank_weight": rank_weight,
                "fast_evidence": list(stage_data.get("fast_evidence") or [])[:3],
                "period_support": list(secondary.get("evidence") or [])[:3],
                "independent_systems": families,
                "independent_system_count": len(families),
                "convergence": len(families) >= 2,
                "return_context": list(day.get("return_hits") or [])[:2],
                "exact_date_basis": "fast_transit_trigger",
                "event_probability": "not_calculated",
            })
    windows.sort(key=lambda row: (-int(bool(row["convergence"])), -float(row["rank_weight"]), str(row["date"]), str(row["stage"])))
    return {
        "windows": windows[:24],
        "policy": "progression is period/background evidence only. A calendar date appears only when a fast transit trigger exists; progression may raise ranking when it overlaps the same stage. Planetary return context is deduplicated from its underlying transit and adds no independent vote.",
        "event_probability": "not_calculated",
    }


def _norm''', 'transit and timing windows', flags=re.S)

# Final cross-system timing packet is created only after progression months exist.
old = '''    if analysis_mode == "reunion":\n        result["reunion_secondary_support"] = {\n            "months": [\n                {"calendar_month": row["calendar_month"], "representative_date": row["representative_date"], "dimensions": row.get("reunion_secondary_support")}\n                for row in monthly\n            ],\n            "policy": "secondary progressed synastry and progressed composite are higher-priority timing evidence and remain separate from daily transit activation scores; Marks/Tertiary stays supplementary and is not folded into these primary dimension supports",\n            "event_probability": "not_calculated",\n        }\n'''
new = '''    if analysis_mode == "reunion":\n        result["reunion_secondary_support"] = {\n            "months": [\n                {"calendar_month": row["calendar_month"], "representative_date": row["representative_date"], "dimensions": row.get("reunion_secondary_support")}\n                for row in monthly\n            ],\n            "policy": "secondary progressed synastry and progressed composite are period/background evidence only and remain separate from daily transit activation scores; they cannot create an exact date without a fast trigger. Marks/Tertiary stays supplementary.",\n            "event_probability": "not_calculated",\n        }\n        result["reunion_timing_windows"] = _build_reunion_timing_windows(result.get("reunion_transits"), result["reunion_secondary_support"])\n        result["reunion_return_support"] = (result.get("reunion_transits") or {}).get("return_support")\n'''
s = once(s, old, new, 'final timing windows')

s = once(s,
'''        "reunion_dimensions": "For reunion mode keep three orthogonal outcomes separate: contact/recontact activation, emotional/relationship reactivation, and relationship-rebuilding support. Within every dimension keep incoming, outgoing and reconnection separate. Never collapse them into one reunion score.",\n        "birth_time":''',
'''        "reunion_dimensions": "For reunion mode keep four orthogonal stages separate: emotional activation, contact/recontact, in-person meeting, and relationship rebuilding/reunion. One stage never auto-escalates to the next. Legacy incoming/outgoing fields are counterpart-side/user-side activation only, never who contacts first.",\n        "reunion_dates": "Secondary progression is period context. Exact dates require fast Sun/Mercury/Venus/Mars transit evidence. Planetary return is deduplicated from the same transit phenomenon and cannot add an independent convergence vote.",\n        "birth_time":''', 'interpretation policy')
write(p, s)


# 3) Calculation tests: four stages, gated dates, no false initiative direction.
p = 'tests/test_reunion_dimensions_v14.py'
s = read(p)
s = once(s, 'def test_dimension_policy_has_exactly_three_orthogonal_axes():\n    assert DIMENSIONS == ("contact_recontact", "emotional_reactivation", "relationship_rebuilding")',
'''def test_dimension_policy_has_exactly_four_orthogonal_axes():
    assert DIMENSIONS == ("emotional_reactivation", "contact_recontact", "in_person_meeting", "relationship_rebuilding")''', 'dimension test')
s = once(s, 'def test_reunion_transit_builder_exposes_three_axes_without_overwriting_directional_context(monkeypatch):', 'def test_reunion_transit_builder_exposes_four_axes_without_promoting_side_activation_to_initiative(monkeypatch):', 'transit test name')
s = once(s, '    assert out["directional_context"]["incoming"] is not None\n    assert out["directional_context"]["outgoing"] is not None',
'''    assert out["directional_context"]["incoming"] is not None
    assert out["directional_context"]["outgoing"] is not None
    assert out["directional_context"]["initiative_gate"]["available"] is False
    assert out["directional_context"]["initiative_gate"]["verdict"] == "undetermined"
    assert "in_person_meeting" in out["dimensions"]''', 'safe side activation assertions')
s = once(s, '    assert "overall reunion score" in dimensions["policy"]', '    assert "No stage auto-escalates" in dimensions["policy"]', 'policy assertion')
s = once(s, '    rebuilding = support["relationship_rebuilding"]\n    assert rebuilding["score"] is None',
'''    rebuilding = support["relationship_rebuilding"]
    assert "in_person_meeting" in support
    assert support["in_person_meeting"]["exact_date_eligible"] is False
    assert rebuilding["score"] is None''', 'secondary meeting assertion')
s = once(s, '    assert out["engine"] == "relationship-western-v1.12-provisional-entered-time"', '    assert out["engine"] == "relationship-western-v1.13-four-stage-gated-dates"', 'engine assertion')
s = once(s, '    assert out["reunion_secondary_support"]["event_probability"] == "not_calculated"',
'''    assert out["reunion_secondary_support"]["event_probability"] == "not_calculated"
    assert out["reunion_timing_windows"]["event_probability"] == "not_calculated"
    for row in out["reunion_timing_windows"]["windows"]:
        assert row["exact_date_basis"] == "fast_transit_trigger"
        assert "daily_transit" in row["independent_systems"]''', 'timing window assertions')
write(p, s)

p = 'tests/test_relationship_api_e2e_v15.py'
s = read(p)
s = s.replace('(\"contact_recontact\", \"emotional_reactivation\", \"relationship_rebuilding\")', '(\"emotional_reactivation\", \"contact_recontact\", \"in_person_meeting\", \"relationship_rebuilding\")')
write(p, s)


# 4) Browser/external prompt transport: carry all four stages and exact-date gate packet.
p = 'web/src/lib/resultFormatters.ts'
s = read(p)
s = once(s,
"return {period:row.period ?? null,contact_recontact:one('contact_recontact'),emotional_reactivation:one('emotional_reactivation'),relationship_rebuilding:one('relationship_rebuilding'),policy:row.policy ?? null}",
"return {period:row.period ?? null,emotional_reactivation:one('emotional_reactivation'),contact_recontact:one('contact_recontact'),in_person_meeting:one('in_person_meeting'),relationship_rebuilding:one('relationship_rebuilding'),policy:row.policy ?? null}", 'formatter four dims')
s = once(s,
"return {calendar_month:m.calendar_month ?? null,representative_date:m.representative_date ?? null,dimensions:{contact_recontact:compactSecondaryDimensionForExternal(d.contact_recontact,evidenceLimit),emotional_reactivation:compactSecondaryDimensionForExternal(d.emotional_reactivation,evidenceLimit),relationship_rebuilding:compactSecondaryDimensionForExternal(d.relationship_rebuilding,evidenceLimit)}}",
"return {calendar_month:m.calendar_month ?? null,representative_date:m.representative_date ?? null,dimensions:{emotional_reactivation:compactSecondaryDimensionForExternal(d.emotional_reactivation,evidenceLimit),contact_recontact:compactSecondaryDimensionForExternal(d.contact_recontact,evidenceLimit),in_person_meeting:compactSecondaryDimensionForExternal(d.in_person_meeting,evidenceLimit),relationship_rebuilding:compactSecondaryDimensionForExternal(d.relationship_rebuilding,evidenceLimit)}}", 'formatter secondary four dims')
s = once(s, '    reunion_secondary_support: compactReunionSecondarySupportForExternal(rawResult.reunion_secondary_support,caps.months,caps.tight),',
'''    reunion_secondary_support: compactReunionSecondarySupportForExternal(rawResult.reunion_secondary_support,caps.months,caps.tight),
    reunion_timing_windows: rawResult.reunion_timing_windows ?? null,
    reunion_return_support: rawResult.reunion_return_support ?? null,''', 'formatter gated packets')
s = once(s,
"? '- 재회는 ① 연락/재접촉 활성화 ② 감정 재활성화 ③ 실제 관계 재구축 가능성을 서로 다른 층으로 분리한다. 수신(상대→나)·발신(나→상대)·과거인연 재접점도 섞지 않는다.'",
"? '- 재회는 ① 감정 활성 ② 연락·재접촉 ③ 실제 만남 ④ 관계 재결합을 서로 독립된 단계로 계산한다. 앞 단계가 강해도 다음 단계로 자동 승격하지 않는다. 상대측/내측 활성만으로 누가 먼저 연락한다고 판정하지 않는다.'", 'external mode rule')
s = once(s,
"kind === 'reunion' ? '- 재회운은 reunion_dimensions의 연락·재접촉 / 감정·관계 재활성 / 관계 재구축 지원층을 분리하고, 각 축의 incoming/outgoing/reconnection도 합치지 않는다. reunion_secondary_support는 daily transit 점수와 합산하지 않는다.' : '',",
"kind === 'reunion' ? '- 재회운은 reunion_dimensions의 감정 활성 / 연락·재접촉 / 실제 만남 / 관계 재결합을 분리한다. incoming/outgoing은 상대측/내측 활성이지 행동 방향이 아니다. reunion_secondary_support는 기간 배경이며 exact date를 만들지 않는다.' : '',", 'external four-stage rule')
s = once(s,
"kind === 'reunion' ? '- 수신(상대→나)·발신(나→상대)·재접점을 따로 읽고, directional 날짜와 reunion_transits의 실제 날짜가 겹치는지 교차검증한다.' : '',",
"kind === 'reunion' ? '- 정확한 날짜는 reunion_timing_windows에 실제 존재하는 fast-trigger 날짜만 쓴다. 진행각은 기간 신호로만 읽고 날짜를 만들지 않는다. 상대측/내측 활성은 선연락 주체 판정에 사용하지 않는다.' : '',", 'external date gate rule')
s = once(s,
"kind === 'reunion' ? '재회에서는 reunion_dimensions, reunion_directional_context, reunion_transits, secondary support를 다른 층으로 읽는다. 재접촉 활성도는 재회 성공 확률이 아니다.' : '',",
"kind === 'reunion' ? '재회에서는 reunion_dimensions, reunion_timing_windows, reunion_directional_context, reunion_transits, secondary support를 다른 층으로 읽는다. 감정 활성≠연락≠만남≠재결합이며 재접촉 활성도는 재회 성공 확률이 아니다.' : '',", 'external stage inequality')
write(p, s)

p = 'web/src/lib/compactDeepPrompt.ts'
s = read(p)
s = once(s, "['contact_recontact','emotional_reactivation','relationship_rebuilding']", "['emotional_reactivation','contact_recontact','in_person_meeting','relationship_rebuilding']", 'compact prompt dims')
# Carry gated dates if the compact object has a reunion branch.
needle = "reunion_directional_context:kind==='reunion'?directions(timing):undefined,"
if needle in s:
    s = once(s, needle, needle + "\n    reunion_timing_windows:kind==='reunion'?pick(r.reunion_timing_windows,['windows','policy']):undefined,", 'compact gated windows')
write(p, s)


# 5) Built-in relationship interpreter: four stages, safe initiative, gated dates.
p = 'supabase/functions/relationship-interpret-v9-preview/index.ts'
s = read(p)
s = once(s, 'const REUNION_VERSION="relationship-v11.10-provisional-time-reference";', 'const REUNION_VERSION="relationship-v11.11-four-stage-gated-dates";', 'reunion interpreter version')
s = once(s,
'return {contact_recontact:one(raw?.contact_recontact),emotional_reactivation:one(raw?.emotional_reactivation),relationship_rebuilding:one(raw?.relationship_rebuilding),policy:raw?.policy??null};',
'return {emotional_reactivation:one(raw?.emotional_reactivation),contact_recontact:one(raw?.contact_recontact),in_person_meeting:one(raw?.in_person_meeting),relationship_rebuilding:one(raw?.relationship_rebuilding),policy:raw?.policy??null};', 'edge four dims')
s = once(s,
'return {months,policy:raw?.policy??null,event_probability:"not_calculated"};',
'return {months,policy:raw?.policy??null,event_probability:"not_calculated"};', 'edge secondary anchor')  # anchor check only
s = once(s,
'dimensions:{contact_recontact:secondaryDimensionPacket(m?.dimensions?.contact_recontact,n),emotional_reactivation:secondaryDimensionPacket(m?.dimensions?.emotional_reactivation,n),relationship_rebuilding:secondaryDimensionPacket(m?.dimensions?.relationship_rebuilding,n)}',
'dimensions:{emotional_reactivation:secondaryDimensionPacket(m?.dimensions?.emotional_reactivation,n),contact_recontact:secondaryDimensionPacket(m?.dimensions?.contact_recontact,n),in_person_meeting:secondaryDimensionPacket(m?.dimensions?.in_person_meeting,n),relationship_rebuilding:secondaryDimensionPacket(m?.dimensions?.relationship_rebuilding,n)}', 'edge secondary dims')
s = once(s,
'   reunion_secondary_support:purpose==="reunion"?secondarySupportPacket(r?.reunion_secondary_support,L.months):null,\n   transit_triggers:trans?{period:trans?.period,policy:trans?.policy,top_days:transitDays,top_months:transitMonths}:null,',
'   reunion_secondary_support:purpose==="reunion"?secondarySupportPacket(r?.reunion_secondary_support,L.months):null,\n   reunion_timing_windows:purpose==="reunion"?r?.reunion_timing_windows??null:null,\n   reunion_return_support:purpose==="reunion"?r?.reunion_return_support??null:null,\n   transit_triggers:trans?{period:trans?.period,policy:trans?.policy,top_days:transitDays,top_months:transitMonths}:null,', 'edge gated packet')
s = once(s,
'- 재회운에서는 CALCULATED_DATA.reunion_dimensions의 ① contact_recontact(연락·재접촉) ② emotional_reactivation(감정·관계 재활성) ③ relationship_rebuilding(관계 재구축 지원층)을 절대 하나의 재회 점수로 합치지 않는다. 각 축 안에서도 incoming(상대측)·outgoing(내측)·reconnection(동시 재접점)을 분리한다.',
'- 재회운에서는 CALCULATED_DATA.reunion_dimensions의 ① emotional_reactivation(감정 활성) ② contact_recontact(연락·재접촉) ③ in_person_meeting(실제 만남) ④ relationship_rebuilding(관계 재결합)을 절대 하나로 합치지 않는다. 감정 활성↑ ≠ 연락↑ ≠ 만남↑ ≠ 재결합↑이다. incoming/outgoing은 상대측/내측 차트 활성이지 선연락 주체가 아니다.', 'edge system stages')
# Add hard timing/direction rules near existing secondary rule.
s = once(s,
'- reunion_secondary_support는 daily transit 점수와 합산하지 않는다. Secondary Progression(2차 진행)은 Daily Transit보다 상위 근거로 읽고, Marks/Tertiary 단독 신호로 관계 재구축 결론을 뒤집지 않는다.',
'- reunion_secondary_support는 daily transit 점수와 합산하지 않는다. Secondary Progression(2차 진행)은 기간/배경 신호로만 읽고 정확한 날짜를 만들지 않는다. 특정 날짜는 CALCULATED_DATA.reunion_timing_windows에 존재하는 fast transit trigger 날짜만 제시한다. Marks/Tertiary 단독 신호로 관계 재결합 결론을 뒤집지 않는다.\n- 누가 먼저 움직이는지는 reunion_evidence_v2.initiative_gate가 available=true일 때만 방향을 말한다. false면 반드시 판정 불가로 쓰고, 상대측 활성만으로 상대가 먼저 연락한다고 단정하지 않는다.\n- Return(회귀)이 Daily Transit과 같은 현상을 재표현한 경우 독립 근거로 중복 가산하지 않는다.', 'edge progression and direction policy')
s = once(s,
'purpose==="reunion"?"재회운이다. reunion_evidence_v2의 다섯 질문을 순서대로 종합하고, 각 핵심 섹션의 evidence_refs에는 반드시 실제 제공된 ID만 사용하라. 같은 원자료 파생 신호를 여러 표에서 반복해 강도를 부풀리지 말고, 독립 계열이 충돌하면 평균내지 말고 왜 연락 재개와 관계 재구축이 다르게 보이는지 설명하라. 범용 상담문구 대신 차트 레이어 간 일치·충돌을 현실 관계 장면으로 번역하라."',
'purpose==="reunion"?"재회운이다. 감정 활성→연락·재접촉→실제 만남→관계 재결합을 네 개의 독립 단계로 읽고 절대 자동 승격하지 마라. reunion_evidence_v2의 다섯 질문을 순서대로 종합하되 initiative_gate가 닫혀 있으면 누가 먼저 연락하는지 판정하지 않는다. 정확한 날짜는 reunion_timing_windows에 있는 fast-trigger 날짜만 사용한다. 같은 원자료 파생 신호를 여러 표에서 반복해 강도를 부풀리지 말고, 독립 계열이 충돌하면 평균내지 말고 단계별로 왜 다른지 설명하라. 범용 상담문구 대신 차트 레이어 간 일치·충돌을 현실 관계 장면으로 번역하라."', 'edge mode instruction')
write(p, s)


# 6) Evidence ledger: directional action gate and meeting dimension.
p = 'supabase/functions/relationship-interpret-v9-preview/reunionEvidenceV2.ts'
s = read(p)
s = once(s, "export const REUNION_EVIDENCE_VERSION = 'reunion-evidence-v2.1-editorial-polish'", "export const REUNION_EVIDENCE_VERSION = 'reunion-evidence-v2.2-four-stage-direction-gate'", 'evidence version')
s = once(s,
"      for (const a of arr(mt?.user?.to_base_marks_aspects).slice(0,2)) addAspect(items,'timing','marks_tertiary.user','tertiary','marks_tertiary',a,undefined,period,'outgoing')\n      for (const a of arr(mt?.counterpart?.to_base_marks_aspects).slice(0,2)) addAspect(items,'timing','marks_tertiary.counterpart','tertiary','marks_tertiary',a,undefined,period,'incoming')",
"      for (const a of arr(mt?.user?.to_base_marks_aspects).slice(0,2)) addAspect(items,'initiative','marks_tertiary.user','tertiary','marks_tertiary',a,undefined,period,'outgoing')\n      for (const a of arr(mt?.counterpart?.to_base_marks_aspects).slice(0,2)) addAspect(items,'initiative','marks_tertiary.counterpart','tertiary','marks_tertiary',a,undefined,period,'incoming')", 'marks initiative evidence')
s = once(s,
"  addMetric(items,'timing','dimension.contact_recontact','dimension_metric',dims?.contact_recontact?.reconnection,'shared')\n  addMetric(items,'why_reconnect','dimension.emotional_reactivation','dimension_metric',dims?.emotional_reactivation?.reconnection,'shared')\n  addMetric(items,'rebuild','dimension.relationship_rebuilding','dimension_metric',dims?.relationship_rebuilding?.reconnection,'shared')",
"  addMetric(items,'why_reconnect','dimension.emotional_reactivation','dimension_metric',dims?.emotional_reactivation?.reconnection,'shared')\n  addMetric(items,'timing','dimension.contact_recontact','dimension_metric',dims?.contact_recontact?.reconnection,'shared')\n  addMetric(items,'timing','dimension.in_person_meeting','dimension_metric',dims?.in_person_meeting?.reconnection,'shared')\n  addMetric(items,'rebuild','dimension.relationship_rebuilding','dimension_metric',dims?.relationship_rebuilding?.reconnection,'shared')", 'evidence four dims')
s = once(s,
"    for (const [name,q] of [['contact_recontact','timing'],['emotional_reactivation','why_reconnect'],['relationship_rebuilding','rebuild']] as const) {",
"    for (const [name,q] of [['emotional_reactivation','why_reconnect'],['contact_recontact','timing'],['in_person_meeting','timing'],['relationship_rebuilding','rebuild']] as const) {", 'secondary four dims')
# Insert action-direction gate before build function return.
anchor = "  const coverage = {\n"
gate_code = r'''  const actionTerms = ['Mercury','Venus','Mars','Sun']
  const directionalRows = evidence.filter(e => e.question === 'initiative' && (e.direction === 'incoming' || e.direction === 'outgoing') && e.aspect && (e.independence_group === 'secondary_progression' || e.independence_group === 'marks_tertiary') && actionTerms.some(term => String(e.aspect).includes(term)))
  const gateSide = (direction: 'incoming'|'outgoing') => {
    const rows = directionalRows.filter(e => e.direction === direction)
    const groups = [...new Set(rows.map(e=>e.independence_group))]
    return {independent_groups:groups,evidence_refs:rows.slice(0,6).map(e=>e.id),qualified:groups.length>=2}
  }
  const incomingGate = gateSide('incoming'), outgoingGate = gateSide('outgoing')
  const gateAvailable = incomingGate.qualified !== outgoingGate.qualified && (incomingGate.qualified || outgoingGate.qualified)
  const initiative_gate = {
    available: gateAvailable,
    verdict: gateAvailable ? (incomingGate.qualified ? 'counterpart_to_user' : 'user_to_counterpart') : 'undetermined',
    incoming: incomingGate,
    outgoing: outgoingGate,
    policy: 'Side-level transit metrics are excluded. A first-move direction requires at least two independent directional action families aligned on one side; otherwise the result is undetermined.',
  }

'''
s = once(s, anchor, gate_code + anchor, 'initiative gate insert')
s = once(s,
"return {version:REUNION_EVIDENCE_VERSION,policy:'Question-first evidence matrix. Convergence requires at least two independent families aligned as support or counter evidence; context and derived duplicates are not additive probabilities. In user-facing prose, do not re-explain the same aspect across multiple questions, prefer Korean planet/aspect names, and display angular precision no finer than 0.1°.',coverage,questions,evidence:evidence.slice(0,36),convergence}",
"return {version:REUNION_EVIDENCE_VERSION,policy:'Question-first evidence matrix. Convergence requires at least two independent families aligned as support or counter evidence; context and derived duplicates are not additive probabilities. Emotion, contact, meeting, and reunion are separate stages. Progression is period context; exact dates require fast triggers. Return labels that restate the same transit phenomenon do not add an independent vote. In user-facing prose, do not re-explain the same aspect across multiple questions, prefer Korean planet/aspect names, and display angular precision to 0.01° with values below 0.01° shown as <0.01°.',coverage,questions,evidence:evidence.slice(0,36),convergence,initiative_gate}", 'evidence return gate')
write(p, s)


# 7) Grounding: 0.01° precision, safe direction labels, exact-date allowlist and initiative override.
p = 'supabase/functions/relationship-interpret-v9-preview/reunionGroundingV2.ts'
s = read(p)
s = sub_once(s, r'function normalizeDegreePrecision\(value: string\) \{.*?\n\}', r'''function normalizeDegreePrecision(value: string) {
  return value.replace(/(\d+\.\d{2,})\s*°/g, (_m, raw) => {
    const n = Number(raw)
    if (!Number.isFinite(n)) return `${raw}°`
    if (n >= 0 && n < 0.005) return '0.01° 미만'
    return `${n.toFixed(2)}°`
  })
}''', 'degree precision', flags=re.S)
s = once(s, ".replace(/\\bincoming\\b/gi, '상대→나')\n    .replace(/\\boutgoing\\b/gi, '나→상대')", ".replace(/\\bincoming\\b/gi, '상대측 활성')\n    .replace(/\\boutgoing\\b/gi, '내측 활성')", 'safe direction terminology')
s = once(s, ".replace(/(?:오차|오브)\\s*0\\.1° 미만(?:\\s*수준)?의?\\s*(?:극도로\\s*)?정밀한/g, '아주 가까운')", ".replace(/(?:오차|오브)\\s*0\\.01° 미만(?:\\s*수준)?의?\\s*(?:극도로\\s*)?정밀한/g, '아주 가까운')", 'tiny orb wording')
# Insert exact-date filter helpers before hasCoreText.
anchor = 'function hasCoreText(v: any) {'
helpers = r'''function allowedTimingDates(payload: any) {
  return new Set(arr(payload?.reunion_timing_windows?.windows).map((x:any)=>text(x?.date)).filter((x:string)=>/^\d{4}-\d{2}-\d{2}$/.test(x)))
}

function timingWindowAllowed(window: any, allowed: Set<string>) {
  if (!allowed.size) return true
  const found = text(window?.period).match(/\d{4}-\d{2}-\d{2}/g) ?? []
  return !found.length || found.every((x:string)=>allowed.has(x))
}

'''
s = once(s, anchor, helpers + anchor, 'timing allowlist helpers')
# After v2 object creation, filter timing windows and enforce gate. Find convergence block end before summary.
needle = '''  if (text(v2.summary).length < 180) v2.summary = composeSummary(v2)'''
insert = r'''  const allowedDates = allowedTimingDates(payload)
  v2.timing = { ...v2.timing, windows: arr(v2?.timing?.windows).filter((w:any)=>timingWindowAllowed(w, allowedDates)) }
  const gate = payload?.reunion_evidence_v2?.initiative_gate
  if (gate?.available !== true) {
    v2.initiative = {
      ...v2.initiative,
      conclusion: '현재 계산만으로 누가 먼저 연락한다고 판정하지 않는다.',
      interpretation: '상대측 활성과 내측 활성은 각 차트가 자극받는 정도일 뿐 실제 행동 방향이 아니다. 서로 독립된 방향성 행동 근거가 충분히 겹치지 않아 선연락 주체는 판정 불가다.',
      evidence_refs: normalizeRefs(v2?.initiative?.evidence_refs, fallbacks.initiative, valid),
    }
  }

'''
s = once(s, needle, insert + needle, 'grounding gates')
write(p, s)


# 8) Mobile UI: never label side activation as first-contact direction; precise orb text.
p = 'web/src/ReunionPanels.tsx'
s = read(p)
s = once(s, "function reunionScoreBand(score: number) {", "function orbText(value: number) { const n=Math.abs(Number(value)); return n<0.005?'<0.01°':`${n.toFixed(2)}°` }\n\nfunction reunionScoreBand(score: number) {", 'orb helper')
s = once(s, "<span>수신·발신·과거인연 재접점 흐름을 같은 기간에서 따로 계산하고 있어.</span>", "<span>감정·연락·만남·재결합과 양측 활성 흐름을 분리해서 계산하고 있어.</span>", 'loading copy')
s = once(s, "{ key: 'incoming', title: '상대측 → 관계 · 수신 참고신호', desc: '상대 차트 쪽 관계 트랜짓 활성도. 실제 연락 의도나 확률은 아님', stat: context.incoming },", "{ key: 'incoming', title: '상대측 활성', desc: '상대 차트 쪽 활성도. 상대가 먼저 연락한다는 뜻은 아님', stat: context.incoming },", 'counterpart UI label')
s = once(s, "{ key: 'outgoing', title: '나 → 상대 · 발신 참고신호', desc: '내 차트 쪽 관계 트랜짓 활성도. 실제 연락 결과 확률은 아님', stat: context.outgoing },", "{ key: 'outgoing', title: '내측 활성', desc: '내 차트 쪽 활성도. 내가 먼저 연락한다는 뜻은 아님', stat: context.outgoing },", 'user UI label')
s = once(s, '<div className="result-card-title"><span>REUNION TIMING</span><strong>재회운 · 연락 방향과 시기</strong></div>', '<div className="result-card-title"><span>REUNION TIMING</span><strong>재회운 · 양측 활성과 시기</strong></div>', 'timing title')
s = once(s, '0~100 값은 실제 연락 확률 %가 아니라 점성 계산의 상대 활성도 지수야. 두 사람 차트의 방향별 활성도를 섞지 않고 따로 봐. 상대의 속마음이나 실제 행동 확률을 뜻하지 않아.', '0~100 값은 실제 연락 확률 %가 아니라 점성 계산의 상대 활성도 지수야. 상대측/내측 활성은 누가 먼저 연락하는지 판정하는 값이 아니고, 실제 방향성 근거가 따로 있을 때만 선행 행동을 판단해.', 'timing note')
s = once(s, "const hitText = (hit:any) => `${pointKo[hit.transit]||hit.transit} → ${hit.person==='counterpart'?'상대':'나'} ${pointKo[hit.target]||hit.target} ${aspectKo[hit.aspect]||hit.aspect} · 오브 ${Number(hit.orb).toFixed(2)}°`", "const hitText = (hit:any) => `${pointKo[hit.transit]||hit.transit} → ${hit.person==='counterpart'?'상대':'나'} ${pointKo[hit.target]||hit.target} ${aspectKo[hit.aspect]||hit.aspect} · 오브 ${orbText(Number(hit.orb))}`", 'transit orb text')
write(p, s)

p = 'web/src/RelationshipInterpretationPanel.tsx'
s = read(p)
s = sub_once(s, r'  const reunionInitiativeSummary = \(\(\) => \{.*?\n  \}\)\(\)', r'''  const reunionInitiativeSummary = (() => {
    if (!reunion || !timing) return ''
    return '현재 상대측/내측 활성도만으로 누가 먼저 연락한다고 판정하지 않아. 실제 방향성 행동 근거가 서로 독립된 체계에서 확인될 때만 방향을 제시해.'
  })()''', 'safe initiative summary', flags=re.S)
s = once(s, "{ stat: timing.incoming, label: '상대 → 나' },\n      { stat: timing.outgoing, label: '나 → 상대' },", "{ stat: timing.incoming, label: '상대측 활성' },\n      { stat: timing.outgoing, label: '내측 활성' },", 'date highlight labels')
write(p, s)

print('reunion four-stage v15 migration applied')
