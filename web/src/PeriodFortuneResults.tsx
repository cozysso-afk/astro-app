import type { LoveStatus } from './lib/loveReadingContext'
import { DatingArchetypePanel } from './DatingArchetypePanel'
import { fortuneField } from './lib/fortuneFields'
import { SystemReadingViews } from './SystemReadingViews'
import type { ExternalCopyMode } from './lib/compactDeepPrompt'
import { CheckCircle2 } from 'lucide-react'
import type { AiInterpretationResponse, FortunePoint, FortuneStat, IntegratedApiResponse, PeriodKey } from './appTypes'
import { DailyOutcomeCard, type DailyOutcomeRecord, type OutcomeCalibration } from './DailyOutcomeCard'
import { PeriodAiInterpretationPanel } from './PeriodAiInterpretationPanel'

type TopicRow = { topic: string; stat: FortuneStat }
type HighlightPoint = FortunePoint & { topic: string }
type ActiveDayun = NonNullable<IntegratedApiResponse['saju']['dayun']>[number]

type PeriodFortuneResultsProps = {
  loveStatus?: LoveStatus
  onLoveStatusChange?: (value: LoveStatus) => void
  datingProfile?: Record<string,unknown>
  datingApiBase?: string
  profileGender?: unknown
  fieldId?: string
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
  onCopyAiPrompt: (mode?: ExternalCopyMode) => void
  onCancelAi: () => void
  aiCanCancel: boolean
  onOutcomeChange: (draft: DailyOutcomeRecord) => void
  onSaveOutcome: () => void
}

export function PeriodFortuneResults({
  loveStatus = 'single', onLoveStatusChange,
  datingProfile,
  datingApiBase,
  profileGender,
  fieldId,
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
  const field = fortuneField(fieldId)
  const technicalDetails = <>
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

  </>
  return <div className="fortune-experience">
    <div className="result-headline"><CheckCircle2 size={16}/><div><strong>{periodLabel} 운세</strong><span>{result.period.start}{result.period.start !== result.period.end ? ` — ${result.period.end}` : ''}</span></div></div>
    {field?.id==='love'&&<div className="system-context-chips love-context-selector" role="group" aria-label="미혼 연애 상태"><button type="button" aria-pressed={loveStatus==='single'} onClick={()=>onLoveStatusChange?.('single')}>싱글 · 새로운 만남</button><button type="button" aria-pressed={loveStatus==='flirting'} onClick={()=>onLoveStatusChange?.('flirting')}>싱글 · 썸·알아가는 중</button><button type="button" aria-pressed={loveStatus==='intimate_uncommitted'} onClick={()=>onLoveStatusChange?.('intimate_uncommitted')}>싱글 · 친밀하지만 미정</button><button type="button" aria-pressed={loveStatus==='couple'} onClick={()=>onLoveStatusChange?.('couple')}>커플 · 현재 관계</button></div>}
    {field?.id==='contact'&&<aside className="contact-scope-note"><strong>어떤 연락을 보는 운세일까?</strong><p>연애 상대가 없어도 볼 수 있어. 지인과의 대화, 업무 문의, DM처럼 직접 주고받는 연락과 공식 안내·결과 발표는 구분해서 읽어.</p><p>연락 점수만으로 누가 어떤 소식을 보낼지는 알 수 없어. 기다리는 연락이 없다면 답장을 기다리라는 뜻으로 받아들이지 않아도 돼. 수신·발신은 관계 방향성의 참고값이며, 공식 발표 여부는 알려주지 않아.</p></aside>}
    <SystemReadingViews loveStatus={field?.id==='love'?loveStatus:undefined} key={fieldId} calculation={result} field={field}><PeriodAiInterpretationPanel loveStatus={loveStatus} field={field} period={period} calculation={result} result={aiInterpretation} loading={aiLoading} error={aiError} cacheSource={aiCacheSource} onRetry={onRetryAi} onCopyPrompt={onCopyAiPrompt} onCancel={onCancelAi} canCancel={aiCanCancel} technicalDetails={technicalDetails}/></SystemReadingViews>
    {field?.id==='love'&&loveStatus!=='couple'&&<DatingArchetypePanel key={`${JSON.stringify(datingProfile)}-${result.period.start}-${result.period.end}`} calculation={result} profileGender={profileGender} profile={datingProfile} apiBase={datingApiBase}/>}
    <p className="reading-safety-note">점수는 흐름의 강도야. 사건이 일어날 확률은 아니야.</p>
    {period==='today' && <details className="reading-outcome"><summary>오늘의 체감 기록하기</summary><DailyOutcomeCard
      draft={outcomeDraft}
      saved={outcomeSaved}
      calibration={outcomeCalibration}
      onChange={onOutcomeChange}
      onSave={onSaveOutcome}
    /></details>}
  </div>
}
