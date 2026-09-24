from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]

def read(p): return (ROOT/p).read_text()
def write(p,s): (ROOT/p).write_text(s)
def must_replace(s, old, new, label):
    if old not in s:
        raise SystemExit(f'missing replacement target: {label}')
    return s.replace(old,new,1)

# 1) Own the ACTUAL final app background. reading-experience.css loads after the old stability layer.
p=Path('web/src/reading-experience.css')
s=read(p)
old_bg="background:radial-gradient(ellipse at 0 8%,#c5eaf16b,transparent 37%),radial-gradient(ellipse at 100% 30%,#efd5e970,transparent 38%),radial-gradient(ellipse at 12% 70%,#cdeee37a,transparent 40%),#f7f8fb!important"
new_bg="background:linear-gradient(90deg,#c5eaf13d 0%,transparent 25%),linear-gradient(270deg,#efd5e93d 0%,transparent 27%),linear-gradient(135deg,transparent 58%,#cdeee32f 100%),#f7f8fb!important"
s=must_replace(s,old_bg,new_bg,'final app-shell background owner')
write(p,s)

# 2) Reunion product spacing and editorial story rhythm.
p=Path('web/src/reunion-reading-product-v13.css')
s=read(p)
append=r'''

/* Reunion editorial v12.6: story first, technical evidence second. */
.app-shell .relationship-experience[data-mode='reunion'] .reunion-story {
  display: grid;
  gap: 22px;
  margin-top: 4px;
}
.app-shell .relationship-experience[data-mode='reunion'] .reunion-story-section {
  display: grid;
  gap: 9px;
  padding: 0;
}
.app-shell .relationship-experience[data-mode='reunion'] .reunion-story-section + .reunion-story-section {
  padding-top: 20px;
  border-top: 1px solid rgba(92, 85, 112, .10);
}
.app-shell .relationship-experience[data-mode='reunion'] .reunion-story-section > h4 {
  margin: 0 !important;
  font-size: 16px !important;
  line-height: 1.5 !important;
  color: var(--reading-indigo);
}
.app-shell .relationship-experience[data-mode='reunion'] .reunion-story-section > p,
.app-shell .relationship-experience[data-mode='reunion'] .reunion-story-section .reunion-readable-copy > p {
  margin: 0 !important;
  font-size: 15px !important;
  line-height: 1.78 !important;
}
.app-shell .relationship-experience[data-mode='reunion'] .reunion-stage-sequence {
  margin: 2px 0 0;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(242, 238, 249, .62);
  color: var(--reading-indigo);
  font-size: 13.5px;
  line-height: 1.65;
}
.app-shell .relationship-experience[data-mode='reunion'] .reunion-technical-evidence {
  margin-top: 28px;
  padding-top: 4px;
  border-top: 1px solid rgba(92, 85, 112, .11);
}
.app-shell .relationship-experience[data-mode='reunion'] .reunion-technical-evidence > summary {
  min-height: 46px;
  display: flex;
  align-items: center;
  font-size: 13.5px;
  color: var(--reading-secondary);
}
.app-shell .relationship-experience[data-mode='reunion'] .reunion-local-evidence-grid {
  display: grid;
  gap: 26px;
  margin-top: 18px;
}
.app-shell .relationship-experience[data-mode='reunion'] .reunion-local-evidence-group {
  display: grid;
  gap: 11px;
  margin: 0;
}
.app-shell .relationship-experience[data-mode='reunion'] .reunion-local-evidence-group > b {
  display: block;
  margin: 0 0 3px;
  font-size: 15px;
  line-height: 1.5;
  color: var(--reading-indigo);
}
.app-shell .relationship-experience[data-mode='reunion'] .reunion-local-evidence-group + .reunion-local-evidence-group {
  padding-top: 5px;
}
.app-shell .relationship-experience[data-mode='reunion'] .reunion-direction-layer > .reading-direction-panel {
  margin-bottom: 24px;
}
.app-shell .relationship-experience[data-mode='reunion'] .relationship-calculated-fallback {
  margin-top: 24px;
}
'''
if 'Reunion editorial v12.6' not in s:
    s += append
write(p,s)

