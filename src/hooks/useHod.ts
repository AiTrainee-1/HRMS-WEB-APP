import { useQuery } from '@tanstack/react-query'
import { hodApi } from '@/api/resources'
import { ApiError } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { parseHod } from '@/lib/hod'
import { retryTransient } from './retry'

/**
 * GET /employee/hod, validated (lib/hod.ts): the employee's assigned Department Head and the approvals that head can
 * give. Open to every employee type. An answer that is not the contract is an error, so the page offers a retry.
 */
export function useHod() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['hod', user?.employeeId],
    queryFn: async () => {
      const payload = parseHod(await hodApi.mine())
      if (!payload) throw new ApiError('The server sent an answer this page could not read.', 200)
      return payload
    },
    enabled: !!user,
    // Who the head is (and what they may approve) changes rarely: no need to re-ask on every visit.
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    retry: retryTransient,
  })
}
