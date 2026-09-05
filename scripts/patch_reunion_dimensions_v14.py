from __future__ import annotations

import re
from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding="utf-8")


def once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, got {count}: {old[:120]!r}")
    write(path, text.replace(old, new, 1))


def regex_once(path: str, pattern: str, repl: str) -> None:
    text = read(path)
    new, count = re.subn(pattern, repl, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"{path}: regex expected one match, got {count}: {pattern[:120]!r}")
    write(path, new)


# ----- relationship engine -----
once(
    "relationship_western_v1.py",
    "from relationship_reliability_v1 import aspect_signature, classify_scan_ratio, decorate_aspect, sensitivity_scan_spec\n",
    "from relationship_reliability_v1 import aspect_signature, classify_scan_ratio, decorate_aspect, sensitivity_scan_spec\nfrom reunion_dimension_v1 import DIMENSIONS, daily_dimension_scores, secondary_support\n",
)
once(
    "relationship_western_v1.py",
    'ENGINE_VERSION = "relationship-western-v1.10-reliability-evidence"',
    'ENGINE_VERSION = "relationship-western-v1.11-reunion-dimensions"',
)

anchor = '''def _build_reunion_transits(user_natal, cp_natal, start_date, end_date, utc_offset_hours):
'''
helpers = '''def _dimension_timing_stat(rows, dimension, score_key, label):
    adapted = []
    for row in rows:
        value = ((row.get("dimensions") or {}).get(dimension) or {}).get(score_key)
        if isinstance(value, (int, float)):
            adapted.append({"date": row["date"], "value": float(value)})
    return _relationship_timing_stat(adapted, "value", label) if adapted else None


def _reunion_dimension_context(rows, start_date, end_date):
    labels = {
        "contact_recontact": "연락·재접촉 활성지수 · 사건 발생 확률 아님",
        "emotional_reactivation": "감정·관계 재활성지수 · 실제 속마음/사건 확률 아님",
        "relationship_rebuilding": "관계 재구축 지원 활성지수 · 실제 재결합/장기지속 확률 아님",
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
        ranked = sorted(
            rows,
            key=lambda row: -float(((row.get("dimensions") or {}).get(dimension) or {}).get("score") or 0.0),
        )
        top_evidence = []
        for row in ranked:
            data = (row.get("dimensions") or {}).get(dimension) or {}
            if float(data.get("score") or 0.0) <= 0:
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
        "policy": "contact/recontact, emotional reactivation, and relationship rebuilding support are orthogonal transit-activation dimensions. Each keeps incoming/outgoing/reconnection directions separate. No overall reunion score or event probability is calculated.",
    }


'''
once("relationship_western_v1.py", anchor, helpers + anchor)

once(
    "relationship_western_v1.py",
    '''        user_score = _side_trigger_score(user_hits)
        cp_score = _side_trigger_score(cp_hits)
        shared_bonus = 8.0 if user_score >= 35 and cp_score >= 35 else 0.0
        combined = round(min(100.0, user_score * .45 + cp_score * .55 + shared_bonus), 1)
        rows.append({
''',
    '''        user_score = _side_trigger_score(user_hits)
        cp_score = _side_trigger_score(cp_hits)
        shared_bonus = 8.0 if user_score >= 35 and cp_score >= 35 else 0.0
        combined = round(min(100.0, user_score * .45 + cp_score * .55 + shared_bonus), 1)
        dimensions = daily_dimension_scores(user_hits, cp_hits)
        rows.append({
''',
)
once(
    "relationship_western_v1.py",
    '''            "shared_activation": bool(user_score >= 25 and cp_score >= 25),
            "hits": (cp_hits[:3] + user_hits[:3])[:6],
        })
''',
    '''            "shared_activation": bool(user_score >= 25 and cp_score >= 25),
            "hits": (cp_hits[:3] + user_hits[:3])[:6],
            "dimensions": dimensions,
        })
''',
)
once(
    "relationship_western_v1.py",
    '''        "top_months": top_months[:12],
        "directional_context": _relationship_directional_context(rows, start_date, end_date),
    }
''',
    '''        "top_months": top_months[:12],
        "directional_context": _relationship_directional_context(rows, start_date, end_date),
        "dimensions": _reunion_dimension_context(rows, start_date, end_date),
    }
''',
)

once(
    "relationship_western_v1.py",
    '''        result["relationship_transits"] = transit_layer
        result["reunion_transits"] = transit_layer
''',
    '''        result["relationship_transits"] = transit_layer
        result["reunion_transits"] = transit_layer
        result["reunion_dimensions"] = transit_layer["dimensions"]
''',
)

