import { tenGodLens } from './lib/systemReading'
import { ReadingBadge, ReadingDirections, ReadingTimeline } from './ReadingSignals'
import { ReadingExplanation } from './ReadingExplanation'
import { AlertTriangle, Orbit, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Aspect, RelationshipAiResponse, RelationshipAnalysisMode, ReunionTimingContext } from './appTypes'
import { buildRelationshipUserSummary, type RelationshipPattern } from './lib/relationshipUserSummary'

export function RelationshipInterpretationPanel({ sajuContext, aspects, partnerExact, ai, aiLoading, aiError, onAi, analysisMode, timeSensitivePoints, formatAspect, timing, technicalDetails }: {
  sajuContext?: Record<string, unknown>;
  aspects: Aspect[]; partnerExact: boolean; ai: RelationshipAiResponse | null; aiLoading: boolean; aiError: string;
  onAi: () => void; analysisMode: RelationshipAnalysisMode; timeSensitivePoints: ReadonlySet<string>; formatAspect: (aspect: Aspect) => string;
  timing?: ReunionTimingContext | null; technicalDetails?: ReactNode
}) {
  const view = buildRelationshipUserSummary({ aspects, partnerExact, mode: analysisMode, sensitive: timeSensitivePoints, timing: analysisMode === 'reunion' ? timing : null })
  const relation = sajuContext?.available === true && sajuContext.day_master_relation && typeof sajuContext.day_master_relation === 'object' ? sajuContext.day_master_relation as Record<string, unknown> : {}
  const sajuRows = [['내가 상대를 대할 때',relation.user_to_counterpart_ten_god],['상대가 나를 대할 때',relation.counterpart_to_user_ten_god]].flatMap(([label,value])=>typeof value === 'string' && tenGodLens(value) ? [{label:String(label),value,lens:tenGodLens(value)!}] : [])
  const reunion = analysisMode === 'reunion'
  const compactPatterns = (rows: RelationshipPattern[]) => <>{rows.slice(0,2).map(interpretation)}{rows.length>2&&<details className="reading-more"><summary>패턴 {rows.length-2}개 더 보기</summary>{rows.slice(2).map(interpretation)}</details>}</>
  const interpretation = (p: RelationshipPattern) => <article className="relationship-pattern" key={p.key}><h4>{p.title}</h4><p className="reading-conclusion">{p.conclusion}</p><ReadingExplanation kind="reason">{p.reason}</ReadingExplanation><ReadingExplanation kind="practice">{p.action}</ReadingExplanation>{p.challenging&&<ReadingExplanation kind="caution">{p.caution}</ReadingExplanation>}</article>

  return <section className="relationship-experience reading-experience" data-mode={analysisMode}>
    <header className="reading-hero"><span className="celestial-mark" aria-hidden="true"><Orbit size={26}/></span><p className="eyebrow">{view.title}</p><h3>{view.headline}</h3><p className="reading-hero-subtitle">{reunion ? '다시 연락하는 계기와 관계를 회복할 준비를 나눠서 읽어봐.' : analysisMode === 'marriage_married' ? '이미 함께하는 생활 안에서 지킬 것과 조정할 것을 살펴봐.' : analysisMode === 'marriage_unmarried' ? '끌림뿐 아니라 함께 살아갈 때의 약속과 부담까지 살펴봐.' : '잘 맞는 부분과 서로 배워야 할 부분을 함께 읽어봐.'}</p></header>
    {reunion ? <>
      <section className="reading-section"><h3>재접촉 흐름</h3><ReadingDirections rows={[{kind:'incoming',label:'상대 → 나',...view.incoming},{kind:'outgoing',label:'나 → 상대',...view.outgoing},{kind:'reconnection',label:'과거 인연 재접점',...view.reconnection}]}/></section>
      <section className="reading-section"><h3>{view.stabilityTitle}<ReadingBadge kind="rebuilding"/><span className="reading-state">{view.sustainability}</span></h3><p>{view.sustainabilityText}</p></section>
      <section className="reading-section"><h3>반복될 가능성이 높은 문제</h3>{view.friction.length ? compactPatterns(view.friction) : <p>반복 갈등을 뚜렷하게 짚을 접점이 부족해. 문제가 없다는 뜻은 아니야.</p>}</section>
      <section className="reading-section"><h3>주요 시기</h3>{view.windows.length ? <ReadingTimeline events={view.windows.map(w=>({date:w.date,kind:w.kind,label:w.label,status:w.status,detail:w.detail}))}/> : <p>다른 날과 구별할 만큼 뚜렷한 시기는 없어.</p>}</section>
      {!!view.patterns.length && <section className="reading-section"><h3>관계의 핵심 패턴</h3>{compactPatterns(view.patterns)}</section>}
    </> : <>
      <div className="relationship-balance"><section><h3>{view.strengthsTitle}</h3>{view.strengths.length ? <ul>{view.strengths.slice(0, 2).map(p => <li key={p}>{p}</li>)}</ul> : <p>뚜렷하게 잘 맞는 접점은 적어.</p>}</section><section><h3>{view.frictionTitle}</h3>{view.friction.length ? <ul>{view.friction.map(p => <li key={p.key}>{p.title}</li>)}</ul> : <p>강한 충돌 접점은 적지만, 문제가 없다는 뜻은 아니야.</p>}</section></div>
      {view.sections.filter(s => s.rows.length || s.empty).map((s,index) => index<2 ? <section className="reading-section" key={s.id}><h3>{s.title}</h3>{s.rows.length ? s.rows.map(interpretation) : <p className="reading-muted">{s.empty}</p>}</section> : <details className="reading-more reading-pattern-section" key={s.id}><summary>{s.title}<small>{s.rows[0]?.title ?? '읽을 수 있는 범위'}</small></summary>{s.rows.length?s.rows.map(interpretation):<p className="reading-muted">{s.empty}</p>}</details>)}
      <section className="reading-section"><h3>{view.stabilityTitle}<ReadingBadge kind="rebuilding"/><span className="reading-state">{view.sustainability}</span></h3><p>{view.sustainabilityText}</p></section>
      <section className="reading-section"><h3>{view.practicalTitle}</h3><ReadingExplanation kind="practice">{view.practical}</ReadingExplanation></section>
    </>}
    {!!sajuRows.length&&<section className="system-saju system-lens"><h3>사주에서 읽는 관계 맥락</h3>{sajuRows.map(r=><details key={r.label}><summary>{r.label} · {r.value}</summary><p>{r.lens.meaning}</p><p>{r.lens.action}</p></details>)}<p>두 일간의 관계를 읽는 별도 층이야. 서양점성 점수와 합산하거나 상대의 감정을 추정하지 않아.</p></section>}
    <p className="reading-safety-note">{partnerExact ? '계산된 관계 패턴이야. 실제 감정이나 관계의 결과를 확정하지 않아.' : '출생시간이 검증되지 않은 요소는 제외했어. 실제 감정이나 관계의 결과를 확정하지 않아.'}</p>
    <details className="relationship-enrichment"><summary>추가 맞춤 해설</summary>
      {ai?.ok && ai.data ? <><p>{ai.data.headline}</p><p>{analysisMode === 'reunion' ? ai.data.reunion_reading?.bottom_line || ai.data.overview : analysisMode.startsWith('marriage_') ? ai.data.marriage_reading?.bottom_line || ai.data.overview : ai.data.overview}</p></> : <><p>기본 해설은 위에서 볼 수 있어. 추가 해설은 별도로 요청할 수 있어.</p><button type="button" onClick={onAi} disabled={aiLoading}><Sparkles size={16}/>{aiLoading ? '관계 흐름을 정리하고 있어…' : '추가 해설 요청'}</button></>}
      {aiError && <p className="reading-alert" role="status"><AlertTriangle size={16}/>{aiError}</p>}
    </details>
    <details className="relationship-technical"><summary>기술 근거 자세히 보기</summary>
      {technicalDetails}
      <div className="technical-aspects"><h4>관계 접점 원자료</h4>{view.ranked.map((a, i) => <p key={i}>{formatAspect(a)} · orb {a.orb.toFixed(2)}°</p>)}</div>
      {ai?.ok && ai.data && <div className="technical-ai"><h4>추가 해설 원문</h4><pre>{JSON.stringify(ai.data, null, 2)}</pre><h4>생성 정보</h4><pre>{JSON.stringify(ai.usage ?? {}, null, 2)}</pre></div>}
    </details>
  </section>
}
