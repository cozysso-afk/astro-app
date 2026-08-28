import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, CalendarDays, CheckCircle2, ChevronDown, Gem, Heart, History, Home,
  LoaderCircle, MapPin, Moon, Orbit, Save, Search, Settings, Sparkles, Sun, User,
} from 'lucide-react'
import { KoreaBirthplaceSelector } from './koreaBirthplaces'

const DEFAULT_API_BASE = 'https://astro-app-api-f7fn.onrender.com'
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE).replace(/\/$/, '')
const PROFILE_STORAGE_KEY = 'starlight-destiny.birth-profile.v1'

type PeriodKey = 'today' | 'week' | 'month' | 'year'
type ApiStatus = 'warming' | 'online' | 'offline'
type MainView = 'home' | 'profile' | 'history' | 'settings'
type ToolKey = 'integrated' | 'compatibility' | 'marriage' | 'precision'
type RelationshipStatus = 'single' | 'dating' | 'long_term' | 'cohabiting' | 'engaged' | 'married'
type Gender = 'female' | 'male'

type BirthProfile = {
  name: string
  birthDate: string
  birthTime: string
  placeKey: string
  latitude: string
  longitude: string
  utcOffset: string
  gender: Gender
}

type CounterpartProfile = BirthProfile & { timeKnown: boolean }

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

