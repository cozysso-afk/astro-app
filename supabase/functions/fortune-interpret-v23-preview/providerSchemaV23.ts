import { DOMAIN_ANSWER_KEYS, DOMAIN_ANSWER_LOOKUP, domainAnswerContractKey } from "./domainAnswerContractsV1.ts";

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
const APPLICABILITY = new Set(["direct","conditional","insufficient"]);
const DOMAIN_ANSWER_STATUS = new Set(["direct","partial","not_calculated"]);

function insufficientProviderSection(){
  return {
    conclusion:"이 항목은 이번 응답에서 직접 해설 근거가 충분하지 않아.",
    real_scene:"",
    action:"확인 가능한 사실과 다른 정상 해설 항목을 우선해.",
    change_condition:"직접 근거가 보강되면 이 항목의 판단을 다시 갱신해.",
    evidence_refs:[],
    applicability:"insufficient",
  };
}


function normalizedDomainAnswers(value:any){
  const rows=Array.isArray(value)?value:[];
  const seen=new Set<string>();
  const invalid=new Set<string>();
  const found=new Map<string,any>();
  for(const row of rows){
    const topic=String(row?.topic??"").trim();
    const questionKey=String(row?.question_key??"").trim();
    const key=domainAnswerContractKey(topic,questionKey);
    if(!DOMAIN_ANSWER_LOOKUP.has(key))continue;
    if(seen.has(key)){invalid.add(key);continue;}
    seen.add(key);
    const status=String(row?.status??"").trim();
    const answer=String(row?.answer??"").trim();
    const refs=Array.isArray(row?.evidence_refs)?row.evidence_refs.map((x:any)=>String(x??"").trim()).filter(Boolean).slice(0,8):[];
    if(!DOMAIN_ANSWER_STATUS.has(status) || (status!=="not_calculated"&&!answer)){
      invalid.add(key);
      continue;
    }
    found.set(key,{status,answer:status==="not_calculated"?"":answer,evidence_refs:refs});
  }
  return DOMAIN_ANSWER_KEYS.map(contract=>{
    const key=domainAnswerContractKey(contract.topic,contract.question_key);
    const row=!invalid.has(key)?found.get(key):null;
    return {
      topic:contract.topic,
      question_key:contract.question_key,
      label:contract.label,
      answer:row?.answer??"",
      status:row?.status??"not_calculated",
      evidence_refs:row?.evidence_refs??[],
    };
  });
}

function validProviderSection(row:any){
  if(!row||typeof row!=="object"||Array.isArray(row))return false;
  if(!["conclusion","real_scene","action","change_condition"].every(field=>typeof row?.[field]==="string"))return false;
  if(!Array.isArray(row?.evidence_refs))return false;
  return APPLICABILITY.has(String(row?.applicability??""));
}

export function buildProviderCoreSchema(fullSchema:any){
  const core:any=structuredClone(fullSchema);
  delete core?.properties?.topic_analysis;
  core.required=(core.required??[]).filter((key:string)=>key!=="topic_analysis");
  const section=fullSchema?.properties?.clusters?.properties?.relationship?.properties?.summary;
  if(!section?.properties)throw new Error("editorial section schema missing");
  core.properties.domain_answers={
    type:"ARRAY",
    items:{
      type:"OBJECT",
      properties:{
        topic:{type:"STRING"},
        question_key:{type:"STRING"},
        label:{type:"STRING"},
        answer:{type:"STRING"},
        status:{type:"STRING",enum:["direct","partial","not_calculated"]},
        evidence_refs:{type:"ARRAY",items:{type:"STRING"}},
      },
      required:["topic","question_key","label","answer","status","evidence_refs"],
    },
  };
  if(!core.required.includes("domain_answers"))core.required.push("domain_answers");
  core.properties.clusters={
    type:"ARRAY",
    items:{
      type:"OBJECT",
      properties:{
        // Gemini rejects the otherwise-valid 25-value enum/fixed-length combination
        // as INVALID_ARGUMENT. The prompt names every key; normalization below keeps
        // valid rows and isolates a malformed/missing/duplicate key instead of
        // discarding every authored section.
        key:{type:"STRING"},
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
  if(!core||typeof core!=="object"||Array.isArray(core))return core;
  const rows=Array.isArray(core.clusters)?core.clusters:[];
  const groups:any={relationship:{},work_study:{},money_news:{},investment:{},condition:{}};
  const seen=new Set<string>();
  const invalid=new Set<string>();

  for(const row of rows){
    const key=String(row?.key??"");
    if(!KEY_SET.has(key))continue;
    if(seen.has(key)){
      invalid.add(key);
      continue;
    }
    seen.add(key);
    if(!validProviderSection(row)){
      invalid.add(key);
      continue;
    }
    const dot=key.indexOf(".");
    const group=key.slice(0,dot),section=key.slice(dot+1);
    if(!groups[group]||!section){
      invalid.add(key);
      continue;
    }
    groups[group][section]=Object.fromEntries(EDITORIAL_FIELDS.map(field=>[field,row?.[field]]));
  }

  for(const key of EDITORIAL_SECTION_KEYS){
    const dot=key.indexOf(".");
    const group=key.slice(0,dot),section=key.slice(dot+1);
    if(!seen.has(key)||invalid.has(key))groups[group][section]=insufficientProviderSection();
  }
  return {...core,clusters:groups,domain_answers:normalizedDomainAnswers(core?.domain_answers)};
}
