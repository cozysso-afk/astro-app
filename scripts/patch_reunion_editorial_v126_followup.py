from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def read(p): return (ROOT/p).read_text()
def write(p,s): (ROOT/p).write_text(s)
def replace1(s,old,new,label):
    if old not in s: raise SystemExit(f'missing target: {label}')
    return s.replace(old,new,1)

# The human-facing story now lives in ReunionHierarchyPanel, not its host wrapper.
p=Path('web/src/lib/humanLanguageV25.test.mjs')
s=read(p)
s=s.replace("const panel=readFileSync(new URL('../RelationshipInterpretationPanel.tsx',import.meta.url),'utf8')","const panel=readFileSync(new URL('../ReunionHierarchyPanel.tsx',import.meta.url),'utf8')")
s=s.replace("panel.indexOf('오늘 이후 후보 시기')","panel.indexOf('앞으로의 후보 시기')")
s=s.replace("assert.match(panel,/오늘 이후 후보 시기/)","assert.match(panel,/앞으로의 후보 시기/)")
s=s.replace("assert.match(panel,/단계별 활성도 · 보조지표/)","assert.match(panel,/reunion-stage-status/)")
s=s.replace("assert.match(panel,/현재 감정 세기나 사건 확률이 아니라/)","assert.match(panel,/사건 확률이나 현재 감정 세기가 아니라/)")
write(p,s)

# Add an explicit convergence story when multiple systems actually converge.
p=Path('web/src/ReunionHierarchyPanel.tsx')
s=read(p)
old="""  const repeatStory = reunionV2?.repeat_risks?.conclusion
    ? `${reunionV2.repeat_risks.conclusion}${reunionV2.repeat_risks.patterns?.length ? ` ${reunionV2.repeat_risks.patterns.join(' ')}` : ''}`
    : '다시 연락이 닿더라도 예전과 같은 방식으로 대화가 끊기거나 약속이 흐려진다면 연락 단계에서 다시 멈출 수 있어. 재접촉 자체보다 연락 뒤의 대화 지속, 약속 제안, 실제 만남, 문제를 다루는 방식이 달라지는지를 확인해야 해.'

  return <section"""
new="""  const repeatStory = reunionV2?.repeat_risks?.conclusion
    ? `${reunionV2.repeat_risks.conclusion}${reunionV2.repeat_risks.patterns?.length ? ` ${reunionV2.repeat_risks.patterns.join(' ')}` : ''}`
    : '다시 연락이 닿더라도 예전과 같은 방식으로 대화가 끊기거나 약속이 흐려진다면 연락 단계에서 다시 멈출 수 있어. 재접촉 자체보다 연락 뒤의 대화 지속, 약속 제안, 실제 만남, 문제를 다루는 방식이 달라지는지를 확인해야 해.'
  const convergenceStory = reunionV2?.convergence?.length
    ? reunionV2.convergence.slice(0,3).map((row)=>`${row.theme}${row.period ? `(${row.period})` : ''}: ${row.meaning}`).join(' ')
    : '서로 다른 계산층이 같은 단계와 시기를 함께 가리킬 때만 수렴 근거로 올려. 한 체계의 강한 신호 하나만으로 연락·만남·재구축을 다음 단계로 올리지 않아.'

  return <section"""
s=replace1(s,old,new,'convergence story value')
old="""        <section className=\"reunion-story-section reunion-story-repeat\"><h4>다시 멀어질 수 있는 지점</h4><p>{repeatStory}</p></section>
      </div>"""
new="""        <section className=\"reunion-story-section reunion-story-repeat\"><h4>다시 멀어질 수 있는 지점</h4><p>{repeatStory}</p></section>
        <section className=\"reunion-story-section reunion-story-convergence\"><h4>여러 근거가 같이 가리키는 부분</h4><p>{convergenceStory}</p></section>
      </div>"""
s=replace1(s,old,new,'convergence story markup')
write(p,s)

print('reunion editorial v12.6 follow-up applied')
