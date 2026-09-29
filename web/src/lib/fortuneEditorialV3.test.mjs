import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildFortuneEditorialV3, editorialGroupCopy } from './fortuneEditorialV3.ts'

function stat(average,band='보통'){return {average,band,spread:0,best_days:[],caution_days:[]}}
function base(){return {periodKind:'day',when:'오늘',headline:'컨디션 복붙',summary:'컨디션 복붙',doTitle:'좋은 흐름',cautionTitle:'주의',focusTitle:'중요',doItems:[],cautionItems:[],bestFlow:['컨디션','직장'],cautionFlow:['금전','소식'],favorableCards:[{topic:'컨디션',score:56,band:'다소 강함',meaning:'집중할 일정과 쉴 시간을 나눠'}],cautionCards:[{topic:'금전',score:35,band:'약함',meaning:'충동 결제를 주의'}],focusTopics:[{topic:'컨디션',conclusion:'무작정 버티기보다 집중할 일정과 쉴 시간을 나눠 쓰기 좋은 날이야.',reason:'',action:'쉬어',observe:'피로'}],referenceTopics:[],importantWindows:[]}}
function calc(){return {period:{start:'2026-09-28',end:'2026-09-28',day_count:1,month_segments:1},western:{overall:{컨디션:stat(56,'다소 강함'),직장:stat(53,'다소 강함'),금전:stat(35,'약함'),소식:stat(36,'약함')},relationship_signals:{수신신호:stat(43,'보통'),발신적합:stat(45,'보통')}}}}
function section(text=''){return {conclusion:text,real_scene:'현실 장면을 구분해.',action:'지금 할 일을 정해.',change_condition:'구체적 행동이 생기면 판단을 바꿔.',evidence_refs:[],applicability:'conditional'}}
function emptyClusters(){return {relationship:Object.fromEntries(['summary','friends','coworkers','family','new_people','boundaries','love_general','love_single','love_crush','love_flirting','love_ambiguous','love_couple','love_reunion_interest','contact_activation','contact_continuity'].map(key=>[key,section()])),work_study:Object.fromEntries(['work','career_change','exam','study'].map(key=>[key,section()])),money_news:{money:section(),news:section()},investment:{psychology:section(),realization:section(),entry:section()},condition:{condition:section()}}}
function data(overrides={}){return {headline:'무작정 버티기보다 집중할 일정과 쉴 시간을 나눠 쓰기 좋은 날이야.',overall:{summary:'무작정 버티기보다 집중할 일정과 쉴 시간을 나눠 쓰기 좋은 날이야.',dominant_pattern:'',best_phase:'',caution_phase:'',evidence_refs:[]},clusters:emptyClusters(),contact_flow:{incoming:'상대 → 나 방향은 보통이야.',outgoing:'나 → 상대 방향은 보통이야.',reconnection:''},topic_analysis:{컨디션:{verdict:'무작정 버티기보다 집중할 일정과 쉴 시간을 나눠 쓰기 좋은 날이야.',reason:'',timing:'',action:'쉬어',avoid:'',importance:'핵심',confidence:'보통',confidence_reason:'',evidence_refs:[]},연락:{verdict:'연락 보통',reason:'',timing:'',action:'대화 지속',avoid:'',importance:'주목',confidence:'보통',confidence_reason:'',evidence_refs:[]},대인관계:{verdict:'대인 기본',reason:'',timing:'',action:'역할 합의',avoid:'',importance:'주목',confidence:'보통',confidence_reason:'',evidence_refs:[]}},...overrides}}

test('integrated hero rejects strongest-sector copy and synthesizes supportive plus caution sectors',()=>{
  const result=buildFortuneEditorialV3(data(),calc(),base())
  assert.notEqual(result.heroSummary,'무작정 버티기보다 집중할 일정과 쉴 시간을 나눠 쓰기 좋은 날이야.')
  assert.match(result.heroSummary,/컨디션|직장/)
  assert.match(result.heroSummary,/금전|소식/)
})

