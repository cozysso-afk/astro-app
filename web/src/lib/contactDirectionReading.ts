import type {IntegratedApiResponse} from '../appTypes'

export function periodContactSignals(calculation:IntegratedApiResponse, monthly:boolean) {
  const {start,end}=calculation.period
  if(monthly) {
    const month=calculation.western.months?.find(row=>row.start===start && row.end===end)
    if(month?.relationship_signals) return month.relationship_signals
  }
  return calculation.western.relationship_signals
}

export function contactDirectionComparison(calculation:IntegratedApiResponse, monthly:boolean) {
  const signals=periodContactSignals(calculation,monthly)
  const incoming=signals?.수신신호?.average, outgoing=signals?.발신적합?.average
  if(typeof incoming!=='number' || typeof outgoing!=='number' || !Number.isFinite(incoming) || !Number.isFinite(outgoing)) return ''
  const frame=monthly?'이달 평균':'이날'
  const intro=`${frame} 연락을 받을 조건은 ${incoming}점, 내가 먼저 말을 꺼낼 조건은 ${outgoing}점이야.`
  if(incoming===outgoing) return intro+' 두 값이 같아서 어느 쪽이 더 두드러지는지 가릴 수 없어.'
  const difference=Number(Math.abs(incoming-outgoing).toFixed(6))
  const higher=incoming>outgoing?'연락을 받는 쪽':'내가 먼저 말을 건네는 쪽'
  return `${intro} ${higher}이 ${difference}점 높아. 실제로 누가 먼저 연락했는지는 그날 주고받은 연락에서 확인할 수 있어.`
}
