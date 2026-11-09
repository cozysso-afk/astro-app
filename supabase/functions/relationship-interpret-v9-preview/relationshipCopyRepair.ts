import { technical, unobservedMind } from './relationshipEditorialV1.ts'
import { hasUnsupportedInitiativeDirection } from './reunionGroundingV2.ts'

type Target = { id: string; path: string[]; previous: string; issues: string[] }

// Paths come exclusively from the first model response. The next call can only
// replace those prose fields, never IDs, scores, timing windows or observations.
export function planRelationshipCopyRepair(draft:any,payload:any,purpose:string) {
  const targets: Target[] = []
  function visit(value:any,path:string[]) {
    if (typeof value === 'string') {
      const key = path.join('.')
      const issues = []
      if (['headline','core_summary'].includes(key) && technical.test(value)) issues.push('전문 용어를 생활 언어로 풀이')
      if (key === 'core_reason' && technical.test(value.split(/[.!?。]/)[0])) issues.push('첫 문장은 전문 용어 없이 판단 이유만 설명')
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
  if (!targets.length || targets.length>24) return null
  const schema = {type:'OBJECT',properties:Object.fromEntries(targets.map(t=>[t.id,{type:'STRING'}])),required:targets.map(t=>t.id)}
  return {draft,targets,schema}
}

export function applyRelationshipCopyRepair(plan:NonNullable<ReturnType<typeof planRelationshipCopyRepair>>, reply:any) {
  if (!reply || typeof reply !== 'object' || Object.keys(reply).length!==plan.targets.length) throw new Error('invalid repair')
  const patched = structuredClone(plan.draft)
  for (const {id,path} of plan.targets) {
    if (!Object.hasOwn(reply,id) || typeof reply[id] !== 'string' || !reply[id].trim()) throw new Error('missing repair field')
    const parent = path.slice(0,-1).reduce((obj,key)=>obj[key],patched)
    parent[path[path.length-1]] = reply[id]
  }
  return patched
}
