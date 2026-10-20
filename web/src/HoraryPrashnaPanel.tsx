import { useState } from 'react'
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, Copy, LocateFixed, LoaderCircle, MapPin, RotateCcw, Sparkles } from 'lucide-react'

import type { Gender } from './appTypes'

type HoraryChartReport = {
  engine_version: string
  julian_day_ut: number
  western: {
    ascendant: string; house_system: string; house_fallback: boolean; question_house: number | null
    querent_lord: string; quesited_lord: string | null
    querent_position: string; quesited_position: string | null; moon: string
    contacts: Array<{pair:string;aspect:string;orb:number;phase:string;applying:boolean;quality:string}>
    summary: string
  }
  prashna: {
    ayanamsa: string; lagna:string;lagna_lord:string;moon:string;moon_bhava:number
    question_bhava:number|null;question_bhava_lord:string|null;question_lord_bhava:number|null
    contacts:Array<{body:string;link:string;house:number}>; summary:string
  }
  synthesis: {status:string;conclusion:string;timing:string;limitations:string}
}
type HoraryClassifyResponse = {
  analysis?: HoraryChartReport

  ok: boolean
  router_version: string
  classifier_version: string
  classifier_mode: string
  normalized_question: string
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
    timezone_id?: string | null
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
  const [activeAction, setActiveAction] = useState<'analyze' | 'classify' | null>(null)
  const [copyState, setCopyState] = useState('')
  const invalidate = () => { setResult(null); setCopyState('') }

  const resetQuestionTime = () => { setQuestionTime(localDateTimeValue()); invalidate() }
  const setQuestionDate = (value: string) => {
    setQuestionTime(value ? `${value}T${questionTime.slice(11,16) || '00:00'}` : '')
    invalidate()
  }
  const setQuestionClock = (value: string) => {
    setQuestionTime(value && questionTime.slice(0,10) ? `${questionTime.slice(0,10)}T${value}` : '')
    invalidate()
  }

  const useCurrentLocation = () => {
    setLocationError('')
    invalidate()
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
    invalidate()
    if (kind === 'lat') setLatitude(value)
    else setLongitude(value)
    setAccuracy(null)
    setLocationSource(value || (kind === 'lat' ? longitude : latitude) ? 'manual' : 'none')
  }

  const submitQuestion = async (mode: 'analyze' | 'classify') => {
    setError('')
    setResult(null)
    if (question.trim().length < 2) {
      setError('질문을 먼저 적어줘.')
      return
    }
    if (!questionTime) {
      setError('질문 시각을 입력해줘.')
      return
    }
    const lat = parseCoordinate(latitude, -90, 90)
    const lon = parseCoordinate(longitude, -180, 180)
    if (Number.isNaN(lat) || Number.isNaN(lon) || ((lat === null) !== (lon === null))) {
      setError('위도·경도를 둘 다 올바른 값으로 입력해줘.')
      return
    }
    setLoading(true)
    setActiveAction(mode)
    try {
      const locationReady = lat !== null && lon !== null
      const response = await fetch(`${apiBase}/v1/horary-prashna/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.trim(),
          question_time_local: questionTime ? `${questionTime}:00` : null,
          latitude: locationReady ? lat : null,
          longitude: locationReady ? lon : null,
          utc_offset_hours: -new Date(questionTime).getTimezoneOffset() / 60,
          timezone_id: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
          gender,
          location_source: locationReady ? locationSource : 'none',
          accuracy_meters: locationSource === 'browser_geolocation' ? accuracy : null,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.ok) {
        const message = response.status === 404 && payload?.detail === 'Not Found'
          ? '해설 계산 API가 아직 배포되지 않았어. 질문 유형만 확인하거나 프롬프트를 복사할 수 있어.'
          : payload?.detail || payload?.error || '질문 분류에 실패했어.'
        throw new Error(message)
      }
      setResult(payload as HoraryClassifyResponse)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '질문 분류 중 오류가 발생했어.')
    } finally {
      setLoading(false)
      setActiveAction(null)
    }
  }

  const makePrompt = () => {
    const chart = result?.analysis
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '기기 시간대'
    const lines = [
      '호라리 · 프라슈나 질문 해설 요청',
      '질문 원문: ' + question.trim(),
      '질문 시각(기기 현지): ' + (questionTime || '미입력'),
      '시간대: ' + tz + ' / UTC 오프셋: ' + (questionTime ? (-new Date(questionTime).getTimezoneOffset()/60) : '?') + '시간',
      '위도/경도: ' + (latitude && longitude ? latitude + ', ' + longitude : '미입력 · 실제 차트 계산 전 위치 필요'),
      '질문 분야: ' + (result ? (domainKo[result.primary_type] ?? result.primary_type) : '미분류'),
      '요청: 서양 호라리(전통 1·질문 대상 하우스의 주인성, 달의 적용·분리각)와',
      '프라슈나(D1 Lahiri 라그나, 질문 바바·주인성, 그라하 시선)를 독립적으로 검토한 뒤 비교해.',
      '성사·지연·무산의 근거를 구분하고, 근거가 부족하면 확답을 하지 마.',
      '실제 상대의 의사나 일정에 관한 사실은 차트로 지어내지 마. 시간·위치·천문력 계산을 먼저 검증해.',
    ]
    if (chart) {
      lines.push('--- 실제 계산된 차트 근거(간이 v1) ---')
      lines.push('Western Horary: ' + JSON.stringify(chart.western))
      lines.push('Prashna D1: ' + JSON.stringify(chart.prashna))
      lines.push('현재 계산 요약: ' + chart.synthesis.conclusion)
      lines.push('미구현 판정: ' + chart.synthesis.limitations)
      lines.push('정확한 성사 시각이나 예/아니오를 추정하려면 추가 전통 판단 및 확인된 근거를 밝혀.')
    } else lines.push('이 프롬프트에는 실제 차트 위치·주인성 계산 결과가 아직 없어. 외부 도구에서 계산한 뒤 판단하고, 근거 없이 예측을 만들어내지 마.')
    return lines.join('\n')
  }
  const copyPrompt = async () => {
    try {
      const copy = makePrompt()
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(copy)
      else {
        const textArea = document.createElement('textarea')
        textArea.value = copy
        textArea.style.position = 'fixed'
        textArea.style.opacity = '0'
        document.body.appendChild(textArea)
        textArea.select()
        const success = document.execCommand('copy')
        document.body.removeChild(textArea)
        if (!success) throw new Error('복사 권한이 없어')
      }
      setCopyState('복사 완료 · 다른 AI 채팅창에 붙여넣어 분석을 요청할 수 있어.')
    } catch {
      setCopyState('복사 실패 · 브라우저의 클립보드 권한을 확인해줘.')
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
          onChange={(event) => { setQuestion(event.target.value); invalidate() }}
          placeholder="예: 오늘 예정된 만남은 예정대로 이루어질까, 지연될까?"
        />
      </label>
      <div className="horary-input-caption"><span>{question.length}/2000</span><span>한 번에 하나의 핵심 질문이 가장 정확해.</span></div>
    </div>

    <div className="subsection-title">질문 시각</div>
    <div className="horary-time-row">
      <div className="horary-date-time-fields">
        <label className="field">
          <span>질문 날짜</span>
          <span className="horary-native-input">
            <input aria-label="질문 날짜" type="date" value={questionTime.slice(0,10)} onChange={(event) => setQuestionDate(event.target.value)}/>
            <CalendarDays aria-hidden="true" size={18}/>
          </span>
        </label>
        <label className="field">
          <span>질문 시간 · 기기 현지</span>
          <span className="horary-native-input">
            <input aria-label="질문 시간" type="time" step={60} value={questionTime.slice(11,16)} onChange={(event) => setQuestionClock(event.target.value)}/>
            <Clock3 aria-hidden="true" size={18}/>
          </span>
        </label>
      </div>
      <button className="horary-secondary-button" type="button" onClick={resetQuestionTime}><Clock3 size={16}/><span>지금 시각</span></button>
    </div>
    <p className="horary-form-hint">차트는 실제 질문을 떠올린 시각과 그때의 위치를 기준으로 계산해. 날짜·시간을 각각 수정할 수 있어.</p>

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
    <div className="horary-action-group">
      <button className="primary-button horary-classify-button" type="button" disabled={loading} onClick={() => void submitQuestion('analyze')}>
        {loading && activeAction === 'analyze' ? <LoaderCircle className="spin" size={18}/> : <Sparkles size={18}/>}
        <span>{loading && activeAction === 'analyze' ? '차트 계산 중…' : '차트 계산 · 해설 보기'}</span>
      </button>
      <div className="horary-action-secondary">
        <button className="horary-secondary-button" type="button" disabled={loading} onClick={() => void submitQuestion('classify')}>
          {loading && activeAction === 'classify' ? <LoaderCircle className="spin" size={16}/> : null}
          <span>{loading && activeAction === 'classify' ? '유형 확인 중…' : '질문 유형만 확인'}</span>
        </button>
        <button className="horary-secondary-button" type="button" onClick={() => void copyPrompt()}><Copy size={16}/><span>해설 프롬프트 복사</span></button>
      </div>
    </div>
    <p className="horary-form-hint">프롬프트를 복사하면 질문 시각·좌표와 계산한 근거도 포함돼. 공유할 채팅방을 확인해줘.</p>
    {copyState && <p role="status" className="horary-copy-status">{copyState}</p>}
    {result && <section className="result-card horary-routing-result">
      <div className="result-card-title"><span>{result.analysis ? 'CHART EVIDENCE · 1차 해설' : '질문 분류 결과 · 차트 미계산'}</span><strong>{domainKo[result.primary_type] ?? result.primary_type}</strong></div>
      <p className="horary-confidence-note">분류 신뢰도 {Math.round(result.confidence * 100)}%는 질문 유형에 대한 점수야. 약속이 성사될 확률이 아니야.</p>
      <div className="horary-intent-list">{result.intents.map((intent) => <span key={intent}>{intentKo[intent] ?? intent}</span>)}</div>
      {result.options.length > 0 && <div className="horary-options"><span>질문 선택지</span><ol>{result.options.map((option) => <li key={option}>{option}</li>)}</ol></div>}
      {result.subject && <p className="result-note">질문 대상: <b>{result.subject}</b></p>}
      {result.needs_clarification && result.clarification_question && <div className="status-banner subtle"><AlertTriangle size={16}/><span>{result.clarification_question}</span></div>}
      {result.analysis ? <>
        <div className="horary-interpretation">
          <span className="eyebrow">독립 계산 근거를 종합한 1차 해설</span>
          <strong>{result.analysis.synthesis.status}</strong>
          <p>{result.analysis.synthesis.conclusion}</p>
          <p className="horary-limit-note">{result.analysis.synthesis.timing}</p>
        </div>
        <div className="horary-route-systems">
          <div><span>Western Horary · 실제 차트</span>
            <strong>ASC {result.analysis.western.ascendant} · {result.analysis.western.house_system}</strong>
            <p>{result.analysis.western.querent_lord} / {result.analysis.western.quesited_lord ?? '대상 하우스 미지정'} · 달 {result.analysis.western.moon}</p>
            <p>{result.analysis.western.summary}</p>
            {result.analysis.western.contacts.map((item,idx) => <p key={idx} className="horary-aspect-line">{item.pair}: {item.aspect} · {item.orb}° · {item.phase}</p>)}
          </div>
          <div><span>Prashna D1 · 독립 계산</span>
            <strong>라그나 {result.analysis.prashna.lagna} · Lahiri</strong>
            <p>라그나 주인성 {result.analysis.prashna.lagna_lord} · 질문 바바 {result.analysis.prashna.question_bhava ?? '미지정'} · 달 {result.analysis.prashna.moon}</p>
            <p>{result.analysis.prashna.summary}</p>
            {result.analysis.prashna.contacts.map((item,idx) => <p key={idx} className="horary-aspect-line">{item.body}: {item.link} · {item.house}바바</p>)}
          </div>
        </div>
        <details className="horary-calc-limits"><summary>이 해설의 계산 범위와 한계</summary><p>{result.analysis.synthesis.limitations}</p></details>
      </> : <div className="horary-classification-note">현재는 질문을 분류한 결과야. 실제 호라리·프라슈나 차트는 아직 계산하지 않았어. 위의 <b>차트 계산 · 해설 보기</b>를 눌러야 계산 근거가 나와.</div>}
      <div className="horary-result-actions">
        <button className="horary-secondary-button" type="button" onClick={() => void copyPrompt()}><Copy size={16}/><span>{result.analysis ? '계산 근거 + AI 해설 프롬프트 복사' : '질문 프롬프트 복사'}</span></button>
        <button className="horary-secondary-button" type="button" onClick={() => setResult(null)}><RotateCcw size={15}/><span>질문 수정</span></button>
      </div>
    </section>}
  </section>
}