# 3) Human story in hierarchy panel; keep raw directional progression collapsed.
p=Path('web/src/ReunionHierarchyPanel.tsx')
s=read(p)
anchor="  const past = hierarchyData.past_windows\n\n  return <section className=\"reading-section reunion-hierarchy reunion-ui-vnext\">"
insert=r'''  const past = hierarchyData.past_windows
  const stageRows = STAGE_ORDER.map(([stage,label]) => {
    const currentRow = current.find((row)=>row.stage===stage)
    const futureRows = future.filter((row)=>row.stage===stage)
    const nearest = futureRows[0]
    return { stage, label, current: Boolean(currentRow), currentRow, futureRows, nearest }
  })
  const nearestFuture = [...future].sort((a,b)=>a.date.localeCompare(b.date))[0]
  const incoming = directionRows.find((row)=>row.kind==='incoming')
  const outgoing = directionRows.find((row)=>row.kind==='outgoing')
  const stageLine = stageRows.map((row)=>`${row.label} ${row.current?'현재 열림':row.futureRows.length?`후보 ${row.futureRows.length}개`:'후보 없음'}`).join(' · ')
  const movementOrder = '감정이 다시 올라옴 → 메시지·답장·안부처럼 실제 접촉 → 대화가 이어짐 → 구체적인 약속 제안 → 실제 만남 → 이전 문제를 다르게 다루는 합의'
  const currentStory = current.length
    ? `지금 기준일에는 ${current.map((row)=>row.label).join(' · ')} 단계가 현재 창에 걸려 있어. ${stageLine}. 마음이 다시 움직이는 시기와 실제 관계가 움직이는 시기는 같은 단계가 아니므로, 현재 열린 단계보다 뒤의 일을 한꺼번에 재회로 묶어 읽지 않아.`
    : `지금 기준일을 포함하는 공개 활성창은 없어. ${stageLine}. 이것은 감정이 없다는 뜻이 아니라, 현재 날짜가 감정·연락·만남·재구축 관문을 통과한 구간은 아니라는 뜻이야. 마음이 다시 움직이는 시기와 실제 관계가 움직이는 시기는 따로 봐.`
  const whyStory = reunionV2?.why_reconnect
    ? `${reunionV2.why_reconnect.conclusion} ${reunionV2.why_reconnect.interpretation}`
    : `과거 인연이 다시 의식되는 층과 실제 접촉으로 넘어가는 층을 분리해서 보고 있어. 생각이 나거나 예전 대화가 다시 의미 있게 느껴지는 것만으로는 연락 단계가 열린 게 아니고, 메시지·답장·안부처럼 실제 상호작용으로 넘어가는 후보가 따로 잡혀야 해.`
  const initiativeStory = reunionV2?.initiative
    ? `${reunionV2.initiative.conclusion} ${reunionV2.initiative.interpretation}`
    : `상대 → 나는 ${incoming?.band ?? '정보 부족'}, 나 → 상대는 ${outgoing?.band ?? '정보 부족'}으로 잡혀 있어. 이 값은 숨은 속마음이 아니라 어느 방향의 관계 자극이 더 도드라지는지 보는 보조근거라서, 독립된 행동 방향 근거가 없으면 누가 먼저 연락한다고 단정하지 않아.`
  const timingStory = reunionV2?.timing?.conclusion
    ? reunionV2.timing.conclusion
    : nearestFuture
      ? `가장 가까운 공개 후보는 ${nearestFuture.date} 전후의 ${nearestFuture.label} 단계야. 이 날짜는 사건 확정일이 아니라 해당 단계의 장기·중기·빠른 촉발 근거가 함께 관문을 통과한 후보 구간이야.`
      : '현재 이후 공개할 단계 후보가 없어. 후보가 없는 단계를 억지로 날짜로 만들어내지 않아.'
  const rebuildStory = reunionV2?.rebuild?.conclusion
    ? `${reunionV2.rebuild.conclusion}${reunionV2.rebuild.conditions?.length ? ` ${reunionV2.rebuild.conditions.join(' ')}` : ''}`
    : `연락이 다시 닿는 것과 관계를 다시 이어가는 것은 다른 단계야. 대화가 이어지고, 실제 약속과 만남으로 넘어가며, 이전에 관계를 끊게 만든 문제를 이번에는 어떻게 다르게 다룰지 합의가 생겨야 재구축 단계로 읽을 수 있어. ${sustainabilityText}`
  const repeatStory = reunionV2?.repeat_risks?.conclusion
    ? `${reunionV2.repeat_risks.conclusion}${reunionV2.repeat_risks.patterns?.length ? ` ${reunionV2.repeat_risks.patterns.join(' ')}` : ''}`
    : '다시 연락이 닿더라도 예전과 같은 방식으로 대화가 끊기거나 약속이 흐려진다면 연락 단계에서 다시 멈출 수 있어. 재접촉 자체보다 연락 뒤의 대화 지속, 약속 제안, 실제 만남, 문제를 다루는 방식이 달라지는지를 확인해야 해.'

  return <section className="reading-section reunion-hierarchy reunion-ui-vnext">'''