once(
    "relationship_western_v1.py",
    '''        row["signal_summary"] = _summary(layer_aspects)
        monthly.append(row)

    result["months"] = monthly
''',
    '''        row["signal_summary"] = _summary(layer_aspects)
        if analysis_mode == "reunion":
            row["reunion_secondary_support"] = secondary_support(row)
        monthly.append(row)

    result["months"] = monthly
    if analysis_mode == "reunion":
        result["reunion_secondary_support"] = {
            "months": [
                {"calendar_month": row["calendar_month"], "representative_date": row["representative_date"], "dimensions": row.get("reunion_secondary_support")}
                for row in monthly
            ],
            "policy": "secondary progressed synastry and progressed composite are higher-priority timing evidence and remain separate from daily transit activation scores; Marks/Tertiary stays supplementary and is not folded into these primary dimension supports",
            "event_probability": "not_calculated",
        }
''',
)

once(
    "relationship_western_v1.py",
    '''        "evidence": "Prioritize orb_grade, evidence_confidence, time_sensitivity and independent-layer repetition over raw aspect counts.",
        "birth_time": "An entered clock time is not automatically an exact birth time. Provisional times may support planetary layers, while angles/houses/Davison/Marks require provenance-verified exact time.",
''',
    '''        "evidence": "Prioritize orb_grade, evidence_confidence, time_sensitivity and independent-layer repetition over raw aspect counts.",
        "reunion_dimensions": "For reunion mode keep three orthogonal outcomes separate: contact/recontact activation, emotional/relationship reactivation, and relationship-rebuilding support. Within every dimension keep incoming, outgoing and reconnection separate. Never collapse them into one reunion score.",
        "birth_time": "An entered clock time is not automatically an exact birth time. Provisional times may support planetary layers, while angles/houses/Davison/Marks require provenance-verified exact time.",
''',
)

# ----- internal relationship AI -----
once(
    "supabase/functions/relationship-interpret-v9-preview/index.ts",
    'const DEFAULT_MODEL="gemini-3.7-flash",FALLBACK_MODEL="gemini-3.6-flash",VERSION="relationship-v11.4-reliability-evidence";',
    'const DEFAULT_MODEL="gemini-3.7-flash",FALLBACK_MODEL="gemini-3.6-flash",VERSION="relationship-v11.5-reunion-dimensions";',
)

anchor_ts = '''function compact(calc:any,ctx:any,purpose:Purpose,level=0){
'''
helper_ts = '''function reunionDimensionPacket(raw:any,n:number){
 if(!raw||typeof raw!=="object")return null;
 const one=(x:any)=>x&&typeof x==="object"?{
   incoming:stat(x?.incoming),outgoing:stat(x?.outgoing),reconnection:stat(x?.reconnection),
   top_evidence:(Array.isArray(x?.top_evidence)?x.top_evidence:[]).slice(0,n).map((e:any)=>({date:e?.date??null,score:Number(e?.score??0),user_score:Number(e?.user_score??0),counterpart_score:Number(e?.counterpart_score??0),user_evidence:aspectList(e?.user_evidence,2),counterpart_evidence:aspectList(e?.counterpart_evidence,2),event_probability:"not_calculated"})),
 }:null;
 return {contact_recontact:one(raw?.contact_recontact),emotional_reactivation:one(raw?.emotional_reactivation),relationship_rebuilding:one(raw?.relationship_rebuilding),policy:raw?.policy??null};
}
function secondarySupportPacket(raw:any,n:number){
 if(!raw||typeof raw!=="object")return null;
 const months=(Array.isArray(raw?.months)?raw.months:[]).slice(0,n).map((m:any)=>({calendar_month:m?.calendar_month??null,representative_date:m?.representative_date??null,dimensions:m?.dimensions??null}));
 return {months,policy:raw?.policy??null,event_probability:"not_calculated"};
}
'''
once("supabase/functions/relationship-interpret-v9-preview/index.ts", anchor_ts, helper_ts + anchor_ts)

