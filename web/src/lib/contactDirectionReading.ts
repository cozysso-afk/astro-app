import type {IntegratedApiResponse} from '../appTypes'

export function periodContactSignals(calculation:IntegratedApiResponse, monthly:boolean) {
  const {start,end}=calculation.period
  if(monthly) {
    const month=calculation.western.months?.find(row=>row.start===start && row.end===end)
    if(month?.relationship_signals) return month.relationship_signals
  }
  return calculation.western.relationship_signals
}

// The two directions answer different questions even if the aggregate is high.
export function contactDirectionApplication(incoming?:string,outgoing?:string) {
  const weak=(band?:string)=>/약|낮/.test(band ?? '')
  const strong=(band?:string)=>/강|높|보통 이상/.test(band ?? '')
  if(weak(incoming) && strong(outgoing)) return '먼저 전할 용건이 있다면 질문 하나로 말을 꺼내 봐. 내가 연락하기 괜찮다는 말이 상대에게서 연락이 온다는 뜻은 아니야.'
  if(strong(incoming) && weak(outgoing)) return '기다리던 답이 오면 그 내용에 맞춰 대화를 이어가 봐. 이미 질문을 보냈다면 답이 늦다는 이유로 같은 질문을 거듭 보낼 필요는 없어.'
  return ''
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
  const application=contactDirectionApplication(signals?.수신신호?.band,signals?.발신적합?.band)
  return [`${intro} ${higher}이 ${difference}점 높아.`,application,'실제로 누가 먼저 연락했는지는 그날 주고받은 연락에서 확인할 수 있어.'].filter(Boolean).join(' ')
}