s=must_replace(s,anchor,insert,'hierarchy story setup')

old_start='''    {!valid ? <p role="alert">계산 검증을 통과하지 못해서 현재·미래 판정을 보류했어.</p> : <>
      <section className="reunion-ai-block reunion-current-state">'''
new_start='''    {!valid ? <p role="alert">계산 검증을 통과하지 못해서 현재·미래 판정을 보류했어.</p> : <>
      <div className="reunion-story">
        <section className="reunion-story-section reunion-story-current"><h4>지금 두 사람 사이에서 살아 있는 흐름</h4><p>{currentStory}</p></section>
        <section className="reunion-story-section reunion-story-why"><h4>왜 다시 신경 쓰이거나 연결될 수 있나</h4><p>{whyStory}</p></section>
        <section className="reunion-story-section reunion-story-stage"><h4>지금 어디까지 와 있나</h4><p>{stageLine}. 지금 열린 단계와 다음 후보 단계를 구분해서 봐야 해.</p></section>
        <section className="reunion-story-section reunion-story-initiative"><h4>누가 먼저 움직일 흐름인가</h4><p>{initiativeStory}</p></section>
        <section className="reunion-story-section reunion-story-order"><h4>다시 움직인다면 어떤 순서인가</h4><p>{movementOrder}. 각 화살표는 자동 승격이 아니야. 답장 하나가 생겼다고 만남이나 재회 단계까지 열린 것으로 보지 않아.</p><div className="reunion-stage-sequence">{movementOrder}</div></section>
        <section className="reunion-story-section reunion-story-timing"><h4>실제 관계가 움직이는 후보 시기</h4><p>{timingStory}</p></section>
        <section className="reunion-story-section reunion-story-rebuild"><h4>연락이 닿은 뒤, 재회까지는 뭐가 남나</h4><p>{rebuildStory}</p></section>
        <section className="reunion-story-section reunion-story-repeat"><h4>다시 멀어질 수 있는 지점</h4><p>{repeatStory}</p></section>
      </div>

      <section className="reunion-ai-block reunion-current-state">'''
s=must_replace(s,old_start,new_start,'story markup insertion')

old_grid='''        <div className="reunion-local-evidence-grid">
          <EvidenceRows evidence={evidence} direction="counterpart_to_user" asOf={hierarchyData.as_of_date} title="상대의 현재 진행 → 나"/>
          <EvidenceRows evidence={evidence} direction="user_to_counterpart" asOf={hierarchyData.as_of_date} title="나의 현재 진행 → 상대"/>
          <EvidenceRows evidence={evidence} direction="shared" asOf={hierarchyData.as_of_date} title="현재의 나 ↔ 현재의 상대 · 진행↔진행"/>
        </div>'''
new_grid='''        <details className="reading-more reunion-technical-evidence">
          <summary>진행차트 근거 보기</summary>
          <div className="reunion-local-evidence-grid">
            <EvidenceRows evidence={evidence} direction="counterpart_to_user" asOf={hierarchyData.as_of_date} title="상대의 현재 진행 → 나"/>
            <EvidenceRows evidence={evidence} direction="user_to_counterpart" asOf={hierarchyData.as_of_date} title="나의 현재 진행 → 상대"/>
            <EvidenceRows evidence={evidence} direction="shared" asOf={hierarchyData.as_of_date} title="현재의 나 ↔ 현재의 상대 · 진행↔진행"/>
          </div>
        </details>'''
