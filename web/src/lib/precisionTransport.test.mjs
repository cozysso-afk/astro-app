import assert from 'node:assert/strict'
import test from 'node:test'
import { applyIntegratedPrecisionToRequest, fortuneAiPrecisionReadiness, precisionModeFromProvenance, sanitizeCalculationForExternalAi, sanitizeExternalFortuneText } from './precisionTransport.ts'

function exactPrecision(){return {contract_version:'integrated-precision-v2',time_available:true,time_exact:true,status:'exact',time_source:'official_record',time_confidence:'exact',scoring_mode:'full_exact',allow_natal_moon_scoring:true,allow_angles_houses_scoring:true,allow_house_ruler_bonus:true,allow_intraday_timing:true,allow_saju_ai:true,allow_thai_ai:true,layer_policy:{natal_moon:'allow',angles_houses:'allow',house_ruler_bonus:'allow',intraday_timing:'allow',saju_ai:'allow',thai_ai:'allow'}}}
function provisionalPrecision(){return {contract_version:'integrated-precision-v2',time_available:true,time_exact:false,status:'provisional',time_source:'family_memory',time_confidence:'medium',scoring_mode:'planet_only_provisional',allow_natal_moon_scoring:false,allow_angles_houses_scoring:false,allow_house_ruler_bonus:false,allow_intraday_timing:false,allow_saju_ai:false,allow_thai_ai:false,layer_policy:{natal_moon:'exclude',angles_houses:'exclude',house_ruler_bonus:'exclude',intraday_timing:'exclude',saju_ai:'exclude',thai_ai:'exclude'}}}

test('provenance classifier keeps entered time distinct from exact',()=>{
  assert.equal(precisionModeFromProvenance('official_record','exact',true,'07:26'),'exact')
  assert.equal(precisionModeFromProvenance('family_memory','medium',true,'07:26'),'provisional')
  assert.equal(precisionModeFromProvenance('unknown','unknown',true,'07:26'),'provisional')
  assert.equal(precisionModeFromProvenance('official_record','exact',false,'07:26'),null)
})

test('AI readiness fails closed on legacy and inconsistent contracts',()=>{
  assert.equal(fortuneAiPrecisionReadiness({}).ok,false)
  assert.deepEqual(fortuneAiPrecisionReadiness({precision:exactPrecision()}).mode,'exact')
  assert.deepEqual(fortuneAiPrecisionReadiness({precision:provisionalPrecision()}).mode,'provisional')
  assert.equal(fortuneAiPrecisionReadiness({precision:{...exactPrecision(),time_source:'family_memory'}}).ok,false)
})

test('request transport writes explicit unknown provenance when no snapshot is available',()=>{
  const original=globalThis.localStorage
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem(){return null},setItem(){}}})
  try{
    const request={profile:{birth_date:'1991-03-21',birth_time:'07:26',latitude:34.7,longitude:127.6,place_key:'yeosu'}}
    applyIntegratedPrecisionToRequest(request)
    assert.equal(request.profile.time_known,true)
    assert.equal(request.profile.time_source,'unknown')
    assert.equal(request.profile.time_confidence,'unknown')
    assert.equal(request.profile.rectified_window,null)
  } finally { Object.defineProperty(globalThis,'localStorage',{configurable:true,value:original}) }
})

test('provisional external AI calculation strips Saju Thai angles and sensitive evidence',()=>{
  const calc={precision:provisionalPrecision(),saju:{pillars:{hour:'庚辰'}},thai:{thai_day:'Thursday'},western:{natal:{asc:1,mc:2,house_system:{used:'Placidus'}},detail_days:[{date:'2026-09-10'}],daily_scores:[{evidence:[{kind:'aspect',transit:'Moon',target:'Venus',text:'Moon→Venus trine'},{kind:'aspect',transit:'Venus',target:'Moon',text:'Venus→Moon trine'},{kind:'house',whole_house:7,text:'Venus Whole Sign 7H'}]}]}}
  const safe=sanitizeCalculationForExternalAi(calc)
  assert.equal(safe.saju.provisional_excluded_from_ai,true)
  assert.equal(safe.thai.provisional_excluded_from_ai,true)
  assert.equal(safe.western.natal.asc,null)
  assert.equal(safe.western.detail_days.length,0)
  assert.equal(safe.western.daily_scores[0].evidence.length,1)
  assert.equal(safe.western.daily_scores[0].evidence[0].target,'Venus')
})

test('provisional clipboard text becomes Western-only and parse failure blocks original copy',()=>{
  const calc={precision:provisionalPrecision(),saju:{pillars:{hour:'庚辰'}},thai:{thai_day:'Thursday'},western:{natal:{asc:null,mc:null,house_system:null},detail_days:[],daily_scores:[]}}
  const text=`header\n[원본 계산 JSON]\n${JSON.stringify(calc)}`
  const safe=sanitizeExternalFortuneText(text)
  assert.match(safe,/Western-only/)
  assert.doesNotMatch(safe,/庚辰|Thursday/)
  const malformed='header\n"contract_version": "integrated-precision-v2"\n"status": "provisional"\n[원본 계산 JSON]\n{oops'
  assert.match(sanitizeExternalFortuneText(malformed),/차단/)
})
