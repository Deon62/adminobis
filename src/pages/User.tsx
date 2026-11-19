import { ArrowLeft, Receipt } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { WalletPanel } from '../components/WalletPanel'
import { AskDialog, Button, cell, EmptyState, Facts, Kpis, Loading, Notice, num, Panel, Ref, Stat, Status, Table, useAdminData, useAdminPost, useCan, VipTag } from '../components/ui'
import { day, useKsh, useTxKsh, usd, when } from '../lib/format'
import { METHOD, type Tx } from '../lib/types'

type Detail = {
  id: string
  email: string
  name: string
  phone: string
  country: string | null
  currency: string
  referralCode: string
  referredBy: string | null
  createdAt: string
  vip: boolean
  vipSince: string | null
  staged: boolean
  balances: { real?: number; demo?: number }
  deposited: number
  withdrawn: number
  realPl: number
  transactions: Tx[]
  verification?: {
    ready: boolean
    verified: boolean
    identity: { docName: string; status: string; reason: string | null; createdAt: string } | null
    address: { docName: string; status: string; reason: string | null; createdAt: string } | null
  }
  methods: Array<{ id: string; kind: string; label: string; masked: string; status: string; isDefault: boolean; createdAt: string; removed: boolean }>
}

export default function User() {
  const { id = '' } = useParams()
  const { data, error, loading, reload } = useAdminData<Detail>(`/users/${encodeURIComponent(id)}`)
  const post = useAdminPost()
  const can = useCan()
  const { ksh, signed } = useKsh()
  const txKsh = useTxKsh()
  const [asking, setAsking] = useState<'grant' | 'remove' | 'credit' | 'debit' | null>(null)
  const path = `/users/${encodeURIComponent(id)}`
  const done = () => {
    setAsking(null)
    void reload()
  }

  return (
    <>
      <Link to="/users" className="inline-flex items-center gap-2 text-sm text-muted hover:text-text">
        <ArrowLeft size={14} aria-hidden="true" />
        Users
      </Link>
      {error && <Notice>{error}</Notice>}
      {loading && !data && <Loading />}
      {data && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="flex items-center text-2xl font-semibold tracking-[-0.02em]">
                {data.name || data.email}
                {data.vip && <VipTag />}
              </h1>
              <p className="mt-1 text-sm text-muted">Joined {when(data.createdAt)}</p>
            </div>
            {data.verification && !data.vip && (
              <span
                className={`border px-2.5 py-1 font-mono text-xs ${data.verification.verified ? 'border-good/60 text-good' : 'border-warn/60 text-warn'}`}
              >
                {data.verification.verified
                  ? 'Identity verified'
                  : data.verification.identity?.status === 'pending'
                    ? 'ID waiting for review'
                    : 'Not verified: cannot withdraw'}
              </span>
            )}
          </div>

          <Facts
            items={[
              ['Email', data.email],
              ['Phone', data.phone || '-'],
              ['Country', data.country || '-'],
              ['Joined', when(data.createdAt)],
              ['Referral code', <Ref key="r" value={data.referralCode} />],
              ['Referred by', data.referredBy || '-'],
              [
                'Identity',
                data.verification?.identity ? (
                  <span key="i">
                    {data.verification.identity.docName} · <Status value={data.verification.identity.status === 'pending' ? 'review' : data.verification.identity.status} />
                    <span className="block text-xs text-muted">sent {day(data.verification.identity.createdAt)}</span>
                  </span>
                ) : (
                  <span key="i" className="text-muted">Nothing sent</span>
                ),
              ],
              [
                'Address',
                data.verification?.address ? (
                  <span key="a">
                    {data.verification.address.docName} · <Status value={data.verification.address.status === 'pending' ? 'review' : data.verification.address.status} />
                  </span>
                ) : (
                  <span key="a" className="text-muted">Nothing sent</span>
                ),
              ],
              ['User ID', <Ref key="id" value={data.id} />],
            ]}
          />

          <Kpis>
            <Stat label="Real balance" value={ksh(data.balances.real)} note={`${usd(data.balances.real)} · demo ${usd(data.balances.demo)}`} />
            <Stat label="Deposited" value={ksh(data.deposited)} />
            <Stat label="Withdrawn" value={ksh(data.withdrawn)} />
            <Stat label="Real trading P/L" value={signed(data.realPl)} tone={data.realPl > 0 ? 'bad' : data.realPl < 0 ? 'good' : undefined} note="The user's, so a gain is the house's loss" />
          </Kpis>

          <Panel
            title="VIP account"
            action={
              !can('admin') ? undefined : data.vip ? (
                <span className="flex gap-2">
                  <Button tone="primary" onClick={() => setAsking('credit')}>
                    Credit
                  </Button>
                  <Button onClick={() => setAsking('debit')}>Debit</Button>
                  <Button
                    tone={data.staged ? 'danger' : 'plain'}
                    onClick={() => void post(`${path}/staged`, { on: !data.staged }).then(done, (e: Error) => window.alert(e.message))}
                  >
                    {data.staged ? 'Stop staged results' : 'Stage results'}
                  </Button>
                  <Button tone="danger" onClick={() => setAsking('remove')}>
                    Remove VIP
                  </Button>
                </span>
              ) : (
                <Button onClick={() => setAsking('grant')}>Make VIP</Button>
              )
            }
          >
            <p className="text-sm text-muted">
              {data.vip
                ? `A VIP since ${when(data.vipSince)}. A demonstration account: it deposits and withdraws by M-Pesa through the demo wallet below (the M-Pesa clone app), and you can also credit or debit its real balance here. Its trades earn no referral commission, and the overview leaves it out.`
                : 'A VIP is a demonstration account: its M-Pesa deposits and withdrawals go through a demo wallet that the M-Pesa clone app shows, set up here, and you can credit its real balance directly. Only accounts with nothing in the real balance can be made VIP.'}
            </p>
            {data.vip && (
              <p className={`mt-3 text-sm ${data.staged ? 'text-warn' : 'text-muted'}`}>
                {data.staged
                  ? 'Staged results are ON: this account wins most contracts whatever the price does. Its screens show a DEMO tag, and each contract settled this way is marked Staged.'
                  : 'Stage results makes this account win most contracts, for presentations. While it is on, the account shows a DEMO tag and its contracts are marked Staged.'}
              </p>
            )}
          </Panel>

          {data.vip && <WalletPanel userId={data.id} onChange={() => void reload()} />}

          <Panel title="Money" flush>
            {data.transactions.length === 0 ? (
              <EmptyState icon={Receipt} title="No deposits or withdrawals" />
            ) : (
              <Table minWidth="56rem" columns={['Reference', 'Type', 'Method', { label: 'Amount', right: true }, { label: 'Net', right: true }, 'Detail', 'Status', 'When']}>
                {data.transactions.map((tx) => (
                  <tr key={tx.reference}>
                    <td className={cell}>
                      <Ref value={tx.reference} />
                    </td>
                    <td className={cell}>{tx.type}</td>
                    <td className={cell}>{METHOD[tx.method] ?? tx.method}</td>
                    <td className={num}>{txKsh(tx)}</td>
                    <td className={num}>{ksh(tx.net)}</td>
                    <td className={`${cell} max-w-64 text-xs`}>
                      {tx.failure ? <span className="text-bad">{tx.failure}</span> : <span className="font-mono">{tx.receipt ?? tx.destination ?? '-'}</span>}
                    </td>
                    <td className={cell}>
                      <Status value={tx.status} />
                    </td>
                    <td className={`${cell} whitespace-nowrap text-muted`}>{when(tx.createdAt)}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Panel>

          <Panel title="Payment methods" flush>
            {data.methods.length === 0 ? (
              <EmptyState icon={Receipt} title="No payment methods" />
            ) : (
              <Table minWidth="40rem" columns={['Method', 'Account', 'Status', 'Added']}>
                {data.methods.map((m) => (
                  <tr key={m.id} className={m.removed ? 'text-muted' : undefined}>
                    <td className={cell}>
                      {m.label}
                      {m.isDefault && <span className="ml-2 text-xs text-muted">default</span>}
                      {m.removed && <span className="ml-2 text-xs">removed by user</span>}
                    </td>
                    <td className={`${cell} font-mono text-xs`}>{m.masked}</td>
                    <td className={cell}>
                      <Status value={m.status} />
                    </td>
                    <td className={`${cell} whitespace-nowrap text-muted`}>{when(m.createdAt)}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Panel>

        </>
      )}

      {data && asking === 'grant' && (
        <AskDialog
          title="Make VIP"
          text={
            <>
              <b className="text-text">{data.email}</b> becomes a demonstration account. Its M-Pesa deposits and withdrawals then go through a demo
              wallet you set up next (a PIN for the M-Pesa clone app), and you can credit its real balance. Cards and USDT are closed to it. Any
              unfinished deposit is removed; a withdrawal in review stays for you to pay or reject.
            </>
          }
          label="Note, for the audit log"
          placeholder="e.g. Demo account for the marketing team"
          optional
          confirm="Make VIP"
          onClose={() => setAsking(null)}
          onSubmit={async (note) => {
            await post(`${path}/vip`, { vip: true, note: note || null })
            done()
          }}
        />
      )}
      {data && asking === 'remove' && (
        <AskDialog
          title="Remove VIP"
          tone="danger"
          text={
            <>
              The credited real balance of <b className="text-text">{usd(data.balances.real)}</b> is taken back to zero, and{' '}
              <b className="text-text">{data.email}</b> becomes an ordinary account again.
            </>
          }
          label="Note, for the audit log"
          optional
          confirm="Remove VIP"
          onClose={() => setAsking(null)}
          onSubmit={async (note) => {
            await post(`${path}/vip`, { vip: false, note: note || null })
            done()
          }}
        />
      )}
      {data && (asking === 'credit' || asking === 'debit') && (
        <AskDialog
          title={asking === 'credit' ? 'Credit real balance' : 'Debit real balance'}
          tone={asking === 'credit' ? 'primary' : 'danger'}
          text={
            <>
              The real balance is <b className="text-text">{usd(data.balances.real)}</b> now. The change shows in the user's history as a VIP{' '}
              {asking}, and they get a text from obisflow at {data.phone || 'their phone number (none saved)'}.
            </>
          }
          label="Amount in USD"
          placeholder="e.g. 500"
          amount
          confirm={asking === 'credit' ? 'Credit' : 'Debit'}
          onClose={() => setAsking(null)}
          onSubmit={async (value) => {
            await post(`${path}/balance`, { action: asking, amount_usd: Number(value) })
            done()
          }}
        />
      )}
    </>
  )
}
