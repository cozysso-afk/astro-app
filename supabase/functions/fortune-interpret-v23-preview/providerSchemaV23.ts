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
    applies_when:"",
    evidence_meaning:"",
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
  const applies_when=typeof row?.applies_when==="string"?row.applies_when:"";
  const evidence_meaning=typeof row?.evidence_meaning==="string"?row.evidence_meaning:"";
  const real_scene=typeof row?.real_scene==="string"?row.real_scene:[applies_when,evidence_meaning].map((value:any)=>String(value??"").trim()).filter(Boolean).join(" ");
  return {conclusion:row?.conclusion,applies_when,evidence_meaning,real_scene,action:row?.action,change_condition:row?.change_condition,evidence_refs:row?.evidence_refs,applicability:row?.applicability};
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
    core.properties.contact_evidence_refs={type:"OBJECT",properties:{
      incoming:structuredClone(section.properties.evidence_refs),outgoing:structuredClone(section.properties.evidence_refs),
      reconnection:structuredClone(section.properties.evidence_refs),
    },required:["incoming","outgoing","reconnection"]};
    core.required.push("contact_evidence_refs");
    core.properties.system_field_readings={type:"ARRAY",description:"system_field_sources의 모든 행(system/topic)마다 하나씩 써. 앱의 사주·태국점성술 분야 화면 본문이야. 두세 문장(90~220자) 반말: ① 이 기간에 들어온 근거를 이름과 쉬운 뜻으로(예: '올해 세운에 편관이 들어와서', '탁사쫀에서 금전을 맡는 시리 자리에 목성이 있어서') ② 그것이 그 topic의 생활에서 어떻게 드러나는지 구체적 장면 하나 ③ 그래서 해 볼 것이나 조심할 것 하나. 사전 정의만 쓰고 '~를 뜻해/상징해/나타내/의미해'로 끝내면 탈락이야. 같은 근거가 여러 topic에 쓰여도 topic마다 다른 장면을 써. fact가 월운·세운이면 하루 일진 이야기를 하지 말고 그 기간 전체로 말해. 시기를 말할 땐 fact에 적힌 실제 기간 안의 달 이름만 쓰고(기간을 모르면 시기를 빼), 상반기·하반기·월초·월말·주 초반 같은 말은 쓰지 마. 출근·퇴근·저녁·답장처럼 기록에 없는 생활 사건도 만들지 마. 해당 행의 evidence_ref 하나만 인용해. 사건 확정·점수·확률로 바꾸지 마. sources가 없으면 빈 배열.",items:{type:"OBJECT",properties:{
      system:{type:"STRING",enum:["saju","thai"]},topic:{type:"STRING"},reading:{type:"STRING"},evidence_refs:structuredClone(section.properties.evidence_refs),
    },required:["system","topic","reading","evidence_refs"]}};
    core.required.push("system_field_readings");
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
      item.properties.applies_when={...structuredClone(scene),description:"사용자에게 실제로 생긴 일을 단정하지 않는 조건형 적용 상황. 어떤 경우에 해당하는지 독립된 한 문장으로 마쳐. 조건절에서 끊지 마."};
      item.properties.evidence_meaning={...structuredClone(scene),description:"계산 근거가 conclusion을 허용하는 이유의 생활어 번역. 행성명·배치 용어는 systems로 보내고 사용자 사건·증상·상대 행동을 만들지 않음."};
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
        section_key:{type:"STRING",description:"종합의 판단을 실제로 뒷받침한 clusters의 key 하나"},reader_question:{type:"STRING"},judgment:{type:"STRING"},
        applicable_situation:{type:"STRING"},interpretation_reason:{type:"STRING"},
        limitation:{type:"STRING"},evidence_refs:{type:"ARRAY",items:{type:"STRING"}},
      },required:["section_key","reader_question","judgment","applicable_situation","interpretation_reason","limitation","evidence_refs"]};
      const {clusters,headline,overall,...rest}=core.properties;
      core.properties={clusters,editorial_focus:focus,overall,headline,...rest};
      core.required=[...core.required,"editorial_focus"];
      core.propertyOrdering=Object.keys(core.properties);
      core.properties.headline.description="분야별 해석과 editorial_focus를 작성한 뒤, 구체적 대상에 대한 판단 하나를 짧은 한국어 한 문장으로 써. 이유·행동·제한을 전부 압축하지 마.";
      core.properties.overall.properties.summary.description="focus를 먼저 설명하고 근거가 다른 기본 분야가 있으면 그 분야와 무엇이 다른지 두 문장으로 설명해. 각 판단은 해당 분야 원고에서 직접 인용한 근거를 overall.evidence_refs에 담아.";
    }
  }
  return core;
}

export function normalizeProviderCore(core:any){
  if(!core||typeof core!=="object"||Array.isArray(core))return core;
  // "함께 알아둘 점" is shown to the reader. A disclaimer about samples, data
  // or guarantees is internal bookkeeping, so it is left out rather than shown.
  if(typeof core.limits==="string"&&/표본|근거|데이터|계산|보장|제공된|바탕으로|경향|대신하지|참고용|evidence/i.test(core.limits))core={...core,limits:""};
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
