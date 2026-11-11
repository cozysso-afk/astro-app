import type {IntegratedApiResponse} from '../appTypes'

export function monthlyTopicPhases(calculation:Pick<IntegratedApiResponse, 'period' | 'western'>,topic:string) {
  const {start,end}=calculation.period
  const dates=new Map<string,number>()
  for(const row of calculation.western.daily_scores??[]){
    const score=row.scores?.[topic]
    if(row.date>=start && row.date<=end && /^\d{4}-\d{2}-\d{2}$/.test(row.date) &&
       new Date(row.date+'T00:00:00Z').toJSON()?.slice(0,10)===row.date && typeof score==='number' && Number.isFinite(score)) dates.set(row.date,score)
  }
  const parts=['초순','중순','하순'].map((label,index)=>{
    const scores=[...dates].filter(([date])=>Math.min(2,Math.floor((Number(date.slice(-2))-1)/10))===index)
    const average=scores.length?Math.round(scores.reduce((sum,[,score])=>sum+score,0)/scores.length):0
    return {label,average,count:scores.length}
  })
  if(parts.some(part=>part.count<3)) return
  const values=parts.map(part=>part.average)
  const high=Math.max(...values),low=Math.min(...values)
  const leaders=parts.filter(part=>part.average===high)
  const spread=high-low
  const scores=parts.map(part=>`${part.label} ${part.average}점`).join(', ')
  const expected=(Date.parse(end)-Date.parse(start))/86400000+1
  const sample=dates.size===expected?'저장된 날짜별':`선택 기간 중 계산된 ${dates.size}일의`
  const summary=`${sample} ${topic} 점수를 나눠 보면 ${scores}이야.`
  let comparison='세 구간의 평균이 같아. 이 자료에서 특별히 더 두드러지는 시기를 고르기는 어려워.'
  if(leaders.length===1) comparison=`세 구간 중 ${leaders[0].label}에 이 지표가 가장 높아.`
  if(leaders.length===2) comparison=`${leaders.map(part=>part.label).join('과 ')}의 평균이 같아서 두 구간이 함께 가장 높아.`
  return {topic,parts,spread,scores,sample,leader:leaders.length===1?leaders[0].label:undefined,summary,comparison}
}
