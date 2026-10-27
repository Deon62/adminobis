import { ScrollText } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cell, EmptyState, Filter, Loading, Notice, PageHeader, Panel, Ref, Table, useAdminData, UserLink } from '../components/ui'
import { cn, count, when } from '../lib/format'

type Summary = { kind: string; total: number; failed: number; lastAt: string | null; lastFailedAt: string | null; lastError: string | null; avgMs: number | null }
type Event = { kind: string; ok: boolean; provider: string | null; ref: string | null; userId: string | null; email: string | null; detail: string | null; ms: number | null; at: string }

/** The calls that matter, in the order they are looked at, grouped. */
const GROUPS: Array<{ title: string; kinds: Array<[string, string]> }> = [
  {
    title: 'Deposits',
    kinds: [
      ['mpesa.stk', 'M-Pesa prompt (STK push)'],
      ['mpesa.checkout', 'M-Pesa checkout page'],
      ['mpesa.payment', 'M-Pesa payments'],
      ['card.checkout', 'Card checkout'],
      ['card.payment', 'Card payments'],
      ['usdt.payment', 'USDT deposits'],
      ['withdrawal.request', 'Withdrawal requests'],
    ],
  },
  {
    title: 'Provider callbacks',
    kinds: [
      ['webhook.kora', 'Kora'],
      ['webhook.payhero', 'PayHero'],
      ['webhook.paystack', 'Paystack'],
    ],
  },
  {
    title: 'Accounts',
    kinds: [
      ['auth.signup', 'Email sign-ups'],
      ['auth.google', 'Google sign-in started'],
      ['account.created', 'Accounts created'],
      ['auth.login', 'Email sign-ins'],
    ],
  },
  {
    title: 'Messages and prices',
    kinds: [
      ['notify.email', 'Emails'],
      ['notify.sms', 'SMS'],
      ['feed.binance', 'Price feed: Binance'],
      ['feed.finnhub', 'Price feed: Finnhub'],
    ],
  },
]
const LABEL = Object.fromEntries(GROUPS.flatMap((g) => g.kinds))

type Health = 'ok' | 'failing' | 'mixed' | 'quiet'

/** Failing: every call failed. Mixed: some did. Sign-in failures are mostly wrong passwords, so they never read as failing. */
function health(s: Summary | undefined): Health {
  if (!s || s.total === 0) return 'quiet'
  if (s.failed === 0) return 'ok'
  if (s.failed === s.total && !s.kind.startsWith('auth.login') && !s.kind.startsWith('auth.signup')) return 'failing'
  return 'mixed'
}
const HEALTH: Record<Health, [string, string]> = {
  ok: ['Working', 'text-good'],
  mixed: ['Some failures', 'text-warn'],
  failing: ['Failing', 'text-bad'],
  quiet: ['No activity', 'text-faint'],
}

type Range = '24' | '168' | '720'

