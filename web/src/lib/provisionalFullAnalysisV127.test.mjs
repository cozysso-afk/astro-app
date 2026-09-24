import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const ui=readFileSync(new URL('../RelationshipPrecisionDetails.tsx',import.meta.url),'utf8')
const css=readFileSync(new URL('../mobile-density-v29.css',import.meta.url),'utf8')
const edge=readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/index.ts',import.meta.url),'utf8')
const cache=readFileSync(new URL('./readingCache.ts',import.meta.url),'utf8')

test('entered birth time is presented as full provisional analysis, not excluded',()=>{
  assert.match(ui,/입력 생시 · 전체 분석 포함/)
  assert.match(ui,/전부 분석에 포함해/)
  assert.match(ui,/입력 생시는 분석에서 빼지 않아/)
  assert.doesNotMatch(ui,/각도·하우스 계열은 결정적 근거로 쓰지 않아/)
})

test('circled precision summaries have visible mobile inset and rhythm',()=>{
  assert.match(css,/relationship-precision-card>\.relationship-precision-summary[\s\S]*padding:17px 18px 16px!important/)
  assert.match(css,/row-gap:8px!important/)
  assert.match(css,/relationship-time-reliability-card[\s\S]*padding:18px 18px 17px!important/)
})

test('AI contract analyzes all entered-time layers while marking uncertainty',()=>{
  assert.match(edge,/REUNION_VERSION="relationship-v12\.7-provisional-full-analysis"/)
  assert.match(edge,/누락하거나 제외하지 말고 전부 분석한다/)
  assert.match(edge,/exact\/provisional 모두 whole_house/)
  assert.match(cache,/relationship-v12\.7-provisional-full-analysis-v1/)
})
