from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one match, found {count}')
    p.write_text(text.replace(old, new, 1))


# Cache/version bump so old hierarchy-only prose is not reused.
replace_once(
    'web/src/lib/readingCache.ts',
    "const RELATIONSHIP_REUNION_AI_CACHE_CONTRACT = 'relationship-v12.1-hierarchy-presentation-v2'",
    "const RELATIONSHIP_REUNION_AI_CACHE_CONTRACT = 'relationship-v12.2-human-narrative-v1'",
)
replace_once(
    'supabase/functions/relationship-interpret-v9-preview/index.ts',
    'const REUNION_VERSION="relationship-v12.1-hierarchy-presentation";',
    'const REUNION_VERSION="relationship-v12.2-human-narrative";',
)

# Keep dates deterministic, but make the AI responsible for concrete human-language meaning.
replace_once(
    'supabase/functions/relationship-interpret-v9-preview/index.ts',
    "범용 상담문구 대신 이번 계산의 구체적 단계 차이를 현실 관계 장면으로 번역하라.",
    "범용 상담문구 대신 이번 계산의 구체적 단계 차이를 현실 관계 장면으로 번역하라. summary는 첫 2~3문장 안에서 현재 가장 가까운 단계와 아직 열리지 않은 다음 단계를 대비해 설명하고, 점수보다 실제 관계에서 무엇이 달라 보이는지를 먼저 말한다. timing.conclusion은 날짜 목록을 다시 쓰지 말고 감정→연락→만남→재구축 중 지금 어디에 있고 다음 단계로 넘어가려면 무엇이 더 필요한지를 설명한다. rebuild는 연락이 생긴 뒤 관계 회복 여부를 가르는 현실 조건을 최대 3개로 좁힌다. repeat_risks는 현재 단계와 직접 연결되는 근거가 있는 문제만 최대 2개 쓰고, '균형·성장·조율·신중함' 같은 추상어만으로 문장을 만들지 않는다. why_reconnect는 고정 natal/시너스트리 구조를 장황하게 반복하지 말고 이번 흐름을 이해하는 데 필요한 만큼만 짧게 쓴다.",
)

panel = Path('web/src/RelationshipInterpretationPanel.tsx')
text = panel.read_text()

helper_anchor = """function ReadableCopy({ text, className = '' }: { text: string; className?: string }) {\n  const paragraphs = readableParagraphs(text)\n  if (!paragraphs.length) return null\n  return <div className={`reunion-readable-copy ${className}`.trim()}>{paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>\n}\n"""
helper = helper_anchor + """
const REUNION_STAGE_HUMAN: Record<string, string> = {
  emotional_reactivation: '서로를 다시 의식하거나 감정과 기억이 먼저 올라오는 단계야. 이것만으로 실제 연락이 생겼다고 보지는 않아.',
  contact_recontact: '메시지·답장·안부·간접 반응처럼 실제 상호작용이 다시 시작되는 단계야. 연락이 닿아도 곧바로 재결합을 뜻하지는 않아.',
  in_person_meeting: '대화가 현실 약속이나 직접 만남으로 이어지는 단계야. 온라인 반응과 실제 만남은 따로 봐.',
  relationship_rebuilding: '다시 만나는 것보다 관계를 어떤 조건으로 다시 이어갈지 정하는 단계야. 예전 패턴이 달라지는지가 핵심이야.',
}
function reunionStageHuman(stageKey: string, fallbackLabel = '') {
  if (REUNION_STAGE_HUMAN[stageKey]) return REUNION_STAGE_HUMAN[stageKey]
  if (fallbackLabel.includes('감정')) return REUNION_STAGE_HUMAN.emotional_reactivation
  if (fallbackLabel.includes('연락') || fallbackLabel.includes('접촉')) return REUNION_STAGE_HUMAN.contact_recontact
  if (fallbackLabel.includes('만남')) return REUNION_STAGE_HUMAN.in_person_meeting
  if (fallbackLabel.includes('재정') || fallbackLabel.includes('재구') || fallbackLabel.includes('관계')) return REUNION_STAGE_HUMAN.relationship_rebuilding
  return '이 단계가 실제 관계에서 어떤 행동으로 이어지는지 다른 단계와 분리해서 봐.'
}
"""
if 'REUNION_STAGE_HUMAN' not in text:
    if helper_anchor not in text:
        raise SystemExit('ReadableCopy helper anchor not found')
    text = text.replace(helper_anchor, helper, 1)

