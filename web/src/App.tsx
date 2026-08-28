import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  ChevronDown,
  Gem,
  Heart,
  History,
  Home,
  Moon,
  Orbit,
  Search,
  Settings,
  Sparkles,
  Sun,
  User,
} from 'lucide-react'

const DEFAULT_API_BASE = 'https://astro-app-api-f7fn.onrender.com'
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE).replace(/\/$/, '')

type PeriodKey = 'today' | 'week' | 'month' | 'year'

type ApiStatus = 'idle' | 'warming' | 'online' | 'offline'

const periods = [
  { key: 'today' as const, label: '오늘', icon: Sun },
  { key: 'week' as const, label: '주간', icon: CalendarDays },
  { key: 'month' as const, label: '월간', icon: Moon },
  { key: 'year' as const, label: '연간', icon: Orbit },
]

const tools = [
  { label: '통합운세', desc: '여러 체계의 흐름을 한눈에', icon: Sparkles, tone: 'gold' },
  { label: '궁합운', desc: '두 사람의 관계 구조와 흐름', icon: Heart, tone: 'rose' },
  { label: '결혼운', desc: '미혼·연애·기혼 모두를 위한 관계 주기', icon: Gem, tone: 'champagne' },
  { label: '정밀분석', desc: '세부 계산과 고급 레이어', icon: Search, tone: 'sage' },
]

function toDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function App() {
  const [period, setPeriod] = useState<PeriodKey>('today')
  const [queryDate, setQueryDate] = useState(() => toDateInputValue(new Date()))
  const [apiStatus, setApiStatus] = useState<ApiStatus>('warming')

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${API_BASE}/health`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('health check failed')
        return response.json()
      })
      .then(() => setApiStatus('online'))
      .catch((error) => {
        if (error?.name !== 'AbortError') setApiStatus('offline')
      })

    return () => controller.abort()
  }, [])

  const apiLabel = useMemo(() => {
    if (apiStatus === 'warming') return '계산 서버 깨우는 중'
    if (apiStatus === 'online') return '계산 서버 연결됨'
    if (apiStatus === 'offline') return '계산 서버 대기 중'
    return '계산 서버 준비'
  }, [apiStatus])

  return (
    <div className="app-shell">
      <main className="page-content">
        <section className="hero-card">
          <div className="hero-orbit hero-orbit-a" />
          <div className="hero-orbit hero-orbit-b" />
          <div className="hero-star hero-star-a" />
          <div className="hero-star hero-star-b" />

          <div className="hero-kicker">CELESTIAL OBSERVATORY</div>
          <div className="hero-row">
            <div className="hero-sigil" aria-hidden="true">
              <Moon size={24} strokeWidth={1.7} />
            </div>
            <div>
              <h1>별빛의 운명</h1>
              <p>시간의 흐름과 삶의 패턴을 읽는 개인 관측실</p>
            </div>
          </div>
        </section>

        <button className="profile-card" type="button">
          <div className="profile-copy">
            <span className="eyebrow">MY BIRTH PROFILE</span>
            <strong>나의 출생 프로필</strong>
            <span>프로필 연결 후 출생정보와 상승점을 표시해</span>
          </div>
          <ChevronDown size={20} strokeWidth={1.8} />
        </button>

        <section className="date-card">
          <label htmlFor="query-date">운세 기준 날짜</label>
          <div className="date-control">
            <CalendarDays size={19} strokeWidth={1.8} />
            <input
              id="query-date"
              type="date"
              value={queryDate}
              onChange={(event) => setQueryDate(event.target.value)}
            />
          </div>
        </section>

        <section className="section-block">
          <div className="section-label">기간 선택</div>
          <div className="period-grid" role="tablist" aria-label="기간 선택">
            {periods.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                className={`period-button ${period === key ? 'is-active' : ''}`}
                type="button"
                onClick={() => setPeriod(key)}
              >
                <Icon size={17} strokeWidth={1.9} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="section-block tools-section">
          <div className="section-heading-row">
            <div className="section-label">분석 도구</div>
            <span className={`server-pill ${apiStatus}`}>{apiLabel}</span>
          </div>
          <div className="tool-grid">
            {tools.map(({ label, desc, icon: Icon, tone }) => (
              <button key={label} className="tool-card" type="button">
                <span className={`tool-icon tone-${tone}`}>
                  <Icon size={24} strokeWidth={1.75} />
                </span>
                <strong>{label}</strong>
                <span>{desc}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="report-card">
          <div className="report-icon">
            <Moon size={21} strokeWidth={1.8} />
          </div>
          <div className="report-copy">
            <span className="eyebrow">DAILY CELESTIAL REPORT</span>
            <strong>오늘의 리포트</strong>
            <p>새 계산 API 연결 후 기존 별빛 결과를 이 카드형 화면으로 옮길 거야.</p>
          </div>
        </section>
      </main>

      <nav className="bottom-nav" aria-label="하단 탐색">
        <button className="nav-item is-active" type="button">
          <Home size={20} strokeWidth={1.9} />
          <span>홈</span>
        </button>
        <button className="nav-item" type="button">
          <User size={20} strokeWidth={1.9} />
          <span>내정보</span>
        </button>
        <button className="nav-item" type="button">
          <History size={20} strokeWidth={1.9} />
          <span>기록</span>
        </button>
        <button className="nav-item" type="button">
          <Settings size={20} strokeWidth={1.9} />
          <span>설정</span>
        </button>
      </nav>
    </div>
  )
}
