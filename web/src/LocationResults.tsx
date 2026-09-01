import type { LocationFitResponse } from './appTypes'
import { AstrocartographyWorldMap } from './AstrocartographyWorldMap'

type LocationResultsProps = {
  result: LocationFitResponse
  annotateText: (value: string) => string
}

export function LocationResults({ result, annotateText }: LocationResultsProps) {
  return <div className="results-wrap">
    {result.map && <AstrocartographyWorldMap map={result.map} purposes={result.purposes}/>}
    <section className="result-card"><div className="result-card-title"><span>국가 순위</span><strong>종합·장기거주 기준 상위 국가</strong></div><div className="location-rank-list">{result.countries.slice(0,10).map((row,index)=><div className="location-rank-row" key={row.country}><span>{index+1}</span><div><strong>{row.country}</strong><small>대표 도시 {row.best_city}</small></div><b>{row.score.toFixed(1)}</b></div>)}</div><p className="result-note">점수는 대표 도시 카탈로그 안의 상대적 점성 활성도야. 실제 이민·여행 성공 확률이 아니야.</p></section>
    <div className="location-purpose-grid">{Object.entries(result.purposes).map(([key,group])=><section className="location-purpose-card" key={key}><strong>{group.label}</strong><div className="location-rank-list">{group.cities.slice(0,5).map((row,index)=><div className="location-rank-row" key={`${key}-${row.city}`}><span>{index+1}</span><div><strong>{row.city} · {row.country}</strong><small>{row.evidence.slice(0,2).map((ev)=>`${ev.planet}(${annotateText(ev.planet).replace(ev.planet,'').replace(/[()]/g,'')||ev.planet})-${ev.angle} ${ev.separation_deg}°`).join(' · ')}</small></div><b>{row.score.toFixed(1)}</b></div>)}</div></section>)}</div>
    <p className="location-evidence">{result.policy.meaning} · {result.policy.catalog_scope}</p>
  </div>
}
