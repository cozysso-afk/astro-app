from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, text: str) -> None:
    Path(path).write_text(text)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing patch anchor: {label}")
    return text.replace(old, new, 1)


# 1) Daily headline: never fall back to the generic best-topic/caution-topic sentence.
path = "web/src/lib/fortuneUserSummary.ts"
text = read(path)
start = text.index("// DAILY_HEADLINE_SCENE_V24:")
end = text.index("// WEEKLY_HEADLINE_ARC_V24:", start)
daily = r'''// DAILY_HEADLINE_SCENE_V25: the home-card headline must describe a concrete scene even when detailed evidence is sparse.
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

function fallbackDayHeadline(context: FortuneUserSummaryContext, bestFlow: string[], cautionFlow: string[]): string {
  const best = bestFlow.find(topic => DAILY_HEADLINE_SCENE[topic])
  const watch = cautionFlow.find(topic => DAILY_HEADLINE_SCENE[topic])
  const variant = [...context.calculation.period.start].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 3
  if (best && watch) {
    const use = DAILY_HEADLINE_SCENE[best].use
    const caution = DAILY_HEADLINE_SCENE[watch].caution
    if (variant === 0) return `오늘은 ${best}부터 보면, ${use} ${watch}에서는 ${caution}`
    if (variant === 1) return `오늘의 중심은 ${best} 쪽이야. ${use} 다만 ${watch}에서는 ${caution}`
    return `${use} 반면 ${watch}에서는 ${caution}`
  }
  if (best) return `오늘은 ${best} 쪽 장면이 가장 또렷해. ${DAILY_HEADLINE_SCENE[best].use}`
  if (watch) return `오늘은 ${watch} 쪽에서 한 번 더 확인할 게 있어. ${DAILY_HEADLINE_SCENE[watch].caution}`
  return '오늘은 특정 분야를 억지로 밀기보다, 실제로 들어오는 요청·답변·일정 변화를 확인하면서 움직이는 날이야.'
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
  const meaning = key ? SYMBOLS[key]?.[1] : ''
  const scene = DAILY_HEADLINE_SCENE[lead.topic]
  if (!meaning || !scene) return fallbackDayHeadline(context, bestFlow, cautionFlow)
  const polarity = typeof lead.item.polarity === 'number' && Number.isFinite(lead.item.polarity) ? Math.sign(lead.item.polarity) : 0
  const caution = cautionFlow.includes(lead.topic) || polarity < 0
  const motion = String(lead.item.motion ?? '')
  const phase = /Applying|적용/i.test(motion)
    ? '이 자극이 아직 가까워지는 중이라'
    : /Exact|정확/i.test(motion)
      ? '오늘 특히 선명하게 걸리는 편이라'
      : /Separating|분리/i.test(motion)
        ? '정점은 지나도 여운이 남아'
        : '오늘 체감이 도드라져'
  return `오늘 ${lead.topic}에서는 ${meaning}이 특히 두드러지고, ${phase} ${caution ? scene.caution : scene.use}`
}

function daySummary(bestFlow: string[], cautionFlow: string[]) {
  const best = bestFlow[0]
  const watch = cautionFlow[0]
  if (best && watch) return `오늘은 ${best}에서 움직일 장면과 ${watch}에서 한 번 더 확인할 장면이 갈려. 점수 순위보다 위 한줄과 아래 실제 상황 설명을 먼저 봐.`
  if (best) return `오늘은 ${best} 쪽 장면이 가장 또렷해. 아래에서 왜 그런지와 현실에서 뭘 확인할지 이어서 봐.`
  if (watch) return `오늘은 ${watch} 쪽에서 무리하지 않는 게 핵심이야. 아래에서 어떤 장면을 특히 확인해야 하는지 이어서 봐.`
  return '오늘은 한 분야가 압도적으로 튀기보다 작은 반응 차이가 중요해. 아래 실제 장면을 기준으로 읽어봐.'
}

'''
text = text[:start] + daily + text[end:]
text = replace_once(
    text,
    "  if (when === '오늘') {\n    const scene = dayEvidenceHeadline(context, bestFlow, cautionFlow)\n    if (scene) return scene\n  }",
    "  if (when === '오늘') return dayEvidenceHeadline(context, bestFlow, cautionFlow)",
    "daily buildHeadline branch",
)
text = replace_once(
    text,
    "summary: (frame.kind === 'day' ? '하루 안의 선택에 초점을 맞춰 읽어봐. 다른 날까지 같은 흐름으로 이어진다고 보지는 않아.' : frame.kind === 'week' ?",
    "summary: (frame.kind === 'day' ? daySummary(bestFlow, cautionFlow) : frame.kind === 'week' ?",
    "daily dynamic summary",
)
write(path, text)


