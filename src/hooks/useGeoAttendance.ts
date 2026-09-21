import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { attendanceApi, geoAttendanceApi, onDutyApi } from '@/api/resources'

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

export function useOnDutyStatus() {
  return useQuery({
    queryKey: ['on-duty-status'],
    queryFn: onDutyApi.status,
    refetchInterval: 30_000,
  })
}

function useInvalidateOnDuty() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['on-duty-status'] })
    queryClient.invalidateQueries({ queryKey: ['geo-punch-status'] })
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
