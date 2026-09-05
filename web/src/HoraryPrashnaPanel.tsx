import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, LocateFixed, LoaderCircle, MapPin, RotateCcw, Sparkles } from 'lucide-react'

import type { Gender } from './appTypes'

type HoraryClassifyResponse = {
  ok: boolean
  router_version: string
  classifier_version: string
  classifier_mode: string
  primary_type: string
  intents: string[]
  policy_id: string
  subject?: string | null
  counterparty?: string | null
  options: string[]
  confidence: number
  needs_clarification: boolean
  clarification_question?: string
  risk_profile: string
  context: {
    question_time_local: string
    question_time_utc?: string | null
    latitude?: number | null
    longitude?: number | null
    utc_offset_hours?: number | null
    location_source: string
    accuracy_meters?: number | null
    location_ready: boolean
  }
  policy_preview?: {
    domain?: string
    western?: Record<string, unknown>
    prashna?: Record<string, unknown>
    default_outputs?: string[]
    safety?: string
  }
  next_stage: string
}

type Props = {
  apiBase: string
  gender: Gender
}

const domainKo: Record<string, string> = {
  LOST_ITEM: '분실물 · 위치',
  RELATIONSHIP: '연애 · 관계',
  CAREER: '직장 · 커리어',
  EXAM_EDUCATION: '시험 · 교육',
  MONEY: '금전 · 대금',
  BUSINESS_CONTRACT: '사업 · 계약',
  PROPERTY_MOVE: '집 · 부동산 · 이사',
  TRAVEL_FOREIGN: '여행 · 해외',
  HEALTH: '컨디션 · 건강',
  LEGAL_CONFLICT: '분쟁 · 법률',
  FAMILY_CHILDREN: '가족 · 자녀',
  COMMUNICATION_NEWS: '연락 · 소식',
  GENERAL_EVENT: '일반 자유질문',
}

const intentKo: Record<string, string> = {
  YES_NO: '가능 여부', TIMING: '시기', LOCATION: '위치', RECOVERY: '회수·회복', CONTACT: '연락',
  RECONCILIATION: '재회', COMMITMENT: '관계정립', OPTION_RANKING: '선택지 비교', ACTION_ADVICE: '행동 선택',
  OUTCOME: '결과 흐름', CAUSE: '원인', THIRD_PARTY_SYMBOLISM: '제3자 상징', THEFT_SYMBOLISM: '도난 상징',
  JOB_OFFER: '채용 오퍼', PROMOTION: '승진', PASS_FAIL: '합격 여부', PURCHASE_SALE: '매매', SIGNING: '서명',
  PAYMENT: '입금·정산', MOVE: '이동·이사', TRAVEL: '여행', CONFLICT_RESOLUTION: '갈등 해결', NEWS_RESULT: '소식·결과',
}

