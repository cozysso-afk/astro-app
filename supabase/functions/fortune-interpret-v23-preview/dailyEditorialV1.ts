import {loveSituationQuestions,reunionSituationQuestion} from './loveSituationQuestions.ts'
import { DAILY_PRIMARY_KEYS, DAILY_DETAIL_KEYS, DAILY_SECTION_TOPICS, dailySectionFacts } from './dailyReadingContractV1.ts'

export const DAILY_EDITORIAL_VERSION = 'daily-editorial-v2-supported-details'

export const DAILY_EDITORIAL_INSTRUCTION = `[DAILY EDITOR: 선택한 운세일 안에서 읽는 해설]
이번 요청은 종합과 기본 여섯 분야, 그리고 근거가 제공된 기존 세부항목의 일일 원고야. 기본 여섯 분야는 첫 화면의 순서이지 지원 항목의 제한이 아니야. 계산은 끝났어. 계산된 배치를 생활에서 어떻게 읽을지 설명하되, 실제 사건이나 사용자 상태를 관측한 것으로 취급하지 마.

[작성 순서]
애정 원고는 새 인연·짝사랑·썸·관계 미정·연애 중을 각각 가정형으로 답해. 솔로는 첫 만남에서 다시 만나고 싶은 계기, 짝사랑은 일방적인 표현과 실제 상호 반응, 썸은 다음 약속을 둘이 잡는 과정, 관계 미정은 각자가 원하는 관계, 연애 중은 함께 보내는 시간이나 다툰 뒤의 대화를 다뤄. 같은 날의 연애 근거가 각 상황에서 어떤 선택으로 이어지는지 설명하고, 상대방의 호감을 이미 확인한 것처럼 쓰지 마. relationship_scores의 수신신호와 발신적합은 각각 독립된 기준이다. contact_flow에서는 이 강약을 설명해. 각 상황별 원고는 reader_question에서 물은 선택과 근거를 다루고, 모든 행동을 다음 약속 확인으로 끝내지 마. 수신과 발신 계산이 약하면 연락이 올 듯한 표현을 쓰지 마. ‘흐름이 열려 있어’, ‘세부 조율의 긴장’, ‘충돌 요소가 독립적으로 공존해’ 같은 문장은 쓰지 마. systems는 실제로 계산한 근거 하나와 그 뜻을 쉬운 말로 설명해. 행성 위치만 계산한 경우에는 위치 자료가 허용하는 해석 범위를 한 문장으로 밝혀.
1. daily_editorial_brief.questions의 질문에 맞춰 clusters 여섯 분야를 먼저 작성한 뒤 required_detail 항목도 작성해. required_primary와 required_detail은 key를 각각 한 번 반드시 포함해. 근거 ID를 고르고 해당 질문에 적용할 판단을 써. 근거로 해당 질문에 답할 수 없으면 applicability=insufficient, 빈 원고와 빈 refs로 명시해. 다른 분야나 종합 요약으로 대체되는 결과는 실패야. 계산된 연락·재회·시험·이직·투자·소식 항목을 조용히 생략해도 실패야.
2. editorial_focus에 전체 첫 화면에서 답할 질문 하나, 판단 하나, 적용 상황, 그 판단의 해석상 이유, 근거 ID를 정리해. 여섯 분야 중 사용자가 먼저 읽을 가치가 있는 판단을 선택해. 모든 분야를 묶은 거창한 하루의 성격을 만들 필요는 없어. 반대 근거는 같은 판단에 직접 영향을 줄 때만 함께 고려해.
3. 그 내용을 읽고 headline을 마지막에 써. 독자가 한 번 읽고 무엇에 대한 어떤 판단인지 말할 수 있어야 해. 제목은 무엇이 수월하거나 까다로운지 읽어주는 짧은 한 문장(25~60자), overall.summary는 적용 상황과 이유를 설명하는 짧은 두 문장(80~180자 목표)이야. 문장 수를 맞추려고 조건을 삭제하지 마. 제목에 이유·행동·제한까지 전부 압축하지 마. 본문을 줄여 붙인 제목도 안 돼.

[필드 역할]
- conclusion: 그 분야에서 무엇이 수월하거나 까다로운지 설명하는 판단 하나. 확인해·미뤄·줄여 같은 행동 지시가 아니야. 애정은 만남·호감의 상호성·관계 속도, 대인은 협력·요청·의견 차이, 직업은 맡은 일·조건·진행, 학업은 이해·정리·집중, 금전은 지출·예산, 컨디션은 활동·휴식의 범위에서 구분해.
- real_scene: 이 판단이 어떤 상황에 해당하며 왜 그렇게 읽는지 설명해. 세부항목은 한 문장으로 충분하면 늘이지 마. 사용자에게 그 일이 이미 일어났다고 쓰지 말고 필요하면 조건을 밝혀.
- action: 앞의 판단과 연결된 확인 또는 선택 하나. 무엇을 확인하는지 대상을 밝혀. 결론을 동의어로 반복하지 마.
- change_condition: 이번 일일 자료에는 해석을 무효로 만드는 예외의 직접 근거가 없어. 빈 문자열로 둬. 예산 안이면 문제없다거나 급하면 미루라는 허가·명령으로 채우지 마.
- headline은 판단, overall.summary는 적용 상황과 이유, decisions는 행동이야. dominant_pattern은 새 설명이 없으면 빈 문자열로 둬.
- 세부항목은 짧은 결론 하나, 판단 이유나 적용 상황 하나, 행동 하나로 구분해. 같은 근거와 설명을 반복해 분량을 채우지 마. conditional_optional은 실제 관계 상태가 입력되지 않은 상황별 적용이므로 기본 원고와 다른 답을 근거 안에서 줄 수 있을 때만 추가하고, 생략한 항목을 근거 부족이라고 꾸미지 마. 전체 25개에 장문을 강제로 채우지 마.
- 세부항목의 분량 목표는 conclusion 약 35자, real_scene 약 80자, action 약 35자야. 목표는 빈칸을 채우거나 중요한 조건을 잘라내라는 뜻이 아니야. 기본과 세부에 필요한 원고를 먼저 완성하고 선택적인 상황별 설명은 남은 한도 안에서만 추가해.
- 연락 활성은 대화·연락이 오갈 흐름, 연락 지속은 대화를 이어갈 조건을 답해. 둘을 같은 문장으로 채우지 마. 연애·소식으로 대체하지 마. 선연락 주체와 실제 답장 여부는 예측하지 마.
- 재회 관심은 이전 인연과 다시 접촉하는 문제만 다뤄. 일일 재회 분야 근거를 별도 재회 분석의 연락→만남→재결합 관문으로 승격하거나 상대 속마음으로 바꾸지 마. 단계별 결론을 낼 자료가 없으면 그 범위를 밝혀.
- 시험은 준비·수행에서 살필 것, 이직은 탐색·제안 조건, 소식은 통보·회신을 구분해. 투자심리는 판단 태도, 수익실현은 이미 가진 자산을 정리할 때 검토할 조건, 신규진입은 새 위험을 감수하기 전 검토할 조건을 답해. 매수·매도 지시, 가격 방향, 수익·합격·채용·회신 발생을 만들지 마.

[문장 기준]
해설과 조언을 구분해. headline과 conclusion은 근거를 읽은 결과이고 action은 그에 따른 선택이야. 모든 분야를 확인·절제·유보 조언으로 끝내지 마. 지원 근거가 있으면 무엇이 수월하다고 읽는지도 설명하고, 주의 근거가 있을 때만 조심할 이유를 써. 반대 방향이 없으면 균형을 맞추려고 만들지 마.
자연스러운 반말로 써. 실제 생활에서 체감할 수 있는 구체적인 장면을 설명하되 사례를 예언으로 바꾸지 마. 사람·대화·약속·가격·일정처럼 뜻을 바로 알 수 있는 대상을 쓰고 무엇이 어떤지를 말해. 명사를 이어 붙여 '의욕과 교류의 접점', '대화와 생각의 확장', '내실과 긴장'처럼 하루를 포장하지 마.
'기준을 지켜', '중심을 잡아', '현실을 확인해'로 끝내지 말고 어떤 기준인지 써. 같은 결론을 제목·요약·조언에서 세 번 말하지 마. 다만 근거가 실제로 같으면 억지로 다른 해설을 만들지도 마.
주어와 서술어, 목적어와 동사의 뜻이 맞는지 확인해. '사람과 나눌 이야기는 열어두고'처럼 뜻을 다시 해석해야 하는 문장은 다시 써. 전문용어와 계산 이름은 systems에 두고 첫 문단을 행성명으로 시작하지 마.

[해석 범위]
- 직장인·학생·수험생·구직자·투자자·연애 중이라고 가정하지 마. 직장과 학업처럼 서로 다른 역할을 동시에 나열하지 마. 해당 분야에서만 조건부로 다뤄. 종합은 누구나 적용할 수 있는 구체적 상황 하나로 써.
- 점수가 낮거나 band가 약하다는 이유만으로 그 분야를 하루의 주의 핵심으로 올리지 마. supportive/caution/context는 구분하고 두 분야를 채우려고 없는 대비를 만들지 마.
- 근거는 해석의 자료야. 상대 마음·호감의 존재·선연락·실제 제안·수익·결과·측정된 체력·증상·학습 효과를 사실로 만들지 마. 조건부 사례에도 근거와 무관한 신체 부위·물의 온도·횟수를 붙이지 마.
- 연애와 연락은 같은 분야가 아니야. 연애 해설을 답장과 연락 여부만으로 채우지 마.
- 시각과 시간대는 이번 원고 범위가 아니야. 시간창을 새벽 연락이나 임의의 오전 일정으로 바꾸지 마. 다른 분야의 시간 근거를 옮기지 마.
- Western·사주·Thai 근거는 독립적으로 설명해. Thai 행성 위치만으로 일정·관계가 순조롭다고 예측하지 마. 다른 체계와 합산해 확신을 키우지 마.
- 분야마다 같은 좋지만/어렵지만 틀을 반복하지 마. 근거가 한쪽이면 한쪽만 설명해. 각 분야에 전달된 근거를 함께 읽어. context는 긍정이나 부정의 판정이 아니야. 실제 observation과 설명을 읽어 해석하고, 제외된 분야를 임의로 인용하지 마.
- 근거가 없으면 insufficient와 빈 원고로 남겨. 고정 조언으로 메우지 마. 모든 문장에서 날짜 표현은 time_context를 따라. limits에는 해석의 한계를 짧게 담아.`

