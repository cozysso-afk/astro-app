import type { FortuneField } from './lib/fortuneFields'
import { useState, cloneElement, isValidElement, type ReactNode } from 'react'
import { Orbit, Columns3, Sparkles, Layers3, Copy } from 'lucide-react'
import type { IntegratedApiResponse, FortuneStat } from './appTypes'
import { thaiPlanetLabel, thaiLifeSummary, buildSystemReading, BHUMI_LENSES, tenGodLens, SAJU_LIFE_KEYS, THAI_LIFE_KEYS, compactSystemPrompt, type LifeTopic, type SystemId, type Lens } from './lib/systemReading'
import { ReadingExplanation } from './ReadingExplanation'

const SYSTEMS = [{id:'integrated',label:'통합',Icon:Layers3},{id:'western',label:'서양점성술',Icon:Orbit},{id:'saju',label:'사주',Icon:Columns3},{id:'thai',label:'태국점성술',Icon:Sparkles}] as const
const TOPICS: LifeTopic[] = ['전체','애정','대인','학업','직업','금전','컨디션']
const WESTERN: Record<LifeTopic,string[]> = {전체:[],애정:['연애','연락','재회'],대인:['대인관계','소식'],학업:['학업','시험'],직업:['직장','이직'],금전:['금전','투자심리','수익실현','신규진입','투자주의'],컨디션:['컨디션']}
function LensCard({lens,evidence}:{lens:Lens;evidence:string}) { return <article className="system-lens"><h4>{lens.title}</h4><p>{lens.meaning}</p><ReadingExplanation kind="reason">{evidence}</ReadingExplanation><ReadingExplanation kind="practice">{lens.action}</ReadingExplanation><ReadingExplanation kind="caution">{lens.limit}</ReadingExplanation></article> }
function BoundedCopy({packet}:{packet:Record<string,unknown>}) {
  const [notice,setNotice] = useState('')
  async function copy() {
    let text: string
    try {text=compactSystemPrompt(packet)} catch(error){setNotice(error instanceof Error?error.message:'프롬프트 생성 실패');return}
    try {await navigator.clipboard.writeText(text);setNotice(`심층 프롬프트 복사 완료 · ${text.length.toLocaleString()}자`)} catch {setNotice('복사하지 못했어. 브라우저의 클립보드 권한을 확인해줘.')}
  }
  return <div className="system-copy"><button type="button" onClick={copy}><Copy size={16}/>선택 체계 심층 프롬프트 복사</button><small>현재 체계의 계산 근거만 · 최대 7,500자</small><p role="status">{notice}</p></div>
}
export function SystemReadingViews({calculation:c,children,field,initialSystem='integrated'}:{calculation:IntegratedApiResponse;children:ReactNode;field?:FortuneField;initialSystem?:SystemId}) {
  const [system,setSystem] = useState<SystemId>(initialSystem)
  const [topic,setTopic] = useState<LifeTopic>(field?.lens ?? '전체')
  const [wheelIndex,setWheelIndex] = useState(-1)
  const view=buildSystemReading(c)
  const wheel = wheelIndex<0 ? view.natalWheel : view.wheels[wheelIndex]?.wheel ?? []
  const activeWheel = wheel.length ? wheel : view.wheels[0]?.wheel ?? []
  const available = (t:LifeTopic) => t==='전체' || system==='western' || system==='integrated' ? true : system==='saju' ? view.lenses.some(l=>SAJU_LIFE_KEYS[t].includes(l.key)) : activeWheel.some(r=>THAI_LIFE_KEYS[t].includes(r.bhumi_key))
  const selectedWestern = Object.entries(c.western.overall ?? {}).filter((row): row is [string, FortuneStat] => row[1] !== null).filter(([name])=>field?field.topics.includes(name):topic==='전체'||WESTERN[topic].includes(name))
  const selectedLenses=view.lenses.filter(l=>SAJU_LIFE_KEYS[topic].includes(l.key))
  const selectedBhumi=activeWheel.filter(r=>THAI_LIFE_KEYS[topic].includes(r.bhumi_key))
  const period = `${c.period.start}${c.period.end!==c.period.start?` — ${c.period.end}`:''}`
  const focusedField = field ?? (topic==='전체' ? undefined : {id:topic,label:topic+'운',desc:'선택 분야',topics:WESTERN[topic],lens:topic})
  const overview = <section className="system-overview"><h3>세 체계 한눈에</h3><div className="system-overview-grid">
        <article className="system-western"><strong><Orbit size={16}/>서양점성술</strong><p>{selectedWestern.slice().sort((a,b)=>b[1].average-a[1].average).slice(0,2).map(([name,s])=>`${name} · ${s.band}`).join(', ') || '해당 분야의 계산값이 없어.'}</p><small>선택 기간의 강약과 날짜를 읽는 층</small></article>
        {view.saju&&view.contexts.length ? <article className="system-saju"><strong><Columns3 size={16}/>사주</strong><p>{topic==='전체'?view.sajuSummary:selectedLenses.length?selectedLenses.map(l=>l.title).join(', '):'이 분야에 직접 연결된 십성 해석은 없어. 다른 분야의 맥락을 가져와 채우지 않았어.'}</p></article>:<p className="system-unavailable">사주 · 현재 정밀도 또는 기간 근거로는 해석할 수 없어.</p>}
        {view.thai&&(view.natalWheel.length||view.wheels.length)>0 ? <article className="system-thai"><strong><Sparkles size={16}/>태국점성술</strong><p>{topic==='전체'?view.thaiSummary:selectedBhumi.length?thaiLifeSummary(selectedBhumi.map(r=>r.bhumi_key)):'이 분야와 연결된 생활 영역 자료가 없어.'}</p><small>생활 영역의 맥락이며 길흉 점수가 아니야.</small></article>:<p className="system-unavailable">태국점성술 · 현재 정밀도 또는 사용 가능한 배치가 부족해.</p>}
      </div><details className="system-synthesis"><summary>세 체계를 같이 보면 · {view.state}</summary><p>서양점성술의 분야 강약과 사주의 운 구간, 태국점성술의 생활 영역 배치는 서로 다른 질문에 답해. 숫자를 더하거나 같은 결론으로 맞추지 않고, 선택한 분야에서 실제로 겹치는 맥락이 있는지 비교해.</p>{selectedLenses.map(l=><p key={l.key}>{l.title} 맥락에서는 {l.action}</p>)}</details></section>
  return <section className={`system-reading system-${system}`}>
    <span className="reading-period-date">{period}</span>
    <div className="system-switcher" role="group" aria-label="해석 체계 선택">{SYSTEMS.map(({id,label,Icon})=><button type="button" aria-pressed={system===id} key={id} onClick={()=>{setSystem(id);setTopic(field?.lens ?? '전체')}}><Icon size={16}/>{label}</button>)}</div>
    {!field&&<div className="system-topic-selector" role="group" aria-label="생활 분야 선택">{TOPICS.map(t=><button type="button" key={t} disabled={!available(t)} title={!available(t)?'이 체계에서 연결된 근거가 부족해':undefined} aria-pressed={topic===t} onClick={()=>setTopic(t)}>{t}</button>)}</div>}
    {field&&<h3>{field.label} · {period}</h3>}
    {system==='integrated' ? <>
      {isValidElement<{field?:FortuneField;systemOverview?:ReactNode;systemSummary?:string}>(children) && typeof children.type !== 'string' ? cloneElement(children,{field:focusedField,systemOverview:overview,systemSummary:view.saju&&view.contexts.length?view.sajuSummary:undefined}) : <>{overview}{children}</>}
    </> : system==='western' ? <>
      <header className="system-hero"><span>서양점성술 · {period}</span><h3>분야의 강약과 날짜를 나눠 읽어봐.</h3><p>높은 점수는 사건 확률이 아니야. 낮은 점수도 주의할 분야를 찾는 데 의미가 있어. 투자주의의 높은 값은 유리함이 아니라 위험 관리에 주목할 강도야.</p></header>
      <div className="system-score-grid">{selectedWestern.map(([name,s])=><details key={name}><summary><strong>{name}</strong><b>{s.average}</b><span>{s.band}</span></summary>{c.period.start!==c.period.end&&<p>선택 기간 변동폭 {s.spread} · 최고·최저 날짜는 아래 계산 근거에서 비교할 수 있어.</p>}<p>좋은 날: {(s.best_days??[]).slice(0,1).map(d=>d.date).join(', ')||'자료 없음'}</p><p>주의할 날: {(s.caution_days??[]).slice(0,1).map(d=>d.date).join(', ')||'자료 없음'}</p></details>)}</div>
      {isValidElement<{field?:FortuneField;westernOnly?:boolean;technicalDetails?:ReactNode}>(children) && typeof children.type !== 'string' ? cloneElement(children,{field:focusedField,westernOnly:true,technicalDetails:undefined}) : children}
    </> : !view.allowed ? <p className="system-unavailable">출생시간 검증 정책에 따라 이 계산에서는 {system==='saju'?'사주':'태국점성술'} 해석이 제외돼 있어. 탭 전환으로 정밀도 제한을 바꾸지 않아.</p> : system==='saju' ? <>
      <header className="system-hero"><span>사주 · {period}</span><h3>{view.sajuSummary}</h3><p>{c.period.start===c.period.end?'선택한 날이 속한 운 구간을 배경으로 읽어. 계산되지 않은 일진은 만들지 않아.':view.monthly.length>1?'선택 기간이 여러 절기 구간에 걸쳐 있어. 달력의 월 이름으로 합치지 않고 각 경계와 십성을 나눠 읽어.':'선택 기간에 적용되는 실제 운 구간을 배경으로 읽어. 구간 안에서 매일 같은 사건이 생긴다는 뜻은 아니야.'}</p></header>
      <div className="system-context-chips">{view.dayun.map(r=><span key={r.start_year}>대운 <b>{r.ganzhi}</b> {r.start_year}–{r.end_year}</span>)}</div>
      <section><h3>운 구간을 따라 읽기</h3>{view.contexts.map((r,i)=><details className="system-segment" key={`${r.layer}-${r.segment_start}`} open={i<2}><summary><b>{r.layer} · {r.ganzhi} · {r.stem_ten_god}</b><small>{r.segment_start} → {r.segment_end_exclusive} 미만</small></summary><p>{tenGodLens(r.stem_ten_god)?.meaning??'이 십성 값의 생활 분야 번역은 아직 정의돼 있지 않아.'}</p>{r.branch_links.length>0&&<ReadingExplanation kind="reason">{r.branch_links.join(' / ')}. 지지 사이의 연결을 표시한 계산이야. 특정 관계의 성립이나 충돌 사건을 단정하지 않아.</ReadingExplanation>}<p>{r.boundary_note}</p></details>)}</section>
      <section><h3>생활 분야로 읽기</h3>{topic==='애정'&&<p>표현과 관계 경계를 읽는 맥락이야. 배우자성이나 특정 상대의 마음을 계산한 결과는 아니야.</p>}{selectedLenses.map(l=><LensCard key={l.key} lens={l} evidence={view.contexts.filter(r=>tenGodLens(r.stem_ten_god)?.key===l.key).map(r=>`${r.layer} ${r.ganzhi} · ${r.stem_ten_god} (${r.segment_start}부터 ${r.segment_end_exclusive} 미만)`).join(' / ')}/>)}{!selectedLenses.length&&<p>연결된 십성이 없어 이 분야의 설명을 만들지 않았어.</p>}</section>
      <details className="system-raw"><summary>사주 원국과 계산 범위</summary><p>일간 · {view.saju?.day_master}</p><p>원국 · {Object.entries(view.saju?.pillars??{}).map(([k,v])=>`${{year:'년주',month:'월주',day:'일주',hour:'시주'}[k]} ${v}`).join(' / ')}</p><p>오행 · {Object.entries(view.saju?.elements??{}).map(([k,v])=>`${k} ${v}`).join(' / ')}</p><p>진태양시 · {view.saju?.true_solar?.true_solar_time} · 보정 {view.saju?.true_solar?.total_correction_minutes}분</p><p>미계산: {view.saju?.not_calculated?.join(', ')}</p></details>
      <BoundedCopy packet={{system:'saju',focus_topic:field?.label??topic,period:c.period,dayun:view.dayun,contexts:view.contexts.filter(r=>SAJU_LIFE_KEYS[topic].includes(tenGodLens(r.stem_ten_god)?.key??'')),pillars:view.saju?.pillars,day_master:view.saju?.day_master,not_calculated:view.saju?.not_calculated}}/>
    </> : <>
      <header className="system-hero"><span>태국점성술 · {period}</span><h3>{view.thaiSummary}</h3><p>여덟 생활 영역은 생활의 어느 영역을 살펴보는지 보여줘. 모든 영역에 행성이 배치되는 구조이므로 배치가 있다는 이유만으로 그 분야가 강하다고 판정하지 않아.</p></header>
      <div className="system-topic-selector" role="group" aria-label="태국점성술 운 구간 선택">{!!view.natalWheel.length&&<button type="button" aria-pressed={wheelIndex===-1} onClick={()=>setWheelIndex(-1)}>출생 배치</button>}{view.wheels.map((w,i)=><button type="button" key={w.start} aria-pressed={wheelIndex===i} onClick={()=>setWheelIndex(i)}>{w.start}–{w.end}</button>)}</div>
      {view.wheels.map((w,i)=><details className="system-segment" key={w.start} open={wheelIndex===i}><summary>연간 배치 · {w.start}–{w.end}<small>주변 사람 영역 · {thaiPlanetLabel(w.annual_boriwan.label)}</small></summary><p>진행 나이 {w.age_in_progress}의 실제 배치야. {w.landed_center?'중앙에 도달해 엔진의 목성 대체 규칙을 적용했어.':'이 구간은 주변 사람 영역을 시작점으로 여덟 영역을 나눠 읽어.'} 전후 구간이 바뀌더라도 사건의 발생 시각을 뜻하지 않아.</p></details>)}
      <section><h3>여덟 생활 영역</h3><div className="bhumi-grid">{selectedBhumi.map(r=><details data-bhumi={r.bhumi_key} key={r.bhumi_key}><summary><strong>{thaiPlanetLabel(r.planet.label)}</strong><span>{BHUMI_LENSES[r.bhumi_key].title}</span></summary><p>{BHUMI_LENSES[r.bhumi_key].meaning}</p></details>)}</div></section>
      <section><h3>생활 분야로 읽기</h3>{selectedBhumi.map((r,i)=><details className="system-segment" key={r.bhumi_key} open={i<2}><summary>{BHUMI_LENSES[r.bhumi_key].title}</summary><LensCard lens={BHUMI_LENSES[r.bhumi_key]} evidence={`${r.bhumi_label} · ${thaiPlanetLabel(r.planet.label)}. 선택한 구간에서 이 생활 영역에 배치된 행성이야. 아래 조언은 영역의 의미를 일상에 적용한 질문이야.`}/></details>)}</section>
      {view.suriyayat&&<details className="system-raw"><summary>Suriyayat · 위치와 검증된 라그나</summary><p>별도로 계산된 위치 자료야. 위치와 하우스 경로가 검증됐다는 사실은 사건 예측이 검증됐다는 뜻이 아니야.</p>{view.suriyayat.lagna?.available&&<p>숫자 Lagna · {view.suriyayat.lagna.display}</p>}{(['natal','period_start','period_end'] as const).map(key=><details key={key}><summary>{{natal:'출생 위치',period_start:'기간 시작 위치',period_end:'기간 종료 위치'}[key]}</summary><p>{view.suriyayat![key]?.instant}</p>{Object.entries(view.suriyayat![key]?.positions??{}).map(([name,value])=><p key={name}>{name} · {String((value as {display?:string}).display??'')}</p>)}</details>)}{view.suriyayat.ai_safe_descriptive_packet&&<details><summary>검증된 비예측형 하우스 연결</summary><p>생활 영역 사이의 연결만 설명하는 경로야. 길흉·사건·점수로 변환하지 않아.</p><pre>{JSON.stringify(view.suriyayat.ai_safe_descriptive_packet,null,2)}</pre></details>}</details>}<details className="system-raw"><summary>태국점성술 계산 범위 자세히 보기</summary><p>출생 요일 · {view.thai?.thai_day} · 출생 행성 {view.thai?.birth_planet?.label}</p><p>{view.thai?.predictive_status}</p><p>{view.thai?.consensus_policy}</p><p>미계산: {view.thai?.not_calculated?.join(', ')}</p></details>
      <BoundedCopy packet={{system:'thai',focus_topic:field?.label??topic,period:c.period,wheel:selectedBhumi,segments:view.wheels.map(({start,end,annual_boriwan,landed_center})=>({start,end,annual_boriwan,landed_center})),predictive_status:view.thai?.predictive_status,not_calculated:view.thai?.not_calculated}}/>
    </>}
  </section>
}
