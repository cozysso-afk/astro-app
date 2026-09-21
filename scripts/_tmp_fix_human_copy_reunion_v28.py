from pathlib import Path


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f'anchor missing: {path}\n{old[:240]}')
    p.write_text(s.replace(old, new, 1))

# 1) Daily copy: never leak internal planet shorthand such as "말·정리 자극".
fortune = 'web/src/lib/fortuneUserSummary.ts'
replace_once(
    fortune,
    """const DAILY_EVIDENCE_FOCUS: Record<string,string> = {
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
""",
    """const DAILY_EVIDENCE_FOCUS: Record<string,string> = {
  금전:'돈의 순서와 책임을 정리하는 것',
  학업:'읽고 정리한 내용을 실제 진도로 옮기는 것',
  시험:'아는 내용을 시간 안에 정확히 꺼내 쓰는 것',
  직장:'업무 범위·담당·마감을 분명히 하는 것',
  이직:'변화 욕구를 직무·보상·일정 비교로 바꾸는 것',
  대인관계:'대화의 요점과 실제 합의를 맞추는 것',
  연애:'호감 표현이 약속과 실제 만남으로 이어지는지 보는 것',
  연락:'말을 꺼낸 뒤 질문과 답장이 실제 대화로 이어지는지 보는 것',
  재회:'과거 감정보다 실제 재접촉과 달라진 태도를 확인하는 것',
  소식:'전해 들은 말보다 확정된 답과 다음 절차를 확인하는 것',
  컨디션:'집중할 일정과 회복할 시간을 나눠 쓰는 것',
  투자심리:'사고 싶은 마음과 실제 매매 근거를 분리하는 것',
  수익실현:'목표와 보유 이유를 실제 조건에 다시 맞추는 것',
  신규진입:'가격·손실 한도·진입 이유를 함께 확인하는 것',
  투자주의:'수익 기대보다 감당할 손실 범위를 먼저 보는 것',
}

// DAILY_MOTION_HUMAN_V28: phase language stays human and domain-specific; internal planet shorthand never reaches the headline.
const DAILY_FOLLOW_THROUGH: Record<string,string> = {
  금전:'이미 잡아 둔 예산과 결제가 계획대로 처리되는지 확인해.',
  학업:'이미 시작한 공부가 실제로 끝낸 분량으로 남는지 확인해.',
  시험:'이미 풀어 본 문제에서 같은 실수가 반복되는지 확인해.',
  직장:'이미 오간 업무 합의가 실제 담당과 일정으로 이어지는지 확인해.',
  이직:'이미 나온 제안이나 대화가 구체적인 조건으로 이어지는지 확인해.',
  대인관계:'이미 오간 말이 실제 약속이나 행동으로 이어지는지 확인해.',
  연애:'이미 오간 호감 표현이 실제 약속이나 만남으로 이어지는지 확인해.',
  연락:'이미 시작된 대화가 한두 번의 답장에서 끝나지 않고 이어지는지 확인해.',
  재회:'떠오른 감정이 아니라 실제 연락과 달라진 행동이 이어지는지 확인해.',
  소식:'이미 들어온 정보가 확정 답변이나 다음 절차로 이어지는지 확인해.',
  컨디션:'이미 잡아 둔 일정이 무리 없이 이어지는지 몸 상태를 확인해.',
  투자심리:'이미 세운 기준이 조급함 때문에 흔들리지 않는지 확인해.',
  수익실현:'이미 정한 목표와 보유 이유가 지금 조건에도 맞는지 확인해.',
  신규진입:'이미 정한 진입 조건과 손실 한도가 실제로 지켜지는지 확인해.',
  투자주의:'이미 정한 위험 한도 안에서 움직이고 있는지 확인해.',
}
""",
)

