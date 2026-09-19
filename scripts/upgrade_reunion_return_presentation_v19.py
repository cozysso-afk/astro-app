from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


# Return calculation: keep Return as a bounded context/tie-break layer --------
ret_path = Path("relationship_return_v1.py")
ret = ret_path.read_text(encoding="utf-8")
ret = replace_once(
    ret,
    'ENGINE_VERSION = "relationship-return-v1.0-solar-lunar-context"',
    'ENGINE_VERSION = "relationship-return-v1.1-bounded-context-presentation"\nFAST_TRIGGER_WEIGHT = 0.85\nRETURN_CONTEXT_WEIGHT = 0.15',
    "return engine/version weights",
)
ret = replace_once(
    ret,
    '            "priority_index": round(fast_score * 0.85 + background * 0.15, 1),\n            "exact_date_basis": "fast_transit_trigger",\n            "return_role": "background_tiebreaker_only",',
    '            "priority_index": round(fast_score * FAST_TRIGGER_WEIGHT + background * RETURN_CONTEXT_WEIGHT, 1),\n            "exact_date_basis": "fast_transit_trigger",\n            "return_role": "background_tiebreaker_only",\n            "priority_components": {\n                "fast_trigger_weight": FAST_TRIGGER_WEIGHT,\n                "return_context_weight": RETURN_CONTEXT_WEIGHT,\n                "return_weight_cap": RETURN_CONTEXT_WEIGHT,\n            },',
    "candidate weight decomposition",
)
ret = replace_once(
    ret,
    '        "candidate_dates": candidates[:16],\n        "policy": (',
    '        "candidate_dates": candidates[:16],\n        "weight_policy": {\n            "fast_trigger_weight": FAST_TRIGGER_WEIGHT,\n            "return_context_weight": RETURN_CONTEXT_WEIGHT,\n            "return_weight_cap": RETURN_CONTEXT_WEIGHT,\n            "meaning": "Return can only re-rank dates that already passed the fast-trigger gate; it never creates a date or event probability.",\n        },\n        "display_policy": {\n            "main_labels": ["연간 배경", "월간 배경"],\n            "technical_labels": ["Solar Return(태양회귀)", "Lunar Return(달회귀)"],\n            "initiative_use": "forbidden",\n        },\n        "policy": (',
    "return support policy metadata",
)
ret_path.write_text(ret, encoding="utf-8")


# Evidence: Return activation is never a first-contact direction signal -------
ev_path = Path("supabase/functions/relationship-interpret-v9-preview/reunionEvidenceV2.ts")
ev = ev_path.read_text(encoding="utf-8")
ev = replace_once(
    ev,
    "export const REUNION_EVIDENCE_VERSION = 'reunion-evidence-v2.3-solar-lunar-return-context'",
    "export const REUNION_EVIDENCE_VERSION = 'reunion-evidence-v2.4-return-neutral-direction'",
    "evidence version",
)
ev = replace_once(
    ev,
    "  const directionFor = (person: string): Evidence['direction'] => person === 'counterpart' ? 'incoming' : person === 'user' ? 'outgoing' : 'shared'\n",
    "",
    "remove return person-direction mapping",
)
ev = replace_once(
    ev,
    "          `independent_bonus_eligible=false`,\n          ...arr(row?.top_aspects)",
    "          `independent_bonus_eligible=false`,\n          `directional_use=forbidden`,\n          ...arr(row?.top_aspects)",
    "return directional-use fact",
)
ev = replace_once(
    ev,
    "          role:'context', direction:directionFor(person), period:start && end ? `${start}..${end}` : start || null,",
    "          role:'context', direction:'shared', period:start && end ? `${start}..${end}` : start || null,",
    "return evidence neutral direction",
)
ev = replace_once(
    ev,
    "Return context may cross-check or break ties among dates that already passed the fast-trigger gate, but never creates an exact date and never adds an independent convergence vote against the same underlying transit phenomenon.",
    "Return context may cross-check or break ties among dates that already passed the fast-trigger gate, but never creates an exact date and never adds an independent convergence vote against the same underlying transit phenomenon. Return activation is non-directional and cannot identify who contacts first.",
    "return evidence policy direction",
)
ev_path.write_text(ev, encoding="utf-8")


