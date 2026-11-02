import { motion } from 'framer-motion'
import { Footprints, QrCode } from 'lucide-react'
import { format } from 'date-fns'
import { EASE_OUT, StatusPill } from '@/components/kit'
import { useNowTick } from '@/hooks/useOutpassRequests'
import { formatSpan, formatSpanShort, formatTicker, formatTickerShort, openPassClock, type OpenPassInput } from '@/lib/outpass-open'
import { cn } from '@/lib/utils'

/**
 * The live strip on top of the pinned gate pass (owner 2026-10-31): "You are out - 1:05:12" with how long until the
 * expected return (rose once late), or "Your pass is ready - go out within 42:10" while the exit QR is valid. Ticks every
 * second; the figure is read out to screen readers only through the summary label (not every second).
 * Phones: the mobile app's OpenPassBanner - a 1.5px border in the state colour, an uppercase title with a live dot,
 * a 32px figure, a 6px track and a 12px line under it. Phones also keep long stretches short ("52 d 18 h", "4 h 12 m";
 * the ticking mm:ss only under an hour) - a phone-only figure and line beside the desktop ones, from the same values.
 */
export function OpenPassBanner({ pass }: { pass: OpenPassInput }) {
  const now = useNowTick(1000)
  const clock = openPassClock(pass, now)
  if (!clock) return null

  const out = clock.kind === 'out'
  const late = out && clock.overdue
  const tone = late ? 'rejected' : out ? 'waiting' : 'approved'
  const box = late
    ? 'border-rejected-border bg-rejected-bg'
    : out
      ? 'border-waiting-border bg-waiting-bg'
      : 'border-approved-border bg-approved-bg'
  const text = late ? 'text-rejected' : out ? 'text-waiting' : 'text-approved'
  const bar = late ? 'bg-destructive' : out ? 'bg-warning' : 'bg-success'
  const edge = late ? 'max-md:border-destructive' : out ? 'max-md:border-warning' : 'max-md:border-success'

  let title: string
  let big: string
  let bigPhone: string
  let unit: string
  let sub: string
  let subPhone: string
  if (clock.kind === 'out') {
    title = late ? 'You are late coming back' : 'You are out of the gate'
    big = formatTicker(clock.elapsedMs)
    bigPhone = formatTickerShort(clock.elapsedMs)
    unit = 'out for'
    const backBy = pass.expectedReturnAt ? format(new Date(pass.expectedReturnAt), 'h:mm a') : null
    const returnInMs = clock.returnInMs
    const subWith = (span: (ms: number) => string) =>
      returnInMs == null
        ? 'Make a return QR on the pass below and scan it at the gate when you are back.'
        : clock.overdue
          ? `Late by ${span(returnInMs)}. You said you would be back by ${backBy}.`
          : `Back by ${backBy} · ${span(returnInMs)} left`
    sub = subWith(formatSpan)
    subPhone = subWith(formatSpanShort)
  } else {
    title = 'Your pass is ready'
    big = formatTicker(clock.exitWindowMs)
    bigPhone = formatTickerShort(clock.exitWindowMs)
    unit = 'left to go out'
    sub = 'Go out through the gate before this runs out. Show the QR on the pass below.'
    subPhone = sub
  }
  const progress = clock.progress
  const summary = `${title}. ${out ? 'Out for' : 'Time left to go out:'} ${formatSpan(out ? clock.elapsedMs : clock.exitWindowMs)}. ${sub}`

  return (
    <div className={cn('flex flex-col gap-3 rounded-xl border-2 p-4 sm:p-5', 'max-md:gap-2 max-md:border-[1.5px] max-md:p-3.5!', box, edge)} role="group" aria-label={summary}>
      <div className="flex items-center justify-between gap-3">
        <StatusPill tone={tone === 'approved' ? 'live' : tone} dot className="max-md:hidden">
          {title}
        </StatusPill>
        {/* Phones: the app's live dot + uppercase title. */}
        <span className={cn('hidden max-md:flex max-md:items-center max-md:gap-2 max-md:text-[10.5px] max-md:leading-[14px] max-md:font-black max-md:tracking-[0.08em] max-md:uppercase', text)}>
          <span className="max-md:relative max-md:flex max-md:size-2 max-md:shrink-0" aria-hidden="true">
            <span className="max-md:absolute max-md:inset-0 max-md:animate-ping max-md:rounded-full max-md:bg-current max-md:opacity-50 motion-reduce:hidden" />
            <span className="max-md:relative max-md:size-2 max-md:rounded-full max-md:bg-current" />
          </span>
          {title}
        </span>
        {out ? <Footprints className={cn('size-5 max-md:size-[18px]', text)} aria-hidden="true" /> : <QrCode className={cn('size-5 max-md:size-[18px]', text)} aria-hidden="true" />}
      </div>
      <p className="flex flex-wrap items-baseline gap-x-2" aria-hidden="true">
        <span className="metric text-[40px] leading-[44px] text-foreground max-md:hidden">{big}</span>
        <span className="metric hidden max-md:inline max-md:text-[32px] max-md:leading-[38px] max-md:text-foreground">{bigPhone}</span>
        <span className="font-label text-[13px] font-semibold text-foreground/70 max-md:text-[12px] max-md:font-bold max-md:text-muted-foreground">{unit}</span>
      </p>
      {progress != null && (
        <div className="h-2 overflow-hidden rounded-full bg-foreground/[0.08] max-md:h-1.5 max-md:bg-card" aria-hidden="true">
          <motion.div
            className={cn('h-full rounded-full', bar)}
            initial={false}
            animate={{ width: `${Math.max(3, progress * 100)}%` }}
            transition={{ duration: 0.6, ease: EASE_OUT }}
          />
        </div>
      )}
      <p className={cn('text-[13.5px] leading-5 max-md:text-[12px] max-md:leading-[17px]', late ? 'font-bold text-rejected' : 'text-foreground/85 max-md:text-secondary-foreground')} aria-hidden="true">
        <span className="max-md:hidden">{sub}</span>
        <span className="hidden max-md:inline">{subPhone}</span>
      </p>
    </div>
  )
}
