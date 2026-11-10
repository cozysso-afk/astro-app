import type {FortuneStat, IntegratedApiResponse} from '../appTypes'
import type {AuthoredReadingDocument} from './authoredReadingDocument'

export type MonthSupplement = {id:string; label:string; text:string; evidence:string}
const questions: Record<string,[string,string,string,string]> = {
  'relationship.love_single':['연애','새로운 만남을 넓힐 힘은 작은 편이야. 소개를 받는다면 한 번의 인상으로 결론 내리지 말고 편하게 이야기한 주제 하나를 기억해 둬.','소개나 모임에서 대화가 편했다면 그때 함께 즐긴 일로 다음 만남을 제안해 봐.','새로운 만남에 시간을 써 볼 만해. 관심사가 겹치는 사람에게 다시 해 보고 싶은 활동을 제안해 봐.'],
  'relationship.love_crush':['연애','호감이 오가는지 읽기 어려울 수 있어. 내가 먼저 말을 건 날과 상대도 먼저 질문한 날을 구분해 보면 일방적으로 애쓰고 있는지 알기 쉬워.','상대도 네 이야기를 궁금해하는지 봐. 여러 번 만났을 때 질문과 제안이 양쪽에서 나왔는지가 기준이야.','마음을 표현해 보고 싶은 달이야. 좋아했던 장면을 하나 짚어 말하고, 상대도 둘이 시간을 보내고 싶어 하는지 들어 봐.'],
  'relationship.love_flirting':['연애','관계의 속도를 올리는 데 힘이 덜 붙는 편이야. 다음 약속을 한쪽만 계속 제안하는지, 상대도 가능한 날짜를 보태는지 봐.','대화가 즐거웠다면 작게라도 다음 약속을 정해 봐. 둘이 실제로 시간을 맞추는 과정에서 관심의 속도를 가늠할 수 있어.','함께할 일을 하나 더 제안하기 좋은 편이야. 지난 만남에서 나왔던 이야기를 다음 약속으로 이어 봐.'],
  'relationship.love_ambiguous':['연애','만남이 이어져도 관계를 정할 계기는 약할 수 있어. 네가 기대하는 만남의 빈도와 관계의 범위를 먼저 말하고 상대가 원하는 것도 들어 봐.','만나는 방식에 같은 기대를 두고 있는지 물어봐. 다음 만남에서도 말한 내용과 실제 행동이 맞는지 확인해 봐.','관계를 어떻게 이어갈지 이야기할 여지가 있어. 둘만 만나는 관계를 원하는지처럼 중요한 기대 한 가지를 꺼내 봐.'],
  'relationship.love_couple':['연애','서운함이 자연스럽게 풀리길 오래 기다리기보다, 기억에 남은 상황과 다음에 바라는 행동 하나를 함께 이야기해 봐.','평소 두 사람이 보내는 시간을 돌아봐. 함께할 일정 하나를 정하고 서로 편한 방식으로 약속을 지킬 수 있는지 확인해 봐.','서로에게 고마웠던 행동을 이야기하기 좋은 편이야. 둘 다 즐겼던 일을 이번 달 일정에 한 번 더 넣어 봐.'],
  'relationship.contact_activation':['연락','연락이 활발하게 오갈 것으로 읽을 근거는 약해. 필요한 답이 있다면 묻고 싶은 내용을 하나로 좁혀 봐.','연락이 늘거나 뜸해질 쪽으로 강하게 기울지 않아. 연락할 이유와 실제 답이 오가는지 함께 살펴봐.','연락이 오가는 상황에 주목할 만해. 누가 먼저 시작할지는 실제 메시지가 오간 뒤에 확인할 수 있어.'],
  'relationship.contact_continuity':['연락','전체 연락 지표가 낮아도 이미 시작한 대화가 끝난다고 볼 수는 없어. 상대도 질문을 돌려주거나 다음에 할 이야기를 보태는지 확인해 봐.','연락 횟수만으로 대화가 이어질지는 읽기 어려워. 질문과 답이 양쪽에서 오가고 다음 약속을 함께 정하는지 봐.','연락 지표가 높아도 한 번의 안부가 지속적인 대화를 보장하지 않아. 다음 대화도 양쪽에서 시작하는지 살펴봐.'],
  'relationship.love_reunion_interest':['재회','과거 인연과 관계를 다시 시작할 흐름은 약한 편이야. 이미 안부가 오갔다면 다시 만날 의사가 서로에게 있는지 따로 확인해.','과거 인연과의 관계는 아직 한쪽으로 기울여 읽기 어려워. 연락이 닿은 일과 다시 교제하자는 합의는 구분해서 봐.','과거 인연을 다시 생각해 볼 여지가 있는 달이야. 연락이 닿았다면 이전의 문제가 달라졌는지, 둘 다 관계를 다시 시작하고 싶은지 이야기해 봐.'],
}
const isoDate = (value:string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value+'T00:00:00Z').toJSON()?.slice(0,10)===value
function evidence(topic:string, stat:FortuneStat, start:string, end:string) {
  const days = [stat.best_days,stat.caution_days].map(points =>
    points?.find(point => isoDate(point.date) && point.date>=start && point.date<=end && Number.isFinite(point.score)))
  const samples = [...new Map(days.filter(point=>point!==undefined).map(point=>[point.date,point])).values()]
  return [`월간 ${topic} 평균 ${stat.average}점 · ${stat.band}`,...samples.map(point=>`${point.date} ${point.score}점`)].join(' / ')
}
export function monthlyLoveSupplements(doc:AuthoredReadingDocument, calculation:IntegratedApiResponse):MonthSupplement[] {
  const {start,end} = calculation.period
  if (doc.scope!=='love' || doc.state==='unverified' || !isoDate(start) || !isoDate(end) ||
      end<start || start.slice(0,7)!==end.slice(0,7) || doc.date!==`${start} → ${end}`) return []
  const month=calculation.western.months?.find(row=>row.start===start && row.end===end)
  const topics=month?.topics ?? calculation.western.overall
  return doc.sections.flatMap(section=>{
    const question=questions[section.id]
    if (section.state!=='missing'||!question) return []
    const [topic,weak,neutral,strong]=question
    const stat=topics?.[topic]
    if (!stat?.band || !Number.isFinite(stat.average)) return []
    const text=/약|낮|이하/.test(stat.band)?weak:/강|높|이상/.test(stat.band)?strong:neutral
    return [{id:section.id,label:section.label,text,evidence:evidence(topic,stat,start,end)}]
  })
}
