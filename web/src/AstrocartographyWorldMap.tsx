import { useMemo, useState } from 'react'
import { MapPin, Orbit, Sparkles } from 'lucide-react'
import './astrocartography-map.css'

type MapPoint = { latitude: number; longitude: number }
type AstroLine = {
  planet: string
  angle: 'ASC' | 'DC' | 'MC' | 'IC'
  segments: MapPoint[][]
}
type CityRow = {
  city: string
  country: string
  latitude: number
  longitude: number
  score: number
  evidence: Array<{ planet: string; angle: string; separation_deg: number; tone: string }>
}
type PurposeGroup = { label: string; cities: CityRow[] }

type AstroMap = {
  projection: string
  latitude_limit: number
  line_policy: string
  lines: AstroLine[]
}

const PLANET_LABELS: Record<string, string> = {
  Sun: '태양', Moon: '달', Mercury: '수성', Venus: '금성', Mars: '화성',
  Jupiter: '목성', Saturn: '토성', Uranus: '천왕성', Neptune: '해왕성', Pluto: '명왕성',
}
const PURPOSE_PLANETS: Record<string, string[]> = {
  overall: ['Sun', 'Venus', 'Jupiter'],
  love: ['Venus', 'Moon', 'Jupiter'],
  career: ['Sun', 'Jupiter', 'Mercury', 'Saturn'],
  study: ['Mercury', 'Jupiter', 'Saturn'],
  rest_creative: ['Venus', 'Moon', 'Neptune', 'Jupiter'],
}
const ANGLE_HELP: Record<string, string> = {
  ASC: '나 자신·새 출발', DC: '관계·타인', MC: '커리어·사회적 방향', IC: '집·내면·정착',
}

