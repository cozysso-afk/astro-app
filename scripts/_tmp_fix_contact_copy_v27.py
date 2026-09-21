from pathlib import Path


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f'anchor missing: {path}')
    p.write_text(s.replace(old, new, 1))

# 1) Keep reunion numeric activation as a secondary indicator.
replace_once(
    'web/src/lib/relationshipUserSummary.ts',
    "    return { band, text: band === '정보 부족' ? '이 방향을 판단할 계산 정보가 없어. 다른 방향의 점수로 대신하지 않을게.' : copy[kind][band], timing }",
    "    return { score: typeof score === 'number' && Number.isFinite(score) ? Math.round(score) : undefined, band, text: band === '정보 부족' ? '이 방향을 판단할 계산 정보가 없어. 다른 방향의 점수로 대신하지 않을게.' : copy[kind][band], timing }",
)

panel = Path('web/src/RelationshipInterpretationPanel.tsx')
s = panel.read_text()
marker = "        {ai?.ok && ai.data && reunionV2 && <section className=\"reunion-human-narrative reunion-ai-block\">"
if marker not in s:
    raise SystemExit('relationship panel marker missing')
contact_block = """        {typeof view.reconnection.score === 'number' && <section className=\"reunion-ai-block reunion-contact-indicators\">\n          <h4>연락 가능성 · 보조지표</h4>\n          <div className=\"reunion-return-context-grid\">\n            <article className=\"reunion-return-context-card\"><b>재접촉 활성도</b><strong>{view.reconnection.score}/100</strong><small>{view.reconnection.band}</small></article>\n            {typeof view.incoming.score === 'number' && <article className=\"reunion-return-context-card\"><b>상대측 반응 활성도</b><strong>{view.incoming.score}/100</strong><small>{view.incoming.band}</small></article>}\n            {typeof view.outgoing.score === 'number' && <article className=\"reunion-return-context-card\"><b>내측 연락 적합도</b><strong>{view.outgoing.score}/100</strong><small>{view.outgoing.band}</small></article>}\n          </div>\n          <p className=\"reunion-score-meaning\">숫자는 같은 조회 기간 안에서 신호가 얼마나 활성돼 있는지 비교하는 보조지표야. 실제 연락 확률·재회 확률이나 누가 먼저 연락할 확률이 아니야.</p>\n        </section>}\n\n"""
panel.write_text(s.replace(marker, contact_block + marker, 1))

# 2) Daily sentence coherence: a separating signal cannot be sold as a new peak.
old_daily = """  const motion = String(lead.item.motion ?? '')\n  const phase = /Applying|적용/i.test(motion)\n    ? `${trigger} 자극도 아직 커지는 중이야.`\n    : /Exact|정확/i.test(motion)\n      ? `${trigger} 자극이 오늘 특히 또렷해.`\n      : /Separating|분리/i.test(motion)\n        ? `${trigger} 자극의 정점은 지났지만 여운이 남아 있어.`\n        : `${trigger} 자극이 오늘 체감에 남아 있어.`\n  const variant = [...context.calculation.period.start].reduce((sum,ch)=>sum+ch.charCodeAt(0),0) % 3\n  if (variant === 0) return `${sceneText} 오늘 ${lead.topic}에서는 ${focus}이 핵심이야. ${phase}`\n  if (variant === 1) return `${lead.topic}에서 오늘 가장 눈에 띄는 건 ${focus}이야. ${sceneText} ${phase}`\n  return `오늘은 ${sceneText} ${lead.topic}에서는 ${focus}이 먼저 보여. ${phase}`\n"""
new_daily = """  const motion = String(lead.item.motion ?? '')\n  const applying = /Applying|적용/i.test(motion)\n  const exact = /Exact|정확/i.test(motion)\n  const separating = /Separating|분리/i.test(motion)\n  if (separating) {\n    return `${lead.topic}에서 오늘 남아 있는 핵심은 ${focus}이야. ${trigger} 자극의 정점은 지났으니, 새로 밀어붙이기보다 이미 시작된 일과 반응이 실제 행동으로 어떻게 이어지는지 확인해.`\n  }\n  const phase = applying\n    ? `${trigger} 자극도 아직 커지는 중이라 첫 반응 하나보다 흐름이 이어지는지를 봐.`\n    : exact\n      ? `${trigger} 자극이 오늘 특히 또렷해.`\n      : `${trigger} 자극이 오늘 체감에 남아 있어.`\n  const variant = [...context.calculation.period.start].reduce((sum,ch)=>sum+ch.charCodeAt(0),0) % 3\n  if (variant === 0) return `${sceneText} 오늘 ${lead.topic}에서는 ${focus}이 핵심이야. ${phase}`\n  if (variant === 1) return `${lead.topic}에서 오늘 가장 눈에 띄는 건 ${focus}이야. ${sceneText} ${phase}`\n  return `오늘은 ${sceneText} ${lead.topic}에서는 ${focus}이 먼저 보여. ${phase}`\n"""
replace_once('web/src/lib/fortuneUserSummary.ts', old_daily, new_daily)

