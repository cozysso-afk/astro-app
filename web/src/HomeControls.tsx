import { CalendarDays, ChevronDown, Gem, Heart, MapPin, Moon, Orbit, Search, Sparkles, Sun } from 'lucide-react'

import type { ApiStatus, BirthProfile, PeriodKey, ToolKey } from './appTypes'

export const fortunePeriods = [
  { key: 'today' as const, label: '오늘', icon: Sun },
  { key: 'week' as const, label: '주간', icon: CalendarDays },
  { key: 'month' as const, label: '월간', icon: Moon },
  { key: 'year' as const, label: '연간', icon: Orbit },
]

export const analysisTools = [
  { key: 'integrated' as const, label: '통합운세', desc: '서양·사주·태국 흐름을 분리 계산해 비교', icon: Sparkles, tone: 'gold' },
  { key: 'compatibility' as const, label: '궁합운', desc: '두 사람의 관계 구조와 시기 흐름', icon: Heart, tone: 'rose' },
  { key: 'marriage' as const, label: '결혼운', desc: '현재 관계의 장기 결속과 주기 흐름', icon: Gem, tone: 'champagne' },
  { key: 'location' as const, label: '지역·국가운', desc: '나와 잘 맞는 국가·도시를 목적별로 비교', icon: MapPin, tone: 'sage' },
  { key: 'precision' as const, label: '정밀분석', desc: '세부 계산과 고급 점성 레이어', icon: Search, tone: 'sage' },
]

type HomeControlsProps = {
  birthProfile: BirthProfile
  hasProfile: boolean
  queryDate: string
  period: PeriodKey
  selectedTool: ToolKey | null
  apiStatus: ApiStatus
  apiLabel: string
  onOpenProfile: () => void
  onQueryDateChange: (date: string) => void
  onPeriodSelect: (period: PeriodKey, clearTool: boolean) => void
  onToolSelect: (tool: ToolKey) => void
}

export function HomeControls({
  birthProfile,
  hasProfile,
  queryDate,
  period,
  selectedTool,
  apiStatus,
  apiLabel,
  onOpenProfile,
  onQueryDateChange,
  onPeriodSelect,
  onToolSelect,
}: HomeControlsProps) {
  return <>
    <button className="profile-card" type="button" onClick={onOpenProfile}>
      <div className="profile-copy">
        <span className="eyebrow">MY BIRTH PROFILE</span>
        <strong>{hasProfile ? `${birthProfile.name || '나'}의 출생 프로필` : '나의 출생 프로필'}</strong>
        <span>{hasProfile ? `${birthProfile.birthDate} · ${birthProfile.birthTime} · 이 기기에 저장됨` : '정밀 계산에 사용할 출생정보를 먼저 저장해'}</span>
      </div>
      <ChevronDown size={20}/>
    </button>

    <section className="date-card">
      <label htmlFor="query-date">운세 기준 날짜</label>
      <div className="date-control">
        <CalendarDays size={19}/>
        <input id="query-date" type="date" value={queryDate} onChange={(event) => onQueryDateChange(event.target.value)}/>
      </div>
    </section>

    <section className="section-block period-fortune-section">
      <div className="section-label">기간 운세</div>
      <div className="period-grid" role="tablist" aria-label="기간 운세">
        {fortunePeriods.map(({ key, label, icon: Icon }) => {
          const active = selectedTool === null && period === key
          return <button aria-selected={active} className={`period-button ${active ? 'is-active' : ''}`} key={key} role="tab" type="button" onClick={() => onPeriodSelect(key, true)}>
            <Icon size={17}/><span>{label}</span>
          </button>
        })}
      </div>
    </section>

    {selectedTool === 'precision' && <section className="section-block precision-period-range">
      <div className="section-label">정밀분석 기간 선택</div>
      <div className="period-grid" role="tablist" aria-label="정밀분석 기간">
        {fortunePeriods.map(({ key, label, icon: Icon }) => <button aria-selected={period === key} className={`period-button ${period === key ? 'is-active' : ''}`} key={key} role="tab" type="button" onClick={() => onPeriodSelect(key, false)}>
          <Icon size={17}/><span>{label}</span>
        </button>)}
      </div>
    </section>}

    <section className="section-block tools-section">
      <div className="section-heading-row"><div className="section-label">분석 도구</div><span className={`server-pill ${apiStatus}`}>{apiLabel}</span></div>
      <div className="tool-grid">
        {analysisTools.map(({ key, label, desc, icon: Icon, tone }) => <button aria-pressed={selectedTool === key} className={`tool-card ${selectedTool === key ? 'is-selected' : ''}`} key={key} type="button" onClick={() => onToolSelect(key)}>
          <span className={`tool-icon tone-${tone}`}><Icon size={24}/></span><strong>{label}</strong><span>{desc}</span>
        </button>)}
      </div>
    </section>
  </>
}