old_nearest = """          <p>핵심 날짜 {hierarchyData.nearest_window.date} · 활성도 {hierarchyData.nearest_window.final}점</p>\n          <p>이 날짜는 {hierarchyData.nearest_window.label} 단계 후보야. 감정 활성, 연락, 실제 만남, 관계 재구축은 서로 다른 단계라 자동으로 다음 단계까지 이어졌다고 보지 않아.</p>"""
new_nearest = """          <p>{reunionStageHuman(hierarchyData.nearest_window.stage, hierarchyData.nearest_window.label)}</p>\n          <small>핵심 날짜 {hierarchyData.nearest_window.date} · 보조지표 활성도 {hierarchyData.nearest_window.final}</small>"""
if old_nearest not in text:
    raise SystemExit('nearest window block not found')
text = text.replace(old_nearest, new_nearest, 1)

old_stages = """          {Object.values(hierarchyData.stages).map((stage)=><p key={stage.label}><b>{stage.label}</b> · {stage.activation === null ? '유효 미래 후보 없음' : `활성도 ${stage.activation}`}</p>)}"""
new_stages = """          {Object.entries(hierarchyData.stages).map(([stageKey,stage])=><p key={stage.label}><b>{stage.label}</b> · {reunionStageHuman(stageKey, stage.label)} <small>{stage.activation === null ? '현재 기간에 공개할 미래 후보 없음' : `보조지표 · 활성도 ${stage.activation}`}</small></p>)}"""
if old_stages not in text:
    raise SystemExit('stage status block not found')
text = text.replace(old_stages, new_stages, 1)

old_top = """        {hierarchyData.top_periods.map((w)=><article className=\"relationship-pattern reunion-future-window\" key={`${w.start}:${w.stage}`}>\n          <b>{w.start} ~ {w.end} · {w.label}</b><p>핵심 날짜 {w.date} · 활성도 {w.final}점</p>\n          <details><summary>왜 후보가 됐는지</summary><p>장기 {w.components.long_term} · 중기 {w.components.mid_term} · 사건 촉발 {w.components.event_trigger} · 체계 교차 {w.components.cross_system} · 최종 {w.components.final}</p></details>\n        </article>)}"""
new_top = """        {hierarchyData.top_periods.map((w)=><article className=\"relationship-pattern reunion-future-window\" key={`${w.start}:${w.stage}`}>\n          <b>{w.start} ~ {w.end} · {w.label}</b><p>{reunionStageHuman(w.stage, w.label)}</p><small>핵심 날짜 {w.date} · 보조지표 활성도 {w.final}</small>\n          <details><summary>왜 후보가 됐는지</summary><p>장기 배경과 중기 흐름이 먼저 겹친 뒤, 이 단계에 맞는 사건 촉발 신호까지 함께 통과했어.</p><small>기술값 · 장기 {w.components.long_term} · 중기 {w.components.mid_term} · 사건 촉발 {w.components.event_trigger} · 체계 교차 {w.components.cross_system} · 최종 {w.components.final}</small></details>\n        </article>)}"""
if old_top not in text:
    raise SystemExit('top period block not found')
text = text.replace(old_top, new_top, 1)

