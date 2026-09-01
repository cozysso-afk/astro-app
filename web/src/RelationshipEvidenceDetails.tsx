import type { Aspect } from './appTypes'
import { aspectText } from './lib/resultFormatters'

type RelationshipEvidenceDetailsProps = {
  aspects: Aspect[]
}

export function RelationshipEvidenceDetails({ aspects }: RelationshipEvidenceDetailsProps) {
  const supportive = aspects.filter((aspect) => aspect.tone === 'supportive').length
  const challenging = aspects.filter((aspect) => aspect.tone === 'challenging').length
  const mixed = aspects.filter((aspect) => aspect.tone === 'mixed').length

  return <details className="result-card relationship-evidence-details">
    <summary>기본 관계 구조 · 계산 근거 펼치기</summary>
    <div className="relationship-evidence-body">
      <div className="result-card-title"><span>기본 궁합</span><strong>계산 근거</strong></div>
      <p className="result-note">아래 숫자는 관계 점수나 재회 확률이 아니라, 허용 오브 안에서 포착된 주요 천체 각의 개수야.</p>
      <div className="metric-grid">
        <div className="metric"><strong>{aspects.length}</strong><span>주요 각</span></div>
        <div className="metric"><strong>{supportive}</strong><span>조화 각</span></div>
        <div className="metric"><strong>{challenging}</strong><span>긴장 각</span></div>
      </div>
      {mixed>0 && <p className="result-note">혼합 각 {mixed}개 · 개수만으로 관계의 좋고 나쁨을 판정하지 않아.</p>}
      <div className="aspect-list">{aspects.slice(0,8).map((aspect,index)=><div className="aspect-row" key={`${aspect.a}-${aspect.aspect}-${aspect.b}-${index}`}><span className={`tone-dot ${aspect.tone}`}/><div><strong>{aspectText(aspect)}</strong><span>오브 {aspect.orb.toFixed(2)}° · {aspect.tone==='supportive'?'조화':aspect.tone==='challenging'?'긴장':'혼합'}</span></div></div>)}</div>
    </div>
  </details>
}
