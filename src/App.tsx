import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout, Wordmark } from './components/Layout'
import { AdminContext, Spinner } from './components/ui'
import { adminGet, adminPost, API_URL, loadToken, saveToken, type Me } from './lib/api'
import { RateContext } from './lib/format'
import { useTheme } from './lib/theme'
import Account from './pages/Account'
import Activity from './pages/Activity'
import Admins from './pages/Admins'
import Deposits from './pages/Deposits'
import Finance from './pages/Finance'
import Logs from './pages/Logs'
import Markets from './pages/Markets'
import Methods from './pages/Methods'
import Overview from './pages/Overview'
import TestBench from './pages/TestBench'
import User from './pages/User'
import Users from './pages/Users'
import Live from './pages/Live'
import Verification from './pages/Verification'
import Withdrawals from './pages/Withdrawals'

const input = 'mt-2 h-11 w-full border border-line bg-surface px-3 text-sm outline-none transition-colors focus:border-text'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mt-5 block">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  )
}

/**
 * Email and password. While no admin account exists yet, the page instead
 * makes the first super admin, with ADMIN_TOKEN as proof.
 */
function SignIn({ onSignedIn, error: initialError }: { onSignedIn: (token: string, me: Me) => void; error?: string | null }) {
  const [mode, setMode] = useState<'loading' | 'login' | 'setup' | 'off'>('loading')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [adminToken, setAdminToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(initialError ?? null)

  useEffect(() => {
    adminGet<{ ready: boolean; setup: boolean }>('/auth/state', '').then(
      (s) => {
        if (!s.ready) {
          setMode('off')
          setError('Run sql/016_admin_users.sql on the database, then reload.')
        } else setMode(s.setup ? 'setup' : 'login')
      },
      (e: Error) => {
        setMode('login')
        setError(e.message)
      },
    )
  }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const out =
        mode === 'setup'
          ? await adminPost<{ token: string; me: Me }>('/auth/setup', '', { admin_token: adminToken.trim(), email: email.trim(), name: name.trim(), password })
          : await adminPost<{ token: string; me: Me }>('/auth/login', '', { email: email.trim(), password })
      onSignedIn(out.token, out.me)
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-ink p-10 text-paper lg:flex lg:flex-col lg:justify-between">
        <Wordmark dark />
        <div className="relative z-10 max-w-md">
          <p className="text-[2rem] font-semibold leading-tight tracking-[-0.02em]">Withdrawals, deposits, users and the price feed, in one place.</p>
          <p className="mt-4 text-sm leading-relaxed text-paper/60">Every change made here is logged with who made it and where from.</p>
        </div>
        <p className="relative z-10 text-xs text-paper/45">obisflow Markets Ltd. · Nairobi</p>
        <img src="/skyline.svg" alt="" aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 w-full opacity-10" />
      </aside>

      <div className="flex items-center justify-center px-5 py-16">
        {mode === 'loading' ? (
          <Spinner />
        ) : (
          <form onSubmit={submit} className="w-full max-w-sm">
            <div className="flex justify-center lg:hidden">
              <Wordmark />
            </div>
            <h1 className="mt-8 text-center text-2xl font-semibold tracking-[-0.02em] lg:mt-0 lg:text-left">
              {mode === 'setup' ? 'Create the first super admin' : 'Sign in'}
            </h1>
            <p className="mt-2 text-center text-sm text-muted lg:text-left">
              {mode === 'setup' ? 'No admin accounts exist yet. Prove access with the ADMIN_TOKEN set on the API.' : 'Use the email and password a super admin set up for you.'}
            </p>
            {mode === 'setup' && (
              <>
                <Field label="ADMIN_TOKEN">
                  <input type="password" value={adminToken} onChange={(e) => setAdminToken(e.target.value)} required className={input} />
                </Field>
                <Field label="Your name">
                  <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={input} />
                </Field>
              </>
            )}
            <Field label="Email">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required className={input} />
            </Field>
            <Field label={mode === 'setup' ? 'Password, 10 characters or more' : 'Password'}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'setup' ? 'new-password' : 'current-password'}
                minLength={mode === 'setup' ? 10 : undefined}
                required
                className={input}
              />
            </Field>
            {error && <p className="mt-4 text-sm text-bad">{error}</p>}
            <button
              type="submit"
              disabled={busy || mode === 'off'}
              className="mt-6 flex h-11 w-full items-center justify-center bg-brand text-sm font-semibold text-white transition-opacity disabled:opacity-45"
            >
              {busy ? 'Checking' : mode === 'setup' ? 'Create and sign in' : 'Sign in'}
            </button>
            <p className="mt-6 text-center text-xs leading-relaxed text-muted lg:text-left">
              Signed in for 12 hours, in this tab only.
              <br />
              {API_URL}
            </p>
          </form>
        )}
      </div>
    </main>
  )
}

export default function App() {
  const [theme, setTheme] = useTheme()
  const [token, setToken] = useState<string | null>(loadToken)
  const [me, setMe] = useState<Me | null>(null)
  const [expired, setExpired] = useState<string | null>(null)
  const [rate, setRate] = useState(129.5)

  const signOut = useCallback(() => {
    const was = loadToken()
    if (was) void adminPost('/auth/logout', was).catch(() => null)
    saveToken(null)
    setToken(null)
    setMe(null)
  }, [])

  // A session saved earlier in this tab: confirm it still works and learn who
  // it is, then the USD to KES rate every figure is shown at.
  useEffect(() => {
    if (!token) return
    adminGet<Me>('/me', token).then((who) => {
      setMe(who)
      if (who.usdKesRate) setRate(who.usdKesRate)
    }, (reason: Error & { status?: number }) => {
      setExpired(reason.message)
      saveToken(null)
      setToken(null)
    })
  }, [token])

  if (!token) {
    return (
      <SignIn
        error={expired}
        onSignedIn={(next, who) => {
          saveToken(next)
          setExpired(null)
          setMe(who)
          setToken(next)
        }}
      />
    )
  }
  if (!me) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Spinner />
      </main>
    )
  }

  const superadmin = me.role === 'superadmin'

  // a marketer gets two pages: their live sessions and their account
  if (me.role === 'marketer') {
    return (
      <AdminContext.Provider value={{ token, me, signOut, setMe }}>
        <RateContext.Provider value={rate}>
          <Routes>
            <Route element={<Layout theme={theme} onTheme={setTheme} />}>
              <Route index element={<Live />} />
              <Route path="account" element={<Account />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </RateContext.Provider>
      </AdminContext.Provider>
    )
  }

  return (
    <AdminContext.Provider value={{ token, me, signOut, setMe }}>
      <RateContext.Provider value={rate}>
        <Routes>
          <Route element={<Layout theme={theme} onTheme={setTheme} />}>
            <Route index element={<Overview />} />
            <Route path="finance" element={<Finance />} />
            <Route path="withdrawals" element={<Withdrawals />} />
            <Route path="verification" element={<Verification />} />
            <Route path="test-bench" element={<TestBench />} />
            <Route path="deposits" element={<Deposits />} />
            <Route path="users" element={<Users />} />
            <Route path="users/:id" element={<User />} />
            <Route path="payment-methods" element={<Methods />} />
            <Route path="markets" element={<Markets />} />
            <Route path="logs" element={<Logs />} />
            <Route path="activity" element={<Activity />} />
            <Route path="account" element={<Account />} />
            <Route path="live" element={<Live />} />
            {superadmin && <Route path="admins" element={<Admins />} />}
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </RateContext.Provider>
    </AdminContext.Provider>
  )
}
