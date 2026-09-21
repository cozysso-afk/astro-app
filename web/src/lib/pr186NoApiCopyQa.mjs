import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { fortuneFixture, aspects, timing, stat, topics } from './readingExperience.fixtures.mjs'

const server = await createServer({root:fileURLToPath(new URL('../..',import.meta.url)),server:{middlewareMode:true},appType:'custom'})
try {
  const { buildFortuneUserSummary } = await server.ssrLoadModule('/src/lib/fortuneUserSummary.ts')
  const { RelationshipInterpretationPanel: Relationship } = await server.ssrLoadModule('/src/RelationshipInterpretationPanel.tsx')
  const noAction = () => { throw new Error('NO_API_QA: provider call attempted') }

  const dailyCases = [
    {date:'2026-09-21',best:'대인관계',watch:'학업',scores:{대인관계:72,학업:34},lead:{transit:'Mercury',target:'Jupiter',polarity:.7,motion:'Applying'}},
    {date:'2026-09-22',best:'연애',watch:'연락',scores:{연애:71,연락:35},lead:{transit:'Venus',target:'Moon',polarity:.7,motion:'Exact'}},
    {date:'2026-09-23',best:'학업',watch:'컨디션',scores:{학업:76,컨디션:30},lead:{transit:'Mercury',target:'Saturn',polarity:.65,motion:'Applying'}},
    {date:'2026-09-24',best:'직장',watch:'대인관계',scores:{직장:73,대인관계:33},lead:{transit:'Jupiter',target:'Sun',polarity:.65,motion:'Separating'}},
    {date:'2026-09-25',best:'금전',watch:'투자주의',scores:{금전:69,투자주의:78},lead:{transit:'Saturn',target:'Venus',polarity:.55,motion:'Exact'}},
    {date:'2026-09-26',best:'연락',watch:'재회',scores:{연락:68,재회:31},lead:{transit:'Mercury',target:'Venus',polarity:.6,motion:'Applying'}},
    {date:'2026-09-27',best:'이직',watch:'컨디션',scores:{이직:70,컨디션:32},lead:{transit:'Uranus',target:'Sun',polarity:.55,motion:'Separating'}},
  ]

  const headlines=[]
  for (const c of dailyCases) {
    const f=fortuneFixture('today')
    f.calculation.period.start=c.date; f.calculation.period.end=c.date
    f.data.priorities=[c.best,c.watch]
    for (const topic of topics) {
      const score = c.scores[topic] ?? 50
      f.calculation.western.overall[topic]=stat(score)
      f.data.topic_analysis[topic].importance = topic===c.best ? '핵심' : topic===c.watch ? '주목' : '참고'
      f.data.topic_analysis[topic].evidence_refs = topic===c.best || topic===c.watch ? [`W:${c.date}:${topic}`] : []
    }
    f.calculation.western.daily_scores=[{date:c.date,evidence:[
      {source_topics:[c.best],transit:c.lead.transit,target:c.lead.target,aspect:'trine',contribution:4,polarity:c.lead.polarity,motion:c.lead.motion,text:'fixture'},
      {source_topics:[c.watch],transit:'Mars',target:'Saturn',aspect:'square',contribution:2,polarity:-.6,motion:'Applying',text:'fixture'},
    ]}]
    const summary=buildFortuneUserSummary(f.data,{period:'today',calculation:f.calculation,topicEntries:Object.entries(f.data.topic_analysis)})
    headlines.push(summary.headline)
    console.log(`DAILY ${c.date} | ${summary.headline}`)
  }
  assert.equal(new Set(headlines).size,headlines.length,'daily headlines must all differ across the seven synthetic days')
  assert.ok(headlines.every(x=>!x.includes('에 힘을 쓰기 괜찮지만')),'old generic favorable/caution sentence must not return')

  const hierarchy={
    version:'fixture-v2.13',as_of_date:'2026-09-21',score_meaning:'활성도는 실제 연락·재회 확률이 아니라 각 단계에서 계산 근거가 얼마나 겹치는지 보여주는 보조지표야.',
    validation:{status:'PASS',checks:[]},
    stages:{
      emotional_reactivation:{label:'감정 재활성',activation:76,candidate_count:3},
      contact_recontact:{label:'연락·재접촉',activation:60,candidate_count:2},
      in_person_meeting:{label:'실제 만남',activation:42,candidate_count:1},
      relationship_rebuilding:{label:'관계 재구축',activation:34,candidate_count:1},
    },
    nearest_window:{start:'2026-09-22',end:'2026-09-24',date:'2026-09-22',stage:'contact_recontact',label:'연락·재접촉',final:60,components:{long_term:51,mid_term:36,event_trigger:18,cross_system:8,final:60}},
    top_periods:[
      {start:'2026-09-22',end:'2026-09-24',date:'2026-09-22',stage:'contact_recontact',label:'연락·재접촉',final:60,components:{long_term:51,mid_term:36,event_trigger:18,cross_system:8,final:60}},
      {start:'2026-11-01',end:'2026-11-04',date:'2026-11-02',stage:'emotional_reactivation',label:'감정 재활성',final:76,components:{long_term:58,mid_term:45,event_trigger:19,cross_system:7,final:76}},
      {start:'2026-11-27',end:'2026-11-30',date:'2026-11-28',stage:'emotional_reactivation',label:'감정 재활성',final:68,components:{long_term:54,mid_term:39,event_trigger:17,cross_system:6,final:68}},
    ],
    past_windows:[{start:'2026-08-20',end:'2026-08-23',date:'2026-08-21',stage:'contact_recontact',label:'연락·재접촉',final:57,components:{long_term:48,mid_term:34,event_trigger:16,cross_system:5,final:57}}],
    limitations:['출생시간이 추정값이면 하우스와 각은 입력 생시 기준으로 읽되 시간 민감도를 함께 봐.'],
    stability_structure:{support:[1,2],obstacles:[1,2,3],policy:'fixture'}
  }
  const ai={ok:true,model:'fixture-no-provider',interpreter_version:'relationship-v12.3-rich-human-narrative',data:{
    headline:'다시 신경 쓰이는 흐름은 살아 있지만, 실제 재회는 연락 이후의 행동이 더 중요해',
    overview:'fixture',chemistry:'fixture',communication:'fixture',timing:'fixture',reunion_context:'fixture',top_aspects:[],limits:'fixture',
    reunion_synthesis_v2:{
      summary:'지금은 두 사람 사이의 감정 흔적이 다시 올라오는 것과 실제 행동이 시작되는 것이 완전히 같은 속도로 움직이지 않아. 관계를 다시 떠올리거나 상대 반응을 의식하는 힘은 비교적 살아 있지만, 이번 계산에서 더 중요한 변화는 연락·재접촉 단계가 미래 후보로 따로 잡혔다는 점이야. 즉 마음속에서 다시 생각나는 정도를 넘어서 실제 대화가 열릴 수 있는 문이 생기는 쪽으로 한 단계 이동해 있어. 다만 연락이 닿는 것 자체를 재회로 읽으면 안 돼. 실제 만남과 관계 재구축은 더 뒤의 조건으로 남아 있어서, 이번 흐름은 먼저 대화가 살아나는지 확인하는 구간으로 보는 게 가장 자연스러워.',
      why_reconnect:{conclusion:'다시 연결될 여지가 남아 있는 이유는 단순히 과거 감정이 세서가 아니라, 장기적인 관계 자극 위에 이번 기간의 대화·접촉 신호가 겹치기 때문이야. 그래서 아무 일 없이 마음만 남는 흐름과는 조금 달라.',interpretation:'현실에서는 갑자기 깊은 관계 이야기를 꺼내는 장면보다 안부, 짧은 질문, 우연한 반응, 미뤄둔 대화를 다시 이어가는 식으로 먼저 나타날 수 있어. 상대가 다시 생각난다는 감정과 실제 답장이 오는지는 따로 봐야 하지만, 이번 후보에서는 적어도 대화를 열 수 있는 단계의 근거가 같이 들어와 있어. 반대로 바로 관계를 정의하려 하거나 과거 문제를 한꺼번에 정리하려 들면 지금 열리는 단계보다 너무 앞서갈 수 있어. 처음 반응이 생겼다면 내용이 구체적인지, 다음 대화로 자연스럽게 이어지는지, 실제 약속을 잡으려는 태도가 붙는지를 차례로 보는 게 중요해.',evidence_refs:[]},
      initiative:{conclusion:'누가 먼저 연락할지는 현재 계산만으로 확정하지 않아.',interpretation:'상대측 활성과 내측 활성은 각 차트가 자극되는 정도이지 실제 선연락 행동의 방향을 뜻하지 않아.',evidence_refs:[]},
      timing:{conclusion:'가장 가까운 미래 창은 연락·재접촉 단계고, 그 뒤에는 감정 재활성이 다시 크게 올라오는 후보들이 이어져. 가까운 창에서 실제 대화가 생기는지 여부가 뒤 시기의 의미를 바꿀 수 있어. 연락이 전혀 없었다면 11월의 강한 감정 창은 다시 생각나거나 서로를 의식하는 쪽으로 체감될 수 있고, 이미 대화가 시작됐다면 같은 창이 관계를 더 깊게 확인하는 계기가 될 수 있어.',windows:[],evidence_refs:[]},
      rebuild:{conclusion:'연락이 다시 닿아도 재회까지 가려면 이전과 다른 행동이 실제로 보여야 해. 특히 감정이 올라오는 속도보다 현실적인 합의가 늦게 따라오는 구조라면, 다시 만나는 순간보다 그 다음 며칠과 몇 주의 태도가 훨씬 중요해.',conditions:['말로만 미안하다고 하는 것보다 이전 갈등을 실제로 어떻게 다르게 처리할지 합의가 생길 것','연락 빈도보다 실제 약속을 잡고 지키는 행동이 이어질 것','관계 이름을 먼저 정하기보다 예전 문제를 다시 반복하지 않을 생활 규칙이 생길 것'],evidence_refs:[]},
      repeat_risks:{conclusion:'가까워질수록 예전의 힘겨루기나 감정 과열이 다시 살아나는 게 가장 큰 반복 위험이야. 특히 처음 분위기가 좋아졌다는 이유로 관계가 이미 회복됐다고 생각하면 속도 차이가 다시 갈등으로 바뀔 수 있어.',patterns:['상대 반응을 확인하기 전에 의미를 크게 붙여 관계 결론을 서두르는 패턴','불편한 문제를 미뤄두다가 감정이 쌓인 뒤 한 번에 터뜨리는 패턴'],evidence_refs:[]},
      convergence:[{theme:'대화 재개가 먼저',period:'2026-09-22 전후',meaning:'여러 층의 근거가 재결합 자체보다 실제 대화와 재접촉이 먼저 열리는 순서를 가리켜.',evidence_refs:[]},{theme:'감정은 뒤에서 다시 커질 수 있음',period:'2026-11 초',meaning:'가까운 연락 창 뒤에도 감정 자극이 다시 강해지는 후보가 남아 있어서, 앞선 접촉의 실제 결과에 따라 같은 시기의 체감이 달라질 수 있어.',evidence_refs:[]}],
      precision_note:'입력한 추정 생시 기준으로 하우스와 각까지 읽었어. 주변 시간에서도 유지되는 관계축 자극은 비교적 안정적으로 보고, 정확한 각도나 하우스 경계에 걸리는 부분은 실제 출생시각이 달라지면 강도나 표현이 바뀔 수 있다고 함께 표시해.'
    }
  }}
  const html=renderToStaticMarkup(createElement(Relationship,{aspects,partnerExact:false,angleTimeAvailable:true,analysisMode:'reunion',timing,ai,aiLoading:false,aiError:'',onAi:noAction,timeSensitivePoints:new Set(['Moon','ASC']),formatAspect:a=>`${a.a} ${a.aspect} ${a.b}`,hierarchy}))
  const narrative=html.split('<div class="reunion-stage-status">')[0].split('<section class="reunion-human-narrative reunion-ai-block">')[1] ?? ''
  const text=narrative.replace(/<[^>]*>/g,' ').replace(/&middot;/g,'·').replace(/&#x27;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim()
  console.log(`REUNION_NARRATIVE_CHARS ${text.length}`)
  console.log(`REUNION_NARRATIVE | ${text}`)
  for (const title of ['지금 두 사람 사이에서 살아 있는 흐름','왜 다시 신경 쓰이거나 연결될 수 있나','지금 어디까지 와 있나','연락이 닿은 뒤, 재회까지는 뭐가 남나','다시 멀어질 수 있는 지점','여러 근거가 같이 가리키는 부분']) assert.ok(text.includes(title),`missing ${title}`)
  assert.ok(text.length >= 1200,`reunion human narrative still too short: ${text.length}`)
  assert.doesNotMatch(text,/\borb\b|오브\s*\d|conjunction|opposition|square|trine/i)
  console.log('NO_API_COPY_QA PASS')
} finally {
  await server.close()
}
