import type { FortuneStat, IntegratedApiResponse } from '../appTypes'
import type { AuthoredReadingDocument, AuthoredSection } from './authoredReadingDocument'
import type { FortuneField } from './fortuneFields'

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

type AspectReading = {
  transit: string; target: string; aspect: string; sign: number
  label: string; name: string; reading: string
}

const questionAspects: Record<string, AspectReading> = {
  '직장:coordination_responsibility': {
    label:'협업 · 책임', transit:'Mercury', target:'Saturn', aspect:'사분위', sign:-1, name:'수성과 토성의 사분위',
    reading:'일을 맡기는 사람과 실제로 마무리할 사람이 같은 뜻으로 약속했는지 살필 때야. 회의에서 “이번 주까지”라고 했다면 초안을 보낼 날인지, 승인까지 받을 날인지 짚어 봐. 담당 변경 여부는 합의한 내용에서 확인할 수 있어.',
  },
  '이직:exploration_offer': {
    label:'탐색 · 제안', transit:'Uranus', target:'Jupiter', aspect:'육십분위', sign:1, name:'천왕성과 목성의 육십분위',
    reading:'지금 해 온 일을 다른 자리에서도 활용할 길을 찾아보는 쪽으로 읽어. 눈에 들어오는 공고가 있다면 직함보다 실제 맡을 일을 지금 업무와 비교해 봐. 지원할 만한 곳을 발견한 단계와 회사에서 면담을 제안한 단계는 구분해 두면 좋아.',
  },
  '이직:conditions_movement': {
    label:'조건 · 실제 이동', transit:'Uranus', target:'Saturn', aspect:'삼분위', sign:1, name:'천왕성과 토성의 삼분위',
    reading:'변화를 지금 지키고 있는 일정에 맞춰 보는 흐름이야. 이직을 검토 중이라면 가능한 입사일과 현 직장에서 마쳐야 할 일을 함께 적어 봐. 이동이 구체화됐는지는 근무 조건과 시작일을 양쪽에서 확인했을 때 판단할 수 있어.',
  },
  '학업:review_performance': {
    label:'복습 · 수행', transit:'Mercury', target:'Saturn', aspect:'사분위', sign:-1, name:'수성과 토성의 사분위',
    reading:'배운 내용 중 설명이 막히는 지점을 찾아 다시 짚는 데 초점을 둬. 예제를 덮고 풀이의 첫 단계부터 말해 봐. 답은 기억나는데 그 방법을 고른 이유가 막힌다면 바로 그 부분이 이번 복습의 출발점이야.',
  },
  '시험:preparation': {
    label:'준비 흐름', transit:'Mercury', target:'Jupiter', aspect:'사분위', sign:-1, name:'수성과 목성의 사분위',
    reading:'큰 줄거리를 아는 것과 문제에서 요구한 범위까지 답하는 것을 나눠 연습해 봐. 기출 한 문제를 고르고 답안을 쓰기 전에 제한 조건 두 가지를 표시해. 다 쓴 뒤 그 조건이 실제 답에 들어갔는지 확인하면 준비할 부분이 좁혀져.',
  },
  '시험:performance_error': {
    label:'수행 · 실수', transit:'Moon', target:'Mars', aspect:'충', sign:-1, name:'달과 화성의 충',
    reading:'풀이 속도를 올릴 때 검토할 시간이 남는지 살펴봐. 시간 제한을 두고 풀어 본 뒤, 틀린 문항에서 개념이 막혔는지 마지막 단위나 부호를 건너뛰었는지 나눠 봐. 실제 시험에서 실수할 문항을 이 배치로 특정할 수는 없어.',
  },
  '연애:pace_definition': {
    label:'관계 속도 · 정의', transit:'Venus', target:'Mars', aspect:'삼분위', sign:1, name:'금성과 화성의 삼분위',
    reading:'호감을 표현하거나 만나고 싶은 마음을 행동에 옮기는 쪽으로 읽어. 가까워지고 싶다면 둘이 편하게 할 수 있는 약속 하나를 제안해 봐. 제안을 반갑게 받는 것과 같은 속도로 관계를 이어가고 싶다고 말하는 건 서로 다른 단계야. 관계를 어떻게 부를지는 두 사람이 직접 나눈 말에서 확인해.',
  },
}

// Uncached weeks use the same question resolver as archived reports.
export function calculatedWeeklyQuestions(field?:FortuneField):AuthoredSection[] {
  const names:Record<string,string> = Object.fromEntries(Object.entries(questionAspects).map(([id,rule])=>[id,rule.label]))
  for(const topic of Object.keys(timingMeaning)) {
    names[topic+':'+(topic==='직장'?'change_timing':'timing')]='시기'
  }
  names['연락:activation_direction']='연락 강도 · 방향'
  names['연락:continuity']='대화 지속'
  names['재회:contact_meeting']='연락 · 만남'
  names['재회:stage_progression']='현재 단계'
  return Object.entries(names).flatMap(([key,label])=>{
    const topic=key.split(':')[0]
    if(field && !field.topics.includes(topic)) return []
    return [{id:'question:'+key,label:topic+' · '+label,state:'insufficient' as const,blocks:[]}]
  })
}

function questionAspectAnswer(topic:string, question:string, calc:IntegratedApiResponse) {
  const rule=questionAspects[topic+':'+question]
  if (!rule) return ''
  const dates=Array.from(new Set((calc.western.daily_scores??[]).filter(row=>
    /^\d{4}-\d{2}-\d{2}$/.test(row.date) && row.date>=calc.period.start && row.date<=calc.period.end &&
    row.evidence?.some(e=>e.kind==='aspect' && e.source_topics?.includes(topic) &&
      e.transit===rule.transit && e.target===rule.target && e.aspect===rule.aspect &&
      typeof e.polarity==='number' && Number.isFinite(e.polarity) && Math.sign(e.polarity)===rule.sign)
  ).map(row=>row.date))).sort()
  if (!dates.length) return ''
  const day=(value:string)=>Number(value.slice(5,7))+'월 '+Number(value.slice(8))+'일'
  const contiguous=Date.parse(dates[dates.length-1])-Date.parse(dates[0])===(dates.length-1)*86400000
  const when=dates.length>1 && contiguous ? day(dates[0])+'부터 '+day(dates[dates.length-1])+'까지' : dates.map(day).join('·')+'에'
  return `${when} ${topic} 계산에 ${rule.name} 배치가 보여. ${rule.reading}`
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
    if (!answer) answer=questionAspectAnswer(topic,question,calc)
    if (!answer) return section
    return {...section,state:'ready',label:section.label+' · 부분 해설',blocks:[{id:section.id+':calculation',label:'주간 계산값으로 보면',text:answer}]}
  })
}
