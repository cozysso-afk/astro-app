import type { FortuneStat, IntegratedApiResponse } from '../appTypes'
import type { AuthoredReadingDocument } from './authoredReadingDocument'
import type { MonthSupplement } from './monthlyLoveSupplement'
import { fortuneEvidenceSnapshot } from './fortuneToneCalibration.ts'
import { westernPeriodFact } from './systemPeriodFacts.ts'

type Question = { topic: string; application: string }

// The topic names refer to existing western calculations. Each situation is a
// way of reading that topic, not a separately scored person or event.
const questions: Record<string, Question> = {
  'relationship.love_general': {topic:'연애', application:'호감을 느낀 장면이 있다면, 그 뒤 두 사람의 선택이 어떻게 이어졌는지 봐. 한 번 즐겁게 대화한 일과 둘이 다시 시간을 내서 만난 일은 서로 다른 단서야.'},
  'relationship.love_single': {topic:'연애', application:'새 사람을 만날 자리가 있다면 첫인상보다 대화가 어느 순간 편해졌는지 떠올려 봐. 관심사가 겹쳤다면 다음에 같이 해볼 일을 가볍게 건네 봐. 실제로 서로 시간을 내는지 보면 한 번의 만남을 이어갈지 판단하기 쉬워.'},
  'relationship.love_crush': {topic:'연애', application:'좋아하는 사람에게 먼저 말을 걸었다면 답장이 빨랐는지보다 대화가 어떻게 이어졌는지가 중요해. 상대도 네 이야기를 물어왔거나 지난 대화를 기억해 다시 꺼냈다면 다음에 말을 걸 실마리가 있어. 짧게 답하고 끝났다면 그 한 번으로 마음을 정해 읽지는 마.'},
  'relationship.love_flirting': {topic:'연애', application:'둘이 호감을 주고받는 중이라면 즐거웠던 대화 하나를 구체적인 약속으로 이어 봐. 상대가 제안한 날에 어렵더라도 다른 날이나 장소를 먼저 보태는지 살펴봐. 연락 횟수보다 다음 만남을 둘이 함께 만드는지가 관계의 속도를 더 잘 보여줘.'},
  'relationship.love_ambiguous': {topic:'연애', application:'만나기는 하는데 서로 어떤 사이인지 모호하다면 먼저 네가 바라는 것을 한 가지로 좁혀 봐. 다음 만남을 미리 정하고 싶은 건지, 둘만 만나는 관계를 원하는 건지에 따라 물어볼 내용이 달라져. 그때 들은 답과 이후 약속을 지키는 모습까지 함께 봐.'},
  'relationship.love_couple': {topic:'연애', application:'연애 중이라면 이번 주에 둘이 같이 쓰고 싶은 시간과 각자 쉬고 싶은 시간을 먼저 맞춰 봐. 연락이 뜸한 날 서운했다면 그날 바랐던 행동을 하나만 말해 봐. “바쁠 때는 퇴근하고 한 번 알려줘”처럼 두 사람이 지킬 수 있는 약속이 좋아.'},
  'relationship.contact_activation': {topic:'연락', application:'기다리는 연락이 있다면 답이 필요한 이유부터 구분해 봐. 약속 시간이나 장소를 정해야 한다면 그 내용 하나를 물으면 돼. 안부가 궁금한 경우에는 한 번 건넨 뒤 실제 답이 오는지 보고 다음 대화를 정해.'},
  'relationship.contact_continuity': {topic:'연락', application:'이미 연락이 닿았다면 중요한 건 첫 답장 다음이야. 둘 다 질문을 보태는지, 대화가 끝난 뒤 다른 날에도 한쪽만 먼저 말을 꺼내는지 살펴봐. 약속을 제안했을 때 상대도 시간을 조율한다면 대화를 이어갈 구체적인 소재가 생겨.'},
  'relationship.love_reunion_interest': {topic:'재회', application:'과거 인연에게 연락이 닿는 일과 다시 교제하기로 하는 일 사이에는 확인할 게 있어. 안부를 나눈 뒤 서로 다음 만남을 원했는지, 예전에 멀어진 이유를 지금은 이야기할 수 있는지 봐. 만남이 실제로 한 번 더 이어졌을 때 관계를 다시 생각할 근거가 늘어나.'},
  'relationship.summary': {topic:'대인관계', application:'몇 사람의 의견을 맞춰야 한다면 각자 정할 수 있는 일부터 확인해. 의견이 잘 맞았더라도 담당자나 날짜가 비어 있으면 다음 대화에서 같은 이야기를 반복하게 돼. 합의된 한 가지를 먼저 실행해 봐.'},
  'relationship.friends': {topic:'대인관계', application:'친구에게 먼저 연락할지 고민된다면 최근 둘이 하다 만 이야기를 떠올려 봐. 같이 가기로 했던 곳이나 미뤄 둔 약속을 꺼내면 막연한 안부보다 답할 거리가 생겨. 상대가 바쁘다고 하면 가능한 날을 다시 건네는지까지 봐.'},
  'relationship.coworkers': {topic:'대인관계', application:'동료와 일을 나눌 때 “여기까지 하면 끝”이라는 기준이 서로 같은지 확인해. 자료를 넘기는 것까지인지 최종 수정까지인지에 따라 일정이 달라질 수 있어. 중간에 한 번 확인할 시점을 같이 정해 두면 마지막에 일이 몰리는 걸 줄일 수 있어.'},
  'relationship.family': {topic:'대인관계', application:'가까운 사람이 고민을 꺼내면 해결책이 필요한지, 일단 들어주면 되는지 물어봐. 평소 잘 아는 사이라도 그날 원하는 도움은 다를 수 있어. 부탁을 받았다면 지금 가능한 만큼을 구체적으로 알려 줘.'},
  'relationship.new_people': {topic:'대인관계', application:'처음 보는 사람이 많은 자리라면 여러 사람에게 두루 인사한 뒤 기억나는 대화 하나를 골라 봐. 나중에 다시 말을 걸 때 그때 나온 관심사를 꺼내면 상대도 이야기를 잇기 쉬워. 한 번의 인사 이후 서로 대화를 이어가는지 살펴봐.'},
  'relationship.boundaries': {topic:'대인관계', application:'반복되는 부탁이 부담스럽다면 도와줄 수 있는 부분과 어려운 부분을 한 번에 알려 줘. “오늘은 초안만 볼 수 있어”처럼 범위를 정하면 도움을 주면서도 내 일정을 지킬 수 있어. 그 뒤 상대가 그 범위를 존중하는지도 확인해.'},
  'money_news.news': {topic:'소식', application:'발표나 회신을 기다리는 일이 있다면 확인할 날짜와 공식 경로를 구분해 둬. 공지문을 읽을 때는 결과 발표일과 그 뒤 제출해야 할 서류의 마감일을 따로 적어 봐. 이번 주 소식 점수만으로 기관의 실제 발표 날짜를 알 수는 없어.'},
  'work_study.study': {topic:'학업', application:'이번 주에 익힌 내용을 다음 공부 시간에 책을 덮고 설명해 봐. 말이 막힌 대목이 개념 자체인지, 문제에서 그 개념을 알아보는 단계인지에 따라 복습할 내용이 달라져. 다시 볼 문제를 그 이유와 함께 한두 개 남겨 둬.'},
  'work_study.exam': {topic:'시험', application:'시간을 정해 문제를 풀어 본 뒤 틀린 이유를 나눠 봐. 개념을 몰랐다면 그 부분을 다시 배우고, 알고도 마지막에 놓쳤다면 다음 풀이에서 확인할 표시를 정해. 모의 점수 하나에 맞춰 계획 전체를 바꾸기보다 같은 실수가 반복되는지 보는 게 좋아.'},
  'work_study.work': {topic:'직장', application:'업무 두 개의 마감이 겹치면 먼저 결정이 필요한 부분을 담당자에게 짚어 줘. 상대의 답이 있어야 진행할 수 있는 일과 지금 혼자 끝낼 일을 나누면 기다리는 동안 쓸 시간이 생겨. 변경한 일정은 함께 일하는 사람에게도 알려 줘.'},
  'work_study.career_change': {topic:'이직', application:'관심 가는 공고나 제안이 있으면 이번 주에 확인할 조건부터 적어 봐. 같은 직무명이라도 실제 담당 업무와 근무지가 다르면 선택이 달라져. 지원 의사, 면접 제안, 확정된 이동은 각각 채용처의 안내가 왔을 때 구분해서 판단해.'},
  'money_news.money': {topic:'금전', application:'이번 주에 나갈 돈을 적을 때 결제 예정액과 아직 확정되지 않은 약속 비용을 나눠 봐. 받을 돈이 늦어져도 먼저 낼 수 있는 항목이 무엇인지 확인해 두면 일정이 겹칠 때 선택하기 쉬워.'},
  'investment.psychology': {topic:'투자심리', application:'가격을 자주 확인하게 되는 날에는 처음 적어 둔 판단 근거가 실제로 바뀌었는지 봐. 새로운 공시가 나온 경우와 가격만 움직인 경우를 나눠 적으면 무엇 때문에 마음이 급해졌는지 알기 쉬워.'},
  'investment.realization': {topic:'수익실현', application:'보유 자산을 정리할지 고민된다면 정해 뒀던 목표, 비용, 현금이 필요한 날짜를 다시 맞춰 봐. 셋 중 어느 조건이 바뀌었는지 확인해야 가격이 잠깐 움직였을 때도 일관된 판단을 할 수 있어. 이 지표로 매도할 날짜나 수익률을 정할 수는 없어.'},
  'investment.entry': {topic:'신규진입', application:'새로 관심이 간 자산이 있다면 진입을 검토한 이유와 그 생각을 바꿀 조건을 함께 적어 봐. 현재 가격만 보고 이유가 달라졌다면 성급히 결론을 내리기 쉬워. 이번 주 점수는 관심이나 판단을 돌아보는 참고 자료야.'},
  'condition.condition': {topic:'컨디션', application:'일정이 몰린 날 앞뒤로 쉬는 시간이 충분했는지 살펴봐. 같은 분량을 해도 유독 힘들었던 날이 있다면 수면과 약속 시간을 같이 기록해 둬. 다음 일정을 잡을 때 실제로 지쳤던 구간을 먼저 비워 두는 데 도움이 돼.'},
}

