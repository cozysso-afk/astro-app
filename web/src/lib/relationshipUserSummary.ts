import type { Aspect, FortuneStat, RelationshipAnalysisMode, ReunionTimingContext } from '../appTypes'

const PERSONAL = new Set(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars'])
const OUTER = new Set(['Uranus', 'Neptune', 'Pluto'])
const SENSITIVE = new Set(['Moon', 'ASC', 'DSC', 'MC', 'IC', 'Vertex'])
const PLANETS: Record<string, string> = { Sun: '태양', Moon: '달', Mercury: '수성', Venus: '금성', Mars: '화성', Jupiter: '목성', Saturn: '토성', Uranus: '천왕성', Neptune: '해왕성', Pluto: '명왕성', 'True Node': '교점', 'North Node': '교점' }
type Role = 'communication' | 'attraction' | 'stability' | 'power' | 'perspective'
export type RelationshipPattern = { key: string; role: Role; title: string; conclusion: string; caution: string; reason: string; action: string; challenging: boolean; supportive: boolean }

export function aspectRole(aspect: Aspect): Role {
  const pair = [aspect.a, aspect.b]
  if (pair.includes('Saturn')) return 'stability'
  if (pair.includes('Pluto')) return 'power'
  if (pair.includes('Mercury')) return 'communication'
  if (pair.some(p => ['Venus', 'Mars', 'Moon'].includes(p))) return 'attraction'
  return 'perspective'
}

function aspectKey(aspect: Aspect) { return `${aspect.a}:${aspect.aspect}:${aspect.b}:${aspect.layer ?? 'natal'}` }

export function rankRelationshipAspects(aspects: Aspect[], partnerExact: boolean, sensitive: ReadonlySet<string> = SENSITIVE) {
  const seen = new Set<string>()
  const safe = aspects.filter(aspect => {
    if (!PLANETS[aspect.a] || !PLANETS[aspect.b] || !Number.isFinite(aspect.orb)) return false
    if (!partnerExact && [aspect.a, aspect.b].some(p => SENSITIVE.has(p) || sensitive.has(p))) return false
    const key = aspectKey(aspect)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  const weight = (a: Aspect) => {
    const personal = Number(PERSONAL.has(a.a)) + Number(PERSONAL.has(a.b))
    const generational = OUTER.has(a.a) && OUTER.has(a.b)
    const structural = [a.a, a.b].includes('Saturn') ? 8 : [a.a, a.b].some(p => /Node/.test(p)) ? 4 : 0
    const repeated = Math.min(3, safe.filter(b => aspectRole(b) === aspectRole(a)).length - 1)
    const aspectWeight = ['conjunction', 'opposition', 'square', 'trine', '합', '충', '사분위', '삼분위'].includes(a.aspect) ? 3 : 1
    return personal * 20 + structural + repeated + aspectWeight + Math.max(0, 6 - a.orb) - (generational ? 25 : 0)
  }
  return [...safe].sort((a, b) => weight(b) - weight(a) || a.orb - b.orb || aspectKey(a).localeCompare(aspectKey(b)))
}

function pattern(a: Aspect): RelationshipPattern {
  const role = aspectRole(a)
  const tense = a.tone === 'challenging'
  const positive = a.tone === 'supportive'
  const first = PLANETS[a.a]
  const names = `${first}${(first.charCodeAt(first.length - 1) - 0xac00) % 28 ? '과' : '와'} ${PLANETS[a.b]}`
  const geometry = positive ? '조화로운 배치' : tense ? '긴장을 만드는 배치' : '함께 작용하는 배치'
  const copy = {
    power: { title: tense ? '주도권과 경계의 충돌' : '서로에게 미치는 영향', reason: tense ? '강한 반응이 통제나 힘겨루기로 번지기 쉬워. 서로의 선택권을 지키는지가 중요해.' : '서로에게 깊이 영향을 줄 수 있지만 그 힘을 상대를 바꾸려는 요구로 쓰지는 마.', action: '원치 않는 일에는 거절할 수 있는지, 서로의 사생활을 존중하는지 봐.' },
    communication: { title: tense ? '말이 엇갈릴 때의 반응' : '대화를 이어가는 방식', reason: tense ? '말의 속도나 받아들이는 방식이 달라 대화가 쉽게 끊길 수 있어.' : positive ? '다른 생각을 주고받으며 대화를 풀어가는 데 힘을 보태.' : '생각을 자극하지만 편안한 대화로 이어질지는 반응을 더 봐야 해.', action: '감정을 추측하기보다 한 번에 한 가지를 묻고 답할 여유를 줘.' },
    attraction: { title: tense ? '끌림과 속도 차이' : '호감을 주고받는 방식', reason: tense ? '끌리더라도 원하는 거리와 표현 속도가 달라 부딪힐 수 있어.' : positive ? '호감을 표현하고 받아들이는 데 비교적 자연스럽게 힘이 실려.' : '서로 의식하기 쉬워도 호감과 부담 중 어느 쪽으로 이어질지는 단정할 수 없어.', action: '끌림만으로 관계를 판단하지 말고 만남 뒤에도 태도가 이어지는지 봐.' },
    stability: { title: tense ? '책임과 거리의 부담' : '꾸준함을 만드는 약속', reason: tense ? '책임이나 기대가 압박으로 느껴질 수 있어. 부담을 한 사람만 떠안지 않는지가 중요해.' : positive ? '약속을 지키고 관계에 꾸준히 시간을 쓰는 데 힘을 보태.' : '관계를 진지하게 대하는 마음과 의무감이 함께 작용할 수 있어.', action: '연락 빈도와 서로 감당할 수 있는 약속부터 구체적으로 맞춰봐.' },
    perspective: { title: '기대와 현실 사이', reason: tense ? '서로 기대하는 방향이 달라 이해가 엇갈릴 수 있어.' : positive ? '서로의 관점을 넓히는 데 도움을 줄 수 있어.' : '서로에게 의미를 느껴도 그 자체가 관계의 미래를 보장하지는 않아.', action: '같은 미래를 원하는지 말뿐 아니라 선택과 행동을 함께 봐.' },
  }[role]
  const pair = new Set([a.a, a.b])
  const detail = role === 'communication'
    ? pair.has('Uranus') ? '수성은 말과 이해를, 천왕성은 익숙한 방식을 벗어나려는 움직임을 읽는 단서야. 대화가 새로워지는 힘과 예측하기 어려운 속도를 함께 봐야 해.'
      : pair.has('Neptune') ? '수성이 다루는 구체적인 말에 해왕성의 상상과 기대가 겹쳐 있어. 말하지 않은 뜻을 서로 다르게 받아들이는지를 살펴봐.'
      : '수성은 말을 주고받고 상황을 이해하는 방식과 연결돼. 대화가 잘 통한다는 느낌뿐 아니라 서로 같은 뜻으로 이해했는지가 중요해.'
    : role === 'attraction'
    ? pair.has('Venus') && pair.has('Mars') ? '금성은 편안하게 느끼는 애정 표현을, 화성은 먼저 다가가는 힘을 읽는 단서야. 끌림의 크기와 서로 편안한 속도는 따로 살펴봐.'
      : pair.has('Moon') ? '달은 정서적인 반응과 안심하고 싶은 마음에 연결돼. 즐거운 순간뿐 아니라 피곤하거나 예민할 때 서로를 어떻게 대하는지도 중요해.'
      : '애정을 표현하는 방식과 상대에게 다가가는 리듬이 맞물리는 지점이야. 호감이 있어도 필요한 거리와 표현의 양은 다를 수 있어.'
    : role === 'stability' ? '토성은 시간을 들여 지키는 책임과 관계 안에서 느끼는 부담을 함께 읽는 단서야. 오래 이어지는 것과 편안하게 유지되는 것은 같은 뜻이 아니야.'
    : role === 'power' ? '명왕성은 서로에게 강하게 영향을 주는 지점을 읽는 단서야. 몰입이 깊어져도 상대의 선택을 대신하거나 거절을 압박하는 행동은 구분해야 해.'
    : pair.has('Jupiter') ? '목성은 기대를 넓히고 가능성을 보는 방식과 연결돼. 함께 그리고 싶은 미래가 실제 선택에서도 같은 방향인지 살펴봐.'
    : '서로 자극받는 관점이 있다는 뜻이야. 같은 감정을 느끼거나 같은 미래를 원한다는 결론까지 확대하지는 마.'
  const caution = role === 'communication' ? '답이 늦거나 표현이 낯설다는 이유만으로 속마음을 결론 내리지 마. 합의가 필요한 말은 서로 이해한 뜻을 다시 말해봐.'
    : role === 'attraction' ? '강한 끌림을 관계에 대한 약속으로 받아들이지는 마. 말과 만남 이후의 태도가 함께 이어지는지가 중요해.'
    : role === 'stability' ? '참는 사람이 늘 같은 쪽이라면 오래 버틴다는 이유만으로 안정적이라고 보지는 마.'
    : role === 'power' ? '질투나 집착을 애정의 크기로 받아들이지 마. 거절과 사생활을 존중하는지가 먼저야.'
    : '좋은 기대만으로 생활 조건의 차이를 넘기지 마. 바꿀 수 있는 것과 양보하기 어려운 것을 나눠봐.'
  return { key: aspectKey(a), role, title: copy.title, conclusion: `${copy.reason} ${{ communication: '대화가 어긋난 뒤 서로 설명할 여유를 주는지가 관계의 차이를 만들어.', attraction: '좋았던 만남 하나보다 그 뒤에도 서로 편안한 태도가 이어지는지를 봐.', stability: '작은 약속을 지속적으로 지키는 과정에서 이 차이가 드러나기 쉬워.', power: '한쪽만 관계의 속도와 규칙을 정하지 않는지가 중요한 기준이야.', perspective: '서로 원하는 방향을 구체적인 생활 선택에 놓고 비교해봐.' }[role]}`, caution, reason: `${names}의 ${geometry}가 잡혀 있어. ${detail}`, action: copy.action, challenging: tense, supportive: positive }
}

export function buildRelationshipUserSummary(input: { aspects: Aspect[]; partnerExact: boolean; sensitive?: ReadonlySet<string>; timing?: ReunionTimingContext | null; mode: RelationshipAnalysisMode }) {
  const ranked = rankRelationshipAspects(input.aspects, input.partnerExact, input.sensitive)
  const individualPatterns = ranked.filter(a => !(OUTER.has(a.a) && OUTER.has(a.b))).map(pattern).map(p => {
    if (!input.mode.startsWith('marriage_')) return p
    if (p.role === 'attraction') return { ...p, conclusion: input.mode === 'marriage_married' ? `${p.challenging ? '애정이 있어도 편안함을 느끼는 방식은 다를 수 있어.' : '익숙한 사이에서도 애정을 주고받는 방식이 관계의 온도를 바꿔.'} 함께 있을 때의 거리와 혼자 회복할 시간을 같이 살펴봐.` : p.conclusion, action: input.mode === 'marriage_married' ? '익숙함에 기대지 말고 서로 편안하게 느끼는 애정 표현과 혼자 쉴 시간을 이야기해봐.' : '호감뿐 아니라 함께 지낼 때 필요한 거리와 애정 표현을 이야기해봐.' }
    if (p.role === 'stability') return { ...p, action: '생활비와 집안일, 돌봄을 누가 얼마나 맡을지 구체적으로 나눠봐.' }
    return p
  })
  // One visible pattern per semantic role; retain every aspect in the raw disclosure.
  const patterns: RelationshipPattern[] = []
  const interaction: Record<Role, [string,string,string]> = {
    communication: ['말이 통하는 순간과 엇갈리는 순간','수월하게 생각을 나누는 접점과 말이 어긋나는 접점이 함께 있어.','말문이 잘 트여도 어려운 이야기를 끝까지 풀어가는지는 별도로 봐야 해. 중요한 부탁에 서로 같은 내용으로 답하는지가 판단 기준이야.'],
    attraction: ['끌림 속에서 맞춰야 할 거리','호감 표현을 돕는 접점과 서로 편안한 거리가 어긋나는 접점이 같이 잡혀 있어.','만나고 싶은 마음이 있어도 표현의 양까지 같지는 않을 수 있어. 만남 전의 기대보다 만난 뒤에도 편안한 연락과 태도가 이어지는지 살펴봐.'],
    stability: ['이어갈 힘과 감당할 부담','약속을 지키는 쪽과 책임을 압박으로 느끼는 쪽의 접점이 함께 있어.','이 관계의 유지력은 버티는 기간만으로 읽기 어려워. 부담을 이야기했을 때 약속을 서로 감당할 만큼 수정할 수 있는지가 더 중요해.'],
    power: ['몰입과 선택권 사이','서로 깊이 관여하는 접점 안에 도움과 긴장이 함께 있어.','관심이 크다는 이유로 한쪽이 관계의 규칙을 정해도 된다는 뜻은 아니야. 친밀해진 뒤에도 거절과 사생활이 존중되는지를 기준으로 삼아.'],
    perspective: ['함께 기대하는 것의 차이','시야를 넓히는 부분과 기대가 엇갈리는 부분이 공존해.','같은 미래를 말해도 시간이나 돈을 쓰는 선택은 다를 수 있어. 바꾸기 어려운 조건부터 구체적으로 나눠 이야기할 필요가 있어.'],
  }
  for (const role of [...new Set(individualPatterns.map(p=>p.role))]) {
    const group=individualPatterns.filter(p=>p.role===role)
    const positive=group.find(p=>p.supportive), negative=group.find(p=>p.challenging)
    const primary=group[0]
    const secondary=positive&&negative ? (primary.supportive?negative:positive) : group[1]
    const combined=positive&&negative
    const [title,conclusion,meaning]=interaction[role]
    // Unknown/mixed tone alone is never turned into a claim of positive + negative agreement.
    const reason=secondary ? `${primary.reason} ${secondary.reason.split('. ')[0]}. ${combined ? meaning : '여러 접점이 같은 주제를 건드리지만, 접점 수가 많다고 결과가 확정되는 건 아니야.'}` : primary.reason
    patterns.push({...primary,key:role,title:combined?title:primary.title,conclusion:combined?`${conclusion} 한 가지 장점만으로 관계 전체를 판단하기보다, 서로 다른 반응이 어떤 상황에서 나타나는지 나눠 읽어야 해.`:primary.conclusion,reason,
      action: input.mode==='marriage_married' && role==='communication' ? '같은 다툼이 시작되는 말과 시간을 함께 적어봐. 피곤할 때는 결론을 미루되 언제 다시 이야기할지 정해 두는 게 실제 조정이야.'
        : input.mode==='marriage_unmarried' && role==='stability' ? '생활비와 집안일을 얼마나 나눌지 구체적인 사례로 이야기해봐. 약속하기 쉬운 답보다 각자의 일정 안에서 실제로 지킬 수 있는 범위를 확인해야 해.'
        : input.mode==='reunion' && role==='communication' ? '다시 연락이 닿으면 이전에 대화가 끊긴 문제를 한 가지씩 다뤄봐. 사과나 안부만 오가는 단계와 해결 방법에 서로 동의하는 단계를 나눠서 봐야 해.' : primary.action,
      challenging:Boolean(negative),supportive:Boolean(positive)})
  }
  const stability = patterns.filter(p => p.role === 'stability')
  const friction = patterns.filter(p => p.challenging)
  const positiveStructure = ranked.some(a => aspectRole(a) === 'stability' && a.tone === 'supportive')
  const negativeStructure = ranked.some(a => aspectRole(a) === 'stability' && a.tone === 'challenging')
  const sustainability = !stability.length ? '정보 부족' : positiveStructure && !negativeStructure && !friction.length ? '안정적' : negativeStructure && !positiveStructure ? '불안정' : '혼합'
  const sustainabilityText = sustainability === '안정적' ? '책임을 뜻하는 토성 접점이 꾸준함을 돕는 방향으로 잡혀 있어. 이는 오래 함께할 기반을 읽는 단서이고, 갈등이 없거나 늘 편안하다는 보장은 아니야. 실제로 서로의 시간을 존중하고 약속을 지켜 나갈 때 이 장점이 드러날 수 있어.'
    : sustainability === '불안정' ? '책임을 뜻하는 토성 접점에 긴장이 잡혀 있어, 오래 이어지는 것과 편안하게 지내는 것을 구분해야 해. 한 사람이 계속 버텨야 유지되는 방식인지, 함께 부담을 줄일 방법이 있는지가 핵심이야.'
    : sustainability === '혼합' ? '관계를 이어가는 접점과 조정이 필요한 부분을 함께 읽어야 해. 지킬 수 없는 약속을 늘리기보다, 의견이 어긋난 뒤에도 합의를 다시 만들 수 있는지가 유지력의 기준이야.'
    : '오래 유지할 힘을 판단할 접점이 부족해. 끌림만으로 지속성을 단정하지 않을게.'
  const direction = (stat: FortuneStat | null | undefined, kind: 'incoming' | 'outgoing' | 'reconnection') => {
    const score = stat?.average
    const band = typeof score !== 'number' || !Number.isFinite(score) ? '정보 부족' : score >= 60 ? '강함' : score < 40 ? '약함' : '보통'
    const copy = {
      incoming: { 강함: '상대 쪽 움직임이 비교적 강하게 잡혀 있어. 실제 연락이 오면 대화를 이어갈 의지가 있는지 봐.', 약함: '상대가 먼저 연락할 흐름은 약한 편이야. 기다림만으로 일정을 비워 두지는 마.', 보통: '상대의 반응은 열려 있지만 먼저 연락이 온다고 기대하기엔 뚜렷하지 않아.' },
      outgoing: { 강함: '내가 먼저 짧게 말을 꺼내기 좋은 편이야. 답이 애매하면 더 밀지는 마.', 약함: '지금은 먼저 밀어붙이기보다 하고 싶은 말을 정리해 두는 편이 좋아.', 보통: '가벼운 안부 정도는 생각해볼 수 있어. 답장의 구체성을 보고 다음을 정해.' },
      reconnection: { 강함: '다시 대화가 시작되는 움직임을 살펴볼 때야. 재회가 확정된다는 뜻은 아니야.', 약함: '과거 인연과 다시 이어질 신호는 약해. 추억을 현재의 의사로 읽지는 마.', 보통: '재접촉의 여지는 있지만 관계 회복까지 이어질지는 실제 행동을 더 봐야 해.' },
    }
    const point = band === '약함' ? stat?.caution_days?.[0] : stat?.best_days?.[0]
    const timing = stat && stat.spread > 0 && point && input.timing && point.date >= input.timing.period.start && point.date <= input.timing.period.end ? point.date : undefined
    return { band, text: band === '정보 부족' ? '이 방향을 판단할 계산 정보가 없어. 다른 방향의 점수로 대신하지 않을게.' : copy[kind][band], timing }
  }
  const incoming = direction(input.timing?.incoming, 'incoming')
  const outgoing = direction(input.timing?.outgoing, 'outgoing')
  const reconnection = direction(input.timing?.reconnection, 'reconnection')
  const windows = (['incoming','outgoing','reconnection'] as const).flatMap(kind=>{
    const stat=input.timing?.[kind]
    if(!stat || !stat.spread || !input.timing)return []
    return (['best_days','caution_days'] as const).flatMap(source=>{
      const point=stat[source]?.[0]
      if(!point || point.date<input.timing!.period.start || point.date>input.timing!.period.end)return []
      const caution=source==='caution_days'
      return [{date:point.date,kind,label:{incoming:'상대 쪽 반응을 살펴볼 때',outgoing:'내가 말을 꺼낼 속도를 정할 때',reconnection:'과거 인연과 접점이 두드러지는 때'}[kind],band:point.score>=60?'강함':point.score<40?'약함':'보통',status:caution?'주의':'활용',detail:caution?'이 축에서 상대적으로 힘이 약한 날짜야. 다른 방향까지 약하다거나 연락이 끊긴다는 뜻은 아니야.':'이 축에서 상대적으로 힘이 실리는 날짜야. 실제 연락과 약속으로 이어지는지 살펴보되 관계 회복까지 확정하지는 않아.'}]
    })
  })

  const reunion = input.mode === 'reunion'
  const headline = !patterns.length && input.mode !== 'reunion' ? '현재 입력으로 확정할 수 있는 관계 접점이 부족해. 감정과 생활의 궁합을 단정하지 않을게.' : input.mode === 'marriage_married'
    ? friction.length ? '현재 부부관계에서는 반복되는 부담을 나눠 갖는 게 중요해. 책임과 대화 방식을 함께 조정해봐.' : '현재 부부관계의 꾸준함을 살리는 쪽으로 봐. 서로 지키는 작은 약속과 생활 리듬이 중요해.'
    : input.mode === 'marriage_unmarried'
    ? stability.length ? '결혼 상대로서의 안정성은 끌림과 따로 봐야 해. 함께 감당할 책임과 생활 방식을 먼저 맞춰봐.' : '함께 살 때의 안정성을 단정할 근거는 부족해. 결혼을 결정하기 전에 생활과 책임을 구체적으로 이야기해봐.'
    : reunion
    ? reconnection.band === '강함' ? `재접촉의 움직임은 살아 있어. ${friction.length ? '다만 다시 만나기 전에 반복되는 갈등을 풀 방법부터 맞춰야 해.' : '다시 이어진 뒤에도 약속이 지켜지는지 천천히 봐.'}`
      : reconnection.band === '약함' ? '지금은 재접촉을 크게 기대하기보다, 다시 대화할 때 달라져야 할 점을 정리하는 편이 좋아.'
      : reconnection.band === '정보 부족' ? '재접촉 시기는 판단할 정보가 부족해. 두 사람 사이에서 반복되기 쉬운 패턴부터 살펴볼게.'
      : '다시 대화할 여지는 열려 있지만, 관계 회복은 그 뒤의 행동을 보고 판단하는 편이 좋아.'
    : friction.length ? '서로 자극하는 힘이 있어도 편안함과는 다를 수 있어. 반복해서 부딪히는 부분을 어떻게 조율하는지가 중요해.' : patterns.length ? '서로 맞물리는 부분을 살릴 수 있어. 호감보다 약속과 대화가 꾸준히 이어지는지를 봐.' : '확정할 수 있는 접점이 적어 관계 전체를 단정하기 어려워.'
  const roleLabel: Record<Role, string> = { communication: '서로 말을 이해하는 방식', attraction: '애정을 주고받는 방식', stability: '약속과 책임의 분담', power: '서로의 선택권', perspective: '함께 기대하는 방향' }
  const supportive = patterns.find(p => p.supportive)
  const difficult = friction[0]
  const orientation = supportive && difficult && supportive.role !== difficult.role
    ? `${roleLabel[supportive.role]}에는 도움을 주는 접점이 있고, ${roleLabel[difficult.role]}에는 조정이 필요해.`
    : difficult ? `${roleLabel[difficult.role]}에서 생기는 부담을 먼저 다뤄야 해.`
    : supportive ? `${roleLabel[supportive.role]}에서 서로를 돕는 접점부터 살려봐.` : ''
  const marriage = input.mode.startsWith('marriage_')
  const married = input.mode === 'marriage_married'
  const sections = [
    { id: 'attraction', title: '감정 · 친밀감', rows: patterns.filter(p => p.role === 'attraction'), empty: '감정과 친밀감을 구체적으로 풀어낼 접점이 부족해. 실제 표현 방식은 대화로 알아가는 게 좋아.' },
    { id: 'communication', title: marriage ? '갈등 해결' : '대화 · 소통', rows: patterns.filter(p => p.role === 'communication'), empty: '대화 방식을 단정할 접점이 부족해. 서로 불편했던 말을 구체적으로 묻는 데서 시작해봐.' },
    { id: 'stability', title: marriage ? '책임 · 현실 생활' : '관계의 약속', rows: patterns.filter(p => p.role === 'stability'), empty: '책임과 생활 리듬을 판단할 접점이 부족해. 역할 분담과 시간 사용을 실제로 맞춰봐야 해.' },
    { id: 'power', title: '관계의 힘의 균형', rows: patterns.filter(p => p.role === 'power'), empty: '주도권이나 통제 문제를 단정할 근거는 없어. 한쪽만 결정하거나 양보하는지는 현실에서 별도로 봐.' },
    { id: 'perspective', title: '기대와 현실', rows: patterns.filter(p => p.role === 'perspective'), empty: '' },
  ]
  const practical = marriage
    ? negativeStructure ? '한 사람이 집안일과 책임을 떠안지 않도록 분담 범위와 쉴 시간을 구체적으로 정해봐.' : '함께 쓰는 돈과 혼자 보내는 시간, 집안일을 어떻게 나눌지 이야기해봐.'
    : friction.some(p => p.role === 'communication') ? '말이 엇갈릴 때 바로 결론 내리지 말고, 각자 받아들인 뜻을 한 번씩 말해봐.' : '편안한 연락 빈도와 함께 보내고 싶은 시간을 서로 맞춰봐.'
  return { mode: input.mode, title: reunion ? '재회 흐름 한눈에' : married ? '지금 우리 부부' : marriage ? '결혼 궁합 한눈에' : '한눈에 궁합',
    strengthsTitle: marriage ? '함께 살 때 강점' : '잘 맞는 점', frictionTitle: marriage ? '생활에서 부딪힐 점' : '부딪히기 쉬운 점',
    stabilityTitle: reunion ? '다시 붙었을 때 유지력' : married ? '관계 회복력 · 장기 안정성' : marriage ? '결혼 유지력' : '장기 유지력',
    practicalTitle: married ? '지금 함께 바꿔볼 것' : marriage ? '결혼 전 확인할 것' : '현실에서 맞춰야 할 것',
    practical, sections, strengths: patterns.filter(p => p.supportive).map(p => p.title),
    headline: [headline, orientation].filter(Boolean).join(' '), incoming, outgoing, reconnection, sustainability, sustainabilityText, windows,
    friction, patterns: patterns.filter(p => !friction.some(f => f.key === p.key)), ranked }
}
