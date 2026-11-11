import { reunionContactReference } from './lib/relationshipReferenceFlow'
import { ContactObservationScope, useObservedPromptContext } from './ContactObservationScope'
import { westernRankCopy, westernLoveHeadline } from './lib/westernRankCopy'
import type { LoveStatus } from './lib/loveReadingContext'
import { fortuneEvidenceSnapshot, fortunePresentationTone } from './lib/fortuneToneCalibration.ts'
import { fortuneGroup, type FortuneField } from './lib/fortuneFields'
import { Children, Fragment, useEffect, useState, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { Orbit, Columns3, Sparkles, Layers3, Copy } from 'lucide-react'
import type { IntegratedApiResponse, FortuneStat } from './appTypes'
import { lensForTopic, thaiLensForTopic, thaiPlacementWindow, sajuDayExamples, thaiPlacementComparison, thaiPlanetLabel, thaiLifeSummary, thaiLoveSummary, thaiPeriodLabel, buildSystemReading, sajuRelationshipSummary, tenGodLens, ganzhiWithReading, SAJU_LIFE_KEYS, THAI_LIFE_KEYS, compactSystemPrompt, type LifeTopic, type SystemId, type Lens } from './lib/systemReading'
import { ReadingExplanation } from './ReadingExplanation'
import { browserLocalDateIso } from './lib/readingDateSemantics'
import { periodFrame, westernPeriodFact } from './lib/systemPeriodFacts'

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
  const relationshipScoped = lenses[0].topic === '애정'
  const concise = relationshipScoped ? lenses[0].action : sajuLeadSentence(lenses[0])
  const secondary = lenses[1] ? (relationshipScoped ? lenses[1].title : SAJU_SECONDARY_COPY[lenses[1].key]) : ''
  return `${concise}${secondary ? ` 이어서 ${secondary}도 확인해.` : ''}`
}
const WESTERN_NEUTRAL_COPY: Record<string,string> = {
  금전:'예산과 현금 흐름은 평소 계획에 가까워.', 학업:'진도와 복습은 평소 리듬에 가까워.', 시험:'준비 흐름은 크게 흔들리지 않는 편이야.',
  직장:'업무 범위와 마감은 기존 계획을 이어가기 충분해.', 이직:'이직을 크게 촉발하는 신호는 두드러지지 않아.', 대인관계:'관계 흐름은 평소 거리와 약속을 유지하는 쪽이 자연스러워.',
  연애:'관계 속도를 크게 바꾸는 신호는 두드러지지 않아.', 연락:'연락을 크게 촉발하거나 막는 방향은 뚜렷하지 않아.', 재회:'재접촉을 강하게 뜻하는 방향은 뚜렷하지 않아.',
  소식:'새 소식을 크게 앞당기거나 늦추는 방향은 뚜렷하지 않아.', 컨디션:'일정과 회복은 평소 리듬을 유지하는 흐름이야.',
  투자심리:'투자 판단을 크게 흔드는 방향은 뚜렷하지 않아.', 수익실현:'청산 판단을 새로 바꿀 방향은 뚜렷하지 않아.', 신규진입:'신규 진입을 새로 촉발하는 방향은 뚜렷하지 않아.',
  투자주의:'별도 경계 압력이 두드러지지 않지만 일반적인 시장 위험은 그대로야.',
}
function westernGuidance(name:string, stat:FortuneStat, calculation:IntegratedApiResponse) {
  const pair = WESTERN_FLOW_COPY[name] ?? ['결정 전에 확인할 조건을 적고, 비어 있는 항목부터 채워.','확인되지 않은 조건이 있으면 결정을 미루고 사실부터 확인해.']
  const tone = fortunePresentationTone(calculation,name,stat.average,String(stat.band ?? ''))
  if (name === '연락' && /약|낮/.test(stat.band || '')) {
    if (tone === 'good') return '연락 흐름은 약하지만 대화에 도움이 되는 근거도 있어. 이미 오간 말이 있다면 그 화제를 이어가 봐.'
    if (tone === 'caution') return '연락 흐름이 약하고 말을 주고받을 때 걸리는 조건도 있어. 급한 용건이라면 한 가지를 짧게 물어봐.'
    return '연락 흐름은 약해. 이 점수만으로는 누가 먼저 연락할지 알기 어려워.'
  }
  return tone === 'good' ? pair[0] : tone === 'caution' ? pair[1] : WESTERN_NEUTRAL_COPY[name] ?? `${name}은 평소 흐름에 가까워.`
}
function WesternScoreEvidence({calculation, topic}:{calculation:IntegratedApiResponse;topic:string}) {
  const {support, challenge, neutral} = fortuneEvidenceSnapshot(calculation,topic)
  if (!support && !challenge && !neutral) return null
  return <div className="western-score-evidence">
    {support && <p>도움이 되는 배치 · {support}</p>}
    {challenge && <p>부담이 되는 배치 · {challenge}</p>}
    {neutral && <p>함께 작용하는 배치 · {neutral}</p>}
  </div>
}
function periodReadingFrame(when:string) {
  return when === '오늘' ? koreanParticle(when,'은는') : `${when} 기준으로`
}
function koreanParticle(text:string, pair:'은는'|'이가') {
  const clean = String(text ?? '').trim()
  const last = clean.charAt(clean.length - 1)
  const code = last.charCodeAt(0)
  const hasFinal = code >= 0xAC00 && code <= 0xD7A3 && (code - 0xAC00) % 28 !== 0
  return `${clean}${pair === '은는' ? (hasFinal ? '은' : '는') : (hasFinal ? '이' : '가')}`
}
function westernHeadline(rows:Array<[string,FortuneStat]>, when:string, _calculation:IntegratedApiResponse) {
  return westernRankCopy(rows, when)
}
function westernOverviewText(rows:Array<[string,FortuneStat]>, when:string, _calculation:IntegratedApiResponse) {
  return westernRankCopy(rows, when)
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
  if (!lenses.length) return `${periodReadingFrame(when)} 바로 생활 조언으로 연결할 만큼 뚜렷한 사주 주제가 적어. 아래 계산 근거에서 적용 구간만 확인해줘.`
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
function BoundedCopy({packet,topic}:{packet:Record<string,unknown> | (()=>Record<string,unknown>);topic:LifeTopic}) {
  const [notice,setNotice] = useState('')
  const observed = useObservedPromptContext()
  async function copy() {
    let text: string
    try {text=compactSystemPrompt(typeof packet==='function' ? packet() : packet,topic,observed)} catch(error){setNotice(error instanceof Error?error.message:'프롬프트 생성 실패');return}
    try {await navigator.clipboard.writeText(text);setNotice(`심층 프롬프트 복사 완료 · ${text.length.toLocaleString()}자`)} catch {setNotice('복사하지 못했어. 브라우저의 클립보드 권한을 확인해줘.')}
  }
  return <div className="system-copy"><button type="button" onClick={copy}><Copy size={16}/>선택 체계 심층 프롬프트 복사</button><small>현재 체계의 계산 근거만 · 최대 7,500자</small><p role="status">{notice}</p></div>
}
export function SystemReadingViews({calculation:c,children,field,initialSystem='integrated',onSystemChange,outcomeRecords}:{outcomeRecords?:unknown[];calculation:IntegratedApiResponse;children:ReactNode;field?:FortuneField;loveStatus?:LoveStatus;initialSystem?:SystemId;onSystemChange?:(system:SystemId)=>void}) {
  const [system,setSystem] = useState<SystemId>(initialSystem)
  useEffect(()=>{onSystemChange?.(system)},[system,onSystemChange])
  const [topic,setTopic] = useState<LifeTopic>(field?.lens ?? '전체')
  const [wheelIndex,setWheelIndex] = useState(0)
  useEffect(()=>{setSystem(initialSystem);setTopic(field?.lens ?? '전체')},[initialSystem,field?.lens])
  const view=buildSystemReading(c)
  const selectedSegment = wheelIndex < 0 ? undefined : view.wheels[wheelIndex] ?? view.wheels[0]
  const isNatalWheel = !selectedSegment
  const activeWheel = selectedSegment?.wheel ?? view.natalWheel
  const available = (t:LifeTopic) => t==='전체' || system==='western' || system==='integrated' ? true : system==='saju' ? SAJU_LIFE_KEYS[t].length>0 : activeWheel.some(r=>THAI_LIFE_KEYS[t].includes(r.bhumi_key))
  const selectedWestern = Object.entries(c.western.overall ?? {}).filter((row): row is [string, FortuneStat] => row[1] !== null).filter(([name])=>field?field.topics.includes(name):topic==='전체'||WESTERN[topic].includes(name))
  const selectedLenses=view.lenses.filter(l=>SAJU_LIFE_KEYS[topic].includes(l.key)).map(l=>lensForTopic(l,topic))
  const selectedBhumi = THAI_LIFE_KEYS[topic].flatMap(key=>activeWheel.filter(row=>row.bhumi_key===key))
  const thaiGuide = topic==='애정' ? thaiLoveSummary : thaiLifeSummary
  const firstPlacement = selectedBhumi[0]
  const thaiReaderSummary = firstPlacement
    ? thaiLensForTopic(firstPlacement.bhumi_key,topic).action
    : '이 분야와 연결된 생활 영역 자료가 없어.'
  const thaiPlacement = firstPlacement ? thaiPlacementComparison(firstPlacement,view.natalWheel,isNatalWheel) : ''
  const thaiSampleStart = selectedSegment && selectedSegment.start > c.period.start ? selectedSegment.start : c.period.start
  const thaiSampleEnd = selectedSegment && selectedSegment.end < c.period.end ? selectedSegment.end : c.period.end
  const thaiObserved = firstPlacement && selectedSegment
    ? thaiPlacementWindow(firstPlacement.planet.key,thaiPlanetLabel(firstPlacement.planet.label),thaiSampleStart,thaiSampleEnd,view.thai?.suriyayat_daily)
    : ''
  const thaiEvidence = [thaiPlacement,thaiObserved].filter(Boolean).join('. ')
  const period = `${c.period.start}${c.period.end!==c.period.start?` — ${c.period.end}`:''}`
  const periodCaption = c.period.start === c.period.end ? `운세일 · ${period}` : `운세 기간 · ${period}`
  const westernPeriod = periodFrame(c.period.start,c.period.end,c.period.day_count,browserLocalDateIso())
  const loveScores = selectedWestern.filter(([name])=>['연애','연락','재회'].includes(name))
  const westernReaderHeadline = topic==='애정' && loveScores.length
    ? westernLoveHeadline(loveScores)
    : westernHeadline(selectedWestern,westernPeriod,c)
  const westernLoveValues = loveScores.filter(([,stat])=>Number.isFinite(stat.average)).map(([name,stat])=>`${name} ${stat.average}점(${stat.band})`).join(' · ')
  const highestWestern = [...selectedWestern].filter(([name,stat])=>name!=='투자주의' && Number.isFinite(stat.average)).sort((a,b)=>b[1].average-a[1].average)[0]
  const lowestWestern = [...selectedWestern].filter(([name])=>name!=='투자주의').sort((a,b)=>a[1].average-b[1].average)[0]
  const westernOverviewSummary = topic==='애정' && loveScores.length ? westernReaderHeadline : westernOverviewText(selectedWestern,westernPeriod,c)
  const westernDisplayRows = field || topic!=='전체' ? selectedWestern : representativeWesternRows(selectedWestern)
  const sajuPeriod = westernPeriod
  const relevantContexts = view.contexts.filter(row=>selectedLenses.some(lens=>tenGodLens(row.stem_ten_god)?.key===lens.key))
  const relationshipSummary = topic==='애정' ? sajuRelationshipSummary(relevantContexts) : ''
  const sajuDates = sajuDayExamples(view.daily, topic, c.period)
  const dayLead = c.period.start===c.period.end ? sajuDates[0] : undefined
  const matchingMonth = dayLead && relevantContexts.find(row=>row.layer==='월운' && tenGodLens(row.stem_ten_god)?.key===dayLead.lens.key)
  const monthBackdrop = matchingMonth ? `월운도 ${matchingMonth.stem_ten_god}으로 같은 주제를 다뤄. 하루의 기분인지 되풀이되는 관계 습관인지는 다음 대화에서도 살펴봐.` : relationshipSummary
  const dayBranchReading = topic==='애정' && dayLead?.links.length
    ? dayLead.links.some(link=>/충|沖/.test(link))
      ? '일진과 원국 사이에는 충도 있어. 같은 말을 다르게 받아들였을 때는, 상대가 실제로 한 말과 내가 기대한 답을 나눠 보는 게 좋아.'
      : dayLead.links.some(link=>/합|合/.test(link))
        ? '일진과 원국 사이에는 합도 있어. 대화에서 의견이 맞은 부분을 다음 약속으로 옮길 수 있는지 살펴봐.'
        : ''
    : ''
  const dayReading = dayLead ? `${shortKoreanDate(dayLead.date)} 일진의 주제는 ‘${dayLead.lens.title}’이야. ${dayLead.lens.action}` : ''
  const sajuReaderHeadline = dayReading || (topic==='애정'
    ? relationshipSummary || '이 기간에 관계를 설명할 십성 자료가 부족해.'
    : sajuHeadline(selectedLenses,sajuPeriod))
  const sajuOverviewSummary = topic==='전체'
    ? dayReading || sajuOverviewText(view.lenses, view.sajuSummary)
    : dayReading || relationshipSummary || sajuOverviewText(selectedLenses, '이번 기간의 사주 흐름은 계산됐지만, 이 분야까지 바로 연결할 근거는 부족해. 사주 탭에서 적용된 운 구간을 확인해줘.')
  const focusedField = field ?? fortuneGroup(topic)
  const reunionReference = system === 'integrated' && (!focusedField || focusedField.id === 'love') ? reunionContactReference(c) : undefined
  const hasSajuOverview = Boolean(view.saju) && (view.contexts.length > 0 || sajuDates.length > 0)
  const overview = <section className="system-overview"><h3>세 체계 한눈에</h3><div className="system-overview-grid">
        <article className="system-western"><strong><Orbit size={16}/>서양점성술</strong><p>{westernOverviewSummary}</p><small>점수는 사건 확률이 아니라 같은 기간 안에서의 상대적 강약이야.</small></article>
        {hasSajuOverview ? <article className="system-saju"><strong><Columns3 size={16}/>사주</strong><p>{sajuOverviewSummary}</p><small>간지·십성은 사주 탭의 계산 근거에서 따로 확인할 수 있어.</small></article>:<p className="system-unavailable">사주 · 현재 정밀도 또는 기간 근거로는 해석할 수 없어.</p>}
        {view.thai&&(view.natalWheel.length||view.wheels.length)>0 ? <article className="system-thai"><strong><Sparkles size={16}/>태국점성술</strong><p>{thaiReaderSummary}</p><small>{thaiEvidence}</small></article>:<p className="system-unavailable">태국점성술 · 현재 정밀도 또는 사용 가능한 배치가 부족해.</p>}
      </div><details className="system-synthesis"><summary>세 체계에서 지금 확인할 것</summary><p><b>서양점성술</b> · {westernOverviewSummary}</p>{hasSajuOverview ? <p><b>사주</b> · {sajuOverviewSummary}</p> : null}{view.thai && (view.natalWheel.length > 0 || view.wheels.length > 0) ? <p><b>태국점성술</b> · {thaiReaderSummary}</p> : null}<small>세 체계의 수치나 기준은 합산하지 않고 각각의 계산 근거로 확인해.</small></details></section>
  return <ContactObservationScope calculation={c} field={focusedField} localRecords={outcomeRecords}><section className={`system-reading system-${system}`}>
    <span className="reading-period-date">{periodCaption}</span>
    <div className="system-switcher" role="group" aria-label="해석 체계 선택">{SYSTEMS.map(({id,label,Icon})=><button type="button" aria-pressed={system===id} key={id} onClick={()=>setSystem(id)}><Icon size={18} aria-hidden="true"/><span>{label}</span></button>)}</div>
    {!field&&<div className="system-topic-selector system-topic-selector-fixed" role="group" aria-label="생활 분야 선택">{TOPICS.map(t=><button type="button" key={t} disabled={!available(t)} title={!available(t)?(system==='saju'&&SAJU_LIFE_KEYS[t].length===0?'현재 계산 자료만으로는 이 분야를 직접 설명할 근거가 부족해':'이 체계에서 연결된 근거가 부족해'):undefined} aria-pressed={topic===t} onClick={()=>setTopic(t)}>{t}</button>)}</div>}
    {field&&<h3>{field.label} · {period}</h3>}
    {system==='integrated' ? <>
      {injectReadingContext(children,{field:focusedField,systemOverview:overview})}
      {reunionReference && <aside className="reading-explanation"><strong>재회와 연락을 함께 보면</strong><p>{reunionReference}</p></aside>}
    </> : system==='western' ? <>
      <header className="system-hero western-reader-hero"><span>서양점성술 · {westernPeriod}</span><h3>{westernReaderHeadline}</h3><p>{topic==='애정' ? westernLoveValues : highestWestern ? westernGuidance(highestWestern[0],highestWestern[1],c) : '비교할 수 있는 점수가 부족해.'}</p>{c.period.start!==c.period.end && highestWestern && <p>{highestWestern[0]} · {westernPeriodFact(highestWestern[1],c.period.start,c.period.end)}</p>}{topic==='전체' && lowestWestern && lowestWestern[0]!==highestWestern?.[0] && <p>{lowestWestern[0]}은 {lowestWestern[1].average}점이야. {westernGuidance(lowestWestern[0],lowestWestern[1],c)}</p>}</header>
      {!field&&topic==='전체'&&<p className="western-score-overview-note">전체에서는 대표 흐름 6개만 먼저 보여줘. 더 세부적인 값은 위의 애정·대인·학업·직업·금전 탭에서 확인해.</p>}
      <div className="system-score-grid western-score-grid">{westernDisplayRows.map(([name,s])=><details className="western-score-card" key={name}><summary><span className="western-score-topline"><strong>{name}</strong><b>{s.average}</b></span><span className="western-score-band">{s.band}</span><small className="western-score-guidance">{westernGuidance(name,s,c)}</small><span className="western-score-more">{c.period.start===c.period.end?'계산일 보기':'날짜 보기'}</span></summary><p>{westernPeriodFact(s,c.period.start,c.period.end)}</p><WesternScoreEvidence calculation={c} topic={name}/></details>)}</div>
      <BoundedCopy topic={topic} packet={()=>{
        const stats = selectedWestern.filter(([,stat])=>Number.isFinite(stat.average))
        const includeDirections = stats.some(([name])=>name==='연락' || name==='재회')
        const describe = (stat:FortuneStat)=>({average:stat.average,band:stat.band,period_fact:westernPeriodFact(stat,c.period.start,c.period.end)})
        return {
          system:'western', focus_topic:field?.label??topic, period:c.period,
          topics:Object.fromEntries(stats.map(([name,stat])=>[name,describe(stat)])),
          relationship_signals:includeDirections ? Object.fromEntries(Object.entries(c.western.relationship_signals??{}).flatMap(([name,stat])=>stat && Number.isFinite(stat.average) ? [[name,describe(stat)]] : [])) : undefined,
          evidence:stats.map(([name])=>({topic:name,...fortuneEvidenceSnapshot(c,name)})),
        }
      }}/>
      {injectReadingContext(children,{field:focusedField,westernOnly:true,technicalDetails:undefined})}
    </> : !view.allowed ? <p className="system-unavailable">현재 입력된 출생시간 정보로는 {system==='saju'?'사주':'태국점성술'}를 신뢰도 있게 계산할 수 없어. 화면을 바꿔도 이 제한은 그대로야.</p> : system==='saju' ? <>
      <header className="system-hero saju-reader-hero"><span>사주 · {sajuPeriod}</span><h3>{sajuReaderHeadline}</h3>{dayLead && <p>{[dayLead.evidence,...dayLead.links].join(' · ')}</p>}{dayBranchReading && <p>{dayBranchReading}</p>}{dayLead && topic==='애정' && monthBackdrop && <p>{monthBackdrop}</p>}{relevantContexts.length>0 && <p>{relevantContexts.slice(0,3).map(r=>`${r.layer} ${ganzhiWithReading(r.ganzhi)} · ${r.stem_ten_god}${c.period.day_count>1 ? ` (${shortKoreanDate(r.segment_start)}부터)` : ''}`).join(' / ')}</p>}</header>
      {c.period.day_count>1 && sajuDates.length>0 && <section className="saju-reader-topics"><h3>날짜별로 달라지는 일진</h3>{sajuDates.map(day=><article className="system-lens saju-lens-card" key={day.date}><h4>{shortKoreanDate(day.date)} · {day.lens.title}</h4><p>{day.lens.action}</p><small>{[day.evidence,...day.links].join(' · ')}</small></article>)}</section>}
      <section className="saju-reader-topics"><h3>{topic==='전체'?'이 기간에 먼저 볼 것':`${topic}에서 먼저 볼 것`}</h3>{topic==='애정'&&<p className="saju-topic-note">애정에서는 표현 방식과 관계 경계를 먼저 봐. 배우자성이나 특정 상대의 마음을 계산한 결과는 아니야.</p>}{selectedLenses.map(l=><LensCard key={l.key} lens={l} evidence={view.contexts.filter(r=>tenGodLens(r.stem_ten_god)?.key===l.key).map(r=>`${r.layer} ${ganzhiWithReading(r.ganzhi)} · ${r.stem_ten_god}`).join(' / ')}/>)}{!selectedLenses.length&&!sajuDates.length&&<p className="saju-topic-note">이번 기간에는 {topic}을 바로 설명할 사주 근거가 많지 않아. 전체 탭에서 이 기간에 실제로 적용된 주제를 먼저 보고, 자세한 간지·십성은 아래 계산 근거에서 확인해줘.</p>}</section>
      <details className="system-raw saju-calculation-detail"><summary>사주 계산 근거 자세히 보기</summary><p className="saju-calculation-intro">생활 해설에 실제로 사용한 운 구간과 원국·보정값이야. 기본 화면에서는 읽기 쉬운 해설만 먼저 보여줘.</p>{view.dayun.length>0&&<div className="system-context-chips">{view.dayun.map(r=><span key={r.start_year}>대운 <b>{ganzhiWithReading(r.ganzhi)}</b> {r.start_year}–{r.end_year}</span>)}</div>}<section className="saju-segments"><h4>적용 운 구간</h4>{view.contexts.map(r=><details className="system-segment" key={`${r.layer}-${r.segment_start}`}><summary><b>{r.layer} · {ganzhiWithReading(r.ganzhi)} · {r.stem_ten_god}</b><small>{sajuSegmentHint(c.period.start,c.period.end)}</small></summary><p>생활 번역 · {selectedLenses.find(l=>l.key===tenGodLens(r.stem_ten_god)?.key)?.title??'이 분야에 연결된 해설 없음'}</p>{r.branch_links.length>0&&<p>지지 연결 · {r.branch_links.join(' / ')}. 특정 관계의 성립이나 충돌 사건을 단정하지 않아.</p>}<p>적용 기간 · {r.segment_start}부터 {r.segment_end_exclusive} 직전까지</p>{r.boundary_note&&<p>{r.boundary_note}</p>}</details>)}</section><section className="saju-origin-data"><h4>원국과 보정값</h4><p>일간 · {view.saju?.day_master}</p><p>원국 · {Object.entries(view.saju?.pillars??{}).map(([k,v])=>`${{year:'년주',month:'월주',day:'일주',hour:'시주'}[k]} ${v}`).join(' / ')}</p><p>오행 · {Object.entries(view.saju?.elements??{}).map(([k,v])=>`${k} ${v}`).join(' / ')}</p><p>진태양시 · {view.saju?.true_solar?.true_solar_time} · 보정 {view.saju?.true_solar?.total_correction_minutes}분</p><p>이번 해설에서 다루지 않는 항목 · {view.saju?.not_calculated?.join(', ')}</p></section></details>
      <BoundedCopy topic={topic} packet={{system:'saju',focus_topic:field?.label??topic,period:c.period,dayun:view.dayun,daily:sajuDates.map(({date,evidence,links})=>({date,evidence,links})),contexts:view.contexts.filter(r=>SAJU_LIFE_KEYS[topic].includes(tenGodLens(r.stem_ten_god)?.key??'')),pillars:view.saju?.pillars,day_master:view.saju?.day_master,not_calculated:view.saju?.not_calculated}}/>
    </> : <>
      <header className="system-hero"><span>태국점성술 · {period}</span><h3>{thaiReaderSummary}</h3><p>{thaiEvidence}</p></header>
      <div className="system-topic-selector" role="group" aria-label="태국점성술 운 구간 선택">{!!view.natalWheel.length&&<button type="button" aria-pressed={isNatalWheel} onClick={()=>setWheelIndex(-1)}>출생 배치</button>}{view.wheels.map((w,i)=><button type="button" key={w.start} aria-pressed={selectedSegment===w} onClick={()=>setWheelIndex(i)}>{w.start===w.end?w.start:`${w.start}–${w.end}`}</button>)}</div>
      {view.wheels.map(w=><details className="system-segment" key={w.start} open={selectedSegment===w}><summary>{thaiPeriodLabel(w.start,w.end)}<small>{w.start===w.end?'이 날짜에 적용':'이 기간에 적용'}</small></summary><p>{thaiGuide(w.wheel.filter(r=>THAI_LIFE_KEYS[topic].includes(r.bhumi_key)).map(r=>r.bhumi_key))}</p><details className="system-segment-technical"><summary>계산 상세</summary><p>진행 나이 {w.age_in_progress} · 타크사 연간 기준 · 주변 사람 영역 {thaiPlanetLabel(w.annual_boriwan.label)}</p>{w.landed_center&&<p>연간 계산 순환이 중앙 단계에 도달해, 이 전통 방식에서 정한 목성 기준을 사용해.</p>}</details></details>)}
      <section className="thai-life-map"><h3>{topic==='전체'?'여덟 생활 영역':`${topic}에 연결된 생활 영역`}</h3>
        <div className="bhumi-grid">{selectedBhumi.map(r=>{
          const lens = thaiLensForTopic(r.bhumi_key,topic)
          return <details data-bhumi={r.bhumi_key} key={r.bhumi_key}><summary><strong>{lens.title}</strong></summary>
            <div className="thai-lens-reading"><p>{lens.meaning}</p><ReadingExplanation kind="practice">{lens.action}</ReadingExplanation>
              <ReadingExplanation kind="reason">{thaiPlacementComparison(r,view.natalWheel,isNatalWheel)}</ReadingExplanation>
            </div></details>
        })}</div></section>
      <details className="system-raw thai-reading-limit"><summary>이 해설을 읽는 범위</summary><p>여덟 생활 영역의 전통적 범위를 일상 언어로 풀어 쓴 해설이야. 행성 배치는 계산 근거로만 표시하며, 행성 이름만으로 좋은 운·나쁜 운이나 사건의 성립, 상대 마음, 건강 상태를 새로 판정하지 않아.</p></details>
      {view.suriyayat&&<details className="system-raw"><summary>전통 천문 위치 자료 · 상승점 참고</summary><p>수리야얏 방식으로 계산한 행성 위치와 상승점 자료야. 위치가 확인됐다는 사실만으로 사건 발생이나 길흉을 예측하지 않아.</p>{view.suriyayat.lagna?.available&&<p>상승점 위치 · {view.suriyayat.lagna.display}</p>}{(['natal','period_start','period_end'] as const).map(key=><details key={key}><summary>{{natal:'출생 위치',period_start:'기간 시작 위치',period_end:'기간 종료 위치'}[key]}</summary><p>{view.suriyayat![key]?.instant}</p>{Object.entries(view.suriyayat![key]?.positions??{}).map(([name,value])=><p key={name}>{name} · {String((value as {display?:string}).display??'')}</p>)}</details>)}{view.suriyayat.ai_safe_descriptive_packet&&<details><summary>생활 영역 연결 참고</summary><p>확인된 하우스 연결 자료는 생활 영역 사이의 연결을 설명할 때만 사용해. 길흉·사건·점수로 바꾸지 않아.</p></details>}</details>}<details className="system-raw"><summary>태국점성술 계산 범위 자세히 보기</summary><p>출생 요일 · {view.thai?.thai_day} · 출생 행성 {view.thai?.birth_planet?.label}</p><p><b>사용하는 계산</b> · 마하탁사, 타크사 연간 흐름, 수리야얏 위치와 상승점의 생활 영역 연결</p><p><b>해석 범위</b> · 위치와 생활 영역을 설명하는 데만 쓰고, 길흉 최종판정·사건 발생·정확한 시점·확률·점수로 바꾸지 않아.</p><p><b>다른 체계와의 관계</b> · 서양점성술·사주 점수와 합산하지 않고 각각의 근거를 따로 봐.</p><p><b>이번 해설에서 다루지 않는 계산</b> · 학파별 예외 선택, 최종 길흉 판정, 사건 확률 변환, 정확한 수리야얏 진입 시점 계산은 사용하지 않아.</p></details>
      <BoundedCopy topic={topic} packet={{system:'thai',focus_topic:field?.label??topic,period:c.period,wheel:selectedBhumi,placement_observations:thaiObserved,selected_wheel:isNatalWheel?'natal':{start:thaiSampleStart,end:thaiSampleEnd},segments:view.wheels.map(({start,end,annual_boriwan,landed_center})=>({start,end,annual_boriwan,landed_center})),predictive_status:view.thai?.predictive_status,not_calculated:view.thai?.not_calculated}}/>
    </>}
  </section></ContactObservationScope>
}
