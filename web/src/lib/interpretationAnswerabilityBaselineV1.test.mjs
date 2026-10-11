import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (url) => readFileSync(new URL(url, import.meta.url), 'utf8')

const hierarchyEngine = read('../../../reunion_hierarchy_v2.py')
const hierarchyView = read('./reunionHierarchy.ts')
const compactPrompt = read('./compactDeepPrompt.ts')
const reunionCompact = read('./reunionCompactEvidence.ts')
const resultFormatters = read('./resultFormatters.ts')
const reunionPanel = read('../ReunionHierarchyPanelV3.tsx')
const providerSchema = read('../../../supabase/functions/fortune-interpret-v23-preview/providerSchemaV23.ts')
const domainContracts = read('../../../supabase/functions/fortune-interpret-v23-preview/domainAnswerContractsV1.ts')
const periodNarrative = read('../../../supabase/functions/fortune-interpret-v23-preview/periodNarrativeV23.ts')
const relationshipWestern = read('../../../relationship_western_v1.py')
const relationshipEdge = read('../../../supabase/functions/relationship-interpret-v9-preview/index.ts')
const fortuneEditorial = read('./fortuneEditorialV3.ts')
const toneCalibration = read('./fortuneToneCalibration.ts')

test('A1 baseline: reunion engine calculates past, current and future hierarchy windows', () => {
  assert.match(hierarchyEngine, /['"]top_periods['"]\s*:/)
  assert.match(hierarchyEngine, /['"]nearest_window['"]\s*:/)
  assert.match(hierarchyEngine, /['"]past_windows['"]\s*:/)
  assert.match(hierarchyEngine, /['"]current_windows['"]\s*:/)
})

test('A2 baseline: web hierarchy view preserves past and current windows', () => {
  assert.match(hierarchyView, /past_windows:\s*pastWindows/)
  assert.match(hierarchyView, /current_windows:\s*currentWindows/)
  assert.match(hierarchyView, /value\.past_windows/)
  assert.match(hierarchyView, /value\.current_windows/)
})

test('A3 preserved: relationship compact prompt keeps structured past/current/future hierarchy', () => {
  assert.match(compactPrompt, /compactReunionHierarchyForExternal/)
  assert.match(reunionCompact, /top_periods:list\(h\.top_periods\)/)
  assert.match(reunionCompact, /past_windows:list\(h\.past_windows\)/)
  assert.match(reunionCompact, /current_windows:list\(h\.current_windows\)/)
  assert.match(reunionCompact, /nearest_window:hierarchyWindow/)
})

test('A4 preserved: production relationship Edge hierarchy packet keeps bounded past/current windows', () => {
  assert.match(relationshipEdge, /function hierarchyPacket/)
  const packet = relationshipEdge.slice(relationshipEdge.indexOf('function hierarchyPacket'), relationshipEdge.indexOf('function aspect'))
  assert.match(packet, /past_windows:/)
  assert.match(packet, /current_windows:/)
  assert.match(packet, /contextLimit=level===0\?3:level===1\?2:1/)
  assert.match(packet, /top_periods:/)
  assert.match(packet, /nearest_window:/)
})

test('A5 baseline: result formatter preserves hierarchy fields except audit-heavy traces', () => {
  assert.match(resultFormatters, /reunion_hierarchy/)
  assert.match(resultFormatters, /daily_trace/)
  assert.match(resultFormatters, /long_term_daily/)
  assert.match(resultFormatters, /saju_boundaries/)
})

test('A6 partial fix: readable reunion prose keeps a technical sentence when plain prose underfills the limit', () => {
  assert.match(reunionPanel, /const TECHNICAL_RE/)
  assert.match(reunionPanel, /function readerSentences/)
  assert.match(reunionPanel, /if \(plain\.length >= limit\)/)
  assert.match(reunionPanel, /selected\.push\(row\)/)
})

test('A7 improved: shared editorial base remains compatible while domain-specific answer extension exists', () => {
  assert.match(providerSchema, /EDITORIAL_FIELDS\s*=\s*\["conclusion","real_scene","action","change_condition","evidence_refs","applicability"\]/)
  assert.match(providerSchema, /core\.properties\.domain_answers/)
  assert.match(providerSchema, /"direct","partial","not_calculated"/)
  for (const topic of ['직장','이직','학업','시험','금전','소식','연애','연락','재회','컨디션']) {
    assert.ok(domainContracts.includes(`topic:'${topic}'`), `missing domain answer contract ${topic}`)
  }
})

test('A8 preserved: period narrative already differentiates day, week, month and annual objectives', () => {
  for (const key of ["day:", "week:", "month:", "annual:"]) assert.ok(periodNarrative.includes(key), `missing period contract ${key}`)
  assert.match(periodNarrative, /hours-and-one-day/)
  assert.match(periodNarrative, /early-mid-late-week/)
  assert.match(periodNarrative, /early-mid-late-month/)
  assert.match(periodNarrative, /quarters-and-months/)
})

test('A9 preserved: relationship direction values exist but side activation alone cannot decide initiative', () => {
  assert.match(relationshipWestern, /incoming/)
  assert.match(relationshipWestern, /outgoing/)
  assert.match(relationshipWestern, /initiative_gate/)
  assert.match(relationshipWestern, /available["']?\s*:\s*False/)
  assert.match(relationshipWestern, /side activation alone is not an action-direction indicator/)
})

test('A10 preserved: fortune presentation has an explicit incoming/outgoing comparison path', () => {
  assert.match(fortuneEditorial, /function directionSummary/)
  assert.match(fortuneEditorial, /['"]수신신호['"]/)
  assert.match(fortuneEditorial, /['"]발신적합['"]/)
})

test('A11 baseline compression boundary: compact fortune packet caps evidence and date depth', () => {
  assert.match(compactPrompt, /evidenceLimit=level>=1\?1:2/)
  assert.match(compactPrompt, /dateLimit=level>=2\?2:4/)
  assert.match(compactPrompt, /slice\(0,evidenceLimit\)/)
})

test('A12 preserved: tone calibration separates evidence direction from activation magnitude', () => {
  assert.match(toneCalibration, /FortuneEvidenceDirection/)
  assert.match(toneCalibration, /hasSupportiveEvidence/)
  assert.match(toneCalibration, /hasChallengingEvidence/)
  assert.match(toneCalibration, /direction === 'supportive'/)
  assert.match(toneCalibration, /direction === 'challenging'/)
})

test('A13 audit boundary: this baseline describes interpretation loss, not calculation probability', () => {
  assert.match(hierarchyEngine, /event_probability/)
  assert.match(relationshipWestern, /event_probability/)
})
