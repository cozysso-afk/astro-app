import type { AiEditorialSection, AiInterpretationResponse, IntegratedApiResponse } from '../appTypes'
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
export function buildDailyReadingDocument(data: Data, date: string, field?: FortuneField, verified = false, calculation?: IntegratedApiResponse): DailyReadingDocument {
  const doc: DailyReadingDocument = {version:'daily-document-v1',date,scope:field?.id ?? 'overall',title:field?.label ?? '일일 종합운세',state:verified?'missing':'unverified',headline:'',blocks:[],details:[]}
  if (!verified) return doc
  if (field) {
    const topicForKey: Record<string,string> = {work:'직장',career_change:'이직',study:'학업',exam:'시험',news:'소식',psychology:'투자심리',realization:'수익실현',entry:'신규진입'}
    const sections = (sectionKeys[field.id] ?? []).filter(([,k])=>!topicForKey[k] || field.topics.includes(topicForKey[k])).map(([g,k,label])=>({key:`${g}.${k}`,label,section:(data.clusters as unknown as Record<string,Record<string,AiEditorialSection>>)?.[g]?.[k]}))
    doc.slots=sections.map(s=>({id:s.key,label:s.label,state:ready(s.section)?'ready':s.section?.applicability==='insufficient'&&data.editorial_delivery?.[s.key]==='authored'?'insufficient':'missing'}))
    doc.details=sections.slice(1).filter(s=>ready(s.section)).flatMap(s=>[
      {id:`${s.key}:conclusion`,label:s.label,text:clean(s.section.conclusion)},...blocksFor(s.section,s.key),
    ])
    const loveStat = calculation?.western.overall?.['연애']
    if (field.id==='love' && loveStat?.band) {
      const scenarios = [
        ['single','새 인연','소개나 모임이 있다면 첫 대화가 편한지, 한 번 더 만날 의사가 양쪽에 있는지 살펴봐.'],
        ['crush','짝사랑','내가 관심을 표현한 뒤 상대도 질문을 건네거나 먼저 시간을 내는지가 확인할 점이야.'],
        ['flirting','썸','대화가 잘 통했던 날 이후에 실제로 다음 약속을 잡는지 봐.'],
        ['ambiguous','애매한 관계','만남이 이어져도 원하는 관계가 같은지는 별개야. 둘이 어느 정도의 연락과 만남을 원하는지 이야기해 봐.'],
        ['couple','연애 중','한쪽이 바쁜 날이라면 답장 속도로 마음을 짐작하기보다 함께 시간을 낼 수 있는 날을 정해 봐.'],
      ]
      for (const [key,label,application] of scenarios) {
        const slot=doc.slots.find(item=>item.id==='relationship.love_'+key)
        if (slot?.state!=='missing') continue
        doc.details.push({id:'application:'+key,label:label+' · 계산값 적용 예시',text:application})
        doc.slots=doc.slots.filter(item=>item!==slot)
      }
      if (doc.details.some(item=>item.id.startsWith('application:'))) {
        doc.details.unshift({id:'application:basis',label:'상황별로 읽는 기준',text:`이날 연애 지표는 ${loveStat.average}점(${loveStat.band})이야. 아래 예시는 같은 계산을 각 관계에 적용할 때 살펴볼 점이야.`})
      }
    }
    if (field.topics.includes('연락')) {
      for (const [key,label] of [['incoming','연락을 받을 흐름'],['outgoing','내가 먼저 연락할 조건'],['reconnection','과거 인연과 다시 연락할 흐름']] as const) {
        if (key === 'reconnection' && !field.topics.includes('재회')) continue
        const signals=calculation?.western.relationship_signals
        const stat=signals?.[{incoming:'수신신호',outgoing:'발신적합',reconnection:'과거인연접점'}[key]]
        const weak=stat?.band && /약|낮/.test(stat.band)
        const value = weak ? ({
          incoming:`수신 지표는 ${stat.band}이야. 먼저 연락이 올 것으로 기대할 만한 신호는 약해.`,
          outgoing:`발신 지표는 ${stat.band}이야. 먼저 말을 건다고 대화가 수월하게 이어질 것으로 보기는 어려워.`,
          reconnection:`재접점 지표는 ${stat.band}이야. 과거 인연과 다시 대화가 시작될 뚜렷한 신호는 없어.`,
        }[key]) : clean(data.contact_flow?.[key])
        if (value) doc.details.push({id:`direction:${key}`,label,text:value})
      }
    }
    const answers = (data.domain_answers ?? []).filter(a=>field.topics.includes(a.topic) && a.status !== 'not_calculated' && a.evidence_refs?.length && clean(a.answer))
    doc.details.push(...answers.map(a=>({id:`question:${a.topic}:${a.question_key}`,label:a.label,text:a.answer})))
    // The primary question must be answered; never promote a secondary subject.
    if (!ready(sections[0]?.section)) {
      if (sections[0]?.section?.applicability === 'insufficient' && data.editorial_delivery?.[sections[0].key] === 'authored') doc.state='insufficient'
      return doc
    }
    const fingerprint=(s:string)=>s.replace(/[\s.,!?·]/g,'')
    const primary=sections[0].section.conclusion
    if (clean(sections[0].section.real_scene).length>500 || sections[0].section.action.length>300 || sections[0].section.change_condition.length>300) {doc.state='needs_refresh';return doc}
    const peers=Object.values(data.clusters??{}).flatMap(group=>Object.values(group??{})).filter(s=>s && s!==sections[0].section && s.applicability!=='insufficient')
    if(primary.length>180 || fingerprint(primary)===fingerprint(data.overall?.summary??'') || peers.some(s=>fingerprint(clean(s.conclusion))===fingerprint(primary))) {doc.state='needs_refresh';return doc}
    doc.headline = clean(sections[0].section.conclusion)
    doc.blocks = blocksFor(sections[0].section,sections[0].key)
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
      const raw=clean(data.systems?.[key])
      if (!raw) continue
      let prose=raw
      if (calculation && key==='western' && /세부 조율의 긴장|긴장을 형성/.test(raw)) prose='여러 조건을 한꺼번에 맞추기 어려울 수 있다는 해석이야. 약속을 잡는다면 서로 같은 날짜와 시간을 생각하는지 확인해.'
      if (calculation && key==='saju' && /정인/.test(raw) && /충돌 요소/.test(raw)) prose='정인과 충을 따로 봐야 해. 정인은 익숙한 방식으로 상황을 이해하려는 쪽으로 읽고, 충은 그 방식과 다른 요구가 생겼을 때 어떻게 대응할지를 살펴보는 근거야.'
      if (calculation && key==='thai' && /황도 위치가 계산|위치가 계산되/.test(raw)) prose='이날의 행성 위치를 확인한 자료야. 위치만으로 연락이 오거나 약속이 잡힐지는 판단할 수 없어.'
      doc.details.push({id:`system:${key}`,label,text:prose})
    }
  }
  // The overall limit has no field scope: a money-specific caveat must not
  // become love, study or condition copy merely because it is globally present.
  if (!field && clean(data.limits)) doc.blocks.push({id:'limits',label:'함께 알아둘 점',text:clean(data.limits)})
  doc.state = 'ready'
  return doc
}