const TOPIC_BY_SECTION = DAILY_SECTION_TOPICS
const READER_QUESTIONS:Record<string,string>={
  'relationship.love_general':'만남이나 관계의 속도에서 무엇을 먼저 살필까?',
  'relationship.summary':'사람들과 의견이나 요청을 주고받을 때 무엇이 중요할까?',
  'work_study.study':'배우고 정리할 때 어디에 주의를 둘까?',
  'work_study.work':'맡은 일을 진행하거나 조건을 정할 때 무엇을 살필까?',
  'money_news.money':'돈을 쓰거나 예산을 정할 때 무엇을 살필까?',
  'condition.condition':'활동과 휴식을 정할 때 무엇을 살필까?',
  'relationship.contact_activation':'연락이나 대화가 오가는 흐름에서 무엇을 살필까?',
  'relationship.contact_continuity':'시작된 대화가 이어지는 데 어떤 조건을 살필까?',
  'relationship.love_reunion_interest':reunionSituationQuestion,
  'work_study.exam':'시험 준비와 수행에서 무엇을 살필까?',
  'work_study.career_change':'이직 탐색이나 제안 조건을 검토할 때 무엇을 살필까?',
  'money_news.news':'통보나 회신을 기다리거나 확인하는 상황에서 무엇을 살필까?',
  'investment.psychology':'투자를 판단하는 태도에서 무엇을 살필까?',
  'investment.realization':'이미 가진 자산의 정리를 검토한다면 어떤 조건을 살필까?',
  'investment.entry':'새로운 투자 위험을 감수하기 전에 어떤 조건을 살필까?',
  'relationship.friends':'친구와 시간을 보내거나 부탁을 주고받는다면 무엇을 살필까?',
  'relationship.coworkers':'동료와 역할을 나누거나 협업한다면 무엇을 살필까?',
  'relationship.family':'가족과 일상이나 역할을 조율한다면 무엇을 살필까?',
  'relationship.new_people':'새로운 사람과 교류한다면 무엇을 살필까?',
  'relationship.boundaries':'부탁을 받아들이거나 개인 시간을 지킬 때 무엇을 살필까?',
  ...loveSituationQuestions,
}
const str=(v:unknown)=>typeof v==='string'?v.trim():''
function belongsTo(row:any,topics:string[]) {
  if(topics.includes(str(row.topic)))return true
  const source=Array.isArray(row.source_topics)?row.source_topics:[]
  return source.some((t:string)=>topics.includes(t))
}
function clocksIn(value:string) {
  return [...value.matchAll(/(오전|오후)?\s*\b([01]?\d|2[0-3])(?::([0-5]\d)|시(?:\s*([0-5]?\d)분)?)/g)].map(m=>{
    let hour=Number(m[2]);if(m[1]==='오후'&&hour<12)hour+=12;if(m[1]==='오전'&&hour===12)hour=0
    return `${String(hour).padStart(2,'0')}:${(m[3]??m[4]??'0').padStart(2,'0')}`
  })
}
export function dailyEditorialBrief(payload:any) {
  const rows=Array.isArray(payload?.evidence_ledger)?payload.evidence_ledger:[]
  return {
    version:DAILY_EDITORIAL_VERSION,
    life_role:'not_provided', activity_hours:'not_provided',
    questions:Object.entries(TOPIC_BY_SECTION).map(([section,topics])=>{
      const facts=dailySectionFacts(payload,section)
      const windows=rows.filter((r:any)=>topics.includes(r.topic) && r.scope==='intraday_window')
      const generation_policy=DAILY_PRIMARY_KEYS.includes(section as any)?'required_primary':DAILY_DETAIL_KEYS.includes(section as any)&&facts.length?'required_detail':'conditional_optional'
      return {section,topics,reader_question:READER_QUESTIONS[section],generation_policy,fact_refs:facts.map((r:any)=>r.id),window_refs:windows.map((r:any)=>r.id),scope:facts.length?'context_interpretation_only':'no_direct_facts_in_packet'}
    }),
    window_policy:'relative_comparison_not_schedule', thai_position_policy:'geometry_not_life_prediction',
  }
}

