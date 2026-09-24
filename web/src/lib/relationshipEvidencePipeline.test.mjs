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
  for (const field of ['composite','progressed_synastry','progressed_composite','marks_tertiary','timing_timezone_policy','reunion_evidence_contract']) {
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
  assert.match(formatters, /compactReunionDimensionsForExternal\(rawResult\.reunion_dimensions,caps\)/)
  assert.match(formatters, /compactReunionSecondarySupportForExternal\(rawResult\.reunion_secondary_support,caps\.months,caps\.tight\)/)
  assert.match(formatters, /reunion_timing_windows: rawResult\.reunion_timing_windows \?\? null/)
  assert.match(formatters, /reunion_return_support: rawResult\.reunion_return_support \?\? null/)
  assert.doesNotMatch(formatters, /reunion_dimensions: rawResult\.reunion_dimensions \?\? null/)
  assert.doesNotMatch(formatters, /reunion_secondary_support: rawResult\.reunion_secondary_support \?\? null/)
  assert.match(edge, /secondaryDimensionPacket/)
  assert.match(edge, /reunion_evidence_contract:base\.reunion_evidence_contract/)
  assert.match(edge, /reunion_timing_windows:base\.reunion_timing_windows/)
})

test('relationship interpretation cache versions track the provisional-time and current reunion narrative contracts', () => {
  assert.match(edge, /VERSION="relationship-v11\.8-provisional-time-reference"/)
  assert.match(edge, /REUNION_VERSION="relationship-v12\.9-grounding-false-negative"/)
  assert.match(cache, /RELATIONSHIP_AI_CACHE_CONTRACT = 'relationship-v11\.8-provisional-time-reference'/)
  assert.match(cache, /RELATIONSHIP_REUNION_AI_CACHE_CONTRACT = 'relationship-v12\.9-grounding-false-negative-v1'/)
})