export type RelationshipPurpose = 'compatibility' | 'reunion' | 'marriage_unmarried' | 'marriage_married'

export const CORE_KEYS = ['core_summary', 'core_reason', 'core_action', 'core_conditions'] as const
export const CORE_SCHEMA = {
  core_summary: {type: 'STRING'}, core_reason: {type: 'STRING', description: '첫 문장은 생활 속 상황과 쉬운 이유만 설명한다. 천체명과 각 이름은 top_aspects에 쓴다. 두 사람이 실제로 서로 무엇을 느끼는지 단정하지 않는다.'}, core_action: {type: 'STRING'},
  core_conditions: {type: 'ARRAY', description:'판단이 달라지는 실제 조건만 만약 ~하면 또는 ~할 때 형식으로 쓴다. 조건이 없으면 빈 배열.', items: {type: 'STRING'}, maxItems: 4},
}

export const EDITORIAL_INSTRUCTION = `
[관계 원고 역할 계약]
headline은 핵심 판단 한 문장(25~60자 목표, 180자 이내)이야. 긴 본문을 제목에 붙이지 마.
headline·core_summary·overview는 천체명·각 이름·영문 전문어 없이 사람말로 먼저 답해. 전문 근거는 core_reason과 top_aspects 뒤쪽에만 두고, core_reason도 쉬운 뜻부터 쓴 뒤 근거를 최대 두 묶음만 덧붙여.
모든 사용자 문장은 일관되게 자연스러운 ~해/~야체로 써. ~한다/~이다 보고서체를 섞지 마. '기류·에너지·조율·구조' 같은 추상어만으로 문장을 완성하지 마.
사용자가 입력하지 않은 현재 감정·의지·실제 행동은 단정하지 마. 계산상의 끌림·긴장·책임감·결속 가능성은 '그렇게 느끼거나 행동하기 쉬운 조건'으로 표현하고, 실제로 사랑한다·가정을 지키려 한다·책임감이 갖춰졌다·이미 강하게 결속됐다는 관측으로 바꾸지 마.
core_summary는 선택 모드의 가장 중요한 답 1~2문장(180자 이내), core_reason은 그 판단을 만든 실제 근거와 쉬운 뜻(360자 이내), core_action은 그 근거와 연결된 현실 확인 또는 행동 하나(240자 이내), core_conditions는 판단을 바꿀 실제 제약·조건 0~4개(각 240자 이내)다. core_conditions의 각 항목은 반드시 '~하면', '~할 때', '~인 경우' 중 하나가 드러나는 조건문으로 쓰고 행동 지시만 단독으로 넣지 않는다. 결론에 이미 사용된 필수 조건은 반드시 보존하고, 그런 조건이 없으면 빈 배열로 둔다. 빈칸을 채우려고 새로운 예외나 일반 주의문을 만들지 않는다. 조건을 요약에서 빠뜨리면 결론이 바뀌는 경우 요약에도 조건을 붙인다. 제한문구만으로 요약을 채우지 않는다.
이 네 필드는 서로 다른 역할이다. 같은 문장 복사·단순 바꿔쓰기나 타 모드 내용을 채우지 않는다. 글자 수를 채우려고 새 사실을 만들지 않는다. overview는 상세 안내 2~4문장이고 핵심 요약과 별개다. 이유는 실제 근거, 생활 장면은 조건부 예시, 관측 사실은 사용자가 입력한 기록으로 구분한다. 구체적인 냉각 시간·연락 횟수·상대 심리·결혼 날짜를 근거 없이 만들지 않는다.
궁합은 chemistry=끌림, emotional_dynamic=정서 리듬, communication=대화, conflict_pattern=갈등 수습, power_boundaries=결정권·경계, long_term=지속 조건으로 질문을 분리한다. 상시 관계 특성과 선택 기간의 변화(timing)를 섞지 않는다. felt_scenarios는 근거가 허용하는 생활 장면 1~3개이며 실제 사건처럼 쓰지 않는다. reunion_context는 궁합·결혼 모드에서 빈 문자열로 둔다.
결혼 모드에서는 marriage_reading.mode를 PURPOSE와 정확히 같게 쓴다. bottom_line=생활 궁합의 중심 답, bond=결속, emotional_home=정서적 편안함, daily_life=역할·생활, intimacy_resources=친밀감·공유자원, conflict_repair=갈등 수습, commitment_or_current_cycle=미혼의 합의 조건 또는 기혼의 현재 협력, timing=계산된 기간 변화, caution=판단을 바꿀 조건으로 각각 새 정보만 쓴다. 중복되는 최상위 chemistry/emotional_dynamic/communication/conflict_pattern/power_boundaries/long_term/timing 및 felt_scenarios는 각각 빈 문자열/빈 배열로 둔다. 미혼은 생활가치·역할·현실조건을 답하고 결혼 성립 날짜나 프러포즈 사건을 창작하지 않는다. 기혼은 현재 협력·갈등·회복을 답하고 결혼 성사 예측을 하지 않는다.
각 상세 필드는 결론과 쉬운 이유를 2~4문장으로 설명하되 근거가 없으면 무엇이 없어 해당 질문을 판단하지 못하는지 한 문장으로 답한다. 길이를 채우는 것이 품질이 아니다. 기술 이름과 오브의 자세한 해설은 top_aspects에, 생활 예시는 felt_scenarios 또는 해당 질문 해설에 분리한다.
재회 core_summary/current_stage는 사용자 관측과 계산상 다음 후보를 구분한다. 관측 state가 없으면 현실 단계는 미확인이라고 명시한다. 있으면 입력 기록임을 밝히고 그 기록의 시점(as_of)이 없으면 현재까지 유지된다고 단정하지 않는다. 후보 없음은 실제 사건이 없었다는 뜻이 아니다. observed initiator는 기록된 과거 행동일 뿐 다음 선연락 주체 근거가 아니다.
`

