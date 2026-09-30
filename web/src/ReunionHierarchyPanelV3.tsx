import type { Aspect, RelationshipAiResponse } from './appTypes'
import { ReadingTimeline, type DirectionRow } from './ReadingSignals'
import type { ReunionHierarchy } from './lib/reunionHierarchy'
import { polishKoreanSentence } from './lib/fortuneNarrativePolish'

type ReunionSynthesis = NonNullable<NonNullable<RelationshipAiResponse['data']>['reunion_synthesis_v2']>
type Strength = '낮음' | '보통' | '높음' | '정보 부족'
type ScoredDirection = DirectionRow & { score?: number }

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
  return sentenceList(value).filter(row => !TECHNICAL_RE.test(row)).slice(0, limit).join(' ')
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
  const activation = hierarchy.stages?.contact_recontact?.activation
  const band = strengthFromActivation(activation)
  const contactWindows = [...hierarchy.current_windows, ...hierarchy.top_periods].filter(row => row.stage === 'contact_recontact')
  if (band === '정보 부족') return { band, text:'연락·대화 재개 자체의 강도를 판단할 계산 정보가 부족해.', first:'' }
  if (!contactWindows.length) return {
    band,
    text: band === '낮음'
      ? '이번 조회 범위에서는 연락·대화 재개가 두드러지는 구간이 잡히지 않았어.'
      : `연락 단계의 전체 활성도는 ${band}이지만, 특정 구간을 따로 강조할 만큼 시기 근거가 모이지 않았어.`,
    first:'',
  }
  const first = [...contactWindows].sort((a,b) => a.start.localeCompare(b.start))[0]
  const text = band === '낮음'
    ? '연락을 살펴볼 시기는 있지만 전체 연락 활성도 자체는 낮아. 시기가 있다는 이유만으로 연락을 기대하는 쪽으로 확대하지 않아.'
    : band === '높음'
      ? '연락·대화 재개 자체가 이번 조회 범위에서 비교적 두드러져. 연락이 생긴다면 한 번의 반응보다 대화가 이어지는지를 같이 봐.'
      : '연락·대화 재개를 살펴볼 구간은 있어. 강한 확정 신호라기보다 실제 접촉이 생기는지 확인할 정도로 읽는 게 맞아.'
  return { band, text, first:first.start === first.end ? first.start : `${first.start}~${first.end}` }
}

function directionRow(rows: DirectionRow[], kind:'incoming'|'outgoing') {
  return rows.find(row => row.kind === kind) as ScoredDirection | undefined
}

function rowScore(row?: ScoredDirection) {
  return typeof row?.score === 'number' && Number.isFinite(row.score) ? row.score : null
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
    if (diff === 0) return { label:'판정상 동률', text:`상대 → 나 ${roundedA}, 나 → 상대 ${roundedB}. 계산값이 같아서 어느 쪽이 먼저라고 구분되지 않아.` }
    if (Math.abs(diff) < 5) {
      const micro = diff > 0 ? '상대 → 나' : '나 → 상대'
      const pointGap = Math.abs(roundedA - roundedB)
      return {
        label:`판정상 동률권 · ${micro} +${pointGap}`,
        text:`굳이 수치만 비교하면 ${micro}가 ${pointGap}점 높아. 상대 → 나 ${roundedA}, 나 → 상대 ${roundedB}지만 이 차이는 실제 선연락 주체를 확정할 수준은 아니야.`,
      }
    }
    const side = diff > 0 ? '상대 → 나' : '나 → 상대'
    const weak = a < 40 && b < 40
    return {
      label: weak ? `${side} 약우세` : `${side} 우세`,
      text: weak
        ? `상대 → 나 ${roundedA}, 나 → 상대 ${roundedB}. 두 방향 모두 강하지 않지만 상대 비교에서는 ${side} 쪽이 조금 앞서.`
        : `상대 → 나 ${roundedA}, 나 → 상대 ${roundedB}. ${side} 쪽이 반대 방향보다 상대적으로 더 두드러져.`,
    }
  }
  const ar = bandRank(incoming?.band)
  const br = bandRank(outgoing?.band)
  if (ar && br && ar !== br) return { label: ar > br ? '상대 → 나 약우세' : '나 → 상대 약우세', text:'두 방향의 등급 차이는 있지만 실제 선연락 행동을 확정하는 값은 아니야.' }
  return { label:'판정 보류', text:'두 방향을 비교할 독립 계산값이 충분하지 않아 선연락 주체를 만들지 않아.' }
}

