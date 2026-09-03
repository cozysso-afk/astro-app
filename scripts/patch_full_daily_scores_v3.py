from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str) -> None:
    p = ROOT / path
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'anchor missing: {path}: {old[:100]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


# ---------------------------------------------------------------------------
# 1) Calculation engine: preserve every calculated day + actual evidence.
# ---------------------------------------------------------------------------
path = 'integrated_fortune_v1.py'
replace_once(path, 'ENGINE_VERSION = "integrated-fortune-v2.10-thai-lagna-research"', 'ENGINE_VERSION = "integrated-fortune-v2.11-full-daily-evidence"')
replace_once(path, 'WESTERN_ENGINE_VERSION = "western-period-engine-v10-bounded-vector"', 'WESTERN_ENGINE_VERSION = "western-period-engine-v11-full-daily-evidence"')

rows_anchor = '''def _rows_avg(rows: list[dict], key: str):
    vals = [r.get(key) for r in rows if isinstance(r.get(key), (int, float))]
    return int(round(sum(vals) / len(vals))) if vals else None
'''
rows_new = rows_anchor + '''

def _compact_daily_evidence(life_rows: list[dict], market_rows: list[dict], limit: int = 10):
    """Keep the strongest real aspect/house contacts from an already-scanned day.

    The annual engine already computes these rows to obtain the daily scores. We
    preserve a compact evidence signature here instead of throwing the calculation
    away and asking the AI to infer why a date was strong or weak.
    """
    best: dict[tuple, dict] = {}

    def ingest(rows: list[dict], topic_names):
        for sample in rows:
            stamp = sample.get("dt")
            sample_time = stamp.strftime("%H:%M") if stamp is not None else ""
            topics = sample.get("topics") if isinstance(sample.get("topics"), dict) else {}
            for topic in topic_names:
                result = topics.get(topic)
                if not isinstance(result, dict):
                    continue
                for evidence in result.get("evidence") or []:
                    if not isinstance(evidence, dict):
                        continue
                    kind = str(evidence.get("kind") or "")
                    if kind == "aspect":
                        identity = (
                            kind, evidence.get("transit"), evidence.get("target"),
                            evidence.get("aspect"), evidence.get("motion"), evidence.get("direction"),
                        )
                    elif kind == "house":
                        identity = (kind, evidence.get("transit"), evidence.get("whole_house"), evidence.get("placidus_house"))
                    else:
                        identity = (kind, str(evidence))
                    try:
                        contribution = float(evidence.get("score") or 0.0)
                    except (TypeError, ValueError):
                        contribution = 0.0
                    current = best.get(identity)
                    if current is not None and float(current.get("contribution") or 0.0) >= contribution:
                        current.setdefault("source_topics", [])
                        if topic not in current["source_topics"]:
                            current["source_topics"].append(topic)
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
                    best[identity] = packed

    ingest(life_rows, ("금전", "학업", "시험", "직장", "이직", "대인관계", "연애", "연락", "재회", "소식", "컨디션"))
    ingest(market_rows, ("금전", "투자심리"))
    out = list(best.values())
    out.sort(key=lambda item: (
        0 if item.get("kind") == "aspect" else 1,
        -float(item.get("contribution") or 0.0),
        float(item.get("orb") or 99.0),
        str(item.get("text") or ""),
    ))
    for item in out:
        item["source_topics"] = sorted(set(item.get("source_topics") or []))
    return out[:max(1, int(limit))]
'''
replace_once(path, rows_anchor, rows_new)

replace_once(
    path,
    '''    for key in ["수익실현", "신규진입", "투자주의"]:
        row[key] = _rows_avg(market, key) if market else None
    return row


def _aggregate_topic_result''',
    '''    for key in ["수익실현", "신규진입", "투자주의"]:
        row[key] = _rows_avg(market, key) if market else None
    row["_evidence"] = _compact_daily_evidence(life, market, 10)
    return row


def _aggregate_topic_result''',
)

replace_once(
    path,
    '''    for key in ["수익실현", "신규진입", "투자주의"]:
        row[key] = _rows_avg(market, key) if market else None
    return {"row": row, "detail": _legacy_detail(day_value, timing, market)}
''',
    '''    for key in ["수익실현", "신규진입", "투자주의"]:
        row[key] = _rows_avg(market, key) if market else None
    row["_evidence"] = _compact_daily_evidence(life, market, 10)
    return {"row": row, "detail": _legacy_detail(day_value, timing, market)}
''',
)

