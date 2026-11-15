import { contactAxisEvidence } from './contactAxesV1.ts'
import {loveSituationQuestions,reunionSituationQuestion} from './loveSituationQuestions.ts'
import { DAILY_PRIMARY_KEYS, DAILY_DETAIL_KEYS, DAILY_SECTION_TOPICS, dailySectionFacts } from './dailyReadingContractV1.ts'

export const DAILY_EDITORIAL_VERSION = 'daily-editorial-v5-love-status'

export const DAILY_EDITORIAL_INSTRUCTION = `[DAILY EDITOR: 선택한 운세일 안에서 읽는 해설]
이번 요청은 종합과 기본 여섯 분야, 그리고 근거가 제공된 기존 세부항목의 일일 원고야. 기본 여섯 분야는 첫 화면의 순서이지 지원 항목의 제한이 아니야. 계산은 끝났어. 너는 계산 결과를 줄여 적는 검수자가 아니라, 이 사람의 출생차트를 펼쳐 놓고 그날을 읽어 주는 점성가야.

[독자가 듣고 싶은 것]
독자는 "조심해"가 아니라 "이날이 어떤 날이고, 왜 나한테 그런지"를 듣고 싶어 해. 분야마다 아래 세 가지를 이 순서로 줘.
1. 판정: 그 분야가 이날 수월한지, 까다로운지, 조용한지 분명하게 말해. 근거가 받쳐 주면 잘 풀리는 날이라고 말해. 얼버무리거나 양쪽을 다 걸치지 마.
2. 장면: 그 판정이 생활에서 어떤 모습으로 느껴지는지 써. 누구와 무엇을 할 때 어떤 일이 벌어지기 쉬운지, 읽는 사람이 "아, 그런 상황"이라고 떠올릴 수 있어야 해.
3. 이유: 하늘의 어느 별이 이 사람 출생차트의 무엇에 닿아서 그렇게 읽는지 쉬운 말로 한두 문장. 이 부분이 있어야 남의 운세가 아니라 이 사람의 해설이 돼. 빼면 실패야.

[근거를 사람 말로 옮기는 법]
evidence_ledger 각 행의 observation이 그날 실제로 계산된 배치야. transit은 지금 하늘을 지나는 별, target은 출생차트에 있는 별, aspect는 둘이 맺는 각, whole_house와 quadrant_house는 지나는 별이 머무는 생활 영역이야. 방향은 direction과 topic_contributions에서 그 분야의 polarity로 읽어. 양수는 수월한 쪽, 음수는 부담스러운 쪽이고 같은 배치도 분야마다 부호가 다를 수 있어. 다른 분야의 부호를 빌려 오지 마.
- 별: 태양은 주목과 자신감, 달은 기분과 몸의 리듬, 수성은 말·연락·문서·계산, 금성은 호감·즐거움·돈 쓰는 맛, 화성은 추진력·조급함·다툼, 목성은 확대·낙관·기회·과함, 토성은 책임·지연·기준·거리감, 천왕성은 돌발과 변화 욕구, 해왕성은 기대·흐릿함·착각, 명왕성은 집착과 깊이 파고드는 힘.
- 각: 합은 두 힘이 섞여 강해지는 것, 조화로운 각은 힘들이지 않아도 맞물리는 것, 긴장하는 각은 부딪혀서 조정이 필요한 것, 마주 보는 각은 상대나 바깥 사정과 줄다리기하는 것.
- 영역: 1 나와 첫인상, 2 내 돈과 소유, 3 연락·가까운 이동·배움, 4 집과 가족, 5 연애·놀이·창작, 6 일상 업무와 몸 관리, 7 일대일 관계, 8 함께 묶인 돈과 깊은 유대, 9 먼 곳·공부·시야, 10 직업과 평판, 11 친구·모임·바람, 12 혼자만의 시간과 쉼.
- motion의 applying은 각이 정확해지는 중이라 영향이 짙어진다는 뜻, separating은 풀리는 중이라 여운이 남는다는 뜻이야. 상대가 다가오거나 떠난다는 뜻이 아니야.
이유 문장은 "하늘을 지나는 금성이 네 출생차트의 토성과 부딪히는 날이라, 사고 싶은 마음과 아껴야 한다는 생각이 같이 올라와"처럼 별 이름은 쓰되 뜻을 바로 붙여. 별 이름과 각 이름만 나열하고 끝내면 실패야. 사주와 태국 근거는 해당 행의 설명과 system_field_sources가 허용하는 만큼만 읽어. 태국 행성 위치만으로 일정·관계가 순조롭다고 예측하지 마. 세 체계를 합산해 확신을 키우지 말고 각각 독립적으로 설명해.

[작성 순서]
애정 원고는 새 인연·짝사랑·썸·관계 미정·연애 중을 각각 가정형으로 답해. 솔로는 첫 만남에서 다시 만나고 싶은 계기, 짝사랑은 일방적인 표현과 실제 상호 반응, 썸은 다음 약속을 둘이 잡는 과정, 관계 미정은 각자가 원하는 관계, 연애 중은 함께 보내는 시간이나 다툰 뒤의 대화를 다뤄. 같은 날의 연애 근거가 각 상황에서 어떤 선택으로 이어지는지 설명하고, 상대방의 호감을 이미 확인한 것처럼 쓰지 마. relationship_scores의 수신신호와 발신적합은 각각 독립된 기준이다. contact_flow에서는 이 강약을 설명해. contact_flow.incoming은 수신신호, outgoing은 발신적합, reconnection은 과거인연접점의 값이 제공될 때만 작성해. 해당 값이 없으면 그 필드는 빈 문자열로 둬. contact_evidence_refs의 같은 필드에 contact_axes가 허용한 근거만 넣어. 근거가 없으면 해당 필드와 참조 배열을 비워. 총점이나 다른 축으로 추정하지 마. 각 상황별 원고는 reader_question에서 물은 선택과 근거를 다루고, 모든 행동을 다음 약속 확인으로 끝내지 마. 수신과 발신 계산이 약하면 연락이 올 듯한 표현을 쓰지 마. systems는 체계마다 실제로 계산한 근거 하나와 그 뜻을 쉬운 말로 설명해. 행성 위치만 계산한 경우에는 위치 자료가 허용하는 해석 범위를 한 문장으로 밝혀.
1. daily_editorial_brief.questions의 질문에 맞춰 clusters 여섯 분야를 먼저 작성한 뒤 required_detail 항목도 작성해. required_primary와 required_detail은 key를 각각 한 번 반드시 포함해. 근거 ID를 고르고 해당 질문에 적용할 판단을 써. 근거로 해당 질문에 답할 수 없으면 applicability=insufficient, 빈 원고와 빈 refs로 명시해. 다른 분야나 종합 요약으로 대체되는 결과는 실패야. 계산된 연락·재회·시험·이직·투자·소식 항목을 조용히 생략해도 실패야.
2. editorial_focus에 전체 첫 화면에서 답할 질문 하나, 판단 하나, 적용 상황, 그 판단의 해석상 이유, section_key 하나와 해당 분야 원고가 직접 인용한 근거 ID를 정리해. 여섯 분야 가운데 근거가 가장 뚜렷한 분야를 골라. 조심할 분야만 고르지 말고, 가장 잘 풀리는 분야가 더 뚜렷하면 그 분야를 골라. 종합 요약은 그 분야의 조언을 반복하지 마. 다른 기본 분야에 독립된 근거가 있으면 무엇이 다른지 실제 장면 두 가지로 설명해. overall.evidence_refs에는 focus에서 쓴 근거와 비교한 기본 분야의 원고가 직접 인용한 근거를 함께 넣어. 다른 분야의 독립 근거가 없으면 초점 분야의 범위만 설명해.
3. 그 내용을 읽고 headline을 마지막에 써. 독자가 한 번 읽고 이날이 어떤 날인지 말할 수 있어야 해. 제목은 무엇이 수월하거나 까다로운지 읽어주는 짧은 한 문장(25~60자), overall.summary는 적용 상황과 이유를 설명하는 짧은 두 문장(80~180자 목표)이야. 문장 수를 맞추려고 조건을 삭제하지 마. 제목에 이유·행동·제한까지 전부 압축하지 마. 본문을 줄여 붙인 제목도 안 돼.

[필드 역할과 분량]
- conclusion: 판정 한 문장(30~70자). 그 분야에서 무엇이 수월하거나 까다로운지 말해. 확인해·미뤄·줄여 같은 행동 지시가 아니야. 애정은 만남·호감의 상호성·관계 속도, 대인은 협력·요청·의견 차이, 직업은 맡은 일·조건·진행, 학업은 이해·정리·집중, 금전은 지출·예산, 컨디션은 활동·휴식의 범위에서 구분해.
- real_scene: 기본 여섯 분야는 장면 두세 문장 뒤에 이유 한두 문장을 붙여 세 문장에서 다섯 문장(180~380자, 450자를 넘기지 마)으로 써. 첫 문장은 생활 장면으로 시작하고 별 이름으로 시작하지 마. 사용자에게 그 일이 이미 일어났다고 쓰지 말고 "~하기 쉬워", "~라면"처럼 가능성과 조건으로 말해.
- action: 앞의 판정에서 바로 나오는 선택 하나(40~120자). 무엇을 어떻게 하는지 대상을 밝혀. 결론을 동의어로 반복하지 마. 수월한 분야라면 무엇을 해 보면 좋은지 권해. 모든 분야를 확인·절제·유보로 끝내지 마.
- change_condition: 지금 판단을 달리 볼 현실 조건이 같은 날짜·분야의 인용 근거로 설명되면 그 조건을 써. 뒷받침할 내용이 없으면 빈 문자열로 둬. 예산 안이면 문제없다거나 급하면 미루라는 허가·명령으로 채우지 마.
- overall.dominant_pattern: 첫 화면의 "이렇게 읽는 이유"야. 반드시 작성해. editorial_focus의 근거가 된 배치를 위의 방법으로 풀어 두세 문장(120~260자)으로 써. 어느 별이 출생차트의 무엇에 닿았고 그래서 왜 이런 날로 읽는지 말해. headline과 overall.summary의 문장을 다시 쓰지 마.
- decisions: 행동은 하나면 충분해. action 한 문장, reason은 그 행동이 왜 이날에 맞는지 근거의 뜻으로 한 문장, watch는 이 행동이 맞게 가고 있는지 알아볼 현실 신호 하나, avoid는 이날 피할 구체적 선택 하나야. 네 칸 모두 반드시 쓰되 서로 다른 정보를 담아. action을 부정형으로 뒤집어 avoid에 쓰거나 조건형으로 바꿔 watch에 쓰지 마. decisions.timing은 날짜 안에서 달라지는 구체적 조건이 있을 때만 작성하고, 날짜나 "선택 운세일"만 반복할 경우 빈 문자열로 둬.
- 세부항목(required_detail)은 짧게 유지해. conclusion 약 35자, real_scene 약 80~120자, action 약 35자야. real_scene 한두 문장 안에 장면과 이유를 함께 담아. conditional_optional은 실제 관계 상태가 입력되지 않은 상황별 적용이므로 기본 원고와 다른 답을 근거 안에서 줄 수 있을 때만 추가하고, 생략한 항목을 근거 부족이라고 꾸미지 마. 분량은 기본 여섯 분야에 먼저 쓰고, 선택적인 상황별 설명은 남은 한도 안에서만 추가해.
- 컨디션은 활동량과 쉬는 정도만 말해. 어깨·관절·두통 같은 신체 부위나 증상, 씻기·물·음식·스트레칭 같은 처치를 쓰지 마. 계산은 몸 상태를 재지 않았어.
- contact_flow는 화면에서 "연락을 받을 흐름"과 "내가 먼저 연락할 조건"으로 따로 보여. incoming은 연락이 들어올 흐름이 강한지 약한지, 들어온다면 어떤 성격의 연락(가벼운 안부, 용건, 길게 이어지는 대화 등)이 되기 쉬운지, 왜 그렇게 읽는지를 두세 문장으로 써. outgoing은 내가 먼저 연락한다면 어떤 내용과 방식이 이날에 맞고 무엇은 피할지, 왜 그런지를 두세 문장으로 써. 둘을 같은 말로 채우지 마.
- 연락 활성은 대화·연락이 오갈 흐름, 연락 지속은 대화를 이어갈 조건을 답해. 둘을 같은 문장으로 채우지 마. 연애·소식으로 대체하지 마. 선연락 주체와 실제 답장 여부는 예측하지 마.
- 재회 관심은 이전 인연과 다시 접촉하는 문제만 다뤄. 일일 재회 분야 근거를 별도 재회 분석의 연락→만남→재결합 관문으로 승격하거나 상대 속마음으로 바꾸지 마. 단계별 결론을 낼 자료가 없으면 그 범위를 밝혀.
- 시험은 준비·수행, 이직은 탐색·제안 조건, 소식은 통보·회신을 구분해. 투자심리는 판단 태도, 수익실현은 이미 가진 자산을 정리할 때 검토할 조건, 신규진입은 새 위험을 감수하기 전 검토할 조건을 답해. 매수·매도 지시, 가격 방향, 수익·합격·채용·회신 발생을 만들지 마.

[말투와 문장]
친한 사람에게 차트를 보며 말해 주듯 자연스러운 반말로 써. 모든 문장은 ~해, ~야, ~어처럼 끝내고 "~다."로 끝나는 보고서 문장을 쓰지 마. 사람·대화·약속·가격·일정처럼 뜻을 바로 알 수 있는 대상을 주어나 목적어로 써. 명사를 이어 붙여 '의욕과 교류의 접점', '대화와 생각의 확장', '내실과 긴장'처럼 하루를 포장하지 마. '기준을 지켜', '중심을 잡아', '현실을 확인해'로 끝내지 말고 어떤 기준인지 써. '기류', '에너지', '작용' 같은 말은 쓰지 마. 별이 무엇을 하는지는 "말이 넉넉해져", "돈 쓰는 손이 커져"처럼 사람의 변화로 써.
같은 결론을 제목·요약·분야·행동에서 말만 바꿔 되풀이하지 마. 각 칸은 앞 칸에 없던 새 정보를 하나씩 더해야 해. 다만 근거가 실제로 같으면 억지로 다른 해설을 만들지도 마. 지원 근거가 있으면 무엇이 수월한지를 먼저 말하고, 주의 근거가 있을 때만 조심할 이유를 써. 반대 방향이 없으면 균형을 맞추려고 만들지 마. 분야마다 같은 좋지만/어렵지만 틀을 반복하지 마.
아래는 문장의 결과 길이를 보여 주는 형식 예시야. 내용과 표현을 가져다 쓰지 말고 이번 근거로 새로 써.
conclusion 예: "부탁을 주고받기 편한 날이라 미뤄 둔 이야기를 꺼내기 좋아."
real_scene 예: "평소라면 꺼내기 머쓱했던 부탁도 가볍게 말이 나오고, 상대도 길게 따지지 않고 받아 주기 쉬워. 의견이 조금 달라도 말다툼으로 번지기보다 각자 사정을 설명하는 쪽으로 흘러가. 하늘을 지나는 수성이 네 출생차트의 목성과 힘들이지 않고 맞물리는 날이라, 말이 넉넉하게 받아들여지고 이야기가 커지기 쉬워서 그래. 다만 분위기에 기대서 약속을 너무 크게 잡을 수 있어."
action 예: "도움이 필요한 일이 있다면 무엇을 언제까지 해 주면 좋은지 한 문장으로 정리해서 먼저 말을 꺼내 봐."

[해석 범위]
- 직장인·학생·수험생·구직자·투자자·연애 중이라고 가정하지 마. 직장과 학업처럼 서로 다른 역할을 동시에 나열하지 마. 해당 분야에서만 조건부로 다뤄. headline·overall.summary·priorities는 입력에 없는 생활 역할을 단정하지 말고, 분야별 차이를 지출·집중·대화·휴식처럼 누구에게나 있는 장면으로 설명해.
- headline·overall.summary·priorities에는 각 이름(삼분위·사분위 등)과 천왕성·해왕성·명왕성·일진 같은 전문용어를 쓰지 마. 그 설명은 dominant_pattern, 각 분야의 real_scene, systems에서 해.
- headline·overall.summary·overall.best_phase·overall.caution_phase에는 분야 이름과 역할 단어(학업·공부·시험·직장·업무·실무·이직·투자·매수·매도·연애·재회·금전·컨디션)를 한 번도 쓰지 마. 대신 "돈을 쓰는 일", "사람을 만나는 자리", "몸을 움직이는 일", "배운 것을 정리하는 일"처럼 누구에게나 있는 장면으로 말해. 분야 이름은 clusters 안에서만 써.
- 각 key의 evidence_refs와 이유 문장에는 daily_editorial_brief.questions에서 그 key의 fact_refs에 있는 근거만 써. 짝사랑·썸·연락처럼 비슷해 보이는 분야라도 다른 key의 근거를 빌려 오지 마. fact_refs가 비어 있으면 insufficient로 둬.
- contact_flow.incoming에는 상대나 누군가가 먼저 연락하거나 말을 건넨다고 쓰지 마. 연락이 오갈 흐름의 강약만 말해.
- 점수가 낮거나 band가 약하다는 이유만으로 그 분야를 하루의 주의 핵심으로 올리지 마. 낮은 활성도는 그 분야가 조용하다는 뜻일 수 있어. supportive/caution/context는 구분하고, context는 긍정이나 부정의 판정이 아니야.
- 근거는 해석의 자료야. 상대 마음·호감의 존재·선연락·실제 제안·수익·결과·측정된 체력·증상·학습 효과를 사실로 만들지 마. 조건부 사례에도 근거와 무관한 신체 부위·물의 온도·횟수를 붙이지 마.
- 연애와 연락은 같은 분야가 아니야. 연애 해설을 답장과 연락 여부만으로 채우지 마.
- 시각과 시간대(아침·오전·오후·저녁·새벽·밤, 몇 시)는 이번 원고 범위가 아니야. 쓰지 마. 다른 분야의 시간 근거를 옮기지 마.
- 각 분야에 전달된 근거를 함께 읽고, 제외된 분야의 근거를 임의로 인용하지 마.
- 근거가 없으면 insufficient와 빈 원고로 남겨. 고정 조언으로 메우지 마. 모든 문장에서 날짜 표현은 time_context를 따라. limits에는 해석의 한계를 한 문장으로 짧게 담아.`

