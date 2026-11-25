import { apiRequest } from './client'

// Salary Advance and Term Loan, employee self-service (2026-10-31; backend api/mobile_settlement_views.py):
//   GET  /my/advances/eligibility   windows (a Salary Advance only 20th-22nd, a Term Loan any day; 2026-11-25), salary,
//                                   60% limit, deduction months, what is already applied, the rules
//   GET  /my/advances               own applications: requested vs approved, schedule, deductions, timeline
//   GET  /my/advances/<id>          one of them
//   POST /my/advances               { advanceType, amount, repaymentMonths?, purpose }
// A refusal comes back as { error, code, field? }: apiRequest turns it into an ApiError whose message is the server's own
// sentence, which the form shows as it is. Replies are read by lib/advances.ts (hooks/useAdvances.ts).

export interface ApplyAdvanceBody {
  advanceType: 'general' | 'term'
  amount: number
  repaymentMonths?: number
  purpose: string
}

export const payAdvancesApi = {
  eligibility: () => apiRequest<unknown>({ method: 'GET', url: '/my/advances/eligibility' }),
  list: () => apiRequest<unknown>({ method: 'GET', url: '/my/advances' }),
  detail: (id: number) => apiRequest<unknown>({ method: 'GET', url: `/my/advances/${id}` }),
  apply: (body: ApplyAdvanceBody) => apiRequest<unknown>({ method: 'POST', url: '/my/advances', data: body }),
}
