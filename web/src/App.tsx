import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Gem,
  Heart,
  History,
  Home,
  LoaderCircle,
  MapPin,
  Moon,
  Orbit,
  Save,
  Search,
  Settings,
  Sparkles,
  Sun,
  User,
} from 'lucide-react'

const DEFAULT_API_BASE = 'https://astro-app-api-f7fn.onrender.com'
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE).replace(/\/$/, '')
const PROFILE_STORAGE_KEY = 'starlight-destiny.birth-profile.v1'

type PeriodKey = 'today' | 'week' | 'month' | 'year'
type ApiStatus = 'warming' | 'online' | 'offline'
type MainView = 'home' | 'profile' | 'history' | 'settings'
type ToolKey = 'integrated' | 'compatibility' | 'marriage' | 'precision'
type RelationshipStatus = 'single' | 'dating' | 'long_term' | 'cohabiting' | 'engaged' | 'married'

type BirthProfile = {
  name: string
  birthDate: string
  birthTime: string
  placeKey: string
  latitude: string
  longitude: string
  utcOffset: string
}

type CounterpartProfile = BirthProfile & {
  timeKnown: boolean
}

type Aspect = {
  a: string
  aspect: string
  b: string
  orb: number
  tone: 'supportive' | 'challenging' | 'mixed'
  layer?: string
}

type SignalSummary = {
  exact_contacts: number
  supportive_contacts: number
  challenging_contacts: number
  tightest: Aspect[]
}

type RelationshipMonth = {
  calendar_month: string
  representative_date: string
  signal_summary: SignalSummary
}

type RelationshipApiResponse = {
  ok: boolean
  api_version: string
  engine: string
  relationship_status: RelationshipStatus
  period: { start: string; end: string; month_segments: number }
  result: {
    limitations?: string[]
    natal_synastry?: { available: boolean; partner_time_exact: boolean; aspects: Aspect[]; note?: string }
    davison?: { available: boolean; reason?: string }
    marks?: { available: boolean; reason?: string }
    months?: RelationshipMonth[]
  }
}

const periods = [
  { key: 'today' as const, label: '오늘', icon: Sun },
  { key: 'week' as const, label: '주간', icon: CalendarDays },
  { key: 'month' as const, label: '월간', icon: Moon },
  { key: 'year' as const, label: '연간', icon: Orbit },
]

const tools = [
  { key: 'integrated' as const, label: '통합운세', desc: '서양·사주·태국 흐름을 분리 계산해 비교', icon: Sparkles, tone: 'gold' },
  { key: 'compatibility' as const, label: '궁합운', desc: '두 사람의 관계 구조와 시기 흐름', icon: Heart, tone: 'rose' },
  { key: 'marriage' as const, label: '결혼운', desc: '현재 관계의 장기 결속과 주기 흐름', icon: Gem, tone: 'champagne' },
  { key: 'precision' as const, label: '정밀분석', desc: '세부 계산과 고급 점성 레이어', icon: Search, tone: 'sage' },
]

const relationshipModes: Array<[RelationshipStatus, string]> = [
  ['single', '솔로'],
  ['dating', '연애중'],
  ['long_term', '장기커플'],
  ['cohabiting', '동거'],
  ['engaged', '약혼'],
  ['married', '기혼'],
]

const placePresets = [
  { key: '', label: '직접 입력 / 선택 안 함', lat: '', lon: '' },
  { key: 'seoul', label: '서울', lat: '37.5665', lon: '126.9780' },
  { key: 'busan', label: '부산', lat: '35.1796', lon: '129.0756' },
  { key: 'daegu', label: '대구', lat: '35.8714', lon: '128.6014' },
  { key: 'incheon', label: '인천', lat: '37.4563', lon: '126.7052' },
  { key: 'gwangju', label: '광주', lat: '35.1595', lon: '126.8526' },
  { key: 'daejeon', label: '대전', lat: '36.3504', lon: '127.3845' },
  { key: 'ulsan', label: '울산', lat: '35.5384', lon: '129.3114' },
  { key: 'suwon', label: '수원', lat: '37.2636', lon: '127.0286' },
  { key: 'jeju', label: '제주', lat: '33.4996', lon: '126.5312' },
  { key: 'yeosu', label: '여수', lat: '34.7604', lon: '127.6622' },
  { key: 'pyeongtaek', label: '평택', lat: '36.9921', lon: '127.1129' },
]

