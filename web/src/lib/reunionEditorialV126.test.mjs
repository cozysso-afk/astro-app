import test from 'node:test'
import {renderHierarchy,renderReunion,hierarchy,candidate} from './fixtures/reunionPanel.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const panel=readFileSync(new URL('../ReunionHierarchyPanelV3.tsx',import.meta.url),'utf8')
const css=readFileSync(new URL('../reunion-quality-v74.css',import.meta.url),'utf8')
const readingCss=readFileSync(new URL('../reading-experience.css',import.meta.url),'utf8')
const edge=readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/index.ts',import.meta.url),'utf8')
const cache=readFileSync(new URL('./readingCache.ts',import.meta.url),'utf8')

test('final app background owner no longer ties aurora y positions to content height',()=>{
  assert.doesNotMatch(readingCss,/ellipse at 0 8%/)
  assert.doesNotMatch(readingCss,/ellipse at 100% 30%/)
  assert.doesNotMatch(readingCss,/ellipse at 12% 70%/)
  assert.match(readingCss,/linear-gradient\(90deg,#c5eaf13d/)
})

test('recorded facts and calculated dates precede technical progression evidence',()=>{
  const html=renderHierarchy({hierarchyData:{...hierarchy,top_periods:[candidate('2027-01-12')]},
    reunionV2:{summary:'실제 상황부터 확인해요.',why_reconnect:{conclusion:'연락을 다시 한 이유를 확인해요.'},
    rebuild:{conclusion:'다음 대화를 함께 정해요.'},repeat_risks:{conclusion:'예전 갈등이 반복되는지 봐요.'},
    consultation_answer:{next_stage_up_conditions:['둘이 약속을 정하는지 봐요.']}},sustainabilityText:'만남 뒤에도 약속을 지키는지 봐요.'})
  const headings=['입력한 관계 기록','관계가 어디까지 왔는지','다음 단계의 계산상 참고 시기','연락 방향 참고값','계산 근거와 점수 보기']
  assert.doesNotMatch(html,/만남 뒤에도 약속을 지키는지 봐요|다음 대화를 함께 정해요/)
  let cursor=-1
  for(const heading of headings){const next=html.indexOf(heading);assert.ok(next>cursor,heading);cursor=next}

})

test('raw progression evidence is collapsed and has breathing room',()=>{
  assert.match(panel,/details className="reunion-v5-details"/)
  assert.match(panel,/summary>계산 근거와 점수 보기/)
  assert.match(css,/\.reunion-v4-stage-rail > li\s*\{[^}]*gap:\s*(?:[89]|[1-9]\d+)px/)
  assert.match(css,/\.reunion-v5-section\s*\{[^}]*padding:\s*(?:1[6-9]|[2-9]\d)px 0/)
})

test('modern hierarchy keeps generic appendix closed by default',()=>{
  for(const props of [{},{hierarchy:null}]) {
    const html=renderReunion(props)
    assert.match(html,/<details class="relationship-technical"><summary>기술 근거 자세히 보기/)
    assert.doesNotMatch(html,/<details[^>]*class="relationship-technical"[^>]*open/)
  }
})

test('v12.6 invalidates shallow cache and enforces editorial stage story',()=>{
  const v=edge.match(/REUNION_VERSION="([^"]+)"/)?.[1]
  assert.ok(v && !v.startsWith('relationship-v13.3'))
  assert.ok(cache.includes(`RELATIONSHIP_REUNION_AI_CACHE_CONTRACT = '${v}'`))
  assert.match(edge,/마음이 다시 움직이는 시기/)
  assert.match(edge,/실제 관계가 움직이는 시기/)
  assert.match(edge,/독립 카드 여러 장처럼 쓰지 말고 하나의 상담 서사로 이어라/)
  assert.match(edge,/답장·안부/)
})
