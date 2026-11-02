import { useQuery } from '@tanstack/react-query'
import { notificationApi } from '@/api/resources'

/**
 * How many notifications are unread. The same query (key, function, 60s polling) as the desktop NotificationBell, so the
 * phone bar, the drawer and the bell share one request and one cache entry.
 */
export function useUnreadNotifications(): number {
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationApi.list,
    refetchInterval: 60_000,
  })
  return data?.filter((n) => !n.isRead).length ?? 0
}
