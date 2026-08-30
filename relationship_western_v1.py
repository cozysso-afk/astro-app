# -*- coding: utf-8 -*-
"""Advanced Western relationship astrology calculations for Fortune Lab.

Calculated layers:
- natal synastry
- secondary progressed synastry (progressed->natal in both directions + progressed->progressed)
- midpoint composite and secondary progressed composite
- Davison relationship chart (uncorrected time/space midpoint)
- Bob Marks directional charts (A<->Davison and B<->Davison)
- Tertiary-I progressions of each Marks chart (1 ephemeris day = 27.32158218 life days)

The module deliberately returns calculation facts, not event probabilities or claims about another
person's private feelings. Angles/houses and Davison/Marks layers require exact birth time and place.
"""

import math
from datetime import date, datetime, time as dt_time, timedelta, timezone

import swisseph as swe

ENGINE_VERSION = "relationship-western-v1.4-dual-house-audit"
TROPICAL_MONTH_DAYS = 27.32158218
YEAR_DAYS = 365.2422

BODIES = {
    "Sun": swe.SUN,
    "Moon": swe.MOON,
    "Mercury": swe.MERCURY,
    "Venus": swe.VENUS,
    "Mars": swe.MARS,
    "Jupiter": swe.JUPITER,
    "Saturn": swe.SATURN,
    "Uranus": swe.URANUS,
    "Neptune": swe.NEPTUNE,
    "Pluto": swe.PLUTO,
    "True Node": swe.TRUE_NODE,
}

ASPECTS = {
    "conjunction": 0.0,
    "sextile": 60.0,
    "square": 90.0,
    "trine": 120.0,
    "quincunx": 150.0,
    "opposition": 180.0,
}
SUPPORTIVE = {"sextile", "trine"}
CHALLENGING = {"square", "opposition", "quincunx"}


TRANSIT_WEIGHTS = {
    "Sun": .45, "Mercury": 1.00, "Venus": .95, "Mars": .90,
    "Jupiter": .85, "Saturn": .70, "Uranus": .70, "Neptune": .55, "Pluto": .65,
}
TRANSIT_TARGET_WEIGHTS = {
    "Sun": 1.00, "Mercury": .95, "Venus": 1.00, "Mars": .90,
    "Jupiter": .55, "Saturn": .65, "Uranus": .45, "Neptune": .50, "Pluto": .75,
    "True Node": .65, "ASC": .90, "DSC": .90, "MC": .55, "IC": .45,
}
TRANSIT_ASPECT_WEIGHTS = {
    "conjunction": 1.00, "opposition": .95, "square": .92,
    "trine": .82, "sextile": .76, "quincunx": .68,
}


def _transit_orb_limit(planet):
    return 1.4 if planet in {"Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"} else 1.0


def _transit_hits(transit_chart, natal_chart, person):
    transits = transit_chart.get("positions") or {}
    targets = _point_map(natal_chart)
    found = []
    for t_name, t_info in transits.items():
        if t_name not in TRANSIT_WEIGHTS:
            continue
        t_lon = float(t_info["lon"])
        orb_limit = _transit_orb_limit(t_name)
        for target, n_lon in targets.items():
            target_weight = TRANSIT_TARGET_WEIGHTS.get(target, .35)
            dist = _angle_distance(t_lon, float(n_lon))
            for aspect, exact in ASPECTS.items():
                orb = abs(dist - exact)
                if orb > orb_limit:
                    continue
                orb_factor = max(0.0, 1.0 - orb / orb_limit)
                score = 100.0 * TRANSIT_WEIGHTS[t_name] * target_weight * TRANSIT_ASPECT_WEIGHTS[aspect] * orb_factor
                tone = "supportive" if aspect in SUPPORTIVE else ("challenging" if aspect in CHALLENGING else "mixed")
                found.append({
                    "person": person,
                    "transit": t_name,
                    "aspect": aspect,
                    "target": target,
                    "orb": round(orb, 3),
                    "tone": tone,
                    "score": round(score, 1),
                })
    found.sort(key=lambda x: (-x["score"], x["orb"]))
    return found[:10]


def _side_trigger_score(hits):
    if not hits:
        return 0.0
    top = [float(x["score"]) for x in hits[:4]]
    return round(min(100.0, sum(top) / 2.35), 1)


