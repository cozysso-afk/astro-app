import { useState } from 'react'
import type { FortuneDailyEvidence, IntegratedApiResponse, PeriodKey } from './appTypes'
import { periodContactSignals } from './lib/contactDirectionReading'

type DataProps = {calculation:IntegratedApiResponse; topics?:string[]; period:PeriodKey}
const finite = (value:unknown):value is number => typeof value==='number' && Number.isFinite(value)

export function ContactSignalData({calculation,topics,period}:DataProps) {
  if (topics?.length && !topics.some(t=>t==='연락' || t==='재회')) return null
  const signals=periodContactSignals(calculation,period==='month')
  const pastKey=finite(signals?.과거인연접점?.average) ? '과거인연접점' : '과거인연재접점'
  const labels:Record<string,string>={수신신호:'외부 연락 반응 신호',발신적합:'내 연락 실행 적합도',[pastKey]:'과거 인연 접점'}
  const rows=Object.entries(labels).filter(([name])=>finite(signals?.[name]?.average))
  if (!rows.length) return null
  return <div aria-label="연락 방향별 계산값">
    <h4>연락 방향별 지표</h4>
    {rows.map(([name,label])=><p key={name}>{label} · {signals![name]!.average}점</p>)}
  </div>
}

function evidenceLabel(row:FortuneDailyEvidence) {
  return [row.sample_time, row.transit, row.aspect, row.target].filter(Boolean).join(' · ') || row.text || row.kind
}

export function FortuneCalculationData({calculation,topics=[],period}:DataProps) {
  const {start,end}=calculation.period
  const [selected,setSelected]=useState('')
  const selectedTopic=(name:string)=>!topics.length || topics.includes(name)
  const days=(calculation.western.daily_scores ?? []).filter(d=>d.date>=start && d.date<=end)
  const day=days.find(d=>d.date===selected) ?? days[0]
  const stats=Object.entries(calculation.western.overall ?? {}).filter(([name,s])=>selectedTopic(name) && finite(s?.average))
  const dayTopics=Object.entries(day?.scores ?? {}).filter(([name,score])=>selectedTopic(name) && finite(score))
  const evidence=(day?.evidence ?? []).filter(row=>!topics.length || row.source_topics?.some(selectedTopic))
  return <section className="result-card calculation-data" aria-label="기간 계산 원자료">
    <h3>계산 원자료</h3><p>{start}{start!==end && ' — '+end}</p>
    {stats.length>0 && <div><h4>기간 평균</h4>{stats.map(([name,s])=><p key={name}>{name} · {s!.average}점</p>)}</div>}
    <ContactSignalData calculation={calculation} topics={topics} period={period}/>
    {day && <div>
      {days.length>1 ? <label>계산 날짜 <select value={day.date} onChange={event=>setSelected(event.target.value)}>{days.map(d=><option key={d.date} value={d.date}>{d.date}</option>)}</select></label> : <h4>{day.date} 계산값</h4>}
      {dayTopics.map(([name,score])=>{
        const axes=day.score_components?.[name]
        return <p key={name}>{name} · {score}점{axes && finite(axes.activation) && finite(axes.favorability) && <> · 활성도 {axes.activation} · 유리도 {axes.favorability}</>}</p>
      })}
      {evidence.length>0 && <details><summary>이 날짜의 계산 근거 {evidence.length}개</summary><ul>{evidence.map((row,index)=><li key={index}>
        {evidenceLabel(row)}
        {Object.entries(row.topic_contributions ?? {}).filter(([name,v])=>selectedTopic(name) && finite(v?.contribution) && finite(v?.polarity)).map(([name,v])=><span key={name}> · {name} 기여도 {v.contribution} · 방향 {v.polarity}</span>)}
      </li>)}</ul></details>}
    </div>}
    {!stats.length && !dayTopics.length && !evidence.length && <p>선택한 분야의 점수·근거가 저장되어 있지 않아.</p>}
  </section>
}
