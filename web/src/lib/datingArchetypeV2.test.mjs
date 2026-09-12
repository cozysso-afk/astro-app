import assert from 'node:assert/strict'
import test,{before,after} from 'node:test'
import {createServer} from 'vite'
import {createElement as h} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {fileURLToPath} from 'node:url'
import {archetypeFixtures,archetypeContext,visualSettings} from './datingArchetype.fixtures.mjs'
import {fortuneFixture} from './readingExperience.fixtures.mjs'
let server,engine,transport,Profile,Panel
before(async()=>{
 server=await createServer({root:fileURLToPath(new URL('../..',import.meta.url)),optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false},appType:'custom'})
 engine=await server.ssrLoadModule('/src/lib/datingArchetypeV2.ts')
 transport=await server.ssrLoadModule('/src/lib/datingNatalTransport.ts')
 const ui=await server.ssrLoadModule('/src/DatingArchetypePanel.tsx');Profile=ui.DatingVisualProfile;Panel=ui.DatingArchetypePanel
})
after(async()=>server?.close())
const build=(f=archetypeFixtures[0],context=archetypeContext)=>engine.buildDatingArchetypeV2(f.natal,context)
for(const fixture of archetypeFixtures)test(`${fixture.id}: deterministic independent traits and complete prompt`,()=>{
 const before=JSON.stringify(fixture.natal),model=build(fixture)
 assert.deepEqual(model,build(fixture));assert.equal(JSON.stringify(fixture.natal),before)
 assert.equal(model.kind,'dating_partner');assert.equal(model.precision,'exact')
 for(const k of ['face_shape_primary','eyes_shape','nose_bridge','mouth','body_build','proportions','fashion','animal_type_primary'])assert.ok(model.traits[k],k)
 const prompt=engine.datingPortraitPromptV2(model,visualSettings,'ko')
 for(const k of ['face_shape_primary','eyes_shape','eyelid_style','body_build','proportions','fashion'])if(model.traits[k])assert.ok(prompt.includes(model.traits[k].ko))
 assert.match(prompt,/한국인 성인 남성/);assert.doesNotMatch(prompt,/\b\d+\s*cm|미래 상대는 \d+세/)
 assert.equal(model.attraction_points_top3.length,3)
 for(const trait of Object.values(model.traits))for(const id of trait.evidence)assert.ok(model.evidence_summary.some(e=>e.id===id))
})
test('five chart configurations produce substantially different profiles',()=>{
 const models=archetypeFixtures.map(f=>build(f))
 assert.equal(new Set(models.map(m=>m.traits.overall_vibe.id)).size,5)
 assert.ok(new Set(models.map(m=>m.traits.face_shape_primary.id)).size>=3)
 assert.ok(new Set(models.map(m=>m.traits.animal_type_primary.id)).size>=4)
 for(let i=0;i<models.length;i++)for(let j=i+1;j<models.length;j++){
  const differences=Object.keys(models[i].traits).filter(k=>models[i].traits[k]?.id!==models[j].traits[k]?.id)
  assert.ok(differences.length>=5,`${i}/${j}: only ${differences.length} differences`)
 }
 assert.equal(models[0].relativeAge,'younger');assert.equal(models[1].relativeAge,'mature')
 assert.equal(models[2].traits.height_band.id,'tall')
 assert.notEqual(models[3].traits.jaw.id,models[4].traits.jaw.id)
})
test('5H dominates dating context and is not interchangeable with 7H spouse structure',()=>{
 const f=structuredClone(archetypeFixtures[0]);const base=build(f)
 ;[f.natal.fifth_house,f.natal.seventh_house]=[f.natal.seventh_house,f.natal.fifth_house]
 assert.notDeepEqual(base.traits,build(f).traits)
 assert.ok(base.evidence_summary.some(e=>e.label.includes('5하우스')))
 assert.match(base.limitations.join(' '),/배우자상과 같은 사람으로 취급하지/)
})
test('birth-time uncertainty and inconsistent provenance exclude Moon/houses/DSC',()=>{
 for(const patch of [{time_exact:false},{time_source:'family_memory'},{time_confidence:'low'},{time_available:false}]){
  const f=structuredClone(archetypeFixtures[0]);Object.assign(f.natal.time_reliability,patch)
  const model=build(f);assert.equal(model.precision,'limited');assert.equal(model.confidence,'low')
  assert.equal(model.evidence_summary.length,1);assert.equal(model.evidence_summary[0].physicalKey,'planet:Venus')
  assert.equal(model.traits.face_shape_primary,undefined);assert.equal(model.traits.eyelid_style,undefined)
  assert.equal(model.relativeAge,undefined)
 }
})
test('duplicate physical rulers and DSC never inflate independent factor count',()=>{
 const f=structuredClone(archetypeFixtures[3]);const rows=engine.extractDatingSignatures(f.natal)
 assert.equal(rows.filter(x=>x.physicalKey==='planet:Venus').length,1)
 assert.equal(rows.filter(x=>x.physicalKey==='house:7').length,1)
 const model=build(f);f.natal.dsc=undefined
 assert.deepEqual(Object.fromEntries(Object.entries(model.traits).map(([k,t])=>[k,t.id])),Object.fromEntries(Object.entries(build(f).traits).map(([k,t])=>[k,t.id])))
})
test('relative age follows actual user age and remains an adult range, not a 30s default',()=>{
 const a=build(archetypeFixtures[0]),b=build(archetypeFixtures[0],{birthDate:'1981-03-21',asOf:'2026-09-12'})
 assert.equal(b.ageBand.min-a.ageBand.min,10);assert.ok(a.ageBand.min<35)
 assert.equal(engine.ageAt('1991-03-21','2026-03-20'),34);assert.equal(engine.ageAt('1991-03-21','2026-03-21'),35)
 assert.equal(engine.ageAt('1991-02-30','2026-03-21'),undefined)
 assert.equal(build(archetypeFixtures[0],{birthDate:'',asOf:'2026-09-12'}).ageBand,undefined)
 for(const kind of ['younger','slightly_younger','peer','slightly_older','mature'])assert.ok(engine.relativeAgeBand(18,kind).min>=18)
})
test('visual settings never modify archetype or infer nationality; celebrity refs stay text-only',()=>{
 const model=build(),before=JSON.stringify(model)
 assert.ok(engine.celebrityVibes(model,'male').length);assert.notDeepEqual(engine.celebrityVibes(model,'male'),engine.celebrityVibes(model,'female'))
 for(const background of ['korean','east_asian','unrestricted'])for(const gender of ['male','female','neutral'])for(const language of ['ko','en']){
  const prompt=engine.datingPortraitPromptV2(model,{...visualSettings,gender,background,celebrity:'FORBIDDEN_NAME'},language)
  assert.doesNotMatch(prompt,/FORBIDDEN_NAME|정해인|이제훈|공유|박서준|김고은|정유미|류준열|한소희|김세정|이동욱|정경호|유연석|최우식|배두나|신민아|전여빈/)
  if(background==='korean')assert.match(prompt,language==='ko'?/한국인 성인/:/Korean adult/)
  if(background==='unrestricted')assert.match(prompt,language==='ko'?/배경은 제한하지/:/No ethnicity restriction/)
 }
 assert.equal(JSON.stringify(model),before)
})
test('no natal data means no two-template or transit-face fallback',()=>{
 const model=engine.buildDatingArchetypeV2({scope:'single_person_natal_only'},archetypeContext)
 assert.deepEqual(model.traits,{});assert.throws(()=>engine.datingPortraitPromptV2(model,visualSettings,'ko'))
 assert.deepEqual(engine.extractDatingSignatures({scope:'synastry',venus:{sign:'황소자리'}}),[])
})
test('period mood can change while natal face and body remain identical',()=>{
 const a=build(),b=build(archetypeFixtures[0],{...archetypeContext,periodMood:{ko:'활동적인 첫 만남',en:'active meeting'}})
 assert.deepEqual(a.traits,b.traits);assert.deepEqual(a.ageBand,b.ageBand)
 assert.notEqual(engine.datingPortraitPromptV2(a,visualSettings,'ko'),engine.datingPortraitPromptV2(b,visualSettings,'ko'))
})
test('existing natal endpoint request is one-day, single-person and never includes counterpart/AI fields',async()=>{
 let calls=0
 const profile={birth_date:'1991-03-21',birth_time:'07:26',gender:'female',counterpart:{name:'NO'},name:'PRIVATE_NAME',time_source:'official_record',time_confidence:'exact'}
 const result=await transport.fetchDatingNatal('https://example.test',profile,'2026-09-12',new AbortController().signal,async(url,options)=>{
  calls++;assert.equal(url,'https://example.test/v1/love/new-relationship')
  const request=JSON.parse(options.body);assert.equal(request.start_date,request.end_date)
  assert.equal(request.profile.gender,undefined);assert.equal(request.profile.counterpart,undefined);assert.equal(request.profile.name,undefined)
  return {ok:true,json:async()=>({ok:true,result:{ok:true,source_scope:'single_person_only',counterpart_used:false,relationship_engine_used:false,static_structure:archetypeFixtures[0].natal}})}
 })
 assert.equal(calls,1);assert.deepEqual(result,archetypeFixtures[0].natal)
 assert.throws(()=>transport.readDatingNatalResponse({ok:true,result:{source_scope:'two_person'}}))
})
test('transport errors never display backend details or profile secrets',async()=>{
 await assert.rejects(transport.fetchDatingNatal('https://example.test',{birth_date:'1991-03-21'},'2026-09-12',new AbortController().signal,async()=>({ok:false,json:async()=>({detail:'SECRET'})})),error=>!error.message.includes('SECRET'))
})
test('profile renders compact categories, references, independent controls and final KR prompt',()=>{
 const model=build();const html=renderToStaticMarkup(h(Profile,{model,settings:visualSettings,onSettings:()=>{}}))
 for(const text of ['전체','체형','스타일','동물상','매력 포인트','얼굴','무드 레퍼런스','인물 배경','제한 없음','한국어 프롬프트 복사','English Prompt Copy']){
  if(text!=='전체')assert.ok(html.includes(text),text)
 }
 assert.ok(html.includes(model.traits.eyes_shape.ko));assert.doesNotMatch(html,/연령대<select|초상 눈매/)
 const shell=renderToStaticMarkup(h(Panel,{calculation:fortuneFixture().calculation,profile:{birth_date:'1991-03-21'},profileGender:'female',apiBase:'https://example.test'}))
 assert.match(shell,/출생차트로 느낌 보기/);assert.doesNotMatch(shell,/계란형|성인 남성, 30대/)
})
