import { useRef, useState } from 'react'
import { ImageDown, LoaderCircle } from 'lucide-react'
import { PeriodFortuneNarrativeV2 } from './PeriodFortuneNarrativeV2'
import { exportReadingImages } from './lib/readingImageExport'
import type { AiInterpretationResponse, IntegratedApiResponse } from './appTypes'

export type LiveFortuneQaPayload = {
  jobId: string
  model: string
  periodStart: string
  periodEnd: string
  calculation: IntegratedApiResponse
  interpretation: AiInterpretationResponse
}

declare global {
  interface Window {
    __FORTUNE_LIVE_QA__?: LiveFortuneQaPayload
  }
}

function evidenceRefs(value: unknown, found = new Set<string>()) {
  if (Array.isArray(value)) {
    value.forEach(item => evidenceRefs(item, found))
    return found
  }
  if (!value || typeof value !== 'object') return found
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (key === 'evidence_refs' && Array.isArray(item)) {
      item.forEach(ref => { if (typeof ref === 'string' && ref.trim()) found.add(ref.trim()) })
    } else evidenceRefs(item, found)
  }
  return found
}

export function LiveFortuneQaPreview() {
  const payload = window.__FORTUNE_LIVE_QA__
  const exportRoot = useRef<HTMLElement | null>(null)
  const [exportState, setExportState] = useState('idle')

  if (!payload) {
    return <main className="app-shell" data-qa-live-ready="false"><p>실제 Gemini QA 입력이 없습니다.</p></main>
  }

  const refs = [...evidenceRefs(payload.interpretation.data)].sort()
  const saveImages = async () => {
    if (!exportRoot.current || exportState === 'working') return
    setExportState('working')
    try {
      const result = await exportReadingImages(exportRoot.current, `실제 Gemini 운세 QA · ${payload.periodStart}`)
      setExportState(result.cancelled ? 'cancelled' : `done:${result.pages}`)
    } catch (error) {
      setExportState(`error:${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return <main className="app-shell live-fortune-qa-preview" data-qa-live-ready="true" style={{maxWidth:760,margin:'0 auto',padding:'18px 16px 100px'}}>
    <header className="result-card" data-qa-live-meta>
      <span className="eyebrow">실제 Gemini 응답 기반 모바일 QA</span>
      <h2>V23.9 해설 렌더링 검증</h2>
      <p>QA 전용 가상 프로필의 저장된 Gemini 원문을 재사용합니다. 새 Gemini 호출은 하지 않습니다.</p>
      <small>{payload.model} · {payload.periodStart}{payload.periodStart !== payload.periodEnd ? ` — ${payload.periodEnd}` : ''}</small>
    </header>

    <section ref={node => { exportRoot.current = node }} data-reading-export-root="period-fortune" data-qa-live-root>
      <div className="reading-export-toolbar" data-reading-export-ignore="true">
        <button type="button" data-qa-live-export onClick={saveImages} disabled={exportState === 'working'}>
          {exportState === 'working' ? <LoaderCircle className="reading-export-spinner" size={17}/> : <ImageDown size={17}/>} 실제 응답 이미지 저장
        </button>
        <output data-qa-live-export-status>{exportState}</output>
      </div>
      <PeriodFortuneNarrativeV2
        period="today"
        calculation={payload.calculation}
        result={payload.interpretation}
        technicalDetails={<section data-qa-live-evidence>
          <div className="result-card-title"><span>LIVE TRACE</span><strong>실제 응답 근거 ID</strong></div>
          <p className="result-note">Gemini 해설이 참조한 근거 ID {refs.length}개를 확인합니다. 계산값을 새로 만들거나 해설 문장을 보충하지 않습니다.</p>
          <ul>{refs.map(ref => <li key={ref}>{ref}</li>)}</ul>
        </section>}
      />
    </section>
  </main>
}
