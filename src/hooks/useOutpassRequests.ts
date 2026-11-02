import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { outpassRequestsApi } from '@/api/requests-api'
import { useAuth } from '@/context/AuthContext'

/** Every outpass of the employee. Same key as before ('outpass-requests'), which the flip card's "Generate return QR"
 *  invalidates. Polled every 30 s while the page is open, so the guard's gate scan shows up without a reload. */
export function useOutpassRequests() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['outpass-requests', user?.employeeId],
    queryFn: outpassRequestsApi.list,
    enabled: !!user,
    refetchInterval: 30_000,
  })
}

/** Date.now(), refreshed every `intervalMs` (for clocks and "is this pass still open"). */
export function useNowTick(intervalMs: number): number {
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(t)
  }, [intervalMs])
  return now
}
