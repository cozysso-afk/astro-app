export const EDITORIAL_SECTION_KEYS = [
  "relationship.summary",
  "relationship.friends",
  "relationship.coworkers",
  "relationship.family",
  "relationship.new_people",
  "relationship.boundaries",
  "relationship.love_general",
  "relationship.love_single",
  "relationship.love_crush",
  "relationship.love_flirting",
  "relationship.love_ambiguous",
  "relationship.love_couple",
  "relationship.love_reunion_interest",
  "relationship.contact_activation",
  "relationship.contact_continuity",
  "work_study.work",
  "work_study.career_change",
  "work_study.exam",
  "work_study.study",
  "money_news.money",
  "money_news.news",
  "investment.psychology",
  "investment.realization",
  "investment.entry",
  "condition.condition",
] as const;

const KEY_SET = new Set<string>(EDITORIAL_SECTION_KEYS);
const EDITORIAL_FIELDS = ["conclusion","real_scene","action","change_condition","evidence_refs","applicability"] as const;

function invalidProviderClusters(core:any){
  return {...core,clusters:null};
}

export function buildProviderCoreSchema(fullSchema:any){
  const core:any=structuredClone(fullSchema);
  delete core?.properties?.topic_analysis;
  core.required=(core.required??[]).filter((key:string)=>key!=="topic_analysis");
  const section=fullSchema?.properties?.clusters?.properties?.relationship?.properties?.summary;
  if(!section?.properties)throw new Error("editorial section schema missing");
  core.properties.clusters={
    type:"ARRAY",
    minItems:EDITORIAL_SECTION_KEYS.length,
    maxItems:EDITORIAL_SECTION_KEYS.length,
    items:{
      type:"OBJECT",
      properties:{
        key:{type:"STRING",enum:[...EDITORIAL_SECTION_KEYS]},
        conclusion:structuredClone(section.properties.conclusion),
        real_scene:structuredClone(section.properties.real_scene),
        action:structuredClone(section.properties.action),
        change_condition:structuredClone(section.properties.change_condition),
        evidence_refs:structuredClone(section.properties.evidence_refs),
        applicability:structuredClone(section.properties.applicability),
      },
      required:["key",...EDITORIAL_FIELDS],
    },
  };
  return core;
}

export function normalizeProviderCore(core:any){
  if(!core||typeof core!=="object"||Array.isArray(core)||!Array.isArray(core.clusters))return core;
  if(core.clusters.length!==EDITORIAL_SECTION_KEYS.length)return invalidProviderClusters(core);
  const groups:any={relationship:{},work_study:{},money_news:{},investment:{},condition:{}};
  const seen=new Set<string>();
  for(const row of core.clusters){
    const key=String(row?.key??"");
    if(!KEY_SET.has(key)||seen.has(key))return invalidProviderClusters(core);
    seen.add(key);
    const dot=key.indexOf(".");
    const group=key.slice(0,dot),section=key.slice(dot+1);
    if(!groups[group]||!section)return invalidProviderClusters(core);
    groups[group][section]=Object.fromEntries(EDITORIAL_FIELDS.map(field=>[field,row?.[field]]));
  }
  if(seen.size!==EDITORIAL_SECTION_KEYS.length)return invalidProviderClusters(core);
  return {...core,clusters:groups};
}
