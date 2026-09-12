import { useEffect, useRef, useState } from 'react'
import { Sparkles, ChevronDown, Copy, LoaderCircle } from 'lucide-react'
import type { IntegratedApiResponse } from './appTypes'
import { defaultDatingPartnerGender } from './lib/datingArchetype'
import { buildDatingArchetypeV2,celebrityVibes,datingPortraitPromptV2,type NatalDatingStructure,type VisualSettings,type DatingArchetypeV2 } from './lib/datingArchetypeV2'
import { datingPeriodMood,fetchDatingNatal } from './lib/datingNatalTransport'
import { TRAIT_LABELS,type TraitKey } from './lib/datingTraitRules'
import './dating-archetype.css'

const GROUPS:Array<{title:string;keys:TraitKey[]}>= [
 {title:'얼굴',keys:['face_shape_primary','face_shape_secondary','eyes_shape','eye_impression','eyelid_style','nose_bridge','mouth','smile']},
 {title:'체형',keys:['height_band','body_build','proportions']},
 {title:'스타일',keys:['hair','grooming','fashion','first_impression','closer_impression']},
]
const CONFIDENCE={high:'근거 반복 충분',medium:'근거 반복 일부',low:'제한된 근거'}
export function DatingVisualProfile({model,settings,onSettings}:{model:DatingArchetypeV2;settings:VisualSettings;onSettings:(s:VisualSettings)=>void}) {
 const [notice,setNotice]=useState('')
 const references=celebrityVibes(model,settings.gender)
 const prompt=model.evidence_summary.length?datingPortraitPromptV2(model,settings,'ko'):''
 async function copy(language:'ko'|'en') {try{await navigator.clipboard.writeText(datingPortraitPromptV2(model,settings,language));setNotice('초상 프롬프트 복사 완료')}catch{setNotice('복사하지 못했어. 아래 프롬프트를 직접 선택해 복사해줘.')}}
 return <>
  <div className="dating-v2-overview"><strong>{model.traits.overall_vibe?.ko??'지금 자료로는 분위기를 좁히기 어려워'}</strong><p>{model.traits.relative_age?.ko??'연하·또래·연상을 구분할 근거 부족'}{model.ageBand&&<> · {model.ageBand.ko}</>}</p><small>{model.precision==='exact'?'검증된 생시':'생시 제한'} · {CONFIDENCE[model.confidence]}</small></div>
  {GROUPS.map(group=>group.keys.some(k=>model.traits[k])&&<section className="dating-v2-group" key={group.title}><h4>{group.title}</h4><dl>{group.keys.map(k=>model.traits[k]&&<div key={k}><dt>{TRAIT_LABELS[k]}</dt><dd>{model.traits[k]!.ko}</dd></div>)}</dl></section>)}
  {model.traits.animal_type_primary&&<div className="dating-v2-animal"><span>동물상 · 시각적 비유</span><strong>{model.traits.animal_type_primary.ko}{model.traits.animal_type_secondary&&` + ${model.traits.animal_type_secondary.ko}`}</strong></div>}
  {!!model.attraction_points_top3.length&&<section className="dating-v2-group"><h4>매력 포인트</h4><ol className="dating-v2-attractions">{model.attraction_points_top3.map(p=><li key={p.key}><strong>{p.label}</strong><span>{p.description}</span></li>)}</ol></section>}
  {!!references.length&&<details className="dating-v2-disclosure"><summary>무드 레퍼런스 · FUN <ChevronDown size={15}/></summary><p>{references.join(' · ')}</p><small>표정과 스타일을 설명하기 위한 부분 참고야. 같은 외모라는 뜻은 아니며 이미지 프롬프트에는 이름을 넣지 않아.</small></details>}
  <details className="dating-v2-disclosure"><summary>차트 근거와 세부 특징 <ChevronDown size={15}/></summary><ul>{model.evidence_summary.map(e=><li key={e.id}>{e.label}</li>)}</ul><dl className="dating-v2-evidence">{Object.entries(model.traits).map(([key,t])=><div key={key}><dt>{TRAIT_LABELS[key as TraitKey]} · {CONFIDENCE[t.confidence]}</dt><dd>{t.ko}<small>{t.evidence.map(id=>model.evidence_summary.find(e=>e.id===id)?.label).filter(Boolean).join(' / ')}</small></dd></div>)}</dl>{model.limitations.map(t=><p key={t}>{t}</p>)}</details>
  {!!prompt&&<details className="dating-v2-disclosure dating-v2-portrait"><summary><span>이 느낌을 이미지로 보기</span><ChevronDown size={16}/></summary>
   <div className="dating-v2-controls">
    <label>인물 배경<select value={settings.background} onChange={e=>onSettings({...settings,background:e.target.value as VisualSettings['background']})}><option value="korean">한국인 중심</option><option value="east_asian">동아시아 중심</option><option value="unrestricted">제한 없음</option></select></label>
    <label>성별<select value={settings.gender} onChange={e=>onSettings({...settings,gender:e.target.value as VisualSettings['gender']})}><option value="male">남성</option><option value="female">여성</option><option value="neutral">중립</option></select></label>
    <label>스타일<select value={settings.style} onChange={e=>onSettings({...settings,style:e.target.value as VisualSettings['style']})}><option value="real">실사</option><option value="dream">몽환 실사</option><option value="illustration">일러스트</option></select></label>
    <label>구도<select value={settings.frame} onChange={e=>onSettings({...settings,frame:e.target.value as VisualSettings['frame']})}><option value="face">얼굴</option><option value="half">상반신</option><option value="full">전신</option></select></label>
    <label>장면<select value={settings.scene} onChange={e=>onSettings({...settings,scene:e.target.value as VisualSettings['scene']})}><option value="daily">일상</option><option value="meeting">첫 만남</option><option value="date">데이트</option></select></label>
   </div><small>인물 배경·성별은 그림 설정이야. 차트에서 국적이나 성적 지향을 추정하지 않아.</small>
   <div className="dating-v2-copy"><button type="button" onClick={()=>void copy('ko')}><Copy size={15}/>한국어 프롬프트 복사</button><button type="button" onClick={()=>void copy('en')}>English Prompt Copy</button></div><p role="status">{notice}</p><details><summary>현재 프롬프트 보기</summary><pre>{prompt}</pre></details>
  </details>}
 </>
}
export function DatingArchetypePanel({calculation,profileGender,profile,apiBase,initialNatal}:{calculation:IntegratedApiResponse;profileGender?:unknown;profile?:Record<string,unknown>;apiBase?:string;initialNatal?:NatalDatingStructure}) {
 const [natal,setNatal]=useState(initialNatal)
 const [loading,setLoading]=useState(false),[error,setError]=useState('')
 const [asOf]=useState(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`})
 const [settings,setSettings]=useState<VisualSettings>({gender:defaultDatingPartnerGender(profileGender),background:'korean',style:'real',frame:'half',scene:'meeting'})
 const request=useRef<AbortController|null>(null)
 useEffect(()=>()=>{request.current?.abort();request.current=null},[])
 async function load(){if(!profile||!apiBase||request.current)return;const controller=new AbortController();request.current=controller;setLoading(true);setError('');const timer=window.setTimeout(()=>controller.abort(),45000)
  try{const data=await fetchDatingNatal(apiBase,profile,calculation.period.start,controller.signal);if(!controller.signal.aborted)setNatal(data)}catch{if(request.current===controller)setError('출생차트를 불러오지 못했어. 잠시 후 다시 시도해줘.')}finally{window.clearTimeout(timer);if(request.current===controller){request.current=null;setLoading(false)}}
 }
 const model=natal?buildDatingArchetypeV2(natal,{birthDate:String(profile?.birth_date??''),asOf,periodMood:datingPeriodMood(calculation)}):undefined
 return <section className="dating-v2"><header><span className="dating-v2-icon"><Sparkles size={21}/></span><div><small>FUN · 차트 기반 아키타입</small><h3>다음 연애상대 느낌</h3></div></header>
  {model?<DatingVisualProfile model={model} settings={settings} onSettings={setSettings}/>:<div className="dating-v2-start"><p>출생 금성과 연애 하우스의 실제 배치를 함께 읽어 전체 인상·얼굴·체형·스타일을 조합해.</p><button type="button" disabled={loading||!profile||!apiBase} onClick={()=>void load()}>{loading?<><LoaderCircle size={16} className="spin"/>출생차트 확인 중…</>:'출생차트로 느낌 보기'}</button>{(!profile||!apiBase)&&<small>이 기록에는 출생정보가 연결돼 있지 않아. 프로필로 운세를 다시 열어줘.</small>}<p role="status">{error}</p></div>}
  <p className="dating-v2-note">실제 미래 인물의 외모를 맞히는 기능이 아니라, 차트에서 읽히는 관계·취향 아키타입을 시각화한 결과야.</p>
 </section>
}