relationship_anchor = '''    relationship_signals = {
        key: _period_stats(rows, key) for key in ["수신신호", "발신적합", "과거인연접점"]
    }
'''
relationship_new = relationship_anchor + '''    daily_score_keys = TOPIC_ORDER + ["수신신호", "발신적합", "과거인연접점"]
    daily_scores = []
    for row in rows:
        daily_scores.append({
            "date": row["date"],
            "label": row["label"],
            "market_open": bool(row.get("market_open")),
            "scores": {
                key: (float(row[key]) if isinstance(row.get(key), (int, float)) else None)
                for key in daily_score_keys
            },
            "evidence": list(row.get("_evidence") or [])[:10],
        })
'''
replace_once(path, relationship_anchor, relationship_new)

replace_once(
    path,
    '''    # Intraday evidence is returned for a single selected day. Multi-day reports
    # keep best/caution dates but avoid multiplying expensive intraday scans.
''',
    '''    # Multi-day reports now preserve every calculated daily score and a compact
    # signature of the real aspect/house evidence already used to produce it.
    # Full intraday best/caution windows remain a single-day precision feature.
''',
)
replace_once(
    path,
    '''        "performance": {"vector_ephemeris_prewarm": bool(prewarmed_longitudes), "prewarmed_longitudes": prewarmed_longitudes},''',
    '''        "performance": {"vector_ephemeris_prewarm": bool(prewarmed_longitudes), "prewarmed_longitudes": prewarmed_longitudes, "daily_evidence_days": len(daily_scores), "daily_evidence_rows": sum(len(row.get("evidence") or []) for row in daily_scores)},''',
)
replace_once(
    path,
    '''        "detail_days": detail_days,
        "months": months,
''',
    '''        "detail_days": detail_days,
        "daily_scores": daily_scores,
        "months": months,
''',
)

# ---------------------------------------------------------------------------
# 2) Interpretation packet: full 365-day matrix + deterministic trajectory digest.
# ---------------------------------------------------------------------------
path = 'supabase/functions/fortune-interpret-v6-preview/integratedInterpretationV2.ts'
replace_once(path, 'export const VERSION = "supabase-ai-v8-evidence-ledger-five-stage-guard";', 'export const VERSION = "supabase-ai-v9-full-daily-trajectory-five-stage-guard";')
replace_once(path, 'export const PACKET_VERSION = "fortune-interpretation-packet-v2";', 'export const PACKET_VERSION = "fortune-interpretation-packet-v3-full-daily";')

compact_anchor = '''function evidenceDirection(topic:string,kind:"best"|"caution"|"average",score:number){
  if(topic===INVESTMENT_RISK){
    if(kind==="best" || (kind==="average"&&score>=60))return "caution" as const;
    if(kind==="caution" || (kind==="average"&&score<40))return "supportive" as const;
    return "neutral" as const;
  }
  if(kind==="best")return "supportive" as const;
  if(kind==="caution")return "caution" as const;
  if(score>=60)return "supportive" as const;
  if(score<40)return "caution" as const;
  return "neutral" as const;
}
'''
compact_new = compact_anchor + '''
function trajectoryDigest(rows:any[],topic:string){
  const values=rows.map((row:any)=>({date:String(row?.date??""),score:Number(row?.scores?.[topic])})).filter((x:any)=>x.date&&Number.isFinite(x.score));
  if(!values.length)return null;
  const mean=values.reduce((sum:number,x:any)=>sum+x.score,0)/values.length;
  const variance=values.reduce((sum:number,x:any)=>sum+Math.pow(x.score-mean,2),0)/values.length;
  const rolling=(size:number)=>{
    if(values.length<size)return [] as any[];
    const out:any[]=[];
    for(let i=0;i<=values.length-size;i++){
      const chunk=values.slice(i,i+size); const avg=chunk.reduce((sum:number,x:any)=>sum+x.score,0)/size;
      out.push({start:chunk[0].date,end:chunk[chunk.length-1].date,average:Math.round(avg*10)/10});
    }
    return out;
  };
  const seven=rolling(Math.min(7,values.length));
  const peak7=seven.length?[...seven].sort((a,b)=>b.average-a.average)[0]:null;
  const low7=seven.length?[...seven].sort((a,b)=>a.average-b.average)[0]:null;
  const changes:any[]=[];
  for(let i=7;i<values.length;i++)changes.push({from:values[i-7].date,to:values[i].date,delta:Math.round((values[i].score-values[i-7].score)*10)/10});
  const rise=changes.length?[...changes].sort((a,b)=>b.delta-a.delta)[0]:null;
  const fall=changes.length?[...changes].sort((a,b)=>a.delta-b.delta)[0]:null;
  return {days:values.length,mean:Math.round(mean*10)/10,min:[...values].sort((a,b)=>a.score-b.score)[0],max:[...values].sort((a,b)=>b.score-a.score)[0],volatility:Math.round(Math.sqrt(variance)*10)/10,peak_7d:peak7,low_7d:low7,largest_7d_rise:rise,largest_7d_fall:fall};
}
'''
replace_once(path, compact_anchor, compact_new)