replace_once(
    fortune,
    """  const key = lead.item.transit && SYMBOLS[lead.item.transit]
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
  const applying = /Applying|적용/i.test(motion)
  const exact = /Exact|정확/i.test(motion)
  const separating = /Separating|분리/i.test(motion)
  if (separating) {
    return `${lead.topic}에서 오늘 남아 있는 핵심은 ${focus}이야. ${trigger} 자극의 정점은 지났으니, 새로 밀어붙이기보다 이미 시작된 일과 반응이 실제 행동으로 어떻게 이어지는지 확인해.`
  }
  const phase = applying
    ? `${trigger} 자극도 아직 커지는 중이라 첫 반응 하나보다 흐름이 이어지는지를 봐.`
    : exact
      ? `${trigger} 자극이 오늘 특히 또렷해.`
      : `${trigger} 자극이 오늘 체감에 남아 있어.`
""",
    """  const scene = DAILY_HEADLINE_SCENE[lead.topic]
  const focus = DAILY_EVIDENCE_FOCUS[lead.topic]
  if (!scene || !focus) return fallbackDayHeadline(context, bestFlow, cautionFlow)
  const polarity = typeof lead.item.polarity === 'number' && Number.isFinite(lead.item.polarity) ? Math.sign(lead.item.polarity) : 0
  const caution = cautionFlow.includes(lead.topic) || polarity < 0
  const sceneText = caution ? scene.caution : scene.use
  const motion = String(lead.item.motion ?? '')
  const applying = /Applying|적용/i.test(motion)
  const exact = /Exact|정확/i.test(motion)
  const separating = /Separating|분리/i.test(motion)
  if (separating) {
    const followThrough = DAILY_FOLLOW_THROUGH[lead.topic] ?? '이미 시작된 일이 실제 행동으로 이어지는지 확인해.'
    return `${lead.topic}에서 오늘 남아 있는 핵심은 ${focus}이야. 이 흐름은 가장 강했던 구간을 지나고 있어. ${followThrough}`
  }
  const phase = applying
    ? '이 흐름은 아직 강해지는 중이라 첫 반응 하나보다 실제 변화가 이어지는지를 봐.'
    : exact
      ? '오늘은 이 주제가 가장 또렷하게 드러나는 구간이야.'
      : '오늘은 이 흐름의 영향이 이어지는 구간이야.'
""",
)

