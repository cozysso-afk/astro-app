import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildFortuneEditorialV3, editorialGroupCopy, editorialSectionComplete, editorialSectionReady, sectionCopy, topicSectionCopy } from './fortuneEditorialV3.ts'
import { FORTUNE_FIELDS } from './fortuneFields.ts'

function stat(average,band='보통'){return {average,band,spread:0,best_days:[],caution_days:[]}}
function base(){return {periodKind:'day',when:'오늘',headline:'컨디션 복붙',summary:'컨디션 복붙',doTitle:'좋은 흐름',cautionTitle:'주의',focusTitle:'중요',doItems:[],cautionItems:[],bestFlow:['컨디션','직장'],cautionFlow:['금전','소식'],favorableCards:[{topic:'컨디션',score:56,band:'다소 강함',meaning:'집중할 일정과 쉴 시간을 나눠'}],cautionCards:[{topic:'금전',score:35,band:'약함',meaning:'충동 결제를 주의'}],focusTopics:[{topic:'컨디션',conclusion:'무작정 버티기보다 집중할 일정과 쉴 시간을 나눠 쓰기 좋은 날이야.',reason:'',action:'쉬어',observe:'피로'}],referenceTopics:[],importantWindows:[]}}
function calc(){return {period:{start:'2026-09-28',end:'2026-09-28',day_count:1,month_segments:1},western:{overall:{컨디션:stat(56,'다소 강함'),직장:stat(53,'다소 강함'),금전:stat(35,'약함'),소식:stat(36,'약함')},relationship_signals:{수신신호:stat(43,'보통'),발신적합:stat(45,'보통')}}}}
function section(text=''){return {conclusion:text,real_scene:'현실 장면을 구분해.',action:'지금 할 일을 정해.',change_condition:'구체적 행동이 생기면 판단을 바꿔.',evidence_refs:[],applicability:'conditional'}}
function deepSection(name){return {conclusion:`${name} 결론을 분명히 정리해.`,real_scene:`${name}에서 실제 장면을 구체적으로 확인해.`,action:`${name}에서 지금 할 행동을 하나 정해.`,change_condition:`${name}의 확인 조건이 바뀌면 판단을 다시 해.`,evidence_refs:[],applicability:'direct'}}
function blankSection(){return {conclusion:'',real_scene:'',action:'',change_condition:'',evidence_refs:[],applicability:'insufficient'}}
function emptyClusters(){return {relationship:Object.fromEntries(['summary','friends','coworkers','family','new_people','boundaries','love_general','love_single','love_crush','love_flirting','love_ambiguous','love_couple','love_reunion_interest','contact_activation','contact_continuity'].map(key=>[key,section()])),work_study:Object.fromEntries(['work','career_change','exam','study'].map(key=>[key,section()])),money_news:{money:section(),news:section()},investment:{psychology:section(),realization:section(),entry:section()},condition:{condition:section()}}}
function data(overrides={}){return {headline:'무작정 버티기보다 집중할 일정과 쉴 시간을 나눠 쓰기 좋은 날이야.',overall:{summary:'무작정 버티기보다 집중할 일정과 쉴 시간을 나눠 쓰기 좋은 날이야.',dominant_pattern:'',best_phase:'',caution_phase:'',evidence_refs:[]},clusters:emptyClusters(),contact_flow:{incoming:'상대 → 나 방향은 보통이야.',outgoing:'나 → 상대 방향은 보통이야.',reconnection:''},topic_analysis:{컨디션:{verdict:'무작정 버티기보다 집중할 일정과 쉴 시간을 나눠 쓰기 좋은 날이야.',reason:'',timing:'',action:'쉬어',avoid:'',importance:'핵심',confidence:'보통',confidence_reason:'',evidence_refs:[]},연락:{verdict:'연락 보통',reason:'',timing:'',action:'대화 지속',avoid:'',importance:'주목',confidence:'보통',confidence_reason:'',evidence_refs:[]},대인관계:{verdict:'대인 기본',reason:'',timing:'',action:'역할 합의',avoid:'',importance:'주목',confidence:'보통',confidence_reason:'',evidence_refs:[]}},...overrides}}
function assertFourParts(text,name){for(const marker of [`${name} 결론을 분명히 정리해.`,`${name}에서 실제 장면을 구체적으로 확인해.`,`${name}에서 지금 할 행동을 하나 정해.`,`${name}의 확인 조건이 바뀌면 판단을 다시 해.`]) assert.ok(String(text??'').includes(marker),`${name}: missing ${marker}`)}

