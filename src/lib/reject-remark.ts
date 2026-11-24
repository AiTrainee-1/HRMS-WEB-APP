// The rule for every Reject a Department Head makes (owner brief 2026-11-21): approving never needs a remark, rejecting
// always needs the reason. The server applies the same rule to every decision endpoint (HTTP 400, error code
// "remark_required", the same sentence), so this check only saves a round trip; the server's words are still shown when
// it refuses. Same helper as the HRMS (frontend/src/lib/reject-remark.ts). Pure, tested in reject-remark.test.ts.

export const REJECT_REMARK_MIN = 3
export const REJECT_REMARK_MAX = 1000

/** The words the employee will read: spaces (and line breaks) collapsed, trimmed, at most REJECT_REMARK_MAX characters. */
export function cleanRejectRemark(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim().slice(0, REJECT_REMARK_MAX)
}

export const REJECT_REMARK_MESSAGE = `Write the reason for rejecting (at least ${REJECT_REMARK_MIN} characters).`

/** Why this reason cannot be sent yet, or null when it is fine. */
export function rejectRemarkProblem(text: string | null | undefined): string | null {
  return cleanRejectRemark(text).length < REJECT_REMARK_MIN ? REJECT_REMARK_MESSAGE : null
}

/**
 * True when the server refused a rejection because its reason was missing or too short (`code: "remark_required"`).
 * Reads the code off the error itself or off its response body (ApiError keeps the body in `data`).
 */
export function isRemarkRequiredError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const own = (err as { code?: unknown }).code
  const data = (err as { data?: unknown }).data
  const body = data && typeof data === 'object' ? (data as { code?: unknown }).code : undefined
  return own === 'remark_required' || body === 'remark_required'
}
