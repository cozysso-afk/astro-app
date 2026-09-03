import { useEffect, useMemo, useState } from 'react'
import type { FortuneDailyScore } from './appTypes'
import { topicOrder } from './lib/fortuneTopics'

const relationshipTopics = ['수신신호','발신적합','과거인연접점']
const allTopics = [...topicOrder, ...relationshipTopics]
const ALL_PAGE_SIZE = 60
export const ANNUAL_SCORE_FOCUS_EVENT = 'starlight:annual-score-focus'

type AnnualScoreFocusDetail = { date?: string; topic?: string }

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

function monthLabel(month: string) {
  const value = Number(month.slice(5,7))
  return Number.isFinite(value) ? `${value}월` : month
}

function scoreValue(row: FortuneDailyScore, topic: string) {
  const value = row.scores?.[topic]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function AnnualDailyScoresPanel({ rows }: { rows: FortuneDailyScore[] }) {
  const availableTopics = useMemo(() => allTopics.filter((topic) => rows.some((row) => typeof row.scores?.[topic] === 'number')), [rows])
  const months = useMemo(() => [...new Set(rows.map((row) => row.date.slice(0,7)))].sort(), [rows])
  const [selectedTopic, setSelectedTopic] = useState('대인관계')
  const [selectedMonth, setSelectedMonth] = useState('all')
  const [allLimit, setAllLimit] = useState(ALL_PAGE_SIZE)
  const [focusedDate, setFocusedDate] = useState('')
  const [detailOpen, setDetailOpen] = useState(false)

  const scrollToDate = (date: string) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const target = document.getElementById(`annual-daily-score-${date}`) ?? document.getElementById('annual-daily-scores')
      target?.scrollIntoView({ behavior:'smooth', block:'center' })
    }))
  }

  useEffect(() => {
    const handleFocus = (event: Event) => {
      const detail = (event as CustomEvent<AnnualScoreFocusDetail>).detail ?? {}
      const date = String(detail.date ?? '')
      const requestedTopic = String(detail.topic ?? '')
      if (requestedTopic && availableTopics.includes(requestedTopic)) setSelectedTopic(requestedTopic)
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        setSelectedMonth(date.slice(0,7))
        setFocusedDate(date)
        setDetailOpen(true)
        scrollToDate(date)
      }
      setAllLimit(ALL_PAGE_SIZE)
    }
    window.addEventListener(ANNUAL_SCORE_FOCUS_EVENT, handleFocus)
    return () => window.removeEventListener(ANNUAL_SCORE_FOCUS_EVENT, handleFocus)
  }, [availableTopics])

  if (!rows.length) return null
  const topic = availableTopics.includes(selectedTopic) ? selectedTopic : (availableTopics[0] ?? '금전')
  const month = selectedMonth === 'all' || months.includes(selectedMonth) ? selectedMonth : 'all'
  const annualScored = rows
    .map((row) => ({ row, score: scoreValue(row, topic) }))
    .filter((item): item is { row: FortuneDailyScore; score: number } => item.score != null)
  const sortedBest = [...annualScored].sort((a,b) => topic === '투자주의' ? a.score-b.score : b.score-a.score)
  const sortedCaution = [...annualScored].sort((a,b) => topic === '투자주의' ? b.score-a.score : a.score-b.score)
  const annualBest = sortedBest.slice(0,3)
  const annualCaution = sortedCaution.slice(0,3)

  const monthly = months.map((item) => {
    const scored = annualScored.filter(({row}) => row.date.startsWith(item))
    const average = scored.length ? scored.reduce((sum,current) => sum + current.score, 0) / scored.length : null
    return { month:item, average, count:scored.length }
  })

  const visible = rows.filter((row) => month === 'all' || row.date.startsWith(month))
  const scored = visible
    .map((row) => ({ row, score: scoreValue(row, topic) }))
    .filter((item): item is { row: FortuneDailyScore; score: number } => item.score != null)
  const best = scored.length ? [...scored].sort((a,b) => topic === '투자주의' ? a.score-b.score : b.score-a.score)[0] : null
  const caution = scored.length ? [...scored].sort((a,b) => topic === '투자주의' ? b.score-a.score : a.score-b.score)[0] : null
  const listed = month === 'all' ? visible.slice(0,allLimit) : visible
  const hasMore = month === 'all' && listed.length < visible.length

  const focusLocalDate = (date: string) => {
    setSelectedMonth(date.slice(0,7))
    setFocusedDate(date)
    setDetailOpen(true)
    setAllLimit(ALL_PAGE_SIZE)
    scrollToDate(date)
  }

  return <section className="result-card annual-daily-scores" id="annual-daily-scores">
    <div className="result-card-title"><span>DATE SCORES</span><strong>중요 날짜 · {rows.length}일 원점수</strong></div>
    <p className="daily-score-intro">핵심 날짜만 잘라낸 표가 아니라 계산 기간의 모든 날짜야. 먼저 연간 핵심일과 월별 흐름을 보고, 필요하면 아래에서 365일 원점수와 실제 계산 근거까지 확인하면 돼. 점수는 사건 확률이 아니고, <b>투자주의만 높을수록 경계가 큰 값</b>이야.</p>

    <div className="daily-score-controls">
      <label><span>분야</span><select value={topic} onChange={(event)=>{setSelectedTopic(event.target.value);setFocusedDate('');setAllLimit(ALL_PAGE_SIZE)}}>{availableTopics.map((item)=><option value={item} key={item}>{item}</option>)}</select></label>
      <label><span>상세 목록 범위</span><select value={month} onChange={(event)=>{setSelectedMonth(event.target.value);setFocusedDate('');setDetailOpen(event.target.value !== 'all');setAllLimit(ALL_PAGE_SIZE)}}><option value="all">전체 기간</option>{months.map((item)=><option value={item} key={item}>{monthLabel(item)}</option>)}</select></label>
    </div>

    {(annualBest.length || annualCaution.length) > 0 && <div className="daily-score-section">
      <div className="daily-score-section-head"><strong>연간 핵심 날짜</strong><span>{topic} 기준 상·하위 3일</span></div>
      <div className="daily-score-highlights">
        <div className="daily-score-highlight-group">
          <span>{topic === '투자주의' ? '경계 낮은 날' : '강한 날'}</span>
          {annualBest.map(({row,score})=><button type="button" key={`best-${row.date}`} onClick={()=>focusLocalDate(row.date)}><strong>{row.date.slice(5)}</strong><b>{score.toFixed(1)}</b></button>)}
        </div>
        <div className="daily-score-highlight-group is-caution">
          <span>{topic === '투자주의' ? '경계 높은 날' : '약한 날'}</span>
          {annualCaution.map(({row,score})=><button type="button" key={`caution-${row.date}`} onClick={()=>focusLocalDate(row.date)}><strong>{row.date.slice(5)}</strong><b>{score.toFixed(1)}</b></button>)}
        </div>
      </div>
    </div>}

    <div className="daily-score-section">
      <div className="daily-score-section-head"><strong>월별 흐름</strong><span>월 평균 · 눌러서 상세 보기</span></div>
      <div className="daily-score-months">
        {monthly.map((item) => <button type="button" className={month === item.month ? 'is-selected' : ''} key={item.month} onClick={()=>{setSelectedMonth(item.month);setFocusedDate('');setDetailOpen(true);setAllLimit(ALL_PAGE_SIZE)}}>
          <span><strong>{monthLabel(item.month)}</strong><small>{item.count ? `${item.count}일` : '값 없음'}</small></span>
          <b>{item.average == null ? '—' : item.average.toFixed(1)}</b>
          <i aria-hidden="true"><em style={{width:`${item.average == null ? 0 : Math.max(0,Math.min(100,item.average))}%`}} /></i>
        </button>)}
      </div>
      {month !== 'all' && <button type="button" className="daily-score-all-button" onClick={()=>{setSelectedMonth('all');setFocusedDate('');setDetailOpen(false);setAllLimit(ALL_PAGE_SIZE)}}>전체 기간으로 돌아가기</button>}
    </div>

    <details className="daily-score-section daily-score-detail-disclosure" open={detailOpen} onToggle={(event)=>setDetailOpen(event.currentTarget.open)}>
      <summary><span><strong>{month === 'all' ? '365일 상세 원점수' : `${monthLabel(month)} 상세 원점수`}</strong><small>날짜별 점수와 직접 연결된 계산 근거</small></span><b>{detailOpen ? '접기' : '펼치기'}</b></summary>
      <div className="daily-score-detail-body">
        <div className="daily-score-section-head"><strong>{topic} · {month === 'all' ? '전체 기간' : monthLabel(month)}</strong><span>{listed.length}/{visible.length}일 표시</span></div>
        {(best || caution) && <div className="daily-score-extremes">
          {best && <div><span>{topic === '투자주의' ? '이 범위 경계 최저' : '이 범위 최고점'}</span><strong>{best.row.date}</strong><b>{best.score.toFixed(1)}</b></div>}
          {caution && <div><span>{topic === '투자주의' ? '이 범위 경계 최고' : '이 범위 최저점'}</span><strong>{caution.row.date}</strong><b>{caution.score.toFixed(1)}</b></div>}
        </div>}
        <div className="daily-score-list">{listed.map((row) => {
          const score = scoreValue(row, topic)
          const evidence = (row.evidence ?? []).filter((item) => !item.source_topics?.length || item.source_topics.includes(topic))
          const isFocused = focusedDate === row.date
          return <details id={`annual-daily-score-${row.date}`} className={`daily-score-row ${scoreClass(score, topic)} ${isFocused ? 'is-focused' : ''}`} key={`${row.date}-${topic}`} open={isFocused || undefined} onToggle={(event)=>{if(isFocused&&!event.currentTarget.open)setFocusedDate('')}}>
            <summary><span><strong>{row.date}</strong><small>{row.label}{row.market_open ? ' · KRX 거래일' : ''}</small></span><span className="daily-score-value"><b>{score == null ? '—' : score.toFixed(1)}</b><small>{band(score, topic)}</small></span></summary>
            {evidence.length ? <div className="daily-score-evidence"><strong>{topic}에 직접 연결된 계산 근거</strong>{evidence.slice(0,6).map((item,index)=><p key={`${row.date}-ev-${index}`}>{item.sample_time ? `${item.sample_time} · ` : ''}{evidenceText(item.text)}</p>)}</div> : <p className="daily-score-no-evidence">이 날짜의 {topic} 점수는 계산됐지만, 저장된 상위 근거 중 이 분야에 직접 연결된 항목은 없어. 다른 분야 근거로 대신 설명하지 않을게.</p>}
          </details>
        })}</div>
        {hasMore && <div className="daily-score-more">
          <button type="button" onClick={()=>setAllLimit((value)=>Math.min(value+ALL_PAGE_SIZE,visible.length))}>다음 {Math.min(ALL_PAGE_SIZE,visible.length-listed.length)}일 더 보기</button>
          <button type="button" onClick={()=>setAllLimit(visible.length)}>365일 전부 펼치기</button>
        </div>}
      </div>
    </details>
  </section>
}
