import type { PeriodKey, RelationshipAnalysisMode } from '../appTypes'

const PERIOD_COST: Record<PeriodKey,{typical:number;retry:number}> = {
  today:{typical:40,retry:75},
  week:{typical:40,retry:80},
  month:{typical:55,retry:90},
  year:{typical:70,retry:120},
}

export function periodAiCostPreview(period: PeriodKey) {
  const cost = PERIOD_COST[period]
  return `호출 전 예상 · 보통 약 ${cost.typical}원 · 재시도까지 가면 약 ${cost.retry}원 · 작업 안전 상한 300원 · 저장본 재열람 0원`
}

export function relationshipAiCostPreview(_mode: RelationshipAnalysisMode) {
  return '호출 전 예상 · 보통 약 100~130원 · 재시도까지 가면 약 230원 · 작업 안전 상한 300원 · 저장본 재열람 0원'
}
