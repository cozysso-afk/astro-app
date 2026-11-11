import type {FortuneStat, IntegratedApiResponse} from '../appTypes'
import type {AuthoredReadingDocument} from './authoredReadingDocument'

export type MonthSupplement = {id:string; label:string; text:string; evidence:string}
const questions: Record<string,[string,string,string,string]> = {
  'relationship.love_single':['연애','새로운 만남을 넓힐 힘은 작은 편이야. 소개를 받는다면 한 번의 인상으로 결론 내리지 말고 편하게 이야기한 주제 하나를 기억해 둬.','이달에 처음 본 사람 중에 다시 얘기해 보고 싶은 얼굴이 있는지 떠올려 봐. 호감이 생겼던 자리가 조용한 소개 자리였는지, 함께 뭔가를 하던 자리였는지 알면 어디에 시간을 쓸지 고르기 쉬워.','새로운 만남에 시간을 써 볼 만한 달이야. 가능하다면 한 번에 첫인상을 결정해야 하는 소개와 같은 사람들을 여러 번 보는 모임 중 네가 더 편한 쪽을 골라 봐.'],
  'relationship.love_crush':['연애','호감이 오가는지 읽기 어려울 수 있어. 내가 먼저 말을 건 날과 상대도 먼저 질문한 날을 구분해 보면 일방적으로 애쓰고 있는지 알기 쉬워.','마음에 둔 사람과 오간 대화를 한 달 단위로 돌아봐. 늘 네가 먼저 이야기를 살려야 했는지, 상대도 전에 들은 일을 기억했다가 다시 물었는지 보면 친절과 지속적인 관심을 성급하게 혼동하지 않게 돼.','마음을 표현해 보고 싶은 달이야. 좋아했던 장면을 하나 짚어 말하고, 상대도 둘이 시간을 보내고 싶어 하는지 들어 봐.'],
  'relationship.love_flirting':['연애','관계의 속도를 올리는 데 힘이 덜 붙는 편이야. 다음 약속을 한쪽만 계속 제안하는지, 상대도 가능한 날짜를 보태는지 봐.','대화가 즐거웠다면 작게라도 다음 약속을 정해 봐. 둘이 실제로 시간을 맞추는 과정에서 관심의 속도를 가늠할 수 있어.','서로 시간을 내는 과정이 가벼워질 수 있는 달이야. 즉흥적으로만 보던 두 사람이 먼저 서로의 일정을 묻기 시작했다면 관계를 생활 속에 들이는 변화로 읽을 수 있어.'],
  'relationship.love_ambiguous':['연애','만남이 이어져도 관계를 정할 계기는 약할 수 있어. 네가 기대하는 만남의 빈도와 관계의 범위를 먼저 말하고 상대가 원하는 것도 들어 봐.','만나는 방식에 같은 기대를 두고 있는지 물어봐. 다음 만남에서도 말한 내용과 실제 행동이 맞는지 확인해 봐.','관계를 어떻게 이어갈지 이야기할 여지가 있어. 둘만 만나는 관계를 원하는지처럼 중요한 기대 한 가지를 꺼내 봐.'],
  'relationship.love_couple':['연애','서운함이 자연스럽게 풀리길 오래 기다리기보다, 기억에 남은 상황과 다음에 바라는 행동 하나를 함께 이야기해 봐.','한 달 동안 되풀이된 작은 서운함이 있다면 한 장면을 골라 이야기해 봐. 바쁠 때 소식이 끊긴 게 아쉬웠다면 어떤 말 한마디가 마음을 놓이게 하는지 알려 줘. 이후 비슷한 날에 서로 편해졌는지가 기준이야.','평소 서로 챙겨주던 일을 말로 알아주기 좋은 달이야. 한쪽이 늘 먼저 챙기는 일이 있다면 이달엔 다른 쪽이 한번 맡아 봐. 둘이 누리는 편안함을 어떻게 함께 만드는지도 보일 거야.'],
  'relationship.contact_activation':['연락','연락이 활발하게 오갈 것으로 읽을 근거는 약해. 필요한 답이 있다면 묻고 싶은 내용을 하나로 좁혀 봐.','연락이 늘거나 뜸해질 쪽으로 강하게 기울지 않아. 연락할 이유와 실제 답이 오가는지 함께 살펴봐.','연락이 오가는 상황에 주목할 만해. 누가 먼저 시작할지는 실제 메시지가 오간 뒤에 확인할 수 있어.'],
  'relationship.contact_continuity':['연락','전체 연락 지표가 낮아도 이미 시작한 대화가 끝난다고 볼 수는 없어. 상대도 질문을 돌려주거나 다음에 할 이야기를 보태는지 확인해 봐.','연락 횟수만으로 대화가 이어질지는 읽기 어려워. 질문과 답이 양쪽에서 오가고 다음 약속을 함께 정하는지 봐.','연락 지표가 높아도 한 번의 안부가 지속적인 대화를 보장하지 않아. 다음 대화도 양쪽에서 시작하는지 살펴봐.'],
  'relationship.love_reunion_interest':['재회','한 달의 재회 지표가 약하면 한두 번 접점이 생겨도 관계가 회복되는 흐름으로 넓혀 읽기 어려워. 이미 만났다면 이후 예전에 멀어졌던 문제를 둘이 이야기했는지 돌아봐. 같은 상황이 왔을 때 무엇을 바꾸기로 했는지가 다시 만나기 시작했다는 판단에 더 가까운 근거야.','과거 인연과의 관계는 아직 한쪽으로 기울여 읽기 어려워. 연락이 닿은 일과 다시 교제하자는 합의는 구분해서 봐.','과거 인연을 다시 생각해 볼 여지가 있는 달이야. 연락이 닿았다면 이전의 문제가 달라졌는지, 둘 다 관계를 다시 시작하고 싶은지 이야기해 봐.'],
}
const isoDate = (value:string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value+'T00:00:00Z').toJSON()?.slice(0,10)===value
function evidence(topic:string, stat:FortuneStat, start:string, end:string) {
  const days = [stat.best_days,stat.caution_days].map(points =>
    points?.find(point => isoDate(point.date) && point.date>=start && point.date<=end && Number.isFinite(point.score)))
  const samples = [...new Map(days.filter(point=>point!==undefined).map(point=>[point.date,point])).values()]
  return [`월간 ${topic} 평균 ${stat.average}점 · ${stat.band}`,...samples.map(point=>`${point.date} ${point.score}점`)].join(' / ')
}
function monthTopics(doc:AuthoredReadingDocument, calculation:IntegratedApiResponse) {
  const {start,end} = calculation.period
  if (doc.state==='unverified' || !isoDate(start) || !isoDate(end) || start===end ||
      end<start || start.slice(0,7)!==end.slice(0,7) || doc.date!==`${start} → ${end}`) return
  const month=calculation.western.months?.find(row=>row.start===start && row.end===end)
  return month?.topics ?? calculation.western.overall
}
const topicReadings:Record<string,string> = {
  연애:'만남에서 호감을 표현하는 흐름', 연락:'말을 걸거나 답을 주고받는 흐름', 재회:'과거 인연과 다시 접점이 생기는 흐름',
  대인관계:'다른 사람과 의견을 맞추는 흐름', 학업:'배운 내용을 익히고 적용하는 흐름', 시험:'시험 과제를 수행하는 흐름',
  직장:'일을 나누거나 책임을 맡는 흐름', 이직:'새로운 일자리를 탐색하는 흐름', 금전:'돈의 입출금을 챙기는 흐름',
  소식:'안내와 회신을 확인하는 흐름', 투자심리:'가격 변화에 관심이 쏠리는 흐름', 수익실현:'보유 자산의 정리를 검토하는 흐름',
  신규진입:'새 자산을 검토하는 흐름', 컨디션:'활동과 휴식의 리듬',
}

