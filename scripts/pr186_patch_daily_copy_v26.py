from pathlib import Path

source = Path('web/src/lib/fortuneUserSummary.ts')
s = source.read_text()
start = s.index('function dayEvidenceHeadline(')
end = s.index('\nfunction daySummary(', start)
new_block = r'''const DAILY_EVIDENCE_FOCUS: Record<string,string> = {
  금전:'돈의 순서와 책임을 정리하는 쪽',
  학업:'읽고 정리한 내용을 실제 진도로 옮기는 쪽',
  시험:'아는 내용을 시간 안에 정확히 꺼내 쓰는 쪽',
  직장:'요청을 담당자·마감·책임으로 구체화하는 쪽',
  이직:'변화 욕구를 직무·보상·일정 비교로 바꾸는 쪽',
  대인관계:'대화의 요점과 실제 합의를 맞추는 쪽',
  연애:'호감 표현을 약속과 실제 만남으로 연결하는 쪽',
  연락:'말을 꺼내고 질문·답장을 이어가는 쪽',
  재회:'과거 감정보다 실제 재접촉과 태도를 확인하는 쪽',
  소식:'전해 들은 말보다 확정된 답과 다음 절차를 확인하는 쪽',
  컨디션:'집중할 일정과 회복할 시간을 나눠 쓰는 쪽',
  투자심리:'사고 싶은 마음과 실제 매매 근거를 분리하는 쪽',
  수익실현:'목표와 보유 이유를 실제 조건에 다시 맞추는 쪽',
  신규진입:'가격·손실 한도·진입 이유를 함께 확인하는 쪽',
  투자주의:'수익 기대보다 감당할 손실 범위를 먼저 보는 쪽',
}
const DAILY_SYMBOL_FOCUS: Record<string,string> = {
  Sun:'목표·주도권', Moon:'감정·편안함', Mercury:'말·정리', Venus:'호감·조화', Mars:'행동·마찰',
  Jupiter:'확장·선택', Saturn:'책임·제약', Uranus:'변화·변수', Neptune:'기대·상상', Pluto:'몰입·주도권',
  'True Node':'관계·선택', 'North Node':'관계·선택',
}

function dayEvidenceHeadline(context: FortuneUserSummaryContext, bestFlow: string[], cautionFlow: string[]): string {
  const day = (context.calculation.western.daily_scores ?? []).find(row => row.date === context.calculation.period.start)
  const evidence = day?.evidence ?? []
  const wanted = new Set([...bestFlow, ...cautionFlow])
  const ranked = evidence.flatMap(item => {
    const topics = Array.isArray(item.source_topics) ? item.source_topics.filter(topic => DAILY_HEADLINE_SCENE[topic]) : []
    return topics.map(topic => ({ item, topic }))
  }).sort((a,b)=>Math.abs(Number(b.item.contribution ?? 0))-Math.abs(Number(a.item.contribution ?? 0)))
  const preferred = ranked.filter(row => wanted.has(row.topic))
  const lead = (preferred.length ? preferred : ranked)[0]
  if (!lead) return fallbackDayHeadline(context, bestFlow, cautionFlow)
  const key = lead.item.transit && SYMBOLS[lead.item.transit]
    ? lead.item.transit
    : lead.item.target && SYMBOLS[lead.item.target]
      ? lead.item.target
      : ''
  const scene = DAILY_HEADLINE_SCENE[lead.topic]
  const focus = DAILY_EVIDENCE_FOCUS[lead.topic]
  if (!scene || !focus) return fallbackDayHeadline(context, bestFlow, cautionFlow)
  const polarity = typeof lead.item.polarity === 'number' && Number.isFinite(lead.item.polarity) ? Math.sign(lead.item.polarity) : 0
  const caution = cautionFlow.includes(lead.topic) || polarity < 0
  const sceneText = caution ? scene.caution : scene.use
  const trigger = (key && DAILY_SYMBOL_FOCUS[key]) || '당일'
  const motion = String(lead.item.motion ?? '')
  const phase = /Applying|적용/i.test(motion)
    ? `${trigger} 자극도 아직 커지는 중이야.`
    : /Exact|정확/i.test(motion)
      ? `${trigger} 자극이 오늘 특히 또렷해.`
      : /Separating|분리/i.test(motion)
        ? `${trigger} 자극의 정점은 지났지만 여운이 남아 있어.`
        : `${trigger} 자극이 오늘 체감에 남아 있어.`
  const variant = [...context.calculation.period.start].reduce((sum,ch)=>sum+ch.charCodeAt(0),0) % 3
  if (variant === 0) return `${sceneText} 오늘 ${lead.topic}에서는 ${focus}이 핵심이야. ${phase}`
  if (variant === 1) return `${lead.topic}에서 오늘 가장 눈에 띄는 건 ${focus}이야. ${sceneText} ${phase}`
  return `오늘은 ${sceneText} ${lead.topic}에서는 ${focus}이 먼저 보여. ${phase}`
}
'''
s = s[:start] + new_block + s[end:]
source.write_text(s)

test_file = Path('web/src/lib/interpretationUiContract.test.mjs')
t = test_file.read_text()
marker = "test('A/B: study leads favorable flow while relationship weakness stays in caution', () => {"
assert marker in t
regression = r'''test('daily scene headline changes its language by domain even when the same planet repeats', () => {
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
  assert.match(joined,/실제 진도로 옮기는 쪽/)
  assert.match(joined,/질문·답장을 이어가는 쪽/)
})

'''
if "daily scene headline changes its language by domain" not in t:
    t = t.replace(marker, regression + marker, 1)
test_file.write_text(t)
