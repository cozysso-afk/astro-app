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

test('reunion surface leads with gated timing and keeps initiative undetermined',()=>{
  assert.match(panel,/재접점 활성도:/)
  assert.match(panel,/선연락 주체: 판정 불가/)
  assert.match(panel,/오늘 이후 가장 강한 기간 TOP 3/)
  assert.match(panel,/이미 지나간 활성기/)
})

test('reunion mobile reading is locked to vertical gestures and uses bounded fallback cards',()=>{
  assert.match(css,/\.relationship-experience \{[\s\S]*overflow-x: clip;[\s\S]*touch-action: pan-y;/)
  assert.match(panel,/relationship-fallback-card/)
  assert.match(panel,/relationship-section-heading/)
})

test('reunion AI uses a reunion-specific cost and output contract instead of generic compatibility essays',()=>{
  assert.match(rel,/relationship-v12\.0-hierarchical-timing/)
  assert.match(rel,/purpose==="reunion"\)return compactMode\?6500:8500/)
  assert.match(rel,/if\(purpose==="reunion"\)return \{type:"OBJECT",properties:/)
  assert.match(rel,/sensitivity_scan:sensitivityPacket\(r\?\.sensitivity_scan\)/)
  assert.match(rel,/일반론 조언 금지/)
})
