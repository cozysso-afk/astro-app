import type {IntegratedApiResponse} from '../appTypes'
import type {AuthoredReadingDocument} from './authoredReadingDocument'
import type {FortuneField} from './fortuneFields'

// Each sentence describes the topic's strongest segment within the selected
// month. A higher score does not identify another person's intention or an event.
const meaning:Record<string,string>={
  연애:'호감이 오간 만남을 돌아보면 좋아. 대화가 즐거웠던 날과 서로 다음 약속까지 잡은 날을 나누면 관계가 실제로 어디까지 왔는지 보여.',
  연락:'주고받은 연락을 살펴봐. 기다리던 답이 온 날과 내가 먼저 안부를 건넨 날을 나누면 무엇이 대화를 시작하게 했는지 볼 수 있어.',
  재회:'과거 인연과 다시 닿을 계기를 살펴볼 때야. 연락이 있었다면 한 번의 안부로 끝났는지, 다음 약속도 함께 정했는지 구분해 봐.',
  대인관계:'사람들과 일정을 맞추거나 부탁을 주고받는 일이 중심이 될 수 있어. 상대와 합의한 날짜나 각자 맡기로 한 일을 짚어 봐.',
  소식:'기다리는 회신이나 공지가 있다면 예정됐던 채널을 확인해 봐. 실제 발표일은 해당 기관의 일정에서 확인해야 해.',
  학업:'배운 내용을 문제로 옮겨 보는 데 시간을 써 봐. 직접 풀 때 막히는 대목이 다음 복습의 출발점이야.',
  시험:'실전처럼 시간을 재고 풀어 봐. 풀이를 몰라 틀린 문제와 시간이 모자라 놓친 문제는 보완할 방법이 달라.',
  직장:'담당자와 마감이 맞물리는 일을 챙겨 봐. 내 작업이 끝나야 다른 사람이 시작할 수 있는 일부터 기한을 맞추는 게 좋아.',
  이직:'공고와 제안의 조건을 직접 비교해 봐. 업무 범위나 근무지가 내 기준과 맞으면 지원할 이유도 구체적이 돼.',
  금전:'예정된 지출과 실제 입금 날짜를 나란히 살펴봐. 돈이 들어오기 전에 먼저 나가야 하는 비용이 있는지가 이번 달에 확인할 부분이야.',
  투자심리:'가격을 자주 확인했다면 처음 판단한 이유가 달라졌는지 돌아봐. 가격 변동과 새로운 정보를 구분해 적으면 관심이 커진 이유가 보여.',
  수익실현:'보유 자산을 정리할 이유가 생겼다면 처음 세운 조건과 비교해 봐. 이 흐름은 매도 가격이나 수익률을 알려 주지는 않아.',
  신규진입:'새 자산을 검토한다면 무엇을 확인하고 관심이 생겼는지 적어 봐. 지표만으로 매수할 날짜를 정할 수는 없어.',
  컨디션:'일정과 쉬는 시간을 같이 봐. 활동이 몰린 뒤 유독 지쳤다면 다음 일정 사이에 어느 정도 여유가 필요한지 가늠할 수 있어.',
}

export function monthlyReadingCore(doc:AuthoredReadingDocument,calculation:IntegratedApiResponse,field?:FortuneField):AuthoredReadingDocument {
  const {start,end}=calculation.period
  if(doc.state==='unverified' || doc.date!==`${start} → ${end}` || start.slice(0,7)!==end.slice(0,7) || start>=end) return doc
  const topics=field?.topics ?? ['연애','대인관계','학업','직장','금전','컨디션']
  const rows=calculation.western.daily_scores??[]
  const candidates=topics.flatMap(topic=>{
    if(!meaning[topic]) return []
    const dates=new Map<string,number>()
    for(const row of rows){
      const score=row.scores?.[topic]
      if(row.date>=start && row.date<=end && typeof score==='number' && Number.isFinite(score)) dates.set(row.date,score)
    }
    const parts=['초순','중순','하순'].map((label,index)=>{
      const segment=[...dates].filter(([date])=>Math.min(2,Math.floor((Number(date.slice(-2))-1)/10))===index)
      const average=segment.length?Math.round(segment.reduce((sum,[,score])=>sum+score,0)/segment.length):0
      return {label,average,count:segment.length}
    })
    if(parts.some(part=>part.count<3)) return []
    const high=Math.max(...parts.map(p=>p.average)), low=Math.min(...parts.map(p=>p.average))
    return [{topic,parts,spread:high-low,leaders:parts.filter(p=>p.average===high)}]
  }).sort((a,b)=>b.spread-a.spread)
  const picked=candidates[0]
  if(!picked) return doc
  const {topic,parts,leaders}=picked
  const scores=parts.map(p=>`${p.label} ${p.average}점`).join(', ')
  const interpretation=leaders.length===3
    ? '세 구간의 평균이 같아. 이 자료에서 특별히 더 두드러지는 시기를 고르기는 어려워.'
    : `세 구간 중 ${leaders.map(part=>part.label).join('과 ')}에 이 지표가 가장 높아. ${meaning[topic]}`
  const id='month:segments:'+topic
  const text=`저장된 날짜별 ${topic} 점수를 나눠 보면 ${scores}이야. ${interpretation}`
  const core=[...doc.core]
  core.splice(Math.min(1,core.length),0,{id,label:`${topic} · 초순부터 하순까지`,text})
  return {...doc,core,revision:doc.revision+'|month:'+topic+':'+scores,exportBlockIds:doc.exportBlockIds.length?core.map(b=>b.id):[]}
}
