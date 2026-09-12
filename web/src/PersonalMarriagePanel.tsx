import { useState } from 'react'
import { Copy, Moon, Sparkles } from 'lucide-react'
import { ReadingExplanation } from './ReadingExplanation'

export type PersonalMarriageResponse = {
  ok: boolean
  api_version: string
  engine: string
  period: { start: string; end: string; day_count: number }
  result: {
    mode: 'personal_unmarried'
    house_system?: { requested: string; used: string; fallback: boolean; fallback_reason?: string | null }
    policy: {
      counterpart_required: boolean
      marriage_probability: boolean
      spouse_archetype_prediction: boolean
      specific_identity_claims: boolean
      entertainment_index: boolean
      meaning: string
    }
    relationship_houses: Record<string, {
      house: number
      whole_sign: string
      whole_ruler: string
      whole_ruler_placement: { planet: string; sign: string; degree: number; whole_house: number; placidus_house: number; quadrant_house?: number; quadrant_system?: string }
      quadrant_sign?: string
      quadrant_ruler?: string
      quadrant_ruler_placement?: { planet: string; sign: string; degree: number; whole_house: number; placidus_house: number; quadrant_house?: number; quadrant_system?: string }
      quadrant_system?: string
      placidus_sign: string
      placidus_ruler: string
      placidus_ruler_placement: { planet: string; sign: string; degree: number; whole_house: number; placidus_house: number; quadrant_house?: number; quadrant_system?: string }
    }>
    relationship_planets: Record<string, { sign: string; degree: number; whole_house: number; placidus_house: number; quadrant_house?: number; quadrant_system?: string }>
    natal_aspects: Array<{ a: string; aspect: string; b: string; orb: number; tone: string }>
    forecast: {
      marriage_probability_percent: number
      label: string
      supportive_component: number
      pressure_component: number
      commitment_component: number
      probability_note: string
      strong_windows: Array<{
        date: string
        score: number
        themes: string[]
        supportive_load: number
        pressure_load: number
        strongest_hit: { transit: string; aspect: string; target: string; orb: number; tone: string; strength: number } | null
      }>
    }
    spouse_archetype: {
      summary: string
      appearance_hints: string[]
      personality_hints: string[]
      career_clusters: string[]
      meeting_route: string
      identity_clues: string[]
      precision_note: string
    }
    timing: {
      average_activation: number
      spread: number
      top_days: Array<{ date: string; activation: number; supportive_load: number; pressure_load: number; hits: Array<{ transit: string; aspect: string; target: string; orb: number; tone: string; strength: number }> }>
      pressure_days: Array<{ date: string; activation: number; supportive_load: number; pressure_load: number; hits: Array<{ transit: string; aspect: string; target: string; orb: number; tone: string; strength: number }> }>
      top_months: Array<{ calendar_month: string; activation: number; top_dates: string[] }>
    }
    limits: string[]
  }
}

const planetKo: Record<string,string> = {Moon:'달',Venus:'금성',Mars:'화성',Jupiter:'목성',Saturn:'토성',Uranus:'천왕성',Neptune:'해왕성',Pluto:'명왕성',Sun:'태양',Mercury:'수성','True Node':'진북교점'}
const pointKo: Record<string,string> = {DSC:'DSC(하강점)',IC:'IC(천저점)',Venus:'Venus(금성)',Moon:'Moon(달)',Saturn:'Saturn(토성)',Jupiter:'Jupiter(목성)','7th_ruler':'7하우스 주인행성','4th_ruler':'4하우스 주인행성','8th_ruler':'8하우스 주인행성'}
const aspectKo: Record<string,string> = {conjunction:'합',sextile:'육십분위',square:'사각',trine:'삼각',quincunx:'퀸컨스·150도각',opposition:'대립'}
const houseMeaning: Record<string,string> = {'4':'가정 · 함께 사는 생활','5':'연애 · 즐거움 · 애정표현','7':'배우자 · 동반자 관계','8':'친밀감 · 공유자원 · 깊은 결속'}