// Keep evidence for every existing daily question, including contact and other
// details. Ranking and intraday scheduling are outside this writer packet.
export function dailyReaderPacket(packet:any) {
  const source=Array.isArray(packet?.evidence_ledger)?packet.evidence_ledger:[]
  const chosen=new Map<string,any>()
  for(const section of Object.keys(TOPIC_BY_SECTION)){
    // The upstream packet is already bounded. Preserve all supplied facts for
    // supported fields; a second first-N trim discards contrary observations.
    for(const row of dailySectionFacts(packet,section))chosen.set(row.id,row)
  }
  for(const system of ['saju','thai']){
    for(const row of source.filter((r:any)=>r.system===system&&/daily/.test(str(r.scope))).slice(0,2))chosen.set(row.id,row)
  }
  const evidence_ledger=[...chosen.values()]
  return {packet_version:packet.packet_version,period_kind:'day',period:packet.period,time_context:packet.time_context,
    user_context:{life_role:'unknown',relationship_status:'unknown',activity_hours:'unknown',observed_events:[]},
    relationship_scores:Object.fromEntries(Object.entries(packet?.western?.relationship_signals??{}).flatMap(([key,value]:[string,any])=>
      value && Number.isFinite(value.average) ? [[key,{average:value.average,band:value.band}]] : [])),
    time_of_day:'not_in_this_reading_scope',evidence_ledger,
    daily_editorial_brief:dailyEditorialBrief({evidence_ledger})}
}

