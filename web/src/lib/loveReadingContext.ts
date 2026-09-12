import type { FortuneStat, IntegratedApiResponse } from '../appTypes'
import type { FortuneUserSummary } from './fortuneUserSummary'

export type LoveStatus = 'single' | 'couple'
export function lovePromptContext(status: LoveStatus) {
  return `LOVE_STATUS=${status}\n${status === 'single'
    ? '미혼 싱글의 연애운이다. 현재 연인이 있다고 전제하지 말고 새로운 만남·호감·첫 대화의 관점으로 해석한다. 특정 상대의 존재·감정·재회를 만들지 않는다.'
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
      ? single ? '새로운 사람을 만날 기회가 생기면 편안하게 이야기할 수 있는지, 서로 질문을 주고받는지부터 살펴.' : '함께 보낼 시간과 각자 쉴 시간을 구체적으로 맞춰. 서로 원하는 데이트 방식이 같은지도 이야기해.'
      : single ? '대화할 사람이 생겼을 때 공통 관심사로 짧게 말을 꺼내. 아직 접점이 없다면 기다리는 답장이 있다고 가정할 필요는 없어.' : '연락 빈도나 답장 속도에 대한 기대를 말로 확인해. 바쁜 일정과 무관심을 같은 뜻으로 읽지 않는 게 중요해.'
    return {title,conclusion:`${title}의 ${direction} ${single ? '지금 특정 상대가 있다는 뜻도, 새 인연이 반드시 나타난다는 뜻도 아니야.' : '내가 관계를 대하는 흐름이며 연인의 감정이나 두 사람의 궁합을 계산한 점수는 아니야.'}`,action,
      caution: single ? '호감이 생겨도 첫인상만으로 상호 관심을 확정하지 않아. 실제로 다음 대화나 만남이 이어지는지 확인해.' : '한 번의 답장이나 표정으로 관계 전체를 판단하지 않아. 반복되는 불편은 서로의 상황을 듣고 조율할 문제야.'}
  }
  const love = copy('연애',calculation.western.overall['연애'])
  const cards = (rows: FortuneUserSummary['favorableCards'], caution: boolean) => rows.filter(r=>['연애','연락'].includes(r.topic)).map(r=>({...r,meaning: caution ? copy(r.topic,calculation.western.overall[r.topic]).caution : copy(r.topic,calculation.western.overall[r.topic]).action}))
  const relationship = summary.relationship ? {...summary.relationship,
    summary: single ? '대화할 사람이 생겼을 때의 수신·발신 흐름을 따로 읽어. 특정 상대가 이미 있다고 전제하지 않아.' : '연인과 주고받는 연락의 두 방향을 구분해. 상대의 속마음을 확정하는 값은 아니야.',
    reconnection:undefined,reconnectionBand:undefined,reconnectionTiming:undefined,
  } : undefined
  return {...summary,headline:`${summary.when} · ${single?'싱글의 새로운 만남':'커플의 현재 관계'} 흐름`,summary:love.conclusion+' '+summary.summary,
    favorableCards:cards(summary.favorableCards,false),cautionCards:cards(summary.cautionCards,true),relationship,
    focusTopics:summary.focusTopics.filter(t=>['연애','연락'].includes(t.topic)).map(t=>{const c=copy(t.topic,calculation.western.overall[t.topic]);return {...t,conclusion:c.conclusion,action:c.action,observe:undefined,caution:c.caution}}),
    referenceTopics:summary.referenceTopics.filter(t=>['연애','연락'].includes(t.topic)).map(t=>({...t,summary:copy(t.topic,calculation.western.overall[t.topic]).conclusion})),
    importantWindows:summary.importantWindows.map(w=>({...w,guidance:`${single?'새로운 접점이 있을 때':'연인과 함께'} · ${w.kind==='caution'?'기대를 앞세우기보다 상황 확인':'대화와 만남에 쓸 시간 검토'}`})),
  }
}
