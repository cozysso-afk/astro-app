from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
summary_path = ROOT / 'web/src/lib/fortuneUserSummary.ts'
test_path = ROOT / 'web/src/lib/readingExperience.test.mjs'

source = summary_path.read_text()
if 'DAILY_HEADLINE_SCENE_V24' not in source:
    replacement = r'''// DAILY_HEADLINE_SCENE_V24: deterministic fallback should still describe today's concrete evidence.
const DAILY_HEADLINE_SCENE: Record<string, { use: string; caution: string }> = {
  금전: { use:'결제·정산·예산처럼 실제 돈의 순서를 정리하기 좋은 날이야.', caution:'예상 밖 지출이나 충동 결제는 금액과 필요성을 한 번 더 확인하는 편이 좋아.' },
  학업: { use:'계획을 늘리기보다 실제로 끝낸 분량을 만들기 좋은 날이야.', caution:'집중이 흩어지면 여러 과제를 벌이기보다 하나를 끝내는 쪽이 나아.' },
  시험: { use:'새 범위를 넓히기보다 문제를 풀며 실수 지점을 잡기 좋은 날이야.', caution:'불안해서 범위를 넓히기보다 틀린 문제와 시간 배분부터 확인하는 편이 좋아.' },
  직장: { use:'말로만 오가던 요청을 담당자·마감·완료 기준까지 구체화하기 좋은 날이야.', caution:'책임 범위가 애매한 부탁은 바로 떠안기보다 조건부터 확인하는 편이 좋아.' },
  이직: { use:'막연한 이동 욕구보다 직무·보상·일정 같은 실제 조건을 비교하기 좋은 날이야.', caution:'답답한 기분만으로 결론 내리기보다 제안의 구체적인 조건이 있는지부터 보는 편이 좋아.' },
  대인관계: { use:'필요한 말이 실제 약속이나 일정으로 이어지는지 확인해 보기 좋은 날이야.', caution:'한 번의 말투나 답장만으로 관계 전체를 결론 내리지 않는 편이 좋아.' },
  연애: { use:'호감 표현 자체보다 약속을 잡고 실제로 만남을 이어가는 반응을 보기 좋은 날이야.', caution:'호감 표현 하나에 관계의 의미를 너무 빨리 붙이지 않는 편이 좋아.' },
  연락: { use:'안부·질문·일정처럼 답하기 쉬운 내용으로 대화를 구체화하기 좋은 날이야.', caution:'답장 속도 하나를 마음의 결론처럼 확대해석하지 않는 편이 좋아.' },
  재회: { use:'추억보다 실제 대화가 다시 시작되고 태도가 이어지는지를 확인해 볼 날이야.', caution:'과거가 떠오르는 것과 관계가 다시 시작되는 것은 구분해서 보는 편이 좋아.' },
  소식: { use:'전해 들은 말보다 원문·답변·공식 안내를 직접 확인하기 좋은 날이야.', caution:'중간 정보만 듣고 결과를 미리 확정하지 않는 편이 좋아.' },
  컨디션: { use:'무작정 버티기보다 집중할 일정과 쉴 시간을 나눠 쓰기 좋은 날이야.', caution:'피곤한데도 하루 전체를 같은 강도로 밀어붙이지 않는 편이 좋아.' },
  투자심리: { use:'사고 싶은 마음과 실제 매수 근거를 따로 적어 보기 좋은 날이야.', caution:'조급함이나 놓칠 것 같은 기분 때문에 원래 기준을 바꾸지 않는 편이 좋아.' },
  수익실현: { use:'목표가·손실 한도·보유 이유를 실제 시장 데이터와 다시 맞춰 보기 좋은 날이야.', caution:'정리하고 싶은 기분만으로 매도 시점을 결정하지 않는 편이 좋아.' },
  신규진입: { use:'가격 조건·손실 한도·진입 이유가 모두 맞는지 확인하기 좋은 날이야.', caution:'기회를 놓칠 것 같은 마음 때문에 위험 한도를 넓히지 않는 편이 좋아.' },
  투자주의: { use:'포지션 크기와 감당 가능한 손실 범위를 먼저 점검하기 좋은 날이야.', caution:'주의 신호가 약해 보여도 안전하다고 가정하지 않는 편이 좋아.' },
}

function dayEvidenceHeadline(context: FortuneUserSummaryContext, bestFlow: string[], cautionFlow: string[]): string {
  const day = (context.calculation.western.daily_scores ?? []).find(row => row.date === context.calculation.period.start)
  const evidence = day?.evidence ?? []
  const wanted = new Set([...bestFlow, ...cautionFlow])
  const candidates = evidence.flatMap(item => {
    const topics = Array.isArray(item.source_topics) ? item.source_topics.filter(topic => wanted.has(topic)) : []
    return topics.map(topic => ({ item, topic }))
  }).sort((a,b)=>Math.abs(Number(b.item.contribution ?? 0))-Math.abs(Number(a.item.contribution ?? 0)))
  const lead = candidates[0]
  if (!lead) return ''
  const key = lead.item.transit && SYMBOLS[lead.item.transit]
    ? lead.item.transit
    : lead.item.target && SYMBOLS[lead.item.target]
      ? lead.item.target
      : ''
  const meaning = key ? SYMBOLS[key]?.[1] : ''
  const scene = DAILY_HEADLINE_SCENE[lead.topic]
  if (!meaning || !scene) return ''
  const polarity = Number(lead.item.polarity ?? lead.item.contribution ?? 0)
  const caution = cautionFlow.includes(lead.topic) || polarity < 0
  return `오늘 ${lead.topic}에서는 ${meaning}이 특히 두드러져 ${caution ? scene.caution : scene.use}`
}

function buildHeadline(when: string, bestFlow: string[], cautionFlow: string[], consistency: RelationshipConsistency, context: FortuneUserSummaryContext) {
  if (bestFlow.includes('재회')) {
    const otherBest = bestFlow.filter(topic => topic !== '재회')
    const otherFocus = joinTopics(otherBest)
    const caution = joinTopics(cautionFlow)
    const reconnectionClause = consistency.blockReconnectionAction
      ? '재회는 실제 연락 흐름이 약해 의미를 크게 두지 않는 편이 좋아.'
      : '재회는 실제 연락과 태도가 이어지는지 확인해볼 만해.'
    const lead = otherFocus
      ? `${when}${particle(when, '은', '는')} ${otherFocus}${particle(otherFocus, '을', '를')} 먼저 살펴보고, ${reconnectionClause}`
      : `${when} ${reconnectionClause}`
    return caution ? `${lead} ${caution} 쪽은 속도를 낮추는 편이 좋아.` : lead
  }
  if (when === '오늘') {
    const scene = dayEvidenceHeadline(context, bestFlow, cautionFlow)
    if (scene) return scene
  }
  return bestFlow.length && cautionFlow.length
    ? `${when}${particle(when, '은', '는')} ${joinTopics(bestFlow)}에 힘을 쓰기 괜찮지만, ${joinTopics(cautionFlow)} 쪽은 속도를 낮추는 편이 좋아.`
    : bestFlow.length ? `${when}${particle(when, '은', '는')} ${joinTopics(bestFlow)}에 힘을 쓰기 좋은 편이야. 이쪽부터 계획을 잡아봐.`
    : cautionFlow.length ? `${when}${particle(when, '은', '는')} ${joinTopics(cautionFlow)} 쪽의 기대를 낮추는 편이 좋아. 그 밖에 크게 밀어줄 분야는 뚜렷하지 않아.`
    : `${when}${particle(when, '은', '는')} 좋거나 조심할 분야가 뚜렷하게 갈리지 않아. 평소 계획을 유지하면서 변화를 지켜봐.`
}

export function buildFortuneUserSummary'''
    pattern = r"function buildHeadline\(when: string, bestFlow: string\[], cautionFlow: string\[], consistency: RelationshipConsistency\) \{.*?\n\}\n\nexport function buildFortuneUserSummary"
    source, count = re.subn(pattern, replacement, source, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'expected one buildHeadline block, got {count}')
    old_call = 'const headline = buildHeadline(when, bestFlow, cautionFlow, consistency)'
    new_call = 'const headline = buildHeadline(when, bestFlow, cautionFlow, consistency, context)'
    if old_call not in source:
        raise SystemExit('headline call site not found')
    source = source.replace(old_call, new_call, 1)
    summary_path.write_text(source)


test_source = test_path.read_text()
old_expectation = "assert.match(view.headline,/사람 관계와 이직 조건/)"
if old_expectation in test_source:
    test_source = test_source.replace(
        old_expectation,
        "assert.match(view.headline,/대인관계/)\n  assert.match(view.headline,/실제 약속이나 일정/)",
        1,
    )

marker = "daily fallback headline uses the strongest linked evidence as a concrete scene"
if marker not in test_source:
    test_source += r'''

test('daily fallback headline uses the strongest linked evidence as a concrete scene',()=>{
  const f=fortuneFixture('today')
  const view=buildFortuneUserSummary(f.data,f.context)
  assert.match(view.headline,/생각을 정리하고 말을 주고받는 방식/)
  assert.match(view.headline,/실제 약속이나 일정/)
  assert.doesNotMatch(view.headline,/힘을 쓰기 괜찮지만|평소 계획을 유지하면서/)
})
'''
test_path.write_text(test_source)

print('interpretation v24 human-language patch applied')
