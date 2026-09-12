import { createContext, useContext } from 'react'
import { LogOut } from 'lucide-react'

// Placement only: AuthGate still owns sign-out and all authorization state.
export const AccountActionsContext = createContext<{ logout: () => Promise<void>; busy: boolean } | null>(null)

export function AccountActions() {
  const account = useContext(AccountActionsContext)
  if (!account) return null
  return <section className="settings-account"><h3>계정</h3><button type="button" onClick={() => void account.logout()} disabled={account.busy}><LogOut size={18}/>{account.busy ? '로그아웃 중…' : '로그아웃'}</button></section>
}
