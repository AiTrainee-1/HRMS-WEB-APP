import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { payAdvancesApi, type ApplyAdvanceBody } from '@/api/pay-advances'
import { ApiError } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import {
  normalizeAdvance,
  normalizeAdvances,
  normalizeEligibility,
  type AdvanceEligibility,
  type MyAdvance,
} from '@/lib/advances'
import { retryTransient } from './retry'
import { MY_PENDING_KEY } from './useMyPendingRequests'

const UNREADABLE = 'The server sent an answer this page could not read.'

export const MY_ADVANCES_KEY = ['pay', 'my-advances'] as const

/** GET /my/advances: own applications, newest first (the server's order). */
export function useMyAdvances() {
  const { user } = useAuth()
  return useQuery({
    queryKey: [...MY_ADVANCES_KEY, 'list', user?.employeeId ?? null],
    queryFn: async (): Promise<MyAdvance[]> => {
      const rows = normalizeAdvances(await payAdvancesApi.list())
      if (!rows) throw new ApiError(UNREADABLE, 200)
      return rows
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: retryTransient,
  })
}

/** GET /my/advances/eligibility: the window, the limit, what can be applied for now and why not. */
export function useAdvanceEligibility() {
  const { user } = useAuth()
  return useQuery({
    queryKey: [...MY_ADVANCES_KEY, 'eligibility', user?.employeeId ?? null],
    queryFn: async (): Promise<AdvanceEligibility> => {
      const data = normalizeEligibility(await payAdvancesApi.eligibility())
      if (!data) throw new ApiError(UNREADABLE, 200)
      return data
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: retryTransient,
  })
}

/** GET /my/advances/<id>. Opened from the list: shows that row at once, then refreshes it. */
export function useMyAdvance(id: number | null) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: [...MY_ADVANCES_KEY, 'one', id],
    queryFn: async (): Promise<MyAdvance> => {
      const row = normalizeAdvance(await payAdvancesApi.detail(id!))
      if (!row) throw new ApiError(UNREADABLE, 200)
      return row
    },
    enabled: !!user && id != null,
    initialData: () =>
      queryClient.getQueryData<MyAdvance[]>([...MY_ADVANCES_KEY, 'list', user?.employeeId ?? null])?.find((a) => a.id === id),
    initialDataUpdatedAt: 0,
    retry: retryTransient,
  })
}

/** POST /my/advances. A refusal throws an ApiError carrying the server's own sentence. */
export function useApplyAdvance() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: ApplyAdvanceBody): Promise<MyAdvance | null> => normalizeAdvance(await payAdvancesApi.apply(body)),
    onSettled: () => {
      // Every advance query sits under this prefix, the Dashboard's "applications are open" check included
      // (useAdvanceEligibilityLite), so one call refreshes the list, the eligibility and the Dashboard row.
      void queryClient.invalidateQueries({ queryKey: MY_ADVANCES_KEY })
      // The new application is now one of "my requests waiting" (Dashboard row + Department Head > My Requests).
      void queryClient.invalidateQueries({ queryKey: MY_PENDING_KEY })
    },
  })
}
