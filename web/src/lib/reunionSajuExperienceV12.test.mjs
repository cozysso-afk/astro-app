import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const panel=readFileSync(new URL('../RelationshipInterpretationPanel.tsx',import.meta.url),'utf8')
const systems=readFileSync(new URL('../SystemReadingViews.tsx',import.meta.url),'utf8')
const css=readFileSync(new URL('../reading-experience.css',import.meta.url),'utf8')
const rel=readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/index.ts',import.meta.url),'utf8')

test('Saju keeps supported topics selectable even when current period has no direct ten-god lens',()=>{
  assert.match(systems,/system==='saju' \? SAJU_LIFE_KEYS\[t\]\.length>0/)
  assert.match(systems,/직접 연결되는 십성 운 구간이 두드러지지 않아/)
  assert.match(systems,/현재 사주 계산 계약에는 이 분야를 직접 읽을 안전한 근거가 없어/)
})

test('reunion surface leads with direction, timing and initiative comparison',()=>{
  assert.match(panel,/연락·재접촉 상대활성도/)
  assert.match(panel,/누가 먼저 움직일지의 상대활성도/)
  assert.match(panel,/상대 → 나/)
  assert.match(panel,/나 → 상대/)
  assert.match(panel,/과거 인연 재접점/)
})

test('reunion mobile reading is locked to vertical gestures and uses bounded fallback cards',()=>{
  assert.match(css,/\.relationship-experience \{[\s\S]*overflow-x: clip;[\s\S]*touch-action: pan-y;/)
  assert.match(panel,/relationship-fallback-card/)
  assert.match(panel,/relationship-section-heading/)
})

test('reunion AI uses a reunion-specific cost and output contract instead of generic compatibility essays',()=>{
  assert.match(rel,/relationship-v11\.7-reunion-specific/)
  assert.match(rel,/purpose==="reunion"\)return compactMode\?6500:8500/)
  assert.match(rel,/if\(purpose==="reunion"\)return \{type:"OBJECT",properties:/)
  assert.match(rel,/sensitivity_scan:sensitivityPacket\(r\?\.sensitivity_scan\)/)
  assert.match(rel,/근거 없는 일반 상담문구를 반복하지 말고/)
})
