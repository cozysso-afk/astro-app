import { buildLocalQualityFallbackCore } from '../fortune-interpret-v21-preview/costGuardV21.ts'
import { buildPeriodNarrativeContext, normalizePeriodKind } from './periodNarrativeV23.ts'

function text(value: unknown) { return String(value ?? '').trim() }
function uniq<T>(values: T[]): T[] { return [...new Set(values)] }

function topTopics(base: any) {
  const rows = Object.entries(base?.topic_analysis ?? {}).map(([topic, row]: any) => ({ topic, ...row }))
  const rank = (value: string) => value === '핵심' ? 0 : value === '주목' ? 1 : 2
  return rows.sort((a: any, b: any) => rank(text(a.importance)) - rank(text(b.importance))).slice(0, 4)
}

function phenomenonSentence(ctx: any) {
  const rows = (ctx?.phenomena ?? []).slice(0, 3)
  if (!rows.length) return ''
  return rows.map((row: any) => {
    const when = Array.isArray(row.dates) && row.dates.length ? ` (${row.dates.slice(0, 2).join(', ')})` : ''
    const topics = Array.isArray(row.topics) && row.topics.length ? ` · ${row.topics.slice(0, 3).join('·')}` : ''
    return `${text(row.label)}${when}${topics}`
  }).join('; ')
}

function periodCopy(kind: string, focus: string, evidence: string, start: string, end: string) {
  const range = start && end && start !== end ? `${start}~${end}` : start || '선택 기간'
  if (kind === 'day') return {
    headline: `${range}은 ${focus}에서 오늘 바로 체감되는 변화와 실제 반응을 확인하는 날이야.`,
    summary: `${focus}를 중심으로 오늘 직접 잡힌 근거가 어떻게 체감되는지 보는 게 핵심이야.${evidence ? ` 직접 근거는 ${evidence}.` : ''} 하루 운세이므로 기간 평균이나 장기 추세보다 오늘의 실제 일정·반응·컨디션을 우선해.`,
    pattern: `오늘은 장기 결론보다 당일 촉발과 반응의 연결을 본다. 같은 점수라도 실제 근거가 붙은 분야만 우선해서 확인해.`,
    best: `오늘 안에서 직접 근거가 연결된 순간에 실제 반응이 따라오는지 확인해.`,
    caution: `오늘의 한 장면을 주간·월간·연간 흐름으로 확대하지 마.`,
  }
  if (kind === 'week') return {
    headline: `${range}은 ${focus}가 이번 주 안에서 어떻게 이동하는지 보는 주간 흐름이야.`,
    summary: `${focus}를 하루씩 따로 읽기보다 초반·중반·후반의 이동과 전환을 봐.${evidence ? ` 이번 주 핵심 근거는 ${evidence}.` : ''} 같은 현상이 여러 날 반복되면 사건이 여러 번 생긴다는 뜻이 아니라 주간 배경이 이어진다는 뜻으로 읽어.`,
    pattern: `이번 주는 하루짜리 고점보다 흐름의 이동과 반복을 구분하는 게 중요해. 직접 근거가 모이는 날과 그 전후의 실제 변화를 함께 확인해.`,
    best: `주중 직접 근거가 모이는 구간에서 일정·대화·진척이 실제로 이어지는지 확인해.`,
    caution: `하루의 좋고 나쁨을 이번 주 전체 결론으로 바꾸지 마.`,
  }
  if (kind === 'month') return {
    headline: `${range}은 ${focus}의 반복 패턴과 방향 전환을 확인하는 월간 흐름이야.`,
    summary: `${focus}를 중심으로 월초·중순·월말의 역할이 어떻게 달라지는지 보는 게 핵심이야.${evidence ? ` 이번 달 주요 근거는 ${evidence}.` : ''} 단일 고점보다 여러 날 반복되는 흐름과 다시 나타나는 패턴을 더 중요하게 봐.`,
    pattern: `이번 달은 한 날짜의 강한 점수보다 반복성·지속성·전환 여부를 구분해서 읽어. 월초의 반응이 월말까지 그대로 간다고 가정하지 않아.`,
    best: `여러 날에 걸쳐 직접 근거가 반복되는 구간에서 실제 진척이 누적되는지 확인해.`,
    caution: `하루짜리 피크를 한 달 전체의 대표 흐름으로 확대하지 마.`,
  }
  return {
    headline: `${range}은 ${focus}의 장기 배경과 큰 전환을 구분해서 보는 연간 흐름이야.`,
    summary: `${focus}를 중심으로 올해의 구조적 배경과 분기·월별 변화를 나눠서 봐.${evidence ? ` 연중 핵심 근거는 ${evidence}.` : ''} 짧은 접촉과 장기적으로 반복되는 배경을 분리하고, 한두 날짜의 고점보다 월별·분기별 지속성을 우선해.`,
    pattern: `올해는 단기 촉발과 장기 배경을 같은 무게로 읽지 않아. 반복되는 현상과 월별 변화가 실제 생활의 방향을 어떻게 바꾸는지 확인해.`,
    best: `연중 반복 근거가 모이는 달·분기에서 실제 일정과 선택이 누적되는지 확인해.`,
    caution: `특정 하루의 강한 점수를 올해 전체의 확정적 결과로 바꾸지 마.`,
  }
}