s=must_replace(s,old_grid,new_grid,'collapse progression evidence')

old_rel='''        <EvidenceRows evidence={evidence} direction="relationship_itself" asOf={hierarchyData.as_of_date} title="진행 컴포짓 · 관계 자체"/>'''
new_rel='''        <details className="reading-more reunion-technical-evidence"><summary>진행 컴포짓 근거 보기</summary><EvidenceRows evidence={evidence} direction="relationship_itself" asOf={hierarchyData.as_of_date} title="진행 컴포짓 · 관계 자체"/></details>'''
s=must_replace(s,old_rel,new_rel,'collapse relationship progression evidence')
write(p,s)

# 4) The generic deterministic appendix should be closed on modern hierarchy results.
p=Path('web/src/RelationshipInterpretationPanel.tsx')
s=read(p)
s=must_replace(s,'<details className="relationship-calculated-fallback" open={!(ai?.ok && ai.data)}>','<details className="relationship-calculated-fallback" open={!hierarchyData && !(ai?.ok && ai.data)}>','close generic appendix for hierarchy')
write(p,s)

# 5) Tighten AI editorial contract and invalidate old shallow reunion prose cache.
p=Path('supabase/functions/relationship-interpret-v9-preview/index.ts')
s=read(p)
s=must_replace(s,'const REUNION_VERSION="relationship-v12.5-directional-evidence-narrative";','const REUNION_VERSION="relationship-v12.6-editorial-stage-story";','reunion interpreter version')
needle='- "실제 행동을 봐", "속단하지 마", "대화가 중요해" 같은 범용 조언은 전체 해설에서 한 번을 넘기지 말고, 대신 계산 근거가 만드는 구체적 관계 역학을 설명한다.'
extra='''- "실제 행동을 봐", "속단하지 마", "대화가 중요해" 같은 범용 조언은 전체 해설에서 한 번을 넘기지 말고, 대신 계산 근거가 만드는 구체적 관계 역학을 설명한다.
- 재회 해설은 독립 카드 여러 장처럼 쓰지 말고 하나의 상담 서사로 이어라. 순서는 반드시 [현재 살아 있는 흐름] → [왜 다시 신경 쓰이는가] → [지금 어느 단계인가] → [누가/어떻게 움직일 여지] → [연락 창] → [만남 창] → [재구축 조건] → [반복 위험] 순서다.
- 첫 2~3문장 안에서 감정 재활성화·연락/재접촉·실제 만남·관계 재구축 네 단계를 각각 현재 열림/미래 후보/후보 없음 중 무엇인지 구분해라.
- "마음이 다시 움직이는 시기"와 "실제 관계가 움직이는 시기"를 반드시 분리해 설명해라. 감정 활성만으로 연락·만남·재구축을 승격하지 마라.
- 같은 안전문구를 섹션마다 반복하지 마라. 각 섹션은 앞 섹션에 없던 새 정보를 추가해야 한다.
- 현실 장면은 계산 근거가 허용할 때만 구체적으로 써라: 상대가 떠오름/예전 대화를 되짚음/메시지·답장·안부/대화가 며칠 이어짐/약속 제안/실제 만남/이전 문제를 다르게 다루는 합의. 근거 없는 속마음·행동은 만들지 마라.
- 본문은 사람말이 먼저다. 행성명·각·오브·하우스·진행차트 기술어는 결론을 설명하는 데 꼭 필요한 1회만 쓰고 나머지는 기술 근거로 밀어라.'''
s=must_replace(s,needle,extra,'editorial narrative rules')
write(p,s)

p=Path('web/src/lib/readingCache.ts')
s=read(p)
s=must_replace(s,"const RELATIONSHIP_REUNION_AI_CACHE_CONTRACT = 'relationship-v12.5-directional-evidence-narrative-v1'","const RELATIONSHIP_REUNION_AI_CACHE_CONTRACT = 'relationship-v12.6-editorial-stage-story-v1'",'reunion cache version')
write(p,s)

