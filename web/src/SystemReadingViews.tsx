import type { LoveStatus } from './lib/loveReadingContext'
import type { FortuneField } from './lib/fortuneFields'
import { Children, Fragment, useEffect, useState, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { Orbit, Columns3, Sparkles, Layers3, Copy } from 'lucide-react'
import type { IntegratedApiResponse, FortuneStat } from './appTypes'
import { lensForTopic, thaiPlacementComparison, thaiPlanetLabel, thaiLifeSummary, thaiPeriodLabel, buildSystemReading, BHUMI_LENSES, tenGodLens, ganzhiWithReading, SAJU_LIFE_KEYS, THAI_LIFE_KEYS, compactSystemPrompt, type LifeTopic, type SystemId, type Lens } from './lib/systemReading'
import { ReadingExplanation } from './ReadingExplanation'

const SYSTEMS = [{id:'integrated',label:'통합',Icon:Layers3},{id:'western',label:'서양점성술',Icon:Orbit},{id:'saju',label:'사주',Icon:Columns3},{id:'thai',label:'태국점성술',Icon:Sparkles}] as const

type ReadingChildContext = { field?: FortuneField; systemOverview?: ReactNode; systemSummary?: string; westernOnly?: boolean; technicalDetails?: ReactNode }
function injectReadingContext(children: ReactNode, props: ReadingChildContext): ReactNode {
  return Children.map(children, child => {
    if (!isValidElement(child)) return child
    const element = child as ReactElement<{children?:ReactNode} & ReadingChildContext>
    if (child.type === Fragment || typeof child.type === 'string') {
      if (element.props.children == null) return child
      return cloneElement(element, {}, injectReadingContext(element.props.children, props))
    }
    return cloneElement(element, props)
  })
}
const TOPICS: LifeTopic[] = ['전체','애정','대인','학업','직업','금전','컨디션']
const WESTERN: Record<LifeTopic,string[]> = {전체:[],애정:['연애','연락','재회'],대인:['대인관계','소식'],학업:['학업','시험'],직업:['직장','이직'],금전:['금전','투자심리','수익실현','신규진입','투자주의'],컨디션:['컨디션']}
const WESTERN_FLOW_COPY: Record<string,[string,string]> = {
  금전:['수입·지출 계획을 정리하고 예산 안에서 움직여.','예상 밖 지출에 여유를 두고 꼭 필요한 돈부터 챙겨.'],
  학업:['공부할 분량을 정하고, 끝낸 뒤 틀린 부분을 바로 표시해.','새 진도보다 복습부터 잡고 목표를 작게 나눠.'],
  시험:['배운 내용을 꺼내 쓰는 연습과 실수 점검을 같이 해.','새 내용을 늘리기보다 자주 틀리는 부분부터 확인해.'],
  직장:['업무 요청과 협의는 일정과 책임 범위를 분명히 해.','일정과 책임 범위가 모호하면 바로 확정하지 말고 다시 맞춰.'],
  이직:['직무·보상·시작 일정처럼 비교할 조건을 적고, 확인되지 않은 항목부터 물어봐.','조건이 불분명하면 결정을 서두르지 말고 확인부터 해.'],
  대인관계:['대화와 조율은 상대의 반응을 보면서 이어가.','의견 차이를 급히 결론 내지 말고 사실관계부터 맞춰.'],
  연애:['호감과 만남은 상대의 실제 반응을 보면서 이어가.','관계 진전을 서두르기보다 서로 원하는 속도를 확인해.'],
  연락:['안부·질문·약속처럼 목적이 분명한 연락이 나아.','먼저 연락한다면 짧고 구체적으로 하고 답을 재촉하지 마.'],
  재회:['관계 회복 여지는 실제 연락과 이후 태도로 확인해.','추억과 지금의 행동을 구분하고 관계 회복을 미리 단정하지 마.'],
  소식:['새 소식과 제안은 원문과 조건을 확인해.','전해 들은 말만으로 결론 내리지 말고 출처부터 확인해.'],
  컨디션:['일정 사이에 쉴 틈을 남기면서 움직여.','무리해서 끌고 가기보다 쉬는 시간을 먼저 확보해.'],
  투자심리:['관심이 커져도 매수 근거와 감정은 따로 확인해.','불안이나 조급함 때문에 기준을 바꾸지 마.'],
  수익실현:['청산 조건과 목표를 점검해. 수익을 보장하는 신호는 아니야.','목표와 손실 한도를 먼저 확인하고 급한 결정을 피해야 해.'],
  신규진입:['진입 조건을 비교해. 매수 권유를 뜻하는 점수는 아니야.','급하게 들어가기보다 조건과 손실 한도를 먼저 점검해.'],
  투자주의:['뚜렷한 경계가 적어도 안전을 뜻하진 않아.','위험 노출과 손실 한도를 우선 점검해야 해.'],
}
const WESTERN_HEADLINE_LABEL: Record<string,string> = {
  금전:'금전 관리',학업:'학업',시험:'시험 준비',직장:'직장 업무',이직:'이직 조건',대인관계:'대인관계',연애:'연애 흐름',연락:'연락 흐름',재회:'재회 흐름',소식:'소식 확인',컨디션:'컨디션',투자심리:'투자 판단',수익실현:'수익 실현 조건',신규진입:'신규 진입 조건',투자주의:'위험 관리',
}
const WESTERN_OVERVIEW_GROUPS = [
  ['금전','투자심리','수익실현','신규진입','투자주의'],
  ['학업','시험'],
  ['직장','이직'],
  ['대인관계','소식'],
  ['연애','연락','재회'],
  ['컨디션'],
]
const SAJU_LEAD_COPY: Record<string,string> = {
  관성:'먼저 맡은 일의 완료 기준과 기한을 적어. 책임 범위가 모호한 요청은 조건부터 맞춰.',
  인성:'새 자료를 늘리기보다 이미 배운 내용을 한 번 설명해봐. 막히는 부분만 다시 확인해.',
  재성:'예상 수입보다 지금 확실한 예산·고정지출·쓸 수 있는 시간을 먼저 적어. 남는 범위 안에서 우선순위를 정해.',
  식상:'전하려는 내용을 짧은 제안이나 작은 결과물로 보여줘. 상대가 어떻게 이해했는지 실제 반응을 확인해.',
  비겁:'함께 하는 일은 내 몫과 상대 몫을 나눠 적어. 양보할 부분과 지킬 기준을 먼저 정해.',
}
const SAJU_SECONDARY_COPY: Record<string,string> = {
  관성:'마감일과 책임 범위',
  인성:'이해가 막히는 부분',
  재성:'예산과 고정 의무',
  식상:'표현 뒤 실제 반응',
  비겁:'역할 분담과 경계',
}
function sajuLeadSentence(lens:Lens) {
  const lead = SAJU_LEAD_COPY[lens.key] ?? lens.action
  return lead.match(/^[^.!?]+[.!?]?/)?.[0]?.trim() || lead
}
function sajuOverviewText(lenses:Lens[], fallback:string) {
  if (!lenses.length) return fallback
  const concise = sajuLeadSentence(lenses[0])
  const secondary = lenses[1] ? SAJU_SECONDARY_COPY[lenses[1].key] : ''
  return `${concise}${secondary ? ` 이어서 ${secondary}도 확인해.` : ''}`
}
function westernCaution(name:string, stat:FortuneStat) {
  if (name === '투자주의') return stat.average >= 60 || /강|높/.test(String(stat.band ?? ''))
  return stat.average < 40 || /약|낮/.test(String(stat.band ?? ''))
}
function westernGuidance(name:string, stat:FortuneStat) {
  const pair = WESTERN_FLOW_COPY[name] ?? ['결정 전에 확인할 조건을 적고, 비어 있는 항목부터 채워.','확인되지 않은 조건이 있으면 결정을 미루고 사실부터 확인해.']
  return pair[westernCaution(name,stat) ? 1 : 0]
}
function westernWhen(dayCount:number) {
  if (dayCount <= 1) return '오늘'
  if (dayCount <= 9) return '이번 주'
  if (dayCount <= 45) return '이번 달'
  return '올해'
}
function periodReadingFrame(when:string) {
  return koreanParticle(when,'은는')
}
function thaiPeriodOverview(when:string) {
  if (when==='오늘') return '오늘은 부탁을 받을 때 내가 맡을 범위부터 정하고, 일정 사이에 쉴 시간을 먼저 확보해. 돈·시간을 쓰는 일은 남은 여유를 확인한 뒤 결정해.'
  if (when==='이번 주') return '이번 주는 반복되는 부탁 중 내가 맡을 것과 넘길 것을 나누고, 수면·회복 시간을 일정에 먼저 넣어. 돈·시간은 며칠 동안 누적해서 얼마나 썼는지 확인해.'
  if (when==='이번 달') return '이번 달은 부탁과 책임이 한쪽에 몰리는지, 쉬는 시간이 실제로 지켜지는지, 돈·시간 사용이 계획 안에 있는지 주마다 확인해.'
  return '올해는 사람 관계의 책임을 한쪽에 몰지 말고, 쉬는 시간·내가 결정할 범위·돈과 시간을 장기 계획으로 나눠 관리해.'
}
function koreanParticle(text:string, pair:'은는'|'이가') {
  const clean = String(text ?? '').trim()
  const last = clean.charAt(clean.length - 1)
  const code = last.charCodeAt(0)
  const hasFinal = code >= 0xAC00 && code <= 0xD7A3 && (code - 0xAC00) % 28 !== 0
  return `${clean}${pair === '은는' ? (hasFinal ? '은' : '는') : (hasFinal ? '이' : '가')}`
}
function westernHeadline(rows:Array<[string,FortuneStat]>, when:string) {
  const readable = rows.filter(([name])=>name!=='투자주의')
  if (!readable.length) return `${koreanParticle(when,'은는')} 비교할 수 있는 서양점성술 분야 점수가 없어.`
  const strongest = readable.slice().sort((a,b)=>b[1].average-a[1].average)[0]
  const weakest = readable.slice().sort((a,b)=>a[1].average-b[1].average)[0]
  const strongLabel = WESTERN_HEADLINE_LABEL[strongest[0]] ?? strongest[0]
  const weakLabel = WESTERN_HEADLINE_LABEL[weakest[0]] ?? weakest[0]
  if (weakest[0]!==strongest[0] && strongest[1].average-weakest[1].average>=8) {
    return `${koreanParticle(when,'은는')} ${koreanParticle(strongLabel,'이가')} 점수가 가장 높아. ${westernGuidance(strongest[0],strongest[1])} ${koreanParticle(weakLabel,'은는')} 점수가 가장 낮으니 ${westernGuidance(weakest[0],weakest[1])}`
  }
  return `${koreanParticle(when,'은는')} 분야별 점수 차이가 크지 않아. ${strongLabel}에서는 ${westernGuidance(strongest[0],strongest[1])}`
}
function westernOverviewText(rows:Array<[string,FortuneStat]>, when:string) {
  const readable = rows.filter(([name])=>name!=='투자주의')
  if (!readable.length) return '이 분야의 서양점성술 계산값이 충분하지 않아.'
  const strongest = readable.slice().sort((a,b)=>b[1].average-a[1].average)[0]
  const weakest = readable.slice().sort((a,b)=>a[1].average-b[1].average)[0]
  const strongLabel = WESTERN_HEADLINE_LABEL[strongest[0]]??strongest[0]
  const weakLabel = WESTERN_HEADLINE_LABEL[weakest[0]]??weakest[0]
  if (strongest[0]===weakest[0]) return `${koreanParticle(when,'은는')} ${strongLabel}을 중심으로 봐. ${westernGuidance(strongest[0],strongest[1])}`
  return `${koreanParticle(when,'은는')} ${koreanParticle(strongLabel,'이가')} 점수가 가장 높고, ${koreanParticle(weakLabel,'은는')} 가장 낮아. ${westernGuidance(weakest[0],weakest[1])}`
}
function representativeWesternRows(rows:Array<[string,FortuneStat]>) {
  const picked:Array<[string,FortuneStat]> = []
  for (const group of WESTERN_OVERVIEW_GROUPS) {
    const candidates = rows.filter(([name])=>group.includes(name))
    if (!candidates.length) continue
    candidates.sort((a,b)=>Math.abs(b[1].average-50)-Math.abs(a[1].average-50))
    picked.push(candidates[0])
  }
  return picked
}
function sajuHeadline(lenses:Lens[], when:string) {
  if (!lenses.length) return `${koreanParticle(when,'은는')} 바로 생활 조언으로 연결할 만큼 뚜렷한 사주 주제가 적어. 아래 계산 근거에서 적용 구간만 확인해줘.`
  const lead = sajuLeadSentence(lenses[0])
  const secondary = lenses[1] ? SAJU_SECONDARY_COPY[lenses[1].key] : ''
  return `${periodReadingFrame(when)} ${lead}${secondary ? ` 이어서 ${secondary}도 확인해.` : ''}`
}
function LensCard({lens,evidence}:{lens:Lens;evidence:string}) { return <article className="system-lens saju-lens-card"><h4>{lens.title}</h4><p className="system-lens-meaning">{lens.meaning}</p><ReadingExplanation kind="practice">{lens.action}</ReadingExplanation><p className="system-lens-evidence"><b>근거</b><span>{evidence || '연결된 운 구간 근거가 없어.'}</span></p><details className="system-lens-limit"><summary>해석 범위</summary><p>{lens.limit}</p></details></article> }
function shortKoreanDate(value?: string) {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${Number(match[2])}월 ${Number(match[3])}일` : String(value ?? '')
}
function sajuSegmentHint(selectedStart:string, selectedEnd:string) {
  return selectedStart===selectedEnd ? `${shortKoreanDate(selectedStart)} 적용` : '선택 기간에 적용'
}
function BoundedCopy({packet}:{packet:Record<string,unknown>}) {
  const [notice,setNotice] = useState('')
  async function copy() {
    let text: string
    try {text=compactSystemPrompt(packet)} catch(error){setNotice(error instanceof Error?error.message:'프롬프트 생성 실패');return}
    try {await navigator.clipboard.writeText(text);setNotice(`심층 프롬프트 복사 완료 · ${text.length.toLocaleString()}자`)} catch {setNotice('복사하지 못했어. 브라우저의 클립보드 권한을 확인해줘.')}
  }
  return <div className="system-copy"><button type="button" onClick={copy}><Copy size={16}/>선택 체계 심층 프롬프트 복사</button><small>현재 체계의 계산 근거만 · 최대 7,500자</small><p role="status">{notice}</p></div>
}
export function SystemReadingViews({calculation:c,children,field,loveStatus,initialSystem='integrated'}:{calculation:IntegratedApiResponse;children:ReactNode;field?:FortuneField;loveStatus?:LoveStatus;initialSystem?:SystemId}) {
  const [system,setSystem] = useState<SystemId>(initialSystem)
  const [topic,setTopic] = useState<LifeTopic>(field?.lens ?? '전체')
  const [wheelIndex,setWheelIndex] = useState(0)
  useEffect(()=>{setSystem(initialSystem);setTopic(field?.lens ?? '전체')},[initialSystem,field?.lens])
  const view=buildSystemReading(c)
  const wheel = wheelIndex<0 ? view.natalWheel : view.wheels[wheelIndex]?.wheel ?? []
  const activeWheel = wheel.length ? wheel : view.wheels[0]?.wheel ?? view.natalWheel
  const available = (t:LifeTopic) => t==='전체' || system==='western' || system==='integrated' ? true : system==='saju' ? SAJU_LIFE_KEYS[t].length>0 : activeWheel.some(r=>THAI_LIFE_KEYS[t].includes(r.bhumi_key))
  const selectedWestern = Object.entries(c.western.overall ?? {}).filter((row): row is [string, FortuneStat] => row[1] !== null).filter(([name])=>field?field.topics.includes(name):topic==='전체'||WESTERN[topic].includes(name))
  const selectedLenses=view.lenses.filter(l=>SAJU_LIFE_KEYS[topic].includes(l.key)).map(l=>lensForTopic(l,topic))
  const selectedBhumi=activeWheel.filter(r=>THAI_LIFE_KEYS[topic].includes(r.bhumi_key))
  const thaiReaderSummary = topic==='전체'
    ? thaiPeriodOverview(westernWhen(c.period.day_count))
    : selectedBhumi.length ? thaiLifeSummary(selectedBhumi.map(r=>r.bhumi_key)) : '이 분야와 연결된 생활 영역 자료가 없어.'
  const period = `${c.period.start}${c.period.end!==c.period.start?` — ${c.period.end}`:''}`
  const westernPeriod = westernWhen(c.period.day_count)
  const westernReaderHeadline = westernHeadline(selectedWestern,westernPeriod)
  const westernOverviewSummary = westernOverviewText(selectedWestern,westernPeriod)
  const westernDisplayRows = field || topic!=='전체' ? selectedWestern : representativeWesternRows(selectedWestern)
  const sajuPeriod = westernWhen(c.period.day_count)
  const sajuReaderHeadline = sajuHeadline(selectedLenses,sajuPeriod)
  const sajuOverviewSummary = topic==='전체'
    ? sajuOverviewText(view.lenses, view.sajuSummary)
    : sajuOverviewText(selectedLenses, '이번 기간의 사주 흐름은 계산됐지만, 이 분야까지 바로 연결할 근거는 부족해. 사주 탭에서 적용된 운 구간을 확인해줘.')
  const focusedField = field ?? (topic==='전체' ? undefined : {id:topic,label:topic+'운',desc:'선택 분야',topics:WESTERN[topic],lens:topic})
  const overview = <section className="system-overview"><h3>세 체계 한눈에</h3><div className="system-overview-grid">
        <article className="system-western"><strong><Orbit size={16}/>서양점성술</strong><p>{westernOverviewSummary}</p><small>점수는 사건 확률이 아니라 같은 기간 안에서의 상대적 강약이야.</small></article>
        {view.saju&&view.contexts.length ? <article className="system-saju"><strong><Columns3 size={16}/>사주</strong><p>{sajuOverviewSummary}</p><small>간지·십성은 사주 탭의 계산 근거에서 따로 확인할 수 있어.</small></article>:<p className="system-unavailable">사주 · 현재 정밀도 또는 기간 근거로는 해석할 수 없어.</p>}
        {view.thai&&(view.natalWheel.length||view.wheels.length)>0 ? <article className="system-thai"><strong><Sparkles size={16}/>태국점성술</strong><p>{thaiReaderSummary}</p><small>행성 이름과 배치는 태국점성술 탭의 계산 상세에서 확인해.</small></article>:<p className="system-unavailable">태국점성술 · 현재 정밀도 또는 사용 가능한 배치가 부족해.</p>}
      </div><details className="system-synthesis"><summary>세 체계에서 지금 확인할 것</summary><p><b>서양점성술</b> · {westernOverviewSummary}</p>{view.saju&&view.contexts.length&&<p><b>사주</b> · {sajuOverviewSummary}</p>}{view.thai&&(view.natalWheel.length||view.wheels.length)>0&&<p><b>태국점성술</b> · {thaiReaderSummary}</p>}<small>세 체계의 수치나 기준은 합산하지 않고 각각의 계산 근거로 확인해.</small></details></section>
  return <section className={`system-reading system-${system}`}>
    <span className="reading-period-date">{period}</span>
    <div className="system-switcher" role="group" aria-label="해석 체계 선택">{SYSTEMS.map(({id,label,Icon})=><button type="button" aria-pressed={system===id} key={id} onClick={()=>{setSystem(id);setTopic(field?.lens ?? '전체')}}><Icon size={18} aria-hidden="true"/><span>{label}</span></button>)}</div>
    {!field&&<div className="system-topic-selector system-topic-selector-fixed" role="group" aria-label="생활 분야 선택">{TOPICS.map(t=><button type="button" key={t} disabled={!available(t)} title={!available(t)?(system==='saju'&&SAJU_LIFE_KEYS[t].length===0?'현재 계산 자료만으로는 이 분야를 직접 설명할 근거가 부족해':'이 체계에서 연결된 근거가 부족해'):undefined} aria-pressed={topic===t} onClick={()=>setTopic(t)}>{t}</button>)}</div>}
    {field&&<h3>{field.label} · {period}</h3>}
    {system==='integrated' ? <>
      {injectReadingContext(children,{field:focusedField,systemOverview:overview})}
    </> : system==='western' ? <>
      <header className="system-hero western-reader-hero"><span>서양점성술 · {westernPeriod}</span><h3>{westernReaderHeadline}</h3><p>점수는 사건 확률이 아니야. 특히 연락·재회·투자 관련 값은 실제 행동이나 수익을 보장하지 않으니 조건과 위험을 같이 확인해.</p></header>
      {!field&&topic==='전체'&&<p className="western-score-overview-note">전체에서는 대표 흐름 6개만 먼저 보여줘. 더 세부적인 값은 위의 애정·대인·학업·직업·금전 탭에서 확인해.</p>}
      <div className="system-score-grid western-score-grid">{westernDisplayRows.map(([name,s])=><details className="western-score-card" key={name}><summary><span className="western-score-topline"><strong>{name}</strong><b>{s.average}</b></span><span className="western-score-band">{s.band}</span><small className="western-score-guidance">{westernGuidance(name,s)}</small><span className="western-score-more">날짜 보기</span></summary>{c.period.start!==c.period.end&&<p>선택 기간 변동폭 {s.spread} · 날짜별 점수 차이는 아래처럼 참고해.</p>}<p>점수가 높은 날: {(s.best_days??[]).slice(0,1).map(d=>d.date).join(', ')||'자료 없음'} · 계획한 일을 진행할 후보일로만 보고 실제 일정·조건을 함께 확인해.</p><p>점수가 낮은 날: {(s.caution_days??[]).slice(0,1).map(d=>d.date).join(', ')||'자료 없음'} · 피해야 할 날로 단정하지 말고 일정·문서·약속을 한 번 더 확인해.</p></details>)}</div>
      {injectReadingContext(children,{field:focusedField,westernOnly:true,technicalDetails:undefined})}
    </> : !view.allowed ? <p className="system-unavailable">현재 입력된 출생시간 정보로는 {system==='saju'?'사주':'태국점성술'}를 신뢰도 있게 계산할 수 없어. 화면을 바꿔도 이 제한은 그대로야.</p> : system==='saju' ? <>
      <header className="system-hero saju-reader-hero"><span>사주 · {sajuPeriod}</span><h3>{sajuReaderHeadline}</h3><p>이 기간에 계산된 운 구간을 생활에서 확인할 문제로 풀어봤어. 특정 사건이 반드시 생긴다는 뜻은 아니고, 간지·십성·절기 경계는 아래 계산 근거에서 따로 확인할 수 있어.</p></header>
      <section className="saju-reader-topics"><h3>{topic==='전체'?'지금 먼저 볼 것':`${topic}에서 먼저 볼 것`}</h3>{topic==='애정'&&<p className="saju-topic-note">애정에서는 표현 방식과 관계 경계를 먼저 봐. 배우자성이나 특정 상대의 마음을 계산한 결과는 아니야.</p>}{selectedLenses.map(l=><LensCard key={l.key} lens={l} evidence={view.contexts.filter(r=>tenGodLens(r.stem_ten_god)?.key===l.key).map(r=>`${r.layer} ${ganzhiWithReading(r.ganzhi)} · ${r.stem_ten_god}`).join(' / ')}/>)}{!selectedLenses.length&&<p className="saju-topic-note">이번 기간에는 {topic}을 바로 설명할 사주 근거가 많지 않아. 전체 탭에서 이 기간에 실제로 적용된 주제를 먼저 보고, 자세한 간지·십성은 아래 계산 근거에서 확인해줘.</p>}</section>
      <details className="system-raw saju-calculation-detail"><summary>사주 계산 근거 자세히 보기</summary><p className="saju-calculation-intro">생활 해설에 실제로 사용한 운 구간과 원국·보정값이야. 기본 화면에서는 읽기 쉬운 해설만 먼저 보여줘.</p>{view.dayun.length>0&&<div className="system-context-chips">{view.dayun.map(r=><span key={r.start_year}>대운 <b>{ganzhiWithReading(r.ganzhi)}</b> {r.start_year}–{r.end_year}</span>)}</div>}<section className="saju-segments"><h4>적용 운 구간</h4>{view.contexts.map(r=><details className="system-segment" key={`${r.layer}-${r.segment_start}`}><summary><b>{r.layer} · {ganzhiWithReading(r.ganzhi)} · {r.stem_ten_god}</b><small>{sajuSegmentHint(c.period.start,c.period.end)}</small></summary><p>생활 번역 · {tenGodLens(r.stem_ten_god)?.title??'정의되지 않음'}</p>{r.branch_links.length>0&&<p>지지 연결 · {r.branch_links.join(' / ')}. 특정 관계의 성립이나 충돌 사건을 단정하지 않아.</p>}<p>적용 기간 · {r.segment_start}부터 {r.segment_end_exclusive} 직전까지</p>{r.boundary_note&&<p>{r.boundary_note}</p>}</details>)}</section><section className="saju-origin-data"><h4>원국과 보정값</h4><p>일간 · {view.saju?.day_master}</p><p>원국 · {Object.entries(view.saju?.pillars??{}).map(([k,v])=>`${{year:'년주',month:'월주',day:'일주',hour:'시주'}[k]} ${v}`).join(' / ')}</p><p>오행 · {Object.entries(view.saju?.elements??{}).map(([k,v])=>`${k} ${v}`).join(' / ')}</p><p>진태양시 · {view.saju?.true_solar?.true_solar_time} · 보정 {view.saju?.true_solar?.total_correction_minutes}분</p><p>이번 해설에서 다루지 않는 항목 · {view.saju?.not_calculated?.join(', ')}</p></section></details>
      <BoundedCopy packet={{system:'saju',love_status:loveStatus,focus_topic:field?.label??topic,period:c.period,dayun:view.dayun,contexts:view.contexts.filter(r=>SAJU_LIFE_KEYS[topic].includes(tenGodLens(r.stem_ten_god)?.key??'')),pillars:view.saju?.pillars,day_master:view.saju?.day_master,not_calculated:view.saju?.not_calculated}}/>
    </> : <>
      <header className="system-hero"><span>태국점성술 · {period}</span><h3>{thaiReaderSummary}</h3><p>부탁·휴식·결정 범위·돈과 시간처럼 지금 손댈 수 있는 부분부터 확인해. 행성 이름과 배치는 아래 계산 상세에서 근거로만 봐.</p></header>
      <div className="system-topic-selector" role="group" aria-label="태국점성술 운 구간 선택">{!!view.natalWheel.length&&<button type="button" aria-pressed={wheelIndex===-1||!view.wheels.length} onClick={()=>setWheelIndex(-1)}>출생 배치</button>}{view.wheels.map((w,i)=><button type="button" key={w.start} aria-pressed={wheelIndex===i} onClick={()=>setWheelIndex(i)}>{w.start===w.end?w.start:`${w.start}–${w.end}`}</button>)}</div>
      {view.wheels.map((w,i)=><details className="system-segment" key={w.start} open={wheelIndex===i}><summary>{thaiPeriodLabel(w.start,w.end)}<small>{w.start===w.end?'이 날짜에 적용':'이 기간에 적용'}</small></summary><p>{thaiLifeSummary(w.wheel.map(r=>r.bhumi_key))}</p><details className="system-segment-technical"><summary>계산 상세</summary><p>진행 나이 {w.age_in_progress} · 타크사 연간 기준 · 주변 사람 영역 {thaiPlanetLabel(w.annual_boriwan.label)}</p>{w.landed_center&&<p>연간 계산 순환이 중앙 단계에 도달해, 이 전통 방식에서 정한 목성 기준을 사용해.</p>}</details></details>)}
      <section className="thai-life-map"><h3>여덟 생활 영역</h3><p className="thai-map-intro">사람·생활 리듬·일·돈·도움·걸림돌을 나눠 보고, 각 카드에서 지금 확인할 행동부터 봐. 행성 배치는 계산 근거에만 둬.</p><div className="bhumi-grid">{selectedBhumi.map(r=><details data-bhumi={r.bhumi_key} key={r.bhumi_key}><summary><strong>{BHUMI_LENSES[r.bhumi_key].title}</strong></summary><div className="thai-lens-reading"><p>{BHUMI_LENSES[r.bhumi_key].meaning}</p><ReadingExplanation kind="practice">{BHUMI_LENSES[r.bhumi_key].action}</ReadingExplanation><ReadingExplanation kind="reason">{thaiPlacementComparison(r,view.natalWheel,wheelIndex<0||!view.wheels.length)}</ReadingExplanation></div></details>)}</div></section>
      <details className="system-raw thai-reading-limit"><summary>이 해설을 읽는 범위</summary><p>여덟 생활 영역의 전통적 범위를 일상 언어로 풀어 쓴 해설이야. 행성 배치는 계산 근거로만 표시하며, 행성 이름만으로 좋은 운·나쁜 운이나 사건의 성립, 상대 마음, 건강 상태를 새로 판정하지 않아.</p></details>
      {view.suriyayat&&<details className="system-raw"><summary>전통 천문 위치 자료 · 상승점 참고</summary><p>수리야얏 방식으로 계산한 행성 위치와 상승점 자료야. 위치가 확인됐다는 사실만으로 사건 발생이나 길흉을 예측하지 않아.</p>{view.suriyayat.lagna?.available&&<p>상승점 위치 · {view.suriyayat.lagna.display}</p>}{(['natal','period_start','period_end'] as const).map(key=><details key={key}><summary>{{natal:'출생 위치',period_start:'기간 시작 위치',period_end:'기간 종료 위치'}[key]}</summary><p>{view.suriyayat![key]?.instant}</p>{Object.entries(view.suriyayat![key]?.positions??{}).map(([name,value])=><p key={name}>{name} · {String((value as {display?:string}).display??'')}</p>)}</details>)}{view.suriyayat.ai_safe_descriptive_packet&&<details><summary>생활 영역 연결 참고</summary><p>확인된 하우스 연결 자료는 생활 영역 사이의 연결을 설명할 때만 사용해. 길흉·사건·점수로 바꾸지 않아.</p></details>}</details>}<details className="system-raw"><summary>태국점성술 계산 범위 자세히 보기</summary><p>출생 요일 · {view.thai?.thai_day} · 출생 행성 {view.thai?.birth_planet?.label}</p><p><b>사용하는 계산</b> · 마하탁사, 타크사 연간 흐름, 수리야얏 위치와 상승점의 생활 영역 연결</p><p><b>해석 범위</b> · 위치와 생활 영역을 설명하는 데만 쓰고, 길흉 최종판정·사건 발생·정확한 시점·확률·점수로 바꾸지 않아.</p><p><b>다른 체계와의 관계</b> · 서양점성술·사주 점수와 합산하지 않고 각각의 근거를 따로 봐.</p><p><b>이번 해설에서 다루지 않는 계산</b> · 학파별 예외 선택, 최종 길흉 판정, 사건 확률 변환, 정확한 수리야얏 진입 시점 계산은 사용하지 않아.</p></details>
      <BoundedCopy packet={{system:'thai',love_status:loveStatus,focus_topic:field?.label??topic,period:c.period,wheel:selectedBhumi,segments:view.wheels.map(({start,end,annual_boriwan,landed_center})=>({start,end,annual_boriwan,landed_center})),predictive_status:view.thai?.predictive_status,not_calculated:view.thai?.not_calculated}}/>
    </>}
  </section>
}
