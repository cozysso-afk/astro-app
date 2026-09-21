import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { buildFortuneUserSummary, buildRelationshipUserSummary } from './fortuneUserSummary.ts'
import { buildRelationshipUserSummary as relationshipSummary } from './relationshipUserSummary.ts'
import { buildPeriodEvidenceLedger } from './periodEvidenceLedger.ts'
import { buildInterpretationPromptV2 } from './interpretationPromptV2.ts'
import { buildInterpretationPromptCompact } from './interpretationPromptCompact.ts'
import { normalizeTopicEntries } from './interpretationTransport.ts'
import { buildBirthTimeAudit } from './birthTimeAudit.ts'
import { FortuneInterpretationPanel } from '../FortuneInterpretationPanel.tsx'
import { RelationshipInterpretationPanel } from '../RelationshipInterpretationPanel.tsx'
import { SettingsSection } from '../SettingsSection.tsx'
import { PersonalMarriageResult } from '../PersonalMarriageResult.tsx'
import { normalizePeriod, topicOrder } from './constants.ts'

const period=readFileSync(new URL('../FortuneInterpretationPanel.tsx',import.meta.url),'utf8')
const relationship=readFileSync(new URL('../RelationshipInterpretationPanel.tsx',import.meta.url),'utf8')
const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8')
const settings=readFileSync(new URL('../SettingsSection.tsx',import.meta.url),'utf8')
const auth=readFileSync(new URL('../AuthGate.tsx',import.meta.url),'utf8')
const css=readFileSync(new URL('../index.css',import.meta.url),'utf8')

const makeDailyEvidence=(date,topic,score,opts={})=>({date,evidence:[{source_topics:[topic],transit:opts.transit||'Mercury',target:opts.target||'Jupiter',aspect:opts.aspect||'trine',contribution:opts.contribution??4,polarity:opts.polarity??(score>=50?.7:-.7),motion:opts.motion,text:'fixture'}]})
const makeScore=(average,best='2026-09-21',caution='2026-09-22')=>({average,min:average-8,max:average+8,spread:16,best_days:[{date:best,score:average+8}],caution_days:[{date:caution,score:average-8}]})
const baseTopics={금전:55,학업:65,시험:50,직장:60,이직:52,대인관계:58,연애:57,연락:54,재회:51,소식:56,컨디션:53,투자심리:48,수익실현:50,신규진입:49,투자주의:45}

function fixture({focus={},scores={},dailyScores,periodKind='today'}={}){
  const merged={...baseTopics,...scores}
  const data={
    headline:'fixture headline', summary:'fixture summary', priorities:[], decisions:[], clusters:[],
    topic_analysis:Object.fromEntries(Object.keys(merged).map(topic=>[topic,{importance:focus[topic]||'참고',verdict:`${topic} fixture`,reason:'fixture reason',timing:'fixture timing',action:'fixture action',avoid:'fixture avoid',confidence:'보통',confidence_reason:'fixture',evidence_refs:[]}]))
  }
  const calculation={
    period:{start:'2026-09-21',end:periodKind==='today'?'2026-09-21':'2026-09-27',day_count:periodKind==='today'?1:7},
    western:{overall:Object.fromEntries(Object.entries(merged).map(([topic,score])=>[topic,makeScore(score)])),daily_scores:dailyScores??Object.entries(merged).map(([topic,score],i)=>makeDailyEvidence(`2026-09-${String(21+(i%7)).padStart(2,'0')}`,topic,score))},
    saju:{}, thai:{}
  }
  return {data,calculation,summary:buildFortuneUserSummary(data,{period:periodKind,calculation,topicEntries:normalizeTopicEntries(data.topic_analysis,topicOrder)})}
}

// The remainder of this contract file is intentionally unchanged; only the v28 wording assertions below track the new human-copy contract.

test('period result labels natural presentation without claiming deterministic text came from Gemini', () => {
  assert.match(period, /result\.model === 'deterministic-provisional-v2' \|\| localQualityFallback/)
  assert.match(period, /자동 운세 해설/)
  assert.match(period, /맞춤 운세 해설/)
  const defaultMarkup = period.slice(period.indexOf('return <section className="period-ai-card period-ai-v18">'),period.lastIndexOf('<summary>계산 근거 자세히 보기</summary>'))
  assert.doesNotMatch(defaultMarkup,/계산근거 기반 자동 해설|AI\(인공지능\) 기간 해설/)
})

test('daily scene headline changes its language by domain even when the same planet repeats', () => {
  const makeHeadline = ({date,best,watch,transit,target,motion='Applying'}) => {
    const { data, calculation } = fixture({ focus:{[best]:'핵심',[watch]:'주목'}, scores:{[best]:72,[watch]:32} })
    calculation.period.start=date; calculation.period.end=date
    calculation.western.daily_scores=[{date,evidence:[{source_topics:[best],transit,target,aspect:'trine',contribution:4,polarity:.7,motion,text:'fixture'}]}]
    data.priorities=[`${best} 우선 확인 대상`,`${watch} 우선 확인 대상`]
    return buildFortuneUserSummary(data,{period:'today',calculation,topicEntries:normalizeTopicEntries(data.topic_analysis,topicOrder)}).headline
  }
  const rows=[
    makeHeadline({date:'2026-09-21',best:'대인관계',watch:'학업',transit:'Mercury',target:'Jupiter'}),
    makeHeadline({date:'2026-09-22',best:'연애',watch:'연락',transit:'Venus',target:'Moon',motion:'Exact'}),
    makeHeadline({date:'2026-09-23',best:'학업',watch:'컨디션',transit:'Mercury',target:'Saturn'}),
    makeHeadline({date:'2026-09-26',best:'연락',watch:'재회',transit:'Mercury',target:'Venus'}),
    makeHeadline({date:'2026-09-27',best:'이직',watch:'컨디션',transit:'Uranus',target:'Sun',motion:'Separating'}),
  ]
  assert.equal(new Set(rows).size,rows.length)
  const joined=rows.join('\n')
  assert.doesNotMatch(joined,/생각을 정리하고 말을 주고받는 방식이 특히 두드러지고|변화이 특히|에 힘을 쓰기 괜찮지만/)
  assert.match(joined,/대화의 요점과 실제 합의/)
  assert.match(joined,/실제 진도로 옮기는 것/)
  assert.match(joined,/질문과 답장이 실제 대화로 이어지는지 보는 것/)
})
