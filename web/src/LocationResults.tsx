import type { LocationFitResponse } from './appTypes'
import { AstrocartographyWorldMap } from './AstrocartographyWorldMap'
import { ReadingExplanation } from './ReadingExplanation'

type LocationResultsProps = {
  result: LocationFitResponse
  annotateText: (value: string) => string
}

type LocationEvidence = LocationFitResponse['countries'][number]['evidence'][number]

const PLANET_KO: Record<string,string> = { Sun:'태양', Moon:'달', Mercury:'수성', Venus:'금성', Mars:'화성', Jupiter:'목성', Saturn:'토성', Uranus:'천왕성', Neptune:'해왕성', Pluto:'명왕성' }
const PLANET_FOCUS: Record<string,string> = {
  Sun:'자기표현과 존재감', Moon:'정서적 안정과 생활 리듬', Mercury:'학습·소통·정보 이동', Venus:'관계의 편안함과 취향', Mars:'행동력과 경쟁',
  Jupiter:'확장과 기회 탐색', Saturn:'책임과 구조', Uranus:'변화와 독립성', Neptune:'상상력과 경계의 모호함', Pluto:'강한 몰입과 변화',
}
const ANGLE_KO: Record<string,string> = { ASC:'ASC(상승점)', DC:'DC(하강점)', MC:'MC(중천점)', IC:'IC(천저점)' }
const ANGLE_FOCUS: Record<string,string> = { ASC:'내가 환경에 적응하고 자신을 드러내는 방식', DC:'타인과 관계를 맺는 방식', MC:'사회적 역할과 성취 방향', IC:'집·생활 기반과 사적인 안정' }

function locationEvidenceText(evidence: LocationEvidence[], purpose: string) {
  if (!evidence.length) return `${purpose} 순위에 반영된 세부 각도 근거가 적어서 점수 자체를 중심으로 비교했어.`
  const first = evidence[0]
  const second = evidence[1]
  const firstPlanet = PLANET_KO[first.planet] ?? first.planet
  const firstAngle = ANGLE_KO[first.angle] ?? first.angle
  const firstFocus = PLANET_FOCUS[first.planet] ?? '해당 행성의 주제'
  const firstAxis = ANGLE_FOCUS[first.angle] ?? '해당 각도 축의 생활 영역'
  const extra = second ? ` 함께 ${PLANET_KO[second.planet] ?? second.planet}-${ANGLE_KO[second.angle] ?? second.angle} 접점도 ${second.separation_deg.toFixed(1)}° 차이로 반영됐어.` : ''
  return `${firstPlanet}-${firstAngle} 축이 ${first.separation_deg.toFixed(1)}° 차이로 가까이 잡혀 있어. 이 계산에서는 ${firstFocus}과 ${firstAxis}가 ${purpose} 목적에서 얼마나 두드러지는지를 비교하는 근거로 써.${extra}`
}

export function LocationResults({ result, annotateText }: LocationResultsProps) {
  const topCountry = result.countries[0]
  return <div className="results-wrap location-results">
    <section className="result-card location-reading-card"><div className="result-card-title"><span>지역·국가운 해설</span><strong>{topCountry ? `${topCountry.country} · ${topCountry.best_city}가 종합 기준에서 먼저 보여.` : '목적별로 도시의 점성 활성도를 비교해봐.'}</strong></div>
      <p className="reading-conclusion">{topCountry ? `대표 도시 카탈로그 안에서 종합·장기거주 점수를 비교하면 ${topCountry.country}가 ${topCountry.best_city}를 중심으로 상대적으로 높게 잡혔어. 이건 실제로 살기 좋은 나라를 판정한 게 아니라, 출생 순간의 행성과 각도 축이 어느 도시에서 더 가깝게 놓이는지를 비교한 결과야.` : '비교 가능한 국가·도시 결과가 부족해. 현재 계산 범위 안에서 확인되는 도시만 보여줄게.'}</p>
      {topCountry && <ReadingExplanation kind="reason">{locationEvidenceText(topCountry.evidence, '종합·장기거주')}</ReadingExplanation>}
      <ReadingExplanation kind="practice">상위권 도시가 실제 선택지라면 비자, 직업시장, 생활비, 치안, 언어, 가족과의 거리 같은 현실 조건을 따로 비교해. 점수 차이가 작을수록 현실 조건을 더 우선해서 판단하는 게 좋아.</ReadingExplanation>
      <ReadingExplanation kind="caution">이 순위는 이민·취업·연애·성공 확률이 아니야. 같은 국가 안에서도 도시별 각도 거리가 달라질 수 있으니 국가명 하나만 보고 결론 내리지는 마.</ReadingExplanation>
    </section>
    {result.map && <AstrocartographyWorldMap map={result.map} purposes={result.purposes}/>}
    <section className="result-card"><div className="result-card-title"><span>국가 순위</span><strong>종합·장기거주 기준 상위 국가</strong></div><div className="location-rank-list">{result.countries.slice(0,10).map((row,index)=><div className="location-rank-row" key={row.country}><span>{index+1}</span><div><strong>{row.country}</strong><small>대표 도시 {row.best_city}</small></div><b>{row.score.toFixed(1)}</b></div>)}</div><p className="result-note">점수는 대표 도시 카탈로그 안의 상대적 점성 활성도야. 실제 이민·여행 성공 확률이 아니야.</p></section>
    <div className="location-purpose-grid">{Object.entries(result.purposes).map(([key,group])=>{const lead=group.cities[0];return <section className="location-purpose-card" key={key}><strong>{group.label}</strong>{lead&&<><p className="location-purpose-reading">{group.label}만 따로 보면 {lead.city} · {lead.country}가 이 목적에서 가장 먼저 보여. 아래 순위는 같은 목적 가중치로 계산한 상대 비교야.</p><ReadingExplanation kind="reason">{locationEvidenceText(lead.evidence, group.label)}</ReadingExplanation></>}<div className="location-rank-list">{group.cities.slice(0,5).map((row,index)=><div className="location-rank-row" key={`${key}-${row.city}`}><span>{index+1}</span><div><strong>{row.city} · {row.country}</strong><small>{row.evidence.slice(0,2).map((ev)=>`${ev.planet}(${annotateText(ev.planet).replace(ev.planet,'').replace(/[()]/g,'')||ev.planet})-${ev.angle} ${ev.separation_deg}°`).join(' · ')}</small></div><b>{row.score.toFixed(1)}</b></div>)}</div></section>})}</div>
    <p className="location-evidence">{result.policy.meaning} · {result.policy.catalog_scope} · {result.policy.distance_rule}</p>
  </div>
}
