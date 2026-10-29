import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateRelationshipCase, evaluateRelationshipCases } from './relationship-quality-audit.mjs'
import { requestBody } from './relationship-live-qa.mjs'

const prose='서로 다른 계산 근거를 현실의 대화 장면으로 구체적으로 설명하고 확인할 조건을 함께 제시하는 문장이다. '.repeat(3)
const section=topic=>`${topic}에서는 ${topic}만의 계산 지표와 상대 반응, 생활 장면, 확인 조건, 주의할 행동을 구체적으로 나누어 설명한다. ${topic}에 맞는 선택과 관찰 기준도 별도로 제시한다. `.repeat(2)
const result={origin:'gemini',provenance_verified:true,model:'gemini-3.6-flash',interpreter_version:'relationship-v12.0-gemini-single-author',usage:{generation_version:'relationship-v12.0-gemini-single-author',attempt_count:1,call_trace:[{call:1,model:'gemini-3.6-flash',kind:'initial',http_status:200,finish_reason:'STOP',outcome:'success'}]},data:{headline:'궁합 해설',overview:prose,chemistry:section('끌림과 애정표현'),emotional_dynamic:section('정서 안정과 공감'),communication:section('대화 속도와 오해'),conflict_pattern:section('갈등 촉발과 수습'),power_boundaries:section('주도권과 개인 경계'),long_term:section('장기 책임과 생활'),timing:'계산된 흐름',reunion_context:'재회와 별도',felt_scenarios:['장면 하나','장면 둘'],practical_advice:[],top_aspects:[],limits:'한계',reunion_reading:{},marriage_reading:{}}}

test('live reunion calculation request uses an accepted status and explicit reunion mode',()=>{const body=requestBody({purpose:'reunion',user:{},counterpart:{}});assert.equal(body.relationship_status,'single');assert.equal(body.analysis_mode,'reunion')})

test('verified compatibility fixture passes six stages but remains fixture-only',()=>{const row=evaluateRelationshipCase({id:'fixture',purpose:'compatibility',calculation:{},result});assert.equal(row.passed,true);assert.equal(row.stages.length,6);const report=evaluateRelationshipCases([{id:'fixture',purpose:'compatibility',calculation:{},result}]);assert.equal(report.live_gemini_cases,0);assert.equal(report.fixture_only,true)})
test('self-declared Gemini without a successful call trace is rejected',()=>{const bad=structuredClone(result);bad.usage.call_trace=[];const row=evaluateRelationshipCase({id:'bad',purpose:'compatibility',calculation:{},result:bad});assert.equal(row.passed,false);assert(row.issues.includes('SUCCESSFUL_CALL_TRACE_MISSING'))})
test('uncomputed date and deterministic reunion claim are rejected',()=>{const bad=structuredClone(result);bad.data.overview='반드시 연락한다. 2027-01-02';const row=evaluateRelationshipCase({id:'bad',purpose:'compatibility',calculation:{period:{start:'2027-01-01'}},result:bad});assert(row.issues.includes('UNSUPPORTED_DETERMINISTIC_CLAIM'));assert(row.issues.includes('DATE_NOT_IN_CALCULATION'))})
