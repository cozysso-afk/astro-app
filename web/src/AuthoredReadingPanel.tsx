import {useEffect,useRef,useState,type ReactNode} from 'react'
import type {AuthoredReadingDocument,AuthoredBlock} from './lib/authoredReadingDocument'
import {exportAuthoredReadingImages} from './lib/readingImageExport'
import './authored-reading.css'
import '@fontsource/nanum-myeongjo/korean-400.css'
import '@fontsource/nanum-myeongjo/korean-700.css'
import '@fontsource/nanum-myeongjo/latin-400.css'
import '@fontsource/nanum-myeongjo/latin-700.css'
import '@fontsource/noto-sans-kr/korean-400.css'
import '@fontsource/noto-sans-kr/korean-700.css'

function Blocks({blocks}:{blocks:AuthoredBlock[]}) {
  return <>{blocks.map(b=><section className="authored-reading-block" data-reading-block={b.id} key={b.id}><h4>{b.label}</h4><p>{b.text}</p></section>)}</>
}
export function AuthoredReadingPanel({doc,technicalDetails}:{doc:AuthoredReadingDocument;technicalDetails?:ReactNode}) {
  const job=useRef<AbortController|null>(null)
  const [saving,setSaving]=useState(false)
  const [notice,setNotice]=useState('')
  const authored=doc.sections.filter(section=>section.state==='ready'&&section.blocks.length)
  const missing=doc.sections.filter(section=>section.state==='missing')
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
      {!!authored.length&&<details className="authored-reading-details" open={doc.state!=='ready'}><summary>질문별 상세 해설</summary>{authored.map(section=><section className="authored-reading-section" key={section.id} data-reading-section={section.id}><h3>{section.label}</h3><Blocks blocks={section.blocks}/></section>)}</details>}
      {!!missing.length&&<details className="authored-reading-coverage"><summary>아직 작성되지 않은 항목 {missing.length}개</summary><ul>{missing.map(section=><li key={section.id} data-reading-section={section.id} data-section-state="missing">{section.label}</li>)}</ul></details>}
      {!!insufficient.length&&<details className="authored-reading-coverage"><summary>근거가 부족한 항목 {insufficient.length}개</summary><ul>{insufficient.map(section=><li key={section.id} data-reading-section={section.id} data-section-state="insufficient">{section.label}</li>)}</ul></details>}
    </>}
    {technicalDetails&&<details className="authored-reading-technical"><summary>계산 근거 자세히 보기</summary>{technicalDetails}</details>}
  </section>
}
