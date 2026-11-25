import { Link } from 'wouter'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TONE_SOFT, TONE_TEXT } from '@/components/kit'
import { notificationLink, targetOf, type NotificationLinkViewer } from '@/lib/notification-target'
import { fullTime, notificationHeadline, notificationKindTitle } from '@/lib/notification-list'
import { cn } from '@/lib/utils'
import type { Notification } from '@/types'
import { notificationLook } from './kinds'

/**
 * One notification, large and easy to read (owner 2026-11-25, mirror of the mobile app's NotificationDetailSheet): its
 * kind, when it came, the headline and the whole message - and, when it is about something in the app
 * (lib/notification-target.ts), ONE small link to open it. The message can be selected and copied. Opening it marks it
 * read (the page does that); a bottom sheet on phones (ui/dialog).
 */
export function NotificationDetailDialog({
  n,
  open,
  now,
  viewer,
  onClose,
}: {
  /** The notification shown; the page keeps it while the dialog fades out. */
  n: Notification | null
  open: boolean
  now: Date
  viewer: NotificationLinkViewer
  onClose: () => void
}) {
  const look = n ? notificationLook(n, targetOf(n)) : null
  const Icon = look?.icon
  const link = n ? notificationLink(n, viewer) : null

  return (
    <Dialog open={open && !!n} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg" data-testid={n ? `notification-${n.id}-detail` : undefined}>
        {n && look && Icon && (
          <>
            <DialogHeader className="gap-3 text-left">
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className={cn('grid size-12 shrink-0 place-items-center rounded-2xl border max-md:rounded-full max-md:border-0', TONE_SOFT[look.tone])}>
                  <Icon className="size-[22px]" />
                </span>
                <div className="min-w-0">
                  <p className={cn('text-[13px] font-bold', TONE_TEXT[look.tone])}>{notificationKindTitle(n.type)}</p>
                  <p className="text-[12.5px] text-muted-foreground">
                    <time dateTime={n.createdAt}>{fullTime(n.createdAt, now)}</time>
                  </p>
                </div>
              </div>
              <DialogTitle className="text-[21px] leading-7 break-words max-md:text-[19px]">{notificationHeadline(n)}</DialogTitle>
              <DialogDescription className="sr-only">The whole notification</DialogDescription>
            </DialogHeader>

            <p className="text-[15.5px] leading-7 break-words whitespace-pre-line text-foreground/90 select-text max-md:text-[15px] max-md:leading-[24px]">
              {n.message}
            </p>

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t hairline pt-3 max-md:border-input">
              <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-approved">
                <CheckCircle2 className="size-4" aria-hidden="true" /> Marked as read
              </span>
              {link && (
                <Link
                  href={link.href}
                  onClick={onClose}
                  className="focus-ring inline-flex min-h-9 items-center gap-1 rounded-md text-[13.5px] font-semibold text-primary underline-offset-4 hover:underline"
                  data-testid={`notification-${n.id}-view`}
                >
                  {link.label} <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
