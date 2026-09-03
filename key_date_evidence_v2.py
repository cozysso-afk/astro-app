# -*- coding: utf-8 -*-
"""Selective evidence enrichment for important Western dates.

The annual engine already scans every day for relative topic scores. Re-running a
full high-resolution year just to explain a handful of dates would waste CPU.
This module therefore ranks the dates already selected by the deterministic
period engine and reuses the engine's cached 08:00~22:00 / 120-minute snapshots
for only the most salient dates. The result is actual aspect/house evidence for
the dates shown to the user, not a second AI calculation.
"""

from __future__ import annotations

from datetime import date, time as dt_time, timezone
from typing import Any

from integrated_fortune_v1 import (
    PLANET_KEYS,
    TOPIC_SPECS,
    _aware_local,
    _compute_houses,
    _evidence_text,
    _planet_lon,
    _scan_intraday,
)

KEY_DATE_EVIDENCE_VERSION = "western-key-date-evidence-v2.0-cached-daily-scan"
_REL_SOURCE_TOPICS = {
    "수신신호": ("연락", "소식", "재회", "연애"),
    "발신적합": ("연락", "연애", "재회", "소식"),
    "과거인연접점": ("재회", "연락"),
}
_INVEST_SOURCE_TOPICS = {
    "수익실현": ("금전", "투자심리"),
    "신규진입": ("금전", "투자심리"),
    "투자주의": ("금전", "투자심리"),
}