# 2) Weekly copy: replace compressed checklist nouns with natural, complete tasks.
old_weekly_scene = """const WEEKLY_HEADLINE_SCENE: Record<string, { use: string; caution: string }> = {
  금전:{use:'정산·예산을 정리하는 쪽',caution:'지출과 결제 조건을 다시 확인하는 쪽'},
  학업:{use:'실제로 끝낼 공부 분량을 만드는 쪽',caution:'집중을 흩뜨리는 일을 줄이는 쪽'},
  시험:{use:'문제를 풀며 실수 지점을 잡는 쪽',caution:'범위를 넓히기보다 정확도를 챙기는 쪽'},
  직장:{use:'요청·담당자·마감을 구체화하는 쪽',caution:'애매한 책임을 바로 떠안지 않는 쪽'},
  이직:{use:'직무·보상·일정을 비교하는 쪽',caution:'기분보다 실제 제안 조건을 확인하는 쪽'},
  대인관계:{use:'대화를 실제 약속과 일정으로 잇는 쪽',caution:'말투 하나보다 이후 태도를 확인하는 쪽'},
  연애:{use:'호감을 실제 만남과 약속으로 확인하는 쪽',caution:'호감 표현 하나에 의미를 앞서 붙이지 않는 쪽'},
  연락:{use:'답하기 쉬운 말로 대화를 구체화하는 쪽',caution:'답장 속도를 관계 결론으로 확대하지 않는 쪽'},
  재회:{use:'추억보다 실제 대화와 달라진 태도를 확인하는 쪽',caution:'과거가 떠오르는 것과 재시작을 구분하는 쪽'},
  소식:{use:'원문·답변·공식 안내를 직접 확인하는 쪽',caution:'중간 정보만으로 결과를 확정하지 않는 쪽'},
  컨디션:{use:'집중할 일정과 쉴 시간을 나누는 쪽',caution:'한 주 내내 같은 속도로 밀지 않는 쪽'},
  투자심리:{use:'매수 욕구와 실제 근거를 분리하는 쪽',caution:'조급함 때문에 원래 기준을 바꾸지 않는 쪽'},
  수익실현:{use:'목표와 보유 이유를 다시 맞춰 보는 쪽',caution:'기분만으로 정리 시점을 정하지 않는 쪽'},
  신규진입:{use:'진입 조건과 손실 한도를 확인하는 쪽',caution:'놓칠까 봐 위험 한도를 넓히지 않는 쪽'},
  투자주의:{use:'포지션과 감당할 손실 범위를 점검하는 쪽',caution:'경계가 약해 보여도 안전하다고 가정하지 않는 쪽'},
}
"""
new_weekly_scene = """const WEEKLY_HEADLINE_SCENE: Record<string, { use: string; caution: string }> = {
  금전:{use:'정산과 예산의 우선순위를 정리하는 것',caution:'지출과 결제 조건을 다시 확인하는 것'},
  학업:{use:'끝낼 공부 분량을 정하고 실제로 마치는 것',caution:'집중을 흩뜨리는 일을 줄이고 한 과제를 끝내는 것'},
  시험:{use:'문제를 풀며 실수 원인을 확인하는 것',caution:'범위를 넓히기보다 정확도를 챙기는 것'},
  직장:{use:'누가 무엇을 언제까지 맡을지 분명히 하는 것',caution:'책임 범위가 애매한 일을 바로 떠안지 않는 것'},
  이직:{use:'직무·보상·시작 일정을 실제 조건으로 비교하는 것',caution:'기분보다 실제 제안 조건을 확인하는 것'},
  대인관계:{use:'오간 대화를 실제 약속이나 일정으로 이어 보는 것',caution:'말투 하나보다 이후 태도와 행동을 확인하는 것'},
  연애:{use:'호감 표현이 실제 약속과 만남으로 이어지는지 보는 것',caution:'호감 표현 하나에 관계의 의미를 앞서 붙이지 않는 것'},
  연락:{use:'답하기 쉬운 말로 대화를 시작하고 실제로 이어 보는 것',caution:'답장 속도를 관계의 결론으로 확대하지 않는 것'},
  재회:{use:'추억보다 실제 대화와 달라진 행동이 있는지 확인하는 것',caution:'과거가 떠오르는 것과 관계 재시작을 구분하는 것'},
  소식:{use:'원문·답변·공식 안내를 직접 확인하는 것',caution:'중간 정보만으로 결과를 확정하지 않는 것'},
  컨디션:{use:'집중할 일정과 쉴 시간을 나눠 배치하는 것',caution:'한 주 내내 같은 속도로 밀어붙이지 않는 것'},
  투자심리:{use:'매수 욕구와 실제 근거를 분리하는 것',caution:'조급함 때문에 원래 기준을 바꾸지 않는 것'},
  수익실현:{use:'목표와 보유 이유를 지금 조건에 다시 맞춰 보는 것',caution:'기분만으로 정리 시점을 정하지 않는 것'},
  신규진입:{use:'진입 조건과 손실 한도를 함께 확인하는 것',caution:'놓칠까 봐 위험 한도를 넓히지 않는 것'},
  투자주의:{use:'포지션과 감당할 손실 범위를 점검하는 것',caution:'경계가 약해 보여도 안전하다고 가정하지 않는 것'},
}
"""
replace_once(fortune, old_weekly_scene, new_weekly_scene)
replace_once(
    fortune,
    """  // WEEKLY_ARC_COHERENCE_V27: each phase owns a complete clause; repeated adjacent scenes collapse.
  const task = (scene: string) => scene.replace(/쪽$/, '일')
  const sameBeat = (a: typeof beats[number], b: typeof beats[number]) => a.topic === b.topic && a.scene === b.scene
  const phrase = (beat: typeof beats[number]) => `${beat.topic}에서 ${task(beat.scene)}`
""",
    """  // WEEKLY_ARC_HUMAN_V28: each phase is a complete real-life task, not a compressed checklist phrase.
  const sameBeat = (a: typeof beats[number], b: typeof beats[number]) => a.topic === b.topic && a.scene === b.scene
  const phrase = (beat: typeof beats[number]) => `${beat.topic}에서 ${beat.scene}`
""",
)

