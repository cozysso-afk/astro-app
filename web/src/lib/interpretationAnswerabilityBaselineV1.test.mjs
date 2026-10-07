import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (url) => readFileSync(new URL(url, import.meta.url), 'utf8')

const hierarchyEngine = read('../../../reunion_hierarchy_v2.py')
const hierarchyView = read('./reunionHierarchy.ts')
const compactPrompt = read('./compactDeepPrompt.ts')
const resultFormatters = read('./resultFormatters.ts')
const reunionPanel = read('../ReunionHierarchyPanelV3.tsx')
const providerSchema = read('../../../supabase/functions/fortune-interpret-v23-preview/providerSchemaV23.ts')
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

test('A3 baseline gap B: relationship compact prompt carries future hierarchy but omits past/current windows', () => {
  assert.match(compactPrompt, /reunion_hierarchy:kind==='reunion'\?pick\(r\.reunion_hierarchy/)
  assert.match(compactPrompt, /['"]top_periods['"]/)
  assert.match(compactPrompt, /['"]nearest_window['"]/)
  assert.doesNotMatch(compactPrompt, /past_windows/)
  assert.doesNotMatch(compactPrompt, /current_windows/)
})

test('A4 baseline gap B: production relationship Edge hierarchy packet also omits past/current windows', () => {
  assert.match(relationshipEdge, /function hierarchyPacket/)
  assert.match(relationshipEdge, /top_periods/)
  assert.match(relationshipEdge, /nearest_window/)
  const packet = relationshipEdge.slice(relationshipEdge.indexOf('function hierarchyPacket'), relationshipEdge.indexOf('function aspect'))
  assert.doesNotMatch(packet, /past_windows/)
  assert.doesNotMatch(packet, /current_windows/)
})

test('A5 baseline: result formatter preserves hierarchy fields except audit-heavy traces', () => {
  assert.match(resultFormatters, /reunion_hierarchy/)
  assert.match(resultFormatters, /daily_trace/)
  assert.match(resultFormatters, /long_term_daily/)
  assert.match(resultFormatters, /saju_boundaries/)
})

test('A6 baseline gap E: readable reunion prose can filter technical causal sentences', () => {
  assert.match(reunionPanel, /const TECHNICAL_RE/)
  assert.match(reunionPanel, /function readerSentences/)
  assert.match(reunionPanel, /filter\(row\s*=>\s*!TECHNICAL_RE\.test\(row\)\)/)
})

test('A7 baseline D: provider editorial sections share one six-field shape', () => {
  assert.match(providerSchema, /EDITORIAL_FIELDS\s*=\s*\["conclusion","real_scene","action","change_condition","evidence_refs","applicability"\]/)
  for (const key of ['relationship.contact_activation','relationship.contact_continuity','work_study.work','work_study.career_change','work_study.exam','work_study.study','money_news.money','money_news.news','condition.condition']) {
    assert.ok(providerSchema.includes(`"${key}"`), `missing audited section ${key}`)
  }
})

test('A10 preserved: period narrative already differentiates day, week, month and annual objectives', () => {
  for (const key of ["day:", "week:", "month:", "annual:"]) assert.ok(periodNarrative.includes(key), `missing period contract ${key}`)
  assert.match(periodNarrative, /hours-and-one-day/)
  assert.match(periodNarrative, /early-mid-late-week/)
  assert.match(periodNarrative, /early-mid-late-month/)
  assert.match(periodNarrative, /quarters-and-months/)
})

test('A8 preserved: relationship direction values exist but side activation alone cannot decide initiative', () => {
  assert.match(relationshipWestern, /incoming/)
  assert.match(relationshipWestern, /outgoing/)
  assert.match(relationshipWestern, /initiative_gate/)
  assert.match(relationshipWestern, /available["']?\s*:\s*False/)
  assert.match(relationshipWestern, /side activation alone is not an action-direction indicator/)
})

test('A9 preserved: fortune presentation has an explicit incoming/outgoing comparison path', () => {
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
