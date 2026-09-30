export const PERIOD_NARRATIVE_VERSION = 'fortune-period-narrative-v23.5-structured-editorial-v6'

export type PeriodKind = 'day' | 'week' | 'month' | 'annual'

type EvidenceRow = {
  id?: string
  system?: string
  topic?: string
  scope?: string
  date?: string
  start?: string
  end?: string
  direction?: string
  text?: string
  label?: string
  observation?: {
    transit?: string
    target?: string
    aspect?: string
    motion?: string
  }
}

type PhenomenonCluster = {
  id: string
  label: string
  role: 'trigger' | 'background' | 'tension' | 'support' | 'caution' | 'context'
  systems: string[]
  dates: string[]
  topics: string[]
  directions: string[]
  evidence_refs: string[]
  evidence_count: number
  distinct_dates: number
  salience: number
}

const KIND_ALIASES: Record<string, PeriodKind> = {
  day: 'day',
  week: 'week',
  month: 'month',
  year: 'annual',
  annual: 'annual',
}

const PERIOD_CONTRACT: Record<PeriodKind, {
  objective: string
  sequence: string[]
  evidence_priority: string[]
  forbidden: string[]
  distinctive_requirements: string[]
  granularity: string
}> = {
  day: {
    objective: '오늘 안에서 무엇이 촉발되고 어떻게 체감되는지 읽는다. 기간 평균보다 당일 직접 근거와 시간창이 우선이다.',
    sequence: ['오늘의 촉발', '체감 방식', '시간대 또는 당일 전환', '즉시 행동', '오늘 확인할 현실 신호'],
    evidence_priority: ['intraday_evidence', 'intraday_window', 'daily_actual', 'dated direct evidence'],
    forbidden: ['주간·월간·연간 일반론', '기간 평균을 본문 중심으로 반복', '오늘 근거 없이 장기 추세를 확대'],
    distinctive_requirements: [
      '헤드라인과 첫 문단은 오늘만의 촉발 또는 당일 직접 근거를 중심으로 쓴다.',
      '초반·중반·후반 같은 주간 구조를 만들지 않는다.',
      '행동은 오늘 바로 확인하거나 조정할 수 있는 한 가지 구체 행동으로 끝낸다.',
    ],
    granularity: 'hours-and-one-day',
  },
  week: {
    objective: '7일 안에서 흐름이 어떻게 이동하는지 읽는다. 하루 운세 7개를 붙이지 말고 전환과 누적을 설명한다.',
    sequence: ['이번 주 핵심 흐름', '초반', '중반', '후반', '전환점', '이번 주에 이어지는 행동'],
    evidence_priority: ['daily trajectory', 'dated direct evidence', 'repeated short pattern', 'period context'],
    forbidden: ['날짜별 독립 운세 나열', '월간·연간 구조적 결론', '같은 행동문구 반복'],
    distinctive_requirements: [
      '헤드라인은 특정 하루의 촉발보다 7일간의 이동·누적·전환을 요약한다.',
      '가능하면 서로 다른 날짜 2개 이상을 연결해 초반→중반→후반의 변화를 설명한다.',
      '오늘 운세처럼 즉시 행동 한 줄로 끝내지 말고 이번 주에 유지하거나 조정할 패턴을 제시한다.',
    ],
    granularity: 'early-mid-late-week',
  },
  month: {
    objective: '한 달 안에서 반복되는 패턴과 방향 전환을 읽는다. 단일 고점보다 지속성과 재발 여부를 우선한다.',
    sequence: ['이번 달 큰 흐름', '월초', '중순', '월말', '반복되는 패턴', '일시적인 변화와 지속되는 변화', '현실적 우선순위'],
    evidence_priority: ['weekly or multi-day recurrence', 'month segments', 'dated direct evidence', 'period context'],
    forbidden: ['일일 시간창을 중심축으로 사용', '한 날짜만으로 월 전체를 대표', '주간 문구를 기간만 늘려 재사용'],
    distinctive_requirements: [
      '반복되는 패턴과 월중 방향 전환을 중심으로 쓰고 단일 하루의 분위기를 월 전체 결론으로 확대하지 않는다.',
      '월초·중순·월말 가운데 실제 근거가 있는 구간만 연결한다.',
    ],
    granularity: 'early-mid-late-month',
  },
  annual: {
    objective: '연중 구조적 배경과 큰 전환을 읽는다. 장기 배경과 일시적 촉발을 분리하고 분기·월 단위의 변화를 설명한다.',
    sequence: ['올해의 구조적 테마', '1분기', '2분기', '3분기', '4분기', '장기 배경', '일시적 촉발', '올해의 우선순위'],
    evidence_priority: ['long-running transit context', 'monthly trajectory', 'quarter changes', 'dated peaks as supporting detail'],
    forbidden: ['좋은 날짜 TOP 목록을 본문 중심으로 사용', '일일 행동문구를 연간 조언으로 확대', '짧은 접촉을 연중 지속으로 추정'],
    distinctive_requirements: [
      '장기 배경과 분기별 전환을 먼저 설명하고 특정 하루는 보조 근거로만 쓴다.',
      '연간 조언은 한 해 동안 반복해서 확인할 기준으로 작성한다.',
    ],
    granularity: 'quarters-and-months',
  },
}

