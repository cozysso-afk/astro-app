import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
const fortune=readFileSync(new URL('../../../supabase/functions/fortune-interpret-v21-preview/costGuardV21.ts',import.meta.url),'utf8')
const relation=readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/index.ts',import.meta.url),'utf8')
const period=readFileSync(new URL('../PeriodFortuneResults.tsx',import.meta.url),'utf8')
const panel=readFileSync(new URL('../RelationshipInterpretationPanel.tsx',import.meta.url),'utf8')
const app=readFileSync(new URL('../AppNext.tsx',import.meta.url),'utf8')
test('estimated whole-job 300 KRW guard replaces small byte-only cost ceilings',()=>{assert.match(fortune,/MAX_AI_JOB_ESTIMATED_KRW=300/);assert.match(fortune,/HARD_PROMPT_BYTES=180000/);assert.match(relation,/MAX_PROMPT_BYTES=180000,MAX_AI_JOB_ESTIMATED_KRW=300/);assert.match(relation,/relationshipEstimatedJobKrw/)})
test('Gemini is primary and fresh relationship AI auto archives',()=>{assert.ok(period.indexOf('<PeriodAiInterpretationPanel') < period.indexOf('period-fallback-reading'));assert.ok(panel.indexOf('relationship-natural-reading') < panel.indexOf('relationship-calculated-fallback'));assert.match(app,/archive_mode:'relationship_ai_auto_v1'/);assert.match(app,/interpretation:annotated/)})
