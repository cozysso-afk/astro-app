import type { FortuneDailyEvidence, IntegratedApiResponse } from '../appTypes'

export type FortuneEvidenceDirection = 'supportive' | 'challenging' | 'mixed' | 'neutral'

export type FortuneToneAssessment = {
  direction: FortuneEvidenceDirection
  hasSupportiveEvidence: boolean
  hasChallengingEvidence: boolean
  supportiveWeight: number
  challengingWeight: number
  dominantDirection: 'supportive' | 'challenging' | 'balanced' | 'neutral'
}

type CalculationSlice = Pick<IntegratedApiResponse, 'period' | 'western'>

export function evidenceDirection(row: FortuneDailyEvidence) {
  if (row.direction === 'supportive') return 1
  if (row.direction === 'caution' || row.direction === 'challenging') return -1
  if (typeof row.polarity === 'number' && Number.isFinite(row.polarity)) return Math.sign(row.polarity)
  return 0
}

/**
 * Distinct encounters with the same aspect may recur after a gap.
 * Consecutive daily samples remain one episode; a second Moon encounter
 * weeks later is a new episode. This groups presentation evidence only:
 * upstream astrology scores and their original daily rows are not modified.
 */
type EvidenceEpisode = {
  row: FortuneDailyEvidence
  date: string
  endDate: string
  sign: number
  weight: number
  key: string
}
const FAST_TRANSITS = new Set(['Moon','달','Mercury','수성'])
const PLANET_LABEL: Record<string,string> = {
  Sun:'태양',Moon:'달',Mercury:'수성',Venus:'금성',Mars:'화성',
  Jupiter:'목성',Saturn:'토성',Uranus:'천왕성',Neptune:'해왕성',Pluto:'명왕성',
}
const ASPECT_LABEL: Record<string,string> = {
  trine:'삼분위',sextile:'육십분위',square:'사분위',
  opposition:'충',conjunction:'합',
}
export type FortuneEvidenceSnapshot = {
  support?: string
  challenge?: string
  neutral?: string
  dominantDirection: FortuneToneAssessment['dominantDirection']
}

function parseDay(value: string) {
  const ms = Date.parse(value + 'T00:00:00Z')
  return Number.isFinite(ms) ? ms : NaN
}

function episodesFor(calculation: CalculationSlice, topic: string): EvidenceEpisode[] {
  const samples: Array<{row:FortuneDailyEvidence;date:string;sign:number;weight:number;key:string}> = []
  for (const day of calculation.western.daily_scores ?? []) {
    if (day.date < calculation.period.start || day.date > calculation.period.end) continue
    for (const row of day.evidence ?? []) {
      if (!row.source_topics?.includes(topic)) continue
      const contribution = Math.abs(Number(row.contribution ?? 0))
      if (!Number.isFinite(contribution) || contribution <= 0) continue
      const sign = evidenceDirection(row)
      const polarity = row.polarity
      // Neutral conjunctions retain their activation; zero polarity means
      // unknown/neutral direction, not a non-existent configuration.
      const weight = sign === 0 ? contribution
        : contribution * (typeof polarity === 'number' && Number.isFinite(polarity) ? Math.abs(polarity) : 1)
      if (weight <= 0) continue
      const key = row.transit && row.target && row.aspect
        ? [row.transit,row.target,row.aspect,row.whole_house ?? '',sign].join('|')
        : [row.transit ?? '',row.whole_house ?? '',row.text ?? '',sign].join('|')
      samples.push({row,date:day.date,sign,weight,key})
    }
  }
  samples.sort((a,b)=>a.date.localeCompare(b.date) || a.key.localeCompare(b.key))
  const perKey = new Map<string,EvidenceEpisode[]>()
  for (const sample of samples) {
    const list = perKey.get(sample.key) ?? []
    const last = list[list.length-1]
    const gap = last ? (parseDay(sample.date)-parseDay(last.endDate))/86400000 : Infinity
    const continuousDays = FAST_TRANSITS.has(sample.row.transit ?? '') ? 2 : 7
    if (last && gap >= 0 && gap <= continuousDays) {
      last.endDate = sample.date
      if (sample.weight > last.weight) {
        last.row = sample.row
        last.weight = sample.weight
        last.date = sample.date
      }
    } else {
      list.push({row:sample.row,date:sample.date,endDate:sample.date,sign:sample.sign,weight:sample.weight,key:sample.key})
    }
    perKey.set(sample.key,list)
  }
  return [...perKey.values()].flat()
}

function evidenceLabel(episode: EvidenceEpisode, repeated: EvidenceEpisode[]) {
  const row = episode.row
  const transit = PLANET_LABEL[row.transit ?? ''] ?? row.transit
  const target = PLANET_LABEL[row.target ?? ''] ?? row.target
  const aspect = ASPECT_LABEL[row.aspect ?? ''] ?? row.aspect
  const house = row.whole_house ? String(row.whole_house) + '하우스' : ''
  const event = transit && target && aspect
    ? transit + '–출생 ' + target + ' ' + aspect
    : transit ? transit + (aspect ? ' ' + aspect : '') + '의 움직임'
      : house ? house + ' 영역의 근거' : '분야별 계산 근거'
  const dates = [episode.date, ...repeated
    .filter(other=>other !== episode && other.key === episode.key)
    .sort((a,b)=>a.date.localeCompare(b.date)).map(other=>other.date)].slice(0,3)
  const phase = /Applying|적용/i.test(row.motion ?? '') ? '접근 중'
    : /Separating|분리/i.test(row.motion ?? '') ? '분리 중' : ''
  return [event, house, [...new Set(dates)].join('·'), phase].filter(Boolean).join(' · ')
}