test('integrated hero rejects strongest-sector copy and synthesizes supportive plus caution sectors',()=>{
  const result=buildFortuneEditorialV3(data(),calc(),base())
  assert.notEqual(result.heroSummary,'무작정 버티기보다 집중할 일정과 쉴 시간을 나눠 쓰기 좋은 날이야.')
  assert.match(result.heroSummary,/컨디션|직장/)
  assert.match(result.heroSummary,/금전|소식/)
})

test('structured relationship schema exposes six love contexts at once',()=>{
  const clusters=emptyClusters();Object.assign(clusters.relationship,{summary:section('협업과 경계를 정리해.'),love_general:section('관계 상태마다 질문이 달라.'),love_single:section('새 만남의 여유를 봐.'),love_crush:section('상호 반응을 봐.'),love_flirting:section('다음 약속을 봐.'),love_ambiguous:section('기대치를 맞춰.'),love_couple:section('갈등 뒤 회복을 봐.'),love_reunion_interest:section('재접점과 회복을 구분해.'),contact_activation:section('직접 대화 흐름을 확인해.'),contact_continuity:section('질문과 답이 이어지는지 봐.')})
  const result=buildFortuneEditorialV3(data({clusters}),calc(),base(),{id:'love',label:'애정',topics:['연애','연락','재회']})
  assert.deepEqual(result.loveContexts.map(row=>row.label),['솔로 · 새 인연','짝사랑 · 마음 가는 사람','썸 · 알아가는 중','관계가 애매한 사이','연애 중','재회를 생각하는 경우'])
  assert.match(result.loveContexts[1].text,/상호 반응/)
  assert.match(result.loveContexts[4].text,/갈등 뒤 회복/)
})

test('relationship dedicated copy drops internal meta but keeps real scene and action',()=>{
  const clusters=emptyClusters()
  clusters.relationship.love_crush={conclusion:'계산 근거상 상대지수는 보통이야.',real_scene:'상대가 먼저 질문하고 시간을 내는지 봐.',action:'한 번의 명확한 제안 뒤 반응을 확인해.',change_condition:'구체적 답과 대안 일정이 오면 판단을 올려.',evidence_refs:[],applicability:'conditional'}
  const result=buildFortuneEditorialV3(data({clusters}),calc(),base(),{id:'love',label:'애정',topics:['연애','연락','재회']})
  const crush=result.loveContexts.find(row=>row.key==='crush').text
  assert.doesNotMatch(crush,/계산 근거|상대지수/)
  assert.match(crush,/상대가 먼저 질문하고 시간을 내는지/)
  assert.match(crush,/명확한 제안 뒤 반응/)
  assert.match(crush,/대안 일정/)
})

test('interpersonal reading exposes friend coworker family new-network and boundary contexts',()=>{
  const clusters=emptyClusters();Object.assign(clusters.relationship,{summary:section('관계 종류마다 다르게 봐야 해.'),friends:section('친구와 약속을 다시 맞추는 장면이 중요해.'),coworkers:section('협업 역할을 문장으로 분명히 해.'),family:section('가까운 사람의 기대를 다 받아주지 마.'),new_people:section('새 모임은 넓게보다 한두 사람과 대화를 이어가.'),boundaries:section('부탁을 거절해야 할 때 이유를 길게 변명하지 마.'),contact_activation:section('메시지가 이어지는지 봐.')})
  const result=buildFortuneEditorialV3(data({clusters}),calc(),base(),{id:'social',label:'대인관계',topics:['대인관계']})
  assert.match(result.interpersonal.summary,/관계 종류/)
  assert.deepEqual(result.interpersonalContexts.map(row=>row.label),['친구 · 지인','직장동료 · 협업 상대','가족 · 가까운 사람','새 인맥 · 모임','갈등 · 경계'])
  assert.match(result.interpersonalContexts[0].text,/친구와 약속/)
  assert.match(result.interpersonalContexts[1].text,/협업 역할/)
  assert.doesNotMatch(result.interpersonal.summary,/메시지/)
})

