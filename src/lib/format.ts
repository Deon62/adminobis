import { createContext, useContext } from 'react'

export const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ')

/** An ISO time to a short local date and time. */
export const when = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '-'

export const day = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '-'

export const ago = (iso: string | null | undefined) => {
  if (!iso) return '-'
  const secs = (Date.now() - new Date(iso).getTime()) / 1000
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

/** Dollars as they are stored, for the few places the USD figure matters (e.g. VIP credits). */
export const usd = (value: number | null | undefined) =>
  value == null
    ? '-'
    : (value < 0 ? '-$' : '$') + Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const count = (value: number | null | undefined) => (value == null ? '-' : value.toLocaleString())

/**
 * The USD to KES rate the API converts M-Pesa amounts at (USD_KES_RATE). Every
 * figure on the admin site is shown in shillings; the API keeps dollars.
 */
export const RateContext = createContext(129.5)
export const useRate = () => useContext(RateContext)

const shillings = (kes: number, decimals = 0) =>
  (kes < 0 ? '-KSh ' : 'KSh ') + Math.abs(kes).toLocaleString('en-KE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

/** A formatter bound to the current rate: ksh(usd) gives "KSh 1,295". */
export function useKsh() {
  const rate = useRate()
  const ksh = (value: number | null | undefined) => (value == null ? '-' : shillings(value * rate))
  const signed = (value: number | null | undefined) => (value == null ? '-' : (value > 0 ? '+' : '') + shillings(value * rate))
  /** Short form for charts and tight spots: KSh 12.4K, KSh 1.2M. */
  const short = (value: number | null | undefined) => {
    if (value == null) return '-'
    const kes = value * rate
    const abs = Math.abs(kes)
    const sign = kes < 0 ? '-' : ''
    if (abs >= 1e6) return `${sign}KSh ${(abs / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}M`
    if (abs >= 1e4) return `${sign}KSh ${(abs / 1e3).toFixed(abs >= 1e5 ? 0 : 1)}K`
    return shillings(kes)
  }
  return { ksh, signed, short, rate }
}

/**
 * What a transaction is worth in shillings: the exact KES amount when the
 * money moved by M-Pesa, otherwise the dollar amount at the current rate.
 */
export function useTxKsh() {
  const { ksh } = useKsh()
  return (tx: { local: number | null; localCurrency: string | null; amount: number }) =>
    tx.local != null && tx.localCurrency === 'KES' ? shillings(tx.local) : ksh(tx.amount)
}
