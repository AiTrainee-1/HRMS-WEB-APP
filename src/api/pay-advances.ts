import { apiRequest } from './client'

// Loan & Advance - Salary Advance and Term Loan, employee self-service (2026-10-31; backend api/mobile_settlement_views.py):
//   GET  /my/advances/eligibility   windows (a Salary Advance on Settings' days, the 21st-22nd by default, a Term Loan any
//                                   day), salary, the Salary Advance limit (`salaryAdvance.earned`), every Term Loan rule
//                                   (`termLoan.code` / `limit` / `service`), the Settings rules (`salaryAdvance.rules`,
//                                   `termLoan.rules`, 2026-11-27), the method and whether this employee can apply at all
//                                   (`method`, `applyAvailable`, 2026-11-28), deduction months, the rules in words
//   GET  /my/advances               own applications: requested vs approved (`approvedLess` / `approvedMore`), where a
//                                   waiting one stands (`reviewLabel`, `canWithdraw`), the remark, schedule, timeline
//   GET  /my/advances/<id>          one of them
//   POST /my/advances               { advanceType, amount, repaymentMonths?, purpose }
// A refusal comes back as { error, code, field? }: apiRequest turns it into an ApiError carrying that body (`data`); the
// form reads it with lib/advances.ts applyRefusal (the sentence next to the field it names). Replies are read by
// lib/advances.ts (hooks/useAdvances.ts).

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
