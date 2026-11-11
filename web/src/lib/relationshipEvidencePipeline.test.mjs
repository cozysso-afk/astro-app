import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const ts=require('typescript')
function cacheApi(source){
  const module={exports:{}}
  const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText
  new Function('module','exports','require',compiled)(module,module.exports,()=>({}))
  return module.exports
}

const engine = readFileSync(new URL('../../../relationship_western_v1.py', import.meta.url), 'utf8')
const api = readFileSync(new URL('../../../api/main.py', import.meta.url), 'utf8')
const types = readFileSync(new URL('../appTypes.ts', import.meta.url), 'utf8')
const edge = readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/index.ts', import.meta.url), 'utf8')
const formatters = readFileSync(new URL('./resultFormatters.ts', import.meta.url), 'utf8')
const cache = readFileSync(new URL('./readingCache.ts', import.meta.url), 'utf8')

test('calculation evidence survives API to internal Gemini and external-AI prompt contracts', () => {
  for (const field of ['composite','progressed_synastry','progressed_composite','marks_tertiary','timing_timezone_policy','reunion_evidence_contract']) {
    assert.match(engine, new RegExp(`[\"']${field}[\"']`), `engine must emit ${field}`)
    assert.match(edge, new RegExp(field), `internal Gemini packet must retain ${field}`)
    assert.match(formatters, new RegExp(field), `external AI packet must retain ${field}`)
  }
  assert.match(api, /result[\"']:\s*result/)
  assert.match(types, /progressed_synastry\?: RelationshipProgressedSynastry/)
  assert.match(types, /progressed_composite\?: RelationshipProgressedComposite/)
  assert.match(types, /marks_tertiary\?: RelationshipMarksTertiary/)
  assert.match(edge, /advanced:\{composite:advancedPacket/)
  assert.match(edge, /monthlyAdvancedPacket\(m,L\.tight\)/)
  assert.match(edge, /timing_contract:\{timing_timezone_policy:/)
  assert.match(formatters, /compactAdvancedMonthForExternal\(month,caps\.tight\)/)
  assert.match(formatters, /composite:compactAdvancedStaticForExternal\(rawResult\.composite\)/)
  assert.match(formatters, /timing_contract:\s*\{/)
  assert.match(formatters, /compactReunionDimensionsForExternal\(rawResult\.reunion_dimensions,caps\)/)
  assert.match(formatters, /compactReunionSecondarySupportForExternal\(rawResult\.reunion_secondary_support,caps\.months,caps\.tight\)/)
  assert.match(formatters, /reunion_timing_windows: rawResult\.reunion_timing_windows \?\? null/)
  assert.match(formatters, /reunion_return_support: rawResult\.reunion_return_support \?\? null/)
  assert.doesNotMatch(formatters, /reunion_dimensions: rawResult\.reunion_dimensions \?\? null/)
  assert.doesNotMatch(formatters, /reunion_secondary_support: rawResult\.reunion_secondary_support \?\? null/)
  assert.match(edge, /secondaryDimensionPacket/)
  assert.match(edge, /reunion_evidence_contract:base\.reunion_evidence_contract/)
  assert.match(edge, /reunion_timing_windows:base\.reunion_timing_windows/)
})

test('new question contracts invalidate old cache while retaining mode and observation identity', () => {
  const current=cacheApi(cache),legacy=cacheApi(cache.replaceAll('relationship-v12.7-grounded-question-reading-contract','relationship-v12.0-gemini-single-author').replaceAll('relationship-v14.11-observed-fact-reading-contract','relationship-v14.10-grounded-stage-question-reading-contract'))
  const versions={compatibility:'relationship-v12.7-grounded-question-reading-contract',reunion:'relationship-v14.11-observed-fact-reading-contract'}
  for(const [purpose,version] of Object.entries(versions)){
    assert.ok(edge.includes(`="${version}"`),`${purpose}: server contract`)
    assert.ok(cache.includes(`= '${version}'`),`${purpose}: browser contract`)
  }
  const calc={period:{start:'2026-11-04',end:'2026-11-04'},result:{synthetic:true}},model='gemini-3.6-flash'
  const keys=['compatibility','reunion','marriage_unmarried','marriage_married'].map(mode=>{
    const key=current.relationshipAiCacheId(calc,mode,model)
    assert.notEqual(key,legacy.relationshipAiCacheId(calc,mode,model))
    assert.equal(key,current.relationshipAiCacheId({result:calc.result,period:calc.period},mode,model))
    return key
  })
  assert.equal(new Set(keys).size,4)
  assert.notEqual(current.relationshipAiCacheId(calc,'reunion',model,{reunion_observation:{state:'messaging'}}),current.relationshipAiCacheId(calc,'reunion',model,{reunion_observation:{state:'disconnected'}}))
})
