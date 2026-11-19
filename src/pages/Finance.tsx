import { ArrowDownToLine, ArrowUpFromLine, Landmark, Scale, TrendingUp, UserPlus } from 'lucide-react'
import { DayBars, ShareBars } from '../components/Chart'
import { PeriodPicker, PERIODS, usePeriod } from '../components/Period'
import { cell, EmptyState, Kpis, Loading, Notice, num, PageHeader, Panel, Stat, Table, useAdminData, UserLink } from '../components/ui'
import { count, day, useKsh } from '../lib/format'
import { METHOD } from '../lib/types'

type Finance = {
  since: string
  until: string
  deposits: number
  depositsCount: number
  depositors: number
  firstDeposits: number
  depositFees: number
  withdrawals: number
  withdrawalsCount: number
  withdrawalFees: number
  referralPaid: number
  net: number
  houseResult: number
  volume: number
  trades: number
  traders: number
  realBalances: number
  fundedAccounts: number
  withdrawalsWaiting: number
  withdrawalsWaitingUsd: number
  byMethod: Array<{ type: 'deposit' | 'withdrawal'; method: string; count: number; usd: number }>
  days: Array<{ day: string; deposits: number; withdrawals: number; house: number }>
  topDepositors: Array<{ id: string; email: string; name: string; count: number; usd: number }>
}

export default function Finance() {
  const { ksh, signed, short } = useKsh()
  const period = usePeriod('30d')
  const { data, error, loading } = useAdminData<Finance>(`/finance${period.query.replace(/^&/, "?")}`)
  const earned = data ? data.houseResult + data.withdrawalFees + data.depositFees - data.referralPaid : 0

  return (
    <>
      <PageHeader title="Finance" note="Real money only, VIP accounts left out. Deposits are customers' money held, not income.">
        <PeriodPicker period={period} options={PERIODS.filter(([k]) => k !== 'all')} />
      </PageHeader>
      {error && <Notice>{error}</Notice>}
      {loading && !data && <Loading />}

      {data && (
        <>
          <Kpis>
            <Stat icon={ArrowDownToLine} label="Money in" value={ksh(data.deposits)} note={`${count(data.depositsCount)} deposits from ${count(data.depositors)} users`} to="/deposits" />
            <Stat icon={ArrowUpFromLine} label="Money out" value={ksh(data.withdrawals)} note={`${count(data.withdrawalsCount)} withdrawals paid`} to="/withdrawals" />
            <Stat icon={Scale} label="Net flow" value={signed(data.net)} note="In less out" tone={data.net >= 0 ? 'good' : 'bad'} />
            <Stat
              icon={TrendingUp}
              label="House result"
              value={signed(data.houseResult)}
              note={`${count(data.trades)} contracts · ${ksh(data.volume)} staked`}
              tone={data.houseResult >= 0 ? 'good' : 'bad'}
              to="/trades"
            />
          </Kpis>

          <Kpis>
            <Stat icon={Landmark} label="Real balances, now" value={ksh(data.realBalances)} note={`Owed to ${count(data.fundedAccounts)} funded accounts`} />
            <Stat label="Withdrawals waiting" value={ksh(data.withdrawalsWaitingUsd)} note={`${count(data.withdrawalsWaiting)} to pay, now`} tone={data.withdrawalsWaiting ? 'warn' : undefined} to="/withdrawals" />
            <Stat label="Fees kept" value={ksh(data.withdrawalFees + data.depositFees)} note={`${ksh(data.withdrawalFees)} withdrawal · ${ksh(data.depositFees)} card`} />
            <Stat label="Referral commission" value={ksh(data.referralPaid)} note="Paid to referrers" />
            <Stat icon={UserPlus} label="First deposits" value={count(data.firstDeposits)} note="New paying users" />
            <Stat label="Earned" value={signed(earned)} note="House + fees − referrals" tone={earned >= 0 ? 'good' : 'bad'} />
          </Kpis>

          <Panel title={`Money in and out · ${day(data.since)} to ${day(data.until)}`}>
            <DayBars
              rows={data.days}
              format={ksh}
              short={short}
              height={260}
              series={[
                { key: 'deposits', label: 'Deposits', color: 'var(--series-in)' },
                { key: 'withdrawals', label: 'Withdrawals paid', color: 'var(--series-out)' },
              ]}
            />
          </Panel>

          <div className="grid gap-5 xl:grid-cols-3">
            <Panel title="Deposits by method">
              {data.byMethod.some((m) => m.type === 'deposit') ? (
                <ShareBars
                  format={ksh}
                  items={data.byMethod
                    .filter((m) => m.type === 'deposit')
                    .map((m) => ({ label: METHOD[m.method] ?? m.method, note: `${count(m.count)}`, value: m.usd }))}
                />
              ) : (
                <p className="text-sm text-muted">No deposits in this period.</p>
              )}
            </Panel>
            <Panel title="Withdrawals by method">
              {data.byMethod.some((m) => m.type === 'withdrawal') ? (
                <ShareBars
                  format={ksh}
                  items={data.byMethod
                    .filter((m) => m.type === 'withdrawal')
                    .map((m) => ({ label: METHOD[m.method] ?? m.method, note: `${count(m.count)}`, value: m.usd, color: 'var(--series-out)' }))}
                />
              ) : (
                <p className="text-sm text-muted">No withdrawals paid in this period.</p>
              )}
            </Panel>
            <Panel title="House result by day">
              <ul className="max-h-72 divide-y divide-line overflow-y-auto text-sm">
                {data.days
                  .filter((d) => d.house !== 0)
                  .reverse()
                  .map((d) => (
                    <li key={d.day} className="flex justify-between py-2 first:pt-0">
                      <span className="text-muted">{day(d.day)}</span>
                      <span className={`font-mono text-xs ${d.house > 0 ? 'text-good' : 'text-bad'}`}>{signed(d.house)}</span>
                    </li>
                  ))}
                {!data.days.some((d) => d.house !== 0) && <li className="text-muted">No real contracts settled.</li>}
              </ul>
            </Panel>
          </div>

          <Panel title="Top depositors" flush>
            {data.topDepositors.length === 0 ? (
              <EmptyState icon={ArrowDownToLine} title="No deposits in this period" />
            ) : (
              <Table minWidth="36rem" columns={['User', 'Name', { label: 'Deposits', right: true }, { label: 'Total', right: true }]}>
                {data.topDepositors.map((u) => (
                  <tr key={u.id}>
                    <td className={cell}>
                      <UserLink id={u.id} email={u.email} />
                    </td>
                    <td className={`${cell} text-muted`}>{u.name || '-'}</td>
                    <td className={num}>{count(u.count)}</td>
                    <td className={num}>{ksh(u.usd)}</td>
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