test('missing relationship editorial falls back to concrete user actions instead of AI status',()=>{
  const clusters=emptyClusters()
  for(const key of ['summary','friends','coworkers','family','new_people','boundaries','contact_activation','contact_continuity']) clusters.relationship[key]=blankSection()
  const source=data()
  const topicAnalysis={...source.topic_analysis,연락:{...source.topic_analysis.연락,verdict:'',timing:'',action:''},대인관계:{...source.topic_analysis.대인관계,verdict:'',action:'',avoid:''}}
  const payload=data({clusters,contact_flow:{incoming:'',outgoing:'',reconnection:''},topic_analysis:topicAnalysis})
  const social=buildFortuneEditorialV3(payload,calc(),base(),{id:'social',label:'대인관계',topics:['대인관계']})
  const contact=buildFortuneEditorialV3(payload,calc(),base(),{id:'contact',label:'연락·소식',topics:['연락','소식']})
  assert.match(social.interpersonalContexts.find(row=>row.key==='coworkers').text,/담당자·마감·완료 기준/)
  assert.doesNotMatch(JSON.stringify(social.interpersonalContexts),/AI 원고|원고가 아직|별도 계산값/)
  assert.match(contact.contact.incoming,/안부·질문·약속 제안/)
  assert.match(contact.contact.outgoing,/짧고 구체적으로/)
  assert.doesNotMatch(JSON.stringify(contact.contact),/AI 원고|별도 계산값|전체 활성도/)
})

test('Gemini structured cluster prose remains available for user-facing topic copy',()=>{
  const clusters=emptyClusters();Object.assign(clusters.relationship,{summary:section('사람마다 역할을 나눠 읽어.'),love_general:section('관계의 속도를 보자.'),contact_activation:section('직접 대화가 시작되는지와 이어지는지를 나눠 봐.')});Object.assign(clusters.work_study,{work:section('진행 중인 업무를 먼저 닫고 새 일을 벌이지 마. 마감 기준을 먼저 맞추면 협업 마찰을 줄일 수 있어.'),career_change:section('제안의 빠진 조건을 비교해.'),exam:section('아는 문제의 실수를 줄여.'),study:section('복습 범위를 좁혀.')});Object.assign(clusters.money_news,{money:section('이미 정한 지출부터 처리하고 충동 결제는 미뤄.'),news:section('중간 전달보다 공식 안내를 기다려.')});Object.assign(clusters.investment,{psychology:section('불안과 실제 보유 조건을 분리해.'),realization:section('현금 필요와 계획 기준을 먼저 봐.'),entry:section('진입 조건이 충족됐는지부터 확인해.')});clusters.condition.condition=section('집중과 휴식을 번갈아 배치해. 오후 피로가 오기 전에 쉴 시간을 먼저 잡아.')
  const result=buildFortuneEditorialV3(data({clusters}),calc(),base())
  assert.match(result.topicEditorial['직장'],/진행 중인 업무/)
  assert.match(result.topicEditorial['금전'],/정한 지출/)
  assert.match(result.topicEditorial['컨디션'],/집중과 휴식/)
  assert.match(result.topicEditorial['투자심리'],/보유 조건/)
  assert.match(result.topicEditorial['소식'],/공식 안내/)
})

