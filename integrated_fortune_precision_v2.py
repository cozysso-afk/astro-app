from __future__ import annotations

from datetime import date, datetime, time as dt_time, timedelta, timezone
from typing import Any

import integrated_fortune_v1 as legacy

PRECISION_CONTRACT_VERSION = "integrated-precision-v2"
ENGINE_VERSION = f"{legacy.ENGINE_VERSION}+precision-v2"

_ROBUST_NATAL_BODIES = tuple(body for body in legacy.PLANET_KEYS if body != "Moon")
_STATIC_TRANSITS = ("Jupiter", "Saturn", "Uranus", "Neptune", "Pluto")
_DYNAMIC_TRANSITS = ("Sun", "Moon", "Mercury", "Venus", "Mars")
_LIFE_TOPICS = ("금전", "학업", "시험", "직장", "이직", "대인관계", "연애", "연락", "재회", "소식", "컨디션")
_MARKET_TOPICS = ("금전", "투자심리")
_RELATIONSHIP_SIGNALS = ("수신신호", "발신적합", "과거인연접점")


def build_precision_contract(reliability: dict[str, Any]) -> dict[str, Any]:
    status = str(reliability.get("status") or "unknown")
    exact = status == "exact" and bool(reliability.get("time_exact"))
    provisional = status == "provisional" and bool(reliability.get("time_available")) and not exact
    if not (exact or provisional):
        raise ValueError("integrated-precision-v2 does not support unknown birth time in phase 1")
    return {
        "contract_version": PRECISION_CONTRACT_VERSION,
        "time_available": bool(reliability.get("time_available")),
        "time_exact": bool(exact),
        "status": "exact" if exact else "provisional",
        "time_source": str(reliability.get("time_source") or "unknown"),
        "time_confidence": str(reliability.get("time_confidence") or "unknown"),
        "scoring_mode": "full_exact" if exact else "planet_only_provisional",
        "allow_natal_moon_scoring": bool(exact),
        "allow_angles_houses_scoring": bool(exact),
        "allow_house_ruler_bonus": bool(exact),
        "allow_intraday_timing": bool(exact),
        "allow_saju_ai": bool(exact),
        "allow_thai_ai": bool(exact),
        "layer_policy": {
            "natal_moon": "allow" if exact else "exclude",
            "angles_houses": "allow" if exact else "exclude",
            "house_ruler_bonus": "allow" if exact else "exclude",
            "intraday_timing": "allow" if exact else "exclude",
            "saju_ai": "allow" if exact else "exclude",
            "thai_ai": "allow" if exact else "exclude",
        },
    }


def _aspect_polarity(record: dict[str, Any]) -> float:
    base = float(record["base_polarity"])
    transit_tone = float(legacy.PLANET_TONE.get(record["transit"], 0.0))
    target_tone = float(legacy.PLANET_TONE.get(record["target"], 0.0))
    if record["name"] == "합":
        value = 0.70 * transit_tone + 0.30 * target_tone
    else:
        value = 0.75 * base + 0.30 * transit_tone + 0.10 * target_tone
    return max(-1.0, min(1.0, value))


def _build_planet_only_records(query_dt_utc: datetime, natal_lons: dict[str, float], bodies: tuple[str, ...]):
    snapshots = {body: legacy._planet_snapshot(body, query_dt_utc) for body in bodies}
    records: list[dict[str, Any]] = []
    for body, snap in snapshots.items():
        for target, target_lon in natal_lons.items():
            asp = legacy._analyze_aspect(body, snap, target_lon)
            if not asp:
                continue
            records.append({
                "layer": legacy.LAYER_BY_TRANSIT[body],
                "transit": body,
                "target": target,
                "speed": snap["speed"],
                "direction": snap["direction"],
                **asp,
            })
    records.sort(key=lambda row: (row["orb"], -row["orb_weight"]))
    return snapshots, records


