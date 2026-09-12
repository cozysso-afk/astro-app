import type { FortuneStat, IntegratedApiResponse } from '../appTypes'
import type { FortuneUserSummary } from './fortuneUserSummary'

export type LoveStatus = 'single' | 'couple'
export function lovePromptContext(status: LoveStatus) {
  return `LOVE_STATUS=${status}\n${status === 'single'
    ? '미혼 싱글의 연애운이다. 현재 연인이 있다고 전제하지 말고 아직 대상자가 없는 상황에서 소개 부탁·소개팅 제의 검토·모임 참여·새로운 만남·첫 대화의 관점으로 해석한다. 소개팅이 들어온다는 사건 예측은 직접 근거가 없으면 하지 않는다. 특정 상대의 존재·감정·재회를 만들지 않는다.'
    : '미혼 커플의 연애운이다. 현재 연인과의 대화·데이트·거리 조율을 중심으로 읽는다. 새 연애상대나 배우자를 예측하지 않는다.'} 수신과 발신은 분리한다. 개인 차트의 활성도를 상대의 마음이나 궁합으로 바꾸지 않는다.\n`
}

// A presentation lens over existing scores/evidence. No additional calculation or request.
export function applyLoveContext(summary: FortuneUserSummary, calculation: IntegratedApiResponse, status: LoveStatus): FortuneUserSummary {
  const single = status === 'single'
  const copy = (topic: string, stat?: FortuneStat | null) => {
    const score = stat?.average
    const band = stat?.band ?? '정보 부족'
    const low = /약|낮/.test(band) || (Number.isFinite(score) && score! < 40)
    const high = !low && (/강|높/.test(band) || (Number.isFinite(score) && score! >= 60))
    const title = topic === '연애' ? single ? '새로운 만남과 호감' : '현재 연인과의 교류' : single ? '첫 대화와 연락' : '연인과의 연락'
    const direction = !Number.isFinite(score) ? '방향을 판단할 계산 정보가 부족해.' : low ? '활성도가 약하게 잡혀 있어.' : high ? '활성도가 상대적으로 높게 잡혀 있어.' : '활성도는 중간 범위에 있어.'
    const action = topic === '연애'
      ? single ? '만날 사람이 아직 없다면 믿는 지인에게 소개를 부탁하거나 부담 없는 모임에 시간을 낼지 검토해. 소개팅 제의가 들어온 경우에는 상대 조건보다 내가 만남을 원하는지, 일정과 방식이 편안한지부터 확인해.' : '함께 보낼 시간과 각자 쉴 시간을 구체적으로 맞춰. 서로 원하는 데이트 방식이 같은지도 이야기해.'
      : single ? '소개를 부탁하는 메시지, 모임 참여 문의, 첫 인사를 서로 다른 출발점으로 볼 수 있어. 새 접점이 생기면 공통 관심사로 짧게 말을 꺼내고, 아직 없다면 기다리는 답장을 만들어 해석하지 않아.' : '연락 빈도나 답장 속도에 대한 기대를 말로 확인해. 바쁜 일정과 무관심을 같은 뜻으로 읽지 않는 게 중요해.'
    return {title,conclusion:`${title}의 ${direction} ${single ? '지금 특정 상대가 있다는 뜻도, 새 인연이 반드시 나타난다는 뜻도 아니야.' : '내가 관계를 대하는 흐름이며 연인의 감정이나 두 사람의 궁합을 계산한 점수는 아니야.'}`,action,
      caution: single ? '소개나 모임 경로는 행동 예시이며, 제의가 들어온다는 계산 결과는 아니야. 호감이 생겨도 첫인상만으로 상호 관심을 확정하지 않아. 실제로 다음 대화나 만남이 이어지는지 확인해.' : '한 번의 답장이나 표정으로 관계 전체를 판단하지 않아. 반복되는 불편은 서로의 상황을 듣고 조율할 문제야.'}
  }
  const love = copy('연애',calculation.western.overall['연애'])
  const periodAction = summary.periodKind==='day' ? '오늘은 소개를 부탁할지, 초대를 수락할지처럼 한 가지 작은 선택부터 정리해.' : summary.periodKind==='week' ? '이번 주에는 만남에 쓸 수 있는 날을 먼저 정하고, 실제로 잡힌 제의나 일정에 맞춰 움직여.' : summary.periodKind==='month' ? '이번 달은 소개·모임의 접점을 만드는 단계와 첫 만남 뒤 다시 만날지 확인하는 단계를 나눠 생각해.' : '올해는 생활 반경과 사람을 만나는 경로부터 살피고, 실제 제의가 생긴 시기에 맞춰 만남의 속도를 정해.'
  const directionCopy = (direction:'incoming'|'outgoing',band?:string) => {
    if(!band||band==='정보 부족')return '이 방향을 읽을 독립 계산 근거가 부족해. 소개팅 제의나 먼저 연락할 시점을 단정하지 않아.'
    const low=band==='약함',high=band==='강함'
    return direction==='incoming'
      ? `다른 쪽에서 접점이 생기는 흐름은 ${band}으로 잡혀 있어. ${low?'소개팅 제의나 먼저 오는 연락을 당연하게 기대하기보다 실제 제안이 있는지 확인해.':high?'지인의 소개 제의나 새 사람의 첫 인사가 실제로 있다면 내용과 일정을 살펴볼 수 있어.':'소개나 첫 인사가 실제로 생겼을 때 구체적인 만남으로 이어지는지 확인해.'} 누가 소개를 해주거나 연락한다는 예측은 아니야.`
      : `내가 접점을 만드는 흐름은 ${band}이야. ${low?'소개를 무리하게 부탁하거나 만남 일정을 몰기보다 원하는 만남의 조건부터 정리해.':'믿는 지인에게 소개를 부탁하거나 관심 있는 모임에 문의하는 작은 행동을 검토해.'} 먼저 움직이는 것과 실제 소개·만남이 성사되는 것은 별개야.`
  }
  const cards = (rows: FortuneUserSummary['favorableCards'], caution: boolean) => rows.filter(r=>['연애','연락'].includes(r.topic)).map(r=>({...r,meaning: caution ? copy(r.topic,calculation.western.overall[r.topic]).caution : copy(r.topic,calculation.western.overall[r.topic]).action}))
  const relationship = summary.relationship ? {...summary.relationship,
    summary: single ? '대화할 사람이 생겼을 때의 수신·발신 흐름을 따로 읽어. 특정 상대가 이미 있다고 전제하지 않아.' : '연인과 주고받는 연락의 두 방향을 구분해. 상대의 속마음을 확정하는 값은 아니야.',
    incoming:single?directionCopy('incoming',summary.relationship.incomingBand):summary.relationship.incoming,
    outgoing:single?directionCopy('outgoing',summary.relationship.outgoingBand):summary.relationship.outgoing,
    reconnection:undefined,reconnectionBand:undefined,reconnectionTiming:undefined,
  } : undefined
  return {...summary,headline:`${summary.when} · ${single?'싱글의 새로운 만남':'커플의 현재 관계'} 흐름`,summary:love.conclusion+' '+(single?periodAction:'현재 관계의 일정과 대화 방식을 조율하는 관점으로 읽어.'),
    doItems:[love.action],cautionItems:[love.caution],
    favorableCards:cards(summary.favorableCards,false),cautionCards:cards(summary.cautionCards,true),relationship,
    focusTopics:summary.focusTopics.filter(t=>['연애','연락'].includes(t.topic)).map(t=>{const c=copy(t.topic,calculation.western.overall[t.topic]);return {...t,conclusion:c.conclusion,action:c.action,observe:undefined,caution:c.caution}}),
    referenceTopics:summary.referenceTopics.filter(t=>['연애','연락'].includes(t.topic)).map(t=>({...t,summary:copy(t.topic,calculation.western.overall[t.topic]).conclusion})),
    importantWindows:summary.importantWindows.map(w=>({...w,guidance:`${single?'새로운 접점이 있을 때':'연인과 함께'} · ${w.kind==='caution'?'기대를 앞세우기보다 상황 확인':'대화와 만남에 쓸 시간 검토'}`})),
  }
}
