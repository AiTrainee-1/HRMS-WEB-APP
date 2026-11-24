/**
 * The offline queue's rules (owner 2026-11-24: "users should be able to complete their tasks offline", the same rules
 * as the mobile app's src/offline). Pure: no React, no storage, no network; tested in offline-ops.test.ts.
 *
 * The rule that keeps data safe: an operation leaves the browser ONLY on a 2xx. Everything else either waits for another
 * try (no internet, timeout, server down or busy, a write still being processed) or stays saved, marked failed with the
 * server's own sentence, until the employee retries or discards it. Every operation carries an Idempotency-Key, so a
 * send that did reach the server before the connection dropped is never done twice (backend/api/idempotency.py).
 */

export type OpMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/** What the queue knows how to send. The engine never looks at it; screens use it to show their own waiting items. */
export type OpKind =
  | 'leave.apply'
  | 'casualLeave.apply'
  | 'permission.submit'
  | 'missingPunch.submit'
  | 'outpass.submit'
  | 'compensation.claim'
  | 'enquiry.submit'
  | 'onDuty.request'
  | 'onDuty.punch'
  | 'onDuty.end'
  | 'onDuty.otPunch'
  | (string & {})

/** A file sent as one multipart field (an On-Duty selfie). Kept as a Blob in IndexedDB. */
export interface OpFile {
  field: string
  name: string
  type: string
  blob: Blob
}

export type OpStatus = 'pending' | 'failed'

export interface QueuedOp {
  id: string
  /** Whose it is: a queue item is only ever sent with that employee's sign-in. */
  employeeId: string
  kind: OpKind
  /** What the employee reads in the "waiting to sync" list ("Leave request · 28 Nov"). */
  label: string
  method: OpMethod
  /** Path under the API base, e.g. "/leave-requests". */
  url: string
  /** JSON body, or the text fields of a multipart body when `files` is set. */
  body: Record<string, unknown> | null
  files: OpFile[]
  /** TanStack Query keys to refresh once the server has it. */
  invalidate: unknown[][]
  /** Anything a screen needs to draw the waiting item. Never sent. */
  meta: Record<string, unknown>
  idempotencyKey: string
  createdAt: number
  status: OpStatus
  attempts: number
  lastError: string | null
  lastTriedAt: number | null
  nextTryAt: number
}

/** What the engine does with one answer. */
export type SendVerdict =
  | { kind: 'done' }
  | { kind: 'retry'; reason: string }
  | { kind: 'failed'; message: string }
  | { kind: 'auth' }

export interface SendOutcome {
  status?: number
  data?: unknown
  /** No answer came back at all (offline, DNS, timeout). */
  noResponse?: boolean
}

export const MAX_SERVER_ERROR_TRIES = 5

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The server's own sentence for a refusal, or a plain fallback. */
export function serverMessage(data: unknown, status?: number): string {
  if (isObject(data)) {
    for (const key of ['error', 'message', 'detail']) {
      const value = data[key]
      if (typeof value === 'string' && value.trim()) return value.trim()
    }
  }
  if (typeof data === 'string' && data.trim() && data.length < 300 && !data.trim().startsWith('<')) return data.trim()
  return status ? `The server could not accept this (error ${status}).` : 'The server could not accept this.'
}

export function classifySend(outcome: SendOutcome, attemptsSoFar = 0): SendVerdict {
  const { status, data } = outcome
  if (outcome.noResponse || status === undefined || status === 0) return { kind: 'retry', reason: 'No internet connection' }
  if (status >= 200 && status < 300) return { kind: 'done' }
  if (status === 401) return { kind: 'auth' }
  if (status === 408 || status === 425 || status === 429) return { kind: 'retry', reason: 'The server is busy' }
  if (status === 409 && isObject(data) && data.code === 'request_in_progress') return { kind: 'retry', reason: 'Still being processed' }
  if (status === 502 || status === 503 || status === 504) return { kind: 'retry', reason: 'The server is not reachable' }
  if (status >= 500) {
    return attemptsSoFar + 1 >= MAX_SERVER_ERROR_TRIES
      ? { kind: 'failed', message: serverMessage(data, status) }
      : { kind: 'retry', reason: 'Server error' }
  }
  // A captive Wi-Fi page / proxy answering 403 or 404 with HTML is not our server's refusal: try again later.
  if ((status === 403 || status === 404) && !isObject(data)) return { kind: 'retry', reason: 'Unexpected answer' }
  return { kind: 'failed', message: serverMessage(data, status) }
}

/** When to try a retryable operation again: 30 s, 1, 2, 4 ... minutes, at most 15. */
export function nextTryDelayMs(attempts: number): number {
  return Math.min(30_000 * 2 ** Math.max(0, attempts - 1), 15 * 60_000)
}

/** A random id for an operation and its Idempotency-Key. */
export function newOpId(now = Date.now(), random: () => number = Math.random): string {
  let tail = ''
  for (let i = 0; i < 16; i++) tail += Math.floor(random() * 36).toString(36)
  return `op-${now.toString(36)}-${tail}`
}

/** The employee's operations due for a send, oldest first (an On-Duty request goes before the punches made under it). */
export function dueOps(ops: readonly QueuedOp[], employeeId: string, now: number, force = false): QueuedOp[] {
  return ops
    .filter((op) => op.employeeId === employeeId && op.status === 'pending' && (force || op.nextTryAt <= now))
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
}

export function countOps(ops: readonly QueuedOp[], employeeId: string): { pending: number; failed: number } {
  let pending = 0
  let failed = 0
  for (const op of ops) {
    if (op.employeeId !== employeeId) continue
    if (op.status === 'pending') pending++
    else failed++
  }
  return { pending, failed }
}

/** The status shown to the employee. */
export type SyncState = 'online' | 'offline' | 'syncing' | 'pending'

export function syncState(input: { online: boolean; syncing: boolean; pending: number }): SyncState {
  if (!input.online) return 'offline'
  if (input.syncing) return 'syncing'
  return input.pending > 0 ? 'pending' : 'online'
}

export const SYNC_STATE_LABEL: Record<SyncState, string> = {
  online: 'Online',
  offline: 'Offline',
  syncing: 'Syncing',
  pending: 'Pending',
}

/** The sentence a form shows when its request was saved in the browser instead of sent. */
export const QUEUED_MESSAGE =
  'No internet right now, so this is saved on this device. It will be sent automatically as soon as you are back online.'

/** The offline popup's sentence (owner's words). */
export const OFFLINE_POPUP_MESSAGE = 'No internet connection. Please turn on your network to sync your data.'
