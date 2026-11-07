import type { AiEditorialSection, AiInterpretationResponse, PeriodKey, RelationshipAiResponse, RelationshipAnalysisMode } from '../appTypes'
import type { FortuneField } from './fortuneFields'

export type AuthoredBlock = { id: string; label: string; text: string }
export type AuthoredSection = { id: string; label: string; state: 'ready'|'missing'|'insufficient'; blocks: AuthoredBlock[] }
export type AuthoredReadingDocument = {
  version: 'authored-reading-v1'; revision: string; scope: string; title: string; date: string
  state: 'ready'|'partial'|'missing'|'unverified'; headline: string
  core: AuthoredBlock[]; sections: AuthoredSection[]; exportBlockIds: string[]
}
const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const block = (id:string,label:string,value:unknown): AuthoredBlock[] => text(value) ? [{id,label,text:text(value)}] : []
const hash = (value:string) => { let h=2166136261;for(let i=0;i<value.length;i++)h=Math.imul(h^value.charCodeAt(i),16777619);return (h>>>0).toString(16) }
function finish(doc:AuthoredReadingDocument,complete:boolean,version:string) {
  if(doc.state!=='unverified')doc.state=complete?'ready':doc.core.length||doc.sections.some(s=>s.blocks.length)?'partial':'missing'
  doc.exportBlockIds=complete?doc.core.map(b=>b.id):[]
  doc.revision=`${version}:${hash(JSON.stringify([doc.scope,doc.date,doc.headline,doc.core,doc.sections]))}`
  return doc
}
const sectionMap: Record<string,Array<[string,string,string,string]>> = {
  love:[['relationship','love_general','애정','연애'],['relationship','contact_activation','연락 흐름','연락'],['relationship','contact_continuity','대화의 지속','연락'],['relationship','love_reunion_interest','재회 관심','재회'],...['single','crush','flirting','ambiguous','couple'].map((key,i)=>['relationship',`love_${key}`,['솔로 · 새 인연','짝사랑','썸','애매한 관계','연애 중'][i],'연애'] as [string,string,string,string])],
  social:[['relationship','summary','대인관계','대인관계'],...['friends','coworkers','family','new_people','boundaries'].map((key,i)=>['relationship',key,['친구 · 지인','직장동료','가족 · 가까운 사람','새 만남','관계의 경계'][i],'대인관계'] as [string,string,string,string]),['money_news','news','공식 소식','소식']],
  study:[['work_study','study','학업','학업'],['work_study','exam','시험','시험']],
  exam:[['work_study','exam','시험','시험']],
  work:[['work_study','work','직장','직장'],['work_study','career_change','이직','이직']],
  'job-change':[['work_study','career_change','이직','이직']],
  money:[['money_news','money','금전','금전'],['investment','psychology','투자 판단','투자심리'],['investment','realization','수익 실현','수익실현'],['investment','entry','신규 진입','신규진입']],
  investment:[['investment','psychology','투자 판단','투자심리'],['investment','realization','수익 실현','수익실현'],['investment','entry','신규 진입','신규진입']],
  contact:[['relationship','contact_activation','연락 흐름','연락'],['relationship','contact_continuity','대화의 지속','연락'],['money_news','news','공식 소식','소식']],
  condition:[['condition','condition','컨디션','컨디션']],
}
function editorialSection(id:string,label:string,section:AiEditorialSection|undefined,delivered?:string):AuthoredSection {
  const authored=section?.evidence_refs?.length && section.applicability!=='insufficient'
  const hasSplit=text(section?.applies_when)&&text(section?.evidence_meaning)
  const hasLegacy=text(section?.real_scene)
  const state=section?.applicability==='insufficient'&&delivered==='authored'?'insufficient':authored&&text(section.conclusion)&&(hasSplit||hasLegacy)&&text(section.action)?'ready':'missing'
  return {id,label,state,blocks:state==='ready'?[
    ...block(`${id}:conclusion`,'핵심 답',section?.conclusion),
    ...(hasSplit?[
      ...block(`${id}:applies-when`,'이럴 때 적용',section?.applies_when),
      ...block(`${id}:evidence-meaning`,'근거가 뜻하는 것',section?.evidence_meaning),
    ]:block(`${id}:scene`,'생활에서 보면',section?.real_scene)),
    ...block(`${id}:action`,'할 일 · 확인할 점',section?.action),
    ...block(`${id}:condition`,'판단이 달라지는 조건',section?.change_condition),
  ]:[]}
}
function authoredSupplementSections(data:NonNullable<AiInterpretationResponse['data']>,field?:FortuneField):AuthoredSection[] {
  const sections:AuthoredSection[]=[]
  const add=(id:string,label:string,value:unknown)=>{if(text(value))sections.push({id,label,state:'ready',blocks:block(`${id}:text`,'해설',value)})}
  if(!field||field.topics.some(topic=>['연애','연락','재회','대인관계'].includes(topic))) {
    for(const [key,label] of [['incoming','외부 연락 반응'],['outgoing','내 연락 실행 조건'],['reconnection','과거 인연과의 재접점']] as const)if(!field||key!=='reconnection'||field.topics.includes('재회'))add(`contact:${key}`,label,data.contact_flow?.[key])
    if(!field)for(const [key,label] of [['context','관계의 배경'],['flow','관계의 흐름'],['focus_timing','관계에서 살필 시기'],['watch','관계에서 확인할 점'],['avoid','관계에서 피할 것']] as const)add(`relationship:${key}`,label,data.relationship_reading?.[key])
  }
  if(!field||field.topics.includes('투자심리'))for(const [key,label] of [['psychology','투자 판단'],['realization','수익 실현'],['entry','신규 진입'],['risk','투자 위험']] as const)add(`investment:${key}`,label,data.investment_reading?.[key])
  return sections
}
// Migration is intentionally lossless: no sentence slicing, score-derived prose,
// paraphrasing or substitution of the overall summary for a missing field.
export function buildPeriodReadingDocument(data:NonNullable<AiInterpretationResponse['data']>,period:PeriodKey,start:string,end:string,field:FortuneField|undefined,verified:boolean,version='legacy'):AuthoredReadingDocument {
  const label=period==='week'?'주간':period==='month'?'월간':period==='year'?'연간':'일일'
  const doc:AuthoredReadingDocument={version:'authored-reading-v1',revision:'',scope:field?.id??'overall',title:`${label} ${field?.label??'종합운세'}`,date:start===end?start:`${start} → ${end}`,state:verified?'missing':'unverified',headline:'',core:[],sections:[],exportBlockIds:[]}
  if(!verified)return finish(doc,false,version)
  if(field) {
    const cluster=data.clusters as unknown as Record<string,Record<string,AiEditorialSection>>
    const slots=(sectionMap[field.id]??[]).filter(([, , ,topic])=>field.topics.includes(topic))
    doc.sections=slots.map(([group,key,label])=>editorialSection(`${group}.${key}`,label,cluster?.[group]?.[key],data.editorial_delivery?.[`${group}.${key}`]))
    const primary=doc.sections[0]
    if(primary?.state==='ready'){
      doc.headline=primary.blocks[0].text
      doc.core=primary.blocks.slice(1)
      doc.sections=doc.sections.slice(1)
    }
    // Every authored question stays in its selected field; missing questions stay visible.
    const questions=(data.domain_answers??[]).filter(answer=>field.topics.includes(answer.topic)).map(answer=>({id:`question:${answer.topic}:${answer.question_key}`,label:`${answer.topic} · ${answer.label}${answer.status==='partial'?' · 부분 근거':''}`,state:answer.status==='not_calculated'?'insufficient' as const:text(answer.answer)&&answer.evidence_refs?.length?'ready' as const:'missing' as const,blocks:answer.status!=='not_calculated'?block(`question:${answer.topic}:${answer.question_key}:answer`,'해설',answer.answer):[]}))
    doc.sections=[...questions,...doc.sections,...authoredSupplementSections(data,field)]
    const windows=(data.key_windows??[]).filter(w=>w.topics?.some(topic=>field.topics.includes(topic)))
    windows.forEach((w,i)=>doc.sections.push({id:`window:${i}`,label:`${w.start}${w.end&&w.end!==w.start?` → ${w.end}`:''}`,state:'ready',blocks:[...block(`window:${i}:summary`,'이 시기의 흐름',w.summary),...block(`window:${i}:action`,'할 일',w.action),...block(`window:${i}:avoid`,'확인할 조건',w.avoid)]}))
    return finish(doc,primary?.state==='ready',version)
  }
  doc.headline=text(data.headline)
  doc.core=[...block('overall:summary','핵심 요약',data.overall?.summary),...block('overall:reason','이렇게 읽는 이유',data.overall?.dominant_pattern)]
  const decisions=data.decisions??[]
  const first=decisions.find(d=>text(d.action)&&d.evidence_refs?.length)
  if(first)for(const [key,label] of [['action','먼저 할 일'],['reason','행동의 이유'],['timing','적용 시기'],['watch','다시 판단할 조건'],['avoid','피할 것']] as const)doc.core.push(...block(`decision:primary:${key}`,label,first[key]))
  doc.core.push(...block('limits','함께 알아둘 조건',data.limits))
  decisions.forEach((d,i)=>{if(d!==first)doc.sections.push({id:`decision:${i}`,label:'함께 살필 판단',state:'ready',blocks:([['action','할 일'],['reason','이유'],['timing','적용 시기'],['watch','다시 판단할 조건'],['avoid','피할 것']] as const).flatMap(([key,label])=>block(`decision:${i}:${key}`,label,d[key]))})})
  ;(data.key_windows??[]).forEach((w,i)=>doc.sections.push({id:`window:${i}`,label:`${w.start}${w.end&&w.end!==w.start?` → ${w.end}`:''}`,state:'ready',blocks:[...block(`window:${i}:summary`,'이 시기의 흐름',w.summary),...block(`window:${i}:action`,'할 일',w.action),...block(`window:${i}:avoid`,'확인할 조건',w.avoid)]}))
  ;(data.year_phases??[]).forEach((p,i)=>doc.sections.push({id:`phase:${i}`,label:`${p.label} · ${p.start} → ${p.end}`,state:'ready',blocks:[...block(`phase:${i}:theme`,'흐름',p.theme),...block(`phase:${i}:change`,'달라지는 점',p.change)]}))
  for(const [key,label] of [['western','서양점성술'],['saju','사주'],['thai','태국점성술']] as const)if(text(data.systems?.[key]))doc.sections.push({id:`system:${key}`,label,state:'ready',blocks:block(`system:${key}:text`,'체계별 해설',data.systems[key])})
  ;(data.cross_checks??[]).forEach((c,i)=>doc.sections.push({id:`cross:${i}`,label:`${c.label} · ${c.start} → ${c.end}`,state:'ready',blocks:([['western','서양점성술'],['saju','사주'],['thai','태국점성술'],['synthesis','함께 보면']] as const).flatMap(([key,label])=>block(`cross:${i}:${key}`,label,c[key]))}))
  ;(data.priorities??[]).forEach((value,i)=>doc.sections.push({id:`priority:${i}`,label:'기간 우선순위',state:'ready',blocks:block(`priority:${i}:text`,'원고의 우선순위',value)}))
  for(const answer of data.domain_answers??[])doc.sections.push({id:`question:${answer.topic}:${answer.question_key}`,label:`${answer.topic} · ${answer.label}${answer.status==='partial'?' · 부분 근거':''}`,state:answer.status==='not_calculated'?'insufficient':text(answer.answer)&&answer.evidence_refs?.length?'ready':'missing',blocks:answer.status!=='not_calculated'?block(`question:${answer.topic}:${answer.question_key}:answer`,'해설',answer.answer):[]})
  doc.sections.push(...authoredSupplementSections(data))
  // Preserve all question slots in the detailed view, including unavailable slots.
  for(const [scope,slots] of Object.entries(sectionMap))if(['love','social','study','work','money','condition'].includes(scope))for(const [group,key,label] of slots){const id=`${group}.${key}`;if(!doc.sections.some(s=>s.id===id))doc.sections.push(editorialSection(id,label,(data.clusters as unknown as Record<string,Record<string,AiEditorialSection>>)?.[group]?.[key],data.editorial_delivery?.[id]))}
  const completed=finish(doc,Boolean(doc.headline&&text(data.overall?.summary)&&data.overall?.evidence_refs?.length),version)
  // A readable period overview can legitimately have no action. Do not fabricate
  // one to unlock an export that promises an actionable core and its conditions.
  if(!first)completed.exportBlockIds=[]
  return completed
}

