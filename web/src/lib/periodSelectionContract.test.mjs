import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
const app=readFileSync(new URL('../AppNext.tsx',import.meta.url),'utf8')
const home=readFileSync(new URL('../HomeControls.tsx',import.meta.url),'utf8')
const ai=readFileSync(new URL('../PeriodAiInterpretationPanel.tsx',import.meta.url),'utf8')
const css=readFileSync(new URL('../ux-readability-v22.css',import.meta.url),'utf8')
test('calendar periods use Monday-Sunday, calendar month and calendar year',()=>{assert.match(app,/function startOfWeekMonday/);assert.match(app,/const periodSelectionStart = periodStart\(queryDate, period\)/);assert.match(app,/startDate=\{periodSelectionStart\}/);assert.match(app,/return `\$\{start\.slice\(0,4\)\}-12-31`/)})
test('week month year have direct pickers',()=>{assert.match(home,/월요일~일요일/);assert.match(home,/type="month"/);assert.match(home,/연간 선택 · 달력 연도/);assert.match(home,/이전 기간/);assert.match(home,/다음 기간/)})
test('period AI always exposes generation and prompt copy in idle state',()=>{assert.match(ai,/자연어 해설 준비됨/);assert.match(ai,/>해설 생성</);assert.match(ai,/>프롬프트 복사</)})
test('fixed star dots are removed and typography is normalized',()=>{assert.match(css,/\.app-shell::before\{display:none!important\}/);assert.match(css,/period-ai-v21-controls button/);assert.match(css,/uxCardRise/)})
test('married compatibility is explicitly distinct from married marriage fortune',()=>{assert.match(app,/기혼 · 일반 궁합/);assert.match(app,/결혼운 → 기혼/)})