# 3) Hierarchy reunion UI: numeric secondary indicators come from stage-gated future candidates.
panel_path = 'web/src/RelationshipInterpretationPanel.tsx'
replace_once(
    panel_path,
    """}
function reunionStageHuman(stageKey: string, fallbackLabel = '') {
""",
    """}
const REUNION_STAGE_INDICATORS = [
  ['emotional_reactivation','감정 재활성화'],
  ['contact_recontact','연락·재접촉'],
  ['in_person_meeting','실제 만남'],
  ['relationship_rebuilding','관계 재구축'],
] as const
function reunionStageHuman(stageKey: string, fallbackLabel = '') {
""",
)

replace_once(
    panel_path,
    """        {typeof view.reconnection.score === 'number' && <section className=\"reunion-ai-block reunion-contact-indicators\">
          <h4>연락 가능성 · 보조지표</h4>
          <div className=\"reunion-return-context-grid\">
            <article className=\"reunion-return-context-card\"><b>재접촉 활성도</b><strong>{view.reconnection.score}/100</strong><small>{view.reconnection.band}</small></article>
            {typeof view.incoming.score === 'number' && <article className=\"reunion-return-context-card\"><b>상대측 반응 활성도</b><strong>{view.incoming.score}/100</strong><small>{view.incoming.band}</small></article>}
            {typeof view.outgoing.score === 'number' && <article className=\"reunion-return-context-card\"><b>내측 연락 적합도</b><strong>{view.outgoing.score}/100</strong><small>{view.outgoing.band}</small></article>}
          </div>
          <p className=\"reunion-score-meaning\">숫자는 같은 조회 기간 안에서 신호가 얼마나 활성돼 있는지 비교하는 보조지표야. 실제 연락 확률·재회 확률이나 누가 먼저 연락할 확률이 아니야.</p>
        </section>}
""",
    """        <section className=\"reunion-ai-block reunion-contact-indicators\">
          <h4>단계별 활성도 · 보조지표</h4>
          <div className=\"reunion-return-context-grid\">
            {REUNION_STAGE_INDICATORS.map(([stageKey,label])=>{
              const stage=hierarchyData.stages[stageKey]
              const hasCandidate=!!stage && stage.candidate_count>0 && typeof stage.activation==='number'
              return <article className=\"reunion-return-context-card\" key={stageKey}><b>{label}</b><strong>{hasCandidate ? `${Math.round(stage.activation as number)}/100` : '—'}</strong><small>{hasCandidate ? `미래 후보 ${stage.candidate_count}개` : '공개할 미래 후보 없음'}</small></article>
            })}
          </div>
          <p className=\"reunion-score-meaning\">숫자는 현재 감정 세기나 사건 확률이 아니라, 조회 범위에서 단계별 관문을 통과해 공개된 미래 후보 중 가장 높은 활성도야. 연락·재접촉 후보가 0개면 그 기간에 공개할 연락 후보가 없다는 뜻이고, 후보가 있더라도 그 숫자만으로 실제 연락·재회나 선연락 주체를 확정하지 않아.</p>
        </section>
""",
)
replace_once(panel_path, '<small>핵심 날짜 {hierarchyData.nearest_window.date} · 보조지표 활성도 {hierarchyData.nearest_window.final}</small>', '<small>대표 날짜 {hierarchyData.nearest_window.date} · 사건 확정일 아님 · 보조지표 활성도 {hierarchyData.nearest_window.final}</small>')
replace_once(
    panel_path,
    "{Object.entries(hierarchyData.stages).map(([stageKey,stage])=><p key={stage.label}><b>{stage.label}</b> · {reunionStageHuman(stageKey, stage.label)} <small>{stage.activation === null ? '현재 기간에 공개할 미래 후보 없음' : `보조지표 · 활성도 ${stage.activation}`}</small></p>)}",
    "{Object.entries(hierarchyData.stages).map(([stageKey,stage])=><p key={stage.label}><b>{stage.label}</b> · {reunionStageHuman(stageKey, stage.label)} <small>{stage.candidate_count>0 ? `미래 후보 ${stage.candidate_count}개` : '현재 기간에 공개할 미래 후보 없음'}</small></p>)}",
)

