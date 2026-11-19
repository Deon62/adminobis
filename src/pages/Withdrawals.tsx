import { useState } from 'react'
import { PeriodPicker, usePeriod } from '../components/Period'
import { Filter, Filters, Kpis, Loading, Notice, PageHeader, Panel, Stat, useAdminData } from '../components/ui'
import { WithdrawalTable } from '../components/WithdrawalTable'
import { count, useKsh } from '../lib/format'
import type { Totals, Tx } from '../lib/types'

type Show = 'waiting' | 'completed' | 'failed' | 'all'
type Method = 'all' | 'mpesa' | 'bank' | 'usdt'

export default function Withdrawals() {
  const { ksh } = useKsh()
  const [show, setShow] = useState<Show>('waiting')
  const [method, setMethod] = useState<Method>('all')
  const [who, setWho] = useState<'real' | 'all'>('real')
  const period = usePeriod('all')
  const q = `type=withdrawal&status=${show}&method=${method}&vip=${who === 'all'}${period.query}`
  const { data, error, loading, reload } = useAdminData<Tx[]>(`/transactions?${q}&limit=300`)
  const totals = useAdminData<Totals>(`/transactions/totals?type=withdrawal&method=${method}&vip=${who === 'all'}${period.query}`)
  const t = totals.data?.byStatus

  return (
    <>
      <PageHeader title="Withdrawals" note="Pay outside this site, then mark the withdrawal paid with its receipt. Oldest first while waiting.">
        <Filters>
          <Filter<Show>
            label="Status"
            value={show}
            onChange={setShow}
            options={[
              ['waiting', 'Waiting'],
              ['completed', 'Paid'],
              ['failed', 'Rejected'],
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
              ['bank', 'Bank'],
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
          <PeriodPicker period={period} />
        </Filters>
      </PageHeader>

      <Kpis>
        <Stat label="Waiting" value={ksh(t?.waiting?.net ?? 0)} note={`${count(t?.waiting?.count ?? 0)} requests`} tone={t?.waiting?.count ? 'warn' : undefined} />
        <Stat label="Paid" value={ksh(t?.completed?.amount ?? 0)} note={`${count(t?.completed?.count ?? 0)} withdrawals · ${period.label}`} />
        <Stat label="Fees kept" value={ksh(t?.completed?.fee ?? 0)} note="On paid withdrawals" />
        <Stat label="Rejected" value={ksh(t?.failed?.net ?? 0)} note={`${count(t?.failed?.count ?? 0)} refunded to balance`} />
      </Kpis>

      {error && <Notice>{error}</Notice>}
      <Panel flush>
        {loading && !data ? (
          <Loading />
        ) : (
          <WithdrawalTable
            rows={data ?? []}
            emptyText={show === 'waiting' ? 'Nothing waiting' : 'No withdrawals here'}
            onChanged={() => {
              void reload()
              void totals.reload()
            }}
          />
        )}
      </Panel>
    </>
  )
}
