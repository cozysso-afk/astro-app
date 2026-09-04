from pathlib import Path

p = Path('supabase/functions/relationship-interpret-v9-preview/index.ts')
s = p.read_text()

s = s.replace('VERSION="relationship-v11.0-mode-split-cost-guard"', 'VERSION="relationship-v11.1-adaptive-prompt-pack"')

start = s.index('function compact(calc:any,ctx:any){')
end = s.index('\n\nconst SYSTEM=`', start)
new_compact = r'''function aspectList(v:any,n:number){return (Array.isArray(v)?v:[]).map(aspect).filter(Boolean).sort((a:any,b:any)=>a.orb-b.orb).slice(0,n);}
function focusPacket(f:any,n:number){const keys=["core_identity_emotion","attraction_romance","sexual_intimacy","communication","stability_commitment","conflict_reactivity","idealization_confusion","power_attachment","freedom_unpredictability","home_marriage"];return Object.fromEntries(keys.map(k=>[k,aspectList(f?.[k],n)]));}
function houseRows(v:any,n:number){return (Array.isArray(v)?v:[]).slice(0,n).map((x:any)=>({planet:String(x?.planet??""),whole_house:x?.whole_house??null,placidus_house:x?.placidus_house??x?.house??null}));}
function housePacket(h:any,n:number){if(!h||typeof h!=="object")return null;if(!h.available)return {available:false,precision_note:h?.precision_note??""};return {available:true,precision_note:h?.precision_note??"",user_in_counterpart:{relationship_houses:houseRows(h?.user_in_counterpart?.relationship_houses,n)},counterpart_in_user:{relationship_houses:houseRows(h?.counterpart_in_user?.relationship_houses,n)}};}
function sajuPerson(x:any){if(!x||typeof x!=="object")return null;return {year:x?.year??null,month:x?.month??null,day:x?.day??null,hour:x?.hour??null,day_stem:x?.day_stem??null,day_branch:x?.day_branch??null,precision:x?.precision??null,time_known:Boolean(x?.time_known)};}
function sajuPacket(x:any,n:number){if(!x||typeof x!=="object")return null;if(!x.available)return {available:false,error:x?.error??""};return {available:true,policy:x?.policy??"",user:sajuPerson(x?.user),counterpart:sajuPerson(x?.counterpart),day_master_relation:x?.day_master_relation??null,spouse_palace:x?.spouse_palace??null,cross_branch_links:Array.isArray(x?.cross_branch_links)?x.cross_branch_links.slice(0,n):[],limitations:Array.isArray(x?.limitations)?x.limitations.slice(0,6):[]};}
function compactSignal(s:any,n:number){if(!s||typeof s!=="object")return null;return {exact_contacts:Number(s?.exact_contacts??0),supportive_contacts:Number(s?.supportive_contacts??0),challenging_contacts:Number(s?.challenging_contacts??0),tightest:aspectList(s?.tightest,n)};}
const CORE_PLANETS=["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto","True Node","ASC","MC"];
function chartCore(c:any,n:number){if(!c||typeof c!=="object")return null;const pos=c?.positions??{};const keys=CORE_PLANETS.filter(k=>pos?.[k]).slice(0,n);return {positions:Object.fromEntries(keys.map(k=>{const v=pos[k]??{};return [k,{lon:Number(v?.lon??v?.longitude??v?.longitude_deg??0),sign:v?.sign??v?.sign_ko??null,house:v?.house??null}]})),angles:c?.angles?{ASC:c.angles?.ASC??null,MC:c.angles?.MC??null,IC:c.angles?.IC??null,DSC:c.angles?.DSC??null}:null};}
function advancedPacket(x:any,n:number){if(!x||typeof x!=="object")return null;if(!x.available)return {available:false,reason:x?.reason??""};return {available:true,reason:x?.reason??"",method:x?.method??null,chart:chartCore(x?.chart,n),user:chartCore(x?.user,n),counterpart:chartCore(x?.counterpart,n)};}
function transitHit(x:any){if(!x||typeof x!=="object")return null;return {person:x?.person??null,transit:x?.transit??null,aspect:x?.aspect??null,target:x?.target??null,orb:Number(x?.orb??0),tone:x?.tone??null,score:Number(x?.score??0)};}
function transitDay(x:any,n:number){if(!x||typeof x!=="object")return null;return {date:x?.date??null,score:Number(x?.score??0),user_score:Number(x?.user_score??0),counterpart_score:Number(x?.counterpart_score??0),shared_activation:Boolean(x?.shared_activation),hits:(Array.isArray(x?.hits)?x.hits:[]).map(transitHit).filter(Boolean).slice(0,n)};}
function transitMonth(x:any){if(!x||typeof x!=="object")return null;return {calendar_month:x?.calendar_month??null,score:Number(x?.score??0),top_dates:Array.isArray(x?.top_dates)?x.top_dates.slice(0,4):[]};}
function compact(calc:any,ctx:any,purpose:Purpose,level=0){
 const r=calc?.result??{},n=r?.natal_synastry??{},exact=Boolean(n?.partner_time_exact);
 let aspects=(Array.isArray(n?.aspects)?n.aspects:[]).map(aspect).filter(Boolean).sort((a:any,b:any)=>a.orb-b.orb);
 if(!exact)aspects=aspects.filter((a:any)=>!TIME_SENSITIVE.has(a.a)&&!TIME_SENSITIVE.has(a.b));
 const L=level===0?{static:36,focus:6,house:12,cross:12,chart:13,months:12,tight:5,ranked:12,days:14,hits:5,topMonths:10}:level===1?{static:28,focus:4,house:9,cross:9,chart:10,months:9,tight:3,ranked:9,days:10,hits:3,topMonths:8}:{static:20,focus:3,house:6,cross:6,chart:8,months:6,tight:2,ranked:6,days:8,hits:2,topMonths:6};
 const focus=r?.relationship_focus?.groups??{};
 const trans=r?.relationship_transits??r?.reunion_transits??null;
 const ctxMonths=Array.isArray(ctx?.months)?ctx.months.map((m:any)=>({calendar_month:m?.calendar_month,start:m?.start,end:m?.end,incoming:stat(m?.incoming),outgoing:stat(m?.outgoing),reconnection:stat(m?.reconnection)})):[];
 const rankedMonths=ctxMonths.map((m:any)=>({...m,rank_score:Number(m?.reconnection?.average??0)*.5+Number(m?.incoming?.average??0)*.35+Number(m?.outgoing?.average??0)*.15})).sort((a:any,b:any)=>b.rank_score-a.rank_score).slice(0,L.ranked);
 const advancedMonths=(Array.isArray(r?.months)?r.months:[]).slice(0,L.months).map((m:any)=>({calendar_month:m?.calendar_month,representative_date:m?.representative_date,signal_summary:compactSignal(m?.signal_summary,L.tight)}));
 const transitDays=(Array.isArray(trans?.top_days)?trans.top_days:[]).slice(0,L.days).map((d:any)=>transitDay(d,L.hits)).filter(Boolean);
 const transitMonths=(Array.isArray(trans?.top_months)?trans.top_months:[]).slice(0,L.topMonths).map(transitMonth).filter(Boolean);
 return deep({
   analysis_mode:r?.analysis_mode??null,period:calc?.period,relationship_status:calc?.relationship_status,
   precision:{partner_time_exact:exact,removed_time_sensitive_count:(Array.isArray(n?.aspects)?n.aspects.length:0)-aspects.length},
   static:{aspects:aspects.slice(0,L.static),strongest:aspects.slice(0,Math.min(14,L.static))},
   focus:focusPacket(focus,L.focus),
   house_overlays:housePacket(r?.house_overlays,L.house),
   saju_relationship:sajuPacket(r?.saju_relationship,L.cross),
   advanced:{davison:advancedPacket(r?.davison,L.chart),marks:advancedPacket(r?.marks,L.chart),months:advancedMonths},
   directional:purpose==="reunion"&&ctx?{period:ctx?.period,incoming:stat(ctx?.incoming),outgoing:stat(ctx?.outgoing),reconnection:stat(ctx?.reconnection),ranked_months:rankedMonths}:null,
   transit_triggers:trans?{period:trans?.period,policy:trans?.policy,top_days:transitDays,top_months:transitMonths}:null,
   limitations:Array.isArray(r?.limitations)?r.limitations.slice(0,8):[]
 });
}
function selectPromptPacket(calc:any,ctx:any,purpose:Purpose){let originalBytes=0,last:any=null;for(let level=0;level<=2;level++){const payload=compact(calc,ctx,purpose,level);const budget=promptBudget(payload,purpose);if(level===0)originalBytes=budget.bytes;last={payload,budget,compression_level:level,original_prompt_bytes:originalBytes};if(budget.ok)return last;}return last;}
'''
s = s[:start] + new_compact + s[end:]

