import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFortuneUserSummary, contactReading } from './fortuneUserSummary.ts'
import { buildFortuneEditorialV3 } from './fortuneEditorialV3.ts'

const stat = (average, band='매우 약함') => ({ average, band, spread:0, best_days:[], caution_days:[] })

function calculation(incoming=39, outgoing=38) {
  return {
    period:{ start:'2026-10-03', end:'2026-10-03', day_count:1, month_segments:1 },
    western:{
      overall:{ 연락:stat(37,'약함'), 소식:stat(42,'다소 약함') },
      relationship_signals:{ 수신신호:stat(incoming), 발신적합:stat(outgoing), 과거인연접점:stat(48,'보통') },
      daily_scores:[], detail_days:[], months:[],
    },
  }
}

function interpretation() {
  const empty = { conclusion:'', real_scene:'', action:'', change_condition:'', evidence_refs:[], applicability:'insufficient' }
  return {
    headline:'연락 흐름',
    overall:{ summary:'연락 흐름', dominant_pattern:'', best_phase:'', caution_phase:'', evidence_refs:[] },
    key_windows:[], cross_checks:[], decisions:[], priorities:[], systems:{}, limits:'',
    clusters:{
      relationship:{ summary:empty, friends:empty, coworkers:empty, family:empty, new_people:empty, boundaries:empty, love_general:empty, love_single:empty, love_crush:empty, love_flirting:empty, love_ambiguous:empty, love_couple:empty, love_reunion_interest:empty, contact_activation:empty, contact_continuity:empty },
      work_study:{ work:empty, career_change:empty, exam:empty, study:empty },
      money_news:{ money:empty, news:empty }, investment:{ psychology:empty, realization:empty, entry:empty }, condition:{ condition:empty },
    },
    contact_flow:{ incoming:'', outgoing:'', reconnection:'' },
    topic_analysis:{
      연락:{ importance:'핵심', verdict:'', reason:'', timing:'', action:'', avoid:'', confidence:'보통', confidence_reason:'', evidence_refs:[] },
      소식:{ importance:'주목', verdict:'', reason:'', timing:'', action:'', avoid:'', confidence:'보통', confidence_reason:'', evidence_refs:[] },
    },
  }
}

test('weak absolute contact strength still exposes the incoming relative edge', () => {
  const calc = calculation(39,38)
  const data = interpretation()
  const summary = buildFortuneUserSummary(data, { period:'today', calculation:calc, topicEntries:Object.entries(data.topic_analysis), focusTopics:['연락','소식'] })
  assert.equal(summary.relationship?.incomingBand, '다소 약함')
  assert.equal(summary.relationship?.outgoingBand, '다소 약함')
  assert.match(contactReading(summary.relationship), /실제 연락이 오거나 안 온다고 판단하지 않아/)
  const editorial = buildFortuneEditorialV3(data, calc, summary, { id:'contact', label:'연락·소식', topics:['연락','소식'] })
  assert.match(editorial.contact?.directionSummary ?? '', /상대 → 나 39, 나 → 상대 38/)
  assert.match(editorial.contact?.directionSummary ?? '', /상대 → 나.*근소 우세/)
  assert.doesNotMatch(editorial.contact?.directionSummary ?? '', /동률/)
})

test('only exact equality is a true direction tie', () => {
  const calc = calculation(39,39)
  const data = interpretation()
  const summary = buildFortuneUserSummary(data, { period:'today', calculation:calc, topicEntries:Object.entries(data.topic_analysis), focusTopics:['연락','소식'] })
  const editorial = buildFortuneEditorialV3(data, calc, summary, { id:'contact', label:'연락·소식', topics:['연락','소식'] })
  assert.match(editorial.contact?.directionSummary ?? '', /같은 값/)
  assert.match(editorial.contact?.directionSummary ?? '', /선연락 주체는 구분되지 않아/)
})
