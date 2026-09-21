from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one match, found {count}')
    p.write_text(text.replace(old, new, 1))


replace_once(
    'web/src/lib/readingCache.ts',
    "const RELATIONSHIP_REUNION_AI_CACHE_CONTRACT = 'relationship-v12.0-hierarchical-timing-v1'",
    "const RELATIONSHIP_REUNION_AI_CACHE_CONTRACT = 'relationship-v12.1-hierarchy-presentation-v2'",
)

replace_once(
    'supabase/functions/relationship-interpret-v9-preview/index.ts',
    'const REUNION_VERSION="relationship-v12.0-hierarchical-timing";',
    'const REUNION_VERSION="relationship-v12.1-hierarchy-presentation";',
)

old_instruction = '''재회운이다. 감정 활성→연락·재접촉→실제 만남→관계 재결합을 네 개의 독립 단계로 읽고 절대 자동 승격하지 마라. reunion_evidence_v2의 다섯 질문을 순서대로 종합하되 initiative_gate가 닫혀 있으면 누가 먼저 연락하는지 판정하지 않는다. 날짜와 기간은 reunion_hierarchy의 관문을 통과한 후보만 사용한다. 기존 빠른 트랜짓이나 진행각으로 날짜를 새로 만들지 않는다. 같은 원자료 파생 신호를 여러 표에서 반복해 강도를 부풀리지 말고, 독립 계열이 충돌하면 평균내지 말고 단계별로 왜 다른지 설명하라. 범용 상담문구 대신 차트 레이어 간 일치·충돌을 현실 관계 장면으로 번역하라.'''
new_instruction = '''재회운이다. 감정 활성→연락·재접촉→실제 만남→관계 재결합을 네 개의 독립 단계로 읽고 절대 자동 승격하지 마라. reunion_evidence_v2의 다섯 질문을 순서대로 종합하되 initiative_gate가 닫혀 있으면 누가 먼저 연락하는지 판정하지 않는다. 날짜와 기간은 reunion_hierarchy의 오늘 이후 top_periods 및 nearest_window가 제공한 문자열만 그대로 인용한다. 날짜 문자열을 새로 만들거나, 이미 지난 날짜를 미래 핵심 시기처럼 제시하거나, 기존 빠른 트랜짓·진행각·Return 배경으로 새 날짜를 만들어서는 안 된다. hierarchy에 없는 월·기간을 핵심 시기로 승격하지 않는다. 같은 원자료 파생 신호를 여러 표에서 반복해 강도를 부풀리지 말고, 독립 계열이 충돌하면 평균내지 말고 단계별 차이를 설명하라. natal/시너스트리처럼 매 계산에서 고정되는 관계 구조는 짧게 요약하고, 이번 조회에서 달라진 stage·nearest window·future top periods를 우선 설명한다. '카르마적 인연', '운명적 인연', '끊을 수 없는 인연'처럼 검증 불가능한 숙명 표현을 쓰지 않는다. 범용 상담문구 대신 이번 계산의 구체적 단계 차이를 현실 관계 장면으로 번역하라.'''
replace_once('supabase/functions/relationship-interpret-v9-preview/index.ts', old_instruction, new_instruction)

replace_once(
    'supabase/functions/relationship-interpret-v9-preview/reunionGroundingV2.ts',
    "/끊어지지 않는 인연|운명적으로 다시 만난다|서로를 지울 수 없다|반드시 연락한다|상대가 아직 사랑한다|(?:연락|만남|재회)\\s*확률\\s*\\d+(?:\\.\\d+)?\\s*%/",
    "/끊어지지 않는 인연|끊을 수 없는 인연|카르마적 인연|운명적 인연|운명적으로 다시 만난다|천생연분|서로를 지울 수 없다|반드시 연락한다|상대가 아직 사랑한다|(?:연락|만남|재회)\\s*확률\\s*\\d+(?:\\.\\d+)?\\s*%/",
)

