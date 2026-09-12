import { Compass, ShieldCheck, Sparkles, Clock3 } from 'lucide-react'
import type { ReactNode } from 'react'

export function ReadingExplanation({ kind, children }: { kind: 'reason' | 'practice' | 'caution' | 'timing'; children: ReactNode }) {
  const [Icon, label] = ({ reason: [Sparkles, '왜 이렇게 보냐면'], practice: [Compass, '현실에서'], caution: [ShieldCheck, '주의'], timing: [Clock3, '시기'] } as const)[kind]
  return <div className={`reading-explanation is-${kind}`}><div className="reading-explanation-label"><Icon size={14} aria-hidden="true"/><span>{label}</span></div><p>{children}</p></div>
}
