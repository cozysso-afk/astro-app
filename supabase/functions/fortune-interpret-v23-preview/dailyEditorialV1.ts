export const DAILY_EDITORIAL_VERSION = 'daily-editorial-v1-evidence-and-language'

export const DAILY_EDITORIAL_INSTRUCTION = `[DAILY_EDITORIAL]
- 이번 요청은 종합과 기본 여섯 분야의 첫 화면 원고다. 추가 하위관계·이직·시험·투자 원고는 이번 생성 범위가 아니다. 빈칸을 채우려고 범위를 넓히지 마.
- 독자에게 말하듯 자연스러운 반말을 써. 보고서식 "작용한다/형성된다/요구된다/적합하다/동시 작용" 대신 실제 대상과 동사를 써. headline은 25~60자, overall.summary는 80~180자를 목표로 하되 조건을 자르지 마.
- headline에서 결론 하나를 먼저 말하고 summary에서는 왜 그렇게 읽었는지 풀어줘. 핵심이 두 문장에 흩어지거나 "변화와 점검이 동시에 작용" 같은 추상 대비만 남으면 다시 써. dominant_pattern도 별도 설명이 없으면 빈 문자열로 두고 요약을 반복하지 마.
- clusters.real_scene은 먼저 조건부 생활 장면을 독자가 이해할 말로 설명해. 행성명·삼분위·육십분위·역행을 문단 첫머리에 나열하지 마. 전문 계산 이름은 systems 또는 계산 근거에 모아.
- 계산된 배치를 실제 사건의 관측처럼 쓰지 마. 호감 표현이 존재한다, 상급자의 요구가 강해진다, 늦은 시간 체력이 저하된다는 사실은 입력에 없다. 상황 예시를 쓸 때에는 "약속을 앞두고 있다면"처럼 조건을 밝혀.
- 구체적으로 보이게 하려고 물의 온도·신체 부위·증상·학습 효과·임의의 개수나 횟수를 만들지 마. 계산값은 그런 정보를 주지 않는다. 행동은 핵심 판단과 바로 연결되는 확인 하나로 써.
- 애정은 실제 만남·호감의 상호성·관계 속도를 다뤄. 메시지를 주고받으라는 행동만 쓰면 연락과 구분되지 않는다. 상대가 실제로 무엇을 했다고 가정하지 마.
- change_condition은 다른 일을 시키는 칸이 아니다. 어떤 현실 관찰이 앞의 판단을 약하게 하거나 적용하지 않게 하는지 써. 설명할 근거가 없으면 "이 자료만으로는 판단을 바꿀 구체 조건까지 정할 수 없어"처럼 한계를 밝혀. 과거 이야기를 하면 감정을 설명하라는 등 새 시나리오를 만들지 마.
- 독자가 묻는 것은 "이 날 무엇을 먼저 살피고, 왜 그렇게 읽는가"다. headline은 핵심 판단, overall.summary는 판단의 이유와 적용 범위, decisions는 행동을 맡는다. 같은 뜻을 세 번 풀어쓰지 마.
- 일일 종합 첫 문단에서 이직·시험·학업·투자 등 사용자에게 확인되지 않은 역할과 일정을 전제하지 마. 해당 분야에서만 상황을 조건부로 다뤄.
- "이야기를 열어두다", "대화의 접점을 열다", "변화 욕구를 현실적 규격에 안착시키다"처럼 대상과 행동이 불분명한 표현은 쓰지 마. 누가 무엇을 말하거나 확인하는지 일상적인 한국어로 써.
- 추상어를 쉬운 말로 바꾸더라도 근거와의 연결을 없애지 마. 근거의 어떤 특징을 어떤 생활상의 질문으로 읽는지 설명해. "오늘도 일정과 휴식을 챙겨" 같은 상시 조언만 남으면 실패다.
- daily_editorial_brief는 질문별로 전달된 사실과 그 사용 범위를 표시한다. 근거가 있다는 것과 사건을 예측할 수 있다는 것은 다르다. 상대 마음, 선연락 주체, 신체 증상, 결과를 사실로 만들어내지 마.
- 시간창은 하루 안의 상대 비교이며 실제 약속·업무·수면 시간표가 아니다. 새벽 최고값을 새벽 연락·이직 검토 권유로 바꾸지 마. 사용자의 활동 시간이 없으면 새벽에는 행동을 권하지 말고 시각은 근거 상세에만 남겨.
- 01:00~02:30 근거를 "오전 업무 전"으로 바꾸거나, 학업 시간창을 업무·컨디션 조언의 시간으로 옮기지 마. 쓸 만한 시간 근거가 없으면 시각 없는 행동으로 쓰고 시간은 만들지 마.
- 행성 위치만 있는 Thai 자료를 순조로운 일정·안정·관계 유지의 근거로 승격하지 마. 설명 가능한 위치 사실과 설명 불가능한 생활 판단의 경계를 밝혀. 다른 두 체계와 억지로 같은 결론을 만들지 마.
- 명확한 지원·주의 방향이 없으면 대립을 꾸미지 마. 확인된 맥락과 해석의 한계를 설명해. 원고가 부족하면 일반론으로 채우지 마.
- 한 분야의 domain_answers를 direct/partial로 답했다면 그 분야 기본 요약을 빈 insufficient로 남기지 마. 같은 자료로 무엇까지 말할 수 있는지 기본 요약에도 설명해.`

