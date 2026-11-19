import { ArrowDownToLine } from 'lucide-react'
import { useState } from 'react'
import { PeriodPicker, usePeriod } from '../components/Period'
import { cell, EmptyState, Filter, Filters, Kpis, Loading, Notice, num, PageHeader, Panel, Ref, Stat, Status, Table, useAdminData, UserLink, VipTag } from '../components/ui'
import { count, useKsh, useTxKsh, when } from '../lib/format'
import { METHOD, type Totals, type Tx } from '../lib/types'

type Show = 'all' | 'completed' | 'pending' | 'failed'
type Method = 'all' | 'mpesa' | 'card' | 'usdt'

export default function Deposits() {
  const { ksh } = useKsh()
  const txKsh = useTxKsh()
  const [show, setShow] = useState<Show>('completed')
  const [method, setMethod] = useState<Method>('all')
  const [who, setWho] = useState<'real' | 'all'>('real')
  const period = usePeriod('today')
  const base = `type=deposit&method=${method}&vip=${who === 'all'}${period.query}`
  const { data, error, loading } = useAdminData<Tx[]>(`/transactions?${base}&status=${show}&limit=500`)
  const totals = useAdminData<Totals>(`/transactions/totals?${base}`)
  const t = totals.data?.byStatus
  const done = t?.completed

  return (
    <>
      <PageHeader title="Deposits" note="A deposit pending for more than 15 minutes usually means a lost callback: check it with the provider.">
        <Filters>
          <PeriodPicker period={period} />
          <Filter<Show>
            label="Status"
            value={show}
            onChange={setShow}
            options={[
              ['completed', 'Completed'],
              ['pending', 'Pending'],
              ['failed', 'Failed'],
              ['all', 'All'],
            ]}
          />
          <Filter<Method>
            label="Method"
            value={method}
            onChange={setMethod}
            options={[
              ['all', 'All methods'],
              ['mpesa', 'M-Pesa'],
              ['card', 'Card'],
              ['usdt', 'USDT'],
            ]}
          />
          <Filter<'real' | 'all'>
            label="Accounts"
            value={who}
            onChange={setWho}
            options={[
              ['real', 'Real users'],
              ['all', 'Include VIP'],
            ]}
          />
        </Filters>
      </PageHeader>

      <Kpis>
        <Stat label={`Deposited · ${period.label}`} value={ksh(done?.net ?? 0)} note={`${count(done?.count ?? 0)} deposits, credited to real balances`} tone="good" />
        <Stat label="Depositors" value={count(done?.users ?? 0)} note={done?.count ? `Average ${ksh(done.net / done.count)} each` : 'No completed deposits'} />
        <Stat label="Pending" value={ksh(t?.pending?.amount ?? 0)} note={`${count(t?.pending?.count ?? 0)} not finished yet`} tone={t?.pending?.count ? 'warn' : undefined} />
        <Stat label="Failed" value={count(t?.failed?.count ?? 0)} note={`${ksh(t?.failed?.amount ?? 0)} attempted`} />
      </Kpis>

      {error && <Notice>{error}</Notice>}
      <Panel flush title={data ? `${count(data.length)} deposits${data.length === 500 ? ' (latest 500 shown)' : ''}` : undefined}>
        {loading && !data ? (
          <Loading />
        ) : !data?.length ? (
          <EmptyState icon={ArrowDownToLine} title="No deposits here">
            Try another period or status.
          </EmptyState>
        ) : (
          <Table minWidth="60rem" columns={['Reference', 'User', 'Method', { label: 'Paid', right: true }, { label: 'Credited', right: true }, 'Receipt', 'Status', 'When']}>
            {data.map((tx) => (
              <tr key={tx.reference}>
                <td className={cell}>
                  <Ref value={tx.reference} />
                </td>
                <td className={cell}>
                  <UserLink id={tx.userId} email={tx.email} />
                  {tx.vip && <VipTag />}
                </td>
                <td className={cell}>{METHOD[tx.method] ?? tx.method}</td>
                <td className={num}>{txKsh(tx)}</td>
                <td className={num}>{ksh(tx.net)}</td>
                <td className={`${cell} font-mono text-xs`}>
                  {tx.receipt ?? (tx.failure ? <span className="text-bad">{tx.failure}</span> : <span className="text-muted">-</span>)}
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
    </>
  )
}
