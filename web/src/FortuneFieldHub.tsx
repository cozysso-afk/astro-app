import { Heart, Wallet, ChartNoAxesCombined, BookOpen, PenLine, BriefcaseBusiness, Compass, Users, MessagesSquare, Leaf } from 'lucide-react'
import { FORTUNE_FIELDS } from './lib/fortuneFields'
const ICONS=[Heart,Wallet,ChartNoAxesCombined,BookOpen,PenLine,BriefcaseBusiness,Compass,Users,MessagesSquare,Leaf]
export function FortuneFieldHub({selected,onSelect}:{selected?:string;onSelect:(id:string|undefined)=>void}) {
 return <details className="fortune-field-hub"><summary>분야별 운세 <small>{FORTUNE_FIELDS.find(f=>f.id===selected)?.label??'궁금한 분야부터 골라봐'}</small></summary><div className="fortune-field-grid">{FORTUNE_FIELDS.map((f,i)=>{const Icon=ICONS[i];return <button type="button" key={f.id} aria-pressed={selected===f.id} onClick={()=>onSelect(f.id)}><Icon size={19}/><span><strong>{f.label}</strong><small>{f.desc}</small></span></button>})}</div>{selected&&<button className="field-reset" type="button" onClick={()=>onSelect(undefined)}>전체 운세로 돌아가기</button>}</details>
}