const emptyProfile: BirthProfile = {
  name: '',
  birthDate: '',
  birthTime: '',
  placeKey: '',
  latitude: '',
  longitude: '',
  utcOffset: '9',
}

const emptyCounterpart: CounterpartProfile = {
  ...emptyProfile,
  timeKnown: true,
}

const planetLabels: Record<string, string> = {
  Sun: '태양', Moon: '달', Mercury: '수성', Venus: '금성', Mars: '화성', Jupiter: '목성', Saturn: '토성',
  Uranus: '천왕성', Neptune: '해왕성', Pluto: '명왕성', 'True Node': '진북교점', ASC: '상승점', DSC: '하강점', MC: '중천점', IC: '천저점',
}

const aspectLabels: Record<string, string> = {
  conjunction: '합', sextile: '육합', square: '사각', trine: '삼각', quincunx: '퀸컨스', opposition: '대립',
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`)
  date.setDate(date.getDate() + days)
  return toDateInputValue(date)
}

function periodEnd(start: string, period: PeriodKey) {
  if (period === 'today') return start
  if (period === 'week') return addDays(start, 6)
  if (period === 'month') return addDays(start, 30)
  return addDays(start, 364)
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const number = Number(trimmed)
  return Number.isFinite(number) ? number : null
}

function loadStoredProfile(): BirthProfile {
  if (typeof window === 'undefined') return emptyProfile
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY)
    if (!raw) return emptyProfile
    return { ...emptyProfile, ...(JSON.parse(raw) as Partial<BirthProfile>) }
  } catch {
    return emptyProfile
  }
}

function applyPlace<T extends BirthProfile>(profile: T, placeKey: string): T {
  const place = placePresets.find((item) => item.key === placeKey)
  if (!place) return { ...profile, placeKey }
  return { ...profile, placeKey, latitude: place.lat, longitude: place.lon }
}

function aspectText(aspect: Aspect) {
  const a = planetLabels[aspect.a] ?? aspect.a
  const b = planetLabels[aspect.b] ?? aspect.b
  const relation = aspectLabels[aspect.aspect] ?? aspect.aspect
  return `${a} · ${b} ${relation}`
}

export default function App() {
  const [period, setPeriod] = useState<PeriodKey>('today')
  const [queryDate, setQueryDate] = useState(() => toDateInputValue(new Date()))
  const [apiStatus, setApiStatus] = useState<ApiStatus>('warming')
  const [apiVersion, setApiVersion] = useState('')
  const [mainView, setMainView] = useState<MainView>('home')
  const [selectedTool, setSelectedTool] = useState<ToolKey | null>(null)
  const [relationshipMode, setRelationshipMode] = useState<RelationshipStatus>('dating')
  const [birthProfile, setBirthProfile] = useState<BirthProfile>(() => loadStoredProfile())
  const [profileSaved, setProfileSaved] = useState(false)
  const [counterpart, setCounterpart] = useState<CounterpartProfile>(emptyCounterpart)
  const [relationshipResult, setRelationshipResult] = useState<RelationshipApiResponse | null>(null)
  const [relationshipLoading, setRelationshipLoading] = useState(false)
  const [relationshipError, setRelationshipError] = useState('')

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
  const hasProfile = Boolean(birthProfile.birthDate && birthProfile.birthTime)
  const resultMonths = relationshipResult?.result?.months ?? []
  const natalAspects = relationshipResult?.result?.natal_synastry?.aspects ?? []

  const switchMainView = (view: MainView) => {
    setMainView(view)
    if (view !== 'home') setSelectedTool(null)
  }

  const saveBirthProfile = () => {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(birthProfile))
    setProfileSaved(true)
    window.setTimeout(() => setProfileSaved(false), 1800)
  }

  const runRelationship = async () => {
    setRelationshipError('')
    setRelationshipResult(null)

    if (!birthProfile.birthDate || !birthProfile.birthTime) {
      setRelationshipError('먼저 내정보에서 본인 생년월일과 출생시간을 저장해줘.')
      return
    }
    if (!counterpart.birthDate) {
      setRelationshipError('상대 생년월일은 반드시 필요해.')
      return
    }
    if (counterpart.timeKnown && !counterpart.birthTime) {
      setRelationshipError('상대 출생시간을 모르면 “출생시간 모름”을 체크해줘.')
      return
    }

    const startDate = queryDate
    const endDate = periodEnd(queryDate, period)
    const body = {
      user: {
        name: birthProfile.name || null,
        birth_date: birthProfile.birthDate,
        birth_time: birthProfile.birthTime,
        time_known: true,
        latitude: parseOptionalNumber(birthProfile.latitude),
        longitude: parseOptionalNumber(birthProfile.longitude),
        utc_offset_hours: Number(birthProfile.utcOffset || 9),
      },
      counterpart: {
        name: counterpart.name || null,
        birth_date: counterpart.birthDate,
        birth_time: counterpart.timeKnown ? counterpart.birthTime : null,
        time_known: counterpart.timeKnown,
        latitude: counterpart.timeKnown ? parseOptionalNumber(counterpart.latitude) : null,
        longitude: counterpart.timeKnown ? parseOptionalNumber(counterpart.longitude) : null,
        utc_offset_hours: Number(counterpart.utcOffset || 9),
      },
      start_date: startDate,
      end_date: endDate,
      relationship_status: relationshipMode,
    }

    setRelationshipLoading(true)
    try {
      const response = await fetch(`${API_BASE}/v1/relationship/western`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(typeof payload?.detail === 'string' ? payload.detail : '관계 계산 요청에 실패했어.')
      }
      setRelationshipResult(payload as RelationshipApiResponse)
    } catch (error) {
      setRelationshipError(error instanceof Error ? error.message : '관계 계산 중 오류가 발생했어.')
    } finally {
      setRelationshipLoading(false)
    }
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
                <strong>{hasProfile ? `${birthProfile.name || '나'}의 출생 프로필` : '나의 출생 프로필'}</strong>
                <span>{hasProfile ? `${birthProfile.birthDate} · ${birthProfile.birthTime} · 이 기기에 저장됨` : '정밀 계산에 사용할 출생정보를 먼저 저장해'}</span>
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
                  <button key={key} className={`tool-card ${selectedTool === key ? 'is-selected' : ''}`} type="button" onClick={() => setSelectedTool(key)}>
                    <span className={`tool-icon tone-${tone}`}><Icon size={24} strokeWidth={1.75} /></span>
                    <strong>{label}</strong><span>{desc}</span>
                  </button>
                ))}
              </div>
            </section>

            {selectedToolInfo && (selectedTool === 'compatibility' || selectedTool === 'marriage') && (
              <section className="tool-panel">
                <div className="tool-panel-heading">
                  <span className={`tool-icon ${selectedTool === 'compatibility' ? 'tone-rose' : 'tone-champagne'}`}>
                    {selectedTool === 'compatibility' ? <Heart size={22} /> : <Gem size={22} />}
                  </span>
                  <div>
                    <span className="eyebrow">LIVE RELATIONSHIP ENGINE</span>
                    <h2>{selectedToolInfo.label}</h2>
                    <p>{selectedTool === 'marriage' ? '결혼 여부를 단정하지 않고 두 사람의 장기 결속·협력·긴장 활성도를 계산해.' : '정적 궁합과 월별 진행 접점을 분리해서 보여줘.'}</p>
                  </div>
                </div>

                <div className="relationship-mode-row" role="group" aria-label="관계 상태">
                  {relationshipModes.map(([value, label]) => (
                    <button key={value} type="button" className={relationshipMode === value ? 'is-active' : ''} onClick={() => setRelationshipMode(value)}>{label}</button>
                  ))}
                </div>

                <div className="subsection-title">상대 출생정보</div>
                <div className="field-grid">
                  <label className="field field-wide">
                    <span>이름 / 구분명</span>
                    <input value={counterpart.name} onChange={(event) => setCounterpart({ ...counterpart, name: event.target.value })} placeholder="예: A, 상대방" autoComplete="off" />
                  </label>
                  <label className="field">
                    <span>생년월일</span>
                    <input type="date" value={counterpart.birthDate} onChange={(event) => setCounterpart({ ...counterpart, birthDate: event.target.value })} />
                  </label>
                  <label className="field">
                    <span>출생시간</span>
                    <input type="time" value={counterpart.birthTime} disabled={!counterpart.timeKnown} onChange={(event) => setCounterpart({ ...counterpart, birthTime: event.target.value })} />
                  </label>
                  <label className="check-field field-wide">
                    <input type="checkbox" checked={!counterpart.timeKnown} onChange={(event) => setCounterpart({ ...counterpart, timeKnown: !event.target.checked, birthTime: event.target.checked ? '' : counterpart.birthTime })} />
                    <span>상대 출생시간 모름 — 달·각도·다빈슨/마크스 일부 정밀 레이어는 자동 제외</span>
                  </label>
                  <label className="field field-wide">
                    <span>출생지 간편 선택</span>
                    <select value={counterpart.placeKey} disabled={!counterpart.timeKnown} onChange={(event) => setCounterpart(applyPlace(counterpart, event.target.value))}>
                      {placePresets.map((place) => <option key={place.key} value={place.key}>{place.label}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    <span>위도</span>
                    <input inputMode="decimal" value={counterpart.latitude} disabled={!counterpart.timeKnown} onChange={(event) => setCounterpart({ ...counterpart, latitude: event.target.value, placeKey: '' })} placeholder="35.1595" />
                  </label>
                  <label className="field">
                    <span>경도</span>
                    <input inputMode="decimal" value={counterpart.longitude} disabled={!counterpart.timeKnown} onChange={(event) => setCounterpart({ ...counterpart, longitude: event.target.value, placeKey: '' })} placeholder="126.8526" />
                  </label>
                </div>

                <div className="calculation-range">
                  <CalendarDays size={17} />
                  <span>{queryDate} → {periodEnd(queryDate, period)} · {periods.find((item) => item.key === period)?.label} 범위</span>
                </div>

                {relationshipError && <div className="status-banner error"><AlertTriangle size={17} /><span>{relationshipError}</span></div>}

                <button className="primary-button" type="button" onClick={runRelationship} disabled={relationshipLoading || apiStatus === 'offline'}>
                  {relationshipLoading ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}
                  <span>{relationshipLoading ? '정밀 계산 중…' : '실제 계산 실행'}</span>
                </button>

                {relationshipResult && (
                  <div className="results-wrap">
                    <div className="result-headline">
                      <CheckCircle2 size={20} />
                      <div><strong>실제 계산 완료</strong><span>{relationshipResult.engine} · {relationshipResult.period.month_segments}개 월 구간</span></div>
                    </div>

                    <section className="result-card">
                      <div className="result-card-title"><span>STATIC</span><strong>기본 관계 구조</strong></div>
                      <div className="metric-grid">
                        <div className="metric"><strong>{natalAspects.length}</strong><span>시너스트리 접점</span></div>
                        <div className="metric"><strong>{relationshipResult.result.davison?.available ? 'ON' : 'OFF'}</strong><span>다빈슨</span></div>
                        <div className="metric"><strong>{relationshipResult.result.marks?.available ? 'ON' : 'OFF'}</strong><span>마크스</span></div>
                      </div>
                      <div className="aspect-list">
                        {natalAspects.slice(0, 8).map((aspect, index) => (
                          <div className="aspect-row" key={`${aspect.a}-${aspect.aspect}-${aspect.b}-${index}`}>
                            <span className={`tone-dot ${aspect.tone}`} />
                            <div><strong>{aspectText(aspect)}</strong><span>오브 {aspect.orb.toFixed(2)}° · {aspect.tone === 'supportive' ? '조화' : aspect.tone === 'challenging' ? '긴장' : '혼합'}</span></div>
                          </div>
                        ))}
                      </div>
                    </section>

                    {resultMonths.length > 0 && (
                      <section className="result-card">
                        <div className="result-card-title"><span>TIMING</span><strong>기간별 활성도</strong></div>
                        <p className="result-note">접점 수는 사건 확률이나 좋고 나쁨 점수가 아니야. 여러 독립 레이어에서 반복되는 정밀 접점을 보는 용도야.</p>
                        <div className="month-list">
                          {resultMonths.map((month) => (
                            <div className="month-card" key={`${month.calendar_month}-${month.representative_date}`}>
                              <div className="month-title"><strong>{month.calendar_month}</strong><span>대표일 {month.representative_date}</span></div>
                              <div className="month-metrics">
                                <span><b>{month.signal_summary.exact_contacts}</b> 정밀</span>
                                <span><b>{month.signal_summary.supportive_contacts}</b> 조화</span>
                                <span><b>{month.signal_summary.challenging_contacts}</b> 긴장</span>
                              </div>
                              {month.signal_summary.tightest.slice(0, 3).map((aspect, index) => (
                                <div className="tight-row" key={`${month.calendar_month}-${index}`}>
                                  <span>{aspectText(aspect)}</span><b>{aspect.orb.toFixed(2)}°</b>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {(relationshipResult.result.limitations?.length ?? 0) > 0 && (
                      <div className="status-banner subtle"><AlertTriangle size={16} /><span>{relationshipResult.result.limitations?.join(' ')}</span></div>
                    )}
                  </div>
                )}
              </section>
            )}

            {selectedToolInfo && selectedTool === 'integrated' && (
              <section className="report-card">
                <div className="report-icon"><Sparkles size={21} /></div>
                <div className="report-copy"><span className="eyebrow">INTEGRATED</span><strong>통합운세</strong><p>관계 엔진은 실연결 완료. 기간별 서양점성술·사주 계산 API 분리가 다음 연결 대상이야.</p></div>
              </section>
            )}

            {selectedToolInfo && selectedTool === 'precision' && (
              <section className="report-card">
                <div className="report-icon"><Search size={21} /></div>
                <div className="report-copy"><span className="eyebrow">PRECISION</span><strong>정밀분석</strong><p>현재 궁합/결혼운 결과 카드에서 실제 정밀 접점까지 먼저 볼 수 있어. 독립 정밀분석 화면은 계산 API 분리 후 연결해.</p></div>
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

        {mainView === 'profile' && (
          <section className="form-card profile-form-card">
            <div className="form-card-heading">
              <div className="report-icon"><User size={21} /></div>
              <div><span className="eyebrow">MY BIRTH PROFILE</span><h2>내 출생 프로필</h2><p>정밀 계산에만 사용하고 이 브라우저 기기에 로컬 저장해.</p></div>
            </div>

            <div className="privacy-note"><CheckCircle2 size={16} /><span>현재 단계에서는 서버 계정 DB에 저장하지 않아. 공개 GitHub 코드에도 개인 출생정보를 넣지 않아.</span></div>

            <div className="field-grid">
              <label className="field field-wide"><span>이름 / 닉네임</span><input value={birthProfile.name} onChange={(event) => setBirthProfile({ ...birthProfile, name: event.target.value })} placeholder="선택 입력" autoComplete="off" /></label>
              <label className="field"><span>생년월일</span><input type="date" value={birthProfile.birthDate} onChange={(event) => setBirthProfile({ ...birthProfile, birthDate: event.target.value })} /></label>
              <label className="field"><span>출생시간</span><input type="time" value={birthProfile.birthTime} onChange={(event) => setBirthProfile({ ...birthProfile, birthTime: event.target.value })} /></label>
              <label className="field field-wide"><span>출생지 간편 선택</span><select value={birthProfile.placeKey} onChange={(event) => setBirthProfile(applyPlace(birthProfile, event.target.value))}>{placePresets.map((place) => <option key={place.key} value={place.key}>{place.label}</option>)}</select></label>
              <label className="field"><span>위도</span><input inputMode="decimal" value={birthProfile.latitude} onChange={(event) => setBirthProfile({ ...birthProfile, latitude: event.target.value, placeKey: '' })} placeholder="37.5665" /></label>
              <label className="field"><span>경도</span><input inputMode="decimal" value={birthProfile.longitude} onChange={(event) => setBirthProfile({ ...birthProfile, longitude: event.target.value, placeKey: '' })} placeholder="126.9780" /></label>
              <label className="field field-wide"><span>UTC(협정세계시) 시차</span><input inputMode="decimal" value={birthProfile.utcOffset} onChange={(event) => setBirthProfile({ ...birthProfile, utcOffset: event.target.value })} placeholder="한국은 9" /></label>
            </div>

            <div className="coordinate-note"><MapPin size={16} /><span>위도·경도가 없으면 기본 시너스트리는 계산되지만 다빈슨·마크스 같은 위치 기반 정밀 레이어는 제한돼.</span></div>

            <button className="primary-button" type="button" onClick={saveBirthProfile}><Save size={18} /><span>{profileSaved ? '이 기기에 저장 완료' : '이 기기에 프로필 저장'}</span></button>
          </section>
        )}

        {mainView === 'history' && (
          <section className="report-card"><div className="report-icon"><History size={21} /></div><div className="report-copy"><span className="eyebrow">ARCHIVE</span><strong>기록</strong><p>{relationshipResult ? '이번 세션의 최근 관계 계산 결과는 홈의 궁합/결혼운 카드에 남아 있어. 영구 저장은 Supabase 연결 단계에서 별도로 붙일게.' : '아직 저장된 분석 기록이 없어. 계정 기반 기록 저장은 Supabase 연결 단계에서 활성화해.'}</p></div></section>
        )}
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