# 4) QA fixture: make the example conservative and explicitly stage-grounded.
qa_path='web/src/EditorialQaPreview.tsx'
qa=Path(qa_path).read_text()
start=qa.index('function ReunionQA() {')
end=qa.index('\nexport function EditorialQaPreview()', start)
new_reunion = r'''function ReunionQA() {
  return <div className="period-ai-card period-ai-v18">
    <div className="period-ai-head" style={{order:-1}}><div><span className="period-ai-kicker">재회운 핵심</span><h3>감정 쪽 신호가 먼저 보이고, 연락 단계에는 후보가 하나 있지만 만남·재구축 단계까지 열린 흐름은 아니야.</h3><p className="reading-hero-subtitle">이 화면은 실제 사용자 계산이 아니라 문구와 구조를 검수하는 fixture야. 아래 숫자도 예시값이며, 확률이 아니라 단계별 후보를 비교하는 보조지표야.</p></div></div>
    <section className="period-ai-window-section"><div className="period-ai-section-title"><span>단계별 활성도 · 보조지표</span></div><div className="reunion-return-context-grid"><article className="reunion-return-context-card"><b>감정 재활성화</b><strong>68/100</strong><small>미래 후보 2개</small></article><article className="reunion-return-context-card"><b>연락·재접촉</b><strong>57/100</strong><small>미래 후보 1개</small></article><article className="reunion-return-context-card"><b>실제 만남</b><strong>—</strong><small>공개할 미래 후보 없음</small></article><article className="reunion-return-context-card"><b>관계 재구축</b><strong>—</strong><small>공개할 미래 후보 없음</small></article></div><p>57은 연락 확률 57%도, 현재 마음의 세기도 아니야. 이 예시에서는 연락 단계 관문을 통과한 미래 후보가 하나 있고 그 후보의 활성도가 57이라는 뜻이야. 반대로 후보가 없는 만남·재구축 단계는 점수를 억지로 만들어 보여주지 않아.</p></section>
    <section className="period-ai-window-section"><div className="period-ai-section-title"><span>지금 두 사람 사이에서 살아 있는 흐름</span></div><p>지금 가장 앞선 건 감정과 기억이 다시 움직이는 단계야. 서로가 다시 생각나거나 과거 대화를 되짚는 장면은 생길 수 있지만, 그것만으로 연락이 온다고 읽지는 않아. 연락·재접촉 단계에는 후보가 하나 잡혀 있어서 대화가 다시 열릴 가능성을 관찰할 구간은 있어. 다만 실제 만남과 관계 재구축 단계에는 공개할 미래 후보가 없으므로, 현재 흐름을 ‘재회가 가까워졌다’고 묶어 말하면 과장이야. 지금의 핵심은 감정 반응과 실제 행동 사이에 아직 간격이 있다는 점이야.</p></section>
    <section className="period-ai-window-section"><div className="period-ai-section-title"><span>왜 다시 신경 쓰이거나 연결될 수 있나</span></div><p>이번 예시에서는 감정 단계가 연락 단계보다 먼저, 더 여러 번 후보로 잡혀 있어. 그래서 현실에서는 문득 상대가 생각나거나 예전 대화가 다시 의미 있게 느껴지는 식으로 먼저 나타날 수 있어. 연락 단계 후보가 있다는 건 그 감정이 실제 메시지·답장·안부 같은 상호작용으로 넘어갈 수 있는 창이 하나 있다는 뜻이야. 하지만 후보 하나가 있다는 것과 연락이 실제로 발생한다는 것은 다르고, 상대가 먼저 움직인다는 뜻도 아니야. 연락이 닿더라도 한 번의 답장보다 대화가 며칠 이상 이어지는지, 다음 질문이나 약속 제안으로 넘어가는지를 봐야 해. 그런 후속 행동이 없다면 감정 재활성화에서 멈춘 흐름으로 읽는 게 맞아.</p></section>
    <section className="period-ai-window-section"><div className="period-ai-section-title"><span>지금 어디까지 와 있나</span></div><p>단계로 보면 ‘감정 재활성화’는 열려 있고 ‘연락·재접촉’은 제한적인 후보가 있지만, ‘실제 만남’과 ‘관계 재구축’은 아직 열리지 않은 상태야. 그래서 지금은 재회 여부를 묻기보다 연락 단계로 실제 이동하는지가 먼저야. 메시지 한 번, 좋아요 한 번, 우연한 반응 하나만으로 다음 단계가 열렸다고 보지 않아. 대화가 이어지고 서로 시간을 쓰려는 제안이 생겨야 만남 단계와 구분할 수 있어. 그 전에는 기대보다 관찰이 앞서는 흐름이야.</p></section>
    <section className="period-ai-window-section"><div className="period-ai-section-title"><span>다시 움직인다면 어떤 순서인가</span></div><p>감정이 다시 올라옴 → 짧은 연락이나 반응이 실제로 생김 → 대화가 한 번 이상 이어짐 → 구체적인 약속을 잡음 → 실제로 만남 → 이전 문제를 어떻게 다르게 다룰지 합의함의 순서로 봐. 각 화살표는 자동으로 넘어가는 단계가 아니야. 예를 들어 연락이 와도 대화가 금방 끊기면 연락 단계에서 끝난 거고, 대화가 이어져도 만남 약속이 없으면 만남 단계로 승격하지 않아. 이 구분이 있어야 ‘연락 왔다 = 재회’ 같은 과잉해석을 막을 수 있어.</p></section>
    <section className="period-ai-window-section"><div className="period-ai-section-title"><span>오늘 이후 후보 시기</span></div><p><strong>2026-10-21 전후</strong>는 연락·재접촉 단계가 실제로 열리는지 살피는 예시 후보 창이야. <strong>2027-01-21 전후</strong>는 감정 재활성화 쪽 근거가 다시 모이는 예시 후보 창으로 두 단계의 의미가 달라. 특정 하루를 사건일로 찍는 게 아니라, 해당 단계의 장기·중기·사건 촉발 근거가 함께 통과하는 기간을 후보로 보는 방식이야. 만남·재구축 후보가 없다면 그보다 뒤 단계를 억지로 만들어 내지 않아.</p></section>
    <section className="period-ai-window-section"><div className="period-ai-section-title"><span>연락 이후, 재회까지 남은 것</span></div><p>연락이 다시 시작돼도 재회 판단은 그 다음 행동에서 해야 해. 첫째, 대화가 일회성 안부에서 끝나지 않고 서로 질문과 답을 주고받는지 봐야 해. 둘째, 실제 만남이나 함께 시간을 쓰는 약속이 구체적으로 잡히는지가 필요해. 셋째, 예전 갈등을 다시 꺼냈을 때 피하거나 끊는 대신 무엇을 바꿀지 합의할 수 있어야 해. 이 세 단계가 따라오지 않으면 연락은 재접촉일 뿐 관계 재구축이라고 부르지 않는 게 맞아.</p></section>
    <section className="period-ai-window-section"><div className="period-ai-section-title"><span>다시 멀어질 수 있는 지점</span></div><p>가장 큰 위험은 감정이 다시 올라온 것을 관계가 회복될 신호로 너무 빨리 해석하는 거야. 연락 후보가 하나 있다는 이유로 답장을 기다리며 모든 행동에 의미를 붙이면 실제로 확인된 단계보다 앞서가게 돼. 또 연락이 닿더라도 예전처럼 갈등이 생겼을 때 대화를 끊거나 약속을 흐리는 방식이 반복되면 재구축 단계로 넘어가기 어렵다고 봐야 해.</p></section>
  </div>
}
'''
Path(qa_path).write_text(qa[:start] + new_reunion + qa[end:])

