import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock, CalendarCheck, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { MonthYearPicker } from '@/components/employee/MonthYearPicker'
import { AttendanceCalendarGrid } from '@/components/employee/AttendanceCalendarGrid'
import { DayDetailPanel } from '@/components/employee/DayDetailPanel'
import { GeoPunchCard } from '@/components/employee/GeoPunchCard'
import { attendanceApi } from '@/api/resources'
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

  const summary = data?.summary
  // The monthly summary rarely carries a reliable half-shift count — fall
  // back to counting 'half_shift' records directly when it's missing.
  const halfShiftCount = summary?.halfShift ?? data?.records.filter((r) => r.status === 'half_shift').length ?? 0

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
            <p className="mt-1 text-xl font-bold text-warning-foreground">{halfShiftCount}</p>
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
