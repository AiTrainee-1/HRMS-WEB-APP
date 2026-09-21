import { Bell } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'wouter'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { notificationApi } from '@/api/resources'
import { formatDistanceToNow } from 'date-fns'

export function NotificationBell() {
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationApi.list,
    refetchInterval: 60_000,
  })

  const unread = data?.filter((n) => !n.isRead) ?? []
  const preview = (data ?? []).slice(0, 5)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="!size-5" />
          {unread.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex size-[18px] items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-background">
              {unread.length > 9 ? '9+' : unread.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="font-display text-base font-semibold">Alert Center</span>
          {unread.length > 0 && <Badge variant="warning">{unread.length} unread</Badge>}
        </div>
        <Separator />
        <div className="max-h-80 overflow-y-auto">
          {preview.length === 0 && <p className="text-muted-foreground p-4 text-center text-sm">No notifications yet</p>}
          {preview.map((n) => (
            <div key={n.id} className={`flex gap-2.5 border-b hairline px-4 py-3 text-sm last:border-b-0 ${!n.isRead ? 'bg-primary/[0.07]' : ''}`}>
              <span className={`pip mt-1.5 ${!n.isRead ? 'text-brand-blue' : 'text-transparent'}`} />
              <div className="min-w-0">
                <p className="line-clamp-2">{n.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</p>
              </div>
            </div>
          ))}
        </div>
        <Separator />
        <Link href="/employee/notifications" className="font-label block px-4 py-2.5 text-center text-[13px] font-semibold text-brand-blue hover:underline">
          View all
        </Link>
      </PopoverContent>
    </Popover>
  )
}
