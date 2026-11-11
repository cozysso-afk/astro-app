import {useEffect,useRef,useState,type ReactNode} from 'react'
import type {AuthoredReadingDocument,AuthoredBlock} from './lib/authoredReadingDocument'
import {weeklyEvidenceLimit} from './lib/weeklyQuestionEvidence'
import type {MonthSupplement} from './lib/monthlyLoveSupplement'
import {exportAuthoredReadingImages} from './lib/readingImageExport'
import './authored-reading.css'
import '@fontsource/nanum-myeongjo/korean-400.css'
import '@fontsource/nanum-myeongjo/korean-700.css'
import '@fontsource/nanum-myeongjo/latin-400.css'
import '@fontsource/nanum-myeongjo/latin-700.css'
import '@fontsource/noto-sans-kr/korean-400.css'
import '@fontsource/noto-sans-kr/korean-700.css'

const loveQuestions = [
  ['single','솔로 · 새 인연','새 사람과 가까워질 계기는?'],
  ['crush','짝사랑','내 호감이 일방적인지 어떻게 살필까?'],
  ['flirting','썸','서로 느낀 호감이 다음 만남으로 이어질까?'],
  ['ambiguous','애매한 관계','서로 기대하는 관계가 같을까?'],
  ['couple','연애 중','함께 지내며 무엇을 맞춰 가면 좋을까?'],
  ['reunion_interest','재회','다시 연락하는 일과 관계를 회복하는 일은 어디까지 왔을까?'],
] as const

function Blocks({blocks}:{blocks:AuthoredBlock[]}) {
  return <>{blocks.map(b=><section className="authored-reading-block" data-reading-block={b.id} key={b.id}><h4>{b.label}</h4><p>{b.text}</p></section>)}</>
}
export function AuthoredReadingPanel({doc,technicalDetails,supplements=[],period,onRefresh}:{doc:AuthoredReadingDocument;technicalDetails?:ReactNode;supplements?:MonthSupplement[];period?:string;onRefresh?:()=>void}) {
  const weekly=period==='week'
  const periodLabel=weekly?'주간':'월간'
  const job=useRef<AbortController|null>(null)
  const [saving,setSaving]=useState(false)
  const [notice,setNotice]=useState('')
  const scenarios = doc.scope === 'love' ? loveQuestions.flatMap(([key,label,question])=>{
    const id='relationship.love_'+key
    const section=doc.sections.find(row=>row.id===id)
    const calculated=supplements.find(row=>row.id===id)
    if(!section || !(section.blocks.length || calculated)) return []
    return [{id,label,question,section,calculated}]
  }) : []
  const scenarioIds=new Set(scenarios.map(row=>row.id))
  const remainingSupplements=supplements.filter(row=>!scenarioIds.has(row.id))
  const authored=doc.sections.filter(section=>!scenarioIds.has(section.id)).filter(section=>section.state==='ready'&&section.blocks.length)
  const supplemented=new Set(supplements.map(row=>row.id))
  const missing=doc.sections.filter(section=>section.state==='missing' && !supplemented.has(section.id))
  const insufficient=doc.sections.filter(section=>section.state==='insufficient')
  useEffect(()=>{setSaving(false);setNotice('');return()=>{job.current?.abort();job.current=null}},[doc.revision])
  async function save(){
    if(job.current||doc.state!=='ready')return
    const controller=new AbortController();job.current=controller;setSaving(true);setNotice('')
    try{const result=await exportAuthoredReadingImages(doc,controller.signal);if(!controller.signal.aborted)setNotice(result.cancelled?'공유를 취소했어.':result.shared?`${result.pages}장 공유 완료`:`${result.pages}장 저장 요청 완료`)}
    catch(error){if(!controller.signal.aborted)setNotice(error instanceof Error?error.message:'이미지를 준비하지 못했어.')}
    finally{if(job.current===controller){job.current=null;setSaving(false)}}
  }
  return <section className="authored-reading" data-authored-scope={doc.scope} data-authored-state={doc.state} data-authored-revision={doc.revision}>
    <header><span>{doc.title}</span>{doc.date&&<time>{doc.date}</time>}</header>
    {doc.headline&&<h3 className="authored-reading-headline">{doc.headline}</h3>}
    {doc.state==='unverified'?<p className="authored-reading-state">확인된 해설을 아직 불러오지 못했어.</p>:<>
      {doc.state!=='ready'&&<p className="authored-reading-state">이 저장본의 핵심 요약이 아직 완성되지 않았어. 작성된 상세 해설은 아래에서 볼 수 있어.</p>}
      <div className="authored-reading-core"><Blocks blocks={doc.core}/></div>
      {doc.state==='ready'&&!!doc.exportBlockIds.length&&<button className="authored-reading-save" type="button" onClick={save} disabled={saving}>{saving?'이미지 만드는 중…':`${doc.title} 핵심 이미지 저장`}</button>}
      {doc.state==='ready'&&!doc.exportBlockIds.length&&<p className="authored-reading-state">이 원고에는 행동·확인점이 따로 작성되지 않았어. 기간 해설은 그대로 읽을 수 있어.</p>}
      {notice&&<p className="authored-reading-notice" role="status">{notice}</p>}
      {!!scenarios.length&&<section className="authored-reading-section" aria-label="내 상황에 맞춰 보기">
        <h3>내 상황에 맞춰 보기</h3>
        {scenarios.map(({id,label,question,section,calculated})=><details className="authored-reading-details" key={id} data-reading-section={id}>
          <summary>{label}</summary><h4>{question}</h4>
          {section.blocks.length ? <Blocks blocks={section.blocks}/> : calculated && <><p>{calculated.text}</p><small>{periodLabel} 계산 근거 · {calculated.evidence}</small></>}
        </details>)}
      </section>}
      {!!authored.length&&<details className="authored-reading-details" open={doc.state!=='ready'}><summary>질문별 상세 해설</summary>{authored.map(section=><section className="authored-reading-section" key={section.id} data-reading-section={section.id}><h3>{section.label}</h3><Blocks blocks={section.blocks}/></section>)}</details>}
      {!!remainingSupplements.length&&<section className="authored-reading-section"><h3>{periodLabel} 계산값으로 본 {doc.scope==='love'?'애정운':'분야별 해설'}</h3>
        <p>{weekly?'이번 주에 계산된 지표를 각 질문에 적용했어.':'기존 원고에 빠진 질문을 이달의 서양점성술 계산값으로 풀었어.'}</p>
        {remainingSupplements.map(row=><details className="authored-reading-details" key={row.id} data-calculated-section={row.id}><summary>{row.label}</summary><p>{row.text}</p><small>{row.evidence}</small></details>)}
      </section>}
      {onRefresh&&<button className="authored-reading-save" type="button" onClick={onRefresh}>{periodLabel} AI 해설 다시 작성</button>}
      {!!missing.length&&<details className="authored-reading-coverage"><summary>아직 작성되지 않은 항목 {missing.length}개</summary><ul>{missing.map(section=><li key={section.id} data-reading-section={section.id} data-section-state="missing">{section.label}</li>)}</ul></details>}
      {!!insufficient.length&&<details className="authored-reading-coverage"><summary>근거가 부족한 항목 {insufficient.length}개</summary>{weekly&&<p>{weeklyEvidenceLimit}</p>}<ul>{insufficient.map(section=><li key={section.id} data-reading-section={section.id} data-section-state="insufficient">{section.label}</li>)}</ul></details>}
    </>}
    {technicalDetails&&<details className="authored-reading-technical"><summary>계산 근거 자세히 보기</summary>{technicalDetails}</details>}
  </section>
}
