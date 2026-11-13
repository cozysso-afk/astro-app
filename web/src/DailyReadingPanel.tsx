import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AiInterpretationResponse, IntegratedApiResponse } from './appTypes'
import type { FortuneField } from './lib/fortuneFields'
import { useObservedPassage } from './ContactObservationScope'
import { buildDailyReadingDocument, type DailyReadingDocument } from './lib/dailyReadingDocument'
import { exportDailyReadingImages } from './lib/readingImageExport'
import './daily-reading.css'
import '@fontsource/nanum-myeongjo/korean-400.css'
import '@fontsource/nanum-myeongjo/korean-700.css'
import '@fontsource/nanum-myeongjo/latin-400.css'
import '@fontsource/nanum-myeongjo/latin-700.css'
import '@fontsource/noto-sans-kr/korean-400.css'
import '@fontsource/noto-sans-kr/korean-700.css'

export function DailyReadingPanel({data,date,field,verified,technicalDetails,onRetry}:{calculation?:IntegratedApiResponse;data:NonNullable<AiInterpretationResponse['data']>;date:string;field?:FortuneField;verified:boolean;technicalDetails?:ReactNode;onRetry?:()=>void}) {
  const original = useMemo(()=>buildDailyReadingDocument(data,date,field,verified),[data,date,field,verified])
  return <DailyReadingDocumentView original={original} technicalDetails={technicalDetails} onRetry={onRetry}/>
}

export function DailyReadingDocumentView({original,technicalDetails,onRetry}:{original:DailyReadingDocument;technicalDetails?:ReactNode;onRetry?:()=>void}) {
  const doc=original
  const date=doc.date
  const observed = useObservedPassage('today',doc.scope)
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
  const relationshipLabels: Record<string, string> = {
    'relationship.contact_activation': '연락운',
    'relationship.contact_continuity': '대화가 이어질 조건',
  }
  const featured = doc.scope === 'love'
    ? (doc.slots ?? []).filter(slot => relationshipLabels[slot.id])
    : []
  const featuredIds = new Set(featured.map(slot => slot.id))
  const directions = doc.details.filter(block=>block.id.startsWith('direction:'))
  const scenarioLabels:Record<string,string>={single:'솔로 · 새 인연',crush:'짝사랑',flirting:'썸',ambiguous:'애매한 관계',couple:'연애 중',reunion_interest:'재회'}
  const scenarios=doc.scope==='love' && doc.state!=='unverified' ? Object.entries(scenarioLabels).map(([key,label])=>{
    const id='relationship.love_'+key
    const slot=doc.slots?.find(slot=>slot.id===id)
    const blocks=doc.details.filter(block=>block.id.startsWith(id+':'))
    return {key,id,label,slot,blocks}
  }).filter(row=>row.slot || row.blocks.length) : []
  const scenarioIds = new Set(scenarios.flatMap(row=>row.blocks.map(block=>block.id)))
  const otherDetails = doc.details.filter(block => !scenarioIds.has(block.id) && !block.id.startsWith('direction:') && !featuredIds.has(block.id.split(':')[0]))
  return <section className="daily-reading" data-daily-scope={doc.scope} data-daily-state={doc.state}>
    <header className="daily-reading-heading"><span>{doc.title}</span><time dateTime={date}>{date}</time></header>

    {doc.state === 'ready' ? <>
      <h3 className="daily-reading-headline">{doc.headline}</h3>
      <div className="daily-reading-blocks">{doc.blocks.map(b=><section className="daily-reading-block" key={b.id} data-daily-block={b.id}><h4>{b.label}</h4><p>{b.text}</p></section>)}</div>
    </> : <p className="daily-reading-state">{{unverified:'확인된 해설을 아직 불러오지 못했어.',missing:'이 분야의 해설이 아직 완성되지 않았어.',insufficient:'이번 해설에서는 이 분야에 답할 근거를 충분히 연결하지 못했어.',needs_refresh:'기존 해설의 길이나 내용 중복을 다시 확인해야 해. 해설을 새로 불러와줘.'}[doc.state]}</p>}
    {observed && <aside className="daily-reading-block" aria-label="내가 기록한 연락"><h4>내가 기록한 연락</h4><p>{observed.fact}</p></aside>}
    {directions.map(block=><section className="daily-reading-block" key={block.id} data-daily-detail={block.id}>
      <h4>{block.label}</h4><p>{block.text}</p>
    </section>)}
    {featured.map(slot => {
      const label = relationshipLabels[slot.id]
      if (slot.state !== 'ready') {
        return <p className="daily-reading-state" key={slot.id} data-daily-slot={slot.id} data-slot-state={slot.state}>
          <strong>{label}</strong> · {slot.state === 'insufficient' ? '판단할 근거가 부족해.' : '이 항목의 해설이 없어.'}
        </p>
      }
      return <details className="daily-reading-details" key={slot.id} data-daily-slot={slot.id} data-slot-state="ready">
        <summary>{label}</summary>
        {doc.details.filter(block => block.id.startsWith(slot.id + ':')).map(block =>
          <section className="daily-reading-block" key={block.id} data-daily-detail={block.id}>
            <h4>{block.label}</h4><p>{block.text}</p>
          </section>
        )}
      </details>
    })}
    {scenarios.length>0 && <section className="daily-reading-block"><h4>내 상황에 맞춰 보기</h4>
      {scenarios.map(row=><details className="daily-reading-details" key={row.key} data-daily-slot={row.id} data-slot-state={row.slot?.state ?? 'ready'}>
        <summary>{row.label}</summary>
        {row.blocks.length ? row.blocks.map(block=><section className="daily-reading-block" key={block.id}><h4>{block.label}</h4><p>{block.text}</p></section>) : <p>{row.slot?.state==='insufficient' ? '이 상황을 판단할 근거가 부족해.' : '이 상황의 해설은 아직 작성되지 않았어.'}</p>}
      </details>)}
    </section>}
    {!!otherDetails.length&&<details className="daily-reading-details"><summary>상세 해설</summary>{otherDetails.map(b=><section className="daily-reading-block" key={b.id} data-daily-detail={b.id}><h4>{b.label}</h4><p>{b.text}</p></section>)}</details>}
    {(['missing','insufficient'] as const).map(state=>{const slots=doc.slots?.filter(slot=>slot.state===state && !featuredIds.has(slot.id) && !scenarios.some(row=>row.id===slot.id))??[];return slots.length?<details className="daily-reading-coverage" key={state}><summary>{state==='missing'?'아직 작성되지 않은 항목':'근거가 부족한 항목'} {slots.length}개</summary><ul>{slots.map(slot=><li key={slot.id} data-daily-slot={slot.id} data-slot-state={state}>{slot.label}</li>)}</ul></details>:null})}
    {onRetry && (doc.state==='missing' || doc.state==='needs_refresh') && <button type="button" className="daily-reading-save" onClick={onRetry}>해설 다시 불러오기</button>}
    {doc.state==='ready' && <>      <button className="daily-reading-save" type="button" disabled={saving} onClick={save}>{saving?'이미지 만드는 중…':'핵심 해설 이미지 저장'}</button>
      {notice&&<p className="daily-reading-notice" role="status">{notice}</p>}
</>}
    {technicalDetails&&<details className="daily-reading-details"><summary>계산 근거 보기</summary>{technicalDetails}</details>}
  </section>
}
