from pathlib import Path

cost_path = Path('supabase/functions/fortune-interpret-v21-preview/costGuardV21.ts')
s = cost_path.read_text(encoding='utf-8')

old_rel = '''    const relEvidenceDates=(key:string)=>new Set(relRows.filter((row:any)=>String(row?.topic??"")===key).flatMap((row:any)=>[row?.date,row?.start,row?.end]).map((value:any)=>String(value??"").slice(0,10)).filter((value:string)=>/^\\d{4}-\\d{2}-\\d{2}$/.test(value)));
'''
new_rel = '''    const relEvidenceDates=(key:string)=>new Set(relRows.filter((row:any)=>String(row?.topic??"")===key).map((row:any)=>iso(row?.date)).filter(Boolean));
'''
if s.count(old_rel) != 1:
    raise SystemExit(f'relEvidenceDates anchor count={s.count(old_rel)}')
s = s.replace(old_rel, new_rel, 1)

old_rr = '''    for(const axis of axes){
      for(const date of [axis.best,axis.caution].filter(Boolean)){
        linked=uniq([...linked,...relRows.filter((row:any)=>iso(row?.date)===date).map((row:any)=>String(row.id))]);
      }
    }
    rr.evidence_refs=linked.slice(0,10);
'''
new_rr = '''    const timingDirectRefs=axes.flatMap((axis:any)=>[axis.best,axis.caution].filter(Boolean).flatMap((date:string)=>relRows.filter((row:any)=>iso(row?.date)===date).map((row:any)=>String(row.id))));
    linked=uniq([...timingDirectRefs,...linked]);
    rr.evidence_refs=linked.slice(0,10);
'''
if s.count(old_rr) != 1:
    raise SystemExit(f'relationship exact-ref anchor count={s.count(old_rr)}')
s = s.replace(old_rr, new_rr, 1)

