import { Children, Fragment, useEffect, useState, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { Columns3, Copy, Layers3, Orbit, Sparkles } from 'lucide-react'
import type { AiInterpretationResponse, FortuneStat, IntegratedApiResponse, PeriodKey } from './appTypes'
import { ContactObservationScope, useObservedPromptContext } from './ContactObservationScope'
import { AuthoredReadingPanel } from './AuthoredReadingPanel'
import { ContactSignalData } from './FortuneCalculationData'
import { buildSystemReadingDocument } from './lib/authoredReadingDocument'
import { verifiedFortuneNarrative } from './PeriodFortuneNarrativeV2'
import { fortuneEvidenceSnapshot } from './lib/fortuneToneCalibration'
import { fortuneGroup, type FortuneField } from './lib/fortuneFields'
import type { LoveStatus } from './lib/loveReadingContext'
import { buildSystemReading, compactSystemPrompt, ganzhiWithReading, SAJU_LIFE_KEYS, tenGodLens, thaiPlanetLabel, THAI_LIFE_KEYS, type LifeTopic, type SystemId } from './lib/systemReading'
import { westernPeriodFact } from './lib/systemPeriodFacts'

const SYSTEMS = [{id:'integrated',label:'통합',Icon:Layers3},{id:'western',label:'서양점성술',Icon:Orbit},{id:'saju',label:'사주',Icon:Columns3},{id:'thai',label:'태국점성술',Icon:Sparkles}] as const
type ReadingChildContext = {field?: FortuneField}
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

type Props = {
  calculation:IntegratedApiResponse
  periodKey?:PeriodKey
  interpretation?:AiInterpretationResponse|null
  children:ReactNode
  field?:FortuneField
  loveStatus?:LoveStatus
  initialSystem?:SystemId
  onSystemChange?:(system:SystemId)=>void
  outcomeRecords?:unknown[]
  onGenerate?:()=>void
  generating?:boolean
  generationError?:string
}
export function SystemReadingViews({calculation:c,periodKey,interpretation,children,field,initialSystem='integrated',onSystemChange,outcomeRecords,onGenerate,generating,generationError}:Props) {
  const [system,setSystem] = useState<SystemId>(initialSystem)
  const [topic,setTopic] = useState<LifeTopic>(field?.lens ?? '전체')
  const [wheelIndex,setWheelIndex] = useState(0)
  useEffect(()=>{onSystemChange?.(system)},[system,onSystemChange])
  useEffect(()=>{setSystem(initialSystem);setTopic(field?.lens ?? '전체');setWheelIndex(0)},[initialSystem,field?.lens,c.period.start,c.period.end])
  const view = buildSystemReading(c)
  const segment = wheelIndex < 0 ? undefined : view.wheels[wheelIndex] ?? view.wheels[0]
  const wheel = segment?.wheel ?? view.natalWheel
  const focusedField = field ?? fortuneGroup(topic)
  const chosenTopics = field?.topics ?? WESTERN[topic]
  const westernRows = Object.entries(c.western.overall ?? {}).filter((entry):entry is [string,FortuneStat]=>Boolean(entry[1]) && Number.isFinite(entry[1]?.average) && (!chosenTopics.length || chosenTopics.includes(entry[0])))
  const contexts = view.contexts.filter(r=>topic==='전체' || SAJU_LIFE_KEYS[topic].includes(tenGodLens(r.stem_ten_god)?.key ?? ''))
  const days = view.daily.filter(r=>topic==='전체' || SAJU_LIFE_KEYS[topic].includes(tenGodLens(r.stem_ten_god)?.key ?? ''))
  const placements = wheel.filter(r=>topic==='전체' || THAI_LIFE_KEYS[topic].includes(r.bhumi_key))
  const systemTitle = SYSTEMS.find(s=>s.id===system)!.label
  const period = c.period.start===c.period.end ? c.period.start : `${c.period.start} — ${c.period.end}`
  const verified = verifiedFortuneNarrative(interpretation)
  const authored = verified && system!=='integrated' ? buildSystemReadingDocument(system,interpretation?.data?.systems?.[system],period,interpretation?.interpreter_version) : null
  const sampleStart = segment && (segment.start>c.period.start ? segment.start : c.period.start)
  const sampleEnd = segment && (segment.end<c.period.end ? segment.end : c.period.end)
  const samplePlanets = new Map(placements.map(row=>[row.planet.key,thaiPlanetLabel(row.planet.label)]))
  const thaiSamples = (view.thai?.suriyayat_daily ?? []).filter(row=>sampleStart && sampleEnd && row.date>=sampleStart && row.date<=sampleEnd)
  const available = system==='western' || system==='integrated' || (system==='saju' ? Boolean(view.saju) : Boolean(view.thai))
  const canSelect = (t:LifeTopic) => t==='전체' || system==='western' || system==='integrated' || (system==='saju' ? SAJU_LIFE_KEYS[t].length>0 : wheel.some(r=>THAI_LIFE_KEYS[t].includes(r.bhumi_key)))

  return <ContactObservationScope calculation={c} field={focusedField} localRecords={outcomeRecords}>
    <section className={`system-reading system-${system}`}>
      <span className="reading-period-date">{c.period.start===c.period.end?'운세일':'운세 기간'} · {period}</span>
      <div className="system-switcher" role="group" aria-label="해석 체계 선택">{SYSTEMS.map(({id,label,Icon})=><button type="button" aria-pressed={system===id} key={id} onClick={()=>setSystem(id)}><Icon size={18} aria-hidden="true"/><span>{label}</span></button>)}</div>
      {!field && <div className="system-topic-selector system-topic-selector-fixed" role="group" aria-label="생활 분야 선택">{TOPICS.map(t=><button type="button" key={t} disabled={!canSelect(t)} aria-pressed={topic===t} onClick={()=>setTopic(t)}>{t}</button>)}</div>}
      {field && <h3>{field.label} · {period}</h3>}
      {system==='integrated' ? injectReadingContext(children,{field:focusedField}) : !available ? <p className="system-unavailable">현재 입력으로 확인된 {systemTitle} 계산 자료가 없어.</p> : <>
        {authored?.state==='ready' ? <AuthoredReadingPanel doc={authored}/> :
          <section className="result-card system-generation-card"><h3>{systemTitle} Gemini 해설</h3>
            <p role="status">{generating?'Gemini 해설을 생성하고 있어.':generationError || '이 기간에 저장된 체계별 Gemini 원고가 없어.'}</p>
            {onGenerate && <button type="button" className="period-ai-generate" disabled={generating} onClick={onGenerate}>{generationError || verified ? '해설 다시 생성' : '해설 생성'}</button>}
          </section>}
        {system==='western' && <>
          <section className="result-card"><h3>{topic==='전체'?'분야별':topic} 계산 점수</h3>
            <div className="system-score-grid western-score-grid">{westernRows.map(([name,s])=><details className="western-score-card" key={name}>
              <summary><span className="western-score-topline"><strong>{name}</strong><b>{s.average}</b></span><span className="western-score-band">{s.band}</span></summary>
              <p>{westernPeriodFact(s,c.period.start,c.period.end)}</p>
              {Object.entries(fortuneEvidenceSnapshot(c,name)).filter(([k,v])=>['support','challenge','neutral'].includes(k)&&v).map(([k,v])=><p key={k}>{{support:'도움 근거',challenge:'부담 근거',neutral:'중립 근거'}[k]} · {v}</p>)}
            </details>)}</div>
            <ContactSignalData calculation={c} topics={chosenTopics} period={periodKey ?? 'today'}/>
            {!westernRows.length && <p>이 분야에 계산된 점수가 없어.</p>}
          </section>
          <BoundedCopy topic={topic} packet={()=>({system,focus_topic:field?.label??topic,period:c.period,topics:Object.fromEntries(westernRows.map(([name,s])=>[name,{average:s.average,band:s.band,period_fact:westernPeriodFact(s,c.period.start,c.period.end)}])),relationship_signals:westernRows.some(([name])=>name==='연락'||name==='재회')?c.western.relationship_signals:undefined,evidence:westernRows.map(([name])=>({topic:name,...fortuneEvidenceSnapshot(c,name)}))})}/>
        </>}
        {system==='saju' && <>
          <section className="result-card"><h3>사주 계산 근거</h3>
            {view.saju?.pillars && <p>원국 · {Object.entries(view.saju.pillars).map(([k,v])=>`${({year:'년주',month:'월주',day:'일주',hour:'시주'} as Record<string,string>)[k]} ${ganzhiWithReading(v)}`).join(' / ')}</p>}
            {view.saju?.day_master && <p>일간 · {view.saju.day_master}</p>}
            {view.saju?.elements && <p>오행 · {Object.entries(view.saju.elements).map(([k,v])=>k+' '+v).join(' / ')}</p>}
            {view.saju?.true_solar && <p>진태양시 · {view.saju.true_solar.true_solar_time} · 보정 {view.saju.true_solar.total_correction_minutes}분</p>}
            {view.dayun.map(r=><p key={r.start_year}>대운 · {ganzhiWithReading(r.ganzhi)} · {r.start_year}–{r.end_year}</p>)}
            {contexts.map(r=><details className="system-segment" key={r.layer+r.segment_start}><summary>{r.layer} · {ganzhiWithReading(r.ganzhi)} · {r.stem_ten_god}</summary><p>{r.segment_start}부터 {r.segment_end_exclusive} 직전까지</p>{r.branch_links.length>0 && <p>지지 연결 · {r.branch_links.join(' / ')}</p>}{r.boundary_note && <p>{r.boundary_note}</p>}</details>)}
            {days.length>0 && <details className="system-raw"><summary>날짜별 일진</summary>{days.map(d=><p key={d.date}>{d.date} · {ganzhiWithReading(d.ganzhi)} · {d.stem_ten_god}{d.branch_links.length>0?' · '+d.branch_links.join(' / '):''}</p>)}</details>}
          </section>
          <BoundedCopy topic={topic} packet={{system,focus_topic:field?.label??topic,period:c.period,dayun:view.dayun,daily:days,contexts,pillars:view.saju?.pillars,day_master:view.saju?.day_master,not_calculated:view.saju?.not_calculated}}/>
        </>}
        {system==='thai' && <>
          <section className="result-card"><h3>태국점성술 계산 근거</h3>
            <p>출생 요일 · {view.thai?.thai_day} · {view.thai?.birth_planet?.label ?? view.thai?.ruler}</p>
            <div className="system-topic-selector" role="group" aria-label="태국점성술 운 구간 선택">{view.natalWheel.length>0 && <button type="button" aria-pressed={!segment} onClick={()=>setWheelIndex(-1)}>출생 배치</button>}{view.wheels.map((w,i)=><button type="button" key={w.start} aria-pressed={segment===w} onClick={()=>setWheelIndex(i)}>{w.start===w.end?w.start:w.start+'–'+w.end}</button>)}</div>
            {segment && <p>진행 나이 {segment.age_in_progress} · 연간 보리완 {thaiPlanetLabel(segment.annual_boriwan.label)}</p>}
            {placements.map(row=><p key={row.bhumi_key} data-bhumi={row.bhumi_key}>{row.bhumi_label} · {thaiPlanetLabel(row.planet.label)}</p>)}
            {thaiSamples.length>0 && <details className="system-raw"><summary>선택한 구간의 날짜별 행성 위치</summary>
              {thaiSamples.map(sample=>Array.from(samplePlanets,([key,label])=>sample.positions?.[key]?.sign_ko && <p key={sample.date+key}>{sample.date} · {label} · {sample.positions[key].sign_ko}</p>))}
            </details>}
            {view.suriyayat && <details className="system-raw"><summary>수리야얏 위치 자료</summary>
              {view.suriyayat.lagna?.available && <p>상승점 · {view.suriyayat.lagna.display}</p>}
              {(['natal','period_start','period_end'] as const).map(key=><details key={key}><summary>{{natal:'출생 위치',period_start:'기간 시작 위치',period_end:'기간 종료 위치'}[key]}</summary><p>{view.suriyayat?.[key]?.instant}</p>{Object.entries(view.suriyayat?.[key]?.positions??{}).map(([name,v])=><p key={name}>{name} · {String((v as {display?:string}).display??'')}</p>)}</details>)}
            </details>}
          </section>
          <BoundedCopy topic={topic} packet={{system,focus_topic:field?.label??topic,period:c.period,wheel:placements,selected_wheel:segment?{start:segment.start,end:segment.end}:'natal',predictive_status:view.thai?.predictive_status,not_calculated:view.thai?.not_calculated}}/>
        </>}
      </>}
    </section>
  </ContactObservationScope>
}