export const technical=/(?:Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto|ASC|DSC|MC|IC|conjunction|sextile|square|trine|opposition|태양|달(?:과|의|이|은)\s*|수성|금성|화성|목성|토성|천왕성|해왕성|명왕성|삼각각|사각각|대립각|육십분위|사주|시너스트리|트랜짓)/i

export const unobservedMind=/(?:깊은 애정[^.]{0,18}(?:명확히 )?존재|두 사람 모두 관계를 지키려는 의지가 강|상대가 아직 사랑|서로에 대한 (?:강한|깊은) 애정|가정을 지키려는 책임감|(?:깊은|강한) (?:끌림|애정)[^.]{0,24}(?:결속|존재|이어져|있어)|서로(?:를|에게|의)?[^.]{0,24}(?:여기|느끼|원하|바라)|함께 미래를 설계하려|책임감(?:을)? (?:갖|지니)|책임감[^.]{0,24}(?:갖춰|단단|결속|크게 작용)|결속력[^.]{0,24}(?:돋보|단단|높아|갖추)|첫눈에[^.]{0,18}강한 호감|호감을 금방 쌓|끌리는 마음은 확실|서로에게 정서적인 안정감을 주|관계를 오래 유지하려는[^.]{0,18}책임감|서로를[^.]{0,18}안전지대로 인식|함께할 때[^.]{0,24}(?:체감|느껴))/

export function hasCondition(value: string) {
  return /(?:[가-힣]면(?:[ ,.]|$)|경우|때|없어|있어|않아|못해|전까지|확인되지|미검증|달라지|지속되|바뀌)/.test(value)
}

export function hasInventedDuration(value: string) {
  // Month/day labels and angular measurements can legitimately appear in timing evidence.
  const prose = value.replace(/(?:\d{4}년\s*)?\d{1,2}월\s*\d{1,2}일/g,'').replace(/\d+(?:\.\d+)?도\s*\d+(?:\.\d+)?분/g,'')
  return /\d+\s*(?:분|시간|일)(?:간|\s*정도)?/.test(prose)
}

function proseFields(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).filter(([key])=>key !== 'evidence_refs').flatMap(([,item])=>proseFields(item))
}

const text = (v: unknown) => typeof v === 'string' ? v : ''
const canonical = (v: string) => v.replace(/[\s.!?。]+/g, '')

