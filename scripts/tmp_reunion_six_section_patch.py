from pathlib import Path

panel_path = Path('web/src/RelationshipInterpretationPanel.tsx')
panel = panel_path.read_text(encoding='utf-8')
start = panel.index('    {reunion && hierarchyData && <section className="reading-section reunion-hierarchy reunion-v211">')
end = panel.index('\n\n    {ai?.ok && ai.data && (!reunion || !hierarchyData) ?', start)
new = r'''    {reunion && hierarchyData && <section className="reading-section reunion-hierarchy reunion-v212">
      <h3>재회운 핵심</h3>
      {hierarchyData.validation?.status !== 'PASS' ? <p role="alert">계산 검증에 실패해 시기 후보와 해설을 보류했어.</p> : <>
        <section className="reunion-primary-section reunion-past-check">
          <h4>지난 활성기 · 사후검증</h4>
          <p className="reunion-score-meaning">기준일 이전에 같은 관문을 통과했던 구간이야. 실제 메시지·답장·만남·관계 변화 기록과 비교하는 개인 사후 확인용이야. 맞아 보인다는 사실만으로 엔진 정확도가 증명되는 것은 아니야.</p>
          {hierarchyData.past_windows.map((w)=><article className="relationship-pattern reunion-past-window" key={`past:${w.start}:${w.stage}`}><b>{w.start} ~ {w.end} · {w.label}</b><p>{reunionStageHuman(w.stage,w.label)}</p><small>대표 날짜 {w.date} · 이미 지난 구간 · 보조지표 활성도 {w.final}</small></article>)}
          {!hierarchyData.past_windows.length&&<p>조회 범위 안에서 실제 기록과 비교할 지난 활성기가 없어.</p>}
        </section>

        <section className="reunion-primary-section reunion-current-flow">
          <h4>현재 흐름</h4>
          {reunionV2?.summary&&<ReadableCopy className="reading-conclusion" text={firstSentences(reunionV2.summary,3)}/>} 
          {hierarchyData.current_windows.map((w)=><article className="relationship-pattern reunion-current-window" key={`current:${w.start}:${w.stage}`}><b>{w.start} ~ {w.end} · {w.label}</b><p>{reunionStageHuman(w.stage,w.label)}</p><small>기준일 {hierarchyData.as_of_date} 포함 · 사건 확정 아님 · 보조지표 활성도 {w.final}</small></article>)}
          {!hierarchyData.current_windows.length&&<p>기준일이 포함된 공개 활성창은 없어. 현재 감정이나 행동이 없다는 뜻이 아니라, 지금 시점에 계층 관문을 통과한 사건 후보가 없다는 뜻이야.</p>}
        </section>

        <section className="reunion-primary-section reunion-future-flow">
          <h4>앞으로의 후보 시기</h4>
          {hierarchyData.top_periods.map((w)=><article className="relationship-pattern reunion-future-window" key={`${w.start}:${w.stage}`}><b>{w.start} ~ {w.end} · {w.label} 후보 창</b><p>{reunionStageHuman(w.stage,w.label)}</p><small>대표 날짜 {w.date} · 사건 확정일 아님 · 보조지표 활성도 {w.final}</small></article>)}
          {!hierarchyData.top_periods.length&&<p>오늘 이후 조회 범위에는 공개할 후보 시기가 없어.</p>}
        </section>

        <section className="reunion-primary-section reunion-contact-not-reunion">
          <h4>연락 ≠ 재회</h4>
          {(()=>{const contact=hierarchyData.stages.contact_recontact;const meeting=hierarchyData.stages.in_person_meeting;const rebuild=hierarchyData.stages.relationship_rebuilding;return <p>{contact?.candidate_count>0?`연락·재접촉 후보는 ${contact.candidate_count}개가 잡혀 있어.`:'현재 조회 범위에는 공개할 연락·재접촉 후보가 없어.'} {meeting?.candidate_count>0?`그중 별도로 실제 만남 관문을 통과한 후보는 ${meeting.candidate_count}개야.`:'실제 만남 단계는 아직 별도 후보가 없어.'} {rebuild?.candidate_count>0?`관계 재구축 관문까지 통과한 후보는 ${rebuild.candidate_count}개야.`:'관계 재구축 단계까지 열린 후보는 아직 없어.'} 연락 한 번이나 답장 하나만으로 재회를 판정하지 않아.</p>})()}
          <div className="reunion-return-context-grid">{REUNION_STAGE_INDICATORS.map(([stageKey,label])=>{const stage=hierarchyData.stages[stageKey];const hasCandidate=!!stage&&stage.candidate_count>0&&typeof stage.activation==='number';return <article className="reunion-return-context-card" key={stageKey}><b>{label}</b><strong>{hasCandidate?`${Math.round(stage.activation as number)}/100`:'—'}</strong><small>{hasCandidate?`후보 ${stage.candidate_count}개`:'후보 없음'}</small></article>})}</div>
          <p className="reunion-score-meaning">숫자는 실제 연락·재회 확률이나 현재 감정의 세기가 아니라, 해당 단계 관문을 통과한 후보의 상대 활성도야.</p>
        </section>

        <section className="reunion-primary-section reunion-rebuild-conditions">
          <h4>재구축 조건</h4>
          {reunionV2?.rebuild?.conclusion?<ReadableCopy text={reunionV2.rebuild.conclusion}/>:<p>연락이 이어지는 것만으로는 부족해. 대화가 실제 약속이나 만남으로 넘어가고, 예전 갈등을 반복하지 않을 방식과 관계의 경계를 다시 합의하는 단계까지 확인해야 해.</p>}
          {reunionV2?.rebuild?.conditions?.length>0&&<ul>{reunionV2.rebuild.conditions.slice(0,3).map((x,i)=><li key={i}>{x}</li>)}</ul>}
          {hierarchyData.stages.relationship_rebuilding?.candidate_count>0?<p>현재 조회 범위에서는 관계 재구축 관문을 통과한 후보가 {hierarchyData.stages.relationship_rebuilding.candidate_count}개 있어. 그래도 실제 관계 회복을 확정하는 값은 아니야.</p>:<p>현재 조회 범위에는 관계 재구축 관문까지 통과한 공개 후보가 없어. 감정이나 연락 신호가 있어도 그 다음 행동을 따로 봐야 해.</p>}
        </section>

        <details className="reading-more reunion-evidence-fold"><summary>근거 보기 · 계산/정밀도</summary>
          {hierarchyData.nearest_window&&<article className="relationship-pattern reunion-nearest-window"><h4>가장 가까운 활성창</h4><b>{hierarchyData.nearest_window.start} ~ {hierarchyData.nearest_window.end} · {hierarchyData.nearest_window.label}</b><p>{reunionStageHuman(hierarchyData.nearest_window.stage,hierarchyData.nearest_window.label)}</p><small>대표 날짜 {hierarchyData.nearest_window.date} · 보조지표 활성도 {hierarchyData.nearest_window.final}</small></article>}
          <p className="reunion-initiative-closed"><b>누가 먼저 연락?</b> 현재 활성도만으로는 판정하지 않아. 실제 방향성 행동 근거가 독립된 체계에서 확인될 때만 방향을 제시해.</p>
          <p>{hierarchyData.score_meaning}</p>
          {hierarchyData.stability_structure&&<p>고정 관계 구조: 지지 접촉 {hierarchyData.stability_structure.support.length}개 · 긴장 접촉 {hierarchyData.stability_structure.obstacles.length}개. 접촉 수 자체는 재결합 확률이 아니야.</p>}
          {reunionV2?.why_reconnect?.conclusion&&<><h4>왜 다시 신경 쓰일 수 있나</h4><ReadableCopy text={firstSentences(reunionV2.why_reconnect.conclusion,2)}/></>}
          {reunionV2?.repeat_risks?.conclusion&&<><h4>다시 멀어질 수 있는 지점</h4><ReadableCopy text={firstSentences(reunionV2.repeat_risks.conclusion,2)}/></>}
          {reunionV2?.precision_note&&<><h4>정밀도 메모</h4><ReadableCopy text={reunionV2.precision_note}/></>}
          {hierarchyData.limitations.map((x)=><p key={x}>{x}</p>)}
        </details>
      </>}
    </section>}'''
