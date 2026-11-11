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

type ReadingStrength = 'weak' | 'neutral' | 'strong'
function readingStrength(band: string): ReadingStrength {
  if (/약|낮|이하/.test(band)) return 'weak'
  if (/강|높|이상/.test(band)) return 'strong'
  return 'neutral'
}

const socialApplications: Record<string,Record<ReadingStrength,string>> = {
  friends: {
    weak:'친구들과 약속을 맞추기 어렵다면 꼭 만나고 싶은 날 하나만 제안해 봐. 답이 늦어도 사이가 멀어졌다고 해석할 필요는 없어.',
    neutral:'친구와 만날 계획이 있다면 서로 하고 싶은 일을 하나씩 골라 봐. 둘 다 시간을 낼 수 있는 약속부터 잡기 편해.',
    strong:'친구들과 함께할 일을 제안하기 좋은 쪽이야. 다 같이 좋아했던 활동을 꺼내고 참여할 사람의 의견을 들어 봐.',
  },
  coworkers: {
    weak:'동료에게 부탁할 일이 있다면 맡아 달라는 범위와 필요한 시점을 함께 알려 줘. 서로 다르게 이해한 부분을 일찍 찾을 수 있어.',
    neutral:'같이 맡은 일이 있다면 누가 무엇을 끝내면 다음 사람이 이어받는지 맞춰 봐. 역할을 확인하기 무난한 날이야.',
    strong:'함께 일할 사람과 의견을 모아 볼 만해. 합의가 됐다면 각자가 맡을 일까지 그 자리에서 정해 봐.',
  },
  family: {
    weak:'가까운 사람에게 부탁할 때는 이미 알고 있을 거라 여기기 쉬워. 무엇을 도와주면 좋겠는지 한 가지를 짚어 말해 봐.',
    neutral:'가족과 일정을 맞출 일이 있다면 서로 비워 둔 시간을 먼저 확인해. 원하는 일을 한쪽이 미리 정하지 않아도 돼.',
    strong:'가까운 사람과 함께 보내고 싶은 시간을 제안해 봐. 상대가 요즘 편하게 느끼는 방식도 물어보면 좋아.',
  },
  new_people: {
    weak:'낯선 자리라면 여러 사람과 깊게 친해지려 애쓰지 않아도 돼. 소개받은 사람 한 명에게 공통 관심사를 물어봐.',
    neutral:'처음 만난 사람과는 함께 있는 자리의 이야기부터 시작해 봐. 상대도 질문을 건네면 대화를 조금 더 이어갈 수 있어.',
    strong:'새로운 사람과 말을 나눌 여지가 있는 날이야. 공통으로 즐긴 주제가 있다면 다음에 함께할 일을 가볍게 제안해 봐.',
  },
  boundaries: {
    weak:'다른 사람의 부탁을 받았을 때 부담이 크다면 지금 가능한 범위를 먼저 알려 줘. 바로 답하기 어려우면 확인할 시간을 정해.',
    neutral:'새 약속이나 부탁을 받으면 이미 잡힌 일정부터 살펴봐. 어디까지 시간을 쓸 수 있는지 말해 두면 기대를 맞추기 쉬워.',
    strong:'의견을 나누기 좋은 날에도 모든 부탁을 받아야 하는 건 아니야. 함께 하고 싶은 일과 네가 맡을 수 있는 범위를 같이 알려 줘.',
  },
}