function mercator(point: MapPoint) {
  const lat = Math.max(-85.05112878, Math.min(85.05112878, Number(point.latitude)))
  const lon = Math.max(-180, Math.min(180, Number(point.longitude)))
  const x = ((lon + 180) / 360) * 100
  const phi = lat * Math.PI / 180
  const y = (1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2 * 100
  return { x, y }
}

function pointsAttr(segment: MapPoint[]) {
  return segment.map((point) => {
    const p = mercator(point)
    return `${p.x.toFixed(3)},${p.y.toFixed(3)}`
  }).join(' ')
}

export function AstrocartographyWorldMap({ map, purposes }: { map: AstroMap; purposes: Record<string, PurposeGroup> }) {
  const purposeKeys = Object.keys(purposes)
  const [purpose, setPurpose] = useState(purposeKeys.includes('overall') ? 'overall' : purposeKeys[0])
  const [angle, setAngle] = useState<'ALL'|'ASC'|'DC'|'MC'|'IC'>('ALL')
  const [expandedPlanets, setExpandedPlanets] = useState(false)
  const [selectedPlanet, setSelectedPlanet] = useState<string | null>(null)
  const group = purposes[purpose]
  const defaultPlanets = PURPOSE_PLANETS[purpose] ?? ['Sun', 'Venus', 'Jupiter']
  const activePlanets = selectedPlanet ? [selectedPlanet] : expandedPlanets ? Object.keys(PLANET_LABELS) : defaultPlanets
  const selectablePlanets = expandedPlanets ? Object.keys(PLANET_LABELS) : defaultPlanets
  const angleLabel = (key: 'ALL'|'ASC'|'DC'|'MC'|'IC') => key === 'ALL' ? '전체' : key === 'DC' ? 'DSC' : key
  const lines = useMemo(() => map.lines.filter((line) => activePlanets.includes(line.planet) && (angle === 'ALL' || line.angle === angle)), [map.lines, activePlanets.join('|'), angle])
  const cities = group?.cities?.slice(0, 10) ?? []

  return <section className="astro-world-card">
    <div className="astro-world-head">
      <div><span className="eyebrow">ASTROCARTOGRAPHY WORLD MAP</span><h3>내 행성선이 지나는 세계</h3><p>출생 순간의 행성을 지구의 ASC·DSC·MC·IC 선으로 펼친 지도야. 선은 사건 확률이 아니라 그 행성 주제가 강하게 체감되기 쉬운 지리적 축이야.</p></div>
      <span className="astro-world-orb"><Orbit size={22}/></span>
    </div>

    <div className="astro-purpose-tabs" role="tablist" aria-label="지역 목적 선택">
      {purposeKeys.map((key) => <button key={key} type="button" className={purpose === key ? 'is-active' : ''} onClick={() => { setPurpose(key); setSelectedPlanet(null) }}>{purposes[key].label}</button>)}
    </div>

    <div className="astro-map-shell">
      <div className="astro-map-tiles" aria-hidden="true">
        <img src="https://tile.openstreetmap.org/1/0/0.png" alt=""/><img src="https://tile.openstreetmap.org/1/1/0.png" alt=""/>
        <img src="https://tile.openstreetmap.org/1/0/1.png" alt=""/><img src="https://tile.openstreetmap.org/1/1/1.png" alt=""/>
      </div>
      <div className="astro-map-veil" aria-hidden="true"/>
      <svg className="astro-map-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="아스트로카토그래피 행성선 세계지도">
        <g className="astro-graticule">
          {[25,50,75].map((x)=><line key={`v${x}`} x1={x} x2={x} y1="0" y2="100"/>)}
          {[25,50,75].map((y)=><line key={`h${y}`} x1="0" x2="100" y1={y} y2={y}/>)}
        </g>
        <g className="astro-lines">
          {lines.flatMap((line) => line.segments.map((segment,index) => <polyline key={`${line.planet}-${line.angle}-${index}`} className={`astro-line planet-${line.planet.toLowerCase()} angle-${line.angle.toLowerCase()}`} points={pointsAttr(segment)} vectorEffect="non-scaling-stroke"/>))}
        </g>
        <g className="astro-city-pins">
          {cities.map((city,index) => {
            const p = mercator(city)
            const radius = index < 3 ? 1.35 : 1.0
            return <g key={`${purpose}-${city.city}`} transform={`translate(${p.x} ${p.y})`}>
              <circle className={index < 3 ? 'is-top' : ''} r={radius}/>
              {index < 5 && <text x="1.7" y="-1.25" vectorEffect="non-scaling-stroke">{index+1}</text>}
            </g>
          })}
        </g>
      </svg>
      <div className="astro-map-caption"><span><Sparkles size={13}/> 목적별 핵심 행성 {expandedPlanets ? '전체 표시' : '우선 표시'}</span><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a></div>
    </div>

    <div className="astro-map-controls">
      <div className="astro-angle-filter"><strong>각도선</strong>{(['ALL','ASC','DC','MC','IC'] as const).map((key)=><button type="button" key={key} className={angle===key?'is-active':''} onClick={()=>setAngle(key)}>{angleLabel(key)}</button>)}</div>
      <div className="astro-planet-filter"><strong>행성</strong><button type="button" className={!selectedPlanet&&!expandedPlanets?'is-active':''} onClick={()=>{setSelectedPlanet(null);setExpandedPlanets(false)}}>목적 핵심</button><button type="button" className={!selectedPlanet&&expandedPlanets?'is-active':''} onClick={()=>{setSelectedPlanet(null);setExpandedPlanets(true)}}>10행성</button>{selectablePlanets.map((planet)=><button type="button" key={planet} className={selectedPlanet===planet?'is-active':''} onClick={()=>setSelectedPlanet(selectedPlanet===planet?null:planet)}>{PLANET_LABELS[planet]}</button>)}</div>
    </div>

    <div className="astro-angle-guide">{['ASC','DC','MC','IC'].map((key)=><span key={key}><b>{key==='DC'?'DSC':key}</b> {ANGLE_HELP[key]}</span>)}</div>

    <div className="astro-map-city-strip">
      {cities.slice(0,5).map((city,index)=><article key={`${purpose}-card-${city.city}`}><span><MapPin size={14}/>{index+1}</span><div><strong>{city.city} · {city.country}</strong><small>{city.evidence.slice(0,2).map((ev)=>`${PLANET_LABELS[ev.planet] ?? ev.planet}-${ev.angle} ${ev.separation_deg}°`).join(' · ') || '주요 각도선 근접도 종합'}</small></div><b>{city.score.toFixed(1)}</b></article>)}
    </div>

    <p className="astro-map-policy">{map.line_policy}</p>
  </section>
}
