import type { ReactNode } from 'react'
import { AlertTriangle, LoaderCircle, Moon, Sparkles } from 'lucide-react'

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
  return <section className="tool-panel period-fortune-report">
    <div className="tool-panel-heading">
      <span className="tool-icon tone-gold"><Moon size={22}/></span>
      <div><span className="eyebrow">PERIOD FORTUNE</span><h2>{title}</h2><p>{startDate} → {endDate} · 선택한 기간만 따로 보는 기간 운세야.</p></div>
    </div>

    {!ready ? <>
      <div className="coordinate-note"><Sparkles size={16}/><span>현재 선택한 기간의 계산 결과가 아직 없어. 버튼을 누르면 계산 후 Gemini 자연어 해설도 자동 생성해. 최초 생성은 API 사용량이 발생할 수 있고, 같은 계산의 저장본 재조회는 다시 호출하지 않아.</span></div>
      {error ? <div className="status-banner error"><AlertTriangle size={17}/><span>{error}</span></div> : null}
      <button className="primary-button" type="button" onClick={onCalculate} disabled={loading || offline}>
        {loading ? <LoaderCircle className="spin" size={18}/> : <Sparkles size={18}/>}<span>{loading ? '기간 운세 계산 중…' : buttonLabel}</span>
      </button>
    </> : children}
  </section>
}