old_timeline = '''  const timeline=Array.isArray(payload?.cross_system_timeline)?payload.cross_system_timeline:[];const timelineFor=(start:string,end:string)=>timeline.find((x:any)=>{const d=iso(x?.date);return d&&start&&end&&start<=d&&d<=end;});
  const enrichCross=(x:any)=>{const out={...x};const start=iso(out?.start),end=iso(out?.end)||start,t=timelineFor(start,end);let linked=valid(out?.evidence_refs);if(t)linked=uniq([...linked,...valid(t?.western_refs),...valid(t?.saju_context_refs),...valid(t?.thai_context_refs)]);const linkedRows=linked.map(ref=>map.get(ref)).filter(Boolean),systems=new Set(linkedRows.map((r:any)=>String(r?.system??"")));out.evidence_refs=linked.slice(0,8);out.mode=systems.has("western")&&systems.size>=2?(out?.mode==="상반맥락"?"상반맥락":"복수체계"):"Western단독";const western=linkedRows.filter((r:any)=>r?.system==="western").map((r:any)=>String(r?.text??"")).filter(Boolean).slice(0,2).join(" "),saju=linkedRows.filter((r:any)=>r?.system==="saju").map((r:any)=>String(r?.text??"")).filter(Boolean).slice(0,2).join(" "),thai=linkedRows.filter((r:any)=>r?.system==="thai").map((r:any)=>String(r?.text??"")).filter(Boolean).slice(0,2).join(" ");out.western=ensureMinText(out?.western,25,western||"Western 계산은 해당 시기의 상대활성도 변화를 직접 추적해.");out.saju=String(out?.saju??"").trim()||(saju?`${saju} 사주는 Western 점수에 합산하지 않고 독립 맥락으로만 참고해.`:"");out.thai=String(out?.thai??"").trim()||(thai?`${thai} Thai는 위치·기간 맥락만 독립적으로 참고해.`:"");const others=[out.saju,out.thai].filter(Boolean).join(" ");const otherNames=[out.saju?"사주":"",out.thai?"Thai":""].filter(Boolean).join("·");out.synthesis=out.mode==="Western단독"?"다른 체계의 독립 근거가 충분하지 않아 Western 직접 계산을 중심으로 보고, 실제 변화가 나타나는지 확인해.":out.mode==="상반맥락"?`Western 직접 시기 근거와 ${otherNames||"비Western"}의 독립 맥락이 같은 기간에 서로 다르게 나타나는지 비교해. 서로 점수나 인과를 합산하지 말고 실제 관찰에서 어느 맥락이 더 두드러지는지만 확인해.`:`Western 직접 시기 근거와 ${otherNames||"비Western"}의 독립 맥락이 같은 기간에 함께 나타나는지 비교해. 서로 점수나 인과를 합산하지 말고 실제 변화가 각 체계의 맥락과 동시에 관찰되는지만 확인해.`;return out;};
'''
new_timeline = '''  const timeline=Array.isArray(payload?.cross_system_timeline)?payload.cross_system_timeline:[];const timelineFor=(start:string,end:string)=>timeline.find((x:any)=>{const d=iso(x?.date);return d&&start&&end&&start<=d&&d<=end;});
  const balanceCrossRefs=(values:string[])=>{const linked=uniq(values.filter(ref=>map.has(ref)));const firstFor=(system:string)=>linked.find(ref=>String(map.get(ref)?.system??"")===system);return uniq([firstFor("western"),firstFor("saju"),firstFor("thai"),...linked].filter(Boolean) as string[]).slice(0,8);};
  const enrichCross=(x:any)=>{const out={...x};const start=iso(out?.start),end=iso(out?.end)||start,t=timelineFor(start,end);let linked=valid(out?.evidence_refs);if(t)linked=uniq([...linked,...valid(t?.western_refs),...valid(t?.saju_context_refs),...valid(t?.thai_context_refs)]);if(start&&!linked.some(ref=>String(map.get(ref)?.system??"")==="western")){linked=uniq([...linked,...refsForDate(start,[]).filter(ref=>String(map.get(ref)?.system??"")==="western").slice(0,1)]);}linked=balanceCrossRefs(linked);const linkedRows=linked.map(ref=>map.get(ref)).filter(Boolean),systems=new Set(linkedRows.map((r:any)=>String(r?.system??"")));out.evidence_refs=linked;out.mode=systems.has("western")&&systems.size>=2?(out?.mode==="상반맥락"?"상반맥락":"복수체계"):"Western단독";const western=linkedRows.filter((r:any)=>r?.system==="western").map((r:any)=>String(r?.text??"")).filter(Boolean).slice(0,2).join(" "),saju=linkedRows.filter((r:any)=>r?.system==="saju").map((r:any)=>String(r?.text??"")).filter(Boolean).slice(0,2).join(" "),thai=linkedRows.filter((r:any)=>r?.system==="thai").map((r:any)=>String(r?.text??"")).filter(Boolean).slice(0,2).join(" ");out.western=ensureMinText(western?out?.western:"",25,western||"Western 계산은 해당 시기의 상대활성도 변화를 직접 추적해.");out.saju=saju?ensureMinText(out?.saju,25,`${saju} 사주는 Western 점수에 합산하지 않고 독립 맥락으로만 참고해.`):"";out.thai=thai?ensureMinText(out?.thai,25,`${thai} Thai는 위치·기간 맥락만 독립적으로 참고해.`):"";const otherNames=[out.saju?"사주":"",out.thai?"Thai":""].filter(Boolean).join("·");out.synthesis=out.mode==="Western단독"?"다른 체계의 독립 근거가 충분하지 않아 Western 직접 계산을 중심으로 보고, 실제 변화가 나타나는지 확인해.":out.mode==="상반맥락"?`Western 직접 시기 근거와 ${otherNames||"비Western"}의 독립 맥락이 같은 기간에 서로 다르게 나타나는지 비교해. 서로 점수나 인과를 합산하지 말고 실제 관찰에서 어느 맥락이 더 두드러지는지만 확인해.`:`Western 직접 시기 근거와 ${otherNames||"비Western"}의 독립 맥락이 같은 기간에 함께 나타나는지 비교해. 서로 점수나 인과를 합산하지 말고 실제 변화가 각 체계의 맥락과 동시에 관찰되는지만 확인해.`;return out;};
'''
if s.count(old_timeline) != 1:
    raise SystemExit(f'cross enrich anchor count={s.count(old_timeline)}')
s = s.replace(old_timeline, new_timeline, 1)
cost_path.write_text(s, encoding='utf-8')

test_path = Path('supabase/functions/fortune-interpret-v21-preview/costGuardV21.test.mjs')
t = test_path.read_text(encoding='utf-8')
if 'V11.1 exact relationship timing refs survive the final evidence cap' in t:
    raise SystemExit('V11.1 tests already present')