panel = panel[:start] + new + panel[end:]
panel = panel.replace('className="reading-section relationship-natural-reading is-ready"','className="reading-section relationship-natural-reading is-ready" hidden={reunion && !!hierarchyData}',1)
panel = panel.replace('open={!(ai?.ok && ai.data)}','open={!hierarchyData && !(ai?.ok && ai.data)}',1)
panel_path.write_text(panel, encoding='utf-8')

test_path = Path('web/src/lib/relationshipReunionV2.contract.test.mjs')
test = test_path.read_text(encoding='utf-8')
test = test.replace('assert.match(panel,/재회 흐름 타임라인/)','assert.match(panel,/재회운 핵심/)')
test = test.replace('assert.match(panel,/지난 활성기 · 사후 확인용/)','assert.match(panel,/지난 활성기 · 사후검증/)')
for stale in [
    '  assert.match(panel,/실제 메시지·만남·관계 변화 기록과 비교하는 개인 사후 확인용/)\n',
    '  assert.match(panel,/고정 관계 구조 · 필요할 때만 보기/)\n',
    '  assert.match(panel,/지금 두 사람 사이에서 살아 있는 흐름/)\n',
    '  assert.match(panel,/지금 어디까지 와 있나/)\n',
    '  assert.match(panel,/연락이 닿은 뒤, 재회까지는 뭐가 남나/)\n',
    '  assert.match(panel,/다시 멀어질 수 있는 지점/)\n',
]:
    test = test.replace(stale, '')
anchor = '  assert.match(panel,/현재 흐름/)\n'
addition = '  assert.match(panel,/앞으로의 후보 시기/)\n  assert.match(panel,/연락 ≠ 재회/)\n  assert.match(panel,/재구축 조건/)\n  assert.match(panel,/근거 보기 · 계산\\/정밀도/)\n  assert.match(panel,/실제 메시지·답장·만남·관계 변화 기록과 비교하는 개인 사후 확인용/)\n  assert.match(panel,/연락 한 번이나 답장 하나만으로 재회를 판정하지 않아/)\n  assert.match(panel,/hidden=\\{reunion && !!hierarchyData\\}/)\n'
if addition not in test:
    if anchor not in test:
        raise SystemExit('test anchor missing')
    test = test.replace(anchor, anchor + addition, 1)
test_path.write_text(test, encoding='utf-8')
