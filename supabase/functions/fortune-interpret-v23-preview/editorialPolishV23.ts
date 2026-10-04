const TOPIC_CLUSTER_PATHS: Record<string, string[]> = {
  '대인관계': ['relationship','summary'],
  '연애': ['relationship','love_general'],
  '연락': ['relationship','contact_activation'],
  '재회': ['relationship','love_reunion_interest'],
  '직장': ['work_study','work'],
  '이직': ['work_study','career_change'],
  '시험': ['work_study','exam'],
  '학업': ['work_study','study'],
  '금전': ['money_news','money'],
  '소식': ['money_news','news'],
  '투자심리': ['investment','psychology'],
  '수익실현': ['investment','realization'],
  '신규진입': ['investment','entry'],
  '투자주의': ['investment','psychology'],
  '컨디션': ['condition','condition'],
}

function uniq<T>(values:T[]):T[]{ return [...new Set(values)] }
function text(value:unknown){ return String(value??'').replace(/\s+/g,' ').trim() }
function clip(value:string,max:number){ return value.length<=max?value:`${value.slice(0,Math.max(0,max-1)).trim()}…` }
function refs(value:any){ return Array.isArray(value)?value.map(String).filter(Boolean):[] }

function sectionFor(data:any,topic:string){
  const path=TOPIC_CLUSTER_PATHS[topic]
  if(!path)return null
  return data?.clusters?.[path[0]]?.[path[1]]??null
}

function softenCertainty(value:string){
  return value
    .replace(/가능성이 높아/g,'그런 장면이 나타날 수 있어')
    .replace(/가능성이 높다/g,'그런 장면이 나타날 수 있어')
    .replace(/필수적인 날이야/g,'중요도가 커지는 날이야')
    .replace(/필수적이야/g,'중요해')
    .replace(/무조건/g,'조건을 확인하지 않은 채')
    .replace(/반드시/g,'우선')
    .replace(/오늘 바로 정중히 거절해/g,'오늘은 정중히 거절하는 쪽이 안전해')
    .replace(/즉각 대화를 멈추고/g,'대화가 겉돌면 잠시 멈추고')
}

function polishProseFields(data:any){
  const apply=(node:any,keys:string[])=>{if(!node||typeof node!=='object')return;for(const key of keys)if(typeof node[key]==='string')node[key]=softenCertainty(node[key])}
  apply(data?.overall,['summary','dominant_pattern','best_phase','caution_phase'])
  for(const group of Object.values(data?.clusters??{}) as any[])for(const section of Object.values(group??{}) as any[])apply(section,['conclusion','real_scene','action','change_condition'])
  for(const item of data?.decisions??[])apply(item,['action','reason','watch','avoid'])
  for(const item of Object.values(data?.topic_analysis??{}) as any[])apply(item,['verdict','reason','action','avoid','confidence_reason'])
  for(const node of [data?.relationship_reading,data?.contact_flow,data?.investment_reading,data?.systems]){
    if(!node||typeof node!=='object')continue
    for(const [key,value] of Object.entries(node))if(typeof value==='string')node[key]=softenCertainty(value)
  }
  if(Array.isArray(data?.priorities))data.priorities=data.priorities.map((value:any)=>softenCertainty(String(value)))
}

function enrichTopicAnalysis(data:any,map:Map<string,any>){
  if(!data?.topic_analysis||typeof data.topic_analysis!=='object')return
  for(const [topic,item] of Object.entries(data.topic_analysis) as any[]){
    if(!item||item.importance==='참고')continue
    const section=sectionFor(data,topic)
    if(!section||!['direct','conditional'].includes(String(section?.applicability??'')))continue
    const linked=refs(section?.evidence_refs).filter(ref=>map.has(ref))
    if(!linked.length)continue
    const conclusion=text(section?.conclusion),scene=text(section?.real_scene),action=text(section?.action),change=text(section?.change_condition)
    if(conclusion.length>=18)item.verdict=clip(conclusion,240)
    const existingReason=text(item?.reason)
    if(scene.length>=18){
      const sceneSentence=`현실에서는 ${scene}`
      item.reason=clip([existingReason,sceneSentence].filter(Boolean).join(' '),680)
    }
    if(action.length>=10)item.action=clip(action,260)
    if(change.length>=12){
      const existingAvoid=text(item?.avoid)
      item.avoid=clip([existingAvoid,`판단을 바꿀 조건은 ${change}`].filter(Boolean).join(' '),360)
    }
    item.evidence_refs=uniq([...refs(item?.evidence_refs).filter(ref=>map.has(ref)),...linked]).slice(0,8)
  }
}

