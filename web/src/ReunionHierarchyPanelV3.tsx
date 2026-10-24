import type { Aspect, RelationshipAiResponse, ReunionObservationContext } from './appTypes'
import { ReadingTimeline, type DirectionRow } from './ReadingSignals'
import type { ReunionHierarchy } from './lib/reunionHierarchy'
import { polishKoreanSentence } from './lib/fortuneNarrativePolish'
import { compareObservedEvents, nextUnconfirmedStage, observationReading, observedStage, REUNION_STAGE_ORDER, type ReunionStage } from './lib/reunionObservation'

type ReunionSynthesis = NonNullable<NonNullable<RelationshipAiResponse['data']>['reunion_synthesis_v2']>
type Strength = '낮음' | '보통' | '높음' | '정보 부족'
type ContactAvailabilityState = 'not_calculated' | 'calculated_no_candidate' | 'candidate_not_top' | 'current_active' | 'future_candidate'
type ScoredDirection = DirectionRow

type StageVerdict = {
  key: string
  label: string
  status: string
  text: string
}

const STAGE_LABEL: Record<string,string> = {
  emotional_reactivation: '서로를 다시 의식하는 배경',
  contact_recontact: '연락·대화 재개',
  in_person_meeting: '실제 만남',
  relationship_rebuilding: '관계 재구축',
}

const TECHNICAL_RE = /(?:태양|수성|금성|화성|목성|토성|천왕성|해왕성|명왕성|노드|하우스|트랜짓|프로그레스|컴포지트|시너스트리|삼분|사분|육합|육파|오브|\d+도각|사주\s*(?:일지|월지|시주)|[甲乙丙丁戊己庚辛壬癸寅卯辰巳午未申酉戌亥子丑])/i

function sentenceList(value?: string | null) {
  const clean = polishKoreanSentence(String(value ?? '')).trim()
  if (!clean) return []
  return clean
    .replace(/([.!?])\s+/g, '$1\n')
    .split('\n')
    .map(row => row.trim())
    .filter(Boolean)
}

function sentences(value?: string | null, limit = 2) {
  return sentenceList(value).slice(0, limit).join(' ')
}

function readerSentences(value?: string | null, limit = 2) {
  const rows = sentenceList(value)
  const plain = rows.filter(row => !TECHNICAL_RE.test(row))
  if (plain.length >= limit) return plain.slice(0, limit).join(' ')
  const selected = [...plain]
  for (const row of rows) {
    if (!TECHNICAL_RE.test(row) || selected.includes(row)) continue
    selected.push(row)
    if (selected.length >= limit) break
  }
  return selected.slice(0, limit).join(' ')
}

function stageSet(hierarchy: ReunionHierarchy) {
  return new Set([...hierarchy.current_windows, ...hierarchy.top_periods].map(row => row.stage))
}

function strengthFromActivation(value: number | null | undefined): Strength {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '정보 부족'
  if (value >= 60) return '높음'
  if (value >= 40) return '보통'
  return '낮음'
}

function contactReading(hierarchy: ReunionHierarchy) {
  const stage = hierarchy.stages?.contact_recontact
  const candidateCount = typeof stage?.candidate_count === 'number' && Number.isFinite(stage.candidate_count) ? stage.candidate_count : null
  const currentWindows = hierarchy.current_windows.filter(row => row.stage === 'contact_recontact')
  const futureWindows = hierarchy.top_periods.filter(row => row.stage === 'contact_recontact')
  const contactWindows = [...currentWindows, ...futureWindows]
  const windowActivation = contactWindows.map(row => row.final).filter(Number.isFinite).sort((a,b)=>b-a)[0]
  const activation = typeof stage?.activation === 'number' && Number.isFinite(stage.activation) ? stage.activation : windowActivation
  const band = strengthFromActivation(activation)
  const first = [...futureWindows].sort((a,b) => a.start.localeCompare(b.start))[0]
  const firstText = first ? (first.start === first.end ? first.start : `${first.start}~${first.end}`) : ''

  if (!stage || candidateCount === null) return {
    state:'not_calculated' as ContactAvailabilityState,
    band,
    status:'계산 정보 없음',
    candidateCount,
    text:'연락 단계의 후보 수와 활성도를 구분할 계산 정보가 없어. 미래 후보 없음으로 바꿔 말하지 않아.',
    first:'',
  }
  if (currentWindows.length) return {
    state:'current_active' as ContactAvailabilityState,
    band,
    status:`현재 활성 · ${band === '정보 부족' ? '강도 미산출' : band}`,
    candidateCount,
    text:`현재 연락·대화 재개 단계에 걸린 구간이 있어. 기준일 이후 미래 후보는 ${candidateCount}개로 따로 계산돼 있으며, 현재 활성과 미래 후보를 같은 뜻으로 합치지 않아.`,
    first:firstText,
  }
  if (futureWindows.length) return {
    state:'future_candidate' as ContactAvailabilityState,
    band,
    status:`${band === '정보 부족' ? '강도 미산출' : band} · 미래 후보 ${candidateCount}개`,
    candidateCount,
    text: band === '낮음'
      ? '미래 연락 후보는 잡혀 있지만 활성도는 낮아. 후보가 있다는 이유만으로 실제 연락을 기대하는 쪽으로 확대하지 않아.'
      : '미래 연락·대화 재개 후보가 계산돼 있어. 실제 선연락 주체와 대화 지속성은 별도 근거로 나눠서 봐.',
    first:firstText,
  }
  if (candidateCount === 0) return {
    state:'calculated_no_candidate' as ContactAvailabilityState,
    band,
    status:'계산됨 · 미래 후보 없음',
    candidateCount,
    text:'연락 단계 계산은 완료됐지만 기준일 이후 공개할 미래 후보는 없어요. 계산 자체가 없다는 뜻은 아니며, 상대 차트 쪽·내 차트 쪽 활성과 지난 구간은 별도로 읽어요.',
    first:'',
  }
  return {
    state:'candidate_not_top' as ContactAvailabilityState,
    band,
    status:`미래 후보 ${candidateCount}개 · 우선 시기 미포함`,
    candidateCount,
    text:'연락 단계의 미래 후보는 계산됐지만 현재 공개된 우선 시기에는 포함되지 않았어. 날짜를 새로 만들어 보충하지 않고 후보 존재와 우선 시기 노출을 구분해.',
    first:'',
  }
}

