import { BookOpen, BriefcaseBusiness, Compass, Heart, Leaf, MessageCircle, TrendingUp, Users, Wallet, Check } from 'lucide-react'
import type { FortuneFlowCard } from './lib/fortuneUserSummary'

const icons = { 학업: BookOpen, 시험: BookOpen, 직장: BriefcaseBusiness, 이직: Compass, 대인관계: Users, 연애: Heart, 재회: Heart, 연락: MessageCircle, 소식: MessageCircle, 컨디션: Leaf, 금전: Wallet }

export function FortuneFlowCards({ title, items, caution = false }: { title: string; items: FortuneFlowCard[]; caution?: boolean }) {
  const card = (item: FortuneFlowCard) => {
    const Icon = icons[item.topic as keyof typeof icons] ?? TrendingUp
    return <article className="flow-tile" key={item.topic}>
      <div className="flow-tile-heading"><Icon size={17} aria-hidden="true"/><strong>{item.topic}</strong><span className="flow-score">{Math.round(item.score)}</span></div>
      <span className="flow-band">{item.band}</span><p>{item.meaning}</p>
    </article>
  }
  if (!items.length) return <p className="flow-empty"><Check size={15} aria-hidden="true"/>{caution ? '특별히 두드러진 주의 분야는 없어.' : '뚜렷하게 밀어줄 분야는 없어. 평소 계획을 이어가.'}</p>
  return <section className={`flow-section ${caution ? 'is-caution' : 'is-favorable'}`} aria-label={title}>
    <h4>{title}</h4><div className="flow-grid">{items.slice(0, 2).map(card)}</div>
    {items.length > 2 && <details className="flow-more"><summary>더 보기 · {items.length - 2}개 분야</summary><div className="flow-grid">{items.slice(2).map(card)}</div></details>}
  </section>
}