test('topic editorial preserves strong core prose when only change condition is weak',()=>{
  const clusters=emptyClusters()
  clusters.work_study.work={
    conclusion:'업무 우선순위를 한 번에 하나로 줄이는 편이 낫다.',
    real_scene:'요청이 겹치면 먼저 마감과 담당자를 다시 정하는 장면이 생기기 쉽다.',
    action:'새 일을 받기 전에 기존 작업의 완료 기준부터 합의해.',
    change_condition:'상황이 바뀌면 다시 봐.',
    evidence_refs:[],
    applicability:'direct',
  }
  assert.equal(sectionCopy(clusters.work_study.work),'')
  assert.match(topicSectionCopy(clusters.work_study.work),/업무 우선순위/)
  const result=buildFortuneEditorialV3(data({clusters}),calc(),base())
  assert.match(result.topicEditorial['직장'],/업무 우선순위/)
  assert.match(result.topicEditorial['직장'],/마감과 담당자/)
  assert.match(result.topicEditorial['직장'],/완료 기준/)
  assert.doesNotMatch(result.topicEditorial['직장'],/상황이 바뀌면/)
})

test('applicability blocks insufficient copy and marks conditional depth without downgrading direct copy',()=>{
  const clusters=emptyClusters()
  clusters.work_study.work={...section('근거가 부족한데도 직장 결론을 단정해.'),applicability:'insufficient'}
  clusters.work_study.study={...section('공부할 범위를 좁히고 막힌 부분부터 다시 풀어.'),applicability:'direct'}
  clusters.money_news.money={...section('예산과 고정지출을 먼저 확인하고 남는 범위에서 결정해.'),applicability:'conditional'}
  clusters.relationship.love_crush={...section('근거가 부족한데도 상대 마음을 단정해.'),applicability:'insufficient'}
  const result=buildFortuneEditorialV3(data({clusters}),calc(),base())
  assert.equal(result.topicEditorial['직장'],undefined)
  assert.match(result.topicEditorial['학업'],/^공부할 범위를 좁히고/)
  assert.doesNotMatch(result.topicEditorial['학업'],/^조건부로 보면,/)
  assert.match(result.topicEditorial['금전'],/^조건부로 보면,/)
  const love=buildFortuneEditorialV3(data({clusters}),calc(),base(),{id:'love',label:'애정',topics:['연애','연락','재회']})
  const crush=love.loveContexts.find(row=>row.key==='crush').text
  assert.doesNotMatch(crush,/근거가 부족한데도 상대 마음/)
  assert.match(crush,/마음 가는 사람이 있다면/)
  assert.equal(editorialGroupCopy({hidden:{...section('이 문장도 숨겨야 해.'),applicability:'insufficient'}}),'')
})

test('structured depth requires conclusion scene action and change condition together',()=>{
  const complete=deepSection('완결성')
  assert.equal(editorialSectionComplete(complete),true)
  assertFourParts(sectionCopy(complete),'완결성')
  for(const key of ['conclusion','real_scene','action','change_condition']){
    const partial={...complete,[key]:''}
    assert.equal(editorialSectionComplete(partial),false,key)
    assert.equal(sectionCopy(partial),'',key)
  }
  assert.equal(editorialSectionComplete({...complete,applicability:'insufficient'}),false)
})

test('structured depth rejects repeated roles and vague change conditions',()=>{
  const repeated={...deepSection('중복'),conclusion:'예산 범위를 먼저 정하고 지출을 줄이는 게 핵심이야.',action:'예산 범위를 먼저 정하고 지출을 줄이는 행동이 핵심이야.'}
  assert.equal(editorialSectionComplete(repeated),true)
  assert.equal(editorialSectionReady(repeated),false)
  assert.equal(sectionCopy(repeated),'')

  const vague={...deepSection('모호'),change_condition:'상황을 보면서 판단해.'}
  assert.equal(editorialSectionComplete(vague),true)
  assert.equal(editorialSectionReady(vague),false)
  assert.equal(sectionCopy(vague),'')

  const observable={...deepSection('관찰'),change_condition:'실제 약속 날짜가 확정되면 판단을 다시 해.'}
  assert.equal(editorialSectionReady(observable),true)
  assert.match(sectionCopy(observable),/실제 약속 날짜가 확정되면/)

  const clusters=emptyClusters()
  clusters.money_news.money=repeated
  const result=buildFortuneEditorialV3(data({clusters}),calc(),base())
  assert.equal(result.topicEditorial['금전'],undefined)
})