function directionRow(rows: DirectionRow[], kind:'incoming'|'outgoing') {
  return rows.find(row => row.kind === kind) as ScoredDirection | undefined
}

function rowScore(row?: ScoredDirection) {
  return typeof row?.score === 'number' && Number.isFinite(row.score) ? row.score : null
}

function displayScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function directionReading(rows: DirectionRow[], kind:'incoming'|'outgoing') {
  const row = directionRow(rows, kind)
  const score = rowScore(row)
  const direction = kind === 'incoming' ? '상대 쪽 흐름이 내 관계 영역을 건드리는 정도' : '내 쪽 흐름이 상대 관계 영역을 건드리는 정도'
  if (score == null) return {
    metric:'계산값 없음',
    text:`${direction}를 따로 비교할 값이 없어요. 다른 방향의 점수로 대신 채우지 않아요.`,
  }
  const band = row?.band || strengthFromActivation(score)
  return {
    metric:`활성도 ${displayScore(score)} · ${band}`,
    text:`${direction}를 나타내는 상대 활성도예요. 실제 선연락이나 답장 여부를 뜻하는 확률은 아니에요.`,
  }
}

function bandRank(value?: string) {
  return value === '강함' ? 3 : value === '보통' ? 2 : value === '약함' ? 1 : 0
}

function initiativeReading(rows: DirectionRow[]) {
  const incoming = directionRow(rows, 'incoming')
  const outgoing = directionRow(rows, 'outgoing')
  const a = rowScore(incoming)
  const b = rowScore(outgoing)
  if (a != null && b != null) {
    const diff = a - b
    const roundedA = Math.round(a)
    const roundedB = Math.round(b)
    if (diff === 0) return { label:'두 활성축 차이 없음', text:`상대 차트 ${roundedA}, 내 차트 ${roundedB}로 같아요. 어느 쪽이 먼저 연락한다는 예측으로 바꾸지 않아요.` }
    if (Math.abs(diff) < 5) {
      return {
        label:'두 방향 차이 작음',
        text:`상대 차트 ${roundedA}, 내 차트 ${roundedB}로 차이가 작아요. 이 정도 차이로 실제 선연락 주체를 정하지 않아요.`,
      }
    }
    const side = diff > 0 ? '상대 차트 쪽' : '내 차트 쪽'
    const pointGap = Math.abs(roundedA - roundedB)
    const weak = a < 40 && b < 40
    return {
      label:`${side} 상대 활성도 높음`,
      text: weak
        ? `상대 차트 ${roundedA}, 내 차트 ${roundedB}로 둘 다 낮은 구간이지만 ${side}이 ${pointGap}점 높아요. 행동 예측이 아니라 두 계산축의 상대 비교예요.`
        : `상대 차트 ${roundedA}, 내 차트 ${roundedB}로 ${side}이 ${pointGap}점 높아요. 먼저 연락할 사람을 확정하는 값은 아니에요.`,
    }
  }
  const ar = bandRank(incoming?.band)
  const br = bandRank(outgoing?.band)
  if (ar && br && ar !== br) return { label: ar > br ? '상대 차트 쪽 등급 높음' : '내 차트 쪽 등급 높음', text:'두 활성축의 등급 차이는 보여 주되 실제 선연락 행동을 확정하지 않아요.' }
  return { label:'활성축 비교 불가', text:'두 차트의 활성도를 비교할 독립 계산값이 충분하지 않아요.' }
}

