import type { FortuneStat, IntegratedApiResponse } from '../appTypes'
import type { AuthoredReadingDocument } from './authoredReadingDocument'
import type { MonthSupplement } from './monthlyLoveSupplement'
import { fortuneEvidenceSnapshot } from './fortuneToneCalibration.ts'
import { westernPeriodFact } from './systemPeriodFacts.ts'

type Question = { topic: string; application: string; weak: string; strong: string }

// The topic names refer to existing western calculations. Each situation is a
// way of reading that topic, not a separately scored person or event.
const questions: Record<string, Question> = {
  'relationship.love_general': {
    topic: '연애',
    application: '호감을 느낀 장면이 있다면, 그 뒤 두 사람의 선택이 어떻게 이어졌는지 봐. 한 번 즐겁게 대화한 일과 둘이 다시 시간을 내서 만난 일은 서로 다른 단서야.',
    weak: '먼저 호감이 생겨도 한 번의 즐거운 만남에 너무 많은 의미를 얹기 쉬워. 다음 만남도 둘이 함께 잡는지 보면 내 기대와 실제 관계의 속도를 구분할 수 있어.',
    strong: '함께할 일을 제안해 보기 좋은 흐름이야. 둘 다 즐겼던 일을 다시 꺼내 보고, 상대도 시간을 내거나 다른 날짜를 보태는지 봐.',
  },
  'relationship.love_single': {
    topic: '연애',
    application: '이번 주에 새로운 인연을 찾고 싶다면 낯선 사람과 자연스럽게 말을 섞을 수 있는 자리를 골라 봐. 취미 모임처럼 함께 할 일이 있으면 처음부터 호감을 표현해야 한다는 부담이 작아. 그 자리에서 유독 더 알고 싶은 사람이 생겼는지가 네 첫 단서야.',
    weak: '소개나 모임에서 눈에 띄는 사람이 없어도 그날의 성패를 정할 필요는 없어. 대화가 편했던 한 사람과 다음에 다시 얘기할 소재를 남겨 봐.',
    strong: '새 사람에게 관심을 보일 여지가 큰 주야. 평소라면 듣고만 있었을 자리에서 네가 좋아하는 얘기를 먼저 꺼내 봐. 여럿과 이야기한 뒤 유독 편했던 사람이 있다면 어떤 점에 끌렸는지 짚어 볼 수 있어.',
  },
  'relationship.love_crush': {
    topic: '연애',
    application: '좋아하는 사람에게 먼저 말을 걸었다면 답장이 빨랐는지보다 대화가 어떻게 이어졌는지가 중요해. 상대도 네 이야기를 물어왔거나 지난 대화를 기억해 다시 꺼냈다면 다음에 말을 걸 실마리가 있어. 짧게 답하고 끝났다면 그 한 번으로 마음을 정해 읽지는 마.',
    weak: '답장이 짧거나 늦었다는 사실 하나로 거절이라고 읽기 쉬워. 먼저 말을 건 뒤 상대가 질문을 돌려줬는지, 다른 날 스스로 대화를 시작했는지 함께 보면 판단이 덜 흔들려.',
    strong: '한동안 마음에 둔 사람이 있다면 좋았던 점 하나를 솔직히 말해 볼 만해. 칭찬에 고맙다고 답하는 것과 네 이야기를 먼저 더 묻는 데에는 차이가 있어. 그 차이를 보면 어디까지 마음을 보여줄지 정하기 쉬워.',
  },
  'relationship.love_flirting': {
    topic: '연애',
    application: '둘이 호감을 주고받는 중이라면 즐거웠던 대화 하나를 구체적인 약속으로 이어 봐. 상대가 제안한 날에 어렵더라도 다른 날이나 장소를 먼저 보태는지 살펴봐. 연락 횟수보다 다음 만남을 둘이 함께 만드는지가 관계의 속도를 더 잘 보여줘.',
    weak: '대화가 잦아도 다음 약속을 늘 한쪽만 정한다면 관계는 같은 자리에 머물 수 있어. 이번엔 가능한 날을 한 번 건네고 상대가 날짜나 장소를 보태는지 기다려 봐.',
    strong: '이미 주고받은 호감을 다음 만남으로 옮겨 볼 만해. 가볍게 나온 이야기를 구체적인 약속으로 꺼내고, 두 사람 모두 시간을 내는지 봐.',
  },
  'relationship.love_ambiguous': {
    topic: '연애',
    application: '만나기는 하는데 서로 어떤 사이인지 모호하다면 먼저 네가 바라는 것을 한 가지로 좁혀 봐. 다음 만남을 미리 정하고 싶은 건지, 둘만 만나는 관계를 원하는 건지에 따라 물어볼 내용이 달라져. 그때 들은 답과 이후 약속을 지키는 모습까지 함께 봐.',
    weak: '관계를 정하고 싶은 마음과 상대가 실제로 약속한 범위가 다를 수 있어. “다음 만남은 미리 잡고 싶어”처럼 지금 가장 답답한 점부터 말하면 무엇이 달라질 수 있는지 알기 쉬워.',
    strong: '관계의 방향을 물어보고 싶었다면 기대 한 가지를 꺼내 봐. 둘만 만나고 싶은 건지, 더 자주 보고 싶은 건지 구체적으로 말하고 상대가 원하는 방식도 들어 봐.',
  },
  'relationship.love_couple': {
    topic: '연애',
    application: '연애 중이라면 이번 주에 둘이 같이 쓰고 싶은 시간과 각자 쉬고 싶은 시간을 먼저 맞춰 봐. 연락이 뜸한 날 서운했다면 그날 바랐던 행동을 하나만 말해 봐. “바쁠 때는 퇴근하고 한 번 알려줘”처럼 두 사람이 지킬 수 있는 약속이 좋아.',
    weak: '연락이 줄어 서운했다면 최근 한 장면을 골라 그때 바랐던 걸 말해 봐. 서로 피곤한 날에는 긴 대화를 잡기보다 다음에 차분히 이야기할 시간을 정하는 편이 좋아.',
    strong: '서로에게 고마웠던 행동을 말로 되짚어 보기 좋아. 편안했던 데이트나 같이 쉬던 시간을 한 번 더 정해 두면 좋은 기억을 이번 주 생활 속에서 이어갈 수 있어.',
  },
  'relationship.contact_activation': {
    topic: '연락',
    application: '기다리는 연락이 있다면 답이 필요한 이유부터 구분해 봐. 약속 시간이나 장소를 정해야 한다면 그 내용 하나를 물으면 돼. 안부가 궁금한 경우에는 한 번 건넨 뒤 실제 답이 오는지 보고 다음 대화를 정해.',
    weak: '기다리는 답이 꼭 필요한 약속이라면 확인할 내용과 기한을 짧게 적어 한 번 물어봐. 안부를 나누는 상황이라면 답이 올 때까지 새 메시지를 거듭 보내기보다 상대가 대화를 이을 자리를 남겨 둬.',
    strong: '연락할 이유가 있다면 부담 없이 말을 꺼낼 만해. 함께 나눈 이야기나 결정할 약속이 있으면 첫 메시지에 담아 봐. 그 뒤의 흐름은 상대가 실제로 보내온 답에서 읽어.',
  },
  'relationship.contact_continuity': {
    topic: '연락',
    application: '이미 연락이 닿았다면 중요한 건 첫 답장 다음이야. 둘 다 질문을 보태는지, 대화가 끝난 뒤 다른 날에도 한쪽만 먼저 말을 꺼내는지 살펴봐. 약속을 제안했을 때 상대도 시간을 조율한다면 대화를 이어갈 구체적인 소재가 생겨.',
    weak: '답이 한 번 왔어도 대화가 자연스럽게 계속된다고 보기엔 이른 주야. 짧은 응답으로 끝났다면 새 질문을 연달아 던지기보다 상대도 나중에 먼저 말을 꺼내는지 봐.',
    strong: '이미 답을 주고받았다면 지난번 이야기를 이어가기 좋아. 상대도 질문을 보태거나 다음 대화에서 먼저 그 얘기를 꺼낸다면 대화가 쌍방으로 이어지고 있다는 단서야.',
  },
  'relationship.love_reunion_interest': {
    topic: '재회',
    application: '과거 인연에게 연락이 닿는 일과 다시 교제하기로 하는 일 사이에는 확인할 게 있어. 안부를 나눈 뒤 서로 다음 만남을 원했는지, 예전에 멀어진 이유를 지금은 이야기할 수 있는지 봐. 만남이 실제로 한 번 더 이어졌을 때 관계를 다시 생각할 근거가 늘어나.',
    weak: '예전 인연에게서 소식이 올 기대로 한 주를 잡아 두기엔 흐름이 약해. 이미 연락이 닿았다면 과거에 대화가 끊겼던 대목을 다시 이야기할 수 있는지 봐. 그 얘기를 둘 다 계속 피한다면 반가웠던 안부와 관계를 회복할 준비는 따로 읽어야 해.',
    strong: '그동안 하지 못한 이야기를 꺼낼 계기를 살펴볼 만한 주야. 이미 만나고 있다면 예전에 멀어졌던 상황이 다시 생길 때 이번에는 무엇을 달리할지 물어봐. 둘 다 실제로 바꿀 행동을 말할 수 있다면 재접촉 이후의 진전을 살필 단서가 생겨.',
  },
  'relationship.summary': {
    topic: '대인관계',
    application: '몇 사람의 의견을 맞춰야 한다면 각자 정할 수 있는 일부터 확인해. 의견이 잘 맞았더라도 담당자나 날짜가 비어 있으면 다음 대화에서 같은 이야기를 반복하게 돼. 합의된 한 가지를 먼저 실행해 봐.',
    weak: '여러 의견이 엇갈리면 모든 사람의 결론을 한 번에 맞추기 어려워. 지금 결정해야 하는 한 가지와 나중에 정해도 될 일을 나누고 각자 가능한 범위를 들어 봐.',
    strong: '사람들과 뜻을 모을 일이 있다면 먼저 나온 합의부터 실행으로 옮겨 봐. 담당자와 날짜를 함께 정하면 대화에서 얻은 공감이 실제 협력으로 이어질 수 있어.',
  },
  'relationship.friends': {
    topic: '대인관계',
    application: '친구에게 먼저 연락할지 고민된다면 최근 둘이 하다 만 이야기를 떠올려 봐. 같이 가기로 했던 곳이나 미뤄 둔 약속을 꺼내면 막연한 안부보다 답할 거리가 생겨. 상대가 바쁘다고 하면 가능한 날을 다시 건네는지까지 봐.',
    weak: '만날 시간이 엇갈렸다면 한 번 미뤄진 약속만으로 거리감을 단정하지 마. 친구에게 편한 때를 물어보고 다른 날을 먼저 제안하는지 봐.',
    strong: '함께하고 싶었던 일을 먼저 꺼내기 좋은 주야. “언제 보자”보다 둘이 좋아하던 곳과 가능한 날 하나를 건네면 약속을 잡기 쉬워.',
  },
  'relationship.coworkers': {
    topic: '대인관계',
    application: '동료와 일을 나눌 때 “여기까지 하면 끝”이라는 기준이 서로 같은지 확인해. 자료를 넘기는 것까지인지 최종 수정까지인지에 따라 일정이 달라질 수 있어. 중간에 한 번 확인할 시점을 같이 정해 두면 마지막에 일이 몰리는 걸 줄일 수 있어.',
    weak: '자료를 넘겼는데 다음 작업이 멈춰 있다면 담당 범위가 어긋났을 수 있어. 누가 수정하고 누가 최종 확인할지를 짧게 맞춰 봐.',
    strong: '협업 제안을 꺼낼 일이 있다면 같이 끝내고 싶은 결과부터 보여 줘. 각자 잘하는 일을 나눈 뒤 중간에 결과를 맞춰 볼 시간을 정해 봐.',
  },
  'relationship.family': {
    topic: '대인관계',
    application: '가까운 사람이 고민을 꺼내면 해결책이 필요한지, 일단 들어주면 되는지 물어봐. 평소 잘 아는 사이라도 그날 원하는 도움은 다를 수 있어. 부탁을 받았다면 지금 가능한 만큼을 구체적으로 알려 줘.',
    weak: '가족의 부탁이 겹치면 가능한 시간을 먼저 알려 줘. 고민을 털어놓는 사람에게는 직접 도와주길 원하는지, 이야기를 들어주면 되는지 물어봐.',
    strong: '가까운 사람과 편하게 이야기를 나눌 기회를 만들어 봐. 지난번에 들은 일을 다시 물어보면 상대가 그 뒤의 이야기를 꺼낼 여지가 생겨.',
  },
  'relationship.new_people': {
    topic: '대인관계',
    application: '처음 보는 사람이 많은 자리라면 여러 사람에게 두루 인사한 뒤 기억나는 대화 하나를 골라 봐. 나중에 다시 말을 걸 때 그때 나온 관심사를 꺼내면 상대도 이야기를 잇기 쉬워. 한 번의 인사 이후 서로 대화를 이어가는지 살펴봐.',
    weak: '낯선 자리에서 어색했다면 많은 사람과 연락을 이어야 한다고 부담을 갖지 마. 다시 묻고 싶은 이야기가 남은 한 사람에게만 말을 건네 봐.',
    strong: '새 모임에 갈 계획이 있다면 대화가 잘 통했던 사람에게 다음에 함께할 일을 제안해 봐. 공통 관심사를 짚으면 다음 대화의 첫마디가 자연스러워져.',
  },
  'relationship.boundaries': {
    topic: '대인관계',
    application: '반복되는 부탁이 부담스럽다면 도와줄 수 있는 부분과 어려운 부분을 한 번에 알려 줘. “오늘은 초안만 볼 수 있어”처럼 범위를 정하면 도움을 주면서도 내 일정을 지킬 수 있어. 그 뒤 상대가 그 범위를 존중하는지도 확인해.',
    weak: '내 일정을 넘기는 부탁이 반복되면 가능한 일과 어려운 일을 한꺼번에 말해 봐. 범위를 알려 준 뒤에도 같은 요구가 이어지는지가 중요한 단서야.',
    strong: '함께할 일이 늘어날수록 처음에 나눈 역할이 중요해. 도울 수 있는 시간과 맡을 일을 먼저 정하면 친근한 분위기를 지키면서 무리한 약속을 줄일 수 있어.',
  },
  'money_news.news': {
    topic: '소식',
    application: '발표나 회신을 기다리는 일이 있다면 확인할 날짜와 공식 경로를 구분해 둬. 공지문을 읽을 때는 결과 발표일과 그 뒤 제출해야 할 서류의 마감일을 따로 적어 봐. 이번 주 소식 점수만으로 기관의 실제 발표 날짜를 알 수는 없어.',
    weak: '회신을 기다리는 중이라면 계속 새로고침하기보다 안내된 발표 일정과 연락처를 확인해. 답이 필요한 마감이 있다면 문의할 날을 따로 정해 둬.',
    strong: '소식이나 제안을 접했다면 전달받은 요약을 그대로 믿기 전에 원문을 열어 봐. 결과 발표와 후속 제출 기한을 각각 확인하면 실제로 움직일 때를 놓치지 않아.',
  },
  'work_study.study': {
    topic: '학업',
    application: '이번 주에 익힌 내용을 다음 공부 시간에 책을 덮고 설명해 봐. 말이 막힌 대목이 개념 자체인지, 문제에서 그 개념을 알아보는 단계인지에 따라 복습할 내용이 달라져. 다시 볼 문제를 그 이유와 함께 한두 개 남겨 둬.',
    weak: '읽었는데도 기억이 안 나는 대목이 있다면 진도를 늘리기 전에 예제 하나를 다시 풀어 봐. 어디서 막혔는지 적으면 다음 공부에서 복습 범위를 좁힐 수 있어.',
    strong: '집중할 시간을 잡을 수 있다면 미뤄 둔 어려운 단원 하나에 써 봐. 공부가 끝나면 책을 덮고 같은 원리를 다른 문제에 적용해 이해한 부분을 확인해.',
  },
  'work_study.exam': {
    topic: '시험',
    application: '시간을 정해 문제를 풀어 본 뒤 틀린 이유를 나눠 봐. 개념을 몰랐다면 그 부분을 다시 배우고, 알고도 마지막에 놓쳤다면 다음 풀이에서 확인할 표시를 정해. 모의 점수 하나에 맞춰 계획 전체를 바꾸기보다 같은 실수가 반복되는지 보는 게 좋아.',
    weak: '시간 압박을 받는다면 틀린 문제를 개념 부족과 풀이 순서 실수로 나눠 봐. 같은 실수가 반복되는 유형 한 가지에 다음 연습 시간을 먼저 써.',
    strong: '실전 연습을 해 보고 싶다면 제한 시간을 정해 한 세트를 풀어 봐. 맞혔어도 시간이 오래 걸린 문제까지 표시하면 다음 훈련 과제를 찾을 수 있어.',
  },
  'work_study.work': {
    topic: '직장',
    application: '업무 두 개의 마감이 겹치면 먼저 결정이 필요한 부분을 담당자에게 짚어 줘. 상대의 답이 있어야 진행할 수 있는 일과 지금 혼자 끝낼 일을 나누면 기다리는 동안 쓸 시간이 생겨. 변경한 일정은 함께 일하는 사람에게도 알려 줘.',
    weak: '진행이 막힌 일은 답을 기다려야 하는 부분과 혼자 마칠 수 있는 부분을 나눠 봐. 기한을 지키기 어렵다면 마지막 날까지 기다리지 말고 무엇이 필요한지 먼저 알려 줘.',
    strong: '일을 밀고 나가고 싶다면 협의가 끝난 과제부터 결과물을 만들어 봐. 새 요청까지 동시에 맡기 전에는 마감과 담당 범위를 한 번 맞춰 둬.',
  },
  'work_study.career_change': {
    topic: '이직',
    application: '관심 가는 공고나 제안이 있으면 이번 주에 확인할 조건부터 적어 봐. 같은 직무명이라도 실제 담당 업무와 근무지가 다르면 선택이 달라져. 지원 의사, 면접 제안, 확정된 이동은 각각 채용처의 안내가 왔을 때 구분해서 판단해.',
    weak: '공고를 보고 마음이 급해졌다면 지원 마감, 근무지, 실제 담당 업무부터 확인해. 조건이 맞지 않는 제안에는 준비 시간을 모두 쓰지 않아도 돼.',
    strong: '관심 두던 자리가 있다면 공고의 필수 조건과 내 경험을 하나씩 맞춰 봐. 맞는 경험이 분명한 자리부터 지원 자료를 다듬고 제안 여부는 채용처의 연락으로 확인해.',
  },
  'money_news.money': {
    topic: '금전',
    application: '이번 주에 나갈 돈을 적을 때 결제 예정액과 아직 확정되지 않은 약속 비용을 나눠 봐. 받을 돈이 늦어져도 먼저 낼 수 있는 항목이 무엇인지 확인해 두면 일정이 겹칠 때 선택하기 쉬워.',
    weak: '결제일이 몰린다면 받을 돈을 미리 잔액에 넣기 전에 지금 낼 수 있는 고정비부터 따져 봐. 미룰 수 있는 지출을 구분하면 일정이 겹쳐도 선택하기 쉬워.',
    strong: '정산이나 비용 조율을 미뤄 뒀다면 금액과 지급일을 확인해 봐. 들어올 돈을 계획에 쓰기 전에는 상대와 합의한 금액과 실제 입금액을 맞춰 봐.',
  },
  'investment.psychology': {
    topic: '투자심리',
    application: '가격을 자주 확인하게 되는 날에는 처음 적어 둔 판단 근거가 실제로 바뀌었는지 봐. 새로운 공시가 나온 경우와 가격만 움직인 경우를 나눠 적으면 무엇 때문에 마음이 급해졌는지 알기 쉬워.',
    weak: '시장에 마음이 덜 가는 주에는 보유 이유가 달라진 종목만 골라 공시를 확인해 봐. 확인 횟수가 줄었다는 사실만으로 투자 판단을 바꿀 이유는 없어.',
    strong: '가격 움직임에 따라 매매하고 싶은 마음이 커질 수 있어. 주문하기 전에 처음 판단의 근거가 바뀐 건지, 가격을 본 뒤 감정만 달라진 건지 적어 봐.',
  },
  'investment.realization': {
    topic: '수익실현',
    application: '보유 자산을 정리할지 고민된다면 정해 뒀던 목표, 비용, 현금이 필요한 날짜를 다시 맞춰 봐. 셋 중 어느 조건이 바뀌었는지 확인해야 가격이 잠깐 움직였을 때도 일관된 판단을 할 수 있어. 이 지표로 매도할 날짜나 수익률을 정할 수는 없어.',
    weak: '정리할지 망설인다면 예정된 현금 지출과 보유 비용을 먼저 확인해 봐. 매도할 이유가 바뀌었는지 살피는 데 쓰고 점수에서 가격 방향을 읽지는 마.',
    strong: '수익을 확정하고 싶은 마음이 든다면 처음 정한 목표와 비용을 다시 맞춰 봐. 실제 매도 판단에는 현재 가격과 필요한 현금부터 확인해야 해.',
  },
  'investment.entry': {
    topic: '신규진입',
    application: '새로 관심이 간 자산이 있다면 진입을 검토한 이유와 그 생각을 바꿀 조건을 함께 적어 봐. 현재 가격만 보고 이유가 달라졌다면 성급히 결론을 내리기 쉬워. 이번 주 점수는 관심이나 판단을 돌아보는 참고 자료야.',
    weak: '새 자산을 보고도 판단 근거가 모이지 않는다면 공시와 비용부터 확인해. 어느 조건에서 생각을 바꿀지 적어 두면 서둘러 들어가야 한다는 부담을 줄일 수 있어.',
    strong: '새 투자처가 유독 눈에 띈다면 관심이 생긴 계기를 적어 봐. 새 정보가 나온 경우와 가격만 오른 경우를 구분한 뒤 실제 진입 조건을 따로 검토해.',
  },
  'condition.condition': {
    topic: '컨디션',
    application: '일정이 몰린 날 앞뒤로 쉬는 시간이 충분했는지 살펴봐. 같은 분량을 해도 유독 힘들었던 날이 있다면 수면과 약속 시간을 같이 기록해 둬. 다음 일정을 잡을 때 실제로 지쳤던 구간을 먼저 비워 두는 데 도움이 돼.',
    weak: '일정을 연달아 잡기 전 최근 피로가 쌓였던 시간대를 떠올려 봐. 꼭 해야 하는 일 사이에 쉬는 시간을 미리 비워 두면 계획을 지키기 쉬워.',
    strong: '해 보고 싶던 활동이 있다면 기존 일정 뒤에 회복할 시간까지 함께 잡아 봐. 실제 컨디션이 평소와 다르면 당일의 수면과 피로에 맞춰 분량을 조절해.',
  },
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

function weekShape(calculation:IntegratedApiResponse, topic:string) {
  const {start,end} = calculation.period
  const days = (calculation.western.daily_scores ?? [])
    .filter(day => Number.isFinite(isoDay(day.date)) && day.date >= start && day.date <= end && Number.isFinite(day.scores?.[topic]))
    .map(day => ({date:day.date, score:Number(day.scores[topic])}))
    .sort((a,b) => a.date.localeCompare(b.date))
  if (new Set(days.map(day=>day.date)).size !== 7 || days.length !== 7) return ''
  const max = Math.max(...days.map(day=>day.score))
  const min = Math.min(...days.map(day=>day.score))
  const format = (date:string) => Number(date.slice(5,7))+'월 '+Number(date.slice(8))+'일'
  if (max === min) return '일곱 날의 값이 같아서 이번 주 안에 특정 날짜가 더 두드러지지는 않아. '
  // Report a single peak or valley only when it is unique.
  const peaks = days.filter(day=>day.score === max)
  const lows = days.filter(day=>day.score === min)
  if (peaks.length !== 1 || lows.length !== 1) return ''
  const high = peaks[0], low = lows[0]
  return high.date > low.date
    ? `${format(low.date)}에는 ${low.score}점이었고 ${format(high.date)}에 ${high.score}점으로 이번 주 가장 높아. `
    : `${format(high.date)}에 ${high.score}점으로 가장 높았고 ${format(low.date)}에는 ${low.score}점까지 낮아져. `
}

export function weeklyPeriodSupplements(doc:AuthoredReadingDocument, calculation:IntegratedApiResponse):MonthSupplement[] {
  const {start,end} = calculation.period
  if (doc.state==='unverified' || isoDay(end)-isoDay(start)!==6*86400000 || doc.date!==`${start} → ${end}`) return []

  return doc.sections.flatMap(section=>{
    const question = questions[section.id]
    if (section.state!=='missing' || !question) return []
    const {topic} = question
    const stat = calculation.western.overall?.[topic]
    if (!validStat(stat)) return []
    const signal = calculation.western.relationship_signals
    // For starting a conversation use the scored outgoing direction when present.
    // The combined contact score cannot distinguish initiating from receiving.
    const decisionStat = section.id === 'relationship.contact_activation' && validStat(signal?.발신적합)
      ? signal.발신적합 : stat
    const application = /약함|낮음/.test(decisionStat.band) ? question.weak
      : /강함|보통 이상|높음/.test(decisionStat.band) ? question.strong : question.application
    const directional = section.id==='relationship.contact_activation' ? directionContext(calculation) : ''
    const lead = directional || `이번 주 ${topic} 지표는 ${stat.average}점(${stat.band})이야. `
    const facts = westernPeriodFact(stat,start,end)
    const aspects = fortuneEvidenceSnapshot(calculation,topic)
    const evidence = [facts,aspects.support && `도움이 되는 배치 · ${aspects.support}`,
      aspects.challenge && `부담이 되는 배치 · ${aspects.challenge}`,aspects.neutral && `함께 작용하는 배치 · ${aspects.neutral}`].filter(Boolean).join(' / ')
    return [{id:section.id,label:section.label,text:lead+(directional ? '' : weekShape(calculation,topic))+application,evidence}]
  })
}
