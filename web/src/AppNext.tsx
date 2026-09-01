import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, CalendarDays, CheckCircle2, ChevronDown, Cloud, Copy, Gem, Heart, History, Home,
  LoaderCircle, MapPin, Moon, Orbit, RefreshCw, Save, Search, Settings, Sparkles, Sun, Trash2, User,
} from 'lucide-react'
import { KoreaBirthplaceSelector } from './koreaBirthplaces'
import { AstrocartographyWorldMap } from './AstrocartographyWorldMap'
import { deleteArchive, listArchive, saveArchive, type ArchiveItem } from './lib/archive'
import { disablePush, enablePush, getPushState, type PushSnapshot } from './lib/push'
import { ensureSupabaseSession, supabase } from './lib/supabase'
import { fortuneAiCacheId, fortuneCalculationCacheId, readReadingCache, relationshipAiCacheId, writeReadingCache } from './lib/readingCache'

import type {
  PeriodKey,
  ApiStatus,
  MainView,
  ToolKey,
  RelationshipStatus,
  RelationshipPurpose,
  MarriageMode,
  RelationshipAnalysisMode,
  Gender,
  BirthProfile,
  CounterpartProfile,
  Aspect,
  SignalSummary,
  RelationshipMonth,
  RelationshipApiResponse,
  RelationshipAiResponse,
  FortunePoint,
  FortuneStat,
  FortuneMonth,
  ReunionTimingContext,
  IntegratedApiResponse,
  LocationFitResponse,
  AiTopicInterpretation,
  AiInterpretationResponse
} from './appTypes'

import { PeriodAiInterpretationPanel } from './PeriodAiInterpretationPanel'
import { AiInterpretationPanel } from './AiInterpretationPanel'
import { RelationshipInterpretationPanel } from './RelationshipInterpretationPanel'
import { ReunionTimingPanel, ReunionTransitPanel } from './ReunionPanels'
import { ArchiveView } from './ArchiveView'
import { estimateGeminiUsage } from './lib/aiUsage'
import { copyToClipboard } from './lib/clipboard'
import { coreTopicOrder, marketTopicOrder, topicOrder } from './lib/fortuneTopics'
import { aspectText, planetLabels, integratedPromptText, integratedResultText, relationshipPromptText, relationshipResultText, precisionPromptText, precisionResultText } from './lib/resultFormatters'

const DEFAULT_API_BASE = 'https://astro-app-api-f7fn.onrender.com'
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE).replace(/\/$/, '')
const PROFILE_STORAGE_KEY = 'starlight-destiny.birth-profile.v1'
const UI_SETTINGS_STORAGE_KEY = 'starlight-destiny.ui-settings.v1'
const AI_MODEL_STORAGE_KEY = 'starlight-destiny.ai-model.v1'
const AI_JOB_STORAGE_KEY = 'starlight-destiny.ai-job.v1'

const PERIOD_CACHE_TTL_DAYS: Record<PeriodKey, number> = {
  today: 180,
  week: 370,
  month: 730,
  year: 1825,
}
const RELATIONSHIP_AI_CACHE_TTL_DAYS = 1825

function fortuneCacheTtlDays(periodKey: PeriodKey, tool: ToolKey | null) {
  if (tool === 'integrated') return PERIOD_CACHE_TTL_DAYS.year
  return PERIOD_CACHE_TTL_DAYS[periodKey]
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
  { key: 'location' as const, label: '지역·국가운', desc: '나와 잘 맞는 국가·도시를 목적별로 비교', icon: MapPin, tone: 'sage' },
  { key: 'precision' as const, label: '정밀분석', desc: '세부 계산과 고급 점성 레이어', icon: Search, tone: 'sage' },
]

const relationshipModes: Array<[RelationshipStatus, string]> = [
  ['dating', '연애중'], ['long_term', '장기커플'], ['cohabiting', '동거'], ['engaged', '약혼'], ['married', '기혼'],
]

const emptyProfile: BirthProfile = {
  name: '', birthDate: '', birthTime: '', placeKey: '', latitude: '', longitude: '', utcOffset: '9', gender: 'female',
}
const emptyCounterpart: CounterpartProfile = { ...emptyProfile, timeKnown: true }

