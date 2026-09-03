import { TOPICS } from "./integratedInterpretationV2.ts";

function issuesOf(report:any){
  return (Array.isArray(report?.stages)?report.stages:[]).flatMap((stage:any)=>(Array.isArray(stage?.issues)?stage.issues:[]).map((issue:any)=>String(issue??""))).filter(Boolean);
}

function topicSpecificIssue(issue:string,candidate:any){
  if(/^topic_analysis\./.test(issue))return true;
  if(TOPICS.some(topic=>issue.startsWith(`${topic} 확신도 `)||issue.startsWith(`${topic} 핵심인데 `)||issue.startsWith(`${topic} 핵심 근거 설명이 얕음`)||issue.startsWith(`${topic} 주목 근거 설명이 얕음`)||issue.startsWith(`${topic} 참고 설명이 과도하게 김`)))return true;
  const ref=issue.match(/^존재하지 않는 근거 ID:\s*(.+)$/)?.[1]?.trim();
  if(ref&&Object.values(candidate?.topic_analysis??{}).some((row:any)=>Array.isArray(row?.evidence_refs)&&row.evidence_refs.map(String).includes(ref)))return true;
  const date=issue.match(/^계산근거에서 찾을 수 없는 날짜 언급:\s*(\d{4}-\d{2}-\d{2})$/)?.[1];
  if(date&&JSON.stringify(candidate?.topic_analysis??{}).includes(date))return true;
  return false;
}

export function classifyQualityRepair(report:any,candidate:any){
  const issues=issuesOf(report);
  let core=false,topics=false;
  for(const issue of issues){
    if(topicSpecificIssue(issue,candidate))topics=true;
    else core=true;
  }
  if(!issues.length)core=true;
  return {core,topics};
}