# 5) AI contract: make hierarchy stage state authoritative and enforce real narrative depth.
edge='supabase/functions/relationship-interpret-v9-preview/index.ts'
replace_once(edge, 'const REUNION_VERSION="relationship-v12.3-rich-human-narrative";', 'const REUNION_VERSION="relationship-v12.4-stage-grounded-narrative";')
replace_once(
    edge,
    "natal/시너스트리처럼 매 계산에서 고정되는 관계 구조는 짧게 요약하고, 이번 조회에서 달라진 stage·nearest window·future top periods를 우선 설명한다.",
    "reunion_hierarchy.stages의 activation은 현재 감정 세기나 사건 확률이 아니라 조회 범위 안에서 선택된 미래 후보 중 최고 활성도다. candidate_count가 0이거나 activation이 null이면 그 단계에는 공개할 미래 후보가 없다고 써라. contact_recontact 후보가 없는데 '연락 기운이 살아 있다', '연결될 여지가 커진다', '연락이 가까워졌다'처럼 쓰지 마라. contact_recontact 후보는 있지만 in_person_meeting 또는 relationship_rebuilding 후보가 없으면 '연락 후보는 있으나 만남·재구축 단계는 아직 열리지 않았다'고 분리해서 써라. generic incoming/outgoing/reconnection 점수로 hierarchy gate를 덮어쓰지 마라. natal/시너스트리처럼 매 계산에서 고정되는 관계 구조는 짧게 요약하고, 이번 조회에서 달라진 stage·nearest window·future top periods를 우선 설명한다."
)
replace_once(
    edge,
    "summary는 4~6문장으로 현재 상태의 이야기와 다음 단계의 간격을 충분히 풀고, why_reconnect는 conclusion+interpretation을 합쳐 5~8문장 정도로 왜 다시 신경 쓰이거나 접점이 열릴 수 있는지 현실 장면까지 번역한다. timing.conclusion은 3~5문장으로 현재 단계와 다음 단계 사이에 무엇이 더 필요한지 설명하고, rebuild.conclusion은 3~5문장으로 연락 이후 실제 관계를 다시 세우려면 무엇을 확인해야 하는지 말한다. repeat_risks는 2~4문장으로 현재 단계와 연결되는 반복 위험만 설명한다.",
    "summary는 5~7문장으로 현재 가장 앞선 단계, 연락 단계의 후보 유무, 아직 열리지 않은 다음 단계를 분명히 대비한다. why_reconnect는 conclusion+interpretation을 합쳐 6~9문장으로 왜 다시 신경 쓰일 수 있는지와 그것이 실제 연락과 어떻게 다른지 현실 장면까지 번역한다. timing.conclusion은 4~6문장으로 현재 단계와 다음 단계 사이에 무엇이 더 필요한지 설명한다. rebuild.conclusion은 4~6문장으로 연락 이후 실제 만남과 관계 재구축까지 무엇을 확인해야 하는지 말한다. repeat_risks는 3~5문장으로 현재 단계와 연결되는 반복 위험만 설명한다. 점수가 중간대이거나 후보 수가 적으면 강한 표현으로 부풀리지 말고, 후보가 없으면 없는 단계를 분명히 말한다."
)
replace_once(
    edge,
    ' if(p==="reunion"&&String(data.reunion_synthesis_v2?.summary??"").length<need(180))return false;\n',
    ''' if(p==="reunion"){
   const r=data.reunion_synthesis_v2??{};
   const why=`${String(r?.why_reconnect?.conclusion??"")} ${String(r?.why_reconnect?.interpretation??"")}`.trim();
   if(String(r?.summary??"").length<need(260))return false;
   if(why.length<need(420))return false;
   if(String(r?.timing?.conclusion??"").length<need(220))return false;
   if(String(r?.rebuild?.conclusion??"").length<need(240))return false;
   if(String(r?.repeat_risks?.conclusion??"").length<need(140))return false;
 }
'''
)

