import {datedAspectReading} from './fortuneUserSummary.ts'
import type {IntegratedApiResponse} from '../appTypes'
import type {AuthoredReadingDocument,AuthoredSection} from './authoredReadingDocument'
import {contactDirectionComparison} from './contactDirectionReading.ts'
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

export function monthlyTopicPhases(calculation:IntegratedApiResponse,topic:string) {
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
  return {topic,spread,scores,sample,leader:leaders.length===1?leaders[0].label:undefined,summary,comparison}
}

function timingTopic(section:AuthoredSection) {
  if(section.state!=='insufficient') return
  const [prefix,topic,question]=section.id.split(':')
  if(prefix==='question' && (question==='timing'||(topic==='직장' && question==='change_timing'))) return topic
}

export function monthlyReadingCore(doc:AuthoredReadingDocument,calculation:IntegratedApiResponse,field?:FortuneField):AuthoredReadingDocument {
  const {start,end}=calculation.period
  if(doc.state==='unverified' || doc.date!==`${start} → ${end}` || start.slice(0,7)!==end.slice(0,7) || start>=end) return doc
  const topics=field?.topics ?? ['연애','대인관계','학업','직장','금전','컨디션']
  const sections=doc.sections??[]
  const timingTopics=sections.map(timingTopic).filter((topic):topic is string=>Boolean(topic))
  const profiles=new Map([...new Set([...topics,...timingTopics])].filter(topic=>meaning[topic]).map(topic=>[topic,monthlyTopicPhases(calculation,topic)]))
  const describe=(phase:NonNullable<ReturnType<typeof monthlyTopicPhases>>)=>[phase.summary,phase.comparison,phase.spread>0?meaning[phase.topic]:''].filter(Boolean).join(' ')
  const showDirection=Boolean(field?.topics.includes('연락'))
  const direction=(showDirection || sections.some(section=>section.id==='question:연락:activation_direction' && section.state==='insufficient'))
    ? contactDirectionComparison(calculation,true) : ''
  const timingSections=sections.map(section=>{
    if(direction && section.id==='question:연락:activation_direction' && section.state==='insufficient') {
      return {...section,state:'ready' as const,label:section.label+' · 부분 해설',
        blocks:[{id:'month:contact-direction',label:'받는 연락과 먼저 거는 연락',text:direction}]}
    }
    const topic=timingTopic(section)
    const phase=topic ? profiles.get(topic) : undefined
    if(!phase) return section
    return {...section,state:'ready' as const,label:section.label+' · 부분 해설',blocks:[{id:section.id+':calculation',label:'월간 계산값으로 보면',text:describe(phase)}]}
  })
  const candidates=topics.flatMap(topic=>profiles.get(topic)??[]).sort((a,b)=>b.spread-a.spread)
  const picked=candidates[0]
  const dated=datedAspectReading(calculation,'month',field?.topics ?? (picked ? [picked.topic] : undefined))
  if(!picked && !dated && !direction && timingSections.every((s,i)=>s===sections[i])) return doc
  const core=[...doc.core]
  if(picked) core.splice(Math.min(1,core.length),0,{id:'month:segments:'+picked.topic,label:`${picked.topic} · 초순부터 하순까지`,text:describe(picked)})
  if(dated) core.push(dated)
  if(showDirection && direction) core.push({id:'month:contact-direction',label:'받는 연락과 먼저 거는 연락',text:direction})
  let revision=2166136261
  for(const char of JSON.stringify([dated,direction,...profiles.values()])) revision=Math.imul(revision^char.charCodeAt(0),16777619)
  return {...doc,core,sections:timingSections,revision:doc.revision+'|month:'+revision.toString(16),exportBlockIds:doc.exportBlockIds.length?core.map(b=>b.id):[]}
}