function currentState(hierarchy: ReunionHierarchy) {
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
  const stages = stageSet(hierarchy)
  const rows: Array<{ key:string; label:string }> = [
    { key:'emotional_reactivation', label:'다시 의식하기' },
    { key:'contact_recontact', label:'연락·대화' },
    { key:'in_person_meeting', label:'실제 만남' },
    { key:'relationship_rebuilding', label:'관계 재구축' },
  ]
  return rows.map(({key,label}) => {
    const activation = hierarchy.stages?.[key]?.activation
    const band = strengthFromActivation(activation)
    const hasWindow = stages.has(key)
    if (hasWindow) return {
      key,
      label,
      status: band === '정보 부족' ? '시기 근거 있음' : `${band} · 시기 근거 있음`,
      text: key === 'emotional_reactivation' ? '과거 관계를 다시 떠올리거나 서로를 의식하기 쉬운 배경이 잡혀 있어.'
        : key === 'contact_recontact' ? '직접 연락이나 대화 재개를 따로 살펴볼 단계가 잡혀 있어.'
        : key === 'in_person_meeting' ? '연락을 넘어 실제 약속·만남으로 이어지는 단계 근거가 잡혀 있어.'
        : '다시 관계를 운영하기 위한 합의·지속 행동을 볼 단계 근거가 잡혀 있어.',
    }
    return {
      key,
      label,
      status: band === '정보 부족' ? '근거 부족' : `${band} · 뚜렷한 시기 없음`,
      text: key === 'emotional_reactivation' ? '이번 조회에서 다시 의식하는 배경을 따로 강조할 정도의 시기 근거는 약해.'
        : key === 'contact_recontact' ? '연락이 실제로 생길 시기를 따로 강조할 정도의 근거는 약해.'
        : key === 'in_person_meeting' ? '연락이 생기더라도 실제 만남까지 넘어간다고 읽을 근거는 아직 약해.'
        : '만남이 생기더라도 안정적인 관계 재구축까지 넘어갔다고 읽을 근거는 아직 약해.',
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

function conditionalGuides(contactBand: Strength, stages: Set<string>) {
  return [
    {
      title:'현재 완전 단절·차단 상태라면',
      text: contactBand === '낮음'
        ? '연락을 기다리라는 결과로 읽지 마. 지금은 생각이나 배경 신호와 실제 접촉 사이의 거리가 큰 편이라, 차단 해제나 직접 접촉 같은 현실 변화가 생기기 전까지는 관찰 정보로만 두는 게 맞아.'
        : '연락 신호가 있어도 차단 상태 자체를 넘어서는 행동을 예측하지 않아. 차단 해제·직접 접촉처럼 현실에서 확인되는 변화가 먼저야.',
    },
    {
      title:'가끔 연락하거나 안부를 주고받는 중이라면',
      text:'연락 횟수보다 질문과 답이 이어지는지, 구체적인 약속을 잡는지, 예전 문제를 피하지 않는지를 구분해. 안부만 반복되면 재회 단계로 올려 읽지 않아.',
    },
    {
      title:'이미 다시 만나고 있거나 관계가 애매하다면',
      text: stages.has('relationship_rebuilding')
        ? '연락 지수보다 관계 재구축 근거를 우선해. 서로 원하는 관계, 이전 갈등의 처리 방식, 약속을 지키는 행동이 실제로 달라졌는지를 봐.'
        : '연락 지수는 이미 핵심 질문이 아니야. 만남 뒤 관계 정의와 반복 문제를 다루는 행동이 있는지가 더 중요해.',
    },
  ]
}

function timeline(hierarchy: ReunionHierarchy) {
  const seenStages = new Set<string>()
  const rows = [] as Array<{ date:string; kind:'rebuilding'|'incoming'|'reconnection'; label:string; status:string }>
  for (const row of hierarchy.top_periods) {
    if (seenStages.has(row.stage)) continue
    seenStages.add(row.stage)
    rows.push({
      date: row.start === row.end ? row.start : `${row.start}~${row.end}`,
      kind: row.stage === 'relationship_rebuilding' ? 'rebuilding' : row.stage === 'contact_recontact' ? 'incoming' : 'reconnection',
      label: STAGE_LABEL[row.stage] ?? row.label,
      status:'주목',
    })
    if (rows.length >= 3) break
  }
  return rows
}

function evidenceLabel(row: Aspect) {
  const a = String(row.a ?? '')
  const b = String(row.b ?? '')
  const aspect = String(row.aspect ?? '')
  const orb = Number.isFinite(Number(row.orb)) ? `${Number(row.orb).toFixed(2)}°` : ''
  return [a,aspect,b,orb].filter(Boolean).join(' · ')
}

export function ReunionHierarchyPanel({ hierarchyData, evidence, reunionV2, directionRows, sustainabilityText }: {
  hierarchyData: ReunionHierarchy
  evidence: Aspect[]
  reunionV2: ReunionSynthesis | null
  directionRows: DirectionRow[]
  sustainabilityText: string
}) {
  const valid = hierarchyData.validation?.status === 'PASS'
  const contact = contactReading(hierarchyData)
  const initiative = initiativeReading(directionRows)
  const change = behaviorChangeReading(hierarchyData)
  const stages = stageSet(hierarchyData)
  const stageRows = stageVerdicts(hierarchyData)
  const answer = bottomLine(hierarchyData, contact, initiative)
  const next = nextActionReading(contact.band, stages)
  const guides = conditionalGuides(contact.band, stages)
  const events = timeline(hierarchyData)
  const consultation = reunionV2?.consultation_answer
  const answerText = readerSentences(consultation?.current_stage, 3) || answer.text
  const contactText = readerSentences(`${consultation?.contact_type_if_any ?? ''} ${consultation?.continuity ?? ''}`, 3) || contact.text
  const initiativeText = readerSentences(consultation?.initiative, 2) || initiative.text
  const behaviorText = readerSentences(consultation?.behavior_change_evidence, 3) || change.text
  const nextUp = (consultation?.next_stage_up_conditions ?? []).map(item=>readerSentences(item,1)).filter(Boolean).slice(0,3)
  const down = (consultation?.down_conditions ?? []).map(item=>readerSentences(item,1)).filter(Boolean).slice(0,3)

  const rawWhy = reunionV2?.why_reconnect ? `${reunionV2.why_reconnect.conclusion} ${reunionV2.why_reconnect.interpretation}` : ''
  const why = readerSentences(rawWhy, 2) || (stages.has('emotional_reactivation') ? '예전 대화나 감정이 다시 떠오르기 쉬운 배경은 있어. 다만 생각이 나는 것과 실제 연락·만남은 별도 단계로 봐.' : '')
  const repeat = readerSentences(reunionV2?.repeat_risks?.conclusion, 2)
  const repeatPatterns = (reunionV2?.repeat_risks?.patterns ?? []).map(item => readerSentences(item, 1)).filter(Boolean).slice(0, 3)
  const rebuildConditions = (reunionV2?.rebuild?.conditions ?? []).map(item => readerSentences(item, 1)).filter(Boolean).slice(0, 3)
  const evidenceRows = [...evidence].filter(row => Number.isFinite(Number(row.orb))).sort((a,b) => Number(a.orb) - Number(b.orb)).slice(0, 6)

  return <section className="reading-section reunion-hierarchy reunion-ui-v3 reunion-ui-v4">
    <header className="reunion-result-meta" data-reading-export-tone="date"><small>기준일</small><strong>{hierarchyData.as_of_date}</strong></header>
    {!valid ? <p role="alert">계산 검증을 통과하지 못해서 현재·미래 해설을 보류했어.</p> : <>
      <section className="reunion-v3-hero reunion-v4-answer" data-reading-export-tone="love">
        <span>이번 조회의 답</span><h3>{answer.title}</h3><p>{answerText}</p>
      </section>

      <section className="reunion-v4-stage-board">
        <div className="period-ai-section-title"><span>재회 단계 한눈에</span><strong>생각 → 연락 → 만남 → 재구축을 섞지 않아</strong></div>
        <div className="reunion-v4-stage-grid">{stageRows.map(row => <article className="reunion-v3-card reunion-v4-stage-card" key={row.key} data-reading-export-tone={row.key === 'relationship_rebuilding' ? 'favorable' : row.key === 'contact_recontact' ? 'love' : 'system'}>
          <small>{row.label}</small><b>{row.status}</b><p>{row.text}</p>
        </article>)}</div>
      </section>

      <section className="reunion-v3-hero reunion-v4-current" data-reading-export-tone="system">
        <span>CURRENT STATE</span><h3>현재 위치</h3><p>{currentState(hierarchyData)}</p>
      </section>

      <div className="reunion-v3-grid">
        <section className="reunion-v3-card" data-reading-export-tone={contact.band === '낮음' ? 'caution' : 'love'}>
          <small>CONTACT</small><h4>연락 자체는 얼마나 열려 있나</h4><b>{contact.band}</b><p>{contactText}</p>{contact.first && <time>먼저 볼 시기 · {contact.first}</time>}
        </section>
        <section className="reunion-v3-card" data-reading-export-tone="love">
          <small>DIRECTION</small><h4>굳이 비교하면 누가 먼저인가</h4><b>{initiative.label}</b><p>{initiativeText}</p>
        </section>
      </div>

      <section className="reunion-v3-card reunion-v3-change" data-reading-export-tone="favorable">
        <small>BEHAVIOR CHANGE</small><h4>상대가 예전과 다르게 움직일 여지가 있나</h4><b>{change.label}</b><p>{behaviorText}</p>
      </section>

      <section className="reunion-v3-card reunion-v3-next" data-reading-export-tone="system">
        <small>NEXT CHECK</small><h4>그래서 지금 무엇을 보면 되나</h4><b>{next.label}</b><p>{readerSentences(consultation?.meeting_gate,2) || next.text}</p>
        {!!nextUp.length && <><strong>판단을 올릴 조건</strong><ul>{nextUp.map((item,index)=><li key={`up:${index}`}>{item}</li>)}</ul></>}
        {!!down.length && <><strong>다시 낮춰 볼 조건</strong><ul>{down.map((item,index)=><li key={`down:${index}`}>{item}</li>)}</ul></>}
      </section>

      {!!events.length && <section className="reunion-v3-timing" data-reading-export-tone="date"><div className="period-ai-section-title"><span>기억할 시기</span><strong>같은 단계 날짜는 반복하지 않아</strong></div><ReadingTimeline events={events}/></section>}

      {(why || repeat || repeatPatterns.length || rebuildConditions.length) && <section className="reunion-v3-meaning">
        {why && <article className="reunion-v3-card"><h4>왜 다시 생각날 수 있나</h4><p>{why}</p></article>}
        <article className="reunion-v3-card"><h4>재회를 판단할 현실 기준</h4><p>{readerSentences(reunionV2?.rebuild?.conclusion,2) || `연락보다 만남, 이전 문제를 다르게 다루는 대화, 지속 행동이 붙는지가 중요해. ${sustainabilityText}`}</p>
          {!!rebuildConditions.length && <ul>{rebuildConditions.map((item,index) => <li key={index}>{item}</li>)}</ul>}
        </article>
        {(repeat || repeatPatterns.length) && <article className="reunion-v3-card" data-reading-export-tone="caution"><h4>다시 만나면 반복될 수 있는 문제</h4>{repeat && <p>{repeat}</p>}{!!repeatPatterns.length && <ul>{repeatPatterns.map((item,index) => <li key={index}>{item}</li>)}</ul>}</article>}
      </section>}

      <section className="reunion-v3-situations">
        <div className="period-ai-section-title"><span>내 현재 상황에 맞춰 읽기</span><strong>연락 상태가 다르면 같은 결과도 의미가 달라</strong></div>
        {guides.map((item,index) => {
          const keys=['complete_cutoff','occasional_contact','meeting_again'] as const
          const contextual=consultation?.contextual_application?.[keys[index]]
          return <article className="reunion-v3-situation" key={item.title}><strong>{item.title}</strong><p>{readerSentences(contextual,3) || item.text}</p></article>
        })}
      </section>

      <p className="reading-safety-note reunion-single-disclaimer">이 결과는 연락·만남·관계 재구축 단계를 서로 분리해서 보는 상대적 신호야. 실제 행동이나 상대의 속마음을 확정하지 않아.</p>

      <details className="reading-more reunion-calculation-basis" data-reading-export-ignore="true"><summary>계산 근거 자세히 보기</summary>
        <p>{hierarchyData.score_meaning}</p>
        <div className="reunion-stage-activation-list">{Object.entries(hierarchyData.stages).map(([stageKey,stage]) => <p key={stageKey}><b>{STAGE_LABEL[stageKey] ?? stage.label}</b> {stage.activation == null ? '—' : Math.round(stage.activation)}</p>)}</div>
        {!!evidenceRows.length && <div className="reunion-local-evidence-grid">{evidenceRows.map((row,index) => <article className="relationship-pattern reunion-local-evidence" key={`${row.a}:${row.aspect}:${row.b}:${index}`}><strong>{evidenceLabel(row)}</strong></article>)}</div>}
        {reunionV2?.precision_note && <p>{sentences(reunionV2.precision_note,2)}</p>}
        {hierarchyData.limitations.map(item => <p key={item}>{item}</p>)}
      </details>
    </>}
  </section>
}