cache='web/src/lib/readingCache.ts'
replace_once(cache, "const RELATIONSHIP_REUNION_AI_CACHE_CONTRACT = 'relationship-v12.3-rich-human-narrative-v1'", "const RELATIONSHIP_REUNION_AI_CACHE_CONTRACT = 'relationship-v12.4-stage-grounded-narrative-v1'")

# 6) Regression contracts.
human='web/src/lib/humanLanguageV25.test.mjs'
h=Path(human).read_text()
h=h.replace("assert.match(edge,/REUNION_VERSION=\"relationship-v12\\.3-rich-human-narrative\"/)", "assert.match(edge,/REUNION_VERSION=\"relationship-v12\\.4-stage-grounded-narrative\"/)")
h=h.replace("assert.match(cache,/relationship-v12\\.3-rich-human-narrative-v1/)", "assert.match(cache,/relationship-v12\\.4-stage-grounded-narrative-v1/)")
h=h.replace("assert.match(edge,/summary는 4~6문장/)", "assert.match(edge,/summary는 5~7문장/)")
h=h.replace("assert.match(edge,/why_reconnect는 conclusion\\+interpretation을 합쳐 5~8문장/)", "assert.match(edge,/why_reconnect는 conclusion\\+interpretation을 합쳐 6~9문장/)")
h=h.replace("assert.match(fortune,/WEEKLY_ARC_COHERENCE_V27/)", "assert.match(fortune,/WEEKLY_ARC_HUMAN_V28/)")
extra = r'''

test('daily and weekly hero copy never leaks internal shorthand or checklist nouns',()=>{
  assert.doesNotMatch(fortune,/DAILY_SYMBOL_FOCUS/)
  assert.doesNotMatch(fortune,/말·정리 자극|목표·주도권 자극|책임·제약 자극/)
  assert.match(fortune,/누가 무엇을 언제까지 맡을지 분명히 하는 것/)
  assert.doesNotMatch(fortune,/요청·담당자·마감을 구체화하는 쪽/)
})

test('hierarchy numeric support uses stage-gated candidates rather than generic direction scores',()=>{
  assert.match(panel,/단계별 활성도 · 보조지표/)
  assert.match(panel,/contact_recontact/)
  assert.match(panel,/미래 후보 \$\{stage\.candidate_count\}개/)
  assert.match(panel,/현재 감정 세기나 사건 확률이 아니라/)
  assert.doesNotMatch(panel,/재접촉 활성도<\/b><strong>\{view\.reconnection\.score/)
})

test('reunion prose contract is score-aware and validates every major human section',()=>{
  assert.match(edge,/candidate_count가 0이거나 activation이 null/)
  assert.match(edge,/generic incoming\/outgoing\/reconnection 점수로 hierarchy gate를 덮어쓰지 마라/)
  assert.match(edge,/why\.length<need\(420\)/)
  assert.match(edge,/timing\?\.conclusion.*need\(220\)/s)
  assert.match(edge,/rebuild\?\.conclusion.*need\(240\)/s)
  assert.match(edge,/repeat_risks\?\.conclusion.*need\(140\)/s)
})
'''
if "daily and weekly hero copy never leaks internal shorthand" not in h:
    h += extra
Path(human).write_text(h)

reading='web/src/lib/readingExperience.test.mjs'
r=Path(reading).read_text()
r=r.replace("  assert.match(view.headline,/정점은 지났으니/)\n  assert.match(view.headline,/이미 시작된 일과 반응/)\n", "  assert.match(view.headline,/가장 강했던 구간을 지나고 있어/)\n  assert.match(view.headline,/이미 오간 말이 실제 약속이나 행동으로 이어지는지/)\n  assert.doesNotMatch(view.headline,/자극|말·정리/)\n")
r=r.replace("  assert.equal((view.headline.match(/요청·담당자·마감/g)||[]).length,1)\n", "  assert.equal((view.headline.match(/누가 무엇을 언제까지 맡을지/g)||[]).length,1)\n")
r=r.replace("  assert.match(panel,/연락 가능성 · 보조지표/)\n  assert.match(panel,/실제 연락 확률·재회 확률/)\n", "  assert.match(panel,/단계별 활성도 · 보조지표/)\n  assert.match(panel,/연락·재접촉/)\n  assert.match(panel,/현재 감정 세기나 사건 확률이 아니라/)\n")
Path(reading).write_text(r)

print('v28 human copy + stage-grounded reunion patch applied')
