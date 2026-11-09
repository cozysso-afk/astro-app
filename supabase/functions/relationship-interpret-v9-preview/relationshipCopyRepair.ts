import { unsupportedSajuTerm, copyTypo, reportStyle, hasCondition, hasInventedDuration, technical, unobservedMind } from './relationshipEditorialV1.ts'
import { hasUnsupportedInitiativeDirection } from './reunionGroundingV2.ts'

type Target = { id: string; path: string[]; previous: string | string[]; issues: string[]; evidence?: {id:string;facts:unknown}[] }

// Paths come exclusively from the first model response. The next call can only
// replace listed prose or choose references from the existing question evidence.
export function planRelationshipCopyRepair(draft:any,payload:any,purpose:string) {
  const targets: Target[] = []
  const source=JSON.stringify(payload)
  function visit(value:any,path:string[]) {
    if (typeof value === 'string') {
      const key = path.join('.')
      const issues = []
      if (['headline','core_summary'].includes(key) && technical.test(value)) issues.push('전문 용어를 생활 언어로 풀이')
      if (key === 'core_reason' && technical.test(value.split(/[.!?。]/)[0])) issues.push('첫 문장은 전문 용어 없이 판단 이유만 설명')
      if (key === 'reunion_synthesis_v2.summary' && value.trim().length < 120) issues.push('120자 이상으로 입력된 관계 상태와 연락·만남·재구축 중 확인할 다음 단계를 구체적으로 설명')
      if (path[0] === 'core_conditions' && !hasCondition(value)) issues.push('행동 지시 대신, 기존 근거에서 판단이 달라지는 조건을 ~하면 또는 ~할 때로 설명')
      const term = unsupportedSajuTerm(value,source)
      if (term) issues.push(`계산에서 제공하지 않은 사주 근거 ${term}을 제거하고 확인된 근거만 설명`)
      if (hasInventedDuration(value)) issues.push('근거 없는 대기 시간·행동 기간을 삭제')
      if (reportStyle.test(value)) issues.push('내용은 유지하고 보고서체 종결을 자연스러운 반말로 바꿔')
      if (copyTypo.test(value)) issues.push('잘못된 한국어 표현을 바로잡아')
      if (unobservedMind.test(value)) issues.push('현재 속마음이나 의지를 단정하지 말고 확인 가능한 조건을 설명')
      if (purpose === 'reunion' && !payload?.reunion_evidence_v2?.initiative_gate?.available &&
          hasUnsupportedInitiativeDirection(value,payload?.reunion_observation)) issues.push('미래 선연락 주체는 알 수 없다고 설명')
      if (issues.length) targets.push({id:'field_'+targets.length,path,previous:value,issues})
    } else if (value && typeof value === 'object') {
      for (const [key,child] of Object.entries(value)) {
        if (['evidence_refs','period','mode','__proto__','constructor','prototype'].includes(key)) continue
        visit(child,[...path,key])
      }
    }
  }
  visit(draft,[])
  if (purpose === 'reunion') {
    const matrix = payload?.reunion_evidence_v2
    for (const question of ['why_reconnect','initiative','timing','rebuild','repeat_risks']) {
      const section=draft.reunion_synthesis_v2?.[question]
      if (!section) continue
      const ids: string[] = matrix?.questions?.[question]?.evidence_refs ?? []
      const evidence=(matrix?.evidence ?? []).filter((row:any)=>ids.includes(row.id)).map((row:any)=>({id:row.id,facts:row.facts ?? row.aspect ?? row.layer}))
      if (!evidence.length) continue
      const refs=section.evidence_refs
      if (Array.isArray(refs) && refs.length && refs.every(id=>evidence.some((row:any)=>row.id===id))) continue
      const path=['reunion_synthesis_v2',question,'evidence_refs']
      targets.push({id:'field_'+targets.length,path,previous:Array.isArray(refs)?refs:[],evidence,
        issues:[`이 질문의 실제 근거 중 원고를 뒷받침하는 ID만 선택해. 원고: ${section.conclusion ?? ''}`]})
      // If the prose did not follow from the available references, allow the
      // author to correct that claim in the same call, without changing dates.
      for (const key of ['conclusion','interpretation']) {
        const textPath=['reunion_synthesis_v2',question,key]
        if (typeof section[key]==='string' && !targets.some(t=>t.path.join('.')===textPath.join('.'))) {
          targets.push({id:'field_'+targets.length,path:textPath,previous:section[key],
            issues:[`새로 선택한 ${question}의 실제 근거에 맞춰 판단과 한계를 설명`]})
        }
      }
    }
  }
  if (!targets.length || targets.length>24) return null
  const schema = {type:'OBJECT',properties:Object.fromEntries(targets.map(t=>[t.id,t.evidence ? {type:'ARRAY',items:{type:'STRING',enum:t.evidence.map(e=>e.id)},minItems:1,maxItems:Math.min(4,t.evidence.length)} : {type:'STRING'}])),required:targets.map(t=>t.id)}
  return {draft,targets,schema}
}

export function applyRelationshipCopyRepair(plan:NonNullable<ReturnType<typeof planRelationshipCopyRepair>>, reply:any) {
  if (!reply || typeof reply !== 'object' || Object.keys(reply).length!==plan.targets.length) throw new Error('invalid repair')
  const patched = structuredClone(plan.draft)
  for (const {id,path,evidence} of plan.targets) {
    if (!Object.hasOwn(reply,id)) throw new Error('missing repair field')
    if (evidence) {
      if (!Array.isArray(reply[id]) || !reply[id].length || !reply[id].every((ref:unknown)=>evidence.some(row=>row.id===ref))) throw new Error('invalid citation')
    } else if (typeof reply[id] !== 'string' || !reply[id].trim()) throw new Error('missing repair text')
    const parent = path.slice(0,-1).reduce((obj,key)=>obj[key],patched)
    parent[path[path.length-1]] = reply[id]
  }
  return patched
}
