import { formatINR, formatINRCompact, spokenINR, toAmount, type MoneyInput, type MoneyOptions } from '@/lib/money'
import { cn } from '@/lib/utils'
import { AnimatedNumber } from './AnimatedNumber'

/**
 * A rupee amount, the Indian way: ₹12,34,567 · ₹1,234.50 · -₹500. Tabular figures so columns line up. Accepts numbers or
 * the numeric strings the API sends; shows "—" for nothing.
 *   tone="auto"   green for money in (> 0), rose for money out (< 0)
 *   compact       ₹3.4 L / ₹12.5K for tiles and charts (the full amount is still read out)
 *   animate       counts up (KPIs only — never in tables or forms)
 *
 *   <MoneyText value={slip.netPay} className="metric text-3xl" animate />
 *   <MoneyText value={-deduction} tone="auto" sign />
 */
export function MoneyText({
  value,
  decimals = 'auto',
  sign,
  compact,
  tone = 'none',
  animate,
  className,
}: {
  value: MoneyInput
  decimals?: MoneyOptions['decimals']
  /** Show "+" on positive amounts. */
  sign?: boolean
  compact?: boolean
  tone?: 'none' | 'auto'
  animate?: boolean
  className?: string
}) {
  const n = toAmount(value)
  const toneClass = tone === 'auto' && n !== null ? (n > 0 ? 'text-approved' : n < 0 ? 'text-rejected' : '') : ''
  const text = compact ? formatINRCompact(value) : formatINR(value, { decimals, sign })
  if (animate && n !== null && !compact) {
    return (
      <AnimatedNumber
        value={n}
        format={(v) => formatINR(decimals === 0 || (decimals === 'auto' && Number.isInteger(n)) ? Math.round(v) : v, { decimals, sign })}
        className={cn('whitespace-nowrap', toneClass, className)}
      />
    )
  }
  return (
    <span
      className={cn('whitespace-nowrap tabular-nums', toneClass, className)}
      aria-label={n !== null && (compact || n < 0) ? spokenINR(n) : undefined}
    >
      {text}
    </span>
  )
}