serve_start = s.index('const preferred=MODELS.has(String(b.model))?')
hash_start = s.index('const hash=await sha', serve_start)
serve_prefix = '''const preferred=MODELS.has(String(b.model))?String(b.model):DEFAULT_MODEL;const pack=selectPromptPacket(b.calculation,b.reunion_context,purpose);const payload=pack.payload;const budget=pack.budget;if(!budget.ok)return respond({ok:false,cost_guard_blocked:true,prompt_budget:true,error:`관계 해설 근거를 3단계로 압축했지만 안전 상한 ${budget.max_bytes.toLocaleString()} bytes를 넘어 Gemini 호출을 막았어.`,prompt_bytes:budget.bytes,max_prompt_bytes:budget.max_bytes,prompt_compression_level:pack.compression_level,original_prompt_bytes:pack.original_prompt_bytes},200);'''
s = s[:serve_start] + serve_prefix + s[hash_start:]

old_result = 'const result:any=await calculate(payload,purpose,preferred,key);const finalStatus=result.ok?"done":"failed";'
new_result = 'const generated:any=await calculate(payload,purpose,preferred,key);const result:any={...generated,prompt_bytes:budget.bytes,max_prompt_bytes:budget.max_bytes,prompt_compression_level:pack.compression_level,original_prompt_bytes:pack.original_prompt_bytes};const finalStatus=result.ok?"done":"failed";'
assert old_result in s, 'relationship result anchor missing'
s = s.replace(old_result, new_result, 1)
s = s.replace('return respond({...result,prompt_bytes:budget.bytes,max_prompt_bytes:budget.max_bytes},200);', 'return respond(result,200);', 1)

assert 'relationship-v11.1-adaptive-prompt-pack' in s
assert 'selectPromptPacket(b.calculation,b.reunion_context,purpose)' in s
assert 'prompt_compression_level' in s
assert 'housePacket(r?.house_overlays,L.house)' in s
assert 'sajuPacket(r?.saju_relationship,L.cross)' in s
assert 'transitDay(d,L.hits)' in s

p.write_text(s)