old_score = """      <p>{hierarchyData.score_meaning}</p>\n      <details className=\"reading-more reunion-fixed-structure\"><summary>고정 관계 구조 · 필요할 때만 보기</summary>"""
new_score = """      {ai?.ok && ai.data && reunionV2 && hierarchyData.validation?.status === 'PASS' && <section className=\"reunion-human-narrative reunion-ai-block\">\n        <h4>이번 흐름을 사람말로 풀면</h4>\n        <ReadableCopy className=\"reading-conclusion\" text={reunionV2.summary}/>\n        {!!reunionV2.timing?.conclusion && <><h4>지금 어디까지 와 있나</h4><ReadableCopy text={reunionV2.timing.conclusion}/></>}\n        <h4>연락 이후에 봐야 할 것</h4>\n        <ReadableCopy text={reunionV2.rebuild.conclusion}/>\n        {reunionV2.rebuild.conditions.length>0 && <ul>{reunionV2.rebuild.conditions.slice(0,3).map((x,i)=><li key={i}>{x}</li>)}</ul>}\n        {(reunionV2.repeat_risks.conclusion || reunionV2.repeat_risks.patterns.length>0) && <><h4>지금 막힐 수 있는 지점</h4><ReadableCopy text={reunionV2.repeat_risks.conclusion}/>{reunionV2.repeat_risks.patterns.length>0 && <ul>{reunionV2.repeat_risks.patterns.slice(0,2).map((x,i)=><li key={i}>{x}</li>)}</ul>}</>}\n      </section>}\n      <p className=\"reunion-score-meaning\">{hierarchyData.score_meaning}</p>\n      <details className=\"reading-more reunion-fixed-structure\"><summary>고정 관계 구조 · 필요할 때만 보기</summary>"""
if old_score not in text:
    raise SystemExit('score/fixed structure anchor not found')
text = text.replace(old_score, new_score, 1)
panel.write_text(text)

# Update contract tests to lock the human-language hierarchy contract.
test_path = Path('web/src/lib/relationshipReunionV2.contract.test.mjs')
test = test_path.read_text()
test = test.replace('relationship-v12\\.1-hierarchy-presentation', 'relationship-v12\\.2-human-narrative')
test = test.replace('relationship-v12\\.1-hierarchy-presentation-v2', 'relationship-v12\\.2-human-narrative-v1')
test = test.replace("test('reunion v2.11 makes hierarchy the only primary future timing presentation',()=>{", "test('reunion v2.12 keeps hierarchy timing deterministic while restoring human narrative',()=>{")
anchor = """  assert.match(panel,/고정 관계 구조 · 필요할 때만 보기/)\n  assert.match(panel,/\\(!reunion \\|\\| !hierarchyData\\)/)"""
replacement = """  assert.match(panel,/고정 관계 구조 · 필요할 때만 보기/)\n  assert.match(panel,/이번 흐름을 사람말로 풀면/)\n  assert.match(panel,/지금 어디까지 와 있나/)\n  assert.match(panel,/연락 이후에 봐야 할 것/)\n  assert.match(panel,/지금 막힐 수 있는 지점/)\n  assert.match(panel,/reunionStageHuman/)\n  assert.match(panel,/보조지표 활성도/)\n  assert.match(panel,/\\(!reunion \\|\\| !hierarchyData\\)/)"""
if anchor not in test:
    raise SystemExit('contract test anchor not found')
test = test.replace(anchor, replacement, 1)
prompt_anchor = """  assert.match(server,/카르마적 인연/)"""
prompt_replacement = """  assert.match(server,/카르마적 인연/)\n  assert.match(server,/summary는 첫 2~3문장 안에서 현재 가장 가까운 단계/)\n  assert.match(server,/repeat_risks는 현재 단계와 직접 연결되는 근거가 있는 문제만 최대 2개/)"""
if prompt_anchor not in test:
    raise SystemExit('prompt contract anchor not found')
test = test.replace(prompt_anchor, prompt_replacement, 1)
test_path.write_text(test)

print('reunion v2.12 human narrative patch applied')