function rulerLine(row: PersonalMarriageResponse['result']['relationship_houses'][string]) {
  const system = row.quadrant_system ?? 'Placidus'
  const systemKo = system === 'Porphyry' ? '포르피리' : '플라시두스'
  const quadrantSign = row.quadrant_sign ?? row.placidus_sign
  const quadrantRuler = row.quadrant_ruler ?? row.placidus_ruler
  const quadrantPlacement = row.quadrant_ruler_placement ?? row.placidus_ruler_placement
  const same = row.whole_ruler === quadrantRuler
  if (same) return `${row.whole_sign} / ${quadrantSign} · 주인행성 ${row.whole_ruler}(${planetKo[row.whole_ruler] ?? row.whole_ruler}) · 홀사인 ${row.whole_ruler_placement.whole_house}H / ${systemKo} ${row.whole_ruler_placement.quadrant_house ?? row.whole_ruler_placement.placidus_house}H`
  return `홀사인 ${row.whole_sign} → ${row.whole_ruler}(${planetKo[row.whole_ruler] ?? row.whole_ruler}) ${row.whole_ruler_placement.whole_house}H · ${systemKo} ${quadrantSign} → ${quadrantRuler}(${planetKo[quadrantRuler] ?? quadrantRuler}) ${quadrantPlacement.quadrant_house ?? quadrantPlacement.placidus_house}H`
}

function hitText(hit?: { transit: string; aspect: string; target: string; orb: number }) {
  if (!hit) return '직접 활성 접점은 약한 편'
  return `${hit.transit}(${planetKo[hit.transit] ?? hit.transit}) ${aspectKo[hit.aspect] ?? hit.aspect} ${pointKo[hit.target] ?? hit.target} · 오브 ${hit.orb.toFixed(2)}°`
}

export function buildPortraitConcept(spouse: PersonalMarriageResponse['result']['spouse_archetype']) {
  const hints = spouse.appearance_hints.map(h => h.trim()).filter(Boolean)
  if (!hints.length) return ''
  return ['실존 인물을 특정하지 않는 성인 인물의 창작 초상.',
    '이 이미지는 미래 배우자 예측이 아니라 취향을 상상하는 무드보드다.',
    `제공된 분위기 단서: ${hints.join('; ')}`,
    '단서에 없는 키, 체형, 나이, 인종, 유명인 닮은꼴은 지정하지 않는다.',
    '스타일: 차분하고 정돈된 옷차림. 색감: 펄 아이보리와 흐린 라벤더.',
    '촬영 톤: 부드러운 창가 자연광, 자연스러운 피부 질감, 과한 미화 없이 편안한 표정.'].join('\n')
}

