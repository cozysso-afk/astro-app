import {loveSituationQuestions,reunionSituationQuestion} from './loveSituationQuestions.ts'

// Period reading is a bounded first-screen bundle. It is not a capability
// certification: available rows describe the evidence, not permission to
// predict events or to infer unobserved changes between sampled dates.
export const PERIOD_READING_VERSION = 'period-reading-v1.2-split-evidence'
export const PERIOD_PRIMARY_TOPICS:Record<string,string[]> = {
  'relationship.love_general':['연애'], 'relationship.summary':['대인관계'],
  'work_study.study':['학업'], 'work_study.work':['직장'],
  'money_news.money':['금전'], 'condition.condition':['컨디션'],
}
export const PERIOD_PRIMARY_KEYS=Object.keys(PERIOD_PRIMARY_TOPICS)
export const PERIOD_DETAIL_TOPICS:Record<string,string[]> = {
  'relationship.contact_activation':['연락','수신신호','발신적합'],
  'relationship.contact_continuity':['연락'],
  'relationship.love_reunion_interest':['재회','과거인연접점'],
  'work_study.exam':['시험'], 'work_study.career_change':['이직'],
  'money_news.news':['소식'], 'investment.psychology':['투자심리'],
  'investment.realization':['수익실현'], 'investment.entry':['신규진입'],
}
const QUESTION_TOPICS={...PERIOD_PRIMARY_TOPICS,...PERIOD_DETAIL_TOPICS}
const loveKeys = Object.keys(loveSituationQuestions)
const loveTopics = Object.fromEntries(loveKeys.map(key => [key,['연애']]))
function loveEvidence(payload:any) {
  return (payload?.evidence_ledger ?? []).filter((row:any) =>
    row?.id && row.system !== 'thai' && intersects(row,payload.period) && topicsOf(row).includes('연애'))
}
function requiredKeys(payload:any) {
  const rows=(payload?.evidence_ledger ?? []).filter((row:any)=>row?.id && row.system!=='thai' && intersects(row,payload?.period))
  const situations=loveEvidence(payload).length ? loveKeys : []
  const reunionKey='relationship.love_reunion_interest'
  const reunion=rows.some((row:any)=>topicsOf(row).some(topic=>PERIOD_DETAIL_TOPICS[reunionKey].includes(topic))) ? [reunionKey] : []
  if (payload?.period_kind === 'week') {
    // Reserve space for a useful answer in each evidenced family while keeping
    // the number of full provider sections within the existing response budget.
    const families=[
      ['relationship.contact_activation','relationship.love_reunion_interest'],
      ['work_study.exam','work_study.career_change'],
      ['money_news.news','investment.psychology','investment.realization','investment.entry'],
    ]
    const supported=families.flatMap(keys=>{
      const key=keys.find(k=>rows.some((row:any)=>topicsOf(row).some(topic=>PERIOD_DETAIL_TOPICS[k].includes(topic))))
      return key ? [key] : []
    })
    return unique([...PERIOD_PRIMARY_KEYS,...situations,...reunion,...supported])
  }
  return [...PERIOD_PRIMARY_KEYS,...situations,...reunion]
}
const text=(v:unknown)=>typeof v==='string'?v.trim():''
const date=(v:unknown)=>{
  const value=text(v)
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return ''
  const stamp=Date.parse(value+'T00:00:00Z')
  return Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,10)===value?value:''
}
const unique=<T>(values:T[])=>[...new Set(values)]
const sceneText=(row:any)=>text(row?.real_scene)||[text(row?.applies_when),text(row?.evidence_meaning)].filter(Boolean).join(' ')
const PERIOD_UNOBSERVED=/(?:퇴근\s*후|출근\s*(?:전|후)|연락이\s*올\s*가능성|답신이\s*늦|상대가\s*먼저|수면\s*시간이\s*부족(?!하다면|한\s*경우)|수면[^.]{0,20}방해|체력이\s*떨어질\s*수|체력\s*소모|피로\s*누적|집중력\s*저하|신체적\s*피로|감정적\s*조급함|상호\s*호감을\s*확인|차익\s*실현|매수\s*적기|매도\s*적기|상반기|하반기|중반\s*이후|주\s*초반|주\s*후반|월\s*(?:초|중순|말)|월중\s*(?:전반|후반)|저녁\s*시간)/
function stringEntries(value:any,path=''):Array<{path:string,value:string}>{
  if(typeof value==='string')return path?[{path,value}]:[]
  if(!value||typeof value!=='object')return []
  return Object.entries(value).flatMap(([key,child])=>stringEntries(child,path?path+'.'+key:key))
}
function evidenceEnd(row:any){
  const end=date(row?.end_exclusive)||date(row?.end)
  if(!end)return ''
  // Saju ledger segments copy segment_end_exclusive into end. Other legacy
  // ledger ranges use inclusive calendar dates and retain that convention.
  if(row?.end_exclusive||['monthly_segment','annual_segment'].includes(row?.scope))return new Date(Date.parse(end+'T00:00:00Z')-86400000).toISOString().slice(0,10)
  return end
}
export const isExtendedPeriod=(kind:unknown)=>['week','month','annual'].includes(String(kind))
const topicsOf=(row:any)=>unique([text(row?.topic),...(Array.isArray(row?.source_topics)?row.source_topics.map(text):[])].filter(Boolean))
function intersects(row:any,period:any){
  const start=date(period?.start),end=date(period?.end)
  const from=date(row?.date)||date(row?.start),to=date(row?.date)||evidenceEnd(row)
  return Boolean(start&&end&&from&&to&&from<=end&&to>=start)
}

