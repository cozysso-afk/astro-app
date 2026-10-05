import { TOPICS, txt } from "./integratedInterpretationV2.ts";

export const QUALITY_VERSION = "fortune-interpretation-quality-v6-semantic-usefulness";

function isoDate(v: unknown){ const s=String(v??""); const m=s.match(/^\d{4}-\d{2}-\d{2}/); return m?m[0]:""; }
function uniq<T>(xs:T[]){ return [...new Set(xs)]; }
function qualityStage(stage:number,name:string,issues:string[]){return {stage,name,passed:issues.length===0,issues};}
function ledgerMap(payload:any){return new Map((Array.isArray(payload?.evidence_ledger)?payload.evidence_ledger:[]).map((x:any)=>[String(x?.id??""),x]));}
function allRefs(data:any){const out:string[]=[];const walk=(v:any)=>{if(Array.isArray(v))for(const x of v)walk(x);else if(v&&typeof v==="object"){if(Array.isArray(v.evidence_refs))out.push(...v.evidence_refs.map(String));for(const [k,x] of Object.entries(v))if(k!=="evidence_refs")walk(x);}};walk(data);return uniq(out);}
function withinPeriod(date:string,payload:any){const start=isoDate(payload?.period?.start),end=isoDate(payload?.period?.end);return Boolean(date&&start&&end&&start<=date&&date<=end);}
function datesInText(s:string){return [...s.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)].map(m=>m[1]);}
function clockWindow(v:unknown){const matches=[...String(v??"").matchAll(/(?:[01]\d|2[0-3]):[0-5]\d/g)].map(m=>m[0]);return matches.length>=2?`${matches[0]}~${matches[1]}`:"";}
function rowCoversDate(row:any,date:string){
  if(!date)return false;
  if(isoDate(row?.date)===date)return true;
  const start=isoDate(row?.start),end=isoDate(row?.end);
  return Boolean(start&&end&&start<=date&&date<=end);
}
function applyUnsupportedV23TimingRepair(data:any,payload:any,map:Map<string,any>){
  if(payload?.__v23_evidence_timing_repair!==true||!data||typeof data!=="object")return false;
  let changed=false;
  if(Array.isArray(data?.key_windows)){
    const original=data.key_windows;
    const kept=original.filter((w:any)=>{
      const refs=(w?.evidence_refs??[]).map((r:any)=>map.get(String(r))).filter(Boolean) as any[];
      const dates=[isoDate(w?.start),isoDate(w?.end)].filter(Boolean);
      const valid=refs.length>0&&dates.length>0&&dates.every((d:string)=>withinPeriod(d,payload)&&refs.some((row:any)=>rowCoversDate(row,d)));
      if(!valid)changed=true;
      return valid;
    });
    if(kept.length!==original.length){
      data.key_windows=kept;
      const windowRefs=new Set<string>(kept.flatMap((w:any)=>(w?.evidence_refs??[]).map(String)));
      if(Array.isArray(data?.decisions))data.decisions=data.decisions.filter((d:any)=>(d?.evidence_refs??[]).some((ref:any)=>windowRefs.has(String(ref))));
    }
  }
  const rr=data?.relationship_reading;
  if(rr&&typeof rr==="object"){
    const dates=uniq(datesInText(String(rr?.focus_timing??"")));
    if(dates.length){
      const refs=(rr?.evidence_refs??[]).map((r:any)=>map.get(String(r))).filter(Boolean) as any[];
      const supported=dates.filter((d:string)=>refs.some((row:any)=>isoDate(row?.date)===d));
      if(supported.length!==dates.length){
        rr.focus_timing=supported.length
          ? `${supported.join("·")}의 관계 근거는 직접 연결돼 있어. 그 밖의 날짜는 확정하지 않고 실제 연락과 반응을 확인해.`
          : "관계 흐름은 특정 날짜를 확정하지 않고, 직접 연결된 근거가 있는 시기의 실제 연락과 반응을 중심으로 확인해.";
        changed=true;
      }
    }
  }
  return changed;
}