# Gemini interpretation: cache break + prose policy -------------------------
idx_path = Path("supabase/functions/relationship-interpret-v9-preview/index.ts")
idx = idx_path.read_text(encoding="utf-8")
idx = replace_once(
    idx,
    'const REUNION_VERSION="relationship-v11.12-solar-lunar-return-context";',
    'const REUNION_VERSION="relationship-v11.13-return-background-presentation";',
    "reunion interpreter version",
)
return_rule = "- CALCULATED_DATA.reunion_return_support의 Solar Return(태양회귀)은 연간 배경, Lunar Return(달회귀)은 월간·정서 배경으로만 사용한다. Return만으로 구체 날짜를 만들지 말고, 이미 fast transit trigger를 통과한 날짜들 사이에서 배경 교차검증/동률 해소에만 사용한다. 같은 천문 현상을 transit과 Return으로 중복 가산하지 않는다."
idx = replace_once(
    idx,
    return_rule,
    return_rule + "\n- Return에서 user/counterpart 쪽이 활성됐다는 사실은 선연락 방향 근거가 아니다. Return은 initiative(누가 먼저 움직이는가) 판정에 사용하지 말고, 방향은 initiative_gate가 available일 때만 따른다.\n- 사용자 본문에서는 Solar Return/Lunar Return 기술명을 앞세우지 말고 각각 '연간 배경', '월간 배경'으로 먼저 풀어 쓴다. 기술명은 정밀도·근거 설명에서만 병기한다.",
    "reunion return prose policy",
)
idx_path.write_text(idx, encoding="utf-8")


# Browser cache must follow the new semantics -------------------------------
cache_path = Path("web/src/lib/readingCache.ts")
cache = cache_path.read_text(encoding="utf-8")
cache = replace_once(
    cache,
    "const RELATIONSHIP_REUNION_AI_CACHE_CONTRACT = 'relationship-v11.12-solar-lunar-return-context-v1'",
    "const RELATIONSHIP_REUNION_AI_CACHE_CONTRACT = 'relationship-v11.13-return-background-presentation-v1'",
    "reunion browser cache",
)
cache_path.write_text(cache, encoding="utf-8")


# External-copy prompt follows identical policy -----------------------------
fmt_path = Path("web/src/lib/resultFormatters.ts")
fmt = fmt_path.read_text(encoding="utf-8")
old_fmt = "kind === 'reunion' ? '- 재회운은 reunion_dimensions의 감정 활성 / 연락·재접촉 / 실제 만남 / 관계 재결합을 분리한다. incoming/outgoing은 상대측/내측 활성이지 행동 방향이 아니다. reunion_secondary_support는 진행계열 기간 배경이며 exact date를 만들지 않는다. reunion_return_support의 Solar Return(태양회귀)은 연간 배경, Lunar Return(달회귀)은 월간·정서 배경이다. Return은 fast trigger를 통과한 날짜를 교차검증하는 보조층일 뿐 날짜를 새로 만들거나 같은 transit을 중복 가산하지 않는다.' : '',"
new_fmt = "kind === 'reunion' ? '- 재회운은 reunion_dimensions의 감정 활성 / 연락·재접촉 / 실제 만남 / 관계 재결합을 분리한다. incoming/outgoing은 상대측/내측 활성이지 행동 방향이 아니다. reunion_secondary_support는 진행계열 기간 배경이며 exact date를 만들지 않는다. reunion_return_support의 Solar Return(태양회귀)은 연간 배경, Lunar Return(달회귀)은 월간·정서 배경이다. Return은 fast trigger를 통과한 날짜를 교차검증하는 보조층일 뿐 날짜를 새로 만들거나 같은 transit을 중복 가산하지 않는다. Return의 user/counterpart 활성은 선연락 방향 근거로 쓰지 않는다. 본문에서는 기술명보다 연간 배경/월간 배경이라는 사용자 언어를 먼저 쓴다.' : '',"
fmt = replace_once(fmt, old_fmt, new_fmt, "external return presentation policy")
fmt_path.write_text(fmt, encoding="utf-8")


# Type contract: expose calculated Return support to the presentation layer --
types_path = Path("web/src/appTypes.ts")
types = types_path.read_text(encoding="utf-8")
types = replace_once(
    types,
    "      directional_context?: ReunionTimingContext\n    }\n  }\n}\n\nexport type RelationshipAiResponse",
    "      directional_context?: ReunionTimingContext\n    }\n    reunion_return_support?: Record<string, unknown>\n  }\n}\n\nexport type RelationshipAiResponse",
    "relationship return support type",
)
types_path.write_text(types, encoding="utf-8")


