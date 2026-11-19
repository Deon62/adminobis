import { useState } from 'react'
import { cn } from '../lib/format'

export type Series = { key: string; label: string; color: string }

/**
 * Paired daily bars (e.g. deposits and withdrawals), one shared axis. Hovering
 * a day shows its figures; a legend names the series, so colour is never the
 * only cue.
 */
export function DayBars<T extends { day: string }>({
  rows,
  series,
  format,
  short,
  height = 220,
}: {
  rows: T[]
  series: Series[]
  format: (value: number) => string
  short: (value: number) => string
  height?: number
}) {
  const [hover, setHover] = useState<number | null>(null)
  const value = (row: T, key: string) => Number((row as Record<string, unknown>)[key] ?? 0)
  const peak = Math.max(1, ...rows.flatMap((row) => series.map((s) => value(row, s.key))))
  const ticks = [0.25, 0.5, 0.75, 1]
  const label = (day: string) => new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  const every = Math.max(1, Math.ceil(rows.length / 10))
  const shown = hover ?? rows.length - 1
  const focus = rows[shown]

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <ul className="flex flex-wrap gap-4 text-xs text-muted">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-2">
              <span className="size-2.5 rounded-[2px]" style={{ background: s.color }} aria-hidden="true" />
              {s.label}
            </li>
          ))}
        </ul>
        {focus && (
          <p className="text-xs text-muted">
            <span className="text-text">{label(focus.day)}</span>
            {series.map((s) => (
              <span key={s.key}>
                {' · '}
                {s.label} <span className="font-mono text-text">{format(value(focus, s.key))}</span>
              </span>
            ))}
          </p>
        )}
      </div>
      <div className="relative" style={{ height }}>
        {ticks.map((t) => (
          <div key={t} className="absolute inset-x-0 border-t border-dashed border-line" style={{ bottom: `${t * 100}%` }}>
            <span className="absolute -top-2 left-0 bg-surface pr-2 font-mono text-[10px] text-faint">{short(peak * t)}</span>
          </div>
        ))}
        <div className="absolute inset-0 flex items-end border-b border-line pl-14" onMouseLeave={() => setHover(null)}>
          {rows.map((row, i) => (
            <div
              key={row.day}
              className={cn('flex h-full min-w-0 flex-1 items-end justify-center gap-[2px] px-[12%]', hover === i && 'bg-hover')}
              onMouseEnter={() => setHover(i)}
              title={`${label(row.day)}: ${series.map((s) => `${s.label} ${format(value(row, s.key))}`).join(', ')}`}
            >
              {series.map((s) => {
                const v = value(row, s.key)
                return (
                  <span
                    key={s.key}
                    className="block max-w-6 flex-1 rounded-t-[4px]"
                    style={{ height: v > 0 ? `max(2px, ${(v / peak) * 100}%)` : 0, background: s.color }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex pl-14">
        {rows.map((row, i) => (
          <span key={row.day} className="min-w-0 flex-1 truncate text-center font-mono text-[10px] text-faint">
            {i % every === 0 || i === rows.length - 1 ? label(row.day) : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Horizontal share bars: one row per item, value on the right. */
export function ShareBars({ items, format }: { items: Array<{ label: string; value: number; note?: string; color?: string }>; format: (value: number) => string }) {
  const peak = Math.max(1, ...items.map((item) => item.value))
  return (
    <ul className="space-y-3.5">
      {items.map((item) => (
        <li key={item.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span>
              {item.label}
              {item.note && <span className="ml-2 text-xs text-muted">{item.note}</span>}
            </span>
            <span className="font-mono text-xs tabular-nums">{format(item.value)}</span>
          </div>
          <div className="mt-1.5 h-1.5 bg-hover">
            <div className="h-full rounded-r-[4px]" style={{ width: `${(item.value / peak) * 100}%`, background: item.color ?? 'var(--series-in)' }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