const scenarioReadings: Record<string, Record<ReadingStrength, string>> = {
  single: {
    weak: '새 사람을 만나는 데 탄력이 작은 날이야. 소개를 받는다면 첫 자리에서 결론을 내리기보다 함께 이야기하기 편한 주제가 있었는지 돌아봐.',
    neutral: '아직 마음에 둔 사람이 없다면, 낯선 자리에서도 네 취향을 편하게 말할 수 있는 사람에게 눈을 돌려 봐. 대화가 잠시 끊겼을 때도 궁금한 게 남는다면 첫인상 너머로 더 알아보고 싶은 사람이야.',
    strong: '새 사람에게 먼저 관심을 표현해 볼 만한 날이야. 소개를 받는다면 상대에게 잘 보이려고 취향을 맞추기보다 요즘 네가 즐기는 일을 들려줘. 어떤 이야기에 둘 다 신이 나는지 알아볼 수 있어.',
  },
  crush: {
    weak: '호감이 서로 통하는지 읽기 어려운 날이야. 친절한 답 하나에 의미를 싣기보다 상대도 네게 궁금한 걸 묻는지 살펴봐.',
    neutral: '내가 좋아하는 마음과 상대가 보인 관심을 구분해 봐. 말을 걸었을 때 상대도 질문하거나 먼저 이야기를 꺼낸다면 대화를 조금 더 이어갈 수 있어.',
    strong: '호감을 표현해 볼 여지가 있는 날이야. 좋아했던 대화나 장면을 하나 짚어 말하고, 상대도 그 이야기를 이어가고 싶어 하는지 들어 봐.',
  },
  flirting: {
    weak: '서로 알아가는 중이라면 다음 단계로 서두를 힘은 약해. 제안한 날이 어렵다는 답이 왔다면 상대도 다른 날을 제안하는지 보고 일정을 잡아.',
    neutral: '즐거웠던 만남을 다음 약속으로 이어갈지가 관건이야. 가능한 날을 하나 건네고 둘이 실제로 시간을 맞추는지 봐.',
    strong: '함께 보내는 시간을 한 번 더 만들어 볼 만해. 지난번에 둘 다 좋아했던 일을 꺼내고 다음에 만날 장소나 날짜를 같이 골라 봐.',
  },
  ambiguous: {
    weak: '관계를 정리할 실마리가 쉽게 보이지 않는 날이야. 연락이 뜸해졌다면 그 이유를 추측하기 전에 너에게 필요한 만남의 빈도부터 생각해 봐.',
    neutral: '만남은 계속돼도 두 사람이 원하는 관계는 다를 수 있어. 다음에 만났을 때 어떤 사이로 지내고 싶은지 네 생각을 말하고 상대의 답도 들어 봐.',
    strong: '관계를 어떻게 이어갈지 이야기할 여지가 있는 날이야. 둘만 만나는 사이를 원하는지처럼 중요한 기대 하나를 구체적으로 꺼내 봐.',
  },
  couple: {
    weak: '작은 서운함이 있을 때 평소처럼 금방 풀릴 거라고 기대하기 어려운 날이야. 가장 마음에 남은 장면 하나와 다음에 바라는 행동 하나를 이야기해 봐.',
    neutral: '평소 관계를 돌보는 데 무리가 크지 않은 날이야. 한쪽이 바쁘다면 짧은 답장의 뜻을 추측하기보다 둘 다 편한 시간을 정해 이야기를 나눠.',
    strong: '연인에게 평소에 당연하게 받아들였던 수고를 알아봤다고 전해 볼 만한 날이야. 어떤 행동 덕분에 네 마음이 놓였는지 짚어주면 그 사람도 네가 사랑받는다고 느끼는 순간을 알아.',
  },
}
// When the saved manuscript omits a situation, relate the day's love reading
// to the independent signal that actually bears on the reader's decision.
const scenarioSignals: Record<string, { signal: string; label: string; meaning: Record<ReadingStrength,string> }> = {
  single: {signal:'발신적합',label:'먼저 말 걸기',meaning:{
    weak:'인사를 나눈 뒤 막상 할 말이 없다면 억지로 호감을 표시하지 않아도 돼.',
    neutral:'말문이 막히면 그 자리에서 상대가 골랐던 음식이나 음악처럼 바로 떠올릴 수 있는 걸 물어봐.',
    strong:'소개를 받아 보고 싶었다면 친구에게 어떤 사람과 대화가 잘 통하는지 알려 주기 편한 날이야.'}},
  crush: {signal:'수신신호',label:'연락 받기',meaning:{
    weak:'상대의 선연락을 기다리는 방식으로 호감을 가늠하기 어려운 날이야. 이미 대화가 있다면 그 안에서 상대가 먼저 물어온 게 있었는지 봐.',
    neutral:'연락이 먼저 오는지만으로 마음을 읽기 어려워. 답을 주고받을 때 상대도 네 일상을 궁금해하는지 봐.',
    strong:'상대에게서 소식이 오면 내용에 주목해 봐. 필요한 답만 보낸 건지, 용건이 끝난 뒤에도 네 이야기를 물었는지에 따라 뜻이 달라.'}},
  flirting: {signal:'발신적합',label:'먼저 제안하기',meaning:{
    weak:'먼저 제안을 건넸다면 답을 재촉하기보다 상대에게도 가능한 날을 꺼낼 차례를 줘.',
    neutral:'약속이 막연하게 끝났다면 가능한 날을 하나만 보내 봐. 상대가 함께 시간을 맞추는지 확인하기 쉬워.',
    strong:'다음 만남은 네가 먼저 제안하기 편한 날이야. 상대가 장소나 날짜를 보태면 둘이 정한 약속으로 이어갈 수 있어.'}},
  ambiguous: {signal:'수신신호',label:'연락 받기',meaning:{
    weak:'상대의 연락이 뜸해도 그 하루를 관계에 대한 대답으로 삼기는 어려워. 다음에 이야기할 때 네가 궁금했던 점을 직접 물어봐.',
    neutral:'먼저 연락이 오느냐만으로 두 사람이 어떤 사이인지 정하기는 어려워. 다음 만남을 바라는지 서로 말할 때 더 분명해져.',
    strong:'안부가 먼저 와도 둘이 같은 관계를 원한다는 뜻까지 담긴 건 아니야. 네가 궁금한 게 서로에게만 집중할 의사라면 그 질문을 그대로 꺼내 봐.'}},
  couple: {signal:'발신적합',label:'대화 시작하기',meaning:{
    weak:'민감한 이야기는 긴 메시지로 한꺼번에 꺼내기보다, 둘 다 이야기할 수 있는 시간을 먼저 잡아 봐.',
    neutral:'고마운 일과 서운한 일이 한꺼번에 떠오른다면 오늘 꼭 전하고 싶은 쪽을 먼저 말해. 두 이야기를 섞으면 상대가 어느 말에 답해야 할지 헷갈릴 수 있어.',
    strong:'고마웠거나 서운했던 일을 네가 먼저 꺼내기 편한 쪽이야. 구체적인 장면 하나를 이야기하면 상대도 자기 입장을 설명하기 쉬워.'}},
}

