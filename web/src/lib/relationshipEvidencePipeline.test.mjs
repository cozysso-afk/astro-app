import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const engine = readFileSync(new URL('../../../relationship_western_v1.py', import.meta.url), 'utf8')
const api = readFileSync(new URL('../../../api/main.py', import.meta.url), 'utf8')
const types = readFileSync(new URL('../appTypes.ts', import.meta.url), 'utf8')
const edge = readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/index.ts', import.meta.url), 'utf8')
const formatters = readFileSync(new URL('./resultFormatters.ts', import.meta.url), 'utf8')
const cache = readFileSync(new URL('./readingCache.ts', import.meta.url), 'utf8')

test('calculation evidence survives API to internal Gemini and external-AI prompt contracts', () => {
  for (const field of ['composite','progressed_synastry','progressed_composite','marks_tertiary','timing_timezone_policy']) {
    assert.match(engine, new RegExp(`[\"']${field}[\"']`), `engine must emit ${field}`)
    assert.match(edge, new RegExp(field), `internal Gemini packet must retain ${field}`)
    assert.match(formatters, new RegExp(field), `external AI packet must retain ${field}`)
  }
  assert.match(api, /result[\"']:\s*result/)
  assert.match(types, /progressed_synastry\?: RelationshipProgressedSynastry/)
  assert.match(types, /progressed_composite\?: RelationshipProgressedComposite/)
  assert.match(types, /marks_tertiary\?: RelationshipMarksTertiary/)
  assert.match(edge, /advanced:\{composite:advancedPacket/)
  assert.match(edge, /monthlyAdvancedPacket\(m,L\.tight\)/)
  assert.match(edge, /timing_contract:\{timing_timezone_policy:/)
  assert.match(formatters, /compactAdvancedMonthForExternal\(month,caps\.tight\)/)
  assert.match(formatters, /composite:compactAdvancedStaticForExternal\(rawResult\.composite\)/)
  assert.match(formatters, /timing_contract:\s*\{/)
})

test('relationship interpretation cache version changes with the evidence packet contract', () => {
  assert.match(edge, /relationship-v11\.3-birth-time-provenance/)
  assert.match(cache, /relationship-v11\.3-birth-time-provenance/)
})
