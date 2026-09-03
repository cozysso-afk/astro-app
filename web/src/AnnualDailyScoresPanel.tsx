import { useMemo, useState } from 'react'
import type { FortuneDailyScore } from './appTypes'
import { topicOrder } from './lib/fortuneTopics'

const relationshipTopics = ['수신신호','발신적합','과거인연접점']
const allTopics = [...topicOrder, ...relationshipTopics]

function band(score: number | null | undefined, topic: string) {
  if (score == null || !Number.isFinite(score)) return '—'
  if (topic === '투자주의') {
    if (score >= 70) return '경계 높음'
    if (score >= 55) return '경계 보통 이상'
    if (score >= 40) return '경계 보통'
    return '경계 낮음'
  }
  if (score >= 82) return '매우 강함'
  if (score >= 70) return '강함'
  if (score >= 60) return '보통 이상'
  if (score >= 50) return '보통'
  if (score >= 40) return '다소 약함'
  if (score >= 30) return '약함'
  return '매우 약함'
}

function scoreClass(score: number | null | undefined, topic: string) {
  if (score == null || !Number.isFinite(score)) return 'is-none'
  if (topic === '투자주의') return score >= 65 ? 'is-caution' : score <= 35 ? 'is-calm' : 'is-mid'
  return score >= 70 ? 'is-high' : score <= 35 ? 'is-low' : 'is-mid'
}

function evidenceText(value: string) {
  return String(value ?? '')
    .replace(/True Node/g, '진북교점')
    .replace(/Uranus/g, '천왕성').replace(/Neptune/g, '해왕성').replace(/Saturn/g, '토성')
    .replace(/Jupiter/g, '목성').replace(/Mercury/g, '수성').replace(/Venus/g, '금성')
    .replace(/Pluto/g, '명왕성').replace(/Mars/g, '화성').replace(/Moon/g, '달').replace(/Sun/g, '태양')
    .replace(/Whole Sign/g, '홀사인').replace(/Placidus/g, '플라시두스').replace(/orb\s*/gi, '오브 ')
}

export function AnnualDailyScoresPanel({ rows }: { rows: FortuneDailyScore[] }) {
  const availableTopics = useMemo(() => allTopics.filter((topic) => rows.some((row) => typeof row.scores?.[topic] === 'number')), [rows])
  const months = useMemo(() => [...new Set(rows.map((row) => row.date.slice(0,7)))].sort(), [rows])
  const [selectedTopic, setSelectedTopic] = useState('대인관계')
  const [selectedMonth, setSelectedMonth] = useState('')

  if (!rows.length) return null
  const topic = availableTopics.includes(selectedTopic) ? selectedTopic : (availableTopics[0] ?? '금전')
  const month = selectedMonth === 'all' || months.includes(selectedMonth) ? selectedMonth : (months[0] ?? 'all')
  const visible = rows.filter((row) => month === 'all' || row.date.startsWith(month))
  const scored = visible
    .map((row) => ({ row, score: typeof row.scores?.[topic] === 'number' ? row.scores[topic] as number : null }))
    .filter((item): item is { row: FortuneDailyScore; score: number } => item.score != null)
  const best = scored.length ? [...scored].sort((a,b) => topic === '투자주의' ? a.score-b.score : b.score-a.score)[0] : null
  const caution = scored.length ? [...scored].sort((a,b) => topic === '투자주의' ? b.score-a.score : a.score-b.score)[0] : null

  return <section className="result-card annual-daily-scores">
    <div className="result-card-title"><span>DATE SCORES</span><strong>{rows.length}일 날짜 점수</strong></div>
    <p className="daily-score-intro">핵심 날짜만 잘라낸 표가 아니라 계산 기간의 모든 날짜야. 분야와 월을 바꿔서 원점수를 직접 확인할 수 있어. 점수는 사건 확률이 아니고, <b>투자주의만 높을수록 경계가 큰 값</b>이야.</p>
    <div className="daily-score-controls">
      <label><span>분야</span><select value={topic} onChange={(event)=>setSelectedTopic(event.target.value)}>{availableTopics.map((item)=><option value={item} key={item}>{item}</option>)}</select></label>
      <label><span>월</span><select value={month} onChange={(event)=>setSelectedMonth(event.target.value)}><option value="all">전체 기간</option>{months.map((item)=><option value={item} key={item}>{item}</option>)}</select></label>
    </div>
    {(best || caution) && <div className="daily-score-extremes">
      {best && <div><span>{topic === '투자주의' ? '경계 가장 낮음' : '가장 강한 날'}</span><strong>{best.row.date}</strong><b>{best.score.toFixed(1)}</b></div>}
      {caution && <div><span>{topic === '투자주의' ? '경계 가장 높음' : '가장 약한 날'}</span><strong>{caution.row.date}</strong><b>{caution.score.toFixed(1)}</b></div>}
    </div>}
    <div className="daily-score-list">{visible.map((row) => {
      const score = typeof row.scores?.[topic] === 'number' ? row.scores[topic] as number : null
      const evidence = (row.evidence ?? []).filter((item) => !item.source_topics?.length || item.source_topics.includes(topic))
      return <details className={`daily-score-row ${scoreClass(score, topic)}`} key={`${row.date}-${topic}`}>
        <summary><span><strong>{row.date}</strong><small>{row.label}{row.market_open ? ' · KRX 거래일' : ''}</small></span><span className="daily-score-value"><b>{score == null ? '—' : score.toFixed(1)}</b><small>{band(score, topic)}</small></span></summary>
        {evidence.length ? <div className="daily-score-evidence"><strong>{topic}에 직접 연결된 계산 근거</strong>{evidence.slice(0,6).map((item,index)=><p key={`${row.date}-ev-${index}`}>{item.sample_time ? `${item.sample_time} · ` : ''}{evidenceText(item.text)}</p>)}</div> : <p className="daily-score-no-evidence">이 날짜의 {topic} 점수는 계산됐지만, 저장된 상위 근거 중 이 분야에 직접 연결된 항목은 없어. 다른 분야 근거로 대신 설명하지 않을게.</p>}
      </details>
    })}</div>
  </section>
}
