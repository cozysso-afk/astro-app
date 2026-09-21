from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'missing patch anchor: {label}')
    return text.replace(old, new, 1)

fortune_path = Path('web/src/lib/fortuneUserSummary.ts')
fortune = fortune_path.read_text()

if 'FLOW_BAND_V26' not in fortune:
    anchor = "\nfunction topicStat(context: FortuneUserSummaryContext, topic: string) {\n"
    helper = """

// FLOW_BAND_V26: display nuance without changing calculation thresholds or ranking.
function displayFlowBand(score: number, fallback = '보통') {
  if (!Number.isFinite(score)) return fallback
  if (score >= 60) return '강함'
  if (score >= 52) return '다소 강함'
  if (score >= 45) return '보통'
  if (score >= 38) return '다소 약함'
  return '약함'
}
"""
    fortune = replace_once(fortune, anchor, helper + anchor, 'display band helper')

old_week = """  const clauses = beats.map(beat=>`${beat.label}에는 ${beat.topic}에서 ${beat.meaning}이 두드러져 ${beat.scene}`)
  if (clauses.length === 2) return `${clauses[0]}으로 시작해서, ${clauses[1]}으로 무게가 옮겨가는 주야.`
  return `${clauses[0]}으로 시작하고, ${clauses[1]}, ${clauses[2]}으로 이어지는 주야.`
"""
new_week = """  // WEEKLY_ARC_COMPACT_V26: keep the arc, drop repeated '쪽/두드러져' scaffolding.
  const compactScene = (scene: string) => scene
    .replace(/하는 쪽$/, '하는 데')
    .replace(/보는 쪽$/, '보는 데')
    .replace(/는 쪽$/, '는 데')
  const clauses = beats.map(beat=>`${beat.label}엔 ${beat.topic}에서 ${compactScene(beat.scene)}`)
  if (clauses.length === 2) return `${clauses[0]} 힘이 실리고, ${clauses[1]} 무게가 옮겨가.`
  return `${clauses[0]} 힘이 실리고, ${clauses[1]} 흐름을 거쳐, ${clauses[2]} 마무리되는 주야.`
"""
if 'WEEKLY_ARC_COMPACT_V26' not in fortune:
    fortune = replace_once(fortune, old_week, new_week, 'compact weekly arc')

fortune = fortune.replace(
    "band: topicStat(context, row.topic)?.band ?? '보통'",
    "band: displayFlowBand(row.score!, topicStat(context, row.topic)?.band ?? '보통')"
)
fortune = fortune.replace(
    "band: row.topic === '투자주의' ? '주의' : topicStat(context, row.topic)?.band ?? '약함'",
    "band: row.topic === '투자주의' ? '주의' : displayFlowBand(row.score!, topicStat(context, row.topic)?.band ?? '약함')"
)
fortune_path.write_text(fortune)

panel_path = Path('web/src/RelationshipInterpretationPanel.tsx')
panel = panel_path.read_text()
panel = panel.replace('<h4>오늘 이후 핵심 시기</h4>', '<h4>오늘 이후 후보 시기</h4>')
panel = panel.replace(
    "<b>{w.start} ~ {w.end} · {w.label}</b><p>{reunionStageHuman(w.stage, w.label)}</p><small>핵심 날짜 {w.date} · 보조지표 활성도 {w.final}</small>",
    "<b>{w.start} ~ {w.end} · {w.label} 후보 창</b><p>{reunionStageHuman(w.stage, w.label)}</p><small>대표 날짜 {w.date} · 사건 확정일 아님 · 보조지표 활성도 {w.final}</small>"
)
panel = panel.replace('오늘 이후 공개할 핵심 후보가 없어.', '오늘 이후 공개할 후보 시기가 없어.')
panel_path.write_text(panel)

qa_path = Path('web/src/EditorialQaPreview.tsx')
qa = qa_path.read_text()
qa = qa.replace(
    "band: score < 40 ? '약함' : score >= 60 ? '강함' : '보통',",
    "band: score >= 60 ? '강함' : score >= 52 ? '다소 강함' : score >= 45 ? '보통' : score >= 38 ? '다소 약함' : '약함',"
)
qa = qa.replace("<span className=\"period-ai-kicker\">QA fixture · {summary.when} 핵심</span>", "<span className=\"period-ai-kicker\">{summary.when} 핵심</span>")
qa = qa.replace("<div className=\"period-ai-head\"><div><span className=\"period-ai-kicker\">QA fixture · 재회운 사람말 본문</span>", "<div className=\"period-ai-head\" style={{order:-1}}><div><span className=\"period-ai-kicker\">재회운 핵심</span>")
qa = qa.replace('<span>오늘 이후 핵심 시기</span>', '<span>오늘 이후 후보 시기</span>')
old_dates = "<p><strong>2026-10-21</strong>은 재접촉 계기가 먼저 살아나는 후보, <strong>2027-01-21</strong>은 상대측 반응을 관찰하기 좋은 후보, <strong>2027-04-18</strong>은 내가 먼저 움직일 때의 반응을 보기 좋은 후보로 두고 읽어. 날짜는 사건 확률이 아니라 엔진이 통과시킨 활성 창이야.</p>"
new_dates = "<p><strong>2026-10-21 전후</strong>는 재접촉 계기를 살피는 첫 후보 창, <strong>2027-01-21 전후</strong>는 상대측 반응을 관찰하는 후보 창, <strong>2027-04-18 전후</strong>는 내가 먼저 움직였을 때의 반응을 비교해 볼 후보 창이야. 특정 하루를 사건일로 찍는 게 아니라, 각 단계 근거가 상대적으로 모이는 시기로 읽어.</p>"
qa = qa.replace(old_dates, new_dates)
qa_path.write_text(qa)

test_path = Path('web/src/lib/humanLanguageV25.test.mjs')
test = test_path.read_text()
if "const qa=" not in test:
    test = test.replace(
        "const cache=readFileSync(new URL('./readingCache.ts',import.meta.url),'utf8')\n",
        "const cache=readFileSync(new URL('./readingCache.ts',import.meta.url),'utf8')\nconst qa=readFileSync(new URL('../EditorialQaPreview.tsx',import.meta.url),'utf8')\n"
    )
if "display bands separate nearby scores" not in test:
    test += """

test('display bands separate nearby scores without changing ranking thresholds',()=>{
  assert.match(fortune,/FLOW_BAND_V26/)
  assert.match(fortune,/score >= 52.*다소 강함/)
  assert.match(fortune,/score >= 38.*다소 약함/)
  assert.match(fortune,/WEEKLY_ARC_COMPACT_V26/)
  assert.doesNotMatch(fortune,/beat\.label\}에는 .*두드러져/)
})

test('reunion dates are framed as candidate windows and QA labels stay minimal',()=>{
  assert.match(panel,/오늘 이후 후보 시기/)
  assert.match(panel,/사건 확정일 아님/)
  assert.doesNotMatch(panel,/핵심 날짜 \{w\.date\}/)
  assert.match(qa,/2026-10-21 전후/)
  assert.match(qa,/각 단계 근거가 상대적으로 모이는 시기/)
  assert.doesNotMatch(qa,/QA fixture · 재회운 사람말 본문/)
})
"""
test_path.write_text(test)

print('editorial QA polish applied')