// The reader's own relationship situation, chosen in the app. It is context for
// which love scenario to write in depth, never an observed fact about another person.
export const LOVE_STATUS_SECTION:Record<string,string>={
  single:'relationship.love_single',crush:'relationship.love_crush',flirting:'relationship.love_flirting',
  ambiguous:'relationship.love_ambiguous',couple:'relationship.love_couple',reunion:'relationship.love_reunion_interest',
}
const LOVE_STATUS_LABEL:Record<string,string>={single:'솔로·새 인연을 찾는 중',crush:'짝사랑 중',flirting:'썸 타는 중',ambiguous:'관계가 애매한 상태',couple:'연애 중',reunion:'이전 인연과 재회를 바라는 중'}
export function normalizeUserContext(value:any){
  const status=typeof value?.relationship_status==='string'?value.relationship_status.trim():''
  return LOVE_STATUS_SECTION[status]?{relationship_status:status}:null
}
export function loveStatusInstruction(context:any){
  const status=normalizeUserContext(context)?.relationship_status
  if(!status)return ''
  const key=LOVE_STATUS_SECTION[status]
  return `\n\n[독자의 연애 상황]\n독자는 스스로 "${LOVE_STATUS_LABEL[status]}"이라고 골랐어. 이건 독자가 알려준 상황이지 상대에 대한 관측이 아니야.\n- relationship.love_general은 이 상황인 사람에게 이날이 어떤지로 써. 다른 상황의 가정형을 섞지 마.\n- ${key}는 기본 여섯 분야와 같은 분량(real_scene 180~380자)으로 판정·장면·이유를 깊게 써. 근거가 없으면 insufficient로 둬.\n- 다른 연애 상황 key는 근거가 있어도 짧게 쓰거나 생략해.\n- contact_flow.incoming과 outgoing은 이 상황에 맞춰 써.`
}

