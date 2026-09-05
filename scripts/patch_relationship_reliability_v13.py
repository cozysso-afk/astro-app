from __future__ import annotations

import re
from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding="utf-8")


def once(path: str, old: str, new: str) -> None:
    text = read(path)
    if text.count(old) != 1:
        raise SystemExit(f"{path}: expected exactly one match, got {text.count(old)} for {old[:100]!r}")
    write(path, text.replace(old, new, 1))


def regex_once(path: str, pattern: str, repl: str) -> None:
    text = read(path)
    new, count = re.subn(pattern, repl, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"{path}: regex expected exactly one match, got {count} for {pattern[:100]!r}")
    write(path, new)


once(
    "relationship_western_v1.py",
    "from birth_time_reliability_v1 import resolve_birth_time_reliability\n",
    "from birth_time_reliability_v1 import resolve_birth_time_reliability\nfrom relationship_reliability_v1 import aspect_signature, classify_scan_ratio, decorate_aspect, sensitivity_scan_spec\n",
)
once(
    "relationship_western_v1.py",
    'ENGINE_VERSION = "relationship-western-v1.9-birth-time-provenance"',
    'ENGINE_VERSION = "relationship-western-v1.10-reliability-evidence"',
)
once(
    "relationship_western_v1.py",
    '        "orb_policy": "natal 3-6° by point; secondary 1.5°; tertiary 1.0°; major aspects + quincunx",\n',
    '        "orb_policy": "natal 3-6° by point with very_tight/strong/background grades; secondary 1.5° with narrow-orb priority; tertiary 1.0° supplementary; major aspects + quincunx",\n        "layer_priority": ["natal", "secondary", "major_transit", "daily_transit", "tertiary"],\n',
)

regex_once(
    "relationship_western_v1.py",
    r'def _transit_hits\(transit_chart, natal_chart, person\):\n.*?\n\ndef _side_trigger_score',
    '''def _transit_hits(transit_chart, natal_chart, person):
    transits = transit_chart.get("positions") or {}
    targets = _point_map(natal_chart)
    natal_exact = _chart_time_exact(natal_chart)
    found = []
    for t_name, t_info in transits.items():
        if t_name not in TRANSIT_WEIGHTS:
            continue
        t_lon = float(t_info["lon"])
        orb_limit = _transit_orb_limit(t_name)
        layer_class = "major_transit" if t_name in {"Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"} else "daily_transit"
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
                meta = decorate_aspect(
                    {"a": t_name, "aspect": aspect, "b": target, "orb": round(orb, 3), "tone": tone},
                    mode=layer_class,
                    chart_a_exact=True,
                    chart_b_exact=natal_exact,
                    orb_limit=orb_limit,
                )
                found.append({
                    "person": person,
                    "transit": t_name,
                    "aspect": aspect,
                    "target": target,
                    "orb": round(orb, 3),
                    "tone": tone,
                    "score": round(score, 1),
                    "layer_class": layer_class,
                    "orb_grade": meta["orb_grade"],
                    "time_sensitivity": meta["time_sensitivity"],
                    "birth_time_dependency": meta["birth_time_dependency"],
                    "evidence_confidence": meta["evidence_confidence"],
                    "layer_priority": meta["layer_priority"],
                    "event_probability": "not_calculated",
                })
    found.sort(key=lambda x: (-x["score"], x["orb"]))
    return found[:10]


def _side_trigger_score''',
)

once(
    "relationship_western_v1.py",
    '''def _point_map(chart):
    out = {k: v["lon"] for k, v in (chart.get("positions") or {}).items()}
''',
    '''def _chart_time_exact(chart):
    reliability = chart.get("time_reliability") or {}
    return bool(reliability.get("time_exact"))


def _point_map(chart):
    out = {k: v["lon"] for k, v in (chart.get("positions") or {}).items()}
''',
)

