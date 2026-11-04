import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AiInterpretationResponse } from './appTypes'
import type { FortuneField } from './lib/fortuneFields'
import { buildDailyReadingDocument } from './lib/dailyReadingDocument'
import { exportDailyReadingImages } from './lib/readingImageExport'
import './daily-reading.css'
import '@fontsource/nanum-myeongjo/korean-400.css'
import '@fontsource/nanum-myeongjo/korean-700.css'
import '@fontsource/nanum-myeongjo/latin-400.css'
import '@fontsource/nanum-myeongjo/latin-700.css'
import '@fontsource/noto-sans-kr/korean-400.css'
import '@fontsource/noto-sans-kr/korean-700.css'

export function DailyReadingPanel({data,date,field,verified,technicalDetails,onRetry}:{data:NonNullable<AiInterpretationResponse['data']>;date:string;field?:FortuneField;verified:boolean;technicalDetails?:ReactNode;onRetry?:()=>void}) {
  const doc = useMemo(()=>buildDailyReadingDocument(data,date,field,verified),[data,date,field,verified])
  const exportJob = useRef<AbortController | null>(null)
  const [saving,setSaving] = useState(false)
  const [notice,setNotice] = useState('')
  useEffect(()=>{
    setSaving(false); setNotice('')
    return ()=>{exportJob.current?.abort();exportJob.current=null}
  },[doc])
  async function save() {
    if (exportJob.current || doc.state !== 'ready') return
    const job = new AbortController()
    exportJob.current = job; setSaving(true);setNotice('')
    try {
      const result = await exportDailyReadingImages(doc,job.signal)
      if (!job.signal.aborted && !result.cancelled) setNotice(result.shared ? `${result.pages}장 공유 완료` : `${result.pages}장 저장 요청 완료`)
    } catch (e) {
      if (!job.signal.aborted) setNotice(e instanceof Error ? e.message : '이미지를 저장하지 못했어.')
    } finally {
      if (exportJob.current === job) {exportJob.current=null;setSaving(false)}
    }
  }
  return <section className="daily-reading" data-daily-scope={doc.scope} data-daily-state={doc.state}>
    <header className="daily-reading-heading"><span>{doc.title}</span><time dateTime={date}>{date}</time></header>
    {doc.state === 'ready' ? <>
      <h3 className="daily-reading-headline">{doc.headline}</h3>
      <div className="daily-reading-blocks">{doc.blocks.map(b=><section className="daily-reading-block" key={b.id} data-daily-block={b.id}><h4>{b.label}</h4><p>{b.text}</p></section>)}</div>
      <button className="daily-reading-save" type="button" disabled={saving} onClick={save}>{saving?'이미지 만드는 중…':'핵심 해설 이미지 저장'}</button>
      {notice&&<p className="daily-reading-notice" role="status">{notice}</p>}
    </> : <p className="daily-reading-state">{{unverified:'확인된 해설을 아직 불러오지 못했어.',missing:'이 분야의 해설이 아직 완성되지 않았어.',insufficient:'이번 해설에서는 이 분야에 답할 근거를 충분히 연결하지 못했어.',needs_refresh:'기존 해설의 길이나 내용 중복을 다시 확인해야 해. 해설을 새로 불러와줘.'}[doc.state]}</p>}
    {!!doc.details.length&&<details className="daily-reading-details"><summary>상세 해설</summary>{doc.details.map(b=><section className="daily-reading-block" key={b.id} data-daily-detail={b.id}><h4>{b.label}</h4><p>{b.text}</p></section>)}</details>}
    {doc.slots?.some(slot=>slot.state!=='ready')&&<section className="daily-reading-coverage"><h4>세부 질문</h4>{doc.slots.filter(slot=>slot.state!=='ready').map(slot=><p className="daily-reading-state" key={slot.id} data-daily-slot={slot.id} data-slot-state={slot.state}><strong>{slot.label}</strong> · {slot.state==='insufficient'?'이번 계산으로 답할 근거가 충분하지 않아.':'이 저장본에는 아직 해설이 작성되지 않았어.'}</p>)}</section>}
    {onRetry && (doc.state==='missing' || doc.state==='needs_refresh') && <button type="button" className="daily-reading-save" onClick={onRetry}>해설 다시 불러오기</button>}
    {technicalDetails&&<details className="daily-reading-details"><summary>계산 근거 보기</summary>{technicalDetails}</details>}
  </section>
}