def _relationship_timing_band(score):
    if score >= 70:
        return "강함"
    if score >= 55:
        return "상승"
    if score >= 40:
        return "보통"
    if score >= 25:
        return "약함"
    return "매우 약함"


def _relationship_timing_stat(rows, key, label):
    points = [
        {"date": row["date"], "label": label, "score": float(row[key])}
        for row in rows if isinstance(row.get(key), (int, float))
    ]
    if not points:
        return None
    avg = sum(point["score"] for point in points) / len(points)

    def spaced(source, reverse, limit):
        ordered = sorted(source, key=lambda x: x["score"], reverse=reverse)
        selected = []
        for point in ordered:
            day = date.fromisoformat(point["date"])
            if any(abs((day - date.fromisoformat(existing["date"])).days) <= 1 for existing in selected):
                continue
            selected.append({**point, "score": round(point["score"], 1)})
            if len(selected) >= limit:
                break
        return selected

    return {
        "average": round(avg, 1),
        "band": _relationship_timing_band(avg),
        "spread": round(max(point["score"] for point in points) - min(point["score"] for point in points), 1),
        "best_days": spaced(points, True, 7),
        "caution_days": spaced(points, False, 5),
    }


def _relationship_directional_context(rows, start_date, end_date):
    incoming_label = "상대측 차트의 관계 트랜짓 활성도 · 실제 연락 의도/확률 아님"
    outgoing_label = "내 차트의 관계 트랜짓 활성도 · 실제 연락 결과 확률 아님"
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
            "incoming": _relationship_timing_stat(month_rows, "counterpart_score", incoming_label),
            "outgoing": _relationship_timing_stat(month_rows, "user_score", outgoing_label),
            "reconnection": _relationship_timing_stat(month_rows, "score", reconnection_label),
        })
    return {
        "period": {"start": start_date.isoformat(), "end": end_date.isoformat()},
        "incoming": _relationship_timing_stat(rows, "counterpart_score", incoming_label),
        "outgoing": _relationship_timing_stat(rows, "user_score", outgoing_label),
        "reconnection": _relationship_timing_stat(rows, "score", reconnection_label),
        "months": monthly,
        "source": "two-person relationship transit engine",
        "policy": "incoming/outgoing are directional chart-activation proxies. They do not reveal private intent and are not event probabilities.",
    }


def _build_reunion_transits(user_natal, cp_natal, start_date, end_date, utc_offset_hours):
    rows = []
    cursor = start_date
    tz = timezone(timedelta(hours=float(utc_offset_hours or 9.0)))
    while cursor <= end_date:
        target_local = datetime.combine(cursor, dt_time(12, 0), tzinfo=tz)
        transit_chart = _chart_from_jd(_jd_from_utc(target_local.astimezone(timezone.utc)), include_moon=False, include_angles=False)
        user_hits = _transit_hits(transit_chart, user_natal, "user")
        cp_hits = _transit_hits(transit_chart, cp_natal, "counterpart")
        user_score = _side_trigger_score(user_hits)
        cp_score = _side_trigger_score(cp_hits)
        shared_bonus = 8.0 if user_score >= 35 and cp_score >= 35 else 0.0
        combined = round(min(100.0, user_score * .45 + cp_score * .55 + shared_bonus), 1)
        rows.append({
            "date": cursor.isoformat(),
            "score": combined,
            "user_score": user_score,
            "counterpart_score": cp_score,
            "shared_activation": bool(user_score >= 25 and cp_score >= 25),
            "hits": (cp_hits[:3] + user_hits[:3])[:6],
        })
        cursor += timedelta(days=1)

    ranked = sorted(rows, key=lambda x: (-x["score"], x["date"]))
    # Avoid filling the top list with adjacent dates from the same transit pass.
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
        strongest = sorted(month_rows, key=lambda x: x["score"], reverse=True)[:5]
        score = round(sum(x["score"] for x in strongest) / max(1, len(strongest)), 1)
        top_months.append({"calendar_month": key, "score": score, "top_dates": [x["date"] for x in strongest[:3]]})
    top_months.sort(key=lambda x: (-x["score"], x["calendar_month"]))
    return {
        "available": True,
        "period": {"start": start_date.isoformat(), "end": end_date.isoformat()},
        "policy": "daily transits to both natal charts; descriptive activation, not contact/reunion probability",
        "top_days": top_days,
        "top_months": top_months[:12],
        "directional_context": _relationship_directional_context(rows, start_date, end_date),
    }


