import { AlertTriangle, CalendarDays, Gem, Home, Sparkles } from 'lucide-react'

export type PersonalMarriageResponse = {
  ok: boolean
  api_version: string
  engine: string
  period: { start: string; end: string; day_count: number }
  result: {
    mode: 'personal_unmarried'
    policy: { counterpart_required: boolean; marriage_probability: boolean; spouse_identity_prediction: boolean; meaning: string }
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

function hitText(hit?: PersonalMarriageResponse['result']['timing']['top_days'][number]['hits'][number]) {
  if (!hit) return '직접 활성 접점은 약한 편'
  return `${hit.transit}(${planetKo[hit.transit] ?? hit.transit}) ${aspectKo[hit.aspect] ?? hit.aspect} ${pointKo[hit.target] ?? hit.target} · 오브 ${hit.orb.toFixed(2)}°`
}

export function PersonalMarriagePanel({ data }: { data: PersonalMarriageResponse }) {
  const result = data.result
  const houses = ['7','4','8','5'].map((key)=>[key,result.relationship_houses[key]] as const).filter(([,row])=>!!row)
  const planets = ['Moon','Venus','Mars','Jupiter','Saturn'].map((key)=>[key,result.relationship_planets[key]] as const).filter(([,row])=>!!row)
  const topDays = result.timing.top_days.slice(0,3)
  const pressureDays = result.timing.pressure_days.filter((row)=>row.pressure_load>0).slice(0,3)

  return <section className="relationship-ai-card personal-marriage-card">
    <span className="eyebrow">상대 없이 보는 미혼 결혼운</span>
    <h3>내 차트의 결혼생활 구조와 주목 시기</h3>
    <div className="status-banner marriage-intro"><Gem size={16}/><span>특정 상대를 가정하지 않아. 결혼 성사 확률이나 미래 배우자 신원을 예언하지 않고, 내 차트에서 동반자·가정·친밀감·책임 주제가 어떻게 작동하고 언제 상대적으로 강해지는지만 봐.</span></div>

    <div className="relationship-ai-grid">
      {houses.map(([key,row])=><article key={key}><strong>{row.house}하우스 · {houseMeaning[key]}</strong><p>{rulerLine(row)}</p></article>)}
    </div>

    <section className="relationship-key-aspects">
      <strong>관계 행성의 기본 배치</strong>
      {planets.map(([key,row])=><div key={key}><b>{key}({planetKo[key]}) · {row.sign} {row.degree.toFixed(1)}°</b><p>홀사인 {row.whole_house}하우스 · 플라시두스 {row.placidus_house}하우스</p></div>)}
    </section>

    <section className="relationship-key-aspects">
      <strong><CalendarDays size={15}/> 가장 먼저 볼 시기 TOP 3</strong>
      {topDays.length ? topDays.map((row)=><div key={row.date}><b>{row.date} · 상대활성도 {row.activation.toFixed(1)}</b><p>{hitText(row.hits[0])}</p></div>) : <p>선택 기간에서 뚜렷하게 솟는 결혼·동반자 활성 구간이 적어.</p>}
    </section>

    {pressureDays.length ? <section className="relationship-key-aspects"><strong><AlertTriangle size={15}/> 압력·조정이 커지는 시기</strong>{pressureDays.map((row)=><div key={row.date}><b>{row.date} · 압력 {row.pressure_load.toFixed(1)}</b><p>{hitText(row.hits.find((hit)=>hit.tone==='challenging') ?? row.hits[0])}</p></div>)}</section> : null}

    {!!result.timing.top_months.length && <section className="relationship-key-aspects"><strong><Home size={15}/> 월별 상대활성 상위</strong>{result.timing.top_months.slice(0,6).map((row)=><div key={row.calendar_month}><b>{row.calendar_month} · {row.activation.toFixed(1)}</b><p>{row.top_dates.slice(0,3).join(' · ')}</p></div>)}</section>}

    {!!result.natal_aspects.length && <details className="ai-system-note"><summary>본래 결혼·동반자 구조의 주요 애스펙트 보기</summary>{result.natal_aspects.slice(0,10).map((row,index)=><p key={`${row.a}-${row.b}-${index}`}><b>{row.a} {aspectKo[row.aspect] ?? row.aspect} {row.b}</b> · 오브 {row.orb.toFixed(2)}° · {row.tone==='supportive'?'조화':row.tone==='challenging'?'긴장':'혼합'}</p>)}</details>}

    <details className="ai-system-note"><summary>해석 한계</summary>{result.limits.map((line,index)=><p key={`${index}-${line}`}>{line}</p>)}</details>
    <p className="ai-limits"><Sparkles size={13}/> 점수는 결혼 확률이 아니라 선택 기간에 동반자·가정·친밀감·책임 주제가 상대적으로 활성되는 정도야.</p>
  </section>
}
