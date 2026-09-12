import * as base from "./qualityV2Base.ts";

export const QUALITY_VERSION = `${base.QUALITY_VERSION}-semantic-hardening-v1`;
export const strictQualityRetryInstruction = base.strictQualityRetryInstruction;

type LedgerRow = Record<string, any>;

function iso(v: unknown){
  const m=String(v??"").match(/\b\d{4}-\d{2}-\d{2}\b/);
  return m?.[0]??"";
}
function refs(v: unknown){return Array.isArray(v)?v.map(String).filter(Boolean):[];}
function uniq<T>(xs:T[]){return [...new Set(xs)];}
function ledgerMap(payload:any){return new Map<string,LedgerRow>((Array.isArray(payload?.evidence_ledger)?payload.evidence_ledger:[]).map((x:any)=>[String(x?.id??""),x]));}
function rowStart(row:any){return iso(row?.start)||iso(row?.date);}
function rowEnd(row:any){return iso(row?.end)||iso(row?.date);}
function overlaps(row:any,start:string,end:string){
  const a=rowStart(row),b=rowEnd(row);
  return Boolean(a&&b&&start&&end&&a<=end&&b>=start);
}
function topicSupported(row:any,topic:string){
  if(!row)return false;
  const explicit=String(row.topic??"").trim();
  if(!explicit)return true;
  if(explicit===topic)return true;
  const text=String(row.text??"");
  const related=text.match(/관련분야\s+(.+)$/)?.[1]??"";
  return related.split(/[,·/]/).map(x=>x.trim()).includes(topic);
}
function textFields(data:any){
  const out:string[]=[];
  const add=(v:any)=>{if(typeof v==="string"&&v.trim())out.push(v);};
  add(data?.headline);
  for(const key of ["summary","dominant_pattern","best_phase","caution_phase"])add(data?.overall?.[key]);
  for(const w of data?.key_windows??[]){for(const key of ["label","start","end","summary","action","avoid"])add(w?.[key]);}
  for(const p of data?.year_phases??[]){for(const key of ["label","start","end","theme","change"])add(p?.[key]);}
  for(const x of data?.cross_checks??[]){for(const key of ["label","start","end","western","saju","thai","synthesis"])add(x?.[key]);}
  for(const d of data?.decisions??[]){for(const key of ["action","timing","reason","watch","avoid"])add(d?.[key]);}
  for(const x of Object.values(data?.topic_analysis??{}) as any[])for(const key of ["verdict","reason","timing","action","avoid","confidence_reason"])add(x?.[key]);
  for(const key of ["context","flow","focus_timing","watch","avoid"])add(data?.relationship_reading?.[key]);
  for(const key of ["incoming","outgoing","reconnection"])add(data?.contact_flow?.[key]);
  for(const key of ["psychology","realization","entry","risk"])add(data?.investment_reading?.[key]);
  for(const key of ["western","saju","thai"])add(data?.systems?.[key]);
  for(const x of data?.priorities??[])add(x);
  add(data?.limits);
  return out;
}
function hasNegated(text:string,at:number){
  const tail=text.slice(at,at+90);
  return /(아니|아님|아니다|않아|않는다|않는다는|뜻하지|보장하지|확정하지|단정하지|의미하지|말하지|예측하지)/.test(tail);
}
function hasUnsupportedOutcomeClaim(text:string){
  const patterns=[
    /(?:연락|답장|재회|합격|성공|취업|수익|돈이\s*(?:들어|생기)|관계가\s*(?:성립|회복)|상대가\s*(?:돌아|받아|연락)).{0,22}(?:온다|온다고|된다|된다고|성공한다|합격한다|높다|높아|가능성이|확률이|확정|보장)/g,
    /(?:연락|재회|합격|성공|취업|수익).{0,12}(?:가능성이\s*(?:높|크)|가능성이\s*있)/g,
  ];
  return patterns.some(re=>{for(const m of text.matchAll(re)){if(!hasNegated(text,m.index??0))return true;}return false;});
}
function hasMindReadingClaim(text:string){
  const re=/(?:상대가|상대는|그\s*사람이).{0,28}(?:그리워|보고\s*싶|마음이\s*있|생각하고|후회하고|미련이|사랑하고|원하고|연락하고\s*싶)/g;
  for(const m of text.matchAll(re))if(!hasNegated(text,m.index??0))return true;
  return false;
}
function hardeningIssues(data:any,payload:any){
  const map=ledgerMap(payload),issues:string[]=[];
  const periodStart=iso(payload?.period?.start),periodEnd=iso(payload?.period?.end);

  for(const topic of Object.keys(data?.topic_analysis??{})){
    const row=data.topic_analysis[topic];
    for(const ref of refs(row?.evidence_refs)){
      const ev=map.get(ref);
      if(ev&&!topicSupported(ev,topic))issues.push(`${topic} 근거가 다른 분야를 가리킴: ${ref}`);
    }
  }

  for(const w of data?.key_windows??[]){
    const start=iso(w?.start),end=iso(w?.end)||start;
    const linked=refs(w?.evidence_refs).map(r=>map.get(r)).filter(Boolean);
    if(start&&periodStart&&start<periodStart)issues.push(`기간 밖 key_window 시작: ${start}`);
    if(end&&periodEnd&&end>periodEnd)issues.push(`기간 밖 key_window 종료: ${end}`);
    for(const topic of Array.isArray(w?.topics)?w.topics.map(String):[]){
      if(topic&&!linked.some(row=>topicSupported(row,topic)))issues.push(`key_window 분야 근거 불일치: ${w?.label||start} · ${topic}`);
    }
    if(start&&end&&!linked.some(row=>overlaps(row,start,end)))issues.push(`key_window 기간을 덮는 직접 근거 없음: ${w?.label||start}`);
  }

  for(const p of data?.year_phases??[]){
    const start=iso(p?.start),end=iso(p?.end)||start;
    const linked=refs(p?.evidence_refs).map(r=>map.get(r)).filter(Boolean);
    if(start&&periodStart&&start<periodStart)issues.push(`기간 밖 year_phase 시작: ${start}`);
    if(end&&periodEnd&&end>periodEnd)issues.push(`기간 밖 year_phase 종료: ${end}`);
    if(start&&end&&!linked.some(row=>overlaps(row,start,end)))issues.push(`year_phase 안에 실제 근거가 없음: ${p?.label||start}`);
  }

  for(const x of data?.cross_checks??[]){
    const start=iso(x?.start),end=iso(x?.end)||start;
    const linked=refs(x?.evidence_refs).map(r=>map.get(r)).filter(Boolean);
    if(start&&end&&!linked.some(row=>overlaps(row,start,end)))issues.push(`교차검증 기간과 근거 기간 불일치: ${x?.label||start}`);
  }

  const windowRefSet=new Set((data?.key_windows??[]).flatMap((w:any)=>refs(w?.evidence_refs)));
  for(const d of data?.decisions??[]){
    const timingDates=[...String(d?.timing??"").matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)].map(m=>m[0]);
    const linked=refs(d?.evidence_refs).map(r=>map.get(r)).filter(Boolean);
    for(const date of uniq(timingDates)){
      if(periodStart&&date<periodStart||periodEnd&&date>periodEnd)issues.push(`기간 밖 decision 날짜: ${date}`);
      if(linked.length&&!linked.some(row=>overlaps(row,date,date)))issues.push(`decision 시기 근거 불일치: ${date}`);
    }
    if(linked.length&&!refs(d?.evidence_refs).some(r=>windowRefSet.has(r)))issues.push(`decision이 key_window와 직접 연결되지 않음: ${String(d?.action??"").slice(0,50)}`);
  }

  const prose=textFields(data).join("\n");
  if(hasUnsupportedOutcomeClaim(prose))issues.push("사건 결과를 가능성·확정처럼 표현한 문장");
  if(hasMindReadingClaim(prose))issues.push("상대의 속마음을 사실처럼 단정한 문장");

  return uniq(issues).slice(0,40);
}

export function inspectInterpretationQuality(data:any,payload:any){
  const report=base.inspectInterpretationQuality(data,payload);
  const extra=hardeningIssues(data,payload);
  const stages=Array.isArray(report?.stages)?report.stages.map((stage:any)=>({...stage})):[];
  const stage4=stages.find((stage:any)=>Number(stage?.stage)===4);
  if(stage4){
    stage4.issues=uniq([...(stage4.issues??[]),...extra]);
    stage4.passed=stage4.issues.length===0;
  }
  const failed=stages.filter((stage:any)=>!stage.passed);
  const score=Math.max(0,100-(stages.filter((stage:any)=>!stage.passed).length*20));
  return {...report,version:QUALITY_VERSION,stages,ok:failed.length===0,score};
}
