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

/** On-Duty: submits a two-photo + reason request for the HOD→HR approval chain. */
export function useOnDutyRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: onDutyApi.request,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geo-punch-status'] })
    },
  })
}