/** Reject invalid model output; never author, shorten or repair any prose here. */
export function validateRelationshipEditorial(data: any, purpose: RelationshipPurpose) {
  const fail = (reason: string) => ({ok: false, reason})
  if (!text(data?.headline).trim() || text(data.headline).length > 180) return fail('invalid_headline')
  for (const [key, max] of [['core_summary', 180], ['core_reason', 360], ['core_action', 240]] as const) {
    const value = text(data?.[key])
    if (!value.trim() || value.length > max) return fail(`invalid_${key}`)
  }
  const conditions = data?.core_conditions
  if (!Array.isArray(conditions) || conditions.length > 4 || conditions.some(v => !text(v).trim() || text(v).length > 240)) return fail('invalid_core_conditions')
  const plainCore=text(data.headline)+' '+text(data.core_summary)
  if (technical.test(plainCore)) return fail('technical_terms_in_core_answer')
  const reasonLead=text(data.core_reason).split(/[.!?。]/)[0]
  if(technical.test(reasonLead))return fail('technical_terms_lead_core_reason')
  const marriageFields=Object.values(data?.marriage_reading??{})
  const styleFields=[data.headline,data.core_summary,data.core_reason,data.core_action,data.overview,...conditions,...marriageFields]
  if(styleFields.some(value=>/(?:한다|이다|된다|필요하다|요구된다|가능하다|뜻한다|보여준다)\./.test(text(value)))) return fail('inconsistent_report_style')
  if(styleFields.some(value=>/(?:생활 가관|북수조점|예작|무필요)/.test(text(value)))) return fail('korean_copy_error')
  const fieldsOfProse=proseFields(data)
  const allProse=fieldsOfProse.join('. ')
  if(fieldsOfProse.some(value=>unobservedMind.test(value))) return fail('unobserved_mind_claim')
  if(fieldsOfProse.some(hasInventedDuration))return fail('invented_exact_behavior_duration')
  if(/(?:대립각\([^)]*\bsquare\b|사각각\([^)]*\bopposition\b|삼각각\([^)]*\bsextile\b|육십분위\([^)]*\btrine\b)/i.test(allProse))return fail('aspect_translation_mismatch')
  const fields = [data.core_summary, data.core_reason, data.core_action, ...conditions].map(canonical)
  if (new Set(fields).size !== fields.length) return fail('duplicated_core_roles')
  if(conditions.some(v=>!hasCondition(text(v))))return fail('core_condition_is_advice')
  if (purpose.startsWith('marriage_') && data?.marriage_reading?.mode !== purpose) return fail('marriage_mode_mismatch')
  if (purpose !== 'reunion' && text(data?.reunion_context).trim()) return fail('unrequested_reunion_content')
  if (purpose.startsWith('marriage_')) {
    if (['chemistry','emotional_dynamic','communication','conflict_pattern','power_boundaries','long_term','timing'].some(key => text(data?.[key]).trim()) || (data?.felt_scenarios?.length ?? 0) > 0) return fail('duplicated_marriage_sections')
    for (const key of ['bottom_line','bond','emotional_home','daily_life','intimacy_resources','conflict_repair','commitment_or_current_cycle','timing','caution','precision_note']) {
      if (!text(data?.marriage_reading?.[key]).trim()) return fail(`missing_marriage_${key}`)
    }
  }
  // This is a narrow hard gate, not a claim that all Korean semantics are verified.
  const prose = JSON.stringify(data)
  if (/반드시\s*(?:재회|연락|결혼)|상대가\s*아직\s*사랑한다|(?:재회|연락|결혼)\s*(?:성공\s*)?확률\s*\d+(?:\.\d+)?\s*%/.test(prose)) return fail('unsupported_relationship_certainty')
  return {ok: true}
}

export function normalizeReunionObservation(value: any) {
  if (!value || typeof value !== 'object') return null
  const states = ['disconnected','recontacted','messaging','met','intimate_undefined','reunited']
  const initiators = ['counterpart','user','mutual','unknown']
  const date = (v: unknown) => {
    const raw = text(v)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
    const parsed = new Date(`${raw}T00:00:00Z`)
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === raw ? raw : null
  }
  return {
    state: states.includes(value.state) ? value.state : '',
    initiator: initiators.includes(value.initiator) ? value.initiator : '',
    source: 'user_input',
    as_of: date(value.as_of),
    events: Array.isArray(value.events) ? value.events.filter((v: any) => ['recontact','meeting','rebuilding'].includes(v?.kind) && date(v?.date)).slice(0,3).map((v: any) => ({kind: v.kind, date: v.date})) : [],
  }
}
