import test from 'node:test'
import assert from 'node:assert/strict'
import { TOPICS } from '../fortune-interpret-v6-preview/integratedInterpretationV2.ts'
import { sanitizeProvisionalInterpretationOutput, auditProvisionalResidue } from '../fortune-interpret-v22-preview/precisionV2.ts'
import { auditPeriodDistinctness } from './periodNarrativeV23.ts'
import { buildLocalPeriodAwareFallbackV23 } from './provisionalV23.ts'

const periods = {
  day: { start:'2026-09-17', end:'2026-09-17', day_count:1 },
  week: { start:'2026-09-14', end:'2026-09-20', day_count:7 },
  month: { start:'2026-09-01', end:'2026-09-30', day_count:30 },
  annual: { start:'2026-01-01', end:'2026-12-31', day_count:365 },
}

function payload(kind) {
  const overall = Object.fromEntries(TOPICS.map(topic => {
    const average = topic === '학업' ? 68 : topic === '시험' ? 63 : topic === '연애' ? 38 : 50
    return [topic,{average,band:average>=60?'강':average<40?'약':'보통',spread:kind==='day'?0:12,best_days:[],caution_days:[]}]
  }))
  const date = kind === 'annual' ? '2026-09-17' : kind === 'month' ? '2026-09-17' : '2026-09-17'
  return {
    period_kind:kind, period:periods[kind],
    ranking:{strongest:[{topic:'학업',average:68},{topic:'시험',average:63}],weakest:[{topic:'연애',average:38}]},
    western:{
      overall, relationship_signals:{}, months:[], detail_days:[], key_date_details:[], market:null,
      daily_pattern_digest:Object.fromEntries(TOPICS.map(topic=>[topic,{volatility:kind==='day'?0:6}])),
      daily_evidence_coverage:{days:periods[kind].day_count,days_with_evidence:1},
    },
    key_dates:[{date,topics:['학업','시험'],western_refs:['W:daily:1','W:daily:2']}],
    cross_system_timeline:[], saju:null, thai:null,
    evidence_ledger:[
      ...TOPICS.map(topic=>({id:`W:overall:${topic}`,system:'western',scope:'period_average',topic,direction:topic==='연애'?'caution':'neutral',text:`${topic} 기간 평균`})),
      {id:'W:daily:1',system:'western',scope:'daily_actual',topic:'학업',date,direction:'supportive',text:'Mercury trine Jupiter',observation:{transit:'Mercury',target:'Jupiter',aspect:'trine'}},
      {id:'W:daily:2',system:'western',scope:'daily_actual',topic:'시험',date,direction:'supportive',text:'Mercury trine Jupiter',observation:{transit:'Mercury',target:'Jupiter',aspect:'trine'}},
    ],
  }
}

function final(kind) {
  return sanitizeProvisionalInterpretationOutput(buildLocalPeriodAwareFallbackV23(payload(kind)))
}

function prose(data) {
  return [data.headline,data.overall?.summary,data.overall?.dominant_pattern,data.overall?.best_phase,data.overall?.caution_phase,...(data.priorities??[])].join(' ')
}

test('provisional V23 uses materially different narrative horizons',()=>{
  const outputs=Object.fromEntries(['day','week','month','annual'].map(kind=>[kind,prose(final(kind))]))
  assert.match(outputs.day,/오늘|하루/)
  assert.match(outputs.week,/초반·중반·후반|이번 주/)
  assert.match(outputs.month,/월초·중순·월말|이번 달/)
  assert.match(outputs.annual,/분기|연중|올해/)
  const audit=auditPeriodDistinctness(outputs,0.78)
  assert.equal(audit.ok,true,JSON.stringify(audit.violations))
})

test('provisional V23 remains Western-only and birth-time safe after final scrub',()=>{
  for(const kind of ['day','week','month','annual']) {
    const out=final(kind)
    assert.equal(auditProvisionalResidue(out).ok,true,kind)
    assert.equal(out.systems?.saju,'',kind)
    assert.equal(out.systems?.thai,'',kind)
    assert.doesNotMatch(JSON.stringify(out),/ASC|MC|하우스|오전\s*\d|오후\s*\d/)
  }
})

test('same repeated configuration is narrated once as a phenomenon cluster',()=>{
  const out=final('week')
  const body=prose(out)
  assert.equal((body.match(/Mercury trine Jupiter/g)??[]).length,1)
  assert.match(body,/학업|시험/)
})