# 2) Deterministic fallback card also must not repeat the old score-list sentence.
path = "web/src/lib/basicFortuneReading.ts"
text = read(path)
text = replace_once(
    text,
    "  if (best && watch) headline = `${when}은 ${best.topic} 쪽은 활용할 만하고, ${watch.topic} 쪽은 속도를 낮추는 편이 좋아.`\n  else if (best) headline = `${when}은 ${scope}${best.topic} 쪽 흐름이 상대적으로 좋아. 계획한 일을 구체적으로 진행해봐.`\n  else if (watch) headline = `${when}은 ${scope}${watch.topic} 쪽을 무리하지 않는 게 좋아. 확인과 점검을 먼저 해.`",
    "  if (best && watch) headline = `${when}: ${best.meaning} ${watch.topic}은 ${watch.meaning}`\n  else if (best) headline = `${when}: ${best.meaning}`\n  else if (watch) headline = `${when}: ${watch.topic}은 ${watch.meaning}`",
    "basic fortune generic headline",
)
write(path, text)


# 3) Reunion hierarchy: put the human story before the score cards and expose useful AI fields.
path = "web/src/RelationshipInterpretationPanel.tsx"
text = read(path)
start_marker = '    {reunion && hierarchyData && <section className="reading-section reunion-hierarchy reunion-v211">'
end_marker = '\n\n    {ai?.ok && ai.data && (!reunion || !hierarchyData) ?'
start = text.index(start_marker)
end = text.index(end_marker, start)
block = r'''    {reunion && hierarchyData && <section className="reading-section reunion-hierarchy reunion-v211">
      <h3>지금부터의 재회 흐름</h3>
      {hierarchyData.validation?.status !== 'PASS' ? <p role="alert">계산 검증에 실패해 미래 후보와 해설을 보류했어.</p> : <>
        {hierarchyData.nearest_window ? <article className="relationship-pattern reunion-nearest-window">
          <h4>가장 가까운 활성창</h4>
          <b>{hierarchyData.nearest_window.start} ~ {hierarchyData.nearest_window.end} · {hierarchyData.nearest_window.label}</b>
          <p>{reunionStageHuman(hierarchyData.nearest_window.stage, hierarchyData.nearest_window.label)}</p>
          <small>핵심 날짜 {hierarchyData.nearest_window.date} · 보조지표 활성도 {hierarchyData.nearest_window.final}</small>
        </article> : <p>오늘 이후 조회 기간에는 장기·중기·단기 조건을 모두 통과한 활성창이 없어.</p>}

        {ai?.ok && ai.data && reunionV2 && <section className="reunion-human-narrative reunion-ai-block">
          <h4>지금 두 사람 사이에서 살아 있는 흐름</h4>
          <ReadableCopy className="reading-conclusion" text={reunionV2.summary}/>

          <h4>왜 다시 신경 쓰이거나 연결될 수 있나</h4>
          <ReadableCopy text={reunionV2.why_reconnect.conclusion}/>
          <ReadableCopy text={reunionV2.why_reconnect.interpretation}/>

          {!!reunionV2.timing?.conclusion && <><h4>지금 어디까지 와 있나</h4><ReadableCopy text={reunionV2.timing.conclusion}/></>}

          <h4>연락이 닿은 뒤, 재회까지는 뭐가 남나</h4>
          <ReadableCopy text={reunionV2.rebuild.conclusion}/>
          {reunionV2.rebuild.conditions.length>0 && <ul>{reunionV2.rebuild.conditions.slice(0,3).map((x,i)=><li key={i}>{x}</li>)}</ul>}

          {(reunionV2.repeat_risks.conclusion || reunionV2.repeat_risks.patterns.length>0) && <><h4>다시 멀어질 수 있는 지점</h4><ReadableCopy text={reunionV2.repeat_risks.conclusion}/>{reunionV2.repeat_risks.patterns.length>0 && <ul>{reunionV2.repeat_risks.patterns.slice(0,2).map((x,i)=><li key={i}>{x}</li>)}</ul>}</>}

          {reunionV2.convergence.length>0 && <><h4>여러 근거가 같이 가리키는 부분</h4>{reunionV2.convergence.slice(0,3).map((x,i)=><article className="reunion-narrative-convergence" key={i}><b>{x.theme}</b><ReadableCopy text={x.meaning}/></article>)}</>}
          {!!reunionV2.precision_note && <details className="reunion-precision-note"><summary>생시·정밀도에 따라 달라질 수 있는 부분</summary><ReadableCopy text={reunionV2.precision_note}/></details>}
        </section>}

        <div className="reunion-stage-status">
          <h4>다시 움직인다면 어떤 순서인가</h4>
          {Object.entries(hierarchyData.stages).map(([stageKey,stage])=><p key={stage.label}><b>{stage.label}</b> · {reunionStageHuman(stageKey, stage.label)} <small>{stage.activation === null ? '현재 기간에 공개할 미래 후보 없음' : `보조지표 · 활성도 ${stage.activation}`}</small></p>)}
        </div>
        <p className="reunion-initiative-closed"><b>누가 먼저 연락?</b> 현재 계산으로는 판정 보류. 상대측/내측 활성도 비교값은 실제 행동 방향이 아니어서 선연락 근거로 쓰지 않아.</p>

        <h4>오늘 이후 핵심 시기</h4>
        {hierarchyData.top_periods.map((w)=><article className="relationship-pattern reunion-future-window" key={`${w.start}:${w.stage}`}>
          <b>{w.start} ~ {w.end} · {w.label}</b><p>{reunionStageHuman(w.stage, w.label)}</p><small>핵심 날짜 {w.date} · 보조지표 활성도 {w.final}</small>
          <details><summary>왜 후보가 됐는지</summary><p>장기 배경과 중기 흐름이 먼저 겹친 뒤, 이 단계에 맞는 사건 촉발 신호까지 함께 통과했어.</p><small>기술값 · 장기 {w.components.long_term} · 중기 {w.components.mid_term} · 사건 촉발 {w.components.event_trigger} · 체계 교차 {w.components.cross_system} · 최종 {w.components.final}</small></details>
        </article>)}
        {!hierarchyData.top_periods.length && <p>오늘 이후 공개할 핵심 후보가 없어.</p>}
      </>}
      <p className="reunion-score-meaning">{hierarchyData.score_meaning}</p>
      <details className="reading-more reunion-fixed-structure"><summary>고정 관계 구조 · 필요할 때만 보기</summary>
        <p>이 부분은 같은 두 사람이라면 매 계산에서 크게 달라지지 않는 출생차트·시너스트리 구조야. 새 시기 신호처럼 반복해서 강조하지 않아.</p>
        {reunionV2?.why_reconnect?.conclusion && <p>{firstSentences(reunionV2.why_reconnect.conclusion, 2)}</p>}
        {reunionV2?.rebuild?.conclusion && <p>{firstSentences(reunionV2.rebuild.conclusion, 2)}</p>}
        {reunionV2?.repeat_risks?.conclusion && <p>{firstSentences(reunionV2.repeat_risks.conclusion, 2)}</p>}
        {hierarchyData.stability_structure && <p>구조 근거: 지지 접촉 {hierarchyData.stability_structure.support.length}개 · 긴장 접촉 {hierarchyData.stability_structure.obstacles.length}개. 접촉 수 자체는 재결합 확률이 아니야.</p>}
      </details>
      <details className="reading-more reunion-past-audit"><summary>지난 활성기 · 사후검증용</summary>{hierarchyData.past_windows.length ? hierarchyData.past_windows.map((w)=><p key={`${w.start}:${w.stage}`}>{w.start} ~ {w.end} · {w.label} · {w.final}점</p>) : <p>분리해 표시할 지난 활성기가 없어.</p>}</details>
      <details className="reading-more"><summary>전문 근거·검증 범위</summary><p>Secondary Progression(세컨더리 프로그레션/2차 진행) · Solar Arc(솔라아크/태양호) · Transit(트랜짓·경과) · 다섯 행성 회귀 · 사주 절입</p><p>감정 활성 ≠ 연락 ≠ 만남 ≠ 재결합 ≠ 안정적 관계 유지</p>{hierarchyData.limitations.map(x=><p key={x}>{x}</p>)}{(hierarchyData.validation?.checks ?? []).filter((x)=>x.status!=='PASS').map((x)=><p key={x.name}>{x.name}: {x.status} — {x.detail}</p>)}</details>
    </section>}'''
