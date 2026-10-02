import test from 'node:test'
import assert from 'node:assert/strict'
import { intradayWindowState, orderTimelineDates, timelineDisplayDate } from './timelineTime.ts'

const at = (hour, minute) => new Date(2026, 9, 2, hour, minute, 0, 0)

test('intraday windows put current and upcoming ranges before already-passed ranges', () => {
  const now = at(12, 8)
  assert.deepEqual(
    orderTimelineDates(['00:30–02:00','06:30–08:00','14:00–15:00','11:30–12:30','18:00–19:00'], now),
    ['11:30–12:30','14:00–15:00','18:00–19:00','06:30–08:00','00:30–02:00'],
  )
})

test('past intraday ranges are visibly marked without changing future ranges', () => {
  const now = at(12, 8)
  assert.equal(intradayWindowState('06:30–08:00', now), 'past')
  assert.equal(timelineDisplayDate('06:30–08:00', now), '지난 · 06:30–08:00')
  assert.equal(timelineDisplayDate('14:00–15:00', now), '14:00–15:00')
})

test('overnight ranges stay current across midnight and ordinary dates keep normal ordering', () => {
  assert.equal(intradayWindowState('23:30–01:00', at(0, 30)), 'current')
  assert.equal(intradayWindowState('23:30–01:00', at(12, 0)), 'upcoming')
  assert.deepEqual(orderTimelineDates(['2026-10-03','2026-10-01','2026-10-02'], at(12, 0)), ['2026-10-01','2026-10-02','2026-10-03'])
})
