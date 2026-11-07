import { hierarchyView } from './lib/reunionHierarchy'
import { ReunionHierarchyPanel } from './ReunionHierarchyPanel'
import { AuthoredReadingPanel } from './AuthoredReadingPanel'
import { buildRelationshipReadingDocument } from './lib/authoredReadingDocument'
import { relationshipAiCostPreview } from './lib/aiCostPreview'
import { Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Aspect, RelationshipAiResponse, RelationshipAnalysisMode, ReunionObservationContext, ReunionTimingContext } from './appTypes'
import { buildRelationshipUserSummary } from './lib/relationshipUserSummary'

export function RelationshipInterpretationPanel({ sajuContext, aspects, partnerExact, angleTimeAvailable, ai, aiLoading, aiError, onAi, analysisMode, timeSensitivePoints, formatAspect, timing, returnSupport, hierarchy, historyHierarchy, historyCalculated=false, observation, evidenceContract, technicalDetails, readingPeriod }: {
  sajuContext?: Record<string, unknown>;
  aspects: Aspect[]; partnerExact: boolean; angleTimeAvailable?: boolean; ai: RelationshipAiResponse | null; aiLoading: boolean; aiError: string;
  onAi: () => void; analysisMode: RelationshipAnalysisMode; timeSensitivePoints: ReadonlySet<string>; formatAspect: (aspect: Aspect) => string;
  hierarchy?: Record<string, unknown> | null;
  historyHierarchy?: Record<string, unknown> | null;
  historyCalculated?: boolean;
  observation?: ReunionObservationContext;
  evidenceContract?: { version?: string; available?: boolean; evidence?: Aspect[] } | null;
  timing?: ReunionTimingContext | null; returnSupport?: Record<string, unknown> | null; technicalDetails?: ReactNode
  readingPeriod?: {start:string;end:string}
}) {
  const reunion=analysisMode==='reunion'
  const hierarchyData=hierarchyView(hierarchy)
  const verified=Boolean(ai?.ok&&ai.origin==='gemini'&&ai.provenance_verified===true&&ai.data)
  const period=readingPeriod??timing?.period
  const date=period?`${period.start}${period.end!==period.start?` → ${period.end}`:''}`:''
  const document=buildRelationshipReadingDocument(ai,analysisMode,date)
  const view=buildRelationshipUserSummary({aspects,partnerExact,angleTimeAvailable,mode:analysisMode,sensitive:timeSensitivePoints,timing:reunion?timing:null})
  return <section className="relationship-experience reading-experience" data-mode={analysisMode} data-reading-export-root="relationship">
    {verified?<AuthoredReadingPanel doc={document}/>:<section className="reading-section relationship-natural-reading" data-relationship-state={aiLoading?'generating':aiError?'failed':'not_requested'}>
      <h3>{aiLoading?'관계 해설을 정리하고 있어…':aiError?'해설을 불러오지 못했어.':'관계 해설이 아직 작성되지 않았어.'}</h3>
      <p>계산된 근거와 실제 관계 기록은 아래에서 확인할 수 있어.</p>
      {aiError&&<p className="reading-alert" role="status">{aiError}</p>}
      <p className="ai-preflight-cost">{relationshipAiCostPreview(analysisMode)}</p>
      <button type="button" onClick={onAi} disabled={aiLoading}><Sparkles size={16}/>{aiLoading?'해설 생성 중…':'자연어 해설 생성'}</button>
    </section>}
    {reunion&&!hierarchyData&&<section className="reading-section reunion-legacy-result" role="status"><h3>이전 계산 저장본</h3><p>단계별 계산이 포함되기 전 저장본이야. 과거 날짜를 현재나 미래의 추천 시기로 읽지 마.</p></section>}
    {reunion&&hierarchyData&&<ReunionHierarchyPanel hierarchyData={hierarchyData} historyHierarchyData={hierarchyView(historyHierarchy)} historyCalculated={historyCalculated} observation={observation} evidence={evidenceContract?.evidence??[]} reunionV2={null} authoredReadingSeparate directionRows={[{kind:'incoming',label:'상대 차트 쪽 활성',...view.incoming},{kind:'outgoing',label:'내 차트 쪽 활성',...view.outgoing},{kind:'reconnection',label:'과거 인연 재접점',...view.reconnection}]} sustainabilityText={view.sustainabilityText}/>}
    <p className="reading-safety-note">실제 감정이나 관계의 결과를 확정하지 않아. 관찰한 행동과 계산상 후보 시기는 구분해서 읽어.</p>
    <details className="relationship-technical"><summary>기술 근거 자세히 보기</summary>{technicalDetails}<div className="technical-aspects"><h4>관계 접점 원자료</h4>{view.ranked.map((aspect,index)=><p key={index}>{formatAspect(aspect)} · orb {aspect.orb.toFixed(2)}°</p>)}</div></details>
  </section>
}