regex_once(
    "relationship_western_v1.py",
    r'def _aspects\(chart_a, chart_b, mode="natal", limit=40\):\n.*?\n\ndef _midpoint_chart',
    '''def _aspects(chart_a, chart_b, mode="natal", limit=40):
    a = _point_map(chart_a); b = _point_map(chart_b)
    found = []
    a_exact = _chart_time_exact(chart_a)
    b_exact = _chart_time_exact(chart_b)
    for p1, l1 in a.items():
        for p2, l2 in b.items():
            dist = _angle_distance(l1, l2)
            best = None
            limit_value = _orb_limit(p1, p2, mode)
            for name, exact in ASPECTS.items():
                orb = abs(dist - exact)
                if orb <= limit_value and (best is None or orb < best[0]):
                    best = (orb, name, exact)
            if best:
                orb, name, exact = best
                tone = "supportive" if name in SUPPORTIVE else ("challenging" if name in CHALLENGING else "mixed")
                row = {
                    "a": p1, "aspect": name, "b": p2,
                    "orb": round(orb, 3), "distance": round(dist, 3), "exact_angle": exact, "tone": tone,
                }
                found.append(decorate_aspect(
                    row,
                    mode=mode,
                    chart_a_exact=a_exact,
                    chart_b_exact=b_exact,
                    orb_limit=limit_value,
                ))
    found.sort(key=lambda x: (x["layer_priority"], x["orb"], 0 if x["a"] in {"Sun", "Moon", "Venus", "Mars", "ASC", "DSC"} else 1))
    return found[:limit]


def _midpoint_chart''',
)

once(
    "relationship_western_v1.py",
    '''    for key in ("ASC", "MC", "DSC", "IC"):
        if key in aa and key in ab:
            angles[key] = round(_mid_angle(aa[key], ab[key]), 6)
    return {"positions": positions, "angles": angles, "method": "shortest-arc midpoint of corresponding points"}
''',
    '''    for key in ("ASC", "MC", "DSC", "IC"):
        if key in aa and key in ab:
            angles[key] = round(_mid_angle(aa[key], ab[key]), 6)
    return {
        "positions": positions,
        "angles": angles,
        "method": "shortest-arc midpoint of corresponding points",
        "time_reliability": {"time_exact": bool(_chart_time_exact(chart_a) and _chart_time_exact(chart_b))},
    }
''',
)

once(
    "relationship_western_v1.py",
    '''    # Planetary secondary progressions are astronomical day-for-year positions.
    # Angles are intentionally omitted here rather than pretending a single disputed angle method.
    return _chart_from_jd(jd, include_moon=True, include_angles=False)
''',
    '''    # Planetary secondary progressions are astronomical day-for-year positions.
    # Angles are intentionally omitted here rather than pretending a single disputed angle method.
    chart = _chart_from_jd(jd, include_moon=True, include_angles=False)
    chart["time_reliability"] = resolve_birth_time_reliability(profile)
    chart["time_basis"] = "secondary_progression_from_entered_birth_time"
    return chart
''',
)