function scoreTiming(topic:string, stat:FortuneStat, start:string, end:string) {
  const points=[...(stat.best_days??[]),...(stat.caution_days??[])]
    .filter(p=>isoDate(p.date) && p.date>=start && p.date<=end && Number.isFinite(p.score))
    .sort((a,b)=>b.score-a.score || a.date.localeCompare(b.date))
  const date=(value:string)=>`${Number(value.slice(5,7))}월 ${Number(value.slice(8))}일`
  const meaning=topicReadings[topic]??topic
  const high=points[0], low=points.at(-1)
  if (!high || !low) return `이달 ${topic} 평균은 ${stat.average}점이야. 날짜별 차이는 확인하기 어려워.`
  if (high.score===low.score && high.date!==low.date) {
    return `${date(high.date)}와 ${date(low.date)} 모두 ${meaning}이 ${high.score}점으로 같아. 두 날짜의 점수만으로 어느 쪽이 더 유리하다고 고르기는 어려워.`
  }
  if (high.score===low.score) {
    const offset=high.score-stat.average
    const relation=offset>0?'높아':offset<0?'낮아':'같아'
    return `${date(high.date)}에 ${meaning}은 ${high.score}점이야. ${offset===0?'월평균과 같아.':`월평균 ${stat.average}점보다 ${Math.abs(offset)}점 ${relation}.`}`
  }
  const early=high.date<low.date?high:low, late=early===high?low:high
  return `${meaning}은 ${date(early.date)}에 ${early.score}점, ${date(late.date)}에 ${late.score}점이야. 이달 평균은 ${stat.average}점이야.`
}

