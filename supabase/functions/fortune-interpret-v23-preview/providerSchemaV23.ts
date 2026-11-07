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
    // Missing or malformed provider sections are represented as data state only.
    // TypeScript must never fill a Gemini-owned reader-facing field with prose.
    conclusion:"",
    real_scene:"",
    action:"",
    change_condition:"",
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
  const legacy=typeof row?.real_scene==="string";
  const split=typeof row?.applies_when==="string"&&typeof row?.evidence_meaning==="string";
  if(typeof row?.conclusion!=="string"||typeof row?.action!=="string"||typeof row?.change_condition!=="string"||(!legacy&&!split))return false;
  if(!Array.isArray(row?.evidence_refs))return false;
  return APPLICABILITY.has(String(row?.applicability??""));
}
function normalizedProviderSection(row:any){
  const real_scene=typeof row?.real_scene==="string"?row.real_scene:[row?.applies_when,row?.evidence_meaning].map((value:any)=>String(value??"").trim()).filter(Boolean).join(" ");
  return {conclusion:row?.conclusion,real_scene,action:row?.action,change_condition:row?.change_condition,evidence_refs:row?.evidence_refs,applicability:row?.applicability};
}

function normalizePeriodKind(value:unknown){
  const kind=String(value??"").trim().toLowerCase();
  return kind==="day"||kind==="week"||kind==="month"||kind==="annual"?kind:"annual";
}

export function buildProviderCoreSchema(fullSchema:any,periodKind?:unknown){
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
        answer:{type:"STRING"},
        status:{type:"STRING",enum:["direct","partial"]},
        evidence_refs:{type:"ARRAY",items:{type:"STRING"}},
      },
      required:["topic","question_key","answer","status","evidence_refs"],
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
  if(periodKind!==undefined){
    const kind=normalizePeriodKind(periodKind);
    const minimums={
      day:{key_windows:1,decisions:1,priorities:1},
      week:{key_windows:0,decisions:0,priorities:0},
      month:{key_windows:0,decisions:0,priorities:0},
      annual:{key_windows:0,decisions:0,priorities:0},
    }[kind];
    for(const [field,minItems] of Object.entries(minimums)){
      if(core.properties?.[field]?.type==="ARRAY")core.properties[field].minItems=minItems;
    }
    if(kind==="annual"){
      core.properties.year_phases.minItems=0;
      core.properties.cross_checks.minItems=0;
    }
    if(kind!=="day"){
      const item=core.properties.clusters.items;
      const scene=structuredClone(item.properties.real_scene);
      item.properties.applies_when={...structuredClone(scene),description:"사용자에게 실제로 생긴 일을 단정하지 않는 조건형 적용 상황. 첫 문장에 만약/라면/할 때/경우 중 하나를 사용."};
      item.properties.evidence_meaning={...structuredClone(scene),description:"계산 근거가 conclusion을 허용하는 이유의 생활어 번역. 사용자 사건·증상·상대 행동을 만들지 않음."};
      delete item.properties.real_scene;
      item.required=["key","conclusion","applies_when","evidence_meaning","action","change_condition","evidence_refs","applicability"];
      const {clusters,headline,overall,...rest}=core.properties;
      core.properties={clusters,overall,headline,...rest};
      core.propertyOrdering=Object.keys(core.properties);
    }
    if(kind==="day"){
      // Write field interpretations before the first-screen answer. This plan
      // is model-authored working data, never a server-written fortune.
      const focus={type:"OBJECT",properties:{
        reader_question:{type:"STRING"},judgment:{type:"STRING"},
        applicable_situation:{type:"STRING"},interpretation_reason:{type:"STRING"},
        limitation:{type:"STRING"},evidence_refs:{type:"ARRAY",items:{type:"STRING"}},
      },required:["reader_question","judgment","applicable_situation","interpretation_reason","limitation","evidence_refs"]};
      const {clusters,headline,overall,...rest}=core.properties;
      core.properties={clusters,editorial_focus:focus,overall,headline,...rest};
      core.required=[...core.required,"editorial_focus"];
      core.propertyOrdering=Object.keys(core.properties);
      core.properties.headline.description="분야별 해석과 editorial_focus를 작성한 뒤, 구체적 대상에 대한 판단 하나를 짧은 한국어 한 문장으로 써. 이유·행동·제한을 전부 압축하지 마.";
      core.properties.overall.properties.summary.description="editorial_focus의 적용 상황과 해석 이유를 짧은 한국어 두 문장으로 설명해. 제목을 반복하거나 여러 분야를 나열하지 마.";
    }
  }
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
    groups[group][section]=normalizedProviderSection(row);
  }

  for(const key of EDITORIAL_SECTION_KEYS){
    const dot=key.indexOf(".");
    const group=key.slice(0,dot),section=key.slice(dot+1);
    if(!seen.has(key)||invalid.has(key))groups[group][section]=insufficientProviderSection();
  }
  const editorial_delivery=Object.fromEntries(EDITORIAL_SECTION_KEYS.map(key=>[key,invalid.has(key)?'invalid':!seen.has(key)?'omitted':'authored']));
  return {...core,clusters:groups,editorial_delivery,domain_answers:normalizedDomainAnswers(core?.domain_answers)};
}