function uniq<T>(values: T[]): T[] { return [...new Set(values)] }
function text(value: unknown): string { return String(value ?? '').trim() }
function dateOnly(value: unknown): string { return text(value).match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] ?? '' }

export function normalizePeriodKind(value: unknown): PeriodKind {
  return KIND_ALIASES[text(value)] ?? 'annual'
}

function evidenceDate(row: EvidenceRow): string {
  return dateOnly(row.date) || dateOnly(row.start) || dateOnly(row.end)
}

function normalizedObservationLabel(row: EvidenceRow): string {
  const o = row.observation ?? {}
  if (o.transit && o.target && o.aspect) return `${o.transit} ${o.aspect} ${o.target}`
  const raw = text(row.label || row.text)
    .replace(/\b(?:W|S|T):[^\s),;\]}]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return raw.slice(0, 90) || `${text(row.system) || 'unknown'} evidence`
}

function phenomenonKey(row: EvidenceRow): string {
  const o = row.observation ?? {}
  if (o.transit && o.target && o.aspect) {
    return [text(row.system), text(o.transit), text(o.aspect), text(o.target)].join('|')
  }
  const scope = text(row.scope).replace(/(?:daily|period|month|annual|week)/gi, 'scope')
  return [text(row.system), scope, normalizedObservationLabel(row)].join('|')
}

function roleFor(rows: EvidenceRow[]): PhenomenonCluster['role'] {
  const directions = new Set(rows.map(row => text(row.direction)).filter(Boolean))
  const dates = new Set(rows.map(evidenceDate).filter(Boolean))
  const scopes = rows.map(row => text(row.scope))
  if (directions.has('supportive') && directions.has('caution')) return 'tension'
  if (scopes.some(scope => /intraday|window|detail|daily_actual/.test(scope)) && dates.size <= 2) return 'trigger'
  if (dates.size >= 3 || scopes.some(scope => /period_average|month_average|annual|background/.test(scope))) return 'background'
  if (directions.has('supportive')) return 'support'
  if (directions.has('caution')) return 'caution'
  return 'context'
}

function salienceFor(rows: EvidenceRow[], role: PhenomenonCluster['role']): number {
  const refs = uniq(rows.map(row => text(row.id)).filter(Boolean)).length
  const dates = uniq(rows.map(evidenceDate).filter(Boolean)).length
  const topics = uniq(rows.map(row => text(row.topic)).filter(Boolean)).length
  const explicitObservation = rows.some(row => Boolean(row.observation?.transit && row.observation?.target && row.observation?.aspect))
  return refs * 3 + dates * 4 + topics * 2 + (explicitObservation ? 6 : 0) + (role === 'tension' ? 5 : 0)
}