def _score_topic_planet_only(topic_name: str, transit_records: list[dict[str, Any]]) -> dict[str, Any]:
    spec = legacy.TOPIC_SPECS[topic_name]
    raw_activation = 0.0
    polarity_num = 0.0
    polarity_den = 0.0
    evidences: list[dict[str, Any]] = []
    layers: set[str] = set()

    for rec in transit_records:
        transit_w = float(spec["transits"].get(rec["transit"], 0.0))
        target_w = float(spec["targets"].get(rec["target"], 0.0))
        if transit_w <= 0 or target_w <= 0:
            continue
        dir_mult, dir_pol = legacy._direction_modifier(topic_name, rec["transit"], rec["direction"])
        contribution = (
            float(rec["orb_weight"]) * float(rec["motion_mult"]) * float(rec["activation_mult"])
            * transit_w * target_w * float(dir_mult)
        )
        if contribution <= 0:
            continue
        pol = max(-1.0, min(1.0, _aspect_polarity(rec) + float(dir_pol)))
        raw_activation += contribution
        polarity_num += contribution * pol
        polarity_den += contribution
        layers.add(str(rec["layer"]))
        evidences.append({
            "kind": "aspect",
            "score": contribution,
            "polarity": pol,
            "transit": rec["transit"],
            "target": rec["target"],
            "aspect": rec["name"],
            "orb": rec["orb"],
            "motion": rec["motion"],
            "direction": rec["direction"],
        })

    strong_count = sum(1 for evidence in evidences if float(evidence["score"]) >= 0.50)
    stacking_bonus = min(7.0, max(0, len(layers) - 1) * 2.0 + min(3, strong_count) * 0.8)
    activation = legacy._clamp(raw_activation * 18.0 + stacking_bonus)
    favorability = legacy._clamp(50.0 + (polarity_num / polarity_den) * 40.0) if polarity_den else 50.0
    evidences.sort(key=lambda row: float(row["score"]), reverse=True)
    return {
        "topic": topic_name,
        "activation": int(round(activation)),
        "favorability": int(round(favorability)),
        "layers": sorted(layers),
        "evidence": evidences[:8],
    }


