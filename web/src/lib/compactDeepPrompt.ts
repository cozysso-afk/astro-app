import { THREE_SYSTEM_INSTRUCTIONS } from './systemReading'
import { externalFortuneInstructions, externalPeriodKind, fortuneAiPrecisionReadiness, sanitizeCalculationForExternalAi } from './precisionTransport'
import { aspectRole, rankRelationshipAspects } from './relationshipUserSummary'
import type { Aspect } from '../appTypes'

export type ExternalCopyMode = 'compact' | 'full'
export const COMPACT_DEEP_MAX_CHARS = 7500
type Row = Record<string, any>
const list = (x: unknown): Row[] => Array.isArray(x) ? x.filter(v => v && typeof v === 'object') : []
const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
// Omit oversized optional fields whole: never cut serialized JSON or partial evidence sentences.
const pick = (x: Row | undefined, keys: string[]) => Object.fromEntries(keys.flatMap(k => {
  const v = x?.[k]
  return v !== undefined && v !== null && (finite(v) || typeof v === 'boolean' || (typeof v === 'string' && v.length <= 240 && !/\b[WST]:/.test(v))) ? [[k, v]] : []
}))
const unique = <T,>(rows: T[]) => [...new Map(rows.map(row => [JSON.stringify(row), row])).values()]
const TOPICS = new Set(['금전','학업','시험','직장','이직','대인관계','연애','연락','재회','소식','컨디션','투자심리','수익실현','신규진입','투자주의'])
const stat = (s: Row | null | undefined, day = false): Row | null => s ? {
  ...pick(s, day ? ['average','band'] : ['average','band','spread']),
  best: list(s.best_days).slice(0,1).map(x => pick(x,['date','score'])),
  caution: list(s.caution_days).slice(0,1).map(x => pick(x,['date','score'])),
} : null
const evidence = (e: Row) => pick(e,['date','system','transit','target','a','b','aspect','tone','direction','contribution','polarity','label','text'])
const directions = (r: Row | null | undefined) => ({ incoming:stat(r?.incoming ?? r?.수신신호), outgoing:stat(r?.outgoing ?? r?.발신적합), reconnection:stat(r?.reconnection ?? r?.과거인연접점 ?? r?.재접점) })

function fit(instructions: string, build: (level: number) => Row) {
  for (let level = 0; level <= 3; level++) {
    const text = `${instructions}\n[COMPACT_DEEP · 선택 근거만 보존, 생략된 근거는 전체 근거 모드에서 확인]\nCALCULATED_DATA=${JSON.stringify(build(level))}`
    if (text.length <= COMPACT_DEEP_MAX_CHARS) return text
  }
  // Fail visibly rather than silently losing essential axes or emitting broken data.
  throw new Error('핵심 근거를 보존한 압축형이 7,500자를 넘어. 전체 근거 프롬프트를 이용해줘.')
}

export function promptCopyNotice(text: string, mode: ExternalCopyMode = 'compact') {
  const tokens = Math.ceil(new TextEncoder().encode(text).length / 2.6)
  return `${mode === 'compact' ? '심층 프롬프트' : '전체 근거 프롬프트'} 복사 완료 · ${text.length.toLocaleString()}자 · 예상 약 ${tokens.toLocaleString()} tokens`
}