export function repairUnsupportedV23Timing(input:any,payload:any){
  const data=structuredClone(input??{});
  const changed=applyUnsupportedV23TimingRepair(data,payload,ledgerMap(payload) as Map<string,any>);
  return {data,changed};
}
function claimStrings(data:any){
  const out:string[]=[];
  const add=(v:any)=>{if(typeof v==="string"&&v)out.push(v);};
  add(data?.headline);
  for(const k of ["summary","dominant_pattern","best_phase","caution_phase"])add(data?.overall?.[k]);
  for(const w of data?.key_windows??[]){add(w?.start);add(w?.end);add(w?.label);add(w?.summary);add(w?.action);add(w?.avoid);}
  for(const p of data?.year_phases??[]){add(p?.theme);add(p?.change);}
  for(const x of data?.cross_checks??[]){add(x?.label);add(x?.western);add(x?.saju);add(x?.thai);add(x?.synthesis);}
  for(const d of data?.decisions??[]){add(d?.action);add(d?.timing);add(d?.reason);add(d?.watch);add(d?.avoid);}
  const walkEditorial=(v:any)=>{if(!v||typeof v!=="object")return;for(const section of Object.values(v) as any[])for(const key of ["conclusion","real_scene","action","change_condition"])add(section?.[key]);};
  for(const v of Object.values(data?.clusters??{}))walkEditorial(v);
  for(const v of Object.values(data?.relationship_reading??{}))add(v);
  for(const v of Object.values(data?.contact_flow??{}))add(v);
  for(const v of Object.values(data?.investment_reading??{}))add(v);
  for(const v of Object.values(data?.systems??{}))add(v);
  for(const v of data?.priorities??[])add(v);
  for(const x of Object.values(data?.topic_analysis??{}) as any[])for(const k of ["verdict","reason","timing","action","avoid","confidence_reason"])add(x?.[k]);
  add(data?.limits);
  return out;
}
const EDITORIAL_CLUSTER_KEYS:Record<string,string[]>={
  relationship:["summary","friends","coworkers","family","new_people","boundaries","love_general","love_single","love_crush","love_flirting","love_ambiguous","love_couple","love_reunion_interest","contact_activation","contact_continuity"],
  work_study:["work","career_change","exam","study"],money_news:["money","news"],investment:["psychology","realization","entry"],condition:["condition"],
};
function words(value:unknown){return new Set(String(value??"").toLowerCase().replace(/[^0-9a-z가-힣]+/gi," ").split(/\s+/).map(x=>x.replace(/(?:은|는|이|가|을|를|에서|으로|에게|하고|하면|해야|이다|야|해)$/,"")) .filter(x=>x.length>=2&&!new Set(["이번","현재","실제","흐름","분야","기간","확인","판단"]).has(x)));}
function semanticSimilarity(a:unknown,b:unknown){const left=words(a),right=words(b);if(!left.size||!right.size)return 0;const overlap=[...left].filter(x=>right.has(x)).length;return overlap/Math.min(left.size,right.size);}
function sectionText(section:any){return [section?.conclusion,section?.real_scene,section?.action,section?.change_condition].map(String).join(" ");}
function hasUnnegatedProbabilityClaim(prose:string){
  const re=/(?:사건|연락|재회|합격|성공|수익)\s*확률/g;
  for(const match of prose.matchAll(re)){
    const start=match.index??0;
    const tail=prose.slice(start,start+45);
    if(!/(?:아니|아님|아니다|뜻하지|의미하지|보장하지|바꾸지|말하지)/.test(tail))return true;
  }
  return false;
}
function hasDeterministicClaim(prose:string){
  const re=/(무조건|100%|반드시|확실히)\s*.{0,16}(연락|재회|합격|수익|오른다|내린다|상승한다|하락한다)/g;
  return re.test(prose);
}

