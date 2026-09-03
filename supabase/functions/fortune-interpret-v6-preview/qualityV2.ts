import { TOPICS, txt } from "./integratedInterpretationV2.ts";

export const QUALITY_VERSION = "fortune-interpretation-quality-v1.1";

function isoDate(v: unknown){ const s=String(v??""); const m=s.match(/^\d{4}-\d{2}-\d{2}/); return m?m[0]:""; }
function uniq<T>(xs:T[]){ return [...new Set(xs)]; }
function qualityStage(stage:number,name:string,issues:string[]){return {stage,name,passed:issues.length===0,issues};}
function ledgerMap(payload:any){return new Map((Array.isArray(payload?.evidence_ledger)?payload.evidence_ledger:[]).map((x:any)=>[String(x?.id??""),x]));}
function allRefs(data:any){const out:string[]=[];const walk=(v:any)=>{if(Array.isArray(v))for(const x of v)walk(x);else if(v&&typeof v==="object"){if(Array.isArray(v.evidence_refs))out.push(...v.evidence_refs.map(String));for(const [k,x] of Object.entries(v))if(k!=="evidence_refs")walk(x);}};walk(data);return uniq(out);}
function withinPeriod(date:string,payload:any){const start=isoDate(payload?.period?.start),end=isoDate(payload?.period?.end);return Boolean(date&&start&&end&&start<=date&&date<=end);}
function datesInText(s:string){return [...s.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)].map(m=>m[1]);}
function rowCoversDate(row:any,date:string){
  if(!date)return false;
  if(isoDate(row?.date)===date)return true;
  const start=isoDate(row?.start),end=isoDate(row?.end);
  return Boolean(start&&end&&start<=date&&date<=end);
}
function claimStrings(data:any){
  const out:string[]=[];
  const add=(v:any)=>{if(typeof v==="string"&&v)out.push(v);};
  add(data?.headline);
  for(const k of ["summary","dominant_pattern","best_phase","caution_phase"])add(data?.overall?.[k]);
  for(const w of data?.key_windows??[]){add(w?.start);add(w?.end);add(w?.label);add(w?.summary);add(w?.action);add(w?.avoid);}
  for(const p of data?.year_phases??[]){add(p?.theme);add(p?.change);}
  for(const d of data?.decisions??[]){add(d?.action);add(d?.timing);add(d?.reason);}
  for(const v of Object.values(data?.clusters??{}))add(v);
  for(const v of Object.values(data?.contact_flow??{}))add(v);
  for(const v of Object.values(data?.investment_reading??{}))add(v);
  for(const v of Object.values(data?.systems??{}))add(v);
  for(const v of data?.priorities??[])add(v);
  for(const x of Object.values(data?.topic_analysis??{}) as any[])for(const k of ["verdict","reason","timing","action","avoid","confidence_reason"])add(x?.[k]);
  add(data?.limits);
  return out;
}
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
  if(!Array.isArray(data?.decisions))s1.push("decisions 누락");
  for(const k of TOPICS)if(!data?.topic_analysis?.[k])s1.push(`topic_analysis.${k} 누락`);
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
  for(const [topic,x] of Object.entries(data?.topic_analysis??{}) as any[]){
    if(x?.confidence==="높음"){
      const rows=(x?.evidence_refs??[]).map((r:string)=>map.get(r)).filter(Boolean) as any[];
      if(rows.length<2)s4.push(`${topic} 확신도 높음인데 근거 2개 미만`);
      if(!rows.some(r=>r.system==="western"))s4.push(`${topic} 확신도 높음인데 Western 근거 없음`);
    }
  }
  const windowRefs=new Set((data?.key_windows??[]).flatMap((x:any)=>x?.evidence_refs??[]));
  for(const d of data?.decisions??[])if(!(d?.evidence_refs??[]).some((r:string)=>windowRefs.has(r)))s4.push(`핵심 시기와 연결되지 않은 결정 조언: ${txt(d?.action,60)}`);
  stages.push(qualityStage(4,"내부 일관성",uniq(s4).slice(0,30)));

  const s5:string[]=[];
  const minWindows=kind==="annual"?5:kind==="month"?3:kind==="week"?2:1;
  if((data?.key_windows?.length??0)<minWindows)s5.push(`핵심 시기 부족: ${data?.key_windows?.length??0}/${minWindows}`);
  if((data?.decisions?.length??0)<3)s5.push("결정/행동 가이드 3개 미만");
  if((data?.priorities?.length??0)<3)s5.push("우선순위 3개 미만");
  if(kind==="annual"&&(data?.year_phases?.length??0)<4)s5.push("연간 4개 phase 미완성");
  if(kind==="annual"&&(data?.overall?.evidence_refs?.length??0)<3)s5.push("연간 총평 근거 3개 미만");
  const minSummary=kind==="annual"?240:kind==="month"?170:110;
  if(String(data?.overall?.summary??"").length<minSummary)s5.push(`총평 깊이 부족(${String(data?.overall?.summary??"").length}/${minSummary})`);
  for(const w of data?.key_windows??[]){
    if(String(w?.summary??"").length<45)s5.push(`핵심 시기 설명이 너무 짧음: ${w?.label}`);
    if(String(w?.action??"").length<18)s5.push(`핵심 시기 행동이 너무 짧음: ${w?.label}`);
    if((w?.evidence_refs?.length??0)<(kind==="annual"?2:1))s5.push(`핵심 시기 근거 수 부족: ${w?.label}`);
  }
  if(kind==="annual")for(const p of data?.year_phases??[])if(!(p?.evidence_refs?.length))s5.push(`연간 phase 근거 없음: ${p?.label}`);
  for(const [topic,x] of Object.entries(data?.topic_analysis??{}) as any[]){
    const minReason=kind==="annual"?70:45;
    if(String(x?.reason??"").length<minReason)s5.push(`${topic} 근거 설명이 얕음`);
    if((x?.evidence_refs?.length??0)<(kind==="annual"?2:1))s5.push(`${topic} 근거 ID 부족`);
  }
  const generic=/좋은\s*기운|긍정적으로|마음을\s*열|천천히\s*해보|자신을\s*믿|잘\s*해낼/g;
  if((prose.match(generic)??[]).length>=3)s5.push("일반론 조언 반복이 많음");
  stages.push(qualityStage(5,"깊이·실용성",uniq(s5).slice(0,45)));

  const passed=stages.filter(s=>s.passed).length;
  return {version:QUALITY_VERSION,ok:passed===5,score:passed*20,stages,refs_used:refsUsed.length,ledger_size:map.size};
}

export function strictQualityRetryInstruction(report:any){
  const failed=(report?.stages??[]).filter((s:any)=>!s?.passed).map((s:any)=>`[${s.stage}단계 ${s.name}] ${(s.issues??[]).slice(0,8).join(" / ")}`).join("\n");
  return `\n\nQUALITY_RETRY: 이전 응답이 5단계 품질검증을 통과하지 못했다. 아래 실패를 모두 고쳐라. 근거 ID는 evidence_ledger에 실제 존재하는 값만 쓰고, 날짜를 새로 만들지 마라. 확률이 아니라는 한계 설명 자체는 유지해도 된다.\n${failed}`;
}
