import { CheckCircle2 } from 'lucide-react'
import type { AiInterpretationResponse, FortunePoint, FortuneStat, IntegratedApiResponse, PeriodKey } from './appTypes'
import { DailyOutcomeCard, type DailyOutcomeRecord, type OutcomeCalibration } from './DailyOutcomeCard'
import { PeriodAiInterpretationPanel } from './PeriodAiInterpretationPanel'

type TopicRow = { topic: string; stat: FortuneStat }
type HighlightPoint = FortunePoint & { topic: string }
type ActiveDayun = NonNullable<IntegratedApiResponse['saju']['dayun']>[number]

type PeriodFortuneResultsProps = {
  period: PeriodKey
  periodLabel?: string
  result: IntegratedApiResponse
  aiInterpretation: AiInterpretationResponse | null
  aiLoading: boolean
  aiError: string
  aiCacheSource: 'local' | 'server' | 'fresh' | ''
  topTopics: TopicRow[]
  cautionTopics: TopicRow[]
  bestDays: HighlightPoint[]
  cautionDays: HighlightPoint[]
  activeDayun: ActiveDayun | null
  outcomeDraft: DailyOutcomeRecord
  outcomeSaved: boolean
  outcomeCalibration: OutcomeCalibration
  topicDisplay: (topic: string) => string
  humanizeEvidence: (value: string) => string
  onRetryAi: () => void
  onCopyAiPrompt: () => void
  onCancelAi: () => void
  aiCanCancel: boolean
  onOutcomeChange: (draft: DailyOutcomeRecord) => void
  onSaveOutcome: () => void
}

export function PeriodFortuneResults({
  period,
  periodLabel,
  result,
  aiInterpretation,
  aiLoading,
  aiError,
  aiCacheSource,
  topTopics,
  cautionTopics,
  bestDays,
  cautionDays,
  activeDayun,
  outcomeDraft,
  outcomeSaved,
  outcomeCalibration,
  topicDisplay,
  humanizeEvidence,
  onRetryAi,
  onCopyAiPrompt,
  onCancelAi,
  aiCanCancel,
  onOutcomeChange,
  onSaveOutcome,
}: PeriodFortuneResultsProps) {
  return <>
    <div className="result-headline"><CheckCircle2 size={20}/><div><strong>{periodLabel}운세 계산 완료</strong><span>{result.engine} · {result.period.day_count}일 분석</span></div></div>
    <PeriodAiInterpretationPanel result={aiInterpretation} loading={aiLoading} error={aiError} cacheSource={aiCacheSource} onRetry={onRetryAi} onCopyPrompt={onCopyAiPrompt} onCancel={onCancelAi} canCancel={aiCanCancel}/>

    <section className="result-card">
      <div className="result-card-title"><span>CORE FLOW</span><strong>계산 점수 한눈에 보기</strong></div>
      <div className="integrated-topic-grid">
        {topTopics.slice(0,3).map(({topic,stat})=><div className="integrated-topic" key={`period-top-${topic}`}><span>{topicDisplay(topic)}</span><strong>{stat.average.toFixed(1)}</strong><small>{stat.band}</small></div>)}
      </div>
      {cautionTopics.length>0 && <div className="best-window caution-window"><span>상대적 주의 흐름</span><strong>{cautionTopics.map((row)=>`${topicDisplay(row.topic)} ${row.stat.average.toFixed(1)}`).join(' · ')}</strong></div>}
      <p className="result-note">위 점수는 사건 확률이 아니라 선택 기간 안에서의 상대적 활성도야. 해설의 행동·시기와 함께 봐.</p>
    </section>

    {(bestDays.length>0 || cautionDays.length>0) && <details className="result-card period-date-highlights period-date-source">
      <summary><span>TIMING RAW DATA</span><strong>날짜 점수 원자료 보기</strong><small>상·하위 날짜와 계산 점수를 직접 확인</small></summary>
      <div className="period-date-source-body">
        {bestDays.map((point)=><div className="tight-row" key={`period-best-${point.date}-${point.topic}`}><span>✨ {point.date} · {topicDisplay(point.topic)} · {point.label}</span><b>{point.score.toFixed(1)}</b></div>)}
        {cautionDays.map((point)=><div className="tight-row" key={`period-caution-${point.date}-${point.topic}`}><span>⚠️ {point.date} · {topicDisplay(point.topic)} · {point.label}</span><b>{point.score.toFixed(1)}</b></div>)}
        <p className="result-note">기간 안의 상대 활성도 비교야. 특정 사건 발생 확률은 아니야.</p>
      </div>
    </details>}

    {result.western.detail_days?.length ? <details className="result-card integrated-time-evidence period-time-evidence"><summary>시간대별 계산 근거 펼치기</summary><div className="time-detail-list">{result.western.detail_days.map((day)=><details key={`period-day-${day.date}`} open={result.period.day_count===1}><summary>{day.date}{day.market_open ? ' · KRX 거래일' : ''}</summary><div className="time-topic-list">{Object.entries(day.topics).map(([topic,detail])=><div className="time-topic" key={`period-${day.date}-${topic}`}><strong className="time-topic-name">{topicDisplay(topic)}</strong>{detail.best_window && <div className="time-window time-window-good"><b>좋은 구간</b><span>{detail.best_window.start}~{detail.best_window.end}</span><em>{detail.best_window.score}</em></div>}{detail.caution_window && <div className="time-window time-window-caution"><b>주의 구간</b><span>{detail.caution_window.start}~{detail.caution_window.end}</span><em>{detail.caution_window.score}</em></div>}{detail.evidence?.length ? <div className="time-evidence"><span className="time-evidence-label">계산 근거</span>{detail.evidence.slice(0,3).map((item,index)=><em key={`period-${day.date}-${topic}-ev-${index}`}>{humanizeEvidence(item)}</em>)}</div> : null}</div>)}</div></details>)}</div></details> : null}

    <section className="result-card">
      <div className="result-card-title"><span>SYSTEMS</span><strong>체계별 보조 흐름</strong></div>
      <div className="saju-summary">
        {result.saju.ok && result.saju.day_master && <span>사주 일간 <b>{result.saju.day_master}</b></span>}
        {activeDayun && <span>현재 대운 <b>{activeDayun.ganzhi}</b> · {activeDayun.start_year}~{activeDayun.end_year}</span>}
        <span>Thai(태국점성술) <b>{result.thai.thai_day}</b> · {result.thai.ruler}</span>
      </div>
    </section>

    {period==='today' && <DailyOutcomeCard
      draft={outcomeDraft}
      saved={outcomeSaved}
      calibration={outcomeCalibration}
      onChange={onOutcomeChange}
      onSave={onSaveOutcome}
    />}
  </>
}
