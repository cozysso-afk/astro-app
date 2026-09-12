import type { IntegratedApiResponse } from '../appTypes'
import { fortuneAiPrecisionReadiness } from './precisionTransport'
import type { NatalDatingResponse, NatalDatingStructure } from './datingArchetypeV2'

// Existing endpoint, existing calculation contract. Never send relationship/partner fields.
export function datingNatalRequest(profile:Record<string,unknown>,date:string) {
 if(typeof profile.birth_date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('저장된 출생정보와 날짜를 확인해줘.')
 const keys=['birth_date','birth_time','time_known','time_source','time_confidence','rectified_window','latitude','longitude','utc_offset_hours']
 return {profile:Object.fromEntries(keys.filter(k=>profile[k]!==undefined).map(k=>[k,profile[k]])),start_date:date,end_date:date}
}
export function readDatingNatalResponse(value:NatalDatingResponse):NatalDatingStructure {
 const r=value?.result
 if(value?.ok!==true||r?.ok!==true||r.source_scope!=='single_person_only'||r.counterpart_used!==false||r.relationship_engine_used!==false||r.static_structure?.scope!=='single_person_natal_only')throw new Error('개인 출생차트 근거를 확인하지 못했어.')
 return r.static_structure
}
export async function fetchDatingNatal(apiBase:string,profile:Record<string,unknown>,date:string,signal:AbortSignal,fetcher:typeof fetch=fetch) {
 const response=await fetcher(`${apiBase}/v1/love/new-relationship`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(datingNatalRequest(profile,date)),signal})
 if(!response.ok)throw new Error('출생차트를 불러오지 못했어. 잠시 후 다시 시도해줘.')
 return readDatingNatalResponse(await response.json())
}
export function datingPeriodMood(c:IntegratedApiResponse) {
 const ready=fortuneAiPrecisionReadiness(c);if(!ready.ok)return undefined
 const rows=(c.western.daily_scores??[]).filter(d=>d.date>=c.period.start&&d.date<=c.period.end).flatMap(d=>(d.evidence??[]).filter(e=>e.source_topics?.includes('연애')&&['Venus','Mars','Mercury'].includes(String(e.transit))))
 const supportive=rows.filter(e=>Number(e.contribution)>0)
 if(supportive.some(e=>e.transit==='Mars'))return {ko:'선택 기간의 화성 근거는 움직임이 있는 첫 만남 장면의 분위기에만 반영',en:'Use the period Mars support only for a slightly active first-meeting scene'}
 if(supportive.some(e=>e.transit==='Venus'))return {ko:'선택 기간의 금성 근거는 편안하고 부드러운 만남 장면의 분위기에만 반영',en:'Use the period Venus support only for a relaxed gentle meeting scene'}
 if(supportive.some(e=>e.transit==='Mercury'))return {ko:'선택 기간의 수성 근거는 대화 중 표정이 살아나는 장면에만 반영',en:'Use the period Mercury support only for animated expressions during conversation'}
 return undefined
}