function calculatedCurrentState(hierarchy: ReunionHierarchy) {
  const current = new Set(hierarchy.current_windows.map(row => row.stage))
  const all = stageSet(hierarchy)
  if (current.has('relationship_rebuilding')) return '지금은 연락 여부보다 관계를 다시 운영할 행동과 합의가 실제로 붙는지를 볼 단계야.'
  if (current.has('in_person_meeting')) return '지금은 연락 횟수보다 실제 약속과 만남이 잡히고, 만난 뒤 관계 이야기가 이어지는지를 보는 게 더 중요해.'
  if (current.has('contact_recontact')) return all.has('in_person_meeting') || all.has('relationship_rebuilding')
    ? '지금은 연락이나 대화 재개를 살펴볼 구간이야. 그 뒤 만남과 관계 재구축은 별도 단계로 확인해.'
    : '지금은 연락이나 대화 재개를 살펴볼 구간이지만, 현재 조회 범위에서 만남·관계 재구축까지 이어지는 근거는 약해.'
  if (current.has('emotional_reactivation')) return '지금은 과거 관계를 다시 떠올리는 배경이 먼저 보여. 생각이 나는 것과 실제 접촉은 구분해서 봐.'
  if (all.has('contact_recontact')) return '현재 기준일에 열린 단계는 없지만 앞으로 연락·대화 재개를 살펴볼 구간은 잡혀 있어.'
  if (all.has('emotional_reactivation')) return '현재는 실제 접촉보다 과거 관계가 다시 떠오르는 배경 쪽이 먼저 보여.'
  return '현재 조회 범위에서는 연락·만남·관계 재구축 가운데 뚜렷하게 열린 단계가 없어.'
}

function stageVerdicts(hierarchy: ReunionHierarchy): StageVerdict[] {
  const currentStages = new Set(hierarchy.current_windows.map(row => row.stage))
  const futureStages = new Set(hierarchy.top_periods.map(row => row.stage))
  const rows: Array<{ key:string; label:string }> = [
    { key:'emotional_reactivation', label:'다시 의식하기' },
    { key:'contact_recontact', label:'연락·대화' },
    { key:'in_person_meeting', label:'실제 만남' },
    { key:'relationship_rebuilding', label:'관계 재구축' },
  ]
  const presentText=(key:string)=>key === 'emotional_reactivation' ? '과거 관계를 다시 떠올리거나 서로를 의식하기 쉬운 배경이 잡혀 있어.'
    : key === 'contact_recontact' ? '직접 연락이나 대화 재개를 따로 살펴볼 단계가 잡혀 있어.'
    : key === 'in_person_meeting' ? '연락을 넘어 실제 약속·만남으로 이어지는 단계 근거가 잡혀 있어.'
    : '다시 관계를 운영하기 위한 합의·지속 행동을 볼 단계 근거가 잡혀 있어.'
  const absentText=(key:string)=>key === 'emotional_reactivation' ? '기준일 이후 다시 의식하는 배경의 공개 후보가 없어.'
    : key === 'contact_recontact' ? '기준일 이후 공개할 연락·대화 재개 후보가 없어.'
    : key === 'in_person_meeting' ? '기준일 이후 공개할 실제 만남 후보가 없어.'
    : '기준일 이후 공개할 관계 재구축 후보가 없어.'

  return rows.map(({key,label}) => {
    const stage = hierarchy.stages?.[key]
    const activation = stage?.activation
    const band = strengthFromActivation(activation)
    const candidateCount = typeof stage?.candidate_count === 'number' && Number.isFinite(stage.candidate_count) ? stage.candidate_count : null
    if (currentStages.has(key)) return {
      key,label,
      status:`현재 활성${band === '정보 부족' ? '' : ` · ${band}`}`,
      text:presentText(key),
    }
    if (futureStages.has(key)) return {
      key,label,
      status:`${band === '정보 부족' ? '강도 미산출' : band} · 미래 핵심 시기 있음`,
      text:presentText(key),
    }
    if (candidateCount != null && candidateCount > 0) return {
      key,label,
      status:`미래 후보 ${candidateCount}개 · 우선 시기 미포함`,
      text:`${presentText(key)} 다만 현재 공개된 우선 시기에는 들지 않아 날짜를 새로 만들어 강조하지 않아.`,
    }
    if (candidateCount === 0) return {
      key,label,
      status:'계산됨 · 미래 후보 없음',
      text:absentText(key),
    }
    return {
      key,label,
      status:'계산 정보 없음',
      text:'이 단계는 후보 수와 활성도를 구분할 계산 정보가 없어 결론을 만들지 않아.',
    }
  })
}
function bottomLine(hierarchy: ReunionHierarchy, contact: ReturnType<typeof contactReading>, initiative: ReturnType<typeof initiativeReading>) {
  const stages = stageSet(hierarchy)
  const direction = initiative.label === '판정 보류' ? '선연락 주체는 판정 보류야.' : `선연락 비교는 ${initiative.label}이야.`
  if (stages.has('relationship_rebuilding')) return {
    title:'연락 여부보다 실제 관계 재구축 행동을 볼 단계',
    text:`이번 조회에서는 관계 재구축 단계까지 근거가 이어져. ${direction} 이제 핵심은 누가 먼저 연락하느냐보다 이전 문제를 다르게 다루고 약속을 지속하는지가 실제로 보이는지야.`,
  }
  if (stages.has('in_person_meeting')) return {
    title:'연락을 넘어 만남은 볼 수 있지만, 재구축은 별도 판단',
    text:`실제 만남 단계까지는 근거가 이어져. ${direction} 다만 만났다는 사실만으로 재회가 성립했다고 보지 않고, 만남 뒤 관계 정의와 지속 행동이 붙는지를 따로 봐야 해.`,
  }
  if (stages.has('contact_recontact')) return {
    title:'연락은 살펴볼 수 있지만, 아직 재회 단계는 아님',
    text:`연락·대화 재개는 ${contact.band}이고${contact.first ? ` 먼저 볼 시기는 ${contact.first}야` : ' 특정 시기를 강하게 못 박을 정도는 아니야'}. ${direction} 현재 조회에서는 실제 만남과 관계 재구축까지 이어지는 근거가 약해서, 연락이 생기는지와 재회 여부를 같은 결론으로 묶으면 안 돼.`,
  }
  if (stages.has('emotional_reactivation')) return {
    title:'생각날 배경은 있어도, 연락을 기다릴 근거는 약함',
    text:`과거 관계를 다시 의식하는 단계는 보이지만 직접 연락·만남 단계는 잡히지 않았어. ${direction} 지금은 프로필 확인이나 추억 회상 같은 내면 반응보다 실제 접촉이 생기는지가 먼저야.`,
  }
  return {
    title:'이번 조회에서는 재회 진행 단계를 뚜렷하게 잡기 어려움',
    text:`연락·만남·관계 재구축으로 이어지는 단계 근거가 충분하지 않아. ${direction} 지금은 재회 결론을 만들기보다 현실에서 새 접촉이나 관계 변화가 생기는지를 먼저 봐야 해.`,
  }
}