rank_anchor = '''  const dateRank=new Map<string,{hits:number;weight:number;refs:string[];topics:Set<string>}>();
  const addDate=(date:string,topic:string,score:number,id:string)=>{if(!date)return;const r=dateRank.get(date)??{hits:0,weight:0,refs:[],topics:new Set<string>()};r.hits+=1;r.weight+=Math.abs(score-50);r.refs.push(id);r.topics.add(topic);dateRank.set(date,r);};
  for(const [topic,s] of Object.entries(overall) as any[])for(const p of [...(s.best_days??[]),...(s.caution_days??[])])addDate(p.date,topic,num(p.score),`W:date:${p.date}:${topic}:${(s.best_days??[]).some((x:any)=>x.date===p.date&&num(x.score)===num(p.score))?"best":"caution"}`);
  for(const [topic,s] of Object.entries(rel) as any[])for(const p of [...(s.best_days??[]),...(s.caution_days??[])])addDate(p.date,topic,num(p.score),`W:date:${p.date}:${topic}:${(s.best_days??[]).some((x:any)=>x.date===p.date&&num(x.score)===num(p.score))?"best":"caution"}`);
  const keyDates=[...dateRank.entries()].sort((a,b)=>b[1].hits-a[1].hits||b[1].weight-a[1].weight||a[0].localeCompare(b[0])).slice(0,16).map(([date,r])=>({date,hits:r.hits,salience:Math.round((r.weight+r.hits*10)*10)/10,topics:[...r.topics],western_refs:uniq(r.refs).filter(x=>evidenceIds.has(x))}));

  const detailRaw='''
