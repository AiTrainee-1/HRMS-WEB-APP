// Rupee amounts in the Indian way: 12,34,567.50 (lakh / crore grouping). Pure, so `npm test` runs it (money.test.ts),
// and deterministic: it never depends on the browser's locale data, so every PC and phone shows the same text.

export type MoneyInput = number | string | null | undefined

export interface MoneyOptions {
  /** 'auto' (default): no paise for a whole amount, two digits otherwise. 0 or 2 forces it. */
  decimals?: 'auto' | 0 | 2
  /** Prefix the rupee sign (default true). */
  symbol?: boolean
  /** Show "+" for positive amounts (a credit next to a debit). Negatives always show "-". */
  sign?: boolean
  /** What to show when there is no amount (default an em dash). */
  empty?: string
}

/** A number from whatever the API sent: 1234, "1234.50", "1,234.50", " 12 ". Null when it is not a number. */
export function toAmount(value: MoneyInput): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const cleaned = String(value).replace(/[₹,\s]/g, '')
  if (cleaned === '' || cleaned === '-' || cleaned === '+') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/** "1234567" -> "12,34,567": the last three digits, then pairs. Digits only, no sign or decimals. */
export function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits
  const last3 = digits.slice(-3)
  const rest = digits.slice(0, -3)
  return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}`
}

/** 1234567.5 -> "12,34,567.50" (decimals per `decimals`), no sign, no symbol. */
export function formatIndianNumber(value: number, decimals: 'auto' | 0 | 2 = 'auto'): string {
  const abs = Math.abs(value)
  // Round once to paise so 0.005 artefacts never show as "1,234.99999".
  const paise = Math.round(abs * 100)
  const whole = Math.floor(paise / 100)
  const fraction = paise % 100
  const digits = decimals === 0 || (decimals === 'auto' && fraction === 0)
  if (digits) {
    const rounded = decimals === 0 ? Math.round(abs) : whole
    return groupIndian(String(rounded))
  }
  return `${groupIndian(String(whole))}.${String(fraction).padStart(2, '0')}`
}

/** A whole count with Indian grouping: 1234567.4 -> "12,34,567", -3 -> "-3". The kit's AnimatedNumber default. */
export function formatCount(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const r = Math.round(value)
  return (r < 0 ? '-' : '') + groupIndian(String(Math.abs(r)))
}

/** "₹12,34,567", "₹1,234.50", "-₹500", "+₹250" (sign: true), "—" for nothing. */
export function formatINR(value: MoneyInput, options: MoneyOptions = {}): string {
  const { decimals = 'auto', symbol = true, sign = false, empty = '—' } = options
  const n = toAmount(value)
  if (n === null) return empty
  const body = formatIndianNumber(n, decimals)
  // "-0" after rounding is just zero.
  const isZero = body.replace(/[0,.]/g, '') === ''
  const prefix = n < 0 && !isZero ? '-' : sign && n > 0 && !isZero ? '+' : ''
  return `${prefix}${symbol ? '₹' : ''}${body}`
}

/** Short form for tiles and charts: "₹950", "₹12.5K", "₹3.4 L", "₹1.2 Cr". One decimal, trailing ".0" dropped. */
export function formatINRCompact(value: MoneyInput, options: Pick<MoneyOptions, 'symbol' | 'empty'> = {}): string {
  const { symbol = true, empty = '—' } = options
  const n = toAmount(value)
  if (n === null) return empty
  const abs = Math.abs(n)
  const sym = symbol ? '₹' : ''
  const neg = n < 0 ? '-' : ''
  const short = (x: number) => (Math.round(x * 10) / 10).toFixed(1).replace(/\.0$/, '')
  if (abs >= 1_00_00_000) return `${neg}${sym}${short(abs / 1_00_00_000)} Cr`
  if (abs >= 1_00_000) return `${neg}${sym}${short(abs / 1_00_000)} L`
  if (abs >= 10_000) return `${neg}${sym}${short(abs / 1_000)}K`
  return `${neg}${sym}${formatIndianNumber(abs, 0)}`
}

/** How a screen reader should hear an amount: "₹1,234.50" reads fine, but a leading hyphen is often skipped, so a
 *  negative is said out loud: "minus ₹500". */
export function spokenINR(value: MoneyInput): string {
  const n = toAmount(value)
  if (n === null) return 'no amount'
  const text = formatINR(Math.abs(n))
  return n < 0 ? `minus ${text}` : text
}