export function inspectInterpretationQuality(data:any,payload:any){
  const map=ledgerMap(payload),kind=String(payload?.period_kind??"day"),stages:any[]=[];

  const s1:string[]=[];
  if(!data?.headline||!data?.overall?.summary)s1.push("headline/overall 누락");
  if(!Array.isArray(data?.key_windows))s1.push("key_windows 누락");
  if(!Array.isArray(data?.cross_checks))s1.push("cross_checks 누락");
  if(!Array.isArray(data?.decisions))s1.push("decisions 누락");
  for(const k of TOPICS){
    if(!data?.topic_analysis?.[k])s1.push(`topic_analysis.${k} 누락`);
    else if(!["핵심","주목","참고"].includes(String(data.topic_analysis[k]?.importance??"")))s1.push(`topic_analysis.${k}.importance 오류`);
  }
  if(payload?.__v23_evidence_timing_repair===true)for(const [group,keys] of Object.entries(EDITORIAL_CLUSTER_KEYS)){
    const value=data?.clusters?.[group];
    if(!value||typeof value!=="object"||Array.isArray(value)){s1.push(`clusters.${group} structured schema 누락`);continue;}
    for(const key of keys){const section=value?.[key];if(!section||typeof section!=="object")s1.push(`clusters.${group}.${key} 누락`);else if(!["direct","conditional","insufficient"].includes(String(section?.applicability??"")))s1.push(`clusters.${group}.${key}.applicability 오류`);}
  }
  stages.push(qualityStage(1,"구조 완전성",s1));

  const s2:string[]=[];
  const refsUsed=allRefs(data);
  for(const ref of refsUsed)if(!map.has(ref))s2.push(`존재하지 않는 근거 ID: ${ref}`);
  const knownExactDates=new Set<string>();
  for(const row of map.values() as any){const d=isoDate(row?.date);if(d)knownExactDates.add(d);for(const v of [row?.start,row?.end]){const x=isoDate(v);if(x)knownExactDates.add(x);}}
  const pStart=isoDate(payload?.period?.start),pEnd=isoDate(payload?.period?.end);if(pStart)knownExactDates.add(pStart);if(pEnd)knownExactDates.add(pEnd);
  for(const w of data?.key_windows??[]){
    const refs=(w?.evidence_refs??[]).map((r:string)=>map.get(r)).filter(Boolean) as any[];
    for(const d of [isoDate(w?.start),isoDate(w?.end)].filter(Boolean)){
      if(!withinPeriod(d,payload))s2.push(`기간 밖 key_window 날짜: ${d}`);
      if(refs.length&&!refs.some(row=>rowCoversDate(row,d)))s2.push(`key_window 날짜를 뒷받침하지 않는 근거: ${w?.label||d} ${d}`);
    }
    if(!refs.length)s2.push(`근거 없는 key_window: ${w?.label||w?.start||""}`);
  }
  for(const d of uniq(claimStrings(data).flatMap(datesInText)))if(!knownExactDates.has(d))s2.push(`계산근거에서 찾을 수 없는 날짜 언급: ${d}`);
  const relationshipTimingRefs=(data?.relationship_reading?.evidence_refs??[]).map((r:string)=>map.get(r)).filter(Boolean) as any[];
  for(const d of uniq(datesInText(String(data?.relationship_reading?.focus_timing??"")))){
    if(!relationshipTimingRefs.some(row=>isoDate(row?.date)===d))s2.push(`관계·재회 주목 날짜에 직접 날짜 근거 미연결: ${d}`);
  }
  stages.push(qualityStage(2,"근거 추적성",uniq(s2).slice(0,35)));

  const s3:string[]=[];
  const prose=claimStrings(data).join("\n");
  if(/\b\d+(?:\.\d+)?\s*%/.test(prose))s3.push("확률처럼 보이는 % 수치");
  if(hasUnnegatedProbabilityClaim(prose))s3.push("사건 확률 단정 표현");
  if(hasDeterministicClaim(prose))s3.push("결정론적 미래 단정");
  for(const w of data?.key_windows??[]){
    const rows=(w?.evidence_refs??[]).map((r:string)=>map.get(r)).filter(Boolean) as any[];
    const pos=rows.some(r=>r.direction==="supportive"),neg=rows.some(r=>r.direction==="caution");
    if(w.signal==="활용"&&neg&&!pos)s3.push(`주의 근거만 있는데 활용으로 표시: ${w.label}`);
    if(w.signal==="주의"&&pos&&!neg)s3.push(`활용 근거만 있는데 주의로 표시: ${w.label}`);
    if(pos&&neg&&w.signal!=="혼합")s3.push(`상반 근거가 함께 있는데 혼합 아님: ${w.label}`);
  }
  stages.push(qualityStage(3,"의미 방향 검증",uniq(s3).slice(0,30)));

  const s4:string[]=[];
  const seen=new Map<string,string>();
  for(const w of data?.key_windows??[]){const key=`${w?.start}|${w?.end}`;const prev=seen.get(key);if(prev&&prev!==w?.signal&&prev!=="혼합"&&w?.signal!=="혼합")s4.push(`같은 기간에 상충 신호: ${key}`);seen.set(key,w?.signal);}
  const coreTopics=Object.entries(data?.topic_analysis??{}).filter(([,x]:any)=>x?.importance==="핵심");
  if(coreTopics.length>5)s4.push(`핵심 분야가 너무 많음: ${coreTopics.length}/5`);
  for(const [topic,x] of Object.entries(data?.topic_analysis??{}) as any[]){
    const rows=(x?.evidence_refs??[]).map((r:string)=>map.get(r)).filter(Boolean) as any[];
    if(x?.confidence==="높음"){
      if(rows.length<2)s4.push(`${topic} 확신도 높음인데 근거 2개 미만`);
      if(!rows.some(r=>r.system==="western"))s4.push(`${topic} 확신도 높음인데 Western 근거 없음`);
    }
    if(x?.importance==="핵심"){
      if(rows.length<2)s4.push(`${topic} 핵심인데 근거 2개 미만`);
      if(!rows.some(r=>r.system==="western"))s4.push(`${topic} 핵심인데 Western 근거 없음`);
    }
  }
  const relationshipSalient=["연애","연락","재회"].some(topic=>["핵심","주목"].includes(String(data?.topic_analysis?.[topic]?.importance??"")));
  const investmentSalient=["투자심리","수익실현","신규진입","투자주의"].some(topic=>["핵심","주목"].includes(String(data?.topic_analysis?.[topic]?.importance??"")));
  if(relationshipSalient){
    const rr=data?.relationship_reading??{};
    const rows=(rr?.evidence_refs??[]).map((r:string)=>map.get(r)).filter(Boolean) as any[];
    const directional=new Set(["수신신호","발신적합","과거인연접점","연애","연락","재회"]);
    if(rows.length<2)s4.push("관계·재회 핵심 흐름 근거 2개 미만");
    if(!rows.some(r=>directional.has(String(r?.topic??""))))s4.push("관계·재회 핵심 흐름에 관계 방향축 근거 없음");
  }
  for(const x of data?.cross_checks??[]){
    const rows=(x?.evidence_refs??[]).map((r:string)=>map.get(r)).filter(Boolean) as any[];
    const systems=new Set(rows.map((r:any)=>String(r?.system??"")).filter(Boolean));
    if(!rows.length)s4.push(`근거 없는 교차검증: ${x?.label||""}`);
    if(x?.mode==="Western단독"&&!systems.has("western"))s4.push(`Western단독인데 Western 근거 없음: ${x?.label||""}`);
    if(x?.mode!=="Western단독"&&(!systems.has("western")||systems.size<2))s4.push(`복수체계/상반맥락인데 독립 체계 2개 미만: ${x?.label||""}`);
  }
  const windowRefs=new Set((data?.key_windows??[]).flatMap((x:any)=>x?.evidence_refs??[]));
  for(const d of data?.decisions??[])if(!(d?.evidence_refs??[]).some((r:string)=>windowRefs.has(r)))s4.push(`핵심 시기와 연결되지 않은 결정 조언: ${txt(d?.action,60)}`);
  stages.push(qualityStage(4,"내부 일관성",uniq(s4).slice(0,30)));

  const s5:string[]=[];
  const minWindows=kind==="annual"?5:kind==="month"?3:kind==="week"?2:1;
  const minDecisions=kind==="annual"?3:kind==="month"?2:kind==="week"?2:1;
  const minPriorities=kind==="annual"?3:kind==="month"?2:kind==="week"?2:1;
  if((data?.key_windows?.length??0)<minWindows)s5.push(`핵심 시기 부족: ${data?.key_windows?.length??0}/${minWindows}`);
  if((data?.decisions?.length??0)<minDecisions)s5.push(`결정/행동 가이드 부족: ${data?.decisions?.length??0}/${minDecisions}`);
  if((data?.priorities?.length??0)<minPriorities)s5.push(`우선순위 부족: ${data?.priorities?.length??0}/${minPriorities}`);
  if(kind==="annual"&&(data?.year_phases?.length??0)<4)s5.push("연간 4개 phase 미완성");
  if(kind==="annual"&&(data?.cross_checks?.length??0)<3)s5.push("연간 교차검증 3개 미만");
  if(kind==="annual"&&Array.from(map.values() as any).some((r:any)=>r?.system&&r.system!=="western")){
    const multi=(data?.cross_checks??[]).filter((x:any)=>{const systems=new Set((x?.evidence_refs??[]).map((r:string)=>map.get(r)?.system).filter(Boolean));return systems.has("western")&&systems.size>=2;}).length;
    if(multi<2)s5.push(`복수체계 교차검증 부족: ${multi}/2`);
  }
  if(kind==="annual"&&(data?.overall?.evidence_refs?.length??0)<3)s5.push("연간 총평 근거 3개 미만");
  if(kind==="annual"&&Number(payload?.western?.daily_evidence_coverage?.days_with_evidence??0)>0){
    const dailyBacked=(data?.key_windows??[]).filter((w:any)=>(w?.evidence_refs??[]).some((ref:string)=>ref.startsWith("W:daily:"))).length;
    if(dailyBacked<Math.min(3,data?.key_windows?.length??0))s5.push(`실제 일별 애스펙트/하우스 근거가 연결된 핵심 시기 부족: ${dailyBacked}/3`);
  }
  if(kind==="week"||kind==="month"){
    const dailyRefsAvailable=Array.from(map.keys()).filter((ref:any)=>String(ref).startsWith("W:daily:"));
    if(dailyRefsAvailable.length){
      const required=kind==="month"?Math.min(2,data?.key_windows?.length??0):Math.min(1,data?.key_windows?.length??0);
      const dailyBacked=(data?.key_windows??[]).filter((w:any)=>(w?.evidence_refs??[]).some((ref:string)=>ref.startsWith("W:daily:"))).length;
      if(dailyBacked<required)s5.push(`${kind==="month"?"월간":"주간"} 실제 일별 계산근거가 연결된 핵심 시기 부족: ${dailyBacked}/${required}`);
    }
  }
  if(kind==="day"){
    const detailDays=Array.isArray(payload?.western?.detail_days)?payload.western.detail_days:[];
    const hasIntradayWindow=detailDays.some((day:any)=>Object.values(day?.topics??{}).some((topic:any)=>Boolean(topic?.best_window||topic?.caution_window)));
    if(hasIntradayWindow){
      const timedDecisions=(data?.decisions??[]).filter((d:any)=>Boolean(clockWindow(d?.timing)));
      if(!timedDecisions.length)s5.push("오늘 시간대 행동 가이드 누락");
      const windowEvidence=[...map.entries()].filter(([ref,row]:any)=>String(ref).startsWith("W:window:")||row?.scope==="intraday_window");
      if(!windowEvidence.length)s5.push("오늘 시간창 전용 W:window:* 계산근거 누락");
      if(windowEvidence.length&&timedDecisions.length){
        const periodDate=isoDate(payload?.period?.start);
        for(const d of timedDecisions){
          const timingWindow=clockWindow(d?.timing);
          const refs=(d?.evidence_refs??[]).map(String);
          let exactLinked=false;
          for(const ref of refs){
            const row:any=map.get(ref);
            if(!row||(row?.scope!=="intraday_window"&&!String(ref).startsWith("W:window:")))continue;
            if(isoDate(row?.date)!==periodDate||clockWindow(row?.window??row?.text)!==timingWindow)continue;
            const sameTopicDetailAvailable=[...map.values()].some((x:any)=>x?.scope==="intraday_evidence"&&isoDate(x?.date)===isoDate(row?.date)&&String(x?.topic??"")===String(row?.topic??""));
            const sameTopicDetailLinked=refs.some((detailRef:string)=>{const x:any=map.get(detailRef);return x?.scope==="intraday_evidence"&&isoDate(x?.date)===isoDate(row?.date)&&String(x?.topic??"")===String(row?.topic??"");});
            if(!sameTopicDetailAvailable||sameTopicDetailLinked){exactLinked=true;break;}
          }
          if(!exactLinked)s5.push(`오늘 시간대 행동 가이드 근거 불일치: ${txt(d?.timing,45)} · 동일 시간창 W:window:* 및 같은 분야 W:detail:* 필요`);
        }
      }
    }
  }
  const maxSummary=kind==="annual"?1100:kind==="month"?800:650;
  const summaryLength=String(data?.overall?.summary??"").trim().length;
  if(!summaryLength)s5.push("총평 누락");
  if(summaryLength>maxSummary)s5.push(`총평이 핵심보다 지나치게 김(${summaryLength}/${maxSummary})`);
  for(const x of data?.cross_checks??[]){
    if(!String(x?.synthesis??"").trim())s5.push(`교차검증 종합 누락: ${x?.label}`);
    if(!String(x?.western??"").trim())s5.push(`교차검증 Western 설명 누락: ${x?.label}`);
  }
  for(const d of data?.decisions??[]){
    if(!String(d?.watch??"").trim())s5.push(`결정 가이드 확인조건 누락: ${txt(d?.action,45)}`);
    if(!String(d?.avoid??"").trim())s5.push(`결정 가이드 회피조건 누락: ${txt(d?.action,45)}`);
    if(String(d?.reason??"").length>700)s5.push(`결정 가이드 근거가 지나치게 김: ${txt(d?.action,45)}`);
    if(String(d?.watch??"").length>400)s5.push(`결정 가이드 확인조건이 지나치게 김: ${txt(d?.action,45)}`);
    if(String(d?.avoid??"").length>400)s5.push(`결정 가이드 회피조건이 지나치게 김: ${txt(d?.action,45)}`);
  }
  for(const w of data?.key_windows??[]){
    if(!String(w?.summary??"").trim())s5.push(`핵심 시기 설명 누락: ${w?.label}`);
    if(String(w?.summary??"").length>750)s5.push(`핵심 시기 설명이 지나치게 김: ${w?.label}`);
    if(!String(w?.action??"").trim())s5.push(`핵심 시기 행동 누락: ${w?.label}`);
    if((w?.evidence_refs?.length??0)<(kind==="annual"?2:1))s5.push(`핵심 시기 근거 수 부족: ${w?.label}`);
  }
  if(kind==="annual")for(const p of data?.year_phases??[])if(!(p?.evidence_refs?.length))s5.push(`연간 phase 근거 없음: ${p?.label}`);
  if(relationshipSalient){
    const rr=data?.relationship_reading??{},cf=data?.contact_flow??{};
    if(!String(rr?.context??"").trim())s5.push("관계·재회 관계 맥락 누락");
    if(!String(rr?.flow??"").trim())s5.push("관계·재회 이어지는 흐름 누락");
    if(!String(rr?.focus_timing??"").trim())s5.push("관계·재회 주목 시기 누락");
    if(!String(rr?.watch??"").trim())s5.push("관계·재회 현실 확인 신호 누락");
    if(!String(rr?.avoid??"").trim())s5.push("관계·재회 과대해석 방지 설명 누락");
    if(String(rr?.context??"").length>600||String(rr?.flow??"").length>850||String(rr?.focus_timing??"").length>550||String(rr?.watch??"").length>550||String(rr?.avoid??"").length>500)s5.push("관계·재회 핵심 흐름이 지나치게 장황함");
    if(!String(cf?.incoming??"").trim())s5.push("관계·재회 상대→나 방향 설명 누락");
    if(!String(cf?.outgoing??"").trim())s5.push("관계·재회 나→상대 방향 설명 누락");
    if(!String(cf?.reconnection??"").trim())s5.push("관계·재회 과거인연 방향 설명 누락");
  }
  if(investmentSalient){
    const ir=data?.investment_reading??{};
    const investmentFields:Record<string,string>={"투자심리":"psychology","수익실현":"realization","신규진입":"entry","투자주의":"risk"};
    for(const [topic,field] of Object.entries(investmentFields)){
      if(["핵심","주목"].includes(String(data?.topic_analysis?.[topic]?.importance??""))&&!String(ir?.[field]??"").trim())s5.push(`${topic} 중요 분야인데 투자 상세 설명 누락`);
    }
  }
  const sectionMax=kind==="annual"?1500:kind==="month"?1200:950;
  for(const [name,value] of Object.entries(data?.clusters??{}))for(const [key,section] of Object.entries(value??{}) as any[]){const length=sectionText(section).length;if(length>sectionMax)s5.push(`분야별 원고 ${name}.${key}가 지나치게 김(${length}/${sectionMax})`);}
  const dominantMax=kind==="annual"?900:650;
  if(String(data?.overall?.dominant_pattern??"").length>dominantMax)s5.push(`핵심 패턴이 지나치게 김(${String(data?.overall?.dominant_pattern??"").length}/${dominantMax})`);
  for(const [topic,x] of Object.entries(data?.topic_analysis??{}) as any[]){
    const importance=["핵심","주목","참고"].includes(String(x?.importance??""))?String(x.importance):"참고";
    const maxReason=importance==="핵심"?1200:importance==="주목"?700:320;
    const reasonLength=String(x?.reason??"").trim().length;
    if(importance!=="참고"&&!reasonLength)s5.push(`${topic} ${importance} 근거 설명 누락`);
    if(reasonLength>maxReason)s5.push(`${topic} ${importance} 분야 과설명(${reasonLength}/${maxReason})`);
    const minRefs=importance==="핵심"?2:1;
    if((x?.evidence_refs?.length??0)<minRefs)s5.push(`${topic} ${importance} 근거 ID 부족`);
    if(importance==="참고"){
      const detailLength=String(x?.timing??"").length+String(x?.action??"").length+String(x?.avoid??"").length+String(x?.confidence_reason??"").length;
      if(detailLength>650)s5.push(`${topic} 참고 분야 부가설명이 지나치게 김(${detailLength}/650)`);
    }
  }
  const synthesisSeen=new Set<string>();
  for(const x of data?.cross_checks??[]){
    const normalized=String(x?.synthesis??"").replace(/\s+/g," ").trim();
    if(normalized.length<45)continue;
    if(synthesisSeen.has(normalized))s5.push("서로 다른 교차해설에 동일한 종합 문장 반복");
    synthesisSeen.add(normalized);
  }
  const generic=/좋은\s*기운|긍정적으로|마음을\s*열|천천히\s*해보|자신을\s*믿|잘\s*해낼/g;
  if((prose.match(generic)??[]).length>=3)s5.push("일반론 조언 반복이 많음");
  stages.push(qualityStage(5,"깊이·실용성",uniq(s5).slice(0,45)));

  const s6:string[]=[];
  const summary=String(data?.overall?.summary??"");
  for(const [topic,row] of Object.entries(data?.topic_analysis??{}) as any[]){
    const candidate=[row?.verdict,row?.reason,row?.action].join(" ");
    if(candidate.length>=45&&semanticSimilarity(summary,candidate)>=.78){s6.push(`overall이 단일 분야 ${topic}의 재진술에 가까움`);break;}
  }
  const allSections:Array<{id:string;section:any}>=[];
  for(const [group,keys] of Object.entries(EDITORIAL_CLUSTER_KEYS))for(const key of keys){const section=data?.clusters?.[group]?.[key];if(section)allSections.push({id:`${group}.${key}`,section});}
  for(const {id,section} of allSections){
    const mode=String(section?.applicability??"");
    if(String(section?.conclusion??"").length<10)s6.push(`${id} 현재 결론 누락`);
    if(mode!=="insufficient"&&String(section?.real_scene??"").length<12)s6.push(`${id} 현실 장면/판단기준 누락`);
    if(String(section?.action??"").length<8)s6.push(`${id} 사용자 행동 누락`);
    if(String(section?.change_condition??"").length<12)s6.push(`${id} 판단변경조건 누락`);
    if(mode==="direct"&&!(section?.evidence_refs?.length))s6.push(`${id} direct인데 근거 ID 없음`);
    const combined=sectionText(section);
    if(/^(?:확인해|지켜봐|신중해|서두르지 마|천천히 봐)[.!\s]*$/.test(combined))s6.push(`${id} 안전하지만 무용한 원고`);
  }
  const genericStem=/(?:확인해|지켜봐|신중해|서두르지 마|천천히 봐)/g;
  const genericSections=allSections.filter(({section})=>(sectionText(section).match(genericStem)??[]).length>=2);
  if(genericSections.length>=3)s6.push(`여러 분야에서 확인·신중·관찰 조언 반복(${genericSections.length})`);
  const interchangeable=(ids:string[],label:string)=>{
    for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
      const a=data?.clusters?.relationship?.[ids[i]],b=data?.clusters?.relationship?.[ids[j]];
      if(a&&b&&semanticSimilarity(sectionText(a),sectionText(b))>=.82){s6.push(`${label} 원고가 서로 바꿔 붙일 수 있음: ${ids[i]}/${ids[j]}`);return;}
    }
  };
  interchangeable(["friends","coworkers","family","new_people","boundaries"],"대인 5상황");
  interchangeable(["love_single","love_crush","love_flirting","love_ambiguous","love_couple","love_reunion_interest"],"애정 6상태");
  stages.push(qualityStage(6,"상담 유용성·의미 비중복",uniq(s6).slice(0,45)));

  const passed=stages.filter(s=>s.passed).length;
  return {version:QUALITY_VERSION,ok:passed===6,score:Math.round(passed/6*100),stages,refs_used:refsUsed.length,ledger_size:map.size};
}

