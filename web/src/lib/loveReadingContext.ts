import type { FortuneStat, IntegratedApiResponse } from '../appTypes'
import type { FortuneUserSummary } from './fortuneUserSummary'

export type LoveStatus = 'single' | 'flirting' | 'intimate_uncommitted' | 'couple'
export function lovePromptContext(status: LoveStatus) {
  return `LOVE_STATUS=${status}\n${status === 'single'
    ? '미혼 싱글의 연애운이다. 현재 연인이 있다고 전제하지 말고 새 인연·소개팅, 썸·알아가는 사이, 친밀하지만 관계가 미정인 사이, 과거 인연을 한 화면의 별도 해설로 다룬다. 여러 상황이 동시에 있을 수 있으며 하나를 고르게 하지 않는다. 각 상황은 해당하는 경우에만 읽도록 조건부로 설명한다. 소개팅이 들어온다는 사건 예측은 직접 근거가 없으면 하지 않는다. 특정 상대의 존재·감정을 만들지 않는다. 과거 인연은 실제 과거인연접점 계산 근거가 있을 때만 흐름과 시기를 설명하고 재접촉을 관계 회복으로 바꾸지 않는다.'
    : status==='flirting' ? '미혼 싱글이며 썸·알아가는 상대가 있다. 첫 만남이 없는 상태나 이미 연인인 상태로 바꾸지 않는다. 서로의 질문·연락·다음 약속·관계 확인 대화를 다루되 상호 호감과 관계 성립은 단정하지 않는다.' : status==='intimate_uncommitted' ? '미혼 싱글이며 신체적 친밀감은 있으나 연인 관계로 합의하지 않은 상황이다. 신체적 끌림, 정서적 기대, 연락과 만남의 일관성, 동의·경계, 원하는 관계를 따로 해석한다. 성관계를 사랑이나 독점적 관계의 증거로 삼지 말고 연애 발전을 필수 목표로 삼지 않는다.' : '미혼 커플의 연애운이다. 현재 연인과의 대화·데이트·거리 조율을 중심으로 읽는다. 새 연애상대나 배우자를 예측하지 않는다.'} 수신과 발신은 분리한다. 개인 차트의 활성도를 상대의 마음이나 궁합으로 바꾸지 않는다.\n`
}

