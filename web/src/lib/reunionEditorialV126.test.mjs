import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const panel=readFileSync(new URL('../ReunionHierarchyPanelV3.tsx',import.meta.url),'utf8')
const css=readFileSync(new URL('../reunion-quality-v74.css',import.meta.url),'utf8')
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
  const headings=['재회 흐름 한눈에','재회 단계별 흐름','받는 연락 · 보내는 연락','앞으로 주목할 시기','지금 확인할 것','관계를 이해하는 해설','왜 다시 연결됐나','재회로 넘어가려면','다시 만났을 때의 유지력','다시 깨질 수 있는 지점']
  let cursor=-1
  for(const heading of headings){const next=panel.indexOf(heading);assert.ok(next>cursor,heading);cursor=next}
  assert.ok(panel.indexOf('계산 근거와 점수 보기')>cursor)
  assert.match(panel,/다음 관문/)
})

test('raw progression evidence is collapsed and has breathing room',()=>{
  assert.match(panel,/details className="reunion-v5-details"/)
  assert.match(panel,/summary>계산 근거와 점수 보기/)
  assert.match(css,/\.reunion-v5-stages[\s\S]*gap:\s*8px/)
  assert.match(css,/\.reunion-v5-section[\s\S]*padding:\s*16px 0/)
})

test('modern hierarchy keeps generic appendix closed by default',()=>{
  assert.match(host,/open=\{!hierarchyData && !\(ai\?\.ok && ai\.data\)\}/)
})

test('v12.6 invalidates shallow cache and enforces editorial stage story',()=>{
  assert.match(edge,/REUNION_VERSION="relationship-v13\.3-stage-answer"/)
  assert.match(cache,/relationship-v13\.3-stage-answer-v1/)
  assert.match(edge,/마음이 다시 움직이는 시기/)
  assert.match(edge,/실제 관계가 움직이는 시기/)
  assert.match(edge,/독립 카드 여러 장처럼 쓰지 말고 하나의 상담 서사로 이어라/)
  assert.match(edge,/답장·안부/)
})
