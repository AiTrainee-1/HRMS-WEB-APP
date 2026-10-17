// The words for "this page could not load", shared by the pages that read a single endpoint (Compensation, HOD
// Assignment). Structural (no import of the app's ApiError), so it is pure and Node's test runner can run it: `npm test`.

/**
 * A sentence for a failed read. `what` names the thing in lower case ("your compensation").
 *  - no answer at all (server down, no network): say so, never a raw "Network Error"
 *  - 404: the deployed server has not got that endpoint yet (an older backend)
 *  - 5xx: the server had a problem (its own text is usually technical)
 *  - anything else: the server's own sentence when it sent one
 */
export function loadErrorMessage(err: unknown, what: string): string {
  const e = err as { status?: number; message?: string } | null
  const status = typeof e?.status === 'number' ? e.status : undefined
  const message = typeof e?.message === 'string' ? e.message.trim() : ''
  if (status === undefined) {
    return 'We could not reach the server. Check your connection and try again.'
  }
  if (status === 404) {
    return `${capitalize(what)} is not available on the server yet. Please try again later, or contact HR.`
  }
  if (status >= 500) {
    return 'The server had a problem. Please try again in a moment.'
  }
  return message || `We could not load ${what}. Please try again.`
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
