import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'


const panel = readFileSync(new URL('../HoraryPrashnaPanel.tsx', import.meta.url), 'utf8')
const home = readFileSync(new URL('../HomeControls.tsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../AppNext.tsx', import.meta.url), 'utf8')


test('Horary Prashna entry is exposed without changing calculation tools', () => {
  assert.match(home, /key: 'horary'/)
  assert.match(app, /selectedTool === 'horary'/)
  assert.match(app, /<HoraryPrashnaPanel apiBase=\{API_BASE\}/)
})


test('browser geolocation is requested only by the explicit location button', () => {
  assert.match(panel, /const useCurrentLocation = \(\) =>/)
  assert.match(panel, /navigator\.geolocation\.getCurrentPosition/)
  assert.match(panel, /onClick=\{useCurrentLocation\}/)
  assert.doesNotMatch(panel, /useEffect\s*\(/)
  assert.doesNotMatch(panel, /localStorage|sessionStorage/)
  assert.match(panel, /버튼을 눌렀을 때만 브라우저 위치 권한을 요청/)
})


test('permission failure keeps manual latitude and longitude fallback visible', () => {
  assert.match(panel, /위치 권한이 거절됐어/)
  assert.match(panel, />위도</)
  assert.match(panel, />경도</)
  assert.match(panel, /location_source: locationReady \? locationSource : 'none'/)
})


test('entry posts classification metadata and renders loading error clarification states', () => {
  assert.match(panel, /\/v1\/horary-prashna\/classify/)
  assert.match(panel, /question_time_local/)
  assert.match(panel, /utc_offset_hours/)
  assert.match(panel, /timezone_id/)
  assert.match(panel, /질문 유형 확인 중/)
  assert.match(panel, /status-banner error/)
  assert.match(panel, /needs_clarification/)
})


test('entry renders routing only and never starts chart judgement', () => {
  assert.match(panel, /차트 계산과 실제 판단을 아직 만들지 않기 때문에/)
  assert.doesNotMatch(panel, /\/v1\/horary-prashna\/(?:chart|judge|predict)/)
  assert.doesNotMatch(panel, /gemini/i)
})