rank_new = '''  const dailyRaw=Array.isArray(w?.daily_scores)?w.daily_scores.slice(0,400):[];
  const dailyTopicOrder=[...TOPICS,...REL];
  const dailyScoreMatrix={topic_order:dailyTopicOrder,rows:dailyRaw.map((d:any)=>[String(d?.date??""),...dailyTopicOrder.map((topic)=>Number.isFinite(Number(d?.scores?.[topic]))?Number(d.scores[topic]):null)])};
  const dailyPatternDigest=Object.fromEntries(dailyTopicOrder.map((topic)=>[topic,trajectoryDigest(dailyRaw,topic)]).filter(([,value])=>Boolean(value)));
  const dailyByDate=new Map(dailyRaw.map((d:any)=>[String(d?.date??""),d]));

  const dateRank=new Map<string,{hits:number;weight:number;refs:string[];topics:Set<string>}>();
  const addDate=(date:string,topic:string,score:number,id:string)=>{if(!date)return;const r=dateRank.get(date)??{hits:0,weight:0,refs:[],topics:new Set<string>()};r.hits+=1;r.weight+=Math.abs(score-50);if(id)r.refs.push(id);r.topics.add(topic);dateRank.set(date,r);};
  for(const [topic,s] of Object.entries(overall) as any[])for(const p of [...(s.best_days??[]),...(s.caution_days??[])])addDate(p.date,topic,num(p.score),`W:date:${p.date}:${topic}:${(s.best_days??[]).some((x:any)=>x.date===p.date&&num(x.score)===num(p.score))?"best":"caution"}`);
  for(const [topic,s] of Object.entries(rel) as any[])for(const p of [...(s.best_days??[]),...(s.caution_days??[])])addDate(p.date,topic,num(p.score),`W:date:${p.date}:${topic}:${(s.best_days??[]).some((x:any)=>x.date===p.date&&num(x.score)===num(p.score))?"best":"caution"}`);
  for(const d of dailyRaw){
    const date=String(d?.date??"");
    for(const topic of dailyTopicOrder){
      const score=Number(d?.scores?.[topic]); if(!Number.isFinite(score))continue;
      const base=(overall as any)?.[topic]??(rel as any)?.[topic]; const avg=Number(base?.average);
      const deviation=Number.isFinite(avg)?Math.abs(score-avg):Math.abs(score-50);
      if(deviation>=12||score>=72||score<=28)addDate(date,topic,score,"");
    }
  }
  const keyDates=[...dateRank.entries()].sort((a,b)=>b[1].hits-a[1].hits||b[1].weight-a[1].weight||a[0].localeCompare(b[0])).slice(0,16).map(([date,r])=>({date,hits:r.hits,salience:Math.round((r.weight+r.hits*10)*10)/10,topics:[...r.topics],western_refs:uniq(r.refs).filter(x=>evidenceIds.has(x))}));
  for(const kd of keyDates){
    const daily:any=dailyByDate.get(kd.date); const rows=Array.isArray(daily?.evidence)?daily.evidence.slice(0,10):[];
    rows.forEach((ev:any,index:number)=>{const id=`W:daily:${kd.date}:${index+1}`;const source=Array.isArray(ev?.source_topics)?ev.source_topics.join(", "):"";addEvidence({id,system:"western",scope:"daily_actual_aspect_house",direction:"context",date:kd.date,text:`${ev?.sample_time?`${ev.sample_time} · `:""}${String(ev?.text??"")}${source?` · 관련분야 ${source}`:""}`});kd.western_refs.push(id);});
    kd.western_refs=uniq(kd.western_refs);
  }

  const detailRaw='''
replace_once(path, rank_anchor, rank_new)

replace_once(
    path,
    '''integration_policy:{score_merging:false,western_score_probability:false,saju_independent:true,thai_predictive_vote:false,important_date_rule:"key_dates는 Western 계산 피크/저점에서 선정하고 사주·Thai는 독립 맥락으로만 교차"},''',
    '''integration_policy:{score_merging:false,western_score_probability:false,saju_independent:true,thai_predictive_vote:false,important_date_rule:"365일 실제 일별 점수·근거에서 다분야 변동과 피크/저점을 선정하고 사주·Thai는 독립 맥락으로만 교차"},''',
)
replace_once(
    path,
    '''western:{engine:w?.engine,ephemeris:w?.ephemeris,score_policy:w?.score_policy,natal:w?.natal??null,overall,relationship_signals:rel,months,detail_days:detail,key_date_details:Array.isArray(w?.key_dates)?w.key_dates.slice(0,16):[],market:{''',
    '''western:{engine:w?.engine,ephemeris:w?.ephemeris,score_policy:w?.score_policy,natal:w?.natal??null,overall,relationship_signals:rel,months,detail_days:detail,daily_score_matrix:dailyScoreMatrix,daily_pattern_digest:dailyPatternDigest,daily_evidence_coverage:{days:dailyRaw.length,days_with_evidence:dailyRaw.filter((d:any)=>Array.isArray(d?.evidence)&&d.evidence.length>0).length},key_date_details:Array.isArray(w?.key_dates)?w.key_dates.slice(0,16):[],market:{''',
)
replace_once(
    path,
    '''- 연간 분석은 연평균만 보지 않는다. western.months의 12개월 궤적 → key_dates의 피크/저점 → cross_system_timeline의 사주·Thai 독립 맥락 순으로 읽는다. 하루짜리 피크를 1년 전체 흐름처럼 과장하지 않는다.''',
    '''- 연간 분석은 연평균만 보지 않는다. western.daily_score_matrix의 최대 365일 원점수 → daily_pattern_digest의 7일 구간·변동성·상승/하락 전환 → western.months의 12개월 궤적 → key_dates의 실제 애스펙트/하우스 근거 → cross_system_timeline의 사주·Thai 독립 맥락 순으로 읽는다. 하루짜리 피크를 1년 전체 흐름처럼 과장하지 않는다.''',
)

