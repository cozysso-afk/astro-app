// Each axis is computed independently for the selected period. A broad contact
// or romance observation is not a measurement of who initiated an actual event.
export const CONTACT_AXES = {
  incoming:'수신신호', outgoing:'발신적합', reconnection:'과거인연접점',
} as const

export function contactAxisEvidence(payload:any) {
  const result:Record<string,{topic:string;refs:string[]}>={}
  const ledger=Array.isArray(payload?.evidence_ledger)?payload.evidence_ledger:[]
  const {start,end}=payload?.period??{}
  for(const [key,topic] of Object.entries(CONTACT_AXES)) {
    const refs=ledger.filter((row:any)=>row?.system==='western' && row.topic===topic &&
      row.scope==='relationship_average' && Number.isFinite(row.score) &&
      (row.start===start && row.end===end) && Boolean(start&&end&&row.id)).map((row:any)=>row.id)
    result[key]={topic,refs}
  }
  return result
}

export function contactEvidenceIssues(core:any,payload:any) {
  const issues:Array<{code:string;path:string}>=[]
  for(const [key,axis] of Object.entries(contactAxisEvidence(payload))) {
    const refs=core?.contact_evidence_refs?.[key]
    const written=typeof core?.contact_flow?.[key]==='string' && core.contact_flow[key].trim().length>0
    if(written && (!Array.isArray(refs) || !refs.length || refs.some((id:string)=>!axis.refs.includes(id)))) {
      issues.push({code:'contact_axis_without_own_period_evidence',path:'contact_flow.'+key})
    } else if (!written && Array.isArray(refs) && refs.length) {
      issues.push({code:'empty_contact_axis_with_references',path:'contact_flow.'+key})
    }
  }
  return issues
}
