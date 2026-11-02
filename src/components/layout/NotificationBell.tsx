import * as React from 'react'
import { Bell, BellOff, ChevronRight } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'wouter'
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { notificationApi } from '@/api/resources'
import { relativeTime } from '@/lib/relative-time'
import { popIn } from '@/components/kit/motion'
import { useReducedMotion } from '@/components/kit/useReducedMotion'
import { cn } from '@/lib/utils'

export function NotificationBell() {
  const [open, setOpen] = React.useState(false)
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationApi.list,
    refetchInterval: 60_000,
  })

  const unread = data?.filter((n) => !n.isRead) ?? []
  const preview = (data ?? []).slice(0, 5)

  // A small ring of the bell when the unread count goes UP (a new one arrived), never on first load.
  const controls = useAnimationControls()
  const reduced = useReducedMotion()
  const lastCount = React.useRef<number | null>(null)
  React.useEffect(() => {
    const count = unread.length
    if (lastCount.current !== null && count > lastCount.current && !reduced) {
      void controls.start({ rotate: [0, -16, 14, -10, 6, 0], transition: { duration: 0.7 } })
    }
    lastCount.current = count
  }, [unread.length, controls, reduced])

  const label = unread.length > 0 ? `Notifications, ${unread.length} unread` : 'Notifications'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={label}
        className="focus-ring relative grid size-10 place-items-center rounded-full text-foreground/80 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
      >
        <motion.span animate={controls} className="grid origin-top place-items-center">
          <Bell className="size-5" aria-hidden="true" />
        </motion.span>
        <AnimatePresence>
          {unread.length > 0 && (
            <motion.span
              key="count"
              variants={popIn}
              initial="hidden"
              animate="show"
              exit="exit"
              aria-hidden="true"
              className="absolute -top-0.5 -right-0.5 flex size-[18px] items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white ring-2 ring-background"
            >
              {unread.length > 9 ? '9+' : unread.length}
            </motion.span>
          )}
        </AnimatePresence>
      </PopoverTrigger>
      <PopoverContent className="w-[22rem] max-w-[calc(100vw-1.5rem)] overflow-hidden p-0" align="end">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="font-display text-base font-semibold">Notifications</span>
          {unread.length > 0 && (
            <span className="font-label rounded-full border border-waiting-border bg-waiting-bg px-2 py-px text-[11px] font-bold text-waiting">
              {unread.length} unread
            </span>
          )}
        </div>
        <div className="bg-silk h-px opacity-60" aria-hidden="true" />
        <div className="scrollbar-thin max-h-80 overflow-y-auto">
          {preview.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground">
              <BellOff className="size-6 opacity-60" aria-hidden="true" />
              No notifications yet
            </div>
          )}
          {/* Each one opens the Notifications page pointed at it, where its Read / View buttons are. */}
          {preview.map((n) => (
            <Link
              key={n.id}
              href={`/employee/notifications?highlight=${encodeURIComponent(String(n.id))}`}
              onClick={() => setOpen(false)}
              className={cn(
                'focus-ring flex gap-2.5 border-b hairline px-4 py-3 text-sm transition-colors last:border-b-0 hover:bg-foreground/[0.04]',
                !n.isRead && 'bg-primary/[0.07]',
              )}
            >
              <span className={cn('pip mt-1.5', !n.isRead ? 'text-brand-blue' : 'text-transparent')} aria-hidden="true" />
              <div className="min-w-0">
                {n.title && <p className="font-semibold">{n.title}</p>}
                <p className="line-clamp-2">{n.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {relativeTime(n.createdAt)}
                  {!n.isRead && <span className="sr-only"> (unread)</span>}
                </p>
              </div>
            </Link>
          ))}
        </div>
        <Link
          href="/employee/notifications"
          onClick={() => setOpen(false)}
          className="font-label focus-ring flex min-h-11 items-center justify-center gap-1 border-t hairline px-4 text-[13px] font-semibold text-brand-blue hover:bg-foreground/[0.04]"
        >
          See all notifications <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </PopoverContent>
    </Popover>
  )
}