export default function Logs() {
  const [range, setRange] = useState<Range>('24')
  const [kind, setKind] = useState('')
  const [failedOnly, setFailedOnly] = useState(false)
  const summary = useAdminData<Summary[]>(`/logs/summary?hours=${range}`)
  const list = useAdminData<Event[]>(`/logs?limit=300&failed=${failedOnly}&kind=${encodeURIComponent(kind)}`)

  // payments and sign-ins keep happening; refresh every 15 seconds
  const { reload: reloadSummary } = summary
  const { reload: reloadList } = list
  useEffect(() => {
    const id = setInterval(() => {
      void reloadSummary()
      void reloadList()
    }, 15000)
    return () => clearInterval(id)
  }, [reloadSummary, reloadList])

  const byKind = Object.fromEntries((summary.data ?? []).map((s) => [s.kind, s]))

  return (
    <>
      <PageHeader title="Logs" note="Whether the calls that move money and open accounts are working. Pick a row to see its events.">
        <Filter<Range>
          value={range}
          onChange={setRange}
          options={[
            ['24', '24 h'],
            ['168', '7 days'],
            ['720', '30 days'],
          ]}
        />
      </PageHeader>
      {summary.error && <Notice>{summary.error}</Notice>}

      <div className="grid gap-4 xl:grid-cols-2">
        {GROUPS.map((group) => (
          <Panel key={group.title} title={group.title} flush>
            <ul className="divide-y divide-line">
              {group.kinds.map(([k, label]) => {
                const s = byKind[k]
                const [word, tone] = HEALTH[health(s)]
                const active = kind === k
                return (
                  <li key={k}>
                    <button
                      type="button"
                      onClick={() => setKind(active ? '' : k)}
                      aria-pressed={active}
                      className={cn('grid w-full grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-5 py-3 text-left transition-colors hover:bg-hover', active && 'bg-hover')}
                    >
                      <span className="text-sm font-medium">{label}</span>
                      <span className={cn('text-right font-mono text-xs', tone)}>{word}</span>
                      <span className="text-xs text-muted">
                        {s ? (
                          <>
                            {count(s.total)} calls{s.failed ? `, ${count(s.failed)} failed` : ''}
                            {s.avgMs != null ? ` · ${(s.avgMs / 1000).toFixed(1)}s avg` : ''} · last {when(s.lastAt)}
                          </>
                        ) : (
                          'Nothing in this period'
                        )}
                      </span>
                      <span />
                      {s?.lastError && (
                        <span className="col-span-2 truncate text-xs text-bad" title={s.lastError}>
                          {when(s.lastFailedAt)}: {s.lastError}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </Panel>
        ))}
      </div>

      <Panel
        title={kind ? `Events: ${LABEL[kind] ?? kind}` : 'All events'}
        flush
        action={
          <span className="flex items-center gap-3">
            {kind && (
              <button type="button" onClick={() => setKind('')} className="text-xs text-muted underline-offset-4 hover:text-text hover:underline">
                Show all
              </button>
            )}
            <Filter<'all' | 'failed'>
              value={failedOnly ? 'failed' : 'all'}
              onChange={(v) => setFailedOnly(v === 'failed')}
              options={[
                ['all', 'All'],
                ['failed', 'Failures'],
              ]}
            />
          </span>
        }
      >
        {list.error ? (
          <div className="p-5">
            <Notice>{list.error}</Notice>
          </div>
        ) : list.loading && !list.data ? (
          <Loading />
        ) : !list.data?.length ? (
          <EmptyState icon={ScrollText} title={failedOnly ? 'No failures' : 'Nothing logged yet'}>
            Events are recorded from the moment the API runs with sql/010_events.sql applied.
          </EmptyState>
        ) : (
          <Table minWidth="60rem" columns={['When', 'What', 'Result', 'Detail', 'User', 'Reference', { label: 'Took', right: true }]}>
            {list.data.map((e, i) => (
              <tr key={`${e.at}-${i}`} className="align-top">
                <td className={`${cell} whitespace-nowrap text-muted`}>{when(e.at)}</td>
                <td className={`${cell} whitespace-nowrap`}>
                  {LABEL[e.kind] ?? e.kind}
                  {e.provider && !e.kind.endsWith(e.provider) && <span className="ml-1.5 text-xs text-muted">{e.provider}</span>}
                </td>
                <td className={cell}>
                  <span className={cn('font-mono text-xs', e.ok ? 'text-good' : 'text-bad')}>{e.ok ? 'ok' : 'failed'}</span>
                </td>
                <td className={`${cell} max-w-96 break-words text-xs ${e.ok ? 'text-muted' : 'text-bad'}`}>{e.detail ?? '-'}</td>
                <td className={cell}>{e.userId || e.email ? <UserLink id={e.userId ?? undefined} email={e.email ?? undefined} /> : <span className="text-muted">-</span>}</td>
                <td className={cell}>{e.ref && !e.kind.startsWith('notify.') ? <Ref value={e.ref} /> : <span className="text-muted">-</span>}</td>
                <td className={`${cell} text-right font-mono text-xs text-muted`}>{e.ms != null ? `${(e.ms / 1000).toFixed(1)}s` : '-'}</td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </>
  )
}
