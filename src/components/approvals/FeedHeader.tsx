import { BellRing, CheckCheck, CheckCircle2, XCircle } from 'lucide-react'
import type { ApprovalStatus } from '@/lib/approvals-history'
import { headerTitle } from '@/lib/approvals-feed'
import { cn } from '@/lib/utils'

/**
 * The header in front of each status group of the all-statuses list (owner 2026-11-25, mirror of the mobile app's
 * FeedHeader): "Waiting for your decision · 3" on an amber band first, then "Approved · 12" and "Rejected · 4" as plain
 * headings. `empty`: nothing waits for this head ("All caught up"), shown above the decided requests so it is seen at once.
 */
export function FeedHeader({ status, count, empty }: { status: ApprovalStatus; count: number; empty?: boolean }) {
  if (status === 'pending' && empty) {
    return (
      <div
        role="heading"
        aria-level={3}
        className="flex items-center gap-2 rounded-xl border border-approved-border bg-approved-bg px-3 py-2 text-approved max-md:border-0"
        data-testid="approvals-header-caught-up"
      >
        <CheckCheck className="size-4 shrink-0" aria-hidden="true" />
        <span className="text-[13.5px] font-semibold">All caught up</span>
        <span className="ml-auto truncate text-[12px] text-foreground/75">Nothing waits for your decision.</span>
      </div>
    )
  }

  const pending = status === 'pending'
  const Icon = pending ? BellRing : status === 'approved' ? CheckCircle2 : XCircle
  return (
    <div
      role="heading"
      aria-level={3}
      aria-label={`${headerTitle(status)}, ${count}`}
      className={cn(
        'flex items-center gap-2',
        pending
          ? 'rounded-xl border border-waiting-border bg-waiting-bg px-3 py-2 max-md:border-[1.5px]'
          : 'px-1 pt-2 pb-0.5',
      )}
      data-testid={`approvals-header-${status}`}
    >
      <Icon
        className={cn('size-4 shrink-0', pending ? 'text-waiting' : status === 'approved' ? 'text-approved' : 'text-rejected')}
        aria-hidden="true"
      />
      <span className={cn('text-[13.5px] font-semibold', pending ? 'text-foreground' : 'text-secondary-foreground')}>{headerTitle(status)}</span>
      <span
        className={cn(
          'grid min-w-6 place-items-center rounded-full px-1.5 text-[12px] leading-5 font-extrabold tabular-nums',
          pending ? 'bg-warning text-warning-foreground' : 'bg-foreground/[0.07] text-secondary-foreground',
        )}
        aria-hidden="true"
      >
        {count}
      </span>
    </div>
  )
}
