import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { attendanceApi, geoAttendanceApi, onDutyApi } from '@/api/resources'
import { onDutyActionsApi, type FieldPunchBody, type OnDutyPunchNowResult, type OnDutyRequestResult, type OtPunchResult } from '@/api/onduty-actions'
import type { OnDutySession } from '@/types'
import { queuedOnDuty } from '@/offline/queued-requests'
import { MY_PENDING_KEY } from '@/hooks/useMyPendingRequests'
import { ON_DUTY_RECORDS_KEY } from '@/hooks/useOnDutyRecords'

export function useGeoPunchStatus() {
  return useQuery({
    queryKey: ['geo-punch-status'],
    queryFn: () => geoAttendanceApi.status(),
    refetchInterval: 30_000,
  })
}

/** Whether today's attendance might still be incomplete because biometric
 * hasn't synced yet — true only once a non-biometric punch (Geo/On-Duty/HR
 * Entry) already exists today AND no device has synced since midnight. */
export function useAttendanceSyncStatus() {
  return useQuery({
    queryKey: ['attendance-sync-status'],
    queryFn: () => attendanceApi.syncStatus(),
    refetchInterval: 60_000,
  })
}

/** Read-only "am I inside the geofence right now?" check — no punch is
 * written, safe to call repeatedly as the employee's location updates. */
export function useGeoPunchPrecheck() {
  return useMutation({
    mutationFn: geoAttendanceApi.precheck,
  })
}

/** Office Geo Punch: the actual punch. Inside the fence it writes
 * immediately; outside it, the backend hard-rejects — no approval flow. */
export function useGeoPunch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: geoAttendanceApi.punch,
    onSuccess: (result) => {
      if (result.status === 'accepted') {
        queryClient.invalidateQueries({ queryKey: ['geo-punch-status'] })
        queryClient.invalidateQueries({ queryKey: ['attendance'] })
      }
    },
  })
}

/** The On-Duty page's status (2026-11-24 shape: named slots with expected times, the gate pass, OT punches). Same key as
 *  before: an older server's reply simply lacks the new fields. */
export function useOnDutyStatus() {
  return useQuery({
    queryKey: ['on-duty-status'],
    queryFn: onDutyActionsApi.status,
    refetchInterval: 30_000,
  })
}

function useInvalidateOnDuty() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['on-duty-status'] })
    queryClient.invalidateQueries({ queryKey: ['geo-punch-status'] })
    // An On-Duty session is one of "my requests waiting" while it awaits approval (Dashboard row + Department Head >
    // My Requests): starting, punching under or completing it can change that list.
    queryClient.invalidateQueries({ queryKey: MY_PENDING_KEY })
    // Since 2026-11-24 an On-Duty carries its own gate pass (Outpass page), and View Records reads the same sessions.
    queryClient.invalidateQueries({ queryKey: ['outpass-requests'] })
    queryClient.invalidateQueries({ queryKey: ON_DUTY_RECORDS_KEY })
  }
}

/** Starts an On-Duty session (HOD -> HR approve it in the background). */
export function useStartOnDuty() {
  const invalidate = useInvalidateOnDuty()
  return useMutation({ mutationFn: onDutyApi.start, onSuccess: invalidate })
}

/** Captures one of the day's punches under the running session. */
export function useOnDutyPunch() {
  const invalidate = useInvalidateOnDuty()
  return useMutation({ mutationFn: onDutyApi.punch, onSuccess: invalidate })
}

/** The employee marks their own session Done. */
export function useCompleteOnDuty() {
  const invalidate = useInvalidateOnDuty()
  return useMutation({ mutationFn: onDutyApi.complete, onSuccess: invalidate })
}

// ---- The redesigned On-Duty page (owner 2026-11-24): request, the four named punches in any order, OT punches, end ----

/** Applies for On-Duty: the session (and its gate pass, pending until approved) starts at once. 409 when one is open. */
export function useRequestOnDuty() {
  const invalidate = useInvalidateOnDuty()
  // Works offline too (owner 2026-11-24): the queued marker (isQueued) when it was saved on this device.
  return useMutation({
    mutationFn: (destination: string) => queuedOnDuty.request<OnDutyRequestResult>(destination),
    onSettled: invalidate,
  })
}

/** One of the four punches (any order). autoEnd=false: the 4th keeps the session open and answers allPunchesIn. */
export function useRecordOnDutyPunch() {
  const invalidate = useInvalidateOnDuty()
  return useMutation({
    mutationFn: (body: FieldPunchBody & { punchNumber: number; name?: string }) => queuedOnDuty.punch<OnDutyPunchNowResult>(body),
    onSettled: invalidate,
  })
}

/** An overtime punch after the four (Continue Duty): never attendance. */
export function useRecordOtPunch() {
  const invalidate = useInvalidateOnDuty()
  return useMutation({
    mutationFn: (body: FieldPunchBody & { sequence?: number }) => queuedOnDuty.otPunch<OtPunchResult>(body),
    onSettled: invalidate,
  })
}

/** "Yes, end On-Duty" / Complete Duty. */
export function useEndOnDuty() {
  const invalidate = useInvalidateOnDuty()
  return useMutation({
    mutationFn: (sessionId: number | null) => queuedOnDuty.end<OnDutySession & { alreadyEnded?: boolean }>(sessionId),
    onSettled: invalidate,
  })
}
