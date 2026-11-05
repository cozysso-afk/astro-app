import { EDITORIAL_SECTION_KEYS } from './providerSchemaV23.ts'

// Primary controls presentation order, not the set of supported daily readings.
export const DAILY_PRIMARY_KEYS = ['relationship.love_general','relationship.summary','work_study.study','work_study.work','money_news.money','condition.condition'] as const
export const DAILY_DETAIL_KEYS = ['relationship.contact_activation','relationship.contact_continuity','relationship.love_reunion_interest','work_study.exam','work_study.career_change','investment.psychology','investment.realization','investment.entry','money_news.news'] as const
export const DAILY_SECTION_TOPICS:Record<string,string[]> = {
  'relationship.summary':['대인관계'], 'relationship.friends':['대인관계'], 'relationship.coworkers':['대인관계'],
  'relationship.family':['대인관계'], 'relationship.new_people':['대인관계'], 'relationship.boundaries':['대인관계'],
  'relationship.love_general':['연애'], 'relationship.love_single':['연애'], 'relationship.love_crush':['연애'],
  'relationship.love_flirting':['연애'], 'relationship.love_ambiguous':['연애'], 'relationship.love_couple':['연애'],
  'relationship.love_reunion_interest':['재회'], 'relationship.contact_activation':['연락'], 'relationship.contact_continuity':['연락'],
  'work_study.work':['직장'], 'work_study.career_change':['이직'], 'work_study.exam':['시험'], 'work_study.study':['학업'],
  'money_news.money':['금전'], 'money_news.news':['소식'], 'investment.psychology':['투자심리'],
  'investment.realization':['수익실현'], 'investment.entry':['신규진입'], 'condition.condition':['컨디션'],
}
export function dailySectionFacts(payload:any,key:string) {
  const topics=DAILY_SECTION_TOPICS[key]??[]
  const start=String(payload?.period?.start??'').slice(0,10),end=String(payload?.period?.end??start).slice(0,10)
  return (Array.isArray(payload?.evidence_ledger)?payload.evidence_ledger:[]).filter((r:any)=>
    /intraday_evidence|daily_actual/.test(String(r?.scope??'')) &&
    (!r?.date || !/^\d{4}-\d{2}-\d{2}$/.test(start) || (String(r.date).slice(0,10)>=start && String(r.date).slice(0,10)<=end)) &&
    (topics.includes(String(r?.topic??'')) || (Array.isArray(r?.source_topics)&&r.source_topics.some((t:string)=>topics.includes(t)))))
}

const text = (v:unknown) => typeof v === 'string' ? v.trim() : ''
const fingerprint = (v:unknown) => text(v).replace(/[\s.,!?·]/g,'')

// Current daily evidence describes the date; it does not substantiate an
// exception that makes the reading inapplicable. Do not publish these optional
// counterfactuals. Keep their provider originals in the editorial trace, and
// preserve every retained authored field verbatim. Other periods are unchanged.
export function omitUnsupportedDailyConditions(core:any,kind:unknown) {
  if(kind!=='day')return core
  const result=structuredClone(core)
  const sections=Array.isArray(result?.clusters)?result.clusters:
    Object.values(result?.clusters??{}).flatMap((group:any)=>Object.values(group??{}))
  for(const section of sections as any[])if(section&&typeof section==='object')section.change_condition=''
  return result
}

export function inspectDailyProviderDocument(core:any, kind:unknown, payload?:any) {
  const issues:string[] = []
  if (kind !== 'day') return {passed:true,issues}
  const rows = Array.isArray(core?.clusters) ? core.clusters : []
  const hero=text(core?.headline)+' '+text(core?.overall?.summary)+' '+text(core?.overall?.best_phase)+' '+text(core?.overall?.caution_phase)
  if (/(?:학업|공부|시험|직장|업무|실무|이직|투자|매수|매도|연애|연락|재회|금전|컨디션)/.test(hero)) issues.push('daily_overview_role_specific')
  if (/(?:기류|에너지|예작|가관)/.test(hero)) issues.push('daily_overview_abstract_or_typo')
  const contactIncoming=text(core?.contact_flow?.incoming)
  if(/(?:상대(?:방)?(?:로부터|가)|누군가가)\s*먼저[^.]{0,30}(?:연락|메시지|대화|문의|건네)/.test(contactIncoming))issues.push('daily_incoming_initiator_prediction')
  if(/(?:상답|예작|생활 가관|북수조점)/.test(JSON.stringify(core)))issues.push('daily_korean_copy_error')
  const authoredRows=rows.filter((row:any)=>row?.applicability!=='insufficient')
  const abstractCount=authoredRows.reduce((count:number,row:any)=>count+((text(row?.conclusion)+' '+text(row?.real_scene)+' '+text(row?.action)).match(/(?:기류|에너지|작용)/g)?.length??0),0)
  if(abstractCount>2)issues.push('daily_detail_abstract_repetition')
  const required=new Set<string>(DAILY_PRIMARY_KEYS)
  for(const key of DAILY_DETAIL_KEYS)if(dailySectionFacts(payload,key).length)required.add(key)
  for (const key of required) {
    const found = rows.filter((r:any)=>r?.key===key)
    if (found.length!==1) issues.push(`${DAILY_PRIMARY_KEYS.includes(key as any)?'daily_primary':'daily_supported_detail'}_missing_or_duplicate:${key}`)
  }
  const allowed=new Set<string>(EDITORIAL_SECTION_KEYS)
  const keys=new Set<string>()
  for(const row of rows) {
    const key=String(row?.key??'')
    if(!allowed.has(key)){issues.push(`daily_unknown_section:${key}`);continue}
    if(keys.has(key)){issues.push(`daily_duplicate_section:${key}`);continue}
    keys.add(key)
    if (row.applicability==='insufficient') {
      if(['conclusion','real_scene','action','change_condition'].some(k=>text(row[k])))issues.push(`daily_insufficient_with_prose:${key}`)
      continue
    }
    if (!['conclusion','real_scene','action'].every(k=>text(row[k])) || typeof row.change_condition!=='string' || !row.evidence_refs?.length) issues.push(`daily_primary_incomplete:${key}`)
    if (text(row.conclusion).length>180) issues.push(`daily_headline_too_long:${key}`)
    for(const [field,max] of [['real_scene',500],['action',300]] as const) {
      if(text(row[field]).length>max)issues.push(`daily_block_too_long:${key}:${field}`)
    }
    if (fingerprint(row.conclusion)===fingerprint(core?.overall?.summary)) issues.push(`daily_overall_reused:${key}`)
  }
  const authored=rows.filter((r:any)=>allowed.has(r?.key) && r.applicability!=='insufficient')
  const seen=new Set<string>()
  for(const row of authored) {
    const fp=fingerprint(row.conclusion)
    if(fp && seen.has(fp))issues.push(`daily_duplicate_conclusion:${row.key}`)
    if(fp)seen.add(fp)
  }
  if(!text(core?.headline) || text(core.headline).length>180)issues.push('daily_headline_invalid')
  if(!text(core?.overall?.summary) || text(core.overall.summary).length>360)issues.push('daily_summary_invalid')
  if(fingerprint(core?.headline)===fingerprint(core?.overall?.summary))issues.push('daily_headline_summary_duplicate')
  return {passed:issues.length===0,issues}
}
