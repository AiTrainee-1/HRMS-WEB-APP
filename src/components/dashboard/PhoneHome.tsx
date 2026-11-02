import { Link } from 'wouter'
import { BadgeCheck, CalendarDays, QrCode } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { greetingFor } from '@/components/kit'
import { PhoneTodayPanel } from '@/components/dashboard/PhoneTodayPanel'
import { dayCountText, type MonthSnapshot } from '@/lib/home-attention'
import type { DayRecordLike } from '@/lib/home-punches'
import type { DayMarkerHit } from '@/lib/attendance-flags'
import type { AssignedShift, AttendancePunch, Employee } from '@/types'
import { cn } from '@/lib/utils'

// PHONE ONLY (< 768px): the top of the mobile app's Home tab (uktextiles-employee-app app/(tabs)/home.tsx) - date line,
// greeting with the punched-in dot, the profile card (photo, code, designation, ID card QR button), the deep-navy month
// attendance card and the "Right now / Today's punches" panel (PhoneTodayPanel: live clock, shift progress, the day bar and
// the punches labelled by what they are; it took over the old shift pill and four-slot tracker, as in the app). Every
// element here is display:none at >= 768px (`hidden max-md:*`), so the desktop Dashboard is untouched. Fed by the
// Dashboard's own queries.

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function PhoneHomeTop({
  now,
  firstName,
  employee,
  fallbackName,
  shift,
  shiftLoading,
  snapshot,
  monthLoading,
  monthFailed,
  records,
  punches,
  markers,
  punchesLoading,
  punchesFailed,
  retrying,
  onRetry,
}: {
  now: Date
  firstName: string
  employee: Employee | undefined
  fallbackName: string
  shift: AssignedShift | null | undefined
  shiftLoading: boolean
  snapshot: MonthSnapshot
  monthLoading: boolean
  monthFailed: boolean
  /** This month's attendance records, for the Right now panel (yesterday's too, for a night worker after midnight). */
  records: readonly DayRecordLike[]
  punches: AttendancePunch[]
  markers: DayMarkerHit[]
  punchesLoading: boolean
  punchesFailed: boolean
  retrying: boolean
  onRetry: () => void
}) {
  const punchedIn = punches.length > 0
  const name = employee ? `${employee.firstName} ${employee.lastName}`.trim() : fallbackName
  const initials = (employee ? `${employee.firstName?.[0] ?? ''}${employee.lastName?.[0] ?? ''}` : fallbackName.slice(0, 2)).toUpperCase()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const tiles = [
    { key: 'work', label: 'Work Days', value: snapshot.workingDays, cls: 'max-md:text-white' },
    { key: 'present', label: 'Present', value: snapshot.presentDays, cls: 'max-md:text-[#5EEAD4]' },
    { key: 'absent', label: 'Absent', value: snapshot.absentDays, cls: 'max-md:text-[#FCA5A5]', alert: true },
    { key: 'leave', label: 'Leaves', value: snapshot.leaveDays, cls: 'max-md:text-white' },
  ]

  return (
    <div className="hidden max-md:flex max-md:flex-col">
      {/* Date · greeting + punched-in dot (the live time and the shift are in the Right now panel below) */}
      <p className="max-md:mb-1 max-md:text-[12px] max-md:text-muted-foreground">
        {WEEKDAY_SHORT[now.getDay()]}, {now.getDate()} {MONTH_SHORT[now.getMonth()]} {now.getFullYear()}
      </p>
      <div className="max-md:mb-4 max-md:flex max-md:items-center max-md:gap-2">
        <h1 className="max-md:min-w-0 max-md:truncate max-md:font-[family-name:var(--font-display)] max-md:text-[22px] max-md:leading-7 max-md:font-bold max-md:tracking-[-0.3px] max-md:text-foreground">
          {greetingFor(now)}, {firstName}
        </h1>
        <span
          className={cn('max-md:size-2 max-md:shrink-0 max-md:rounded-full', punchedIn ? 'max-md:bg-success' : 'max-md:bg-input')}
          role="img"
          aria-label={punchedIn ? 'Punched in today' : 'Not punched in yet today'}
        />
      </div>

      {/* Profile card: opens My Profile; the QR button opens the Digital ID card */}
      <div className="max-md:relative max-md:mb-3.5 max-md:flex max-md:items-center max-md:gap-3 max-md:overflow-hidden max-md:rounded-xl max-md:border max-md:border-border max-md:bg-card max-md:p-3.5 max-md:shadow-[var(--m-shadow-low)]">
        <span aria-hidden="true" className="max-md:pointer-events-none max-md:absolute max-md:-top-[30px] max-md:-right-[30px] max-md:size-[90px] max-md:rounded-full max-md:bg-muted" />
        <Link
          href="/employee/profile"
          aria-label={`${name}${employee?.employeeCode ? `, ${employee.employeeCode}` : ''}. Open profile`}
          className="focus-ring max-md:relative max-md:flex max-md:min-w-0 max-md:flex-1 max-md:items-center max-md:gap-3 max-md:rounded-lg max-md:active:opacity-85"
        >
          <Avatar className="max-md:size-11 max-md:border max-md:border-border">
            {employee?.photoUrl && <AvatarImage src={employee.photoUrl} alt="" className="max-md:object-cover" />}
            <AvatarFallback className="max-md:bg-info-bg max-md:text-[14px] max-md:font-bold max-md:text-info">{initials}</AvatarFallback>
          </Avatar>
          <span className="max-md:min-w-0 max-md:flex-1">
            <span className="max-md:flex max-md:items-center max-md:gap-[5px]">
              <span className="max-md:truncate max-md:font-[family-name:var(--font-display)] max-md:text-[15px] max-md:font-semibold max-md:text-foreground">{name}</span>
              {employee?.status?.toLowerCase() === 'active' && (
                <BadgeCheck className="max-md:size-3.5 max-md:shrink-0 max-md:text-success" aria-label="Active" />
              )}
            </span>
            <span className="max-md:mt-0.5 max-md:block max-md:truncate max-md:text-[12px] max-md:text-muted-foreground">
              {[employee?.employeeCode, employee?.designationTitle].filter(Boolean).join(' • ') || ' '}
            </span>
          </span>
        </Link>
        <Link
          href="/employee/id-card"
          aria-label="Digital ID Card"
          className="focus-ring max-md:relative max-md:grid max-md:size-10 max-md:shrink-0 max-md:place-items-center max-md:rounded-lg max-md:bg-muted max-md:text-primary max-md:active:opacity-80"
        >
          <QrCode className="max-md:size-5" aria-hidden="true" />
        </Link>
      </div>

      {/* The deep-navy month attendance card */}
      <section
        aria-labelledby="m-month-title"
        className="max-md:mb-3.5 max-md:overflow-hidden max-md:rounded-3xl max-md:bg-[linear-gradient(135deg,#0F172A,#1E3A8A,#2563EB)] max-md:p-[18px] max-md:text-white max-md:shadow-[0_10px_20px_rgb(15_23_42/0.15)] max-md:dark:bg-[linear-gradient(135deg,#0B1220,#111827,#1E3A5F)] max-md:dark:shadow-none"
      >
        <div className="max-md:mb-3.5 max-md:flex max-md:items-center max-md:justify-between max-md:gap-2">
          <h2 id="m-month-title" className="max-md:flex max-md:min-w-0 max-md:items-center max-md:gap-2 max-md:font-[family-name:var(--font-display)] max-md:text-[15px] max-md:font-semibold">
            <CalendarDays className="max-md:size-4 max-md:shrink-0" aria-hidden="true" />
            <span className="max-md:truncate">{MONTH[now.getMonth()]} Attendance</span>
          </h2>
          <span className="max-md:shrink-0 max-md:rounded-full max-md:bg-white/16 max-md:px-2.5 max-md:py-1 max-md:text-[11px] max-md:font-bold max-md:text-white/85 max-md:tabular-nums">
            Day {now.getDate()}/{daysInMonth}
          </span>
        </div>
        {monthFailed ? (
          <p className="max-md:text-[12px] max-md:text-white/80">This month's figures could not be loaded just now.</p>
        ) : (
          <dl className="max-md:grid max-md:grid-cols-4 max-md:gap-2">
            {tiles.map((t) => (
              <div
                key={t.key}
                className={cn(
                  'max-md:flex max-md:min-h-[62px] max-md:flex-col-reverse max-md:items-center max-md:justify-center max-md:gap-0.5 max-md:rounded-xl max-md:py-3',
                  t.alert ? 'max-md:bg-[rgb(225_29_72/0.28)]' : 'max-md:bg-white/8',
                  monthLoading && 'max-md:opacity-40',
                )}
              >
                <dt className="max-md:text-center max-md:text-[10px] max-md:font-semibold max-md:text-white/75">{t.label}</dt>
                <dd className={cn('max-md:font-[family-name:var(--font-display)] max-md:text-[20px] max-md:leading-6 max-md:font-bold max-md:tabular-nums', t.cls)}>
                  {monthLoading ? <span className="max-md:invisible">0</span> : dayCountText(t.value)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {/* Right now · Today's punches: the app's TodayPanel */}
      <PhoneTodayPanel
        records={records}
        shift={shift}
        shiftLoading={shiftLoading}
        markers={markers}
        loading={punchesLoading}
        failed={punchesFailed}
        retrying={retrying}
        onRetry={onRetry}
      />
    </div>
  )
}