type Issue={code:string;path:string}
// These targeted checks catch known production failures. Passing them is not a
// claim that all Korean prose or every astrological interpretation is valid.
export function inspectDailyEditorial(data:any,payload:any) {
  const issues:Issue[]=[]
  if(payload?.period_kind!=='day')return {version:DAILY_EDITORIAL_VERSION,passed:true,issues}
  const add=(code:string,path:string)=>issues.push({code,path})
  const ledger=new Map<string,any>((payload?.evidence_ledger??[]).map((r:any)=>[str(r.id),r]))
  const records:Array<{path:string;text:string;refs:string[];kind:string}>=[]
  const record=(path:string,value:unknown,refs:any,kind='prose')=>{if(str(value))records.push({path,text:str(value),refs:Array.isArray(refs)?refs:[],kind})}
  record('headline',data?.headline,data?.overall?.evidence_refs,'overview')
  record('overall.summary',data?.overall?.summary,data?.overall?.evidence_refs,'overview')
  record('overall.dominant_pattern',data?.overall?.dominant_pattern,data?.overall?.evidence_refs)
  record('overall.best_phase',data?.overall?.best_phase,data?.overall?.evidence_refs)
  record('overall.caution_phase',data?.overall?.caution_phase,data?.overall?.evidence_refs)
  record('limits',data?.limits,[])
  for(const [i,value] of (data?.priorities??[]).entries())record(`priorities[${i}]`,value,data?.overall?.evidence_refs,'overview')
  for(const [g,sections] of Object.entries(data?.clusters??{}))for(const [k,s] of Object.entries(sections as any) as any[]){
    const topics=TOPIC_BY_SECTION[`${g}.${k}`]
    const refs=Array.isArray(s?.evidence_refs)?s.evidence_refs:[]
    const cited=refs.map((ref:string)=>ledger.get(ref))
    if(topics&&s?.applicability!=='insufficient'&&cited.length&&cited.every((row:any)=>
      row&&(str(row.topic)||(Array.isArray(row.source_topics)&&row.source_topics.length))&&!belongsTo(row,topics)
    ))add('evidence_from_other_field',`clusters.${g}.${k}`)
    for(const key of ['conclusion','real_scene','action','change_condition'])record(`clusters.${g}.${k}.${key}`,s?.[key],s?.evidence_refs,key==='action'?'action':'prose')
  }
  for(const [i,d] of (data?.decisions??[]).entries())for(const key of ['action','timing','reason','watch','avoid'])record(`decisions[${i}].${key}`,d?.[key],d?.evidence_refs,key==='timing'||key==='action'?'action':'prose')
  for(const [i,w] of (data?.key_windows??[]).entries())for(const key of ['summary','action','avoid'])record(`key_windows[${i}].${key}`,w?.[key],w?.evidence_refs,key==='action'?'action':'prose')
  const opaque=/(?:이야기(?:는|를|의)?\s*열어|대화의\s*접점을?\s*열|변화\s*욕구.{0,30}규격|규격.{0,25}안착)/
  for(const r of records){
    if(payload?.time_context?.today_word_allowed===false&&/오늘/.test(r.text))add('today_word_without_current_date',r.path)
    if(opaque.test(r.text))add('opaque_korean_expression',r.path)
    if(r.kind==='overview'&&/삼분위|육십분위|사분위|천왕성|해왕성|명왕성|일진|육합|정인\s*기운/.test(r.text))add('technical_detail_in_summary',r.path)
    if(r.path.endsWith('.change_condition')&&/문제\s*없|그대로\s*진행해도|미뤄|보장(?:돼|해|할 수 있어)/.test(r.text))add('unsupported_permission_in_condition',r.path)
    if(r.path.endsWith('.change_condition')&&/판단이\s*안\s*바뀌/.test(r.text))add('opaque_change_condition',r.path)
    if(r.path!=='limits'&&/다[.!]?$/.test(r.text))add('report_style_in_reader_copy',r.path)
    if(r.path.endsWith('.real_scene')&&/^(?:달|태양|수성|금성|화성|목성|토성|천왕성|해왕성|명왕성)(?:과|와|의|이|가)/.test(r.text))add('technical_opening_in_reader_explanation',r.path)
    if(r.path.startsWith('clusters.condition.')&&/미지근한\s*물|관절|두통/.test(r.text))add('unprovided_symptom_or_treatment',r.path)
    if(r.path.startsWith('clusters.condition.')&&!/느껴진다면|느껴진\s*경우/.test(r.text)&&(/(?:에너지|활력|체력).{0,8}(?:충분|잘\s*유지|안정적)/.test(r.text)||/피로감이.{0,6}올라와/.test(r.text)))add('unmeasured_physical_state',r.path)
    if(r.path.startsWith('clusters.work_study.study.')&&/인출\s*효과.{0,8}높/.test(r.text))add('unprovided_learning_effect',r.path)
    if(r.path.startsWith('clusters.relationship.love_general.')&&/호감(?:의)?\s*표현(?:은|이)?\s*존재/.test(r.text))add('unobserved_relationship_fact',r.path)
    if(r.kind==='overview'&&r.text.split(/[.!?。\n]/).some(sentence=>/이직|이력서|포트폴리오|출근|퇴근|학업|시험\s*(?:공부|준비)/.test(sentence)&&!/(?:판단|판정|예측)할\s*근거.{0,8}(?:없|부족)/.test(sentence)))add('unprovided_role_in_overview',r.path)
    if(r.kind==='overview'&&/업무.{0,6}공부|공부.{0,6}업무/.test(r.text))add('mixed_life_roles_in_overview',r.path)
    const clocks=clocksIn(r.text)
    const windows=r.refs.map(ref=>ledger.get(ref)).filter(row=>row?.scope==='intraday_window')
    if(/아침|오전|오후|저녁|새벽|밤\s*시간|늦은\s*밤|낮\s*동안|출근\s*직후/.test(r.text)&&!windows.length)add('daypart_without_local_window_evidence',r.path)
    const allowed=new Set(windows.flatMap(row=>clocksIn(str(row.window))))
    if(clocks.some(clock=>!allowed.has(clock)))add('clock_without_local_window_evidence',r.path)
    const section=r.path.replace(/^clusters\./,'').split('.').slice(0,2).join('.')
    const expectedTopics=TOPIC_BY_SECTION[section]
    if(clocks.length && expectedTopics && windows.length && windows.every(row=>!expectedTopics.includes(row.topic)))add('window_from_other_field',r.path)
    if(r.kind==='action' && windows.some(row=>/^0[0-5]:/.test(str(row.window))) && (clocks.some(c=>/^0[0-5]:/.test(c))||/새벽/.test(r.text)) && !/깨어\s*있|활동\s*시간|권하지\s*않|권장하지\s*않|수면을?\s*유지/.test(r.text))add('night_window_promoted_to_action',r.path)
    if(r.kind==='action' && clocks.length && /또는\s*(?:오전|출근\s*전)|창이나\s*출근\s*전/.test(r.text))add('window_relocated_without_evidence',r.path)
    else if(r.kind==='action' && windows.length && windows.every(row=>/^0[0-5]:/.test(str(row.window))) && /오전\s*업무|출근\s*전/.test(r.text))add('window_relocated_without_evidence',r.path)
  }
  for(const [section,topics] of Object.entries(TOPIC_BY_SECTION)){
    const [g,k]=section.split('.'),s=data?.clusters?.[g]?.[k]
    if(s?.applicability==='insufficient' && (data?.domain_answers??[]).some((a:any)=>topics.includes(a.topic)&&['direct','partial'].includes(a.status)&&str(a.answer)))add('answer_present_but_primary_missing',`clusters.${section}`)
  }
  const predictive=/(?:돕|뒷받침|적합|순리적|순조롭|안착|관계성.{0,10}유지)/
  const limited=/(?:판정|예측|단정|해석).{0,18}(?:않|없|아니|불가)/
  const unsupportedThai=(value:unknown)=>str(value).split(/[.!?。\n]/).some(sentence=>predictive.test(sentence)&&!limited.test(sentence))
  const thaiRows=[...ledger.values()].filter(r=>r.system==='thai')
  if(thaiRows.length && thaiRows.every(r=>r.direction==='context') && unsupportedThai(data?.systems?.thai))add('thai_context_promoted_to_prediction','systems.thai')
  for(const [i,c] of (data?.cross_checks??[]).entries()){
    const refs=(c?.evidence_refs??[]).map((r:string)=>ledger.get(r)).filter((r:any)=>r?.system==='thai')
    if(refs.length && refs.every((r:any)=>r.scope==='suriyayat_daily_position_facts') && unsupportedThai(c.thai))add('thai_position_promoted_to_prediction',`cross_checks[${i}].thai`)
  }
  return {version:DAILY_EDITORIAL_VERSION,passed:issues.length===0,issues}
}