export function PersonalMarriagePanel({ data }: { data: PersonalMarriageResponse }) {
  const result = data.result
  const spouse = result.spouse_archetype
  const forecast = result.forecast
  const [copyStatus, setCopyStatus] = useState('')
  const portrait = buildPortraitConcept(spouse)
  const houses = ['7','4','8','5'].map(key => [key, result.relationship_houses[key]] as const).filter(([, row]) => !!row)
  const planets = Object.entries(result.relationship_planets)
  const windows = forecast.strong_windows.filter(w => w.date >= data.period.start && w.date <= data.period.end).slice(0, 3)
  const pressureDays = result.timing.pressure_days.filter(w => w.pressure_load > 0 && w.date >= data.period.start && w.date <= data.period.end).slice(0, 2)
  const hasCommitment = forecast.commitment_component > 0
  const hasPressure = forecast.pressure_component > 0
  const hitMeaning = (hit: { transit: string; target: string; tone: string } | null) => {
    if (!hit || !planetKo[hit.transit]) return '이 날짜를 구체적인 사건으로 설명할 세부 정보는 부족해.'
    const focus = ['Saturn','7th_ruler','DSC'].includes(hit.target) ? '관계의 약속과 책임' : ['Moon','IC','4th_ruler'].includes(hit.target) ? '정서적 편안함과 함께하는 생활' : '애정 표현과 서로의 거리'
    return `${planetKo[hit.transit]}의 움직임이 ${focus}에 연결돼 있어. ${hit.tone === 'challenging' ? '결정을 재촉하기보다 서로 부담스러운 조건을 이야기해볼 때로 읽어봐.' : hit.tone === 'supportive' ? '서로 원하는 관계를 구체적으로 이야기하는 데 활용해봐.' : '좋거나 나쁜 사건을 정하기보다 이 주제가 실제로 떠오르는지 살펴봐.'}`
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(portrait); setCopyStatus('프롬프트를 복사했어.') }
    catch { setCopyStatus('자동 복사가 안 됐어. 아래 프롬프트를 펼쳐 직접 복사해줘.') }
  }
  return <section className="relationship-experience reading-experience personal-marriage-card">
    <header className="reading-hero"><Moon className="celestial-mark" size={26} aria-hidden="true"/><p className="eyebrow">나의 관계 성향 · 미혼 결혼</p><span className="reading-period-date">{data.period.start} — {data.period.end}</span>
      <h3>{hasCommitment ? '끌리는 마음에서 함께하는 생활로, 어떤 약속이 필요한지 살펴볼 때야.' : '누가 나타날지보다, 어떤 관계에서 편안한 나인지 먼저 읽어봐.'}</h3>
      <p className="reading-hero-subtitle">{hasPressure ? '관계에 대한 관심과 현실적인 부담을 따로 살펴봐. 결혼이 이루어질 확률을 말하는 화면은 아니야.' : '본인 차트에서 관계의 취향과 선택을 읽는 해설이야. 특정 상대와의 궁합은 별도로 봐야 해.'}</p>
    </header>
    <section className="reading-section"><h3>내가 편안해지는 관계</h3><p className="reading-conclusion">{spouse.summary}</p><ReadingExplanation kind="practice">{spouse.personality_hints.length ? spouse.personality_hints.join(' ') : '관계 성향을 구체적으로 풀 단서가 부족해.'} 서로 원하는 연락 빈도와 혼자 쉴 시간부터 이야기해봐.</ReadingExplanation></section>
    <section className="reading-section"><h3>생활에서 맞춰야 할 것</h3><p>설레는 마음과 같이 살기 편한 조건은 따로 봐야 해. 돈을 쓰는 방식과 쉬는 시간, 맡을 책임을 구체적으로 나누는 과정이 중요해.</p><ReadingExplanation kind="caution">{hasPressure ? '이번 계산에는 관계 결정의 부담도 잡혀 있어. 불안해서 약속을 서두르거나, 한 사람이 생활을 전부 맞추는 방향은 피하는 편이 좋아.' : '부담이 두드러지지 않아도 모든 생활 조건이 맞는다는 뜻은 아니야. 아직 이야기하지 않은 부분까지 합의됐다고 생각하지 마.'}</ReadingExplanation></section>
    <section className="reading-section"><h3>관계를 생각해볼 시기</h3>{windows.length ? <ol className="reading-timeline">{windows.map(w => <li key={w.date}><time>{w.date}</time><strong>{w.pressure_load > w.supportive_load ? '서로 감당할 조건을 맞출 때' : '관계의 다음 단계를 이야기할 때'}</strong><p>{hitMeaning(w.strongest_hit)}</p></li>)}</ol> : <p className="reading-muted">다른 날과 구별할 만한 시기는 뚜렷하지 않아.</p>}</section>
    {!!pressureDays.length && <details className="relationship-enrichment"><summary>여유를 두고 볼 날짜</summary>{pressureDays.map(w => <ReadingExplanation kind="caution" key={w.date}>{w.date} · {hitMeaning(w.hits.find(h => h.tone === 'challenging') ?? null)}</ReadingExplanation>)}</details>}
    <details className="portrait-concept"><summary><Sparkles size={16} aria-hidden="true"/> 나의 취향을 그려본다면</summary><p className="reading-muted">미래 사람의 외모를 맞히는 기능이 아니야. 아래 단서를 바탕으로 만든 창작 이미지 콘셉트야.</p>
      {portrait ? <><div className="portrait-hints">{spouse.appearance_hints.map((h,i) => <span key={i}>{h}</span>)}</div><button type="button" onClick={() => void copy()}><Copy size={16}/>AI 초상 콘셉트 프롬프트 복사</button><p role="status" aria-live="polite">{copyStatus}</p><details><summary>프롬프트 펼쳐 보기</summary><pre>{portrait}</pre></details></> : <p>외모 분위기를 만들 단서가 없어. 닮은꼴이나 체형을 임의로 덧붙이지 않을게.</p>}
    </details>
    <details className="relationship-technical"><summary>기술 근거 자세히 보기</summary>
      <p>{forecast.probability_note} · 원자료 지수 {forecast.marriage_probability_percent.toFixed(1)}/100 — 통계 확률 아님</p>
      {houses.map(([key,row]) => <div key={key}><h4>{houseMeaning[key]}</h4><p>{rulerLine(row)}</p></div>)}
      {planets.map(([name,row]) => <p key={name}>{planetKo[name] ?? name} · {row.sign} {row.degree.toFixed(1)}°</p>)}
      {windows.map(w => <p key={w.date}>{w.date} · {hitText(w.strongest_hit ?? undefined)}</p>)}
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </details>
    <p className="reading-safety-note">출생 정보에 따라 읽을 수 있는 범위가 달라져. 미래의 사람이나 결혼 성사를 확정하지 않아.</p>
  </section>
}