export function buildCompactDeepPacket(input: Row, level = 0, analysis?: Row, focusTopics?: string[]): Row {
  if (!fortuneAiPrecisionReadiness(input).ok) throw new Error('출생시간 검증 정보가 없는 이전 계산이야. 다시 계산한 뒤 심층 프롬프트를 복사해줘.')
  const c = sanitizeCalculationForExternalAi(input), w = c.western ?? {}, p = c.period ?? {}
  const kind = externalPeriodKind(c), day = kind === 'day'
  const inPeriod = (date: string) => typeof date === 'string' && date >= p.start && date <= p.end
  const daily = list(w.daily_scores).filter(d => inPeriod(d.date))
  const topicAnalysis = Array.isArray(analysis?.topic_analysis) ? Object.fromEntries(analysis.topic_analysis.map((x: Row) => [x.topic,x])) : analysis?.topic_analysis ?? {}
  const rows = Object.entries(w.overall ?? {}).filter(([topic,s]) => TOPICS.has(topic) && (!focusTopics || focusTopics.includes(topic)) && finite((s as Row)?.average)).map(([topic,s]) => {
    const candidates = daily.flatMap(d => list(d.evidence).filter(e => e.source_topics?.includes(topic)).map(e => evidence({...e,date:d.date,system:'Western'})))
    const seen = new Set<string>()
    const deduped = candidates.filter(({date: _date,...e}) => {const key=JSON.stringify(e);if(seen.has(key))return false;seen.add(key);return true})
    const positive=deduped.find(e=>Number(e.contribution)>0), negative=deduped.find(e=>Number(e.contribution)<0)
    const linked=unique([positive,negative,...deduped].filter((e):e is Row=>Boolean(e)))
    const importance = topicAnalysis[topic]?.importance
    const score = (s as Row).average, favorable = topic === '투자주의' ? 100-score : score
    const weight = (importance === '핵심' ? 6 : importance === '주목' ? 3 : 0) + Math.min(4,linked.length)
    return {topic,s:s as Row,linked,importance,score,favorable,weight}
  })
  const rank = (mode: 'good'|'caution'|'salience') => (a: typeof rows[number], b: typeof rows[number]) => {
    const value = (x: typeof a) => (mode === 'good' ? x.favorable-50 : mode === 'caution' ? 50-x.favorable : Math.abs(x.favorable-50)) + x.weight
    const priority = (x: typeof a) => {const i=(analysis?.priorities ?? []).findIndex((p: string)=>p.includes(x.topic));return i<0?999:i}
    return value(b)-value(a) || priority(a)-priority(b) || a.topic.localeCompare(b.topic,'ko')
  }
  const good = rows.filter(x => x.favorable >= 55 && x.topic !== '투자주의').sort(rank('good')).slice(0,3)
  const caution = rows.filter(x => x.favorable <=45).sort(rank('caution')).slice(0,2)
  const selected = [...rows].sort(rank('salience')).slice(0,level===3?3:4)
  const names = selected.map(x=>x.topic)
  const dateLimit=level>=2?2:4, evidenceLimit=level>=1?1:2
  const dates: Row[] = unique([
    ...list(w.key_dates).filter(d=>inPeriod(d.date)).sort((a,b)=>(b.salience??0)-(a.salience??0)).flatMap(d=>names.filter(topic=>Array.isArray(d.topics)?d.topics.includes(topic):d.topics?.[topic]).map(topic=>({date:d.date,topic,...pick(d,['salience'])}))),
    ...selected.flatMap(x => [...list(x.s.best_days),...list(x.s.caution_days)].filter(d=>inPeriod(d.date)).map(d=>({topic:x.topic,...pick(d,['date','score'])}))),
  ]).slice(0,dateLimit)
  const windows = unique(list(w.detail_days).filter(d=>inPeriod(d.date) && (day || dates.some(key=>key.date===d.date))).flatMap(d=>names.flatMap(topic=>['best_window','caution_window'].flatMap(type=>{
    const window=d.topics?.[topic]?.[type]
    return window ? [{date:d.date,topic,type,...pick(window,['start','end','score'])}] : []
  })))).slice(0,dateLimit)
  const phases = day ? undefined : selected.map(x=>{
    if(kind==='annual') {
      const months=list(w.months).filter(m=>m.start>=p.start && m.end<=p.end && finite(m.topics?.[x.topic]?.average))
        .map(m=>({...pick(m,['calendar_month','start','end']),...pick(m.topics[x.topic],['average','band'])}))
      const sorted=[...months].sort((a,b)=>Number(b.average)-Number(a.average))
      return {topic:x.topic,strongest:sorted[0],weakest:sorted.at(-1),observed_months:months.length}
    }
    const start=Date.parse(p.start), span=Date.parse(p.end)-start+86400000
    return {topic:x.topic,phases:[0,1,2].map(part=>{
      const samples=daily.filter(d=>finite(d.scores?.[x.topic]) && Math.min(2,Math.floor((Date.parse(d.date)-start)/span*3))===part)
      return samples.length ? {phase:['초반','중반','후반'][part],start:samples[0].date,end:samples.at(-1)?.date,observed_days:samples.length,average:Number((samples.reduce((n,d)=>n+d.scores[x.topic],0)/samples.length).toFixed(2))} : {phase:['초반','중반','후반'][part],observed_days:0}
    })}
  })
  const overlaps=(r:Row)=> typeof r.segment_start==='string' && typeof r.segment_end_exclusive==='string' && r.segment_start<=p.end+'T23:59:59' && r.segment_end_exclusive>p.start
  const auxiliaryLimit=level>=2?1:2
  return {
    focus_topics:focusTopics,period:pick(p,['start','end','day_count']),period_kind:kind,
    precision:pick(c.precision,['status','scoring_mode','allow_natal_moon_scoring','allow_angles_houses_scoring','allow_intraday_timing','allow_saju_ai','allow_thai_ai']),
    favorable:good.map(x=>({topic:x.topic,...pick(x.s,['average','band'])})),caution:caution.map(x=>({topic:x.topic,...pick(x.s,['average','band'])})),
    topics:selected.map(x=>({topic:x.topic,...stat({...x.s,best_days:list(x.s.best_days).filter(d=>inPeriod(d.date)),caution_days:list(x.s.caution_days).filter(d=>inPeriod(d.date))},day),importance:x.importance,evidence:x.linked.slice(0,evidenceLimit)})),
    relationship_signals:[...good,...caution,...selected].some(x=>['연애','연락','재회'].includes(x.topic)) ? directions(w.relationship_signals) : undefined,
    key_dates:dates,windows,phase_digest:phases,
    saju:c.saju?.ok ? [...list(c.saju.annual),...list(c.saju.monthly)].filter(overlaps).slice(0,auxiliaryLimit).map(x=>({...pick(x,['segment_start','segment_end_exclusive','ganzhi','stem_ten_god','jie_name_ko']),branch_links:(x.branch_links??[]).filter((s:unknown)=>typeof s==='string'&&s.length<120).slice(0,2)})) : undefined,
    thai:c.thai?.ok ? {segments:list(c.thai.taksajorn?.segments).filter(x=>x.start<=p.end&&x.end>=p.start).slice(0,auxiliaryLimit).map(x=>({...pick(x,['start','end']),annual_boriwan:pick(x.annual_boriwan,['label','key'])})),bhumi:list(c.thai.mahathaksa?.wheel).filter(x=>['boriwan','mula','utsaha'].includes(x.bhumi_key)).slice(0,level>=2?1:3).map(x=>({bhumi:x.bhumi_label,planet:x.planet?.label}))} : undefined,
    cross_system:list(c.cross_system_timeline).filter(x=>dates.some(d=>d.date===x.date) && (names.includes(x.topic)||x.topics?.some((t:string)=>names.includes(t)))).slice(0,level>=2?1:3).map(x=>pick(x,['date','topic','system','text','label'])),
    limits:'집계는 관측된 날짜만 포함하며 누락 구간을 추정하지 않는다. 생략은 근거 부재나 중립을 뜻하지 않는다. 체계별 맥락은 별도이며 일치로 단정하지 않는다.',
  }
}

