import test from 'node:test'
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
