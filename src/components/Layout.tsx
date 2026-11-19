import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BadgeCheck,
  CreditCard,
  FlaskConical,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Radio,
  ScrollText,
  Video,
  ShieldCheck,
  UserCog,
  Sun,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '../lib/format'
import type { Theme } from '../lib/theme'
import { ROLE_LABEL } from '../lib/api'
import { useAdmin } from './ui'

const groups: Array<{ title: string; items: Array<{ to: string; label: string; icon: LucideIcon }> }> = [
  {
    title: 'Money',
    items: [
      { to: '/', label: 'Overview', icon: LayoutDashboard },
      { to: '/finance', label: 'Finance', icon: Wallet },
      { to: '/deposits', label: 'Deposits', icon: ArrowDownToLine },
      { to: '/withdrawals', label: 'Withdrawals', icon: ArrowUpFromLine },
    ],
  },
  {
    title: 'People',
    items: [
      { to: '/users', label: 'Users', icon: Users },
      { to: '/verification', label: 'Verification', icon: BadgeCheck },
      { to: '/payment-methods', label: 'Payment methods', icon: CreditCard },
      { to: '/live', label: 'Live sessions', icon: Video },
    ],
  },
  {
    title: 'Platform',
    items: [
      { to: '/markets', label: 'Markets', icon: Radio },
      { to: '/logs', label: 'Logs', icon: ScrollText },
      { to: '/test-bench', label: 'Test bench', icon: FlaskConical },
      { to: '/activity', label: 'Activity', icon: History },
    ],
  },
  {
    title: 'You',
    items: [
      { to: '/account', label: 'Account', icon: UserCog },
      { to: '/admins', label: 'Admins', icon: ShieldCheck },
    ],
  },
]

export function Wordmark({ dark }: { dark?: boolean }) {
  return (
    <span className="flex items-baseline gap-3">
      <span className="font-brand text-[1.0625rem] font-bold tracking-[-0.02em]">
        obis<span className="border-b-2 border-[#00BF63] pb-px">flow</span>
      </span>
      <span className={cn('type-label', dark ? 'text-paper/50' : 'text-muted')}>Admin</span>
    </span>
  )
}

const marketerGroups: typeof groups = [
  {
    title: 'Marketing',
    items: [
      { to: '/', label: 'My live sessions', icon: Video },
      { to: '/account', label: 'Account', icon: UserCog },
    ],
  },
]

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { me } = useAdmin()
  const shown = me.role === 'marketer' ? marketerGroups : groups
  return (
    <div className="flex h-full flex-col px-4 pb-4 pt-6">
      <div className="px-3">
        <Wordmark dark />
      </div>
      <nav aria-label="Admin" className="mt-7 space-y-6">
        {shown.map((group) => (
          <div key={group.title}>
            <p className="type-label px-3 pb-2 text-paper/35">{group.title}</p>
            <ul className="space-y-0.5">
              {group.items.filter((item) => item.to !== '/admins' || me.role === 'superadmin').map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 border-l-2 px-3 py-2 text-sm transition-colors',
                        isActive ? 'border-[#00BF63] bg-paper/10 text-paper' : 'border-transparent text-paper/65 hover:bg-paper/5 hover:text-paper',
                      )
                    }
                  >
                    <item.icon size={17} aria-hidden="true" />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <p className="mt-auto px-3 pt-6 text-xs leading-relaxed text-paper/45">Every change here is logged under Activity.</p>
    </div>
  )
}

export function Layout({ theme, onTheme }: { theme: Theme; onTheme: (theme: Theme) => void }) {
  const { signOut, me } = useAdmin()
  const [menuOpen, setMenuOpen] = useState(false)
  const next = theme === 'dark' ? 'light' : 'dark'

  return (
    <div className="min-h-svh lg:pl-60">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 overflow-y-auto bg-ink text-paper lg:block">
        <Sidebar />
      </aside>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-ink px-5 text-paper lg:hidden">
        <Wordmark dark />
        <button
          type="button"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
          className="-mr-2 flex size-10 items-center justify-center"
        >
          {menuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
        </button>
      </header>
      {menuOpen && (
        <div className="fixed inset-x-0 bottom-0 top-14 z-20 overflow-y-auto bg-ink text-paper lg:hidden">
          <Sidebar onNavigate={() => setMenuOpen(false)} />
        </div>
      )}

      <div className="sticky top-14 z-20 flex h-14 items-center justify-end gap-2 border-b border-line bg-bg/90 px-4 backdrop-blur-md lg:top-0">
        <NavLink to="/account" className="mr-auto flex min-w-0 items-center gap-2 text-sm lg:mr-2">
          <span className="flex size-8 shrink-0 items-center justify-center bg-ink font-brand text-xs font-bold uppercase text-paper">
            {(me.name || me.email).slice(0, 1)}
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate font-medium">{me.name || me.email}</span>
            <span className="block text-[11px] text-muted">{ROLE_LABEL[me.role]}</span>
          </span>
        </NavLink>
        <button
          type="button"
          onClick={() => onTheme(next)}
          aria-label={`Switch to ${next} mode`}
          title={`Switch to ${next} mode`}
          className="flex size-9 items-center justify-center border border-line text-muted transition-colors hover:text-text"
        >
          {theme === 'dark' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
        </button>
        <button
          type="button"
          onClick={signOut}
          className="flex h-9 items-center gap-2 border border-line px-4 text-xs font-medium text-muted transition-colors hover:text-text"
        >
          <LogOut size={14} aria-hidden="true" />
          Sign out
        </button>
      </div>

      <main className="w-full space-y-5 p-4 sm:p-6 2xl:px-10">
        <Outlet />
      </main>
    </div>
  )
}
