import * as React from 'react'
import { useMyShiftSummary } from '@/hooks/useMyShiftSummary'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { MonthYearPicker } from '@/components/employee/MonthYearPicker'
import { EmptyState } from '@/components/employee/EmptyState'
import { DayMarkerChips } from '@/components/employee/DayMarkerChips'
import { LateDeductionCard } from '@/components/employee/LateDeductionCard'
import {
  countEarlyOuts, dayStatusLabel, earlyOutShown, getDayFlags, getDayMarkers, halfDayRule, lateInShown,
} from '@/lib/attendance-flags'
import { Clock } from 'lucide-react'
import { format, parseISO } from 'date-fns'

export default function MyShift() {
  const now = new Date()
  const [month, setMonth] = React.useState(now.getMonth() + 1)
  const [year, setYear] = React.useState(now.getFullYear())
  const { data, isLoading } = useMyShiftSummary(month, year)
  // Company rules from the shift stats; null on an older backend (then nothing is hidden and no time is shown).
  const policy = data?.policy ?? null
  const showLateIn = lateInShown(policy)
  // Early-Out days are only known to a backend that sends isEarlyOut; null hides the card on an older
  // one, and a company that has switched the check off never sees the wording at all.
  const earlyOutCount = data ? countEarlyOuts(data.dailyLogs) : null
  const showEarlyOut = earlyOutCount != null && earlyOutShown(policy)
  const statCards = 4 + (showLateIn ? 1 : 0) + (showEarlyOut ? 1 : 0)
  const halfRule = halfDayRule(policy)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="My Shift"
        subtitle="Assigned shift and this month's performance"
        icon={<Clock />}
        actions={<MonthYearPicker month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y) }} />}
      />

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : data?.assignedShift ? (
        <Card>
          <CardContent className="grid grid-cols-2 gap-4 py-1 sm:grid-cols-4">
            <div>
              <p className="text-muted-foreground text-xs">Shift</p>
              <p className="text-lg font-bold">{data.assignedShift.name}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Start Time</p>
              <p className="text-lg font-bold">{data.assignedShift.startTime}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">End Time</p>
              <p className="text-lg font-bold">{data.assignedShift.endTime}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Grace Period</p>
              <p className="text-lg font-bold">{data.assignedShift.gracePeriodMinutes} min</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-1 text-sm text-muted-foreground">No shift assignment found for this period.</CardContent>
        </Card>
      )}

      {!isLoading && data && (
        <div className={`grid grid-cols-2 gap-3 ${statCards >= 6 ? 'sm:grid-cols-6' : statCards === 5 ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}>
          {showLateIn && (
            <Card>
              <CardContent className="py-1">
                {/* Raw flagged days — the deduction pool below has its own Late-Ins figure, so the words differ */}
                <p className="text-muted-foreground text-xs">{earlyOutCount != null ? 'Days Flagged Late' : 'Late Count'}</p>
                <p className="text-xl font-bold">{data.lateCount}</p>
              </CardContent>
            </Card>
          )}
          {showEarlyOut && (
            <Card>
              <CardContent className="py-1">
                <p className="text-muted-foreground text-xs">Days Flagged Early</p>
                <p className="text-xl font-bold">{earlyOutCount}</p>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="py-1">
              <p className="text-muted-foreground text-xs">Half-Day Count</p>
              <p className="text-xl font-bold">{data.halfShiftCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-1">
              <p className="text-muted-foreground text-xs">CL Approvals</p>
              <p className="text-xl font-bold">{data.casualLeaveApprovals}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-1">
              <p className="text-muted-foreground text-xs">Total Working Shifts</p>
              <p className="text-xl font-bold">{data.totalWorkingShifts}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-1">
              <p className="text-muted-foreground text-xs">Absent Count</p>
              <p className="text-xl font-bold">{data.absentCount}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* The company's half-day windows, only when the backend states them */}
      {!isLoading && data && halfRule && (
        <p className="text-xs text-muted-foreground">
          Half-day rule: {halfRule.morning}. {halfRule.evening}. {halfRule.outcome}.
        </p>
      )}

      {/* Late-in / early-out / excess-permission pool and its deduction
          impact — same numbers HR sees on their Report Log. */}
      {!isLoading && data?.deductions && <LateDeductionCard deductions={data.deductions} />}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily Log</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4">
              <Skeleton className="h-48 w-full" />
            </div>
          ) : !data || data.dailyLogs.length === 0 ? (
            <div className="p-4">
              <EmptyState icon={Clock} title="No daily logs for this period" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium">Punch In</th>
                    <th className="px-4 py-2 font-medium">Punch Out</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {data.dailyLogs.map((log) => (
                    <tr key={log.date} className="border-b last:border-b-0">
                      <td className="px-4 py-2">{format(parseISO(log.date), 'MMM d, yyyy')}</td>
                      <td className="px-4 py-2">{log.firstPunch ?? '—'}</td>
                      <td className="px-4 py-2">{log.lastPunch ?? '—'}</td>
                      <td className="px-4 py-2">{dayStatusLabel(log.status)}</td>
                      <td className="px-4 py-2">
                        <DayMarkerChips markers={getDayMarkers(log, policy)} />
                        {/* The backend's plain-language deadline explanation, whenever it sends one */}
                        {getDayFlags(log).lateReason && (
                          <p className="mt-1 text-xs text-muted-foreground">{getDayFlags(log).lateReason}</p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
