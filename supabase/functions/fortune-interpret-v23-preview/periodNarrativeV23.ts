export const PERIOD_NARRATIVE_VERSION = 'fortune-period-narrative-v23.1-distinct-period-shapes'

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
  // Topic is deliberately NOT part of the primary key. The same astronomical
  // phenomenon may manifest across several life topics and should be interpreted once.
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
    // A day reading should be dominated by one-day triggers, not the same
    // multi-day background that will also lead the weekly reading.
    if (cluster.role === 'trigger') score += 28
    if (cluster.distinct_dates === 1) score += 18
    if (cluster.role === 'background') score -= 18
    if (cluster.distinct_dates >= 3) score -= 22
  } else if (kind === 'week') {
    // A week reading should prefer movement across several dates. A single-day
    // trigger can still appear as a turning point, but it must not own the week.
    if (cluster.distinct_dates >= 2 && cluster.distinct_dates <= 7) score += 18
    if (cluster.role === 'background') score += 4
    if (cluster.role === 'tension') score += 6
    // Keep a one-day trigger available as a weekly turning point, but below
    // genuinely multi-day movement. This preserves direct evidence without
    // letting one day become the whole weekly narrative.
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

export function buildPeriodNarrativeInstruction(payload: any): string {
  const ctx = buildPeriodNarrativeContext(payload)
  const phenomena = ctx.phenomena.map((p, i) =>
    `${i + 1}. ${p.label} | role=${p.role} | dates=${p.dates.join(',') || '-'} | topics=${p.topics.join(',') || '-'} | refs=${p.evidence_refs.join(',')}`
  ).join('\n') || '직접 현상 묶음 없음'

  return `[PERIOD_NARRATIVE_V23]\n기간유형=${ctx.kind}\n목표=${ctx.objective}\n시간해상도=${ctx.granularity}\n\n[반드시 따를 서사 순서]\n${ctx.required_sequence.map((x, i) => `${i + 1}. ${x}`).join('\n')}\n\n[근거 우선순위]\n${ctx.evidence_priority.map(x => `- ${x}`).join('\n')}\n\n[기간 차별화 필수]\n${ctx.distinctive_requirements.map(x => `- ${x}`).join('\n')}\n\n[금지]\n${ctx.forbidden_patterns.map(x => `- ${x}`).join('\n')}\n\n[핵심 현상 묶음]\n${phenomena}\n\n[해석 원칙]\n${ctx.interpretation_policy.map(x => `- ${x}`).join('\n')}\n\n중요: day/week/month/annual은 같은 문장을 기간명만 바꿔 재사용하지 마. 이 기간유형의 시간해상도와 서사 순서에 맞춰 새로 조직해.`
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
