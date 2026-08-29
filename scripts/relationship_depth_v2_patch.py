from pathlib import Path

# ---- relationship western ----
p=Path('relationship_western_v1.py')
t=p.read_text(encoding='utf-8')
t=t.replace('ENGINE_VERSION = "relationship-western-v1.1-transit-triggers"','ENGINE_VERSION = "relationship-western-v1.2-depth-focus"')
marker='''def _summary(aspect_sets):\n'''
insert='''def _house_of_longitude(cusps, longitude):
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


def _house_overlays(source_chart, target_chart, source_label, target_label):
    cusps = (target_chart.get("angles") or {}).get("cusps")
    if not cusps:
        return {"available": False, "reason": f"{target_label} exact birth time/place required for house overlays"}
    rows=[]
    for planet, info in (source_chart.get("positions") or {}).items():
        house=_house_of_longitude(cusps, info["lon"])
        if house:
            rows.append({"source": source_label, "planet": planet, "target": target_label, "house": house})
    priority={4:0,5:1,7:2,8:3,1:4,10:5}
    rows.sort(key=lambda x:(priority.get(x["house"],9), x["house"], x["planet"]))
    return {
        "available": True,
        "all": rows,
        "relationship_houses": [x for x in rows if x["house"] in {4,5,7,8}],
        "note": "4=가정/정서적 기반, 5=연애/즐거움, 7=파트너십, 8=친밀감/공유자원. 사건 보장이나 궁합 점수가 아님",
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


'''
if marker not in t: raise SystemExit('western marker missing')
t=t.replace(marker,insert+marker,1)
old='''    result["natal_synastry"] = {
        "available": True,
        "partner_time_exact": cp_exact,
        "aspects": _aspects(user_natal, cp_natal, mode="natal"),
        "note": "If partner birth time is unknown, partner Moon and angles are excluded; remaining planets use local noon and should be treated as lower precision near orb boundaries." if not cp_exact else "Both birth times/locations available; planets and angles included.",
    }
'''
new='''    natal_aspects = _aspects(user_natal, cp_natal, mode="natal")
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
        "precision_note": "Both exact birth times/places required. Unknown partner time disables partner-house overlays rather than estimating them." if not cp_exact else "Exact-time Placidus house overlays available.",
    }
'''
if old not in t: raise SystemExit('natal block missing')
t=t.replace(old,new,1)
t=t.replace('''        result["reunion_transits"] = _build_reunion_transits(
            user_natal, cp_natal, month_segments[0][0], month_segments[-1][1], user_profile.get("utc_offset_hours", 9.0)
        )
''','''        transit_layer = _build_reunion_transits(
            user_natal, cp_natal, month_segments[0][0], month_segments[-1][1], user_profile.get("utc_offset_hours", 9.0)
        )
        result["relationship_transits"] = transit_layer
        result["reunion_transits"] = transit_layer
''',1)
p.write_text(t,encoding='utf-8')

# ---- FastAPI: accept analysis mode and attach Saju layer ----
p=Path('api/main.py'); t=p.read_text(encoding='utf-8')
t=t.replace('from relationship_western_v1 import build_relationship_western','from relationship_western_v1 import build_relationship_western\nfrom relationship_saju_v1 import ENGINE_VERSION as REL_SAJU_ENGINE_VERSION, build_relationship_saju')
t=t.replace('APP_VERSION = "api-fortune-v4.6-fixpack"','APP_VERSION = "api-fortune-v4.7-relationship-depth"')
t=t.replace('''class RelationshipRequest(BaseModel):
    user: RelationshipProfile
    counterpart: RelationshipProfile
    start_date: date
    end_date: date
    relationship_status: RelationshipStatus = "dating"
''','''class RelationshipRequest(BaseModel):
    user: RelationshipProfile
    counterpart: RelationshipProfile
    start_date: date
    end_date: date
    relationship_status: RelationshipStatus = "dating"
    analysis_mode: Literal["compatibility", "reunion", "marriage_unmarried", "marriage_married"] = "compatibility"
''')
old='''    try:
        result = build_relationship_western(user_payload, cp_payload, segments)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"relationship calculation failed: {exc}") from exc

    return {
'''
new='''    try:
        result = build_relationship_western(user_payload, cp_payload, segments)
        result["analysis_mode"] = request.analysis_mode
        try:
            result["saju_relationship"] = build_relationship_saju(user_payload, cp_payload)
        except Exception as saju_exc:
            result["saju_relationship"] = {"available": False, "engine": REL_SAJU_ENGINE_VERSION, "error": str(saju_exc)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"relationship calculation failed: {exc}") from exc

    return {
'''
if old not in t: raise SystemExit('api relationship block missing')
t=t.replace(old,new,1)
p.write_text(t,encoding='utf-8')
print('relationship depth v2 patch applied')