// Keep the existing bounded packet and reserve actual rows for any of the six
// primary fields it omitted. Record omissions instead of calling a sample a
// complete trajectory. No prose or derived direction is created here.
export function attachPeriodReadingContext(packet:any,fullPayload:any=packet){
  if(!isExtendedPeriod(packet?.period_kind))return packet
  const full=(fullPayload?.evidence_ledger??[]).filter((r:any)=>r?.id&&intersects(r,packet.period))
  const selected=new Map<string,any>((packet?.evidence_ledger??[]).map((r:any)=>[r.id,r]))
  for(const topics of Object.values(QUESTION_TOPICS)){
    if([...selected.values()].some(row=>topicsOf(row).some(t=>topics.includes(t))))continue
    const rows=full.filter((row:any)=>topicsOf(row).some(t=>topics.includes(t)))
    // At most two additional unchanged rows per missing field. Their dates are
    // samples, never the start/end of an inferred continuous influence.
    for(const row of [rows[0],rows.at(-1)].filter(Boolean))selected.set(row.id,row)
  }
  const evidence_ledger=[...selected.values()]
  const selectedIds=new Set(selected.keys())
  const omitted=full.filter((r:any)=>!selectedIds.has(r.id))
  return {...packet,evidence_ledger,period_reading:{
    version:PERIOD_READING_VERSION,kind:packet.period_kind,
    requested_period:packet.period,
    temporal_policy:'dated_samples_do_not_establish_continuous_change',
    required_primary_keys:PERIOD_PRIMARY_KEYS,required_section_keys:requiredKeys({...packet,evidence_ledger}),
    ...(loveEvidence({...packet,evidence_ledger}).length
      ? {love_situations:{questions:loveSituationQuestions, shared_evidence_question:'relationship.love_general'}} : {}),
    included_ids:[...selectedIds],omitted_ids:omitted.map((r:any)=>r.id),
    omission_reason:omitted.length?'bounded_prompt_selection':null,
    questions:Object.entries(QUESTION_TOPICS).map(([key,topics])=>{
      const available=full.filter((r:any)=>topicsOf(r).some(t=>topics.includes(t)))
      const included=available.filter((r:any)=>selectedIds.has(r.id))
      return {key,topics,evidence_refs:included.map((r:any)=>r.id),available_count:available.length,
        included_count:included.length,sampled_dates:unique(included.map((r:any)=>date(r.date)).filter(Boolean)).sort(),
        coverage:!available.length?'no_topic_evidence':included.length<available.length?'sampled':'all_supplied_rows',
        // Full supplied rows may themselves be a calculation sample.
        continuous_coverage_claim_allowed:false}
    }),
  }}
}

