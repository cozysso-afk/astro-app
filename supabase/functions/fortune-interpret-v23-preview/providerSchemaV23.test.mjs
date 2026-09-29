import assert from 'node:assert/strict'
import test from 'node:test'
import { SCHEMA } from '../fortune-interpret-v6-preview/integratedInterpretationV2.ts'
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

test('provider schema flattens repeated editorial object branches into one compact keyed array',()=>{
  const provider=buildProviderCoreSchema(SCHEMA)
  const clusters=provider.properties.clusters
  const original=SCHEMA.properties.clusters
  assert.equal(clusters.type,'ARRAY')
  assert.equal(clusters.minItems,EDITORIAL_SECTION_KEYS.length)
  assert.equal(clusters.maxItems,EDITORIAL_SECTION_KEYS.length)
  assert.deepEqual(clusters.items.properties.key.enum,[...EDITORIAL_SECTION_KEYS])
  assert.equal(new Set(EDITORIAL_SECTION_KEYS).size,EDITORIAL_SECTION_KEYS.length)
  assert.equal(provider.properties.topic_analysis,undefined)
  assert.ok(!provider.required.includes('topic_analysis'))
  assert.ok(JSON.stringify(clusters).length<JSON.stringify(original).length)
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

test('provider normalization rejects missing or duplicate editorial keys instead of silently inventing sections',()=>{
  const rows=EDITORIAL_SECTION_KEYS.map(section)
  assert.equal(normalizeProviderCore({clusters:rows.slice(1)}).clusters,null)
  const duplicate=[...rows.slice(0,-1),section(EDITORIAL_SECTION_KEYS[0],99)]
  assert.equal(normalizeProviderCore({clusters:duplicate}).clusters,null)
})