def _finite_number(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number == number and abs(number) != float("inf") else None


def _rank_dates(western: dict[str, Any], limit: int) -> list[dict[str, Any]]:
    ranked: dict[str, dict[str, Any]] = {}

    def add(topic: str, kind: str, point: Any) -> None:
        if not isinstance(point, dict):
            return
        day = str(point.get("date") or "")
        score = _finite_number(point.get("score"))
        if not day or score is None:
            return
        row = ranked.setdefault(day, {"date": day, "hits": 0, "weight": 0.0, "triggers": []})
        row["hits"] += 1
        row["weight"] += abs(score - 50.0)
        row["triggers"].append({"topic": topic, "kind": kind, "score": round(score, 1)})

    for scope in (western.get("overall"), western.get("relationship_signals")):
        if not isinstance(scope, dict):
            continue
        for topic, stat in scope.items():
            if not isinstance(stat, dict):
                continue
            for point in stat.get("best_days") or []:
                add(str(topic), "best", point)
            for point in stat.get("caution_days") or []:
                add(str(topic), "caution", point)

    rows = sorted(
        ranked.values(),
        key=lambda row: (-int(row["hits"]), -float(row["weight"]), str(row["date"])),
    )
    for row in rows:
        row["salience"] = round(float(row.pop("weight")) + int(row["hits"]) * 10.0, 1)
        row["triggers"] = sorted(
            row["triggers"],
            key=lambda item: (-abs(float(item["score"]) - 50.0), item["topic"], item["kind"]),
        )
    return rows[: max(1, int(limit))]


def _source_topics(trigger_topics: list[str]) -> list[str]:
    out: set[str] = set()
    for topic in trigger_topics:
        if topic in TOPIC_SPECS:
            out.add(topic)
        out.update(_REL_SOURCE_TOPICS.get(topic, ()))
        out.update(_INVEST_SOURCE_TOPICS.get(topic, ()))
    return sorted(out)


def _sampled_scores(rows: list[dict[str, Any]], trigger_topics: list[str]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for topic in trigger_topics:
        values: list[tuple[float, str]] = []
        for row in rows:
            value = _finite_number(row.get(topic))
            stamp = row.get("dt")
            if value is None or stamp is None:
                continue
            values.append((value, stamp.strftime("%H:%M")))
        if not values:
            continue
        mean = sum(item[0] for item in values) / len(values)
        low = min(values, key=lambda item: item[0])
        high = max(values, key=lambda item: item[0])
        result[topic] = {
            "average": round(mean, 1),
            "min": round(low[0], 1),
            "min_time": low[1],
            "max": round(high[0], 1),
            "max_time": high[1],
        }
    return result


def _actual_evidence(rows: list[dict[str, Any]], source_topics: list[str], limit: int = 10) -> list[dict[str, Any]]:
    best_by_identity: dict[tuple[Any, ...], dict[str, Any]] = {}
    for row in rows:
        stamp = row.get("dt")
        sample_time = stamp.strftime("%H:%M") if stamp is not None else ""
        topics = row.get("topics") if isinstance(row.get("topics"), dict) else {}
        for topic in source_topics:
            result = topics.get(topic)
            if not isinstance(result, dict):
                continue
            for evidence in result.get("evidence") or []:
                if not isinstance(evidence, dict):
                    continue
                kind = str(evidence.get("kind") or "")
                if kind == "aspect":
                    identity = (
                        kind,
                        evidence.get("transit"),
                        evidence.get("target"),
                        evidence.get("aspect"),
                        evidence.get("motion"),
                        evidence.get("direction"),
                    )
                elif kind == "house":
                    identity = (
                        kind,
                        evidence.get("transit"),
                        evidence.get("whole_house"),
                        evidence.get("placidus_house"),
                    )
                else:
                    identity = (kind, str(evidence))
                contribution = _finite_number(evidence.get("score")) or 0.0
                existing = best_by_identity.get(identity)
                if existing is not None and float(existing.get("contribution") or 0.0) >= contribution:
                    if topic not in existing["source_topics"]:
                        existing["source_topics"].append(topic)
                    continue
                packed = {
                    "kind": kind,
                    "sample_time": sample_time,
                    "source_topics": [topic],
                    "contribution": round(contribution, 4),
                    "text": _evidence_text(evidence),
                }
                for key in (
                    "transit", "target", "aspect", "orb", "motion", "direction",
                    "whole_house", "placidus_house", "polarity",
                ):
                    if evidence.get(key) is not None:
                        packed[key] = evidence.get(key)
                best_by_identity[identity] = packed

    evidence_rows = list(best_by_identity.values())
    evidence_rows.sort(
        key=lambda item: (
            0 if item.get("kind") == "aspect" else 1,
            -float(item.get("contribution") or 0.0),
            float(item.get("orb") or 99.0),
            str(item.get("text") or ""),
        )
    )
    for item in evidence_rows:
        item["source_topics"] = sorted(set(item.get("source_topics") or []))
    return evidence_rows[: max(1, int(limit))]


def enrich_integrated_key_dates(
    calculation: dict[str, Any],
    *,
    birth_date: date,
    birth_time: dt_time,
    latitude: float,
    longitude: float,
    utc_offset_hours: float,
) -> dict[str, Any]:
    """Attach actual Western evidence to only the period's most salient dates.

    Fail-open by design: a calculation remains usable if enrichment fails, but a
    precision note is attached so the interpretation layer cannot silently imply
    that actual key-date evidence was available.
    """
    if not isinstance(calculation, dict):
        return calculation
    western = calculation.get("western")
    period = calculation.get("period")
    if not isinstance(western, dict) or not isinstance(period, dict):
        return calculation

    try:
        day_count = int(period.get("day_count") or 1)
    except (TypeError, ValueError):
        day_count = 1
    limit = 1 if day_count <= 1 else 4 if day_count <= 9 else 7 if day_count <= 45 else 10
    ranked = _rank_dates(western, limit)
    if not ranked:
        western["key_dates"] = []
        western["key_date_evidence_policy"] = {
            "version": KEY_DATE_EVIDENCE_VERSION,
            "available": False,
            "reason": "period statistics did not expose ranked dates",
        }
        return calculation

    try:
        birth_local = _aware_local(birth_date, birth_time, utc_offset_hours)
        birth_utc = birth_local.astimezone(timezone.utc)
        natal_houses = _compute_houses(birth_utc, latitude, longitude)
        natal_lons = {body: _planet_lon(body, birth_utc) for body in PLANET_KEYS}
        enriched = []
        for ranked_row in ranked:
            day_value = date.fromisoformat(str(ranked_row["date"]))
            trigger_topics = sorted({str(item["topic"]) for item in ranked_row["triggers"]})
            source_topics = _source_topics(trigger_topics)
            # These are the exact same local times used by the multi-day life
            # aggregate. The planet snapshots are therefore normally already in
            # the engine LRU cache after the annual calculation.
            rows = _scan_intraday(
                day_value,
                dt_time(8, 0),
                dt_time(22, 0),
                120,
                natal_lons,
                natal_houses,
                utc_offset_hours,
                topic_names=tuple(source_topics),
            )
            enriched.append({
                **ranked_row,
                "source_topics": source_topics,
                "scan_policy": "08:00~22:00 local / 120-minute representative samples; actual engine aspects and house contacts",
                "sample_count": len(rows),
                "sampled_scores": _sampled_scores(rows, trigger_topics),
                "evidence": _actual_evidence(rows, source_topics, limit=10),
            })
        western["key_dates"] = enriched
        western["key_date_evidence_policy"] = {
            "version": KEY_DATE_EVIDENCE_VERSION,
            "available": True,
            "probability": False,
            "exact_peak_time": False,
            "note": "기간엔진이 선정한 상위 날짜만 기존 일별 샘플 시각으로 재확인. evidence는 실제 트랜짓 애스펙트/하우스 접점이며 사건 확률이 아님.",
        }
    except Exception as exc:  # noqa: BLE001
        western["key_dates"] = []
        western["key_date_evidence_policy"] = {
            "version": KEY_DATE_EVIDENCE_VERSION,
            "available": False,
            "reason": f"{type(exc).__name__}: {exc}",
        }
    return calculation