test('structured relationship schema exposes six love contexts at once',()=>{
  const clusters=emptyClusters();Object.assign(clusters.relationship,{summary:section('협업과 경계를 정리해.'),love_general:section('관계 상태마다 질문이 달라.'),love_single:section('새 만남의 여유를 봐.'),love_crush:section('상호 반응을 봐.'),love_flirting:section('다음 약속을 봐.'),love_ambiguous:section('기대치를 맞춰.'),love_couple:section('갈등 뒤 회복을 봐.'),love_reunion_interest:section('재접점과 회복을 구분해.'),contact_activation:section('직접 대화 활성도는 중간이야.'),contact_continuity:section('질문과 답이 이어지는지 봐.')})
  const result=buildFortuneEditorialV3(data({clusters}),calc(),base(),{id:'love',label:'애정',topics:['연애','연락','재회']})
  assert.deepEqual(result.loveContexts.map(row=>row.label),['솔로 · 새 인연','짝사랑 · 마음 가는 사람','썸 · 알아가는 중','관계가 애매한 사이','연애 중','재회를 생각하는 경우'])
  assert.match(result.loveContexts[1].text,/상호 반응/)
  assert.match(result.loveContexts[4].text,/갈등 뒤 회복/)
})

test('interpersonal reading exposes friend coworker family new-network and boundary contexts',()=>{
  const clusters=emptyClusters();Object.assign(clusters.relationship,{summary:section('관계 종류마다 다르게 봐야 해.'),friends:section('친구와 약속을 다시 맞추는 장면이 중요해.'),coworkers:section('협업 역할을 문장으로 분명히 해.'),family:section('가까운 사람의 기대를 다 받아주지 마.'),new_people:section('새 모임은 넓게보다 한두 사람과 대화를 이어가.'),boundaries:section('부탁을 거절해야 할 때 이유를 길게 변명하지 마.'),contact_activation:section('메시지 활성도는 중간이야.')})
  const result=buildFortuneEditorialV3(data({clusters}),calc(),base(),{id:'social',label:'대인관계',topics:['대인관계']})
  assert.match(result.interpersonal.summary,/관계 종류/)
  assert.deepEqual(result.interpersonalContexts.map(row=>row.label),['친구 · 지인','직장동료 · 협업 상대','가족 · 가까운 사람','새 인맥 · 모임','갈등 · 경계'])
  assert.match(result.interpersonalContexts[0].text,/친구와 약속/)
  assert.match(result.interpersonalContexts[1].text,/협업 역할/)
  assert.doesNotMatch(result.interpersonal.summary,/메시지 활성도/)
})

test('Gemini structured cluster prose remains available for user-facing topic copy',()=>{
  const clusters=emptyClusters();Object.assign(clusters.relationship,{summary:section('사람마다 역할을 나눠 읽어.'),love_general:section('관계의 속도를 보자.'),contact_activation:section('직접 대화가 시작되는지와 이어지는지를 나눠 봐.')});Object.assign(clusters.work_study,{work:section('진행 중인 업무를 먼저 닫고 새 일을 벌이지 마. 마감 기준을 먼저 맞추면 협업 마찰을 줄일 수 있어.'),career_change:section('제안의 빠진 조건을 비교해.'),exam:section('아는 문제의 실수를 줄여.'),study:section('복습 범위를 좁혀.')});Object.assign(clusters.money_news,{money:section('이미 정한 지출부터 처리하고 충동 결제는 미뤄.'),news:section('중간 전달보다 공식 안내를 기다려.')});Object.assign(clusters.investment,{psychology:section('불안과 실제 보유 조건을 분리해.'),realization:section('현금 필요와 계획 기준을 먼저 봐.'),entry:section('진입 조건이 충족됐는지부터 확인해.')});clusters.condition.condition=section('집중과 휴식을 번갈아 배치해. 오후 피로가 오기 전에 쉴 시간을 먼저 잡아.')
  const result=buildFortuneEditorialV3(data({clusters}),calc(),base())
  assert.match(result.topicEditorial['직장'],/진행 중인 업무/)
  assert.match(result.topicEditorial['금전'],/정한 지출/)
  assert.match(result.topicEditorial['컨디션'],/집중과 휴식/)
  assert.match(result.topicEditorial['투자심리'],/보유 조건/)
})

