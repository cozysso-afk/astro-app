import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test, {before,after} from 'node:test'
import {createServer} from 'vite'
import {fileURLToPath} from 'node:url'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {validateRelationshipEditorial} from '../../../supabase/functions/relationship-interpret-v9-preview/relationshipEditorialV1.ts'

let server,documents,Panel,external
before(async()=>{
  server=await createServer({root:fileURLToPath(new URL('../..',import.meta.url)),optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false},appType:'custom'})
  documents=await server.ssrLoadModule('/src/lib/authoredReadingDocument.ts')
  Panel=(await server.ssrLoadModule('/src/RelationshipInterpretationPanel.tsx')).RelationshipInterpretationPanel
  external=await server.ssrLoadModule('/src/lib/resultFormatters.ts')
})
after(async()=>server?.close())
const fixture=()=>({headline:'합성 핵심 제목',overview:'전체 상세 원고',core_summary:'이것은 원문 전달 검사용 핵심이야.',core_reason:'계산 원고의 이유를 보존해.',core_action:'실제 행동을 확인해.',core_conditions:[],chemistry:'끌림 원문',emotional_dynamic:'정서 원문',communication:'대화 원문',conflict_pattern:'갈등 원문',power_boundaries:'경계 원문',long_term:'지속 원문',timing:'기간 원문',reunion_context:'',felt_scenarios:['생활 장면 원문'],practical_advice:[],top_aspects:[],limits:'해석 범위 원문',marriage_reading:Object.fromEntries(['bottom_line','bond','emotional_home','daily_life','intimacy_resources','conflict_repair','commitment_or_current_cycle','timing','caution','precision_note'].map(key=>[key,`${key} 원문`]))})
const aiFor=data=>({ok:true,origin:'gemini',provenance_verified:true,data})
const renderPanel=(analysisMode,ai)=>renderToStaticMarkup(createElement(Panel,{aspects:[],partnerExact:false,ai,aiLoading:false,aiError:'',onAi:()=>{},analysisMode,timeSensitivePoints:new Set(),formatAspect:()=>'',readingPeriod:{start:'2026-11-04',end:'2026-11-04'}}))

const app = readFileSync(new URL('../AppNext.tsx', import.meta.url), 'utf8')
const panel = readFileSync(new URL('../RelationshipInterpretationPanel.tsx', import.meta.url), 'utf8')
const personalPanel = readFileSync(new URL('../PersonalMarriagePanel.tsx', import.meta.url), 'utf8')
const cache = readFileSync(new URL('./readingCache.ts', import.meta.url), 'utf8')
const relationshipFn = readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/index.ts', import.meta.url), 'utf8')
const formatters = readFileSync(new URL('./resultFormatters.ts', import.meta.url), 'utf8')
const relationshipSummary = readFileSync(new URL('./relationshipUserSummary.ts', import.meta.url), 'utf8')
const api = readFileSync(new URL('../../../api/main.py', import.meta.url), 'utf8')
const personalEngine = readFileSync(new URL('../../../personal_marriage_v1.py', import.meta.url), 'utf8')

