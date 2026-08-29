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

const DEFAULT_API_BASE = 'https://astro-app-api-f7fn.onrender.com'
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE).replace(/\/$/, '')
const PROFILE_STORAGE_KEY = 'starlight-destiny.birth-profile.v1'
const UI_SETTINGS_STORAGE_KEY = 'starlight-destiny.ui-settings.v1'
const AI_MODEL_STORAGE_KEY = 'starlight-destiny.ai-model.v1'
const AI_JOB_STORAGE_KEY = 'starlight-destiny.ai-job.v1'

type PeriodKey = 'today' | 'week' | 'month' | 'year'
type ApiStatus = 'warming' | 'online' | 'offline'
type MainView = 'home' | 'profile' | 'history' | 'settings'
type ToolKey = 'integrated' | 'compatibility' | 'marriage' | 'location' | 'precision'
type RelationshipStatus = 'single' | 'dating' | 'long_term' | 'cohabiting' | 'engaged' | 'married'
type RelationshipPurpose = 'compatibility' | 'reunion'
type MarriageMode = 'unmarried' | 'married'
type RelationshipAnalysisMode = RelationshipPurpose | 'marriage_unmarried' | 'marriage_married'
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
    reunion_transits?: {
      available: boolean
      period: { start: string; end: string }
      policy: string
      top_days: Array<{
        date: string; score: number; user_score: number; counterpart_score: number; shared_activation: boolean
        hits: Array<{ person: 'user'|'counterpart'; transit: string; aspect: string; target: string; orb: number; tone: string; score: number }>
      }>
      top_months: Array<{ calendar_month: string; score: number; top_dates: string[] }>
    }
  }
}