const directionReadings = {
  incoming: {
    weak: '먼저 연락이 올 거라고 기대할 근거는 약해. 기다리던 답이 늦어도 그 사실만으로 상대 마음을 판단하기는 어려워.',
    neutral: '먼저 연락이 올지 한쪽으로 기울여 읽기 어려워. 이미 답을 기다리는 일이 있다면 정해 둔 회신 시점부터 살펴봐.',
    strong: '외부에서 들어오는 연락에 주목할 만해. 실제로 메시지가 오면 안부인지 구체적인 제안인지 내용부터 살펴봐.',
  },
  outgoing: {
    weak: '먼저 말을 건 뒤 대화가 쉽게 이어질 조건은 약해. 전할 용건이 있다면 질문 하나로 간단히 보내고 답할 여유를 줘.',
    neutral: '먼저 건네고 싶은 말이 있다면 구체적인 용건으로 시작해 봐. 이후 대화 속도는 실제 답을 보고 정해.',
    strong: '네가 먼저 대화를 꺼내기 좋은 쪽이야. 같이 이야기했던 주제로 말을 건네거나 가능한 만남 날짜를 제안해 봐.',
  },
  reconnection: {
    weak: '지난 인연과 접촉이 다시 시작될 근거는 약해. 이미 연락이 닿았다면 상대도 다시 만날 의사를 보였는지 따로 살펴봐.',
    neutral: '지난 인연과 다시 연락할 흐름은 중간 정도야. 안부가 오갔다면 대화를 조금 더 이어갈 의사가 양쪽에 있는지 봐.',
    strong: '지난 인연과 다시 이야기를 나눌 계기를 살펴볼 만해. 관계를 다시 시작할 뜻이 있는지는 두 사람이 직접 이야기해야 알 수 있어.',
  },
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
    if (field.id==='social' && calculation?.period?.start===date && calculation.period.end===date) {
      const stat=calculation.western.overall?.['대인관계']
      if (stat?.band && Number.isFinite(stat.average)) {
        const strength=readingStrength(stat.band)
        for (const [key,reading] of Object.entries(socialApplications)) {
          const slotId='relationship.'+key
          const slot=doc.slots.find(item=>item.id===slotId)
          if (slot?.state!=='missing') continue
          doc.details.push({id:'social-application:'+key,label:slot.label+' · 계산값 적용',text:reading[strength]})
          doc.slots=doc.slots.filter(item=>item.id!==slotId)
        }
        if (doc.details.some(item=>item.id.startsWith('social-application:'))) {
          doc.details.unshift({id:'social-calculation',label:'상황별 해설의 근거',text:`${date}의 서양점성술 대인관계 지표는 ${stat.average}점(${stat.band})이야. 기존 원고에 빠진 질문은 이 공통 지표를 상황별로 적용해 풀었어.`})
        }
      }
    }
    const loveStat = calculation?.western.overall?.['연애']
    if (field.id==='love' && loveStat?.band) {
      const strength = readingStrength(loveStat.band)
      for (const [key, reading] of Object.entries(scenarioReadings)) {
        const slotId = 'relationship.love_' + key
        const slot = doc.slots.find(item => item.id === slotId)
        if (slot?.state !== 'missing') continue
        const context = scenarioSignals[key]
        const stat = calculation?.western.relationship_signals?.[context.signal]
        const text = stat?.band && Number.isFinite(stat.average)
          ? `${reading[strength]} 이날 ‘${context.label}’ 지표는 ${stat.average}점(${stat.band})이야. ${context.meaning[readingStrength(stat.band)]}`
          : reading[strength]
        doc.details.push({id:'application:'+key,label:'이날의 연애 지표를 적용하면',text})
        doc.slots = doc.slots.filter(item => item.id !== slotId)
      }
      if (doc.details.some(item => item.id.startsWith('application:'))) {
        doc.details.unshift({id:'application:basis',label:'상황별로 읽는 기준',text:`서양점성술의 연애 지표는 ${loveStat.average}점(${loveStat.band})이야. 아래에서 네 상황을 골라 봐.`})
      }
    }
    // A scored re-contact signal can answer a narrower question than reconciliation.
    // Keep a delivered "insufficient" judgement and any original manuscript intact.
    const reunionSlot = doc.slots.find(slot=>slot.id==='relationship.love_reunion_interest')
    const signals = calculation?.western.relationship_signals
    const reconnection = signals?.['과거인연접점'] ?? signals?.['과거인연재접점']
    if (reunionSlot?.state==='missing' && reconnection?.band && Number.isFinite(reconnection.average)) {
      const context = {
        weak:'아직 연락이 끊긴 사이라면 먼저 소식이 닿으리라고 읽을 근거가 적어.',
        neutral:'연락이 다시 닿을 여지는 열려 있지만 누가 먼저 움직일지는 드러나지 않아.',
        strong:'지난 인연과 다시 말이 오갈 계기에 눈길이 가는 날이야.',
      }[readingStrength(reconnection.band)]
      doc.details.push({id:reunionSlot.id+':calculated', label:'재접촉 계산값으로 본 재회',text:`이날 과거 인연 접점은 ${reconnection.average}점(${reconnection.band})이야. ${context} 이미 다시 만났다면 접촉은 이뤄진 거야. 그때 멀어졌던 이유를 서로 말할 수 있었는지, 같은 상황이 돌아오면 이번엔 어떻게 하겠다고 했는지가 관계를 다시 시작할 단서야.`})
      reunionSlot.state='ready'
    }
    if (field.topics.includes('연락')) {
      const signals = calculation?.western.relationship_signals
      for (const [key,label,signal] of [
        ['incoming','연락을 받을 흐름','수신신호'],
        ['outgoing','내가 먼저 연락할 조건','발신적합'],
        ['reconnection','과거 인연과 다시 연락할 흐름','과거인연접점'],
      ] as const) {
        if (key === 'reconnection' && !field.topics.includes('재회')) continue
        const stat = signals?.[signal] ?? (key === 'reconnection' ? signals?.['과거인연재접점'] : undefined)
        let value = clean(data.contact_flow?.[key])
        if (stat?.band) {
          const score = Number.isFinite(stat.average) ? `${stat.average}점 · ` : ''
          value = `${score}${stat.band}. ${directionReadings[key][readingStrength(stat.band)]}`
        }
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
    if (field.id==='love' && calculation) {
      const values=calculation.western.overall
      const scores=['연애','연락','재회'].flatMap(name=>{const stat=values?.[name];return stat && Number.isFinite(stat.average)?[`${name} ${stat.average}점(${stat.band})`]:[]})
      if (scores.length) doc.blocks.unshift({id:'love:calculated',label:'이날의 관계 지표',text:scores.join(' · ')})
    }
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
      if (calculation && key==='western' && /세부 조율의 긴장|긴장을 형성/.test(raw)) prose='약속이나 요청을 주고받을 때 같은 말을 서로 다르게 이해할 수 있다는 해석이야. 시간이나 조건을 한 번 더 짚어 보는 게 좋아.'
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
