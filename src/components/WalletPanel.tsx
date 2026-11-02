import { Smartphone } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { local, when } from '../lib/format'
import { Button, cell, EmptyState, Loading, Notice, num, Panel, Ref, Table, useAdminData, useAdminPost } from './ui'

type Wallet = {
  userId: string
  pin: string
  balanceMinor: number
  fulizaLimitMinor: number
  fulizaUsedMinor: number
  holderName: string | null
  phone: string | null
  updatedAt: string | null
}

type Move = { id: string; kind: string; title: string; subtitle: string; amountMinor: number; balanceAfterMinor: number; reference: string; at: string }

type WalletData = { wallet: Wallet | null; statement: Move[]; sms: { provider: string | null; sender: string | null } }

const ksh = (minor: number) => local(minor / 100, 'KES')
const field = 'mt-1.5 h-9 w-full border border-line bg-bg px-3 text-sm outline-none transition-colors focus:border-text'

/**
 * A VIP's M-Pesa demo wallet: what the M-Pesa clone app shows. The PIN set
 * here is what the tester types into the app once; the VIP's M-Pesa deposits
 * then come off this balance and its withdrawals land on it, each followed by
 * a text to the phone below.
 */
export function WalletPanel({ userId, onChange }: { userId: string; onChange: () => void }) {
  const path = `/users/${encodeURIComponent(userId)}/wallet`
  const { data: loaded, error: loadError, loading } = useAdminData<WalletData>(path)
  const [fresh, setFresh] = useState<WalletData | null>(null)
  const data = fresh ?? loaded
  const post = useAdminPost()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [form, setForm] = useState({ pin: '', balance: '', fuliza: '', phone: '' })

  const w = data?.wallet ?? null
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })

  async function run(fn: () => Promise<WalletData | void>, done?: string) {
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      const out = await fn()
      if (out) setFresh(out)
      if (done) setNote(done)
      onChange()
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const save = (e: FormEvent) => {
    e.preventDefault()
    const body: Record<string, unknown> = {}
    if (form.pin) body.pin = form.pin
    if (form.balance !== '') body.balance_kes = Number(form.balance)
    if (form.fuliza !== '') body.fuliza_limit_kes = Number(form.fuliza)
    if (form.phone) body.phone = form.phone
    void run(async () => {
      const out = await post<WalletData>(path, body)
      setForm({ pin: '', balance: '', fuliza: '', phone: '' })
      return out
    }, w ? 'Saved.' : 'Wallet created. Type the PIN into the M-Pesa app to link it.')
  }

  const testSms = () =>
    run(async () => {
      const out = await post<{ ok: boolean; status: string; detail: string; provider: string | null; sender: string | null; to: string }>(`${path}/test-sms`, {})
      if (!out.ok) throw new Error(`${out.provider ?? 'SMS'} did not send it (${out.status}): ${out.detail}`)
      setNote(`Sent to ${out.to} through ${out.provider}${out.sender ? `, from ${out.sender}` : ''}: ${out.detail}`)
    })

  return (
    <Panel
      title="M-Pesa demo wallet"
      action={
        w && (
          <span className="flex gap-2">
            <Button disabled={busy} onClick={() => void testSms()}>
              Test SMS
            </Button>
            <Button disabled={busy} onClick={() => void run(() => post<WalletData>(`${path}/reset`, {}), 'Statement cleared and Fuliza repaid. The phone stays linked.')}>
              Reset
            </Button>
            <Button
              tone="danger"
              disabled={busy}
              onClick={() => window.confirm('Remove this wallet? The phone is unlinked and the statement is deleted.') && void run(() => post<WalletData>(`${path}/clear`, {}), 'Wallet removed.')}
            >
              Remove
            </Button>
          </span>
        )
      }
    >
      {loadError && <Notice>{loadError}</Notice>}
      {loading && !data && <Loading />}
      {data && (
        <div className="space-y-5">
          <p className="text-sm text-muted">
            {w
              ? 'This VIP deposits and withdraws by M-Pesa through this wallet, which the M-Pesa clone app shows. Each movement is texted to the phone below.'
              : 'No wallet yet. Set a four digit PIN and an opening balance; the tester types the PIN into the M-Pesa clone app once to link it. Until then this VIP cannot deposit by M-Pesa.'}{' '}
            Texts go through {data.sms.provider ? <b className="text-text">{data.sms.provider}{data.sms.sender ? `, from ${data.sms.sender}` : ''}</b> : <b className="text-warn">no gateway (set Celcom or Africa's Talking on the API)</b>}.
          </p>

          {w && (
            <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {[
                ['PIN', <span className="font-mono">{w.pin}</span>],
                ['Balance', <span className="font-mono">{ksh(w.balanceMinor)}</span>],
                ['Fuliza', <span className="font-mono">{ksh(w.fulizaUsedMinor)} used of {ksh(w.fulizaLimitMinor)}</span>],
                ['Holder', w.holderName || '-'],
                ['Phone', w.phone ? `+${w.phone}` : <span className="text-warn">none: no texts</span>],
                ['Updated', when(w.updatedAt)],
              ].map(([label, value], i) => (
                <div key={i} className="flex gap-3">
                  <dt className="w-20 shrink-0 text-muted">{label}</dt>
                  <dd className="min-w-0 break-all">{value}</dd>
                </div>
              ))}
            </dl>
          )}

          <form onSubmit={save} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
            <label className="block text-xs text-muted">
              {w ? 'New PIN' : 'PIN'}
              <input className={field} value={form.pin} onChange={set('pin')} inputMode="numeric" pattern="\d{4}" maxLength={4} placeholder="4 digits" required={!w} />
            </label>
            <label className="block text-xs text-muted">
              {w ? 'Set balance, KSh' : 'Opening balance, KSh'}
              <input className={field} value={form.balance} onChange={set('balance')} type="number" min={0} step="0.01" placeholder={w ? 'unchanged' : 'e.g. 50000'} />
            </label>
            <label className="block text-xs text-muted">
              Fuliza limit, KSh
              <input className={field} value={form.fuliza} onChange={set('fuliza')} type="number" min={0} step="0.01" placeholder={w ? 'unchanged' : '0'} />
            </label>
            <label className="block text-xs text-muted">
              Phone for texts
              <input className={field} value={form.phone} onChange={set('phone')} type="tel" placeholder={w ? 'unchanged' : "profile's"} />
            </label>
            <Button tone="primary" type="submit" disabled={busy} className="h-9">
              {w ? 'Save changes' : 'Create wallet'}
            </Button>
          </form>

          {error && <Notice>{error}</Notice>}
          {note && <Notice tone="good">{note}</Notice>}

          {w && (
            <div className="-mx-5 -mb-5 border-t border-line">
              {data.statement.length === 0 ? (
                <EmptyState icon={Smartphone} title="No movements yet" />
              ) : (
                <Table minWidth="44rem" columns={['Reference', 'Movement', { label: 'Amount', right: true }, { label: 'Balance after', right: true }, 'When']}>
                  {data.statement.map((m) => (
                    <tr key={m.id}>
                      <td className={cell}>
                        <Ref value={m.reference} />
                      </td>
                      <td className={cell}>
                        {m.title}
                        {m.subtitle && <span className="ml-2 text-xs text-muted">{m.subtitle}</span>}
                      </td>
                      <td className={`${num} ${m.amountMinor < 0 ? 'text-bad' : 'text-good'}`}>
                        {m.amountMinor < 0 ? '-' : '+'}
                        {ksh(Math.abs(m.amountMinor))}
                      </td>
                      <td className={num}>{ksh(m.balanceAfterMinor)}</td>
                      <td className={`${cell} whitespace-nowrap text-muted`}>{when(m.at)}</td>
                    </tr>
                  ))}
                </Table>
              )}
            </div>
          )}
        </div>
      )}
    </Panel>
  )
}