function isoDay(value:string) {
  const stamp = Date.parse(value + 'T00:00:00Z')
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0,10) === value ? stamp : NaN
}

function validStat(stat:FortuneStat|null|undefined): stat is FortuneStat {
  return Boolean(stat?.band && Number.isFinite(stat.average))
}

function directionContext(calculation:IntegratedApiResponse) {
  const signals = calculation.western.relationship_signals
  const incoming = signals?.['수신신호']
  const outgoing = signals?.['발신적합']
  const readings: string[] = []
  if (validStat(incoming)) readings.push(`연락을 받을 조건은 ${incoming.average}점(${incoming.band})`)
  if (validStat(outgoing)) readings.push(`먼저 말을 걸 조건은 ${outgoing.average}점(${outgoing.band})`)
  return readings.length ? '이번 주 ' + readings.join(', ') + '으로 계산됐어. ' : ''
}

export function weeklyPeriodSupplements(doc:AuthoredReadingDocument, calculation:IntegratedApiResponse):MonthSupplement[] {
  const {start,end} = calculation.period
  if (doc.state==='unverified' || isoDay(end)-isoDay(start)!==6*86400000 || doc.date!==`${start} → ${end}`) return []

  return doc.sections.flatMap(section=>{
    const question = questions[section.id]
    if (section.state!=='missing' || !question) return []
    const {topic,application} = question
    const stat = calculation.western.overall?.[topic]
    if (!validStat(stat)) return []
    const directional = section.id==='relationship.contact_activation' ? directionContext(calculation) : ''
    const lead = directional || `이번 주 ${topic} 지표는 ${stat.average}점(${stat.band})이야. `
    const facts = westernPeriodFact(stat,start,end)
    const aspects = fortuneEvidenceSnapshot(calculation,topic)
    const evidence = [facts,aspects.support && `도움이 되는 배치 · ${aspects.support}`,
      aspects.challenge && `부담이 되는 배치 · ${aspects.challenge}`,aspects.neutral && `함께 작용하는 배치 · ${aspects.neutral}`].filter(Boolean).join(' / ')
    return [{id:section.id,label:section.label,text:lead+application,evidence}]
  })
}
