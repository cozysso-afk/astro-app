import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, CalendarDays, CheckCircle2, ChevronDown, Cloud, Copy, Gem, Heart, History, Home,
  LoaderCircle, MapPin, Moon, Orbit, RefreshCw, Save, Search, Settings, Sparkles, Sun, Trash2, User,
} from 'lucide-react'
import { KoreaBirthplaceSelector } from './koreaBirthplaces'
import { deleteArchive, listArchive, saveArchive, type ArchiveItem } from './lib/archive'

const DEFAULT_API_BASE = 'https://astro-app-api-f7fn.onrender.com'
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE).replace(/\/$/, '')
const PROFILE_STORAGE_KEY = 'starlight-destiny.birth-profile.v1'
const UI_SETTINGS_STORAGE_KEY = 'starlight-destiny.ui-settings.v1'
const AI_MODEL_STORAGE_KEY = 'starlight-destiny.ai-model.v1'

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


type AiTopicInterpretation = {
  verdict: string
  reason: string
  timing: string
  action: string
  avoid: string
  confidence: '높음' | '보통' | '낮음'
  confidence_reason: string
}

type AiInterpretationResponse = {
  ok: boolean
  missing_key?: boolean
  error?: string
  model?: string
  fallback_from?: string
  interpreter_version?: string
  usage?: { prompt_tokens?: number; candidate_tokens?: number; thought_tokens?: number; total_tokens?: number }
  data?: {
    headline: string
    overall: { summary: string; dominant_pattern: string; best_phase: string; caution_phase: string }
    clusters: { relationship: string; work_study: string; money_news: string; condition: string }
    systems: { western: string; saju: string; thai: string }
    priorities: string[]
    topic_analysis: Record<string, AiTopicInterpretation>
    limits: string
  }
}

