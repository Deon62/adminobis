import { useMemo, useState } from 'react'
import { Filter } from './ui'

/**
 * A time range picked from a dropdown, in Nairobi days (UTC+3, no daylight
 * saving), since that is the day the business runs on. "Custom" opens two
 * date boxes. `since`/`until` are ISO instants for the API, until exclusive.
 */
export type PeriodKey = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'lastMonth' | '90d' | 'all' | 'custom'

const OFFSET = 3 * 3600 * 1000
const DAY = 86400 * 1000

/** Midnight in Nairobi, `back` days ago, as an instant. */
function midnight(back = 0) {
  const local = Date.now() + OFFSET
  return new Date(Math.floor(local / DAY) * DAY - OFFSET - back * DAY)
}

function monthStart(offsetMonths = 0) {
  const local = new Date(Date.now() + OFFSET)
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + offsetMonths, 1) - OFFSET)
}

/** A yyyy-mm-dd from a date box, as Nairobi midnight. */
const fromBox = (value: string, plusDays = 0) => new Date(Date.parse(`${value}T00:00:00Z`) - OFFSET + plusDays * DAY)
const toBox = (date: Date) => new Date(date.getTime() + OFFSET).toISOString().slice(0, 10)

export const PERIODS: Array<[PeriodKey, string]> = [
  ['today', 'Today'],
  ['yesterday', 'Yesterday'],
  ['7d', 'Last 7 days'],
  ['30d', 'Last 30 days'],
  ['month', 'This month'],
  ['lastMonth', 'Last month'],
  ['90d', 'Last 90 days'],
  ['all', 'All time'],
  ['custom', 'Custom range'],
]

export function usePeriod(initial: PeriodKey = 'today') {
  const [key, setKey] = useState<PeriodKey>(initial)
  const [from, setFrom] = useState(() => toBox(midnight(6)))
  const [to, setTo] = useState(() => toBox(midnight()))

  const range = useMemo(() => {
    let since: Date | null = null
    let until: Date | null = null
    switch (key) {
      case 'today':
        since = midnight()
        break
      case 'yesterday':
        since = midnight(1)
        until = midnight()
        break
      case '7d':
        since = midnight(6)
        break
      case '30d':
        since = midnight(29)
        break
      case '90d':
        since = midnight(89)
        break
      case 'month':
        since = monthStart()
        break
      case 'lastMonth':
        since = monthStart(-1)
        until = monthStart()
        break
      case 'custom':
        if (from) since = fromBox(from)
        if (to) until = fromBox(to, 1)
        break
    }
    return { since: since?.toISOString() ?? null, until: until?.toISOString() ?? null }
    // the key is the whole story except for custom; re-evaluated on every pick
  }, [key, from, to])

  const label = key === 'custom' ? `${from || '…'} to ${to || '…'}` : PERIODS.find(([k]) => k === key)?.[1] ?? ''
  const query = (range.since ? `&since=${encodeURIComponent(range.since)}` : '') + (range.until ? `&until=${encodeURIComponent(range.until)}` : '')

  return { key, setKey, from, setFrom, to, setTo, ...range, label, query }
}

export function PeriodPicker({ period, options = PERIODS }: { period: ReturnType<typeof usePeriod>; options?: Array<[PeriodKey, string]> }) {
  return (
    <>
      <Filter<PeriodKey> label="Period" value={period.key} onChange={period.setKey} options={options} />
      {period.key === 'custom' && (
        <span className="flex h-9 items-center gap-2 border border-line bg-surface px-3 text-xs">
          <input
            type="date"
            aria-label="From"
            value={period.from}
            max={period.to || undefined}
            onChange={(event) => period.setFrom(event.target.value)}
            className="bg-transparent text-text outline-none [color-scheme:inherit]"
          />
          <span className="text-muted">to</span>
          <input
            type="date"
            aria-label="To"
            value={period.to}
            min={period.from || undefined}
            onChange={(event) => period.setTo(event.target.value)}
            className="bg-transparent text-text outline-none"
          />
        </span>
      )}
    </>
  )
}
