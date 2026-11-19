import { Check, Copy, Play, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button, Notice, PageHeader, Panel, useAdmin, useAdminPost, useCan } from '../components/ui'
import { adminGet, API_URL } from '../lib/api'
import { cn } from '../lib/format'

/**
 * The test bench: each check answers one question without a customer being
 * involved ("is the SMS gateway up" is a different question from "is this
 * user's phone right"). A failure keeps what was asked and what came back,
 * with a Copy button, so it can be pasted to whoever fixes it.
 */
const CHECKS: Array<{ id: string; label: string; note: string }> = [
  { id: 'database', label: 'Database', note: 'Reads a real table through the API.' },
  { id: 'schema', label: 'Migrations', note: 'Every sql/ file the features rely on has been run, through 015.' },
  { id: 'feed', label: 'Price feed', note: 'The generator is ticking, so real-money markets are open.' },
  { id: 'deposits', label: 'Deposits in flight', note: 'No deposit stuck at pending for over 15 minutes (a lost callback).' },
  { id: 'payhero', label: 'M-Pesa (PayHero)', note: 'Credentials are set, and when an M-Pesa prompt last worked.' },
  { id: 'kora', label: 'M-Pesa (Kora)', note: 'Asks Kora for the balance with the secret key.' },
  { id: 'paystack', label: 'Cards (Paystack)', note: 'Asks Paystack for the balance with the secret key.' },
  { id: 'sms', label: 'SMS gateway', note: 'Which gateway is set, and when a text last went out.' },
  { id: 'email', label: 'Email (Resend)', note: 'The key is set, and when an email last went out.' },
]

type Result = { ok: boolean; detail: string; ms: number; at: string; running?: boolean }

function diagnostic(label: string, r: Result) {
  return [
    'obisflow admin, test bench',
    `test:    ${label}`,
    `when:    ${r.at}`,
    `api:     ${API_URL}`,
    `result:  ${r.ok ? 'ok' : 'FAILED'}`,
    `detail:  ${r.detail}`,
    `took:    ${r.ms} ms`,
  ].join('\n')
}

function CopyText({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        })
      }}
      className="inline-flex items-center gap-1 text-xs text-muted hover:text-text"
    >
      {done ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
      {done ? 'Copied' : 'Copy for support'}
    </button>
  )
}

function SendBox({ kind }: { kind: 'sms' | 'email' }) {
  const post = useAdminPost()
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState(false)
  const [out, setOut] = useState<{ ok: boolean; text: string } | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setOut(null)
    try {
      const r = await post<{ ok: boolean; detail: string; ms: number; provider?: string; sender?: string }>(`/tests/send-${kind}`, { to: to.trim() })
      setOut({ ok: r.ok, text: `${r.ok ? 'Sent' : 'Not sent'}: ${r.detail}${r.provider ? ` · ${r.provider}` : ''}${r.sender ? `, sender ${r.sender}` : ''} · ${r.ms} ms` })
    } catch (e) {
      setOut({ ok: false, text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex gap-2">
        <input
          value={to}
          onChange={(event) => setTo(event.target.value)}
          placeholder={kind === 'sms' ? '0712 345 678' : 'you@example.com'}
          aria-label={kind === 'sms' ? 'Phone number' : 'Email address'}
          inputMode={kind === 'sms' ? 'tel' : 'email'}
          className="h-9 min-w-0 flex-1 border border-line bg-bg px-3 text-sm outline-none focus:border-text"
        />
        <Button type="submit" tone="primary" disabled={busy || to.trim().length < 3} className="h-9">
          {busy ? 'Sending' : 'Send test'}
        </Button>
      </div>
      {out && <p className={cn('text-xs', out.ok ? 'text-good' : 'text-bad')}>{out.text}</p>}
    </form>
  )
}

export default function TestBench() {
  const { token } = useAdmin()
  const [results, setResults] = useState<Record<string, Result>>({})
  const can = useCan()

  const run = async (id: string) => {
    setResults((r) => ({ ...r, [id]: { ...(r[id] ?? { ok: true, detail: '', ms: 0, at: '' }), running: true } }))
    const start = performance.now()
    let next: Result
    try {
      const r = await adminGet<{ ok: boolean; detail: string; ms: number }>(`/tests/${id}`, token)
      next = { ok: r.ok, detail: r.detail, ms: r.ms, at: new Date().toISOString() }
    } catch (e) {
      next = { ok: false, detail: (e as Error).message, ms: Math.round(performance.now() - start), at: new Date().toISOString() }
    }
    setResults((r) => ({ ...r, [id]: next }))
  }

  const runAll = () => Promise.all(CHECKS.map((c) => run(c.id)))
  const done = CHECKS.filter((c) => results[c.id] && !results[c.id].running)
  const failed = done.filter((c) => !results[c.id].ok).length

  return (
    <>
      <PageHeader title="Test bench" note="Check every outside service without touching a customer's account.">
        <Button tone="primary" onClick={() => void runAll()} className="h-9 px-4">
          <Play size={14} aria-hidden="true" />
          Run all checks
        </Button>
      </PageHeader>
      {done.length === CHECKS.length && (
        <Notice tone={failed ? 'bad' : 'good'}>{failed ? `${failed} of ${CHECKS.length} checks failed.` : 'Every check passed.'}</Notice>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title="Checks" flush>
          <ul className="divide-y divide-line">
            {CHECKS.map((c) => {
              const r = results[c.id]
              return (
                <li key={c.id} className="grid grid-cols-[auto_1fr_auto] items-start gap-4 px-5 py-4">
                  <span
                    className={cn(
                      'mt-1 flex size-5 items-center justify-center rounded-full border',
                      !r || r.running ? 'border-line text-muted' : r.ok ? 'border-good bg-good text-white' : 'border-bad bg-bad text-white',
                    )}
                    aria-label={!r ? 'not run' : r.running ? 'running' : r.ok ? 'passed' : 'failed'}
                  >
                    {r && !r.running && (r.ok ? <Check size={12} aria-hidden="true" /> : <X size={12} aria-hidden="true" />)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{c.label}</p>
                    <p className="text-xs text-muted">{c.note}</p>
                    {r && !r.running && (
                      <div className="mt-2 space-y-1">
                        <p className={cn('break-words font-mono text-xs', r.ok ? 'text-text' : 'text-bad')}>
                          {r.detail} <span className="text-faint">· {r.ms} ms</span>
                        </p>
                        {!r.ok && <CopyText text={diagnostic(c.label, r)} />}
                      </div>
                    )}
                  </div>
                  <Button onClick={() => void run(c.id)} disabled={r?.running}>
                    {r?.running ? 'Running' : r ? 'Run again' : 'Run'}
                  </Button>
                </li>
              )
            })}
          </ul>
        </Panel>

        {can('admin') && <div className="space-y-5">
          <Panel title="Send a test text">
            <p className="mb-3 text-xs text-muted">One plainly worded message to any number, through the configured gateway. Logged under Activity.</p>
            <SendBox kind="sms" />
          </Panel>
          <Panel title="Send a test email">
            <p className="mb-3 text-xs text-muted">A short email through Resend, from the address users receive mail from.</p>
            <SendBox kind="email" />
          </Panel>
        </div>}
      </div>
    </>
  )
}
