import { Radio, Square, Video } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Button, cell, EmptyState, Filter, Kpis, Loading, Notice, num, PageHeader, Panel, Stat, Table, useAdmin, useAdminData, useAdminPost } from '../components/ui'
import { count, useKsh, when } from '../lib/format'

type Session = {
  id: string
  channel: string
  note: string | null
  startedAt: string
  endedAt: string | null
  live: boolean
  deposits: number
  depositCount: number
  // admins only
  marketerId?: string
  marketer?: string
  depositors?: number
  signups?: number
}
type LiveData = {
  sessions: Session[]
  someoneElseLive: boolean | null
  totals: { deposits: number; depositCount: number; sessions: number }
  marketers: Array<{ id: string; name: string }>
}

const CHANNELS = ['TikTok', 'Instagram', 'YouTube', 'Facebook', 'X', 'Other']

function ran(s: Session) {
  const ms = (s.endedAt ? new Date(s.endedAt).getTime() : Date.now()) - new Date(s.startedAt).getTime()
  const mins = Math.max(0, Math.round(ms / 60000))
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h ${mins % 60} min`
}

function GoLive({ marketers, onDone }: { marketers: LiveData['marketers'] | null; onDone: () => void }) {
  const post = useAdminPost()
  const [channel, setChannel] = useState('TikTok')
  const [note, setNote] = useState('')
  const [marketer, setMarketer] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const forOther = marketers !== null

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await post('/live/start', { channel, note: note.trim() || null, marketer_id: forOther ? marketer : null })
      setNote('')
      onDone()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      {forOther && (
        <label className="block min-w-48">
          <span className="text-xs text-muted">Marketer</span>
          <select required value={marketer} onChange={(e) => setMarketer(e.target.value)} className="mt-1 block h-9 w-full border border-line bg-bg px-2 text-sm">
            <option value="">Choose</option>
            {marketers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="block">
        <span className="text-xs text-muted">Channel</span>
        <select value={channel} onChange={(e) => setChannel(e.target.value)} className="mt-1 block h-9 border border-line bg-bg px-2 text-sm">
          {CHANNELS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label className="block min-w-56 flex-1">
        <span className="text-xs text-muted">Note, optional</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="e.g. Friday evening stream" className="mt-1 block h-9 w-full border border-line bg-bg px-3 text-sm outline-none focus:border-text" />
      </label>
      <Button type="submit" tone="primary" disabled={busy || (forOther && !marketer)} className="h-9 px-4">
        <Radio size={14} aria-hidden="true" />
        {busy ? 'Starting' : 'Go live'}
      </Button>
      {error && <p className="w-full text-sm text-bad">{error}</p>}
    </form>
  )
}

export default function Live() {
  const { me } = useAdmin()
  const { ksh } = useKsh()
  const post = useAdminPost()
  const marketer = me.role === 'marketer'
  const canRun = marketer || me.role === 'superadmin' || me.role === 'admin'
  const [who, setWho] = useState('all')
  const { data, error, loading, reload } = useAdminData<LiveData>('/live')
  const [ending, setEnding] = useState(false)
  const [endError, setEndError] = useState<string | null>(null)

  // while a session runs, its money keeps arriving: refresh every 15 seconds
  const current = data?.sessions.find((s) => s.live)
  useEffect(() => {
    if (!current) return
    const id = setInterval(() => void reload(), 15000)
    return () => clearInterval(id)
  }, [current, reload])

  const end = async (s: Session) => {
    setEnding(true)
    setEndError(null)
    try {
      await post(`/live/${s.id}/end`)
      void reload()
    } catch (e) {
      setEndError((e as Error).message)
    } finally {
      setEnding(false)
    }
  }

  const rows = (data?.sessions ?? []).filter((s) => who === 'all' || s.marketerId === who)
  const past = rows.filter((s) => !s.live)
  const total = rows.reduce((a, s) => a + s.deposits, 0)

  return (
    <>
      <PageHeader
        title={marketer ? 'My live sessions' : 'Live sessions'}
        note={
          marketer
            ? 'Money deposited while you are live is counted as yours. Go live when you start streaming and end it when you stop.'
            : 'Real money deposited while a marketer is live counts as theirs. One session runs at a time, so nothing is counted twice.'
        }
      >
        {!marketer && data && data.marketers.length > 0 && (
          <Filter label="Marketer" value={who} onChange={setWho} options={[['all', 'All marketers'], ...data.marketers.map((m) => [m.id, m.name] as [string, string])]} />
        )}
      </PageHeader>
      {error && <Notice>{error}</Notice>}
      {endError && <Notice>{endError}</Notice>}
      {loading && !data && <Loading />}

      {data && (
        <>
          {current ? (
            <section className="border border-good/50 bg-surface">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <span className="size-2 animate-pulse rounded-full bg-bad" aria-hidden="true" />
                  Live now{current.marketer ? ` · ${current.marketer}` : ''} · {current.channel || 'stream'} · {ran(current)}
                </h2>
                {canRun && (
                  <Button tone="danger" disabled={ending} onClick={() => void end(current)}>
                    <Square size={12} aria-hidden="true" />
                    {ending ? 'Ending' : 'End session'}
                  </Button>
                )}
              </header>
              <Kpis>
                <Stat label="Deposited during this session" value={ksh(current.deposits)} note={`${count(current.depositCount)} deposits so far`} tone="good" />
                {!marketer && <Stat label="People" value={count(current.depositors ?? 0)} note={`depositors · ${count(current.signups ?? 0)} sign-ups`} />}
                <Stat label="Started" value={when(current.startedAt)} note={current.note ?? 'Counting until it ends'} />
              </Kpis>
            </section>
          ) : (
            canRun && (
              <Panel title={marketer ? 'Start a session' : 'Start a session for a marketer'}>
                {marketer && data.someoneElseLive ? (
                  <p className="text-sm text-muted">Another marketer is live right now. You can go live once their session ends.</p>
                ) : !marketer && data.marketers.length === 0 ? (
                  <p className="text-sm text-muted">No marketers yet. Add one on the Admins page with the Marketer role.</p>
                ) : (
                  <GoLive marketers={marketer ? null : data.marketers} onDone={() => void reload()} />
                )}
              </Panel>
            )
          )}

          <Kpis>
            <Stat label={marketer ? 'Total you brought in' : 'Total from sessions'} value={ksh(total)} note={`${count(rows.reduce((a, s) => a + s.depositCount, 0))} deposits`} />
            <Stat label="Sessions" value={count(rows.length)} note={rows.length ? `Average ${ksh(total / rows.length)} each` : 'None yet'} />
            <Stat label="Best session" value={ksh(Math.max(0, ...rows.map((s) => s.deposits)))} />
          </Kpis>

          <Panel title="Past sessions" flush>
            {past.length === 0 ? (
              <EmptyState icon={Video} title="No sessions yet">
                Each session you end shows here with the money that came in during it.
              </EmptyState>
            ) : (
              <Table
                minWidth={marketer ? '36rem' : '52rem'}
                columns={[
                  ...(marketer ? [] : ['Marketer']),
                  'Channel',
                  'Started',
                  { label: 'Ran for', right: true },
                  ...(marketer ? [] : [{ label: 'Sign-ups', right: true }]),
                  { label: 'Deposits', right: true },
                  { label: 'Money in', right: true },
                ]}
              >
                {past.map((s) => (
                  <tr key={s.id}>
                    {!marketer && <td className={`${cell} font-medium`}>{s.marketer}</td>}
                    <td className={cell}>
                      {s.channel || '-'}
                      {s.note && <p className="text-xs text-muted">{s.note}</p>}
                    </td>
                    <td className={`${cell} whitespace-nowrap text-muted`}>{when(s.startedAt)}</td>
                    <td className={`${num} text-muted`}>{ran(s)}</td>
                    {!marketer && <td className={num}>{count(s.signups ?? 0)}</td>}
                    <td className={num}>{count(s.depositCount)}</td>
                    <td className={`${num} font-semibold`}>{ksh(s.deposits)}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Panel>
        </>
      )}
    </>
  )
}
