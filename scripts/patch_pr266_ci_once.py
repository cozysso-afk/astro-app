from pathlib import Path

cost = Path('supabase/functions/fortune-interpret-v21-preview/costGuardV21.ts')
s = cost.read_text(encoding='utf-8')

old = '''  }else if(data?.clusters&&typeof data.clusters==="object")data.clusters.investment="투자 관련 점수는 심리·행동의 상대활성도 참고값이야. 가격방향·수익률·매매시점을 뜻하지 않으므로 실제 시장 데이터와 손익·리스크 기준을 우선해.";
  if(Array.isArray(data?.priorities))data.priorities=uniq(data.priorities.map((value:any)=>{'''
new = '''  }else if(data?.clusters&&typeof data.clusters==="object")data.clusters.investment="투자 관련 점수는 심리·행동의 상대활성도 참고값이야. 가격방향·수익률·매매시점을 뜻하지 않으므로 실제 시장 데이터와 손익·리스크 기준을 우선해.";
  if(data?.investment_reading&&typeof data.investment_reading==="object"){
    const ir=data.investment_reading;
    const unsafeMarketClaim=/(?:수익에?\\s*(?:유리|좋|높|가능)|수익\\s*(?:가능|확정|보장)|매수|매도|현금화|보유\\s*유지|매매\\s*(?:신호|적기|시점)|진입\\s*(?:적기|시기)|가격\\s*(?:상승|하락)|오를|내릴)/;
    if(unsafeMarketClaim.test(String(ir?.realization??"")))ir.realization="수익실현 상대활성도는 심리·행동 참고값이야. 실제 수익 가능성이나 매도 적기를 뜻하지 않으므로 보유 종목의 시장 데이터와 손익 기준을 우선해.";
    if(unsafeMarketClaim.test(String(ir?.entry??"")))ir.entry="신규진입 상대활성도는 심리·행동 참고값이야. 매수 신호가 아니며 실제 밸류에이션·가격·거래량과 본인 위험 한도를 먼저 확인해.";
  }
  if(Array.isArray(data?.priorities))data.priorities=uniq(data.priorities.map((value:any)=>{'''
assert old in s, 'investment insertion anchor not found'
s = s.replace(old, new, 1)

old = '''    rr.context=String(rr?.context??"").trim()||`관계 계산은 상대 → 나 ${scoreText(axes[0].avg)}점, 나 → 상대 ${scoreText(axes[1].avg)}점, 과거 인연 재접점 ${scoreText(axes[2].avg)}점을 서로 다른 축으로 분리해 읽어.`;
    rr.flow=String(rr?.flow??"").trim()||`${compare} 상대 → 나, 나 → 상대, 재접점은 의미가 서로 다르므로 한 축의 상승을 다른 축의 결과로 옮겨 읽지 마.`;
    const timingParts=axes.filter((a:any)=>a.best).map((a:any)=>`${a.label} ${a.best}`);
    rr.focus_timing=String(rr?.focus_timing??"").trim()||(timingParts.length?(singleDay?"선택한 날에 세 방향의 직접 계산근거가 연결돼 있어. 실제 답변·약속·만남 제안이 뒤따르는지 확인해.":`${timingParts.join(" · ")}. 각 날짜는 해당 방향의 직접 계산상 두드러지는 시기이며 관계 결과 자체를 뜻하지 않아.`):`${singleDay?"이날":"직접 관계 날짜 근거가 있는 구간에서"} 실제 답변·약속·만남 제안이 뒤따르는지 확인해.`);'''
new = '''    const hasRelationshipAxes=(value:any)=>{const text=String(value??"").trim();return ["상대 → 나","나 → 상대","과거 인연 재접점"].every(label=>text.includes(label));};
    const authoredContext=String(rr?.context??"").trim(),authoredFlow=String(rr?.flow??"").trim();
    rr.context=hasRelationshipAxes(authoredContext)?authoredContext:`관계 계산은 상대 → 나 ${scoreText(axes[0].avg)}점, 나 → 상대 ${scoreText(axes[1].avg)}점, 과거 인연 재접점 ${scoreText(axes[2].avg)}점을 서로 다른 축으로 분리해 읽어.`;
    rr.flow=hasRelationshipAxes(authoredFlow)?authoredFlow:`${compare} 상대 → 나, 나 → 상대, 과거 인연 재접점은 의미가 서로 다르므로 한 축의 상승을 다른 축의 결과로 옮겨 읽지 마.`;
    const timingParts=axes.filter((a:any)=>a.best).map((a:any)=>`${a.label} ${a.best}`);
    const groundedTimingDates=new Set(axes.flatMap((axis:any)=>[axis.best,axis.caution]).filter(Boolean));
    const authoredTiming=String(rr?.focus_timing??"").trim();
    const authoredDates=[...authoredTiming.matchAll(/\\b\\d{4}-\\d{2}-\\d{2}\\b/g)].map(match=>match[0]);
    const authoredTimingGrounded=authoredTiming.length>=12&&authoredDates.length>0&&authoredDates.every(date=>groundedTimingDates.has(date));
    rr.focus_timing=authoredTimingGrounded?authoredTiming:(timingParts.length?(singleDay?"선택한 날에 세 방향의 직접 계산근거가 연결돼 있어. 실제 답변·약속·만남 제안이 뒤따르는지 확인해.":`${timingParts.join(" · ")}. 각 날짜는 해당 방향의 직접 계산상 두드러지는 시기이며 관계 결과 자체를 뜻하지 않아.`):`${singleDay?"이날":"직접 관계 날짜 근거가 있는 구간에서"} 실제 답변·약속·만남 제안이 뒤따르는지 확인해.`);'''