test('all ten fortune fields have a complete interpretation path',()=>{
  assert.deepEqual(FORTUNE_FIELDS.map(field=>field.id),['love','money','investment','study','exam','work','job-change','social','contact','condition'])
  const clusters=emptyClusters()
  Object.assign(clusters.work_study,{work:deepSection('직장'),career_change:deepSection('이직'),exam:deepSection('시험'),study:deepSection('학업')})
  Object.assign(clusters.money_news,{money:deepSection('금전'),news:deepSection('소식')})
  Object.assign(clusters.investment,{psychology:deepSection('투자심리'),realization:deepSection('수익실현'),entry:deepSection('신규진입')})
  clusters.condition.condition=deepSection('컨디션')
  Object.assign(clusters.relationship,{
    summary:deepSection('대인관계'),friends:deepSection('친구'),coworkers:deepSection('직장동료'),family:deepSection('가족'),new_people:deepSection('새인맥'),boundaries:deepSection('갈등경계'),
    love_general:deepSection('연애공통'),love_single:deepSection('솔로'),love_crush:deepSection('짝사랑'),love_flirting:deepSection('썸'),love_ambiguous:deepSection('관계미정'),love_couple:deepSection('연애중'),love_reunion_interest:deepSection('재회관심'),
    contact_activation:deepSection('연락'),contact_continuity:deepSection('연락지속'),
  })
  const payload=data({clusters})
  const byId=Object.fromEntries(FORTUNE_FIELDS.map(field=>[field.id,field]))

  for(const [fieldId,topic] of [['money','금전'],['study','학업'],['exam','시험'],['work','직장'],['job-change','이직'],['condition','컨디션']]){
    const result=buildFortuneEditorialV3(payload,calc(),base(),byId[fieldId])
    assertFourParts(result.topicEditorial[topic],topic)
  }

  const investment=buildFortuneEditorialV3(payload,calc(),base(),byId.investment)
  for(const topic of ['투자심리','신규진입','수익실현']) assertFourParts(investment.topicEditorial[topic],topic)
  assert.equal(investment.topicEditorial['투자주의'],undefined,'투자주의는 deterministic safety path가 담당')

  const contact=buildFortuneEditorialV3(payload,calc(),base(),byId.contact)
  assertFourParts(contact.contact.activation,'연락')
  assertFourParts(contact.topicEditorial['소식'],'소식')

  const love=buildFortuneEditorialV3(payload,calc(),base(),byId.love)
  const loveMarkers={single:'솔로',crush:'짝사랑',flirting:'썸',ambiguous:'관계미정',couple:'연애중',reunion_interest:'재회관심'}
  for(const row of love.loveContexts) assertFourParts(row.text,loveMarkers[row.key])
  const social=buildFortuneEditorialV3(payload,calc(),base(),byId.social)
  const socialMarkers={friends:'친구',coworkers:'직장동료',family:'가족',new_people:'새인맥',boundaries:'갈등경계'}
  for(const row of social.interpersonalContexts) assertFourParts(row.text,socialMarkers[row.key])
})

