import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'


const panel = readFileSync(new URL('../HoraryPrashnaPanel.tsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../horary-prashna.css', import.meta.url), 'utf8')
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
  assert.match(panel, /\/v1\/horary-prashna\/\$\{mode\}/)
  assert.match(panel, /question_time_local/)
  assert.match(panel, /utc_offset_hours/)
  assert.match(panel, /timezone_id/)
  assert.match(panel, /유형 확인 중/)
  assert.match(panel, /status-banner error/)
  assert.match(panel, /response\.status === 404/)
  assert.match(panel, /해설 계산 API가 아직 배포되지 않았어/)
  assert.match(panel, /needs_clarification/)
})


test('iPhone question date and time are separate sized controls', () => {
  assert.match(panel, /type="date"/)
  assert.match(panel, /type="time"/)
  assert.doesNotMatch(panel, /type="datetime-local"/)
  assert.match(styles, /\.horary-date-time-fields\{[^}]*min-width:0/)
  assert.match(styles, /input\[type="date"\]/)
  assert.match(styles, /input\[type="time"\]/)
  assert.match(styles, /font-size:16px/)
  assert.match(styles, /text-align:center/)
  assert.match(styles, /color-scheme:light/)
  assert.doesNotMatch(styles, /input\[type="time"\]\{[^}]*appearance:none/)
  assert.match(styles, /@media\(max-width:480px\)/)
  assert.match(panel, /resetQuestionTime/)
})

test('chart-backed analyze route and optional classification are kept distinct', () => {
  assert.match(panel, /submitQuestion = async \(mode: 'analyze' \| 'classify'\)/)
  assert.match(panel, /horary-prashna\/\$\{mode\}/)
  assert.match(panel, /차트 계산 · 해설 보기/)
  assert.match(panel, /질문 유형만 확인/)
  assert.match(panel, /result\.analysis/)
  assert.match(panel, /Western Horary · 실제 차트/)
  assert.match(panel, /Prashna D1 · 독립 계산/)
  assert.match(panel, /분류 신뢰도/)
  assert.doesNotMatch(panel, /독립 규칙 적용 예정/)
})

test('question and calculation prompt are copyable without fabricating predictions', () => {
  assert.match(panel, /navigator\.clipboard\?\.writeText/)
  assert.match(panel, /document\.execCommand\('copy'\)/)
  assert.match(panel, /프롬프트 복사/)
  assert.match(panel, /chart\.western/)
  assert.match(panel, /chart\.prashna/)
  assert.match(panel, /근거 없이 예측을 만들어내지 마/)
  assert.match(panel, /setResult\(null\)/)
})

