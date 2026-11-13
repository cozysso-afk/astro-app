import { after } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { fortuneFixture } from './readingExperience.fixtures.mjs'
import { fortuneField } from './fortuneFields.ts'

const server = await createServer({
  root: fileURLToPath(new URL('../..', import.meta.url)),
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
})
const { SystemReadingViews } = await server.ssrLoadModule('/src/SystemReadingViews.tsx')
after(() => server.close())

export function systemFixture(period = 'today') {
  const { calculation } = fortuneFixture(period)
  calculation.precision = {
    contract_version: 'integrated-precision-v2', status: 'exact', time_available: true, time_exact: true,
    time_source: 'official_record', time_confidence: 'exact', scoring_mode: 'full_exact',
    allow_natal_moon_scoring: true, allow_angles_houses_scoring: true, allow_house_ruler_bonus: true,
    allow_intraday_timing: true, allow_saju_ai: true, allow_thai_ai: true,
    layer_policy: Object.fromEntries(['natal_moon','angles_houses','house_ruler_bonus','intraday_timing','saju_ai','thai_ai'].map(k => [k,'allow'])),
  }
  const { start, end } = calculation.period
  calculation.saju = {
    ok: true, pillars: { year:'甲子', day:'丙寅' }, day_master:'丙', elements:{火:2},
    monthly: [{ ganzhi:'甲子', stem_ten_god:'正印(정인)', branch_links:['六合(육합)'],
      segment_start: start+'T00:00:00+09:00', segment_end_exclusive:'2026-10-08T12:00:00+09:00' }],
    daily: [{ date:start, ganzhi:'乙丑', stem_ten_god:'正印(정인)', branch_links:[] }],
  }
  const wheel = [
    { bhumi_key:'mula', bhumi_label:'물질적 기반', planet:{key:'venus', label:'금성'} },
    { bhumi_key:'ayu', bhumi_label:'생활 리듬', planet:{key:'saturn', label:'토성'} },
  ]
  calculation.thai = {
    ok:true, thai_day:'목요일', birth_planet:{label:'목성'}, mahathaksa:{available:true, wheel},
    taksajorn:{available:true, segments:[{start,end,age_in_progress:30,annual_boriwan:{label:'목성'},wheel}]},
    predictive_status:'internal-prediction-status', not_calculated:[],
  }
  return calculation
}

export function systemResponse(systems, overrides = {}) {
  return {ok:true, data:{systems}, model:'gemini-3.7-flash', origin:'gemini', provenance_verified:true,
    usage:{quality_validation:{score:100}}, ...overrides}
}

export function renderSystem(system, {calculation=systemFixture(), field, interpretation, children=null, ...props} = {}) {
  return renderToStaticMarkup(h(SystemReadingViews, {
    calculation, field:fortuneField(field), initialSystem:system, interpretation, ...props,
  }, children))
}
