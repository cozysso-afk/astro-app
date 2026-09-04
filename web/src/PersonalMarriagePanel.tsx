import { AlertTriangle, CalendarDays, Gem, Home, Sparkles } from 'lucide-react'

export type PersonalMarriageResponse = {
  ok: boolean
  api_version: string
  engine: string
  period: { start: string; end: string; day_count: number }
  result: {
    mode: 'personal_unmarried'
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
      whole_ruler_placement: { planet: string; sign: string; degree: number; whole_house: number; placidus_house: number }
      placidus_sign: string
      placidus_ruler: string
      placidus_ruler_placement: { planet: string; sign: string; degree: number; whole_house: number; placidus_house: number }
    }>
    relationship_planets: Record<string, { sign: string; degree: number; whole_house: number; placidus_house: number }>
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
  const same = row.whole_ruler === row.placidus_ruler
  if (same) return `${row.whole_sign} / ${row.placidus_sign} · 주인행성 ${row.whole_ruler}(${planetKo[row.whole_ruler] ?? row.whole_ruler}) · 홀사인 ${row.whole_ruler_placement.whole_house}H / 플라시두스 ${row.whole_ruler_placement.placidus_house}H`
  return `홀사인 ${row.whole_sign} → ${row.whole_ruler}(${planetKo[row.whole_ruler] ?? row.whole_ruler}) ${row.whole_ruler_placement.whole_house}H · 플라시두스 ${row.placidus_sign} → ${row.placidus_ruler}(${planetKo[row.placidus_ruler] ?? row.placidus_ruler}) ${row.placidus_ruler_placement.placidus_house}H`
}

function hitText(hit?: { transit: string; aspect: string; target: string; orb: number }) {
  if (!hit) return '직접 활성 접점은 약한 편'
  return `${hit.transit}(${planetKo[hit.transit] ?? hit.transit}) ${aspectKo[hit.aspect] ?? hit.aspect} ${pointKo[hit.target] ?? hit.target} · 오브 ${hit.orb.toFixed(2)}°`
}

export function PersonalMarriagePanel({ data }: { data: PersonalMarriageResponse }) {
  const result = data.result
  const forecast = result.forecast
  const spouse = result.spouse_archetype
  const houses = ['7','4','8','5'].map((key)=>[key,result.relationship_houses[key]] as const).filter(([,row])=>!!row)
  const planets = ['Moon','Venus','Mars','Jupiter','Saturn'].map((key)=>[key,result.relationship_planets[key]] as const).filter(([,row])=>!!row)
  const windows = forecast.strong_windows.slice(0,3)
  const pressureDays = result.timing.pressure_days.filter((row)=>row.pressure_load>0).slice(0,3)

  return <section className="relationship-ai-card personal-marriage-card">
    <span className="eyebrow">상대 없이 보는 미혼 결혼운</span>
    <h3>결혼 가능성 · 시기 · 미래 배우자상</h3>

    <div className="status-banner marriage-intro"><Gem size={16}/><span><b>결혼 가능성 지수 {forecast.marriage_probability_percent.toFixed(1)}/100 · {forecast.label}</b> · {forecast.probability_note}</span></div>

    <section className="relationship-key-aspects">
      <strong><CalendarDays size={15}/> 결혼·공식화가 강해지는 시기 TOP 3</strong>
      {windows.length ? windows.map((row)=><div key={row.date}><b>{row.date} · {row.score.toFixed(1)} · {row.themes.join(' · ')}</b><p>{hitText(row.strongest_hit ?? undefined)}</p></div>) : <p>선택 기간에서는 결혼·공식화 신호가 크게 솟는 구간이 적어.</p>}
    </section>

    <section className="marriage-ai-deep">
      <strong>미래 배우자상 · 차트 단서</strong>
      <p className="marriage-ai-bottom">{spouse.summary}</p>
      <div className="marriage-ai-grid">
        <article><b>외모 · 분위기</b>{spouse.appearance_hints.map((x,i)=><p key={`appearance-${i}`}>{x}</p>)}</article>
        <article><b>성격 · 관계 방식</b>{spouse.personality_hints.map((x,i)=><p key={`personality-${i}`}>{x}</p>)}</article>
        <article><b>직업 · 분야</b><p>{spouse.career_clusters.join(' · ')}</p></article>
        <article><b>어디서 만날 가능성이 큰지</b><p>{spouse.meeting_route}</p></article>
        <article><b>신원 단서</b>{spouse.identity_clues.map((x,i)=><p key={`identity-${i}`}>{x}</p>)}</article>
        <article><b>해석 정밀도</b><p>{spouse.precision_note}</p></article>
      </div>
    </section>

    {!!result.timing.top_months.length && <section className="relationship-key-aspects"><strong><Home size={15}/> 월별 결혼운 활성 상위</strong>{result.timing.top_months.slice(0,6).map((row)=><div key={row.calendar_month}><b>{row.calendar_month} · {row.activation.toFixed(1)}</b><p>{row.top_dates.slice(0,3).join(' · ')}</p></div>)}</section>}

    {pressureDays.length ? <section className="relationship-key-aspects"><strong><AlertTriangle size={15}/> 관계 결정 압력이 커지는 시기</strong>{pressureDays.map((row)=><div key={row.date}><b>{row.date} · 압력 {row.pressure_load.toFixed(1)}</b><p>{hitText(row.hits.find((hit)=>hit.tone==='challenging') ?? row.hits[0])}</p></div>)}</section> : null}

    <details className="ai-system-note"><summary>왜 이런 배우자상·결혼운이 나오는지 · 원차트 근거</summary>
      <div className="relationship-ai-grid">{houses.map(([key,row])=><article key={key}><strong>{row.house}하우스 · {houseMeaning[key]}</strong><p>{rulerLine(row)}</p></article>)}</div>
      <div className="relationship-key-aspects"><strong>관계 행성의 기본 배치</strong>{planets.map(([key,row])=><div key={key}><b>{key}({planetKo[key]}) · {row.sign} {row.degree.toFixed(1)}°</b><p>홀사인 {row.whole_house}하우스 · 플라시두스 {row.placidus_house}하우스</p></div>)}</div>
      {!!result.natal_aspects.length && <div className="relationship-key-aspects"><strong>주요 애스펙트</strong>{result.natal_aspects.slice(0,10).map((row,index)=><p key={`${row.a}-${row.b}-${index}`}><b>{row.a} {aspectKo[row.aspect] ?? row.aspect} {row.b}</b> · 오브 {row.orb.toFixed(2)}° · {row.tone==='supportive'?'조화':row.tone==='challenging'?'긴장':'혼합'}</p>)}</div>}
    </details>

    <details className="ai-system-note"><summary>해석 한계</summary>{result.limits.map((line,index)=><p key={`${index}-${line}`}>{line}</p>)}</details>
    <p className="ai-limits"><Sparkles size={13}/> 재미로 보는 예측은 적극적으로 보여주되, 0~100은 실제 통계 확률이 아니고 실제 미래 사람의 이름·주소·회사를 만들어내지는 않아.</p>
  </section>
}