test('contact overall activation is separate from incoming and outgoing direction',()=>{
  const clusters=emptyClusters();clusters.relationship.contact_activation=section('직접 연락과 대화의 전체 활성도는 보통이야.');clusters.relationship.contact_continuity=section('대화가 이어지는지가 핵심이야.')
  const result=buildFortuneEditorialV3(data({clusters}),calc(),base(),{id:'contact',label:'연락·소식',topics:['연락','소식']})
  assert.match(result.contact.activation,/전체 활성도/)
  assert.match(result.contact.directionSummary,/판정상 동률권/)
  assert.match(result.contact.directionSummary,/상대 → 나 43/)
  assert.match(result.contact.directionSummary,/나 → 상대 45/)
  assert.match(result.contact.incoming,/상대 → 나/)
  assert.match(result.contact.outgoing,/나 → 상대/)
})

test('contact UI collapses verbose direction rows when direction scores are effectively tied',()=>{
  const panel=readFileSync(new URL('../PeriodFortuneNarrativeV2.tsx',import.meta.url),'utf8')
  assert.match(panel,/showContactDirectionDetails/)
  assert.match(panel,/동률권\|같은 값\|비교할 계산 정보가 충분하지 않아/)
  assert.match(panel,/showContactDirectionDetails && <ReadingDirections/)
})

test('topic cards gate vague Gemini prose and keep a deterministic fallback',()=>{
  const panel=readFileSync(new URL('../PeriodFortuneNarrativeV2.tsx',import.meta.url),'utf8')
  assert.match(panel,/export function editorialCopyUsable/)
  assert.match(panel,/export function compactEditorialCopy/)
  assert.match(panel,/const aiEditorial = compactEditorialCopy\(editorial\.topicEditorial\[item\.topic\]\)/)
  assert.match(panel,/period-ai-topic-editorial-v4/)
  assert.match(panel,/결론 · 지금 할 일/)
  assert.match(panel,/item\.conclusion/)
  assert.match(panel,/item\.action/)
})

test('overall hero rejects meta copy, removes empty favorable filler, and restores strong mobile hierarchy',()=>{
  const panel=readFileSync(new URL('../PeriodFortuneNarrativeV2.tsx',import.meta.url),'utf8')
  assert.match(panel,/META_EDITORIAL_RE/)
  assert.match(panel,/overallFallback/)
  assert.match(panel,/!!summary\.favorableCards\.length && <FortuneFlowCards/)
  assert.match(panel,/period-ai-hero-title-v4/)
  assert.match(panel,/fontWeight:800/)
  assert.match(panel,/Apple SD Gothic Neo/)
})

test('weak investment caution boilerplate is hidden from the reference list',()=>{
  const panel=readFileSync(new URL('../PeriodFortuneNarrativeV2.tsx',import.meta.url),'utf8')
  assert.match(panel,/visibleReferenceTopics/)
  assert.match(panel,/item\.topic === '투자주의'/)
  assert.match(panel,/\/약\/\.test\(item\.band\)/)
  assert.match(panel,/visibleReferenceTopics\.map/)
})

test('hero subtitle removes the sentence already promoted into the headline',()=>{
  const panel=readFileSync(new URL('../PeriodFortuneNarrativeV2.tsx',import.meta.url),'utf8')
  assert.match(panel,/export function dedupeHeroSubtitle/)
  assert.match(panel,/const heroSubtitle = dedupeHeroSubtitle\(heroSummary, heroHeadline\)/)
  assert.match(panel,/\{heroSubtitle && <p className="reading-hero-subtitle">\{heroSubtitle\}<\/p>\}/)
  assert.doesNotMatch(panel,/\{editorial\.heroSummary && <p className="reading-hero-subtitle">/)
})

test('legacy saved string clusters remain visible in editorial group copy',()=>{
  assert.equal(editorialGroupCopy('과거 저장 결과의 분야별 종합 문구야.'),'과거 저장 결과의 분야별 종합 문구야.')
  assert.equal(editorialGroupCopy('  과거   저장   결과  '),'과거 저장 결과')
})
