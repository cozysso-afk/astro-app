import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const birthplace = readFileSync(new URL('../koreaBirthplaces.tsx', import.meta.url), 'utf8')
const fontCss = readFileSync(new URL('../reading-font-fix-v54.css', import.meta.url), 'utf8')
import {renderReunion,hierarchy,candidate} from './fixtures/reunionPanel.mjs'

test('birthplace chooser avoids native select and preserves rendered relationship results', () => {
  assert.match(birthplace, /createPortal/)
  assert.match(birthplace, /function LocationChoice/)
  assert.match(birthplace, /shouldPreserveRenderedResults/)
  assert.match(birthplace, /document\.querySelector\('\.results-wrap'\)/)
  assert.match(birthplace, /Object\.assign\(value, next\)/)
  assert.match(birthplace, /stagedSelectionRef/)
  assert.match(birthplace, /stagedValueRef/)
  assert.match(birthplace, /sourceValueRef/)
  assert.match(birthplace, /sameBirthplaceValue/)
  assert.match(birthplace, /stagedValueRef\.current && sameBirthplaceValue\(value, stagedValueRef\.current\)/)
  assert.match(birthplace, /stagedSelectionRef\.current\?\.district/)
  assert.match(birthplace, /if \(stagedSelectionRef\.current\) return/)
  assert.match(birthplace, /selection: \{ region: string; district: string \}/)
  assert.match(birthplace, /\{ region: nextRegion, district: '' \}/)
  assert.match(birthplace, /className="stable-choice-trigger"/)
  assert.doesNotMatch(birthplace, /<select\b/)
})

test('reunion consultation prose uses one serif family while headings and controls stay separate', () => {
  assert.match(fontCss, /relationship-experience\[data-mode="reunion"\] \.reunion-story-section > p/)
  assert.match(fontCss, /relationship-experience\[data-mode="reunion"\] \.reunion-behavior-guide > p/)
  assert.match(fontCss, /relationship-experience\[data-mode="reunion"\] \.reunion-final-takeaway > p/)
  assert.match(fontCss, /font-family: var\(--reading-display, 'Noto Serif KR', 'AppleMyungjo', 'Batang', serif\) !important/)
})

test('main reunion reader never exposes internal stage identifiers', () => {
  const ids=['emotional_reactivation','contact_recontact','in_person_meeting','relationship_rebuilding','initiative_gate']
  const stages=Object.fromEntries(ids.map(id=>[id,{label:id,activation:60,candidate_count:1}]))
  const data={...hierarchy,stages,top_periods:[candidate('2027-01-09')]}
  const archive={...hierarchy,past_windows:[candidate('2026-08-01','initiative_gate','initiative_gate')]}
  const html=renderReunion({hierarchy:data,historyHierarchy:archive,historyCalculated:true})
  const prose=html.replace(/<[^>]*>/g,' ')
  for(const id of ids) assert.ok(!prose.includes(id),id)
  assert.match(prose,/2026-08-01 ~ 2026-08-01\s+· 관계 단계 미확인/)
  assert.match(prose,/만남을 살펴볼 시기/)
  assert.match(prose,/연락이 닿음\s+확인됨/)
  assert.equal((html.match(/aria-current="step"/g)||[]).length,1)
})

test('birthplace region step stays staged while placeKey is empty', () => {
  assert.match(birthplace, /stagedSelectionRef\.current = selection[\s\S]*stagedValueRef\.current = next[\s\S]*onChange\(next\)/)
  assert.match(birthplace, /A region-only selection has an empty placeKey/)
})