text = text[:start] + block + text[end:]
write(path, text)


# 4) Ask Gemini for a full reading, not a few guarded sentences, and invalidate cached short reunion prose.
path = "supabase/functions/relationship-interpret-v9-preview/index.ts"
text = read(path)
text = replace_once(
    text,
    'const REUNION_VERSION="relationship-v12.2-human-narrative";',
    'const REUNION_VERSION="relationship-v12.3-rich-human-narrative";',
    "reunion interpreter version",
)
anchor = "why_reconnect는 고정 natal/시너스트리 구조를 장황하게 반복하지 말고 이번 흐름을 이해하는 데 필요한 만큼만 짧게 쓴다."
extra = anchor + " 단, '짧게'를 한두 문장으로 끝내라는 뜻으로 해석하지 마라. summary는 4~6문장으로 현재 상태의 이야기와 다음 단계의 간격을 충분히 풀고, why_reconnect는 conclusion+interpretation을 합쳐 5~8문장 정도로 왜 다시 신경 쓰이거나 접점이 열릴 수 있는지 현실 장면까지 번역한다. timing.conclusion은 3~5문장으로 현재 단계와 다음 단계 사이에 무엇이 더 필요한지 설명하고, rebuild.conclusion은 3~5문장으로 연락 이후 실제 관계를 다시 세우려면 무엇을 확인해야 하는지 말한다. repeat_risks는 2~4문장으로 현재 단계와 연결되는 반복 위험만 설명한다. 같은 뜻을 다른 말로 반복해 분량을 채우지 말고, 근거가 허용하는 범위에서 답장·대화 재개·약속 제안·실제 만남·관계 정의 같은 현실 장면을 조건형으로 넣어라. 사용자 본문은 '무슨 뜻인지 → 현실에서 어떻게 나타날 수 있는지 → 다음 단계와 무엇이 다른지' 순서로 쓰고, 오브와 전문용어 나열은 기술 근거로 밀어라."
text = replace_once(text, anchor, extra, "rich reunion narrative instruction")
write(path, text)

