import { apiRequest } from './client'
import { normalizeMyInsights, type MyInsights } from '@/lib/my-insights'

// The Dashboard's "My Insights" (owner 2026-11-25): the employee's own figures month by month, GET /my/analytics?months=N
// (backend api/mobile_analytics.py, read-only). A background source like the Dashboard's others (api/home-dashboard.ts):
// a failure never raises the app-wide "can't reach the server" banner (skipOfflineDetection). A reply that is not the
// contract (an older server's 404 page, a proxy page) throws, so the section shows its error with Try again.
export const myAnalyticsApi = {
  insights: async (months = 6): Promise<MyInsights> => {
    const data = normalizeMyInsights(
      await apiRequest<unknown>({ method: 'GET', url: '/my/analytics', params: { months }, skipOfflineDetection: true }),
    )
    if (!data) throw new Error('Unexpected reply from /my/analytics')
    return data
  },
}
