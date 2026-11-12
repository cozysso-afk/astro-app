import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { hierarchy, renderReunion } from './fixtures/reunionPanel.mjs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const css = read('../reunion-reading-product-v13.css')
const edge = read('../../../supabase/functions/relationship-interpret-v9-preview/index.ts')

test('three future contact candidates remain accessible and past dates are limited to the history section', () => {
  const contact = date => ({date, start:date, end:date, stage:'contact_recontact', final:60})
  const future = ['2026-09-16','2026-09-19','2026-09-24']
  const past = contact('2026-09-03')
  const html = renderReunion({
    hierarchy:{...hierarchy, top_periods:[past, ...future.map(contact)]},
    historyHierarchy:{...hierarchy, past_windows:[past]},
    historyCalculated:true,
    observation:{state:'disconnected', initiator:'', events:[]},
  })
  const dates = html.match(/다음 단계의 계산상 참고 시기([\s\S]*?)<\/section>/)?.[1]
  assert.ok(dates)
  for (const date of future) assert.ok(dates.includes(date), date)
  assert.doesNotMatch(dates,/2026-09-03/)
  assert.match(html,/지난 시기와 실제 기록 비교[\s\S]*?2026-09-03/)
  assert.match(html,/연락·대화: 42/)
  assert.match(html,/실제 첫 연락<\/b> · 미기록/)
  assert.match(html,/차트 활성도만으로 수신·발신 행동이나 먼저 연락할 사람을 정할 수 없어요/)
})

test('fallback gives old results a bounded card and keeps the generation action optional on mobile', () => {
  const html = renderReunion({hierarchy:null})
  assert.match(html,/relationship-experience reading-experience/)
  assert.match(html,/class="reading-section reunion-legacy-result" role="status"/)
  assert.match(html,/과거 날짜를 현재나 미래의 추천 시기로 읽지 마/)
  assert.match(html,/class="reading-section relationship-natural-reading" data-relationship-state="not_requested"/)
  assert.match(html,/자연어 해설 생성<\/button>/)
  assert.match(css,/\.app-shell \.relationship-experience \{[^}]*overflow-x: clip !important;[^}]*touch-action: pan-y;/)
  assert.match(css,/\.relationship-experience \.reading-section,[^{]+\{[^}]*min-width: 0 !important;[^}]*max-width: 100% !important;/)
})

test('reunion generation carries sensitivity evidence and uses a dedicated output schema and token budget', () => {
  assert.match(edge,/versionForPurpose=.*purpose==="reunion"\?REUNION_VERSION:VERSION/)
  assert.match(edge,/if\(purpose==="reunion"\)return compactMode\?6500:8500/)
  assert.match(edge,/if\(purpose==="reunion"\)[\s\S]*?reunion_synthesis_v2:reunionSchema[\s\S]*?required:\[[^\]]*"reunion_synthesis_v2"\]/)
  assert.match(edge,/sensitivity_scan:sensitivityPacket\(r\?\.sensitivity_scan\)/)
  assert.match(edge,/일반론 조언 금지/)
})
