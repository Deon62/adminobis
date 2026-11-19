import { ArrowDownToLine, ArrowUpFromLine, BadgeCheck, Landmark, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { DayBars } from '../components/Chart'
import { Kpis, Loading, Notice, PageHeader, Panel, Stat, useAdminData } from '../components/ui'
import { WithdrawalTable } from '../components/WithdrawalTable'
import { count, useKsh } from '../lib/format'
import type { Tx } from '../lib/types'

type Overview = {
  users: number
  newUsers24h: number
  realBalances: number
  depositsToday: number
  depositsTodayCount: number
  withdrawalsWaiting: number
  withdrawalsWaitingUsd: number
  verificationsWaiting: number | null
  methodsWaiting: number
  depositsStuck: number
}

type Days = { days: Array<{ day: string; deposits: number; withdrawals: number }> }

export default function Overview() {
  const { ksh, short } = useKsh()
  const { data, error } = useAdminData<Overview>('/overview')
  const finance = useAdminData<Days>('/finance')
  const waiting = useAdminData<Tx[]>('/transactions?type=withdrawal&status=waiting&limit=10')
  const last14 = finance.data?.days.slice(-14) ?? []

  return (
    <>
      <PageHeader title="Overview" note="Real money only. VIP demonstration accounts are left out." />
      {error && <Notice>{error}</Notice>}
      {data && data.depositsStuck > 0 && (
        <Notice tone="bad">
          {count(data.depositsStuck)} deposit{data.depositsStuck === 1 ? ' is' : 's are'} stuck at pending for over 15 minutes.{' '}
          <Link to="/deposits" className="underline underline-offset-4">
            Check them
          </Link>
        </Notice>
      )}

      <Kpis>
        <Stat icon={Landmark} label="Real balances" value={data ? ksh(data.realBalances) : '-'} note="What users could withdraw now" to="/finance" />
        <Stat
          icon={ArrowDownToLine}
          label="Deposits today"
          value={data ? ksh(data.depositsToday) : '-'}
          note={data && `${count(data.depositsTodayCount)} completed since midnight`}
          to="/deposits"
        />
        <Stat
          icon={ArrowUpFromLine}
          label="Withdrawals waiting"
          value={data ? ksh(data.withdrawalsWaitingUsd) : '-'}
          note={data && `${count(data.withdrawalsWaiting)} to pay`}
          tone={data && data.withdrawalsWaiting > 0 ? 'warn' : undefined}
          to="/withdrawals"
        />
        <Stat
          icon={BadgeCheck}
          label="To verify"
          value={data ? count((data.verificationsWaiting ?? 0) + data.methodsWaiting) : '-'}
          note={data && (data.verificationsWaiting == null ? 'Run sql/015 to turn on ID checks' : `${count(data.verificationsWaiting)} IDs · ${count(data.methodsWaiting)} payment methods`)}
          tone={data && (data.verificationsWaiting ?? 0) + data.methodsWaiting > 0 ? 'warn' : undefined}
          to="/verification"
        />
        <Stat icon={Users} label="Users" value={data ? count(data.users) : '-'} note={data && `${count(data.newUsers24h)} new in 24 h`} to="/users" />
      </Kpis>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel
          title="Money in and out, last 14 days"
          action={
            <Link to="/finance" className="text-xs text-muted underline-offset-4 hover:text-text hover:underline">
              Finance
            </Link>
          }
        >
          {finance.error ? (
            <Notice>{finance.error}</Notice>
          ) : !finance.data ? (
            <Loading />
          ) : (
            <DayBars
              rows={last14}
              format={ksh}
              short={short}
              series={[
                { key: 'deposits', label: 'Deposits', color: 'var(--series-in)' },
                { key: 'withdrawals', label: 'Withdrawals paid', color: 'var(--series-out)' },
              ]}
            />
          )}
        </Panel>

        <Panel
          title="Withdrawals waiting"
          flush
          action={
            <Link to="/withdrawals" className="text-xs text-muted underline-offset-4 hover:text-text hover:underline">
              All withdrawals
            </Link>
          }
        >
          {waiting.loading && !waiting.data ? (
            <Loading />
          ) : waiting.error ? (
            <div className="p-5">
              <Notice>{waiting.error}</Notice>
            </div>
          ) : (
            <WithdrawalTable
              rows={waiting.data ?? []}
              emptyText="Nothing waiting"
              onChanged={() => {
                void waiting.reload()
              }}
            />
          )}
        </Panel>
      </div>
    </>
  )
}