export function fortuneEvidenceSnapshot(calculation: CalculationSlice, topic: string): FortuneEvidenceSnapshot {
  const episodes = episodesFor(calculation,topic).sort((a,b)=>b.weight-a.weight)
  const balance = fortuneEvidenceBalance(calculation,topic)
  const lead = (sign:number) => {
    const first = episodes.find(item=>item.sign===sign)
    return first ? evidenceLabel(first,episodes) : undefined
  }
  return {
    support:lead(1), challenge:lead(-1), neutral:lead(0),
    dominantDirection:balance.dominantDirection,
  }
}

export function fortuneEvidenceBalance(calculation: CalculationSlice, topic: string): FortuneToneAssessment {
  const episodes = episodesFor(calculation,topic)
  const supportiveWeight = episodes.filter(item=>item.sign>0).reduce((sum,item)=>sum+item.weight,0)
  const challengingWeight = episodes.filter(item=>item.sign<0).reduce((sum,item)=>sum+item.weight,0)
  const hasSupportiveEvidence = supportiveWeight>0
  const hasChallengingEvidence = challengingWeight>0
  const direction:FortuneEvidenceDirection = hasSupportiveEvidence && hasChallengingEvidence ? 'mixed'
    : hasSupportiveEvidence ? 'supportive' : hasChallengingEvidence ? 'challenging' : 'neutral'
  const total=supportiveWeight+challengingWeight
  const tilt=total ? (supportiveWeight-challengingWeight)/total : 0
  // 3:2 is a *slight* tilt, 1:1 remains balanced. No probability claim.
  const dominantDirection=total===0 ? 'neutral'
    : tilt>=0.15 ? 'supportive'
      : tilt<=-0.15 ? 'challenging' : 'balanced'
  return {direction,hasSupportiveEvidence,hasChallengingEvidence,supportiveWeight,challengingWeight,dominantDirection}
}
export function fortuneToneAssessment(calculation:CalculationSlice,topic:string):FortuneToneAssessment {
  return fortuneEvidenceBalance(calculation,topic)
}
export function fortunePresentationTone(calculation:CalculationSlice,topic:string,average:number,band=''): 'good'|'steady'|'caution' {
  if (topic==='투자주의') return average>=55 || /강|높/.test(band) ? 'caution':'steady'
  const {direction,dominantDirection}=fortuneToneAssessment(calculation,topic)
  if(direction==='supportive'||(direction==='mixed'&&dominantDirection==='supportive'))return 'good'
  if(direction==='challenging'||(direction==='mixed'&&dominantDirection==='challenging'))return 'caution'
  return 'steady'
}

type ToneCopyRow = { topic: string; conclusion?: string; action?: string; change_condition?: string }

function copyKey(value: unknown) {
  return String(value ?? '').replace(/[\s.,!?·~→:;()\[\]-]+/g, '').trim()
}

function tokenOverlap(a: unknown, b: unknown) {
  const left = new Set(String(a ?? '').replace(/[^0-9a-z가-힣]+/gi, ' ').split(' ').filter(token => token.length >= 2))
  const right = new Set(String(b ?? '').replace(/[^0-9a-z가-힣]+/gi, ' ').split(' ').filter(token => token.length >= 2))
  if (!left.size || !right.size) return 0
  return [...left].filter(token => right.has(token)).length / Math.min(left.size, right.size)
}

export function inspectFortuneToneRepetition(rows: ToneCopyRow[]) {
  const issues: string[] = []
  const fields = rows.flatMap(row => [row.conclusion, row.action, row.change_condition].filter((value): value is string => Boolean(value?.trim())))
  const exact = new Map<string, Set<string>>()
  for (const row of rows) for (const value of [row.conclusion, row.action]) {
    const key = copyKey(value)
    if (!key) continue
    exact.set(key, new Set([...(exact.get(key) ?? []), row.topic]))
  }
  if ([...exact.values()].some(topics => topics.size > 1)) issues.push('cross-topic exact duplicate')
  if (fields.filter(value => /확인해[.!]?$/.test(value.trim())).length > 2) issues.push('excessive 확인해 endings')
  if (fields.filter(value => /하지 마[.!]?$/.test(value.trim())).length > 2) issues.push('excessive 하지 마 endings')
  if (rows.length >= 3 && rows.filter(row => /관망/.test(`${row.conclusion ?? ''} ${row.action ?? ''}`)).length === rows.length) issues.push('all topics converge on 관망')
  for (const row of rows) {
    const values = [row.conclusion, row.action, row.change_condition].filter((value): value is string => Boolean(value?.trim()))
    for (let i = 0; i < values.length; i++) for (let j = i + 1; j < values.length; j++) {
      if (copyKey(values[i]) === copyKey(values[j]) || tokenOverlap(values[i], values[j]) >= 0.82) issues.push(`${row.topic}: semantic duplicate fields`)
    }
  }
  return [...new Set(issues)]
}