function periodAction(kind: string, topic: string, baseAction: string, timing: string) {
  const when = timing ? ` ${timing} 전후의 실제 반응을 비교하고,` : ''
  if (kind === 'day') return `오늘 ${topic}은 즉시 확인 가능한 변화에 집중해.${baseAction ? ` ${baseAction}` : ''}`
  if (kind === 'week') return `이번 주 ${topic}은 하루별 점수를 따로 쫓기보다${when} 초반·중반·후반의 흐름 차이를 확인해.${baseAction ? ` ${baseAction}` : ''}`
  if (kind === 'month') return `이번 달 ${topic}은 단일 고점보다 반복과 지속성을 우선해.${when}${baseAction ? ` ${baseAction}` : ''}`
  return `올해 ${topic}은 한 번의 고점보다 월별·분기별 누적 변화를 우선해.${when}${baseAction ? ` ${baseAction}` : ''}`
}

export function buildLocalPeriodAwareFallbackV23(payload: any) {
  const base = buildLocalQualityFallbackCore(payload)
  const ctx = buildPeriodNarrativeContext(payload)
  const kind = normalizePeriodKind(payload?.period_kind)
  const topics = topTopics(base)
  const focus = topics.length ? topics.slice(0, 3).map((row: any) => row.topic).join(' · ') : '핵심 분야'
  const evidence = phenomenonSentence(ctx)
  const copy = periodCopy(kind, focus, evidence, text(payload?.period?.start), text(payload?.period?.end))

  base.headline = copy.headline
  base.overall = { ...(base.overall ?? {}), summary: copy.summary, dominant_pattern: copy.pattern, best_phase: copy.best, caution_phase: copy.caution }
  base.limits = `${text(base.limits)} V23 provisional 해설은 Western planet-only 근거만 사용하되 day/week/month/annual의 시간해상도를 서로 다르게 적용해.`.trim()

  for (const [topic, row] of Object.entries(base.topic_analysis ?? {}) as Array<[string, any]>) {
    if (!row || typeof row !== 'object' || text(row.importance) === '참고') continue
    row.action = periodAction(kind, topic, text(row.action), text(row.timing))
    row.confidence_reason = `${text(row.confidence_reason)} 기간유형=${kind}의 시간해상도에 맞춰 직접 근거의 반복성과 시점을 구분했어.`.trim()
  }

  const ordered = uniq(topics.map((row: any) => row.topic))
  base.priorities = ordered.slice(0, kind === 'annual' ? 3 : 2).map((topic: string) => {
    if (kind === 'day') return `${topic}: 오늘 확인 가능한 반응을 우선해.`
    if (kind === 'week') return `${topic}: 이번 주 전환점과 반복되는 흐름을 확인해.`
    if (kind === 'month') return `${topic}: 이번 달 반복성과 지속 여부를 확인해.`
    return `${topic}: 올해 월별·분기별 누적 변화를 확인해.`
  })

  return base
}