export function buildPeriodReadingInstruction(kind:unknown){
  const word=kind==='week'?'한 주':kind==='month'?'한 달':'한 해'
  const periodQuestion=kind==='month'
    ? '이번 달에 되풀이해서 살필 선택 하나를 제시해. 월평균과 특정 날짜의 흐름이 다르면 둘의 차이를 설명해. 표본 하나를 한 달의 경향으로 쓰지 마.'
    : kind==='annual'
      ? '한 해의 핵심은 여러 달에 걸쳐 판단이 달라지는 조건이야. 실제 기간 근거가 있으면 그 구간과 선택을 연결해. 흩어진 날짜뿐이면 각각의 관측으로 쓰고 분기 전체로 늘리지 마.'
      : '이번 주 안에서 판단이 달라지는 날과 이유를 다뤄.'
  const weekly = kind==='week' ? `
- 주간 본문의 첫 문단은 이번 주 선택에서 무엇이 달라지는지, 실제 근거가 왜 그런 판단을 허용하는지, 그 판단이 적용되는 생활 장면을 서로 다른 문장으로 설명해. 똑같은 조언을 제목·요약·이유에 반복하지 마.
- overall.dominant_pattern은 독자가 “왜?”라고 물었을 때의 답이야. ‘추진력과 대화상 점검 압박의 공존’처럼 이름만 붙이지 말고, 어느 조건에서 결정을 밀고 나가기 수월한지, 어디에서 다시 확인해야 하는지를 해당 주 근거에 따라 완결된 말로 풀어. 서로 반대되는 근거가 없으면 대비를 만들지 마.
- 같은 분야에 주 안의 날짜별 차이가 실제로 있으면 그중 의미 있는 관측 둘을 YYYY-MM-DD와 함께 비교해. 한 날짜만 있으면 그날에 한정해. 날짜를 쓴 항목은 자기 evidence_refs로 날짜를 뒷받침해야 해. 단일 표본은 주 전체로 늘리지 마.
- period_reading.required_section_keys의 추가 질문도 각각 한 번 작성해. 직접 판단할 근거가 부족하면 조건부로 어디까지 말할 수 있는지 밝히고, 전혀 연결되지 않으면 insufficient로 둬. 연락 수신·발신·재회는 각각의 근거로 구분해. 분야별 상세에는 실제 적용 장면과 그 이유를 설명하고, 더 많은 글을 채우려고 근거 없는 사건을 만들지 마.` : ''
  return `[PERIOD FIRST SCREEN · ${PERIOD_READING_VERSION}]
- 이번 요청은 ${word} 전체와 기본 여섯 분야의 첫 화면이야. 기간의 핵심과 판단 이유를 구분해. 분야를 먼저 쓰고 overall.summary와 headline을 마지막에 작성해. ${periodQuestion}${weekly}
- clusters는 key를 가진 배열이야. ${PERIOD_PRIMARY_KEYS.join(', ')} 여섯 key를 각각 반드시 한 번 포함해. 생성 누락은 근거 부족과 다르니 생략하지 마. 연락·재회·시험·이직·소식·투자 등 기존 세부항목은 근거가 그 질문에 직접 답할 때만 선택해서 작성해. 기간 표본에 관련 topic이 있다는 이유만으로 세부항목 전부를 강제로 만들지 마. period_reading.required_section_keys에 있는 모든 질문을 각각 한 번 작성해. 애정 상황은 love_situations.questions의 서로 다른 질문에 연애 근거를 조건부로 적용하고 applicability=conditional로 둬. 재회 질문은 “${reunionSituationQuestion}”이며 재회·과거인연접점 근거로만 답해. 서로 다른 여섯 원고를 모두 다음 약속 확인으로 끝내지 마. 사용자 관계 상태나 상대 마음을 정해 놓지 마.
- 각 항목은 conclusion/applies_when/evidence_meaning/action/change_condition/evidence_refs/applicability를 포함해. conclusion은 그 분야의 판단 하나야. applies_when은 사용자에게 실제로 일어난 일을 예측하지 말고 해당 조건을 독립된 문장으로 마쳐. 예를 들어 '두 약속 중 하나를 골라야 할 때 해당돼.'처럼 상황만 설명해. '경우라면'에서 끊지 마. evidence_meaning은 실제 기간근거가 왜 그 판단을 허용하는지 생활어로만 설명하고 사용자 사건·증상·상대 행동을 만들지 마. action은 그 조건에서 고를 선택 하나야. 자연스러운 반말로 써.
- 근거가 없으면 applicability=insufficient와 빈 원고·빈 evidence_refs로 명시해. conditional은 근거가 있는 조건부 해석이며 근거 없는 일반론을 뜻하지 않아. 직접 답할 수 없는 부분을 예언으로 채우지 마.
- change_condition은 선택항목이야. 판단을 바꾸는 예외를 뒷받침할 근거가 없으면 빈 문자열로 둬. 본문에 이미 있는 필수 조건과 제한은 그대로 보존해.
- headline은 한 문장(25~60자 목표), overall.summary는 적용 상황과 이유를 설명하는 80~180자 목표야. 중요한 제한을 글자 수 때문에 삭제하지 마. 180자 넘는 제목이나 360자 넘는 요약은 실패야. 상세 설명은 evidence_meaning에 둬.
- 초·중·후반이나 네 분기를 의무적으로 채우지 마. 표본 날짜가 여러 개라는 이유만으로 중간이 계속 좋았거나 달라졌다고 말하지 마. 관측이 같은 경우 유지되는 맥락을 설명할 수 있지만, 날짜 사이의 미계산 변화를 확정하지 마.
- period_reading.questions는 전달된 분야별 근거와 표본 범위야. all_supplied_rows도 전체 기간의 모든 날이 계산됐다는 뜻은 아니야. omitted_ids의 근거는 인용하지 마. 일부 날짜 근거만 있으면 그 날짜의 관측과 기간 전체의 제한을 분리해.
- key_windows/year_phases/cross_checks는 이번 계약에서 반드시 빈 배열로 써. 표본 날짜를 연속 구간으로 늘리는 오류를 막기 위한 제한이야. 정확한 날짜 근거는 각 분야 evidence_meaning과 action${kind==='week'?' 또는 overall이 직접 인용한 관측을 설명하는 문장':''}에서만 설명하고, 날짜 사이가 이어졌다고 추정하지 마.
- 각 fields의 날짜·기간 표현은 그 fields의 evidence_refs가 바로 그 날짜 또는 전체 구간을 직접 포함할 때만 써. 다른 분야 근거의 날짜를 빌리지 마. 직접 포함하지 않으면 날짜를 빼고 실제 생활 장면만 설명해.
- headline·overall·best_phase·caution_phase·각 분야 conclusion/action/applies_when/evidence_meaning은 행성명·각 이름·영문 전문어·사주 용어·'기류/에너지/작용' 없이 생활 언어로 써. 행성명이나 배치는 systems에만 써. evidence_meaning에는 왜 그 선택이 적절한지 일상적인 말로 설명해.
- decisions/priorities도 근거가 있는 항목만 작성해. 날짜 근거가 없으면 시각·날짜 없는 행동으로 써도 돼. 핵심 행동은 여섯 분야의 action에 이미 있으니 총평에서 억지로 별도 행동을 추가할 필요는 없어.
- domain_answers와 relationship_reading/contact_flow/investment_reading은 기존 기능이야. 해당 질문에 답할 근거가 있으면 유지해. 근거가 없으면 생략하고, 관계 전체의 점수만으로 선연락·재회 결과·상대 마음을 채우지 마. 질문 계약별 지원 범위를 따라.
- 연애·대인·학업·직업·금전·컨디션을 서로 다른 질문으로 다뤄. 총평을 복사하거나 학업을 직업으로 바꿔 붙이지 마. 총평에서 독자의 직업·학생 여부·관계 상태를 가정하지 마. 퇴근·출근·수면 부족·체력 저하·상대의 답신 같은 현실 사건은 입력 기록 없이 있었다거나 생긴다고 쓰지 마.
- Western·사주·Thai는 독립 근거야. 같은 기간이라고 합산해 확신을 키우지 마. 원시 Thai 위치를 기간의 길흉·사건·상대 마음으로 바꾸지 마. 점수는 확률이 아니고 높은 활성도는 유리하다는 뜻도 아니야.
- 서사는 점수보다 실제 현상 묶음부터 시작해. 같은 현상이 여러 topic에 걸쳐 있으면 한 번 설명하고 각 분야의 질문에 맞춰 적용 범위를 구분해.
- 점수·평균·변동폭을 설명 자체로 착각하지 마. 고정 조언문을 분야명만 바꿔 반복하지 마. 목적어와 서술어의 의미 호응을 확인하고 쉬운 생활 언어로 써. 제출 전 오탈자와 잘못 붙은 단어를 한 번 더 읽어 고쳐.
- domain_answer_contracts의 각 질문에서 실제 evidence_refs로 직접 또는 부분 답변할 수 있는 항목만 domain_answers에 써. status=direct/partial을 구분하고 근거가 없는 질문은 생략해. 서버가 not_calculated로 처리한다. 일반론으로 채우지 마.
- relationship_reading.focus_timing의 정확한 날짜는 같은 관계 분야의 직접 date 근거를 연결한 경우만 써. start/end 구간이나 다른 분야의 날짜를 관계 주목 날짜로 가져오지 마. 직접 날짜 근거가 없으면 정확한 날짜를 쓰지 마.
- 재회 관심 해설은 생각남→연락→실제 만남→관계 재구축 단계를 구분해. 이전 단계가 다음 단계를 보장하지 않아. 다시 낮춰 읽을 현실 조건은 근거가 허용할 때만 쓰고, 실제 관찰 정보가 없으면 있다고 가정하지 마.
- 계산은 다시 하지 마. 근거 ID는 PROMPT_DATA.evidence_ledger의 값만 사용해. 사건·수익·합격·연락 주체·신체 증상은 만들어내지 마. 모든 날짜 표현은 time_context를 따라.`
}

