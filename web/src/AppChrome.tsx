import { History, Home, Moon, Settings, User } from 'lucide-react'

import type { MainView } from './appTypes'

export function AppHeader() {
  return <section className="hero-card">
    <div className="hero-orbit hero-orbit-a"/>
    <div className="hero-orbit hero-orbit-b"/>
    <div className="hero-star hero-star-a"/>
    <div className="hero-star hero-star-b"/>
    <div className="hero-kicker">CELESTIAL OBSERVATORY</div>
    <div className="hero-row">
      <div className="hero-sigil"><Moon size={24} strokeWidth={1.7}/></div>
      <div><h1>별빛의 운명</h1><p>시간의 흐름과 삶의 패턴을 읽는 개인 관측실</p></div>
    </div>
  </section>
}

type BottomNavigationProps = {
  activeView: MainView
  onChange: (view: MainView) => void
}

const navigationItems = [
  { view: 'home' as const, label: '홈', icon: Home },
  { view: 'profile' as const, label: '내정보', icon: User },
  { view: 'history' as const, label: '기록', icon: History },
  { view: 'settings' as const, label: '설정', icon: Settings },
]

export function BottomNavigation({ activeView, onChange }: BottomNavigationProps) {
  return <nav className="bottom-nav" aria-label="하단 탐색">
    {navigationItems.map(({ view, label, icon: Icon }) => <button
      className={`nav-item ${activeView === view ? 'is-active' : ''}`}
      key={view}
      type="button"
      aria-current={activeView === view ? 'page' : undefined}
      onClick={() => onChange(view)}
    >
      <Icon size={20}/>
      <span>{label}</span>
    </button>)}
  </nav>
}
