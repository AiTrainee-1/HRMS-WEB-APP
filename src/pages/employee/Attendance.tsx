import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock, CalendarCheck, AlertTriangle, CalendarHeart } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/layout/PageHeader'
import { MonthYearPicker } from '@/components/employee/MonthYearPicker'
import { AttendanceCalendarGrid } from '@/components/employee/AttendanceCalendarGrid'
import { AttendanceTrendChart } from '@/components/employee/AttendanceTrendChart'
import { DayDetailPanel } from '@/components/employee/DayDetailPanel'
import { GeoPunchCard } from '@/components/employee/GeoPunchCard'
import { attendanceApi, casualLeaveApi } from '@/api/resources'
import { useAuth } from '@/context/AuthContext'
import { useMyShiftSummary } from '@/hooks/useMyShiftSummary'
import { useAttendanceSyncStatus } from '@/hooks/useGeoAttendance'
import type { AttendanceDay } from '@/types'

export default function Attendance() {
  const { user } = useAuth()
  const now = new Date()
  const [month, setMonth] = React.useState(now.getMonth() + 1)
  const [year, setYear] = React.useState(now.getFullYear())
  const [selectedDay, setSelectedDay] = React.useState<AttendanceDay | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['attendance', user?.employeeId, month, year],
    queryFn: () => attendanceApi.monthly(user!.employeeId, month, year),
    enabled: !!user,
  })

  const { data: shiftSummary } = useMyShiftSummary(month, year)
  const { data: syncStatus } = useAttendanceSyncStatus()
  const { data: eligibility } = useQuery({
    queryKey: ['cl-eligibility', user?.employeeId],
    queryFn: () => casualLeaveApi.eligibility(),
    enabled: !!user,
  })

  const summary = data?.summary

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Attendance"
        subtitle="Your monthly attendance record"
        icon={<CalendarCheck />}
        actions={<MonthYearPicker month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y) }} />}
      />

      <GeoPunchCard />

      {syncStatus?.pendingSync && (
        <Card className="border-warning/40 bg-warning/10">
          <CardContent className="flex items-center gap-2 py-3 text-sm text-warning-foreground">
            <AlertTriangle className="size-4 shrink-0" />
            Today's attendance may be incomplete — biometric punches haven't synced yet.
            It will update automatically once HR runs the next sync.
          </CardContent>
        </Card>
      )}

      {shiftSummary?.assignedShift && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 py-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Clock className="size-4 text-primary" />
              Assigned Shift
            </div>
            <span className="text-sm">{shiftSummary.assignedShift.name}</span>
            <span className="text-sm text-muted-foreground">
              {shiftSummary.assignedShift.startTime} – {shiftSummary.assignedShift.endTime}
            </span>
            <span className="text-sm text-muted-foreground">{shiftSummary.assignedShift.gracePeriodMinutes} min grace</span>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Card>
          <CardContent className="py-1">
            <p className="text-muted-foreground text-xs">Present</p>
            <p className="mt-1 text-xl font-bold text-success">{summary?.present ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-1">
            <p className="text-muted-foreground text-xs">Half Shift</p>
            <p className="mt-1 text-xl font-bold text-warning-foreground">{summary?.halfShift ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-1">
            <p className="text-muted-foreground text-xs">Absent</p>
            <p className="mt-1 text-xl font-bold text-destructive">{summary?.absent ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-1">
            <p className="text-muted-foreground text-xs">Late</p>
            <p className="mt-1 text-xl font-bold">{summary?.late ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-1">
            <p className="text-muted-foreground text-xs">On Leave</p>
            <p className="mt-1 text-xl font-bold text-primary">{summary?.onLeave ?? '—'}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-24 w-full" /> : <AttendanceTrendChart records={data?.records ?? []} />}
        </CardContent>
      </Card>

      {eligibility && (
        <Card>
          <CardContent className="flex flex-col gap-2 py-3">
            <div className="flex items-center gap-2">
              <CalendarHeart className="size-4 text-primary" />
              <span className="text-sm font-medium flex-1">Casual Leave</span>
              <Badge variant={eligibility.eligible ? 'success' : 'secondary'}>
                {eligibility.eligible ? 'Eligible' : 'Not Eligible'}
              </Badge>
            </div>
            {!eligibility.eligible && eligibility.reason && (
              <p className="text-xs text-muted-foreground">{eligibility.reason}</p>
            )}
            {eligibility.yearlyEntitlement != null && (
              <div className="flex gap-4 mt-1">
                <div className="flex-1 text-center">
                  <p className="text-lg font-bold">{eligibility.yearlyEntitlement}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Yearly Entitlement</p>
                </div>
                <div className="flex-1 text-center">
                  <p className="text-lg font-bold text-warning-foreground">{eligibility.usedThisYear}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Used</p>
                </div>
                <div className="flex-1 text-center">
                  <p className="text-lg font-bold text-success">{eligibility.remainingThisYear}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Remaining</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            <AttendanceCalendarGrid month={month} year={year} days={data?.records ?? []} onSelectDay={setSelectedDay} />
          )}
        </CardContent>
      </Card>

      <DayDetailPanel day={selectedDay} onClose={() => setSelectedDay(null)} />
    </div>
  )
}
