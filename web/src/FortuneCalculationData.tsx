import { useState } from 'react'
import type { FortuneDailyEvidence, IntegratedApiResponse, PeriodKey } from './appTypes'
import { periodContactSignals } from './lib/contactDirectionReading'

type DataProps = {calculation:IntegratedApiResponse; topics?:string[]; period:PeriodKey}
const contactLabels:Record<string,string>={수신신호:'외부 연락 반응 신호',발신적합:'내 연락 실행 적합도',과거인연접점:'과거 인연 접점',과거인연재접점:'과거 인연 접점'}
const finite = (value:unknown):value is number => typeof value==='number' && Number.isFinite(value)

export function ContactSignalData({calculation,topics,period}:DataProps) {
  if (topics?.length && !topics.some(t=>t==='연락' || t==='재회')) return null
  const signals=periodContactSignals(calculation,period==='month')
  const pastKey=finite(signals?.과거인연접점?.average) ? '과거인연접점' : '과거인연재접점'
  const labels = ['수신신호','발신적합',pastKey] as const
  const rows=labels.filter(name=>finite(signals?.[name]?.average))
  if (!rows.length) return null
  return <div aria-label="연락 방향별 계산값">
    <h4>연락 방향별 지표</h4>
    {rows.map(name=><p key={name}>{contactLabels[name]} · {signals![name]!.average}점</p>)}
  </div>
}

function humanizeEvidence(value: string) {
  let text = String(value ?? '')
  const replacements: Array<[RegExp, string]> = [
    [/True Node/g, '진북교점'], [/Uranus/g, '천왕성'], [/Neptune/g, '해왕성'], [/Saturn/g, '토성'],
    [/Jupiter/g, '목성'], [/Mercury/g, '수성'], [/Venus/g, '금성'], [/Pluto/g, '명왕성'], [/Mars/g, '화성'],
    [/Moon/g, '달'], [/Sun/g, '태양'], [/ASC/g, '상승점'], [/DSC/g, '하강점'], [/MC/g, '중천점'], [/IC/g, '천저점'],
    [/\bsquare\b/gi,'사분위'], [/\btrine\b/gi,'삼분위'], [/\bsextile\b/gi,'육십분위'], [/\bopposition\b/gi,'충'], [/\bconjunction\b/gi,'합'],
    [/Whole Sign/g, '홀사인'], [/Placidus/g, '플라시두스'],
  ]
  replacements.forEach(([pattern, label]) => { text = text.replace(pattern, label) })
  text = text.replace(/(\d+)H\b/g, '$1하우스')
  text = text.replace(/orb\s*/gi, '오브 ')
  return text
}

function evidenceLabel(row:FortuneDailyEvidence) {
  return humanizeEvidence([row.sample_time, row.transit, row.aspect, row.target].filter(Boolean).join(' · ') || row.text || row.kind)
}

