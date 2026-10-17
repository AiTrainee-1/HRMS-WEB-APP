import { useQuery } from '@tanstack/react-query'
import { compensationApi } from '@/api/resources'
import { ApiError } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { parseCompensation } from '@/lib/compensation'
import { retryTransient } from './retry'

export const COMPENSATION_QUERY_KEY = 'compensation'

/**
 * GET /employee/compensation, validated (lib/compensation.ts). `data` is the parsed payload; an answer that is not the
 * contract (an HTML page from a proxy) is an error here, so the page offers a retry instead of rendering garbage.
 * A production employee gets a normal answer with `isStaff: false`, which the page turns into a friendly message.
 */
export function useCompensation() {
  const { user } = useAuth()
  return useQuery({
    queryKey: [COMPENSATION_QUERY_KEY, user?.employeeId],
    queryFn: async () => {
      const payload = parseCompensation(await compensationApi.mine())
      if (!payload) throw new ApiError('The server sent an answer this page could not read.', 200)
      return payload
    },
    enabled: !!user,
    staleTime: 60_000,
    // Detected items change as punches arrive and HR assigns things: catch up when the person comes back to the tab.
    refetchOnWindowFocus: true,
    retry: retryTransient,
  })
}