insert_anchor = '''def _point_map(chart):
    out = {k: v["lon"] for k, v in (chart.get("positions") or {}).items()}
'''
scan_helpers = '''def _diagnostic_profile_chart(profile, shift_minutes):
    reliability = resolve_birth_time_reliability(profile)
    if not reliability.get("time_available") or profile.get("birth_time") is None:
        return None
    base = datetime.combine(profile["birth_date"], profile["birth_time"]) + timedelta(minutes=int(shift_minutes))
    jd = _jd_from_utc(_utc_datetime(base.date(), base.time(), profile.get("utc_offset_hours", 9.0)))
    chart = _chart_from_jd(
        jd,
        profile.get("latitude"),
        profile.get("longitude"),
        include_moon=True,
        include_angles=profile.get("latitude") is not None and profile.get("longitude") is not None,
    )
    chart["time_reliability"] = reliability
    chart["time_basis"] = "diagnostic_sensitivity_candidate"
    chart["diagnostic_only"] = True
    chart["shift_minutes"] = int(shift_minutes)
    chart["candidate_local"] = base.isoformat(timespec="minutes")
    return chart


def _birth_time_sensitivity_scan(variable_profile, fixed_chart, variable_side):
    reliability = resolve_birth_time_reliability(variable_profile)
    spec = sensitivity_scan_spec(reliability)
    if spec is None:
        reason = "verified exact birth time; diagnostic scan not required" if reliability.get("time_exact") else "no concrete birth time available to scan"
        return {"available": False, "reason": reason, "time_reliability": reliability}

    samples = []
    occurrences = {}
    center_rows = {}
    center_angles = {}
    for shift in spec["shifts_minutes"]:
        candidate = _diagnostic_profile_chart(variable_profile, shift)
        if candidate is None:
            continue
        aspects = _aspects(candidate, fixed_chart, mode="natal", limit=200) if variable_side == "a" else _aspects(fixed_chart, candidate, mode="natal", limit=200)
        sample_angles = {key: value for key, value in (candidate.get("angles") or {}).items() if key in {"ASC", "DSC", "MC", "IC"}}
        if shift == 0:
            center_angles = sample_angles
        samples.append({
            "shift_minutes": int(shift),
            "candidate_local": candidate["candidate_local"],
            "angles": sample_angles,
            "aspect_count": len(aspects),
        })
        for aspect in aspects:
            sig = aspect_signature(aspect)
            occurrences.setdefault(sig, []).append((int(shift), aspect))
            if shift == 0:
                center_rows[sig] = aspect

    sample_count = len(samples)
    contacts = []
    for sig, entries in occurrences.items():
        if not sample_count:
            continue
        ratio = len(entries) / sample_count
        representative = center_rows.get(sig) or min((row for _, row in entries), key=lambda row: row["orb"])
        row = dict(representative)
        row.update({
            "sample_hits": len(entries),
            "sample_count": sample_count,
            "presence_ratio": round(ratio, 3),
            "scan_class": classify_scan_ratio(ratio),
            "min_orb": round(min(float(item["orb"]) for _, item in entries), 3),
            "max_orb": round(max(float(item["orb"]) for _, item in entries), 3),
            "center_present": sig in center_rows,
            "diagnostic_only": True,
        })
        contacts.append(row)

    rank = {"robust": 0, "sensitive": 1, "fragile": 2}
    contacts.sort(key=lambda row: (rank[row["scan_class"]], -row["presence_ratio"], row["orb"]))

    angle_variation = {}
    for key, center in center_angles.items():
        values = [sample.get("angles", {}).get(key) for sample in samples if sample.get("angles", {}).get(key) is not None]
        if values:
            angle_variation[key] = round(max(_angle_distance(float(value), float(center)) for value in values), 3)

    warnings = []
    fragile_center_angles = [
        row for row in contacts
        if row.get("center_present") and row.get("time_sensitivity") == "fragile" and row.get("scan_class") != "robust"
    ]
    if fragile_center_angles:
        warnings.append("entered-time angle contacts vary materially across the scan window; they are diagnostic only and excluded from production angle/house scoring until exact birth time is verified")

    return {
        "available": True,
        "time_reliability": reliability,
        "window_minutes": spec["window_minutes"],
        "step_minutes": spec["step_minutes"],
        "sample_count": sample_count,
        "samples": samples,
        "robust_contacts": [row for row in contacts if row["scan_class"] == "robust"][:24],
        "sensitive_contacts": [row for row in contacts if row["scan_class"] == "sensitive"][:24],
        "fragile_contacts": [row for row in contacts if row["scan_class"] == "fragile"][:24],
        "angle_variation_deg": angle_variation,
        "warnings": warnings,
        "policy": spec["policy"],
        "event_probability": "not_calculated",
    }


'''
once("relationship_western_v1.py", insert_anchor, scan_helpers + insert_anchor)

regex_once(
    "relationship_western_v1.py",
    r'def _summary\(aspect_sets\):\n.*?\n\ndef build_relationship_western',
    '''def _summary(aspect_sets):
    flat = []
    contributing_layers = set()
    for label, aspects in aspect_sets.items():
        if aspects:
            contributing_layers.add(label)
        for x in aspects:
            y = dict(x); y["layer"] = label; flat.append(y)
    flat.sort(key=lambda x: (x.get("layer_priority", 9), x["orb"]))
    return {
        "exact_contacts": len([x for x in flat if x["orb"] <= 0.5]),
        "very_tight_contacts": len([x for x in flat if x.get("orb_grade") == "very_tight"]),
        "strong_contacts": len([x for x in flat if x.get("orb_grade") == "strong"]),
        "supportive_contacts": len([x for x in flat if x["tone"] == "supportive"]),
        "challenging_contacts": len([x for x in flat if x["tone"] == "challenging"]),
        "independent_layers": len(contributing_layers),
        "convergence": len(contributing_layers) >= 2,
        "tightest": flat[:10],
        "note": "orb grade and layer priority outrank raw contact count; convergence requires repeated evidence across independent layers and is never an event probability",
    }


def build_relationship_western''',
)

