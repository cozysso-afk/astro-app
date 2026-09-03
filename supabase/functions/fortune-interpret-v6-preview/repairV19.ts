import { REL, TOPICS } from "./integratedInterpretationV2.ts";

const DECISION_LINK_PREFIX="핵심 시기와 연결되지 않은 결정 조언:";
const DIRECTION_TOPICS=[...TOPICS,...REL].map(String);

function issuesOf(report:any){
  return (Array.isArray(report?.stages)?report.stages:[]).flatMap((stage:any)=>(Array.isArray(stage?.issues)?stage.issues:[]).map((issue:any)=>String(issue??""))).filter(Boolean);
}

function isoDate(value:any){return String(value??"").match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0]??"";}
function uniq<T>(values:T[]){return [...new Set(values)];}
function refTopic(ref:any){
  const value=String(ref??"");
  return DIRECTION_TOPICS.find(topic=>value.includes(`:${topic}:`))??"";
}
function refsOf(value:any){return Array.isArray(value)?value.map(String).filter(Boolean):[];}

function decisionForIssue(candidate:any,issue:string){
  const label=issue.startsWith(DECISION_LINK_PREFIX)?issue.slice(DECISION_LINK_PREFIX.length).trim():"";
  if(!label)return null;
  const decisions=Array.isArray(candidate?.decisions)?candidate.decisions:[];
  return decisions.find((decision:any)=>{
    const action=String(decision?.action??"").trim();
    return action===label||action.startsWith(label)||label.startsWith(action);
  })??null;
}

function deterministicDecisionWindowLink(candidate:any,issue:string){
  const decision=decisionForIssue(candidate,issue);
  const windows=Array.isArray(candidate?.key_windows)?candidate.key_windows:[];
  if(!decision||!windows.length)return false;

  const decisionRefs=refsOf(decision?.evidence_refs);
  const allWindowRefs=new Set(windows.flatMap((window:any)=>refsOf(window?.evidence_refs)));
  if(decisionRefs.some(ref=>allWindowRefs.has(ref)))return true;

  const decisionTopics=uniq([
    ...decisionRefs.map(refTopic).filter(Boolean),
    ...DIRECTION_TOPICS.filter(topic=>String(decision?.action??"").includes(topic)||String(decision?.reason??"").includes(topic)),
  ]);
  if(!decisionTopics.length)return false;

  const timingDate=isoDate(decision?.timing);
  const exactWindowDates=uniq(windows.flatMap((window:any)=>{
    const start=isoDate(window?.start),end=isoDate(window?.end);
    return start&&end&&start===end?[start]:[];
  }));
  const implicitSingleDate=!timingDate&&exactWindowDates.length===1?exactWindowDates[0]:"";
  const targetDate=timingDate||implicitSingleDate;

  for(const window of windows){
    const start=isoDate(window?.start),end=isoDate(window?.end);
    if(targetDate&&!(start&&end&&start<=targetDate&&targetDate<=end))continue;
    const windowTopics=uniq([
      ...(Array.isArray(window?.topics)?window.topics.map(String):[]),
      ...refsOf(window?.evidence_refs).map(refTopic).filter(Boolean),
    ]);
    const sharedTopics=decisionTopics.filter(topic=>windowTopics.includes(topic));
    if(!sharedTopics.length)continue;
    const linkRef=refsOf(window?.evidence_refs).find(ref=>sharedTopics.includes(refTopic(ref)));
    if(!linkRef)continue;
    decision.evidence_refs=uniq([...decisionRefs,linkRef]);
    return true;
  }
  return false;
}

function topicSpecificIssue(issue:string,candidate:any){
  if(/^topic_analysis\./.test(issue))return true;
  if(TOPICS.some(topic=>issue.startsWith(`${topic} 확신도 `)||issue.startsWith(`${topic} 핵심인데 `)||issue.startsWith(`${topic} 핵심 근거 설명이 얕음`)||issue.startsWith(`${topic} 주목 근거 설명이 얕음`)||issue.startsWith(`${topic} 참고 근거 설명이 얕음`)||issue.startsWith(`${topic} 참고 설명이 과도하게 김`)))return true;
  const ref=issue.match(/^존재하지 않는 근거 ID:\s*(.+)$/)?.[1]?.trim();
  if(ref&&Object.values(candidate?.topic_analysis??{}).some((row:any)=>Array.isArray(row?.evidence_refs)&&row.evidence_refs.map(String).includes(ref)))return true;
  const date=issue.match(/^계산근거에서 찾을 수 없는 날짜 언급:\s*(\d{4}-\d{2}-\d{2})$/)?.[1];
  if(date&&JSON.stringify(candidate?.topic_analysis??{}).includes(date))return true;
  return false;
}

export function classifyQualityRepair(report:any,candidate:any){
  const issues=issuesOf(report);
  const fixedDecisionLinks=new Set(issues.filter(issue=>issue.startsWith(DECISION_LINK_PREFIX)).filter(issue=>deterministicDecisionWindowLink(candidate,issue)));
  let core=false,topics=false;
  for(const issue of issues){
    if(fixedDecisionLinks.has(issue))continue;
    if(topicSpecificIssue(issue,candidate))topics=true;
    else core=true;
  }
  if(!issues.length)core=true;
  return {core,topics};
}