export function clusterPhenomena(payload: any): PhenomenonCluster[] {
  const ledger: EvidenceRow[] = Array.isArray(payload?.evidence_ledger) ? payload.evidence_ledger : []
  const grouped = new Map<string, EvidenceRow[]>()
  for (const row of ledger) {
    const key = phenomenonKey(row)
    const group = grouped.get(key) ?? []
    group.push(row)
    grouped.set(key, group)
  }

  return [...grouped.entries()].map(([id, rows]) => {
    const role = roleFor(rows)
    const refs = uniq(rows.map(row => text(row.id)).filter(Boolean))
    const dates = uniq(rows.map(evidenceDate).filter(Boolean)).sort()
    return {
      id,
      label: normalizedObservationLabel(rows[0]),
      role,
      systems: uniq(rows.map(row => text(row.system)).filter(Boolean)),
      dates,
      topics: uniq(rows.map(row => text(row.topic)).filter(Boolean)),
      directions: uniq(rows.map(row => text(row.direction)).filter(Boolean)),
      evidence_refs: refs,
      evidence_count: refs.length,
      distinct_dates: dates.length,
      salience: salienceFor(rows, role),
    }
  }).sort((a, b) => b.salience - a.salience)
}

function periodSpecificClusterScore(kind: PeriodKind, cluster: PhenomenonCluster): number {
  let score = cluster.salience
  if (kind === 'day') {
    if (cluster.role === 'trigger') score += 28
    if (cluster.distinct_dates === 1) score += 18
    if (cluster.role === 'background') score -= 18
    if (cluster.distinct_dates >= 3) score -= 22
  } else if (kind === 'week') {
    if (cluster.distinct_dates >= 2 && cluster.distinct_dates <= 7) score += 18
    if (cluster.role === 'background') score += 4
    if (cluster.role === 'tension') score += 6
    if (cluster.distinct_dates === 1) score -= 4
    if (cluster.role === 'trigger' && cluster.distinct_dates <= 1) score -= 4
  } else if (kind === 'month') {
    if (cluster.distinct_dates >= 3) score += 12
    if (cluster.role === 'background') score += 7
  } else {
    if (cluster.role === 'background') score += 14
    if (cluster.distinct_dates >= 4) score += 10
    if (cluster.role === 'trigger' && cluster.distinct_dates <= 1) score -= 4
  }
  return score
}