def _norm(x):
    return float(x) % 360.0


def _angle_distance(a, b):
    d = abs(_norm(a) - _norm(b)) % 360.0
    return min(d, 360.0 - d)


def _mid_angle(a, b):
    a = _norm(a); b = _norm(b)
    d = ((_norm(b - a) + 180.0) % 360.0) - 180.0
    return _norm(a + d / 2.0)


def _utc_datetime(birth_date, birth_time, utc_offset_hours):
    local = datetime.combine(birth_date, birth_time)
    return (local - timedelta(hours=float(utc_offset_hours))).replace(tzinfo=timezone.utc)


def _jd_from_utc(dt):
    dt = dt.astimezone(timezone.utc)
    hour = dt.hour + dt.minute / 60.0 + dt.second / 3600.0 + dt.microsecond / 3_600_000_000.0
    return swe.julday(dt.year, dt.month, dt.day, hour, swe.GREG_CAL)


def _utc_from_jd(jd):
    y, m, d, hour = swe.revjul(float(jd), swe.GREG_CAL)
    base = datetime(int(y), int(m), int(d), tzinfo=timezone.utc)
    return base + timedelta(hours=float(hour))


def _planet_positions(jd, include_moon=True):
    out = {}
    flags = swe.FLG_SWIEPH | swe.FLG_SPEED
    for name, pid in BODIES.items():
        if name == "Moon" and not include_moon:
            continue
        xx, _ = swe.calc_ut(float(jd), pid, flags)
        out[name] = {"lon": round(_norm(xx[0]), 6), "speed": round(float(xx[3]), 6)}
    return out