# 3) Weekly grammar/coherence: use complete clauses and collapse duplicate adjacent phases.
old_weekly = """  if (beats.length < 2) return ''\n  // WEEKLY_ARC_COMPACT_V26: keep the arc, drop repeated '쪽/두드러져' scaffolding.\n  const compactScene = (scene: string) => scene\n    .replace(/하는 쪽$/, '하는 데')\n    .replace(/보는 쪽$/, '보는 데')\n    .replace(/는 쪽$/, '는 데')\n  const clauses = beats.map(beat=>`${beat.label}엔 ${beat.topic}에서 ${compactScene(beat.scene)}`)\n  if (clauses.length === 2) return `${clauses[0]} 힘이 실리고, ${clauses[1]} 무게가 옮겨가.`\n  return `${clauses[0]} 힘이 실리고, ${clauses[1]} 흐름을 거쳐, ${clauses[2]} 마무리되는 주야.`\n"""
new_weekly = """  if (beats.length < 2) return ''\n  // WEEKLY_ARC_COHERENCE_V27: each phase owns a complete clause; repeated adjacent scenes collapse.\n  const task = (scene: string) => scene.replace(/쪽$/, '일')\n  const sameBeat = (a: typeof beats[number], b: typeof beats[number]) => a.topic === b.topic && a.scene === b.scene\n  const phrase = (beat: typeof beats[number]) => `${beat.topic}에서 ${task(beat.scene)}`\n  if (beats.length === 2) {\n    if (sameBeat(beats[0], beats[1])) return `${beats[0].label}부터 ${beats[1].label}까지 ${phrase(beats[0])}이 중심이야.`\n    return `${beats[0].label}엔 ${phrase(beats[0])}에 힘이 실려. ${beats[1].label}엔 ${phrase(beats[1])}이 중심이 돼.`\n  }\n  if (sameBeat(beats[1], beats[2])) return `${beats[0].label}엔 ${phrase(beats[0])}에 힘이 실려. ${beats[1].label}부터 ${beats[2].label}까지는 ${phrase(beats[1])}이 중심이야.`\n  if (sameBeat(beats[0], beats[1])) return `${beats[0].label}부터 ${beats[1].label}까지 ${phrase(beats[0])}이 중심이야. ${beats[2].label}엔 ${phrase(beats[2])}을 중심으로 마무리돼.`\n  return `${beats[0].label}엔 ${phrase(beats[0])}에 힘이 실려. ${beats[1].label}엔 ${phrase(beats[1])}이 중심이 되고, ${beats[2].label}엔 ${phrase(beats[2])}을 중심으로 마무리돼.`\n"""
replace_once('web/src/lib/fortuneUserSummary.ts', old_weekly, new_weekly)

# 4) QA reunion fixture must expose the same numeric secondary indicators.
qa = Path('web/src/EditorialQaPreview.tsx')
s = qa.read_text()
qa_marker = "    <section className=\"period-ai-window-section\"><div className=\"period-ai-section-title\"><span>지금 두 사람 사이에서 살아 있는 흐름</span></div>"
if qa_marker not in s:
    raise SystemExit('QA reunion marker missing')
