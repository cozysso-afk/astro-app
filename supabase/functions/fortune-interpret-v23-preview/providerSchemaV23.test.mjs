import assert from 'node:assert/strict'
import test from 'node:test'
import { SCHEMA, TOPICS, validateOutput } from '../fortune-interpret-v6-preview/integratedInterpretationV2.ts'
import { EDITORIAL_SECTION_KEYS, buildProviderCoreSchema, normalizeProviderCore } from './providerSchemaV23.ts'

const section=(key,index)=>({
  key,
  conclusion:`결론 ${index}`,
  real_scene:`현실 장면 ${index}`,
  action:`행동 ${index}`,
  change_condition:`판단 변경 조건 ${index}`,
  evidence_refs:[`W:test:${index}`],
  applicability:'conditional',
})

const splitSection=(key,index)=>({
  key,
  conclusion:`결론 ${index}`,
  applies_when:`만약 조건 ${index}에 해당할 때`,
  evidence_meaning:`근거 의미 ${index}`,
  action:`행동 ${index}`,
  change_condition:`판단 변경 조건 ${index}`,
  evidence_refs:[`W:test:${index}`],
  applicability:'conditional',
})

test('provider schema flattens repeated editorial object branches into one compact keyed array',()=>{
  const provider=buildProviderCoreSchema(SCHEMA)
  const clusters=provider.properties.clusters
  const original=SCHEMA.properties.clusters
  assert.equal(clusters.type,'ARRAY')
  assert.equal(clusters.minItems,undefined)
  assert.equal(clusters.maxItems,undefined)
  assert.deepEqual(clusters.items.properties.key,{type:'STRING'})
  assert.equal(new Set(EDITORIAL_SECTION_KEYS).size,EDITORIAL_SECTION_KEYS.length)
  assert.equal(provider.properties.topic_analysis,undefined)
  assert.ok(!provider.required.includes('topic_analysis'))
  assert.ok(JSON.stringify(clusters).length<JSON.stringify(original).length)
  // Gemini's structured-output schema rejects array size keywords for this
  // object graph. Response length is bounded by the sparse prompt contract.
  assert.equal(provider.properties.domain_answers.maxItems,undefined)
  assert.equal(provider.properties.key_windows.maxItems,undefined)
})

test('period schema does not force windows or quarterly phases unsupported by evidence',()=>{
  const month=buildProviderCoreSchema(SCHEMA,'month')
  const monthItem=month.properties.clusters.items
  assert.ok(monthItem.required.includes('applies_when'))
  assert.ok(monthItem.required.includes('evidence_meaning'))
  assert.ok(!monthItem.required.includes('real_scene'))
  assert.equal(monthItem.properties.real_scene,undefined)
  assert.ok(monthItem.properties.applies_when)
  assert.ok(monthItem.properties.evidence_meaning)
  const dayItem=buildProviderCoreSchema(SCHEMA,'day').properties.clusters.items
  assert.ok(dayItem.required.includes('real_scene'))
  assert.equal(dayItem.properties.applies_when,undefined)
  assert.equal(dayItem.properties.evidence_meaning,undefined)
  assert.equal(month.properties.key_windows.minItems,0)
  assert.equal(month.properties.decisions.minItems,0)
  assert.equal(month.properties.priorities.minItems,0)
  assert.equal(month.properties.year_phases.minItems,undefined)
  const annual=buildProviderCoreSchema(SCHEMA,'annual')
  assert.equal(annual.properties.key_windows.minItems,0)
  assert.equal(annual.properties.decisions.minItems,0)
  assert.equal(annual.properties.priorities.minItems,0)
  assert.equal(annual.properties.year_phases.minItems,0)
  assert.equal(annual.properties.cross_checks.minItems,0)
})

test('provider editorial array normalizes back to the existing grouped API shape with every key exactly once',()=>{
  const rows=EDITORIAL_SECTION_KEYS.map(section)
  const normalized=normalizeProviderCore({headline:'테스트',clusters:rows})
  assert.equal(normalized.clusters.relationship.summary.conclusion,'결론 0')
  assert.equal(normalized.clusters.relationship.contact_continuity.conclusion,'결론 14')
  assert.equal(normalized.clusters.work_study.work.conclusion,'결론 15')
  assert.equal(normalized.clusters.money_news.news.conclusion,'결론 20')
  assert.equal(normalized.clusters.investment.entry.conclusion,'결론 23')
  assert.equal(normalized.clusters.condition.condition.conclusion,'결론 24')
  assert.deepEqual(Object.keys(normalized.clusters.relationship).sort(),EDITORIAL_SECTION_KEYS.filter(key=>key.startsWith('relationship.')).map(key=>key.split('.')[1]).sort())
})

