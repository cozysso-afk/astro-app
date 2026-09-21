from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if new in text:
        return
    if old not in text:
        raise SystemExit(f"missing guarded source in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))


replace_once(
    "web/src/PeriodAiInterpretationPanel.tsx",
    """  const verifiedHero = verifiedNarrative && !field && !westernOnly\n  const heroHeadline = verifiedHero ? visibleAiText(data.headline) || userSummary.headline : userSummary.headline\n  const heroSummary = verifiedHero\n    ? visibleAiText(data.overall.summary) || userSummary.summary\n    : field?.id!=='love'&&!westernOnly&&systemSummary ? systemSummary : userSummary.summary\n""",
    """  const verifiedHero = verifiedNarrative && !field && !westernOnly\n  // Today/week hero copy is owned by the semantic view model so saved legacy AI prose cannot overwrite the current scene/arc.\n  const semanticHero = !westernOnly && (period === 'today' || period === 'week')\n  const heroHeadline = semanticHero\n    ? userSummary.headline\n    : verifiedHero ? visibleAiText(data.headline) || userSummary.headline : userSummary.headline\n  const heroSummary = semanticHero\n    ? userSummary.summary\n    : verifiedHero\n      ? visibleAiText(data.overall.summary) || userSummary.summary\n      : field?.id!=='love'&&!westernOnly&&systemSummary ? systemSummary : userSummary.summary\n""",
)

replace_once(
    "web/src/lib/fortuneUserSummary.ts",
    """    favorableCards: bestCandidates.map(row => ({ topic: row.topic, score: row.score!, band: topicStat(context, row.topic)?.band ?? '보통', meaning: row.topic === '연락' ? '받는 연락과 먼저 보내는 연락을 구분해' : row.topic === '재회' ? consistency.reconnectionMeaning : FLOW_COPY[row.topic]?.[0] ?? '흐름에 맞춰 계획을 진행해' })),\n    cautionCards: cautionCandidates.map(row => ({ topic: row.topic, score: row.score!, band: row.topic === '투자주의' ? '주의' : topicStat(context, row.topic)?.band ?? '약함', meaning: row.topic === '재회' ? consistency.reconnectionMeaning : FLOW_COPY[row.topic]?.[1] ?? '속도를 낮추는 편이 좋아' })),\n""",
    """    favorableCards: bestCandidates.map(row => ({ topic: row.topic, score: row.score!, band: topicStat(context, row.topic)?.band ?? '보통', meaning: row.topic === '연락' ? '받는 연락과 먼저 보내는 연락을 구분해' : row.topic === '재회' ? consistency.reconnectionMeaning : frame.kind === 'day' && DAILY_HEADLINE_SCENE[row.topic] ? DAILY_HEADLINE_SCENE[row.topic].use : frame.kind === 'week' && WEEKLY_HEADLINE_SCENE[row.topic] ? WEEKLY_HEADLINE_SCENE[row.topic].use : FLOW_COPY[row.topic]?.[0] ?? '흐름에 맞춰 계획을 진행해' })),\n    cautionCards: cautionCandidates.map(row => ({ topic: row.topic, score: row.score!, band: row.topic === '투자주의' ? '주의' : topicStat(context, row.topic)?.band ?? '약함', meaning: row.topic === '재회' ? consistency.reconnectionMeaning : frame.kind === 'day' && DAILY_HEADLINE_SCENE[row.topic] ? DAILY_HEADLINE_SCENE[row.topic].caution : frame.kind === 'week' && WEEKLY_HEADLINE_SCENE[row.topic] ? WEEKLY_HEADLINE_SCENE[row.topic].caution : FLOW_COPY[row.topic]?.[1] ?? '속도를 낮추는 편이 좋아' })),\n""",
)

replace_once(
    "web/src/lib/interpretationUiContract.test.mjs",
    """  assert.match(period.slice(0, renderStart), /verifiedHero \\? visibleAiText\\(data\\.headline\\) \\|\\| userSummary\\.headline : userSummary\\.headline/)\n  assert.match(period.slice(0, renderStart), /verifiedHero[\\s\\S]*visibleAiText\\(data\\.overall\\.summary\\) \\|\\| userSummary\\.summary/)\n""",
    """  assert.match(period.slice(0, renderStart), /const semanticHero = !westernOnly && \\(period === 'today' \\|\\| period === 'week'\\)/)\n  assert.match(period.slice(0, renderStart), /const heroHeadline = semanticHero[\\s\\S]*userSummary\\.headline[\\s\\S]*verifiedHero/)\n  assert.match(period.slice(0, renderStart), /const heroSummary = semanticHero[\\s\\S]*userSummary\\.summary[\\s\\S]*verifiedHero/)\n""",
)

replace_once(
    "web/src/lib/interpretationUiContract.test.mjs",
    """  assert.match(summary.focusTopics.find((item)=>item.topic === '컨디션').conclusion, /쉽게 지칠 수 있으니 일정을 너무 빡빡하게 잡지 않는 게 좋아/)\n""",
    """  assert.match(summary.focusTopics.find((item)=>item.topic === '컨디션').conclusion, /쉽게 지칠 수 있으니 일정을 너무 빡빡하게 잡지 않는 게 좋아/)\n  assert.match(summary.cautionCards.find((item)=>item.topic === '연애').meaning, /호감 표현 하나/)\n  assert.doesNotMatch(summary.cautionCards.map((item)=>item.meaning).join('\\n'), /새 진도보다 복습부터|관계 진전을 서두르지 말 것/)\n""",
)

replace_once(
    "web/src/lib/interpretationUiContract.test.mjs",
    """  assert.equal(summary.importantWindows[0].guidance,'공부에 힘을 써보기 좋아.')\n""",
    """  assert.equal(summary.importantWindows[0].guidance,'공부에 힘을 써보기 좋아.')\n  assert.match(summary.favorableCards.find((item)=>item.topic === '학업').meaning, /끝낼 공부 분량/)\n  assert.match(summary.cautionCards.find((item)=>item.topic === '연애').meaning, /호감 표현/)\n""",
)

print('guarded period hero/card copy patch applied')
