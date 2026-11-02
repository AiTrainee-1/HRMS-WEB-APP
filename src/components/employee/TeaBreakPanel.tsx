import * as React from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { QRCodeSVG } from 'qrcode.react'
import { Coffee, CoffeeIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState, SkeletonList } from '@/components/kit'
import { MonthYearPicker, PhoneMonthBar } from '@/components/employee/MonthYearPicker'
import { monthPickerProps } from '@/components/requests/month-picker'
import { teaBreakApi } from '@/api/resources'
import { useAuth } from '@/context/AuthContext'
import { isCurrentMonth, monthKey, monthLabel, type CalMonth } from '@/lib/month-switch'
import { TEA_BREAK_RECENT_LIMIT, teaBreaksForMonth } from '@/lib/my-requests'
import type { TeaBreakLogItem, TeaBreakRemark } from '@/types'

/**
 * Tea Break -a permanent per-employee QR (unlike the Outpass card's QR,
 * which is per-request and only shows up once approved/exited/etc). This
 * one never disappears: it always identifies the same employee, and the
 * server itself decides whether a scan means "going out" or "coming back"
 * based on whether an open break already exists -see
 * backend/api/tea_break_views.py::resolve_tea_break_scan. No approval, no
 * expiry to watch for here, unlike OutpassFlipCard.
 *
 * Phones (< 768px): the mobile app's TeaBreakPanel - a flat card with a 1.5px outline, the 10px caption, the status
 * line left-aligned, and the recent breaks as white rows.
 */

const REMARK_LABEL: Record<TeaBreakRemark, string> = {
  overtime: 'Overtime', on_time: 'On Time', in_progress: 'Still Out', not_returned: 'Not Returned',
}
const REMARK_CLS: Record<TeaBreakRemark, string> = {
  overtime: 'bg-rejected-bg text-rejected',
  not_returned: 'bg-rejected-bg text-rejected',
  in_progress: 'bg-waiting-bg text-waiting',
  on_time: 'bg-approved-bg text-approved',
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
    <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2.5 max-md:bg-card max-md:p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium max-md:text-[13px] max-md:font-semibold">
          {format(new Date(log.outAt), 'dd MMM, h:mm a')}
          {log.inAt ? ` – ${format(new Date(log.inAt), 'h:mm a')}` : ''}
        </p>
        <p className="text-xs text-muted-foreground max-md:mt-0.5 max-md:text-[11px]">{log.takenMinutes} min</p>
      </div>
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold max-md:text-[10px] max-md:font-[800] ${REMARK_CLS[log.remark]}`}>
        {REMARK_LABEL[log.remark]}
      </span>
    </div>
  )
}

/**
 * `month` (the Outpass & Tea Break page's month switcher, owner 2026-11-02): the list under the QR is that month's tea
 * breaks (by the India day of going out), with the month control above it - "‹ November 2026 ›" on desktop, the phone
 * month bar on phones. The QR and the "on a break now" line are about right now and do not follow the month. Without
 * `month` the list is the latest breaks, as before.
 */
export function TeaBreakPanel({ month, onMonthChange }: { month?: CalMonth; onMonthChange?: (month: CalMonth) => void }) {
  const { user } = useAuth()

  const qrQuery = useQuery({
    queryKey: ['tea-break-qr-token', user?.employeeId],
    queryFn: () => teaBreakApi.qrToken(),
    enabled: !!user,
    staleTime: Infinity,
  })

  const key = month ? monthKey(month) : undefined
  const statusQuery = useQuery({
    queryKey: ['tea-break-status', user?.employeeId, key ?? 'recent'],
    queryFn: () => teaBreakApi.myStatus(key),
    enabled: !!user,
    refetchInterval: 15000,
    // Switching months keeps the "on a break now" line on screen while the new month loads.
    placeholderData: keepPreviousData,
  })

  const status = statusQuery.data
  const elapsedMinutes = useElapsedMinutes(status?.onBreak ? status.outAt : null)
  const overAllowed = elapsedMinutes != null && status ? elapsedMinutes > status.allowedMinutes : false
  const listed = month ? teaBreaksForMonth(status, month) : null

  return (
    <div className="flex flex-col gap-4 max-md:gap-[18px]">
      <Card className="max-md:border-[1.5px]! max-md:border-input! max-md:py-4 max-md:shadow-none!">
        <CardContent className="flex flex-col items-center gap-4 py-6 max-md:gap-3.5 max-md:px-4 max-md:py-0">
          {qrQuery.isLoading || !qrQuery.data ? (
            <Skeleton className="size-[176px] rounded-lg" />
          ) : (
            <div className="rounded-lg border bg-white p-3">
              <QRCodeSVG value={qrQuery.data.qrToken} size={150} fgColor="#0f172a" bgColor="#ffffff" />
            </div>
          )}
          <p className="text-center text-[11px] font-bold tracking-wider text-muted-foreground max-md:text-[10px] max-md:font-[800]">
            SHOW THIS QR AT THE GATE — FOR TEA BREAK OUT &amp; IN
          </p>

          <div
            className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold max-md:justify-start max-md:px-3.5 max-md:text-[13px] ${
              status?.onBreak ? (overAllowed ? 'bg-rejected-bg text-rejected' : 'bg-waiting-bg text-waiting') : 'bg-muted text-muted-foreground'
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

      {month && listed ? (
        <section aria-labelledby="tea-month-title" className="flex flex-col gap-2">
          {/* Phones: the month bar, then the heading (the mobile app's order); desktop: the heading with the month control. */}
          {onMonthChange && <PhoneMonthBar {...monthPickerProps(month, onMonthChange)} label="Tea breaks" />}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="tea-month-title" className="text-xs font-bold uppercase tracking-wide text-muted-foreground max-md:text-[11px]">
              Tea breaks in {monthLabel(month)}
            </h2>
            {onMonthChange && <MonthYearPicker {...monthPickerProps(month, onMonthChange)} label="Tea breaks" className="max-md:hidden" />}
          </div>
          {statusQuery.isPending || statusQuery.isPlaceholderData ? (
            <SkeletonList variant="rows" count={2} label="Loading your tea breaks" />
          ) : statusQuery.isError && !status ? (
            <ErrorState compact error={statusQuery.error} what="your tea breaks" onRetry={() => void statusQuery.refetch()} retrying={statusQuery.isFetching} />
          ) : listed.rows.length === 0 ? (
            <EmptyState
              compact
              icon={Coffee}
              title={`No tea breaks in ${monthLabel(month)}`}
              description={
                listed.partial
                  ? `Only your ${TEA_BREAK_RECENT_LIMIT} most recent tea breaks can be shown here, so older ones may be missing.`
                  : isCurrentMonth(month)
                    ? 'When you scan out for tea this month, it shows here.'
                    : 'Use the arrows above to look at another month.'
              }
            />
          ) : (
            <>
              {listed.rows.map((log) => <RecentRow key={log.id} log={log} />)}
              {listed.partial && (
                <p className="text-xs text-muted-foreground max-md:text-[11px]">
                  Only your {TEA_BREAK_RECENT_LIMIT} most recent tea breaks can be shown here, so older ones of {monthLabel(month)} may be missing.
                </p>
              )}
            </>
          )}
        </section>
      ) : (
        !!status?.recent.length && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground max-md:text-[11px]">Recent Tea Breaks</p>
            {status.recent.map((log) => <RecentRow key={log.id} log={log} />)}
          </div>
        )
      )}
    </div>
  )
}
