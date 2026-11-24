// Withdraw one of my own waiting requests (owner 2026-11-24): POST /my/requests/<module>/<id>/withdraw, module leave |
// permission | casual_leave (backend api/mobile_withdraw_views.py). Rules and words: lib/withdraw.ts.
import { apiRequest } from './client'
import type { WithdrawModule } from '@/lib/withdraw'

export interface WithdrawResult {
  withdrawn: boolean
  module?: string
  id?: number
  message?: string
}

export const withdrawApi = {
  withdraw: (module: WithdrawModule, id: number) =>
    apiRequest<WithdrawResult>({ method: 'POST', url: `/my/requests/${module}/${id}/withdraw`, data: {} }),
}
