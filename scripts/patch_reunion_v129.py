from pathlib import Path

root = Path(__file__).resolve().parents[1]
index = root / 'supabase/functions/relationship-interpret-v9-preview/index.ts'
cache = root / 'web/src/lib/readingCache.ts'

s = index.read_text()
s = s.replace('const REUNION_VERSION="relationship-v12.8-prompt-grounding-resilience";', 'const REUNION_VERSION="relationship-v12.9-grounding-false-negative";')
old = ''' if(p==="reunion"){
   const r=data.reunion_synthesis_v2??{};
   const why=`${String(r?.why_reconnect?.conclusion??"")} ${String(r?.why_reconnect?.interpretation??"")}`.trim();
   if(String(r?.summary??"").length<need(260))return false;
   if(why.length<need(420))return false;
   if(String(r?.timing?.conclusion??"").length<need(220))return false;
   if(String(r?.rebuild?.conclusion??"").length<need(240))return false;
   if(String(r?.repeat_risks?.conclusion??"").length<need(140))return false;
 }
'''
new = ''' if(p==="reunion"){
   const r=data.reunion_synthesis_v2??{};
   const whyConclusion=String(r?.why_reconnect?.conclusion??"").trim();
   const whyInterpretation=String(r?.why_reconnect?.interpretation??"").trim();
   // Grounding is a safety/traceability gate, not a prose-length score. The repair
   // layer already guarantees these core sections and valid evidence refs. Do not
   // discard a grounded Gemini answer merely because it is shorter than the style target.
   if(String(r?.summary??"").trim().length<120)return false;
   if(whyConclusion.length<12||whyInterpretation.length<24)return false;
   if(String(r?.timing?.conclusion??"").trim().length<12)return false;
   if(String(r?.rebuild?.conclusion??"").trim().length<12)return false;
   if(String(r?.repeat_risks?.conclusion??"").trim().length<12)return false;
 }
'''
if old not in s:
    raise SystemExit('expected reunion grounded length block not found')
s = s.replace(old, new)

s = s.replace('if(!data)return publicRelationshipError("REL_RESULT_INVALID",{model,usage:u});', 'if(!data){console.warn(JSON.stringify({event:"relationship_validation_failed",stage:"shape",purpose,model,compactMode}));return publicRelationshipError("REL_RESULT_INVALID",{model,usage:u});}')
s = s.replace('if(!repaired.ok)return publicRelationshipError("REL_RESULT_INVALID",{model,usage:u});data=repaired.data;', 'if(!repaired.ok){console.warn(JSON.stringify({event:"relationship_validation_failed",stage:"reunion_repair",reason:repaired.reason??"unknown",purpose,model,compactMode}));return publicRelationshipError("REL_RESULT_INVALID",{model,usage:u});}data=repaired.data;')
s = s.replace('if(!grounded(data,payload,purpose,compactMode))return publicRelationshipError("REL_RESULT_INVALID",{model,usage:u});', 'if(!grounded(data,payload,purpose,compactMode)){console.warn(JSON.stringify({event:"relationship_validation_failed",stage:"grounded",purpose,model,compactMode}));return publicRelationshipError("REL_RESULT_INVALID",{model,usage:u});}')
s = s.replace('}catch{return publicRelationshipError("REL_RESULT_INVALID",{model,usage:u});}}catch(e){', '}catch(e){console.warn(JSON.stringify({event:"relationship_validation_failed",stage:"parse_or_validation_exception",purpose,model,compactMode,name:e instanceof Error?e.name:"unknown"}));return publicRelationshipError("REL_RESULT_INVALID",{model,usage:u});}}catch(e){')
index.write_text(s)

for path in [cache, *list((root / 'web/src/lib').glob('*.test.mjs')), *list((root / 'supabase/functions/relationship-interpret-v9-preview').glob('*.test.mjs'))]:
    if not path.exists():
        continue
    t = path.read_text()
    t = t.replace('relationship-v12.8-prompt-grounding-resilience-v1', 'relationship-v12.9-grounding-false-negative-v1')
    t = t.replace('relationship-v12.8-prompt-grounding-resilience', 'relationship-v12.9-grounding-false-negative')
    t = t.replace('relationship-v12\\.8-prompt-grounding-resilience', 'relationship-v12\\.9-grounding-false-negative')
    path.write_text(t)

print('patched reunion interpreter v12.9')