qa_block = """    <section className=\"period-ai-window-section\"><div className=\"period-ai-section-title\"><span>연락 가능성 · 보조지표</span></div><div className=\"reunion-return-context-grid\"><article className=\"reunion-return-context-card\"><b>재접촉 활성도</b><strong>57/100</strong><small>보통</small></article><article className=\"reunion-return-context-card\"><b>상대측 반응 활성도</b><strong>49/100</strong><small>보통</small></article><article className=\"reunion-return-context-card\"><b>내측 연락 적합도</b><strong>53/100</strong><small>다소 강함</small></article></div><p>숫자는 같은 조회 기간 안에서 신호 강도를 비교하는 보조지표야. 57점이 연락 확률 57%라는 뜻은 아니고, 누가 먼저 연락할지를 확률로 판정하는 값도 아니야.</p></section>\n"""
qa.write_text(s.replace(qa_marker, qa_block + qa_marker, 1))

# 5) Regression tests: grammar, phase semantics, and numeric reunion support.
test = Path('web/src/lib/readingExperience.test.mjs')
s = test.read_text()
s = s.replace("  assert.match(view.headline,/마무리되는 주야/)\n", "  assert.match(view.headline,/마무리돼/)\n", 1)
s = s.replace("  assert.doesNotMatch(view.headline,/두드러져|하는 쪽|보는 쪽|힘을 쓰기 괜찮지만|속도를 낮추는 편이 좋아/)\n", "  assert.doesNotMatch(view.headline,/두드러져|하는 데 흐름을 거쳐|하는 데 마무리|힘을 쓰기 괜찮지만|속도를 낮추는 편이 좋아/)\n", 1)
extra = r'''

test('daily separating evidence reads as follow-through, not a fresh peak',()=>{
  const f=fortuneFixture('today')
  f.calculation.western.daily_scores[0].evidence[0].motion='Separating'
  const view=buildFortuneUserSummary(f.data,{...f.context,calculation:f.calculation})
  assert.match(view.headline,/정점은 지났으니/)
  assert.match(view.headline,/이미 시작된 일과 반응/)
  assert.doesNotMatch(view.headline,/좋은 날이야.*정점은 지났|좋은 편이야.*정점은 지났/)
})

test('weekly repeated mid-late scene collapses and keeps grammatical phase relations',()=>{
  const f=fortuneFixture('week')
  f.calculation.western.daily_scores=[
    {date:'2026-09-12',evidence:[{source_topics:['대인관계'],transit:'Mercury',target:'Jupiter',aspect:'trine',contribution:4,polarity:.7}]},
    {date:'2026-09-13',evidence:[{source_topics:['대인관계'],transit:'Mercury',target:'Jupiter',aspect:'trine',contribution:4,polarity:.7}]},
    {date:'2026-09-14',evidence:[{source_topics:['직장'],transit:'Saturn',target:'Sun',aspect:'trine',contribution:3,polarity:.6}]},
    {date:'2026-09-15',evidence:[{source_topics:['직장'],transit:'Saturn',target:'Sun',aspect:'trine',contribution:3,polarity:.6}]},
    {date:'2026-09-16',evidence:[{source_topics:['직장'],transit:'Saturn',target:'Sun',aspect:'trine',contribution:3,polarity:.6}]},
    {date:'2026-09-17',evidence:[{source_topics:['직장'],transit:'Mars',target:'Moon',aspect:'sextile',contribution:4,polarity:.7}]},
    {date:'2026-09-18',evidence:[{source_topics:['직장'],transit:'Mars',target:'Moon',aspect:'sextile',contribution:4,polarity:.7}]},
  ]
  const view=buildFortuneUserSummary(f.data,{...f.context,calculation:f.calculation})
  assert.match(view.headline,/중반부터 후반까지/)
  assert.equal((view.headline.match(/요청·담당자·마감/g)||[]).length,1)
  assert.doesNotMatch(view.headline,/하는 데 흐름을 거쳐|하는 데 마무리/)
})

test('reunion keeps numeric activation as a secondary indicator instead of hiding it',()=>{
  const view=relationship('reunion')
  assert.equal(typeof view.reconnection.score,'number')
  assert.equal(typeof view.incoming.score,'number')
  assert.equal(typeof view.outgoing.score,'number')
  const panel=readFileSync(new URL('../RelationshipInterpretationPanel.tsx',import.meta.url),'utf8')
  assert.match(panel,/연락 가능성 · 보조지표/)
  assert.match(panel,/실제 연락 확률·재회 확률/)
})
'''
if "daily separating evidence reads as follow-through" not in s:
    s += extra
test.write_text(s)
print('v27 contact/copy patch applied')
