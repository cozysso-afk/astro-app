import { useState } from 'react'
import { Copy, Moon, Sparkles } from 'lucide-react'

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
  if (!hit) return '접점 미기록'
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
  const copy = async () => {
    try { await navigator.clipboard.writeText(portrait); setCopyStatus('프롬프트를 복사했어.') }
    catch { setCopyStatus('자동 복사가 안 됐어. 아래 프롬프트를 펼쳐 직접 복사해줘.') }
  }
  return <section className="relationship-experience reading-experience personal-marriage-card">
    <header className="reading-hero"><Moon className="celestial-mark" size={26} aria-hidden="true"/>
      <h3>개인 결혼운 계산 결과</h3><span className="reading-period-date">{data.period.start} — {data.period.end}</span>
      <p>상대 없이 계산한 개인 결혼운은 현재 제미나이 해설을 지원하지 않아요.</p>
    </header>
    <section className="reading-section"><h4>기간별 계산 지표</h4>
      <p>결혼 관련 활성 지수 {forecast.marriage_probability_percent.toFixed(1)}/100 · 통계 확률 아님</p>
      <dl><dt>지원 지표</dt><dd>{forecast.supportive_component}</dd><dt>긴장 지표</dt><dd>{forecast.pressure_component}</dd><dt>약속 지표</dt><dd>{forecast.commitment_component}</dd></dl>
    </section>
    {(windows.length > 0 || pressureDays.length > 0) && <section className="reading-section"><h4>날짜별 계산값</h4>
      {windows.map(w=><p key={w.date}><time>{w.date}</time> · 활성 {w.score} · {hitText(w.strongest_hit ?? undefined)}</p>)}
      {pressureDays.map(w=><p key={w.date}><time>{w.date}</time> · 긴장 {w.pressure_load} · {hitText(w.hits.find(h=>h.tone==='challenging'))}</p>)}
    </section>}
    <details className="portrait-concept"><summary><Sparkles size={16} aria-hidden="true"/> 나의 취향을 그려본다면</summary><p className="reading-muted">미래 사람의 외모를 맞히는 기능이 아니야. 아래 단서를 바탕으로 만든 창작 이미지 콘셉트야.</p>
      {portrait ? <><div className="portrait-hints">{spouse.appearance_hints.map((h,i) => <span key={i}>{h}</span>)}</div><button type="button" onClick={() => void copy()}><Copy size={16}/>AI 초상 콘셉트 프롬프트 복사</button><p role="status" aria-live="polite">{copyStatus}</p><details><summary>프롬프트 펼쳐 보기</summary><pre>{portrait}</pre></details></> : <p>외모 분위기를 만들 단서가 없어. 닮은꼴이나 체형을 임의로 덧붙이지 않을게.</p>}
    </details>
    <details className="relationship-technical"><summary>기술 근거 자세히 보기</summary>
      {houses.map(([key,row]) => <div key={key}><h4>{houseMeaning[key]}</h4><p>{rulerLine(row)}</p></div>)}
      {planets.map(([name,row]) => <p key={name}>{planetKo[name] ?? name} · {row.sign} {row.degree.toFixed(1)}°</p>)}
      {result.natal_aspects.map((a,i)=><p key={i}>{planetKo[a.a] ?? a.a} · {aspectKo[a.aspect] ?? a.aspect} · {planetKo[a.b] ?? a.b} · 오브 {a.orb.toFixed(2)}°</p>)}
      <details><summary>계산 엔진 원자료</summary><pre>{JSON.stringify(result, null, 2)}</pre></details>
    </details>
  </section>
}
