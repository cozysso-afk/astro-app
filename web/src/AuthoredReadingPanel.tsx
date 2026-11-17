import {useEffect, useRef, useState, type ReactNode} from 'react'
import type {AuthoredReadingDocument, AuthoredBlock} from './lib/authoredReadingDocument'
import {useObservedPassage} from './ContactObservationScope'
import {exportAuthoredReadingImages} from './lib/readingImageExport'
import './authored-reading.css'
import '@fontsource/nanum-myeongjo/korean-400.css'
import '@fontsource/nanum-myeongjo/korean-700.css'
import '@fontsource/nanum-myeongjo/latin-400.css'
import '@fontsource/nanum-myeongjo/latin-700.css'
import '@fontsource/noto-sans-kr/korean-400.css'
import '@fontsource/noto-sans-kr/korean-700.css'

function Blocks({blocks}:{blocks:AuthoredBlock[]}) {
  return <>{blocks.map(b=><section className="authored-reading-block" data-reading-block={b.id} key={b.id}>{b.label&&<h4>{b.label}</h4>}<p>{b.text}</p></section>)}</>
}

type Props = {doc:AuthoredReadingDocument; technicalDetails?:ReactNode; period?:string; onRefresh?:()=>void}
export function AuthoredReadingPanel({doc,technicalDetails,period,onRefresh}:Props) {
  const observed = useObservedPassage(period ?? '',doc.scope)
  const job = useRef<AbortController|null>(null)
  const [saving,setSaving] = useState(false)
  const [notice,setNotice] = useState('')
  useEffect(()=>{
    setSaving(false)
    setNotice('')
    return ()=>{job.current?.abort();job.current=null}
  },[doc.revision])
  const canSave = doc.state==='ready' && doc.exportBlockIds.length>0
  async function save(){
    if(job.current || !canSave)return
    const controller=new AbortController()
    job.current=controller
    setSaving(true)
    setNotice('')
    try {
      const result=await exportAuthoredReadingImages(doc,controller.signal)
      if(!controller.signal.aborted)setNotice(result.cancelled?'공유를 취소했어.':result.shared?`${result.pages}장 공유 완료`:`${result.pages}장 저장 요청 완료`)
    } catch(error) {
      if(!controller.signal.aborted)setNotice(error instanceof Error?error.message:'이미지를 준비하지 못했어.')
    } finally {
      if(job.current===controller){job.current=null;setSaving(false)}
    }
  }
  const trusted = doc.state !== 'unverified' && doc.state !== 'calculated'
  const coreIds = new Set(doc.core.map(b=>b.id))
  const written = doc.sections.filter(s=>s.state==='ready' && s.blocks.some(b=>!coreIds.has(b.id)))
  const periodLabel = period==='week'?'주간':period==='month'?'월간':period==='year'?'연간':''
  return <section className="authored-reading" data-authored-scope={doc.scope} data-authored-state={doc.state} data-authored-revision={doc.revision}>
    <header><span>{doc.title}</span>{doc.date && <time>{doc.date}</time>}</header>
    {trusted ? <>
      {doc.headline && <h3 className="authored-reading-headline">{doc.headline}</h3>}
      <div className="authored-reading-core"><Blocks blocks={doc.core}/></div>
      {canSave && <button className="authored-reading-save" type="button" onClick={save} disabled={saving}>{saving?'이미지 만드는 중…':`${doc.title} 핵심 이미지 저장`}</button>}
      {notice && <p className="authored-reading-notice" role="status">{notice}</p>}
      {written.length>0 && <details className="authored-reading-details" open={doc.state!=='ready' && !doc.core.length}>
        <summary>질문별 상세 해설</summary>
        {written.map(s=><section className="authored-reading-section" key={s.id} data-reading-section={s.id}><h3>{s.label}</h3><Blocks blocks={s.blocks.filter(b=>!coreIds.has(b.id))}/></section>)}
      </details>}
      {/* Unwritten and weak sections are not listed to the reader. */}
    </> : <p className="authored-reading-state">작성자가 확인된 Gemini 해설이 없어.</p>}
    {observed && <aside className="authored-reading-block" aria-label="내가 기록한 연락"><h4>내가 기록한 연락</h4><p>{observed.fact}</p></aside>}
    {onRefresh && <button className="authored-reading-save" type="button" onClick={onRefresh}>{periodLabel} AI 해설 다시 작성</button>}
    {technicalDetails && <details className="authored-reading-technical"><summary>계산 근거 자세히 보기</summary>{technicalDetails}</details>}
  </section>
}