# Wire the calculated Return support into the relationship reading -----------
app_path = Path("web/src/AppNext.tsx")
app = app_path.read_text(encoding="utf-8")
app = replace_once(
    app,
    "                timing={relationshipResult.result.reunion_transits?.directional_context ?? reunionTiming}\n                technicalDetails=",
    "                timing={relationshipResult.result.reunion_transits?.directional_context ?? reunionTiming}\n                returnSupport={relationshipResult.result.reunion_return_support ?? null}\n                technicalDetails=",
    "wire return support to panel",
)
app_path.write_text(app, encoding="utf-8")


# User-facing reading: human labels first, technical names in details only ---
panel_path = Path("web/src/RelationshipInterpretationPanel.tsx")
panel = panel_path.read_text(encoding="utf-8")
panel = replace_once(
    panel,
    "export function RelationshipInterpretationPanel({ sajuContext, aspects, partnerExact, ai, aiLoading, aiError, onAi, analysisMode, timeSensitivePoints, formatAspect, timing, technicalDetails }: {",
    "export function RelationshipInterpretationPanel({ sajuContext, aspects, partnerExact, ai, aiLoading, aiError, onAi, analysisMode, timeSensitivePoints, formatAspect, timing, returnSupport, technicalDetails }: {",
    "panel return support prop",
)
panel = replace_once(
    panel,
    "  timing?: ReunionTimingContext | null; technicalDetails?: ReactNode\n}) {",
    "  timing?: ReunionTimingContext | null; returnSupport?: Record<string, unknown> | null; technicalDetails?: ReactNode\n}) {",
    "panel return support prop type",
)
summary_block = r'''  const reunionReturnSummary = (() => {
    if (!reunion || !returnSupport || typeof returnSupport !== 'object') return null
    const support = returnSupport as any
    const rows = (value: unknown): any[] => Array.isArray(value) ? value : []
    const numberOrNull = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : null
    const band = (score: number) => score >= 65 ? '강하게' : score >= 45 ? '보통 이상으로' : score >= 25 ? '가볍게' : '약하게'
    const monthLabel = (value: unknown) => {
      const raw = String(value ?? '')
      const match = /^(\d{4})-(\d{2})$/.exec(raw)
      return match ? `${match[1]}년 ${Number(match[2])}월` : raw
    }
    const periodStart = String(support?.period?.start ?? timing?.period.start ?? '')
    const activeSolar = (person: 'user'|'counterpart') => {
      const events = rows(support?.solar_return?.[person]?.events)
      if (!events.length) return null
      return events.find((event:any) => {
        const start = String(event?.window_start ?? '')
        const end = String(event?.window_end_exclusive ?? '')
        return !!periodStart && start <= periodStart && (!end || periodStart < end)
      }) ?? events[0]
    }
    const solarValues = [activeSolar('user'), activeSolar('counterpart')]
      .map((event:any) => numberOrNull(event?.activation_score))
      .filter((value): value is number => value !== null)
    const annualScore = solarValues.length ? solarValues.reduce((sum,value)=>sum+value,0) / solarValues.length : null
    const lunarRows = rows(support?.monthly_context)
      .map((row:any) => ({ month:String(row?.calendar_month ?? ''), score:numberOrNull(row?.lunar_return?.pair_activation_score) }))
      .filter((row:any) => row.month && row.score !== null && row.score > 0)
      .sort((a:any,b:any) => b.score-a.score || a.month.localeCompare(b.month))
    const topLunar = lunarRows.slice(0,2)
    const candidates = rows(support?.candidate_dates)
    const annualText = annualScore === null
      ? '연간 관계 배경은 계산 가능한 근거가 부족해서 별도 강도를 붙이지 않았어.'
      : `연간 관계 배경은 ${band(annualScore)} 활성돼 있어. 관계 문제를 다시 의식하거나 정리하는 분위기가 두드러질 수 있다는 뜻이지, 연락이나 재결합 확률을 뜻하지는 않아.`
    const monthlyText = topLunar.length
      ? `${topLunar.map((row:any)=>monthLabel(row.month)).join(' · ')}의 월간 배경이 상대적으로 도드라져. 감정과 관계 주제가 올라오기 쉬운 달이라는 뜻이고, 실제 연락·만남은 빠른 행동 트리거가 따로 겹쳐야 해.`
      : '월간 배경에서 따로 강조할 구간은 잡히지 않았어. 생시가 없으면 달 기반 월간 배경은 계산하지 않아.'
    return { annualScore, annualText, monthlyText, topLunar, candidateCount:candidates.length }
  })()

'''
panel = replace_once(
    panel,
    "  const leadPattern = view.patterns[0] ?? view.friction[0]\n",
    summary_block + "  const leadPattern = view.patterns[0] ?? view.friction[0]\n",
    "insert return summary",
)
block_jsx = r'''  const returnContextBlock = reunionReturnSummary ? <section className="reunion-ai-block reunion-return-context">
    <h4>연간·월간 배경</h4>
    <div className="reunion-return-context-grid">
      <article className="reunion-return-context-card"><b>연간 배경</b><p>{reunionReturnSummary.annualText}</p></article>
      <article className="reunion-return-context-card"><b>월간 배경</b><p>{reunionReturnSummary.monthlyText}</p></article>
    </div>
    <p className="reunion-return-rule">구체 날짜는 빠른 사건 트리거가 먼저 통과한 후보만 쓰고, 이 배경층은 후보 우선순위를 최대 15%만 조정해.</p>
    <details className="reunion-precision-note reunion-return-technical"><summary>왜 이렇게 봤어?</summary>
      <p>Solar Return(태양회귀)은 연간 배경, Lunar Return(달회귀)은 월간·정서 배경으로만 계산해. 둘 다 연락 날짜를 새로 만들거나 누가 먼저 연락할지를 정하는 근거로 쓰지 않아.</p>
      {reunionReturnSummary.annualScore !== null && <p>연간 배경 활성값 {reunionReturnSummary.annualScore.toFixed(1)} · 사건 확률 아님</p>}
      {reunionReturnSummary.topLunar.length>0 && <p>월간 배경 상위: {reunionReturnSummary.topLunar.map((row:any)=>`${row.month} ${row.score.toFixed(1)}`).join(' · ')}</p>}
      <p>빠른 트리거 85% + Return 배경 최대 15% · 후보 날짜 {reunionReturnSummary.candidateCount}개 안에서만 순위를 보정해.</p>
    </details>
  </section> : null

'''
panel = replace_once(
    panel,
    "  const dateFocus = reunionDateHighlights.length ?",
    block_jsx + "  const dateFocus = reunionDateHighlights.length ?",
    "insert return context block",
)
panel = replace_once(
    panel,
    "        <section className=\"reunion-ai-snapshot\"><h4>누가 먼저 움직일 흐름인가</h4>",
    "        {returnContextBlock}\n        <section className=\"reunion-ai-snapshot\"><h4>누가 먼저 움직일 흐름인가</h4>",
    "render return context in AI reading",
)
panel = replace_once(
    panel,
    "        <section className=\"reading-section\"><h3>재접촉 흐름</h3><ReadingDirections rows={[{kind:'incoming',label:'상대 → 나',...view.incoming},{kind:'outgoing',label:'나 → 상대',...view.outgoing},{kind:'reconnection',label:'과거 인연 재접점',...view.reconnection}]}/></section>\n",
    "        <section className=\"reading-section\"><h3>재접촉 흐름</h3><ReadingDirections rows={[{kind:'incoming',label:'상대 → 나',...view.incoming},{kind:'outgoing',label:'나 → 상대',...view.outgoing},{kind:'reconnection',label:'과거 인연 재접점',...view.reconnection}]}/></section>\n        {returnContextBlock}\n",
    "render return context in calculated fallback",
)
panel_path.write_text(panel, encoding="utf-8")


