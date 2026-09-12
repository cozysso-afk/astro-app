import {createServer} from '../web/node_modules/vite/dist/node/index.js'
import {writeFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {archetypeFixtures,archetypeContext,visualSettings} from '../web/src/lib/datingArchetype.fixtures.mjs'
const server=await createServer({root:fileURLToPath(new URL('../web',import.meta.url)),optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false},appType:'custom'})
try{
 const {buildDatingArchetypeV2,datingPortraitPromptV2}=await server.ssrLoadModule('/src/lib/datingArchetypeV2.ts')
 const keys=['age_impression','relative_age','height_band','body_build','proportions','face_shape_primary','eyes_shape','eyelid_style','nose_bridge','mouth','fashion','animal_type_primary','animal_type_secondary']
 const summaries=[]
 let md='# Dating Appearance Archetype V2 — deterministic QA\n\nBase: dcabee92dc770d19dc7e0b3ee61d71a343d05200. Synthetic fixtures in the existing personal-love static_structure format; no real person, paid AI or generated image was used. Current-age reference is explicitly 2026-09-12, birth date 1991-03-21 (35). These are symbolic visual styles, not physical predictions.\n\n'
 for(const fixture of archetypeFixtures){
  const model=buildDatingArchetypeV2(fixture.natal,archetypeContext)
  summaries.push({id:fixture.id,relativeAge:model.relativeAge,traits:Object.fromEntries(keys.map(k=>[k,model.traits[k]?.id])),vibe:model.traits.overall_vibe?.id})
  md+=`## ${fixture.label}\n\n${model.evidence_summary.map(e=>e.label).join('\n\n')}\n\n| Field | Generated style |\n|---|---|\n${keys.map(k=>`| ${k} | ${model.traits[k]?.ko??'Omitted — insufficient support'} |`).join('\n')}\n\nAge render: ${model.ageBand?.ko??'Omitted'}\n\n### Final Korean image prompt\n\n\`\`\`text\n${datingPortraitPromptV2(model,visualSettings,'ko')}\n\`\`\`\n\n`
 }
 writeFileSync(new URL('../docs/dating-appearance-v2-qa.md',import.meta.url),md)
 console.log(JSON.stringify(summaries,null,2))
}finally{await server.close()}
