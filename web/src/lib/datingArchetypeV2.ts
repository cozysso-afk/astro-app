import { TRAIT_RULES, TRAIT_LABELS, type Choice, type SymbolKey, type TraitKey } from './datingTraitRules'

export type Confidence = 'high'|'medium'|'low'
export type Gender = 'male'|'female'|'neutral'
export type Background = 'korean'|'east_asian'|'unrestricted'
export type RelativeAge = 'younger'|'slightly_younger'|'peer'|'slightly_older'|'mature'
type Placement = {planet?:string;sign?:string;degree?:number;whole_house?:number}
type House = {whole_sign?:string;whole_ruler?:string;whole_ruler_placement?:Placement;quadrant_sign?:string;quadrant_system?:string}
export type NatalDatingStructure = {
 scope?:string;venus?:Placement|null;moon?:Placement|null;fifth_house?:House|null;seventh_house?:House|null;dsc?:number|null;
 house_angle_layers_enabled?:boolean;
 time_reliability?:{time_exact?:boolean;time_available?:boolean;time_source?:string;time_confidence?:string};
}
export type NatalDatingResponse = {ok?:boolean;result?:{ok?:boolean;source_scope?:string;counterpart_used?:boolean;relationship_engine_used?:boolean;static_structure?:NatalDatingStructure}}
export type Signature = {id:string;physicalKey:string;label:string;weight:number;symbols:Partial<Record<SymbolKey,number>>;timeSensitive:boolean}
export type Trait = {id:string;ko:string;en:string;confidence:Confidence;evidence:string[]}
export type DatingArchetypeV2 = {
 version:'dating-appearance-v2';kind:'dating_partner';traits:Partial<Record<TraitKey,Trait>>;
 relativeAge?:RelativeAge;ageBand?:{min:number;max:number;ko:string;en:string};
 confidence:Confidence;precision:'exact'|'limited';evidence_summary:Signature[];
 attraction_points_top3:Array<{key:TraitKey;label:string;description:string}>;
 limitations:string[];periodMood?:{ko:string;en:string};
}
export type VisualSettings = {gender:Gender;background:Background;style:'real'|'dream'|'illustration';frame:'face'|'half'|'full';scene:'daily'|'meeting'|'date'}
const SIGNS=['양자리','황소자리','쌍둥이자리','게자리','사자자리','처녀자리','천칭자리','전갈자리','사수자리','염소자리','물병자리','물고기자리']
const EN_SIGNS=['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']
const SIGN_SYMBOLS:SymbolKey[]=['mars','venus','mercury','moon','sun','mercury','venus','pluto','jupiter','saturn','uranus','neptune']
const PLANETS:Record<string,{ko:string;symbol:SymbolKey}>={Mercury:{ko:'수성',symbol:'mercury'},Venus:{ko:'금성',symbol:'venus'},Mars:{ko:'화성',symbol:'mars'},Moon:{ko:'달',symbol:'moon'},Sun:{ko:'태양',symbol:'sun'},Jupiter:{ko:'목성',symbol:'jupiter'},Saturn:{ko:'토성',symbol:'saturn'},Uranus:{ko:'천왕성',symbol:'uranus'},Neptune:{ko:'해왕성',symbol:'neptune'},Pluto:{ko:'명왕성',symbol:'pluto'}}
// Explicit editorial house-to-style context; never a new planetary placement.
const HOUSE_CONTEXT:Partial<Record<number,SymbolKey>>={1:'mars',2:'venus',3:'mercury',4:'moon',5:'sun',6:'mercury',7:'venus',8:'pluto',9:'jupiter',10:'saturn',11:'uranus',12:'neptune'}
function signIndex(value:unknown) {const raw=String(value??'');const i=SIGNS.indexOf(raw);return i>=0?i:EN_SIGNS.indexOf(raw)}
function exactTime(s:NatalDatingStructure) {const r=s.time_reliability;return r?.time_available===true&&r.time_exact===true&&r.time_confidence==='exact'&&['official_record','rectified'].includes(r.time_source??'')}
export function extractDatingSignatures(s:NatalDatingStructure):Signature[] {
 if(s.scope!=='single_person_natal_only')return []
 const exact=exactTime(s),houses=exact&&s.house_angle_layers_enabled===true
 const candidates:Signature[]=[]
 const planet=(name:string,p:Placement|null|undefined,weight:number,role:string,sensitive:boolean)=>{
  const i=signIndex(p?.sign),native=PLANETS[name];if(i<0||!native)return
  const symbols:Signature['symbols']={[SIGN_SYMBOLS[i]]:1};symbols[native.symbol]=(symbols[native.symbol]??0)+.25
  const h=houses&&Number.isInteger(p?.whole_house)&&p!.whole_house!>=1&&p!.whole_house!<=12?p!.whole_house:undefined
  if(h&&HOUSE_CONTEXT[h])symbols[HOUSE_CONTEXT[h]!]=(symbols[HOUSE_CONTEXT[h]!]??0)+.2
  candidates.push({id:`${role}:${name}`,physicalKey:`planet:${name}`,label:`${role} · ${native.ko} ${SIGNS[i]}${h?` · 홀사인 ${h}하우스`:''}`,weight,symbols,timeSensitive:sensitive})
 }
 planet('Venus',s.venus,2.5,'출생 금성',false)
 // The current route has no uncertainty-safe Moon-sign certification. Fail closed.
 if(exact)planet('Moon',s.moon,1,'출생 달',true)
 if(houses)for(const [key,h,weight] of [[5,s.fifth_house,3],[7,s.seventh_house,1.25]] as const){
  const i=signIndex(h?.whole_sign)
  if(i>=0)candidates.push({id:`house:${key}`,physicalKey:`house:${key}`,label:`홀사인 ${key}하우스 · ${SIGNS[i]}`,weight,symbols:{[SIGN_SYMBOLS[i]]:1},timeSensitive:true})
  if(h?.whole_ruler&&h.whole_ruler===h.whole_ruler_placement?.planet)planet(h.whole_ruler,h.whole_ruler_placement,weight,`${key}하우스 지배성`,true)
 }
 // DSC shares the partner-axis vote: use as supporting provenance, not a second 7H vote.
 if(houses&&typeof s.dsc==='number'&&Number.isFinite(s.dsc)&&s.dsc>=0&&s.dsc<360){
  const i=Math.floor(s.dsc/30),existing=candidates.find(x=>x.physicalKey==='house:7')
  if(existing&&signIndex(s.seventh_house?.whole_sign)===i)existing.label+=` · DSC ${SIGNS[i]}`
  else if(!existing)candidates.push({id:'dsc',physicalKey:'house:7',label:`DSC · ${SIGNS[i]}`,weight:1,symbols:{[SIGN_SYMBOLS[i]]:1},timeSensitive:true})
 }
 // Venus as both rulers remains ONE independent physical source, at the strongest role.
 const unique=new Map<string,Signature>()
 for(const row of candidates){const old=unique.get(row.physicalKey);if(!old)unique.set(row.physicalKey,row);else{const stronger=row.weight>old.weight?row:old;unique.set(row.physicalKey,{...stronger,label:[...new Set([old.label,row.label])].join(' / ')})}}
 return [...unique.values()].sort((a,b)=>a.physicalKey.localeCompare(b.physicalKey))
}
function ranked(choices:Choice[],signatures:Signature[]) {
 return choices.map((choice,index)=>{
  const supports=signatures.map(s=>({s,score:Object.entries(choice.symbols).reduce((sum,[k,w])=>sum+(s.symbols[k as SymbolKey]??0)*w!,0)*s.weight})).filter(x=>x.score>0)
  return {choice,index,score:supports.reduce((sum,x)=>sum+x.score,0),supports}
 }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.index-b.index)
}
const certainty=(count:number,margin:number,exact:boolean):Confidence=>exact&&count>=3&&margin>=.15?'high':count>=2?'medium':'low'
function toTrait(row:ReturnType<typeof ranked>[number],runner:number,exact:boolean):Trait {
 return {id:row.choice.id,ko:row.choice.ko,en:row.choice.en,confidence:certainty(row.supports.length,(row.score-runner)/row.score,exact),evidence:row.supports.map(x=>x.s.id)}
}
export function ageAt(birthDate:string,asOf:string):number|undefined {
 const valid=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v
 if(!valid(birthDate)||!valid(asOf))return undefined
 const a=Number(asOf.slice(0,4))-Number(birthDate.slice(0,4))-(asOf.slice(5)<birthDate.slice(5)?1:0)
 return a>=18&&a<=100?a:undefined
}
export function relativeAgeBand(age:number,relative:RelativeAge) {
 const offsets:Record<RelativeAge,[number,number]>={younger:[-8,-3],slightly_younger:[-6,-1],peer:[-3,3],slightly_older:[2,7],mature:[4,10]}
 const [lo,hi]=offsets[relative];const min=Math.max(18,age+lo),max=Math.max(min+2,age+hi)
 return {min,max,ko:`${min}~${max}세 정도로 표현한 성인 연령감`,en:`adult visual age range approximately ${min}–${max}, a styling range not a predicted age`}
}
export function buildDatingArchetypeV2(structure:NatalDatingStructure,context:{birthDate:string;asOf:string;periodMood?:{ko:string;en:string}}):DatingArchetypeV2 {
 const evidence=extractDatingSignatures(structure),exact=exactTime(structure),traits:DatingArchetypeV2['traits']={}
 const skeletal=new Set<TraitKey>(['height_band','body_build','proportions','face_shape_primary','jaw','nose_shape','eyelid_style'])
 for(const [key,choices] of Object.entries(TRAIT_RULES) as Array<[TraitKey,Choice[]]>){
  const votes=ranked(choices,evidence);if(!votes.length)continue
  // Detailed anatomy-like styling needs repeated independent symbolic support.
  if(skeletal.has(key)&&votes[0].supports.length<2)continue
  traits[key]=toTrait(votes[0],votes[1]?.score??0,exact)
  const secondary=key==='face_shape_primary'?'face_shape_secondary':key==='animal_type_primary'?'animal_type_secondary':undefined
  if(secondary&&votes[1]&&votes[1].supports.length>=2&&votes[1].score>=votes[0].score*.55)traits[secondary]=toTrait(votes[1],votes[2]?.score??0,exact)
 }
 const sum=(symbol:SymbolKey)=>evidence.reduce((n,s)=>n+(s.symbols[symbol]??0)*s.weight,0)
 const total=evidence.reduce((n,s)=>n+s.weight,0)||1
 const ageBias=(sum('saturn')*1.3+sum('pluto')*.25-sum('mercury')*1.2-sum('uranus')*.35)/total
 const relativeAge:RelativeAge|undefined=evidence.length<2?undefined:ageBias<-.65?'younger':ageBias<-.18?'slightly_younger':ageBias>.65?'mature':ageBias>.18?'slightly_older':'peer'
 if(relativeAge){const labels:Record<RelativeAge,[string,string]>={younger:['연하 느낌이 뚜렷한 쪽','clearly younger-leaning adult vibe'],slightly_younger:['약간 연하 쪽','slightly younger-leaning adult vibe'],peer:['또래 전후','peer-like adult vibe'],slightly_older:['약간 연상 쪽','slightly older-leaning adult vibe'],mature:['성숙한 연상 느낌','mature-leaning adult vibe']};traits.relative_age={id:relativeAge,ko:labels[relativeAge][0],en:labels[relativeAge][1],confidence:exact&&evidence.length>=3?'medium':'low',evidence:evidence.map(x=>x.id)}}
 const age=ageAt(context.birthDate,context.asOf)
 const attractionKeys:TraitKey[]=['eyes_shape','smile','fashion','proportions','mouth','hair','eye_impression']
 const rankConfidence={high:3,medium:2,low:1}
 const attraction_points_top3=attractionKeys.filter(k=>traits[k]).sort((a,b)=>rankConfidence[traits[b]!.confidence]-rankConfidence[traits[a]!.confidence]||traits[b]!.evidence.length-traits[a]!.evidence.length||attractionKeys.indexOf(a)-attractionKeys.indexOf(b)).slice(0,3).map(key=>({key,label:TRAIT_LABELS[key],description:traits[key]!.ko}))
 return {version:'dating-appearance-v2',kind:'dating_partner',traits,relativeAge,ageBand:age!==undefined&&relativeAge?relativeAgeBand(age,relativeAge):undefined,
 confidence:evidence.length>=4&&exact?'high':evidence.length>=2?'medium':'low',precision:exact?'exact':'limited',evidence_summary:evidence,attraction_points_top3,periodMood:context.periodMood,
 limitations:[...(!exact?['생시가 확실하지 않아 달·하우스·DSC를 제외했어.']:[]),'현재 개인 연애운 응답에는 독립 출생 화성·수성 등의 전체 위치와 출생 애스펙트가 없어. 지배성으로 실제 반환된 경우에만 사용해.','신뢰도는 상징 조합의 반복 정도이며 실제 외모 예측의 정확도가 아니야.','7하우스는 보조 맥락이야. 개인 결혼운의 배우자상과 같은 사람으로 취급하지 않아.']}
}
// Names live exclusively here; the portrait builder never consumes reference text.
export function celebrityVibes(model:DatingArchetypeV2,gender:Gender):string[] {
 if(!model.evidence_summary.length||gender==='neutral')return []
 const refs=gender==='male'?{lively:'이제훈의 생동하는 표정',calm:'공유의 차분한 분위기',dreamy:'이동욱의 몽환적인 시선',focused:'박서준의 선명한 인상',warm:'정해인의 부드러운 미소',playful:'최우식의 장난기 있는 미소',reserved:'정경호의 절제된 표정',open:'유연석의 편안한 미소',minimal:'공유의 단정한 스타일',casual:'박서준의 캐주얼 스타일',relaxed:'최우식의 힘을 뺀 옷차림',distinct:'류준열의 개성 있는 스타일',soft:'정해인의 부드러운 스타일'}:{lively:'김세정의 생동하는 표정',calm:'정유미의 차분한 분위기',dreamy:'김고은의 부드러운 시선',focused:'한소희의 선명한 인상',warm:'정유미의 편안한 미소',playful:'김세정의 밝은 미소',reserved:'전여빈의 절제된 표정',open:'신민아의 시원한 미소',minimal:'김고은의 담백한 스타일',casual:'김세정의 캐주얼 스타일',relaxed:'정유미의 편안한 옷차림',distinct:'배두나의 개성 있는 스타일',soft:'신민아의 부드러운 스타일'}
 return [...new Set(['eye_impression','smile','fashion'].flatMap(key=>{const id=model.traits[key as TraitKey]?.id;return id&&id in refs?[refs[id as keyof typeof refs]]:[]}))].slice(0,3)
}
export function datingPortraitPromptV2(model:DatingArchetypeV2,settings:VisualSettings,language:'ko'|'en') {
 if(!model.evidence_summary.length)throw new Error('출생차트 근거가 없어 초상 프롬프트를 만들 수 없어.')
 const ko=language==='ko'
 const gender=({male:['성인 남성','adult man'],female:['성인 여성','adult woman'],neutral:['성인 인물','adult person']} as const)[settings.gender][ko?0:1]
 const background=({korean:['한국인 ','Korean '],east_asian:['동아시아인 ','East Asian '],unrestricted:['','']} as const)[settings.background][ko?0:1]
 const style=({real:['자연스러운 일상 실사','natural candid everyday photograph'],dream:['은은한 몽환 실사','subtly dreamy photorealism'],illustration:['섬세한 일러스트','delicate illustration']} as const)[settings.style][ko?0:1]
 const frame=({face:['얼굴 중심','face portrait'],half:['상반신','half-body composition'],full:['전신','full-body composition']} as const)[settings.frame][ko?0:1]
 const scene=({daily:['평범한 실내나 야외의 일상 장면','ordinary indoor or outdoor everyday scene'],meeting:['편안한 첫 만남 장면','relaxed first-meeting scene'],date:['꾸미되 과하지 않은 일상 데이트 장면','casual everyday date scene']} as const)[settings.scene][ko?0:1]
 const keys:TraitKey[]=['overall_vibe','height_band','body_build','proportions','face_shape_primary','face_shape_secondary','jaw','eyes_shape','eyes_size','eye_impression','eyelid_style','brows','nose_bridge','nose_shape','mouth','smile','facial_softness','hair','grooming','fashion','first_impression']
 const descriptions=keys.flatMap(k=>model.traits[k]?[model.traits[k]![ko?'ko':'en']]:[])
 const age=model.ageBand?.[ko?'ko':'en']??model.traits.age_impression?.[ko?'ko':'en']
 const lines=[ko?`가상의 ${background}${gender}.`:`A fictional ${background}${gender}.`,`${style}, ${frame}, ${scene}.`,...(age?[age+'.']:[]),descriptions.join(', ')+'.',...(model.periodMood?[model.periodMood[ko?'ko':'en']+'.']:[]),ko?'자연스러운 피부결과 모공, 미세한 눈 밑 질감과 표정 주름, 약한 좌우 비대칭, 약간 흐트러진 머리, 현실적인 자세. 일부러 노화나 피로를 더하지 말 것. 뷰티 필터·피부 뭉개기·아이돌이나 모델 화보 같은 이상화·극단적인 턱선·과장된 눈과 콧대·스튜디오 조명 금지.':'Natural skin texture and pores, subtle under-eye texture and expression lines, mild asymmetry, ordinary hair imperfections and realistic posture. Do not deliberately add ageing or fatigue. No beauty filters, smoothing, idol or model idealization, extreme jawline, enlarged eyes or nose bridge, or studio lighting.',ko?'인물 배경과 성별은 사용자의 그림 설정이다. 나이 범위와 외형은 차트 상징을 옮긴 시각적 연출이며 실제 미래 인물의 신체 예측이 아니다.':'Background and gender are rendering preferences. Age range and features visualize chart symbolism, not the physical prediction of a future person.']
 if(settings.background==='unrestricted')lines.push(ko?'인물 배경은 제한하지 않는다. 차트가 국적이나 인종을 예측했다는 의미는 아니다.':'No ethnicity restriction; the chart does not predict ethnicity or nationality.')
 return lines.join('\n')
}