export function buildRelationshipReadingDocument(ai:RelationshipAiResponse|null,mode:RelationshipAnalysisMode,date:string):AuthoredReadingDocument {
  const labels:Record<string,string>={compatibility:'궁합',reunion:'재회',marriage_unmarried:'결혼궁합',marriage_married:'결혼생활'}
  const verified=ai?.ok&&ai.origin==='gemini'&&ai.provenance_verified===true&&ai.data
  const doc:AuthoredReadingDocument={version:'authored-reading-v1',revision:'',scope:mode,title:`${labels[mode]??'궁합'} 해설`,date,state:verified?'missing':'unverified',headline:'',core:[],sections:[],exportBlockIds:[]}
  if(!verified||!ai?.data)return finish(doc,false,ai?.interpreter_version??'legacy')
  const data=ai.data
  const core=data as typeof data & {core_summary?:string;core_reason?:string;core_action?:string;core_conditions?:string[]}
  doc.headline=text(data.headline)
  doc.core=[...block('core:summary','핵심 요약',core.core_summary),...block('core:reason','이렇게 읽는 이유',core.core_reason),...block('core:action','할 일 · 확인할 점',core.core_action),...(core.core_conditions??[]).flatMap((value,i)=>block(`core:condition:${i}`,'함께 알아둘 조건',value)),...block('limits','해석의 범위',data.limits)]
  const add=(id:string,label:string,value:unknown)=>doc.sections.push({id,label,state:text(value)?'ready':'missing',blocks:block(`${id}:text`,'해설',value)})
  add('overview','전체 상세 해설',data.overview)
  if(mode.startsWith('marriage_')) {
    const marriage=data.marriage_reading
    for(const [key,label] of [['bottom_line','함께 생활할 때의 핵심'],['bond','관계의 결속'],['emotional_home','정서와 가정'],['daily_life','일상과 역할'],['intimacy_resources','친밀감과 자원'],['conflict_repair','갈등과 회복'],['commitment_or_current_cycle',mode==='marriage_married'?'현재 관계의 과제':'약속과 결혼의 조건'],['timing','시기'],['caution','주의할 조건'],['precision_note','정밀도와 한계']] as const)add(`marriage:${key}`,label,marriage?.[key])
  } else if(mode==='reunion') {
    const reunion=data.reunion_synthesis_v2
    if(reunion) {
      add('reunion:summary','재회 해설',reunion.summary)
      for(const [key,label] of [['current_stage','실제 관계 상태를 바탕으로 보면'],['contact_type_if_any','연락이 있다면 그 성격'],['initiative','연락의 방향'],['continuity','대화의 지속'],['meeting_gate','만남으로 넘어갈 조건'],['rebuild_gate','관계를 다시 만들 조건'],['behavior_change_evidence','달라진 행동의 확인']] as const)add(`consultation:${key}`,label,reunion.consultation_answer?.[key])
      for(const [key,label] of [['next_stage_up_conditions','다음 단계의 확인점'],['down_conditions','멈추거나 다시 볼 조건'],['repeat_risks','반복 위험']] as const)(reunion.consultation_answer?.[key]??[]).forEach((value,i)=>add(`consultation:${key}:${i}`,label,value))
      for(const [key,label] of [['why_reconnect','다시 연결될 여지'],['initiative','양쪽 차트의 활성']] as const){add(`${key}:conclusion`,label,reunion[key]?.conclusion);add(`${key}:interpretation`,`${label}의 이유`,reunion[key]?.interpretation)}
      add('timing:conclusion','계산상 시기',reunion.timing?.conclusion)
      ;(reunion.timing?.windows??[]).forEach((w,i)=>add(`timing:${i}`,w.period,w.meaning))
      add('rebuild:conclusion','다시 이어갈 때의 관계',reunion.rebuild?.conclusion)
      ;(reunion.rebuild?.conditions??[]).forEach((value,i)=>add(`rebuild:condition:${i}`,'관계 재구축 조건',value))
      add('repeat_risks:conclusion','반복 위험',reunion.repeat_risks?.conclusion)
      ;(reunion.repeat_risks?.patterns??[]).forEach((value,i)=>add(`repeat:pattern:${i}`,'반복될 수 있는 문제',value))
      ;(reunion.convergence??[]).forEach((value,i)=>add(`convergence:${i}`,`${value.theme}${value.period?` · ${value.period}`:''}`,value.meaning))
      add('precision','정밀도와 한계',reunion.precision_note)
    } else {
      for(const [key,label] of [['bottom_line','이전 저장본 핵심'],['incoming_contact','상대 차트 쪽 활성'],['outgoing_contact','내 차트 쪽 활성'],['reconnection_windows','이전 저장본 시기'],['low_windows','주의 구간'],['relationship_filter','관계 유지 조건'],['precision_note','정밀도와 한계']] as const)add(`legacy:${key}`,label,data.reunion_reading?.[key])
    }
  } else for(const [key,label] of [['chemistry','서로 끌리는 지점'],['emotional_dynamic','감정을 주고받는 방식'],['communication','소통 방식'],['conflict_pattern','반복 갈등'],['power_boundaries','관계의 경계'],['long_term','오래 이어가는 조건'],['stability','관계의 안정'],['tensions','긴장과 차이'],['timing','선택 기간의 시기']] as const)add(key,label,data[key])
  ;(data.practical_advice??[]).forEach((value,i)=>add(`advice:${i}`,'현실에서 확인할 점',value))
  ;(data.felt_scenarios??[]).forEach((value,i)=>add(`scene:${i}`,'생활 장면',value))
  ;(data.top_aspects??[]).forEach((value,i)=>add(`aspect:${i}`,value.label,value.meaning))
  return finish(doc,Boolean(doc.headline&&text(core.core_summary)&&text(core.core_reason)&&text(core.core_action)&&Array.isArray(core.core_conditions)&&core.core_conditions.length<=4&&core.core_conditions.every(value=>Boolean(text(value)))),ai.interpreter_version??'legacy')
}