# Lightweight styles --------------------------------------------------------
css_path = Path("web/src/reunion-reading-product-v13.css")
css = css_path.read_text(encoding="utf-8")
marker = "/* Return context presentation v19 */"
if marker not in css:
    css += r'''

/* Return context presentation v19 */
.app-shell .relationship-experience[data-mode='reunion'] .reunion-return-context-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
  margin: 9px 0 6px;
}
.app-shell .relationship-experience[data-mode='reunion'] .reunion-return-context-card {
  min-width: 0;
  padding: 11px 12px;
  border: 1px solid rgba(112, 91, 142, 0.14);
  border-radius: 15px;
  background: rgba(255,255,255,0.62);
}
.app-shell .relationship-experience[data-mode='reunion'] .reunion-return-context-card b {
  display: block;
  margin-bottom: 5px;
  font-size: .9rem;
}
.app-shell .relationship-experience[data-mode='reunion'] .reunion-return-context-card p,
.app-shell .relationship-experience[data-mode='reunion'] .reunion-return-rule {
  margin: 0;
  line-height: 1.58;
}
.app-shell .relationship-experience[data-mode='reunion'] .reunion-return-rule {
  margin-top: 7px;
  font-size: .8rem;
  opacity: .72;
}
@media (max-width: 480px) {
  .app-shell .relationship-experience[data-mode='reunion'] .reunion-return-context-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
'''
css_path.write_text(css, encoding="utf-8")