const TOPIC_BY_SECTION: Record<string,string[]> = {
  'relationship.love_general':['연애'], 'relationship.summary':['대인관계'],
  'work_study.study':['학업'], 'work_study.work':['직장'], 'money_news.money':['금전'], 'condition.condition':['컨디션'],
}
const str=(v:unknown)=>typeof v==='string'?v.trim():''
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
      const facts=rows.filter((r:any)=>topics.includes(r.topic) && /intraday_evidence|daily_actual/.test(str(r.scope)))
      const windows=rows.filter((r:any)=>topics.includes(r.topic) && r.scope==='intraday_window')
      return {section,topics,fact_refs:facts.map((r:any)=>r.id),window_refs:windows.map((r:any)=>r.id),scope:facts.length?'context_interpretation_only':'no_direct_facts_in_packet'}
    }),
    window_policy:'relative_comparison_not_schedule', thai_position_policy:'geometry_not_life_prediction',
  }
}

// The first daily screen needs field evidence, not every ranking, sub-question
// and intraday schedule. Keep complete evidence rows and their original IDs.
export function dailyReaderPacket(packet:any) {
  const source=Array.isArray(packet?.evidence_ledger)?packet.evidence_ledger:[]
  const chosen=new Map<string,any>()
  for(const topics of Object.values(TOPIC_BY_SECTION)){
    for(const row of source.filter((r:any)=>topics.includes(r.topic)&&/intraday_evidence|daily_actual/.test(str(r.scope))).slice(0,5))chosen.set(row.id,row)
  }
  for(const system of ['saju','thai']){
    for(const row of source.filter((r:any)=>r.system===system&&/daily/.test(str(r.scope))).slice(0,2))chosen.set(row.id,row)
  }
  const evidence_ledger=[...chosen.values()]
  return {packet_version:packet.packet_version,period_kind:'day',period:packet.period,time_context:packet.time_context,
    user_context:{life_role:'unknown',relationship_status:'unknown',activity_hours:'unknown',observed_events:[]},
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
    for(const key of ['conclusion','real_scene','action','change_condition'])record(`clusters.${g}.${k}.${key}`,s?.[key],s?.evidence_refs,key==='action'?'action':'prose')
  }
  for(const [i,d] of (data?.decisions??[]).entries())for(const key of ['action','timing','reason','watch','avoid'])record(`decisions[${i}].${key}`,d?.[key],d?.evidence_refs,key==='timing'||key==='action'?'action':'prose')
  for(const [i,w] of (data?.key_windows??[]).entries())for(const key of ['summary','action','avoid'])record(`key_windows[${i}].${key}`,w?.[key],w?.evidence_refs,key==='action'?'action':'prose')
  const opaque=/(?:이야기(?:는|를|의)?\s*열어|대화의\s*접점을?\s*열|변화\s*욕구.{0,30}규격|규격.{0,25}안착)/
  for(const r of records){
    if(payload?.time_context?.today_word_allowed===false&&/오늘/.test(r.text))add('today_word_without_current_date',r.path)
    if(opaque.test(r.text))add('opaque_korean_expression',r.path)
    if(r.kind==='overview'&&/삼분위|육십분위|사분위|천왕성|해왕성|명왕성|일진|육합|정인\s*기운/.test(r.text))add('technical_detail_in_summary',r.path)
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
