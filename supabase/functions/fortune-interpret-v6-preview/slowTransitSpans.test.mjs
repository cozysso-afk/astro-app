import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSlowTransitSpans } from './integratedInterpretationV2.ts'

const day=(date,evidence)=>({date,evidence})
const aspect=(transit,aspect,target,topics=['직장'])=>({kind:'aspect',transit,aspect,target,contribution:1,source_topics:topics})

test('a year is described by the slow transits that stay in orb, dated as spans',()=>{
  const rows=[]
  for(let d=1;d<=20;d++)rows.push(day(`2026-03-${String(d).padStart(2,'0')}`,[aspect('Saturn','square','Mercury'),aspect('Moon','trine','Venus')]))
  rows.push(day('2026-06-01',[aspect('Jupiter','trine','Venus',['금전'])]))
  const spans=buildSlowTransitSpans(rows,'annual')
  assert.equal(spans.length,1)
  assert.equal(spans[0].id,'W:span:Saturn-square-Mercury:2026-03-01')
  assert.equal(spans[0].start,'2026-03-01');assert.equal(spans[0].end,'2026-03-20')
  assert.match(spans[0].text,/토성.*수성.*사분/)
  assert.ok(!spans.some(s=>/Moon/.test(s.id)),'the Moon never forms a span')
})

test('short gaps stay one span; long gaps split it',()=>{
  const rows=['2026-01-01','2026-01-02','2026-01-03','2026-01-06','2026-01-07','2026-01-08','2026-01-09','2026-03-01','2026-03-02']
    .map(date=>day(date,[aspect('Pluto','opposition','Sun')]))
  const spans=buildSlowTransitSpans(rows,'annual')
  assert.deepEqual(spans.map(s=>[s.start,s.end]),[['2026-01-01','2026-01-09']])
})