type Issue={code:string;path:string}
export function inspectPeriodProviderDocument(core:any,kind:unknown,payload?:any){
  const issues:Issue[]=[]
  if(!isExtendedPeriod(kind))return {version:PERIOD_READING_VERSION,passed:true,issues}
  const rows=Array.isArray(core?.clusters)?core.clusters:[]
  const technical=/(?:Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto|ASC|DSC|MC|IC|conjunction|sextile|square|trine|opposition|태양|(?<!이번\s)(?<!한\s)달(?:과|의|이|은)\s*|수성|금성|화성|목성|토성|천왕성|해왕성|명왕성|삼각각|사각각|대립각|육십분위|사주|시너스트리|트랜짓)/i
  const hero=[core?.headline,core?.overall?.summary,core?.overall?.best_phase,core?.overall?.caution_phase].map(text).join(' ')
  if(technical.test(hero)||/(?:기류|에너지|작용)/.test(hero))issues.push({code:'period_hero_not_plain_language',path:'headline'})
  if(/(?:업무|실무|직장|학업|시험|공부|이직|출근|퇴근)/.test(hero))issues.push({code:'period_hero_role_assumption',path:'headline'})
  if (kind==='week' && payload?.evidence_ledger?.some((row:any)=>row?.id && intersects(row,payload.period))) {
    const summary=text(core?.overall?.summary)
    const reason=text(core?.overall?.dominant_pattern)
    const sentences=summary.split(/[.!?。]+(?:\s|$)|\n/).map(part=>part.trim()).filter(Boolean)
    if (new Set(sentences).size<2) issues.push({code:'weekly_summary_needs_explanation',path:'overall.summary'})
    if (!reason || /(?:공존|병존|형성|강화|상충|활성화|압박|긴장|혼재)[.!?。\s]*$/u.test(reason) ||
        sentences.some(sentence=>sentence===reason.replace(/[.!?。]+$/u,''))) {
      issues.push({code:'weekly_reason_needs_interpretation',path:'overall.dominant_pattern'})
    }
    const refs=new Set(core?.overall?.evidence_refs ?? [])
    const linked=payload.evidence_ledger.filter((row:any)=>refs.has(row.id) && intersects(row,payload.period))
    for (const field of ['summary','dominant_pattern','best_phase','caution_phase']) {
      for (const match of text(core?.overall?.[field]).matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)) {
        if (match[1]<payload.period.start || match[1]>payload.period.end || !linked.some((row:any)=>rowCoversSpan(row,match[1],match[1]))) {
          issues.push({code:'weekly_date_without_cited_observation',path:'overall.'+field})
        }
      }
    }
  }
  const providerText=JSON.stringify(core)
  if(/(?:무선\s+규칙적인|상답|예작|생활\s+가관)/.test(providerText))issues.push({code:'period_korean_copy_error',path:'root'})
  for(const entry of stringEntries(core))if(PERIOD_UNOBSERVED.test(entry.value))issues.push({code:'period_unobserved_event_or_span',path:entry.path})
  const healthClaim=/(?:피로|체력|기력|수면|열감|개운|과로|과부하|반응\s*속도|생활\s*리듬|집중력|쉬는\s*시간|휴식\s*(?:부족|이\s*모자라)|몸(?:에|이|의)\s*(?:부담|열|무리))/
  const addHealth=(value:any,path:string)=>{if(healthClaim.test(text(value))&&!issues.some(issue=>issue.code==='period_unobserved_health_claim'&&issue.path===path))issues.push({code:'period_unobserved_health_claim',path})}
  for(const [index,row] of rows.entries())if(row?.key==='condition.condition'&&row?.applicability!=='insufficient')for(const field of ['conclusion','real_scene','applies_when','evidence_meaning','action','change_condition'])addHealth(row?.[field],`clusters.${index}.${field}`)
  for(const field of ['summary','best_phase','caution_phase','dominant_pattern'])addHealth(core?.overall?.[field],`overall.${field}`)
  for(const [index,row] of (core?.domain_answers??[]).entries())if(row?.topic==='컨디션')addHealth(row?.answer,`domain_answers.${index}.answer`)
  for(const field of ['verdict','reason','action','avoid','timing'])addHealth(core?.topic_analysis?.['컨디션']?.[field],`topic_analysis.컨디션.${field}`)
  for(const [index,row] of (core?.decisions??[]).entries())for(const field of ['reason','watch','action','avoid'])addHealth(row?.[field],`decisions.${index}.${field}`)
  const conditionalScene=/(?:만약|실제로|라면|한다면|경우|할 때|해야 할 때|정할 때|고를 때|결정할 때)/
  for(const [index,row] of rows.entries())if(row?.applicability!=='insufficient'){const applies=text(row?.applies_when)||text(row?.real_scene).split(/[.!?。]/)[0];if(applies&&!conditionalScene.test(applies))issues.push({code:'period_real_scene_not_conditional',path:`clusters.${index}.${typeof row?.applies_when==='string'?'applies_when':'real_scene'}`})}
  for (const [index, row] of rows.entries()) {
    if (row?.applicability === 'insufficient' || typeof row?.applies_when !== 'string') continue
    const applies = text(row.applies_when)
    const meaning = text(row.evidence_meaning)
    if (!applies || /(?:라면|다면|경우|할 때|일 때)[.!?。…\s]*$/.test(applies)) {
      issues.push({code:'period_real_scene_not_conditional', path:`clusters.${index}.applies_when`})
    }
    if (!meaning || technical.test(meaning) || /행성\s*(?:구조|배치)|상대지수|배경\s*배치|표본일/.test(meaning)) {
      issues.push({code:'period_evidence_not_plain_language', path:`clusters.${index}.evidence_meaning`})
    }
  }
  const specificLifeDetail=/(?:퇴근|출근|상급자|협업자|기획안|첨부\s*파일|문제집|오답\s*노트|요약\s*노트|장바구니|공과금|카드\s*대금|잔고|모임\s*회비|생활비\s*계좌|집으로|내일|지난주|이틀\s*뒤|오전|오후|저녁|새벽|답장\s*간격|짧은\s*연락|대면\s*약속)/
  for (const entry of stringEntries(core)) {
    if (!specificLifeDetail.test(entry.value)) continue
    // An optional budget check is an action the reader can take. A predicted
    // bill, a job role or an exact time still needs supporting evidence.
    const field = /^clusters\.(\d+)\.action$/.exec(entry.path)
    const moneyAction = field && rows[Number(field[1])]?.key === 'money_news.money' &&
      !specificLifeDetail.test(entry.value.replace(/잔고|장바구니|공과금|카드\s*대금/g,'')) &&
      /(?:확인해|비교해|살펴봐|합산해|점검해|따져봐)[.!?。]?$/u.test(entry.value.trim()) &&
      !/예상|발생|늘어|줄어|부족해져|청구될|나갈 거|결제될/.test(entry.value)
    if (!moneyAction) issues.push({code:'period_specific_life_detail',path:entry.path})
  }
  const contactSupported=rows.some((row:any)=>['relationship.contact_activation','relationship.contact_continuity'].includes(String(row?.key??''))&&row?.applicability!=='insufficient')
  if(!contactSupported){
    const contactLeak=/(?:연락|답장|선연락|안부)/
    for(const entry of stringEntries(core?.relationship_reading??{},'relationship_reading'))if(contactLeak.test(entry.value))issues.push({code:'period_relationship_contact_leak',path:entry.path})
    for(const [index,row] of rows.entries())if(['relationship.love_general','relationship.summary'].includes(String(row?.key??'')))for(const field of ['conclusion','real_scene','applies_when','evidence_meaning','action','change_condition'])if(contactLeak.test(text(row?.[field])))issues.push({code:'period_relationship_contact_leak',path:`clusters.${index}.${field}`})
  }
  const investmentSupported=rows.some((row:any)=>String(row?.key??'').startsWith('investment.')&&row?.applicability!=='insufficient')
  if(!investmentSupported)for(const [field,value] of Object.entries(core?.investment_reading??{}))if(text(value))issues.push({code:'period_unsupported_detail_prose',path:`investment_reading.${field}`})
  if(!contactSupported)for(const [field,value] of Object.entries(core?.contact_flow??{}))if(text(value))issues.push({code:'period_unsupported_detail_prose',path:`contact_flow.${field}`})
  const readerCopy=[core?.headline,core?.overall?.summary,...rows.filter((row:any)=>row?.applicability!=='insufficient').flatMap((row:any)=>[row?.conclusion,row?.applies_when,row?.evidence_meaning,row?.real_scene,row?.action])].map(text).join(' ')
  const repeatedTerms=['조율','흐름','압박','정돈','신중','현실적']
  if(repeatedTerms.some(term=>(readerCopy.match(new RegExp(term,'g'))??[] ).length>3))issues.push({code:'period_generic_repetition',path:'root'})
  for(const row of rows.filter((value:any)=>value?.applicability!=='insufficient')){
    const readerLead=[row?.conclusion,row?.action,text(row?.applies_when)||sceneText(row).split(/[.!?。]/)[0]].map(text).join(' ')
    if(technical.test(readerLead))issues.push({code:'period_section_not_plain_language',path:`clusters.${String(row?.key??'unknown')}`})
  }
  const required = payload ? requiredKeys(payload) : PERIOD_PRIMARY_KEYS
  const loveEvidenceIds = new Set(loveEvidence(payload).map((row:any)=>row.id))
  const conclusions = new Set<string>()
  const actions = new Set<string>()
  for(const key of required){
    const found=rows.filter((r:any)=>r?.key===key)
    if(found.length!==1){issues.push({code:'primary_missing_or_duplicate',path:`clusters.${key}`});continue}
    const row=found[0]
    if (loveKeys.includes(key)) {
      if (row.applicability!=='conditional' || !row.evidence_refs?.some((ref:string)=>loveEvidenceIds.has(ref))) {
        issues.push({code:'monthly_love_requires_conditional_topic_evidence',path:`clusters.${key}`})
      }
      for (const [field,seen] of [['conclusion',conclusions],['action',actions]] as const) {
        const normalized=text(row[field]).replace(/[\s.!?,]/g,'')
        if (normalized && seen.has(normalized)) issues.push({code:'monthly_love_repeated_answer',path:`clusters.${key}.${field}`})
        if (normalized) seen.add(normalized)
      }
    }
    if(!['direct','conditional','insufficient'].includes(row.applicability))issues.push({code:'invalid_applicability',path:`clusters.${key}`})
    if(row.applicability==='insufficient'){
      if(['conclusion','real_scene','applies_when','evidence_meaning','action','change_condition'].some(k=>text(row[k]))||(row.evidence_refs?.length??0)>0)issues.push({code:'insufficient_with_authored_claim',path:`clusters.${key}`})
    }else if(!text(row.conclusion)||!sceneText(row)||!text(row.action)||typeof row.change_condition!=='string'||!Array.isArray(row.evidence_refs)||!row.evidence_refs.length){
      issues.push({code:'primary_incomplete',path:`clusters.${key}`})
    }
  }
  return {version:PERIOD_READING_VERSION,passed:!issues.length,issues}
}