// A presentation lens over existing scores/evidence. No additional calculation or request.
export function applyLoveContext(summary: FortuneUserSummary, calculation: IntegratedApiResponse, status: LoveStatus): FortuneUserSummary {
  const single = status === 'single'
  const flirting = status === 'flirting'
  const intimate = status === 'intimate_uncommitted'
  const contextLabel = single?'싱글 · 만남과 관계':flirting?'싱글 · 썸·알아가는 중':intimate?'싱글 · 친밀하지만 미정':'커플 · 현재 관계'
  const copy = (topic: string, stat?: FortuneStat | null) => {
    const score = stat?.average
    const band = stat?.band ?? '정보 부족'
    const low = /약|낮/.test(band) || (Number.isFinite(score) && score! < 40)
    const high = !low && (/강|높/.test(band) || (Number.isFinite(score) && score! >= 60))
    const title = flirting ? (topic==='연애'?'썸과 관계 탐색':'알아가는 상대와 연락') : intimate ? (topic==='연애'?'친밀감과 관계 기대':'친밀한 상대와 연락·만남') : topic === '연애' ? single ? '만남과 호감' : '현재 연인과의 교류' : single ? '첫 인사와 이어가는 대화' : '연인과의 연락'
    const direction = !Number.isFinite(score) ? '방향을 판단할 계산 정보가 부족해.' : low ? '활성도가 약하게 잡혀 있어.' : high ? '활성도가 상대적으로 높게 잡혀 있어.' : '활성도는 중간 범위에 있어.'
    const action = flirting ? (topic==='연애'?'서로 질문을 주고받는지, 다음 만남을 실제 일정으로 잡는지 살펴. 관계를 확인하고 싶다면 내 기대를 말하고 상대가 원하는 방식도 들어봐.':'답장 속도 하나보다 서로 먼저 연락하는지와 약속을 지키는지를 함께 봐. 대화가 편안해도 연인으로 합의한 사이인지는 별도로 확인할 일이야.') : intimate ? (topic==='연애'?'몸이 가까웠다는 사실과 서로 원하는 관계는 따로 확인해. 연애를 원하는지, 부담 없는 만남을 원하는지, 지금 방식이 편안한지를 말로 맞춰볼 수 있어.':'만남 전후의 연락과 약속이 내가 원하는 방식에 맞는지 살펴. 친밀한 만남의 유무로 애정을 단정하지 말고, 연락 빈도·만남 방식·경계에서 불편한 점을 구체적으로 이야기해.') : topic === '연애'
      ? single ? '만날 사람이 아직 없다면 믿는 지인에게 소개를 부탁하거나 부담 없는 모임에 시간을 낼지 검토해. 소개팅 제의가 들어온 경우에는 상대 조건보다 내가 만남을 원하는지, 일정과 방식이 편안한지부터 확인해.' : '함께 보낼 시간과 각자 쉴 시간을 구체적으로 맞춰. 서로 원하는 데이트 방식이 같은지도 이야기해.'
      : single ? '새 사람을 만나고 싶다면 지인에게 소개를 부탁하거나 첫 인사를 건네봐. 알아가는 사람이 있다면 안부나 다음 약속을 꺼낼 수 있어. 과거 인연에게 연락하고 싶다면 재접점 해설도 함께 읽어. 지금 연락할 일이 없다면 이 항목은 넘겨도 돼.' : '연락 빈도나 답장 속도에 대한 기대를 말로 확인해. 바쁜 일정과 무관심을 같은 뜻으로 읽지 않는 게 중요해.'
    return {title,conclusion:`${title}의 ${direction} ${flirting?'호감이나 대화가 있어도 아직 연인으로 합의한 상태는 아니야.':intimate?'신체적 친밀감이 정서적 약속이나 독점적 관계를 뜻하지는 않아.':single ? '지금 특정 상대가 있다는 뜻도, 새 인연이 반드시 나타난다는 뜻도 아니야.' : '내가 관계를 대하는 흐름이며 연인의 감정이나 두 사람의 궁합을 계산한 점수는 아니야.'}`,action,
      caution: flirting ? '친절이나 끌림을 상호 연애 의사로 확정하지 않아. 답을 끌어내기 위한 밀고 당기기보다 서로의 말과 행동을 함께 봐.' : intimate ? '다시 만난다는 이유만으로 사랑이나 관계 발전을 약속받았다고 여기지 않아. 불편한 접촉과 기대는 언제든 거절하거나 조정할 수 있어.' : single ? '소개나 모임 경로는 행동 예시이며, 제의가 들어온다는 계산 결과는 아니야. 호감이 생겨도 첫인상만으로 상호 관심을 확정하지 않아. 실제로 다음 대화나 만남이 이어지는지 확인해.' : '한 번의 답장이나 표정으로 관계 전체를 판단하지 않아. 반복되는 불편은 서로의 상황을 듣고 조율할 문제야.'}
  }
  const love = copy('연애',calculation.western.overall['연애'])
  const periodAction = flirting ? (summary.periodKind==='day'?'오늘의 한 번의 대화보다 다음 약속이 구체화되는지 살펴.':summary.periodKind==='week'?'이번 주 여러 번의 교류에서 관심과 행동이 일관되는지 살펴.':summary.periodKind==='month'?'이번 달은 대화가 이어지는 단계와 관계 기대를 확인하는 단계를 구분해.':'올해는 반복되는 교류 방식과 내가 원하는 관계가 맞는지를 긴 흐름으로 살펴.') : intimate ? (summary.periodKind==='day'?'오늘 만남의 분위기와 내가 원하는 관계를 구분해 생각해.':summary.periodKind==='week'?'이번 주 만남 전후의 소통과 경계가 일관되게 존중되는지 살펴.':summary.periodKind==='month'?'이번 달 반복되는 만남 방식이 서로의 기대에 맞는지 돌아볼 수 있어.':'올해는 친밀감의 강도보다 원하는 관계와 생활 방식이 지속적으로 맞는지 살펴.') : summary.periodKind==='day' ? '오늘은 소개를 부탁할지, 초대를 수락할지처럼 한 가지 작은 선택부터 정리해.' : summary.periodKind==='week' ? '이번 주에는 만남에 쓸 수 있는 날을 먼저 정하고, 실제로 잡힌 제의나 일정에 맞춰 움직여.' : summary.periodKind==='month' ? '이번 달은 소개·모임의 접점을 만드는 단계와 첫 만남 뒤 다시 만날지 확인하는 단계를 나눠 생각해.' : '올해는 생활 반경과 사람을 만나는 경로부터 살피고, 실제 제의가 생긴 시기에 맞춰 만남의 속도를 정해.'
  const cards = (rows: FortuneUserSummary['favorableCards'], caution: boolean) => rows.filter(r=>['연애','연락',...(single?['재회']:[])].includes(r.topic)).map(r=>({...r,meaning: r.topic==='재회' ? '재접촉과 관계 회복을 구분해' : r.topic==='연애' ? caution ? '관계의 속도와 서로의 기대를 확인해' : '만남과 관계 탐색의 흐름을 살펴봐' : '받는 연락과 먼저 보내는 연락을 나눠 읽어'}))
  const relationship = summary.relationship ? {...summary.relationship,
    summary: flirting?'썸·알아가는 사이의 수신과 발신이야. 아직 연인이라고 전제하지 않아.':intimate?'친밀감이 있는 미정 관계의 수신과 발신이야. 연락을 애정이나 관계 약속으로 바로 바꾸지 않아.':single ? '대화할 사람이 생겼을 때의 수신·발신 흐름을 따로 읽어. 특정 상대가 이미 있다고 전제하지 않아.' : '연인과 주고받는 연락의 두 방향을 구분해. 상대의 속마음을 확정하는 값은 아니야.',
    incoming:summary.relationship.incoming,
    outgoing:summary.relationship.outgoing,
    ...(single && Number.isFinite(calculation.western.relationship_signals?.['과거인연접점']?.average) ? {} : {reconnection:undefined,reconnectionBand:undefined,reconnectionTiming:undefined}),
  } : undefined
  return {...summary,headline:`${summary.when} · ${contextLabel} 흐름`,summary:summary.summary+' '+(flirting?'썸·알아가는 관계의 맥락이야. ':intimate?'신체적 친밀감이 있어도 관계의 약속은 별도로 확인할 부분이야. ':'')+(single?'새 인연·썸·친밀한 관계·과거 인연 중 내 상황에 해당하는 해설을 함께 읽어봐.':status!=='couple'?periodAction:'현재 관계의 일정과 대화 방식을 조율하는 관점으로 읽어.'),
    doItems:[love.action],cautionItems:[love.caution],
    favorableCards:cards(summary.favorableCards,false),cautionCards:cards(summary.cautionCards,true),relationship,
    focusTopics:summary.focusTopics.filter(t=>['연애','연락',...(single?['재회']:[])].includes(t.topic)).map(t=>{if(t.topic==='재회')return t;const c=copy(t.topic,calculation.western.overall[t.topic]);return {...t,conclusion:t.conclusion,action:t.topic==='연락'?t.action:c.action,observe:t.observe,caution:c.caution}}),
    referenceTopics:summary.referenceTopics.filter(t=>['연애','연락',...(single?['재회']:[])].includes(t.topic)).map(t=>t.topic==='재회'?t:({...t,summary:t.summary})),
    importantWindows:summary.importantWindows,
  }
}