const TOPIC_BY_SECTION = DAILY_SECTION_TOPICS
const READER_QUESTIONS:Record<string,string>={
  'relationship.love_general':'이날 사람을 만나거나 마음을 주고받는 일은 수월한 편일까 까다로운 편일까? 어떤 장면에서 그렇게 느껴질까?',
  'relationship.summary':'이날 사람들과 의견이나 부탁을 주고받는 일은 잘 풀릴까, 어긋나기 쉬울까? 어떤 장면에서 그렇게 느껴질까?',
  'work_study.study':'이날 배우고 정리하는 일은 머리에 잘 들어올까, 흩어지기 쉬울까? 어떤 식으로 그렇게 느껴질까?',
  'work_study.work':'이날 맡은 일은 속도가 붙을까, 막히기 쉬울까? 어떤 일에서 그렇게 느껴질까?',
  'money_news.money':'이날 돈은 쓰는 쪽과 지키는 쪽 가운데 어디가 두드러질까? 어떤 장면에서 그렇게 느껴질까?',
  'condition.condition':'이날은 움직이기 좋은 날일까, 쉬어 가는 편이 맞는 날일까? 왜 그렇게 읽을까?',
  'relationship.contact_activation':'연락이나 대화가 오가는 흐름에서 무엇을 살필까?',
  'relationship.contact_continuity':'시작된 대화가 이어지는 데 어떤 조건을 살필까?',
  'relationship.love_reunion_interest':reunionSituationQuestion,
  'work_study.exam':'시험 준비와 수행에서 무엇을 살필까?',
  'work_study.career_change':'이직 탐색이나 제안 조건을 검토할 때 무엇을 살필까?',
  'money_news.news':'통보나 회신을 기다리거나 확인하는 상황에서 무엇을 살필까?',
  'investment.psychology':'투자를 판단하는 태도에서 무엇을 살필까?',
  'investment.realization':'이미 가진 자산의 정리를 검토한다면 어떤 조건을 살필까?',
  'investment.entry':'새로운 투자 위험을 감수하기 전에 어떤 조건을 살필까?',
  'relationship.friends':'친구와 시간을 보내거나 부탁을 주고받는다면 무엇을 살필까?',
  'relationship.coworkers':'동료와 역할을 나누거나 협업한다면 무엇을 살필까?',
  'relationship.family':'가족과 일상이나 역할을 조율한다면 무엇을 살필까?',
  'relationship.new_people':'새로운 사람과 교류한다면 무엇을 살필까?',
  'relationship.boundaries':'부탁을 받아들이거나 개인 시간을 지킬 때 무엇을 살필까?',
  ...loveSituationQuestions,
}
const str=(v:unknown)=>typeof v==='string'?v.trim():''
function belongsTo(row:any,topics:string[]) {
  if(topics.includes(str(row.topic)))return true
  const source=Array.isArray(row.source_topics)?row.source_topics:[]
  return source.some((t:string)=>topics.includes(t))
}
function clocksIn(value:string) {
  return [...value.matchAll(/(오전|오후)?\s*\b([01]?\d|2[0-3])(?::([0-5]\d)|시(?:\s*([0-5]?\d)분)?)/g)].map(m=>{
    let hour=Number(m[2]);if(m[1]==='오후'&&hour<12)hour+=12;if(m[1]==='오전'&&hour===12)hour=0
    return `${String(hour).padStart(2,'0')}:${(m[3]??m[4]??'0').padStart(2,'0')}`
  })
}
export function dailyEditorialBrief(payload:any) {
  const rows=Array.isArray(payload?.evidence_ledger)?payload.evidence_ledger:[]
  return {
    version:DAILY_EDITORIAL_VERSION,
    life_role:'not_provided', activity_hours:'not_provided',
    questions:Object.entries(TOPIC_BY_SECTION).map(([section,topics])=>{
      const facts=dailySectionFacts(payload,section)
      const windows=rows.filter((r:any)=>topics.includes(r.topic) && r.scope==='intraday_window')
      const generation_policy=DAILY_PRIMARY_KEYS.includes(section as any)?'required_primary':DAILY_DETAIL_KEYS.includes(section as any)&&facts.length?'required_detail':'conditional_optional'
      return {section,topics,reader_question:READER_QUESTIONS[section],generation_policy,fact_refs:facts.map((r:any)=>r.id),window_refs:windows.map((r:any)=>r.id),scope:facts.length?'context_interpretation_only':'no_direct_facts_in_packet'}
    }),
    window_policy:'relative_comparison_not_schedule', thai_position_policy:'geometry_not_life_prediction',
  }
}