once(
    "relationship_western_v1.py",
    '''    if user_natal is None or cp_natal is None:
        return {"ok": False, "error": "natal chart inputs unavailable", "engine": ENGINE_VERSION}

    fallback_labels = []
''',
    '''    if user_natal is None or cp_natal is None:
        return {"ok": False, "error": "natal chart inputs unavailable", "engine": ENGINE_VERSION}

    result["sensitivity_scan"] = {
        "user": _birth_time_sensitivity_scan(user_profile, cp_natal, "a"),
        "counterpart": _birth_time_sensitivity_scan(counterpart_profile, user_natal, "b"),
        "policy": "non-exact entered times are scanned diagnostically; scan-only angle/house candidates never enter production scores",
    }

    fallback_labels = []
''',
)

once(
    "relationship_western_v1.py",
    '''        "partner_time_reliability": cp_reliability,
        "aspects": natal_aspects,
        "note": natal_precision_note,
''',
    '''        "partner_time_reliability": cp_reliability,
        "aspects": natal_aspects,
        "robust_aspects": [row for row in natal_aspects if row.get("time_sensitivity") == "robust"],
        "conditional_aspects": [row for row in natal_aspects if row.get("time_sensitivity") == "medium"],
        "time_sensitive_aspects": [row for row in natal_aspects if row.get("time_sensitivity") in {"sensitive", "fragile"}],
        "note": natal_precision_note,
''',
)

once(
    "relationship_western_v1.py",
    '''        "timing": "Secondary progressed synastry/progressed composite and Marks Tertiary-I are timing layers. Repeated tight contacts across independent layers may be called convergence, never event certainty.",
        "birth_time": "An entered clock time is not automatically an exact birth time. Provisional times may support planetary layers, while angles/houses/Davison/Marks require provenance-verified exact time.",
''',
    '''        "timing": "Secondary progressed synastry/progressed composite and Marks Tertiary-I are timing layers. Repeated tight contacts across independent layers may be called convergence, never event certainty.",
        "layer_priority": "Interpret in this order: natal structure > secondary progression > major/medium-term transit > fast daily transit > tertiary/Marks supplementary. A tertiary-only hit cannot overturn higher-layer evidence.",
        "evidence": "Prioritize orb_grade, evidence_confidence, time_sensitivity and independent-layer repetition over raw aspect counts.",
        "birth_time": "An entered clock time is not automatically an exact birth time. Provisional times may support planetary layers, while angles/houses/Davison/Marks require provenance-verified exact time.",
''',
)