function relationshipContext(id:string, topics:Record<string,FortuneStat|null>, calculation:IntegratedApiResponse) {
  const {start,end}=calculation.period
  const signals=calculation.western.months?.find(row=>row.start===start && row.end===end)?.relationship_signals ?? calculation.western.relationship_signals
  const incoming=signals?.['수신신호'], outgoing=signals?.['발신적합']
  const reunion=signals?.['과거인연접점']??signals?.['과거인연재접점']
  if (id==='relationship.contact_activation' && incoming && outgoing && Number.isFinite(incoming.average) && Number.isFinite(outgoing.average)) {
    return `상대 쪽 연락을 받을 조건은 ${incoming.average}점, 내가 먼저 말을 꺼낼 조건은 ${outgoing.average}점이야. ${incoming.average===outgoing.average?'시작하는 쪽에 차이가 없어.':incoming.average>outgoing.average?'둘 중에는 상대 쪽에서 오는 연락에 조금 더 무게가 실려.':'둘 중에는 먼저 말을 건네는 쪽에 조금 더 무게가 실려.'}`
  }
  if(id==='relationship.love_reunion_interest' && reunion && Number.isFinite(reunion.average)) {
    return `과거 인연과 다시 접점이 생기는 지표는 월평균 ${reunion.average}점이야. 이 값이 말해 주는 범위는 안부나 만남의 계기까지야.`
  }
  if(id==='relationship.love_single' && topics['대인관계']?.band) {
    return `새로운 사람과 어울리는 데 참고할 이달 대인관계 지표는 ‘${topics['대인관계'].band}’이야. 만날 기회가 얼마나 열리는지와 그 자리에서 호감이 생기는지는 따로 살펴봐.`
  }
  if(id==='relationship.love_flirting' && topics['연락']?.band) {
    return `둘 사이의 연락을 살펴보면 이달 연락 지표는 ‘${topics['연락'].band}’, 연애 지표는 ‘${topics['연애']?.band}’이야. 연락의 빈도만으로 만남의 진전을 판단하면 둘의 차이를 놓칠 수 있어.`
  }
  return ''
}
export function monthlyLoveSupplements(doc:AuthoredReadingDocument, calculation:IntegratedApiResponse):MonthSupplement[] {
  if (!['love','overall','contact'].includes(doc.scope)) return []
  const topics=monthTopics(doc,calculation)
  if (!topics) return []
  const {start,end}=calculation.period
  return doc.sections.flatMap(section=>{
    const question=questions[section.id]
    if (section.state!=='missing'||!question) return []
    const [topic,weak,neutral,strong]=question
    const stat=topics?.[topic]
    if (!stat?.band || !Number.isFinite(stat.average)) return []
    const text=/약|낮|이하/.test(stat.band)?weak:/강|높|이상/.test(stat.band)?strong:neutral
    const context=relationshipContext(section.id,topics,calculation) || scoreTiming(topic,stat,start,end)
    return [{id:section.id,label:section.label,text:context+' '+text,evidence:evidence(topic,stat,start,end)}]
  })
}