def _scan_planet_only(day_value: date, start_time: dt_time, end_time: dt_time, step_minutes: int, natal_lons: dict[str, float], offset_hours: float, topic_names: tuple[str, ...]) -> list[dict[str, Any]]:
    points = legacy._make_time_points(day_value, start_time, end_time, step_minutes, offset_hours)
    if not points:
        return []
    midpoint = points[len(points) // 2]
    _, static_records = _build_planet_only_records(midpoint.astimezone(timezone.utc), natal_lons, _STATIC_TRANSITS)
    rows: list[dict[str, Any]] = []
    for point in points:
        _, dynamic_records = _build_planet_only_records(point.astimezone(timezone.utc), natal_lons, _DYNAMIC_TRANSITS)
        records = static_records + dynamic_records
        topics = {topic: _score_topic_planet_only(topic, records) for topic in topic_names}
        rows.append({"dt": point, **legacy._derived_scores(topics), "topics": topics})
    return rows


def _rows_avg(rows: list[dict[str, Any]], key: str):
    values = [row.get(key) for row in rows if isinstance(row.get(key), (int, float))]
    return int(round(sum(values) / len(values))) if values else None


def _compact_provisional_evidence(life_rows: list[dict[str, Any]], market_rows: list[dict[str, Any]], limit: int = 10):
    relationship_links = {
        "연락": _RELATIONSHIP_SIGNALS,
        "소식": ("수신신호", "발신적합"),
        "재회": _RELATIONSHIP_SIGNALS,
        "연애": ("수신신호", "발신적합"),
    }
    investment_links = {
        "금전": ("수익실현", "신규진입", "투자주의"),
        "투자심리": ("수익실현", "신규진입", "투자주의"),
    }
    best: dict[tuple[Any, ...], dict[str, Any]] = {}

    def ingest(rows, topic_names, derived_links=None):
        links = derived_links or {}
        for sample in rows:
            topics = sample.get("topics") if isinstance(sample.get("topics"), dict) else {}
            for topic in topic_names:
                result = topics.get(topic)
                if not isinstance(result, dict):
                    continue
                for evidence in result.get("evidence") or []:
                    if not isinstance(evidence, dict) or evidence.get("kind") != "aspect":
                        continue
                    identity = ("aspect", evidence.get("transit"), evidence.get("target"), evidence.get("aspect"), evidence.get("motion"), evidence.get("direction"))
                    contribution = float(evidence.get("score") or 0.0)
                    linked_topics = [topic, *links.get(topic, ())]
                    current = best.get(identity)
                    if current is not None and float(current.get("contribution") or 0.0) >= contribution:
                        current["source_topics"] = sorted(set([*(current.get("source_topics") or []), *linked_topics]))
                        continue
                    packed = {
                        "kind": "aspect",
                        "source_topics": sorted(set(linked_topics)),
                        "contribution": round(contribution, 4),
                        "text": legacy._evidence_text(evidence),
                    }
                    for key in ("transit", "target", "aspect", "orb", "motion", "direction", "polarity"):
                        if evidence.get(key) is not None:
                            packed[key] = evidence.get(key)
                    best[identity] = packed

    ingest(life_rows, _LIFE_TOPICS, relationship_links)
    ingest(market_rows, _MARKET_TOPICS, investment_links)
    rows = list(best.values())
    rows.sort(key=lambda item: (-float(item.get("contribution") or 0.0), float(item.get("orb") or 99.0), str(item.get("text") or "")))
    return rows[: max(1, int(limit))]


def _provisional_daily_row(day_value: date, natal_lons: dict[str, float], offset_hours: float):
    life = _scan_planet_only(day_value, dt_time(8, 0), dt_time(22, 0), 120, natal_lons, offset_hours, _LIFE_TOPICS)
    market = _scan_planet_only(day_value, dt_time(9, 0), dt_time(15, 30), 60, natal_lons, offset_hours, _MARKET_TOPICS) if legacy._is_market_day(day_value) else []
    row: dict[str, Any] = {
        "date": day_value.isoformat(),
        "label": f"{day_value.month}/{day_value.day}({legacy.WEEKDAY_KO[day_value.weekday()]})",
        "market_open": bool(market),
    }
    for key in (*_LIFE_TOPICS, *_RELATIONSHIP_SIGNALS):
        row[key] = _rows_avg(life, key)
    row["투자심리"] = _rows_avg(market, "투자심리") if market else None
    for key in ("수익실현", "신규진입", "투자주의"):
        row[key] = _rows_avg(market, key) if market else None
    row["_evidence"] = _compact_provisional_evidence(life, market, 10)
    return row


def _western_provisional(birth_date: date, birth_time: dt_time, utc_offset_hours: float, start_date: date, end_date: date, progress_callback=None):
    birth_utc = legacy._aware_local(birth_date, birth_time, utc_offset_hours).astimezone(timezone.utc)
    natal_lons = {body: legacy._planet_lon(body, birth_utc) for body in _ROBUST_NATAL_BODIES}
    day_count = (end_date - start_date).days + 1
    prewarmed_longitudes = legacy._install_period_ephemeris_prewarm(start_date, end_date, float(utc_offset_hours))
    try:
        rows = []
        for index in range(day_count):
            rows.append(_provisional_daily_row(start_date + timedelta(days=index), natal_lons, float(utc_offset_hours)))
            completed = index + 1
            if progress_callback and (completed == day_count or completed == 1 or completed % 5 == 0):
                progress_callback(completed, day_count, "western_daily_provisional")

        market_rows = [row for row in rows if legacy._is_market_day(date.fromisoformat(row["date"]))]
        overall = {key: legacy._period_stats(market_rows if key in legacy.INVESTMENT_KEYS else rows, key) for key in legacy.TOPIC_ORDER}
        relationship_signals = {key: legacy._period_stats(rows, key) for key in _RELATIONSHIP_SIGNALS}
        daily_keys = legacy.TOPIC_ORDER + list(_RELATIONSHIP_SIGNALS)
        daily_scores = [{
            "date": row["date"],
            "label": row["label"],
            "market_open": bool(row.get("market_open")),
            "scores": {key: (float(row[key]) if isinstance(row.get(key), (int, float)) else None) for key in daily_keys},
            "evidence": list(row.get("_evidence") or [])[:10],
        } for row in rows]
        market_precision = legacy._krx_calendar_precision(start_date, end_date)
        months = []
        for seg_start, seg_end in legacy._month_segments(start_date, end_date):
            seg_rows = [row for row in rows if seg_start.isoformat() <= row["date"] <= seg_end.isoformat()]
            seg_market = [row for row in seg_rows if legacy._is_market_day(date.fromisoformat(row["date"]))]
            months.append({
                "calendar_month": f"{seg_start.year}-{seg_start.month:02d}",
                "start": seg_start.isoformat(),
                "end": seg_end.isoformat(),
                "topics": {key: legacy._period_stats(seg_market if key in legacy.INVESTMENT_KEYS else seg_rows, key) for key in legacy.TOPIC_ORDER},
                "relationship_signals": {key: legacy._period_stats(seg_rows, key) for key in _RELATIONSHIP_SIGNALS},
            })
        _, _, _, _, _, ephemeris_used, fallback_reason = legacy._ephemeris_bundle()
        return {
            "ok": True,
            "engine": f"{legacy.WESTERN_ENGINE_VERSION}+planet-only-provisional-v2",
            "ephemeris": ephemeris_used,
            "ephemeris_fallback_reason": fallback_reason,
            "score_policy": "provisional: 입력 시각의 안정 행성만 사용한 planet-only 상대 흐름; 출생 Moon·ASC/MC·하우스·하우스 룰러 보너스 제외",
            "method": "provisional planet-only period sampling; exact clock timing is intentionally not exposed",
            "performance": {
                "vector_ephemeris_prewarm": bool(prewarmed_longitudes),
                "prewarmed_longitudes": prewarmed_longitudes,
                "daily_evidence_days": len(daily_scores),
                "daily_evidence_rows": sum(len(row.get("evidence") or []) for row in daily_scores),
            },
            "natal": {
                "asc": None,
                "mc": None,
                "house_system": None,
                "precision_note": "provisional birth time: natal Moon, ASC/MC and all house-sensitive scoring are excluded",
            },
            "overall": overall,
            "relationship_signals": relationship_signals,
            "market": {
                "has_open_session": bool(market_rows),
                "session_count": len(market_rows),
                "session_dates": [row["date"] for row in market_rows],
                "calendar_mode": market_precision["mode"],
                "calendar_exact_range": market_precision["exact_range"],
                "calendar_warning": market_precision["warning"],
            },
            "detail_days": [],
            "daily_scores": daily_scores,
            "months": months,
        }
    finally:
        legacy._clear_period_ephemeris_prewarm()


def build_integrated_fortune_precision_v2(*, birth_date: date, birth_time: dt_time, latitude: float, longitude: float, utc_offset_hours: float, gender: str, start_date: date, end_date: date, precision: dict[str, Any], progress_callback=None) -> dict[str, Any]:
    if end_date < start_date:
        raise ValueError("end_date must be on or after start_date")
    day_count = (end_date - start_date).days + 1
    if day_count > 366:
        raise ValueError("integrated fortune range is limited to 366 days per request")
    if precision.get("contract_version") != PRECISION_CONTRACT_VERSION:
        raise ValueError("integrated precision contract is missing or invalid")

    if precision.get("status") == "exact":
        result = legacy.build_integrated_fortune(
            birth_date=birth_date,
            birth_time=birth_time,
            latitude=latitude,
            longitude=longitude,
            utc_offset_hours=utc_offset_hours,
            gender=gender,
            start_date=start_date,
            end_date=end_date,
            progress_callback=progress_callback,
        )
        result["precision"] = precision
        return result

    if precision.get("status") != "provisional":
        raise ValueError("unknown birth time is unsupported by integrated-precision-v2 phase 1")

    western = _western_provisional(birth_date, birth_time, utc_offset_hours, start_date, end_date, progress_callback)
    saju = legacy._saju_payload(birth_date, birth_time, longitude, utc_offset_hours, gender, start_date, end_date)
    thai = legacy._thai_payload(birth_date, birth_time, start_date, end_date, latitude, longitude, utc_offset_hours)
    return {
        "ok": True,
        "engine": ENGINE_VERSION,
        "period": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat(),
            "day_count": day_count,
            "month_segments": len(legacy._month_segments(start_date, end_date)),
        },
        "precision": precision,
        "western": western,
        "saju": saju,
        "thai": thai,
        "consensus_policy": {
            "western": "provisional planet-only 상대지수. 사건 확률이 아니며 출생 Moon·각도·하우스 층을 사용하지 않음.",
            "saju": "입력 시각 기반 원자료는 화면 참고용 provisional로 유지하되 AI evidence/interpretation에는 사용하지 않음.",
            "thai": "입력 시각 기반 원자료는 화면 참고용 provisional로 유지하되 AI evidence/interpretation에는 사용하지 않음.",
        },
    }