# AI packet: preserve new reliability metadata and force evidence-first hierarchy.
once(
    "supabase/functions/relationship-interpret-v9-preview/index.ts",
    'const DEFAULT_MODEL="gemini-3.7-flash",FALLBACK_MODEL="gemini-3.6-flash",VERSION="relationship-v11.3-birth-time-provenance";',
    'const DEFAULT_MODEL="gemini-3.7-flash",FALLBACK_MODEL="gemini-3.6-flash",VERSION="relationship-v11.4-reliability-evidence";',
)
once(
    "supabase/functions/relationship-interpret-v9-preview/index.ts",
    'function aspect(a:any){if(!a||typeof a!=="object")return null;const orb=Number(a.orb??99);if(!Number.isFinite(orb))return null;return {a:String(a.a??""),aspect:String(a.aspect??""),b:String(a.b??""),orb,tone:String(a.tone??"mixed"),layer:a.layer??null};}',
    'function aspect(a:any){if(!a||typeof a!=="object")return null;const orb=Number(a.orb??99);if(!Number.isFinite(orb))return null;return {a:String(a.a??""),aspect:String(a.aspect??""),b:String(a.b??""),orb,tone:String(a.tone??"mixed"),layer:a.layer??null,orb_grade:a.orb_grade??null,time_sensitivity:a.time_sensitivity??null,evidence_confidence:a.evidence_confidence??null,layer_priority:a.layer_priority??null,event_probability:a.event_probability??"not_calculated"};}',
)
once(
    "supabase/functions/relationship-interpret-v9-preview/index.ts",
    'function transitHit(x:any){if(!x||typeof x!=="object")return null;return {person:x?.person??null,transit:x?.transit??null,aspect:x?.aspect??null,target:x?.target??null,orb:Number(x?.orb??0),tone:x?.tone??null,score:Number(x?.score??0)};}',
    'function transitHit(x:any){if(!x||typeof x!=="object")return null;return {person:x?.person??null,transit:x?.transit??null,aspect:x?.aspect??null,target:x?.target??null,orb:Number(x?.orb??0),tone:x?.tone??null,score:Number(x?.score??0),layer_class:x?.layer_class??null,orb_grade:x?.orb_grade??null,time_sensitivity:x?.time_sensitivity??null,evidence_confidence:x?.evidence_confidence??null,layer_priority:x?.layer_priority??null,event_probability:x?.event_probability??"not_calculated"};}',
)
once(
    "supabase/functions/relationship-interpret-v9-preview/index.ts",
    '   precision:{partner_time_available:available,partner_time_exact:exact,birth_time_reliability:r?.birth_time_reliability??null,removed_time_sensitive_count:(Array.isArray(n?.aspects)?n.aspects.length:0)-aspects.length},',
    '   precision:{partner_time_available:available,partner_time_exact:exact,birth_time_reliability:r?.birth_time_reliability??null,sensitivity_scan:r?.sensitivity_scan??null,removed_time_sensitive_count:(Array.isArray(n?.aspects)?n.aspects.length:0)-aspects.length},',
)
# Insert hierarchy rules immediately after the first common absolute-rule line if not already present.
text = read("supabase/functions/relationship-interpret-v9-preview/index.ts")
needle = "- 오브가 좁은 실제 접점을 우선한다."
if needle not in text:
    raise SystemExit("relationship interpreter system prompt anchor missing")
text = text.replace(
    needle,
    needle + " 접점 개수보다 orb_grade·evidence_confidence·time_sensitivity를 우선한다.\n- 레이어 우선순위는 Natal structure > Secondary Progression > 주요/중장기 Transit > 빠른 Daily Transit > Tertiary/Marks 보조층이다. 하위 보조층 하나만으로 상위 레이어 결론을 뒤집지 않는다.\n- sensitivity_scan은 진단용이며 exact 생시 확정이나 사건확률 계산에 사용하지 않는다.",
    1,
)
write("supabase/functions/relationship-interpret-v9-preview/index.ts", text)

# Required calculation gate.
workflow = "./.github/workflows/calculation-audit-ci.yml"
once(
    workflow,
    "      - 'relationship_saju_v1.py'\n",
    "      - 'relationship_saju_v1.py'\n      - 'relationship_reliability_v1.py'\n",
)
once(
    workflow,
    "      - 'tests/test_birth_time_reliability_v12.py'\n",
    "      - 'tests/test_birth_time_reliability_v12.py'\n      - 'tests/test_relationship_reliability_v13.py'\n",
)
once(
    workflow,
    "relationship_western_v1.py relationship_saju_v1.py birth_time_reliability_v1.py personal_marriage_v1.py",
    "relationship_western_v1.py relationship_saju_v1.py relationship_reliability_v1.py birth_time_reliability_v1.py personal_marriage_v1.py",
)
once(
    workflow,
    "            tests/test_birth_time_reliability_v12.py \\\n            tests/test_personal_marriage_v1.py",
    "            tests/test_birth_time_reliability_v12.py \\\n            tests/test_relationship_reliability_v13.py \\\n            tests/test_personal_marriage_v1.py",
)

print("relationship reliability V13 patches applied")
