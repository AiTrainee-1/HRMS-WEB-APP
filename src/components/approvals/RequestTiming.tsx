import { CalendarCheck2, CalendarClock, CalendarDays, CalendarX2, SendHorizontal, type LucideIcon } from 'lucide-react'
import type { ApprovalCategory, ApprovalItem } from '@/lib/approvals-history'
import { requestTiming, type LeadTime, type LeadTone } from '@/lib/request-lead-time'
import { cn } from '@/lib/utils'

const LEAD_ICON: Record<LeadTone, LucideIcon> = {
  early: CalendarCheck2,
  sameDay: CalendarClock,
  late: CalendarX2,
}

// green = applied ahead, amber = on the day itself, rose = applied afterwards (AA in both themes).
const LEAD_TONE: Record<LeadTone, string> = {
  early: 'bg-approved-bg text-approved border-approved-border',
  sameDay: 'bg-waiting-bg text-waiting border-waiting-border',
  late: 'bg-rejected-bg text-rejected border-rejected-border',
}

/** "Applied 3 days before" (green) / "Applied on the same day" (amber) / "Applied 2 days after" (rose). */
export function LeadChip({ lead, className }: { lead: LeadTime; className?: string }) {
  const Icon = LEAD_ICON[lead.tone]
  return (
    <span
      className={cn(
        'inline-flex w-fit max-w-full items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] font-semibold max-md:border-0 max-md:py-1 max-md:text-[11.5px] max-md:font-bold',
        LEAD_TONE[lead.tone],
        className,
      )}
      data-testid="approval-lead"
    >
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{lead.text}</span>
    </span>
  )
}

/**
 * When a request is for (date, with the time where it matters), when it was submitted (date and time, IST) and how far
 * ahead it was applied (owner 2026-11-25, lib/request-lead-time.ts). `card`: two compact lines and the chip; `dialog`: a
 * framed block at the top of the request's details.
 */
export function RequestTiming({
  category,
  item,
  variant = 'card',
}: {
  category: ApprovalCategory
  item: ApprovalItem
  variant?: 'card' | 'dialog'
}) {
  const t = requestTiming(category, item)
  const dialog = variant === 'dialog'
  const forLabel = category === 'resignation' ? 'Last day' : 'For'
  const rows: [LucideIcon, string, string][] = [[CalendarDays, forLabel, t.requested]]
  if (t.submitted) rows.push([SendHorizontal, 'Submitted', t.submitted])

  return (
    <div
      className={cn(
        'flex flex-col',
        dialog ? 'gap-2 rounded-xl border border-input bg-foreground/[0.03] p-3' : 'gap-1.5',
      )}
      data-testid={`approval-timing-${item.id}`}
    >
      <dl className={cn('flex flex-col', dialog ? 'gap-1.5' : 'gap-1')}>
        {rows.map(([Icon, label, value]) => (
          <div key={label} className="flex min-w-0 items-center gap-1.5">
            <Icon className={cn('shrink-0 text-muted-foreground', dialog ? 'size-4' : 'size-3.5')} aria-hidden="true" />
            <dt
              className={cn(
                'shrink-0 font-semibold text-muted-foreground',
                dialog ? 'min-w-[76px] text-[12.5px]' : 'min-w-[66px] text-[12px] max-md:min-w-[62px] max-md:text-[11.5px]',
              )}
            >
              {label}
            </dt>
            <dd
              className={cn(
                'min-w-0 tabular-nums',
                dialog
                  ? 'text-[13.5px] font-semibold text-foreground'
                  : 'truncate text-[13px] font-semibold text-foreground/90 max-md:text-[12.5px] max-md:font-normal max-md:text-secondary-foreground',
              )}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {t.lead && <LeadChip lead={t.lead} />}
    </div>
  )
}