export function strictQualityRetryInstruction(report:any){
  const failed=(report?.stages??[]).filter((s:any)=>!s?.passed).map((s:any)=>`[${s.stage}단계 ${s.name}] ${(s.issues??[]).slice(0,10).join(" / ")}`).join("\n");
  return `\n\nSEMANTIC_REWRITE: 이전 응답이 Quality V6 품질검증을 통과하지 못했다. API 오류 재시도가 아니라 안전하지만 무용한 원고를 사용자 질문에 답하도록 다시 쓰는 semantic rewrite다. 아래 실패만 정확히 고치고 이미 통과한 근거/방향은 망가뜨리지 마라.
- 근거 ID는 evidence_ledger에 실제 존재하는 값만 쓰고 날짜를 새로 만들지 마라. key_window의 start/end는 연결한 근거가 그 날짜를 직접 포함하거나 덮어야 한다. 한 날짜 근거로 임의 범위를 만들지 마라.
- supportive와 caution 근거가 함께 연결된 key_window는 signal='혼합'으로 고쳐라.
- 모든 decision은 적어도 하나의 evidence_ref를 출력한 key_window와 공유하고 timing도 그 핵심 시기와 직접 연결해라.
- topic reason에 직접 연결된 추세·시기·근거가 빠졌을 때만 보완해라. 이미 구체적인 문장을 길이만 맞추려고 늘리지 마라.
- 관계·재회 focus_timing은 실제 관계 evidence_refs가 직접 지지하는 날짜/구간만 남기고, 필요한 현실 확인 기준만 보완해라. 길이만 늘리지 마라.
- 교차검증 synthesis가 비어 있거나 의미가 빠졌다면 Western과 다른 체계의 공통점/차이만 구체적으로 보완해라. 길이만 늘리지 마라.
  - 오늘 시간대 행동 누락이면 W:window의 정확한 HH:MM~HH:MM과 같은 분야 W:detail 근거를 decision에 함께 연결해라.
  - structured editorial section마다 conclusion, real_scene, action, change_condition, evidence_refs, applicability를 모두 채워라. 결론→현실 장면→지금 할 일→판단이 달라질 조건이 한 번에 읽혀야 한다.
  - overall은 narrative_plan의 supporting_topics와 caution_topics를 실제로 연결하고 단일 topic 문장을 재작성하지 마라.
  - 대인 5상황과 애정 6상태는 서로 바꿔 붙일 수 없는 고유한 현실 질문과 판단 기준을 가져야 한다.
  - 확률이 아니라는 한계 설명 자체는 유지해도 된다.\n${failed}`;
}