test('period split fields survive normalization while the legacy scene alias remains compatible',()=>{
  const rows=EDITORIAL_SECTION_KEYS.map(splitSection)
  const normalized=normalizeProviderCore({headline:'테스트',clusters:rows})
  const first=normalized.clusters.relationship.summary
  assert.equal(first.applies_when,'만약 조건 0에 해당할 때')
  assert.equal(first.evidence_meaning,'근거 의미 0')
  assert.equal(first.real_scene,'만약 조건 0에 해당할 때 근거 의미 0')
  const final=validateOutput({...normalized,overall:{},systems:{},topic_analysis:Object.fromEntries(TOPICS.map(topic=>[topic,{}]))})
  assert.equal(final.clusters.relationship.summary.applies_when,first.applies_when)
  assert.equal(final.clusters.relationship.summary.evidence_meaning,first.evidence_meaning)
})

test('provider normalization isolates a missing key without discarding valid authored sections',()=>{
  const rows=EDITORIAL_SECTION_KEYS.map(section)
  const normalized=normalizeProviderCore({clusters:rows.slice(1)})
  assert.notEqual(normalized.clusters,null)
  assert.equal(normalized.clusters.relationship.summary.applicability,'insufficient')
  assert.deepEqual(normalized.clusters.relationship.summary.evidence_refs,[])
  assert.equal(normalized.clusters.relationship.friends.conclusion,'결론 1')
  assert.equal(normalized.clusters.condition.condition.conclusion,'결론 24')
})

test('provider normalization isolates only a duplicated key and preserves the other unique rows',()=>{
  const rows=EDITORIAL_SECTION_KEYS.map(section)
  const duplicate=[...rows,section(EDITORIAL_SECTION_KEYS[0],99)]
  const normalized=normalizeProviderCore({clusters:duplicate})
  assert.equal(normalized.clusters.relationship.summary.applicability,'insufficient')
  assert.equal(normalized.clusters.relationship.friends.conclusion,'결론 1')
  assert.equal(normalized.clusters.work_study.work.conclusion,'결론 15')
  assert.equal(normalized.clusters.condition.condition.conclusion,'결론 24')
})

test('provider normalization ignores unknown rows and isolates malformed known rows field by field',()=>{
  const rows=EDITORIAL_SECTION_KEYS.map(section)
  rows[20]={...rows[20],applicability:'broken'}
  rows.push(section('unknown.extra',99))
  const normalized=normalizeProviderCore({clusters:rows})
  assert.equal(normalized.clusters.money_news.news.applicability,'insufficient')
  assert.equal(normalized.clusters.money_news.money.conclusion,'결론 19')
  assert.equal(normalized.clusters.investment.psychology.conclusion,'결론 21')
})

test('provider normalization turns a missing cluster array into isolated insufficient sections rather than nulling the core',()=>{
  const normalized=normalizeProviderCore({headline:'테스트'})
  assert.equal(normalized.headline,'테스트')
  assert.equal(normalized.clusters.relationship.summary.applicability,'insufficient')
  assert.equal(normalized.clusters.condition.condition.applicability,'insufficient')
  assert.equal(Object.keys(normalized.clusters.relationship).length,15)
})

test('daily writer finishes field evidence before composing its first-screen answer',()=>{
  const schema=buildProviderCoreSchema(SCHEMA,'day')
  assert.deepEqual(schema.propertyOrdering.slice(0,4),['clusters','editorial_focus','overall','headline'])
  assert.ok(schema.required.includes('editorial_focus'))
  assert.ok(schema.properties.editorial_focus.required.includes('evidence_refs'))
  assert.equal(buildProviderCoreSchema(SCHEMA,'week').properties.editorial_focus,undefined)
  assert.equal(SCHEMA.properties.editorial_focus,undefined)
})