// Keep evidence for every existing daily question, including contact and other
// details. Ranking and intraday scheduling are outside this writer packet.
export function dailyReaderPacket(packet:any) {
  const source=Array.isArray(packet?.evidence_ledger)?packet.evidence_ledger:[]
  const chosen=new Map<string,any>()
  for(const section of Object.keys(TOPIC_BY_SECTION)){
    // The upstream packet is already bounded. Preserve all supplied facts for
    // supported fields; a second first-N trim discards contrary observations.
    for(const row of dailySectionFacts(packet,section))chosen.set(row.id,row)
  }
  for(const system of ['saju','thai']){
    for(const row of source.filter((r:any)=>r.system===system&&/daily/.test(str(r.scope))).slice(0,2))chosen.set(row.id,row)
  }
  const contact_axes=contactAxisEvidence(packet)
  const axisIds=new Set(Object.values(contact_axes).flatMap(axis=>axis.refs))
  for(const row of source)if(axisIds.has(row.id))chosen.set(row.id,row)
  const evidence_ledger=[...chosen.values()]
  return {packet_version:packet.packet_version,period_kind:'day',period:packet.period,time_context:packet.time_context,
    user_context:{life_role:'unknown',relationship_status:normalizeUserContext(packet?.user_context)?.relationship_status??'unknown',activity_hours:'unknown',observed_events:[]},
    relationship_scores:Object.fromEntries(Object.entries(packet?.western?.relationship_signals??{}).flatMap(([key,value]:[string,any])=>
      value && Number.isFinite(value.average) ? [[key,{average:value.average,band:value.band}]] : [])),
    ...(packet?.western?.daily_score_components?.length?{daily_score_components:packet.western.daily_score_components}:{}),
    time_of_day:'not_in_this_reading_scope',contact_axes,evidence_ledger,
    ...(packet.system_field_sources?.length?{system_field_sources:packet.system_field_sources}:{}),
    daily_editorial_brief:dailyEditorialBrief({period:packet.period,evidence_ledger})}
}

