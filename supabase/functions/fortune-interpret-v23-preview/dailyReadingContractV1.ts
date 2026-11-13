import { EDITORIAL_SECTION_KEYS } from './providerSchemaV23.ts'
import { contactEvidenceIssues } from './contactAxesV1.ts'
import { DOMAIN_ANSWER_LOOKUP, domainAnswerContractKey } from './domainAnswerContractsV1.ts'

// Primary controls presentation order, not the set of supported daily readings.
export const DAILY_PRIMARY_KEYS = ['relationship.love_general','relationship.summary','work_study.study','work_study.work','money_news.money','condition.condition'] as const
export const DAILY_DETAIL_KEYS = ['relationship.love_single','relationship.love_crush','relationship.love_flirting','relationship.love_ambiguous','relationship.love_couple','relationship.contact_activation','relationship.contact_continuity','relationship.love_reunion_interest','work_study.exam','work_study.career_change','investment.psychology','investment.realization','investment.entry','money_news.news'] as const
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
    r?.id && r.system!=='thai' && /^(?:intraday_evidence|daily_actual(?:_aspect_house)?)$/.test(String(r.scope??'')) &&
    (!start || (r.date>=start && r.date<=end)) &&
    (topics.includes(String(r?.topic??'')) || (Array.isArray(r?.source_topics)&&r.source_topics.some((t:string)=>topics.includes(t)))))
}

const text = (v:unknown) => typeof v === 'string' ? v.trim() : ''
const fingerprint = (v:unknown) => text(v).replace(/[\s.,!?·]/g,'')

export function inspectDailyProviderDocument(core:any, kind:unknown, payload?:any) {
  const issues:string[] = []
  if (kind !== 'day') return {passed:true,issues}
  if (payload?.period?.start) issues.push(...contactEvidenceIssues(core,payload).map(i=>i.code+':'+i.path))
  const rows = Array.isArray(core?.clusters) ? core.clusters : []
  const hero=text(core?.headline)+' '+text(core?.overall?.summary)+' '+text(core?.overall?.best_phase)+' '+text(core?.overall?.caution_phase)
  if (/(?:학업|공부|시험|직장|업무|실무|이직|투자|매수|매도|연애|재회|금전|컨디션)/.test(hero)) issues.push('daily_overview_role_specific')
  if (/(?:기류|에너지|예작|가관)/.test(hero)) issues.push('daily_overview_abstract_or_typo')
  const contactIncoming=text(core?.contact_flow?.incoming)
  if(/(?:상대(?:방)?(?:로부터|가|이)|누군가가)\s*먼저[^.]{0,30}(?:연락|메시지|대화|문의|건네)/.test(contactIncoming))issues.push('daily_incoming_initiator_prediction')
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
      if(['conclusion','real_scene','action','change_condition'].some(k=>text(row[k])) || (row.evidence_refs?.length??0)>0)issues.push(`daily_insufficient_with_prose:${key}`)
      continue
    }
    if (!['conclusion','real_scene','action'].every(k=>text(row[k])) || typeof row.change_condition!=='string' || !row.evidence_refs?.length) issues.push(`daily_primary_incomplete:${key}`)
    if (payload?.period?.start) {
      const allowedRefs=new Set(dailySectionFacts(payload,key).map((fact:any)=>fact.id))
      if (!Array.isArray(row.evidence_refs) || !row.evidence_refs.length || row.evidence_refs.some((id:string)=>!allowedRefs.has(id))) {
        issues.push(`daily_evidence_outside_question:${key}`)
      }
    }
    if (text(row.conclusion).length>180) issues.push(`daily_headline_too_long:${key}`)
    for(const [field,max] of [['real_scene',500],['action',300]] as const) {
      if(text(row[field]).length>max)issues.push(`daily_block_too_long:${key}:${field}`)
    }
    if (fingerprint(row.conclusion)===fingerprint(core?.overall?.summary)) issues.push(`daily_overall_reused:${key}`)
  }
  for (const row of core?.domain_answers??[]) {
    if (!payload?.period?.start || row.status==='not_calculated') continue
    const contract=DOMAIN_ANSWER_LOOKUP.get(domainAnswerContractKey(row.topic,row.question_key))
    const allowedRefs=new Set(contract?dailySectionFacts(payload,contract.section_key).map((fact:any)=>fact.id):[])
    if (!Array.isArray(row.evidence_refs) || !row.evidence_refs.length || row.evidence_refs.some((id:string)=>!allowedRefs.has(id))) {
      issues.push(`daily_answer_outside_question:${row.topic}:${row.question_key}`)
    }
  }
  if (payload?.period?.start && core?.editorial_focus) {
    const focus=core.editorial_focus
    const selected=rows.find((row:any)=>row.key===focus.section_key && row.applicability!=='insufficient')
    const refs=new Set(Array.isArray(selected?.evidence_refs)?selected.evidence_refs:[])
    const cited=Array.isArray(focus.evidence_refs)?focus.evidence_refs:[]
    const overall=Array.isArray(core.overall?.evidence_refs)?core.overall.evidence_refs:[]
    if (!cited.length || cited.some((ref:string)=>!refs.has(ref)) || !overall.length || overall.some((ref:string)=>!cited.includes(ref))) {
      issues.push('daily_overview_evidence_outside_selected_question')
    }
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