export function selectNarrativePhenomena(payload: any, limit = 6): PhenomenonCluster[] {
  const kind = normalizePeriodKind(payload?.period_kind)
  return clusterPhenomena(payload)
    .map(cluster => ({ cluster, score: periodSpecificClusterScore(kind, cluster) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(row => row.cluster)
}

export function buildPeriodNarrativeContext(payload: any) {
  const kind = normalizePeriodKind(payload?.period_kind)
  const contract = PERIOD_CONTRACT[kind]
  return {
    version: PERIOD_NARRATIVE_VERSION,
    kind,
    objective: contract.objective,
    granularity: contract.granularity,
    required_sequence: contract.sequence,
    evidence_priority: contract.evidence_priority,
    forbidden_patterns: contract.forbidden,
    distinctive_requirements: contract.distinctive_requirements,
    phenomena: selectNarrativePhenomena(payload),
    interpretation_policy: [
      '먼저 현상 묶음을 읽고 그 다음 어떤 분야에 나타나는지 설명한다.',
      'topic 점수는 중요도와 강약의 보조정보이지 서사의 출발점이 아니다.',
      '같은 천체 구성이 여러 날짜에 반복되면 여러 개의 독립 근거처럼 부풀리지 않는다.',
      'Western·사주·Thai는 독립 체계로 유지하며 같은 시기라고 합산하거나 시너지로 단정하지 않는다.',
      '각 핵심 문단은 왜 그런지 → 어떻게 체감되는지 → 언제 두드러지는지 → 현실에서 무엇을 확인할지 순서로 쓴다.',
    ],
  }
}

function editorialV4Instruction(kind: PeriodKind) {
  const periodWord = kind === 'day' ? '오늘' : kind === 'week' ? '이번 주' : kind === 'month' ? '이번 달' : '올해'
  return `[EDITORIAL_V4 · 최종 사용자에게 보이는 원고]
- 이것은 계산 메모가 아니라 사용자가 실제로 읽는 최종 해설 원고다. 추상적인 운세평을 길게 늘이지 말고 "그래서 내 생활에서 무슨 장면이 생기고, 나는 무엇을 보면 되는가"에 답해라.
- overall.summary는 ${periodWord} 전 섹터를 통틀어 읽은 총평이다. 가장 강한 한 섹터의 verdict를 복사하거나 조금 바꿔 쓰면 실패다.
- overall.summary에는 근거가 있는 한 최소 두 개 이상의 서로 다른 생활 분야를 연결해라. 받쳐주는 분야와 조심할 분야가 함께 있으면 둘의 대비와 ${periodWord} 전체 운영 원칙을 한 문단으로 종합해라.
- headline도 한 섹터의 verdict 복사본이 아니라 전 기간의 핵심 대비나 공통 테마를 새 문장으로 만든다.
- 각 분야 원고는 가능하면 2~3문장으로 쓴다. 1문장째는 결론, 2문장째는 실제 생활 장면이나 판단 기준, 3문장째는 사용자가 취할 행동 또는 확인할 변화를 쓴다. 근거가 약하면 사건을 만들지 말고 무엇까지 말할 수 없는지 분명히 한다.
- "좋다/나쁘다/무난하다/신중해라/흐름을 봐/확인해"만으로 문단을 끝내면 실패다. 다른 날짜·다른 사람에게 그대로 붙일 수 있는 범용 조언도 실패다.

  [clusters structured editorial schema · 문자열 태그 금지]
  - clusters의 각 user-facing section은 문자열이 아니라 conclusion, real_scene, action, change_condition, evidence_refs, applicability를 가진 객체다.
  - applicability는 direct | conditional | insufficient 중 하나다. 직접 근거가 그 상황을 가리킬 때만 direct, 공통 근거의 조건부 현실 번역이면 conditional, 말할 근거가 부족하면 insufficient를 쓴다.
  - relationship은 summary, friends, coworkers, family, new_people, boundaries, love_general, love_single, love_crush, love_flirting, love_ambiguous, love_couple, love_reunion_interest, contact_activation, contact_continuity를 모두 출력한다.
  - friends/coworkers/family/new_people/boundaries는 별도 예측값이 아니다. 공통 대인 근거를 각 상황에 적용한 조건부 번역이며, 상황 고유 직접 근거가 없으면 conditional 또는 insufficient여야 한다.
  - love_single은 새 만남·소개·호감 형성, love_crush는 상호성, love_flirting은 다음 약속·실제 만남, love_ambiguous는 관계 합의·일관성, love_couple은 함께 보내는 시간·갈등 회복, love_reunion_interest는 생각→연락→만남→재구축의 다음 단계와 상승/하락 조건을 각각 다룬다.
  - contact_activation은 전체 연락·대화 활성도, contact_continuity는 질문·답변·약속·후속 대화가 이어지는지를 다룬다. 선연락 방향축으로 대체하지 않는다.
  - work_study는 work, career_change, exam, study를 모두 출력한다. money_news는 money, news를 모두 출력한다. investment는 psychology, realization, entry를 모두 출력한다. condition은 condition을 출력한다.
  - 각 section의 conclusion은 현재 결론, real_scene은 실제 생활 장면/판단 기준, action은 지금 할 일, change_condition은 무엇이 생기면 판단을 올리거나 낮출지를 쓴다.
  - 근거가 약하면 사건을 만들지 말고 applicability=insufficient와 함께 부족한 정보 및 다음 확인 기준을 쓴다.

- 위 structured 원고는 deterministic topic 문장의 재진술이 아니다. 동일 의미를 말만 바꿔 반복하지 말고, evidence가 허용하는 범위 안에서 장면·판단 기준·행동을 추가한다.
- 대인관계, 애정, 연락, 소식은 서로 다른 분야다. 같은 '답장·반응·다음 행동을 봐' 문장을 반복하면 실패다.
- 여섯 애정 항목은 서로 바꿔 붙여도 통하는 범용 문장을 금지한다. 각 상태의 고유 질문이 드러나야 한다.
- contact_flow.incoming은 오직 상대→나 방향, contact_flow.outgoing은 오직 나→상대 방향이다. 둘은 [연락 전체]의 하위 방향축이며 전체 연락 활성도를 대신하지 않는다.
- incoming/outgoing 차이가 작으면 억지로 승자를 만들지 않는다. 수치 차이가 작다는 사실과 '판정상 동률권'을 함께 말할 수는 있다.
- 사용자가 솔로/짝사랑/썸/연애 중이라고 실제 입력했다고 가정하지 않는다. 상태별 애정 문단은 사용자가 자기 상황에 맞춰 골라 읽는 조건부 해설이다.
- 기술용어는 세부 근거에서만 사용하고 사용자 원고에는 사람·일·돈·약속·대화·만남 같은 생활 언어를 우선한다.`
}

export function buildPeriodNarrativeInstruction(payload: any): string {
  const ctx = buildPeriodNarrativeContext(payload)
  const phenomena = ctx.phenomena.map((p, i) =>
    `${i + 1}. ${p.label} | role=${p.role} | dates=${p.dates.join(',') || '-'} | topics=${p.topics.join(',') || '-'} | refs=${p.evidence_refs.join(',')}`
  ).join('\n') || '직접 현상 묶음 없음'

  return `[PERIOD_NARRATIVE_V23]
기간유형=${ctx.kind}
목표=${ctx.objective}
시간해상도=${ctx.granularity}

[반드시 따를 서사 순서]
${ctx.required_sequence.map((x, i) => `${i + 1}. ${x}`).join('\n')}

[근거 우선순위]
${ctx.evidence_priority.map(x => `- ${x}`).join('\n')}

[기간 차별화 필수]
${ctx.distinctive_requirements.map(x => `- ${x}`).join('\n')}

[금지]
${ctx.forbidden_patterns.map(x => `- ${x}`).join('\n')}

[핵심 현상 묶음]
${phenomena}

[해석 원칙]
${ctx.interpretation_policy.map(x => `- ${x}`).join('\n')}

${editorialV4Instruction(ctx.kind)}

중요: day/week/month/annual은 같은 문장을 기간명만 바꿔 재사용하지 마. 이 기간유형의 시간해상도와 서사 순서에 맞춰 새로 조직해.`
}

function tokens(value: string): Set<string> {
  return new Set(value.toLowerCase().replace(/[^0-9a-z가-힣]+/g, ' ').split(/\s+/).filter(x => x.length >= 2))
}

export function lexicalSimilarity(a: string, b: string): number {
  const aa = tokens(a), bb = tokens(b)
  if (!aa.size && !bb.size) return 1
  const overlap = [...aa].filter(x => bb.has(x)).length
  const union = new Set([...aa, ...bb]).size
  return union ? overlap / union : 0
}

export function auditPeriodDistinctness(outputs: Partial<Record<PeriodKind, string>>, maxSimilarity = 0.78) {
  const entries = Object.entries(outputs).filter(([, value]) => text(value)) as Array<[PeriodKind, string]>
  const violations: Array<{ left: PeriodKind; right: PeriodKind; similarity: number }> = []
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const similarity = lexicalSimilarity(entries[i][1], entries[j][1])
      if (similarity > maxSimilarity) violations.push({ left: entries[i][0], right: entries[j][0], similarity })
    }
  }
  return { ok: violations.length === 0, max_similarity: maxSimilarity, violations }
}