path = "web/src/lib/readingCache.ts"
text = read(path)
text = replace_once(
    text,
    "const RELATIONSHIP_REUNION_AI_CACHE_CONTRACT = 'relationship-v12.2-human-narrative-v1'",
    "const RELATIONSHIP_REUNION_AI_CACHE_CONTRACT = 'relationship-v12.3-rich-human-narrative-v1'",
    "reunion cache contract",
)
write(path, text)


# 5) Align contract assertions and add a focused regression test.
for path_obj in list(Path("web/src").rglob("*.mjs")) + list(Path("supabase/functions/relationship-interpret-v9-preview").rglob("*.mjs")):
    text = path_obj.read_text()
    text = text.replace("relationship-v12\\.2-human-narrative-v1", "relationship-v12\\.3-rich-human-narrative-v1")
    text = text.replace("relationship-v12\\.2-human-narrative", "relationship-v12\\.3-rich-human-narrative")
    text = text.replace("relationship-v12.2-human-narrative-v1", "relationship-v12.3-rich-human-narrative-v1")
    text = text.replace("relationship-v12.2-human-narrative", "relationship-v12.3-rich-human-narrative")
    text = text.replace(
        "reunion v2.12 keeps hierarchy timing deterministic while restoring human narrative",
        "reunion v2.13 keeps hierarchy timing deterministic while expanding human narrative",
    )
    text = text.replace(
        "assert.match(panel,/이번 흐름을 사람말로 풀면/)",
        "assert.match(panel,/지금 두 사람 사이에서 살아 있는 흐름/)",
    )
    text = text.replace(
        "assert.match(panel,/연락 이후에 봐야 할 것/)",
        "assert.match(panel,/연락이 닿은 뒤, 재회까지는 뭐가 남나/)",
    )
    text = text.replace(
        "assert.match(panel,/지금 막힐 수 있는 지점/)",
        "assert.match(panel,/다시 멀어질 수 있는 지점/)",
    )
    path_obj.write_text(text)

