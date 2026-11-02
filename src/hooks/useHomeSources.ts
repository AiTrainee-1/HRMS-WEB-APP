import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { casualLeaveApi, geoAttendanceApi, holidayApi, outpassApi } from '@/api/resources'
import { homeApi } from '@/api/home-dashboard'
import { useAuth } from '@/context/AuthContext'
import { retryTransient } from '@/hooks/retry'
import { MY_ADVANCES_KEY } from '@/hooks/useAdvances'
import { MY_PENDING_KEY } from '@/hooks/useMyPendingRequests'

// The Dashboard's queries. Each one SHARES its key (and function) with the page that owns the data, so opening the
// Dashboard after Outpass, Holidays or Geo Punch costs nothing, and none of them polls on its own: the gate-pass timer
// ticks locally, and everything else is fresh enough for a dashboard for a minute or more.

/** Requests still waiting for an answer (GET /my/pending-requests). */
export function usePendingRequestsLite() {
  const { user } = useAuth()
  return useQuery({
    // Under MY_PENDING_KEY: every request-creating mutation invalidates that prefix, which refreshes this row too.
    queryKey: [...MY_PENDING_KEY, user?.employeeId, 'lite'],
    queryFn: homeApi.pendingRequests,
    enabled: !!user,
    staleTime: 60_000,
    retry: retryTransient,
  })
}

/** Is the Salary Advance / Term Loan window open for me (GET /my/advances/eligibility)? */
export function useAdvanceEligibilityLite() {
  const { user } = useAuth()
  return useQuery({
    // Under MY_ADVANCES_KEY (its own 'eligibility-lite' leaf: the raw answer, not the Advances page's normalised one), so
    // applying for an advance (useApplyAdvance invalidates the prefix) refreshes the "applications are open" row at once.
    queryKey: [...MY_ADVANCES_KEY, 'eligibility-lite', user?.employeeId ?? null],
    queryFn: homeApi.advanceEligibility,
    enabled: !!user,
    staleTime: 5 * 60_000,
    retry: retryTransient,
  })
}

/** The newest year's pay periods (GET /my/salary-insights) for the "Last salary" card. */
export function useSalaryPeriodsLite() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my-salary-insights', user?.employeeId, 'lite'],
    queryFn: homeApi.salaryPeriods,
    enabled: !!user,
    staleTime: 10 * 60_000,
    retry: retryTransient,
  })
}

/** My gate passes: the same key as the Outpass page. */
export function useOutpassList() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['outpass-requests', user?.employeeId],
    queryFn: outpassApi.list,
    enabled: !!user,
    staleTime: 30_000,
    retry: retryTransient,
  })
}

/** Today's geo punches + the On-Duty session: the same key as the Geo Punch page (which polls it; this does not). */
export function useGeoStatusOnce() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['geo-punch-status'],
    queryFn: () => geoAttendanceApi.status(),
    enabled: !!user,
    retry: retryTransient,
  })
}

/** Casual Leave months for me: only asked when `enabled` (staff, last week of the month). Same key as Attendance. */
export function useClEligibility(enabled: boolean) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['cl-eligibility', user?.employeeId],
    queryFn: () => casualLeaveApi.eligibility(),
    enabled: !!user && enabled,
    staleTime: 5 * 60_000,
  })
}

/** A year's holidays: the same key as the Holidays page. */
export function useHolidays(year: number) {
  return useQuery({
    queryKey: ['holidays', year],
    queryFn: () => holidayApi.list(year),
    staleTime: 30 * 60_000,
    retry: retryTransient,
  })
}

/** True while this browser tab is visible (timers sleep in a background tab). */
export function usePageVisible(): boolean {
  return React.useSyncExternalStore(
    (onChange) => {
      document.addEventListener('visibilitychange', onChange)
      return () => document.removeEventListener('visibilitychange', onChange)
    },
    () => document.visibilityState !== 'hidden',
    () => true,
  )
}

/**
 * "Now", refreshed on each minute boundary (for a clock that shows hh:mm), sleeping while the tab is hidden and
 * correcting itself the moment it is shown again. Only the component that calls it re-renders.
 */
export function useMinuteNow(): Date {
  const visible = usePageVisible()
  const [now, setNow] = React.useState(() => new Date())
  React.useEffect(() => {
    if (!visible) return
    setNow(new Date())
    let interval: ReturnType<typeof setInterval> | undefined
    const first = setTimeout(
      () => {
        setNow(new Date())
        interval = setInterval(() => setNow(new Date()), 60_000)
      },
      60_000 - (Date.now() % 60_000) + 50,
    )
    return () => {
      clearTimeout(first)
      if (interval) clearInterval(interval)
    }
  }, [visible])
  return now
}

/**
 * "Now" for the greeting, the date line and the month figures: a Date that changes only when the day or the part of the
 * day (morning / afternoon / evening) changes, checked once a minute. The page re-renders a few times a day, not every
 * minute (the clock has its own useMinuteNow).
 */
export function useCalendarNow(): Date {
  const visible = usePageVisible()
  const [bucket, setBucket] = React.useState(() => calendarBucket(new Date()))
  React.useEffect(() => {
    if (!visible) return
    // The same string again = React skips the render; only a new bucket re-renders the page.
    setBucket(calendarBucket(new Date()))
    const id = setInterval(() => setBucket(calendarBucket(new Date())), 60_000)
    return () => clearInterval(id)
  }, [visible])
  const [state, setState] = React.useState(() => ({ bucket, date: new Date() }))
  if (state.bucket !== bucket) {
    // Adjusting state while rendering (React's documented pattern): one new Date per bucket.
    const date = new Date()
    setState({ bucket, date })
    return date
  }
  return state.date
}

function calendarBucket(d: Date): string {
  const h = d.getHours()
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}|${h < 12 ? 0 : h < 17 ? 1 : 2}`
}

/** "Now" every second while `active` and the tab is visible (a live countdown). */
export function useSecondNow(active: boolean): number {
  const visible = usePageVisible()
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    if (!active || !visible) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [active, visible])
  return now
}
