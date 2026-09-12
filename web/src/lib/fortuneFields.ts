import type { LifeTopic } from './systemReading'
export const FORTUNE_FIELDS = [
  {id:'love',label:'연애운',desc:'호감과 만남의 흐름',topics:['연애','연락'],lens:'애정'},
  {id:'money',label:'금전운',desc:'수입·지출과 현실 조건',topics:['금전'],lens:'금전'},
  {id:'investment',label:'주식·투자운',desc:'판단과 위험 관리',topics:['투자심리','신규진입','수익실현','투자주의'],lens:'금전'},
  {id:'study',label:'학업운',desc:'집중·이해·복습',topics:['학업'],lens:'학업'},
  {id:'exam',label:'시험운',desc:'기억 인출과 실수 점검',topics:['시험'],lens:'학업'},
  {id:'work',label:'직업운',desc:'현재 업무와 책임',topics:['직장'],lens:'직업'},
  {id:'job-change',label:'이직운',desc:'지원과 조건 비교',topics:['이직'],lens:'직업'},
  {id:'social',label:'대인관계운',desc:'협력과 거리 조절',topics:['대인관계'],lens:'대인'},
  {id:'contact',label:'연락·소식운',desc:'수신·발신·공식 안내',topics:['연락','소식'],lens:'대인'},
  {id:'condition',label:'컨디션운',desc:'일정과 생활 리듬',topics:['컨디션'],lens:'컨디션'},
] satisfies Array<{id:string;label:string;desc:string;topics:string[];lens:LifeTopic}>
export type FortuneField = typeof FORTUNE_FIELDS[number]
export function fortuneField(id:string|undefined) {return FORTUNE_FIELDS.find(f=>f.id===id)}