t += r'''

test('V11.1 exact relationship timing refs survive the final evidence cap',()=>{
  const p=packet();
  for(const topic of ['연애','연락','재회']){
    p.western.overall[topic].average=96;
    p.western.overall[topic].spread=70;
    p.western.daily_pattern_digest[topic].volatility=48;
  }
  const dates={수신신호:'2027-06-12',발신적합:'2027-04-19',과거인연접점:'2027-07-03'};
  for(const [key,date] of Object.entries(dates)){
    p.western.relationship_signals[key]={average:key==='수신신호'?82:key==='발신적합'?71:76,band:'강함',spread:32,best_days:[{date,score:88}],caution_days:[]};
  }
  for(let i=0;i<12;i++){
    p.evidence_ledger.push({id:`W:daily:noise:${i}`,system:'western',scope:'daily_actual',topic:'수신신호',direction:'supportive',date:`2027-03-${String(i+1).padStart(2,'0')}`,score:60+i,text:`관계 잡음 직접 근거 ${i}`});
  }
  for(const [key,date] of Object.entries(dates)){
    p.evidence_ledger.push({id:`W:date:${date}:${key}:v11-1`,system:'western',scope:'relationship_best_day',topic:key,direction:'supportive',date,score:88,text:`${key} ${date} 직접 날짜 근거`});
  }
  const fixed=stabilizeCoreForQuality(buildLocalQualityFallbackCore(p),p);
  const validated=validateOutput(fixed);
  assert.ok(validated);
  const report=inspectInterpretationQuality(validated,p);
  for(const stage of [1,2,3,4]){
    const row=report.stages.find(x=>x.stage===stage);
    assert.equal(row?.passed,true,`critical stage ${stage} failed: ${(row?.issues??[]).join(' / ')}`);
  }
  const refs=new Set(validated.relationship_reading.evidence_refs);
  for(const date of Object.values(dates)){
    assert.match(validated.relationship_reading.focus_timing,new RegExp(date));
    const direct=p.evidence_ledger.find(row=>refs.has(row.id)&&row.date===date);
    assert.ok(direct,`focus_timing date ${date} must keep an exact direct evidence ref inside the final capped list`);
  }
});

test('V11.1 cross-check mode is derived from the final capped evidence refs',()=>{
  const p=packet();
  const date='2027-04-11';
  const westernRefs=[];
  for(let i=0;i<12;i++){
    const id=`W:cross:${i}`;
    westernRefs.push(id);
    p.evidence_ledger.push({id,system:'western',scope:'daily_actual',topic:'직장',direction:'supportive',date,score:60+i,text:`Western 교차 잡음 ${i}`});
  }
  const saju='S:cross:v11-1',thai='T:cross:v11-1';
  p.evidence_ledger.push({id:saju,system:'saju',scope:'annual_segment',direction:'context',start:'2027-01-01',end:'2028-01-01',text:'사주 교차 직접 맥락'});
  p.evidence_ledger.push({id:thai,system:'thai',scope:'taksajorn_context',direction:'context',start:'2027-01-01',end:'2027-12-31',text:'Thai 교차 직접 맥락'});
  p.cross_system_timeline=[{date,western_refs:westernRefs,saju_context_refs:[saju],thai_context_refs:[thai]}];
  const core=buildLocalQualityFallbackCore(p);
  core.cross_checks=[{label:`${date} 체계 교차확인`,start:date,end:date,mode:'복수체계',western:'',saju:'',thai:'',synthesis:'',evidence_refs:westernRefs}];
  const fixed=stabilizeCoreForQuality(core,p);
  const x=fixed.cross_checks[0];
  const systems=new Set(x.evidence_refs.map(ref=>p.evidence_ledger.find(row=>row.id===ref)?.system).filter(Boolean));
  assert.ok(x.evidence_refs.length<=8);
  assert.equal(x.mode,'복수체계');
  assert.ok(systems.has('western'));
  assert.ok(systems.has('saju'));
  assert.ok(systems.has('thai'));
  assert.ok(x.saju.length>0);
  assert.ok(x.thai.length>0);
  const validated=validateOutput(fixed);
  assert.ok(validated);
  const report=inspectInterpretationQuality(validated,p);
  const stage4=report.stages.find(row=>row.stage===4);
  assert.equal(stage4?.passed,true,`stage 4 failed: ${(stage4?.issues??[]).join(' / ')}`);
});
'''

test_path.write_text(t, encoding='utf-8')
print('V11.1 fallback contract patch applied')
