import { useQuery } from '@tanstack/react-query'
import { authApi } from '@/api/resources'
import { accountStatusOf, statusPollMs, type AccountStatus } from '@/lib/inactive-account'

export const ACCOUNT_STATUS_KEY = ['account-status'] as const

/**
 * Whether the signed-in employee's HRMS account is active (owner 2026-11-25, mirror of the mobile app's
 * useAccountStatus), from GET /auth/me's additive `accountStatus` (null on an older server that does not say). The
 * password sign-in reply carries it too and is put straight into this query (context/AuthContext.tsx), so an inactive
 * account is covered the moment it signs in; otherwise it is asked as soon as someone is signed in (so at every page
 * load), then every minute, and every 10 seconds while the account is inactive (so an account HR makes active again is
 * let in at once). The query cache lives in this tab's memory only, so every answer is from this run of the app.
 */
export function useAccountStatus(employeeId: string | null): { status: AccountStatus | null; isPending: boolean } {
  const query = useQuery({
    queryKey: [...ACCOUNT_STATUS_KEY, employeeId],
    queryFn: async (): Promise<AccountStatus | null> => accountStatusOf(await authApi.me()),
    enabled: !!employeeId,
    staleTime: 10_000,
    refetchInterval: (q) => statusPollMs(q.state.data),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: 1,
  })
  return { status: query.data ?? null, isPending: query.isPending }
}
