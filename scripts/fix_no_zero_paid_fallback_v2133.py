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

test='supabase/functions/fortune-interpret-v21-preview/costGuardV21.test.mjs'
rep(test, "assert.match(src,/supabase-ai-v21\\.3\\.2-relationship-direction-depth/);", "assert.match(src,/supabase-ai-v21\\.3\\.3-no-zero-paid-fallback/);", 'runtime version assertion')
rep(test, "assert.equal(rows.find(x=>x.topic==='연애').timing,'2026-11-19');", "assert.equal(rows.find(x=>x.topic==='연애').timing,'2027-04-11');", 'evidence-backed timing assertion')

print('V21.3.3 follow-up timing fix applied')
