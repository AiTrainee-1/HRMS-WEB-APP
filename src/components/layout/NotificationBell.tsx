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
        <Button variant="ghost" size="icon" className="relative">
          <Bell />
          {unread.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
              {unread.length > 9 ? '9+' : unread.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold">Notifications</span>
          {unread.length > 0 && <Badge variant="secondary">{unread.length} unread</Badge>}
        </div>
        <Separator />
        <div className="max-h-80 overflow-y-auto">
          {preview.length === 0 && <p className="text-muted-foreground p-4 text-center text-sm">No notifications yet</p>}
          {preview.map((n) => (
            <div key={n.id} className={`px-4 py-2.5 text-sm border-b last:border-b-0 ${!n.isRead ? 'bg-accent/50' : ''}`}>
              <p className="line-clamp-2">{n.message}</p>
              <p className="text-muted-foreground text-xs mt-1">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</p>
            </div>
          ))}
        </div>
        <Separator />
        <Link href="/employee/notifications" className="block px-4 py-2.5 text-center text-sm text-primary hover:underline">
          View all
        </Link>
      </PopoverContent>
    </Popover>
  )
}
