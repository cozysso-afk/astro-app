import { Compass, ShieldCheck, Sparkles, Clock3 } from 'lucide-react'
import type { ReactNode } from 'react'
import { splitReadingReason } from './lib/readingReasonLayers'

export function ReadingExplanation({ kind, children }: { kind: 'reason' | 'practice' | 'caution' | 'timing'; children: ReactNode }) {
  const [Icon, label] = ({ reason: [Sparkles, '왜 이렇게 보냐면'], practice: [Compass, '현실에서'], caution: [ShieldCheck, '주의'], timing: [Clock3, '시기'] } as const)[kind]
  const layeredReason = kind === 'reason' && typeof children === 'string' ? splitReadingReason(children) : null
  const visible = layeredReason?.visible ?? children
  return <div className={`reading-explanation is-${kind}`}><div className="reading-explanation-label"><Icon size={14} aria-hidden="true"/><span>{label}</span></div><p>{visible}</p>{layeredReason?.technical ? <details className="reading-reason-more"><summary>계산 근거 더 보기</summary><p>{layeredReason.technical}</p></details> : null}</div>
}
