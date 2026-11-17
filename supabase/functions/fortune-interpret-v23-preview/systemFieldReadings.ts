import { inspectThaiOutputSafety } from '../fortune-interpret-v6-preview/thaiContract.ts'

export type SystemFieldSource = {system:'saju'|'thai';topic:string;fact:string;evidence_ref:string}

// Every ten god speaks to every life field in its own way (정재 in love is
// steady care, in money a fixed income). One topic per god left most fields
// blank, so the field meaning lives in the writer instruction instead.
export const FIELD_TOPICS=['연애','대인관계','학업','직장','금전','컨디션'] as const
const SAJU_GODS=['비견','겁재','식신','상관','정재','편재','정관','편관','칠살','정인','편인']
// Thai places are field-specific; the first listed place is the most direct one.
const THAI_PLACES:Record<string,string[]>={
  연애:['boriwan','sri','montri','kalakini'],대인관계:['boriwan','montri','kalakini'],
  학업:['utsaha','montri'],직장:['det','utsaha','montri'],금전:['sri','mula','kalakini'],컨디션:['ayu'],
}
type Kind='day'|'week'|'month'|'annual'
function periodKind(packet:any):Kind{
  const k=String(packet?.period_kind??'')
  if(k==='day'||k==='week'||k==='month'||k==='annual')return k
  const a=Date.parse(String(packet?.period?.start??'')),b=Date.parse(String(packet?.period?.end??''))
  const days=Number.isFinite(a)&&Number.isFinite(b)?Math.round((b-a)/86400000)+1:1
  return days<=1?'day':days<=9?'week':days<=45?'month':'annual'
}

// One explicit, in-period calculation per subject bounds the output. The
// calculation scope must match the reading scope: a month or a year is read
// from its own pillar (월운/세운), never from one sampled day.
export function buildSystemFieldSources(payload:any,packet:any):SystemFieldSource[] {
  const result=new Map<string,SystemFieldSource>()
  const from=String(packet.period?.start??''),to=String(packet.period?.end??'')
  if(!from || !to)return []
  const kind=periodKind(packet)
  const rows=Array.isArray(payload.evidence_ledger)?payload.evidence_ledger:[]
  const ids=new Set(rows.map((row:any)=>row.id))
  const add=(system:SystemFieldSource['system'],topic:string,fact:string,ref:string)=>{
    if(!ids.has(ref))return
    const key=system+':'+topic
    if(!result.has(key))result.set(key,{system,topic,fact,evidence_ref:ref})
  }
  const inPeriod=(row:any)=>row?.date ? row.date>=from&&row.date<=to
    : String(row?.segment_start??'').slice(0,10)<=to && String(row?.segment_end_exclusive??'').slice(0,19)>from+'T00:00:00'
  const daily=(payload.saju?.daily??[]).map((row:any)=>({row,label:'일진'}))
  const monthly=(payload.saju?.monthly??[]).map((row:any)=>({row,label:'월운'}))
  const annual=(payload.saju?.annual??[]).map((row:any)=>({row,label:'세운'}))
  const sajuOrder=kind==='annual'?[...annual,...monthly]:kind==='month'?[...monthly,...annual]:[...daily,...monthly,...annual]
  for(const {row,label} of sajuOrder){
    if(!inPeriod(row))continue
    const god=SAJU_GODS.find(name=>String(row.stem_ten_god??'').includes(name))
    if(!god || !row.ganzhi)continue
    for(const topic of FIELD_TOPICS)add('saju',topic,`${label} ${row.date??String(row.segment_start??'').slice(0,10)} ${row.ganzhi} · ${row.stem_ten_god}`,row.evidence_id)
  }
  const dailyTaksa=payload.thai?.daily_taksa
  if((kind==='day'||kind==='week') && dailyTaksa?.date && dailyTaksa.date>=from && dailyTaksa.date<=to){
    for(const topic of FIELD_TOPICS)if(THAI_PLACES[topic].includes(dailyTaksa.role))
      add('thai',topic,`${dailyTaksa.date} 요일 탁사 · ${dailyTaksa.role_label}(${dailyTaksa.role}) · 이날 요일 행성 ${dailyTaksa.day_planet}`,dailyTaksa.evidence_id)
  }
  for(const segment of payload.thai?.taksajorn?.segments??[]){
    if(!(segment.start<=to && segment.end>=from))continue
    const wheel=Array.isArray(segment.wheel)?segment.wheel:[]
    for(const topic of FIELD_TOPICS){
      for(const key of THAI_PLACES[topic]){
        const place=wheel.find((p:any)=>p?.bhumi_key===key)
        const planet=place?.planet?.label
        if(planet){add('thai',topic,`${segment.start}~${segment.end} 탁사쫀 · ${place.bhumi_label??key}(${key}) · ${planet}`,segment.evidence_id);break}
      }
    }
  }
  return [...result.values()]
}

// A reading that only defines the term ("브리완은 대인관계를 상징해") tells the
// reader nothing about this period. Those are dropped and rewritten.
const DEFINITION_ONLY=/(?:을|를|은|는)?\s*(?:뜻해|뜻이야|뜻을 지녀|뜻을 나타내|상징해|나타내|의미해|의미를 지녀|맡아|가리켜|담당해)\s*[.!]?\s*$/
export function isDefinitionOnlyReading(reading:string){
  const sentences=reading.split(/(?<=[.!?])\s+/).map(x=>x.trim()).filter(Boolean)
  return sentences.length<2 || sentences.every(sentence=>DEFINITION_ONLY.test(sentence))
}

export function validSystemFieldReadings(value:any,sources:SystemFieldSource[]){
  if (!Array.isArray(value))return []
  const result=[]
  for(const source of sources){
    const matches=value.filter(row=>row?.system===source.system && row?.topic===source.topic)
    if(matches.length!==1)continue
    const row=matches[0],reading=typeof row.reading==='string'?row.reading.trim():''
    if(!reading || reading.length>600 || isDefinitionOnlyReading(reading) || /표본|근거가 부족|근거 부족|데이터|보장하지|계산되지|evidence/i.test(reading) || !Array.isArray(row.evidence_refs) || row.evidence_refs.length!==1 || row.evidence_refs[0]!==source.evidence_ref)continue
    if(source.system==='thai' && !inspectThaiOutputSafety({systems:{thai:reading}},true).safe)continue
    if(value.some(other=>other!==row && other?.reading?.trim?.()===reading))continue
    result.push({system:source.system,topic:source.topic,reading,evidence_refs:[source.evidence_ref]})
  }
  return result
}