regression = r'''import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const fortune=readFileSync(new URL('./fortuneUserSummary.ts',import.meta.url),'utf8')
const fallback=readFileSync(new URL('./basicFortuneReading.ts',import.meta.url),'utf8')
const panel=readFileSync(new URL('../RelationshipInterpretationPanel.tsx',import.meta.url),'utf8')
const edge=readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/index.ts',import.meta.url),'utf8')
const cache=readFileSync(new URL('./readingCache.ts',import.meta.url),'utf8')

test('daily home headline never drops back to the generic topic-list sentence',()=>{
  assert.match(fortune,/DAILY_HEADLINE_SCENE_V25/)
  assert.match(fortune,/function fallbackDayHeadline/)
  assert.match(fortune,/if \(when === '오늘'\) return dayEvidenceHeadline/)
  assert.match(fortune,/daySummary\(bestFlow, cautionFlow\)/)
  assert.doesNotMatch(fallback,/\$\{best\.topic\} 쪽은 활용할 만하고, \$\{watch\.topic\} 쪽은 속도를 낮추는 편이 좋아/)
})

test('hierarchy reunion shows a full human story before technical evidence',()=>{
  assert.match(panel,/지금 두 사람 사이에서 살아 있는 흐름/)
  assert.match(panel,/왜 다시 신경 쓰이거나 연결될 수 있나/)
  assert.match(panel,/지금 어디까지 와 있나/)
  assert.match(panel,/연락이 닿은 뒤, 재회까지는 뭐가 남나/)
  assert.match(panel,/다시 멀어질 수 있는 지점/)
  assert.match(panel,/여러 근거가 같이 가리키는 부분/)
  assert.ok(panel.indexOf('지금 두 사람 사이에서 살아 있는 흐름') < panel.indexOf('오늘 이후 핵심 시기'))
})

test('rich reunion prose has a new cache contract and explicit depth instruction',()=>{
  assert.match(edge,/REUNION_VERSION="relationship-v12\.3-rich-human-narrative"/)
  assert.match(cache,/relationship-v12\.3-rich-human-narrative-v1/)
  assert.match(edge,/summary는 4~6문장/)
  assert.match(edge,/why_reconnect는 conclusion\+interpretation을 합쳐 5~8문장/)
  assert.match(edge,/오브와 전문용어 나열은 기술 근거로 밀어라/)
})
'''
Path("web/src/lib/humanLanguageV25.test.mjs").write_text(regression)

print("human-language v2.5 patch prepared")
