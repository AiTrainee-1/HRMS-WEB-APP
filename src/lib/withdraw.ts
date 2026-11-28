// Withdraw one of my own requests while it still waits for an answer (owner 2026-11-24): Leave, Permission and Casual
// Leave; since 2026-11-26 also a Salary Advance / Term Loan application (module "advance", shown as "Delete request" on
// the application's details while it is still with HR: `canWithdraw` of the application, lib/advances.ts).
// POST /my/requests/<module>/<id>/withdraw (backend api/mobile_withdraw_views.py) removes the request; the server
// refuses (409 code "not_pending") once it was fully decided, an advance HR forwarded for approval (409 "in_workflow")
// or raised itself (409 "recorded_by_hr"), and 404 for a request that is not the caller's.
// On-Duty, missing punch and outpass are deliberately NOT withdrawable; Compensation claims have their own withdraw.
// Pure, no imports: unit-tested in withdraw.test.ts. The mobile app has the same rules (src/hooks/useWithdraw.ts).

export type WithdrawModule = 'leave' | 'permission' | 'casual_leave' | 'advance'

/** What the request is called in the question and the confirmation ("Your leave request was withdrawn."). */
export const WITHDRAW_WHAT: Record<WithdrawModule, string> = {
  leave: 'leave request',
  permission: 'permission request',
  casual_leave: 'Casual Leave request',
  advance: 'advance application',
}

/** A request in this state may be withdrawn: still waiting at any step (the server says "pending" until the final decision). */
export function canWithdraw(status: unknown): boolean {
  return typeof status === 'string' && status.trim().toLowerCase() === 'pending'
}

/** A positive whole-number id from a row (rows carry ids as numbers or numeric strings); null when there is none. */
export function withdrawId(id: unknown): number | null {
  const n = typeof id === 'number' ? id : typeof id === 'string' && /^\d{1,12}$/.test(id.trim()) ? Number(id.trim()) : NaN
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

/**
 * Whether a card shows "Withdraw": the request is waiting, has a usable id, and (Casual Leave) was not written by HR
 * through an attendance edit (source "hr_edit": the employee did not raise it, so it is not theirs to take back).
 */
export function showWithdraw(row: { id: unknown; status: unknown; source?: unknown }): boolean {
  return canWithdraw(row.status) && withdrawId(row.id) !== null && row.source !== 'hr_edit'
}

/** The question's sentence under "Withdraw this request?" ("Delete this request?" for an advance application). */
export function withdrawQuestion(module: WithdrawModule, label?: string | null): string {
  const what = label?.trim() || WITHDRAW_WHAT[module]
  if (module === 'advance') return `Your ${what} will be deleted and HR will not be asked to decide it. You can apply again later.`
  return `Your ${what} will be taken back and nobody will be asked to decide it. You can apply again later.`
}

/** The words after a withdraw that worked: the server's own sentence, else a plain one. */
export function withdrawDoneText(module: WithdrawModule, result: unknown): string {
  const message = typeof result === 'object' && result !== null ? (result as { message?: unknown }).message : null
  if (typeof message === 'string' && message.trim()) return message.trim()
  return `Your ${WITHDRAW_WHAT[module]} was withdrawn.`
}

/**
 * A refusal that will not change on a retry: 409 (decided meanwhile `not_pending`, raised by HR `recorded_by_hr`, or - an
 * advance application - forwarded for approval `in_workflow`, 2026-11-26) or 404 (gone). The screen then shows the
 * server's sentence where the button was and asks the lists again, so the button disappears.
 */
export function isFinalWithdrawRefusal(err: { status?: number } | null | undefined): boolean {
  return err?.status === 409 || err?.status === 404
}

/**
 * The words for a refused withdraw: the server's own sentence when it sent one (409 "already approved ...", 404, 403),
 * a connection hint when nothing answered, else a plain retry line.
 */
export function withdrawErrorText(err: { status?: number; message?: string; data?: unknown } | null | undefined): string {
  const data = err?.data
  const serverText = typeof data === 'object' && data !== null ? (data as { error?: unknown }).error : null
  if (typeof serverText === 'string' && serverText.trim()) return serverText.trim()
  if (err && err.status === undefined) return 'Could not reach the server. Check your connection and try again.'
  return 'This request could not be withdrawn. Please try again.'
}
