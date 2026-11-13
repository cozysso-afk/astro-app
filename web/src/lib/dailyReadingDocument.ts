import type { AiEditorialSection, AiInterpretationResponse } from '../appTypes'
import type { FortuneField } from './fortuneFields'

export type DailyBlock = { id: string; label: string; text: string }
export type DailyReadingDocument = {
  version: 'daily-document-v1'; date: string; scope: string; title: string
  state: 'ready' | 'missing' | 'unverified' | 'insufficient' | 'needs_refresh'; headline: string
  blocks: DailyBlock[]; details: DailyBlock[]
  slots?: Array<{id:string;label:string;state:'ready'|'missing'|'insufficient'}>
}
type Data = NonNullable<AiInterpretationResponse['data']>
const clean = (s: unknown): string => typeof s === 'string' ? s.trim() : ''
const sectionKeys: Record<string, [string, string, string][]> = {
  love: [['relationship','love_general','애정'],['relationship','contact_activation','연락 흐름'],['relationship','contact_continuity','대화의 지속'],...(['single','crush','flirting','ambiguous','couple','reunion_interest'].map((key,i)=>['relationship',`love_${key}`,['솔로 · 새 인연','짝사랑','썸','애매한 관계','연애 중','재회를 생각하는 경우'][i]] as [string,string,string]))],
  social: [['relationship','summary','대인관계'],['relationship','contact_activation','연락 흐름'],['relationship','contact_continuity','대화의 지속'],['money_news','news','공식 소식'],...(['friends','coworkers','family','new_people','boundaries'].map((key,i)=>['relationship',key,['친구 · 지인','직장동료','가족 · 가까운 사람','새 만남','관계의 경계'][i]] as [string,string,string]))],
  study: [['work_study','study','학업'],['work_study','exam','시험']],
  exam: [['work_study','exam','시험']],
  work: [['work_study','work','직장'],['work_study','career_change','이직']],
  'job-change': [['work_study','career_change','이직']],
  money: [['money_news','money','금전'],['investment','psychology','투자 판단'],['investment','realization','수익 실현'],['investment','entry','신규 진입']],
  investment: [['investment','psychology','투자 판단'],['investment','realization','수익 실현'],['investment','entry','신규 진입']],
  contact: [['relationship','contact_activation','연락'],['relationship','contact_continuity','대화의 지속'],['money_news','news','공식 소식']],
  condition: [['condition','condition','컨디션']],
}
function blocksFor(section: AiEditorialSection, prefix: string): DailyBlock[] {
  const applies = clean(section.applies_when)
  const reason = clean(section.evidence_meaning)
  const scene = clean(section.real_scene)
  const combined = [applies, reason].filter(Boolean).join(' ')
  return [
    {id:`${prefix}:applies-when`,label:'이럴 때 적용',text:applies},
    {id:`${prefix}:evidence-meaning`,label:'이렇게 읽는 이유',text:reason},
    {id:`${prefix}:scene`,label:'생활에서 보면',text:scene === combined ? '' : scene},
    {id:`${prefix}:action`,label:'지금 할 일',text:clean(section.action)},
    {id:`${prefix}:condition`,label:'다시 판단할 조건',text:clean(section.change_condition)},
  ].filter(block => block.text)
}

function sectionState(section: AiEditorialSection | undefined, delivery?: string): 'ready' | 'missing' | 'insufficient' {
  if (!section || delivery === 'omitted' || delivery === 'invalid') return 'missing'
  if (section.applicability === 'insufficient') return delivery === 'authored' ? 'insufficient' : 'missing'
  const scene = clean(section.real_scene) || (clean(section.applies_when) && clean(section.evidence_meaning))
  return scene && clean(section.conclusion) && clean(section.action) && section.evidence_refs?.length ? 'ready' : 'missing'
}