function behaviorChangeReading(hierarchy: ReunionHierarchy) {
  const all = stageSet(hierarchy)
  if (all.has('relationship_rebuilding')) return {
    label:'변화를 확인할 근거 있음',
    text:'관계를 다시 운영하는 단계까지 잡혀 있어. 달라졌는지는 불편한 문제를 피하지 않는지, 약속을 잡고 지키는지, 말과 행동이 전보다 일관적인지로 확인해.',
  }
  if (all.has('in_person_meeting')) return {
    label:'일부 확인 가능',
    text:'실제 만남 단계까지는 보여. 다만 만났다는 사실보다 만남 뒤 책임 있는 대화·조율·지속 행동이 붙는지가 변화 여부를 가르는 기준이야.',
  }
  if (all.has('contact_recontact')) return {
    label:'아직 판단 근거 부족',
    text:'연락이 다시 닿는 것만으로 상대가 달라졌다고 볼 수는 없어. 이번 범위에서는 실제 만남이나 관계 재구축 단계가 약하므로, 행동 변화 판단은 연락 뒤의 약속·사과·조율이 실제로 생기는지에 맡겨야 해.',
  }
  return {
    label:'판단 근거 부족',
    text:'과거를 다시 떠올리는 배경만으로 행동 변화를 판단하지 않아. 실제 접촉 뒤 이전 갈등을 다루는 방식이 달라지는지가 있어야 비교할 수 있어.',
  }
}