once(
    "supabase/functions/relationship-interpret-v9-preview/index.ts",
    '''   directional:purpose==="reunion"&&ctx?{period:ctx?.period,incoming:stat(ctx?.incoming),outgoing:stat(ctx?.outgoing),reconnection:stat(ctx?.reconnection),ranked_months:rankedMonths}:null,
   transit_triggers:trans?{period:trans?.period,policy:trans?.policy,top_days:transitDays,top_months:transitMonths}:null,
''',
    '''   directional:purpose==="reunion"&&ctx?{period:ctx?.period,incoming:stat(ctx?.incoming),outgoing:stat(ctx?.outgoing),reconnection:stat(ctx?.reconnection),ranked_months:rankedMonths}:null,
   reunion_dimensions:purpose==="reunion"?reunionDimensionPacket(r?.reunion_dimensions,L.ranked):null,
   reunion_secondary_support:purpose==="reunion"?secondarySupportPacket(r?.reunion_secondary_support,L.months):null,
   transit_triggers:trans?{period:trans?.period,policy:trans?.policy,top_days:transitDays,top_months:transitMonths}:null,
''',
)

once(
    "supabase/functions/relationship-interpret-v9-preview/index.ts",
    '''- sensitivity_scan은 진단용이며 exact 생시 확정이나 사건확률 계산에 사용하지 않는다.
''',
    '''- sensitivity_scan은 진단용이며 exact 생시 확정이나 사건확률 계산에 사용하지 않는다.
- 재회운에서는 CALCULATED_DATA.reunion_dimensions의 ① contact_recontact(연락·재접촉) ② emotional_reactivation(감정·관계 재활성) ③ relationship_rebuilding(관계 재구축 지원층)을 절대 하나의 재회 점수로 합치지 않는다. 각 축 안에서도 incoming(상대측)·outgoing(내측)·reconnection(동시 재접점)을 분리한다.
- reunion_secondary_support는 daily transit 점수와 합산하지 않는다. Secondary Progression(2차 진행)은 Daily Transit보다 상위 근거로 읽고, Marks/Tertiary 단독 신호로 관계 재구축 결론을 뒤집지 않는다.
''',
)

once(
    "supabase/functions/relationship-interpret-v9-preview/index.ts",
    'const REUNION_SCHEMA:any={type:"OBJECT",properties:{bottom_line:S,incoming_contact:S,outgoing_contact:S,reconnection_windows:S,low_windows:S,relationship_filter:S,precision_note:S},required:["bottom_line","incoming_contact","outgoing_contact","reconnection_windows","low_windows","relationship_filter","precision_note"]};',
    'const REUNION_SCHEMA:any={type:"OBJECT",properties:{bottom_line:S,contact_recontact:S,emotional_reactivation:S,relationship_rebuilding:S,incoming_contact:S,outgoing_contact:S,reconnection_windows:S,low_windows:S,relationship_filter:S,precision_note:S},required:["bottom_line","contact_recontact","emotional_reactivation","relationship_rebuilding","incoming_contact","outgoing_contact","reconnection_windows","low_windows","relationship_filter","precision_note"]};',
)

once(
    "supabase/functions/relationship-interpret-v9-preview/index.ts",
    '''reunion_reading:{bottom_line:cut(rr.bottom_line,4500),incoming_contact:cut(rr.incoming_contact,4000),outgoing_contact:cut(rr.outgoing_contact,3500),reconnection_windows:cut(rr.reconnection_windows,6000),low_windows:cut(rr.low_windows,3500),relationship_filter:cut(rr.relationship_filter,4500),precision_note:cut(rr.precision_note,1800)},''',
    '''reunion_reading:{bottom_line:cut(rr.bottom_line,4500),contact_recontact:cut(rr.contact_recontact,4000),emotional_reactivation:cut(rr.emotional_reactivation,4000),relationship_rebuilding:cut(rr.relationship_rebuilding,4500),incoming_contact:cut(rr.incoming_contact,4000),outgoing_contact:cut(rr.outgoing_contact,3500),reconnection_windows:cut(rr.reconnection_windows,6000),low_windows:cut(rr.low_windows,3500),relationship_filter:cut(rr.relationship_filter,4500),precision_note:cut(rr.precision_note,1800)},''',
)
once(
    "supabase/functions/relationship-interpret-v9-preview/index.ts",
    '''if(p!=="reunion")out.reunion_reading={bottom_line:"",incoming_contact:"",outgoing_contact:"",reconnection_windows:"",low_windows:"",relationship_filter:"",precision_note:""};''',
    '''if(p!=="reunion")out.reunion_reading={bottom_line:"",contact_recontact:"",emotional_reactivation:"",relationship_rebuilding:"",incoming_contact:"",outgoing_contact:"",reconnection_windows:"",low_windows:"",relationship_filter:"",precision_note:""};''',
)
once(
    "supabase/functions/relationship-interpret-v9-preview/index.ts",
    'purpose==="reunion"?"재회운이다. 시기창과 실제 트랜짓 근거를 우선하되 기본 궁합의 재회 필터도 깊게 써라."',
    'purpose==="reunion"?"재회운이다. 연락·재접촉 / 감정·관계 재활성 / 관계 재구축 지원층을 각각 따로 결론내고, 각 축의 수신·발신·동시 재접점 방향도 분리하라. Secondary Progression을 Daily Transit보다 상위 시기근거로 두고 하나의 재회 점수는 만들지 마라."',
)