const hanjaReading: Record<string, string> = {
  '甲':'갑','乙':'을','丙':'병','丁':'정','戊':'무','己':'기','庚':'경','辛':'신','壬':'임','癸':'계',
  '子':'자','丑':'축','寅':'인','卯':'묘','辰':'진','巳':'사','午':'오','未':'미','申':'신','酉':'유','戌':'술','亥':'해',
  '沖':'충','冲':'충','合':'합','刑':'형','破':'파','害':'해',
}
function annotateUserFacingText(value: string) {
  let text = String(value ?? '')
  const replacements: Array<[RegExp, string]> = [
    [/\bMercury\b(?!\s*\()/g, 'Mercury(수성)'], [/\bVenus\b(?!\s*\()/g, 'Venus(금성)'],
    [/\bMars\b(?!\s*\()/g, 'Mars(화성)'], [/\bJupiter\b(?!\s*\()/g, 'Jupiter(목성)'],
    [/\bSaturn\b(?!\s*\()/g, 'Saturn(토성)'], [/\bUranus\b(?!\s*\()/g, 'Uranus(천왕성)'],
    [/\bNeptune\b(?!\s*\()/g, 'Neptune(해왕성)'], [/\bPluto\b(?!\s*\()/g, 'Pluto(명왕성)'],
    [/\bSun\b(?!\s*\()/g, 'Sun(태양)'], [/\bMoon\b(?!\s*\()/g, 'Moon(달)'],
    [/\bASC\b(?!\s*\()/g, 'ASC(상승점)'], [/\bDSC\b(?!\s*\()/g, 'DSC(하강점)'],
    [/\bMC\b(?!\s*\()/g, 'MC(중천점)'], [/\bIC\b(?!\s*\()/g, 'IC(천저점)'],
    [/\bretrograde\b(?!\s*\()/gi, 'retrograde(역행)'], [/\bsquare\b(?!\s*\()/gi, 'square(사각)'],
    [/\btrine\b(?!\s*\()/gi, 'trine(삼각)'], [/\bsextile\b(?!\s*\()/gi, 'sextile(육합)'],
    [/\bconjunction\b(?!\s*\()/gi, 'conjunction(합)'], [/\bopposition\b(?!\s*\()/gi, 'opposition(대립)'],
    [/\bquincunx\b(?!\s*\()/gi, 'quincunx(퀸컨스·150도각)'],
    [/\bWestern\b(?!\s*\()/g, 'Western(서양점성술)'], [/\bThai\b(?!\s*\()/g, 'Thai(태국점성술)'],
    [/\bGemini\b(?!\s*\()/g, 'Gemini(제미나이)'],
  ]
  replacements.forEach(([pattern, label]) => { text = text.replace(pattern, label) })
  text = text.replace(/([甲乙丙丁戊己庚辛壬癸])([子丑寅卯辰巳午未申酉戌亥])(?!\()/g, (m,a,b) => `${m}(${hanjaReading[a]}${hanjaReading[b]})`)
  text = text.replace(/([子丑寅卯辰巳午未申酉戌亥])([子丑寅卯辰巳午未申酉戌亥])([沖冲合刑破害])(?!\()/g, (m,a,b,c) => `${m}(${hanjaReading[a]}${hanjaReading[b]}${hanjaReading[c]})`)
  return text
}
function annotatePayload<T>(value: T): T {
  if (typeof value === 'string') return annotateUserFacingText(value) as T
  if (Array.isArray(value)) return value.map((x) => annotatePayload(x)) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k,v]) => [k, annotatePayload(v)])) as T
  }
  return value
}

function humanizeEvidence(value: string) {
  let text = String(value ?? '')
  const replacements: Array<[RegExp, string]> = [
    [/True Node/g, '진북교점'], [/Uranus/g, '천왕성'], [/Neptune/g, '해왕성'], [/Saturn/g, '토성'],
    [/Jupiter/g, '목성'], [/Mercury/g, '수성'], [/Venus/g, '금성'], [/Pluto/g, '명왕성'], [/Mars/g, '화성'],
    [/Moon/g, '달'], [/Sun/g, '태양'], [/ASC/g, '상승점'], [/DSC/g, '하강점'], [/MC/g, '중천점'], [/IC/g, '천저점'],
    [/Whole Sign/g, '홀사인'], [/Placidus/g, '플라시두스'],
  ]
  replacements.forEach(([pattern, label]) => { text = text.replace(pattern, label) })
  text = text.replace(/(\d+)H\b/g, '$1하우스')
  text = text.replace(/orb\s*/gi, '오브 ')
  return text
}
const topicEmoji: Record<string,string> = {금전:'💰',학업:'📚',시험:'✍️',직장:'💼',이직:'🧭',대인관계:'🤝',연애:'💗',연락:'💌',재회:'🪐',소식:'💌',컨디션:'🌿',투자심리:'📈',수익실현:'💵',신규진입:'🚪',투자주의:'⚠️'}
const topicDisplay = (topic:string) => `${topicEmoji[topic] ?? '✦'} ${topic}`
const relationshipDayPresets = [7,31,90,180,365]
const relationshipSignalOrder = ['수신신호','발신적합','과거인연접점']
const relationshipTimeSensitivePoints = new Set(['Moon','ASC','DSC','MC','IC'])

type OutcomeEvent = '' | 'none' | 'received' | 'sent' | 'both'
type OutcomeTimeBucket = '' | 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night'
type OutcomeChannel = '' | 'message' | 'dm' | 'call' | 'in_person' | 'other'
type DailyOutcomeRecord = {
  date: string
  event: OutcomeEvent
  past_connection: boolean
  event_time_bucket: OutcomeTimeBucket
  channel: OutcomeChannel
  note: string
  saved_at: string
  scores: Record<string, number | null>
}

const OUTCOME_STORAGE_KEY = 'starlight-destiny.relationship-outcomes.v2'

function emptyOutcome(dateValue: string): DailyOutcomeRecord {
  return { date: dateValue, event: '', past_connection: false, event_time_bucket: '', channel: '', note: '', saved_at: '', scores: {} }
}

function readDailyOutcomes(): DailyOutcomeRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(OUTCOME_STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((row)=>row && typeof row.date === 'string') : []
  } catch { return [] }
}

function readDailyOutcome(dateValue: string): DailyOutcomeRecord | null {
  return readDailyOutcomes().find((row)=>row.date === dateValue) ?? null
}

function writeDailyOutcome(record: DailyOutcomeRecord) {
  const current = readDailyOutcomes()
  const next = [record, ...current.filter((row)=>row.date !== record.date)]
    .sort((a,b)=>b.date.localeCompare(a.date))
    .slice(0, 500)
  window.localStorage.setItem(OUTCOME_STORAGE_KEY, JSON.stringify(next))
}

function summarizeDailyOutcomes(records: DailyOutcomeRecord[]) {
  const usable = records.filter((row)=>row.event)
  const contact = usable.filter((row)=>row.event === 'received' || row.event === 'both')
  const none = usable.filter((row)=>row.event === 'none')
  const mean = (rows: DailyOutcomeRecord[], key: string) => {
    const values = rows.map((row)=>row.scores[key]).filter((value): value is number=>typeof value === 'number' && Number.isFinite(value))
    return values.length ? values.reduce((sum,value)=>sum+value,0)/values.length : null
  }
  return {
    n: usable.length,
    contactN: contact.length,
    noneN: none.length,
    incomingContact: mean(contact,'수신신호'),
    incomingNone: mean(none,'수신신호'),
    reconnectionContact: mean(contact,'재접점'),
    reconnectionNone: mean(none,'재접점'),
  }
}

function relationshipLimitKo(text: string) {
  if (text.includes('Partner exact birth time/place missing')) return '상대의 정확한 출생시간·장소가 없어 데이비슨·마크스·마크스 3차 진행은 추정하지 않고 제외했어.'
  if (text.includes('Exact partner birth time')) return '상대의 정확한 출생시간이 없어 해당 정밀 진행 레이어는 계산하지 않았어.'
  return text
}
function initialPeriodFromUrl(): PeriodKey {
  if (typeof window === 'undefined') return 'today'
  const kind = new URLSearchParams(window.location.search).get('kind')
  if (kind === 'weekly') return 'week'
  if (kind === 'monthly') return 'month'
  if (kind === 'annual') return 'year'
  return 'today'
}

function initialDateFromUrl() {
  if (typeof window === 'undefined') return toDateInputValue(new Date())
  const params = new URLSearchParams(window.location.search)
  const date = params.get('date')
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date
  const year = params.get('year')
  const month = params.get('month')
  if (year && month && /^\d{4}$/.test(year) && /^\d{1,2}$/.test(month)) {
    return `${year}-${String(Number(month)).padStart(2,'0')}-01`
  }
  return toDateInputValue(new Date())
}

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
function periodRangeLabel(period: PeriodKey) {
  if (period === 'today') return '1일'
  if (period === 'week') return '7일'
  if (period === 'month') return '31일'
  return '1년 · 365일'
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

function buildReunionTimingContext(result: IntegratedApiResponse): ReunionTimingContext {
  return {
    period: { start: result.period.start, end: result.period.end },
    incoming: result.western.relationship_signals['수신신호'] ?? null,
    outgoing: result.western.relationship_signals['발신적합'] ?? null,
    reconnection: result.western.relationship_signals['과거인연접점'] ?? null,
    months: (result.western.months ?? []).map((month) => ({
      calendar_month: month.calendar_month,
      start: month.start,
      end: month.end,
      incoming: month.relationship_signals['수신신호'] ?? null,
      outgoing: month.relationship_signals['발신적합'] ?? null,
      reconnection: month.relationship_signals['과거인연접점'] ?? null,
    })),
  }
}

function compactPlace(value: unknown) {
  return String(value ?? '').replace('::', ' ') || '위치 미표기'
}

export default function AppNext() {
  const [period, setPeriod] = useState<PeriodKey>(() => initialPeriodFromUrl())
  const [integratedCalendarYear, setIntegratedCalendarYear] = useState<number | null>(null)
  const [queryDate, setQueryDate] = useState(() => initialDateFromUrl())
  const [apiStatus, setApiStatus] = useState<ApiStatus>('warming')
  const [apiVersion, setApiVersion] = useState('')
  const [pushState, setPushState] = useState<PushSnapshot | null>(null)
  const [pushBusy, setPushBusy] = useState(false)
  const [mainView, setMainView] = useState<MainView>('home')
  const [selectedTool, setSelectedTool] = useState<ToolKey | null>(null)
  const [relationshipMode, setRelationshipMode] = useState<RelationshipStatus>('dating')
  const [relationshipPurpose, setRelationshipPurpose] = useState<RelationshipPurpose>('compatibility')
  const [marriageMode, setMarriageMode] = useState<MarriageMode>('unmarried')
  const [relationshipDays, setRelationshipDays] = useState(365)
  const [relationshipCalendarYear, setRelationshipCalendarYear] = useState<number | null>(null)
  const [reunionTiming, setReunionTiming] = useState<ReunionTimingContext | null>(null)
  const [reunionTimingLoading, setReunionTimingLoading] = useState(false)
  const [reunionTimingError, setReunionTimingError] = useState('')
  const [birthProfile, setBirthProfile] = useState<BirthProfile>(() => loadStoredProfile())
  const [profileSaved, setProfileSaved] = useState(false)
  const [counterpart, setCounterpart] = useState<CounterpartProfile>(emptyCounterpart)
  const [relationshipResult, setRelationshipResult] = useState<RelationshipApiResponse | null>(null)
  const [relationshipLoading, setRelationshipLoading] = useState(false)
  const [relationshipError, setRelationshipError] = useState('')
  const [relationshipAi, setRelationshipAi] = useState<RelationshipAiResponse | null>(null)
  const [relationshipAiLoading, setRelationshipAiLoading] = useState(false)
  const [relationshipAiError, setRelationshipAiError] = useState('')
  const [integratedResult, setIntegratedResult] = useState<IntegratedApiResponse | null>(null)
  const [aiInterpretation, setAiInterpretation] = useState<AiInterpretationResponse | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const aiPollRef = useRef<string | null>(null)
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null)
  const [aiModel, setAiModel] = useState(loadAiModel)
  const [aiCacheSource, setAiCacheSource] = useState<'local'|'server'|'fresh'|''>('')
  const [, setRelationshipAiCacheSource] = useState<'local'|'fresh'|''>('')
  const aiRequestRef = useRef('')
  const [outcomeDraft, setOutcomeDraft] = useState<DailyOutcomeRecord>(()=>emptyOutcome(queryDate))
  const [outcomeSaved, setOutcomeSaved] = useState(false)
  const [outcomeNonce, setOutcomeNonce] = useState(0)
  const [integratedLoading, setIntegratedLoading] = useState(false)
  const [integratedProgress, setIntegratedProgress] = useState<{completed:number;total:number;percent:number}|null>(null)
  const [integratedError, setIntegratedError] = useState('')
  const [integratedRequestSnapshot, setIntegratedRequestSnapshot] = useState<Record<string, unknown> | null>(null)
  const [relationshipRequestSnapshot, setRelationshipRequestSnapshot] = useState<Record<string, unknown> | null>(null)
  const [archiveItems, setArchiveItems] = useState<ArchiveItem[]>([])
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [archiveStatus, setArchiveStatus] = useState('')
  const [archiveError, setArchiveError] = useState('')
  const [archiveSaving, setArchiveSaving] = useState(false)
  const [locationResult, setLocationResult] = useState<LocationFitResponse | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [legacyArchiveOpen, setLegacyArchiveOpen] = useState<ArchiveItem | null>(null)
  const [uiSettings, setUiSettings] = useState(() => loadUiSettings())
  const [actionNotice, setActionNotice] = useState('')
  const relationshipRevisionRef = useRef(0)
  const restoringRelationshipRef = useRef(false)

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
  ;(async () => {
    try {
      await ensureSupabaseSession()
      const { data, error } = await supabase.functions.invoke('fortune-interpret-v6-preview', { body: { action: 'meta' } })
      if (error) throw error
      if (!cancelled) setAiConfigured(Boolean(data?.configured))
    } catch {
      if (!cancelled) setAiConfigured(false)
    }
  })()
  return () => { cancelled = true }
}, [])

  useEffect(() => {
    window.localStorage.setItem(AI_MODEL_STORAGE_KEY, aiModel)
  }, [aiModel])

  useEffect(() => {
    relationshipRevisionRef.current += 1
    if (restoringRelationshipRef.current) {
      restoringRelationshipRef.current = false
      return
    }
    if (!relationshipResult && !relationshipRequestSnapshot && !relationshipAi && !reunionTiming) return
    setRelationshipResult(null)
    setRelationshipRequestSnapshot(null)
    setRelationshipAi(null)
    setRelationshipAiCacheSource('')
    setRelationshipAiError('')
    setRelationshipError('')
    setReunionTiming(null)
    setReunionTimingError('')
    setRelationshipLoading(false)
    setRelationshipAiLoading(false)
    setReunionTimingLoading(false)
  }, [selectedTool, relationshipMode, relationshipPurpose, marriageMode, relationshipDays, relationshipCalendarYear, queryDate, birthProfile, counterpart])

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const syncKeyboard = () => {
      const keyboardOpen = window.innerHeight - viewport.height > 160
      document.documentElement.dataset.keyboardOpen = keyboardOpen ? 'true' : 'false'
    }
    syncKeyboard()
    viewport.addEventListener('resize', syncKeyboard)
    viewport.addEventListener('scroll', syncKeyboard)
    return () => { viewport.removeEventListener('resize', syncKeyboard); viewport.removeEventListener('scroll', syncKeyboard) }
  }, [])

  useEffect(() => {
    const resume = () => { if (document.visibilityState !== 'hidden') resumeAiInterpretationJob() }
    document.addEventListener('visibilitychange', resume)
    window.addEventListener('pageshow', resume)
    resume()
    return () => {
      document.removeEventListener('visibilitychange', resume)
      window.removeEventListener('pageshow', resume)
    }
  }, [])

  useEffect(() => {
    if (mainView === 'history' || mainView === 'settings') void refreshArchive()
  }, [mainView])

  useEffect(() => {
    if (mainView === 'settings') void refreshPushState()
  }, [mainView])

  useEffect(() => {
    const existing = readDailyOutcome(queryDate)
    setOutcomeDraft(existing ?? emptyOutcome(queryDate))
    setOutcomeSaved(false)
  }, [queryDate])

  useEffect(() => {
    window.localStorage.setItem(UI_SETTINGS_STORAGE_KEY, JSON.stringify(uiSettings))
    document.documentElement.dataset.celestialGlow = uiSettings.glow ? 'on' : 'off'
    document.documentElement.dataset.celestialMotion = uiSettings.motion ? 'on' : 'off'
  }, [uiSettings])

  const apiLabel = useMemo(() => {
    if (apiStatus === 'warming') return '계산 서버 깨우는 중'
    if (apiStatus === 'online') return '계산 서버 정상'
    return '계산 서버 대기 중'
  }, [apiStatus])

  const selectedToolInfo = selectedTool ? tools.find((tool) => tool.key === selectedTool) : null
  const hasProfile = Boolean(birthProfile.birthDate && birthProfile.birthTime)
  const resultMonths = (relationshipResult?.result?.natal_synastry?.partner_time_exact ? relationshipResult?.result?.months : []) ?? []
  const partnerTimeExact = Boolean(relationshipResult?.result?.natal_synastry?.partner_time_exact)
  const rawNatalAspects = relationshipResult?.result?.natal_synastry?.aspects ?? []
  const natalAspects = partnerTimeExact ? rawNatalAspects : rawNatalAspects.filter((aspect) => !relationshipTimeSensitivePoints.has(aspect.a) && !relationshipTimeSensitivePoints.has(aspect.b))
  const natalSupportive = natalAspects.filter((aspect) => aspect.tone === 'supportive').length
  const natalChallenging = natalAspects.filter((aspect) => aspect.tone === 'challenging').length
  const natalMixed = natalAspects.filter((aspect) => aspect.tone === 'mixed').length
  const orderedIntegratedTopics = integratedResult
    ? coreTopicOrder
        .map((topic) => ({ topic, stat: integratedResult.western.overall[topic] }))
        .filter((row): row is { topic: string; stat: FortuneStat } => Boolean(row.stat))
    : []
  const topIntegratedTopics = [...orderedIntegratedTopics].sort((a,b) => b.stat.average - a.stat.average)
  const orderedRelationshipSignals = integratedResult
    ? relationshipSignalOrder
        .map((topic) => ({ topic, stat: integratedResult.western.relationship_signals[topic] }))
        .filter((row): row is { topic: string; stat: FortuneStat } => Boolean(row.stat))
    : []
  const activeDayun = currentDayun(integratedResult)
  const queryYear = Number(queryDate.slice(0,4)) || new Date().getFullYear()
  const calendarYearOptions = Array.from({length:6},(_,index)=>queryYear - 1 + index)
  const annualFortuneYear = integratedCalendarYear ?? queryYear
  const integratedStartDate = selectedTool === 'integrated' ? `${annualFortuneYear}-01-01` : queryDate
  const integratedSelectionEnd = selectedTool === 'integrated' ? `${annualFortuneYear}-12-31` : periodEnd(queryDate, period)
  const clampedRelationshipDays = Math.max(7, Math.min(365, Number(relationshipDays) || 365))
  const relationshipStartDate = relationshipCalendarYear ? `${relationshipCalendarYear}-01-01` : queryDate
  const relationshipEndDate = relationshipCalendarYear ? `${relationshipCalendarYear}-12-31` : addDays(queryDate, clampedRelationshipDays - 1)
  const relationshipDayCount = Math.round((new Date(`${relationshipEndDate}T12:00:00Z`).getTime()-new Date(`${relationshipStartDate}T12:00:00Z`).getTime())/86400000)+1
  const relationshipPeriodKey: PeriodKey = relationshipCalendarYear || clampedRelationshipDays >= 365 ? 'year' : clampedRelationshipDays >= 28 ? 'month' : 'week'
  const integratedMatchesSelection = Boolean(
    integratedResult &&
    integratedResult.period.start === integratedStartDate &&
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
  const refreshPushState = async () => {
    const state = await getPushState()
    setPushState(state)
  }

  const togglePush = async () => {
    setPushBusy(true)
    try {
      const state = pushState?.status === 'ready' ? await disablePush() : await enablePush()
      setPushState(state)
    } finally {
      setPushBusy(false)
    }
  }

  const saveBirthProfile = () => {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(birthProfile))
    setProfileSaved(true); window.setTimeout(() => setProfileSaved(false), 1800)
  }

  const pollAiInterpretationJob = async (jobId: string, periodStart?: string, periodEndValue?: string, cacheId?: string, ttlDays = PERIOD_CACHE_TTL_DAYS.today, requestForArchive?: Record<string, unknown>) => {
    if (!jobId || aiPollRef.current === jobId) return
    aiPollRef.current = jobId
    setAiLoading(true); setAiError('')
    try {
      await ensureSupabaseSession()
      for (let attempt = 0; attempt < 180; attempt++) {
        if (document.visibilityState === 'hidden') return
        const { data, error } = await supabase.functions.invoke('fortune-interpret-v6-preview', {
          body: { action: 'status', job_id: jobId },
        })
        if (error) throw error
        if (data?.status === 'done') {
          const payload: AiInterpretationResponse = {
            ok: true,
            model: data.model,
            fallback_from: data.fallback_from,
            interpreter_version: data.interpreter_version || 'supabase-ai-v7-thai-lagna-output-guard',
            usage: data.usage ?? undefined,
            data: data.data ?? undefined,
          }
          if (!payload.data) throw new Error('완료된 AI 해설 결과가 비어 있어.')
          const annotated = annotatePayload(payload)
          if (cacheId) await writeReadingCache(cacheId, 'fortune-ai', annotated, ttlDays)
          const currentStart = integratedStartDate
          const currentEnd = integratedSelectionEnd
          if (!periodStart || (currentStart === periodStart && currentEnd === periodEndValue)) {
            setAiInterpretation(annotated)
            setAiCacheSource(data?.reused ? 'server' : 'fresh')
          }
          if (requestForArchive && selectedTool === null && periodStart && periodEndValue) {
            const calc = integratedResult
            if (calc && calc.period.start === periodStart && calc.period.end === periodEndValue) {
              const archiveRequest = {...requestForArchive, archive_mode:'period_fortune_v16'}
              void saveArchive({kind:'daily',periodKey:period,title:`${period==='today'?'오늘':period==='week'?'주간':period==='month'?'월간':'연간'}운세 · ${periodStart}`,periodStart,periodEnd:periodEndValue,engine:calc.engine,request:archiveRequest,result:calc as unknown as Record<string,unknown>,interpretation:annotated as unknown as Record<string,unknown>},`period:${fortuneCalculationCacheId(requestForArchive)}`)
            }
          }
          window.localStorage.removeItem(AI_JOB_STORAGE_KEY)
          setAiConfigured(true)
          aiRequestRef.current = cacheId || ''
          return
        }
        if (data?.status === 'failed') {
          window.localStorage.removeItem(AI_JOB_STORAGE_KEY)
          throw new Error(data?.error || 'AI 해설 서버 작업이 실패했어.')
        }
        await new Promise((resolve) => window.setTimeout(resolve, 2500))
      }
      setAiError('AI 해석은 서버에서 계속 진행 중이야. 앱을 다시 열면 자동으로 완료 여부를 확인해.')
    } catch (error) {
      if (document.visibilityState === 'hidden') return
      const message = error instanceof Error ? error.message : 'AI 해설 상태 확인에 실패했어.'
      setAiError(message.includes('non-2xx') ? 'AI 해설 상태 확인이 잠시 끊겼어. 앱을 다시 열면 이어서 확인해.' : message)
    } finally {
      aiPollRef.current = null
      setAiLoading(Boolean(window.localStorage.getItem(AI_JOB_STORAGE_KEY)))
    }
  }

  const resumeAiInterpretationJob = () => {
    if (document.visibilityState === 'hidden') return
    const raw = window.localStorage.getItem(AI_JOB_STORAGE_KEY)
    if (!raw) return
    try {
      const saved = JSON.parse(raw) as { jobId?: string; periodStart?: string; periodEnd?: string; cacheId?: string; ttlDays?: number; request?: Record<string,unknown> }
      if (saved.jobId) void pollAiInterpretationJob(saved.jobId, saved.periodStart, saved.periodEnd, saved.cacheId, saved.ttlDays ?? PERIOD_CACHE_TTL_DAYS.today, saved.request)
    } catch {
      window.localStorage.removeItem(AI_JOB_STORAGE_KEY)
      setAiLoading(false)
    }
  }

  const runAiInterpretation = async (calculation: IntegratedApiResponse | null = integratedResult, requestOverride: Record<string,unknown> | null = integratedRequestSnapshot) => {
    if (!calculation) return
    const requestForCache = requestOverride ?? { start_date: calculation.period.start, end_date: calculation.period.end }
    const cacheId = fortuneAiCacheId(requestForCache, calculation as unknown as Record<string,unknown>, aiModel)
    const ttlDays = fortuneCacheTtlDays(period, selectedTool)
    if (aiRequestRef.current === cacheId && (aiLoading || aiInterpretation?.ok)) return
    aiRequestRef.current = cacheId
    setAiLoading(true); setAiError('')
    try {
      const cached = await readReadingCache<AiInterpretationResponse>(cacheId)
      if (cached?.ok && cached.data) {
        const annotated = annotatePayload(cached)
        setAiInterpretation(annotated)
        setAiCacheSource('local')
        setAiLoading(false)
        if (selectedTool === null) {
          const archiveRequest = {...requestForCache, archive_mode:'period_fortune_v16'}
          void saveArchive({kind:'daily',periodKey:period,title:`${period==='today'?'오늘':period==='week'?'주간':period==='month'?'월간':'연간'}운세 · ${calculation.period.start}`,periodStart:calculation.period.start,periodEnd:calculation.period.end,engine:calculation.engine,request:archiveRequest,result:calculation as unknown as Record<string,unknown>,interpretation:annotated as unknown as Record<string,unknown>},`period:${fortuneCalculationCacheId(requestForCache)}`)
        }
        return
      }
      setAiInterpretation(null)
      setAiCacheSource('')
      await ensureSupabaseSession()
      const { data, error } = await supabase.functions.invoke('fortune-interpret-v6-preview', {
        body: { action: 'start', calculation, model: aiModel },
      })
      if (error) throw error
      if (!data?.ok || !data?.job_id) {
        if (data?.missing_key) setAiConfigured(false)
        throw new Error(data?.error || 'AI 해설 서버 작업을 시작하지 못했어.')
      }
      const pending = { jobId: String(data.job_id), periodStart: calculation.period.start, periodEnd: calculation.period.end, cacheId, ttlDays, request: requestForCache }
      window.localStorage.setItem(AI_JOB_STORAGE_KEY, JSON.stringify(pending))
      setAiConfigured(true)
      void pollAiInterpretationJob(pending.jobId, pending.periodStart, pending.periodEnd, pending.cacheId, pending.ttlDays, pending.request)
    } catch (error) {
      window.localStorage.removeItem(AI_JOB_STORAGE_KEY)
      setAiLoading(false)
      aiRequestRef.current = ''
      const message = error instanceof Error ? error.message : 'AI 해설 요청에 실패했어.'
      setAiError(message.includes('non-2xx') ? 'Supabase AI 해설 서버에서 오류가 발생했어. 설정의 Gemini 연결 상태를 확인해줘.' : message)
    }
  }


  useEffect(() => {
    if (mainView !== 'home' || integratedLoading || !birthProfile.birthDate || !birthProfile.birthTime) return
    if (!(selectedTool === null || selectedTool === 'integrated' || selectedTool === 'precision')) return
    const latitude = parseOptionalNumber(birthProfile.latitude)
    const longitude = parseOptionalNumber(birthProfile.longitude)
    if (latitude === null || longitude === null) return
    const body: Record<string,unknown> = {
      profile: { name: birthProfile.name || '나', birth_date: birthProfile.birthDate, birth_time: birthProfile.birthTime, latitude, longitude, utc_offset_hours: Number(birthProfile.utcOffset || 9), gender: birthProfile.gender, place_key: birthProfile.placeKey },
      start_date: integratedStartDate,
      end_date: integratedSelectionEnd,
    }
    const cacheId = fortuneCalculationCacheId(body)
    let cancelled = false
    void (async()=>{
      const cached = await readReadingCache<{request:Record<string,unknown>;result:IntegratedApiResponse}>(cacheId)
      if (cancelled || !cached?.result) return
      if (cached.result.period.start !== integratedStartDate || cached.result.period.end !== integratedSelectionEnd) return
      setIntegratedResult(cached.result)
      setIntegratedRequestSnapshot(cached.request)
      setIntegratedError('')
      setIntegratedProgress(null)
      if (selectedTool === null) void runAiInterpretation(cached.result, cached.request)
    })()
    return ()=>{cancelled=true}
  }, [mainView, selectedTool, period, queryDate, annualFortuneYear, birthProfile.birthDate, birthProfile.birthTime, birthProfile.latitude, birthProfile.longitude, birthProfile.utcOffset, birthProfile.gender, birthProfile.placeKey, aiModel])

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
      start_date: integratedStartDate,
      end_date: integratedSelectionEnd,
    }
    const calculationCacheId = fortuneCalculationCacheId(body as unknown as Record<string,unknown>)
    const cachedCalculation = await readReadingCache<{request:Record<string,unknown>;result:IntegratedApiResponse}>(calculationCacheId)
    if (cachedCalculation?.result && cachedCalculation.result.period.start === integratedStartDate && cachedCalculation.result.period.end === integratedSelectionEnd) {
      setIntegratedResult(cachedCalculation.result)
      setIntegratedRequestSnapshot(cachedCalculation.request)
      if (selectedTool === null) void runAiInterpretation(cachedCalculation.result, cachedCalculation.request)
      return
    }
    const sleep = (ms: number) => new Promise((resolve)=>window.setTimeout(resolve, ms))
    setIntegratedProgress(null)
    setIntegratedLoading(true)
    try {
      let calculation: IntegratedApiResponse | null = null
      let lastMessage = ''
      for (let launch=0; launch<2 && !calculation; launch++) {
        let startResponse: Response
        try {
          startResponse = await fetch(`${API_BASE}/v1/fortune/integrated/start`, {
            method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body),
          })
        } catch (error) {
          lastMessage = error instanceof Error ? error.message : '통합운세 계산 서버 연결에 실패했어.'
          if (launch === 0) { await sleep(1200); continue }
          throw error
        }
        const started = await startResponse.json().catch(()=>({}))
        if (!startResponse.ok || !started?.job_id) {
          lastMessage = started?.detail || started?.error || '통합운세 계산 작업을 시작하지 못했어.'
          if (launch === 0 && startResponse.status >= 500) { await sleep(1200); continue }
          throw new Error(lastMessage)
        }
        let lostJob = false
        let transientFailures = 0
        for (let attempt=0; attempt<120; attempt++) {
          await sleep(attempt < 12 ? 1000 : 2000)
          let pollResponse: Response
          try {
            pollResponse = await fetch(`${API_BASE}/v1/fortune/integrated/jobs/${encodeURIComponent(started.job_id)}`)
          } catch (error) {
            transientFailures += 1
            lastMessage = error instanceof Error ? error.message : '통합운세 계산 상태 확인 중 연결이 끊겼어.'
            if (transientFailures <= 4) continue
            throw error
          }
          const job = await pollResponse.json().catch(()=>({}))
          if (pollResponse.status === 404) {
            lostJob = true
            lastMessage = job?.detail || '계산 작업이 서버 재시작으로 사라졌어.'
            break
          }
          if (!pollResponse.ok) {
            if ([502,503,504].includes(pollResponse.status) && transientFailures < 4) {
              transientFailures += 1
              continue
            }
            throw new Error(job?.detail || '통합운세 계산 상태를 확인하지 못했어.')
          }
          transientFailures = 0
          if (job?.progress && Number.isFinite(Number(job.progress.percent))) setIntegratedProgress({completed:Number(job.progress.completed??0),total:Number(job.progress.total??0),percent:Number(job.progress.percent??0)})
          if (job.status === 'failed') throw new Error(job.error || '통합운세 계산 작업이 실패했어.')
          if (job.status === 'done') { calculation = job.result as IntegratedApiResponse; break }
        }
        if (!calculation && lostJob && launch === 0) { await sleep(900); continue }
      }
      if (!calculation) throw new Error(lastMessage || '정밀 계산 시간이 길어지고 있어. 다시 시도해줘.')
      setIntegratedResult(calculation)
      setIntegratedRequestSnapshot(body)
      const calcTtlDays = fortuneCacheTtlDays(period, selectedTool)
      await writeReadingCache(calculationCacheId, 'fortune-calculation', {request:body as unknown as Record<string,unknown>, result:calculation}, calcTtlDays)
      if (selectedTool === null) {
        const archiveRequest = {...body, archive_mode:'period_fortune_v16'} as unknown as Record<string,unknown>
        void saveArchive({kind:'daily',periodKey:period,title:`${period==='today'?'오늘':period==='week'?'주간':period==='month'?'월간':'연간'}운세 · ${calculation.period.start}`,periodStart:calculation.period.start,periodEnd:calculation.period.end,engine:calculation.engine,request:archiveRequest,result:calculation as unknown as Record<string,unknown>},`period:${calculationCacheId}`)
        void runAiInterpretation(calculation, body as unknown as Record<string,unknown>)
      }
      // Period fortunes auto-interpret once and cache. Integrated/precision keep explicit AI controls.
    } catch (error) {
      setIntegratedError(error instanceof Error ? error.message : '통합운세 계산 중 오류가 발생했어.')
    } finally { setIntegratedLoading(false); setIntegratedProgress(null) }
  }

  const runReunionTiming = async (): Promise<ReunionTimingContext | null> => {
    const revision = relationshipRevisionRef.current
    setReunionTimingLoading(true); setReunionTimingError('')
    try {
      const end = relationshipEndDate
      if (integratedResult && integratedResult.period.start === relationshipStartDate && integratedResult.period.end === end) {
        const cached = buildReunionTimingContext(integratedResult)
        if (revision !== relationshipRevisionRef.current) return null
        setReunionTiming(cached)
        return cached
      }
      const body = {
        profile: {
          name: birthProfile.name || '나',
          birth_date: birthProfile.birthDate,
          birth_time: birthProfile.birthTime,
          latitude: Number(birthProfile.latitude),
          longitude: Number(birthProfile.longitude),
          utc_offset_hours: Number(birthProfile.utcOffset || 9),
          gender: birthProfile.gender,
          place_key: birthProfile.placeKey,
        },
        start_date: relationshipStartDate,
        end_date: end,
      }

      const sleep = (ms: number) => new Promise((resolve)=>window.setTimeout(resolve, ms))
      let calculation: IntegratedApiResponse | null = null
      let lastMessage = ''

      for (let launch=0; launch<2 && !calculation; launch++) {
        let startResponse: Response
        try {
          startResponse = await fetch(`${API_BASE}/v1/fortune/integrated/start`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })
        } catch (error) {
          lastMessage = error instanceof Error ? error.message : '재회 시기 계산 서버 연결에 실패했어.'
          if (launch === 0) { await sleep(1200); continue }
          throw error
        }
        const started = await startResponse.json().catch(()=>({}))
        if (!startResponse.ok || !started?.job_id) {
          lastMessage = started?.detail || started?.error || '재회 시기 계산을 시작하지 못했어.'
          if (launch === 0 && startResponse.status >= 500) { await sleep(1200); continue }
          throw new Error(lastMessage)
        }

        let lostJob = false
        let transientFailures = 0
        for (let attempt=0; attempt<120; attempt++) {
          await sleep(attempt < 12 ? 1000 : 2000)
          let pollResponse: Response
          try {
            pollResponse = await fetch(`${API_BASE}/v1/fortune/integrated/jobs/${encodeURIComponent(started.job_id)}`)
          } catch (error) {
            transientFailures += 1
            lastMessage = error instanceof Error ? error.message : '재회 시기 계산 상태 확인 중 연결이 끊겼어.'
            if (transientFailures <= 4) continue
            throw error
          }
          const job = await pollResponse.json().catch(()=>({}))
          if (pollResponse.status === 404) {
            lostJob = true
            lastMessage = job?.detail || '계산 작업이 서버 재시작으로 사라졌어.'
            break
          }
          if (!pollResponse.ok) {
            if ([502,503,504].includes(pollResponse.status) && transientFailures < 4) {
              transientFailures += 1
              continue
            }
            throw new Error(job?.detail || '재회 시기 계산 상태를 확인하지 못했어.')
          }
          transientFailures = 0
          if (job.status === 'failed') throw new Error(job.error || '재회 시기 계산이 실패했어.')
          if (job.status === 'done') { calculation = job.result as IntegratedApiResponse; break }
        }
        if (!calculation && lostJob && launch === 0) {
          await sleep(900)
          continue
        }
      }

      if (!calculation) throw new Error(lastMessage || '재회 시기 계산 시간이 길어지고 있어. 다시 시도해줘.')
      const context = buildReunionTimingContext(calculation)
      if (revision !== relationshipRevisionRef.current) return null
      setReunionTiming(context)
      return context
    } catch (error) {
      if (revision !== relationshipRevisionRef.current) return null
      const message = error instanceof Error ? error.message : '재회 시기 계산 중 오류가 발생했어.'
      setReunionTimingError(message)
      return null
    } finally {
      if (revision === relationshipRevisionRef.current) setReunionTimingLoading(false)
    }
  }

  const runRelationship = async () => {
    const revision = relationshipRevisionRef.current + 1
    relationshipRevisionRef.current = revision
    setRelationshipError(''); setRelationshipResult(null); setRelationshipRequestSnapshot(null); setRelationshipAi(null); setRelationshipAiError(''); setReunionTiming(null); setReunionTimingError('')
    if (!birthProfile.birthDate || !birthProfile.birthTime) { setRelationshipError('먼저 내정보에서 본인 생년월일과 출생시간을 저장해줘.'); return }
    const userLatitude = parseOptionalNumber(birthProfile.latitude)
    const userLongitude = parseOptionalNumber(birthProfile.longitude)
    if (userLatitude === null || userLongitude === null) { setRelationshipError('먼저 내정보에서 본인 출생지역까지 저장해줘. 정밀 관계 계산에는 위치 좌표가 필요해.'); return }
    if (!counterpart.birthDate) { setRelationshipError('상대 생년월일은 반드시 필요해.'); return }
    if (counterpart.timeKnown && !counterpart.birthTime) { setRelationshipError('상대 출생시간을 모르면 “출생시간 모름”을 체크해줘.'); return }
    const counterpartLatitude = parseOptionalNumber(counterpart.latitude)
    const counterpartLongitude = parseOptionalNumber(counterpart.longitude)
    if (counterpart.timeKnown && (counterpartLatitude === null || counterpartLongitude === null)) { setRelationshipError('상대 출생시간을 안다면 출생지역도 선택해줘. 모르면 “출생시간 모름”을 체크해줘.'); return }
    const body = {
      user: {
        name: birthProfile.name || '나', birth_date: birthProfile.birthDate, birth_time: birthProfile.birthTime, time_known: true,
        latitude: userLatitude, longitude: userLongitude, utc_offset_hours: Number(birthProfile.utcOffset || 9),
      },
      counterpart: {
        name: counterpart.name || '상대', birth_date: counterpart.birthDate, birth_time: counterpart.timeKnown ? counterpart.birthTime : null,
        time_known: counterpart.timeKnown, latitude: counterpartLatitude,
        longitude: counterpartLongitude, utc_offset_hours: Number(counterpart.utcOffset || 9),
      },
      start_date: relationshipStartDate,
      end_date: relationshipEndDate,
      relationship_status: selectedTool === 'marriage' ? (marriageMode === 'married' ? 'married' : 'dating') : (relationshipPurpose === 'reunion' ? 'single' : relationshipMode),
      analysis_mode: selectedTool === 'marriage' ? `marriage_${marriageMode}` : relationshipPurpose,
    }
    setRelationshipLoading(true)
    const shouldRunReunionTiming = selectedTool === 'compatibility' && relationshipPurpose === 'reunion'
    try {
      const response = await fetch(`${API_BASE}/v1/relationship/western`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })
      const payload = await response.json()
      if (!response.ok) throw new Error(typeof payload?.detail === 'string' ? payload.detail : '관계 계산 요청에 실패했어.')
      const typed = payload as RelationshipApiResponse
      if (revision !== relationshipRevisionRef.current) return
      setRelationshipResult(typed)
      setRelationshipRequestSnapshot(body as Record<string, unknown>)
      if (shouldRunReunionTiming) {
        const direct = typed.result.reunion_transits?.directional_context
        if (direct) {
          setReunionTiming(direct)
          setReunionTimingError('')
          setReunionTimingLoading(false)
        } else {
          // Backward-compatible only: old backend can still use the previous integrated timing route.
          void runReunionTiming()
        }
      }
    } catch (error) {
      if (revision === relationshipRevisionRef.current) setRelationshipError(error instanceof Error ? error.message : '관계 계산 중 오류가 발생했어.')
    } finally {
      if (revision === relationshipRevisionRef.current) setRelationshipLoading(false)
    }
  }


  const runRelationshipAi = async () => {
    if (!relationshipResult) return
    const revision = relationshipRevisionRef.current
    const currentMode: RelationshipAnalysisMode = selectedTool === 'marriage' ? `marriage_${marriageMode}` : relationshipPurpose
    const snapshotMode = String(relationshipRequestSnapshot?.analysis_mode ?? '')
    const analysisMode = (snapshotMode || currentMode) as RelationshipAnalysisMode
    if (analysisMode === 'reunion' && !reunionTiming) { setRelationshipAiError('재회 시기 계산이 먼저 완료되어야 해.'); return }
    const relationshipCacheId = relationshipAiCacheId(relationshipResult as unknown as Record<string,unknown>, analysisMode, aiModel, reunionTiming)
    setRelationshipAiLoading(true); setRelationshipAiError('')
    try {
      const cached = await readReadingCache<RelationshipAiResponse>(relationshipCacheId)
      if (cached?.ok && cached.data) {
        if (revision !== relationshipRevisionRef.current) return
        setRelationshipAi(annotatePayload(cached))
        setRelationshipAiCacheSource('local')
        return
      }
      await ensureSupabaseSession()
      const { data, error } = await supabase.functions.invoke('relationship-interpret-v9-preview', { body: { calculation: relationshipResult, reunion_context: reunionTiming, purpose: analysisMode, model: aiModel } })
      if (error) {
        let detail = ''
        const context = (error as { context?: Response }).context
        if (context) {
          try {
            const body = await context.clone().json() as { error?: string }
            detail = body?.error ?? ''
          } catch { /* fall back to SDK message */ }
        }
        throw new Error(detail || error.message)
      }
      const payload = data as RelationshipAiResponse
      if (!payload?.ok || !payload.data) throw new Error(payload?.error || '관계 AI 해설 응답이 비어 있어.')
      if (revision !== relationshipRevisionRef.current) return
      const annotated = annotatePayload(payload)
      await writeReadingCache(relationshipCacheId, 'relationship-ai', annotated, RELATIONSHIP_AI_CACHE_TTL_DAYS)
      setRelationshipAi(annotated)
      setRelationshipAiCacheSource('fresh')
    } catch (error) {
      if (revision === relationshipRevisionRef.current) setRelationshipAiError(error instanceof Error ? error.message : '관계 AI 해설을 불러오지 못했어.')
    } finally {
      if (revision === relationshipRevisionRef.current) setRelationshipAiLoading(false)
    }
  }


  async function runLocationFit() {
    if (!birthProfile.birthDate || !birthProfile.birthTime) { setLocationError('먼저 내정보에서 생년월일과 출생시간을 저장해줘.'); return }
    if (parseOptionalNumber(birthProfile.latitude) === null || parseOptionalNumber(birthProfile.longitude) === null) { setLocationError('내정보에서 출생지역을 먼저 선택해줘.'); return }
    setLocationLoading(true); setLocationError(''); setLocationResult(null)
    try {
      const response = await fetch(`${API_BASE}/v1/location/fit`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({profile:{name:birthProfile.name||null,birth_date:birthProfile.birthDate,birth_time:birthProfile.birthTime,latitude:Number(birthProfile.latitude||0),longitude:Number(birthProfile.longitude||0),utc_offset_hours:Number(birthProfile.utcOffset||9),gender:birthProfile.gender}}),
      })
      const payload = await response.json()
      if (!response.ok || !payload?.ok) throw new Error(payload?.detail || payload?.error || '지역·국가운 계산에 실패했어.')
      setLocationResult(payload as LocationFitResponse)
    } catch (error) { setLocationError(error instanceof Error ? error.message : '지역·국가운 계산 중 오류가 발생했어.') }
    finally { setLocationLoading(false) }
  }

  async function handleCopy(label: string, text: string) {
    const ok = await copyToClipboard(text)
    setActionNotice(ok ? `${label} 완료` : '복사 권한을 사용할 수 없어. 브라우저에서 다시 시도해줘.')
    window.setTimeout(() => setActionNotice(''), 2200)
  }

  async function saveIntegratedRecord() {
    if (!integratedResult || !integratedRequestSnapshot || archiveSaving) return
    setArchiveSaving(true); setArchiveStatus('기록 저장 중…')
    const integratedArchivePeriod: PeriodKey = 'year'
    const integratedArchiveYear = Number(integratedResult.period.start.slice(0,4)) || annualFortuneYear
    const label = `${integratedArchiveYear}년`
    try {
    const saved = await saveArchive({
      kind: 'integrated',
      periodKey: integratedArchivePeriod,
      title: `${label} 통합운세 · ${integratedResult.period.start}`,
      periodStart: integratedResult.period.start,
      periodEnd: integratedResult.period.end,
      engine: integratedResult.engine,
      request: integratedRequestSnapshot,
      result: integratedResult as unknown as Record<string, unknown>,
      interpretation: aiInterpretation as unknown as Record<string,unknown> | undefined,
    })
    setArchiveStatus(saved.cloudSynced ? '기록 저장 + Supabase 동기화 완료' : `이 기기에 기록 저장 완료 · 클라우드 동기화 대기${saved.cloudError ? ` (${saved.cloudError})` : ''}`)
    setActionNotice('기록 저장 완료'); window.setTimeout(()=>setActionNotice(''),2200)
    if (mainView === 'history') await refreshArchive()
    } catch (error) { setArchiveStatus(error instanceof Error ? error.message : '기록 저장 실패') } finally { setArchiveSaving(false) }
  }

  async function savePrecisionRecord() {
    if (!integratedResult || !integratedRequestSnapshot || archiveSaving) return
    setArchiveSaving(true); setArchiveStatus('정밀분석 기록 저장 중…')
    const precisionArchivePeriod: PeriodKey = integratedCalendarYear ? 'year' : period
    try {
    const saved = await saveArchive({
      kind: 'precision',
      periodKey: precisionArchivePeriod,
      title: `${integratedCalendarYear ? `${integratedCalendarYear}년 · ` : ''}정밀분석 · ${integratedResult.period.start}`,
      periodStart: integratedResult.period.start,
      periodEnd: integratedResult.period.end,
      engine: integratedResult.engine,
      request: integratedRequestSnapshot,
      result: integratedResult as unknown as Record<string, unknown>,
    })
    setArchiveStatus(saved.cloudSynced ? '정밀분석 기록 저장 + Supabase 동기화 완료' : `이 기기에 정밀분석 기록 저장 완료 · 클라우드 동기화 대기${saved.cloudError ? ` (${saved.cloudError})` : ''}`)
    setActionNotice('정밀분석 기록 저장 완료'); window.setTimeout(()=>setActionNotice(''),2200)
    } catch (error) { setArchiveStatus(error instanceof Error ? error.message : '정밀분석 기록 저장 실패') } finally { setArchiveSaving(false) }
  }

  async function saveRelationshipRecord() {
    if (!relationshipResult || !relationshipRequestSnapshot || archiveSaving) return
    setArchiveSaving(true); setArchiveStatus('관계 분석 기록 저장 중…')
    const kind = selectedTool === 'marriage' ? 'marriage' : 'compatibility'
    const isReunion = selectedTool === 'compatibility' && relationshipPurpose === 'reunion'
    const cp = (relationshipRequestSnapshot.counterpart ?? {}) as Record<string, unknown>
    const archiveRequest = isReunion ? { ...relationshipRequestSnapshot, reunion_context: reunionTiming } : relationshipRequestSnapshot
    const archiveLabel = kind === 'marriage' ? '결혼운' : isReunion ? '재회운' : '궁합운'
    try {
    const saved = await saveArchive({
      kind,
      periodKey: relationshipPeriodKey,
      title: `${archiveLabel} · ${String(cp.name ?? '상대')} · ${relationshipResult.period.start}`,
      periodStart: relationshipResult.period.start,
      periodEnd: relationshipResult.period.end,
      engine: relationshipResult.engine,
      request: archiveRequest,
      result: relationshipResult as unknown as Record<string, unknown>,
      interpretation: relationshipAi as unknown as Record<string,unknown> | undefined,
    })
    setArchiveStatus(saved.cloudSynced ? '기록 저장 + Supabase 동기화 완료' : `이 기기에 기록 저장 완료 · 클라우드 동기화 대기${saved.cloudError ? ` (${saved.cloudError})` : ''}`)
    setActionNotice('관계 분석 기록 저장 완료'); window.setTimeout(()=>setActionNotice(''),2200)
    } catch (error) { setArchiveStatus(error instanceof Error ? error.message : '관계 분석 기록 저장 실패') } finally { setArchiveSaving(false) }
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
    const currentPeriodArchive = item.kind === 'daily' && item.request.archive_mode === 'period_fortune_v16'
    if ((item.kind === 'daily' && !currentPeriodArchive) || item.kind === 'outcome') {
      setLegacyArchiveOpen(item)
      setMainView('history')
      return
    }
    if (currentPeriodArchive) {
      setLegacyArchiveOpen(null)
      setQueryDate(item.periodStart)
      setPeriod(item.periodKey)
      setIntegratedCalendarYear(null)
      setSelectedTool(null)
      setIntegratedResult(item.result as unknown as IntegratedApiResponse)
      setIntegratedRequestSnapshot(item.request)
      setAiInterpretation(item.interpretation as unknown as AiInterpretationResponse || null)
      setAiCacheSource(item.interpretation ? 'local' : '')
      setMainView('home')
      return
    }
    setLegacyArchiveOpen(null)
    setQueryDate(item.periodStart)
    setPeriod(item.periodKey)
    const archiveYear = Number(item.periodStart.slice(0,4))
    const isFullCalendarYear = Number.isFinite(archiveYear) && item.periodStart === `${archiveYear}-01-01` && item.periodEnd === `${archiveYear}-12-31`
    if (item.kind === 'integrated' || item.kind === 'precision') {
      setIntegratedCalendarYear(isFullCalendarYear ? archiveYear : null)
      setRelationshipCalendarYear(null)
      setIntegratedResult(item.result as unknown as IntegratedApiResponse)
      setIntegratedRequestSnapshot(item.request)
      setAiInterpretation(item.interpretation as unknown as AiInterpretationResponse || null)
      setAiCacheSource(item.interpretation ? 'local' : '')
      setSelectedTool(item.kind)
    } else {
      restoringRelationshipRef.current = true
      relationshipRevisionRef.current += 1
      setRelationshipAi(item.interpretation as unknown as RelationshipAiResponse || null)
      setRelationshipAiCacheSource(item.interpretation ? 'local' : '')
      setRelationshipAiError('')
      setRelationshipLoading(false)
      setRelationshipAiLoading(false)
      setReunionTimingLoading(false)
      setReunionTimingError('')
      const request = item.request
      const cp = (request.counterpart ?? {}) as Record<string, unknown>
      const known = cp.time_known !== false
      setIntegratedCalendarYear(null)
      setRelationshipCalendarYear(isFullCalendarYear ? archiveYear : null)
      setRelationshipResult(item.result as unknown as RelationshipApiResponse)
      setRelationshipRequestSnapshot(request)
      const restoredDays = Math.max(7, Math.min(365, Math.round((new Date(`${item.periodEnd}T12:00:00Z`).getTime()-new Date(`${item.periodStart}T12:00:00Z`).getTime())/86400000)+1))
      setRelationshipDays(restoredDays)
      setRelationshipMode((request.relationship_status as RelationshipStatus) || 'dating')
      const restoredAnalysisMode = String(request.analysis_mode ?? 'compatibility')
      if (restoredAnalysisMode === 'reunion') {
        setRelationshipPurpose('reunion')
        const archivedContext = request.reunion_context
        setReunionTiming(archivedContext && typeof archivedContext === 'object' ? archivedContext as ReunionTimingContext : null)
      } else {
        setRelationshipPurpose('compatibility')
        setReunionTiming(null)
      }
      if (request.analysis_mode === 'marriage_married') setMarriageMode('married')
      else if (request.analysis_mode === 'marriage_unmarried') setMarriageMode('unmarried')
      setCounterpart({
        ...emptyCounterpart,
        name: String(cp.name ?? ''),
        birthDate: String(cp.birth_date ?? ''),
        birthTime: known ? String(cp.birth_time ?? '').slice(0, 5) : '',
        latitude: cp.latitude != null ? String(cp.latitude) : '',
        longitude: cp.longitude != null ? String(cp.longitude) : '',
        utcOffset: String(cp.utc_offset_hours ?? 9),
        timeKnown: known,
      })
      setSelectedTool(item.kind === 'marriage' ? 'marriage' : 'compatibility')
    }
    setMainView('home')
  }

  async function copyArchiveResult(item: ArchiveItem) {
    if (item.kind === 'daily' && item.request.archive_mode === 'period_fortune_v16') {
      await handleCopy('기간운세 전체복사', integratedResultText(item.result as unknown as IntegratedApiResponse))
      return
    }
    if (item.kind === 'daily' || item.kind === 'outcome') {
      await handleCopy('이전 기록 전체복사', JSON.stringify(item.result, null, 2))
      return
    }
    if (item.kind === 'integrated' || item.kind === 'precision') {
      const result = item.result as unknown as IntegratedApiResponse
      await handleCopy('저장 결과 전체복사', item.kind === 'precision' ? precisionResultText(result) : integratedResultText(result))
    } else {
      const analysisMode = String(item.request.analysis_mode ?? '')
      const copyKind: 'compatibility' | 'reunion' | 'marriage' = item.kind === 'marriage' ? 'marriage' : analysisMode === 'reunion' ? 'reunion' : 'compatibility'
      const archivedContext = item.request.reunion_context
      await handleCopy('저장 결과 전체복사', relationshipResultText(copyKind, item.result as unknown as RelationshipApiResponse, archivedContext && typeof archivedContext === 'object' ? archivedContext as ReunionTimingContext : null))
    }
  }


  const outcomeCalibration = useMemo(() => {
    void outcomeNonce
    return summarizeDailyOutcomes(readDailyOutcomes())
  }, [outcomeNonce])

  async function saveDailyOutcome() {
    if (!integratedResult || period !== 'today' || !outcomeDraft.event) {
      setActionNotice('실제 연락 결과를 먼저 선택해줘.')
      window.setTimeout(()=>setActionNotice(''),1800)
      return
    }
    const signals = integratedResult.western.relationship_signals ?? {}
    const overall = integratedResult.western.overall ?? {}
    const record: DailyOutcomeRecord = {
      ...outcomeDraft,
      date: queryDate,
      note: outcomeDraft.note.trim().slice(0,200),
      saved_at: new Date().toISOString(),
      scores: {
        '수신신호': signals['수신신호']?.average ?? null,
        '발신적합': signals['발신적합']?.average ?? null,
        '재접점': signals['과거인연재접점']?.average ?? null,
        '연락': overall['연락']?.average ?? null,
        '재회': overall['재회']?.average ?? null,
        '연애': overall['연애']?.average ?? null,
        '소식': overall['소식']?.average ?? null,
      },
    }
    writeDailyOutcome(record)
    setOutcomeDraft(record)
    setOutcomeSaved(true)
    setOutcomeNonce((value)=>value+1)
    void saveArchive({kind:'outcome',periodKey:'today',title:`실제 결과 · ${queryDate}`,periodStart:queryDate,periodEnd:queryDate,engine:'relationship-outcome-v2',request:{date:queryDate,archive_mode:'personal_outcome_v16'},result:record as unknown as Record<string,unknown>},`outcome:${queryDate}`)
    window.setTimeout(()=>setOutcomeSaved(false),2200)
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
          <section className="section-block period-fortune-section">
            <div className="section-label">기간 운세</div>
            <div className="period-grid" role="tablist" aria-label="기간 운세">
              {periods.map(({key,label,icon:Icon})=><button key={key} className={`period-button ${selectedTool===null&&period===key?'is-active':''}`} type="button" onClick={()=>{setPeriod(key);setSelectedTool(null);setIntegratedCalendarYear(null);setIntegratedError('');setIntegratedProgress(null)}}><Icon size={17}/><span>{label}</span></button>)}
            </div>
          </section>
          {selectedTool==='precision' && <section className="section-block precision-period-range"><div className="section-label">정밀분석 기간 선택</div><div className="period-grid">{periods.map(({key,label,icon:Icon})=><button key={key} className={`period-button ${period===key?'is-active':''}`} type="button" onClick={()=>{setPeriod(key);setIntegratedCalendarYear(null);setIntegratedError('');setIntegratedProgress(null)}}><Icon size={17}/><span>{label}</span></button>)}</div></section>}
          <section className="section-block tools-section"><div className="section-heading-row"><div className="section-label">분석 도구</div><span className={`server-pill ${apiStatus}`}>{apiLabel}</span></div><div className="tool-grid">{tools.map(({key,label,desc,icon:Icon,tone})=><button key={key} className={`tool-card ${selectedTool===key?'is-selected':''}`} type="button" onClick={()=>{setSelectedTool(key); if(key==='compatibility'||key==='marriage'){setRelationshipDays(365);setRelationshipCalendarYear(null);} if(key==='location'){setLocationError('');setLocationResult(null)}}}><span className={`tool-icon tone-${tone}`}><Icon size={24}/></span><strong>{label}</strong><span>{desc}</span></button>)}</div></section>

          {selectedTool === 'integrated' && <section className="tool-panel integrated-panel">
            <div className="tool-panel-heading"><span className="tool-icon tone-gold"><Sparkles size={22}/></span><div><span className="eyebrow">연간 통합 흐름</span><h2>통합운세</h2><p>한 해의 연애·재회·연락·금전·학업·시험·직장·컨디션을 Western(서양점성술)·사주·Thai(태국점성술)로 각각 계산한 뒤, 같은 연도에서 겹치는 흐름과 차이를 종합해서 비교해.</p></div></div>
            <section className="annual-fortune-range"><div className="section-heading-row"><div className="section-label">연간 통합운세</div><span className="annual-range-badge">1월 1일 → 12월 31일</span></div><div className="calendar-year-selector annual-year-selector"><div><strong>{annualFortuneYear}년 전체 흐름</strong><span>여러 분야 × 서양점성술 · 사주 · 태국점성술 종합</span></div><select aria-label="연간 통합운세 연도 선택" value={annualFortuneYear} onChange={(e)=>setIntegratedCalendarYear(Number(e.target.value))}>{calendarYearOptions.map((year)=><option key={year} value={year}>{year}년</option>)}</select></div></section>
            <div className="calculation-range annual-calculation-range"><CalendarDays size={17}/><span>연간 분석 {integratedStartDate} ~ {integratedSelectionEnd} · {annualFortuneYear}년 전체</span></div>
            <div className="coordinate-note"><MapPin size={16}/><span>사주는 출생지 경도로 진태양시를 보정하고, 서양점성술은 출생지 좌표로 상승점·하우스를 계산해. Thai(태국점성술)는 출생요일·Mahathaksa(마하탁사)·Taksajorn(탁사쫀), 교차검증된 Suriyayat(수리야얏) 10행성 위치와 숫자 Lagna(라그나)를 계산해. 검증된 12개 하우스 연결은 맥락 설명에만 쓰고 사건·시기·확률·점수는 예측하지 않아.</span></div>
            {integratedError && <div className="status-banner error"><AlertTriangle size={17}/><span>{integratedError}</span></div>}
            <button className="primary-button" type="button" onClick={runIntegrated} disabled={integratedLoading||apiStatus==='offline'}>{integratedLoading?<LoaderCircle className="spin" size={18}/>:<Sparkles size={18}/>}<span>{integratedLoading?(integratedProgress?`연간 통합 계산 중 · ${integratedProgress.completed}/${integratedProgress.total}일 (${integratedProgress.percent}%)`:'연간 통합 계산 준비 중…'):'연간 통합운세 계산'}</span></button>

            {integratedMatchesSelection && integratedResult && <div className="results-wrap integrated-results">
              <div className="result-headline"><CheckCircle2 size={20}/><div><strong>연간 통합 계산 완료</strong><span>{integratedResult.period.day_count}일 분석 · {integratedResult.period.month_segments}개 월 구간</span></div></div>
              {!aiInterpretation&&!aiLoading&&!aiError&&<div className="relationship-ai-toolbar"><button type="button" onClick={()=>void runAiInterpretation()}><Sparkles size={17}/><span>Gemini(제미나이) 통합 정밀해설</span></button><small>원할 때만 AI 호출 · 계산 자체는 Gemini 크레딧 0원 · 완료 후 토큰/예상비용 표시</small></div>}
              <AiInterpretationPanel result={aiInterpretation} loading={aiLoading} error={aiError} onRetry={()=>void runAiInterpretation()} topics={topicOrder}/>
              <div className="result-actions">
                <button type="button" onClick={()=>integratedRequestSnapshot && handleCopy('요청/프롬프트 전체복사', integratedPromptText(integratedRequestSnapshot, integratedResult))}><Copy size={15}/><span>요청/프롬프트 전체복사</span></button>
                <button type="button" onClick={()=>handleCopy('결과 전체복사', integratedResultText(integratedResult))}><Copy size={15}/><span>결과 전체복사</span></button>
                <button className="save-action" type="button" onClick={saveIntegratedRecord} disabled={archiveSaving}><Save size={15}/><span>{archiveSaving?'저장 중…':'기록 저장'}</span></button>
              </div>
              {actionNotice && <div className="status-banner subtle"><CheckCircle2 size={16}/><span>{actionNotice}</span></div>}
              {archiveStatus && <div className="status-banner subtle"><Cloud size={16}/><span>{archiveStatus}</span></div>}

              <section className="result-card">
                <div className="result-card-title"><span>WESTERN</span><strong>서양점성술 기간 흐름</strong></div>
                <p className="result-note">{integratedResult.western.score_policy} · {integratedResult.western.ephemeris}</p>
                {integratedResult.western.market?.calendar_warning && <div className="status-banner subtle"><AlertTriangle size={16}/><span>KRX 거래일 정밀도: {integratedResult.western.market.calendar_warning}</span></div>}
                <div className="integrated-topic-grid">
                  {orderedIntegratedTopics.map(({topic,stat})=><div className="integrated-topic" key={topic}><span>{topicDisplay(topic)}</span><strong>{stat.average.toFixed(1)}</strong><small>{stat.band}</small></div>)}
                </div>
                {topIntegratedTopics.length>0 && <div className="best-window"><span>가장 강한 흐름</span><strong>{topIntegratedTopics.slice(0,3).map((row)=>`${row.topic} ${row.stat.average.toFixed(1)}`).join(' · ')}</strong></div>}
                {cautionIntegratedTopics.length>0 && <div className="best-window caution-window"><span>상대적 주의 흐름</span><strong>{cautionIntegratedTopics.map((row)=>`${row.topic} ${row.stat.average.toFixed(1)}`).join(' · ')}</strong></div>}
              </section>

              {orderedRelationshipSignals.length > 0 && <section className="result-card integrated-relationship-flow"><div className="result-card-title"><span>RELATIONSHIP</span><strong>연애 · 연락 · 재접점 흐름</strong></div><div className="integrated-topic-grid signal-grid">{orderedRelationshipSignals.map(({topic,stat})=><div className="integrated-topic signal-topic" key={`integrated-signal-${topic}`}><span>{topic === '수신신호' ? '수신 · 상대 → 나' : topic === '발신적합' ? '발신 · 나 → 상대' : '과거 인연 · 재접점'}</span><strong>{stat.average.toFixed(1)}</strong><small>{stat.band}</small></div>)}</div><p className="result-note">수신·발신·재접점은 서로 섞지 않아. 점수는 사건 확률이 아니라 선택 기간의 상대적 활성도야.</p></section>}

              {integratedResult.western.market?.has_open_session && <section className="result-card market-flow-card"><div className="result-card-title"><span>MONEY · MARKET</span><strong>금전 · 주식 · 투자 흐름</strong></div><div className="integrated-topic-grid">{['투자심리','수익실현','신규진입','투자주의'].map((topic)=>{const stat=integratedResult.western.overall[topic]; if(!stat) return null; return <div className="integrated-topic market-topic" key={`integrated-market-${topic}`}><span>{topicDisplay(topic)}</span><strong>{stat.average.toFixed(1)}</strong><small>{stat.band}</small></div>})}</div><p className="result-note">투자주의는 높을수록 좋은 점수가 아니라 위험 경계가 강하다는 뜻이야.</p></section>}

              {(bestIntegratedDays.length>0 || cautionIntegratedDays.length>0) && <section className="result-card integrated-date-highlights"><div className="result-card-title"><span>TIMING</span><strong>좋은 날짜 · 주의 날짜</strong></div>{bestIntegratedDays.map((point)=><div className="tight-row" key={`integrated-best-${point.date}-${point.topic}`}><span>✨ {point.date} · {point.topic} · {point.label}</span><b>{point.score.toFixed(1)}</b></div>)}{cautionIntegratedDays.map((point)=><div className="tight-row" key={`integrated-caution-${point.date}-${point.topic}`}><span>⚠️ {point.date} · {point.topic} · {point.label}</span><b>{point.score.toFixed(1)}</b></div>)}<p className="result-note">선택 기간 안의 상대 활성도 비교야. 특정 사건 발생 확률은 아니야.</p></section>}

              {integratedResult.western.detail_days?.length ? <details className="result-card integrated-time-evidence"><summary>시간대별 계산 근거 펼치기</summary><div className="time-detail-list">{integratedResult.western.detail_days.map((day)=><details key={`integrated-day-${day.date}`} open={integratedResult.period.day_count===1}><summary>{day.date}{day.market_open ? ' · KRX 거래일' : ''}</summary><div className="time-topic-list">{Object.entries(day.topics).map(([topic,detail])=><div className="time-topic" key={`integrated-${day.date}-${topic}`}><strong className="time-topic-name">{topic}</strong>{detail.best_window && <div className="time-window time-window-good"><b>좋은 구간</b><span>{detail.best_window.start}~{detail.best_window.end}</span><em>{detail.best_window.score}</em></div>}{detail.caution_window && <div className="time-window time-window-caution"><b>주의 구간</b><span>{detail.caution_window.start}~{detail.caution_window.end}</span><em>{detail.caution_window.score}</em></div>}{detail.evidence?.length ? <div className="time-evidence"><span className="time-evidence-label">계산 근거</span>{detail.evidence.slice(0,3).map((item,index)=><em key={`integrated-${day.date}-${topic}-ev-${index}`}>{humanizeEvidence(item)}</em>)}</div> : null}</div>)}</div></details>)}</div></details> : null}

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
                  {!!integratedResult.saju.monthly?.length && <p className="result-note">사주 세운은 立春(입춘), 월운은 각 절(節)의 정확 시각을 경계로 구간을 나눠. 절기 시각은 lunar_python의 UTC+8 계산시각을 네 프로필 UTC 오프셋으로 변환해 표시해.</p>}
                </> : <div className="status-banner error"><AlertTriangle size={16}/><span>{integratedResult.saju.error || '사주 계산에 실패했어.'}</span></div>}
              </section>

              <section className="result-card">
                <div className="result-card-title"><span>THAI</span><strong>Mahathaksa · Taksajorn · Suriyayat Lagna</strong></div>
                <div className="thai-baseline"><strong>{integratedResult.thai.thai_day}</strong><span>{integratedResult.thai.ruler}</span><p>{integratedResult.thai.rule}</p></div>
                {!!integratedResult.thai.taksajorn?.segments?.length && <div className="saju-list">{integratedResult.thai.taksajorn.segments.map((seg)=><div key={`${seg.start}-${seg.end}`}><strong>{seg.start} ~ {seg.end}</strong><span>나이 진행 {seg.age_in_progress} · 연간 Boriwan(브리완) {seg.annual_boriwan.label}{seg.landed_center?' · 중앙 착지 후 Jupiter(목성) 적용':''}</span></div>)}</div>}
                {integratedResult.thai.suriyayat?.available && <div className="status-banner subtle"><CheckCircle2 size={16}/><span>Suriyayat(수리야얏) 10행성 위치 검증층 ON · 30개 기준값 교차검산 · 최대 오차 {integratedResult.thai.suriyayat.validation?.max_delta_arcmin ?? '—'}각분. {integratedResult.thai.suriyayat.lagna?.available?`Lagna ${integratedResult.thai.suriyayat.lagna.display||'숫자 위치'} 검증 완료.`:'Lagna 제품 계약 미충족으로 해설 제외.'}</span></div>}
                <p className="result-note">Mahathaksa/Taksajorn은 태국 기간층, Suriyayat은 검증된 위치 사실층이야. Lagna와 12개 하우스 연결은 비예측형 맥락만 설명하며, 학파 예외·최종 길흉·사건·정확한 미래 시기·확률·점수는 만들지 않고 Western 점수에도 섞지 않아.</p>
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
            <div className="tool-panel-heading"><span className={`tool-icon ${selectedTool==='compatibility'?'tone-rose':'tone-champagne'}`}>{selectedTool==='compatibility'?<Heart size={22}/>:<Gem size={22}/>}</span><div><span className="eyebrow">관계 정밀 계산</span><h2>{selectedToolInfo.label}</h2><p>{selectedTool==='marriage'?'결혼 여부를 단정하지 않고 두 사람의 장기 결속·협력·긴장 흐름을 계산해.':relationshipPurpose==='reunion'?'과거 인연의 재접점·수신·발신 흐름과 강한 시기를 따로 봐.':'두 사람의 기본 관계 구조와 선택 기간의 시기 흐름을 분리해서 봐.'}</p></div></div>
            {selectedTool==='compatibility' && <>
              <div className="relationship-mode-row relationship-main-mode-row">
                <button type="button" className={relationshipPurpose==='reunion'?'is-active':''} onClick={()=>{setRelationshipPurpose('reunion');setRelationshipMode('single');setRelationshipDays(365);setRelationshipCalendarYear(null);setReunionTiming(null);setRelationshipAi(null)}}>재회</button>
                {relationshipModes.map(([value,label])=><button key={value} type="button" className={relationshipPurpose==='compatibility'&&relationshipMode===value?'is-active':''} onClick={()=>{setRelationshipPurpose('compatibility');setRelationshipMode(value);setReunionTiming(null);setRelationshipAi(null)}}>{label}</button>)}
              </div>
              <div className="relationship-range-block">
                <div><strong>{relationshipPurpose==='reunion'?'재회운 분석기간':'궁합 시기 분석기간'}</strong><span>{relationshipStartDate} ~ {relationshipEndDate} · {relationshipCalendarYear?`${relationshipCalendarYear}년 전체`:`${clampedRelationshipDays}일`}</span></div>
                <div className="relationship-range-buttons">{relationshipDayPresets.map((days)=><button key={days} type="button" className={clampedRelationshipDays===days?'is-active':''} onClick={()=>{setRelationshipDays(days);setRelationshipCalendarYear(null)}}>{days===365?'1년':`${days}일`}</button>)}</div>
                <div className="relationship-custom-days"><span>직접 지정</span><label><input type="number" min="7" max="365" step="1" value={clampedRelationshipDays} onChange={(e)=>{setRelationshipDays(Math.max(7,Math.min(365,Number(e.target.value)||7)));setRelationshipCalendarYear(null)}}/><em>일</em></label></div>
                <div className="calendar-year-selector relationship-calendar-year"><div><strong>연도 전체</strong><span>해당 연도 1/1~12/31</span></div><select aria-label="관계운 달력 연도 선택" value={relationshipCalendarYear??''} onChange={(e)=>{setRelationshipCalendarYear(e.target.value?Number(e.target.value):null);setReunionTiming(null);setRelationshipAi(null)}}><option value="">선택 안 함</option>{calendarYearOptions.map((year)=><option key={year} value={year}>{year}년</option>)}</select></div>
                <small className="relationship-range-note">{relationshipPurpose==='reunion'?'재회는 기본 365일. 수신·발신·재접점과 두 사람 차트를 건드리는 실제 트랜짓 날짜를 이 범위 안에서 비교해.':'기본 궁합 구조는 고정이고, 여기 지정한 7~365일은 관계 시기 흐름에만 적용돼.'}</small>
              </div>
            </>}
            {selectedTool==='marriage' && <div className="relationship-purpose-row marriage-purpose-row"><button type="button" className={marriageMode==='unmarried'?'is-active':''} onClick={()=>{setMarriageMode('unmarried');setRelationshipAi(null)}}><strong>미혼</strong><span>결혼 전 · 장기 결속과 결혼생활 적합 구조</span></button><button type="button" className={marriageMode==='married'?'is-active':''} onClick={()=>{setMarriageMode('married');setRelationshipAi(null)}}><strong>기혼</strong><span>결혼 후 · 현재 결속과 갈등·회복 주기</span></button></div>}
            {selectedTool==='marriage'&&<div className="status-banner marriage-intro"><Gem size={16}/><span>{marriageMode==='unmarried'?'결혼 여부 예언이 아니라, 이 관계가 결혼생활로 이어질 때의 생활궁합·책임·갈등·지속성을 깊게 봐.':'이미 결혼한 관계 기준으로 현재 결속·정서적 거리·역할분담·갈등과 회복 흐름을 봐.'}</span></div>}
            {selectedTool==='marriage'&&<div className="relationship-range-block marriage-range-block"><div><strong>{marriageMode==='unmarried'?'미혼 결혼운 분석기간':'기혼 결혼운 분석기간'}</strong><span>{relationshipStartDate} ~ {relationshipEndDate} · {relationshipCalendarYear?`${relationshipCalendarYear}년 전체`:`${clampedRelationshipDays}일`}</span></div><div className="relationship-range-buttons">{relationshipDayPresets.map((days)=><button key={days} type="button" className={clampedRelationshipDays===days?'is-active':''} onClick={()=>{setRelationshipDays(days);setRelationshipCalendarYear(null)}}>{days===365?'1년':`${days}일`}</button>)}</div><div className="relationship-custom-days"><span>직접 지정</span><label><input type="number" min="7" max="365" step="1" value={clampedRelationshipDays} onChange={(e)=>{setRelationshipDays(Math.max(7,Math.min(365,Number(e.target.value)||7)));setRelationshipCalendarYear(null)}}/><em>일</em></label></div><div className="calendar-year-selector relationship-calendar-year"><div><strong>연도 전체</strong><span>해당 연도 1/1~12/31</span></div><select aria-label="결혼운 달력 연도 선택" value={relationshipCalendarYear??''} onChange={(e)=>{setRelationshipCalendarYear(e.target.value?Number(e.target.value):null);setRelationshipAi(null)}}><option value="">선택 안 함</option>{calendarYearOptions.map((year)=><option key={year} value={year}>{year}년</option>)}</select></div><small className="relationship-range-note">결혼운은 기본 365일. 관계 구조와 선택 기간의 긴장·완화 흐름을 분리해서 봐.</small></div>}
            {selectedTool==='compatibility'&&relationshipPurpose==='reunion'&&<div className="status-banner reunion-intro"><Heart size={16}/><span>재회를 누르면 기본 분석기간은 1년(365일)이야. 현재 범위는 {relationshipStartDate}~{relationshipEndDate}이고, 7~365일 안에서 직접 바꿀 수 있어. 수신(상대→나) · 발신(나→상대) · 재접점은 서로 섞지 않아.</span></div>}
            <div className="subsection-title">상대 출생정보</div>
            <div className="field-grid">
              <label className="field field-wide"><span>이름 / 구분명</span><input value={counterpart.name} onChange={(e)=>setCounterpart({...counterpart,name:e.target.value})} placeholder="예: A, 상대방"/></label>
              <label className="field birth-date-field"><span>생년월일</span><input type="date" value={counterpart.birthDate} onChange={(e)=>setCounterpart({...counterpart,birthDate:e.target.value})}/></label>
              <label className="field birth-time-field"><span>출생시간</span><input type="time" value={counterpart.birthTime} disabled={!counterpart.timeKnown} onChange={(e)=>setCounterpart({...counterpart,birthTime:e.target.value})}/></label>
              <label className="check-field field-wide"><input type="checkbox" checked={!counterpart.timeKnown} onChange={(e)=>setCounterpart({...counterpart,timeKnown:!e.target.checked,birthTime:e.target.checked?'':counterpart.birthTime})}/><span>상대 출생시간 모름 — 출생지역은 그대로 기록 가능 · Moon(달)·각도·하우스·다빈슨/마크스 등 시간민감 레이어만 자동 제외</span></label>
              <KoreaBirthplaceSelector value={counterpart} onChange={(location)=>setCounterpart({...counterpart,...location})}/>
              <details className="advanced-panel field-wide"><summary>고급 위치 설정 · 위도/경도 직접 수정</summary><div className="advanced-grid">
                <label className="field"><span>위도</span><input inputMode="decimal" value={counterpart.latitude} onChange={(e)=>setCounterpart({...counterpart,latitude:e.target.value,placeKey:''})}/></label>
                <label className="field"><span>경도</span><input inputMode="decimal" value={counterpart.longitude} onChange={(e)=>setCounterpart({...counterpart,longitude:e.target.value,placeKey:''})}/></label>
                <label className="field field-wide"><span>UTC(협정세계시) 시차</span><input inputMode="decimal" value={counterpart.utcOffset} onChange={(e)=>setCounterpart({...counterpart,utcOffset:e.target.value})}/></label>
              </div></details>
            </div>
            <div className="coordinate-note"><MapPin size={16}/><span>국내는 시·도 → 시·군·구만 고르면 현재 행정경계 대표좌표와 UTC +9를 자동 적용해. 직접 좌표 입력은 고급 설정이야.</span></div>
            <div className="calculation-range"><CalendarDays size={17}/><span>관계 분석기간 {relationshipStartDate} ~ {relationshipEndDate} · {relationshipDayCount}일</span></div>
            {relationshipError && <div className="status-banner error"><AlertTriangle size={17}/><span>{relationshipError}</span></div>}
            <button className="primary-button" type="button" onClick={runRelationship} disabled={relationshipLoading||reunionTimingLoading||apiStatus==='offline'}>{(relationshipLoading||reunionTimingLoading)?<LoaderCircle className="spin" size={18}/>:<Sparkles size={18}/>}<span>{(relationshipLoading||reunionTimingLoading)?(selectedTool==='marriage'?'결혼운 계산 중…':relationshipPurpose==='reunion'?'재회운 계산 중…':'궁합 계산 중…'):(selectedTool==='marriage'?(marriageMode==='unmarried'?'미혼 결혼운 정밀 계산':'기혼 결혼운 정밀 계산'):relationshipPurpose==='reunion'?'재회운 정밀 계산':'궁합 정밀 계산')}</span></button>

            {relationshipResult && <div className="results-wrap">
              <div className="result-headline"><CheckCircle2 size={20}/><div><strong>실제 계산 완료</strong><span>{relationshipResult.period.start} ~ {relationshipResult.period.end} · {relationshipDayCount}일</span></div></div>
              <div className="result-actions">
                <button type="button" onClick={()=>relationshipRequestSnapshot && handleCopy('요청/프롬프트 전체복사', relationshipPromptText(selectedTool==='marriage'?'marriage':relationshipPurpose, relationshipRequestSnapshot, relationshipResult, reunionTiming))}><Copy size={15}/><span>요청/프롬프트 전체복사</span></button>
                <button type="button" onClick={()=>handleCopy('결과 전체복사', relationshipResultText(selectedTool==='marriage'?'marriage':relationshipPurpose, relationshipResult, reunionTiming))}><Copy size={15}/><span>결과 전체복사</span></button>
                <button className="save-action" type="button" onClick={saveRelationshipRecord} disabled={archiveSaving}><Save size={15}/><span>{archiveSaving?'저장 중…':'기록 저장'}</span></button>
              </div>
              {actionNotice && <div className="status-banner subtle"><CheckCircle2 size={16}/><span>{actionNotice}</span></div>}
              {archiveStatus && <div className="status-banner subtle"><Cloud size={16}/><span>{archiveStatus}</span></div>}
              {selectedTool==='compatibility'&&relationshipPurpose==='reunion'&&<ReunionTimingPanel context={reunionTiming} loading={reunionTimingLoading} error={reunionTimingError}/>}
              {selectedTool==='compatibility'&&relationshipPurpose==='reunion'&&<ReunionTransitPanel result={relationshipResult}/>}
              <RelationshipInterpretationPanel aspects={natalAspects} partnerExact={Boolean(relationshipResult.result.natal_synastry?.partner_time_exact)} ai={relationshipAi} aiLoading={relationshipAiLoading} aiError={relationshipAiError} onAi={runRelationshipAi} analysisMode={selectedTool==='marriage'?`marriage_${marriageMode}`:relationshipPurpose} timeSensitivePoints={relationshipTimeSensitivePoints} formatAspect={aspectText} />
              {partnerTimeExact&&relationshipResult.result.house_overlays?.available&&<section className="result-card"><div className="result-card-title"><span>HOUSE OVERLAY</span><strong>홀사인 + 플라시두스 관계 하우스</strong></div><p className="result-note">한 체계로 덮어쓰지 않고 둘 다 보여줘. 숫자가 다르면 서로 다른 해석층이고, 같으면 중첩 근거로 봐.</p><div className="month-list">{[
                {title:'내 행성 → 상대 하우스',rows:relationshipResult.result.house_overlays.user_in_counterpart?.relationship_houses??[]},
                {title:'상대 행성 → 내 하우스',rows:relationshipResult.result.house_overlays.counterpart_in_user?.relationship_houses??[]},
              ].map((group)=><div className="month-card" key={group.title}><div className="month-title"><strong>{group.title}</strong><span>{group.rows.length}개 관계 하우스 접점</span></div>{group.rows.slice(0,12).map((row,index)=><div className="tight-row" key={`${group.title}-${row.planet}-${index}`}><span>{planetLabels[row.planet]??row.planet}</span><b>홀사인 {row.whole_house??'—'}H · 플라시두스 {row.placidus_house??row.house??'—'}H</b></div>)}</div>)}</div></section>}
              <details className="result-card relationship-evidence-details">
                <summary>기본 관계 구조 · 계산 근거 펼치기</summary>
                <div className="relationship-evidence-body">
                <div className="result-card-title"><span>기본 궁합</span><strong>계산 근거</strong></div>
                <p className="result-note">아래 숫자는 관계 점수나 재회 확률이 아니라, 허용 오브 안에서 포착된 주요 천체 각의 개수야.</p>
                <div className="metric-grid">
                  <div className="metric"><strong>{natalAspects.length}</strong><span>주요 각</span></div>
                  <div className="metric"><strong>{natalSupportive}</strong><span>조화 각</span></div>
                  <div className="metric"><strong>{natalChallenging}</strong><span>긴장 각</span></div>
                </div>
                {natalMixed>0 && <p className="result-note">혼합 각 {natalMixed}개 · 개수만으로 관계의 좋고 나쁨을 판정하지 않아.</p>}
                <div className="aspect-list">{natalAspects.slice(0,8).map((aspect,index)=><div className="aspect-row" key={`${aspect.a}-${aspect.aspect}-${aspect.b}-${index}`}><span className={`tone-dot ${aspect.tone}`}/><div><strong>{aspectText(aspect)}</strong><span>오브 {aspect.orb.toFixed(2)}° · {aspect.tone==='supportive'?'조화':aspect.tone==='challenging'?'긴장':'혼합'}</span></div></div>)}</div>
                </div>
              </details>
              {!partnerTimeExact ? <section className="result-card">
                <div className="result-card-title"><span>정밀도</span><strong>출생시간 미상 · 일부 시기층 제외</strong></div>
                <div className="status-banner subtle"><AlertTriangle size={16}/><span>상대 출생시간을 몰라 진행 궁합차트·진행 합성차트·Davison(데이비슨)·Marks(마크스) 정밀 시기층은 추정하지 않았어. 입력한 출생지역은 기록에 보존하지만 시간민감 각도·하우스 계산에는 사용하지 않아. 이 상태에서 0은 재회 가능성 0%나 관계 점수 0점을 뜻하지 않아.</span></div>
                <p className="result-note">현재는 출생시간 없이도 확정 가능한 행성 간 기본 궁합 접점만 해석 근거로 사용해.</p>
              </section> : resultMonths.length>0 && <section className="result-card"><div className="result-card-title"><span>시기</span><strong>기간별 정밀 접점</strong></div><p className="result-note">접점 수는 사건 확률이 아니야. 독립 레이어에서 반복되는 정밀 접점을 보는 용도야.</p><div className="month-list">{resultMonths.map((month)=><div className="month-card" key={`${month.calendar_month}-${month.representative_date}`}><div className="month-title"><strong>{month.calendar_month}</strong><span>대표일 {month.representative_date}</span></div><div className="month-metrics"><span><b>{month.signal_summary.exact_contacts}</b> 정밀</span><span><b>{month.signal_summary.supportive_contacts}</b> 조화</span><span><b>{month.signal_summary.challenging_contacts}</b> 긴장</span></div>{month.signal_summary.tightest.slice(0,3).map((aspect,index)=><div className="tight-row" key={index}><span>{aspectText(aspect)}</span><b>{aspect.orb.toFixed(2)}°</b></div>)}</div>)}</div></section>}
              {(relationshipResult.result.limitations?.length??0)>0 && <div className="status-banner subtle"><AlertTriangle size={16}/><span>{partnerTimeExact ? relationshipResult.result.limitations?.map(relationshipLimitKo).join(' ') : '상대 출생시간을 몰라 데이비슨·마크스·3차 진행은 임의 추정하지 않고 제외했어.'}</span></div>}
            </div>}
          </section>}

          {selectedTool === 'location' && <section className="tool-panel location-panel">
            <div className="tool-panel-heading"><span className="tool-icon tone-sage"><MapPin size={22}/></span><div><span className="eyebrow">지역 활성도 계산</span><h2>지역·국가운</h2><p>출생 순간의 행성이 각 도시의 ASC(상승점)·DSC(하강점)·MC(중천점)·IC(천저점)에 얼마나 가까이 놓이는지 계산해서 장기거주·연애·커리어·공부·휴식 목적별로 비교해.</p></div></div>
            <div className="coordinate-note"><MapPin size={16}/><span>좋은 나라를 단정하는 기능은 아니야. 대표 도시의 점성 활성도를 비교하고, 비자·생활비·치안·언어·직업시장 같은 현실 조건은 별도로 봐야 해.</span></div>
            {locationError && <div className="status-banner error"><AlertTriangle size={17}/><span>{locationError}</span></div>}
            <button className="primary-button" type="button" onClick={runLocationFit} disabled={locationLoading||apiStatus==='offline'}>{locationLoading?<LoaderCircle className="spin" size={18}/>:<MapPin size={18}/>}<span>{locationLoading?'국가·도시 계산 중…':'나와 맞는 국가·도시 계산'}</span></button>
            {locationResult && <div className="results-wrap">
              {locationResult.map && <AstrocartographyWorldMap map={locationResult.map} purposes={locationResult.purposes}/>}
              <section className="result-card"><div className="result-card-title"><span>국가 순위</span><strong>종합·장기거주 기준 상위 국가</strong></div><div className="location-rank-list">{locationResult.countries.slice(0,10).map((row,index)=><div className="location-rank-row" key={row.country}><span>{index+1}</span><div><strong>{row.country}</strong><small>대표 도시 {row.best_city}</small></div><b>{row.score.toFixed(1)}</b></div>)}</div><p className="result-note">점수는 대표 도시 카탈로그 안의 상대적 점성 활성도야. 실제 이민·여행 성공 확률이 아니야.</p></section>
              <div className="location-purpose-grid">{Object.entries(locationResult.purposes).map(([key,group])=><section className="location-purpose-card" key={key}><strong>{group.label}</strong><div className="location-rank-list">{group.cities.slice(0,5).map((row,index)=><div className="location-rank-row" key={`${key}-${row.city}`}><span>{index+1}</span><div><strong>{row.city} · {row.country}</strong><small>{row.evidence.slice(0,2).map((ev)=>`${ev.planet}(${annotateUserFacingText(ev.planet).replace(ev.planet,'').replace(/[()]/g,'')||ev.planet})-${ev.angle} ${ev.separation_deg}°`).join(' · ')}</small></div><b>{row.score.toFixed(1)}</b></div>)}</div></section>)}</div>
              <p className="location-evidence">{locationResult.policy.meaning} · {locationResult.policy.catalog_scope}</p>
            </div>}
          </section>}

          {selectedTool === 'precision' && <section className="tool-panel precision-panel">
            <div className="tool-panel-heading"><span className="tool-icon tone-sage"><Search size={22}/></span><div><span className="eyebrow">정밀 계산</span><h2>정밀분석</h2><p>새 점수를 만들지 않고 선택한 기간 운세 실계산의 원자료를 더 깊게 펼쳐봐. Western(서양점성술) 세부 지표, 사주 원자료, Thai(태국점성술) 상태와 원본 JSON(제이슨·데이터 형식)까지 확인할 수 있어.</p></div></div>
            <div className="calculation-range"><CalendarDays size={17}/><span>분석기간 {queryDate} ~ {periodEnd(queryDate,period)} · {periodRangeLabel(period)}</span></div>
            <div className="coordinate-note"><Search size={16}/><span>기간 운세와 같은 실계산 엔진을 사용해. 같은 날짜·기간 계산이 이미 있으면 다시 호출하지 않고 동일 결과를 정밀 화면에서 펼쳐 보여줘.</span></div>
            {integratedError && <div className="status-banner error"><AlertTriangle size={17}/><span>{integratedError}</span></div>}
            {!integratedMatchesSelection && <button className="primary-button" type="button" onClick={runIntegrated} disabled={integratedLoading||apiStatus==='offline'}>{integratedLoading?<LoaderCircle className="spin" size={18}/>:<Search size={18}/>}<span>{integratedLoading?'정밀 계산 중…':'정밀분석 실제 계산'}</span></button>}

            {integratedMatchesSelection && integratedResult && <div className="results-wrap precision-results">
              <div className="result-headline"><CheckCircle2 size={20}/><div><strong>정밀 실계산 준비 완료</strong><span>{integratedResult.period.day_count}일 분석 · 원자료 확장 보기</span></div></div>
              <div className="result-actions">
                <button type="button" onClick={()=>integratedRequestSnapshot && handleCopy('정밀 요청/프롬프트 전체복사', precisionPromptText(integratedRequestSnapshot, integratedResult))}><Copy size={15}/><span>요청/프롬프트 전체복사</span></button>
                <button type="button" onClick={()=>handleCopy('정밀 결과 전체복사', precisionResultText(integratedResult))}><Copy size={15}/><span>결과 전체복사</span></button>
                <button className="save-action" type="button" onClick={savePrecisionRecord} disabled={archiveSaving}><Save size={15}/><span>{archiveSaving?'저장 중…':'정밀 기록 저장'}</span></button>
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
                  {(integratedResult.saju.annual?.length??0)>0 && <details className="precision-details"><summary>세운 전체 · 입춘 경계</summary><div className="precision-details-body">{integratedResult.saju.annual?.map((row,index)=><div className="tight-row" key={`${row.year}-${row.ganzhi}-${index}`}><span>{row.segment_start&&row.segment_end_exclusive?`${row.segment_start} ~ ${row.segment_end_exclusive}`:`${row.year}`} · {row.start_jie_ko?`${row.start_jie_ko}(${row.start_jie}) · `:''}{row.stem_ten_god} · {row.branch_links.join(', ')||'연결 없음'}</span><b>{row.ganzhi}</b></div>)}</div></details>}
                  {(integratedResult.saju.monthly?.length??0)>0 && <details className="precision-details"><summary>월운 전체 · 절(節) 경계</summary><div className="precision-details-body">{integratedResult.saju.monthly?.map((row,index)=><div className="tight-row" key={`${row.calendar_month}-${row.ganzhi}-${index}`}><span>{row.segment_start&&row.segment_end_exclusive?`${row.segment_start} ~ ${row.segment_end_exclusive}`:row.calendar_month} · {row.jie_name_ko?`${row.jie_name_ko}(${row.jie_name}) · `:''}{row.stem_ten_god} · {row.branch_links.join(', ')||'연결 없음'}</span><b>{row.ganzhi}</b></div>)}</div></details>}
                  {(integratedResult.saju.not_calculated?.length??0)>0 && <><div className="subsection-title">엔진 미계산 · 임의 추정 금지</div><div className="precision-badge-row">{integratedResult.saju.not_calculated?.map((item)=><span key={item}>{item}</span>)}</div></>}
                </> : <div className="status-banner error"><AlertTriangle size={16}/><span>{integratedResult.saju.error||'사주 계산 원자료가 없어.'}</span></div>}
              </section>

              <section className="result-card">
                <div className="result-card-title"><span>THAI STATUS</span><strong>태국점성술 계산 상태</strong></div>
                <div className="precision-kpi-grid"><div className="precision-kpi"><span>출생요일</span><strong>{integratedResult.thai.thai_day}</strong></div><div className="precision-kpi"><span>주재 행성</span><strong>{integratedResult.thai.ruler}</strong></div></div>
                <div className="tight-row"><span>Mahathaksa</span><b>{integratedResult.thai.mahathaksa?.available?'8궁 계산됨':'미계산'}</b></div>
                <div className="tight-row"><span>Taksajorn</span><b>{integratedResult.thai.taksajorn?.available?'연령 기간 계산됨':'미계산'}</b></div>
                <div className="tight-row"><span>Suriyayat 10행성 위치</span><b>{integratedResult.thai.suriyayat?.available?`교차검증됨 · 최대 Δ${integratedResult.thai.suriyayat.validation?.max_delta_arcmin ?? '—'}′`:'미계산'}</b></div>
                <div className="tight-row"><span>Suriyayat Lagna(라그나)</span><b>{integratedResult.thai.suriyayat?.lagna?.available?(integratedResult.thai.suriyayat.lagna.display||'검증된 숫자 위치 계산됨'):'제품 계약 미충족 · 해설 제외'}</b></div>
                <div className="tight-row"><span>하우스 설명 경로</span><b>{integratedResult.thai.suriyayat?.ai_safe_packet_product?.eligible_for_gemini&&integratedResult.thai.suriyayat.ai_safe_packet_product.route_count===12?'12개 검증됨 · 비예측 설명만':'AI 해설 제외'}</b></div>
                <div className="tight-row"><span>설명 범위</span><b>검증된 위치·하우스 맥락만</b></div>
                <div className="tight-row"><span>예측 제한</span><b>사건·시기·확률·점수 미제공</b></div>
                {integratedResult.thai.taksajorn?.method_variance_note && <p className="result-note">{integratedResult.thai.taksajorn.method_variance_note}</p>}
                {!!integratedResult.thai.not_calculated?.length && <p className="result-note">아직 미계산: {integratedResult.thai.not_calculated.join(' · ')}</p>}
              </section>

              <section className="result-card">
                <div className="result-card-title"><span>RAW JSON</span><strong>원본 계산 응답</strong></div>
                <details className="precision-details"><summary>원본 JSON(제이슨·데이터 형식) 전체 펼치기</summary><div className="precision-details-body"><pre className="precision-json">{JSON.stringify(integratedResult,null,2)}</pre></div></details>
              </section>
            </div>}
          </section>}

          {selectedTool===null && <section className="tool-panel period-fortune-report">
            <div className="tool-panel-heading"><span className="tool-icon tone-gold"><Moon size={22}/></span><div><span className="eyebrow">PERIOD FORTUNE</span><h2>{period==='today'?'오늘의 운세':`${periods.find((item)=>item.key===period)?.label}운세`}</h2><p>{queryDate} → {integratedSelectionEnd} · 선택한 기간만 따로 보는 기간 운세야.</p></div></div>

            {!integratedMatchesSelection && <>
              <div className="coordinate-note"><Sparkles size={16}/><span>현재 선택한 기간의 계산 결과가 아직 없어. 버튼을 누르면 계산 후 Gemini 자연어 해설도 자동 생성해. 최초 생성은 API 사용량이 발생할 수 있고, 같은 계산의 저장본 재조회는 다시 호출하지 않아.</span></div>
              {integratedError && <div className="status-banner error"><AlertTriangle size={17}/><span>{integratedError}</span></div>}
              <button className="primary-button" type="button" onClick={runIntegrated} disabled={integratedLoading||apiStatus==='offline'}>{integratedLoading?<LoaderCircle className="spin" size={18}/>:<Sparkles size={18}/>}<span>{integratedLoading?'기간 운세 계산 중…':`${period==='today'?'오늘':periods.find((item)=>item.key===period)?.label}운세 + AI 해설 생성`}</span></button>
            </>}

            {integratedMatchesSelection && integratedResult && <>
              <div className="result-headline"><CheckCircle2 size={20}/><div><strong>{period==='today'?'오늘':periods.find((item)=>item.key===period)?.label}운세 계산 완료</strong><span>{integratedResult.engine} · {integratedResult.period.day_count}일 분석</span></div></div>
              <PeriodAiInterpretationPanel result={aiInterpretation} loading={aiLoading} error={aiError} cacheSource={aiCacheSource} onRetry={()=>void runAiInterpretation(integratedResult, integratedRequestSnapshot)}/>

              <section className="result-card">
                <div className="result-card-title"><span>CORE FLOW</span><strong>핵심 흐름</strong></div>
                <div className="integrated-topic-grid">
                  {topIntegratedTopics.slice(0,3).map(({topic,stat})=><div className="integrated-topic" key={`period-top-${topic}`}><span>{topicDisplay(topic)}</span><strong>{stat.average.toFixed(1)}</strong><small>{stat.band}</small></div>)}
                </div>
                {cautionIntegratedTopics.length>0 && <div className="best-window caution-window"><span>상대적 주의 흐름</span><strong>{cautionIntegratedTopics.map((row)=>`${topicDisplay(row.topic)} ${row.stat.average.toFixed(1)}`).join(' · ')}</strong></div>}
              </section>

              {(bestIntegratedDays.length>0 || cautionIntegratedDays.length>0) && <section className="result-card period-date-highlights">
                <div className="result-card-title"><span>TIMING</span><strong>좋은 날짜 · 주의 날짜</strong></div>
                {bestIntegratedDays.map((point)=><div className="tight-row" key={`period-best-${point.date}-${point.topic}`}><span>✨ {point.date} · {topicDisplay(point.topic)} · {point.label}</span><b>{point.score.toFixed(1)}</b></div>)}
                {cautionIntegratedDays.map((point)=><div className="tight-row" key={`period-caution-${point.date}-${point.topic}`}><span>⚠️ {point.date} · {topicDisplay(point.topic)} · {point.label}</span><b>{point.score.toFixed(1)}</b></div>)}
                <p className="result-note">기간 안의 상대 활성도 비교야. 특정 사건 발생 확률은 아니야.</p>
              </section>}

              {integratedResult.western.detail_days?.length ? <details className="result-card integrated-time-evidence period-time-evidence"><summary>시간대별 계산 근거 펼치기</summary><div className="time-detail-list">{integratedResult.western.detail_days.map((day)=><details key={`period-day-${day.date}`} open={integratedResult.period.day_count===1}><summary>{day.date}{day.market_open ? ' · KRX 거래일' : ''}</summary><div className="time-topic-list">{Object.entries(day.topics).map(([topic,detail])=><div className="time-topic" key={`period-${day.date}-${topic}`}><strong className="time-topic-name">{topicDisplay(topic)}</strong>{detail.best_window && <div className="time-window time-window-good"><b>좋은 구간</b><span>{detail.best_window.start}~{detail.best_window.end}</span><em>{detail.best_window.score}</em></div>}{detail.caution_window && <div className="time-window time-window-caution"><b>주의 구간</b><span>{detail.caution_window.start}~{detail.caution_window.end}</span><em>{detail.caution_window.score}</em></div>}{detail.evidence?.length ? <div className="time-evidence"><span className="time-evidence-label">계산 근거</span>{detail.evidence.slice(0,3).map((item,index)=><em key={`period-${day.date}-${topic}-ev-${index}`}>{humanizeEvidence(item)}</em>)}</div> : null}</div>)}</div></details>)}</div></details> : null}

              <section className="result-card">
                <div className="result-card-title"><span>SYSTEMS</span><strong>체계별 보조 흐름</strong></div>
                <div className="saju-summary">
                  {integratedResult.saju.ok && integratedResult.saju.day_master && <span>사주 일간 <b>{integratedResult.saju.day_master}</b></span>}
                  {activeDayun && <span>현재 대운 <b>{activeDayun.ganzhi}</b> · {activeDayun.start_year}~{activeDayun.end_year}</span>}
                  <span>Thai(태국점성술) <b>{integratedResult.thai.thai_day}</b> · {integratedResult.thai.ruler}</span>
                </div>
              </section>


              {period==='today' && <details className="result-card outcome-card">
                <summary>실제 결과 기록 · 개인보정</summary>
                <div className="outcome-form">
                  <p className="outcome-note">연락이 온 날뿐 아니라 연락이 없던 날도 같이 기록해야 비교가 덜 치우쳐. 현재 점수를 즉시 바꾸는 용도가 아니라, 네 기록이 쌓일수록 수신·재접점 지표가 실제 경험과 얼마나 맞는지 개인별로 검증하는 데이터야.</p>
                  <div className="outcome-grid">
                    <label><span>이 날 실제 연락 결과</span><select value={outcomeDraft.event} onChange={(e)=>setOutcomeDraft({...outcomeDraft,event:e.target.value as OutcomeEvent})}><option value="">기록 안 함</option><option value="none">연락 없음</option><option value="received">연락 받음</option><option value="sent">내가 먼저 보냄</option><option value="both">서로 주고받음</option></select></label>
                    <label><span>연락 시각대</span><select value={outcomeDraft.event_time_bucket} onChange={(e)=>setOutcomeDraft({...outcomeDraft,event_time_bucket:e.target.value as OutcomeTimeBucket})}><option value="">시간 기록 안 함</option><option value="dawn">새벽 00~06</option><option value="morning">오전 06~12</option><option value="afternoon">오후 12~18</option><option value="evening">저녁 18~22</option><option value="night">밤 22~24</option></select></label>
                    <label><span>연락 경로</span><select value={outcomeDraft.channel} onChange={(e)=>setOutcomeDraft({...outcomeDraft,channel:e.target.value as OutcomeChannel})}><option value="">경로 기록 안 함</option><option value="message">문자·메신저</option><option value="dm">DM·SNS</option><option value="call">전화</option><option value="in_person">직접 만남</option><option value="other">기타</option></select></label>
                    <label><span>짧은 메모</span><input type="text" maxLength={200} value={outcomeDraft.note} onChange={(e)=>setOutcomeDraft({...outcomeDraft,note:e.target.value})} placeholder="예: 저녁에 먼저 전화 옴"/></label>
                    <label className="outcome-check"><input type="checkbox" checked={outcomeDraft.past_connection} onChange={(e)=>setOutcomeDraft({...outcomeDraft,past_connection:e.target.checked})}/><span>과거 인연 관련 연락</span></label>
                  </div>
                  <button className="outcome-save" type="button" onClick={()=>void saveDailyOutcome()}>실제 결과 저장</button>
                  {outcomeSaved && <div className="outcome-saved">저장 완료 · 이후 개인보정 비교에 포함할게.</div>}
                  <p className="outcome-note">개인보정 기록 {outcomeCalibration.n}일{outcomeCalibration.n<5?` · 비교 시작까지 ${5-outcomeCalibration.n}일 더 필요`:outcomeCalibration.contactN&&outcomeCalibration.noneN?` · 연락 받은 날 수신 평균 ${outcomeCalibration.incomingContact?.toFixed(1)??'—'} / 연락 없는 날 ${outcomeCalibration.incomingNone?.toFixed(1)??'—'} · 재접점 ${outcomeCalibration.reconnectionContact?.toFixed(1)??'—'} / ${outcomeCalibration.reconnectionNone?.toFixed(1)??'—'}`:' · 연락 있음/없음 양쪽 표본이 더 필요'}</p>
                </div>
              </details>}
            </>}
          </section>}

        </>}

        {mainView === 'profile' && <section className="form-card profile-form-card">
          <div className="form-card-heading"><div className="report-icon"><User size={21}/></div><div><span className="eyebrow">MY BIRTH PROFILE</span><h2>내 출생 프로필</h2><p>정밀 계산에만 사용하고 이 브라우저 기기에 로컬 저장해.</p></div></div>
          <div className="privacy-note"><CheckCircle2 size={16}/><span>출생 프로필 자체는 이 브라우저에 저장해. 분석 기록에서 “기록 저장”을 누르면 계산 입력과 결과가 본인 전용 Supabase 기록에도 동기화될 수 있어.</span></div>
          <div className="field-grid">
            <label className="field field-wide"><span>이름 / 닉네임</span><input value={birthProfile.name} onChange={(e)=>setBirthProfile({...birthProfile,name:e.target.value})} placeholder="선택 입력"/></label>
            <label className="field birth-date-field"><span>생년월일</span><input type="date" value={birthProfile.birthDate} onChange={(e)=>setBirthProfile({...birthProfile,birthDate:e.target.value})}/></label>
            <label className="field birth-time-field"><span>출생시간</span><input type="time" value={birthProfile.birthTime} onChange={(e)=>setBirthProfile({...birthProfile,birthTime:e.target.value})}/></label>
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

        {mainView === 'history' && <ArchiveView items={archiveItems} loading={archiveLoading} status={archiveStatus} error={archiveError} legacyOpen={legacyArchiveOpen} onRefresh={refreshArchive} onCloseLegacy={setLegacyArchiveOpen.bind(null, null)} onGoHome={switchMainView.bind(null, 'home')} onRestore={restoreArchive} onCopy={copyArchiveResult} onRemove={removeArchive} />}

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
            <div className={`ai-api-state ${aiConfigured===true?'online':aiConfigured===false?'offline':'checking'}`}><Sparkles size={16}/><span><strong>Gemini API</strong><small>{aiConfigured===true?'Supabase Edge Function 연결됨 · Gemini 해설':aiConfigured===false?'미연결 · Supabase에 GEMINI_API_KEY 설정 필요':'연결 상태 확인 중'}</small></span></div>
          </div>

          <div className="subsection-title">알림</div>
          <div className="push-settings-card">
            <div className={`push-state-row ${pushState?.status || 'checking'}`}><span className="push-state-icon">🔔</span><span><strong>운세 푸시 알림</strong><small>{pushState?.message || 'OneSignal 알림 구독 상태 확인 중'}</small></span></div>
            <button type="button" onClick={()=>void togglePush()} disabled={pushBusy || pushState?.status==='unsupported'}>{pushBusy?'처리 중…':pushState?.status==='ready'?'알림 끄기':'알림 켜기'}</button>
            {pushState?.status==='needs_install' && <p>iPhone에서는 Safari에서 홈 화면에 추가한 뒤, 홈화면의 ‘별빛의 운명’을 열고 여기서 알림 켜기를 눌러야 해.</p>}
            {pushState?.status==='error' && <p>OneSignal 사이트 주소가 현재 Vercel 도메인과 맞는지 대시보드에서 확인해줘.</p>}
          </div>

          <div className="subsection-title">앱 상태</div>
          <div className="settings-status-grid">
            <div><span>계산 서버</span><strong>{apiStatus==='online'?'연결됨':apiStatus==='warming'?'확인 중':'대기 중'}</strong><small>{apiVersion || 'API 상태 확인'}</small></div>
            <div><span>AI 해설</span><strong>{aiConfigured===true?'연결됨':aiConfigured===false?'미연결':'확인 중'}</strong><small>{aiModel}</small></div>
            <div><span>알림</span><strong>{pushState?.status==='ready'?'켜짐':pushState?.status==='needs_install'?'홈화면 설치 필요':pushState?.status==='unsupported'?'지원 안 됨':pushState?.status==='error'?'확인 오류':'꺼짐/확인 중'}</strong><small>{pushState?.message || '설정 탭에서 확인'}</small></div>
            <div><span>클라우드 기록</span><strong>{archiveLoading?'확인 중':archiveError?'확인 오류':archiveItems.length+'개'}</strong><small>{archiveError || archiveStatus || '기록 상태 확인 전'}</small></div>
            <div><span>출생 프로필</span><strong>{hasProfile?'저장됨':'미저장'}</strong><small>{hasProfile?'이 브라우저 기기 보관':'내정보에서 먼저 저장'}</small></div>
          </div>

          <div className="privacy-note settings-note"><Cloud size={16}/><span>클라우드 기록은 현재 익명 로그인 세션 기준이야. Safari와 홈화면 웹앱이 서로 다른 익명 세션을 만들면 기록이 따로 보일 수 있어. 장기적으로 기기 간 동일 기록이 필요하면 Apple/Google 로그인이 필요해.</span></div>
          <div className="settings-actions"><button type="button" onClick={()=>switchMainView('history')}><History size={16}/>기록함 열기</button><button type="button" onClick={()=>switchMainView('profile')}><User size={16}/>출생 프로필 열기</button></div>
        </section>}
      </main>
      {actionNotice && actionNotice.includes('저장') && <div className="save-feedback-toast" role="status" aria-live="polite">{actionNotice}</div>}
      <nav className="bottom-nav" aria-label="하단 탐색">
        <button className={`nav-item ${mainView==='home'?'is-active':''}`} type="button" onClick={()=>switchMainView('home')}><Home size={20}/><span>홈</span></button>
        <button className={`nav-item ${mainView==='profile'?'is-active':''}`} type="button" onClick={()=>switchMainView('profile')}><User size={20}/><span>내정보</span></button>
        <button className={`nav-item ${mainView==='history'?'is-active':''}`} type="button" onClick={()=>switchMainView('history')}><History size={20}/><span>기록</span></button>
        <button className={`nav-item ${mainView==='settings'?'is-active':''}`} type="button" onClick={()=>switchMainView('settings')}><Settings size={20}/><span>설정</span></button>
      </nav>
    </div>
  )
}
