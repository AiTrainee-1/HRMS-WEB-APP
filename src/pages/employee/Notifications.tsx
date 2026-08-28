import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Bell, CalendarClock, Send, Timer, FileSignature, MessageCircle, CalendarCheck,
  Briefcase, Fingerprint, FileText, CheckCheck,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/employee/EmptyState'
import { Reveal } from '@/components/employee/Reveal'
import { notificationApi } from '@/api/resources'
import { cn } from '@/lib/utils'
import { format, formatDistanceToNow, isToday, parseISO } from 'date-fns'
import type { Notification } from '@/types'

// Every real `type` value the backend actually sends (grep-confirmed
// against every Notification.objects.create() call site) — anything not
// listed falls through to the generic Bell icon.
const ICONS: Record<string, typeof Bell> = {
  leave: Send,
  permission: Timer,
  casual_leave: CalendarClock,
  attendance: CalendarCheck,
  resignation: FileSignature,
  chat: MessageCircle,
  on_duty: Briefcase,
  missing_punch: Fingerprint,
  employee_request: FileText,
}

export default function Notifications() {
  const qc = useQueryClient()
  const [todayOnly, setTodayOnly] = React.useState(false)

  const { data, isLoading } = useQuery({ queryKey: ['notifications'], queryFn: notificationApi.list })

  const markReadMutation = useMutation({
    mutationFn: notificationApi.markRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markAllReadMutation = useMutation({
    mutationFn: notificationApi.markAllRead,
    onSuccess: () => {
      qc.setQueryData<Notification[]>(['notifications'], (old) => old?.map((n) => ({ ...n, isRead: true })))
    },
  })

  const list = (data ?? []).filter((n) => !todayOnly || isToday(parseISO(n.createdAt)))
  const unreadCount = (data ?? []).filter((n) => !n.isRead).length

  function renderItem(n: Notification) {
    const Icon = ICONS[n.type] ?? Bell
    return (
      <Card key={n.id} className={cn(!n.isRead && 'border-l-4 border-l-brand-blue bg-brand-blue-tint/40')}>
        <CardContent className="flex items-start gap-3 py-1">
          <div
            className={cn(
              'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full',
              !n.isRead ? 'bg-brand-gradient text-white shadow-clay-sm' : 'bg-muted text-muted-foreground',
            )}
          >
            <Icon className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm">{n.message}</p>
            <p className="text-muted-foreground text-xs mt-1">{formatDistanceToNow(parseISO(n.createdAt), { addSuffix: true })}</p>
          </div>
          {!n.isRead && (
            <Button variant="ghost" size="sm" onClick={() => markReadMutation.mutate(n.id)}>
              Mark read
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Alerts"
        subtitle="Status changes and updates on your requests"
        icon={<Bell />}
        actions={
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="bg-white/15 dark:bg-white/5 text-white hover:bg-white/25 dark:hover:bg-white/10 border border-white/25 dark:border-white/10"
              >
                <CheckCheck className="size-4" />
                Mark all read
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => setTodayOnly((v) => !v)}
              className={cn(
                todayOnly ? 'bg-white dark:bg-card/95 text-brand-blue hover:bg-white/90 dark:hover:bg-white/10' : 'bg-white/15 dark:bg-white/5 text-white hover:bg-white/25 dark:hover:bg-white/10 border border-white/25 dark:border-white/10',
              )}
            >
              {todayOnly ? `Today (${format(new Date(), 'MMM d')})` : 'All'}
            </Button>
          </div>
        }
      />

      {isLoading && <Skeleton className="h-64 w-full" />}

      {!isLoading && list.length === 0 && <EmptyState icon={Bell} title="No notifications" />}

      <div className="flex flex-col gap-2">
        {list.map((n, i) => (
          <Reveal key={n.id} index={i}>
            {renderItem(n)}
          </Reveal>
        ))}
      </div>
    </div>
  )
}
