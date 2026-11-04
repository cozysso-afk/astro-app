import type { AiEditorialSection, AiInterpretationResponse } from '../appTypes'
import type { FortuneField } from './fortuneFields'

export type DailyBlock = { id: string; label: string; text: string }
export type DailyReadingDocument = {
  version: 'daily-document-v1'; date: string; scope: string; title: string
  state: 'ready' | 'missing' | 'unverified' | 'insufficient' | 'needs_refresh'; headline: string
  blocks: DailyBlock[]; details: DailyBlock[]
}
type Data = NonNullable<AiInterpretationResponse['data']>
const clean = (s: unknown): string => typeof s === 'string' ? s.trim() : ''
const sectionKeys: Record<string, [string, string, string][]> = {
  love: [['relationship','love_general','애정'],...(['single','crush','flirting','ambiguous','couple','reunion_interest'].map((key,i)=>['relationship',`love_${key}`,['솔로 · 새 인연','짝사랑','썸','애매한 관계','연애 중','재회를 생각하는 경우'][i]] as [string,string,string]))],
  social: [['relationship','summary','대인관계'],...(['friends','coworkers','family','new_people','boundaries'].map((key,i)=>['relationship',key,['친구 · 지인','직장동료','가족 · 가까운 사람','새 만남','관계의 경계'][i]] as [string,string,string]))],
  study: [['work_study','study','학업'],['work_study','exam','시험']],
  exam: [['work_study','exam','시험']],
  work: [['work_study','work','직장'],['work_study','career_change','이직']],
  'job-change': [['work_study','career_change','이직']],
  money: [['money_news','money','금전']],
  investment: [['investment','psychology','투자 판단'],['investment','realization','수익 실현'],['investment','entry','신규 진입']],
  contact: [['relationship','contact_activation','연락'],['relationship','contact_continuity','대화의 지속'],['money_news','news','공식 소식']],
  condition: [['condition','condition','컨디션']],
}
function blocksFor(section: AiEditorialSection, prefix: string): DailyBlock[] {
  return [
    {id:`${prefix}:scene`,label:'생활에서 보면',text:clean(section.real_scene)},
    {id:`${prefix}:action`,label:'지금 할 일',text:clean(section.action)},
    {id:`${prefix}:condition`,label:'다시 판단할 조건',text:clean(section.change_condition)},
  ].filter(b=>b.text)
}
function ready(section: AiEditorialSection | undefined): boolean {
  return Boolean(section && section.applicability !== 'insufficient' && section.evidence_refs?.length &&
    [section.conclusion,section.real_scene,section.action].every(clean))
}

// Migration adapter: preserve provider-owned prose verbatim. In particular,
// deterministic topic_analysis and another scope's overall summary are not fallbacks.
export function buildDailyReadingDocument(data: Data, date: string, field?: FortuneField, verified = false): DailyReadingDocument {
  const doc: DailyReadingDocument = {version:'daily-document-v1',date,scope:field?.id ?? 'overall',title:field?.label ?? '일일 종합운세',state:verified?'missing':'unverified',headline:'',blocks:[],details:[]}
  if (!verified) return doc
  if (field) {
    const topicForKey: Record<string,string> = {work:'직장',career_change:'이직',study:'학업',exam:'시험',news:'소식'}
    const sections = (sectionKeys[field.id] ?? []).filter(([,k])=>!topicForKey[k] || field.topics.includes(topicForKey[k])).map(([g,k,label])=>({key:`${g}.${k}`,label,section:(data.clusters as unknown as Record<string,Record<string,AiEditorialSection>>)?.[g]?.[k]}))
    // The primary question must be answered; never promote a secondary subject.
    if (!ready(sections[0]?.section)) {
      if (sections[0]?.section?.applicability === 'insufficient' && data.editorial_delivery?.[sections[0].key] === 'authored') doc.state='insufficient'
      return doc
    }
    const fingerprint=(s:string)=>s.replace(/[\s.,!?·]/g,'')
    const primary=sections[0].section.conclusion
    if (sections[0].section.real_scene.length>500 || sections[0].section.action.length>300 || sections[0].section.change_condition.length>300) {doc.state='needs_refresh';return doc}
    const peers=Object.values(data.clusters??{}).flatMap(group=>Object.values(group??{})).filter(s=>s && s!==sections[0].section && s.applicability!=='insufficient')
    if(primary.length>180 || fingerprint(primary)===fingerprint(data.overall?.summary??'') || peers.some(s=>fingerprint(clean(s.conclusion))===fingerprint(primary))) {doc.state='needs_refresh';return doc}
    doc.headline = clean(sections[0].section.conclusion)
    doc.blocks = blocksFor(sections[0].section,sections[0].key)
    doc.details = sections.slice(1).filter(s=>ready(s.section)).flatMap(s=>[
      {id:`${s.key}:conclusion`,label:s.label,text:clean(s.section.conclusion)},...blocksFor(s.section,s.key),
    ])
    const answers = (data.domain_answers ?? []).filter(a=>field.topics.includes(a.topic) && a.status !== 'not_calculated' && a.evidence_refs?.length && clean(a.answer))
    doc.details.push(...answers.map(a=>({id:`question:${a.topic}:${a.question_key}`,label:a.label,text:a.answer})))
  } else {
    if (!clean(data.headline) || !clean(data.overall?.summary) || !data.overall?.evidence_refs?.length) return doc
    if(data.headline.length>180 || data.overall.summary.length>360 || data.headline.trim()===data.overall.summary.trim()) {doc.state='needs_refresh';return doc}
    doc.headline = clean(data.headline)
    doc.blocks.push({id:'overall:summary',label:'핵심 요약',text:clean(data.overall.summary)})
    if (clean(data.overall.dominant_pattern)) doc.blocks.push({id:'overall:reason',label:'이렇게 읽는 이유',text:clean(data.overall.dominant_pattern)})
    const decision = data.decisions?.find(d=>clean(d.action) && d.evidence_refs?.length)
    if (decision) {
      doc.blocks.push({id:'overall:action',label:'지금 할 일',text:decision.action})
      if (clean(decision.timing) && clean(decision.timing) !== date) doc.blocks.push({id:'overall:timing',label:'이 행동을 적용할 때',text:decision.timing})
      for (const [key,label] of [['watch','다시 판단할 조건'],['avoid','피할 것']] as const) {
        if (clean(decision[key])) doc.blocks.push({id:`overall:${key}`,label,text:decision[key]})
      }
      if (clean(decision.reason)) doc.details.push({id:'decision:reason',label:'행동의 이유',text:decision.reason})
    }
    for (const [i,d] of (data.decisions??[]).entries()) {
      if (d === decision || !d.evidence_refs?.length) continue
      for(const [key,label] of [['action','함께 살필 행동'],['timing','적용 시기'],['reason','이유'],['watch','다시 판단할 조건'],['avoid','피할 것']] as const) {
        if(clean(d[key]))doc.details.push({id:`decision:${i}:${key}`,label,text:d[key]})
      }
    }
    for(const [key,label] of [['western','서양점성술에서 보면'],['saju','사주에서 보면'],['thai','태국점성술에서 보면']] as const) {
      if(clean(data.systems?.[key]))doc.details.push({id:`system:${key}`,label,text:data.systems[key]})
    }
  }
  // The overall limit has no field scope: a money-specific caveat must not
  // become love, study or condition copy merely because it is globally present.
  if (!field && clean(data.limits)) doc.blocks.push({id:'limits',label:'함께 알아둘 점',text:clean(data.limits)})
  doc.state = 'ready'
  return doc
}
