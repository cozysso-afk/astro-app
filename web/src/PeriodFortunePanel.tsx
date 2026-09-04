import type { ReactNode } from 'react'
import { AlertTriangle, CalendarDays, LoaderCircle, Moon, Sparkles } from 'lucide-react'

type PeriodFortunePanelProps = {
  title: string
  startDate: string
  endDate: string
  ready: boolean
  loading: boolean
  offline: boolean
  error: string
  buttonLabel: string
  onCalculate: () => void
  children: ReactNode
}

function periodBadge(title: string) {
  if (title.includes('오늘')) return '오늘'
  if (title.includes('주간')) return '주간'
  if (title.includes('월간')) return '월간'
  if (title.includes('연간')) return '연간'
  return '기간'
}

export function PeriodFortunePanel({
  title,
  startDate,
  endDate,
  ready,
  loading,
  offline,
  error,
  buttonLabel,
  onCalculate,
  children,
}: PeriodFortunePanelProps) {
  const badge = periodBadge(title)
  return <section className={`tool-panel period-fortune-report period-fortune-${badge}`}>
    <div className="tool-panel-heading period-report-heading">
      <span className="tool-icon tone-gold period-report-icon"><Moon size={22}/></span>
      <div className="period-report-copy">
        <div className="period-report-kicker-row"><span className="eyebrow">기간 운세</span><span className="period-report-badge">{badge}</span></div>
        <h2>{title}</h2>
        <div className="period-report-range"><CalendarDays size={15}/><strong>{startDate}</strong><span>→</span><strong>{endDate}</strong></div>
        <p>선택한 기간의 흐름과 중요한 시기를 정리해서 보여줘.</p>
      </div>
    </div>

    {!ready ? <>
      <div className="coordinate-note"><Sparkles size={16}/><span>현재 선택한 기간의 계산 결과가 아직 없어. 버튼을 누르면 기간 계산을 시작해. 자연어 해설은 자동 생성 경로를 먼저 시도하고, 해설 카드에서 직접 생성하거나 Gemini 호출 없이 프롬프트만 복사할 수도 있어. 같은 계산의 저장본 재조회는 다시 호출하지 않아.</span></div>
      {error ? <div className="status-banner error"><AlertTriangle size={17}/><span>{error}</span></div> : null}
      <button className="primary-button" type="button" onClick={onCalculate} disabled={loading || offline}>
        {loading ? <LoaderCircle className="spin" size={18}/> : <Sparkles size={18}/>}<span>{loading ? '기간 운세 계산 중…' : buttonLabel}</span>
      </button>
    </> : children}
  </section>
}
