import { CalendarHeart, Info } from 'lucide-react'
import { GlassCard, SectionHeader, StatusPill } from '@/components/kit'
import { cn } from '@/lib/utils'
import { slipClView, type SlipClSplitRow } from '@/lib/slip-casual-leave'
import type { SalaryPeriod } from '@/lib/salary-insights'
import { PhoneCardTitle } from './PhoneParts'

const SPLIT_LOOK: Record<SlipClSplitRow['kind'], { row: string; value: string }> = {
  part: { row: '', value: 'font-semibold' },
  total: { row: 'font-bold', value: '' },
  loss: { row: '', value: 'font-bold text-rejected' },
  reference: { row: 'text-muted-foreground', value: 'font-semibold' },
}

/**
 * "Casual Leave this month" (owner 2026-11-28; the mobile app's SlipCasualLeaveCard): whether Casual Leave was used in the
 * slip's month, the days used and paid, what the paid days were paid, and the salary earned split into days worked + paid
 * Casual Leave + holiday pay, then the loss of pay and the monthly salary; each Casual Leave date and whether this slip
 * paid it. All of it is the server's `casualLeave` (read off the stored slip; Casual Leave pay is part of the salary
 * earned, not an extra amount). An older slip has no money figures: the server's note says so. Nothing on a slip Casual
 * Leave does not apply to (production / per-shift pay) or from an older server.
 */
export function SlipCasualLeaveCard({ period: p }: { period: SalaryPeriod }) {
  const v = slipClView(p.casualLeave, p.period.label)
  if (!v) return null
  const pill = (
    <StatusPill tone={v.used ? 'approved' : 'neutral'} size="sm" icon={false}>
      {v.used ? 'Used' : 'Not used'}
    </StatusPill>
  )
  return (
    <GlassCard className="flex flex-col gap-3 max-md:gap-2 max-md:p-4" data-testid="slip-casual-leave">
      <SectionHeader className="max-md:hidden" as="h3" icon={CalendarHeart} tone="violet" title="Casual Leave this month" description={v.headline} action={pill} />
      <div className="hidden max-md:flex max-md:items-start max-md:justify-between max-md:gap-2">
        <PhoneCardTitle icon={CalendarHeart} tone="violet" title="Casual Leave this month" />
        {pill}
      </div>
      <p className="hidden max-md:block max-md:text-[12.5px] max-md:font-semibold">{v.headline}</p>

      {v.figures.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px] sm:grid-cols-4">
          {v.figures.map((f) => (
            <div key={f.key} className="min-w-0">
              <dt className="text-muted-foreground max-md:text-[10.5px] max-md:font-bold max-md:tracking-[0.03em] max-md:uppercase">{f.label}</dt>
              <dd className={cn('text-[15px] font-bold tabular-nums', f.key === 'amount' && 'text-violet', f.key === 'unpaid' && 'text-waiting')}>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {v.split.length > 0 && (
        <div className="flex flex-col">
          <p className="label-caps text-muted-foreground">How your salary earned is made up</p>
          <dl className="mt-1 flex flex-col text-[13px]">
            {v.split.map((r) => (
              <div key={r.key} className={cn('flex items-baseline justify-between gap-3 border-b hairline py-2 last:border-b-0 max-md:border-input', SPLIT_LOOK[r.kind].row)}>
                <dt className="min-w-0">
                  {r.label}
                  {r.sub && <span className="block text-[11.5px] font-normal text-muted-foreground">{r.sub}</span>}
                </dt>
                <dd className={cn('shrink-0 tabular-nums', SPLIT_LOOK[r.kind].value, r.key === 'casualLeave' && 'text-violet')}>{r.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {v.dates.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="label-caps text-muted-foreground">Casual Leave dates</p>
          <ul className="flex flex-col text-[13px]">
            {v.dates.map((d) => (
              <li key={d.key} className="flex flex-wrap items-baseline justify-between gap-x-3 border-b hairline py-1.5 last:border-b-0 max-md:border-input">
                <span>
                  {d.day} <span className="text-muted-foreground">· {d.portion}</span>
                </span>
                {d.paid && <span className={cn('text-[12px] font-semibold', d.paidTone === 'approved' ? 'text-approved' : 'text-waiting')}>{d.paid}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {v.note && (
        <p className="flex items-start gap-2 text-[12.5px] text-muted-foreground max-md:rounded-lg max-md:bg-muted max-md:p-2.5 max-md:text-[12px] max-md:leading-[17px]">
          <Info className="mt-0.5 size-4 shrink-0 max-md:mt-px max-md:size-[15px]" aria-hidden="true" />
          {v.note}
        </p>
      )}
    </GlassCard>
  )
}
