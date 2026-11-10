import assert from 'node:assert/strict'
import test from 'node:test'
import { periodFrame, westernPeriodFact } from './systemPeriodFacts.ts'

test('labels follow the selected calendar dates', () => {
  assert.equal(periodFrame('2026-11-11','2026-11-11',1,'2026-11-10'),'2026-11-11')
  assert.equal(periodFrame('2026-12-01','2026-12-31',31,'2026-11-10'),'2026년 12월')
})
test('day and period use their actual data; out-of-range or tied highlights are omitted', () => {
  const stat = {average:53, best_days:[{date:'2026-11-15',score:62},{date:'2026-12-01',score:90}],caution_days:[{date:'2026-11-06',score:42}]}
  assert.equal(westernPeriodFact(stat,'2026-11-11','2026-11-11'),'2026-11-11 기준 53점')
  assert.match(westernPeriodFact(stat,'2026-11-01','2026-11-30'),/평균 53점 · 높은 날 2026-11-15\(62점\), 낮은 날 2026-11-06\(42점\)/)
  stat.caution_days[0].score = 62
  assert.equal(westernPeriodFact(stat,'2026-11-01','2026-11-30'),'2026-11-01~2026-11-30 평균 53점')
})