// These are simultaneous reading contexts, not additional event forecasts or scores.
export function singleLoveScenarios(calculation: IntegratedApiResponse) {
  const past = calculation.western.relationship_signals?.['과거인연접점']
  const validPast = Number.isFinite(past?.average)
  return [
    {title:'새 인연·소개팅', text:'아직 만날 사람이 없다면 소개를 부탁하거나 모임에 참여할지 살펴봐. 소개팅 제의가 실제로 있다면 일정과 만남 방식이 편안한지 확인해. 연락은 소개 문의와 첫 인사도 포함해.'},
    {title:'썸·알아가는 사이', text:'알아가는 사람이 있다면 서로 질문을 주고받는지, 다음 만남을 구체적으로 잡는지 봐. 대화의 편안함과 교제 의사는 구분하고 서로 원하는 관계를 확인해.'},
    {title:'친밀하지만 관계는 미정', text:'신체적으로 가까워진 사이도 포함해. 만남 전후의 연락과 약속이 일관되는지, 서로 원하는 관계가 맞는지 살펴. 친밀감만으로 애정이나 독점적 관계를 전제하지 않아.'},
    {title:'과거 인연·다시 이어질 가능성', text:validPast ? '과거 인연의 흐름은 별도 재접점 계산을 함께 읽어. 연락이 다시 닿는 것과 관계 회복은 다른 단계야. 실제 대화가 생긴다면 이전 문제가 달라졌는지, 다시 만나려는 뜻이 서로 있는지 확인해.' : '과거 인연도 함께 궁금할 수 있어. 현재 결과에는 재접점의 방향이나 시기를 판단할 독립 계산 정보가 부족해. 연락이 실제로 닿는다면 지난 문제와 서로의 기대가 달라졌는지부터 확인해.'},
  ]
}