# Tests --------------------------------------------------------------------
ret_test_path = Path("tests/test_relationship_returns_v18.py")
ret_test = ret_test_path.read_text(encoding="utf-8")
ret_test = replace_once(
    ret_test,
    '    assert all(row["event_probability"] == "not_calculated" for row in support["candidate_dates"])\n',
    '    assert all(row["event_probability"] == "not_calculated" for row in support["candidate_dates"])\n    assert support["weight_policy"]["fast_trigger_weight"] == 0.85\n    assert support["weight_policy"]["return_context_weight"] == 0.15\n    assert support["display_policy"]["initiative_use"] == "forbidden"\n    for row in support["candidate_dates"]:\n        expected = round(row["fast_trigger_score"] * 0.85 + row["return_context"]["background_score"] * 0.15, 1)\n        assert row["priority_index"] == expected\n        assert row["priority_components"]["return_weight_cap"] == 0.15\n',
    "return weight assertions",
)
ret_test_path.write_text(ret_test, encoding="utf-8")

ev_test_path = Path("supabase/functions/relationship-interpret-v9-preview/reunionEvidenceV2.test.mjs")
ev_test = ev_test_path.read_text(encoding="utf-8")
ev_test = replace_once(
    ev_test,
    "assert.equal(out.version,'reunion-evidence-v2.3-solar-lunar-return-context')",
    "assert.equal(out.version,'reunion-evidence-v2.4-return-neutral-direction')",
    "evidence test version",
)
ev_test = replace_once(
    ev_test,
    "  assert.ok(returns.every(e=>e.role==='context'))\n",
    "  assert.ok(returns.every(e=>e.role==='context'))\n  assert.ok(returns.every(e=>e.direction==='shared'))\n  assert.ok(returns.every(e=>e.question!=='initiative'))\n",
    "return direction test",
)
ev_test_path.write_text(ev_test, encoding="utf-8")

contract_path = Path("web/src/lib/relationshipReunionV2.contract.test.mjs")
contract = contract_path.read_text(encoding="utf-8")
contract = contract.replace('relationship-v11\\.12-solar-lunar-return-context', 'relationship-v11\\.13-return-background-presentation')
contract = replace_once(
    contract,
    "  assert.match(panel,/날짜로 좁혀 보면/)\n",
    "  assert.match(panel,/날짜로 좁혀 보면/)\n  assert.match(panel,/연간·월간 배경/)\n  assert.match(panel,/왜 이렇게 봤어\?/)\n  assert.match(panel,/returnSupport/)\n",
    "return presentation contract",
)
contract_path.write_text(contract, encoding="utf-8")

pipeline_path = Path("web/src/lib/relationshipEvidencePipeline.test.mjs")
pipeline = pipeline_path.read_text(encoding="utf-8")
pipeline = pipeline.replace('relationship-v11\\.12-solar-lunar-return-context', 'relationship-v11\\.13-return-background-presentation')
pipeline = pipeline.replace('relationship-v11\\.12-solar-lunar-return-context-v1', 'relationship-v11\\.13-return-background-presentation-v1')
pipeline_path.write_text(pipeline, encoding="utf-8")

mode_path = Path("web/src/lib/relationshipModeContract.test.mjs")
mode = mode_path.read_text(encoding="utf-8")
mode = mode.replace('relationship-v11\\.12-solar-lunar-return-context-v1', 'relationship-v11\\.13-return-background-presentation-v1')
mode_path.write_text(mode, encoding="utf-8")

print("reunion return presentation v19 applied")
