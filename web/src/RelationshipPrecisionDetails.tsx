import { AlertTriangle } from 'lucide-react'
import type { Aspect, RelationshipApiResponse } from './appTypes'
import { RelationshipEvidenceDetails } from './RelationshipEvidenceDetails'
import { aspectText, planetLabels } from './lib/resultFormatters'

type RelationshipPrecisionDetailsProps = {
  result: RelationshipApiResponse
  partnerTimeExact: boolean
  aspects: Aspect[]
  formatLimit: (value: string) => string
}

export function RelationshipPrecisionDetails({ result, partnerTimeExact, aspects, formatLimit }: RelationshipPrecisionDetailsProps) {
  const resultMonths = result.result.months ?? []
  const houseOverlays = result.result.house_overlays
  const houseGroups = [
    { title: '내 행성 → 상대 하우스', rows: houseOverlays?.user_in_counterpart?.relationship_houses ?? [] },
    { title: '상대 행성 → 내 하우스', rows: houseOverlays?.counterpart_in_user?.relationship_houses ?? [] },
  ]
  const houseContactCount = houseGroups.reduce((sum, group) => sum + group.rows.length, 0)
  const quadrantLabel = (system?: string) => system === 'Porphyry' ? '포르피리' : system === 'Placidus' ? '플라시두스' : (system ?? '사분면')

  return <>
    {partnerTimeExact && houseOverlays?.available && <details className="result-card relationship-precision-card">
      <summary className="relationship-precision-summary"><span>관계 하우스</span><strong>홀사인 + 사분면 하우스 상세</strong><small>{houseContactCount}개 접점 · 펼쳐보기</small></summary>
      <div className="relationship-precision-body"><p className="result-note">사분면 하우스는 플라시두스를 우선 사용하고, 극지에서 계산이 불가능하면 포르피리로 명시 전환해. 숫자가 같으면 중첩 근거, 다르면 서로 다른 해석층이야.</p><div className="month-list">{houseGroups.map((group)=><div className="month-card relationship-precision-month" key={group.title}><div className="month-title"><strong>{group.title}</strong><span>{group.rows.length}개 접점</span></div>{group.rows.slice(0,12).map((row,index)=><div className="tight-row" key={`${group.title}-${row.planet}-${index}`}><span>{planetLabels[row.planet]??row.planet}</span><b>홀사인 {row.whole_house??'—'}H · {quadrantLabel(row.quadrant_system)} {row.quadrant_house??row.placidus_house??row.house??'—'}H</b></div>)}</div>)}</div></div>
    </details>}
    <RelationshipEvidenceDetails aspects={aspects} />
    {!partnerTimeExact ? <section className="result-card">
      <div className="result-card-title"><span>정밀도</span><strong>출생시간 미상 · 일부 시기층 제외</strong></div>
      <div className="status-banner subtle"><AlertTriangle size={16}/><span>상대 출생시간을 몰라 진행 궁합차트·진행 합성차트·Davison(데이비슨)·Marks(마크스) 정밀 시기층은 추정하지 않았어. 입력한 출생지역은 기록에 보존하지만 시간민감 각도·하우스 계산에는 사용하지 않아. 이 상태에서 0은 재회 가능성 0%나 관계 점수 0점을 뜻하지 않아.</span></div>
      <p className="result-note">현재는 출생시간 없이도 확정 가능한 행성 간 기본 궁합 접점만 해석 근거로 사용해.</p>
    </section> : resultMonths.length>0 && <details className="result-card relationship-precision-card">
      <summary className="relationship-precision-summary"><span>정밀 시기</span><strong>기간별 접점 상세</strong><small>{resultMonths.length}개월 · 펼쳐보기</small></summary>
      <div className="relationship-precision-body"><p className="result-note">접점 수는 사건 확률이 아니야. 독립 레이어에서 반복되는 정밀 접점을 확인하는 참고 자료야.</p><div className="month-list relationship-precision-month-list">{resultMonths.map((month)=><div className="month-card relationship-precision-month" key={`${month.calendar_month}-${month.representative_date}`}><div className="month-title"><strong>{month.calendar_month}</strong><span>대표일 {month.representative_date}</span></div><div className="month-metrics"><span><b>{month.signal_summary.exact_contacts}</b> 정밀</span><span><b>{month.signal_summary.supportive_contacts}</b> 조화</span><span><b>{month.signal_summary.challenging_contacts}</b> 긴장</span></div>{month.signal_summary.tightest.slice(0,3).map((aspect,index)=><div className="tight-row" key={index}><span>{aspectText(aspect)}</span><b>{aspect.orb.toFixed(2)}°</b></div>)}</div>)}</div></div>
    </details>}
    {(result.result.limitations?.length??0)>0 && <div className="status-banner subtle"><AlertTriangle size={16}/><span>{partnerTimeExact ? result.result.limitations?.map(formatLimit).join(' ') : '상대 출생시간을 몰라 데이비슨·마크스·3차 진행은 임의 추정하지 않고 제외했어.'}</span></div>}
  </>
}
