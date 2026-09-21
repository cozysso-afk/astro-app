from pathlib import Path

p = Path('web/src/lib/fortuneUserSummary.ts')
s = p.read_text()
old = "  const preferred = ranked.filter(row => wanted.has(row.topic))\n  const lead = (preferred.length ? preferred : ranked)[0]\n  if (!lead) return focusedDayFallback(context, bestFlow, cautionFlow)\n"
new = """  const preferred = ranked.filter(row => wanted.has(row.topic))
  const overallPrimary = !scopedTopics.size ? bestFlow.find(topic => DAILY_HEADLINE_SCENE[topic]) : undefined
  const lead = overallPrimary
    ? ranked.find(row => row.topic === overallPrimary)
    : (preferred.length ? preferred : ranked)[0]
  if (!lead) {
    if (overallPrimary) {
      const primaryScene = DAILY_HEADLINE_SCENE[overallPrimary]
      const primaryLevel = flowLevel(topicStat(context, overallPrimary))
      const primaryText = primaryLevel === 'low' ? primaryScene.caution : primaryScene.use
      const secondary = [...bestFlow, ...cautionFlow].find(topic => topic !== overallPrimary && DAILY_HEADLINE_SCENE[topic])
      const secondaryText = secondary ? ` ${secondary} 쪽은 ${cautionFlow.includes(secondary) ? DAILY_HEADLINE_SCENE[secondary].caution : DAILY_HEADLINE_SCENE[secondary].use}` : ''
      return `오늘 전체 흐름에서 가장 먼저 볼 건 ${overallPrimary}이야. ${primaryText}${secondaryText}`
    }
    return focusedDayFallback(context, bestFlow, cautionFlow)
  }
"""
if old not in s:
    raise SystemExit('missing lead selection anchor')
s = s.replace(old, new, 1)
old = "  const caution = cautionFlow.includes(lead.topic) || polarity < 0\n"
new = "  const caution = scopedTopics.size\n    ? cautionFlow.includes(lead.topic) || polarity < 0\n    : cautionFlow.includes(lead.topic)\n"
if old not in s:
    raise SystemExit('missing caution anchor')
p.write_text(s.replace(old, new, 1))

t = Path('web/src/lib/systemReading.test.mjs')
s = t.read_text()
old = " assert.notEqual(overall.headline,love.headline)\n assert.match(overall.headline,/전체 흐름/)\n assert.match(condition.headline,/컨디션/)\n"
new = " assert.notEqual(overall.headline,love.headline)\n assert.equal(overall.bestFlow[0],'대인관계')\n assert.match(overall.headline,/전체 흐름에서 가장 먼저 볼 건 대인관계/)\n assert.doesNotMatch(overall.headline,/전체 흐름에서 가장 먼저 볼 건 연락/)\n assert.match(condition.headline,/컨디션/)\n"
if old not in s:
    raise SystemExit('missing scoped regression anchor')
t.write_text(s.replace(old, new, 1))