function localDateTimeValue(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d}T${hh}:${mm}`
}

function parseCoordinate(value: string, min: number, max: number) {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : Number.NaN
}

export function HoraryPrashnaPanel({ apiBase, gender }: Props) {
  const [question, setQuestion] = useState('')
  const [questionTime, setQuestionTime] = useState(() => localDateTimeValue())
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [locationSource, setLocationSource] = useState<'none' | 'browser_geolocation' | 'manual'>('none')
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<HoraryClassifyResponse | null>(null)

  const resetQuestionTime = () => setQuestionTime(localDateTimeValue())

  const useCurrentLocation = () => {
    setLocationError('')
    if (!('geolocation' in navigator)) {
      setLocationError('이 브라우저에서는 현재 위치 기능을 사용할 수 없어. 아래 좌표를 직접 입력해줘.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6))
        setLongitude(position.coords.longitude.toFixed(6))
        setAccuracy(Math.round(position.coords.accuracy))
        setLocationSource('browser_geolocation')
        setLocating(false)
      },
      (geoError) => {
        const message = geoError.code === geoError.PERMISSION_DENIED
          ? '위치 권한이 거절됐어. iPhone 설정에서 위치 권한을 허용하거나 좌표를 직접 입력해줘.'
          : geoError.code === geoError.TIMEOUT
            ? '현재 위치 확인 시간이 초과됐어. 다시 누르거나 좌표를 직접 입력해줘.'
            : '현재 위치를 확인하지 못했어. 다시 시도하거나 좌표를 직접 입력해줘.'
        setLocationError(message)
        setLocating(false)
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    )
  }

  const updateManualCoordinate = (kind: 'lat' | 'lon', value: string) => {
    if (kind === 'lat') setLatitude(value)
    else setLongitude(value)
    setAccuracy(null)
    setLocationSource(value || (kind === 'lat' ? longitude : latitude) ? 'manual' : 'none')
  }

  const classify = async () => {
    setError('')
    setResult(null)
    if (question.trim().length < 2) {
      setError('질문을 먼저 적어줘.')
      return
    }
    const lat = parseCoordinate(latitude, -90, 90)
    const lon = parseCoordinate(longitude, -180, 180)
    if (Number.isNaN(lat) || Number.isNaN(lon) || ((lat === null) !== (lon === null))) {
      setError('위도·경도를 둘 다 올바른 값으로 입력해줘.')
      return
    }
    setLoading(true)
    try {
      const locationReady = lat !== null && lon !== null
      const response = await fetch(`${apiBase}/v1/horary-prashna/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.trim(),
          question_time_local: questionTime ? `${questionTime}:00` : null,
          latitude: locationReady ? lat : null,
          longitude: locationReady ? lon : null,
          utc_offset_hours: -new Date().getTimezoneOffset() / 60,
          gender,
          location_source: locationReady ? locationSource : 'none',
          accuracy_meters: locationSource === 'browser_geolocation' ? accuracy : null,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.ok) throw new Error(payload?.detail || payload?.error || '질문 분류에 실패했어.')
      setResult(payload as HoraryClassifyResponse)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '질문 분류 중 오류가 발생했어.')
    } finally {
      setLoading(false)
    }
  }

  return <section className="tool-panel horary-prashna-panel">
    <div className="tool-panel-heading">
      <span className="tool-icon tone-sage"><Sparkles size={22}/></span>
      <div><span className="eyebrow">HORARY · PRASHNA</span><h2>호라리 · 프라슈나</h2><p>질문한 바로 그 시각과 위치를 기준으로 보는 자유질문 기능이야. 먼저 질문을 전통 규칙에 맞는 유형으로 분류해.</p></div>
    </div>

    <div className="horary-question-block">
      <label className="field field-wide">
        <span>무엇이 궁금해?</span>
        <textarea
          value={question}
          maxLength={2000}
          rows={5}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="예: 현재 쿨픽스가 집 안에 있다면, 침실 수납 / 베란다 / 오래된 전자기기·서류 수납 중 어디가 가장 강한가?"
        />
      </label>
      <div className="horary-input-caption"><span>{question.length}/2000</span><span>한 번에 하나의 핵심 질문이 가장 정확해.</span></div>
    </div>

    <div className="subsection-title">질문 시각</div>
    <div className="horary-time-row">
      <label className="field"><span>질문 시각 · 현재 기기 기준</span><input type="datetime-local" value={questionTime} onChange={(event) => setQuestionTime(event.target.value)}/></label>
      <button className="horary-secondary-button" type="button" onClick={resetQuestionTime}><Clock3 size={16}/><span>지금</span></button>
    </div>

    <div className="subsection-title">질문 위치</div>
    <button className="horary-location-button" type="button" onClick={useCurrentLocation} disabled={locating}>
      {locating ? <LoaderCircle className="spin" size={18}/> : <LocateFixed size={18}/>}<span>{locating ? '현재 위치 확인 중…' : '현재 위치 사용'}</span>
    </button>
    <div className="coordinate-note"><MapPin size={16}/><span>버튼을 눌렀을 때만 브라우저 위치 권한을 요청해. 주소는 필요 없고 호라리 계산에는 위도·경도만 사용해.</span></div>
    {locationError && <div className="status-banner error"><AlertTriangle size={16}/><span>{locationError}</span></div>}
    <div className="field-grid horary-coordinate-grid">
      <label className="field"><span>위도</span><input inputMode="decimal" value={latitude} placeholder="34.760400" onChange={(event) => updateManualCoordinate('lat', event.target.value)}/></label>
      <label className="field"><span>경도</span><input inputMode="decimal" value={longitude} placeholder="127.662200" onChange={(event) => updateManualCoordinate('lon', event.target.value)}/></label>
    </div>
    {latitude && longitude && <div className="horary-location-ready"><CheckCircle2 size={15}/><span>{locationSource === 'browser_geolocation' ? `현재 위치 확인됨${accuracy !== null ? ` · 약 ${accuracy}m 정확도` : ''}` : '직접 입력한 위치 사용'}</span></div>}

    {error && <div className="status-banner error"><AlertTriangle size={17}/><span>{error}</span></div>}
    <button className="primary-button horary-classify-button" type="button" disabled={loading} onClick={classify}>
      {loading ? <LoaderCircle className="spin" size={18}/> : <Sparkles size={18}/>}<span>{loading ? '질문 유형 확인 중…' : '질문 유형 확인'}</span>
    </button>

    {result && <section className="result-card horary-routing-result">
      <div className="result-card-title"><span>QUESTION ROUTE</span><strong>{domainKo[result.primary_type] ?? result.primary_type}</strong></div>
      <div className="horary-route-meta"><span>분류 신뢰도 <b>{Math.round(result.confidence * 100)}%</b></span><span>정책 <b>{result.policy_id}</b></span></div>
      <div className="horary-intent-list">{result.intents.map((intent) => <span key={intent}>{intentKo[intent] ?? intent}</span>)}</div>
      {result.options.length > 0 && <div className="horary-options"><span>선택지</span><ol>{result.options.map((option) => <li key={option}>{option}</li>)}</ol></div>}
      {result.subject && <p className="result-note">질문 대상: <b>{result.subject}</b></p>}
      {result.needs_clarification && result.clarification_question && <div className="status-banner subtle"><AlertTriangle size={16}/><span>{result.clarification_question}</span></div>}
      <div className="horary-route-systems"><div><span>Western Horary</span><strong>독립 규칙 적용 예정</strong></div><div><span>Prashna D1</span><strong>독립 바바 규칙 적용 예정</strong></div></div>
      <p className="result-note">지금 단계는 질문 라우팅까지만 연결했어. 차트 계산과 실제 판단을 아직 만들지 않기 때문에 이 화면에서는 결과를 예측하지 않아.</p>
      <button className="horary-secondary-button" type="button" onClick={() => setResult(null)}><RotateCcw size={15}/><span>질문 수정</span></button>
    </section>}
  </section>
}
