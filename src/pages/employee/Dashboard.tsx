import { Link } from 'wouter'
import { useQuery } from '@tanstack/react-query'
import { CalendarCheck, CalendarX2, LayoutDashboard, MapPin, RefreshCw, Send, ShieldCheck, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { KpiTile, PageHero, PageShell, greetingFor } from '@/components/kit'
import { TodayPanel } from '@/components/dashboard/TodayPanel'
import { AttentionCard } from '@/components/dashboard/AttentionCard'
import { LastSalaryCard } from '@/components/dashboard/LastSalaryCard'
import { MonthCard } from '@/components/dashboard/MonthCard'
import { QuickActions, QuickActionsPhone } from '@/components/dashboard/QuickActions'
import { PhoneHomeTop } from '@/components/dashboard/PhoneHome'
import { NextHolidayCard } from '@/components/dashboard/NextHolidayCard'
import { useAuth } from '@/context/AuthContext'
import { employeeApi } from '@/api/resources'
import { useTodayAttendance } from '@/hooks/useTodayAttendance'
import { useMyShiftSummary } from '@/hooks/useMyShiftSummary'
import { useManagerStatus } from '@/hooks/useManagerStatus'
import { useCalendarNow } from '@/hooks/useHomeSources'
import { lateInShown } from '@/lib/attendance-flags'
import { dateKey, dayCountText, monthSnapshot } from '@/lib/home-attention'

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/**
 * The employee's day at a glance. Requests (most shared with other pages and the top bar, none polling on its own):
 * profile + this month's attendance + manager flags (already loaded by the layout), shift summary (shared with
 * Attendance / My Shift, 5 min fresh), and the attention / salary / holiday sources in hooks/useHomeSources.ts. A
 * section whose source fails is simply left out; only today's punches offer a retry, because they are the point.
 *
 * Phones (< 768px) get the mobile app's Home tab instead (app/(tabs)/home.tsx, kit/MOBILE.md): date + greeting, profile
 * card, navy month card, the Right now / Today's punches panel, attention strip, Quick Actions tiles, next holiday, last salary. The
 * phone pieces are phone-only blocks fed by the same queries; PageShell's gap is off on phones (each block carries the
 * app's own spacing), so a desktop-only block left empty on a phone adds no space.
 */
export default function Dashboard() {
  const { user } = useAuth()
  const now = useCalendarNow()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const profile = useQuery({
    queryKey: ['employee', user?.employeeId],
    queryFn: () => employeeApi.get(user!.employeeId),
    enabled: !!user,
    staleTime: 5 * 60_000,
  })
  const shiftQuery = useMyShiftSummary(month, year)
  const policy = shiftQuery.data?.policy ?? null
  const attendance = useTodayAttendance(policy)
  const { isManager, flags } = useManagerStatus()

  const employee = profile.data
  const isStaff = employee?.employmentType === 'staff'
  const records = attendance.data?.records ?? []
  const snapshot = monthSnapshot(records, dateKey(now))
  const loadingMonth = attendance.isPending
  const firstName = (user?.name ?? '').trim().split(/\s+/)[0] || 'there'
  const where = [employee?.departmentName, employee?.branchName].filter(Boolean).join(' · ')
  const showLate = lateInShown(policy)

  return (
    <PageShell width="wide" className="max-md:gap-0">
      <>
        <PageHero
          className="max-md:hidden"
          icon={<LayoutDashboard />}
          title={`${greetingFor(now)}, ${firstName}`}
          subtitle={`${WEEKDAY[now.getDay()]}, ${now.getDate()} ${MONTH[now.getMonth()]}${where ? ` · ${where}` : ''}`}
          actions={
            <>
              <Button asChild variant="outline" className="min-h-11 sm:min-h-9">
                <Link href="/employee/leave">
                  <Send /> Apply for leave
                </Link>
              </Button>
              <Button asChild className="min-h-11 sm:min-h-9">
                <Link href="/employee/attendance-request">
                  <MapPin /> Geo punch / On-Duty
                </Link>
              </Button>
            </>
          }
          kpis={
            <>
              <KpiTile
                label="Present this month"
                value={loadingMonth || attendance.isError ? null : snapshot.presentDays}
                format={dayCountText}
                unit="days"
                icon={ShieldCheck}
                tone="emerald"
                hint={snapshot.workingDays ? `of ${snapshot.workingDays} working days so far` : 'so far this month'}
                href="/employee/attendance"
              />
              <KpiTile
                label="Absent"
                value={loadingMonth || attendance.isError ? null : snapshot.absentDays}
                unit="days"
                icon={CalendarX2}
                tone="rose"
                hint={snapshot.absentDays ? 'Missed a punch? Ask for it to be added.' : 'None this month'}
                href={snapshot.absentDays ? '/employee/missing-punch' : '/employee/attendance'}
              />
              <KpiTile
                label="On leave"
                value={loadingMonth || attendance.isError ? null : snapshot.leaveDays}
                unit="days"
                icon={CalendarCheck}
                tone="sapphire"
                hint="approved leave this month"
                href="/employee/leave"
              />
              {showLate ? (
                <KpiTile
                  label="Days flagged late"
                  value={loadingMonth || attendance.isError ? null : (attendance.data?.summary.late ?? 0)}
                  unit="days"
                  icon={Timer}
                  tone="amber"
                  hint="see My Shift for what it costs"
                  href="/employee/shift"
                />
              ) : (
                <KpiTile
                  label="Half days"
                  value={loadingMonth || attendance.isError ? null : snapshot.halfDays}
                  unit="days"
                  icon={Timer}
                  tone="amber"
                  hint="a punch in only one half"
                  href="/employee/shift"
                />
              )}
            </>
          }
        >
          {attendance.isError ? (
            <div className="glass flex flex-wrap items-center gap-3 rounded-xl p-4 text-sm">
              <p className="flex-1 text-muted-foreground">Today's punches could not be loaded just now.</p>
              <Button variant="outline" size="sm" className="min-h-11 sm:min-h-8" onClick={() => attendance.refetch()} disabled={attendance.isFetching}>
                <RefreshCw className={attendance.isFetching ? 'animate-spin' : undefined} /> Try again
              </Button>
            </div>
          ) : (
            <TodayPanel
              punches={attendance.punches}
              shift={shiftQuery.data?.assignedShift}
              markers={attendance.markers}
              loading={attendance.isPending || shiftQuery.isPending}
            />
          )}
        </PageHero>
        <PhoneHomeTop
          now={now}
          firstName={firstName}
          employee={employee}
          fallbackName={user?.name ?? ''}
          shift={shiftQuery.data?.assignedShift}
          shiftLoading={shiftQuery.isPending}
          snapshot={snapshot}
          monthLoading={loadingMonth}
          monthFailed={attendance.isError}
          records={records}
          punches={attendance.punches}
          markers={attendance.markers}
          punchesLoading={attendance.isPending}
          punchesFailed={attendance.isError}
          retrying={attendance.isFetching}
          onRetry={() => attendance.refetch()}
        />
      </>

      <div className="grid gap-6 max-md:gap-0 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-6 max-md:gap-0">
          <AttentionCard isStaff={isStaff} now={now} />
          {!attendance.isError && (
            <MonthCard snapshot={snapshot} records={records} policy={policy} now={now} loading={loadingMonth} />
          )}
        </div>
        <QuickActionsPhone isStaff={isStaff} isProduction={employee?.employmentType === 'production'} />
        <div className="flex min-w-0 flex-col gap-6 max-md:gap-0">
          <LastSalaryCard />
          <NextHolidayCard now={now} />
        </div>
      </div>

      <QuickActions isStaff={isStaff} isManager={isManager} pendingApprovals={flags?.pendingApprovalsCount ?? 0} />
    </PageShell>
  )
}