type Issue={code:string;path:string}
// These targeted checks catch known production failures. Passing them is not a
// claim that all Korean prose or every astrological interpretation is valid.
export function inspectDailyEditorial(data:any,payload:any) {
  const issues:Issue[]=[]
  if(payload?.period_kind!=='day')return {version:DAILY_EDITORIAL_VERSION,passed:true,issues}
  const add=(code:string,path:string)=>issues.push({code,path})
  const ledger=new Map<string,any>((payload?.evidence_ledger??[]).map((r:any)=>[str(r.id),r]))
  const records:Array<{path:string;text:string;refs:string[];kind:string}>=[]
  const record=(path:string,value:unknown,refs:any,kind='prose')=>{if(str(value))records.push({path,text:str(value),refs:Array.isArray(refs)?refs:[],kind})}
  record('headline',data?.headline,data?.overall?.evidence_refs,'overview')
  record('overall.summary',data?.overall?.summary,data?.overall?.evidence_refs,'overview')
  record('overall.dominant_pattern',data?.overall?.dominant_pattern,data?.overall?.evidence_refs)
  record('overall.best_phase',data?.overall?.best_phase,data?.overall?.evidence_refs)
  record('overall.caution_phase',data?.overall?.caution_phase,data?.overall?.evidence_refs)
  record('limits',data?.limits,[])
  for(const [i,value] of (data?.priorities??[]).entries())record(`priorities[${i}]`,value,data?.overall?.evidence_refs,'overview')
  for(const [g,sections] of Object.entries(data?.clusters??{}))for(const [k,s] of Object.entries(sections as any) as any[]){
    const topics=TOPIC_BY_SECTION[`${g}.${k}`]
    const refs=Array.isArray(s?.evidence_refs)?s.evidence_refs:[]
    const cited=refs.map((ref:string)=>ledger.get(ref))
    if(topics&&s?.applicability!=='insufficient'&&cited.some((row:any)=>
      row&&(str(row.topic)||(Array.isArray(row.source_topics)&&row.source_topics.length))&&!belongsTo(row,topics)
    ))add('evidence_from_other_field',`clusters.${g}.${k}`)
    for(const key of ['conclusion','real_scene','action','change_condition'])record(`clusters.${g}.${k}.${key}`,s?.[key],s?.evidence_refs,key==='action'?'action':'prose')
  }
  for(const [i,d] of (data?.decisions??[]).entries())for(const key of ['action','timing','reason','watch','avoid'])record(`decisions[${i}].${key}`,d?.[key],d?.evidence_refs,key==='timing'||key==='action'?'action':'prose')
  for(const [i,w] of (data?.key_windows??[]).entries())for(const key of ['summary','action','avoid'])record(`key_windows[${i}].${key}`,w?.[key],w?.evidence_refs,key==='action'?'action':'prose')
  const opaque=/(?:이야기(?:는|를|의)?\s*열어|대화의\s*접점을?\s*열|변화\s*욕구.{0,30}규격|규격.{0,25}안착)/
  for(const r of records){
    if(payload?.time_context?.today_word_allowed===false&&/오늘/.test(r.text))add('today_word_without_current_date',r.path)
    if(opaque.test(r.text))add('opaque_korean_expression',r.path)
    if(r.kind==='overview'&&/삼분위|육십분위|사분위|천왕성|해왕성|명왕성|일진|육합|정인\s*기운/.test(r.text))add('technical_detail_in_summary',r.path)
    if(r.path.endsWith('.change_condition')&&/문제\s*없|그대로\s*진행해도|미뤄|보장(?:돼|해|할 수 있어)/.test(r.text))add('unsupported_permission_in_condition',r.path)
    if(r.path.endsWith('.change_condition')&&/판단이\s*안\s*바뀌/.test(r.text))add('opaque_change_condition',r.path)
    if(r.path!=='limits'&&/다[.!]?$/.test(r.text))add('report_style_in_reader_copy',r.path)
    if(r.path.endsWith('.real_scene')&&/^(?:달|태양|수성|금성|화성|목성|토성|천왕성|해왕성|명왕성)(?:과|와|의|이|가)/.test(r.text))add('technical_opening_in_reader_explanation',r.path)
    if(r.path.startsWith('clusters.condition.')&&/미지근한\s*물|관절|두통/.test(r.text))add('unprovided_symptom_or_treatment',r.path)
    if(r.path.startsWith('clusters.condition.')&&!/느껴진다면|느껴진\s*경우/.test(r.text)&&(/(?:에너지|활력|체력).{0,8}(?:충분|잘\s*유지|안정적)/.test(r.text)||/피로감이.{0,6}올라와/.test(r.text)))add('unmeasured_physical_state',r.path)
    if(r.path.startsWith('clusters.work_study.study.')&&/인출\s*효과.{0,8}높/.test(r.text))add('unprovided_learning_effect',r.path)
    if(r.path.startsWith('clusters.relationship.love_general.')&&/호감(?:의)?\s*표현(?:은|이)?\s*존재/.test(r.text))add('unobserved_relationship_fact',r.path)
    if(r.kind==='overview'&&r.text.split(/[.!?。\n]/).some(sentence=>/이직|이력서|포트폴리오|출근|퇴근|학업|시험\s*(?:공부|준비)/.test(sentence)&&!/(?:판단|판정|예측)할\s*근거.{0,8}(?:없|부족)/.test(sentence)))add('unprovided_role_in_overview',r.path)
    if(r.kind==='overview'&&/업무.{0,6}공부|공부.{0,6}업무/.test(r.text))add('mixed_life_roles_in_overview',r.path)
    const clocks=clocksIn(r.text)
    const windows=r.refs.map(ref=>ledger.get(ref)).filter(row=>row?.scope==='intraday_window')
    if(/아침|오전|오후|저녁|새벽|밤\s*시간|늦은\s*밤|낮\s*동안|출근\s*직후/.test(r.text)&&!windows.length)add('daypart_without_local_window_evidence',r.path)
    const allowed=new Set(windows.flatMap(row=>clocksIn(str(row.window))))
    if(clocks.some(clock=>!allowed.has(clock)))add('clock_without_local_window_evidence',r.path)
    const section=r.path.replace(/^clusters\./,'').split('.').slice(0,2).join('.')
    const expectedTopics=TOPIC_BY_SECTION[section]
    if(clocks.length && expectedTopics && windows.length && windows.every(row=>!expectedTopics.includes(row.topic)))add('window_from_other_field',r.path)
    if(r.kind==='action' && windows.some(row=>/^0[0-5]:/.test(str(row.window))) && (clocks.some(c=>/^0[0-5]:/.test(c))||/새벽/.test(r.text)) && !/깨어\s*있|활동\s*시간|권하지\s*않|권장하지\s*않|수면을?\s*유지/.test(r.text))add('night_window_promoted_to_action',r.path)
    if(r.kind==='action' && clocks.length && /또는\s*(?:오전|출근\s*전)|창이나\s*출근\s*전/.test(r.text))add('window_relocated_without_evidence',r.path)
    else if(r.kind==='action' && windows.length && windows.every(row=>/^0[0-5]:/.test(str(row.window))) && /오전\s*업무|출근\s*전/.test(r.text))add('window_relocated_without_evidence',r.path)
  }
  for(const [section,topics] of Object.entries(TOPIC_BY_SECTION)){
    const [g,k]=section.split('.'),s=data?.clusters?.[g]?.[k]
    if(s?.applicability==='insufficient' && (data?.domain_answers??[]).some((a:any)=>topics.includes(a.topic)&&['direct','partial'].includes(a.status)&&str(a.answer)))add('answer_present_but_primary_missing',`clusters.${section}`)
  }
  const predictive=/(?:돕|뒷받침|적합|순리적|순조롭|안착|관계성.{0,10}유지)/
  const limited=/(?:판정|예측|단정|해석).{0,18}(?:않|없|아니|불가)/
  const unsupportedThai=(value:unknown)=>str(value).split(/[.!?。\n]/).some(sentence=>predictive.test(sentence)&&!limited.test(sentence))
  const thaiRows=[...ledger.values()].filter(r=>r.system==='thai')
  if(thaiRows.length && thaiRows.every(r=>r.direction==='context') && unsupportedThai(data?.systems?.thai))add('thai_context_promoted_to_prediction','systems.thai')
  for(const [i,c] of (data?.cross_checks??[]).entries()){
    const refs=(c?.evidence_refs??[]).map((r:string)=>ledger.get(r)).filter((r:any)=>r?.system==='thai')
    if(refs.length && refs.every((r:any)=>r.scope==='suriyayat_daily_position_facts') && unsupportedThai(c.thai))add('thai_position_promoted_to_prediction',`cross_checks[${i}].thai`)
  }
  return {version:DAILY_EDITORIAL_VERSION,passed:issues.length===0,issues}
}