# ---------------------------------------------------------------------------
# 3) Quality guard: annual key windows must actually use daily evidence.
# ---------------------------------------------------------------------------
path = 'supabase/functions/fortune-interpret-v6-preview/qualityV2.ts'
replace_once(path, 'export const QUALITY_VERSION = "fortune-interpretation-quality-v1.1";', 'export const QUALITY_VERSION = "fortune-interpretation-quality-v1.2-daily-evidence";')
replace_once(
    path,
    '''  if(kind==="annual"&&(data?.overall?.evidence_refs?.length??0)<3)s5.push("연간 총평 근거 3개 미만");
''',
    '''  if(kind==="annual"&&(data?.overall?.evidence_refs?.length??0)<3)s5.push("연간 총평 근거 3개 미만");
  if(kind==="annual"&&Number(payload?.western?.daily_evidence_coverage?.days_with_evidence??0)>0){
    const dailyBacked=(data?.key_windows??[]).filter((w:any)=>(w?.evidence_refs??[]).some((ref:string)=>ref.startsWith("W:daily:"))).length;
    if(dailyBacked<Math.min(3,data?.key_windows?.length??0))s5.push(`실제 일별 애스펙트/하우스 근거가 연결된 핵심 시기 부족: ${dailyBacked}/3`);
  }
''',
)

# ---------------------------------------------------------------------------
# 4) Web types, cache contract, imports, and rendering.
# ---------------------------------------------------------------------------
path = 'web/src/appTypes.ts'
replace_once(
    path,
    '''export type IntegratedApiResponse = {
''',
    '''export type FortuneDailyEvidence = {
  kind: string
  sample_time?: string
  source_topics?: string[]
  contribution?: number
  text: string
  transit?: string
  target?: string
  aspect?: string
  orb?: number
  motion?: string
  direction?: string
  whole_house?: number
  placidus_house?: number | null
  polarity?: number
}
export type FortuneDailyScore = {
  date: string
  label: string
  market_open: boolean
  scores: Record<string, number | null>
  evidence?: FortuneDailyEvidence[]
}

export type IntegratedApiResponse = {
''',
)
replace_once(path, '''    detail_days?: Array<{ date: string; market_open: boolean; topics: Record<string, { best_window?: { start: string; end: string; score: number }; caution_window?: { start: string; end: string; score: number }; evidence?: string[] }> }>
    months: FortuneMonth[]
''', '''    detail_days?: Array<{ date: string; market_open: boolean; topics: Record<string, { best_window?: { start: string; end: string; score: number }; caution_window?: { start: string; end: string; score: number }; evidence?: string[] }> }>
    daily_scores?: FortuneDailyScore[]
    months: FortuneMonth[]
''')

path = 'web/src/AppNext.tsx'
replace_once(path, "import { AiInterpretationPanel } from './AiInterpretationPanel'\n", "import { AiInterpretationPanel } from './AiInterpretationPanel'\nimport { AnnualDailyScoresPanel } from './AnnualDailyScoresPanel'\n")
replace_once(path, '''
              {integratedResult.western.detail_days?.length ? <details className="result-card integrated-time-evidence">''', '''
              <AnnualDailyScoresPanel rows={integratedResult.western.daily_scores ?? []}/>

              {integratedResult.western.detail_days?.length ? <details className="result-card integrated-time-evidence">''')

path = 'web/src/main.tsx'
replace_once(path, "import './ai-interpret.css'\n", "import './ai-interpret.css'\nimport './annual-daily-scores.css'\n")

path = 'web/src/lib/readingCache.ts'
replace_once(path, "const FORTUNE_CALC_CACHE_CONTRACT = 'key-date-evidence-v2'", "const FORTUNE_CALC_CACHE_CONTRACT = 'full-daily-evidence-v3'")
replace_once(path, "const FORTUNE_AI_CACHE_CONTRACT = 'evidence-ledger-v2'", "const FORTUNE_AI_CACHE_CONTRACT = 'daily-trajectory-evidence-ledger-v3'")
replace_once(path, '''    western_key_dates: western.key_dates,
''', '''    western_key_dates: western.key_dates,
    western_daily_scores: western.daily_scores,
''')

print('patched full daily scores v3')
