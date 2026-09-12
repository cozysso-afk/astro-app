import { Copy } from 'lucide-react'
import type { ExternalCopyMode } from './lib/compactDeepPrompt'

export function ExternalPromptCopy({ onCopy }: { onCopy: (mode: ExternalCopyMode) => void }) {
  return <div className="external-prompt-copy">
    <button type="button" onClick={()=>onCopy('compact')}><Copy size={15}/>AI 심층해설 프롬프트 복사</button>
    <small>대부분의 AI 앱에 붙여넣기 쉬운 압축형</small>
    <details><summary>전체 근거 프롬프트</summary>
      <button type="button" onClick={()=>onCopy('full')}><Copy size={15}/>전체 근거 프롬프트 복사</button>
      <small>입력 한도가 넉넉한 AI용 · 근거 최대 보존</small>
    </details>
  </div>
}
