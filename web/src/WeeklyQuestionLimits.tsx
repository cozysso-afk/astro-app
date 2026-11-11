import type { AuthoredSection } from './lib/authoredReadingDocument'

const limits:Record<string,string> = {
  '직장:coordination_responsibility':'누가 어느 일까지 맡기로 했는지는 담당자와 합의한 업무 범위에서 확인할 수 있어.',
  '이직:exploration_offer':'관심 있는 공고를 찾아보는 것과 회사에서 제안을 받는 건 다른 단계야. 실제 제안은 회사가 보낸 연락에서 확인할 수 있어.',
  '이직:conditions_movement':'제안을 비교하려면 급여·근무지·시작일이 필요해. 이동이 확정됐는지는 계약이나 발령에서 확인할 수 있어.',
  '학업:review_performance':'공부에 관심이 간 날에도 배운 만큼 기억하는지는 따로 봐야 해. 책을 덮고 다시 풀었을 때 어디서 막혔는지가 단서야.',
  '시험:preparation':'준비가 얼마나 됐는지는 실제 시험 범위 중 혼자 풀 수 있는 부분과 아직 도움이 필요한 부분을 나눠 보면 알 수 있어.',
  '시험:performance_error':'틀린 이유가 개념 때문인지 시간 부족 때문인지는 실제 풀이와 오답을 대조해야 알 수 있어.',
  '금전:contract_recovery':'정산이 늦어졌는지는 계약에 적힌 지급일과 실제 입금일을 비교해야 알 수 있어.',
  '소식:response_notice':'누군가와 안부를 주고받은 기록으로 기관의 회신이나 승인까지 확인할 수는 없어. 접수한 곳의 공지나 답신을 봐야 해.',
  '소식:delay':'지연 여부를 알려면 먼저 안내받은 회신 기한이 있어야 해. 예정일을 알 수 없으면 기다린 시간만으로는 판단하기 어려워.',
  '연애:pace_definition':'두 사람이 관계를 같은 속도로 받아들이는지는 각자가 원하는 만남 방식과 그에 대한 상대의 답을 함께 봐야 해.',
  '연락:continuity':'한 번 연락이 왔다는 사실만으로는 대화가 이어졌는지 알 수 없어. 첫 답장 뒤에도 두 사람이 말을 주고받았는지가 단서야.',
  '재회:stage_progression':'안부를 주고받았는지, 만났는지, 다시 교제하기로 했는지는 서로 다른 사실이야. 실제로 확인된 단계가 필요해.',
  '재회:rebuilding_timing':'다시 만난 날짜가 곧 교제를 다시 시작한 날짜는 아니야. 관계를 어떻게 이어갈지 두 사람이 이야기했는지가 단서야.',
  '컨디션:stamina_capacity':'일정을 어느 정도 소화할 수 있는지는 실제 활동 사이에 얼마나 쉬었고 그 뒤 어떻게 느꼈는지까지 봐야 해.',
}

export function WeeklyQuestionLimits({sections}:{sections:AuthoredSection[]}) {
  return <details className="authored-reading-coverage weekly-question-limits">
    <summary>이번 주에 더 확인할 질문 {sections.length}개</summary>
    <ul>{sections.map(section=>{
      const explanation=section.id.startsWith('question:') ? limits[section.id.slice('question:'.length)] : undefined
      return <li key={section.id} data-reading-section={section.id} data-section-state="insufficient">
        <strong>{section.label}</strong>{explanation && <p>{explanation}</p>}
      </li>
    })}</ul>
  </details>
}