function nextActionReading(contactBand: Strength, stages: Set<string>) {
  if (stages.has('relationship_rebuilding')) return {
    label:'관계 정의와 반복 문제를 확인',
    text:'연락 횟수는 이제 핵심이 아니야. 서로 원하는 관계를 말로 맞추고, 이전 갈등을 다루는 방식과 약속을 지키는 행동이 실제로 달라졌는지를 확인해.',
  }
  if (stages.has('in_person_meeting')) return {
    label:'만남 뒤 행동을 확인',
    text:'만남 자체를 재회로 결론 내리지 마. 다음 약속이 자연스럽게 이어지는지, 관계 이야기를 피하지 않는지, 예전 문제를 다른 방식으로 다루는지를 봐.',
  }
  if (stages.has('contact_recontact')) return {
    label:'연락이 오면 세 가지만 확인',
    text:'질문과 답이 이어지는지, 구체적인 만남 제안이 생기는지, 예전 문제를 피하지 않는지를 확인해. 안부나 추억 이야기만 반복되면 아직 재회 단계로 올려 읽지 않아.',
  }
  return {
    label: contactBand === '낮음' ? '지금은 기다림보다 현실 변화 확인' : '실제 접촉이 생기는지부터 확인',
    text:'생각이 난다는 신호와 실제 재접촉은 다른 단계야. 차단 해제, 직접 연락, 구체적인 약속처럼 현실에서 확인되는 변화가 생기기 전에는 관계 결론을 앞당기지 않아.',
  }
}

function contextualGuide(context: ReunionObservationContext, contactBand: Strength, stages: Set<string>) {
  if (!context.state) return {title:'현재 상태를 입력하지 않았어',text:'실제 관계 단계는 추정하지 않아. 계산된 활성 구간과 미래 후보만 구분해서 보여 줘.'}
  if (context.state === 'disconnected') return {title:'단절·차단 상태에서 볼 것',text:contactBand === '낮음'?'낮은 연락 활성도를 실패로 해석하지 않아. 차단 해제나 직접 접촉이 실제로 생기기 전까지는 계산 신호를 관찰 정보로만 둬.':'연락 후보가 있어도 차단을 넘어서는 행동을 예측하지 않아. 먼저 현실의 재접촉 여부와 계산 근거를 나눠 봐.'}
  if (context.state === 'recontacted' || context.state === 'messaging') return {title:'연락이 확인된 뒤 볼 것',text:'연락이 올지는 이미 지난 질문이야. 대화가 이어지는지, 실제 만남 단계의 계산 근거가 따로 있는지에 초점을 옮겨.'}
  if (context.state === 'met' || context.state === 'intimate_undefined') return {title:'만남이 확인된 뒤 볼 것',text:stages.has('relationship_rebuilding')?'만남 이후 관계 정의와 지속 행동을 뒷받침하는 재구축 근거가 있어. 그래도 합의 자체를 확정하지는 않아.':'만남은 관측 사실이지만 현재 계산에서 관계 재구축 근거는 별도로 약하거나 없어. 두 사실을 모순처럼 합치지 않아.'}
  return {title:'합의 뒤 유지 구조에서 볼 것',text:'관계 합의는 이미 확인된 사실이야. 계산은 그 사실을 취소하지 않고, 약속의 지속과 반복 문제를 다루는 구조를 참고 정보로 보여 줘.'}
}

function timeline(hierarchy: ReunionHierarchy) {
  const seenStages = new Set<string>()
  const rows = [] as Array<{ date:string; kind:'rebuilding'|'incoming'|'reconnection'; label:string; status:string; stage:string }>
  for (const row of hierarchy.top_periods) {
    if (seenStages.has(row.stage)) continue
    seenStages.add(row.stage)
    rows.push({
      date: row.start === row.end ? row.start : `${row.start}~${row.end}`,
      kind: row.stage === 'relationship_rebuilding' ? 'rebuilding' : row.stage === 'contact_recontact' ? 'incoming' : 'reconnection',
      label: STAGE_LABEL[row.stage] ?? row.label,
      status:'주목',
      stage:row.stage,
    })
    if (rows.length >= 3) break
  }
  return rows
}

function windowSummary(row: ReunionHierarchy['top_periods'][number]) {
  const when = row.start === row.end ? row.start : `${row.start}~${row.end}`
  const score = Number.isFinite(Number(row.final)) ? ` · 활성도 ${Math.round(row.final)}` : ''
  return `${when} · ${STAGE_LABEL[row.stage] ?? row.label}${score}`
}

function evidenceLabel(row: Aspect) {
  const a = String(row.a ?? '')
  const b = String(row.b ?? '')
  const aspect = String(row.aspect ?? '')
  const orb = typeof row.orb === 'number' && Number.isFinite(row.orb) ? (row.orb < 0.01 ? '<0.01°' : `${row.orb.toFixed(2)}°`) : '오차 정보 없음'
  return [a,aspect,b,orb].filter(Boolean).join(' · ')
}

