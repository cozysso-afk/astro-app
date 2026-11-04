// Required daily primary questions. Other relationship states/subtopics remain
// sparse; this does not add model calls or invent missing calculation evidence.
export const DAILY_PRIMARY_KEYS = ['relationship.love_general','relationship.summary','work_study.study','work_study.work','money_news.money','condition.condition'] as const

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

export function inspectDailyProviderDocument(core:any, kind:unknown) {
  const issues:string[] = []
  if (kind !== 'day') return {passed:true,issues}
  const rows = Array.isArray(core?.clusters) ? core.clusters : []
  for (const key of DAILY_PRIMARY_KEYS) {
    const found = rows.filter((r:any)=>r?.key===key)
    if (found.length!==1) {issues.push(`daily_primary_missing_or_duplicate:${key}`);continue}
    const row=found[0]
    if (row.applicability==='insufficient') continue
    if (!['conclusion','real_scene','action'].every(k=>text(row[k])) || typeof row.change_condition!=='string' || !row.evidence_refs?.length) issues.push(`daily_primary_incomplete:${key}`)
    if (text(row.conclusion).length>180) issues.push(`daily_headline_too_long:${key}`)
    for(const [field,max] of [['real_scene',500],['action',300]] as const) {
      if(text(row[field]).length>max)issues.push(`daily_block_too_long:${key}:${field}`)
    }
    if (fingerprint(row.conclusion)===fingerprint(core?.overall?.summary)) issues.push(`daily_overall_reused:${key}`)
  }
  const authored=rows.filter((r:any)=>DAILY_PRIMARY_KEYS.includes(r?.key) && r.applicability!=='insufficient')
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
