import { ReadingExplanation } from './ReadingExplanation'
import { AlertTriangle, Orbit, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Aspect, RelationshipAiResponse, RelationshipAnalysisMode, ReunionTimingContext } from './appTypes'
import { buildRelationshipUserSummary, type RelationshipPattern } from './lib/relationshipUserSummary'

export function RelationshipInterpretationPanel({ aspects, partnerExact, ai, aiLoading, aiError, onAi, analysisMode, timeSensitivePoints, formatAspect, timing, technicalDetails }: {
  aspects: Aspect[]; partnerExact: boolean; ai: RelationshipAiResponse | null; aiLoading: boolean; aiError: string;
  onAi: () => void; analysisMode: RelationshipAnalysisMode; timeSensitivePoints: ReadonlySet<string>; formatAspect: (aspect: Aspect) => string;
  timing?: ReunionTimingContext | null; technicalDetails?: ReactNode
}) {
  const view = buildRelationshipUserSummary({ aspects, partnerExact, mode: analysisMode, sensitive: timeSensitivePoints, timing: analysisMode === 'reunion' ? timing : null })
  const reunion = analysisMode === 'reunion'
  const timingGroups = [...new Set(view.windows.map(w => w.date))].map(date => ({ date, windows: view.windows.filter(w => w.date === date) }))
  const interpretation = (p: RelationshipPattern) => <article className="relationship-pattern" key={p.key}><h4>{p.title}</h4><p className="reading-conclusion">{p.conclusion}</p><ReadingExplanation kind="reason">{p.reason}</ReadingExplanation><ReadingExplanation kind="practice">{p.action}</ReadingExplanation>{p.challenging&&<ReadingExplanation kind="caution">{p.caution}</ReadingExplanation>}</article>
  const direction = (label: string, item: typeof view.incoming) => <div className="contact-row" key={label}><div><h4>{label}</h4><span className="direction-band">{item.band}</span></div><p>{item.text}</p>{item.timing&&<time className="contact-timing">{item.timing}</time>}</div>
  return <section className="relationship-experience reading-experience" data-mode={analysisMode}>
    <header className="reading-hero"><span className="celestial-mark" aria-hidden="true"><Orbit size={26}/></span><p className="eyebrow">{view.title}</p><h3>{view.headline}</h3><p className="reading-hero-subtitle">{reunion ? '다시 연락하는 계기와 관계를 회복할 준비를 나눠서 읽어봐.' : analysisMode === 'marriage_married' ? '이미 함께하는 생활 안에서 지킬 것과 조정할 것을 살펴봐.' : analysisMode === 'marriage_unmarried' ? '끌림뿐 아니라 함께 살아갈 때의 약속과 부담까지 살펴봐.' : '잘 맞는 부분과 서로 배워야 할 부분을 함께 읽어봐.'}</p></header>
    {reunion ? <>
      <section className="reading-section"><h3>재접촉 흐름</h3><div className="contact-directions">{direction('상대 → 나', view.incoming)}{direction('나 → 상대', view.outgoing)}{direction('과거 인연 재접점', view.reconnection)}</div></section>
      <section className="reading-section"><h3>{view.stabilityTitle}<span className="direction-band">{view.sustainability}</span></h3><p>{view.sustainabilityText}</p></section>
      <section className="reading-section"><h3>반복될 가능성이 높은 문제</h3>{view.friction.length ? view.friction.map(interpretation) : <p>반복 갈등을 뚜렷하게 짚을 접점이 부족해. 문제가 없다는 뜻은 아니야.</p>}</section>
      <section className="reading-section"><h3>주요 시기</h3>{view.windows.length ? <ol className="reading-timeline">{timingGroups.map(group => <li key={group.date}><time>{group.date}</time>{group.windows.map(w => <span className={`reading-window-line is-${w.band === '약함' ? 'caution' : w.band === '강함' ? 'favorable' : 'mixed'}`} key={w.label}><small>{w.band === '약함' ? '주의' : w.band === '강함' ? '활용' : '혼합'}</small>{w.label} · {w.band}</span>)}</li>)}</ol> : <p>다른 날과 구별할 만큼 뚜렷한 시기는 없어.</p>}</section>
      {!!view.patterns.length && <section className="reading-section"><h3>관계의 핵심 패턴</h3>{view.patterns.map(interpretation)}</section>}
    </> : <>
      <div className="relationship-balance"><section><h3>{view.strengthsTitle}</h3>{view.strengths.length ? <ul>{view.strengths.slice(0, 2).map(p => <li key={p}>{p}</li>)}</ul> : <p>뚜렷하게 잘 맞는 접점은 적어.</p>}</section><section><h3>{view.frictionTitle}</h3>{view.friction.length ? <ul>{view.friction.map(p => <li key={p.key}>{p.title}</li>)}</ul> : <p>강한 충돌 접점은 적지만, 문제가 없다는 뜻은 아니야.</p>}</section></div>
      {view.sections.filter(s => s.rows.length || s.empty).map(s => <section className="reading-section" key={s.id}><h3>{s.title}</h3>{s.rows.length ? s.rows.map(interpretation) : <p className="reading-muted">{s.empty}</p>}</section>)}
      <section className="reading-section"><h3>{view.stabilityTitle}<span className="direction-band">{view.sustainability}</span></h3><p>{view.sustainabilityText}</p></section>
      <section className="reading-section"><h3>{view.practicalTitle}</h3><ReadingExplanation kind="practice">{view.practical}</ReadingExplanation></section>
    </>}
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
