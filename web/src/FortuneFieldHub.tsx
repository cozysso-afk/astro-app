import { Heart, Wallet, ChartNoAxesCombined, BookOpen, PenLine, BriefcaseBusiness, Compass, Users, MessagesSquare, Leaf } from 'lucide-react'
import { FORTUNE_FIELDS } from './lib/fortuneFields'
const ICONS=[Heart,Wallet,ChartNoAxesCombined,BookOpen,PenLine,BriefcaseBusiness,Compass,Users,MessagesSquare,Leaf]
export function FortuneFieldHub({selected,onSelect}:{selected?:string;onSelect:(id:string|undefined)=>void}) {
 return <section className="fortune-field-hub" aria-label="분야별 운세"><div className="field-hub-heading"><strong>분야별 운세</strong><small>{FORTUNE_FIELDS.find(f=>f.id===selected)?.label??'궁금한 분야부터 골라봐'}</small></div><p className="field-hub-help">기간운세와 별도로 보는 화면 · 오늘·주간·월간·연간</p><div className="fortune-field-grid">{FORTUNE_FIELDS.map((f,i)=>{const Icon=ICONS[i];return <button type="button" key={f.id} aria-pressed={selected===f.id} onClick={()=>onSelect(f.id)}><Icon size={19}/><span><strong>{f.label}</strong><small>{f.desc}</small></span></button>})}</div>{selected&&<button className="field-reset" type="button" onClick={()=>onSelect(undefined)}>분야 선택 해제</button>}</section>
}
