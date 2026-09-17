import type { LoveStatus } from './lib/loveReadingContext'
import type { FortuneField } from './lib/fortuneFields'
import { Children, Fragment, useState, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'
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
  학업:['공부할 순서를 정해 차근차근 따라가면 무난해.','새 진도보다 복습부터 잡고 목표를 작게 나눠.'],
  시험:['배운 내용을 꺼내 쓰는 연습과 실수 점검을 같이 해.','새 내용을 늘리기보다 자주 틀리는 부분부터 확인해.'],
  직장:['업무 요청과 협의는 일정과 책임 범위를 분명히 해.','일정과 책임 범위가 모호하면 바로 확정하지 말고 다시 맞춰.'],
  이직:['조건을 비교하고 필요한 대화를 이어가기 괜찮아.','조건이 불분명하면 결정을 서두르지 말고 확인부터 해.'],
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
  관성:'맡은 역할과 책임을 정리하는 데 먼저 무게를 둬. 새 일을 크게 벌이기보다 이미 맡은 일을 정확히 끝내고, 평가받는 부분을 점검하는 편이 좋아.',
  인성:'새 자료를 많이 늘리기보다 이미 배운 내용을 정리하고 이해가 빈 곳을 메우는 데 집중해.',
  재성:'돈과 시간을 어디에 쓸지 우선순위를 먼저 정해. 기대보다 지금 확실한 예산과 의무를 기준으로 움직이는 편이 좋아.',
  식상:'생각을 말이나 결과물로 구체화하는 데 무게가 실려. 길게 설명하기보다 상대가 이해할 수 있는 형태로 보여주는 편이 좋아.',
  비겁:'내 기준과 역할 분담을 분명히 하는 게 중요해. 혼자 밀어붙이거나 무조건 맞추기보다 조율할 부분을 나눠봐.',
}
const SAJU_SECONDARY_COPY: Record<string,string> = {
  관성:'맡은 일의 완료 기준과 책임 범위',
  인성:'배운 내용과 문서 정리',
  재성:'돈·시간의 우선순위',
  식상:'말과 결과물로 표현하는 방식',
  비겁:'내 기준과 역할 분담',
}
function westernCaution(name:string, stat:FortuneStat) {
  if (name === '투자주의') return stat.average >= 60 || /강|높/.test(String(stat.band ?? ''))
  return stat.average < 40 || /약|낮/.test(String(stat.band ?? ''))
}
function westernGuidance(name:string, stat:FortuneStat) {
  const pair = WESTERN_FLOW_COPY[name] ?? ['조건을 확인하면서 움직여.','무리해서 밀어붙이지 말고 조건부터 확인해.']
  return pair[westernCaution(name,stat) ? 1 : 0]
}
function westernWhen(dayCount:number) {
  if (dayCount <= 1) return '오늘'
  if (dayCount <= 9) return '이번 주'
  if (dayCount <= 45) return '이번 달'
  return '올해'
}
function westernHeadline(rows:Array<[string,FortuneStat]>, when:string) {
  const readable = rows.filter(([name])=>name!=='투자주의')
  if (!readable.length) return `${when}은 비교할 수 있는 서양점성술 분야 점수가 없어.`
  const strongest = readable.slice().sort((a,b)=>b[1].average-a[1].average)[0]
  const weakest = readable.slice().sort((a,b)=>a[1].average-b[1].average)[0]
  const strongLabel = WESTERN_HEADLINE_LABEL[strongest[0]] ?? strongest[0]
  const weakLabel = WESTERN_HEADLINE_LABEL[weakest[0]] ?? weakest[0]
  if (weakest[0]!==strongest[0] && strongest[1].average-weakest[1].average>=8) {
    return `${when}은 ${strongLabel} 쪽이 상대적으로 더 살아 있어. 반대로 ${weakLabel}은 힘이 덜 실리니, ${westernGuidance(weakest[0],weakest[1])}`
  }
  return `${when}은 ${strongLabel}이 가장 눈에 띄지만 분야 간 차이가 크진 않아. ${westernGuidance(strongest[0],strongest[1])}`
}
function westernOverviewText(rows:Array<[string,FortuneStat]>, when:string) {
  const readable = rows.filter(([name])=>name!=='투자주의')
  if (!readable.length) return '이 분야의 서양점성술 계산값이 충분하지 않아.'
  const strongest = readable.slice().sort((a,b)=>b[1].average-a[1].average)[0]
  const weakest = readable.slice().sort((a,b)=>a[1].average-b[1].average)[0]
  if (strongest[0]===weakest[0]) return `${when}은 ${WESTERN_HEADLINE_LABEL[strongest[0]]??strongest[0]} 흐름을 중심으로 보면 돼.`
  return `${when}은 ${WESTERN_HEADLINE_LABEL[strongest[0]]??strongest[0]}이 상대적으로 강하고, ${WESTERN_HEADLINE_LABEL[weakest[0]]??weakest[0]}은 약한 편이야.`
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
  if (!lenses.length) return `${when}은 생활 언어로 연결할 수 있는 사주 주제가 충분하지 않아. 계산 근거만 확인해줘.`
  const lead = SAJU_LEAD_COPY[lenses[0].key] ?? lenses[0].action
  const secondary = lenses[1] ? SAJU_SECONDARY_COPY[lenses[1].key] : ''
  return `${when}은 ${lead}${secondary ? ` 여기에 ${secondary}도 같이 확인해.` : ''}`
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
  const view=buildSystemReading(c)
  const wheel = wheelIndex<0 ? view.natalWheel : view.wheels[wheelIndex]?.wheel ?? []
  const activeWheel = wheel.length ? wheel : view.wheels[0]?.wheel ?? view.natalWheel
  const available = (t:LifeTopic) => t==='전체' || system==='western' || system==='integrated' ? true : system==='saju' ? view.lenses.some(l=>SAJU_LIFE_KEYS[t].includes(l.key)) : activeWheel.some(r=>THAI_LIFE_KEYS[t].includes(r.bhumi_key))
  const selectedWestern = Object.entries(c.western.overall ?? {}).filter((row): row is [string, FortuneStat] => row[1] !== null).filter(([name])=>field?field.topics.includes(name):topic==='전체'||WESTERN[topic].includes(name))
  const selectedLenses=view.lenses.filter(l=>SAJU_LIFE_KEYS[topic].includes(l.key)).map(l=>lensForTopic(l,topic))
  const selectedBhumi=activeWheel.filter(r=>THAI_LIFE_KEYS[topic].includes(r.bhumi_key))
  const thaiReaderSummary = topic==='전체'
    ? '이번 기간에는 사람 관계에서 부탁과 책임의 균형, 수면·회복 같은 생활 리듬, 일에서 내가 결정할 범위, 돈·시간 같은 생활 기반을 각각 따로 점검해봐.'
    : selectedBhumi.length ? thaiLifeSummary(selectedBhumi.map(r=>r.bhumi_key)) : '이 분야와 연결된 생활 영역 자료가 없어.'
  const period = `${c.period.start}${c.period.end!==c.period.start?` — ${c.period.end}`:''}`
  const westernPeriod = westernWhen(c.period.day_count)
  const westernReaderHeadline = westernHeadline(selectedWestern,westernPeriod)
  const westernOverviewSummary = westernOverviewText(selectedWestern,westernPeriod)
  const westernDisplayRows = field || topic!=='전체' ? selectedWestern : representativeWesternRows(selectedWestern)
  const sajuPeriod = westernWhen(c.period.day_count)
  const sajuReaderHeadline = sajuHeadline(selectedLenses,sajuPeriod)
  const focusedField = field ?? (topic==='전체' ? undefined : {id:topic,label:topic+'운',desc:'선택 분야',topics:WESTERN[topic],lens:topic})
  const overview = <section className="system-overview"><h3>세 체계 한눈에</h3><div className="system-overview-grid">
        <article className="system-western"><strong><Orbit size={16}/>서양점성술</strong><p>{westernOverviewSummary}</p><small>점수는 사건 확률이 아니라 같은 기간 안에서의 상대적 강약이야.</small></article>
        {view.saju&&view.contexts.length ? <article className="system-saju"><strong><Columns3 size={16}/>사주</strong><p>{topic==='전체'?view.sajuSummary:selectedLenses.length?selectedLenses.map(l=>l.title).join(', '):'사주 운 구간은 계산됐지만 이 분야를 구체적으로 설명할 연결 근거는 부족해. 아래 사주 탭에서 계산된 구간을 확인할 수 있어.'}</p></article>:<p className="system-unavailable">사주 · 현재 정밀도 또는 기간 근거로는 해석할 수 없어.</p>}
        {view.thai&&(view.natalWheel.length||view.wheels.length)>0 ? <article className="system-thai"><strong><Sparkles size={16}/>태국점성술</strong><p>{thaiReaderSummary}</p><small>생활 영역을 읽는 기준표이며 길흉 점수는 아니야.</small></article>:<p className="system-unavailable">태국점성술 · 현재 정밀도 또는 사용 가능한 배치가 부족해.</p>}
      </div><details className="system-synthesis"><summary>세 체계를 같이 보면 · {view.state}</summary><p>서양점성술의 분야 강약과 사주의 운 구간, 태국점성술의 생활 영역 배치는 서로 다른 질문에 답해. 숫자를 더하거나 같은 결론으로 맞추지 않고, 선택한 분야에서 실제로 겹치는 맥락이 있는지 비교해.</p>{selectedLenses.map(l=><p key={l.key}>{l.title} 맥락에서는 {l.action}</p>)}</details></section>
  return <section className={`system-reading system-${system}`}>
    <span className="reading-period-date">{period}</span>
    <div className="system-switcher" role="group" aria-label="해석 체계 선택">{SYSTEMS.map(({id,label,Icon})=><button type="button" aria-pressed={system===id} key={id} onClick={()=>{setSystem(id);setTopic(field?.lens ?? '전체')}}><Icon size={18} aria-hidden="true"/><span>{label}</span></button>)}</div>
    {!field&&<div className="system-topic-selector system-topic-selector-fixed" role="group" aria-label="생활 분야 선택">{TOPICS.map(t=><button type="button" key={t} disabled={!available(t)} title={!available(t)?'이 체계에서 연결된 근거가 부족해':undefined} aria-pressed={topic===t} onClick={()=>setTopic(t)}>{t}</button>)}</div>}
    {field&&<h3>{field.label} · {period}</h3>}
    {system==='integrated' ? <>
      {injectReadingContext(children,{field:focusedField,systemOverview:overview})}
    </> : system==='western' ? <>
      <header className="system-hero western-reader-hero"><span>서양점성술 · {westernPeriod}</span><h3>{westernReaderHeadline}</h3><p>점수는 사건 확률이 아니야. 특히 연락·재회·투자 관련 값은 실제 행동이나 수익을 보장하지 않으니 조건과 위험을 같이 확인해.</p></header>
      {!field&&topic==='전체'&&<p className="western-score-overview-note">전체에서는 대표 흐름 6개만 먼저 보여줘. 더 세부적인 값은 위의 애정·대인·학업·직업·금전 탭에서 확인해.</p>}
      <div className="system-score-grid western-score-grid">{westernDisplayRows.map(([name,s])=><details className="western-score-card" key={name}><summary><span className="western-score-topline"><strong>{name}</strong><b>{s.average}</b></span><span className="western-score-band">{s.band}</span><small className="western-score-guidance">{westernGuidance(name,s)}</small><span className="western-score-more">날짜 보기</span></summary>{c.period.start!==c.period.end&&<p>선택 기간 변동폭 {s.spread} · 최고·최저 날짜는 아래 계산 근거에서 비교할 수 있어.</p>}<p>좋은 날: {(s.best_days??[]).slice(0,1).map(d=>d.date).join(', ')||'자료 없음'}</p><p>주의할 날: {(s.caution_days??[]).slice(0,1).map(d=>d.date).join(', ')||'자료 없음'}</p></details>)}</div>
      {injectReadingContext(children,{field:focusedField,westernOnly:true,technicalDetails:undefined})}
    </> : !view.allowed ? <p className="system-unavailable">출생시간 검증 정책에 따라 이 계산에서는 {system==='saju'?'사주':'태국점성술'} 해석이 제외돼 있어. 탭 전환으로 정밀도 제한을 바꾸지 않아.</p> : system==='saju' ? <>
      <header className="system-hero saju-reader-hero"><span>사주 · {sajuPeriod}</span><h3>{sajuReaderHeadline}</h3><p>이 기간에 계산된 운 구간을 생활 주제로 번역해 보여줘. 특정 사건이 반드시 생긴다는 뜻은 아니고, 간지·십성·절기 경계는 아래 계산 근거에서 따로 확인할 수 있어.</p></header>
      <section className="saju-reader-topics"><h3>{topic==='전체'?'지금 먼저 볼 것':`${topic}에서 먼저 볼 것`}</h3>{topic==='애정'&&<p className="saju-topic-note">표현과 관계 경계를 읽는 맥락이야. 배우자성이나 특정 상대의 마음을 계산한 결과는 아니야.</p>}{selectedLenses.map(l=><LensCard key={l.key} lens={l} evidence={view.contexts.filter(r=>tenGodLens(r.stem_ten_god)?.key===l.key).map(r=>`${r.layer} ${ganzhiWithReading(r.ganzhi)} · ${r.stem_ten_god}`).join(' / ')}/>)}{!selectedLenses.length&&<p>연결된 십성이 없어 이 분야의 설명을 만들지 않았어.</p>}</section>
      <details className="system-raw saju-calculation-detail"><summary>사주 계산 근거 자세히 보기</summary><p className="saju-calculation-intro">생활 해설에 실제로 사용한 운 구간과 원국·보정값이야. 기본 화면에서는 읽기 쉬운 해설만 먼저 보여줘.</p>{view.dayun.length>0&&<div className="system-context-chips">{view.dayun.map(r=><span key={r.start_year}>대운 <b>{ganzhiWithReading(r.ganzhi)}</b> {r.start_year}–{r.end_year}</span>)}</div>}<section className="saju-segments"><h4>적용 운 구간</h4>{view.contexts.map(r=><details className="system-segment" key={`${r.layer}-${r.segment_start}`}><summary><b>{r.layer} · {ganzhiWithReading(r.ganzhi)} · {r.stem_ten_god}</b><small>{sajuSegmentHint(c.period.start,c.period.end)}</small></summary><p>생활 번역 · {tenGodLens(r.stem_ten_god)?.title??'정의되지 않음'}</p>{r.branch_links.length>0&&<p>지지 연결 · {r.branch_links.join(' / ')}. 특정 관계의 성립이나 충돌 사건을 단정하지 않아.</p>}<p>정확 구간 · {r.segment_start} → {r.segment_end_exclusive} 미만</p>{r.boundary_note&&<p>{r.boundary_note}</p>}</details>)}</section><section className="saju-origin-data"><h4>원국과 보정값</h4><p>일간 · {view.saju?.day_master}</p><p>원국 · {Object.entries(view.saju?.pillars??{}).map(([k,v])=>`${{year:'년주',month:'월주',day:'일주',hour:'시주'}[k]} ${v}`).join(' / ')}</p><p>오행 · {Object.entries(view.saju?.elements??{}).map(([k,v])=>`${k} ${v}`).join(' / ')}</p><p>진태양시 · {view.saju?.true_solar?.true_solar_time} · 보정 {view.saju?.true_solar?.total_correction_minutes}분</p><p>미계산: {view.saju?.not_calculated?.join(', ')}</p></section></details>
      <BoundedCopy packet={{system:'saju',love_status:loveStatus,focus_topic:field?.label??topic,period:c.period,dayun:view.dayun,contexts:view.contexts.filter(r=>SAJU_LIFE_KEYS[topic].includes(tenGodLens(r.stem_ten_god)?.key??'')),pillars:view.saju?.pillars,day_master:view.saju?.day_master,not_calculated:view.saju?.not_calculated}}/>
    </> : <>
      <header className="system-hero"><span>태국점성술 · {period}</span><h3>{thaiReaderSummary}</h3><p>좋고 나쁨을 한 줄로 단정하기보다, 지금 생활에서 확인할 부분을 먼저 보고 행성 배치는 계산 근거로 내려서 읽어.</p></header>
      <div className="system-topic-selector" role="group" aria-label="태국점성술 운 구간 선택">{!!view.natalWheel.length&&<button type="button" aria-pressed={wheelIndex===-1||!view.wheels.length} onClick={()=>setWheelIndex(-1)}>출생 배치</button>}{view.wheels.map((w,i)=><button type="button" key={w.start} aria-pressed={wheelIndex===i} onClick={()=>setWheelIndex(i)}>{w.start===w.end?w.start:`${w.start}–${w.end}`}</button>)}</div>
      {view.wheels.map((w,i)=><details className="system-segment" key={w.start} open={wheelIndex===i}><summary>{thaiPeriodLabel(w.start,w.end)}<small>{w.start===w.end?'이 날짜에 적용':'이 기간에 적용'}</small></summary><p>{thaiReaderSummary}</p><details className="system-segment-technical"><summary>계산 상세</summary><p>진행 나이 {w.age_in_progress} · 타크사 연간 기준 · 주변 사람 영역 {thaiPlanetLabel(w.annual_boriwan.label)}</p>{w.landed_center&&<p>계산상 중앙에 도달해 엔진의 목성 대체 규칙이 적용됐어.</p>}</details></details>)}
      <section className="thai-life-map"><h3>여덟 생활 영역</h3><p className="thai-map-intro">각 영역은 뜻과 현실에서 확인할 내용을 먼저 보여줘. 행성 배치는 펼친 뒤 계산 근거에서 확인할 수 있어.</p><div className="bhumi-grid">{selectedBhumi.map(r=><details data-bhumi={r.bhumi_key} key={r.bhumi_key}><summary><strong>{BHUMI_LENSES[r.bhumi_key].title}</strong></summary><div className="thai-lens-reading"><p>{BHUMI_LENSES[r.bhumi_key].meaning}</p><ReadingExplanation kind="practice">{BHUMI_LENSES[r.bhumi_key].action}</ReadingExplanation><ReadingExplanation kind="reason">{thaiPlacementComparison(r,view.natalWheel,wheelIndex<0||!view.wheels.length)}</ReadingExplanation></div></details>)}</div></section>
      <details className="system-raw thai-reading-limit"><summary>이 해설을 읽는 범위</summary><p>여덟 생활 영역의 전통적 범위를 일상 언어로 풀어 쓴 해설이야. 행성 배치는 계산 근거로만 표시하며, 행성 이름만으로 좋은 운·나쁜 운이나 사건의 성립, 상대 마음, 건강 상태를 새로 판정하지 않아.</p></details>
      {view.suriyayat&&<details className="system-raw"><summary>Suriyayat · 위치와 검증된 라그나</summary><p>별도로 계산된 위치 자료야. 위치와 하우스 경로가 검증됐다는 사실은 사건 예측이 검증됐다는 뜻이 아니야.</p>{view.suriyayat.lagna?.available&&<p>숫자 Lagna · {view.suriyayat.lagna.display}</p>}{(['natal','period_start','period_end'] as const).map(key=><details key={key}><summary>{{natal:'출생 위치',period_start:'기간 시작 위치',period_end:'기간 종료 위치'}[key]}</summary><p>{view.suriyayat![key]?.instant}</p>{Object.entries(view.suriyayat![key]?.positions??{}).map(([name,value])=><p key={name}>{name} · {String((value as {display?:string}).display??'')}</p>)}</details>)}{view.suriyayat.ai_safe_descriptive_packet&&<details><summary>검증된 비예측형 하우스 연결</summary><p>생활 영역 사이의 연결만 설명하는 경로야. 길흉·사건·점수로 변환하지 않아.</p><pre>{JSON.stringify(view.suriyayat.ai_safe_descriptive_packet,null,2)}</pre></details>}</details>}<details className="system-raw"><summary>태국점성술 계산 범위 자세히 보기</summary><p>출생 요일 · {view.thai?.thai_day} · 출생 행성 {view.thai?.birth_planet?.label}</p><p>{view.thai?.predictive_status}</p><p>{view.thai?.consensus_policy}</p><p>미계산: {view.thai?.not_calculated?.join(', ')}</p></details>
      <BoundedCopy packet={{system:'thai',love_status:loveStatus,focus_topic:field?.label??topic,period:c.period,wheel:selectedBhumi,segments:view.wheels.map(({start,end,annual_boriwan,landed_center})=>({start,end,annual_boriwan,landed_center})),predictive_status:view.thai?.predictive_status,not_calculated:view.thai?.not_calculated}}/>
    </>}
  </section>
}