old_block = '''    {reunion && hierarchyData && <section className="reading-section reunion-hierarchy">
      <h3>최종 결론</h3>
      <p>재접점 활성도: {String(hierarchyData.stages?.contact_recontact?.activation ?? '유효 후보 없음')} · 재결합 지원 활성도: {String(hierarchyData.stages?.relationship_rebuilding?.activation ?? '유효 후보 없음')}</p>
      <p>선연락 주체: 판정 불가</p>
      <p>{Object.values(hierarchyData.stages).map(s=>`${s.label}: ${s.activation ?? '유효 후보 없음'}`).join(' · ')}</p>
      {hierarchyData.stability_structure && <p>안정적 관계 유지 구조: 지지 접촉 {hierarchyData.stability_structure.support.length}개 · 긴장 접촉 {hierarchyData.stability_structure.obstacles.length}개. 접촉 수는 재결합 확률이나 관계의 지속 여부를 뜻하지 않습니다.</p>}
      {hierarchyData.validation?.status !== 'PASS' && <p role="alert">계산 검증에 실패해 후보 날짜와 해석 생성을 보류했습니다.</p>}
      <h4>오늘 이후 가장 강한 기간 TOP 3</h4>
      {hierarchyData.top_periods.map((w)=><article className="relationship-pattern" key={`${w.start}:${w.stage}`}>
        <b>{w.start} ~ {w.end} · {w.label}</b><p>핵심 날짜 {w.date} · 상대 활성도 {w.final}점</p>
        <details><summary>점수 근거</summary><p>장기 {w.components.long_term} · 중기 {w.components.mid_term} · 촉발점 {w.components.event_trigger} · 체계 교차 {w.components.cross_system} · 최종 {w.components.final}</p></details>
      </article>)}
      {!hierarchyData.top_periods.length && <p>조회 기간에 장기·중기·단기 조건을 모두 통과한 미래 후보가 없습니다.</p>}
      {hierarchyData.nearest_window?.date && <p>가장 가까운 활성창: {hierarchyData.nearest_window.start} ~ {hierarchyData.nearest_window.end} · 핵심 날짜 {hierarchyData.nearest_window.date}</p>}
      <p>반복 패턴: {leadFriction?.caution ?? '긴장과 끌림을 구분하고, 연락 이후 실제 행동이 지속되는지 확인하세요.'}</p>
      <p>{hierarchyData.score_meaning}</p>
      <details className="reading-more"><summary>왜 이렇게 나왔는지 — 쉬운 설명</summary><p>먼저 장기 관계 활성과 중기 배경이 겹치는 기간을 찾고, 그 안에서 연락·감정·만남·관계 재정의의 촉발점을 따로 계산했습니다. 정확한 각 하나만으로 재회 날짜를 정하지 않습니다.</p><p>감정 활성 ≠ 연락 ≠ 만남 ≠ 재결합 ≠ 안정적 관계 유지</p></details>
      <details className="reading-more"><summary>이미 지나간 활성기</summary>{hierarchyData.past_windows.map((w)=><p key={`${w.start}:${w.stage}`}>{w.start} ~ {w.end} · {w.label} · {w.final}점</p>)}</details>
      <details className="reading-more"><summary>전문 근거·검증 범위</summary><p>Secondary Progression(세컨더리 프로그레션/2차 진행) · Solar Arc(솔라아크/태양호) · Transit(트랜짓/경과) · 다섯 행성 회귀 · 사주 절입</p>{hierarchyData.limitations.map(x=><p key={x}>{x}</p>)}{(hierarchyData.validation?.checks ?? []).filter((x)=>x.status!=='PASS').map((x)=><p key={x.name}>{x.name}: {x.status} — {x.detail}</p>)}</details>
    </section>}'''

new_block = '''    {reunion && hierarchyData && <section className="reading-section reunion-hierarchy reunion-v211">
      <h3>지금부터의 재회 흐름</h3>
      {hierarchyData.validation?.status !== 'PASS' ? <p role="alert">계산 검증에 실패해 미래 후보와 해설을 보류했어.</p> : <>
        {hierarchyData.nearest_window ? <article className="relationship-pattern reunion-nearest-window">
          <h4>가장 가까운 활성창</h4>
          <b>{hierarchyData.nearest_window.start} ~ {hierarchyData.nearest_window.end} · {hierarchyData.nearest_window.label}</b>
          <p>핵심 날짜 {hierarchyData.nearest_window.date} · 활성도 {hierarchyData.nearest_window.final}점</p>
          <p>이 날짜는 {hierarchyData.nearest_window.label} 단계 후보야. 감정 활성, 연락, 실제 만남, 관계 재구축은 서로 다른 단계라 자동으로 다음 단계까지 이어졌다고 보지 않아.</p>
        </article> : <p>오늘 이후 조회 기간에는 장기·중기·단기 조건을 모두 통과한 활성창이 없어.</p>}
        <div className="reunion-stage-status">
          <h4>단계별 현재 상태</h4>
          {Object.values(hierarchyData.stages).map((stage)=><p key={stage.label}><b>{stage.label}</b> · {stage.activation === null ? '유효 미래 후보 없음' : `활성도 ${stage.activation}`}</p>)}
        </div>
        <p className="reunion-initiative-closed"><b>누가 먼저 연락?</b> 현재 계산으로는 판정 보류. 상대측/내측 활성도 비교값은 실제 행동 방향이 아니어서 선연락 근거로 쓰지 않아.</p>
        <h4>오늘 이후 TOP 3</h4>
        {hierarchyData.top_periods.map((w)=><article className="relationship-pattern reunion-future-window" key={`${w.start}:${w.stage}`}>
          <b>{w.start} ~ {w.end} · {w.label}</b><p>핵심 날짜 {w.date} · 활성도 {w.final}점</p>
          <details><summary>왜 후보가 됐는지</summary><p>장기 {w.components.long_term} · 중기 {w.components.mid_term} · 사건 촉발 {w.components.event_trigger} · 체계 교차 {w.components.cross_system} · 최종 {w.components.final}</p></details>
        </article>)}
        {!hierarchyData.top_periods.length && <p>오늘 이후 공개할 TOP 후보가 없어.</p>}
      </>}
      <p>{hierarchyData.score_meaning}</p>
      <details className="reading-more reunion-fixed-structure"><summary>고정 관계 구조 · 필요할 때만 보기</summary>
        <p>이 부분은 같은 두 사람이라면 매 계산에서 크게 달라지지 않는 출생차트·시너스트리 구조야. 새 시기 신호처럼 반복해서 강조하지 않아.</p>
        {reunionV2?.why_reconnect?.conclusion && <p>{firstSentences(reunionV2.why_reconnect.conclusion, 2)}</p>}
        {reunionV2?.rebuild?.conclusion && <p>{firstSentences(reunionV2.rebuild.conclusion, 2)}</p>}
        {reunionV2?.repeat_risks?.conclusion && <p>{firstSentences(reunionV2.repeat_risks.conclusion, 2)}</p>}
        {hierarchyData.stability_structure && <p>구조 근거: 지지 접촉 {hierarchyData.stability_structure.support.length}개 · 긴장 접촉 {hierarchyData.stability_structure.obstacles.length}개. 접촉 수 자체는 재결합 확률이 아니야.</p>}
      </details>
      <details className="reading-more reunion-past-audit"><summary>지난 활성기 · 사후검증용</summary>{hierarchyData.past_windows.length ? hierarchyData.past_windows.map((w)=><p key={`${w.start}:${w.stage}`}>{w.start} ~ {w.end} · {w.label} · {w.final}점</p>) : <p>분리해 표시할 지난 활성기가 없어.</p>}</details>
      <details className="reading-more"><summary>전문 근거·검증 범위</summary><p>Secondary Progression(세컨더리 프로그레션/2차 진행) · Solar Arc(솔라아크/태양호) · Transit(트랜짓/경과) · 다섯 행성 회귀 · 사주 절입</p><p>감정 활성 ≠ 연락 ≠ 만남 ≠ 재결합 ≠ 안정적 관계 유지</p>{hierarchyData.limitations.map(x=><p key={x}>{x}</p>)}{(hierarchyData.validation?.checks ?? []).filter((x)=>x.status!=='PASS').map((x)=><p key={x.name}>{x.name}: {x.status} — {x.detail}</p>)}</details>
    </section>}'''