/** If an edit introduces a new defect, try the complete original model-authored
 * field. Publish it only when the assembled document passes every period check. */
export function retainValidPeriodFields(original:any, edited:any, kind:string, packet:any) {
  const report = inspectPeriodProviderDocument(edited,kind,packet)
  if (!isExtendedPeriod(kind) || report.passed || report.issues.length > 4) return edited
  const restored = structuredClone(edited)
  const optionalPriorities = new Set<number>()
  for (const issue of report.issues) {
    const priority = /^priorities\.(\d+)$/.exec(issue.path)
    if (priority && Array.isArray(restored.priorities)) {
      const i = Number(priority[1])
      if (i >= restored.priorities.length) return edited
      optionalPriorities.add(i)
      if (text(original.priorities?.[i])) restored.priorities[i]=original.priorities[i]
      continue
    }
    const path = /^clusters\.(\d+)\.(action|conclusion|applies_when|evidence_meaning|real_scene)$/.exec(issue.path)
    if (!path) return edited
    const row = original.clusters?.[Number(path[1])]
    const target = restored.clusters?.[Number(path[1])]
    if (!target || target.key !== row?.key || !text(row[path[2]])) return edited
    target[path[2]] = row[path[2]]
  }
  if (inspectPeriodProviderDocument(restored,kind,packet).passed) return restored
  // Extra period priorities are optional. Preserve the complete authored core
  // and every unaffected priority if one ungrounded list item is all that failed.
  if (!optionalPriorities.size) return edited
  restored.priorities=restored.priorities.filter((_:unknown,index:number)=>!optionalPriorities.has(index))
  return inspectPeriodProviderDocument(restored,kind,packet).passed ? restored : edited
}

