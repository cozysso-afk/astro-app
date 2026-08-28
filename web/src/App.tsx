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
type ApiStatus = 'warming' | 'online' | 'offline'
type MainView = 'home' | 'profile' | 'history' | 'settings'
type ToolKey = 'integrated' | 'compatibility' | 'marriage' | 'precision'

const periods = [
  { key: 'today' as const, label: '오늘', icon: Sun },
  { key: 'week' as const, label: '주간', icon: CalendarDays },
  { key: 'month' as const, label: '월간', icon: Moon },
  { key: 'year' as const, label: '연간', icon: Orbit },
]

const tools = [
  { key: 'integrated' as const, label: '통합운세', desc: '서양·사주·태국 흐름을 분리 계산해 비교', icon: Sparkles, tone: 'gold' },
  { key: 'compatibility' as const, label: '궁합운', desc: '두 사람의 관계 구조와 시기 흐름', icon: Heart, tone: 'rose' },
  { key: 'marriage' as const, label: '결혼운', desc: '미혼·연애·기혼 모두를 위한 장기 관계 주기', icon: Gem, tone: 'champagne' },
  { key: 'precision' as const, label: '정밀분석', desc: '세부 계산과 고급 점성 레이어', icon: Search, tone: 'sage' },
]

const relationshipModes = [
  ['single', '솔로'],
  ['dating', '연애중'],
  ['long_term', '장기커플'],
  ['cohabiting', '동거'],
  ['engaged', '약혼'],
  ['married', '기혼'],
] as const

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
  const [apiVersion, setApiVersion] = useState('')
  const [mainView, setMainView] = useState<MainView>('home')
  const [selectedTool, setSelectedTool] = useState<ToolKey | null>(null)
  const [relationshipMode, setRelationshipMode] = useState('dating')

  useEffect(() => {
    let cancelled = false

    fetch(`${API_BASE}/health`)
      .then((response) => {
        if (!response.ok) throw new Error('health check failed')
        return response.json()
      })
      .then((payload) => {
        if (cancelled) return
        setApiStatus('online')
        setApiVersion(String(payload.version ?? ''))
      })
      .catch(() => {
        if (!cancelled) setApiStatus('offline')
      })

    return () => {
      cancelled = true
    }
  }, [])

  const apiLabel = useMemo(() => {
    if (apiStatus === 'warming') return '계산 서버 깨우는 중'
    if (apiStatus === 'online') return apiVersion ? `계산 서버 연결됨 · ${apiVersion}` : '계산 서버 연결됨'
    return '계산 서버 대기 중'
  }, [apiStatus, apiVersion])

  const selectedToolInfo = selectedTool ? tools.find((tool) => tool.key === selectedTool) : null

  const switchMainView = (view: MainView) => {
    setMainView(view)
    if (view !== 'home') setSelectedTool(null)
  }

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
            <div className="hero-sigil" aria-hidden="true"><Moon size={24} strokeWidth={1.7} /></div>
            <div>
              <h1>별빛의 운명</h1>
              <p>시간의 흐름과 삶의 패턴을 읽는 개인 관측실</p>
            </div>
          </div>
        </section>

        {mainView === 'home' && (
          <>
            <button className="profile-card" type="button" onClick={() => switchMainView('profile')}>
              <div className="profile-copy">
                <span className="eyebrow">MY BIRTH PROFILE</span>
                <strong>나의 출생 프로필</strong>
                <span>프로필 저장·동기화는 Supabase 연결 단계에서 활성화해</span>
              </div>
              <ChevronDown size={20} strokeWidth={1.8} />
            </button>

            <section className="date-card">
              <label htmlFor="query-date">운세 기준 날짜</label>
              <div className="date-control">
                <CalendarDays size={19} strokeWidth={1.8} />
                <input id="query-date" type="date" value={queryDate} onChange={(event) => setQueryDate(event.target.value)} />
              </div>
            </section>

            <section className="section-block">
              <div className="section-label">기간 선택</div>
              <div className="period-grid" role="tablist" aria-label="기간 선택">
                {periods.map(({ key, label, icon: Icon }) => (
                  <button key={key} className={`period-button ${period === key ? 'is-active' : ''}`} type="button" onClick={() => setPeriod(key)}>
                    <Icon size={17} strokeWidth={1.9} /><span>{label}</span>
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
                {tools.map(({ key, label, desc, icon: Icon, tone }) => (
                  <button key={key} className="tool-card" type="button" onClick={() => setSelectedTool(key)}>
                    <span className={`tool-icon tone-${tone}`}><Icon size={24} strokeWidth={1.75} /></span>
                    <strong>{label}</strong><span>{desc}</span>
                  </button>
                ))}
              </div>
            </section>

            {selectedToolInfo && (
              <section className="report-card">
                <div className="report-icon">
                  {selectedTool === 'marriage' ? <Gem size={21} strokeWidth={1.8} /> : selectedTool === 'compatibility' ? <Heart size={21} strokeWidth={1.8} /> : <Sparkles size={21} strokeWidth={1.8} />}
                </div>
                <div className="report-copy">
                  <span className="eyebrow">{selectedToolInfo.key.toUpperCase()}</span>
                  <strong>{selectedToolInfo.label}</strong>
                  {selectedTool === 'marriage' ? (
                    <>
                      <p>결혼 전뿐 아니라 이미 결혼한 사람도 볼 수 있게 현재 관계 상태를 기준으로 해석해.</p>
                      <p>{relationshipModes.map(([value, label]) => `${relationshipMode === value ? '●' : '○'} ${label}`).join('  ·  ')}</p>
                      <select value={relationshipMode} onChange={(event) => setRelationshipMode(event.target.value)} aria-label="관계 상태">
                        {relationshipModes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                      <p>Render에는 정밀 관계 점성 API가 연결됐어. 다음 단계에서 상대 프로필 입력폼과 실제 결과 카드를 이 화면에 붙여.</p>
                    </>
                  ) : selectedTool === 'compatibility' ? (
                    <p>시너스트리·진행 시너스트리·진행 컴포짓·다빈슨·마크스 계열을 계산하는 실제 API가 연결됐어. 상대 프로필 UI를 다음으로 붙여.</p>
                  ) : selectedTool === 'integrated' ? (
                    <p>통합운세는 기존 서양점성술·사주 계산값을 API로 분리한 뒤 체계별 결과를 섞지 않고 비교하도록 연결할 예정이야.</p>
                  ) : (
                    <p>정밀분석은 원자료·접점·하우스·진행 레이어를 상세 카드로 펼치는 화면으로 연결해.</p>
                  )}
                </div>
              </section>
            )}

            <section className="report-card">
              <div className="report-icon"><Moon size={21} strokeWidth={1.8} /></div>
              <div className="report-copy">
                <span className="eyebrow">DAILY CELESTIAL REPORT</span>
                <strong>{period === 'today' ? '오늘의 리포트' : `${periods.find((item) => item.key === period)?.label} 리포트`}</strong>
                <p>운세 기준일 {queryDate}. 기간별 기존 계산엔진은 현재 API 분리 작업 중이야.</p>
              </div>
            </section>
          </>
        )}

        {mainView === 'profile' && <section className="report-card"><div className="report-icon"><User size={21} /></div><div className="report-copy"><span className="eyebrow">PROFILE</span><strong>내정보</strong><p>출생 프로필을 Supabase에 안전하게 저장·동기화하는 화면을 다음 단계에서 연결해.</p></div></section>}
        {mainView === 'history' && <section className="report-card"><div className="report-icon"><History size={21} /></div><div className="report-copy"><span className="eyebrow">ARCHIVE</span><strong>기록</strong><p>운세·궁합·결혼운 결과 저장함과 공유 링크가 들어갈 자리야.</p></div></section>}
        {mainView === 'settings' && <section className="report-card"><div className="report-icon"><Settings size={21} /></div><div className="report-copy"><span className="eyebrow">SETTINGS</span><strong>설정</strong><p>AI 해석 모델, 개인정보, 알림, 앱 설정을 이곳으로 분리해.</p></div></section>}
      </main>

      <nav className="bottom-nav" aria-label="하단 탐색">
        <button className={`nav-item ${mainView === 'home' ? 'is-active' : ''}`} type="button" onClick={() => switchMainView('home')}><Home size={20} strokeWidth={1.9} /><span>홈</span></button>
        <button className={`nav-item ${mainView === 'profile' ? 'is-active' : ''}`} type="button" onClick={() => switchMainView('profile')}><User size={20} strokeWidth={1.9} /><span>내정보</span></button>
        <button className={`nav-item ${mainView === 'history' ? 'is-active' : ''}`} type="button" onClick={() => switchMainView('history')}><History size={20} strokeWidth={1.9} /><span>기록</span></button>
        <button className={`nav-item ${mainView === 'settings' ? 'is-active' : ''}`} type="button" onClick={() => switchMainView('settings')}><Settings size={20} strokeWidth={1.9} /><span>설정</span></button>
      </nav>
    </div>
  )
}