assert old in s, 'relationship metadata anchor not found'
s = s.replace(old, new, 1)

old = '''    const authoredContact=data?.contact_flow&&typeof data.contact_flow==="object"?data.contact_flow:{};
    data.contact_flow={
      incoming:String(authoredContact?.incoming??"").trim()||axisText(axes[0],"이 축은 상대가 실제로 보이는 반응을 확인하는 용도라서 답변·먼저 온 연락·구체적 만남 제안과 함께 봐."),
      outgoing:String(authoredContact?.outgoing??"").trim()||axisText(axes[1],"이 축은 내가 먼저 연락하거나 제안할 때의 상대적 적합도를 보는 값이지, 상대가 받아준다는 뜻은 아니야."),
      reconnection:String(authoredContact?.reconnection??"").trim()||axisText(axes[2],"이 축은 과거 인연의 재접점 활성도를 보는 값이지, 재회나 관계 재성립을 확정하지 않아."),
    };'''
new = '''    const authoredContact=data?.contact_flow&&typeof data.contact_flow==="object"?data.contact_flow:{};
    const axisCopy=(value:any,pattern:RegExp,fallback:string)=>{const text=String(value??"").trim();return text.length>=16&&pattern.test(text)?text:fallback;};
    data.contact_flow={
      incoming:axisCopy(authoredContact?.incoming,/(?:상대|수신|답변|먼저 온 연락|반응)/,axisText(axes[0],"이 축은 상대가 실제로 보이는 반응을 확인하는 용도라서 답변·먼저 온 연락·구체적 만남 제안과 함께 봐.")),
      outgoing:axisCopy(authoredContact?.outgoing,/(?:내가|발신|먼저 연락|보낸|제안)/,axisText(axes[1],"이 축은 내가 먼저 연락하거나 제안할 때의 상대적 적합도를 보는 값이지, 상대가 받아준다는 뜻은 아니야.")),
      reconnection:axisCopy(authoredContact?.reconnection,/(?:과거|재접점|재회|다시 이어)/,axisText(axes[2],"이 축은 과거 인연의 재접점 활성도를 보는 값이지, 재회나 관계 재성립을 확정하지 않아.")),
    };'''
assert old in s, 'contact flow anchor not found'
s = s.replace(old, new, 1)
cost.write_text(s, encoding='utf-8')

test = Path('supabase/functions/fortune-interpret-v21-preview/costGuardV21.test.mjs')
t = test.read_text(encoding='utf-8')
t = t.replace("test('V21 local stabilizer repairs evidence links and minimum prose without Gemini',()=>{", "test('V21 local stabilizer repairs evidence links without padding authored prose',()=>{", 1)
old = '''  assert.ok(fixed.overall.summary.length>=240);
  assert.ok(fixed.overall.evidence_refs.length>=3);
  assert.ok(fixed.key_windows[0].evidence_refs.some(ref=>ref.startsWith('W:daily:2027-04-11:직장')));
  assert.ok(fixed.key_windows[0].summary.length>=45);
  assert.ok(fixed.decisions[0].evidence_refs.some(ref=>fixed.key_windows[0].evidence_refs.includes(ref)));
  assert.ok(fixed.decisions[0].watch.length>=14);'''
new = '''  assert.equal(fixed.overall.summary,'짧은 총평');
  assert.ok(fixed.overall.evidence_refs.length>=3);
  assert.ok(fixed.key_windows[0].evidence_refs.some(ref=>ref.startsWith('W:daily:2027-04-11:직장')));
  assert.equal(fixed.key_windows[0].summary,'짧음');
  assert.ok(fixed.decisions[0].evidence_refs.some(ref=>fixed.key_windows[0].evidence_refs.includes(ref)));
  assert.equal(fixed.decisions[0].watch,'짧음');'''
assert old in t, 'stabilizer test anchor not found'
t = t.replace(old, new, 1)
test.write_text(t, encoding='utf-8')

# trigger