/** Reuse one complete Gemini-authored summary sentence when only the headline
 * is still abstract. No local words are written or shortened. */
export function reusePlainHeadlineFromSummary(core:any,kind:unknown){
  if(!isExtendedPeriod(kind))return core
  const before=inspectPeriodProviderDocument(core,kind)
  if(before.issues.length!==1||before.issues[0]?.code!=='period_hero_not_plain_language'||before.issues[0]?.path!=='headline')return core
  const sentence=text(core?.overall?.summary).split(/[.!?。]/).map(value=>value.trim()).find(Boolean)??''
  if(sentence.length<12||sentence.length>80)return core
  const patched={...core,headline:sentence}
  return inspectPeriodProviderDocument(patched,kind).passed?patched:core
}

// Validate claims against their own references. Two endpoint samples do not
// cover the interval between them; a phase requires a real interval row.
function rowCoversSpan(row:any,start:string,end:string){
  const point=date(row?.date)
  if(point)return start===end&&start===point
  const from=date(row?.start),to=evidenceEnd(row)
  return Boolean(from&&to&&from<=start&&end<=to)
}
export function inspectPeriodReading(data:any,payload:any){
  const issues:Issue[]=[]
  if(!isExtendedPeriod(payload?.period_kind))return {version:PERIOD_READING_VERSION,passed:true,issues}
  const add=(code:string,path:string)=>issues.push({code,path})
  const ledger=new Map<string,any>((payload?.evidence_ledger??[]).map((r:any)=>[r.id,r]))
  for(const [path,max] of [['headline',180],['overall.summary',360]] as const){
    const value=path==='headline'?data?.headline:data?.overall?.summary
    if(!text(value)||text(value).length>max)add('missing_or_overlong_hero',path)
  }
  const scopedTopics = {...QUESTION_TOPICS,...loveTopics}
  for(const [key,topics] of Object.entries(scopedTopics)){
    const [group,name]=key.split('.'),row=data?.clusters?.[group]?.[name]
    if(!row){if(PERIOD_PRIMARY_KEYS.includes(key))add('primary_missing',`clusters.${key}`);continue}
    if(row.applicability==='insufficient')continue
    const linked=(row.evidence_refs??[]).map((id:string)=>ledger.get(id)).filter(Boolean)
    if(!linked.some((r:any)=>intersects(r,payload.period)&&topicsOf(r).some(t=>topics.includes(t))))add('primary_without_same_topic_period_evidence',`clusters.${key}`)
  }
  for(const [key,topics] of Object.entries(scopedTopics)){
    const [group,name]=key.split('.'),section=data?.clusters?.[group]?.[name]
    if(!section||section.applicability==='insufficient')continue
    const linked=(section.evidence_refs??[]).map((id:string)=>ledger.get(id)).filter((r:any)=>r&&topicsOf(r).some(t=>topics.includes(t)))
    for(const field of ['conclusion','real_scene','applies_when','evidence_meaning','action','change_condition']){
      const prose=text(section[field])
      for(const match of prose.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)){
        if(match[1]<payload.period.start || match[1]>payload.period.end || !linked.some((r:any)=>rowCoversSpan(r,match[1],match[1])))add('claim_date_without_local_evidence',`clusters.${key}.${field}`)
      }
      // These explicit half-year/quarter markers caused a real stored annual
      // failure. This is a narrow guard, not a general Korean claim parser.
      const year=date(payload?.period?.start).slice(0,4)
      if(!year||year!==date(payload?.period?.end).slice(0,4))continue
      for(const sentence of prose.split(/[.!?。\n]/)){
        if(/(?:근거|자료|정보).{0,10}(?:없|부족|미계산|확인되지)/.test(sentence))continue
        for(const m of sentence.matchAll(/상반기|하반기|([1-4])분기/g)){
          const first=m[0]==='상반기'?1:m[0]==='하반기'?7:(Number(m[1])-1)*3+1
          const last=m[0].includes('반기')?first+5:first+2
          const start=`${year}-${String(first).padStart(2,'0')}-01`
          const end=new Date(Date.UTC(Number(year),last,0)).toISOString().slice(0,10)
          if(!linked.some((r:any)=>intersects(r,{start,end})))add('claim_period_without_local_evidence',`clusters.${key}.${field}`)
        }
      }
    }
  }
  const relationshipTopics=new Set(['연애','연락','재회','대인관계','수신신호','발신적합','과거인연접점'])
  const relationshipRefs=(data?.relationship_reading?.evidence_refs??[]).map((id:string)=>ledger.get(id)).filter((r:any)=>r&&topicsOf(r).some(t=>relationshipTopics.has(t)))
  for(const m of text(data?.relationship_reading?.focus_timing).matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)){
    if(!relationshipRefs.some((r:any)=>date(r.date)===m[1]))add('relationship_date_without_direct_relationship_evidence','relationship_reading.focus_timing')
  }
  for(const field of ['key_windows','year_phases','cross_checks']){
    const seen=new Set<string>()
    for(const [i,item] of (data?.[field]??[]).entries()){
      const start=date(item.start),end=date(item.end)
      const refs=(item.evidence_refs??[]).map((id:string)=>ledger.get(id)).filter(Boolean)
      if(!start||!end||start>end||start<date(payload?.period?.start)||end>date(payload?.period?.end)||!refs.some((r:any)=>rowCoversSpan(r,start,end)))add('unsupported_period_span',`${field}[${i}]`)
      const signature=JSON.stringify([start,end,[...(item.topics??[])].sort(),[...(item.evidence_refs??[])].sort()])
      if(seen.has(signature))add('duplicate_period_window',`${field}[${i}]`)
      seen.add(signature)
    }
  }
  return {version:PERIOD_READING_VERSION,passed:!issues.length,issues}
}
export function applyPeriodReadingGate(quality:any,report:ReturnType<typeof inspectPeriodReading>){
  if(report.passed)return {...quality,period_reading:report}
  const stages=quality.stages.map((s:any)=>s.stage===6?{...s,passed:false,issues:[...s.issues,...report.issues.map(i=>`${i.path}: ${i.code}`)]}:s)
  return {...quality,ok:false,score:Math.round(stages.filter((s:any)=>s.passed).length/6*100),stages,period_reading:report}
}
