import { TONE_SOFT } from '@/components/kit'
import { targetOf } from '@/lib/notification-target'
import { notificationHeadline, previewLine } from '@/lib/notification-list'
import { cn } from '@/lib/utils'
import type { Notification } from '@/types'
import { notificationLook } from './kinds'
import { TodoCheck } from './TodoCheck'

/**
 * One notification as a to-do row (owner 2026-11-25, mirror of the mobile app's NotificationRow): the round check (tick
 * = mark read), the type icon, the headline, one line of the message, the time and an unread dot. Clicking the row opens
 * it in the detail dialog; nothing in the list navigates. The rows of one day sit together in one card.
 */
export function NotificationRow({
  n,
  time,
  tickDelay = 0,
  onOpen,
  onTick,
}: {
  n: Notification
  /** "5 min ago", "9:14 am", "12 Nov". */
  time: string
  /** "Mark all read" ripples the ticks down the list (ms). */
  tickDelay?: number
  onOpen: () => void
  onTick: () => void
}) {
  const look = notificationLook(n, targetOf(n))
  const Icon = look.icon
  const headline = notificationHeadline(n)
  const preview = previewLine(n.message)
  const unread = !n.isRead

  return (
    <div
      className={cn(
        'group/row relative flex items-center gap-1 pr-3 pl-1 transition-colors hover:bg-foreground/[0.03] max-md:gap-0.5 max-md:pr-2.5',
        unread && 'bg-primary/[0.035]',
      )}
      data-testid="notification"
      data-unread={unread}
    >
      <TodoCheck checked={n.isRead} onCheck={onTick} delay={tickDelay} label={`Mark as read: ${headline}`} />
      <button
        type="button"
        onClick={onOpen}
        className="focus-ring flex min-w-0 flex-1 items-center gap-3 rounded-lg py-3 text-left max-md:gap-2.5 max-md:py-2.5"
        aria-label={`${unread ? 'Unread. ' : ''}${headline}. ${preview}. ${time}. Opens the notification`}
      >
        <span
          aria-hidden="true"
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-full border transition-opacity max-md:size-[34px] max-md:border-0',
            TONE_SOFT[look.tone],
            !unread && 'opacity-70',
          )}
        >
          <Icon className="size-[17px] max-md:size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              'block truncate text-[14px] leading-5 max-md:text-[13.5px]',
              unread ? 'font-semibold text-foreground' : 'font-medium text-foreground/70',
            )}
          >
            {headline}
          </span>
          <span className={cn('block truncate text-[13px] leading-[18px] max-md:text-[12.5px]', unread ? 'text-secondary-foreground' : 'text-muted-foreground')}>
            {preview}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1.5 self-start pt-0.5">
          <time dateTime={n.createdAt} className={cn('text-[11.5px] whitespace-nowrap tabular-nums', unread ? 'font-semibold text-primary' : 'text-muted-foreground')}>
            {time}
          </time>
          <span aria-hidden="true" className={cn('size-2 rounded-full bg-primary transition-[opacity,scale] duration-300', unread ? 'opacity-100' : 'scale-50 opacity-0')} />
        </span>
      </button>
    </div>
  )
}