type RelationshipAiResponse = {
  ok: boolean
  error?: string
  model?: string
  fallback_from?: string
  interpreter_version?: string
  usage?: { prompt_tokens?: number; candidate_tokens?: number; thought_tokens?: number; total_tokens?: number; estimated_usd?: number; estimated_krw?: number }
  data?: {
    headline: string
    overview: string
    chemistry: string
    emotional_dynamic?: string
    communication: string
    conflict_pattern?: string
    power_boundaries?: string
    long_term?: string
    stability?: string
    tensions?: string
    timing: string
    reunion_context: string
    felt_scenarios?: string[]
    reunion_reading?: {
      bottom_line: string
      incoming_contact: string
      outgoing_contact: string
      reconnection_windows: string
      low_windows: string
      relationship_filter: string
      precision_note: string
    }
    marriage_reading?: {
      mode: string
      bottom_line: string
      bond: string
      emotional_home: string
      daily_life: string
      conflict_repair: string
      commitment_or_current_cycle: string
      timing: string
      caution: string
      precision_note: string
    }
    practical_advice?: string[]
    top_aspects: Array<{ label: string; meaning: string }>
    limits: string
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
type ReunionTimingContext = {
  period: { start: string; end: string }
  incoming: FortuneStat | null
  outgoing: FortuneStat | null
  reconnection: FortuneStat | null
  months: Array<{
    calendar_month: string
    start: string
    end: string
    incoming: FortuneStat | null
    outgoing: FortuneStat | null
    reconnection: FortuneStat | null
  }>
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
    market?: { has_open_session: boolean; session_count: number; session_dates: string[] }
    detail_days?: Array<{ date: string; market_open: boolean; topics: Record<string, { best_window?: { start: string; end: string; score: number }; caution_window?: { start: string; end: string; score: number }; evidence?: string[] }> }>
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



type LocationFitResponse = {
  ok: boolean
  api_version: string
  engine: string
  policy: { meaning: string; probability: boolean; guarantee: boolean; catalog_scope: string; distance_rule: string }
  map: {
    projection: string
    latitude_limit: number
    line_policy: string
    lines: Array<{ planet:string; angle:'ASC'|'DC'|'MC'|'IC'; segments:Array<Array<{latitude:number;longitude:number}>> }>
  }
  countries: Array<{ country: string; score: number; best_city: string; evidence: Array<{planet:string;angle:string;separation_deg:number;tone:string}> }>
  purposes: Record<string,{ label:string; cities:Array<{city:string;country:string;latitude:number;longitude:number;score:number;evidence:Array<{planet:string;angle:string;separation_deg:number;tone:string}>}> }>
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
  usage?: { prompt_tokens?: number; candidate_tokens?: number; thought_tokens?: number; billable_output_tokens?: number; total_tokens?: number; estimated_usd?: number; estimated_krw?: number; price_phase?: string }
  data?: {
    headline: string
    overall: { summary: string; dominant_pattern: string; best_phase: string; caution_phase: string }
    clusters: { relationship: string; work_study: string; money_news: string; investment?: string; condition: string }
    contact_flow?: { incoming?: string; outgoing?: string; reconnection?: string }
    investment_reading?: { psychology?: string; realization?: string; entry?: string; risk?: string }
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
  if (loading) return <section className="ai-interpret-card is-loading"><LoaderCircle className="spin" size={22}/><div><span className="eyebrow">AI(인공지능) 해설</span><strong>Gemini가 서버에서 정밀해석 중…</strong><p>앱을 닫거나 다른 앱으로 이동해도 서버 작업은 계속돼. 돌아오면 완료된 리딩을 자동으로 이어받아.</p></div></section>
  if (error) return <section className="ai-interpret-card is-error"><AlertTriangle size={20}/><div><span className="eyebrow">AI(인공지능) 해설</span><strong>AI 해설을 아직 붙이지 못했어</strong><p>{error}</p><button type="button" onClick={onRetry}>AI 해설 다시 시도</button></div></section>
  if (!result?.ok || !result.data) return null
  const data = result.data
  return <section className="ai-interpret-card">
    <div className="ai-interpret-head"><span className="ai-orb"><Sparkles size={19}/></span><div><span className="eyebrow">Gemini(제미나이) 통합 해설</span><h3>{data.headline || '통합 계산 해설'}</h3><small>실계산 결과를 바탕으로 한 자연어 해설</small></div></div>
    {result.usage?.total_tokens ? <details className="ai-meta-details"><summary>해설 생성 정보</summary><div className="ai-usage-card"><strong>API(응용 프로그램 인터페이스) 사용량</strong><span>입력 {(result.usage.prompt_tokens ?? 0).toLocaleString()} · 본문 출력 {(result.usage.candidate_tokens ?? 0).toLocaleString()} · 사고 {(result.usage.thought_tokens ?? 0).toLocaleString()} token(토큰)</span><b>예상비용 ${Number(result.usage.estimated_usd ?? 0).toFixed(4)} ≈ {Math.round(result.usage.estimated_krw ?? 0).toLocaleString()}원</b><small>최초 생성 예상치 · 저장 기록 재열람은 재호출이 없으면 0원</small></div></details> : null}
    <p className="ai-summary">{data.overall.summary}</p>
    {data.overall.dominant_pattern && <div className="ai-highlight"><strong>핵심 패턴</strong><span>{data.overall.dominant_pattern}</span></div>}
    <div className="ai-cluster-grid">
      {data.clusters.relationship && <div><strong>관계</strong><p>{data.clusters.relationship}</p></div>}
      {data.clusters.work_study && <div><strong>일 · 학업</strong><p>{data.clusters.work_study}</p></div>}
      {data.clusters.money_news && <div><strong>금전 · 소식</strong><p>{data.clusters.money_news}</p></div>}
      {data.clusters.investment && <div><strong>주식 · 투자</strong><p>{data.clusters.investment}</p></div>}
      {data.clusters.condition && <div><strong>컨디션</strong><p>{data.clusters.condition}</p></div>}
    </div>
    {data.contact_flow && (data.contact_flow.incoming || data.contact_flow.outgoing || data.contact_flow.reconnection) && <div className="ai-direction-grid"><article><strong>수신 · 상대 → 나</strong><p>{data.contact_flow.incoming || '뚜렷한 수신 근거가 없어.'}</p></article><article><strong>발신 · 나 → 상대</strong><p>{data.contact_flow.outgoing || '뚜렷한 발신 적합 근거가 없어.'}</p></article><article><strong>과거 인연 · 재접점</strong><p>{data.contact_flow.reconnection || '재접점 근거가 약해.'}</p></article></div>}
    {data.investment_reading && (data.investment_reading.psychology || data.investment_reading.realization || data.investment_reading.entry || data.investment_reading.risk) && <div className="ai-investment-grid"><article><strong>투자심리</strong><p>{data.investment_reading.psychology}</p></article><article><strong>수익실현</strong><p>{data.investment_reading.realization}</p></article><article><strong>신규진입</strong><p>{data.investment_reading.entry}</p></article><article className="is-risk"><strong>투자주의 · 높을수록 경계</strong><p>{data.investment_reading.risk}</p></article></div>}
    {!!data.priorities?.length && <div className="ai-priorities"><strong>이 기간 우선순위</strong>{data.priorities.map((item, index)=><p key={`${index}-${item}`}>{index+1}. {item}</p>)}</div>}
    <details className="ai-details" open><summary>분야별 정밀 해석</summary><div className="ai-topic-list">{topicOrder.map((topic)=>{
      const item=data.topic_analysis?.[topic]
      if(!item) return null
      return <article key={topic}><div className="ai-topic-title"><strong>{topic}</strong><span>{item.confidence}</span></div><p className="ai-verdict">{item.verdict}</p>{item.reason&&<p><b>근거</b> {item.reason}</p>}{item.timing&&<p><b>시기</b> {item.timing}</p>}{item.action&&<p><b>행동</b> {item.action}</p>}{item.avoid&&<p><b>주의</b> {item.avoid}</p>}</article>
    })}</div></details>
    <details className="ai-system-note"><summary>체계별 계산 근거</summary>{data.systems.western&&<p><b>Western(서양점성술)</b> {data.systems.western}</p>}{data.systems.saju&&<p><b>사주</b> {data.systems.saju}</p>}{data.systems.thai&&<p><b>Thai(태국점성술)</b> {data.systems.thai}</p>}</details>
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

const planetLabels: Record<string, string> = {
  Sun:'태양', Moon:'달', Mercury:'수성', Venus:'금성', Mars:'화성', Jupiter:'목성', Saturn:'토성',
  Uranus:'천왕성', Neptune:'해왕성', Pluto:'명왕성', 'True Node':'진북교점', ASC:'상승점', DSC:'하강점', MC:'중천점', IC:'천저점',
}
const aspectLabels: Record<string, string> = {
  conjunction:'합', sextile:'육합', square:'사각', trine:'삼각', quincunx:'퀸컨스', opposition:'대립',
}

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
const coreTopicOrder = ['금전','학업','시험','직장','이직','대인관계','연애','재회','소식','컨디션']
const marketTopicOrder = ['투자심리','수익실현','신규진입','투자주의']
const topicOrder = [...coreTopicOrder, ...marketTopicOrder]
const topicEmoji: Record<string,string> = {금전:'💰',학업:'📚',시험:'✍️',직장:'💼',이직:'🧭',대인관계:'🤝',연애:'💗',재회:'🪐',소식:'💌',컨디션:'🌿',투자심리:'📈',수익실현:'💵',신규진입:'🚪',투자주의:'⚠️'}
const topicDisplay = (topic:string) => `${topicEmoji[topic] ?? '✦'} ${topic}`
const relationshipDayPresets = [7,31,90,180,365]
const relationshipSignalOrder = ['수신신호','발신적합','과거인연접점']
const relationshipTimeSensitivePoints = new Set(['Moon','ASC','DSC','MC','IC'])

function hasPair(aspect: Aspect, a: string, b: string) {
  return (aspect.a === a && aspect.b === b) || (aspect.a === b && aspect.b === a)
}
function relationshipAspectMeaning(aspect: Aspect) {
  const tense = aspect.tone === 'challenging'
  const supportive = aspect.tone === 'supportive'
  if (hasPair(aspect,'Mercury','Mars')) return tense ? '말의 속도와 반응성이 빨라져 논쟁·반박이 쉽게 붙는 접점이야. 누가 맞는지보다 말의 강도를 조절하는 게 핵심이야.' : '생각을 행동으로 옮기는 속도가 잘 맞기 쉬워. 대화를 실제 움직임으로 연결하는 힘이 있어.'
  if (hasPair(aspect,'Mercury','Uranus')) return tense ? '대화가 갑자기 튀거나 예상 밖의 말로 흐름이 끊길 수 있어. 신선함은 크지만 안정적인 소통 규칙이 필요해.' : '서로의 생각을 깨우는 자극이 강해. 새로운 관점과 아이디어가 잘 살아나는 접점이야.'
  if (hasPair(aspect,'Mars','Pluto')) return '추진력과 힘겨루기가 동시에 커질 수 있는 강한 접점이야. 경계·통제·주도권을 어떻게 다루는지가 중요해.'
  if ((aspect.a === 'Neptune' || aspect.b === 'Neptune') && ['ASC','DSC'].some((x)=>aspect.a===x||aspect.b===x)) return tense ? '상대를 보는 이미지와 실제 관계 방식 사이에 흐림이나 이상화가 생기기 쉬워. 추측보다 확인이 중요해.' : '분위기·공감은 잘 생길 수 있지만 현실 확인을 같이 해야 안정적으로 쓰여.'
  if ((aspect.a === 'Sun' || aspect.b === 'Sun') && ['MC','IC'].some((x)=>aspect.a===x||aspect.b===x)) return supportive ? '한 사람의 핵심 방향성이 다른 사람의 진로·생활축과 자연스럽게 연결되는 접점이야.' : '개인의 방향성과 생활·진로축이 부딪힐 수 있어. 관계와 각자의 목표를 분리해 조율해야 해.'
  if (hasPair(aspect,'Venus','Mars')) return supportive ? '호감 표현 방식과 추진력이 자연스럽게 맞물리는 전형적인 끌림 접점이야. 다만 이것만으로 관계 지속이나 재회를 뜻하진 않아.' : '끌림은 강할 수 있지만 원하는 속도나 표현 방식 차이로 마찰도 같이 생길 수 있어.'
  if (aspect.a === 'Saturn' || aspect.b === 'Saturn') return tense ? '책임·거리·기준이 무겁게 느껴질 수 있어. 오래 가려면 의무감보다 합의된 규칙이 필요해.' : '관계에 구조와 지속성을 더해주는 접점이야. 꾸준함과 현실적인 약속으로 쓸 때 힘이 생겨.'
  if (aspect.a === 'Jupiter' || aspect.b === 'Jupiter') return supportive ? '서로의 시야를 넓히고 격려하는 방향으로 쓰이기 쉬워.' : '기대나 낙관이 과해질 수 있어. 실제 상황보다 크게 해석하지 않는 게 중요해.'
  if (aspect.a === 'True Node' || aspect.b === 'True Node') return '익숙함이나 의미 부여가 강해질 수 있지만 운명·재회 확정의 증거는 아니야. 반복 패턴을 살피는 근거로 보는 게 맞아.'
  return supportive ? '이 기능은 비교적 자연스럽게 연결되는 조화 접점이야. 관계 전체가 좋다는 뜻은 아니야.' : tense ? '자극과 마찰이 반복되기 쉬운 긴장 접점이야. 나쁘다는 뜻보다 조율이 필요한 힘이 강하다는 의미야.' : '강한 결합이나 혼합 효과가 나타나는 접점이야. 상황에 따라 협력과 부담이 함께 나타날 수 있어.'
}
function relationshipLimitKo(text: string) {
  if (text.includes('Partner exact birth time/place missing')) return '상대의 정확한 출생시간·장소가 없어 데이비슨·마크스·마크스 3차 진행은 추정하지 않고 제외했어.'
  if (text.includes('Exact partner birth time')) return '상대의 정확한 출생시간이 없어 해당 정밀 진행 레이어는 계산하지 않았어.'
  return text
}
function RelationshipInterpretationPanel({ aspects, partnerExact, ai, aiLoading, aiError, onAi, analysisMode }: { aspects: Aspect[]; partnerExact: boolean; ai: RelationshipAiResponse | null; aiLoading: boolean; aiError: string; onAi: () => void; analysisMode: RelationshipAnalysisMode }) {
  const interpretableAspects = partnerExact ? aspects : aspects.filter((a)=>!relationshipTimeSensitivePoints.has(a.a) && !relationshipTimeSensitivePoints.has(a.b))
  const supportive = interpretableAspects.filter((a)=>a.tone==='supportive').length
  const challenging = interpretableAspects.filter((a)=>a.tone==='challenging').length
  const mixed = interpretableAspects.filter((a)=>a.tone==='mixed').length
  const isReunion = analysisMode === 'reunion'
  const isMarriage = analysisMode.startsWith('marriage_')
  const tight = [...interpretableAspects].sort((a,b)=>a.orb-b.orb).slice(0,4)
  const communication = interpretableAspects.filter((a)=>a.a==='Mercury'||a.b==='Mercury')
  const chemistry = interpretableAspects.filter((a)=>['Venus','Mars','Pluto'].includes(a.a)||['Venus','Mars','Pluto'].includes(a.b))
  const structure = interpretableAspects.filter((a)=>['Saturn','Jupiter','True Node'].includes(a.a)||['Saturn','Jupiter','True Node'].includes(a.b))
  const topAspect = tight[0]
  const headline = topAspect ? `${aspectText(topAspect)}이 가장 강하게 걸리는 관계` : '확정 가능한 핵심 접점이 적은 관계 구조'
  const overview = tight.length ? tight.slice(0,3).map((aspect,index)=>`${index+1}순위 ${aspectText(aspect)}(오브 ${aspect.orb.toFixed(2)}°): ${relationshipAspectMeaning(aspect)}`).join(' ') : '현재 입력으로 확정 가능한 주요 접점이 적어서 관계 전체를 강하게 단정하기 어려워.'
  const communicationTight = [...communication].sort((a,b)=>a.orb-b.orb).slice(0,2)
  const chemistryTight = [...chemistry].sort((a,b)=>a.orb-b.orb).slice(0,2)
  const structureTight = [...structure].sort((a,b)=>a.orb-b.orb).slice(0,2)
  const communicationText = communicationTight.length ? communicationTight.map((aspect)=>`${aspectText(aspect)}(오브 ${aspect.orb.toFixed(2)}°) — ${relationshipAspectMeaning(aspect)}`).join(' ') : 'Mercury(수성) 관련 확정 접점이 상위권에 적어서 소통 패턴은 현재 차트만으로 강하게 말하지 않을게.'
  const chemistryText = chemistryTight.length ? chemistryTight.map((aspect)=>`${aspectText(aspect)}(오브 ${aspect.orb.toFixed(2)}°) — ${relationshipAspectMeaning(aspect)}`).join(' ') : 'Venus(금성)·Mars(화성)·Pluto(명왕성) 관련 확정 접점이 상위권에 적어서 끌림 하나로 관계를 설명하진 않을게.'
  const stabilityText = structureTight.length ? structureTight.map((aspect)=>`${aspectText(aspect)}(오브 ${aspect.orb.toFixed(2)}°) — ${relationshipAspectMeaning(aspect)}`).join(' ') : 'Saturn(토성)·Jupiter(목성)·교점 관련 확정 접점이 상위권에 적어서 장기 지속성은 현재 계산만으로 강하게 단정하기 어려워.'
  const timing = partnerExact ? '두 사람의 정확한 출생시간과 위치가 있어 진행 궁합차트·Davison(데이비슨)·Marks(마크스) 시기층까지 계산할 수 있어.' : '상대 출생시간이 없어서 Moon(달)·ASC(상승점)·DSC(하강점)·MC(중천점)·IC(천저점)처럼 시간에 민감한 요소와 정밀 진행 시기층은 제외했어. 대신 출생시간 없이 확정 가능한 행성 간 접점만 해석해.'
  return <>
    <section className="relationship-reading-card">
      <span className="eyebrow">관계 구조 해설</span><h3>{headline}</h3>
      <p className="relationship-overview">{overview}</p>
      <div className="relationship-reading-grid"><article><strong>대화 · 소통</strong><p>{communicationText}</p></article><article><strong>끌림 · 자극</strong><p>{chemistryText}</p></article><article><strong>지속성 · 성장</strong><p>{stabilityText}</p></article><article><strong>타이밍 정밀도</strong><p>{timing}</p></article></div>
      <div className="relationship-key-aspects"><strong>가장 강한 접점</strong>{tight.slice(0,3).map((aspect,index)=><div key={`${aspect.a}-${aspect.aspect}-${aspect.b}-${index}`}><b>{aspectText(aspect)} · 오브 {aspect.orb.toFixed(2)}°</b><p>{relationshipAspectMeaning(aspect)}</p></div>)}</div>
    </section>
    <div className="relationship-ai-toolbar"><button type="button" onClick={onAi} disabled={aiLoading}><Sparkles size={17}/><span>{aiLoading?'Gemini(제미나이) 관계 해석 중…':'Gemini(제미나이) 관계 정밀해석'}</span></button><small>원할 때만 AI 호출 · 완료 후 토큰/예상비용 표시</small></div>
    {aiError && <div className="status-banner error"><AlertTriangle size={16}/><span>{aiError}</span></div>}
    {ai?.ok && ai.data && <section className="relationship-ai-card"><span className="eyebrow">Gemini(제미나이) 관계 해설</span><h3>{ai.data.headline}</h3>{ai.usage?.total_tokens?<details className="ai-meta-details relationship-meta-details"><summary>해설 생성 정보</summary><div className="relationship-ai-usage"><span>입력 {(ai.usage.prompt_tokens??0).toLocaleString()} · 출력 {(ai.usage.candidate_tokens??0).toLocaleString()} · 사고 {(ai.usage.thought_tokens??0).toLocaleString()} token(토큰)</span><b>예상비용 ${Number(ai.usage.estimated_usd??0).toFixed(4)} ≈ {Math.round(ai.usage.estimated_krw??0).toLocaleString()}원</b></div></details>:null}<p className="relationship-ai-overview">{ai.data.overview}</p><div className="relationship-ai-grid"><article><strong>끌림 · 호감</strong><p>{ai.data.chemistry}</p></article>{ai.data.emotional_dynamic&&<article><strong>정서적 친화 · 거리감</strong><p>{ai.data.emotional_dynamic}</p></article>}<article><strong>대화 · 오해</strong><p>{ai.data.communication}</p></article>{ai.data.conflict_pattern&&<article><strong>갈등이 붙는 지점</strong><p>{ai.data.conflict_pattern}</p></article>}{ai.data.power_boundaries&&<article><strong>힘의 균형 · 경계</strong><p>{ai.data.power_boundaries}</p></article>}{ai.data.long_term&&<article><strong>장기 지속성</strong><p>{ai.data.long_term}</p></article>}{!ai.data.long_term&&ai.data.stability&&<article><strong>장기 지속성</strong><p>{ai.data.stability}</p></article>}<article><strong>시기 · 정밀도</strong><p>{ai.data.timing}</p></article>{isReunion&&ai.data.reunion_context&&<article><strong>재회 맥락</strong><p>{ai.data.reunion_context}</p></article>}</div>{!!ai.data.felt_scenarios?.length&&<div className="relationship-ai-scenarios"><strong>실제로는 이렇게 체감되기 쉬워</strong>{ai.data.felt_scenarios.map((x,i)=><p key={`${i}-${x}`}><span>{i+1}</span>{x}</p>)}</div>}{isReunion&&ai.data.reunion_reading?.bottom_line&&<div className="reunion-ai-deep"><strong>재회운 정밀 해석</strong><p className="reunion-ai-bottom">{ai.data.reunion_reading.bottom_line}</p><div className="reunion-ai-grid"><article><b>상대 → 나 · 수신</b><p>{ai.data.reunion_reading.incoming_contact}</p></article><article><b>나 → 상대 · 발신</b><p>{ai.data.reunion_reading.outgoing_contact}</p></article><article><b>재접점 강한 시기</b><p>{ai.data.reunion_reading.reconnection_windows}</p></article><article><b>약한 시기</b><p>{ai.data.reunion_reading.low_windows}</p></article><article><b>이 인연의 반복 패턴</b><p>{ai.data.reunion_reading.relationship_filter}</p></article><article><b>정밀도</b><p>{ai.data.reunion_reading.precision_note}</p></article></div></div>}{isMarriage&&ai.data.marriage_reading?.bottom_line&&<div className="marriage-ai-deep"><strong>{analysisMode==='marriage_unmarried'?'미혼 결혼운 · 정밀 해석':'기혼 결혼운 · 정밀 해석'}</strong><p className="marriage-ai-bottom">{ai.data.marriage_reading.bottom_line}</p><div className="marriage-ai-grid"><article><b>장기 결속력</b><p>{ai.data.marriage_reading.bond}</p></article><article><b>정서적 집</b><p>{ai.data.marriage_reading.emotional_home}</p></article><article><b>생활 · 돈 · 역할</b><p>{ai.data.marriage_reading.daily_life}</p></article><article><b>갈등과 회복</b><p>{ai.data.marriage_reading.conflict_repair}</p></article><article><b>{analysisMode==='marriage_unmarried'?'결혼 결정 흐름':'현재 결혼생활 주기'}</b><p>{ai.data.marriage_reading.commitment_or_current_cycle}</p></article><article><b>시기 흐름</b><p>{ai.data.marriage_reading.timing}</p></article><article><b>장기 주의점</b><p>{ai.data.marriage_reading.caution}</p></article><article><b>정밀도</b><p>{ai.data.marriage_reading.precision_note}</p></article></div></div>}{!!ai.data.practical_advice?.length&&<div className="relationship-ai-advice"><strong>이 관계를 다룰 때</strong>{ai.data.practical_advice.map((x,i)=><p key={`${i}-${x}`}>{i+1}. {x}</p>)}</div>}{!!ai.data.top_aspects?.length&&<details open><summary>왜 이런 관계로 느껴지는지 · 핵심 접점</summary>{ai.data.top_aspects.map((x,i)=><div className="relationship-ai-aspect" key={`${i}-${x.label}`}><b>{x.label}</b><p>{x.meaning}</p></div>)}</details>}{ai.data.limits&&<p className="relationship-ai-limits">{ai.data.limits}</p>}</section>}
  </>
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

function reunionScoreBand(score: number) {
  if (score >= 70) return '강함'
  if (score >= 55) return '상승'
  if (score >= 40) return '보통'
  if (score >= 25) return '약함'
  return '매우 약함'
}

function ReunionTimingPanel({ context, loading, error }: { context: ReunionTimingContext | null; loading: boolean; error: string }) {
  if (loading) return <section className="result-card reunion-timing-card"><div className="result-card-title"><span>REUNION TIMING</span><strong>재회·연락 시기 계산 중</strong></div><div className="status-banner subtle"><LoaderCircle className="spin" size={16}/><span>수신·발신·과거인연 재접점 흐름을 같은 기간에서 따로 계산하고 있어.</span></div></section>
  if (error) return <section className="result-card reunion-timing-card"><div className="result-card-title"><span>REUNION TIMING</span><strong>재회 시기 계산 오류</strong></div><div className="status-banner error"><AlertTriangle size={16}/><span>{error}</span></div></section>
  if (!context) return null
  const rows = [
    { key: 'incoming', title: '상대 → 나 · 수신 신호', desc: '상대 쪽에서 연락·소식이 들어오는 흐름', stat: context.incoming },
    { key: 'outgoing', title: '나 → 상대 · 발신 적합도', desc: '내가 먼저 연락했을 때 흐름이 받쳐주는 정도', stat: context.outgoing },
    { key: 'reconnection', title: '과거인연 · 재접점', desc: '끊겼던 관계가 다시 활성화되는 흐름', stat: context.reconnection },
  ] as const
  const monthRank = [...context.months]
    .filter((m) => m.reconnection || m.incoming || m.outgoing)
    .map((m) => ({
      ...m,
      score: ((m.reconnection?.average ?? 0) * .5) + ((m.incoming?.average ?? 0) * .35) + ((m.outgoing?.average ?? 0) * .15),
    }))
    .sort((a,b) => b.score-a.score)
    .slice(0, 4)
  return <section className="result-card reunion-timing-card">
    <div className="result-card-title"><span>REUNION TIMING</span><strong>재회운 · 연락 방향과 시기</strong></div>
    <p className="result-note">0~100 값은 실제 연락 확률 %가 아니라 점성 계산의 상대 활성도 지수야. 수신과 발신을 섞지 않고 따로 봐.</p>
    <div className="reunion-signal-grid">{rows.map(({key,title,desc,stat}) => <article key={key}><div><strong>{title}</strong><small>{desc}</small></div><b>{stat ? stat.average.toFixed(1) : '—'}</b><span>{stat ? reunionScoreBand(stat.average) : '계산 없음'}</span>{stat?.best_days?.length ? <div className="reunion-window-list"><em>강한 시기</em>{stat.best_days.slice(0,3).map((point)=><p key={`${key}-${point.date}`}><strong>{point.date}</strong><span>{point.label}</span><b>{point.score.toFixed(1)}</b></p>)}</div> : null}{stat?.caution_days?.length ? <div className="reunion-window-list is-low"><em>약한 시기</em>{stat.caution_days.slice(0,2).map((point)=><p key={`${key}-low-${point.date}`}><strong>{point.date}</strong><span>{point.label}</span><b>{point.score.toFixed(1)}</b></p>)}</div> : null}</article>)}</div>
    {monthRank.length>1 && <div className="reunion-month-rank"><strong>재접점 종합 활성도가 높은 월</strong><small>과거인연 50% · 수신 35% · 발신 15%로 화면 정렬만 한 참고지수야.</small>{monthRank.map((m,index)=><p key={m.calendar_month}><span>{index+1}. {m.calendar_month}</span><b>{m.score.toFixed(1)}</b></p>)}</div>}
  </section>
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

function integratedPromptText(request: Record<string, unknown>, calculation?: IntegratedApiResponse | null) {
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
    '',
    '[외부 AI 해석 지시]',
    '- 아래 CALCULATED_DATA는 별빛의 운명 계산엔진이 이미 산출한 값이다. 행성 위치·하우스·점수·사주를 다시 계산하거나 임의 수정하지 말고 이 값만 근거로 해석한다.',
    '- 데이터에 없는 점성술/사주 요소, 사건 확률, 상대의 속마음은 만들지 않는다.',
    '- 전문용어는 한국어 뜻을 붙이고, 결론→계산 근거→현실에서 체감되는 방식→시기 순서로 설명한다.',
    '',
    '[CALCULATED_DATA · 원본 계산 JSON]',
    calculation ? JSON.stringify(calculation, null, 2) : '계산 결과 없음',
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

function relationshipPromptText(kind: 'compatibility' | 'marriage', request: Record<string, unknown>, calculation?: RelationshipApiResponse | null) {
  const user = (request.user ?? {}) as Record<string, unknown>
  const cp = (request.counterpart ?? {}) as Record<string, unknown>
  return [
    `[별빛의 운명 · ${kind === 'marriage' ? '결혼운' : '궁합운'} 분석 요청]`,
    `관계 상태: ${String(request.relationship_status ?? '')}`,
    `분석 모드: ${String(request.analysis_mode ?? kind)}`,
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
    '',
    '[외부 AI 해석 지시]',
    '- 아래 CALCULATED_DATA는 별빛의 운명 계산엔진이 이미 산출한 관계 계산값이다. 다른 천문력/사주 계산으로 덮어쓰지 말고 이 데이터를 해석의 단일 근거로 사용한다.',
    '- 오브가 좁은 실제 접점을 우선하고, 접점 수나 점수를 재회·결혼·연락 확률로 바꾸지 않는다.',
    '- 생시 미상으로 빠진 Moon(달)·각도점·하우스·진행 레이어는 추정하지 않는다.',
    '- 사주는 CALCULATED_DATA에 실제 포함된 일간 관계·십성·배우자궁·교차 지지관계만 사용하고, 없는 천간합·신강/신약·용신·배우자성 등을 만들지 않는다.',
    '- 결론→계산 근거→관계에서 실제 체감되는 패턴→시기 순서로 구체적으로 설명한다.',
    '',
    '[CALCULATED_DATA · 원본 관계 계산 JSON]',
    calculation ? JSON.stringify(calculation, null, 2) : '계산 결과 없음',
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

function precisionPromptText(request: Record<string, unknown>, calculation?: IntegratedApiResponse | null) {
  return integratedPromptText(request, calculation)
    .replace('[별빛의 운명 · 통합운세 분석 요청]', '[별빛의 운명 · 정밀분석 요청]')
    .concat('\n\n[정밀분석 표시 원칙]\n- 요약 점수를 새로 만들지 않고 동일 실계산의 원자료를 더 자세히 펼쳐본다.\n- 엔진이 계산하지 않은 항목은 추정하지 않는다.')
}

function precisionResultText(result: IntegratedApiResponse) {
  return integratedResultText(result)
    .replace('[별빛의 운명 · 통합운세 전체 결과]', '[별빛의 운명 · 정밀분석 전체 결과]')
}


function ReunionTransitPanel({ result }: { result: RelationshipApiResponse | null }) {
  const data = result?.result?.reunion_transits
  if (!data?.available || !data.top_days?.length) return null
  const aspectKo: Record<string,string> = {conjunction:'합',sextile:'육십분위',square:'사각',trine:'삼각',quincunx:'퀸컨스·150도',opposition:'대립'}
  const pointKo: Record<string,string> = {Sun:'태양',Moon:'달',Mercury:'수성',Venus:'금성',Mars:'화성',Jupiter:'목성',Saturn:'토성',Uranus:'천왕성',Neptune:'해왕성',Pluto:'명왕성','True Node':'북교점',ASC:'상승점',DSC:'하강점',MC:'중천점',IC:'천저점'}
  const hitText = (hit:any) => `${pointKo[hit.transit]||hit.transit} → ${hit.person==='counterpart'?'상대':'나'} ${pointKo[hit.target]||hit.target} ${aspectKo[hit.aspect]||hit.aspect} · 오브 ${Number(hit.orb).toFixed(2)}°`
  return <section className="result-card reunion-transit-panel">
    <div className="result-card-title"><span>실제 트랜짓</span><strong>두 사람 차트를 직접 건드리는 날짜</strong></div>
    <p className="result-note">단순 재회 점수가 아니라, 선택 기간 안에서 현재 행성이 너와 상대의 출생차트 핵심점을 실제로 건드리는 날짜를 별도로 계산했어. 사건 확률은 아니야.</p>
    <div className="reunion-transit-list">{data.top_days.slice(0,8).map((day,index)=><article className="reunion-transit-day" key={day.date}><header><strong>{index+1}. {day.date}</strong><b>{day.score.toFixed(1)}</b></header><p>{day.hits.slice(0,3).map(hitText).join(' · ')}</p></article>)}</div>
  </section>
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
  const [integratedLoading, setIntegratedLoading] = useState(false)
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
      const { data, error } = await supabase.functions.invoke('fortune-interpret-v5-preview', { body: { action: 'meta' } })
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
  const integratedStartDate = integratedCalendarYear ? `${integratedCalendarYear}-01-01` : queryDate
  const integratedSelectionEnd = integratedCalendarYear ? `${integratedCalendarYear}-12-31` : periodEnd(queryDate, period)
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

  const pollAiInterpretationJob = async (jobId: string, periodStart?: string, periodEndValue?: string) => {
    if (!jobId || aiPollRef.current === jobId) return
    aiPollRef.current = jobId
    setAiLoading(true); setAiError('')
    try {
      await ensureSupabaseSession()
      for (let attempt = 0; attempt < 180; attempt++) {
        if (document.visibilityState === 'hidden') return
        const { data, error } = await supabase.functions.invoke('fortune-interpret-v5-preview', {
          body: { action: 'status', job_id: jobId },
        })
        if (error) throw error
        if (data?.status === 'done') {
          const payload: AiInterpretationResponse = {
            ok: true,
            model: data.model,
            fallback_from: data.fallback_from,
            interpreter_version: 'supabase-ai-v2-background-jobs',
            usage: data.usage ?? undefined,
            data: data.data ?? undefined,
          }
          if (!payload.data) throw new Error('완료된 AI 해설 결과가 비어 있어.')
          const currentEnd = periodEnd(queryDate, period)
          if (!periodStart || (queryDate === periodStart && currentEnd === periodEndValue)) {
            setAiInterpretation(annotatePayload(payload))
          }
          window.localStorage.removeItem(AI_JOB_STORAGE_KEY)
          setAiConfigured(true)
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
      const saved = JSON.parse(raw) as { jobId?: string; periodStart?: string; periodEnd?: string }
      if (saved.jobId) void pollAiInterpretationJob(saved.jobId, saved.periodStart, saved.periodEnd)
    } catch {
      window.localStorage.removeItem(AI_JOB_STORAGE_KEY)
      setAiLoading(false)
    }
  }

  const runAiInterpretation = async (calculation: IntegratedApiResponse | null = integratedResult) => {
    if (!calculation) return
    setAiLoading(true); setAiError(''); setAiInterpretation(null)
    try {
      await ensureSupabaseSession()
      const { data, error } = await supabase.functions.invoke('fortune-interpret-v5-preview', {
        body: { action: 'start', calculation, model: aiModel },
      })
      if (error) throw error
      if (!data?.ok || !data?.job_id) {
        if (data?.missing_key) setAiConfigured(false)
        throw new Error(data?.error || 'AI 해설 서버 작업을 시작하지 못했어.')
      }
      const pending = { jobId: String(data.job_id), periodStart: calculation.period.start, periodEnd: calculation.period.end }
      window.localStorage.setItem(AI_JOB_STORAGE_KEY, JSON.stringify(pending))
      setAiConfigured(true)
      void pollAiInterpretationJob(pending.jobId, pending.periodStart, pending.periodEnd)
    } catch (error) {
      window.localStorage.removeItem(AI_JOB_STORAGE_KEY)
      setAiLoading(false)
      const message = error instanceof Error ? error.message : 'AI 해설 요청에 실패했어.'
      setAiError(message.includes('non-2xx') ? 'Supabase AI 해설 서버에서 오류가 발생했어. 설정의 Gemini 연결 상태를 확인해줘.' : message)
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
      start_date: integratedStartDate,
      end_date: integratedSelectionEnd,
    }
    setIntegratedLoading(true)
    try {
      const startResponse = await fetch(`${API_BASE}/v1/fortune/integrated/start`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body),
      })
      const started = await startResponse.json()
      if (!startResponse.ok || !started?.job_id) throw new Error(started?.detail || started?.error || '통합운세 계산 작업을 시작하지 못했어.')
      let calculation: IntegratedApiResponse | null = null
      for (let attempt=0; attempt<120; attempt++) {
        await new Promise((resolve)=>window.setTimeout(resolve, 2000))
        const pollResponse = await fetch(`${API_BASE}/v1/fortune/integrated/jobs/${encodeURIComponent(started.job_id)}`)
        const job = await pollResponse.json()
        if (!pollResponse.ok) throw new Error(job?.detail || '통합운세 계산 상태를 확인하지 못했어.')
        if (job.status === 'failed') throw new Error(job.error || '통합운세 계산 작업이 실패했어.')
        if (job.status === 'done') { calculation = job.result as IntegratedApiResponse; break }
      }
      if (!calculation) throw new Error('정밀 계산 시간이 길어지고 있어. 다시 시도해줘.')
      setIntegratedResult(calculation)
      setIntegratedRequestSnapshot(body)
      void runAiInterpretation(calculation)
    } catch (error) {
      setIntegratedError(error instanceof Error ? error.message : '통합운세 계산 중 오류가 발생했어.')
    } finally { setIntegratedLoading(false) }
  }

  const runReunionTiming = async (): Promise<ReunionTimingContext | null> => {
    setReunionTimingLoading(true); setReunionTimingError('')
    try {
      const end = relationshipEndDate
      if (integratedResult && integratedResult.period.start === queryDate && integratedResult.period.end === end) {
        const cached = buildReunionTimingContext(integratedResult)
        setReunionTiming(cached)
        return cached
      }
      const latitude = parseOptionalNumber(birthProfile.latitude)
      const longitude = parseOptionalNumber(birthProfile.longitude)
      if (latitude === null || longitude === null) throw new Error('내 출생지역 좌표가 필요해.')
      const body = {
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
        start_date: relationshipStartDate,
        end_date: end,
      }
      const startResponse = await fetch(`${API_BASE}/v1/fortune/integrated/start`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })
      const started = await startResponse.json()
      if (!startResponse.ok || !started?.job_id) throw new Error(started?.detail || started?.error || '재회 시기 계산을 시작하지 못했어.')
      let calculation: IntegratedApiResponse | null = null
      for (let attempt=0; attempt<120; attempt++) {
        await new Promise((resolve)=>window.setTimeout(resolve, 2000))
        const pollResponse = await fetch(`${API_BASE}/v1/fortune/integrated/jobs/${encodeURIComponent(started.job_id)}`)
        const job = await pollResponse.json()
        if (!pollResponse.ok) throw new Error(job?.detail || '재회 시기 계산 상태를 확인하지 못했어.')
        if (job.status === 'failed') throw new Error(job.error || '재회 시기 계산이 실패했어.')
        if (job.status === 'done') { calculation = job.result as IntegratedApiResponse; break }
      }
      if (!calculation) throw new Error('재회 시기 계산 시간이 길어지고 있어. 다시 시도해줘.')
      const context = buildReunionTimingContext(calculation)
      setReunionTiming(context)
      return context
    } catch (error) {
      const message = error instanceof Error ? error.message : '재회 시기 계산 중 오류가 발생했어.'
      setReunionTimingError(message)
      return null
    } finally { setReunionTimingLoading(false) }
  }

  const runRelationship = async () => {
    setRelationshipError(''); setRelationshipResult(null); setRelationshipRequestSnapshot(null); setRelationshipAi(null); setRelationshipAiError(''); setReunionTiming(null); setReunionTimingError('')
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
      start_date: relationshipStartDate, end_date: relationshipEndDate,
      relationship_status: selectedTool === 'marriage' ? (marriageMode === 'married' ? 'married' : 'dating') : (relationshipPurpose === 'reunion' ? 'single' : relationshipMode),
      analysis_mode: selectedTool === 'marriage' ? `marriage_${marriageMode}` : relationshipPurpose,
    }
    setRelationshipLoading(true)
    try {
      const response = await fetch(`${API_BASE}/v1/relationship/western`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })
      const payload = await response.json()
      if (!response.ok) throw new Error(typeof payload?.detail === 'string' ? payload.detail : '관계 계산 요청에 실패했어.')
      setRelationshipResult(payload as RelationshipApiResponse)
      setRelationshipRequestSnapshot(body as Record<string, unknown>)
      if (selectedTool === 'compatibility' && relationshipPurpose === 'reunion') await runReunionTiming()
    } catch (error) {
      setRelationshipError(error instanceof Error ? error.message : '관계 계산 중 오류가 발생했어.')
    } finally { setRelationshipLoading(false) }
  }


  const runRelationshipAi = async () => {
    if (!relationshipResult) return
    const analysisMode: RelationshipAnalysisMode = selectedTool === 'marriage' ? `marriage_${marriageMode}` : relationshipPurpose
    if (analysisMode === 'reunion' && !reunionTiming) { setRelationshipAiError('재회 시기 계산이 먼저 완료되어야 해.'); return }
    setRelationshipAiLoading(true); setRelationshipAiError('')
    try {
      await ensureSupabaseSession()
      const { data, error } = await supabase.functions.invoke('relationship-interpret-v9-preview', { body: { calculation: relationshipResult, reunion_context: reunionTiming, purpose: analysisMode, model: aiModel } })
      if (error) throw error
      const payload = data as RelationshipAiResponse
      if (!payload?.ok || !payload.data) throw new Error(payload?.error || '관계 AI 해설 응답이 비어 있어.')
      setRelationshipAi(annotatePayload(payload))
    } catch (error) {
      setRelationshipAiError(error instanceof Error ? error.message : '관계 AI 해설을 불러오지 못했어.')
    } finally { setRelationshipAiLoading(false) }
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
    const label = periods.find((item) => item.key === period)?.label ?? period
    try {
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
    setActionNotice('기록 저장 완료'); window.setTimeout(()=>setActionNotice(''),2200)
    if (mainView === 'history') await refreshArchive()
    } catch (error) { setArchiveStatus(error instanceof Error ? error.message : '기록 저장 실패') } finally { setArchiveSaving(false) }
  }

  async function savePrecisionRecord() {
    if (!integratedResult || !integratedRequestSnapshot || archiveSaving) return
    setArchiveSaving(true); setArchiveStatus('정밀분석 기록 저장 중…')
    try {
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
    setActionNotice('정밀분석 기록 저장 완료'); window.setTimeout(()=>setActionNotice(''),2200)
    } catch (error) { setArchiveStatus(error instanceof Error ? error.message : '정밀분석 기록 저장 실패') } finally { setArchiveSaving(false) }
  }

  async function saveRelationshipRecord() {
    if (!relationshipResult || !relationshipRequestSnapshot || archiveSaving) return
    setArchiveSaving(true); setArchiveStatus('관계 분석 기록 저장 중…')
    const kind = selectedTool === 'marriage' ? 'marriage' : 'compatibility'
    const cp = (relationshipRequestSnapshot.counterpart ?? {}) as Record<string, unknown>
    try {
    const saved = await saveArchive({
      kind,
      periodKey: relationshipPeriodKey,
      title: `${kind === 'marriage' ? '결혼운' : '궁합운'} · ${String(cp.name ?? '상대')} · ${relationshipResult.period.start}`,
      periodStart: relationshipResult.period.start,
      periodEnd: relationshipResult.period.end,
      engine: relationshipResult.engine,
      request: relationshipRequestSnapshot,
      result: relationshipResult as unknown as Record<string, unknown>,
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
      const restoredDays = Math.max(7, Math.min(365, Math.round((new Date(`${item.periodEnd}T12:00:00Z`).getTime()-new Date(`${item.periodStart}T12:00:00Z`).getTime())/86400000)+1))
      setRelationshipDays(restoredDays)
      setRelationshipMode((request.relationship_status as RelationshipStatus) || 'dating')
      if (request.analysis_mode === 'marriage_married') setMarriageMode('married')
      else if (request.analysis_mode === 'marriage_unmarried') setMarriageMode('unmarried')
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
          {(selectedTool==='integrated'||selectedTool==='precision') && <section className="section-block"><div className="section-label">통합운세 기간 선택</div><div className="period-grid">{periods.map(({key,label,icon:Icon})=><button key={key} className={`period-button ${!integratedCalendarYear&&period===key?'is-active':''}`} type="button" onClick={()=>{setPeriod(key);setIntegratedCalendarYear(null)}}><Icon size={17}/><span>{label}</span></button>)}</div><div className="calendar-year-selector"><div><strong>연도 전체</strong><span>1월 1일 ~ 12월 31일</span></div><select aria-label="통합운세 달력 연도 선택" value={integratedCalendarYear??''} onChange={(e)=>setIntegratedCalendarYear(e.target.value?Number(e.target.value):null)}><option value="">선택 안 함</option>{calendarYearOptions.map((year)=><option key={year} value={year}>{year}년</option>)}</select></div></section>}
          <section className="section-block tools-section"><div className="section-heading-row"><div className="section-label">분석 도구</div><span className={`server-pill ${apiStatus}`}>{apiLabel}</span></div><div className="tool-grid">{tools.map(({key,label,desc,icon:Icon,tone})=><button key={key} className={`tool-card ${selectedTool===key?'is-selected':''}`} type="button" onClick={()=>{setSelectedTool(key); if(key==='compatibility'||key==='marriage'){setRelationshipDays(365);setRelationshipCalendarYear(null);} if(key==='location'){setLocationError('');setLocationResult(null)}}}><span className={`tool-icon tone-${tone}`}><Icon size={24}/></span><strong>{label}</strong><span>{desc}</span></button>)}</div></section>

          {selectedTool === 'integrated' && <section className="tool-panel integrated-panel">
            <div className="tool-panel-heading"><span className="tool-icon tone-gold"><Sparkles size={22}/></span><div><span className="eyebrow">통합 흐름 계산</span><h2>통합운세</h2><p>Western(서양점성술) 기간 흐름, 진태양시 보정 사주, Thai(태국점성술) 출생요일층을 각각 계산해 한 화면에서 비교해.</p></div></div>
            <div className="calculation-range"><CalendarDays size={17}/><span>분석기간 {integratedStartDate} ~ {integratedSelectionEnd} · {integratedCalendarYear?`${integratedCalendarYear}년 전체`:periodRangeLabel(period)}</span></div>
            <div className="coordinate-note"><MapPin size={16}/><span>사주는 출생지 경도로 진태양시를 보정하고, 서양점성술은 출생지 좌표로 상승점·하우스를 계산해. Thai(태국점성술)는 현재 출생요일 기준값만 사용해.</span></div>
            {integratedError && <div className="status-banner error"><AlertTriangle size={17}/><span>{integratedError}</span></div>}
            <button className="primary-button" type="button" onClick={runIntegrated} disabled={integratedLoading||apiStatus==='offline'}>{integratedLoading?<LoaderCircle className="spin" size={18}/>:<Sparkles size={18}/>}<span>{integratedLoading?'통합 계산 중…':'통합운세 실제 계산'}</span></button>

            {integratedMatchesSelection && integratedResult && <div className="results-wrap integrated-results">
              <div className="result-headline"><CheckCircle2 size={20}/><div><strong>통합 계산 완료</strong><span>{integratedResult.period.day_count}일 분석 · {integratedResult.period.month_segments}개 월 구간</span></div></div>
              <AiInterpretationPanel result={aiInterpretation} loading={aiLoading} error={aiError} onRetry={()=>void runAiInterpretation()}/>
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
                <div className="integrated-topic-grid">
                  {orderedIntegratedTopics.map(({topic,stat})=><div className="integrated-topic" key={topic}><span>{topicDisplay(topic)}</span><strong>{stat.average.toFixed(1)}</strong><small>{stat.band}</small></div>)}
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
              <label className="check-field field-wide"><input type="checkbox" checked={!counterpart.timeKnown} onChange={(e)=>setCounterpart({...counterpart,timeKnown:!e.target.checked,birthTime:e.target.checked?'':counterpart.birthTime})}/><span>상대 출생시간 모름 — 달·각도·다빈슨/마크스 일부 정밀 레이어는 자동 제외</span></label>
              <KoreaBirthplaceSelector disabled={!counterpart.timeKnown} value={counterpart} onChange={(location)=>setCounterpart({...counterpart,...location})}/>
              <details className="advanced-panel field-wide"><summary>고급 위치 설정 · 위도/경도 직접 수정</summary><div className="advanced-grid">
                <label className="field"><span>위도</span><input inputMode="decimal" value={counterpart.latitude} disabled={!counterpart.timeKnown} onChange={(e)=>setCounterpart({...counterpart,latitude:e.target.value,placeKey:''})}/></label>
                <label className="field"><span>경도</span><input inputMode="decimal" value={counterpart.longitude} disabled={!counterpart.timeKnown} onChange={(e)=>setCounterpart({...counterpart,longitude:e.target.value,placeKey:''})}/></label>
                <label className="field field-wide"><span>UTC(협정세계시) 시차</span><input inputMode="decimal" value={counterpart.utcOffset} disabled={!counterpart.timeKnown} onChange={(e)=>setCounterpart({...counterpart,utcOffset:e.target.value})}/></label>
              </div></details>
            </div>
            <div className="coordinate-note"><MapPin size={16}/><span>국내는 시·도 → 시·군·구만 고르면 현재 행정경계 대표좌표와 UTC +9를 자동 적용해. 직접 좌표 입력은 고급 설정이야.</span></div>
            <div className="calculation-range"><CalendarDays size={17}/><span>분석기간 {queryDate} ~ {periodEnd(queryDate,period)} · {periodRangeLabel(period)}</span></div>
            {relationshipError && <div className="status-banner error"><AlertTriangle size={17}/><span>{relationshipError}</span></div>}
            <button className="primary-button" type="button" onClick={runRelationship} disabled={relationshipLoading||apiStatus==='offline'}>{relationshipLoading?<LoaderCircle className="spin" size={18}/>:<Sparkles size={18}/>}<span>{relationshipLoading?(selectedTool==='marriage'?'결혼운 계산 중…':relationshipPurpose==='reunion'?'재회운 계산 중…':'궁합 계산 중…'):(selectedTool==='marriage'?(marriageMode==='unmarried'?'미혼 결혼운 정밀 계산':'기혼 결혼운 정밀 계산'):relationshipPurpose==='reunion'?'재회운 정밀 계산':'궁합 정밀 계산')}</span></button>

            {relationshipResult && <div className="results-wrap">
              <div className="result-headline"><CheckCircle2 size={20}/><div><strong>실제 계산 완료</strong><span>{relationshipResult.period.start} ~ {relationshipResult.period.end} · {clampedRelationshipDays}일</span></div></div>
              <div className="result-actions">
                <button type="button" onClick={()=>relationshipRequestSnapshot && handleCopy('요청/프롬프트 전체복사', relationshipPromptText(selectedTool==='marriage'?'marriage':'compatibility', relationshipRequestSnapshot, relationshipResult))}><Copy size={15}/><span>요청/프롬프트 전체복사</span></button>
                <button type="button" onClick={()=>handleCopy('결과 전체복사', relationshipResultText(selectedTool==='marriage'?'marriage':'compatibility', relationshipResult))}><Copy size={15}/><span>결과 전체복사</span></button>
                <button className="save-action" type="button" onClick={saveRelationshipRecord} disabled={archiveSaving}><Save size={15}/><span>{archiveSaving?'저장 중…':'기록 저장'}</span></button>
              </div>
              {actionNotice && <div className="status-banner subtle"><CheckCircle2 size={16}/><span>{actionNotice}</span></div>}
              {archiveStatus && <div className="status-banner subtle"><Cloud size={16}/><span>{archiveStatus}</span></div>}
              {selectedTool==='compatibility'&&relationshipPurpose==='reunion'&&<ReunionTimingPanel context={reunionTiming} loading={reunionTimingLoading} error={reunionTimingError}/>}
              {selectedTool==='compatibility'&&relationshipPurpose==='reunion'&&<ReunionTransitPanel result={relationshipResult}/>}
              <RelationshipInterpretationPanel aspects={natalAspects} partnerExact={Boolean(relationshipResult.result.natal_synastry?.partner_time_exact)} ai={relationshipAi} aiLoading={relationshipAiLoading} aiError={relationshipAiError} onAi={runRelationshipAi} analysisMode={selectedTool==='marriage'?`marriage_${marriageMode}`:relationshipPurpose} />
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
                <div className="status-banner subtle"><AlertTriangle size={16}/><span>상대 출생시간·정확 장소가 없어 진행 궁합차트·진행 합성차트·Davison(데이비슨)·Marks(마크스) 정밀 시기층은 추정하지 않았어. 이 상태에서 0은 재회 가능성 0%나 관계 점수 0점을 뜻하지 않아.</span></div>
                <p className="result-note">현재는 출생시간 없이도 확정 가능한 행성 간 기본 궁합 접점만 해석 근거로 사용해.</p>
              </section> : resultMonths.length>0 && <section className="result-card"><div className="result-card-title"><span>시기</span><strong>기간별 정밀 접점</strong></div><p className="result-note">접점 수는 사건 확률이 아니야. 독립 레이어에서 반복되는 정밀 접점을 보는 용도야.</p><div className="month-list">{resultMonths.map((month)=><div className="month-card" key={`${month.calendar_month}-${month.representative_date}`}><div className="month-title"><strong>{month.calendar_month}</strong><span>대표일 {month.representative_date}</span></div><div className="month-metrics"><span><b>{month.signal_summary.exact_contacts}</b> 정밀</span><span><b>{month.signal_summary.supportive_contacts}</b> 조화</span><span><b>{month.signal_summary.challenging_contacts}</b> 긴장</span></div>{month.signal_summary.tightest.slice(0,3).map((aspect,index)=><div className="tight-row" key={index}><span>{aspectText(aspect)}</span><b>{aspect.orb.toFixed(2)}°</b></div>)}</div>)}</div></section>}
              {(relationshipResult.result.limitations?.length??0)>0 && <div className="status-banner subtle"><AlertTriangle size={16}/><span>{partnerTimeExact ? relationshipResult.result.limitations?.map(relationshipLimitKo).join(' ') : '상대 출생시간/장소가 없어 데이비슨·마크스·3차 진행은 임의 추정하지 않고 제외했어.'}</span></div>}
            </div>}
          </section>}

          {selectedTool === 'location' && <section className="tool-panel location-panel">
            <div className="tool-panel-heading"><span className="tool-icon tone-sage"><MapPin size={22}/></span><div><span className="eyebrow">지역 활성도 계산</span><h2>지역·국가운</h2><p>출생 순간의 행성이 각 도시의 ASC(상승점)·DSC(하강점)·MC(중천점)·IC(천저점)에 얼마나 가까이 놓이는지 계산해서 장기거주·연애·커리어·공부·휴식 목적별로 비교해.</p></div></div>
            <div className="coordinate-note"><MapPin size={16}/><span>좋은 나라를 단정하는 기능은 아니야. 대표 도시의 점성 활성도를 비교하고, 비자·생활비·치안·언어·직업시장 같은 현실 조건은 별도로 봐야 해.</span></div>
            {locationError && <div className="status-banner error"><AlertTriangle size={17}/><span>{locationError}</span></div>}
            <button className="primary-button" type="button" onClick={runLocationFit} disabled={locationLoading||apiStatus==='offline'}>{locationLoading?<LoaderCircle className="spin" size={18}/>:<MapPin size={18}/>}<span>{locationLoading?'국가·도시 계산 중…':'나와 맞는 국가·도시 계산'}</span></button>
            {locationResult && <div className="results-wrap">
              <AstrocartographyWorldMap map={locationResult.map} purposes={locationResult.purposes}/>
              <section className="result-card"><div className="result-card-title"><span>국가 순위</span><strong>종합·장기거주 기준 상위 국가</strong></div><div className="location-rank-list">{locationResult.countries.slice(0,10).map((row,index)=><div className="location-rank-row" key={row.country}><span>{index+1}</span><div><strong>{row.country}</strong><small>대표 도시 {row.best_city}</small></div><b>{row.score.toFixed(1)}</b></div>)}</div><p className="result-note">점수는 대표 도시 카탈로그 안의 상대적 점성 활성도야. 실제 이민·여행 성공 확률이 아니야.</p></section>
              <div className="location-purpose-grid">{Object.entries(locationResult.purposes).map(([key,group])=><section className="location-purpose-card" key={key}><strong>{group.label}</strong><div className="location-rank-list">{group.cities.slice(0,5).map((row,index)=><div className="location-rank-row" key={`${key}-${row.city}`}><span>{index+1}</span><div><strong>{row.city} · {row.country}</strong><small>{row.evidence.slice(0,2).map((ev)=>`${ev.planet}(${annotateUserFacingText(ev.planet).replace(ev.planet,'').replace(/[()]/g,'')||ev.planet})-${ev.angle} ${ev.separation_deg}°`).join(' · ')}</small></div><b>{row.score.toFixed(1)}</b></div>)}</div></section>)}</div>
              <p className="location-evidence">{locationResult.policy.meaning} · {locationResult.policy.catalog_scope}</p>
            </div>}
          </section>}

          {selectedTool === 'precision' && <section className="tool-panel precision-panel">
            <div className="tool-panel-heading"><span className="tool-icon tone-sage"><Search size={22}/></span><div><span className="eyebrow">정밀 계산</span><h2>정밀분석</h2><p>새 점수를 만들지 않고 운영 중인 통합 실계산의 원자료를 더 깊게 펼쳐봐. Western(서양점성술) 세부 지표, 사주 원자료, Thai(태국점성술) 상태와 원본 JSON(제이슨·데이터 형식)까지 확인할 수 있어.</p></div></div>
            <div className="calculation-range"><CalendarDays size={17}/><span>분석기간 {queryDate} ~ {periodEnd(queryDate,period)} · {periodRangeLabel(period)}</span></div>
            <div className="coordinate-note"><Search size={16}/><span>통합운세와 같은 실계산 결과를 재사용해. 같은 날짜·기간 계산이 이미 있으면 다시 호출하지 않고 동일 결과를 정밀 화면에서 펼쳐 보여줘.</span></div>
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
                <details className="precision-details"><summary>원본 JSON(제이슨·데이터 형식) 전체 펼치기</summary><div className="precision-details-body"><pre className="precision-json">{JSON.stringify(integratedResult,null,2)}</pre></div></details>
              </section>
            </div>}
          </section>}
          {selectedTool==='integrated' && <section className="tool-panel">
            <div className="tool-panel-heading"><span className="tool-icon tone-gold"><Moon size={22}/></span><div><span className="eyebrow">천체 흐름 리포트</span><h2>{period==='today'?'오늘의 리포트':`${periods.find((item)=>item.key===period)?.label} 리포트`}</h2><p>{queryDate} → {integratedSelectionEnd} · 통합운세 실계산 요약</p></div></div>

            {!integratedMatchesSelection && <>
              <div className="coordinate-note"><Sparkles size={16}/><span>현재 선택한 기간의 계산 결과가 아직 없어. 아래 버튼은 통합운세와 같은 Render 실계산을 한 번만 실행하고, 그 응답을 이 홈 리포트와 상세 통합운세가 함께 재사용해.</span></div>
              {integratedError && <div className="status-banner error"><AlertTriangle size={17}/><span>{integratedError}</span></div>}
              <button className="primary-button" type="button" onClick={runIntegrated} disabled={integratedLoading||apiStatus==='offline'}>{integratedLoading?<LoaderCircle className="spin" size={18}/>:<Sparkles size={18}/>}<span>{integratedLoading?'리포트 계산 중…':`${period==='today'?'오늘':periods.find((item)=>item.key===period)?.label} 리포트 계산`}</span></button>
            </>}

            {integratedMatchesSelection && integratedResult && <>
              <div className="result-headline"><CheckCircle2 size={20}/><div><strong>실계산 리포트 준비 완료</strong><span>{integratedResult.period.day_count}일 분석</span></div></div>
              <AiInterpretationPanel result={aiInterpretation} loading={aiLoading} error={aiError} onRetry={()=>void runAiInterpretation()}/>

              <section className="result-card">
                <div className="result-card-title"><span>핵심 흐름</span><strong>핵심 흐름</strong></div>
                <div className="integrated-topic-grid">
                  {orderedIntegratedTopics.map(({topic,stat})=><div className="integrated-topic" key={`home-top-${topic}`}><span>{topicDisplay(topic)}</span><strong>{stat.average.toFixed(1)}</strong><small>{stat.band}</small></div>)}
                </div>
                {cautionIntegratedTopics.length>0 && <div className="best-window"><span>상대적 주의 흐름</span><strong>{cautionIntegratedTopics.map((row)=>`${row.topic} ${row.stat.average.toFixed(1)}`).join(' · ')}</strong></div>}
              </section>

              {orderedRelationshipSignals.length > 0 && <section className="result-card"><div className="result-card-title"><span>연락 방향</span><strong>연락 방향 보조지표</strong></div><div className="integrated-topic-grid signal-grid">{orderedRelationshipSignals.map(({topic,stat})=><div className="integrated-topic signal-topic" key={`signal-${topic}`}><span>{topic === '수신신호' ? '수신 · 상대 → 나' : topic === '발신적합' ? '발신 · 나 → 상대' : '과거 인연 · 재접점'}</span><strong>{stat.average.toFixed(1)}</strong><small>{stat.band}</small></div>)}</div><p className="result-note">수신은 들어오는 흐름, 발신은 내가 먼저 움직일 때의 적합도, 재접점은 과거 인연 활성도를 따로 본 값이야. 셋 다 사건 확률은 아니야.</p></section>}

              {integratedResult.western.market?.has_open_session && <section className="result-card market-flow-card"><div className="result-card-title"><span>투자 흐름</span><strong>주식 · 투자 흐름</strong></div><div className="integrated-topic-grid">{['투자심리','수익실현','신규진입','투자주의'].map((topic)=>{const stat=integratedResult.western.overall[topic]; if(!stat) return null; return <div className="integrated-topic market-topic" key={`market-${topic}`}><span>{topicDisplay(topic)}</span><strong>{stat.average.toFixed(1)}</strong><small>{stat.band}</small></div>})}</div><p className="result-note">투자심리=판단의 열기, 수익실현=정리 적합도, 신규진입=새 포지션 적합도, 투자주의=위험 경계지수야. 투자주의만 높을수록 좋은 게 아니라 더 조심해야 한다는 뜻이야.</p></section>}

              {(bestIntegratedDays.length>0 || cautionIntegratedDays.length>0) && <section className="result-card">
                <div className="result-card-title"><span>시기</span><strong>좋은 날짜 · 주의 날짜</strong></div>
                {bestIntegratedDays.map((point)=><div className="tight-row" key={`best-${point.date}`}><span>✨ {point.date} · {point.topic} · {point.label}</span><b>{point.score.toFixed(1)}</b></div>)}
                {cautionIntegratedDays.map((point)=><div className="tight-row" key={`caution-${point.date}`}><span>⚠️ {point.date} · {point.topic} · {point.label}</span><b>{point.score.toFixed(1)}</b></div>)}
                <p className="result-note">날짜 점수는 사건 확률이 아니라 기존 Western 기간엔진의 상대적 활성도야.</p>
              </section>}

              {integratedResult.western.detail_days?.length ? <section className="result-card"><div className="result-card-title"><span>TIME FLOW</span><strong>시간 흐름 · 계산 근거</strong></div><div className="time-detail-list">{integratedResult.western.detail_days.map((day)=><details key={`day-${day.date}`} open={integratedResult.period.day_count===1}><summary>{day.date}{day.market_open ? ' · KRX 거래일' : ''}</summary><div className="time-topic-list">{Object.entries(day.topics).map(([topic,detail])=><div className="time-topic" key={`${day.date}-${topic}`}><strong className="time-topic-name">{topic}</strong>{detail.best_window && <div className="time-window time-window-good"><b>좋은 구간</b><span>{detail.best_window.start}~{detail.best_window.end}</span><em>{detail.best_window.score}</em></div>}{detail.caution_window && <div className="time-window time-window-caution"><b>주의 구간</b><span>{detail.caution_window.start}~{detail.caution_window.end}</span><em>{detail.caution_window.score}</em></div>}{detail.evidence?.length ? <div className="time-evidence"><span className="time-evidence-label">계산 근거</span>{detail.evidence.slice(0,3).map((item,index)=><em key={`${day.date}-${topic}-ev-${index}`}>{humanizeEvidence(item)}</em>)}</div> : null}</div>)}</div></details>)}</div></section> : null}

              <details className="result-card system-summary-details">
                <summary>사주·Thai(태국점성술) 계산 근거</summary>
                <div className="saju-summary">
                  {integratedResult.saju.ok && integratedResult.saju.day_master && <span>사주 일간 <b>{integratedResult.saju.day_master}</b></span>}
                  {activeDayun && <span>현재 대운 <b>{activeDayun.ganzhi}</b> · {activeDayun.start_year}~{activeDayun.end_year}</span>}
                  <span>Thai <b>{integratedResult.thai.thai_day}</b> · {integratedResult.thai.ruler}</span>
                </div>
                <p className="result-note">Thai는 아직 출생요일 baseline만 표시하며 날짜별 예측 점수에는 섞지 않아.</p>
              </details>

              <div className="result-actions home-result-actions">
                <button type="button" onClick={()=>integratedRequestSnapshot && handleCopy('요청/프롬프트 전체복사', integratedPromptText(integratedRequestSnapshot))}><Copy size={15}/><span>요청/프롬프트 전체복사</span></button>
                <button type="button" onClick={()=>handleCopy('결과 전체복사', integratedResultText(integratedResult))}><Copy size={15}/><span>결과 전체복사</span></button>
                <button className="save-action" type="button" onClick={saveIntegratedRecord} disabled={archiveSaving}><Save size={15}/><span>{archiveSaving?'저장 중…':'기록 저장'}</span></button>
              </div>
              {actionNotice && <div className="status-banner subtle"><CheckCircle2 size={16}/><span>{actionNotice}</span></div>}
              {archiveStatus && <div className="status-banner subtle"><Cloud size={16}/><span>{archiveStatus}</span></div>}
              <button className="primary-button" type="button" onClick={()=>setSelectedTool('integrated')}><Search size={18}/><span>상세 통합운세 보기</span></button>
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