function directionOf(rows:any[]){
  const supportive=rows.some(row=>row?.direction==='supportive')
  const caution=rows.some(row=>row?.direction==='caution')
  return supportive&&caution?'혼합':supportive?'활용':caution?'주의':'중립'
}
function topicsOf(rows:any[]){return uniq(rows.map(row=>text(row?.topic)).filter(Boolean)).slice(0,3)}
function systemRole(system:string,rows:any[]){
  if(!rows.length)return ''
  const topics=topicsOf(rows),direction=directionOf(rows)
  const focus=topics.length?topics.join('·'):'해당 구간'
  if(system==='western')return `Western은 ${focus}의 ${direction} 신호를 구체 시점 근거로 보여줘.`
  if(system==='saju')return `사주는 ${focus}을 기간 배경에서 ${direction} 맥락으로 보여줘.`
  return `Thai는 ${focus}을 독립 주기·배경에서 ${direction} 맥락으로 보여줘.`
}

function actionHint(data:any,linkedRows:any[]){
  for(const topic of topicsOf(linkedRows)){
    const action=text(sectionFor(data,topic)?.action)
    if(action.length>=10)return action
  }
  return ''
}

function shallowSynthesis(value:string){
  const normalized=text(value)
  if(normalized.length<120)return true
  return /(합산하지 않아|독립 맥락|함께 관측|일치 여부를 판단할 근거가 부족)/.test(normalized)
    && !/(시점|배경|현실|운영|행동)/.test(normalized)
}

function deepenCrossChecks(data:any,map:Map<string,any>){
  if(!Array.isArray(data?.cross_checks))return
  for(const cross of data.cross_checks){
    if(!cross||cross?.mode==='Western단독')continue
    const linkedRows=refs(cross?.evidence_refs).map(ref=>map.get(ref)).filter(Boolean)
    const western=linkedRows.filter((row:any)=>row?.system==='western')
    const saju=linkedRows.filter((row:any)=>row?.system==='saju')
    const thai=linkedRows.filter((row:any)=>row?.system==='thai')
    if(!western.length||(!saju.length&&!thai.length))continue
    if(!shallowSynthesis(String(cross?.synthesis??'')))continue
    const roles=[systemRole('western',western),systemRole('saju',saju),systemRole('thai',thai)].filter(Boolean)
    const nonWestern=[...saju,...thai]
    const westDirection=directionOf(western),otherDirection=directionOf(nonWestern)
    const sameDirection=westDirection!=='중립'&&otherDirection!=='중립'&&westDirection===otherDirection
    const practical=actionHint(data,linkedRows)
    const relation=cross?.mode==='상반맥락'||(!sameDirection&&westDirection!=='중립'&&otherDirection!=='중립')
      ? '체계가 서로 다른 층위를 말하므로 Western은 언제 체감이 강해지는지, 사주·Thai는 왜 그 시기가 무겁거나 수월하게 느껴지는지 분리해서 읽는 편이 정확해.'
      : '같은 방향이 겹쳐도 같은 사건을 보장하는 다수결은 아니야. Western은 시점, 사주·Thai는 기간 배경을 맡는다고 보면 돼.'
    const operation=practical?`실제 운영에서는 ${practical}`:'실제 반응·일정·수치가 이 흐름과 함께 움직이는지 확인해.'
    cross.synthesis=clip(`${roles.join(' ')} ${relation} ${operation}`,880)
  }
}

export function polishV23EditorialDepth(input:any,payload:any){
  const data=structuredClone(input??{})
  const rows=Array.isArray(payload?.evidence_ledger)?payload.evidence_ledger:[]
  const map=new Map<string,any>(rows.map((row:any)=>[String(row?.id??''),row]))
  enrichTopicAnalysis(data,map)
  deepenCrossChecks(data,map)
  polishProseFields(data)
  return data
}