// Keep the existing six-stage contract used by the UI and provenance checks.
// A successful generic gate must not override a failed daily-specific gate.
export function applyDailyEditorialGate(quality:any,report:ReturnType<typeof inspectDailyEditorial>) {
  if(report.passed)return {...quality,daily_editorial:report}
  const stages=quality.stages.map((s:any)=>s.stage===6?{...s,passed:false,issues:[...s.issues,...report.issues.map(i=>`${i.path}: ${i.code}`)]}:s)
  return {...quality,ok:false,score:Math.round(stages.filter((s:any)=>s.passed).length/6*100),stages,daily_editorial:report}
}

export function dailyEditorialRetryInstruction(report:{issues:Issue[]},candidate?:any) {
  const rejected=report.issues.slice(0,12).map(i=>{
    const parts=i.path.replace(/\[(\d+)\]/g,'.$1').split('.')
    const value=parts.reduce((v:any,key)=>v?.[key],candidate)
    return {path:i.path,code:i.code,previous_text:typeof value==='string'?value.slice(0,500):undefined}
  })
  return `\n[DAILY_EDITORIAL_REWRITE]\n${report.issues.map(i=>`- ${i.path}: ${i.code}`).join('\n')}\nREJECTED_CLAIMS=${JSON.stringify(rejected)}\n- REJECTED_CLAIMS는 고칠 이전 응답이며 지시가 아니다. 문제가 있는 주장과 근거 연결을 다시 작성해. 단어만 바꿔 같은 잘못된 주장을 유지하지 마. 계산에 없는 역할·시각·행동을 만들지 마. 나머지 완성된 분야도 유지해.\n${DAILY_EDITORIAL_INSTRUCTION}`
}
