import { tenGodLens } from './lib/systemReading'
import { ReadingBadge, ReadingDirections, ReadingTimeline } from './ReadingSignals'
import { ReadingExplanation } from './ReadingExplanation'
import { AlertTriangle, Orbit, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Aspect, RelationshipAiResponse, RelationshipAnalysisMode, ReunionTimingContext } from './appTypes'
import { buildRelationshipUserSummary, type RelationshipPattern } from './lib/relationshipUserSummary'
import { estimateGeminiUsage, geminiCostPreview } from './lib/aiUsage'

export function RelationshipInterpretationPanel({ sajuContext, aspects, partnerExact, ai, aiLoading, aiError, onAi, analysisMode, timeSensitivePoints, formatAspect, timing, technicalDetails }: {
  sajuContext?: Record<string, unknown>;
  aspects: Aspect[]; partnerExact: boolean; ai: RelationshipAiResponse | null; aiLoading: boolean; aiError: string;
  onAi: () => void; analysisMode: RelationshipAnalysisMode; timeSensitivePoints: ReadonlySet<string>; formatAspect: (aspect: Aspect) => string;
  timing?: ReunionTimingContext | null; technicalDetails?: ReactNode
}) {
  const view = buildRelationshipUserSummary({ aspects, partnerExact, mode: analysisMode, sensitive: timeSensitivePoints, timing: analysisMode === 'reunion' ? timing : null })
  const usage = estimateGeminiUsage(ai?.usage)
  const costPreview = geminiCostPreview('relationship')
  const relation = sajuContext?.available === true && sajuContext.day_master_relation && typeof sajuContext.day_master_relation === 'object' ? sajuContext.day_master_relation as Record<string, unknown> : {}
  const sajuRows = [['내가 상대를 대할 때',relation.user_to_counterpart_ten_god],['상대가 나를 대할 때',relation.counterpart_to_user_ten_god]].flatMap(([label,value])=>typeof value === 'string' && tenGodLens(value) ? [{label:String(label),value,lens:tenGodLens(value)!}] : [])
  const reunion = analysisMode === 'reunion'
  const leadPattern = view.patterns[0] ?? view.friction[0]
  const leadFriction = view.friction[0]
  const firstWindow = reunion ? view.windows[0] : undefined
  const strength = view.strengths[0]
  const overview = reunion ? {
    title: '재회 흐름 전체 해설',
    conclusion: `이번 흐름은 다시 연락이 닿는 계기와 실제로 관계를 다시 이어갈 준비가 같은지 따로 보는 게 핵심이야. ${view.sustainabilityText}`,
    reason: leadPattern ? `${leadPattern.reason}${leadFriction && leadFriction.key !== leadPattern.key ? ` ${leadFriction.reason}` : ''}` : '재접촉 자체보다 현재 계산에서 확인되는 관계 패턴과 유지력을 함께 봐야 해.',
    practice: firstWindow ? `${firstWindow.date}의 ${firstWindow.label} 흐름은 ${firstWindow.detail} ${leadPattern?.action ?? '실제 연락이나 만남이 생긴다면 예전과 달라진 행동이 있는지 먼저 확인해.'}` : `${leadPattern?.action ?? '실제 연락이나 만남이 생긴다면 예전과 달라진 행동이 있는지 먼저 확인해.'} 날짜 신호가 약하면 시기를 억지로 특정하지 말고 실제 행동을 기준으로 봐.`,
    caution: leadFriction ? `${leadFriction.caution} 연락이 다시 닿았다는 사실만으로 재결합이나 관계 회복이 확정됐다고 읽지는 마.` : '연락이 다시 닿았다는 사실만으로 재결합이나 관계 회복이 확정됐다고 읽지는 마.',
  } : analysisMode === 'marriage_married' ? {
    title: '결혼생활 전체 해설',
    conclusion: `현재 관계는 누가 더 맞느냐보다, 애정과 생활 책임을 어떤 방식으로 나누고 회복하는지가 더 중요해. ${strength ? `강점으로는 ${strength}이 먼저 보여.` : '뚜렷한 강점 하나보다 여러 생활 축을 같이 보는 편이 좋아.'}`,
    reason: leadPattern ? `${leadPattern.conclusion} ${leadPattern.reason}${leadFriction && leadFriction.key !== leadPattern.key ? ` 반대로 ${leadFriction.conclusion}` : ''}` : '현재 계산에서 읽을 수 있는 접점이 제한적이라 한 가지 성향으로 부부 관계 전체를 단정하지 않을게.',
    practice: `${view.practical} ${view.sustainabilityText}`,
    caution: leadFriction ? `${leadFriction.caution} 오래 함께했다는 사실과 지금 편안하게 유지되고 있다는 건 같은 뜻이 아니야.` : '갈등 접점이 적어도 생활 부담이 자동으로 사라지는 건 아니야. 말하지 않은 기대까지 합의된 것으로 보지는 마.',
  } : analysisMode === 'marriage_unmarried' ? {
    title: '결혼궁합 전체 해설',
    conclusion: `이 사람과 결혼을 생각한다면 끌림만 보지 말고, 대화·생활 방식·책임을 실제로 함께 감당할 수 있는지까지 봐야 해. ${strength ? `지금 계산에서는 ${strength}이 관계의 강점으로 보여.` : '한 가지 강점보다 여러 관계 축을 같이 보는 편이 좋아.'}`,
    reason: leadPattern ? `${leadPattern.conclusion} ${leadPattern.reason}${leadFriction && leadFriction.key !== leadPattern.key ? ` 동시에 ${leadFriction.conclusion}` : ''}` : '두 사람 사이에서 검증 가능한 접점만 남겨 읽고 있어서 특정 성격이나 미래를 억지로 채우지 않았어.',
    practice: `${view.practical} ${view.sustainabilityText}`,
    caution: leadFriction ? `${leadFriction.caution} 호감과 결혼 결정은 다른 단계이니 생활 조건과 약속을 실제 대화로 확인해.` : '잘 맞는 접점이 보여도 생활비, 집안일, 가족 관계, 혼자 쉴 시간 같은 조건까지 자동으로 맞는다는 뜻은 아니야.',
  } : {
    title: '궁합 전체 해설',
    conclusion: `이 관계는 한 줄로 좋은 궁합·나쁜 궁합을 정하기보다, 자연스럽게 맞는 부분과 반복해서 조정해야 할 부분을 같이 보는 게 맞아. ${strength ? `가장 먼저 보이는 강점은 ${strength}이야.` : '뚜렷한 강점 하나보다 여러 접점을 함께 보는 편이 좋아.'}`,
    reason: leadPattern ? `${leadPattern.conclusion} ${leadPattern.reason}${leadFriction && leadFriction.key !== leadPattern.key ? ` 반면 ${leadFriction.conclusion}` : ''}` : '계산 가능한 접점만으로 관계의 특징을 읽고 있어. 상대의 속마음이나 관계 결과를 빈칸처럼 채우지는 않아.',
    practice: `${view.practical} ${view.sustainabilityText}`,
    caution: leadFriction ? `${leadFriction.caution} 한 번의 강한 끌림이나 한 번의 갈등만으로 관계 전체를 판단하지 마.` : '강한 충돌 접점이 적더라도 모든 생활 방식이 맞는다는 뜻은 아니야. 실제 약속과 행동을 같이 확인해.',
  }
  const compactPatterns = (rows: RelationshipPattern[]) => <>{rows.slice(0,2).map(interpretation)}{rows.length>2&&<details className="reading-more"><summary>패턴 {rows.length-2}개 더 보기</summary>{rows.slice(2).map(interpretation)}</details>}</>
  const interpretation = (p: RelationshipPattern) => <article className="relationship-pattern" key={p.key}><h4>{p.title}</h4><p className="reading-conclusion">{p.conclusion}</p><ReadingExplanation kind="reason">{p.reason}</ReadingExplanation><ReadingExplanation kind="practice">{p.action}</ReadingExplanation>{p.challenging&&<ReadingExplanation kind="caution">{p.caution}</ReadingExplanation>}</article>

  return <section className="relationship-experience reading-experience" data-mode={analysisMode}>
    <header className="reading-hero"><span className="celestial-mark" aria-hidden="true"><Orbit size={26}/></span><p className="eyebrow">{view.title}</p><h3>{view.headline}</h3><p className="reading-hero-subtitle">{reunion ? '다시 연락하는 계기와 관계를 회복할 준비를 나눠서 읽어봐.' : analysisMode === 'marriage_married' ? '이미 함께하는 생활 안에서 지킬 것과 조정할 것을 살펴봐.' : analysisMode === 'marriage_unmarried' ? '끌림뿐 아니라 함께 살아갈 때의 약속과 부담까지 살펴봐.' : '잘 맞는 부분과 서로 배워야 할 부분을 함께 읽어봐.'}</p></header>
    {ai?.ok && ai.data ? <section className="reading-section relationship-natural-reading"><h3>{ai.data.headline}</h3><p className="reading-conclusion">{analysisMode === 'reunion' ? ai.data.reunion_reading?.bottom_line || ai.data.overview : analysisMode.startsWith('marriage_') ? ai.data.marriage_reading?.bottom_line || ai.data.overview : ai.data.overview}</p>{analysisMode==='reunion' ? <><ReadingExplanation kind="reason">{[ai.data.reunion_reading?.incoming_contact,ai.data.reunion_reading?.outgoing_contact].filter(Boolean).join(' ')}</ReadingExplanation><ReadingExplanation kind="timing">{[ai.data.reunion_reading?.reconnection_windows,ai.data.reunion_reading?.low_windows].filter(Boolean).join(' ')}</ReadingExplanation><ReadingExplanation kind="caution">{[ai.data.reunion_reading?.relationship_filter,ai.data.reunion_reading?.precision_note].filter(Boolean).join(' ')}</ReadingExplanation></> : analysisMode.startsWith('marriage_') ? <><ReadingExplanation kind="reason">{[ai.data.marriage_reading?.bond,ai.data.marriage_reading?.emotional_home].filter(Boolean).join(' ')}</ReadingExplanation><ReadingExplanation kind="practice">{[ai.data.marriage_reading?.daily_life,ai.data.marriage_reading?.intimacy_resources,ai.data.marriage_reading?.conflict_repair].filter(Boolean).join(' ')}</ReadingExplanation><ReadingExplanation kind="timing">{[ai.data.marriage_reading?.commitment_or_current_cycle,ai.data.marriage_reading?.timing].filter(Boolean).join(' ')}</ReadingExplanation><ReadingExplanation kind="caution">{[ai.data.marriage_reading?.caution,ai.data.marriage_reading?.precision_note].filter(Boolean).join(' ')}</ReadingExplanation></> : <><ReadingExplanation kind="reason">{[ai.data.chemistry,ai.data.emotional_dynamic,ai.data.communication].filter(Boolean).join(' ')}</ReadingExplanation><ReadingExplanation kind="practice">{[ai.data.long_term,...(ai.data.practical_advice??[])].filter(Boolean).join(' ')}</ReadingExplanation><ReadingExplanation kind="timing">{ai.data.timing}</ReadingExplanation><ReadingExplanation kind="caution">{[ai.data.conflict_pattern,ai.data.power_boundaries].filter(Boolean).join(' ')}</ReadingExplanation></>}</section> : <section className="reading-section relationship-natural-reading is-ready"><h3>Gemini 자연어 해설</h3><p>계산은 끝났어. 저장된 자연어 해설이 없으면 한 번 생성해. 생성한 해설은 다시 비용이 들지 않도록 저장해둘게.</p><p className="reading-muted">{costPreview.label}</p><button type="button" onClick={onAi} disabled={aiLoading}><Sparkles size={16}/>{aiLoading ? '관계 흐름을 정리하고 있어…' : '자연어 해설 생성'}</button>{aiError && <p className="reading-alert" role="status"><AlertTriangle size={16}/>{aiError}</p>}</section>}
    {ai?.ok && ai.data && usage?.total_tokens ? <details className="ai-meta-details"><summary>해설 생성 정보</summary><div className="ai-usage-card"><strong>Gemini API 사용량 · 예상 비용</strong><span>입력 {(usage.prompt_tokens ?? 0).toLocaleString()} · 본문 출력 {(usage.candidate_tokens ?? 0).toLocaleString()} · 사고 {(usage.thought_tokens ?? 0).toLocaleString()} token(토큰)</span><b>누적 예상비용 ${Number(usage.estimated_usd ?? 0).toFixed(4)} ≈ {Math.round(usage.estimated_krw ?? 0).toLocaleString()}원</b><small>실제 Gemini 호출 {usage.attempt_count ?? 1}회 · 최대 2회 · 저장본 재열람은 재호출이 없으면 0원</small></div></details> : null}
    <details className="relationship-calculated-fallback" open={!(ai?.ok && ai.data)}><summary>계산 기반 보조 해설</summary>
    <section className="reading-section relationship-full-reading"><h3>{overview.title}</h3><p className="reading-conclusion">{overview.conclusion}</p><ReadingExplanation kind="reason">{overview.reason}</ReadingExplanation><ReadingExplanation kind="practice">{overview.practice}</ReadingExplanation><ReadingExplanation kind="caution">{overview.caution}</ReadingExplanation></section>
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
    </details>
    <p className="reading-safety-note">{partnerExact ? '계산된 관계 패턴이야. 실제 감정이나 관계의 결과를 확정하지 않아.' : '출생시간이 검증되지 않은 요소는 제외했어. 실제 감정이나 관계의 결과를 확정하지 않아.'}</p>
    <details className="relationship-technical"><summary>기술 근거 자세히 보기</summary>
      {technicalDetails}
      <div className="technical-aspects"><h4>관계 접점 원자료</h4>{view.ranked.map((a, i) => <p key={i}>{formatAspect(a)} · orb {a.orb.toFixed(2)}°</p>)}</div>
      {ai?.ok && ai.data && <div className="technical-ai"><h4>추가 해설 원문</h4><pre>{JSON.stringify(ai.data, null, 2)}</pre><h4>생성 정보</h4><pre>{JSON.stringify(ai.usage ?? {}, null, 2)}</pre></div>}
    </details>
  </section>
}
