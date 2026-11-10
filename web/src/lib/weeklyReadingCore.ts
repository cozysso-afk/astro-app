import type { AiInterpretationResponse, IntegratedApiResponse } from '../appTypes'
import type { AuthoredBlock, AuthoredReadingDocument } from './authoredReadingDocument'
import { weeklyQuestionSections } from './weeklyQuestionEvidence.ts'
import type { FortuneField } from './fortuneFields'

type Data = NonNullable<AiInterpretationResponse['data']>
const calendarDay = (date:string) => date.slice(5).split('-').map(Number).join('월 ')+'일'

function communicationReason(refs:string[], calculation:IntegratedApiResponse, action:string) {
  if(!/약속|대화|협의/.test(action)) return ''
  const dates=new Set<string>(),targets=new Set<string>()
  for (const ref of refs) {
    const m=/^W:daily:(\d{4}-\d{2}-\d{2}):(\d+)$/.exec(ref)
    if(!m || m[1]<calculation.period.start || m[1]>calculation.period.end) continue
    const ev=calculation.western.daily_scores?.find(day=>day.date===m[1])?.evidence?.[Number(m[2])-1]
    if(!ev || ev.transit!=='Mercury' || !['사분위','사각','square'].includes(ev.aspect??'') ||
      !['Saturn','Jupiter'].includes(ev.target??'')) continue
    dates.add(m[1]);targets.add(ev.target!)
  }
  if(!dates.size) return ''
  const ordered=[...dates].sort()
  const consecutive=ordered.length>1 && Date.parse(ordered.at(-1)!)-Date.parse(ordered[0])===(ordered.length-1)*86400000
  const when=consecutive ? calendarDay(ordered[0])+'~'+calendarDay(ordered.at(-1)!) : ordered.map(calendarDay).join('·')
  const lines=[`${when}에 반복해서 살필 주제는 말로 정한 약속이야.`]
  if(dates.size===1) lines[0]=`${when}에는 말로 정한 약속을 한 번 더 확인해 봐.`
  if(targets.has('Jupiter')) lines.push('수성과 목성의 사각은 좋은 뜻으로 한 말이 실제로 할 수 있는 것보다 큰 약속이 되기 쉽다고 읽어.')
  if(targets.has('Saturn')) lines.push('수성과 토성의 사각은 그 약속을 지킬 시간이나 책임 범위를 따져 보라는 근거야.')
  lines.push('예를 들어 “이번 주에 보자”는 말에 둘 다 기분 좋게 답했어도, 어느 날 몇 시에 볼지는 아직 열려 있어. 만남을 원한다면 가능한 시간을 하나 짚어 물어봐.')
  return lines.join(' ')
}

// Promote the dated reading that older documents kept at the bottom of a disclosure.
export function weeklyReadingCore(doc:AuthoredReadingDocument, data:Data, calculation:IntegratedApiResponse, field?:FortuneField): AuthoredReadingDocument {
  const {start,end,day_count} = calculation.period
  if (doc.state==='unverified' || doc.date!==`${start} → ${end}` || day_count!==7) return doc
  const windows=(data.key_windows??[]).filter(w=>w.start>=start && w.start<=end && (w.end||w.start)>=w.start &&
    (w.end||w.start)<=end && w.evidence_refs?.length && w.summary?.trim() &&
    (!field || w.topics?.some(topic=>field.topics.includes(topic)))).sort((a,b)=>a.start.localeCompare(b.start))
  const seen=new Set(doc.core.map(b=>b.text))
  const dates:AuthoredBlock[]=[]
  for (const w of windows) {
    if (seen.has(w.summary)) continue
    const sentences=[w.summary,w.action].filter((s):s is string=>Boolean(s?.trim())&&!seen.has(s))
    sentences.forEach(s=>seen.add(s))
    dates.push({id:'weekly:window:'+dates.length,label:w.end&&w.start!==w.end?`${calendarDay(w.start)}부터 ${calendarDay(w.end)}까지`:calendarDay(w.start),text:sentences.join(' ')})
    if(dates.length===2) break
  }
  if(!dates.length){
    const topics=field?.topics ?? ['연애','대인관계','학업','직장','금전','컨디션']
    const ranges=topics.flatMap(topic=>{
      const days=(calculation.western.daily_scores??[]).filter(day=>day.date>=start && day.date<=end && Number.isFinite(day.scores?.[topic]))
        .map(day=>({date:day.date,score:Number(day.scores[topic])})).sort((a,b)=>a.score-b.score)
      const low=days[0],high=days.at(-1)
      if(!low||!high||low.date===high.date||high.score<=low.score) return []
      return [{topic,low,high,spread:high.score-low.score}]
    }).sort((a,b)=>b.spread-a.spread)
    for(const {topic,low,high} of ranges.slice(0,2)){
      dates.push({id:'weekly:dates:'+topic,label:`${topic} · 날짜별 차이`,text:`이번 주 계산된 날 가운데 ${topic} 지표는 ${calendarDay(high.date)}에 ${high.score}점으로 가장 높고, ${calendarDay(low.date)}에는 ${low.score}점으로 가장 낮아.`})
    }
  }
  const reason=doc.core.find(b=>b.id==='overall:reason')
  const decisionReason=doc.core.find(b=>b.id==='decision:primary:reason')
  const primary=data.decisions?.find(d=>d.action?.trim() && d.evidence_refs?.length)
  const citedReason = !field && primary ? communicationReason(primary.evidence_refs??[],calculation,primary.action) : ''
  const fragment=reason && /(?:공존|압박|긴장|병존|혼재|충돌|상승|하락|집중|강화|중첩)[.!]?$/u.test(reason.text)
  const core:AuthoredBlock[]=doc.core.flatMap(b=>{
    if(fragment && b===reason && (citedReason || decisionReason)) return [{...b,label:citedReason?'날짜별 계산으로 본 이유':b.label,text:citedReason || decisionReason!.text}]
    if(fragment && decisionReason && b===decisionReason) return []
    if (b===reason && fragment) return [{...b,label:'주요 계산 패턴'}]
    return [b]
  })
  core.splice(Math.min(core.length,2),0,...dates)
  const sections=weeklyQuestionSections(doc,calculation)
  let revision=2166136261
  for(const char of JSON.stringify(core)) revision=Math.imul(revision^char.charCodeAt(0),16777619)
  return {...doc,core,sections,revision:doc.revision+'|week:'+revision.toString(16),exportBlockIds:doc.exportBlockIds.length?core.map(b=>b.id):[]}
}
