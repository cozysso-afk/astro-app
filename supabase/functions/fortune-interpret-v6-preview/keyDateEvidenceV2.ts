export const KEY_DATE_LEDGER_VERSION = "key-date-ledger-v2";

function txt(v:unknown,n:number){return String(v??"").trim().slice(0,n);}
function num(v:unknown){const n=Number(v);return Number.isFinite(n)?n:null;}
function uniq<T>(xs:T[]){return [...new Set(xs)];}

function safeEvidence(row:any){
  if(!row||typeof row!=="object")return null;
  const sourceTopics=Array.isArray(row.source_topics)?row.source_topics.slice(0,8).map((x:any)=>txt(x,60)).filter(Boolean):[];
  const packed:any={
    kind:txt(row.kind,30),
    sample_time:txt(row.sample_time,10),
    source_topics:sourceTopics,
    contribution:num(row.contribution),
    text:txt(row.text,500),
  };
  for(const key of ["transit","target","aspect","motion","direction"]){const v=txt(row?.[key],80);if(v)packed[key]=v;}
  for(const key of ["orb","whole_house","placidus_house","polarity"]){const v=num(row?.[key]);if(v!==null)packed[key]=v;}
  return packed;
}

function safeDetail(row:any){
  if(!row||typeof row!=="object")return null;
  const date=txt(row.date,20);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;
  const triggers=Array.isArray(row.triggers)?row.triggers.slice(0,18).map((x:any)=>({topic:txt(x?.topic,80),kind:txt(x?.kind,20),score:num(x?.score)})).filter((x:any)=>x.topic):[];
  const sourceTopics=Array.isArray(row.source_topics)?row.source_topics.slice(0,15).map((x:any)=>txt(x,80)).filter(Boolean):[];
  const sampledScores:any={};
  if(row.sampled_scores&&typeof row.sampled_scores==="object")for(const [topic,value] of Object.entries(row.sampled_scores) as any[]){sampledScores[txt(topic,80)]={average:num(value?.average),min:num(value?.min),min_time:txt(value?.min_time,10),max:num(value?.max),max_time:txt(value?.max_time,10)};}
  return {
    date,
    salience:num(row.salience),
    hits:num(row.hits),
    triggers,
    source_topics:sourceTopics,
    scan_policy:txt(row.scan_policy,400),
    sample_count:num(row.sample_count),
    sampled_scores:sampledScores,
    evidence:(Array.isArray(row.evidence)?row.evidence:[]).slice(0,10).map(safeEvidence).filter(Boolean),
  };
}

/**
 * Promote API-side actual transit/aspect evidence into the same immutable
 * evidence ledger used by the interpretation validator. This keeps model prose
 * traceable all the way back to a concrete calculation row.
 */
export function attachActualKeyDateEvidence(packet:any,calculation:any){
  if(!packet||typeof packet!=="object")return packet;
  const western=calculation?.western??{};
  const raw=Array.isArray(western?.key_dates)?western.key_dates:[];
  const details=raw.slice(0,16).map(safeDetail).filter(Boolean) as any[];
  packet.western=packet.western&&typeof packet.western==="object"?packet.western:{};
  packet.western.key_date_details=details;
  packet.western.key_date_evidence_policy=western?.key_date_evidence_policy??null;
  packet.key_date_ledger_version=KEY_DATE_LEDGER_VERSION;
  packet.evidence_ledger=Array.isArray(packet.evidence_ledger)?packet.evidence_ledger:[];
  const existing=new Set(packet.evidence_ledger.map((x:any)=>String(x?.id??"")));

  for(const detail of details){
    const refs:string[]=[];
    for(let i=0;i<detail.evidence.length;i++){
      const row=detail.evidence[i];
      const id=`W:keydate:${detail.date}:${i+1}`;
      refs.push(id);
      if(existing.has(id))continue;
      existing.add(id);
      const source=row.source_topics?.length?` · 관련 ${row.source_topics.join(", ")}`:"";
      const sample=row.sample_time?` ${row.sample_time}`:"";
      packet.evidence_ledger.push({
        id,
        system:"western",
        scope:"key_date_actual_transit",
        direction:"context",
        date:detail.date,
        text:`${detail.date}${sample} · ${row.text}${source}`.slice(0,900),
        calculation:{
          kind:row.kind,
          transit:row.transit??null,
          target:row.target??null,
          aspect:row.aspect??null,
          orb:row.orb??null,
          motion:row.motion??null,
          direction:row.direction??null,
          whole_house:row.whole_house??null,
          placidus_house:row.placidus_house??null,
          contribution:row.contribution??null,
          source_topics:row.source_topics??[],
          sample_time:row.sample_time??null,
        },
      });
    }
    const keyDate=(Array.isArray(packet.key_dates)?packet.key_dates:[]).find((x:any)=>x?.date===detail.date);
    if(keyDate)keyDate.western_refs=uniq([...(keyDate.western_refs??[]),...refs]);
    const timeline=(Array.isArray(packet.cross_system_timeline)?packet.cross_system_timeline:[]).find((x:any)=>x?.date===detail.date);
    if(timeline)timeline.western_refs=uniq([...(timeline.western_refs??[]),...refs]);
    detail.evidence_refs=refs;
  }
  return packet;
}