// Only verified provider fields enter the reading. The calculation and the reader's
// observed events are displayed independently and cannot supply missing prose.
export function buildDailyReadingDocument(data: Data, date: string, field?: FortuneField, verified = false): DailyReadingDocument {
  const doc: DailyReadingDocument = {version:'daily-document-v1',date,scope:field?.id ?? 'overall',title:field?.label ?? '일일 종합운세',state:verified?'missing':'unverified',headline:'',blocks:[],details:[]}
  if (!verified || !data) return doc
  if (field) {
    const topicForKey: Record<string,string> = {work:'직장',career_change:'이직',study:'학업',exam:'시험',news:'소식',psychology:'투자심리',realization:'수익실현',entry:'신규진입'}
    const clusters = data.clusters as unknown as Record<string,Record<string,AiEditorialSection>>
    const sections = (sectionKeys[field.id] ?? [])
      .filter(([,key]) => !topicForKey[key] || field.topics.includes(topicForKey[key]))
      .map(([group,key,label]) => {
        const id = `${group}.${key}`
        const section = clusters?.[group]?.[key]
        return {id,label,section,state:sectionState(section,data.editorial_delivery?.[id])}
      })
    doc.slots = sections.map(({id,label,state}) => ({id,label,state}))
    doc.details = sections.slice(1).filter(row => row.state === 'ready').flatMap(({id,label,section}) => [
      {id:`${id}:conclusion`,label,text:clean(section.conclusion)}, ...blocksFor(section,id),
    ])
    if (field.topics.includes('연락')) {
      for (const [key,label] of [
        ['incoming','연락을 받을 흐름'],['outgoing','내가 먼저 연락할 조건'],['reconnection','과거 인연과 다시 연락할 흐름'],
      ] as const) {
        if (key === 'reconnection' && !field.topics.includes('재회')) continue
        const text = clean(data.contact_flow?.[key])
        if (text) doc.details.push({id:`direction:${key}`,label,text})
      }
    }
    for (const answer of data.domain_answers ?? []) {
      if (field.topics.includes(answer.topic) && answer.status !== 'not_calculated' && answer.evidence_refs?.length && clean(answer.answer)) {
        doc.details.push({id:`question:${answer.topic}:${answer.question_key}`,label:answer.label,text:clean(answer.answer)})
      }
    }
    const primary = sections[0]
    if (!primary || primary.state !== 'ready') {
      if (primary?.state === 'insufficient') doc.state = 'insufficient'
      return doc
    }
    doc.headline = clean(primary.section.conclusion)
    doc.blocks = blocksFor(primary.section,primary.id)
  } else {
    const headline = clean(data.headline)
    const summary = clean(data.overall?.summary)
    if (!headline || !summary || !data.overall?.evidence_refs?.length) return doc
    doc.headline = headline
    if (summary !== headline) doc.blocks.push({id:'overall:summary',label:'오늘의 흐름',text:summary})
    if (clean(data.overall.dominant_pattern)) doc.blocks.push({id:'overall:reason',label:'이렇게 읽는 이유',text:clean(data.overall.dominant_pattern)})
    const decisions = data.decisions ?? []
    const decision = decisions.find(item => clean(item.action) && item.evidence_refs?.length)
    if (decision) {
      doc.blocks.push({id:'overall:action',label:'지금 할 일',text:clean(decision.action)})
      if (clean(decision.timing) && clean(decision.timing) !== date) doc.blocks.push({id:'overall:timing',label:'이 행동을 적용할 때',text:clean(decision.timing)})
      for (const [key,label] of [['watch','다시 판단할 조건'],['avoid','피할 것']] as const) {
        if (clean(decision[key])) doc.blocks.push({id:`overall:${key}`,label,text:clean(decision[key])})
      }
      if (clean(decision.reason)) doc.details.push({id:'decision:reason',label:'행동의 이유',text:clean(decision.reason)})
    }
    for (const [index,item] of decisions.entries()) {
      if (item === decision || !item.evidence_refs?.length) continue
      for (const [key,label] of [['action','함께 살필 행동'],['timing','적용 시기'],['reason','이유'],['watch','다시 판단할 조건'],['avoid','피할 것']] as const) {
        if (clean(item[key])) doc.details.push({id:`decision:${index}:${key}`,label,text:clean(item[key])})
      }
    }
    for (const [key,label] of [['best_phase','활용할 때'],['caution_phase','주의할 때']] as const) {
      const text = clean(data.overall[key])
      if (text) doc.details.push({id:`overall:${key}`,label,text})
    }
    for (const [key,label] of [['western','서양점성술에서 보면'],['saju','사주에서 보면'],['thai','태국점성술에서 보면']] as const) {
      const text = clean(data.systems?.[key])
      if (text) doc.details.push({id:`system:${key}`,label,text})
    }
    if (clean(data.limits)) doc.blocks.push({id:'limits',label:'함께 알아둘 점',text:clean(data.limits)})
  }
  doc.state = 'ready'
  return doc
}
