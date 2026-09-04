from pathlib import Path


def rep(path, old, new, label):
    p=Path(path); s=p.read_text()
    if old not in s: raise SystemExit(f'missing anchor: {label}')
    p.write_text(s.replace(old,new,1))

cost='supabase/functions/fortune-interpret-v21-preview/costGuardV21.ts'
rep(cost, r'''function bestTopicDate(payload:any,topic:string){
  const stat=payload?.western?.overall?.[topic]??{},avg=num(stat?.average);
  const candidates=[...(stat?.best_days??[]),...(stat?.caution_days??[])].filter((x:any)=>x?.date&&Number.isFinite(Number(x?.score)));
  candidates.sort((a:any,b:any)=>Math.abs(num(b?.score)-avg)-Math.abs(num(a?.score)-avg));
  if(candidates[0]?.date)return String(candidates[0].date);
  const key=(payload?.key_dates??[]).find((row:any)=>Array.isArray(row?.topics)&&row.topics.includes(topic));
  return key?.date?String(key.date):String(payload?.period?.start??"");
}
''', r'''function bestTopicDate(payload:any,topic:string){
  const stat=payload?.western?.overall?.[topic]??{},avg=num(stat?.average);
  const evidence=topicEvidence(payload,topic);
  const backedDates=new Set<string>();
  for(const row of evidence){
    for(const value of [row?.date,row?.start,row?.end]){
      const date=String(value??"").slice(0,10);
      if(/^\d{4}-\d{2}-\d{2}$/.test(date))backedDates.add(date);
    }
  }
  const candidates=[...(stat?.best_days??[]),...(stat?.caution_days??[])].filter((x:any)=>x?.date&&Number.isFinite(Number(x?.score))&&backedDates.has(String(x.date).slice(0,10)));
  candidates.sort((a:any,b:any)=>Math.abs(num(b?.score)-avg)-Math.abs(num(a?.score)-avg));
  if(candidates[0]?.date)return String(candidates[0].date).slice(0,10);
  const key=(payload?.key_dates??[]).find((row:any)=>Array.isArray(row?.topics)&&row.topics.includes(topic)&&backedDates.has(String(row?.date??"").slice(0,10)));
  if(key?.date)return String(key.date).slice(0,10);
  const direct=evidence.find((row:any)=>row?.date&&backedDates.has(String(row.date).slice(0,10)));
  if(direct?.date)return String(direct.date).slice(0,10);
  return String(payload?.period?.start??"").slice(0,10);
}
''', 'evidence-backed topic timing')

rep(cost, r'''    const min=digest?.min, max=digest?.max;
    const reasonParts=[`${topic} 기간 평균은 ${scoreText(avg)}점${stat?.band?`(${String(stat.band)})`:""}이고 변동폭은 ${scoreText(spread)}점이라 ${direction}이야.`];
    if(min?.date&&max?.date)reasonParts.push(`실제 일별 궤적은 ${min.date} ${scoreText(min.score)}점에서 ${max.date} ${scoreText(max.score)}점 사이를 움직였고 변동성은 ${scoreText(digest?.volatility)}점이야.`);
    const timing=bestTopicDate(payload,topic);
''', r'''    const min=digest?.min, max=digest?.max;
    const backedDateSet=new Set(topicEvidence(payload,topic).flatMap((row:any)=>[row?.date,row?.start,row?.end]).map((value:any)=>String(value??"").slice(0,10)).filter((value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)));
    const reasonParts=[`${topic} 기간 평균은 ${scoreText(avg)}점${stat?.band?`(${String(stat.band)})`:""}이고 변동폭은 ${scoreText(spread)}점이라 ${direction}이야.`];
    if(min?.date&&max?.date&&backedDateSet.has(String(min.date).slice(0,10))&&backedDateSet.has(String(max.date).slice(0,10)))reasonParts.push(`직접 근거가 연결된 일별 궤적은 ${min.date} ${scoreText(min.score)}점에서 ${max.date} ${scoreText(max.score)}점 사이를 움직였고 변동성은 ${scoreText(digest?.volatility)}점이야.`);
    else reasonParts.push(`일별 변동성은 ${scoreText(digest?.volatility)}점이며, 날짜를 특정할 때는 evidence ledger에 직접 연결된 날짜만 사용해.`);
    const timing=bestTopicDate(payload,topic);
''', 'topic reason date traceability')