// These questions share their parent topic's statistic. The action is specific
// to the situation; it is not a separately calculated forecast for that person.
const monthlyActions: Record<string,[string,string]> = {
  'relationship.love_general':['연애','관심을 주고받았던 만남을 떠올려 봐. 다음 만남도 두 사람이 함께 정하는지가 관계의 속도를 읽는 기준이야.'],
  'relationship.summary':['대인관계','사람들과 의견을 맞춰야 할 일정이 있다면 누구와 무엇을 정할지 먼저 적어 봐. 실제 합의가 된 일부터 진행해.'],
  'relationship.friends':['대인관계','친구와 멀어진 것 같다면 마지막 대화에서 미뤄 둔 약속부터 떠올려 봐. 다시 만나고 싶을 때는 가능한 날 하나를 건네 봐.'],
  'relationship.coworkers':['대인관계','동료와 부탁을 주고받을 때는 누가 어디까지 맡는지 한 문장으로 확인해. 같은 말을 서로 다르게 이해한 부분을 일찍 찾을 수 있어.'],
  'relationship.family':['대인관계','가까운 사람의 부탁을 들었을 때는 조언을 원하는지, 그냥 들어주길 원하는지 먼저 물어봐. 익숙한 사이에서도 필요한 도움이 다를 수 있어.'],
  'relationship.new_people':['대인관계','새 모임에서는 기억에 남은 공통 관심사를 다음 대화의 시작점으로 써 봐. 한 번 인사가 오간 것과 관계가 이어지는 건 따로 봐.'],
  'relationship.boundaries':['대인관계','반복되는 부탁이 부담스럽다면 가능한 시간과 맡을 수 있는 범위를 구체적으로 알려 줘. 그 뒤에도 같은 요구가 반복되는지 봐.'],
  'money_news.news':['소식','발표나 안내를 기다린다면 공식 게시 일정과 수신 경로를 확인해. 점수가 달라지는 날이 실제 발표일을 정해 주지는 않아.'],
  'work_study.study':['학업','공부한 내용을 책을 덮고 설명해 봐. 설명이 멈추는 지점을 다음 공부 시간에 다시 다루면 복습할 범위를 좁힐 수 있어.'],
  'work_study.exam':['시험','실전 시간에 맞춰 문제 한 세트를 풀고, 개념을 몰라서 틀린 문제와 시간을 놓친 문제를 나눠 봐. 실제 시험일과 합격 여부는 이 지표로 정할 수 없어.'],
  'work_study.work':['직장','여러 요청이 겹칠 때는 먼저 끝내야 하는 일의 담당자와 기한을 맞춰 봐. 주고받은 합의를 기록하면 다시 작업하는 시간을 줄일 수 있어.'],
  'work_study.career_change':['이직','관심 있는 공고의 실제 마감일, 맡게 될 일, 지원 조건을 확인해. 면접 연락이나 합격 여부는 채용처가 알려 준 내용으로 판단해.'],
  'money_news.money':['금전','이번 달 확정된 수입과 빠져나갈 고정비를 먼저 적어 봐. 결제일 전에 남는 금액을 확인하면 미뤄도 되는 지출을 고르기 쉬워.'],
  'investment.psychology':['투자심리','가격이 움직인 날에는 처음 적어 둔 판단 근거가 달라졌는지 살펴봐. 기대나 불안만 달라졌다면 그 변화를 따로 기록해.'],
  'investment.realization':['수익실현','보유한 자산의 정리 조건을 미리 정했다면 현재 가격·비용·비중을 그 조건과 비교해. 이 점수는 매도 시점이나 예상 수익률을 제시하지 않아.'],
  'investment.entry':['신규진입','새로 관심을 둔 자산은 진입을 고려한 이유와 그 이유가 틀렸다고 판단할 조건을 함께 적어 봐. 점수가 높은 날도 매수 신호로 읽을 수 없어.'],
  'condition.condition':['컨디션','피로가 쌓인 날 전후에 수면과 일정이 어떻게 달랐는지 살펴봐. 회복 시간을 어디에 넣을 수 있는지 정하는 데 참고해.'],
}

export function monthlyPeriodSupplements(doc:AuthoredReadingDocument, calculation:IntegratedApiResponse):MonthSupplement[] {
  const topics=monthTopics(doc,calculation)
  if (!topics) return []
  const love=monthlyLoveSupplements(doc,calculation)
  const {start,end}=calculation.period
  const other=doc.sections.flatMap(section=>{
    const action=monthlyActions[section.id]
    if (!action || section.state!=='missing') return []
    const [topic,advice]=action
    const stat=topics[topic]
    if (!stat?.band || !Number.isFinite(stat.average)) return []
    const timing=scoreTiming(topic,stat,start,end)
    return [{id:section.id,label:section.label,text:timing+' '+advice,evidence:evidence(topic,stat,start,end)}]
  })
  return [...love,...other]
}
