// Period reading is a bounded first-screen bundle. It is not a capability
// certification: available rows describe the evidence, not permission to
// predict events or to infer unobserved changes between sampled dates.
export const PERIOD_READING_VERSION = 'period-reading-v1.1-readable-local-dates'
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
function requiredKeys(_payload:any){
  // Extended periods keep the six first-screen questions mandatory. Detail
  // readings remain available when directly answerable, but are not all forced
  // merely because a sampled topic row exists.
  return PERIOD_PRIMARY_KEYS
}
const text=(v:unknown)=>typeof v==='string'?v.trim():''
const date=(v:unknown)=>{
  const value=text(v)
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return ''
  const stamp=Date.parse(value+'T00:00:00Z')
  return Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,10)===value?value:''
}
const unique=<T>(values:T[])=>[...new Set(values)]
const PERIOD_UNOBSERVED=/(?:퇴근\s*후|출근\s*(?:전|후)|연락이\s*올\s*가능성|답신이\s*늦|상대가\s*먼저|수면\s*시간이\s*부족(?!하다면|한\s*경우)|수면[^.]{0,20}방해|체력이\s*떨어질\s*수|체력\s*소모|피로\s*누적|집중력\s*저하|신체적\s*피로|감정적\s*조급함|상호\s*호감을\s*확인|차익\s*실현|매수\s*적기|매도\s*적기|상반기|하반기|중반\s*이후|주\s*초반|주\s*후반)/
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
  return `[PERIOD FIRST SCREEN · ${PERIOD_READING_VERSION}]
- 이번 요청은 ${word} 전체와 기본 여섯 분야의 첫 화면이야. 기간의 핵심과 판단 이유를 구분해. 분야를 먼저 쓰고 overall.summary와 headline을 마지막에 작성해.
- clusters는 key를 가진 배열이야. ${PERIOD_PRIMARY_KEYS.join(', ')} 여섯 key를 각각 반드시 한 번 포함해. 생성 누락은 근거 부족과 다르니 생략하지 마. 연락·재회·시험·이직·소식·투자 등 기존 세부항목은 근거가 그 질문에 직접 답할 때만 선택해서 작성해. 기간 표본에 관련 topic이 있다는 이유만으로 세부항목 전부를 강제로 만들지 마. 상태별 애정·대인 조건부 상세는 근거 범위에서 추가할 수 있으며 모든 상황을 억지로 채울 의무는 없어.
- 각 항목은 conclusion/real_scene/action/change_condition/evidence_refs/applicability를 포함해. conclusion은 그 분야의 판단 하나, real_scene은 적용 상황과 실제 기간근거의 이유, action은 그 판단에서 도출한 선택 하나야. 자연스러운 반말로 써.
- 근거가 없으면 applicability=insufficient와 빈 원고·빈 evidence_refs로 명시해. conditional은 근거가 있는 조건부 해석이며 근거 없는 일반론을 뜻하지 않아. 직접 답할 수 없는 부분을 예언으로 채우지 마.
- change_condition은 선택항목이야. 판단을 바꾸는 예외를 뒷받침할 근거가 없으면 빈 문자열로 둬. 본문에 이미 있는 필수 조건과 제한은 그대로 보존해.
- headline은 한 문장(25~60자 목표), overall.summary는 적용 상황과 이유를 설명하는 80~180자 목표야. 중요한 제한을 글자 수 때문에 삭제하지 마. 180자 넘는 제목이나 360자 넘는 요약은 실패야. 상세 설명은 real_scene 및 근거 상세에 둬.
- 초·중·후반이나 네 분기를 의무적으로 채우지 마. 표본 날짜가 여러 개라는 이유만으로 중간이 계속 좋았거나 달라졌다고 말하지 마. 관측이 같은 경우 유지되는 맥락을 설명할 수 있지만, 날짜 사이의 미계산 변화를 확정하지 마.
- period_reading.questions는 전달된 분야별 근거와 표본 범위야. all_supplied_rows도 전체 기간의 모든 날이 계산됐다는 뜻은 아니야. omitted_ids의 근거는 인용하지 마. 일부 날짜 근거만 있으면 그 날짜의 관측과 기간 전체의 제한을 분리해.
- key_windows/year_phases/cross_checks는 이번 계약에서 반드시 빈 배열로 써. 표본 날짜를 연속 구간으로 늘리는 오류를 막기 위한 제한이야. 정확한 날짜 근거는 각 분야 real_scene과 action에서만 설명하고, 날짜 사이가 이어졌다고 추정하지 마.
- 각 fields의 날짜·기간 표현은 그 fields의 evidence_refs가 바로 그 날짜 또는 전체 구간을 직접 포함할 때만 써. 다른 분야 근거의 날짜를 빌리지 마. 직접 포함하지 않으면 날짜를 빼고 실제 생활 장면만 설명해.
- headline·overall·best_phase·caution_phase·각 분야 conclusion/action/real_scene 첫 문장은 행성명·각 이름·영문 전문어·사주 용어·'기류/에너지/작용' 없이 생활 언어로 써. 전문 근거는 real_scene의 두 번째 문장 뒤로 미뤄.
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
  const providerText=JSON.stringify(core)
  if(/(?:무선\s+규칙적인|상답|예작|생활\s+가관)/.test(providerText))issues.push({code:'period_korean_copy_error',path:'root'})
  for(const entry of stringEntries(core))if(PERIOD_UNOBSERVED.test(entry.value))issues.push({code:'period_unobserved_event_or_span',path:entry.path})
  const readerCopy=[core?.headline,core?.overall?.summary,...rows.filter((row:any)=>row?.applicability!=='insufficient').flatMap((row:any)=>[row?.conclusion,row?.real_scene,row?.action])].map(text).join(' ')
  const repeatedTerms=['조율','흐름','압박','정돈','신중','현실적']
  if(repeatedTerms.some(term=>(readerCopy.match(new RegExp(term,'g'))??[]).length>5))issues.push({code:'period_generic_repetition',path:'root'})
  for(const row of rows.filter((value:any)=>value?.applicability!=='insufficient')){
    const readerLead=[row?.conclusion,row?.action,text(row?.real_scene).split(/[.!?。]/)[0]].map(text).join(' ')
    if(technical.test(readerLead))issues.push({code:'period_section_not_plain_language',path:`clusters.${String(row?.key??'unknown')}`})
  }
  for(const key of payload?requiredKeys(payload):PERIOD_PRIMARY_KEYS){
    const found=rows.filter((r:any)=>r?.key===key)
    if(found.length!==1){issues.push({code:'primary_missing_or_duplicate',path:`clusters.${key}`});continue}
    const row=found[0]
    if(!['direct','conditional','insufficient'].includes(row.applicability))issues.push({code:'invalid_applicability',path:`clusters.${key}`})
    if(row.applicability==='insufficient'){
      if(['conclusion','real_scene','action','change_condition'].some(k=>text(row[k]))||(row.evidence_refs?.length??0)>0)issues.push({code:'insufficient_with_authored_claim',path:`clusters.${key}`})
    }else if(!['conclusion','real_scene','action'].every(k=>text(row[k]))||typeof row.change_condition!=='string'||!Array.isArray(row.evidence_refs)||!row.evidence_refs.length){
      issues.push({code:'primary_incomplete',path:`clusters.${key}`})
    }
  }
  return {version:PERIOD_READING_VERSION,passed:!issues.length,issues}
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
  for(const [key,topics] of Object.entries(QUESTION_TOPICS)){
    const [group,name]=key.split('.'),row=data?.clusters?.[group]?.[name]
    if(!row){if(PERIOD_PRIMARY_KEYS.includes(key))add('primary_missing',`clusters.${key}`);continue}
    if(row.applicability==='insufficient')continue
    const linked=(row.evidence_refs??[]).map((id:string)=>ledger.get(id)).filter(Boolean)
    if(!linked.some((r:any)=>intersects(r,payload.period)&&topicsOf(r).some(t=>topics.includes(t))))add('primary_without_same_topic_period_evidence',`clusters.${key}`)
  }
  for(const [key,topics] of Object.entries(QUESTION_TOPICS)){
    const [group,name]=key.split('.'),section=data?.clusters?.[group]?.[name]
    if(!section||section.applicability==='insufficient')continue
    const linked=(section.evidence_refs??[]).map((id:string)=>ledger.get(id)).filter((r:any)=>r&&topicsOf(r).some(t=>topics.includes(t)))
    for(const field of ['conclusion','real_scene','action','change_condition']){
      const prose=text(section[field])
      for(const match of prose.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)){
        if(!linked.some((r:any)=>rowCoversSpan(r,match[1],match[1])))add('claim_date_without_local_evidence',`clusters.${key}.${field}`)
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
