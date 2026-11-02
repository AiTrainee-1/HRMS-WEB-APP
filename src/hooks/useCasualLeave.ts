import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { casualLeaveRequestsApi } from '@/api/requests-api'
import { useAuth } from '@/context/AuthContext'
import { monthKeyOf, type CLPortion } from '@/lib/casual-leave'
import { MY_PENDING_KEY } from '@/hooks/useMyPendingRequests'

// Casual Leave data for the Leave page card and the Casual Leave page. Query keys:
//   ['cl-eligibility', 'full', id] - under the ['cl-eligibility'] prefix the Dashboard and Attendance pages already use (a
//                                     different shape, so its own key; invalidating the prefix refreshes all of them);
//   ['casual-leaves', id]          - every request of the employee;
//   ['casual-leaves', 'history', id, year] - the year's balance history (2026-11-02).

export const CL_ELIGIBILITY_KEY = 'cl-eligibility'
export const CL_LIST_KEY = 'casual-leaves'

/** This month's (and, on the 1st to the 5th, last month's) Casual Leave answer. Asked again when the device's month moves on,
 *  so a page left open over midnight on the 1st never shows last month's answer. */
export function useCasualLeaveEligibility() {
  const { user } = useAuth()
  const q = useQuery({
    queryKey: [CL_ELIGIBILITY_KEY, 'full', user?.employeeId],
    queryFn: async () => ({ ...(await casualLeaveRequestsApi.eligibility()), fetchedMonth: monthKeyOf(new Date()) }),
    enabled: !!user,
  })
  const { refetch } = q
  const dataMonth = q.data?.fetchedMonth
  const nowMonth = monthKeyOf(new Date())
  React.useEffect(() => {
    if (dataMonth && dataMonth !== nowMonth) void refetch({ cancelRefetch: false })
  }, [dataMonth, nowMonth, refetch])
  return q
}

/** The year's Casual Leave balance history (2026-11-02). Under the ['casual-leaves'] prefix, so a new request refreshes
 *  it too. `data` is null on an older server (no history endpoint). */
export function useCasualLeaveHistory(year: number, enabled = true) {
  const { user } = useAuth()
  return useQuery({
    queryKey: [CL_LIST_KEY, 'history', user?.employeeId, year],
    queryFn: () => casualLeaveRequestsApi.history(year),
    enabled: !!user && enabled,
    staleTime: 60_000,
  })
}

export function useCasualLeaveRequests() {
  const { user } = useAuth()
  return useQuery({
    queryKey: [CL_LIST_KEY, user?.employeeId],
    queryFn: () => casualLeaveRequestsApi.list(user!.employeeId),
    enabled: !!user,
  })
}

export function useApplyCasualLeave() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { date: string; reason: string; portion: CLPortion }) =>
      casualLeaveRequestsApi.apply({ employeeId: user!.employeeId, ...body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CL_LIST_KEY] })
      // The per-month verdicts (and the yearly days) change with this request: the prefix also refreshes the Attendance
      // and Dashboard copies.
      qc.invalidateQueries({ queryKey: [CL_ELIGIBILITY_KEY] })
      // The new request is one of "my requests waiting" (Dashboard row + Department Head > My Requests).
      qc.invalidateQueries({ queryKey: MY_PENDING_KEY })
    },
  })
}
