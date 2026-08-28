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

type PlacePreset = {
  key: string
  region: string
  label: string
  lat: string
  lon: string
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

const placePresets: PlacePreset[] = [
  { key: 'seoul', region: '서울특별시', label: '서울', lat: '37.5665', lon: '126.9780' },
  { key: 'busan', region: '부산광역시', label: '부산', lat: '35.1796', lon: '129.0756' },
  { key: 'daegu', region: '대구광역시', label: '대구', lat: '35.8714', lon: '128.6014' },
  { key: 'incheon', region: '인천광역시', label: '인천', lat: '37.4563', lon: '126.7052' },
  { key: 'gwangju', region: '광주광역시', label: '광주', lat: '35.1595', lon: '126.8526' },
  { key: 'daejeon', region: '대전광역시', label: '대전', lat: '36.3504', lon: '127.3845' },
  { key: 'ulsan', region: '울산광역시', label: '울산', lat: '35.5384', lon: '129.3114' },
  { key: 'sejong', region: '세종특별자치시', label: '세종', lat: '36.4800', lon: '127.2890' },

  { key: 'suwon', region: '경기도', label: '수원', lat: '37.2636', lon: '127.0286' },
  { key: 'seongnam', region: '경기도', label: '성남', lat: '37.4200', lon: '127.1267' },
  { key: 'goyang', region: '경기도', label: '고양', lat: '37.6584', lon: '126.8320' },
  { key: 'yongin', region: '경기도', label: '용인', lat: '37.2411', lon: '127.1776' },
  { key: 'bucheon', region: '경기도', label: '부천', lat: '37.5034', lon: '126.7660' },
  { key: 'ansan', region: '경기도', label: '안산', lat: '37.3219', lon: '126.8309' },
  { key: 'anyang', region: '경기도', label: '안양', lat: '37.3943', lon: '126.9568' },
  { key: 'pyeongtaek', region: '경기도', label: '평택', lat: '36.9921', lon: '127.1129' },
  { key: 'hwaseong', region: '경기도', label: '화성', lat: '37.1995', lon: '126.8312' },
  { key: 'namyangju', region: '경기도', label: '남양주', lat: '37.6360', lon: '127.2165' },
  { key: 'uijeongbu', region: '경기도', label: '의정부', lat: '37.7381', lon: '127.0337' },
  { key: 'paju', region: '경기도', label: '파주', lat: '37.7599', lon: '126.7800' },
  { key: 'gimpo', region: '경기도', label: '김포', lat: '37.6152', lon: '126.7156' },
  { key: 'gwangju-gyeonggi', region: '경기도', label: '광주(경기)', lat: '37.4294', lon: '127.2550' },
  { key: 'icheon', region: '경기도', label: '이천', lat: '37.2720', lon: '127.4350' },
  { key: 'anseong', region: '경기도', label: '안성', lat: '37.0080', lon: '127.2797' },

  { key: 'chuncheon', region: '강원특별자치도', label: '춘천', lat: '37.8813', lon: '127.7298' },
  { key: 'wonju', region: '강원특별자치도', label: '원주', lat: '37.3422', lon: '127.9202' },
  { key: 'gangneung', region: '강원특별자치도', label: '강릉', lat: '37.7519', lon: '128.8761' },
  { key: 'sokcho', region: '강원특별자치도', label: '속초', lat: '38.2070', lon: '128.5918' },
  { key: 'donghae', region: '강원특별자치도', label: '동해', lat: '37.5247', lon: '129.1143' },
  { key: 'samcheok', region: '강원특별자치도', label: '삼척', lat: '37.4499', lon: '129.1652' },
  { key: 'taebaek', region: '강원특별자치도', label: '태백', lat: '37.1641', lon: '128.9856' },

  { key: 'cheongju', region: '충청북도', label: '청주', lat: '36.6424', lon: '127.4890' },
  { key: 'chungju', region: '충청북도', label: '충주', lat: '36.9910', lon: '127.9259' },
  { key: 'jecheon', region: '충청북도', label: '제천', lat: '37.1326', lon: '128.1910' },

  { key: 'cheonan', region: '충청남도', label: '천안', lat: '36.8151', lon: '127.1139' },
  { key: 'gongju', region: '충청남도', label: '공주', lat: '36.4465', lon: '127.1190' },
  { key: 'boryeong', region: '충청남도', label: '보령', lat: '36.3333', lon: '126.6128' },
  { key: 'asan', region: '충청남도', label: '아산', lat: '36.7898', lon: '127.0018' },
  { key: 'seosan', region: '충청남도', label: '서산', lat: '36.7845', lon: '126.4503' },
  { key: 'nonsan', region: '충청남도', label: '논산', lat: '36.1872', lon: '127.0987' },
  { key: 'dangjin', region: '충청남도', label: '당진', lat: '36.8897', lon: '126.6459' },

  { key: 'jeonju', region: '전북특별자치도', label: '전주', lat: '35.8242', lon: '127.1480' },
  { key: 'gunsan', region: '전북특별자치도', label: '군산', lat: '35.9677', lon: '126.7369' },
  { key: 'iksan', region: '전북특별자치도', label: '익산', lat: '35.9483', lon: '126.9576' },
  { key: 'jeongeup', region: '전북특별자치도', label: '정읍', lat: '35.5699', lon: '126.8559' },
  { key: 'namwon', region: '전북특별자치도', label: '남원', lat: '35.4164', lon: '127.3903' },
  { key: 'gimje', region: '전북특별자치도', label: '김제', lat: '35.8036', lon: '126.8807' },

  { key: 'mokpo', region: '전라남도', label: '목포', lat: '34.8118', lon: '126.3922' },
  { key: 'yeosu', region: '전라남도', label: '여수', lat: '34.7604', lon: '127.6622' },
  { key: 'suncheon', region: '전라남도', label: '순천', lat: '34.9506', lon: '127.4872' },
  { key: 'naju', region: '전라남도', label: '나주', lat: '35.0159', lon: '126.7108' },
  { key: 'gwangyang', region: '전라남도', label: '광양', lat: '34.9407', lon: '127.6959' },

  { key: 'pohang', region: '경상북도', label: '포항', lat: '36.0190', lon: '129.3435' },
  { key: 'gyeongju', region: '경상북도', label: '경주', lat: '35.8562', lon: '129.2247' },
  { key: 'gimcheon', region: '경상북도', label: '김천', lat: '36.1398', lon: '128.1136' },
  { key: 'andong', region: '경상북도', label: '안동', lat: '36.5684', lon: '128.7294' },
  { key: 'gumi', region: '경상북도', label: '구미', lat: '36.1195', lon: '128.3446' },
  { key: 'yeongju', region: '경상북도', label: '영주', lat: '36.8057', lon: '128.6240' },
  { key: 'yeongcheon', region: '경상북도', label: '영천', lat: '35.9733', lon: '128.9386' },
  { key: 'sangju', region: '경상북도', label: '상주', lat: '36.4109', lon: '128.1590' },
  { key: 'mungyeong', region: '경상북도', label: '문경', lat: '36.5861', lon: '128.1868' },
  { key: 'gyeongsan', region: '경상북도', label: '경산', lat: '35.8251', lon: '128.7415' },

  { key: 'changwon', region: '경상남도', label: '창원', lat: '35.2279', lon: '128.6811' },
  { key: 'jinju', region: '경상남도', label: '진주', lat: '35.1800', lon: '128.1076' },
  { key: 'tongyeong', region: '경상남도', label: '통영', lat: '34.8544', lon: '128.4331' },
  { key: 'sacheon', region: '경상남도', label: '사천', lat: '35.0038', lon: '128.0642' },
  { key: 'gimhae', region: '경상남도', label: '김해', lat: '35.2285', lon: '128.8894' },
  { key: 'miryang', region: '경상남도', label: '밀양', lat: '35.5038', lon: '128.7466' },
  { key: 'geoje', region: '경상남도', label: '거제', lat: '34.8806', lon: '128.6210' },
  { key: 'yangsan', region: '경상남도', label: '양산', lat: '35.3350', lon: '129.0373' },

  { key: 'jeju', region: '제주특별자치도', label: '제주', lat: '33.4996', lon: '126.5312' },
  { key: 'seogwipo', region: '제주특별자치도', label: '서귀포', lat: '33.2541', lon: '126.5601' },
]

const placeRegions = Array.from(new Set(placePresets.map((place) => place.region)))

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

function BirthplaceOptions() {
  return (
    <>
      <option value="">직접 입력 / 해외 / 목록에 없음</option>
      {placeRegions.map((region) => (
        <optgroup key={region} label={region}>
          {placePresets.filter((place) => place.region === region).map((place) => (
            <option key={place.key} value={place.key}>{place.label}</option>
          ))}
        </optgroup>
      ))}
    </>
  )
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
  return { ...profile, placeKey, latitude: place.lat, longitude: place.lon, utcOffset: '9' }
}

function selectedPlaceLabel(placeKey: string) {
  const place = placePresets.find((item) => item.key === placeKey)
  return place ? `${place.region} · ${place.label}` : ''
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
                <span>{hasProfile ? `${birthProfile.birthDate} · ${birthProfile.birthTime}${birthProfile.placeKey ? ` · ${selectedPlaceLabel(birthProfile.placeKey)}` : ''} · 이 기기에 저장됨` : '정밀 계산에 사용할 출생정보를 먼저 저장해'}</span>
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
                    <span>출생지역 선택 · 좌표 자동 입력</span>
                    <select value={counterpart.placeKey} disabled={!counterpart.timeKnown} onChange={(event) => setCounterpart(applyPlace(counterpart, event.target.value))}>
                      <BirthplaceOptions />
                    </select>
                  </label>
                  <details className="advanced-panel field-wide">
                    <summary>고급 위치 설정 · 위도/경도 직접 수정</summary>
                    <div className="advanced-grid">
                      <label className="field">
                        <span>위도</span>
                        <input inputMode="decimal" value={counterpart.latitude} disabled={!counterpart.timeKnown} onChange={(event) => setCounterpart({ ...counterpart, latitude: event.target.value, placeKey: '' })} placeholder="자동 입력" />
                      </label>
                      <label className="field">
                        <span>경도</span>
                        <input inputMode="decimal" value={counterpart.longitude} disabled={!counterpart.timeKnown} onChange={(event) => setCounterpart({ ...counterpart, longitude: event.target.value, placeKey: '' })} placeholder="자동 입력" />
                      </label>
                      <label className="field field-wide">
                        <span>UTC(협정세계시) 시차</span>
                        <input inputMode="decimal" value={counterpart.utcOffset} disabled={!counterpart.timeKnown} onChange={(event) => setCounterpart({ ...counterpart, utcOffset: event.target.value })} placeholder="한국은 9" />
                      </label>
                    </div>
                  </details>
                </div>

                <div className="coordinate-note"><MapPin size={16} /><span>국내 지역을 선택하면 위도·경도와 UTC +9를 자동으로 넣어. 숫자를 직접 입력할 필요는 없어. 해외·목록 외 지역만 고급 위치 설정을 사용하면 돼.</span></div>

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
              <label className="field field-wide"><span>출생지역 선택 · 좌표 자동 입력</span><select value={birthProfile.placeKey} onChange={(event) => setBirthProfile(applyPlace(birthProfile, event.target.value))}><BirthplaceOptions /></select></label>

              <details className="advanced-panel field-wide">
                <summary>고급 위치 설정 · 위도/경도 직접 수정</summary>
                <div className="advanced-grid">
                  <label className="field"><span>위도</span><input inputMode="decimal" value={birthProfile.latitude} onChange={(event) => setBirthProfile({ ...birthProfile, latitude: event.target.value, placeKey: '' })} placeholder="지역 선택 시 자동 입력" /></label>
                  <label className="field"><span>경도</span><input inputMode="decimal" value={birthProfile.longitude} onChange={(event) => setBirthProfile({ ...birthProfile, longitude: event.target.value, placeKey: '' })} placeholder="지역 선택 시 자동 입력" /></label>
                  <label className="field field-wide"><span>UTC(협정세계시) 시차</span><input inputMode="decimal" value={birthProfile.utcOffset} onChange={(event) => setBirthProfile({ ...birthProfile, utcOffset: event.target.value })} placeholder="한국은 9" /></label>
                </div>
              </details>
            </div>

            <div className="coordinate-note"><MapPin size={16} /><span>국내 출생지역을 고르면 좌표와 UTC +9가 자동 입력돼. 위도·경도를 직접 칠 필요 없어. 좌표가 없으면 기본 행성 궁합은 가능하지만 상승점·하우스·다빈슨·마크스 같은 위치 기반 정밀 레이어는 제한돼.</span></div>

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
