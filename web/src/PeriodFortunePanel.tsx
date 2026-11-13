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

function periodHeading(title: string, badge: string) {
  if (/^(?:서양점성술|사주|태국점성술)\s*·\s*/.test(title)) return `${badge} 운세`
  return title
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
  const heading = periodHeading(title, badge)
  return <section className={`tool-panel period-fortune-report period-fortune-${badge}`}>
    <div className="tool-panel-heading period-report-heading">
      <span className="tool-icon tone-gold period-report-icon"><Moon size={22}/></span>
      <div className="period-report-copy">
        <div className="period-report-kicker-row"><span className="eyebrow">기간 운세</span><span className="period-report-badge">{badge}</span></div>
        <h2>{heading}</h2>
        <div className="period-report-range"><CalendarDays size={15}/><strong>{startDate}</strong>{startDate !== endDate && <><span>→</span><strong>{endDate}</strong></>}</div>
        <p>선택한 기간의 흐름과 중요한 시기를 정리해서 보여줘. 해석 체계는 아래 선택 탭을 기준으로 해.</p>
      </div>
    </div>

    {!ready ? <>
      <div className="coordinate-note"><Sparkles size={16}/><span>선택한 기간을 계산하면 원자료와 저장된 해설을 볼 수 있어. 새 Gemini 해설은 ‘해설 생성’을 눌러 요청해.</span></div>
      {error ? <div className="status-banner error"><AlertTriangle size={17}/><span>{error}</span></div> : null}
      <button className="primary-button" type="button" onClick={onCalculate} disabled={loading || offline}>
        {loading ? <LoaderCircle className="spin" size={18}/> : <Sparkles size={18}/>}<span>{loading ? '기간 운세 계산 중…' : buttonLabel}</span>
      </button>
    </> : children}
  </section>
}