test('unmarried marriage splits no-counterpart forecast from specific-partner marriage compatibility', () => {
  assert.match(app, /marriageScope.*'personal'.*'partner'/s)
  assert.match(app, /상대 없음 · 개인 결혼운/)
  assert.match(app, /결혼 가능성 · 시기 · 미래 배우자상/)
  assert.match(app, /특정 상대 있음 · 결혼궁합/)
  assert.match(app, /const isPersonalMarriage/)
  assert.match(app, /const needsCounterpart/)
  assert.match(app, /\/v1\/marriage\/personal/)
  assert.match(app, /isPersonalMarriage\?runPersonalMarriage:runRelationship/)
  assert.match(app, /\{needsCounterpart&&<>/)
  assert.match(app, /setMarriageMode\('married'\);setMarriageScope\('partner'\)/)
  assert.doesNotMatch(personalPanel, /supabase\.functions\.invoke|GEMINI_API_KEY|generateContent/)
})

test('personal marriage preserves computed data with non-prophetic creative presentation', () => {
  assert.match(api, /@app\.post\("\/v1\/marriage\/personal"\)/)
  assert.match(api, /counterpart_required["']:\s*False/)
  assert.match(personalEngine, /"counterpart_required": False/)
  assert.match(personalEngine, /"marriage_probability": True/)
  assert.match(personalEngine, /"spouse_archetype_prediction": True/)
  assert.match(personalEngine, /"specific_identity_claims": False/)
  assert.match(personalEngine, /marriage_probability_percent/)
  assert.match(personalEngine, /spouse_archetype/)
  assert.match(personalEngine, /appearance_hints/)
  assert.match(personalEngine, /career_clusters/)
  assert.match(personalEngine, /meeting_route/)
  assert.match(personalPanel, /forecast\.marriage_probability_percent/)
  assert.match(personalPanel, /나의 취향을 그려본다면/)
  assert.match(personalPanel, /spouse\.appearance_hints/)
  assert.match(personalPanel, /JSON\.stringify\(result, null, 2\)/)
  assert.match(personalPanel, /통계 확률 아님/)
  assert.match(personalPanel, /기술 근거 자세히 보기/)
  assert.match(personalPanel, /AI 초상 콘셉트 프롬프트 복사/)
})

test('relationship AI keeps compatibility reunion unmarried-partner and married semantics separate', () => {
  assert.match(relationshipFn, /type Purpose="compatibility"\|"reunion"\|"marriage_unmarried"\|"marriage_married"/)
  assert.match(relationshipFn, /CALCULATED_DATA\.reunion_evidence_v2/)
  assert.match(relationshipFn, /reunion_dimensions:base\.reunion_dimensions/)
  assert.match(relationshipFn, /reunion_timing_windows:base\.reunion_timing_windows/)
  assert.match(relationshipFn, /reunion_secondary_support:base\.reunion_secondary_support/)
  assert.match(relationshipFn, /initiative_gate/)
  assert.match(relationshipFn, /감정 활성 \/ 연락·재접촉 \/ 실제 만남 \/ 관계 재결합/)
  assert.match(relationshipFn, /왜 다시 연결될 여지가 있는가/)
  assert.match(relationshipFn, /같은 파생계열 반복은 수렴 근거로 세지 않는다/)
  assert.match(relationshipFn, /reunion_synthesis_v2:reunionSchema/)
  assert.match(relationshipFn, /특정 상대가 있는 미혼 결혼궁합/)
  assert.match(relationshipFn, /생활가치·역할·현실조건/)
  assert.match(relationshipFn, /결혼 성립 날짜·프러포즈·약혼 사건은 만들지 않는다/)
  assert.match(relationshipFn, /이미 결혼한 두 사람의 결혼생활 분석/)
  assert.match(relationshipFn, /결혼 가능성 표현은 금지/)
  assert.match(relationshipFn, /intimacy_resources/)
  assert.match(relationshipFn, /if\(!available\)aspects=aspects\.filter/)
  assert.match(relationshipFn, /누락하거나 제외하지 말고 전부 분석한다/)
  assert.match(app, /analysisMode === 'reunion' && !reunionTiming/)
})

test('marriage UI preserves each authored question and excludes generic duplicate fields', () => {
  for(const mode of ['marriage_unmarried','marriage_married']){
    const data=fixture(),html=renderPanel(mode,aiFor(data))
    assert.ok(html.includes(`data-mode="${mode}"`))
    for(const [key,value] of Object.entries(data.marriage_reading)){assert.ok(html.includes(`data-reading-section="marriage:${key}"`));assert.ok(html.includes(value))}
    assert.ok(!html.includes(data.chemistry));assert.ok(html.includes('기술 근거 자세히 보기'))
  }
})

test('compatibility and both marriage modes prioritize different real-life questions', () => {
  assert.match(relationshipSummary, /const sectionOrder: Role\[\] = married/)
  assert.match(relationshipSummary, /\['communication','stability','attraction','power','perspective'\]/)
  assert.match(relationshipSummary, /\['stability','communication','attraction','power','perspective'\]/)
  assert.match(relationshipSummary, /반복 갈등 · 회복 방식/)
  assert.match(relationshipSummary, /생활 책임 · 돌봄 분담/)
  assert.match(relationshipSummary, /생활비 · 집안일 · 책임/)
  assert.match(relationshipSummary, /결정권 · 가족 경계/)
  assert.match(relationshipSummary, /결혼 전 합의할 것/)
  assert.match(relationshipSummary, /이번에 함께 바꿀 것/)
  assert.match(relationshipSummary, /생활비·집안일·돌봄·가족행사·혼자 쉴 시간/)
  assert.match(relationshipSummary, /말이 꼬였을 때 서로 뜻을 확인하고 다시 대화를 이어갈 수 있는지가 핵심/)
  const data=fixture()
  const unmarried=documents.buildRelationshipReadingDocument(aiFor(data),'marriage_unmarried','2026-11-04')
  const married=documents.buildRelationshipReadingDocument(aiFor(data),'marriage_married','2026-11-04')
  assert.equal(unmarried.sections.find(s=>s.id==='marriage:commitment_or_current_cycle').label,'약속과 결혼의 조건')
  assert.equal(married.sections.find(s=>s.id==='marriage:commitment_or_current_cycle').label,'현재 관계의 과제')
  const compatibility=documents.buildRelationshipReadingDocument(aiFor(data),'compatibility','2026-11-04')
  for(const key of ['chemistry','emotional_dynamic','communication','conflict_pattern','power_boundaries','long_term'])assert.equal(compatibility.sections.find(s=>s.id===key).blocks[0].text,data[key])
})

test('relationship modes never render deterministic prose as the authored reading', () => {
  for(const mode of ['compatibility','reunion','marriage_unmarried','marriage_married']){
    const data=fixture(),unverified=renderPanel(mode,{...aiFor(data),provenance_verified:false})
    assert.ok(unverified.includes('관계 해설이 아직 작성되지 않았어'))
    assert.ok(!unverified.includes(data.core_summary));assert.ok(!unverified.includes(data.overview))
    const verified=renderPanel(mode,aiFor(data))
    assert.ok(verified.includes(data.core_summary));assert.ok(verified.includes(data.overview))
    assert.ok(!verified.includes('relationship-calculated-fallback'))
  }
})

test('relationship AI has bounded paid calls cumulative usage server cache and rolling breaker', () => {
  assert.match(relationshipFn, /MAX_GEMINI_CALLS=2/)
  assert.match(relationshipFn, /MAX_PROMPT_BYTES=180000,REUNION_PROMPT_TARGET_BYTES=40000,MAX_AI_JOB_ESTIMATED_KRW=300/)
  assert.match(relationshipFn, /addUsage\(firstUsage,second\.usage/)
  assert.match(relationshipFn, /attempt_count:calls/)
  assert.match(relationshipFn, /supabase-relationship-v11/)
  assert.match(readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/publicError.ts', import.meta.url),'utf8'), /server_cache:true/)
  assert.match(relationshipFn, /rolling_job_guard:true/)
  assert.match(relationshipFn, /cost_guard_blocked:true/)
  assert.match(relationshipFn, /ai_interpret_jobs/)
  assert.match(cache, /RELATIONSHIP_AI_CACHE_CONTRACT = 'relationship-v12\.7-grounded-question-reading-contract'/)
  assert.match(cache, /RELATIONSHIP_REUNION_AI_CACHE_CONTRACT = 'relationship-v14\.10-grounded-stage-question-reading-contract'/)
  assert.match(cache, /purpose === 'reunion' \? RELATIONSHIP_REUNION_AI_CACHE_CONTRACT : RELATIONSHIP_AI_CACHE_CONTRACT/)
})

test('external relationship prompt is compact bounded and clearly separated from raw full copy', () => {
  assert.match(formatters, /EXTERNAL_RELATIONSHIP_PROMPT_MAX_CHARS = 28000/)
  assert.match(formatters, /compactRelationshipExternalPacket/)
  assert.match(formatters, /for \(let level=0; level<=2; level\+\+\)/)
  assert.match(formatters, /prompt\.slice\(0,EXTERNAL_RELATIONSHIP_PROMPT_MAX_CHARS - 180\)/)
  assert.match(formatters, /좌표·원본 API 요청은 이미 계산에 반영됐으므로 외부 AI 입력에서는 중복 제거했다/)
  assert.match(app, /ExternalPromptCopy onCopy={mode=>.*relationshipPromptText/)
  assert.doesNotMatch(app, /handleCopy\('요청\/프롬프트 전체복사', relationshipPromptText/)
  for(const kind of ['compatibility','reunion','marriage']){
    const prompt=external.relationshipPromptText(kind,{analysis_mode:kind==='marriage'?'marriage_unmarried':kind,user:{name:'합성'},counterpart:{time_known:false}},{result:{natal_synastry:{aspects:[]},raw_private_marker:'DO_NOT_COPY_RAW'},period:{start:'2026-11-04',end:'2026-11-04'}})
    assert.ok(prompt.length<=28000);assert.ok(!prompt.includes('DO_NOT_COPY_RAW'));assert.match(prompt,/출생시간 모름/)
  }
})

test('marriage generation requires exact mode and preserves complete question answers',()=>{
  for(const mode of ['marriage_unmarried','marriage_married']){
    const data=fixture();data.marriage_reading.mode=mode
    for(const key of ['chemistry','emotional_dynamic','communication','conflict_pattern','power_boundaries','long_term','timing'])data[key]=''
    data.felt_scenarios=[]
    assert.equal(validateRelationshipEditorial(data,mode).ok,true)
    data.marriage_reading.mode=mode==='marriage_married'?'marriage_unmarried':'marriage_married'
    assert.equal(validateRelationshipEditorial(data,mode).reason,'marriage_mode_mismatch')
  }
})

// Run the executable browser boundary suite through the existing CI entrypoint.
import './relationshipAiPublicError.test.mjs'
// These execute the real handler with mocked provider/DB boundaries: no paid calls.
import '../../../supabase/functions/relationship-interpret-v9-preview/publicError.test.mjs'
