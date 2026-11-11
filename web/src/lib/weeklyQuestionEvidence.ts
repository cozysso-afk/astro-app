import type { FortuneStat, IntegratedApiResponse } from '../appTypes'
import type { AuthoredReadingDocument, AuthoredSection } from './authoredReadingDocument'

export const weeklyEvidenceLimit = '주간 지표로 비교할 수 있는 날짜와 연락 방향은 상세 해설에 표시했어. 아래 질문은 그 질문에 직접 연결되는 자료가 부족해. 실제 회신·합격·정산이나 두 사람의 관계 변화는 별도의 기록이 필요해.'

const timingMeaning:Record<string,string> = {
  직장:'업무를 둘러싼 흐름의 차이로 읽을 수 있어. 실제 보직이나 책임 범위가 바뀌는 날까지 정할 수는 없어.',
  이직:'지원이나 조건 비교처럼 이미 진행 중인 일이 있다면 살펴볼 날짜야. 면담이나 제안이 들어오는 날을 뜻하지는 않아.',
  학업:'공부 계획을 돌아볼 때 참고할 차이야. 그날 배운 내용이 실제로 남았는지는 책을 덮고 다시 설명해 보면 확인할 수 있어.',
  시험:'시험 준비와 관련된 활동이 두드러지는 정도를 비교한 값이야. 실제 시험일의 성적이나 실수 횟수를 나타내지는 않아.',
  금전:'돈과 관련한 일을 의식하기 쉬운 때로 읽어. 정산을 기다린다면 실제 입금일은 약정이나 거래 내역에서 확인해야 해.',
  소식:'소식을 확인하거나 답을 기다리는 일이 있다면 참고할 차이야. 공식 발표일은 안내된 일정에서 확인해야 해.',
  연애:'호감이나 만남이라는 주제가 어느 날 더 두드러지는지를 보여줘. 두 사람이 만날 날짜는 실제로 약속을 잡았을 때 알 수 있어.',
  연락:'연락이라는 주제가 두드러지는 정도를 비교한 값이야. 누가 먼저 메시지를 보낼지, 답이 언제 올지는 이 날짜만으로 정할 수 없어.',
  컨디션:'일정을 소화하는 생활 리듬을 돌아볼 때 참고할 차이야. 실제 피로나 회복 정도는 그날의 수면과 활동 기록을 함께 봐야 해.',
}

export function weeklyTimingValues(topic:string, calc:IntegratedApiResponse):string {
  const scores=new Map<string,number>()
  const add=(date:string,value:unknown)=>{
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && date>=calc.period.start && date<=calc.period.end && typeof value==='number' && Number.isFinite(value) && !scores.has(date)) scores.set(date,value)
  }
  for(const row of calc.western.daily_scores??[]) add(row.date,row.scores?.[topic])
  const stat=calc.western.overall?.[topic]
  for(const point of [...(stat?.best_days??[]),...(stat?.caution_days??[])]) add(point.date,point.score)
  const ranked=[...scores].sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0]))
  const high=ranked[0],low=ranked.at(-1)
  if (!high || !low || high[1]===low[1] || !timingMeaning[topic]) return ''
  const day=(date:string)=>Number(date.slice(5,7))+'월 '+Number(date.slice(8))+'일'
  const datesFor=(score:number)=>ranked.filter(row=>row[1]===score).map(row=>day(row[0])).join('·')
  return `${datesFor(high[1])}에 ${high[1]}점, ${datesFor(low[1])}에 ${low[1]}점`
}

function scoreLabel(stat?:FortuneStat|null) {
  return stat && Number.isFinite(stat.average) && stat.band?.trim() ? `${stat.average}점(${stat.band})` : ''
}

export function weeklyQuestionSections(doc:AuthoredReadingDocument, calc:IntegratedApiResponse):AuthoredSection[] {
  const {start,end,day_count}=calc.period
  if (doc.state==='unverified' || day_count!==7 || Date.parse(end)-Date.parse(start)!==6*86400000 ||
      doc.date!==`${start} → ${end}`) return doc.sections
  return doc.sections.map(section=>{
    if (section.state!=='insufficient' || !section.id.startsWith('question:')) return section
    const [,topic,question]=section.id.split(':')
    const signals=calc.western.relationship_signals
    let answer=''
    if (question==='timing' || (topic==='직장' && question==='change_timing')) {
      const values=weeklyTimingValues(topic,calc)
      if (values) answer=`이번 주 ${topic} 지표는 ${values}이야. ${timingMeaning[topic]}`
    } else if (topic==='연락' && question==='activation_direction') {
      const incoming=scoreLabel(signals?.수신신호),outgoing=scoreLabel(signals?.발신적합)
      if (incoming && outgoing) {
        const a=signals.수신신호!.average,b=signals.발신적합!.average
        const interpretation = a===b?'두 방향의 주간 점수가 같아.':a>b?'둘을 비교하면 이번 주에는 바깥에서 연락을 받을 조건이 더 두드러져.':'둘을 비교하면 이번 주에는 내가 말을 꺼낼 조건이 더 두드러져.'
        answer=`외부에서 연락을 받을 조건은 ${incoming}, 내가 먼저 연락할 조건은 ${outgoing}이야. ${interpretation} 실제 첫 연락을 어느 쪽이 했는지는 연락 기록에서 확인할 수 있어.`
      }
    } else if(topic==='재회' && question==='contact_meeting'){
      const signal=scoreLabel(signals?.과거인연접점??signals?.과거인연재접점)
      if (signal) answer=`이번 주 과거 인연과의 재접점 지표는 ${signal}이야. 예전 인연과 다시 연결될 조건을 본 값이야. 실제로 연락이 닿았는지, 만남까지 이어졌는지는 각각 따로 확인해야 해.`
    }
    if (!answer) return section
    return {...section,state:'ready',label:section.label+' · 부분 해설',blocks:[{id:section.id+':calculation',label:'주간 계산값으로 보면',text:answer}]}
  })
}