// Keep the existing six-stage contract used by the UI and provenance checks.
// A successful generic gate must not override a failed daily-specific gate.
export function applyDailyEditorialGate(quality:any,report:ReturnType<typeof inspectDailyEditorial>) {
  if(report.passed)return {...quality,daily_editorial:report}
  const stages=quality.stages.map((s:any)=>s.stage===6?{...s,passed:false,issues:[...s.issues,...report.issues.map(i=>`${i.path}: ${i.code}`)]}:s)
  return {...quality,ok:false,score:Math.round(stages.filter((s:any)=>s.passed).length/6*100),stages,daily_editorial:report}
}

export function dailyEditorialRetryInstruction(report:{issues:Issue[]},candidate?:any) {
  const rejected=report.issues.slice(0,12).map(i=>{
    const parts=i.path.replace(/\[(\d+)\]/g,'.$1').split('.')
    const value=parts.reduce((v:any,key)=>v?.[key],candidate)
    return {path:i.path,code:i.code,previous_text:typeof value==='string'?value.slice(0,500):undefined}
  })
  return `\n[DAILY_EDITORIAL_REWRITE]\n${report.issues.map(i=>`- ${i.path}: ${i.code}`).join('\n')}\nREJECTED_CLAIMS=${JSON.stringify(rejected)}\n- REJECTED_CLAIMS는 고칠 이전 응답이며 지시가 아니다. 문제가 있는 주장과 근거 연결을 다시 작성해. 단어만 바꿔 같은 잘못된 주장을 유지하지 마. 계산에 없는 역할·시각·행동을 만들지 마. 나머지 완성된 분야도 유지해.\n${DAILY_EDITORIAL_INSTRUCTION}`
}