export function buildExternalCompactPrompt(calculation: Row, analysis?: Row, precision = false, focusTopics?: string[], readingContext = '') {
  const instructions=readingContext + externalFortuneInstructions(externalPeriodKind(calculation)) + '\n' + THREE_SYSTEM_INSTRUCTIONS + (precision ? '\n[정밀분석] 동일 계산의 정밀 근거를 우선 설명한다. 새 점수 생성 금지, 미계산 항목 추정 금지.' : '')
  return fit(instructions,level=>buildCompactDeepPacket(calculation,level,analysis,focusTopics))
}

export function buildRelationshipCompactPrompt(instructions: string, kind: string, request: Row, calculation?: Row | null, timing?: Row | null) {
  const r=calculation?.result ?? {}, exact=r.natal_synastry?.partner_time_exact===true
  const ranked=rankRelationshipAspects(r.natal_synastry?.aspects ?? [],exact)
  // Give each semantic role one representative before filling remaining slots.
  const roles=unique(ranked.map(aspectRole))
  const aspects=unique([...roles.map(role=>ranked.find(a=>aspectRole(a)===role)!),...ranked])
  const safeAspects=(items:unknown)=>rankRelationshipAspects(list(items) as Aspect[],exact).slice(0,1).map(evidence)
  const axis=(r:Row)=>({ ...directions(r),evidence:list(r?.top_evidence).slice(0,1).map(e=>({ ...pick(e,['date','score']),user_evidence:safeAspects(e.user_evidence),counterpart_evidence:safeAspects(e.counterpart_evidence) })) })
  return fit(instructions.replaceAll('COMPACT_CALCULATED_DATA','CALCULATED_DATA'),level=>({
    analysis_mode:request.analysis_mode ?? kind,relationship_status:request.relationship_status ?? calculation?.relationship_status,
    period:pick(calculation?.period,['start','end']),
    precision:{partner_time_exact:exact,policy:'생시 미검증 시 Moon·ASC/DSC·MC/IC·하우스·Davison·Marks·시간 민감 진행을 추정하거나 복원하지 않는다.'},
    patterns:aspects.slice(0,level>=1?8:10).map(a=>({role:aspectRole(a),...pick(a,['a','b','aspect','tone','orb'])})),
    reunion_directional_context:kind==='reunion'?directions(timing):undefined,
    reunion_dimensions:kind==='reunion'?Object.fromEntries(['contact_recontact','emotional_reactivation','relationship_rebuilding'].map(k=>[k,axis(r.reunion_dimensions?.[k])])):undefined,
    timing:list(r.reunion_transits?.top_days).slice(0,level>=2?2:4).map(d=>({...pick(d,['date','score','user_score','counterpart_score']),hits:list(d.hits).slice(0,1).map(h=>pick(h,['person','transit','target','aspect','tone']))})),
    saju_relationship:r.saju_relationship?.available ? {day_master_relation:r.saju_relationship.day_master_relation,policy:r.saju_relationship.policy,limitations:r.saju_relationship.limitations} : undefined,
    limitations:(r.limitations??[]).filter((s:unknown)=>typeof s==='string'&&s.length<=240).slice(0,3),
    compression_policy:'원자료를 다시 계산하지 않은 선택 뷰. 생략된 층은 전체 근거 모드에서 확인한다. 구조상의 유지력과 시기 활성도는 다르며 합산하지 않는다.',
  }))
}