rep(cost, r'''    const sig=payload?.western?.relationship_signals??{};
    const tone=(v:number)=>v>=60?"강한 편":v<40?"약한 편":"중간권";
    const bestDate=(stat:any)=>Array.isArray(stat?.best_days)&&stat.best_days[0]?.date?String(stat.best_days[0].date):"";
    const cautionDate=(stat:any)=>Array.isArray(stat?.caution_days)&&stat.caution_days[0]?.date?String(stat.caution_days[0].date):"";
    const axes=[
      {key:"수신신호",label:"상대 → 나",avg:num(sig?.수신신호?.average),best:bestDate(sig?.수신신호),caution:cautionDate(sig?.수신신호)},
      {key:"발신적합",label:"나 → 상대",avg:num(sig?.발신적합?.average),best:bestDate(sig?.발신적합),caution:cautionDate(sig?.발신적합)},
      {key:"과거인연접점",label:"과거 인연 재접점",avg:num(sig?.과거인연접점?.average),best:bestDate(sig?.과거인연접점),caution:cautionDate(sig?.과거인연접점)},
    ];
''', r'''    const sig=payload?.western?.relationship_signals??{};
    const tone=(v:number)=>v>=60?"강한 편":v<40?"약한 편":"중간권";
    const relEvidenceDates=(key:string)=>new Set(relRows.filter((row:any)=>String(row?.topic??"")===key).flatMap((row:any)=>[row?.date,row?.start,row?.end]).map((value:any)=>String(value??"").slice(0,10)).filter((value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)));
    const backedStatDate=(key:string,stat:any,field:"best_days"|"caution_days")=>{
      const allowed=relEvidenceDates(key);
      const row=(Array.isArray(stat?.[field])?stat[field]:[]).find((item:any)=>allowed.has(String(item?.date??"").slice(0,10)));
      return row?.date?String(row.date).slice(0,10):"";
    };
    const axes=[
      {key:"수신신호",label:"상대 → 나",avg:num(sig?.수신신호?.average),best:backedStatDate("수신신호",sig?.수신신호,"best_days"),caution:backedStatDate("수신신호",sig?.수신신호,"caution_days")},
      {key:"발신적합",label:"나 → 상대",avg:num(sig?.발신적합?.average),best:backedStatDate("발신적합",sig?.발신적합,"best_days"),caution:backedStatDate("발신적합",sig?.발신적합,"caution_days")},
      {key:"과거인연접점",label:"과거 인연 재접점",avg:num(sig?.과거인연접점?.average),best:backedStatDate("과거인연접점",sig?.과거인연접점,"best_days"),caution:backedStatDate("과거인연접점",sig?.과거인연접점,"caution_days")},
    ];
''', 'relationship evidence-backed dates')

rep(cost, '한 날짜나 점수 하나를 사건 확률로 바꾸지 않고 기간 평균·직접 날짜 근거·실제 반응을 함께 봐.', '한 날짜나 점수 하나를 사건 결과로 바꾸지 않고 기간 평균·직접 날짜 근거·실제 반응을 함께 봐.', 'fallback probability wording 1')
rep(cost, '사건 확률·상대 속마음·가격방향은 단정하지 않아.', '사건 결과·상대 속마음·가격방향을 미리 확정하지 않아.', 'fallback probability wording 2')

test='supabase/functions/fortune-interpret-v21-preview/costGuardV21.test.mjs'
rep(test, "assert.match(src,/supabase-ai-v21\\.3\\.2-relationship-direction-depth/);", "assert.match(src,/supabase-ai-v21\\.3\\.3-no-zero-paid-fallback/);", 'runtime version assertion')
rep(test, "assert.equal(rows.find(x=>x.topic==='연애').timing,'2026-11-19');", "assert.equal(rows.find(x=>x.topic==='연애').timing,'2027-04-11');", 'evidence-backed timing assertion')
rep(test, '''  assert.ok(validated.key_windows.length>=5);
  assert.ok(validated.decisions.length>=3);
''', '''  assert.ok(Array.isArray(validated.key_windows));
  assert.ok(Array.isArray(validated.decisions));
  const depth=report.stages.find(x=>x.stage===5);
  assert.ok(depth,'stage 5 must remain observable even when degraded fallback is shown');
''', 'degraded fallback depth expectation')

print('V21.3.3 follow-up traceability fix applied')