function AiInterpretationPanel({ result, loading, error, onRetry }: {
  result: AiInterpretationResponse | null
  loading: boolean
  error: string
  onRetry: () => void
}) {
  if (loading) return <section className="ai-interpret-card is-loading"><LoaderCircle className="spin" size={20}/><div><span className="eyebrow">AI INTERPRETATION</span><strong>Gemini가 실계산 근거를 해석하는 중…</strong><p>숫자를 사건 확률로 바꾸지 않고 Western·사주·Thai를 분리해서 읽고 있어.</p></div></section>
  if (error) return <section className="ai-interpret-card is-error"><AlertTriangle size={20}/><div><span className="eyebrow">AI INTERPRETATION</span><strong>AI 해설을 아직 붙이지 못했어</strong><p>{error}</p><button type="button" onClick={onRetry}>AI 해설 다시 시도</button></div></section>
  if (!result?.ok || !result.data) return null
  const data = result.data
  return <section className="ai-interpret-card">
    <div className="ai-interpret-head"><span className="ai-orb"><Sparkles size={19}/></span><div><span className="eyebrow">GEMINI INTERPRETATION</span><h3>{data.headline || '통합 계산 해설'}</h3><small>{result.model || 'Gemini'} · 계산 후 해설층</small></div></div>
    <p className="ai-summary">{data.overall.summary}</p>
    {data.overall.dominant_pattern && <div className="ai-highlight"><strong>핵심 패턴</strong><span>{data.overall.dominant_pattern}</span></div>}
    <div className="ai-cluster-grid">
      {data.clusters.relationship && <div><strong>관계</strong><p>{data.clusters.relationship}</p></div>}
      {data.clusters.work_study && <div><strong>일 · 학업</strong><p>{data.clusters.work_study}</p></div>}
      {data.clusters.money_news && <div><strong>금전 · 소식</strong><p>{data.clusters.money_news}</p></div>}
      {data.clusters.condition && <div><strong>컨디션</strong><p>{data.clusters.condition}</p></div>}
    </div>
    {!!data.priorities?.length && <div className="ai-priorities"><strong>이 기간 우선순위</strong>{data.priorities.map((item, index)=><p key={`${index}-${item}`}>{index+1}. {item}</p>)}</div>}
    <details className="ai-details"><summary>분야별 정밀 해석 보기</summary><div className="ai-topic-list">{topicOrder.map((topic)=>{
      const item=data.topic_analysis?.[topic]
      if(!item) return null
      return <article key={topic}><div className="ai-topic-title"><strong>{topic}</strong><span>{item.confidence}</span></div><p className="ai-verdict">{item.verdict}</p>{item.reason&&<p><b>근거</b> {item.reason}</p>}{item.timing&&<p><b>시기</b> {item.timing}</p>}{item.action&&<p><b>행동</b> {item.action}</p>}{item.avoid&&<p><b>주의</b> {item.avoid}</p>}</article>
    })}</div></details>
    <div className="ai-system-note"><strong>체계별 해석</strong>{data.systems.western&&<p><b>Western</b> {data.systems.western}</p>}{data.systems.saju&&<p><b>사주</b> {data.systems.saju}</p>}{data.systems.thai&&<p><b>Thai</b> {data.systems.thai}</p>}</div>
    {data.limits && <p className="ai-limits">{data.limits}</p>}
  </section>
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
function loadUiSettings() {
  if (typeof window === 'undefined') return { glow: true, motion: true }
  try {
    const raw = window.localStorage.getItem(UI_SETTINGS_STORAGE_KEY)
    if (!raw) return { glow: true, motion: true }
    const parsed = JSON.parse(raw) as Partial<{ glow: boolean; motion: boolean }>
    return { glow: parsed.glow !== false, motion: parsed.motion !== false }
  } catch {
    return { glow: true, motion: true }
  }
}


function loadAiModel() {
  if (typeof window === 'undefined') return 'gemini-3.7-flash'
  const saved = window.localStorage.getItem(AI_MODEL_STORAGE_KEY)
  return saved === 'gemini-3.6-flash' ? saved : 'gemini-3.7-flash'
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

function collectFortuneHighlights(
  rows: Array<{ topic: string; stat: FortuneStat }>,
  key: 'best_days' | 'caution_days',
  limit = 3,
) {
  const byDate = new Map<string, FortunePoint & { topic: string }>()
  rows.forEach(({ topic, stat }) => {
    for (const point of stat[key] ?? []) {
      const previous = byDate.get(point.date)
      const shouldReplace = !previous || (key === 'best_days' ? point.score > previous.score : point.score < previous.score)
      if (shouldReplace) byDate.set(point.date, { ...point, topic })
    }
  })
  return [...byDate.values()]
    .sort((a, b) => key === 'best_days' ? b.score - a.score : a.score - b.score)
    .slice(0, limit)
}

async function copyToClipboard(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // iOS/private browsing fallback below.
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}

function compactPlace(value: unknown) {
  return String(value ?? '').replace('::', ' ') || '위치 미표기'
}

function integratedPromptText(request: Record<string, unknown>) {
  const profile = (request.profile ?? {}) as Record<string, unknown>
  return [
    '[별빛의 운명 · 통합운세 분석 요청]',
    `분석 기간: ${String(request.start_date ?? '')} ~ ${String(request.end_date ?? '')}`,
    `이름: ${String(profile.name ?? '미입력')}`,
    `출생: ${String(profile.birth_date ?? '')} ${String(profile.birth_time ?? '')}`,
    `좌표: ${String(profile.latitude ?? '')}, ${String(profile.longitude ?? '')} / UTC ${String(profile.utc_offset_hours ?? '')}`,
    `성별(사주 대운 계산 기준): ${String(profile.gender ?? '')}`,
    '',
    '계산/해석 원칙:',
    '- Western(서양점성술), 사주, Thai(태국점성술)를 서로 다른 체계로 분리해서 본다.',
    '- Western 점수는 사건 확률이 아니라 상대적 활성도다.',
    '- 사주는 진태양시 보정을 사용하고, 엔진이 계산하지 않은 신강·신약/용희기신 등을 임의 생성하지 않는다.',
    '- Thai transit(태국식 트랜짓)이 미구현이면 출생요일 baseline을 날짜 예측 합의점수에 섞지 않는다.',
    '',
    '[원본 API 요청 JSON]',
    JSON.stringify(request, null, 2),
  ].join('\n')
}

function integratedResultText(result: IntegratedApiResponse) {
  const lines = [
    '[별빛의 운명 · 통합운세 전체 결과]',
    `엔진: ${result.engine} / API: ${result.api_version}`,
    `기간: ${result.period.start} ~ ${result.period.end} (${result.period.day_count}일)`,
    '',
    '■ Western(서양점성술)',
  ]
  topicOrder.forEach((topic) => {
    const stat = result.western.overall[topic]
    if (stat) lines.push(`- ${topic}: ${stat.average.toFixed(1)} · ${stat.band} · 변동폭 ${stat.spread.toFixed(1)}`)
  })
  if (result.saju.ok && result.saju.pillars) {
    lines.push('', '■ 사주')
    lines.push(`- 원국: ${result.saju.pillars.year} / ${result.saju.pillars.month} / ${result.saju.pillars.day} / ${result.saju.pillars.hour}`)
    lines.push(`- 일간: ${result.saju.day_master ?? ''}`)
    if (result.saju.true_solar) lines.push(`- 진태양시: ${result.saju.true_solar.true_solar_time} (보정 ${result.saju.true_solar.total_correction_minutes.toFixed(1)}분)`)
    for (const row of result.saju.dayun ?? []) lines.push(`- 대운: ${row.start_year}~${row.end_year} ${row.ganzhi} (${row.start_age}~${row.end_age}세)`)
    for (const row of result.saju.annual ?? []) lines.push(`- ${row.year} 세운: ${row.ganzhi} · ${row.stem_ten_god} · ${row.branch_links.join(', ') || '지지 연결 없음'}`)
    for (const row of result.saju.monthly ?? []) lines.push(`- ${row.calendar_month} 월운: ${row.ganzhi} · ${row.stem_ten_god} · ${row.branch_links.join(', ') || '지지 연결 없음'}`)
    if (result.saju.not_calculated?.length) lines.push(`- 미계산 항목: ${result.saju.not_calculated.join(', ')}`)
  }
  lines.push('', '■ Thai(태국점성술)')
  lines.push(`- ${result.thai.thai_day} · ${result.thai.ruler}`)
  lines.push(`- 규칙: ${result.thai.rule}`)
  lines.push(`- 예측 상태: ${result.thai.predictive_status}`)
  lines.push('', '[원본 계산 JSON]', JSON.stringify(result, null, 2))
  return lines.join('\n')
}

function relationshipPromptText(kind: 'compatibility' | 'marriage', request: Record<string, unknown>) {
  const user = (request.user ?? {}) as Record<string, unknown>
  const cp = (request.counterpart ?? {}) as Record<string, unknown>
  return [
    `[별빛의 운명 · ${kind === 'marriage' ? '결혼운' : '궁합운'} 분석 요청]`,
    `관계 상태: ${String(request.relationship_status ?? '')}`,
    `분석 기간: ${String(request.start_date ?? '')} ~ ${String(request.end_date ?? '')}`,
    '',
    `본인: ${String(user.name ?? '나')} / ${String(user.birth_date ?? '')} ${String(user.birth_time ?? '')}`,
    `본인 좌표: ${String(user.latitude ?? '')}, ${String(user.longitude ?? '')} / UTC ${String(user.utc_offset_hours ?? '')}`,
    `상대: ${String(cp.name ?? '상대')} / ${String(cp.birth_date ?? '')} ${cp.time_known ? String(cp.birth_time ?? '') : '출생시간 모름'}`,
    `상대 좌표: ${cp.time_known ? `${String(cp.latitude ?? '')}, ${String(cp.longitude ?? '')}` : '정밀 좌표 레이어 제외'}`,
    '',
    '해석 원칙:',
    '- 정적 시너스트리와 기간별 진행 접점을 분리한다.',
    '- 접점 수/오브를 연락·재회·결혼의 통계 확률처럼 말하지 않는다.',
    '- 상대의 사적인 속마음을 계산값만으로 단정하지 않는다.',
    kind === 'marriage' ? '- 결혼 여부를 예언하지 않고 장기 결속·협력·긴장 활성도를 본다.' : '- 궁합의 구조와 시기 활성도를 구분한다.',
    '',
    '[원본 API 요청 JSON]',
    JSON.stringify(request, null, 2),
  ].join('\n')
}

function relationshipResultText(kind: 'compatibility' | 'marriage', response: RelationshipApiResponse) {
  const result = response.result
  const aspects = result.natal_synastry?.aspects ?? []
  const lines = [
    `[별빛의 운명 · ${kind === 'marriage' ? '결혼운' : '궁합운'} 전체 결과]`,
    `엔진: ${response.engine} / API: ${response.api_version}`,
    `관계 상태: ${response.relationship_status}`,
    `기간: ${response.period.start} ~ ${response.period.end}`,
    '',
    '■ 기본 관계 구조',
    `- 시너스트리 접점: ${aspects.length}`,
    `- 다빈슨: ${result.davison?.available ? 'ON' : `OFF · ${result.davison?.reason ?? ''}`}`,
    `- 마크스: ${result.marks?.available ? 'ON' : `OFF · ${result.marks?.reason ?? ''}`}`,
  ]
  aspects.forEach((aspect) => lines.push(`- ${aspectText(aspect)} · orb ${aspect.orb.toFixed(2)}° · ${aspect.tone}`))
  for (const month of result.months ?? []) {
    lines.push('', `■ ${month.calendar_month} / 대표일 ${month.representative_date}`)
    lines.push(`- 정밀 ${month.signal_summary.exact_contacts} · 조화 ${month.signal_summary.supportive_contacts} · 긴장 ${month.signal_summary.challenging_contacts}`)
    month.signal_summary.tightest.forEach((aspect) => lines.push(`- ${aspectText(aspect)} · orb ${aspect.orb.toFixed(2)}°`))
  }
  if (result.limitations?.length) lines.push('', `제한사항: ${result.limitations.join(' ')}`)
  lines.push('', '[원본 계산 JSON]', JSON.stringify(response, null, 2))
  return lines.join('\n')
}

function precisionPromptText(request: Record<string, unknown>) {
  return integratedPromptText(request)
    .replace('[별빛의 운명 · 통합운세 분석 요청]', '[별빛의 운명 · 정밀분석 요청]')
    .concat('\n\n[정밀분석 표시 원칙]\n- 요약 점수를 새로 만들지 않고 동일 실계산의 원자료를 더 자세히 펼쳐본다.\n- 엔진이 계산하지 않은 항목은 추정하지 않는다.')
}

function precisionResultText(result: IntegratedApiResponse) {
  return integratedResultText(result)
    .replace('[별빛의 운명 · 통합운세 전체 결과]', '[별빛의 운명 · 정밀분석 전체 결과]')
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
  const [aiInterpretation, setAiInterpretation] = useState<AiInterpretationResponse | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null)
  const [aiModel, setAiModel] = useState(loadAiModel)
  const [integratedLoading, setIntegratedLoading] = useState(false)
  const [integratedError, setIntegratedError] = useState('')
  const [integratedRequestSnapshot, setIntegratedRequestSnapshot] = useState<Record<string, unknown> | null>(null)
  const [relationshipRequestSnapshot, setRelationshipRequestSnapshot] = useState<Record<string, unknown> | null>(null)
  const [archiveItems, setArchiveItems] = useState<ArchiveItem[]>([])
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [archiveStatus, setArchiveStatus] = useState('')
  const [archiveError, setArchiveError] = useState('')
  const [legacyArchiveOpen, setLegacyArchiveOpen] = useState<ArchiveItem | null>(null)
  const [uiSettings, setUiSettings] = useState(() => loadUiSettings())
  const [actionNotice, setActionNotice] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE}/health`)
      .then((response) => { if (!response.ok) throw new Error('health check failed'); return response.json() })
      .then((payload) => { if (!cancelled) { setApiStatus('online'); setApiVersion(String(payload.version ?? '')) } })
      .catch(() => { if (!cancelled) setApiStatus('offline') })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE}/v1/fortune/ai-meta`)
      .then((response)=>response.json().then((payload)=>({response,payload})))
      .then(({response,payload})=>{ if(!cancelled) setAiConfigured(Boolean(response.ok && payload?.configured)) })
      .catch(()=>{ if(!cancelled) setAiConfigured(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(AI_MODEL_STORAGE_KEY, aiModel)
  }, [aiModel])

  useEffect(() => {
    if (mainView === 'history' || mainView === 'settings') void refreshArchive()
  }, [mainView])

  useEffect(() => {
    window.localStorage.setItem(UI_SETTINGS_STORAGE_KEY, JSON.stringify(uiSettings))
    document.documentElement.dataset.celestialGlow = uiSettings.glow ? 'on' : 'off'
    document.documentElement.dataset.celestialMotion = uiSettings.motion ? 'on' : 'off'
  }, [uiSettings])

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
  const integratedSelectionEnd = periodEnd(queryDate, period)
  const integratedMatchesSelection = Boolean(
    integratedResult &&
    integratedResult.period.start === queryDate &&
    integratedResult.period.end === integratedSelectionEnd
  )
  const cautionIntegratedTopics = [...topIntegratedTopics]
    .sort((a,b) => a.stat.average - b.stat.average)
    .slice(0,2)
  const bestIntegratedDays = integratedMatchesSelection
    ? collectFortuneHighlights(topIntegratedTopics, 'best_days')
    : []
  const cautionIntegratedDays = integratedMatchesSelection
    ? collectFortuneHighlights(topIntegratedTopics, 'caution_days')
    : []
  const precisionRelationshipSignals = integratedResult
    ? Object.entries(integratedResult.western.relationship_signals)
        .filter((row): row is [string, FortuneStat] => Boolean(row[1]))
        .sort((a, b) => b[1].average - a[1].average)
    : []

  const switchMainView = (view: MainView) => { setMainView(view); if (view !== 'home') setSelectedTool(null) }
  const saveBirthProfile = () => {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(birthProfile))
    setProfileSaved(true); window.setTimeout(() => setProfileSaved(false), 1800)
  }

  const runAiInterpretation = async (calculation: IntegratedApiResponse | null = integratedResult) => {
    if (!calculation) return
    setAiLoading(true); setAiError('')
    try {
      const response = await fetch(`${API_BASE}/v1/fortune/interpret`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ calculation, model: aiModel }),
      })
      const payload = await response.json() as AiInterpretationResponse
      if (!response.ok) throw new Error(payload?.error || 'AI 해설 요청에 실패했어.')
      if (!payload.ok || !payload.data) {
        if (payload.missing_key) setAiConfigured(false)
        throw new Error(payload.error || 'AI 해설 결과가 비어 있어.')
      }
      setAiInterpretation(payload); setAiConfigured(true)
    } catch (error) {
      setAiInterpretation(null)
      setAiError(error instanceof Error ? error.message : 'AI 해설 요청에 실패했어.')
    } finally {
      setAiLoading(false)
    }
  }

  const runIntegrated = async () => {
    setIntegratedError(''); setIntegratedResult(null); setIntegratedRequestSnapshot(null); setAiInterpretation(null); setAiError('')
    if (!birthProfile.birthDate || !birthProfile.birthTime) {
      setIntegratedError('먼저 내정보에서 생년월일과 출생시간을 저장해줘.'); return
    }
    const latitude = parseOptionalNumber(birthProfile.latitude)
    const longitude = parseOptionalNumber(birthProfile.longitude)
    if (latitude === null || longitude === null) {
      setIntegratedError('출생지역을 시·도 → 시·군·구 순서로 선택해줘. 정밀 계산에는 위치 좌표가 필요해.'); return
    }
    const body: Record<string, unknown> = {
      profile: {
        name: birthProfile.name || null,
        birth_date: birthProfile.birthDate,
        birth_time: birthProfile.birthTime,
        latitude,
        longitude,
        utc_offset_hours: Number(birthProfile.utcOffset || 9),
        gender: birthProfile.gender,
        place_key: birthProfile.placeKey,
      },
      start_date: queryDate,
      end_date: periodEnd(queryDate, period),
    }
    setIntegratedLoading(true)
    try {
      const response = await fetch(`${API_BASE}/v1/fortune/integrated`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(typeof payload?.detail === 'string' ? payload.detail : '통합운세 계산 요청에 실패했어.')
      const calculation = payload as IntegratedApiResponse
      setIntegratedResult(calculation)
      setIntegratedRequestSnapshot(body)
      void runAiInterpretation(calculation)
    } catch (error) {
      setIntegratedError(error instanceof Error ? error.message : '통합운세 계산 중 오류가 발생했어.')
    } finally { setIntegratedLoading(false) }
  }

  const runRelationship = async () => {
    setRelationshipError(''); setRelationshipResult(null); setRelationshipRequestSnapshot(null)
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
      setRelationshipRequestSnapshot(body as Record<string, unknown>)
    } catch (error) {
      setRelationshipError(error instanceof Error ? error.message : '관계 계산 중 오류가 발생했어.')
    } finally { setRelationshipLoading(false) }
  }


  async function handleCopy(label: string, text: string) {
    const ok = await copyToClipboard(text)
    setActionNotice(ok ? `${label} 완료` : '복사 권한을 사용할 수 없어. 브라우저에서 다시 시도해줘.')
    window.setTimeout(() => setActionNotice(''), 2200)
  }

  async function saveIntegratedRecord() {
    if (!integratedResult || !integratedRequestSnapshot) return
    const label = periods.find((item) => item.key === period)?.label ?? period
    const saved = await saveArchive({
      kind: 'integrated',
      periodKey: period,
      title: `${label} 통합운세 · ${integratedResult.period.start}`,
      periodStart: integratedResult.period.start,
      periodEnd: integratedResult.period.end,
      engine: integratedResult.engine,
      request: integratedRequestSnapshot,
      result: integratedResult as unknown as Record<string, unknown>,
    })
    setArchiveStatus(saved.cloudSynced ? '기록 저장 + Supabase 동기화 완료' : `이 기기에 기록 저장 완료 · 클라우드 동기화 대기${saved.cloudError ? ` (${saved.cloudError})` : ''}`)
    if (mainView === 'history') await refreshArchive()
  }

  async function savePrecisionRecord() {
    if (!integratedResult || !integratedRequestSnapshot) return
    const saved = await saveArchive({
      kind: 'precision',
      periodKey: period,
      title: `정밀분석 · ${integratedResult.period.start}`,
      periodStart: integratedResult.period.start,
      periodEnd: integratedResult.period.end,
      engine: integratedResult.engine,
      request: integratedRequestSnapshot,
      result: integratedResult as unknown as Record<string, unknown>,
    })
    setArchiveStatus(saved.cloudSynced ? '정밀분석 기록 저장 + Supabase 동기화 완료' : `이 기기에 정밀분석 기록 저장 완료 · 클라우드 동기화 대기${saved.cloudError ? ` (${saved.cloudError})` : ''}`)
  }

  async function saveRelationshipRecord() {
    if (!relationshipResult || !relationshipRequestSnapshot) return
    const kind = selectedTool === 'marriage' ? 'marriage' : 'compatibility'
    const cp = (relationshipRequestSnapshot.counterpart ?? {}) as Record<string, unknown>
    const saved = await saveArchive({
      kind,
      periodKey: period,
      title: `${kind === 'marriage' ? '결혼운' : '궁합운'} · ${String(cp.name ?? '상대')} · ${relationshipResult.period.start}`,
      periodStart: relationshipResult.period.start,
      periodEnd: relationshipResult.period.end,
      engine: relationshipResult.engine,
      request: relationshipRequestSnapshot,
      result: relationshipResult as unknown as Record<string, unknown>,
    })
    setArchiveStatus(saved.cloudSynced ? '기록 저장 + Supabase 동기화 완료' : `이 기기에 기록 저장 완료 · 클라우드 동기화 대기${saved.cloudError ? ` (${saved.cloudError})` : ''}`)
  }

  async function refreshArchive() {
    setArchiveLoading(true)
    setArchiveError('')
    try {
      const data = await listArchive()
      setArchiveItems(data.items)
      if (data.cloudAvailable) setArchiveStatus(data.cloudError ? `클라우드 연결됨 · 일부 동기화 주의: ${data.cloudError}` : `Supabase 클라우드 기록 연결됨 · ${data.items.length}개`)
      else setArchiveStatus(data.cloudError ? `이 기기 기록 사용 중 · 클라우드 대기: ${data.cloudError}` : `이 기기 기록 사용 중 · ${data.items.length}개`)
    } catch (error) {
      const message = error instanceof Error ? error.message : '기록을 불러오지 못했어.'
      setArchiveError(message)
      setArchiveStatus('기록 불러오기 오류')
    } finally {
      setArchiveLoading(false)
    }
  }

  function restoreArchive(item: ArchiveItem) {
    if (item.kind === 'daily' || item.kind === 'outcome') {
      setLegacyArchiveOpen(item)
      setMainView('history')
      return
    }
    setLegacyArchiveOpen(null)
    setQueryDate(item.periodStart)
    setPeriod(item.periodKey)
    if (item.kind === 'integrated' || item.kind === 'precision') {
      setIntegratedResult(item.result as unknown as IntegratedApiResponse)
      setIntegratedRequestSnapshot(item.request)
      setSelectedTool(item.kind)
    } else {
      const request = item.request
      const cp = (request.counterpart ?? {}) as Record<string, unknown>
      const known = cp.time_known !== false
      setRelationshipResult(item.result as unknown as RelationshipApiResponse)
      setRelationshipRequestSnapshot(request)
      setRelationshipMode((request.relationship_status as RelationshipStatus) || 'dating')
      setCounterpart({
        ...emptyCounterpart,
        name: String(cp.name ?? ''),
        birthDate: String(cp.birth_date ?? ''),
        birthTime: known ? String(cp.birth_time ?? '').slice(0, 5) : '',
        latitude: known && cp.latitude != null ? String(cp.latitude) : '',
        longitude: known && cp.longitude != null ? String(cp.longitude) : '',
        utcOffset: String(cp.utc_offset_hours ?? 9),
        timeKnown: known,
      })
      setSelectedTool(item.kind)
    }
    setMainView('home')
  }

  async function copyArchiveResult(item: ArchiveItem) {
    if (item.kind === 'daily' || item.kind === 'outcome') {
      await handleCopy('이전 기록 전체복사', JSON.stringify(item.result, null, 2))
      return
    }
    if (item.kind === 'integrated' || item.kind === 'precision') {
      const result = item.result as unknown as IntegratedApiResponse
      await handleCopy('저장 결과 전체복사', item.kind === 'precision' ? precisionResultText(result) : integratedResultText(result))
    } else {
      await handleCopy('저장 결과 전체복사', relationshipResultText(item.kind, item.result as unknown as RelationshipApiResponse))
    }
  }

  async function removeArchive(item: ArchiveItem) {
    try {
      await deleteArchive(item)
      if (legacyArchiveOpen?.id === item.id) setLegacyArchiveOpen(null)
      setArchiveStatus('기록 삭제 완료')
      await refreshArchive()
    } catch (error) {
      setArchiveStatus(error instanceof Error ? error.message : '기록 삭제 중 오류가 발생했어.')
    }
  }

  return (
    <div className={`app-shell ${uiSettings.glow ? 'celestial-glow-on' : 'celestial-glow-off'} ${uiSettings.motion ? 'celestial-motion-on' : 'celestial-motion-off'}`}>
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

            {integratedMatchesSelection && integratedResult && <div className="results-wrap integrated-results">
              <div className="result-headline"><CheckCircle2 size={20}/><div><strong>통합 계산 완료</strong><span>{integratedResult.engine} · {integratedResult.period.day_count}일 · {integratedResult.period.month_segments}개 월 구간</span></div></div>
              <AiInterpretationPanel result={aiInterpretation} loading={aiLoading} error={aiError} onRetry={()=>void runAiInterpretation()}/>
              <div className="result-actions">
                <button type="button" onClick={()=>integratedRequestSnapshot && handleCopy('요청/프롬프트 전체복사', integratedPromptText(integratedRequestSnapshot))}><Copy size={15}/><span>요청/프롬프트 전체복사</span></button>
                <button type="button" onClick={()=>handleCopy('결과 전체복사', integratedResultText(integratedResult))}><Copy size={15}/><span>결과 전체복사</span></button>
                <button className="save-action" type="button" onClick={saveIntegratedRecord}><Save size={15}/><span>기록 저장</span></button>
              </div>
              {actionNotice && <div className="status-banner subtle"><CheckCircle2 size={16}/><span>{actionNotice}</span></div>}
              {archiveStatus && <div className="status-banner subtle"><Cloud size={16}/><span>{archiveStatus}</span></div>}

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
              <div className="result-actions">
                <button type="button" onClick={()=>relationshipRequestSnapshot && handleCopy('요청/프롬프트 전체복사', relationshipPromptText(selectedTool==='marriage'?'marriage':'compatibility', relationshipRequestSnapshot))}><Copy size={15}/><span>요청/프롬프트 전체복사</span></button>
                <button type="button" onClick={()=>handleCopy('결과 전체복사', relationshipResultText(selectedTool==='marriage'?'marriage':'compatibility', relationshipResult))}><Copy size={15}/><span>결과 전체복사</span></button>
                <button className="save-action" type="button" onClick={saveRelationshipRecord}><Save size={15}/><span>기록 저장</span></button>
              </div>
              {actionNotice && <div className="status-banner subtle"><CheckCircle2 size={16}/><span>{actionNotice}</span></div>}
              {archiveStatus && <div className="status-banner subtle"><Cloud size={16}/><span>{archiveStatus}</span></div>}
              <section className="result-card">
                <div className="result-card-title"><span>STATIC</span><strong>기본 관계 구조</strong></div><div className="metric-grid"><div className="metric"><strong>{natalAspects.length}</strong><span>시너스트리 접점</span></div><div className="metric"><strong>{relationshipResult.result.davison?.available?'ON':'OFF'}</strong><span>다빈슨</span></div><div className="metric"><strong>{relationshipResult.result.marks?.available?'ON':'OFF'}</strong><span>마크스</span></div></div><div className="aspect-list">{natalAspects.slice(0,8).map((aspect,index)=><div className="aspect-row" key={`${aspect.a}-${aspect.aspect}-${aspect.b}-${index}`}><span className={`tone-dot ${aspect.tone}`}/><div><strong>{aspectText(aspect)}</strong><span>오브 {aspect.orb.toFixed(2)}° · {aspect.tone==='supportive'?'조화':aspect.tone==='challenging'?'긴장':'혼합'}</span></div></div>)}</div></section>
              {resultMonths.length>0 && <section className="result-card"><div className="result-card-title"><span>TIMING</span><strong>기간별 활성도</strong></div><p className="result-note">접점 수는 사건 확률이 아니야. 독립 레이어에서 반복되는 정밀 접점을 보는 용도야.</p><div className="month-list">{resultMonths.map((month)=><div className="month-card" key={`${month.calendar_month}-${month.representative_date}`}><div className="month-title"><strong>{month.calendar_month}</strong><span>대표일 {month.representative_date}</span></div><div className="month-metrics"><span><b>{month.signal_summary.exact_contacts}</b> 정밀</span><span><b>{month.signal_summary.supportive_contacts}</b> 조화</span><span><b>{month.signal_summary.challenging_contacts}</b> 긴장</span></div>{month.signal_summary.tightest.slice(0,3).map((aspect,index)=><div className="tight-row" key={index}><span>{aspectText(aspect)}</span><b>{aspect.orb.toFixed(2)}°</b></div>)}</div>)}</div></section>}
              {(relationshipResult.result.limitations?.length??0)>0 && <div className="status-banner subtle"><AlertTriangle size={16}/><span>{relationshipResult.result.limitations?.join(' ')}</span></div>}
            </div>}
          </section>}

          {selectedTool === 'precision' && <section className="tool-panel precision-panel">
            <div className="tool-panel-heading"><span className="tool-icon tone-sage"><Search size={22}/></span><div><span className="eyebrow">LIVE PRECISION ENGINE</span><h2>정밀분석</h2><p>새 점수를 만들지 않고 운영 중인 통합 실계산의 원자료를 더 깊게 펼쳐봐. Western(서양점성술) 세부 지표, 사주 원자료, Thai(태국점성술) 상태와 원본 JSON까지 확인할 수 있어.</p></div></div>
            <div className="calculation-range"><CalendarDays size={17}/><span>{queryDate} → {periodEnd(queryDate,period)} · {periods.find((item)=>item.key===period)?.label} 범위</span></div>
            <div className="coordinate-note"><Search size={16}/><span>통합운세와 같은 `/v1/fortune/integrated` 실제 엔진을 재사용해. 같은 날짜·기간 계산이 이미 있으면 다시 호출하지 않고 동일 응답을 정밀 화면에서 그대로 펼쳐 보여줘.</span></div>
            {integratedError && <div className="status-banner error"><AlertTriangle size={17}/><span>{integratedError}</span></div>}
            {!integratedMatchesSelection && <button className="primary-button" type="button" onClick={runIntegrated} disabled={integratedLoading||apiStatus==='offline'}>{integratedLoading?<LoaderCircle className="spin" size={18}/>:<Search size={18}/>}<span>{integratedLoading?'정밀 계산 중…':'정밀분석 실제 계산'}</span></button>}

            {integratedMatchesSelection && integratedResult && <div className="results-wrap precision-results">
              <div className="result-headline"><CheckCircle2 size={20}/><div><strong>정밀 실계산 준비 완료</strong><span>{integratedResult.engine} · {integratedResult.period.day_count}일 · 원자료 확장 보기</span></div></div>
              <div className="result-actions">
                <button type="button" onClick={()=>integratedRequestSnapshot && handleCopy('정밀 요청/프롬프트 전체복사', precisionPromptText(integratedRequestSnapshot))}><Copy size={15}/><span>요청/프롬프트 전체복사</span></button>
                <button type="button" onClick={()=>handleCopy('정밀 결과 전체복사', precisionResultText(integratedResult))}><Copy size={15}/><span>결과 전체복사</span></button>
                <button className="save-action" type="button" onClick={savePrecisionRecord}><Save size={15}/><span>정밀 기록 저장</span></button>
              </div>
              {actionNotice && <div className="status-banner subtle"><CheckCircle2 size={16}/><span>{actionNotice}</span></div>}
              {archiveStatus && <div className="status-banner subtle"><Cloud size={16}/><span>{archiveStatus}</span></div>}

              <section className="result-card">
                <div className="result-card-title"><span>WESTERN AXES</span><strong>출생축 · 계산 엔진</strong></div>
                <div className="precision-kpi-grid">
                  <div className="precision-kpi"><span>ASC(상승점)</span><strong>{integratedResult.western.natal.asc.toFixed(3)}°</strong></div>
                  <div className="precision-kpi"><span>MC(중천점)</span><strong>{integratedResult.western.natal.mc.toFixed(3)}°</strong></div>
                  <div className="precision-kpi"><span>천문력</span><strong>{integratedResult.western.ephemeris}</strong></div>
                  <div className="precision-kpi"><span>Western 엔진</span><strong>{integratedResult.western.engine}</strong></div>
                </div>
                <p className="result-note">{integratedResult.western.score_policy}</p>
              </section>

              <section className="result-card">
                <div className="result-card-title"><span>ALL TOPICS</span><strong>전 분야 세부 지표</strong></div>
                <div className="precision-table">{topIntegratedTopics.map(({topic,stat})=>{
                  const best = stat.best_days?.[0]
                  const caution = stat.caution_days?.[0]
                  return <div className="precision-row" key={`precision-${topic}`}><strong>{topic}</strong><span className="precision-score">{stat.average.toFixed(2)}</span><span>{stat.band} · Δ{stat.spread.toFixed(2)}</span><div className="precision-date-stack"><span>↑ {best ? `${best.date} ${best.score.toFixed(1)}` : '—'}</span><span>↓ {caution ? `${caution.date} ${caution.score.toFixed(1)}` : '—'}</span></div></div>
                })}</div>
              </section>

              {precisionRelationshipSignals.length>0 && <section className="result-card">
                <div className="result-card-title"><span>RELATIONSHIP SIGNALS</span><strong>관계 관련 기간 신호</strong></div>
                <div className="precision-table">{precisionRelationshipSignals.map(([topic,stat])=><div className="precision-row" key={`relationship-signal-${topic}`}><strong>{topic}</strong><span className="precision-score">{stat.average.toFixed(2)}</span><span>{stat.band}</span><span>변동폭 {stat.spread.toFixed(2)}</span></div>)}</div>
                <p className="result-note">이 값도 연락·재회·결혼의 사건 확률이 아니라 상대적 활성도야.</p>
              </section>}

              {integratedResult.western.months.length>0 && <section className="result-card">
                <div className="result-card-title"><span>MONTH RAW</span><strong>월별 전체 지표</strong></div>
                {integratedResult.western.months.map((month)=><details className="precision-details" key={`precision-month-${month.calendar_month}`}><summary>{month.calendar_month} · {month.start}~{month.end}</summary><div className="precision-details-body"><div className="precision-table">{topicOrder.map((topic)=>{
                  const stat = month.topics[topic]
                  return stat ? <div className="precision-row" key={`${month.calendar_month}-${topic}`}><strong>{topic}</strong><span className="precision-score">{stat.average.toFixed(2)}</span><span>{stat.band}</span><span>Δ {stat.spread.toFixed(2)}</span></div> : null
                })}</div></div></details>)}
              </section>}

              <section className="result-card">
                <div className="result-card-title"><span>SAJU RAW</span><strong>사주 계산 원자료</strong></div>
                {integratedResult.saju.ok && integratedResult.saju.pillars ? <>
                  <div className="pillar-grid">
                    <div><span>년주</span><strong>{integratedResult.saju.pillars.year}</strong></div><div><span>월주</span><strong>{integratedResult.saju.pillars.month}</strong></div><div><span>일주</span><strong>{integratedResult.saju.pillars.day}</strong></div><div><span>시주</span><strong>{integratedResult.saju.pillars.hour}</strong></div>
                  </div>
                  {integratedResult.saju.elements && <><div className="subsection-title">오행 카운트</div><div className="element-grid">{Object.entries(integratedResult.saju.elements).map(([name,count])=><div key={name}><span>{name}</span><strong>{count}</strong></div>)}</div></>}
                  {integratedResult.saju.true_solar && <div className="coordinate-note"><Sun size={16}/><span>법정 출생시 {integratedResult.saju.true_solar.legal_local_time} → 진태양시 {integratedResult.saju.true_solar.true_solar_time} · 총 보정 {integratedResult.saju.true_solar.total_correction_minutes>0?'+':''}{integratedResult.saju.true_solar.total_correction_minutes.toFixed(2)}분</span></div>}
                  {(integratedResult.saju.dayun?.length??0)>0 && <details className="precision-details" open><summary>대운 전체</summary><div className="precision-details-body">{integratedResult.saju.dayun?.map((row)=><div className="tight-row" key={`${row.start_year}-${row.ganzhi}`}><span>{row.start_year}~{row.end_year} · {row.start_age}~{row.end_age}세</span><b>{row.ganzhi}</b></div>)}</div></details>}
                  {(integratedResult.saju.annual?.length??0)>0 && <details className="precision-details"><summary>세운 전체</summary><div className="precision-details-body">{integratedResult.saju.annual?.map((row)=><div className="tight-row" key={`${row.year}-${row.ganzhi}`}><span>{row.year} · {row.stem_ten_god} · {row.branch_links.join(', ')||'연결 없음'}</span><b>{row.ganzhi}</b></div>)}</div></details>}
                  {(integratedResult.saju.monthly?.length??0)>0 && <details className="precision-details"><summary>월운 전체</summary><div className="precision-details-body">{integratedResult.saju.monthly?.map((row)=><div className="tight-row" key={`${row.calendar_month}-${row.ganzhi}`}><span>{row.calendar_month} · {row.stem_ten_god} · {row.branch_links.join(', ')||'연결 없음'}</span><b>{row.ganzhi}</b></div>)}</div></details>}
                  {(integratedResult.saju.not_calculated?.length??0)>0 && <><div className="subsection-title">엔진 미계산 · 임의 추정 금지</div><div className="precision-badge-row">{integratedResult.saju.not_calculated?.map((item)=><span key={item}>{item}</span>)}</div></>}
                </> : <div className="status-banner error"><AlertTriangle size={16}/><span>{integratedResult.saju.error||'사주 계산 원자료가 없어.'}</span></div>}
              </section>

              <section className="result-card">
                <div className="result-card-title"><span>THAI STATUS</span><strong>태국점성술 계산 상태</strong></div>
                <div className="precision-kpi-grid"><div className="precision-kpi"><span>출생요일</span><strong>{integratedResult.thai.thai_day}</strong></div><div className="precision-kpi"><span>주재 행성</span><strong>{integratedResult.thai.ruler}</strong></div></div>
                <div className="tight-row"><span>규칙</span><b>{integratedResult.thai.rule}</b></div>
                <div className="tight-row"><span>예측 구현 상태</span><b>{integratedResult.thai.predictive_status}</b></div>
                <div className="tight-row"><span>합의 정책</span><b>{integratedResult.thai.consensus_policy}</b></div>
              </section>

              <section className="result-card">
                <div className="result-card-title"><span>RAW JSON</span><strong>원본 계산 응답</strong></div>
                <details className="precision-details"><summary>원본 JSON 전체 펼치기</summary><div className="precision-details-body"><pre className="precision-json">{JSON.stringify(integratedResult,null,2)}</pre></div></details>
              </section>
            </div>}
          </section>}
          <section className="tool-panel">
            <div className="tool-panel-heading"><span className="tool-icon tone-gold"><Moon size={22}/></span><div><span className="eyebrow">LIVE CELESTIAL REPORT</span><h2>{period==='today'?'오늘의 리포트':`${periods.find((item)=>item.key===period)?.label} 리포트`}</h2><p>{queryDate} → {integratedSelectionEnd} · 통합운세 실계산 요약</p></div></div>

            {!integratedMatchesSelection && <>
              <div className="coordinate-note"><Sparkles size={16}/><span>현재 선택한 기간의 계산 결과가 아직 없어. 아래 버튼은 통합운세와 같은 Render 실계산을 한 번만 실행하고, 그 응답을 이 홈 리포트와 상세 통합운세가 함께 재사용해.</span></div>
              {integratedError && <div className="status-banner error"><AlertTriangle size={17}/><span>{integratedError}</span></div>}
              <button className="primary-button" type="button" onClick={runIntegrated} disabled={integratedLoading||apiStatus==='offline'}>{integratedLoading?<LoaderCircle className="spin" size={18}/>:<Sparkles size={18}/>}<span>{integratedLoading?'리포트 계산 중…':`${period==='today'?'오늘':periods.find((item)=>item.key===period)?.label} 리포트 계산`}</span></button>
            </>}

            {integratedMatchesSelection && integratedResult && <>
              <div className="result-headline"><CheckCircle2 size={20}/><div><strong>실계산 리포트 준비 완료</strong><span>{integratedResult.engine} · {integratedResult.period.day_count}일 분석</span></div></div>
              <AiInterpretationPanel result={aiInterpretation} loading={aiLoading} error={aiError} onRetry={()=>void runAiInterpretation()}/>

              <section className="result-card">
                <div className="result-card-title"><span>CORE FLOW</span><strong>핵심 흐름</strong></div>
                <div className="integrated-topic-grid">
                  {topIntegratedTopics.slice(0,3).map(({topic,stat})=><div className="integrated-topic" key={`home-top-${topic}`}><span>{topic}</span><strong>{stat.average.toFixed(1)}</strong><small>{stat.band}</small></div>)}
                </div>
                {cautionIntegratedTopics.length>0 && <div className="best-window"><span>상대적 주의 흐름</span><strong>{cautionIntegratedTopics.map((row)=>`${row.topic} ${row.stat.average.toFixed(1)}`).join(' · ')}</strong></div>}
              </section>

              {(bestIntegratedDays.length>0 || cautionIntegratedDays.length>0) && <section className="result-card">
                <div className="result-card-title"><span>TIMING</span><strong>좋은 날짜 · 주의 날짜</strong></div>
                {bestIntegratedDays.map((point)=><div className="tight-row" key={`best-${point.date}`}><span>✨ {point.date} · {point.topic} · {point.label}</span><b>{point.score.toFixed(1)}</b></div>)}
                {cautionIntegratedDays.map((point)=><div className="tight-row" key={`caution-${point.date}`}><span>⚠️ {point.date} · {point.topic} · {point.label}</span><b>{point.score.toFixed(1)}</b></div>)}
                <p className="result-note">날짜 점수는 사건 확률이 아니라 기존 Western 기간엔진의 상대적 활성도야.</p>
              </section>}

              <section className="result-card">
                <div className="result-card-title"><span>SYSTEMS</span><strong>사주 · Thai 요약</strong></div>
                <div className="saju-summary">
                  {integratedResult.saju.ok && integratedResult.saju.day_master && <span>사주 일간 <b>{integratedResult.saju.day_master}</b></span>}
                  {activeDayun && <span>현재 대운 <b>{activeDayun.ganzhi}</b> · {activeDayun.start_year}~{activeDayun.end_year}</span>}
                  <span>Thai <b>{integratedResult.thai.thai_day}</b> · {integratedResult.thai.ruler}</span>
                </div>
                <p className="result-note">Thai는 아직 출생요일 baseline만 표시하며 날짜별 예측 점수에는 섞지 않아.</p>
              </section>

              <div className="result-actions home-result-actions">
                <button type="button" onClick={()=>integratedRequestSnapshot && handleCopy('요청/프롬프트 전체복사', integratedPromptText(integratedRequestSnapshot))}><Copy size={15}/><span>요청/프롬프트 전체복사</span></button>
                <button type="button" onClick={()=>handleCopy('결과 전체복사', integratedResultText(integratedResult))}><Copy size={15}/><span>결과 전체복사</span></button>
                <button className="save-action" type="button" onClick={saveIntegratedRecord}><Save size={15}/><span>기록 저장</span></button>
              </div>
              {actionNotice && <div className="status-banner subtle"><CheckCircle2 size={16}/><span>{actionNotice}</span></div>}
              {archiveStatus && <div className="status-banner subtle"><Cloud size={16}/><span>{archiveStatus}</span></div>}
              <button className="primary-button" type="button" onClick={()=>setSelectedTool('integrated')}><Search size={18}/><span>상세 통합운세 보기</span></button>
            </>}
          </section>
        </>}

        {mainView === 'profile' && <section className="form-card profile-form-card">
          <div className="form-card-heading"><div className="report-icon"><User size={21}/></div><div><span className="eyebrow">MY BIRTH PROFILE</span><h2>내 출생 프로필</h2><p>정밀 계산에만 사용하고 이 브라우저 기기에 로컬 저장해.</p></div></div>
          <div className="privacy-note"><CheckCircle2 size={16}/><span>출생 프로필 자체는 이 브라우저에 저장해. 분석 기록에서 “기록 저장”을 누르면 계산 입력과 결과가 본인 전용 Supabase 기록에도 동기화될 수 있어.</span></div>
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

        {mainView === 'history' && <section className="form-card archive-view">
          <div className="form-card-heading"><div className="report-icon"><History size={21}/></div><div><span className="eyebrow">ARCHIVE</span><h2>분석 기록</h2><p>통합운세·정밀분석·궁합·결혼운 결과를 저장하고 다시 열어볼 수 있어.</p></div></div>
          <div className="archive-sync-row"><span><Cloud size={15}/>{archiveLoading ? '기록 연결 상태 확인 중' : archiveStatus || '기록 연결 상태 확인 전'}</span><button type="button" onClick={refreshArchive} disabled={archiveLoading}><RefreshCw className={archiveLoading?'spin':''} size={15}/>새로고침</button></div>
          {legacyArchiveOpen && <section className={`legacy-archive-detail legacy-${legacyArchiveOpen.kind}`}>
            <div className="legacy-archive-head"><div><span className={`archive-kind kind-${legacyArchiveOpen.kind}`}>{legacyArchiveOpen.kind==='daily'?'이전 일일운세':'결과 기록'}</span><strong>{legacyArchiveOpen.title}</strong><small>{legacyArchiveOpen.periodStart} · {new Date(legacyArchiveOpen.createdAt).toLocaleString('ko-KR')}</small></div><button type="button" onClick={()=>setLegacyArchiveOpen(null)}>닫기</button></div>
            <p>{legacyArchiveOpen.kind==='daily'?'이전 앱에서 저장한 일일운세 원문이야. 기존 계산·해석 데이터를 수정하지 않고 그대로 보존했어.':'이전 앱에서 남긴 실제 결과/피드백 기록이야. 당시 메모와 점수를 원본 그대로 보존했어.'}</p>
            <details open><summary>원문 데이터 보기</summary><pre>{JSON.stringify(legacyArchiveOpen.result,null,2)}</pre></details>
          </section>}
          {archiveError && <div className="status-banner error"><AlertTriangle size={16}/><span>{archiveError}</span></div>}
          {archiveLoading && archiveItems.length===0 && <div className="status-banner subtle"><LoaderCircle className="spin" size={16}/><span>저장된 기록을 불러오는 중…</span></div>}
          {!archiveLoading && !archiveError && archiveItems.length===0 && <div className="archive-empty"><History size={22}/><strong>저장된 기록 0개</strong><span>클라우드 연결은 정상이고, 현재 세션에 저장된 분석 결과가 아직 없어. 계산 결과에서 “기록 저장”을 누르면 여기에 쌓여.</span><button className="archive-empty-action" type="button" onClick={()=>switchMainView('home')}><Home size={15}/>홈에서 계산하고 기록 저장하기</button></div>}
          <div className="archive-list">{archiveItems.map((item)=><article className="archive-card" key={item.id}>
            <div className="archive-card-top"><div><span className={`archive-kind kind-${item.kind}`}>{item.kind==='integrated'?'통합운세':item.kind==='precision'?'정밀분석':item.kind==='marriage'?'결혼운':item.kind==='compatibility'?'궁합운':item.kind==='daily'?'이전 일일운세':'결과 기록'}</span><strong>{item.title}</strong><small>{new Date(item.createdAt).toLocaleString('ko-KR')} · {item.periodStart}~{item.periodEnd}</small></div><span className={`sync-chip ${item.syncState}`}><Cloud size={12}/>{item.syncState==='cloud'?'클라우드':'이 기기'}</span></div>
            <div className="archive-actions">
              <button type="button" onClick={()=>restoreArchive(item)}><Search size={14}/>다시 열기</button>
              <button type="button" onClick={()=>copyArchiveResult(item)}><Copy size={14}/>전체복사</button>
              <button className="danger" type="button" onClick={()=>removeArchive(item)}><Trash2 size={14}/>삭제</button>
            </div>
          </article>)}</div>
        </section>}

        {mainView === 'settings' && <section className="form-card settings-view">
          <div className="form-card-heading"><div className="report-icon"><Settings size={21}/></div><div><span className="eyebrow">SETTINGS</span><h2>설정</h2><p>별빛 화면 효과와 앱 상태를 여기서 조절해.</p></div></div>

          <div className="settings-list">
            <label className="settings-toggle-row">
              <span className="settings-row-icon lilac"><Sparkles size={19}/></span>
              <span className="settings-row-copy"><strong>별빛 · 오로라 효과</strong><small>파스텔 빛 번짐, 글로우, 천체 장식의 강도를 켜고 꺼.</small></span>
              <span className="toggle-switch"><input type="checkbox" checked={uiSettings.glow} onChange={(e)=>setUiSettings({...uiSettings, glow:e.target.checked})}/><span className="toggle-track"><span/></span></span>
            </label>
            <label className="settings-toggle-row">
              <span className="settings-row-icon blue"><Orbit size={19}/></span>
              <span className="settings-row-copy"><strong>잔잔한 애니메이션</strong><small>별 반짝임과 광택 이동 효과를 사용해.</small></span>
              <span className="toggle-switch"><input type="checkbox" checked={uiSettings.motion} onChange={(e)=>setUiSettings({...uiSettings, motion:e.target.checked})}/><span className="toggle-track"><span/></span></span>
            </label>
          </div>

          <div className="subsection-title">AI 해석</div>
          <div className="ai-settings-card">
            <label><span><strong>AI 해석 모델</strong><small>실계산 뒤에 붙는 자연어 해설 모델</small></span><select value={aiModel} onChange={(e)=>setAiModel(e.target.value)}><option value="gemini-3.7-flash">Gemini 3.7 Flash · 정밀 우선</option><option value="gemini-3.6-flash">Gemini 3.6 Flash · 빠른 해설</option></select></label>
            <div className={`ai-api-state ${aiConfigured===true?'online':aiConfigured===false?'offline':'checking'}`}><Sparkles size={16}/><span><strong>Gemini API</strong><small>{aiConfigured===true?'서버 비밀키 연결됨 · 계산 후 자동 해설':aiConfigured===false?'미연결 · Render에 GEMINI_API_KEY 설정 필요':'연결 상태 확인 중'}</small></span></div>
          </div>

          <div className="subsection-title">앱 상태</div>
          <div className="settings-status-grid">
            <div><span>계산 서버</span><strong>{apiStatus==='online'?'연결됨':apiStatus==='warming'?'확인 중':'대기 중'}</strong><small>{apiVersion || 'API 상태 확인'}</small></div>
            <div><span>AI 해설</span><strong>{aiConfigured===true?'연결됨':aiConfigured===false?'미연결':'확인 중'}</strong><small>{aiModel}</small></div>
            <div><span>클라우드 기록</span><strong>{archiveLoading?'확인 중':archiveError?'확인 오류':archiveItems.length+'개'}</strong><small>{archiveError || archiveStatus || '기록 상태 확인 전'}</small></div>
            <div><span>출생 프로필</span><strong>{hasProfile?'저장됨':'미저장'}</strong><small>{hasProfile?'이 브라우저 기기 보관':'내정보에서 먼저 저장'}</small></div>
          </div>

          <div className="privacy-note settings-note"><Cloud size={16}/><span>클라우드 기록은 현재 익명 로그인 세션 기준이야. Safari와 홈화면 웹앱이 서로 다른 익명 세션을 만들면 기록이 따로 보일 수 있어. 장기적으로 기기 간 동일 기록이 필요하면 Apple/Google 로그인이 필요해.</span></div>
          <div className="settings-actions"><button type="button" onClick={()=>switchMainView('history')}><History size={16}/>기록함 열기</button><button type="button" onClick={()=>switchMainView('profile')}><User size={16}/>출생 프로필 열기</button></div>
        </section>}
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
