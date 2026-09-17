import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { QRCodeSVG } from 'qrcode.react'
import { Coffee, CoffeeIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { teaBreakApi } from '@/api/resources'
import { useAuth } from '@/context/AuthContext'
import type { TeaBreakLogItem, TeaBreakRemark } from '@/types'

/**
 * Tea Break -a permanent per-employee QR (unlike the Outpass card's QR,
 * which is per-request and only shows up once approved/exited/etc). This
 * one never disappears: it always identifies the same employee, and the
 * server itself decides whether a scan means "going out" or "coming back"
 * based on whether an open break already exists -see
 * backend/api/tea_break_views.py::resolve_tea_break_scan. No approval, no
 * expiry to watch for here, unlike OutpassFlipCard.
 */

const REMARK_LABEL: Record<TeaBreakRemark, string> = {
  overtime: 'Overtime', on_time: 'On Time', in_progress: 'Still Out', not_returned: 'Not Returned',
}
const REMARK_CLS: Record<TeaBreakRemark, string> = {
  overtime: 'bg-destructive/10 text-destructive',
  not_returned: 'bg-destructive/10 text-destructive',
  in_progress: 'bg-amber-500/10 text-amber-600',
  on_time: 'bg-success/10 text-success',
}

function useElapsedMinutes(outAt: string | null) {
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    if (!outAt) return
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [outAt])
  if (!outAt) return null
  return Math.max(0, Math.round((now - new Date(outAt).getTime()) / 60000))
}

function RecentRow({ log }: { log: TeaBreakLogItem }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {format(new Date(log.outAt), 'dd MMM, h:mm a')}
          {log.inAt ? ` – ${format(new Date(log.inAt), 'h:mm a')}` : ''}
        </p>
        <p className="text-xs text-muted-foreground">{log.takenMinutes} min</p>
      </div>
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${REMARK_CLS[log.remark]}`}>
        {REMARK_LABEL[log.remark]}
      </span>
    </div>
  )
}

export function TeaBreakPanel() {
  const { user } = useAuth()

  const qrQuery = useQuery({
    queryKey: ['tea-break-qr-token', user?.employeeId],
    queryFn: () => teaBreakApi.qrToken(),
    enabled: !!user,
    staleTime: Infinity,
  })

  const statusQuery = useQuery({
    queryKey: ['tea-break-status', user?.employeeId],
    queryFn: () => teaBreakApi.myStatus(),
    enabled: !!user,
    refetchInterval: 15000,
  })

  const status = statusQuery.data
  const elapsedMinutes = useElapsedMinutes(status?.onBreak ? status.outAt : null)
  const overAllowed = elapsedMinutes != null && status ? elapsedMinutes > status.allowedMinutes : false

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-6">
          {qrQuery.isLoading || !qrQuery.data ? (
            <Skeleton className="size-[176px] rounded-lg" />
          ) : (
            <div className="rounded-lg border bg-white p-3">
              <QRCodeSVG value={qrQuery.data.qrToken} size={150} fgColor="#0f172a" bgColor="#ffffff" />
            </div>
          )}
          <p className="text-center text-[11px] font-bold tracking-wider text-muted-foreground">
            SHOW THIS QR AT THE GATE — FOR TEA BREAK OUT &amp; IN
          </p>

          <div
            className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold ${
              status?.onBreak ? (overAllowed ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-600') : 'bg-muted text-muted-foreground'
            }`}
          >
            {status?.onBreak ? <Coffee className="size-4" /> : <CoffeeIcon className="size-4 opacity-50" />}
            {statusQuery.isLoading
              ? 'Checking status…'
              : status?.onBreak
              ? `On tea break — ${elapsedMinutes ?? 0} min${overAllowed ? ' (over allowed time)' : ''}`
              : 'Not currently on a tea break'}
          </div>
        </CardContent>
      </Card>

      {!!status?.recent.length && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Recent Tea Breaks</p>
          {status.recent.map((log) => <RecentRow key={log.id} log={log} />)}
        </div>
      )}
    </div>
  )
}
