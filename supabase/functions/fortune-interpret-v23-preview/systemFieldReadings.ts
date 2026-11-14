import { inspectThaiOutputSafety } from '../fortune-interpret-v6-preview/thaiContract.ts'

export type SystemFieldSource = {system:'saju'|'thai';topic:string;fact:string;evidence_ref:string}

const SAJU_TOPICS:Record<string,string[]> = {
  비견:['대인관계','연애'],겁재:['대인관계','연애'],식신:['대인관계','학업','직장','연애'],
  상관:['대인관계','학업','직장','연애'],정관:['직장','학업','연애'],편관:['직장','학업','연애'],
  정인:['학업','연애'],편인:['학업','연애'],정재:['금전','직장','연애'],편재:['금전','직장','연애'],
}
const THAI_TOPICS:Record<string,string[]> = {
  boriwan:['대인관계','연애'],sri:['금전','연애'],montri:['학업','직장','대인관계','연애'],
  kalakini:['금전','대인관계','연애'],utsaha:['학업','직장'],det:['직장'],mula:['금전'],ayu:['컨디션'],
}

// One explicit, in-period calculation per subject bounds the output. A
// Suriyayat longitude does not establish a life topic or an event forecast.
export function buildSystemFieldSources(payload:any,packet:any):SystemFieldSource[] {
  const result=new Map<string,SystemFieldSource>()
  const from=String(packet.period?.start??''),to=String(packet.period?.end??'')
  if(!from || !to)return []
  const rows=Array.isArray(payload.evidence_ledger)?payload.evidence_ledger:[]
  const ids=new Set(rows.map((row:any)=>row.id))
  const add=(system:SystemFieldSource['system'],topics:string[],fact:string,ref:string)=>{
    if(!ids.has(ref))return
    for(const topic of topics){
      const key=system+':'+topic
      if(!result.has(key))result.set(key,{system,topic,fact,evidence_ref:ref})
    }
  }
  for(const row of [...(payload.saju?.daily??[]),...(payload.saju?.monthly??[]),...(payload.saju?.annual??[])]){
    if(row.date ? row.date<from||row.date>to : !(row.segment_start?.slice(0,10)<=to && row.segment_end_exclusive?.slice(0,10)>=from))continue
    const god=Object.keys(SAJU_TOPICS).find(name=>String(row.stem_ten_god??'').includes(name))
    if(god && row.ganzhi)add('saju',SAJU_TOPICS[god],`${row.date??row.segment_start} ${row.ganzhi} · ${row.stem_ten_god}`,row.evidence_id)
  }
  for(const segment of payload.thai?.taksajorn?.segments??[]){
    if(!(segment.start<=to && segment.end>=from))continue
    for(const place of segment.wheel??[]){
      const planet=place.planet?.label
      if(planet && THAI_TOPICS[place.bhumi_key])add('thai',THAI_TOPICS[place.bhumi_key],`${segment.start}~${segment.end} · ${place.bhumi_label??place.bhumi_key}(${place.bhumi_key}) · ${planet}`,segment.evidence_id)
    }
  }
  return [...result.values()]
}

export function validSystemFieldReadings(value:any,sources:SystemFieldSource[]){
  if (!Array.isArray(value))return []
  const result=[]
  for(const source of sources){
    const matches=value.filter(row=>row?.system===source.system && row?.topic===source.topic)
    if(matches.length!==1)continue
    const row=matches[0],reading=typeof row.reading==='string'?row.reading.trim():''
    if(!reading || reading.length>450 || !Array.isArray(row.evidence_refs) || row.evidence_refs.length!==1 || row.evidence_refs[0]!==source.evidence_ref)continue
    if(source.system==='thai' && !inspectThaiOutputSafety({systems:{thai:reading}},true).safe)continue
    if(value.some(other=>other!==row && other?.reading?.trim?.()===reading))continue
    result.push({system:source.system,topic:source.topic,reading,evidence_refs:[source.evidence_ref]})
  }
  return result
}