# 6) Update version expectations and add focused contract tests.
p=Path('web/src/lib/relationshipReunionV2.contract.test.mjs')
s=read(p).replace('relationship-v12\\.5-directional-evidence-narrative','relationship-v12\\.6-editorial-stage-story').replace('relationship-v12\\.5-directional-evidence-narrative-v1','relationship-v12\\.6-editorial-stage-story-v1')
write(p,s)

p=Path('web/src/lib/humanLanguageV25.test.mjs')
s=read(p)
s=s.replace('REUNION_VERSION="relationship-v12\\.4-stage-grounded-narrative"','REUNION_VERSION="relationship-v12\\.6-editorial-stage-story"')
s=s.replace('relationship-v12\\.4-stage-grounded-narrative-v1','relationship-v12\\.6-editorial-stage-story-v1')
write(p,s)

p=Path('web/src/lib/reunionUiVnext.test.mjs')
s=read(p)
# Keep existing vNext order checks; editorial story adds another readable layer without deleting deterministic sections.
write(p,s)

newtest=ROOT/'web/src/lib/reunionEditorialV126.test.mjs'
newtest.write_text(r'''import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const panel=readFileSync(new URL('../ReunionHierarchyPanel.tsx',import.meta.url),'utf8')
const css=readFileSync(new URL('../reunion-reading-product-v13.css',import.meta.url),'utf8')
const readingCss=readFileSync(new URL('../reading-experience.css',import.meta.url),'utf8')
const edge=readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/index.ts',import.meta.url),'utf8')
const cache=readFileSync(new URL('./readingCache.ts',import.meta.url),'utf8')
const host=readFileSync(new URL('../RelationshipInterpretationPanel.tsx',import.meta.url),'utf8')

test('final app background owner no longer ties aurora y positions to content height',()=>{
  assert.doesNotMatch(readingCss,/ellipse at 0 8%/)
  assert.doesNotMatch(readingCss,/ellipse at 100% 30%/)
  assert.doesNotMatch(readingCss,/ellipse at 12% 70%/)
  assert.match(readingCss,/linear-gradient\(90deg,#c5eaf13d/)
})

test('reunion story precedes technical progression evidence',()=>{
  const headings=['지금 두 사람 사이에서 살아 있는 흐름','왜 다시 신경 쓰이거나 연결될 수 있나','지금 어디까지 와 있나','누가 먼저 움직일 흐름인가','다시 움직인다면 어떤 순서인가','실제 관계가 움직이는 후보 시기','연락이 닿은 뒤, 재회까지는 뭐가 남나','다시 멀어질 수 있는 지점']
  let cursor=-1
  for(const heading of headings){const next=panel.indexOf(heading);assert.ok(next>cursor,heading);cursor=next}
  assert.ok(panel.indexOf('진행차트 근거 보기')>cursor)
  assert.match(panel,/마음이 다시 움직이는 시기와 실제 관계가 움직이는 시기/)
})

test('raw progression evidence is collapsed and has breathing room',()=>{
  assert.match(panel,/details className="reading-more reunion-technical-evidence"/)
  assert.match(panel,/summary>진행차트 근거 보기/)
  assert.match(css,/\.reunion-local-evidence-grid[\s\S]*gap:\s*26px/)
  assert.match(css,/\.reunion-technical-evidence[\s\S]*margin-top:\s*28px/)
})

test('modern hierarchy keeps generic appendix closed by default',()=>{
  assert.match(host,/open=\{!hierarchyData && !\(ai\?\.ok && ai\.data\)\}/)
})

test('v12.6 invalidates shallow cache and enforces editorial stage story',()=>{
  assert.match(edge,/REUNION_VERSION="relationship-v12\.6-editorial-stage-story"/)
  assert.match(cache,/relationship-v12\.6-editorial-stage-story-v1/)
  assert.match(edge,/마음이 다시 움직이는 시기/)
  assert.match(edge,/실제 관계가 움직이는 시기/)
  assert.match(edge,/독립 카드 여러 장처럼 쓰지 말고 하나의 상담 서사로 이어라/)
  assert.match(edge,/답장·안부/)
})
''')

print('reunion editorial v12.6 patch applied')