test('contact overall reading keeps useful scene and action separate from direction',()=>{
  const clusters=emptyClusters();clusters.relationship.contact_activation={conclusion:'계산 근거상 연락 활성도는 보통이야.',real_scene:'안부 뒤 질문이 이어지는지 봐.',action:'답장을 재촉하지 말고 다음 질문이 있는지 확인해.',change_condition:'구체적인 약속이 잡히면 판단을 올려.',evidence_refs:[],applicability:'conditional'};clusters.relationship.contact_continuity=section('대화가 이어지는지가 핵심이야.')
  const result=buildFortuneEditorialV3(data({clusters}),calc(),base(),{id:'contact',label:'연락·소식',topics:['연락','소식']})
  assert.doesNotMatch(result.contact.activation,/계산 근거|활성도/)
  assert.match(result.contact.activation,/안부 뒤 질문/)
  assert.match(result.contact.activation,/답장을 재촉하지 말고/)
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
  assert.match(panel,/대화가 이어지는지와 누가 먼저 움직이는지를 따로 봐/)
  assert.match(panel,/<strong>연락이 오가는 흐름<\/strong>/)
  assert.match(panel,/<strong>먼저 움직이는 쪽<\/strong>/)
  assert.doesNotMatch(panel,/전체 연락 활성도/)
})

test('verified non-relationship fields surface structured editorial in main focus cards with deterministic fallback',()=>{
  const panel=readFileSync(new URL('../PeriodFortuneNarrativeV2.tsx',import.meta.url),'utf8')
  assert.match(panel,/const structuredFieldTopics = verifiedNarrative && field/)
  assert.match(panel,/editorial\.topicEditorial\[topic\] \?\? ''/)
  assert.match(panel,/연애','대인관계','연락','재회','투자주의/)
  assert.match(panel,/editorialCopyUsable\(item\.text\)/)
  assert.match(panel,/export function focusEditorialParts/)
  assert.match(panel,/verifiedNarrative && !field \? focusEditorialParts\(editorial\.topicEditorial\[item\.topic\]/)
  assert.match(panel,/deepEditorial\?\.conclusion \|\| item\.conclusion/)
  assert.match(panel,/period-ai-topic-editorial-v4/)
  assert.match(panel,/deepEditorial\.sceneAction/)
  assert.match(panel,/판단 바뀌는 조건/)
  assert.match(panel,/deepEditorial\.change/)
  assert.match(panel,/<em>실제로는<\/em> \{item\.action\}/)
  assert.match(panel,/<em>확인할 것<\/em> \{item\.observe\}/)
})

test('overall hero accepts only verified reader-facing integrated editorial and keeps deterministic fallback',()=>{
  const panel=readFileSync(new URL('../PeriodFortuneNarrativeV2.tsx',import.meta.url),'utf8')
  assert.match(panel,/META_EDITORIAL_RE/)
  assert.match(panel,/const fallbackHero = overallFallback\(summary\)/)
  assert.match(panel,/const integratedHeroHeadline = verifiedNarrative && !field && editorialCopyUsable\(editorial\.heroHeadline\)/)
  assert.match(panel,/const integratedHeroSummary = verifiedNarrative && !field && editorialCopyUsable\(editorial\.heroSummary\)/)
  assert.match(panel,/const heroHeadline = integratedHeroHeadline \|\| fallbackHero\.headline/)
  assert.match(panel,/const heroSummary = integratedHeroSummary \|\| fallbackHero\.summary/)
  assert.match(panel,/!!summary\.favorableCards\.length && <FortuneFlowCards/)
  assert.match(panel,/<h3 className="period-ai-hero-title-v4">\{heroHeadline\}<\/h3>/)
})

test('main relationship and reference summaries cannot be overwritten by generic Gemini prose',()=>{
  const panel=readFileSync(new URL('../PeriodFortuneNarrativeV2.tsx',import.meta.url),'utf8')
  assert.match(panel,/<p>\{summary\.relationship\.summary\}<\/p>/)
  assert.doesNotMatch(panel,/compactEditorialCopy\(editorial\.topicEditorial\['연락'\]\) \|\| summary\.relationship\.summary/)
  assert.match(panel,/<p>\{item\.detail\?\.conclusion \|\| item\.summary\}<\/p>/)
  assert.doesNotMatch(panel,/compactEditorialCopy\(editorial\.topicEditorial\[item\.topic\]\) \|\| item\.detail/)
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