# ----- browser AI cache contract -----
once(
    "web/src/lib/readingCache.ts",
    "const RELATIONSHIP_AI_CACHE_CONTRACT = 'relationship-v11.4-reliability-evidence'",
    "const RELATIONSHIP_AI_CACHE_CONTRACT = 'relationship-v11.5-reunion-dimensions'",
)

# ----- external AI packet / prompt -----
once(
    "web/src/lib/resultFormatters.ts",
    '''    orb: Number(orb.toFixed(2)), tone: String(row.tone ?? 'mixed'), layer: row.layer ?? undefined,
  }
''',
    '''    orb: Number(orb.toFixed(2)), tone: String(row.tone ?? 'mixed'), layer: row.layer ?? undefined,
    orb_grade:row.orb_grade ?? undefined, time_sensitivity:row.time_sensitivity ?? undefined,
    evidence_confidence:row.evidence_confidence ?? undefined, layer_priority:row.layer_priority ?? undefined,
    event_probability:row.event_probability ?? 'not_calculated',
  }
''',
)
once(
    "web/src/lib/resultFormatters.ts",
    '''    reunion_transits: transits,
    reunion_directional_context: reunionContext ? {
''',
    '''    reunion_transits: transits,
    reunion_dimensions: rawResult.reunion_dimensions ?? null,
    reunion_secondary_support: rawResult.reunion_secondary_support ?? null,
    reunion_directional_context: reunionContext ? {
''',
)
once(
    "web/src/lib/resultFormatters.ts",
    '''- 좁은 오브의 실제 접점과 서로 독립된 레이어에서 반복되는 근거를 우선한다. 접점 수·점수는 연락/재회/결혼 확률이 아니다.',
''',
    '''- 좁은 오브의 실제 접점과 서로 독립된 레이어에서 반복되는 근거를 우선한다. 접점 수·점수는 연락/재회/결혼 확률이 아니다.',
''',
) if False else None
# Add explicit reunion semantics beside the existing mode rule text.
text = read("web/src/lib/resultFormatters.ts")
needle = "'- 아래 COMPACT_CALCULATED_DATA만 단일 근거로 사용한다. 데이터에 없는 요소·사건 확률·상대 속마음은 만들지 않는다.',"
if needle not in text:
    raise SystemExit("external prompt rule anchor missing")
text = text.replace(
    needle,
    needle + "\n    '- 재회운은 reunion_dimensions의 연락·재접촉 / 감정·관계 재활성 / 관계 재구축 지원층을 분리하고, 각 축의 incoming/outgoing/reconnection도 합치지 않는다. reunion_secondary_support는 daily transit 점수와 합산하지 않는다.',",
    1,
)
write("web/src/lib/resultFormatters.ts", text)

# ----- contract tests version bump -----
for test_path in ["web/src/lib/relationshipModeContract.test.mjs", "web/src/lib/relationshipEvidencePipeline.test.mjs"]:
    text = read(test_path)
    text = text.replace("relationship-v11\\.4-reliability-evidence", "relationship-v11\\.5-reunion-dimensions")
    text = text.replace("relationship-v11.4-reliability-evidence", "relationship-v11.5-reunion-dimensions")
    write(test_path, text)

# ----- permanent required calculation gate -----
workflow = ".github/workflows/calculation-audit-ci.yml"
once(workflow, "      - 'relationship_reliability_v1.py'\n", "      - 'relationship_reliability_v1.py'\n      - 'reunion_dimension_v1.py'\n")
once(workflow, "      - 'tests/test_relationship_reliability_v13.py'\n", "      - 'tests/test_relationship_reliability_v13.py'\n      - 'tests/test_reunion_dimensions_v14.py'\n")
once(workflow, "relationship_saju_v1.py relationship_reliability_v1.py birth_time_reliability_v1.py", "relationship_saju_v1.py relationship_reliability_v1.py reunion_dimension_v1.py birth_time_reliability_v1.py")
once(workflow, "            tests/test_relationship_reliability_v13.py \\\n            tests/test_personal_marriage_v1.py", "            tests/test_relationship_reliability_v13.py \\\n            tests/test_reunion_dimensions_v14.py \\\n            tests/test_personal_marriage_v1.py")

print("reunion dimensions V14 patches applied")