def _angles(jd, lat, lon):
    if lat is None or lon is None:
        return {}
    placidus_cusps, ascmc = swe.houses(float(jd), float(lat), float(lon), b"P")
    asc = _norm(ascmc[0])
    asc_sign = int(asc // 30.0)
    whole_cusps = [float(((asc_sign + i) % 12) * 30.0) for i in range(12)]
    placidus = [round(_norm(x), 6) for x in placidus_cusps]
    return {
        "ASC": round(asc, 6),
        "MC": round(_norm(ascmc[1]), 6),
        "DSC": round(_norm(ascmc[0] + 180.0), 6),
        "IC": round(_norm(ascmc[1] + 180.0), 6),
        # `cusps` remains a backward-compatible Placidus alias.
        "cusps": placidus,
        "placidus_cusps": placidus,
        "whole_cusps": whole_cusps,
    }


def _chart_from_jd(jd, lat=None, lon=None, include_moon=True, include_angles=True):
    return {
        "jd_ut": round(float(jd), 8),
        "utc": _utc_from_jd(jd).isoformat(),
        "positions": _planet_positions(jd, include_moon=include_moon),
        "angles": _angles(jd, lat, lon) if include_angles and lat is not None and lon is not None else {},
    }


def _profile_chart(profile, allow_unknown_time=False):
    time_known = bool(profile.get("time_known", True))
    bt = profile.get("birth_time")
    if not time_known or bt is None:
        if not allow_unknown_time:
            return None
        bt = dt_time(12, 0)
    jd = _jd_from_utc(_utc_datetime(profile["birth_date"], bt, profile.get("utc_offset_hours", 9.0)))
    return _chart_from_jd(
        jd,
        profile.get("latitude"), profile.get("longitude"),
        include_moon=time_known,
        include_angles=time_known and profile.get("latitude") is not None and profile.get("longitude") is not None,
    )


def _point_map(chart):
    out = {k: v["lon"] for k, v in (chart.get("positions") or {}).items()}
    for key in ("ASC", "MC", "DSC", "IC"):
        if key in (chart.get("angles") or {}):
            out[key] = chart["angles"][key]
    return out


def _orb_limit(p1, p2, mode):
    if mode == "natal":
        if p1 in {"Sun", "Moon"} or p2 in {"Sun", "Moon"}:
            return 6.0
        if p1 in {"ASC", "MC", "DSC", "IC", "True Node"} or p2 in {"ASC", "MC", "DSC", "IC", "True Node"}:
            return 3.0
        return 4.0
    if mode == "tertiary":
        return 1.0
    return 1.5


def _aspects(chart_a, chart_b, mode="natal", limit=40):
    a = _point_map(chart_a); b = _point_map(chart_b)
    found = []
    for p1, l1 in a.items():
        for p2, l2 in b.items():
            dist = _angle_distance(l1, l2)
            best = None
            for name, exact in ASPECTS.items():
                orb = abs(dist - exact)
                if orb <= _orb_limit(p1, p2, mode) and (best is None or orb < best[0]):
                    best = (orb, name, exact)
            if best:
                orb, name, exact = best
                tone = "supportive" if name in SUPPORTIVE else ("challenging" if name in CHALLENGING else "mixed")
                found.append({
                    "a": p1, "aspect": name, "b": p2,
                    "orb": round(orb, 3), "distance": round(dist, 3), "exact_angle": exact, "tone": tone,
                })
    found.sort(key=lambda x: (x["orb"], 0 if x["a"] in {"Sun", "Moon", "Venus", "Mars", "ASC", "DSC"} else 1))
    return found[:limit]


def _midpoint_chart(chart_a, chart_b):
    pa = chart_a.get("positions") or {}; pb = chart_b.get("positions") or {}
    positions = {}
    for name in sorted(set(pa) & set(pb)):
        positions[name] = {"lon": round(_mid_angle(pa[name]["lon"], pb[name]["lon"]), 6)}
    angles = {}
    aa = chart_a.get("angles") or {}; ab = chart_b.get("angles") or {}
    for key in ("ASC", "MC", "DSC", "IC"):
        if key in aa and key in ab:
            angles[key] = round(_mid_angle(aa[key], ab[key]), 6)
    return {"positions": positions, "angles": angles, "method": "shortest-arc midpoint of corresponding points"}


def _secondary_progressed_chart(profile, target_dt, include_angles=False):
    birth_utc = _utc_datetime(profile["birth_date"], profile["birth_time"], profile.get("utc_offset_hours", 9.0))
    age_days = (target_dt.astimezone(timezone.utc) - birth_utc).total_seconds() / 86400.0
    progressed_days = age_days / YEAR_DAYS
    jd = _jd_from_utc(birth_utc) + progressed_days
    # Planetary secondary progressions are astronomical day-for-year positions.
    # Angles are intentionally omitted here rather than pretending a single disputed angle method.
    return _chart_from_jd(jd, include_moon=True, include_angles=False)


def _geo_midpoint(lat1, lon1, lat2, lon2):
    # Great-circle midpoint; stable across the date line.
    phi1, lam1, phi2, lam2 = map(math.radians, [float(lat1), float(lon1), float(lat2), float(lon2)])
    x1, y1, z1 = math.cos(phi1)*math.cos(lam1), math.cos(phi1)*math.sin(lam1), math.sin(phi1)
    x2, y2, z2 = math.cos(phi2)*math.cos(lam2), math.cos(phi2)*math.sin(lam2), math.sin(phi2)
    x, y, z = x1+x2, y1+y2, z1+z2
    lon = math.degrees(math.atan2(y, x))
    hyp = math.hypot(x, y)
    lat = math.degrees(math.atan2(z, hyp))
    return lat, lon


def _davison_from_profiles(a, b):
    a_utc = _utc_datetime(a["birth_date"], a["birth_time"], a.get("utc_offset_hours", 9.0))
    b_utc = _utc_datetime(b["birth_date"], b["birth_time"], b.get("utc_offset_hours", 9.0))
    mid_ts = (a_utc.timestamp() + b_utc.timestamp()) / 2.0
    mid_utc = datetime.fromtimestamp(mid_ts, tz=timezone.utc)
    lat, lon = _geo_midpoint(a["latitude"], a["longitude"], b["latitude"], b["longitude"])
    jd = _jd_from_utc(mid_utc)
    chart = _chart_from_jd(jd, lat, lon, include_moon=True, include_angles=True)
    chart.update({"latitude": round(lat, 6), "longitude": round(lon, 6), "method": "uncorrected Davison: midpoint in UTC time + great-circle geographic midpoint"})
    return chart


def _synthetic_profile_from_chart(chart):
    utc = _utc_from_jd(chart["jd_ut"])
    return {
        "birth_date": utc.date(), "birth_time": utc.time().replace(tzinfo=None), "utc_offset_hours": 0.0,
        "latitude": chart.get("latitude"), "longitude": chart.get("longitude"), "time_known": True,
    }


def _marks_chart(person, davison):
    rel = _synthetic_profile_from_chart(davison)
    return _davison_from_profiles(person, rel)


def _tertiary_progressed_chart(base_chart, target_dt):
    base_utc = _utc_from_jd(base_chart["jd_ut"])
    elapsed_days = (target_dt.astimezone(timezone.utc) - base_utc).total_seconds() / 86400.0
    lunar_months = math.floor(elapsed_days / TROPICAL_MONTH_DAYS)
    symbolic_jd = float(base_chart["jd_ut"]) + lunar_months
    return _chart_from_jd(symbolic_jd, include_moon=True, include_angles=False), lunar_months


def _house_of_longitude(cusps, longitude):
    if not cusps or len(cusps) < 12:
        return None
    lon = _norm(longitude)
    for idx in range(12):
        start = _norm(cusps[idx])
        end = _norm(cusps[(idx + 1) % 12])
        arc = (end - start) % 360.0
        pos = (lon - start) % 360.0
        if pos < arc or abs(pos - arc) < 1e-9:
            return idx + 1
    return None


def _whole_sign_house(asc_longitude, longitude):
    asc_sign = int(_norm(asc_longitude) // 30.0)
    planet_sign = int(_norm(longitude) // 30.0)
    return (planet_sign - asc_sign) % 12 + 1


def _house_overlays(source_chart, target_chart, source_label, target_label):
    angles = target_chart.get("angles") or {}
    placidus_cusps = angles.get("placidus_cusps") or angles.get("cusps")
    asc = angles.get("ASC")
    if not placidus_cusps or asc is None:
        return {"available": False, "reason": f"{target_label} exact birth time/place required for house overlays"}
    rows=[]
    for planet, info in (source_chart.get("positions") or {}).items():
        placidus_house = _house_of_longitude(placidus_cusps, info["lon"])
        whole_house = _whole_sign_house(asc, info["lon"])
        if placidus_house or whole_house:
            rows.append({
                "source": source_label,
                "planet": planet,
                "target": target_label,
                # backward-compatible field; new consumers should use both fields below.
                "house": placidus_house,
                "placidus_house": placidus_house,
                "whole_house": whole_house,
            })
    relationship_houses = {4,5,7,8}
    priority={4:0,5:1,7:2,8:3,1:4,10:5}
    rows.sort(key=lambda x:(min(priority.get(x.get("whole_house"),9), priority.get(x.get("placidus_house"),9)), x["planet"]))
    return {
        "available": True,
        "systems": ["Whole Sign", "Placidus"],
        "all": rows,
        "relationship_houses": [x for x in rows if x.get("whole_house") in relationship_houses or x.get("placidus_house") in relationship_houses],
        "note": "Whole Sign(홀사인)과 Placidus(플라시두스)를 병행. 4=가정/정서적 기반, 5=연애/즐거움, 7=파트너십, 8=친밀감/공유자원. 두 체계가 다르면 각각 분리해서 읽고 사건 보장/궁합 점수로 합산하지 않음",
    }


def _focus_groups(aspects):
    def touches(a, names):
        return a.get("a") in names or a.get("b") in names
    def pair(a, left, right):
        return (a.get("a") in left and a.get("b") in right) or (a.get("b") in left and a.get("a") in right)
    groups={
        "core_identity_emotion": [a for a in aspects if pair(a,{"Sun"},{"Moon"}) or pair(a,{"Sun"},{"Sun"}) or pair(a,{"Moon"},{"Moon"})],
        "attraction_romance": [a for a in aspects if pair(a,{"Venus"},{"Mars","Sun","Moon","ASC","DSC"}) or pair(a,{"Mars"},{"Venus","Moon","ASC","DSC"})],
        "sexual_intimacy": [a for a in aspects if touches(a,{"Venus","Mars","Pluto"}) and (a.get("a") in {"Venus","Mars","Pluto","Moon"} and a.get("b") in {"Venus","Mars","Pluto","Moon"})],
        "communication": [a for a in aspects if touches(a,{"Mercury"})],
        "stability_commitment": [a for a in aspects if touches(a,{"Saturn","Jupiter","True Node"}) and touches(a,{"Sun","Moon","Venus","Mars","ASC","DSC","Saturn","Jupiter","True Node"})],
        "conflict_reactivity": [a for a in aspects if a.get("tone")=="challenging" and touches(a,{"Mars","Saturn","Uranus","Pluto"})],
        "idealization_confusion": [a for a in aspects if touches(a,{"Neptune"}) and touches(a,{"Mercury","Venus","Sun","Moon","ASC","DSC","Neptune"})],
        "power_attachment": [a for a in aspects if touches(a,{"Pluto"})],
        "freedom_unpredictability": [a for a in aspects if touches(a,{"Uranus"})],
        "home_marriage": [a for a in aspects if touches(a,{"Moon","Venus","Saturn","IC","DSC"})],
    }
    return {k: sorted(v,key=lambda x:x["orb"])[:12] for k,v in groups.items()}


def _summary(aspect_sets):
    flat = []
    for label, aspects in aspect_sets.items():
        for x in aspects:
            y = dict(x); y["layer"] = label; flat.append(y)
    flat.sort(key=lambda x: x["orb"])
    return {
        "exact_contacts": len([x for x in flat if x["orb"] <= 0.5]),
        "supportive_contacts": len([x for x in flat if x["tone"] == "supportive"]),
        "challenging_contacts": len([x for x in flat if x["tone"] == "challenging"]),
        "tightest": flat[:10],
        "note": "contact counts are descriptive aspect counts, not probabilities or a good/bad relationship score",
    }


def build_relationship_western(user_profile, counterpart_profile, month_segments):
    """Return static and monthly advanced relationship layers.

    month_segments: iterable of (segment_start: date, segment_end: date); midpoint noon KST is used as
    the representative timing date. Exact partner birth time/place unlocks Davison and Marks layers.
    """
    month_segments = list(month_segments)
    result = {
        "ok": True,
        "engine": ENGINE_VERSION,
        "zodiac": "tropical",
        "house_system": "Whole Sign + Placidus for exact-time natal/Davison/Marks charts",
        "secondary_key": "1 ephemeris day = 1 tropical year of life (365.2422 days)",
        "tertiary_key": f"Tertiary I: 1 ephemeris day = {TROPICAL_MONTH_DAYS} life days; completed lunar months",
        "orb_policy": "natal 3-6° by point; secondary 1.5°; tertiary 1.0°; major aspects + quincunx",
        "limitations": [],
    }

    user_exact = bool(user_profile.get("birth_time") is not None and user_profile.get("latitude") is not None and user_profile.get("longitude") is not None)
    cp_exact = bool(counterpart_profile.get("time_known") and counterpart_profile.get("birth_time") is not None and counterpart_profile.get("latitude") is not None and counterpart_profile.get("longitude") is not None)

    user_natal = _profile_chart(user_profile, allow_unknown_time=False)
    cp_natal = _profile_chart(counterpart_profile, allow_unknown_time=True)
    if user_natal is None or cp_natal is None:
        return {"ok": False, "error": "natal chart inputs unavailable", "engine": ENGINE_VERSION}

    natal_aspects = _aspects(user_natal, cp_natal, mode="natal")
    result["natal_synastry"] = {
        "available": True,
        "partner_time_exact": cp_exact,
        "aspects": natal_aspects,
        "note": "If partner birth time is unknown, partner Moon and angles are excluded; remaining planets use local noon and should be treated as lower precision near orb boundaries." if not cp_exact else "Both birth times/locations available; planets and angles included.",
    }
    result["relationship_focus"] = {
        "available": True,
        "groups": _focus_groups(natal_aspects),
        "policy": "standard relationship-astrology themes grouped from actual natal synastry aspects; no good/bad total score",
    }
    result["house_overlays"] = {
        "available": bool(user_exact and cp_exact),
        "user_in_counterpart": _house_overlays(user_natal, cp_natal, "user", "counterpart"),
        "counterpart_in_user": _house_overlays(cp_natal, user_natal, "counterpart", "user"),
        "precision_note": "Both exact birth times/places required. Unknown partner time disables partner-house overlays rather than estimating them." if not cp_exact else "Exact-time Whole Sign + Placidus house overlays available.",
    }
    result["composite"] = {
        "available": True,
        "chart": _midpoint_chart(user_natal, cp_natal),
        "note": "Mathematical midpoint composite. Partner angles/Moon are omitted when partner time is unknown.",
    }

    if month_segments:
        transit_layer = _build_reunion_transits(
            user_natal, cp_natal, month_segments[0][0], month_segments[-1][1], user_profile.get("utc_offset_hours", 9.0)
        )
        result["relationship_transits"] = transit_layer
        result["reunion_transits"] = transit_layer

    davison = marks_a = marks_b = None
    if user_exact and cp_exact:
        davison = _davison_from_profiles(user_profile, counterpart_profile)
        marks_a = _marks_chart(user_profile, davison)
        marks_b = _marks_chart(counterpart_profile, davison)
        result["davison"] = {"available": True, "chart": davison}
        result["marks"] = {
            "available": True,
            "user": marks_a,
            "counterpart": marks_b,
            "method": "Bob Marks method: Davison(person, relationship Davison), calculated separately for each direction",
        }
    else:
        result["davison"] = {"available": False, "reason": "Davison requires exact birth time and coordinates for both people."}
        result["marks"] = {"available": False, "reason": "Marks charts require the exact-time Davison base chart."}
        result["limitations"].append("Partner exact birth time/place missing: Davison, Marks and Marks tertiary progression are disabled rather than estimated.")

    monthly = []
    for seg_start, seg_end in month_segments:
        rep_date = seg_start + (seg_end - seg_start) // 2
        target = datetime.combine(rep_date, dt_time(12, 0), tzinfo=timezone(timedelta(hours=9))).astimezone(timezone.utc)
        row = {"calendar_month": f"{seg_start.year}-{seg_start.month:02d}", "representative_date": rep_date.isoformat()}
        layer_aspects = {}

        if cp_exact:
            up = _secondary_progressed_chart(user_profile, target)
            cp = _secondary_progressed_chart(counterpart_profile, target)
            ps = {
                "user_progressed_to_partner_natal": _aspects(up, cp_natal, mode="secondary", limit=24),
                "partner_progressed_to_user_natal": _aspects(cp, user_natal, mode="secondary", limit=24),
                "progressed_to_progressed": _aspects(up, cp, mode="secondary", limit=24),
            }
            row["progressed_synastry"] = {"available": True, **ps}
            layer_aspects.update({f"progressed_synastry.{k}": v for k, v in ps.items()})

            prog_comp = _midpoint_chart(up, cp)
            natal_comp = result["composite"]["chart"]
            pc_aspects = _aspects(prog_comp, natal_comp, mode="secondary", limit=24)
            row["progressed_composite"] = {
                "available": True,
                "chart": prog_comp,
                "to_natal_composite_aspects": pc_aspects,
                "method": "secondary-progress both natal charts to target date, then midpoint corresponding progressed points",
            }
            layer_aspects["progressed_composite_to_natal_composite"] = pc_aspects
        else:
            row["progressed_synastry"] = {"available": False, "reason": "Exact partner birth time required for reliable progressed synastry."}
            row["progressed_composite"] = {"available": False, "reason": "Exact partner birth time required for progressed composite."}

        if marks_a is not None and marks_b is not None:
            mt_a, n_a = _tertiary_progressed_chart(marks_a, target)
            mt_b, n_b = _tertiary_progressed_chart(marks_b, target)
            a_contacts = _aspects(mt_a, marks_a, mode="tertiary", limit=24)
            b_contacts = _aspects(mt_b, marks_b, mode="tertiary", limit=24)
            cross_contacts = _aspects(mt_a, mt_b, mode="tertiary", limit=24)
            row["marks_tertiary"] = {
                "available": True,
                "user": {"completed_lunar_months": n_a, "chart": mt_a, "to_base_marks_aspects": a_contacts},
                "counterpart": {"completed_lunar_months": n_b, "chart": mt_b, "to_base_marks_aspects": b_contacts},
                "directional_cross_aspects": cross_contacts,
                "angle_policy": "planetary points only in tertiary layer; progressed angles omitted because tertiary angle conventions vary",
            }
            layer_aspects["marks_tertiary.user_to_base"] = a_contacts
            layer_aspects["marks_tertiary.counterpart_to_base"] = b_contacts
            layer_aspects["marks_tertiary.directional_cross"] = cross_contacts
        else:
            row["marks_tertiary"] = {"available": False, "reason": "Exact-time Marks base charts unavailable."}

        row["signal_summary"] = _summary(layer_aspects)
        monthly.append(row)

    result["months"] = monthly
    result["interpretation_policy"] = {
        "static": "Natal synastry/composite/Davison/Marks describe different relationship structures and must not be collapsed into one score.",
        "timing": "Secondary progressed synastry/progressed composite and Marks Tertiary-I are timing layers. Repeated tight contacts across independent layers may be called convergence, never event certainty.",
        "privacy": "No chart layer proves another person's private feelings, intention, contact, or reconciliation.",
    }
    return result