replace_once('web/src/RelationshipInterpretationPanel.tsx', old_block, new_block)

replace_once(
    'web/src/RelationshipInterpretationPanel.tsx',
    '{ai?.ok && ai.data ? <section className="reading-section relationship-natural-reading">',
    '{ai?.ok && ai.data && (!reunion || !hierarchyData) ? <section className="reading-section relationship-natural-reading">',
)

replace_once(
    'web/src/lib/relationshipReunionV2.contract.test.mjs',
    'assert.match(server,/REUNION_VERSION="relationship-v12\\.0-hierarchical-timing"/)',
    'assert.match(server,/REUNION_VERSION="relationship-v12\\.1-hierarchy-presentation"/)',
)

marker = "test('archive filter guards iOS date controls from widening the page',()=>{"
contract = Path('web/src/lib/relationshipReunionV2.contract.test.mjs')
text = contract.read_text()
if text.count(marker) != 1:
    raise SystemExit('contract test insertion marker mismatch')
insert = '''test('reunion v2.11 makes hierarchy the only primary future timing presentation',()=>{\n  const cache=readFileSync(new URL('./readingCache.ts',import.meta.url),'utf8')\n  const hierarchy=readFileSync(new URL('./reunionHierarchy.ts',import.meta.url),'utf8')\n  const grounding=readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/reunionGroundingV2.ts',import.meta.url),'utf8')\n  assert.match(cache,/relationship-v12\\.1-hierarchy-presentation-v2/)\n  assert.match(panel,/지금부터의 재회 흐름/)\n  assert.match(panel,/가장 가까운 활성창/)\n  assert.match(panel,/지난 활성기 · 사후검증용/)\n  assert.match(panel,/고정 관계 구조 · 필요할 때만 보기/)\n  assert.match(panel,/\(!reunion \|\| !hierarchyData\)/)\n  assert.match(hierarchy,/top_periods: topPeriods/)\n  assert.match(hierarchy,/row\.date >= asOf/)\n  assert.match(server,/날짜 문자열을 새로 만들거나/)\n  assert.match(server,/이미 지난 날짜를 미래 핵심 시기처럼/)\n  assert.match(server,/카르마적 인연/)\n  assert.match(grounding,/카르마적 인연/)\n})\n\n'''
contract.write_text(text.replace(marker, insert + marker, 1))

# Fail if calculated engine files were accidentally touched by this script.
for forbidden in ('reunion_hierarchy_v2.py','relationship_return_v1.py','relationship_western_v1.py','relationship_saju_v1.py'):
    if Path(forbidden).stat().st_mtime_ns > Path(__file__).stat().st_mtime_ns:
        raise SystemExit(f'unexpected engine mutation: {forbidden}')

print('v2.11 presentation patch applied')