type FortunePoint = { date: string; label: string; score: number }
type FortuneStat = {
  average: number
  band: string
  spread: number
  best_days: FortunePoint[]
  caution_days: FortunePoint[]
}
type FortuneMonth = {
  calendar_month: string
  start: string
  end: string
  topics: Record<string, FortuneStat | null>
  relationship_signals: Record<string, FortuneStat | null>
}
type IntegratedApiResponse = {
  ok: boolean
  api_version: string
  engine: string
  period: { start: string; end: string; day_count: number; month_segments: number }
  western: {
    ok: boolean
    engine: string
    ephemeris: string
    score_policy: string
    natal: { asc: number; mc: number }
    overall: Record<string, FortuneStat | null>
    relationship_signals: Record<string, FortuneStat | null>
    months: FortuneMonth[]
  }
  saju: {
    ok: boolean
    engine: string
    error?: string
    pillars?: { year: string; month: string; day: string; hour: string }
    day_master?: string
    elements?: Record<string, number>
    true_solar?: {
      legal_local_time: string
      true_solar_time: string
      total_correction_minutes: number
    }
    dayun?: Array<{ start_year: number; end_year: number; start_age: number; end_age: number; ganzhi: string }>
    annual?: Array<{ year: number; ganzhi: string; stem_ten_god: string; branch_links: string[] }>
    monthly?: Array<{ calendar_month: string; ganzhi: string; stem_ten_god: string; branch_links: string[] }>
    not_calculated?: string[]
  }
  thai: {
    ok: boolean
    engine: string
    thai_day: string
    ruler: string
    rule: string
    predictive_status: string
    consensus_policy: string
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
  ['single', '솔로'], ['dating', '연애중'], ['long_term', '장기커플'],
  ['cohabiting', '동거'], ['engaged', '약혼'], ['married', '기혼'],
]

const emptyProfile: BirthProfile = {
  name: '', birthDate: '', birthTime: '', placeKey: '', latitude: '', longitude: '', utcOffset: '9', gender: 'female',
}
const emptyCounterpart: CounterpartProfile = { ...emptyProfile, timeKnown: true }

const planetLabels: Record<string, string> = {
  Sun:'태양', Moon:'달', Mercury:'수성', Venus:'금성', Mars:'화성', Jupiter:'목성', Saturn:'토성',
  Uranus:'천왕성', Neptune:'해왕성', Pluto:'명왕성', 'True Node':'진북교점', ASC:'상승점', DSC:'하강점', MC:'중천점', IC:'천저점',
}
const aspectLabels: Record<string, string> = {
  conjunction:'합', sextile:'육합', square:'사각', trine:'삼각', quincunx:'퀸컨스', opposition:'대립',
}
const topicOrder = ['금전','학업','시험','직장','이직','연애','연락','재회','소식','컨디션']

function toDateInputValue(date: Date) {
  const y = date.getFullYear(); const m = String(date.getMonth()+1).padStart(2,'0'); const d = String(date.getDate()).padStart(2,'0')
  return `${y}-${m}-${d}`
}
function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`); date.setDate(date.getDate()+days); return toDateInputValue(date)
}
function periodEnd(start: string, period: PeriodKey) {
  if (period === 'today') return start
  if (period === 'week') return addDays(start, 6)
  if (period === 'month') return addDays(start, 30)
  return addDays(start, 364)
}
function parseOptionalNumber(value: string) {
  const n = Number(value.trim()); return value.trim() && Number.isFinite(n) ? n : null
}
function loadStoredProfile(): BirthProfile {
  if (typeof window === 'undefined') return emptyProfile
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY)
    if (!raw) return emptyProfile
    const parsed = { ...emptyProfile, ...(JSON.parse(raw) as Partial<BirthProfile>) }
    if (parsed.placeKey && !parsed.placeKey.includes('::')) parsed.placeKey = ''
    if (parsed.gender !== 'male' && parsed.gender !== 'female') parsed.gender = 'female'
    return parsed
  } catch { return emptyProfile }
}
function aspectText(aspect: Aspect) {
  return `${planetLabels[aspect.a] ?? aspect.a} · ${planetLabels[aspect.b] ?? aspect.b} ${aspectLabels[aspect.aspect] ?? aspect.aspect}`
}
function currentDayun(result: IntegratedApiResponse | null) {
  if (!result?.saju.dayun?.length) return null
  const y = Number(result.period.start.slice(0,4))
  return result.saju.dayun.find((row) => row.start_year <= y && row.end_year >= y) ?? result.saju.dayun[0]
}

export default function AppNext() {
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
  const [integratedResult, setIntegratedResult] = useState<IntegratedApiResponse | null>(null)
  const [integratedLoading, setIntegratedLoading] = useState(false)
  const [integratedError, setIntegratedError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE}/health`)
      .then((response) => { if (!response.ok) throw new Error('health check failed'); return response.json() })
      .then((payload) => { if (!cancelled) { setApiStatus('online'); setApiVersion(String(payload.version ?? '')) } })
      .catch(() => { if (!cancelled) setApiStatus('offline') })
    return () => { cancelled = true }
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
  const topIntegratedTopics = integratedResult
    ? topicOrder
        .map((topic) => ({ topic, stat: integratedResult.western.overall[topic] }))
        .filter((row): row is { topic: string; stat: FortuneStat } => Boolean(row.stat))
        .sort((a,b) => b.stat.average - a.stat.average)
    : []
  const activeDayun = currentDayun(integratedResult)

  const switchMainView = (view: MainView) => { setMainView(view); if (view !== 'home') setSelectedTool(null) }
  const saveBirthProfile = () => {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(birthProfile))
    setProfileSaved(true); window.setTimeout(() => setProfileSaved(false), 1800)
  }

  const runIntegrated = async () => {
    setIntegratedError(''); setIntegratedResult(null)
    if (!birthProfile.birthDate || !birthProfile.birthTime) {
      setIntegratedError('먼저 내정보에서 생년월일과 출생시간을 저장해줘.'); return
    }
    const latitude = parseOptionalNumber(birthProfile.latitude)
    const longitude = parseOptionalNumber(birthProfile.longitude)
    if (latitude === null || longitude === null) {
      setIntegratedError('출생지역을 시·도 → 시·군·구 순서로 선택해줘. 정밀 계산에는 위치 좌표가 필요해.'); return
    }
    setIntegratedLoading(true)
    try {
      const response = await fetch(`${API_BASE}/v1/fortune/integrated`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          profile: {
            name: birthProfile.name || null,
            birth_date: birthProfile.birthDate,
            birth_time: birthProfile.birthTime,
            latitude,
            longitude,
            utc_offset_hours: Number(birthProfile.utcOffset || 9),
            gender: birthProfile.gender,
          },
          start_date: queryDate,
          end_date: periodEnd(queryDate, period),
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(typeof payload?.detail === 'string' ? payload.detail : '통합운세 계산 요청에 실패했어.')
      setIntegratedResult(payload as IntegratedApiResponse)
    } catch (error) {
      setIntegratedError(error instanceof Error ? error.message : '통합운세 계산 중 오류가 발생했어.')
    } finally { setIntegratedLoading(false) }
  }

  const runRelationship = async () => {
    setRelationshipError(''); setRelationshipResult(null)
    if (!birthProfile.birthDate || !birthProfile.birthTime) { setRelationshipError('먼저 내정보에서 본인 생년월일과 출생시간을 저장해줘.'); return }
    if (!counterpart.birthDate) { setRelationshipError('상대 생년월일은 반드시 필요해.'); return }
    if (counterpart.timeKnown && !counterpart.birthTime) { setRelationshipError('상대 출생시간을 모르면 “출생시간 모름”을 체크해줘.'); return }
    const body = {
      user: {
        name: birthProfile.name || null, birth_date: birthProfile.birthDate, birth_time: birthProfile.birthTime, time_known: true,
        latitude: parseOptionalNumber(birthProfile.latitude), longitude: parseOptionalNumber(birthProfile.longitude), utc_offset_hours: Number(birthProfile.utcOffset || 9),
      },
      counterpart: {
        name: counterpart.name || null, birth_date: counterpart.birthDate,
        birth_time: counterpart.timeKnown ? counterpart.birthTime : null, time_known: counterpart.timeKnown,
        latitude: counterpart.timeKnown ? parseOptionalNumber(counterpart.latitude) : null,
        longitude: counterpart.timeKnown ? parseOptionalNumber(counterpart.longitude) : null,
        utc_offset_hours: Number(counterpart.utcOffset || 9),
      },
      start_date: queryDate, end_date: periodEnd(queryDate, period), relationship_status: relationshipMode,
    }
    setRelationshipLoading(true)
    try {
      const response = await fetch(`${API_BASE}/v1/relationship/western`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })
      const payload = await response.json()
      if (!response.ok) throw new Error(typeof payload?.detail === 'string' ? payload.detail : '관계 계산 요청에 실패했어.')
      setRelationshipResult(payload as RelationshipApiResponse)
    } catch (error) {
      setRelationshipError(error instanceof Error ? error.message : '관계 계산 중 오류가 발생했어.')
    } finally { setRelationshipLoading(false) }
  }

  return (
    <div className="app-shell">
      <main className="page-content">
        <section className="hero-card">
          <div className="hero-orbit hero-orbit-a"/><div className="hero-orbit hero-orbit-b"/><div className="hero-star hero-star-a"/><div className="hero-star hero-star-b"/>
          <div className="hero-kicker">CELESTIAL OBSERVATORY</div>
          <div className="hero-row"><div className="hero-sigil"><Moon size={24} strokeWidth={1.7}/></div><div><h1>별빛의 운명</h1><p>시간의 흐름과 삶의 패턴을 읽는 개인 관측실</p></div></div>
        </section>

        {mainView === 'home' && <>
          <button className="profile-card" type="button" onClick={() => switchMainView('profile')}>
            <div className="profile-copy"><span className="eyebrow">MY BIRTH PROFILE</span><strong>{hasProfile ? `${birthProfile.name || '나'}의 출생 프로필` : '나의 출생 프로필'}</strong><span>{hasProfile ? `${birthProfile.birthDate} · ${birthProfile.birthTime} · 이 기기에 저장됨` : '정밀 계산에 사용할 출생정보를 먼저 저장해'}</span></div><ChevronDown size={20}/>
          </button>
          <section className="date-card"><label htmlFor="query-date">운세 기준 날짜</label><div className="date-control"><CalendarDays size={19}/><input id="query-date" type="date" value={queryDate} onChange={(e)=>setQueryDate(e.target.value)}/></div></section>
          <section className="section-block"><div className="section-label">기간 선택</div><div className="period-grid">{periods.map(({key,label,icon:Icon})=><button key={key} className={`period-button ${period===key?'is-active':''}`} type="button" onClick={()=>setPeriod(key)}><Icon size={17}/><span>{label}</span></button>)}</div></section>
          <section className="section-block tools-section"><div className="section-heading-row"><div className="section-label">분석 도구</div><span className={`server-pill ${apiStatus}`}>{apiLabel}</span></div><div className="tool-grid">{tools.map(({key,label,desc,icon:Icon,tone})=><button key={key} className={`tool-card ${selectedTool===key?'is-selected':''}`} type="button" onClick={()=>setSelectedTool(key)}><span className={`tool-icon tone-${tone}`}><Icon size={24}/></span><strong>{label}</strong><span>{desc}</span></button>)}</div></section>

          {selectedTool === 'integrated' && <section className="tool-panel integrated-panel">
            <div className="tool-panel-heading"><span className="tool-icon tone-gold"><Sparkles size={22}/></span><div><span className="eyebrow">LIVE INTEGRATED ENGINE</span><h2>통합운세</h2><p>Western(서양점성술) 기간 흐름, 진태양시 보정 사주, Thai(태국) 출생요일층을 각각 계산해 한 화면에서 비교해.</p></div></div>
            <div className="calculation-range"><CalendarDays size={17}/><span>{queryDate} → {periodEnd(queryDate,period)} · {periods.find((item)=>item.key===period)?.label} 범위</span></div>
            <div className="coordinate-note"><MapPin size={16}/><span>사주는 출생지 경도로 진태양시를 보정하고, 서양점성술은 출생지 좌표로 상승점·하우스를 계산해. Thai는 현재 출생요일 baseline만 사용해.</span></div>
            {integratedError && <div className="status-banner error"><AlertTriangle size={17}/><span>{integratedError}</span></div>}
            <button className="primary-button" type="button" onClick={runIntegrated} disabled={integratedLoading||apiStatus==='offline'}>{integratedLoading?<LoaderCircle className="spin" size={18}/>:<Sparkles size={18}/>}<span>{integratedLoading?'통합 계산 중…':'통합운세 실제 계산'}</span></button>

            {integratedResult && <div className="results-wrap integrated-results">
              <div className="result-headline"><CheckCircle2 size={20}/><div><strong>통합 계산 완료</strong><span>{integratedResult.engine} · {integratedResult.period.day_count}일 · {integratedResult.period.month_segments}개 월 구간</span></div></div>

              <section className="result-card">
                <div className="result-card-title"><span>WESTERN</span><strong>서양점성술 기간 흐름</strong></div>
                <p className="result-note">{integratedResult.western.score_policy} · {integratedResult.western.ephemeris}</p>
                <div className="integrated-topic-grid">
                  {topIntegratedTopics.slice(0,6).map(({topic,stat})=><div className="integrated-topic" key={topic}><span>{topic}</span><strong>{stat.average.toFixed(1)}</strong><small>{stat.band}</small></div>)}
                </div>
                {topIntegratedTopics.length>0 && <div className="best-window"><span>가장 강한 흐름</span><strong>{topIntegratedTopics.slice(0,3).map((row)=>`${row.topic} ${row.stat.average.toFixed(1)}`).join(' · ')}</strong></div>}
              </section>

              <section className="result-card">
                <div className="result-card-title"><span>SAJU</span><strong>사주 원국 · 진태양시</strong></div>
                {integratedResult.saju.ok && integratedResult.saju.pillars ? <>
                  <div className="pillar-grid">
                    <div><span>년주</span><strong>{integratedResult.saju.pillars.year}</strong></div>
                    <div><span>월주</span><strong>{integratedResult.saju.pillars.month}</strong></div>
                    <div><span>일주</span><strong>{integratedResult.saju.pillars.day}</strong></div>
                    <div><span>시주</span><strong>{integratedResult.saju.pillars.hour}</strong></div>
                  </div>
                  <div className="saju-summary"><span>일간 <b>{integratedResult.saju.day_master}</b></span>{activeDayun && <span>현재 대운 <b>{activeDayun.ganzhi}</b> · {activeDayun.start_year}~{activeDayun.end_year}</span>}</div>
                  {integratedResult.saju.true_solar && <div className="coordinate-note"><Sun size={16}/><span>법정시 {integratedResult.saju.true_solar.legal_local_time.slice(11,16)} → 진태양시 {integratedResult.saju.true_solar.true_solar_time.slice(11,16)} · 보정 {integratedResult.saju.true_solar.total_correction_minutes>0?'+':''}{integratedResult.saju.true_solar.total_correction_minutes.toFixed(1)}분</span></div>}
                </> : <div className="status-banner error"><AlertTriangle size={16}/><span>{integratedResult.saju.error || '사주 계산에 실패했어.'}</span></div>}
              </section>

              <section className="result-card">
                <div className="result-card-title"><span>THAI</span><strong>태국 점성술 출생요일층</strong></div>
                <div className="thai-baseline"><strong>{integratedResult.thai.thai_day}</strong><span>{integratedResult.thai.ruler}</span><p>{integratedResult.thai.rule}</p></div>
                <p className="result-note">Thai transit(태국식 트랜짓)은 아직 구현하지 않았기 때문에 날짜별 예측 합의 점수에는 섞지 않아.</p>
              </section>

              {integratedResult.western.months.length>1 && <section className="result-card">
                <div className="result-card-title"><span>MONTHLY</span><strong>월별 흐름</strong></div>
                <div className="month-list">{integratedResult.western.months.map((month)=>{
                  const ranked = topicOrder.map((topic)=>({topic,stat:month.topics[topic]})).filter((row): row is {topic:string;stat:FortuneStat}=>Boolean(row.stat)).sort((a,b)=>b.stat.average-a.stat.average).slice(0,3)
                  return <div className="month-card" key={month.calendar_month}><div className="month-title"><strong>{month.calendar_month}</strong><span>{month.start}~{month.end}</span></div>{ranked.map(({topic,stat})=><div className="tight-row" key={topic}><span>{topic} · {stat.band}</span><b>{stat.average.toFixed(1)}</b></div>)}</div>
                })}</div>
              </section>}
            </div>}
          </section>}

          {selectedToolInfo && (selectedTool === 'compatibility' || selectedTool === 'marriage') && <section className="tool-panel">
            <div className="tool-panel-heading"><span className={`tool-icon ${selectedTool==='compatibility'?'tone-rose':'tone-champagne'}`}>{selectedTool==='compatibility'?<Heart size={22}/>:<Gem size={22}/>}</span><div><span className="eyebrow">LIVE RELATIONSHIP ENGINE</span><h2>{selectedToolInfo.label}</h2><p>{selectedTool==='marriage'?'결혼 여부를 단정하지 않고 두 사람의 장기 결속·협력·긴장 활성도를 계산해.':'정적 궁합과 월별 진행 접점을 분리해서 보여줘.'}</p></div></div>
            <div className="relationship-mode-row">{relationshipModes.map(([value,label])=><button key={value} type="button" className={relationshipMode===value?'is-active':''} onClick={()=>setRelationshipMode(value)}>{label}</button>)}</div>
            <div className="subsection-title">상대 출생정보</div>
            <div className="field-grid">
              <label className="field field-wide"><span>이름 / 구분명</span><input value={counterpart.name} onChange={(e)=>setCounterpart({...counterpart,name:e.target.value})} placeholder="예: A, 상대방"/></label>
              <label className="field"><span>생년월일</span><input type="date" value={counterpart.birthDate} onChange={(e)=>setCounterpart({...counterpart,birthDate:e.target.value})}/></label>
              <label className="field"><span>출생시간</span><input type="time" value={counterpart.birthTime} disabled={!counterpart.timeKnown} onChange={(e)=>setCounterpart({...counterpart,birthTime:e.target.value})}/></label>
              <label className="check-field field-wide"><input type="checkbox" checked={!counterpart.timeKnown} onChange={(e)=>setCounterpart({...counterpart,timeKnown:!e.target.checked,birthTime:e.target.checked?'':counterpart.birthTime})}/><span>상대 출생시간 모름 — 달·각도·다빈슨/마크스 일부 정밀 레이어는 자동 제외</span></label>
              <KoreaBirthplaceSelector disabled={!counterpart.timeKnown} value={counterpart} onChange={(location)=>setCounterpart({...counterpart,...location})}/>
              <details className="advanced-panel field-wide"><summary>고급 위치 설정 · 위도/경도 직접 수정</summary><div className="advanced-grid">
                <label className="field"><span>위도</span><input inputMode="decimal" value={counterpart.latitude} disabled={!counterpart.timeKnown} onChange={(e)=>setCounterpart({...counterpart,latitude:e.target.value,placeKey:''})}/></label>
                <label className="field"><span>경도</span><input inputMode="decimal" value={counterpart.longitude} disabled={!counterpart.timeKnown} onChange={(e)=>setCounterpart({...counterpart,longitude:e.target.value,placeKey:''})}/></label>
                <label className="field field-wide"><span>UTC(협정세계시) 시차</span><input inputMode="decimal" value={counterpart.utcOffset} disabled={!counterpart.timeKnown} onChange={(e)=>setCounterpart({...counterpart,utcOffset:e.target.value})}/></label>
              </div></details>
            </div>
            <div className="coordinate-note"><MapPin size={16}/><span>국내는 시·도 → 시·군·구만 고르면 현재 행정경계 대표좌표와 UTC +9를 자동 적용해. 직접 좌표 입력은 고급 설정이야.</span></div>
            <div className="calculation-range"><CalendarDays size={17}/><span>{queryDate} → {periodEnd(queryDate,period)} · {periods.find((item)=>item.key===period)?.label} 범위</span></div>
            {relationshipError && <div className="status-banner error"><AlertTriangle size={17}/><span>{relationshipError}</span></div>}
            <button className="primary-button" type="button" onClick={runRelationship} disabled={relationshipLoading||apiStatus==='offline'}>{relationshipLoading?<LoaderCircle className="spin" size={18}/>:<Sparkles size={18}/>}<span>{relationshipLoading?'정밀 계산 중…':'실제 계산 실행'}</span></button>

            {relationshipResult && <div className="results-wrap">
              <div className="result-headline"><CheckCircle2 size={20}/><div><strong>실제 계산 완료</strong><span>{relationshipResult.engine} · {relationshipResult.period.month_segments}개 월 구간</span></div></div>
              <section className="result-card"><div className="result-card-title"><span>STATIC</span><strong>기본 관계 구조</strong></div><div className="metric-grid"><div className="metric"><strong>{natalAspects.length}</strong><span>시너스트리 접점</span></div><div className="metric"><strong>{relationshipResult.result.davison?.available?'ON':'OFF'}</strong><span>다빈슨</span></div><div className="metric"><strong>{relationshipResult.result.marks?.available?'ON':'OFF'}</strong><span>마크스</span></div></div><div className="aspect-list">{natalAspects.slice(0,8).map((aspect,index)=><div className="aspect-row" key={`${aspect.a}-${aspect.aspect}-${aspect.b}-${index}`}><span className={`tone-dot ${aspect.tone}`}/><div><strong>{aspectText(aspect)}</strong><span>오브 {aspect.orb.toFixed(2)}° · {aspect.tone==='supportive'?'조화':aspect.tone==='challenging'?'긴장':'혼합'}</span></div></div>)}</div></section>
              {resultMonths.length>0 && <section className="result-card"><div className="result-card-title"><span>TIMING</span><strong>기간별 활성도</strong></div><p className="result-note">접점 수는 사건 확률이 아니야. 독립 레이어에서 반복되는 정밀 접점을 보는 용도야.</p><div className="month-list">{resultMonths.map((month)=><div className="month-card" key={`${month.calendar_month}-${month.representative_date}`}><div className="month-title"><strong>{month.calendar_month}</strong><span>대표일 {month.representative_date}</span></div><div className="month-metrics"><span><b>{month.signal_summary.exact_contacts}</b> 정밀</span><span><b>{month.signal_summary.supportive_contacts}</b> 조화</span><span><b>{month.signal_summary.challenging_contacts}</b> 긴장</span></div>{month.signal_summary.tightest.slice(0,3).map((aspect,index)=><div className="tight-row" key={index}><span>{aspectText(aspect)}</span><b>{aspect.orb.toFixed(2)}°</b></div>)}</div>)}</div></section>}
              {(relationshipResult.result.limitations?.length??0)>0 && <div className="status-banner subtle"><AlertTriangle size={16}/><span>{relationshipResult.result.limitations?.join(' ')}</span></div>}
            </div>}
          </section>}

          {selectedTool === 'precision' && <section className="report-card"><div className="report-icon"><Search size={21}/></div><div className="report-copy"><span className="eyebrow">PRECISION</span><strong>정밀분석</strong><p>궁합/결혼운에서는 실제 정밀 접점이 이미 연결돼 있어. 독립 화면은 통합운세 안정화 뒤 확장해.</p></div></section>}
          <section className="report-card"><div className="report-icon"><Moon size={21}/></div><div className="report-copy"><span className="eyebrow">DAILY CELESTIAL REPORT</span><strong>{period==='today'?'오늘의 리포트':`${periods.find((item)=>item.key===period)?.label} 리포트`}</strong><p>운세 기준일 {queryDate}. 통합운세 실계산 결과를 다음 단계에서 이 홈 리포트에도 재사용해.</p></div></section>
        </>}

        {mainView === 'profile' && <section className="form-card profile-form-card">
          <div className="form-card-heading"><div className="report-icon"><User size={21}/></div><div><span className="eyebrow">MY BIRTH PROFILE</span><h2>내 출생 프로필</h2><p>정밀 계산에만 사용하고 이 브라우저 기기에 로컬 저장해.</p></div></div>
          <div className="privacy-note"><CheckCircle2 size={16}/><span>현재 단계에서는 서버 계정 DB나 공개 GitHub에 개인 출생정보를 저장하지 않아.</span></div>
          <div className="field-grid">
            <label className="field field-wide"><span>이름 / 닉네임</span><input value={birthProfile.name} onChange={(e)=>setBirthProfile({...birthProfile,name:e.target.value})} placeholder="선택 입력"/></label>
            <label className="field"><span>생년월일</span><input type="date" value={birthProfile.birthDate} onChange={(e)=>setBirthProfile({...birthProfile,birthDate:e.target.value})}/></label>
            <label className="field"><span>출생시간</span><input type="time" value={birthProfile.birthTime} onChange={(e)=>setBirthProfile({...birthProfile,birthTime:e.target.value})}/></label>
            <label className="field field-wide"><span>성별 · 사주 대운 계산 기준</span><select value={birthProfile.gender} onChange={(e)=>setBirthProfile({...birthProfile,gender:e.target.value as Gender})}><option value="female">여성</option><option value="male">남성</option></select></label>
            <KoreaBirthplaceSelector value={birthProfile} onChange={(location)=>setBirthProfile({...birthProfile,...location})}/>
            <details className="advanced-panel field-wide"><summary>고급 위치 설정 · 위도/경도 직접 수정</summary><div className="advanced-grid">
              <label className="field"><span>위도</span><input inputMode="decimal" value={birthProfile.latitude} onChange={(e)=>setBirthProfile({...birthProfile,latitude:e.target.value,placeKey:''})}/></label>
              <label className="field"><span>경도</span><input inputMode="decimal" value={birthProfile.longitude} onChange={(e)=>setBirthProfile({...birthProfile,longitude:e.target.value,placeKey:''})}/></label>
              <label className="field field-wide"><span>UTC(협정세계시) 시차</span><input inputMode="decimal" value={birthProfile.utcOffset} onChange={(e)=>setBirthProfile({...birthProfile,utcOffset:e.target.value})}/></label>
            </div></details>
          </div>
          <div className="coordinate-note"><MapPin size={16}/><span>2026년 7월 1일 현행 전국 행정체계를 기준으로 선택해. 좌표는 자동 적용되고 직접 입력은 선택사항이야.</span></div>
          <button className="primary-button" type="button" onClick={saveBirthProfile}><Save size={18}/><span>{profileSaved?'이 기기에 저장 완료':'이 기기에 프로필 저장'}</span></button>
        </section>}

        {mainView === 'history' && <section className="report-card"><div className="report-icon"><History size={21}/></div><div className="report-copy"><span className="eyebrow">ARCHIVE</span><strong>기록</strong><p>{integratedResult||relationshipResult?'이번 세션의 최근 계산 결과는 홈 카드에 남아 있어. 영구 저장은 계산 API 안정화 뒤 Supabase로 붙일게.':'아직 저장된 분석 기록이 없어.'}</p></div></section>}
        {mainView === 'settings' && <section className="report-card"><div className="report-icon"><Settings size={21}/></div><div className="report-copy"><span className="eyebrow">SETTINGS</span><strong>설정</strong><p>AI 해석 모델, 개인정보, 알림, 앱 설정을 이곳으로 분리해.</p></div></section>}
      </main>
      <nav className="bottom-nav" aria-label="하단 탐색">
        <button className={`nav-item ${mainView==='home'?'is-active':''}`} type="button" onClick={()=>switchMainView('home')}><Home size={20}/><span>홈</span></button>
        <button className={`nav-item ${mainView==='profile'?'is-active':''}`} type="button" onClick={()=>switchMainView('profile')}><User size={20}/><span>내정보</span></button>
        <button className={`nav-item ${mainView==='history'?'is-active':''}`} type="button" onClick={()=>switchMainView('history')}><History size={20}/><span>기록</span></button>
        <button className={`nav-item ${mainView==='settings'?'is-active':''}`} type="button" onClick={()=>switchMainView('settings')}><Settings size={20}/><span>설정</span></button>
      </nav>
    </div>
  )
}