export function ReunionHierarchyPanel({ hierarchyData, historyHierarchyData, historyCalculated=false, observation={state:'',initiator:'',events:[]}, evidence, reunionV2, directionRows, sustainabilityText }: {
  hierarchyData: ReunionHierarchy
  historyHierarchyData?: ReunionHierarchy | null
  historyCalculated?: boolean
  observation?: ReunionObservationContext
  evidence: Aspect[]
  reunionV2: ReunionSynthesis | null
  directionRows: DirectionRow[]
  sustainabilityText: string
}) {
  const valid = hierarchyData.validation?.status === 'PASS'
  const contact = contactReading(hierarchyData)
  const initiative = initiativeReading(directionRows)
  const incomingDirection = directionReading(directionRows, 'incoming')
  const outgoingDirection = directionReading(directionRows, 'outgoing')
  const change = behaviorChangeReading(hierarchyData)
  const stages = stageSet(hierarchyData)
  const stageRows = stageVerdicts(hierarchyData)
  const answer = bottomLine(hierarchyData, contact, initiative)
  const next = nextActionReading(contact.band, stages)
  const guide = contextualGuide(observation, contact.band, stages)
  const observed = observationReading(observation)
  const observedLevel = observedStage(observation.state)
  const nextObserved = nextUnconfirmedStage(observation.state)
  const events = timeline(hierarchyData)
  const pastContext = hierarchyData.past_windows.slice(0,2)
  const currentContext = hierarchyData.current_windows.slice(0,2)
  const consultation = reunionV2?.consultation_answer
  const answerTitle = observation.state ? observed.title : answer.title
  const observedNextRow = nextObserved ? stageRows.find(row=>row.key===nextObserved) : null
  const observedNextText = observedNextRow ? `아직 확인되지 않은 다음 단계인 ${observedNextRow.label}의 계산 상태는 ‘${observedNextRow.status}’야. ${observedNextRow.text}` : '이미 합의된 관계의 실제 지속 여부는 이번 계산으로 확정하지 않아.'
  const answerText = observation.state ? `${observed.text} ${observedNextText}` : readerSentences(consultation?.current_stage, 3) || answer.text
  const contactAlreadyObserved = observedLevel ? REUNION_STAGE_ORDER.indexOf(observedLevel) >= REUNION_STAGE_ORDER.indexOf('contact_recontact') : false
  const contactText = contactAlreadyObserved ? `연락은 사용자가 확인한 관측 사실이야. ${contact.text}` : readerSentences(`${consultation?.contact_type_if_any ?? ''} ${consultation?.continuity ?? ''}`, 3) || contact.text
  const initiativeText = initiative.text
  const meetingAlreadyObserved = observedLevel ? REUNION_STAGE_ORDER.indexOf(observedLevel) >= REUNION_STAGE_ORDER.indexOf('in_person_meeting') : false
  const behaviorText = observation.state === 'reunited'
    ? '관계 합의는 사용자가 확인한 관측 사실이야. 계산은 그 합의를 취소하지 않으며, 실제 지속 여부는 이후 행동으로만 확인할 수 있어.'
    : meetingAlreadyObserved && !stages.has('relationship_rebuilding')
      ? '실제 만남은 관측됐지만 이번 계산 범위에서 관계 재구축을 뒷받침하는 단계 근거는 약해. 만남이 있었다는 사실과 관계 재구축 근거는 별개야.'
      : readerSentences(consultation?.behavior_change_evidence, 3) || change.text
  const nextUp = (consultation?.next_stage_up_conditions ?? []).map(item=>readerSentences(item,1)).filter(Boolean).slice(0,3)
  const down = (consultation?.down_conditions ?? []).map(item=>readerSentences(item,1)).filter(Boolean).slice(0,3)

  const rawWhy = reunionV2?.why_reconnect ? `${reunionV2.why_reconnect.conclusion} ${reunionV2.why_reconnect.interpretation}` : ''
  const why = readerSentences(rawWhy, 2) || (stages.has('emotional_reactivation') ? '예전 대화나 감정이 다시 떠오르기 쉬운 배경은 있어. 다만 생각이 나는 것과 실제 연락·만남은 별도 단계로 봐.' : '')
  const repeat = readerSentences(reunionV2?.repeat_risks?.conclusion, 2)
  const repeatPatterns = (reunionV2?.repeat_risks?.patterns ?? []).map(item => readerSentences(item, 1)).filter(Boolean).slice(0, 3)
  const rebuildConditions = (reunionV2?.rebuild?.conditions ?? []).map(item => readerSentences(item, 1)).filter(Boolean).slice(0, 3)
  const evidenceRows = [...evidence].filter(row => Number.isFinite(Number(row.orb))).sort((a,b) => Number(a.orb) - Number(b.orb)).slice(0, 6)
  const historyRows = historyHierarchyData?.past_windows ?? []
  const comparisons = compareObservedEvents(observation, historyHierarchyData ?? null, historyCalculated)
  const actualInitiator = observation.initiator === 'counterpart' ? '상대가 먼저' : observation.initiator === 'user' ? '내가 먼저' : observation.initiator === 'mutual' ? '서로 비슷한 시점' : observation.initiator === 'unknown' ? '확인 어려움' : ''

  const statusFor = (row: StageVerdict) => {
    const stage = hierarchyData.stages[row.key]
    if (observedLevel && REUNION_STAGE_ORDER.indexOf(row.key as typeof observedLevel) <= REUNION_STAGE_ORDER.indexOf(observedLevel)) return '이미 확인됨'
    if (!stage || stage.candidate_count == null) return '정보 부족'
    if (hierarchyData.current_windows.some(w => w.stage === row.key)) return '현재 신호 있음'
    if (stage.candidate_count === 0) return '뚜렷한 시기 없음'
    return strengthFromActivation(stage.activation) === '정보 부족' ? '시기 신호 있음' : strengthFromActivation(stage.activation)
  }
  const stageHasEvidence = (key:string) => {
    const stage = hierarchyData.stages[key]
    return hierarchyData.current_windows.some(row=>row.stage===key)
      || hierarchyData.top_periods.some(row=>row.stage===key)
      || Boolean(stage && typeof stage.candidate_count === 'number' && stage.candidate_count > 0)
  }
  const stageState = (row:StageVerdict) => {
    const rowIndex = REUNION_STAGE_ORDER.indexOf(row.key as ReunionStage)
    const observedIndex = observedLevel ? REUNION_STAGE_ORDER.indexOf(observedLevel) : -1
    if (observedIndex >= rowIndex) return 'confirmed'
    for (let index=Math.max(0,observedIndex+1); index<rowIndex; index += 1) {
      if (!stageHasEvidence(REUNION_STAGE_ORDER[index])) return 'blocked'
    }
    return stageHasEvidence(row.key) ? 'signal' : 'empty'
  }
  const stageDisplayStatus = (row:StageVerdict) => {
    const state = stageState(row)
    if (state === 'confirmed') return '확인됨'
    if (state === 'blocked') return '앞 단계 미확인'
    return statusFor(row)
  }
  const stateTitle = observed.title.replace('관측 사실 · ', '')
  const safeNarrative = (value?: string | null) => sentenceList(value)
    .filter(row => !TECHNICAL_RE.test(row) && !/관문|후보|TOP|완전히 닫|통과 점수|활성도|검증|3일 이상/.test(row))
    .slice(0, 2).join(' ')
  const whyNarrative = readerSentences(rawWhy, 4) || safeNarrative(why)
  const rebuildNarrative = readerSentences(`${consultation?.meeting_gate ?? ''} ${consultation?.rebuild_gate ?? ''} ${reunionV2?.rebuild?.conclusion ?? ''}`, 4)
  const riskNarrative = readerSentences(`${reunionV2?.repeat_risks?.conclusion ?? ''} ${(reunionV2?.repeat_risks?.patterns ?? []).join(' ')}`, 3) || safeNarrative(repeat)
  const sustainabilityNarrative = readerSentences(sustainabilityText, 2)
  const adviceNarratives = [...rebuildConditions, ...repeatPatterns]
    .map(item => safeNarrative(item))
    .filter((item, index, rows) => item && rows.indexOf(item) === index)
    .slice(0, 4)
  const futureEvents = events.filter(event => {
    const date = event.date.slice(0, 10)
    const end = event.date.slice(-10)
    const isFuture = end >= hierarchyData.as_of_date || date >= hierarchyData.as_of_date
    return isFuture && (!nextObserved || event.stage === nextObserved)
  })
  return <section className="reading-section reunion-hierarchy reunion-ui-v5">
    <header className="reunion-result-meta"><span>기준일 {hierarchyData.as_of_date}</span></header>
    {!valid ? <p role="alert">계산 확인이 필요해요. 다시 계산한 뒤 결과를 확인해 주세요.</p> : <>
      <section className="reunion-v5-answer">
        <span>재회 흐름 한눈에</span>
        <h3>{observation.state ? stateTitle : '현재 관계 상태를 알려주세요'}</h3>
        <p>{observation.state ? answerText : '실제 연락·만남 여부를 입력하면 지금 단계에 맞춰 읽을 수 있어요.'}</p>
      </section>
      <div className="reunion-v5-stages" aria-label="재회 단계별 흐름">
        {stageRows.map(row => <article key={row.key} data-stage-state={stageState(row)} data-reading-export-detail={safeNarrative(row.text)}>
          <span>{row.label}</span><strong>{stageDisplayStatus(row)}</strong>
        </article>)}
      </div>
      <section className="reunion-v5-section">
        <h4>양쪽 차트의 관계 활성</h4>
        <div className="reunion-v5-directions">
          <article><b>상대 차트 쪽 활성</b><strong>{incomingDirection.metric}</strong><p>{incomingDirection.text}</p></article>
          <article><b>내 차트 쪽 활성</b><strong>{outgoingDirection.metric}</strong><p>{outgoingDirection.text}</p></article>
        </div>
        {actualInitiator ? <p className="reunion-v5-note">입력한 실제 첫 연락: {actualInitiator}</p> : null}
        <p className="reunion-v5-direction-summary">{contactText}</p>
        <p className="reunion-v5-direction-summary"><b>{initiative.label}</b> · {initiativeText}</p>
      </section>
      <section className="reunion-v5-section">
        <h4>앞으로 주목할 시기</h4>
        {futureEvents.length > 0 ? <ReadingTimeline events={futureEvents} context={{now:new Date(hierarchyData.as_of_date+'T12:00:00+09:00')}}/> : <p>현재 공개된 계산 결과에는 강조할 미래 시기가 없어요.</p>}
        <p className="reunion-v5-note">표시된 날짜는 해당 단계의 계산 신호가 있는 시기예요.</p>
      </section>
      <section className="reunion-v5-section">
        <h4>{next.label}</h4>
        <p>{next.text}</p>
        {meetingAlreadyObserved || observation.state === 'reunited' ? <p>{behaviorText}</p> : <p>{guide.text}</p>}
      </section>
      {reunionV2 ? <section className="reunion-v5-section">
        <h4>관계를 이해하는 해설</h4>
        <div className="reunion-v5-meaning-grid">
          {whyNarrative ? <article className="reunion-v5-meaning-card"><b>왜 다시 연결됐나</b><p>{whyNarrative}</p></article> : <article className="reunion-v5-meaning-card"><b>왜 다시 연결됐나</b><p>정서적 이유를 개인화해서 설명할 계산 문장이 부족해요.</p></article>}
          {rebuildNarrative ? <article className="reunion-v5-meaning-card"><b>재회로 넘어가려면</b><p>{rebuildNarrative}</p></article> : null}
          {sustainabilityNarrative ? <article className="reunion-v5-meaning-card"><b>다시 만났을 때의 유지력</b><p>{sustainabilityNarrative}</p></article> : null}
          {riskNarrative ? <article className="reunion-v5-meaning-card"><b>다시 깨질 수 있는 지점</b><p>{riskNarrative}</p></article> : null}
        </div>
        {(nextUp.length > 0 || down.length > 0) ? <div className="reunion-v5-conditions">
          {nextUp.length > 0 ? <article><b>판정을 올리는 현실 신호</b><ul>{nextUp.slice(0,2).map((item,index)=><li key={index}>{item}</li>)}</ul></article> : null}
          {down.length > 0 ? <article><b>다시 낮춰 봐야 할 신호</b><ul>{down.slice(0,2).map((item,index)=><li key={index}>{item}</li>)}</ul></article> : null}
        </div> : adviceNarratives.length > 0 ? <ul className="reunion-v5-advice">{adviceNarratives.slice(0,2).map((item,index)=><li key={index}>{item}</li>)}</ul> : null}
      </section> : null}
      <details className="reunion-v5-details"><summary>지난 시기와 실제 기록 비교</summary>
        <p>이미 지난 날짜의 비교 자료예요. 예측 적중률을 뜻하지 않아요.</p>
        {!historyCalculated ? <p>과거 분석을 실행하면 기록과 비교할 수 있어요.</p> : null}
        {historyCalculated && historyRows.length === 0 ? <p>선택한 과거 기간을 계산했지만 비교할 시기 신호를 찾지 못했어요.</p> : null}
        {historyRows.map((row,index)=><p key={index}><time>{row.start} ~ {row.end}</time> · {STAGE_LABEL[row.stage] ?? row.label}</p>)}
        {comparisons.map(row=><p key={row.kind+row.date}>{row.label} · {row.date}: {row.detail}</p>)}
      </details>
      <details className="reunion-v5-details"><summary>계산 근거와 점수 보기</summary>
        <p>점수는 계산 신호의 상대적 강도이며 연락·만남·재회 확률이 아니에요.</p>
        {stageRows.map(row=><p key={row.key}>{row.label}: {hierarchyData.stages[row.key]?.activation == null ? '점수 없음' : Math.round(hierarchyData.stages[row.key].activation!)}</p>)}
        {directionRows.filter(row=>row.kind!=='reconnection').map(row=><p key={row.kind}>{row.kind==='incoming'?'상대 차트':'내 차트'} 활성도: {rowScore(row) ?? '정보 없음'}</p>)}
        <p>차트 활성도만으로 수신·발신 행동이나 먼저 연락할 사람을 정할 수 없어요.</p>
        {evidenceRows.map((row,index)=><p key={index}>{evidenceLabel(row)} <small>· 각도 오차</small></p>)}
      </details>
      <p className="reunion-v5-note">실제 연락·만남 기록과 계산 해석을 구분해 읽어주세요.</p>
    </>}
  </section>
}