export function FortuneCalculationData({calculation,topics=[],period}:DataProps) {
  const {start,end}=calculation.period
  const [selected,setSelected]=useState('')
  const selectedTopic=(name:string)=>!topics.length || topics.includes(name)
  const days=(calculation.western.daily_scores ?? []).filter(d=>d.date>=start && d.date<=end)
  const day=days.find(d=>d.date===selected) ?? days[0]
  const stats=Object.entries(calculation.western.overall ?? {}).filter(([name,s])=>selectedTopic(name) && finite(s?.average))
  const singleDay=start===end
  const periodScores=new Map(stats.map(([name,stat])=>[name,stat!.average]))
  const directional=periodContactSignals(calculation,period==='month')
  const showDirections=!topics.length || topics.includes('연락') || topics.includes('재회')
  const dayScores=new Map<string,number>()
  if (singleDay) {
    periodScores.forEach((score,name)=>dayScores.set(name,score))
    if (showDirections) for (const [name,stat] of Object.entries(directional ?? {})) {
      if (finite(stat?.average)) dayScores.set(name,stat.average)
    }
  }
  for (const [name,score] of Object.entries(day?.scores ?? {})) {
    if (finite(score) && (contactLabels[name] ? showDirections : selectedTopic(name))) dayScores.set(name,score)
  }
  const evidence=(day?.evidence ?? []).filter(row=>!topics.length || row.source_topics?.some(selectedTopic))
  const axesRows=Object.entries(day?.score_components ?? {}).filter(([name,v])=>dayScores.has(name) && finite(v?.activation) && finite(v?.favorability))
  const rankedStats=stats.filter(([,stat])=>stat!.best_days?.length || stat!.caution_days?.length)
  const hourly=calculation.western.detail_days?.find(row=>row.date===(day?.date ?? start))
  const hourlyTopics=Object.entries(hourly?.topics ?? {}).filter(([topic,value])=>selectedTopic(topic) && (value.best_window || value.caution_window || value.evidence?.length))
  return <section className="result-card calculation-data" aria-label="기간 계산 원자료">
    <h3>{singleDay?'분야별 계산 점수':'분야별 기간 평균'}</h3><p>{start}{!singleDay && ' — '+end}</p>
    <p className="result-note">일반 분야 점수에는 그날 차트에서 배치가 얼마나 강하게 작용하는지, 도움이 되는 방향인지가 함께 반영돼.{(dayScores.has('투자주의') || periodScores.has('투자주의')) && ' 투자주의는 높을수록 경계 신호가 강해.'}</p>
    {!singleDay && <>
      {stats.map(([name,s])=><p key={name}>{name} · {s!.average}점</p>)}
      <ContactSignalData calculation={calculation} topics={topics} period={period}/>
      {rankedStats.length>0 && <details><summary>분야별 점수가 높은 날과 낮은 날</summary>
        {rankedStats.map(([name,s])=>{
          const rows=[['높은 날',s!.best_days],['낮은 날',s!.caution_days]] as const
          return <div key={name}><h4>{name}</h4>{rows.map(([label,points])=>
            points?.length ? <p key={label}>{label} · {points.map(point=>`${point.date} (${point.score}점)`).join(' · ')}</p> : null)}</div>
        })}
      </details>}
    </>}
    {(day || dayScores.size>0) && <div>
      {!singleDay && day && (days.length>1 ? <label>계산 날짜 <select value={day.date} onChange={event=>setSelected(event.target.value)}>{days.map(d=><option key={d.date} value={d.date}>{d.date}</option>)}</select></label> : <h4>{day.date} 계산값</h4>)}
      {[...dayScores].map(([name,score])=><p key={name} data-score-topic={name}>{contactLabels[name] ?? name} · {score}점</p>)}
      {axesRows.length>0 && <details><summary>활성도와 유리도는 어떻게 달라?</summary>
        <p>활성도는 이 분야와 관련된 배치가 얼마나 강하게 나타났는지 보여줘. 유리도는 배치가 도움 쪽인지 부담 쪽인지 보여줘. 50이 중립이고 높을수록 도움 쪽이야. 두 값 모두 하루 안에서 여러 시각을 계산한 평균이야.</p>
        <p>일반 분야는 각 시각의 활성도 46%와 유리도 54%를 합쳐 점수를 계산해. 연락 방향과 매매 관련 보조 지표는 각각의 산식을 써.</p>
        {axesRows.map(([name,v])=><p key={name}>{name} · 활성도 {v.activation} · 유리도 {v.favorability}</p>)}
      </details>}
      {evidence.length>0 && <details><summary>이 날짜의 계산 근거 {evidence.length}개</summary><ul>{evidence.map((row,index)=><li key={index}>
        {evidenceLabel(row)}
        {Object.entries(row.topic_contributions ?? {}).filter(([name,v])=>selectedTopic(name) && finite(v?.contribution) && finite(v?.polarity)).map(([name,v])=><span key={name}> · {name} 기여도 {v.contribution} · 방향 {v.polarity}</span>)}
      </li>)}</ul></details>}
    </div>}
    {hourlyTopics.length>0 && <details className="integrated-time-evidence period-time-evidence">
      <summary>시간대별 계산 근거 펼치기</summary>
      {hourlyTopics.map(([topic,v])=><div key={topic} className="time-topic"><h4>{topic}</h4>
        {v.best_window && <p>높은 점수 구간 · {v.best_window.start}~{v.best_window.end} · {v.best_window.score}점</p>}
        {v.caution_window && <p>낮은 점수 구간 · {v.caution_window.start}~{v.caution_window.end} · {v.caution_window.score}점</p>}
        {v.evidence?.map((item,index)=><p key={index}>{humanizeEvidence(item)}</p>)}
      </div>)}
    </details>}
    {!hourlyTopics.length && !stats.length && !dayScores.size && !evidence.length && !(showDirections && Object.values(directional ?? {}).some(s=>finite(s?.average))) && <p>선택한 분야의 점수·근거가 저장되어 있지 않아.</p>}
  </section>
}
