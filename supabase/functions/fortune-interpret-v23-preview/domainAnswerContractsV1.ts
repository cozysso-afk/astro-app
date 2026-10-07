export type DomainAnswerQuestion = {
  key: string
  label: string
  scope: string
}

export type DomainAnswerContract = {
  topic: string
  section_key: string
  questions: DomainAnswerQuestion[]
}

export const DOMAIN_ANSWER_CONTRACT_VERSION = 'domain-answer-contracts-v1'

export const DOMAIN_ANSWER_CONTRACTS: DomainAnswerContract[] = [
  {
    topic:'직장', section_key:'work_study.work',
    questions:[
      {key:'progress',label:'업무 진행',scope:'현재 업무가 굴러가는 속도·막힘·완료 흐름. 새 직장이나 이직으로 확대하지 않는다.'},
      {key:'coordination_responsibility',label:'협업 · 책임',scope:'협의·커뮤니케이션·마감·책임·평가 압력 중 근거가 있는 부분만 답한다.'},
      {key:'change_timing',label:'변화 · 시기',scope:'역할·범위·업무환경 변화와 상대적으로 두드러지는 시기. 구체 인사발령을 만들지 않는다.'},
    ],
  },
  {
    topic:'이직', section_key:'work_study.career_change',
    questions:[
      {key:'exploration_offer',label:'탐색 · 제안',scope:'이직 탐색·지원·외부 제안·면담에 해당하는 근거가 있을 때만 구분한다.'},
      {key:'conditions_movement',label:'조건 · 실제 이동',scope:'조건 비교와 실제 이동은 분리한다. 합격·채용 확정은 만들지 않는다.'},
      {key:'timing',label:'시기',scope:'이직 관련 근거가 상대적으로 두드러지는 기간만 말한다.'},
    ],
  },
  {
    topic:'학업', section_key:'work_study.study',
    questions:[
      {key:'focus_understanding',label:'집중 · 이해',scope:'집중 유지와 이해·정리 흐름을 계산 근거 범위에서 구분한다.'},
      {key:'review_performance',label:'복습 · 수행',scope:'복습·인출·과제 수행에 직접 연결할 근거가 없으면 일반 공부법으로 채우지 않는다.'},
      {key:'timing',label:'시기',scope:'학업 관련 강약 구간이나 날짜 근거가 있을 때만 제시한다.'},
    ],
  },
  {
    topic:'시험', section_key:'work_study.exam',
    questions:[
      {key:'preparation',label:'준비 흐름',scope:'시험 준비·정리·인출을 돕거나 방해하는 근거만 설명한다.'},
      {key:'performance_error',label:'수행 · 실수',scope:'시험 수행과 실수 위험을 구분할 근거가 있을 때만 답한다. 합격 여부는 예측하지 않는다.'},
      {key:'timing',label:'시기',scope:'시험 대응이 상대적으로 수월하거나 점검이 필요한 구간만 설명한다.'},
    ],
  },
  {
    topic:'금전', section_key:'money_news.money',
    questions:[
      {key:'inflow_outflow',label:'유입 · 유출',scope:'돈의 유입과 지출 압력을 구분할 직접 근거가 있을 때만 답한다. 수익을 만들어내지 않는다.'},
      {key:'contract_recovery',label:'계약 · 회수',scope:'계약·정산·회수에 직접 연결되는 근거가 없으면 미계산으로 둔다.'},
      {key:'timing',label:'시기',scope:'금전 관련 변화가 상대적으로 두드러지는 시기만 말한다.'},
    ],
  },
  {
    topic:'소식', section_key:'money_news.news',
    questions:[
      {key:'response_notice',label:'회신 · 공식 통보',scope:'사적 연락과 승인·결과·공식 안내를 구분할 근거가 있을 때만 답한다.'},
      {key:'delay',label:'지연',scope:'지연·보류를 말할 직접 근거가 없으면 결과가 늦어진다고 추정하지 않는다.'},
      {key:'timing',label:'시기',scope:'소식·회신 관련 날짜나 구간 근거가 있을 때만 제시한다.'},
    ],
  },
  {
    topic:'연애', section_key:'relationship.love_general',
    questions:[
      {key:'mutuality_meeting',label:'상호성 · 만남',scope:'호감·상호 반응·실제 만남은 서로 다른 질문이다. 상대 속마음을 만들지 않는다.'},
      {key:'pace_definition',label:'관계 속도 · 정의',scope:'교류 속도와 관계 정의를 구분하고, 행동 근거가 없으면 확정하지 않는다.'},
      {key:'timing',label:'시기',scope:'연애 관련 활성 구간만 말하고 연락 날짜나 재회를 대신 예측하지 않는다.'},
    ],
  },
  {
    topic:'연락', section_key:'relationship.contact_activation',
    questions:[
      {key:'activation_direction',label:'연락 강도 · 방향',scope:'연락 활성과 상대→나/나→상대 상대 비교를 분리한다. 선연락 주체를 확정하지 않는다.'},
      {key:'continuity',label:'대화 지속',scope:'연락 시작과 질문·답변·약속이 이어지는 지속성을 구분한다.'},
      {key:'timing',label:'시기',scope:'연락 관련 직접 날짜·구간 근거만 사용한다.'},
    ],
  },
  {
    topic:'재회', section_key:'relationship.love_reunion_interest',
    questions:[
      {key:'stage_progression',label:'현재 단계',scope:'생각남→연락→만남→관계 재구축을 자동 승격하지 않고 현재 근거가 닿는 단계까지만 답한다.'},
      {key:'contact_meeting',label:'연락 · 만남',scope:'재접촉과 실제 만남을 분리하고 상대 속마음·사건 확률을 만들지 않는다.'},
      {key:'rebuilding_timing',label:'재구축 · 시기',scope:'관계 재구축과 시기를 직접 뒷받침하는 근거가 있을 때만 답한다.'},
    ],
  },
  {
    topic:'컨디션', section_key:'condition.condition',
    questions:[
      {key:'recovery_fatigue',label:'회복 · 피로',scope:'생활 리듬·피로·회복 흐름만 설명하고 질병 진단은 하지 않는다.'},
      {key:'stamina_capacity',label:'지속력 · 일정 소화',scope:'일정을 감당하는 지속력·휴식 필요성을 근거 범위에서만 설명한다.'},
      {key:'timing',label:'시기',scope:'컨디션 변화가 상대적으로 두드러지는 구간만 말한다.'},
    ],
  },
]

export const DOMAIN_ANSWER_KEYS = DOMAIN_ANSWER_CONTRACTS.flatMap(contract =>
  contract.questions.map(question => ({
    topic:contract.topic,
    section_key:contract.section_key,
    question_key:question.key,
    label:question.label,
    scope:question.scope,
  }))
)

export function domainAnswerContractKey(topic:string, questionKey:string) {
  return `${topic}::${questionKey}`
}

export const DOMAIN_ANSWER_LOOKUP = new Map(
  DOMAIN_ANSWER_KEYS.map(row => [domainAnswerContractKey(row.topic,row.question_key), row]),
)
