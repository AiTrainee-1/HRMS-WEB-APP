import axios from 'axios'
import type { QueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import {
  classifySend,
  countOps,
  dueOps,
  nextTryDelayMs,
  type OpFile,
  type OpKind,
  type OpMethod,
  type QueuedOp,
  type SendOutcome,
} from '@/lib/offline-ops'
import { allOps, deleteOp, getOp, putOp } from '@/offline/store'

/**
 * The offline sync (owner 2026-11-24, the web side of the mobile app's src/offline/engine.ts). Forms that may be used
 * offline send through submit.ts: online it goes to the server at once; with no connection (or the connection dropped
 * mid-way) the same operation, with the same Idempotency-Key, is saved here and sent automatically when the browser is
 * back online, when the tab comes back into view, and every 30 seconds while something is waiting. Oldest first, one
 * at a time; a refusal is kept, marked failed, with the server's sentence until the employee retries or discards it.
 * Nothing is ever sent twice: the server answers a repeated key with the first answer.
 *
 * A browser has no background sync for this: the queue is sent while the web app is open.
 */

export interface OfflineStatus {
  /** navigator.onLine (the browser has a network). */
  online: boolean
  syncing: boolean
  pending: number
  failed: number
  /** The label being sent right now. */
  current: string | null
  lastSyncedAt: number | null
  /** The signed-in employee the counts are for (null = nobody signed in). */
  employeeId: string | null
}

const USER_STORAGE_KEY = 'uktex_employee_user'
const TICK_MS = 30_000

let status: OfflineStatus = {
  online: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  syncing: false,
  pending: 0,
  failed: 0,
  current: null,
  lastSyncedAt: null,
  employeeId: null,
}
const listeners = new Set<() => void>()
const changeListeners = new Set<() => void>()
let queryClient: QueryClient | null = null
let running: Promise<void> | null = null

function setStatus(patch: Partial<OfflineStatus>) {
  status = { ...status, ...patch }
  for (const fn of listeners) fn()
}

export function getOfflineStatus(): OfflineStatus {
  return status
}

export function subscribeOfflineStatus(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** Runs whenever the queue changes (an item added, sent, failed, discarded): lists of waiting items reload. */
export function subscribeQueueChanges(fn: () => void): () => void {
  changeListeners.add(fn)
  return () => {
    changeListeners.delete(fn)
  }
}

function queueChanged() {
  for (const fn of changeListeners) fn()
}

/** The employee signed in now, read the same way AuthProvider stores it. */
function currentEmployeeId(): string | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY)
    const id = raw ? (JSON.parse(raw) as { employeeId?: unknown }).employeeId : null
    return id === null || id === undefined || id === '' ? null : String(id)
  } catch {
    return null
  }
}

async function refreshCounts() {
  const employeeId = currentEmployeeId()
  const counts = employeeId ? countOps(await allOps(), employeeId) : { pending: 0, failed: 0 }
  setStatus({ ...counts, employeeId })
}

export function formFor(body: Record<string, unknown> | null | undefined, files: readonly OpFile[]): FormData {
  const form = new FormData()
  for (const [name, value] of Object.entries(body ?? {})) {
    if (value === undefined || value === null) continue
    form.append(name, String(value))
  }
  for (const f of files) form.append(f.field, f.blob, f.name)
  return form
}

async function send(op: QueuedOp): Promise<SendOutcome> {
  try {
    const res = await apiClient.request({
      method: op.method,
      url: op.url,
      data: op.files.length ? formFor(op.body, op.files) : (op.body ?? {}),
      headers: { 'Idempotency-Key': op.idempotencyKey },
      timeout: op.files.length ? 60_000 : 20_000,
    })
    return { status: res.status, data: res.data }
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) return { status: err.response.status, data: err.response.data }
    return { noResponse: true }
  }
}

function invalidate(op: QueuedOp) {
  for (const key of op.invalidate) void queryClient?.invalidateQueries({ queryKey: key })
}

export interface NewOp {
  kind: OpKind
  label: string
  method: OpMethod
  url: string
  body?: Record<string, unknown> | null
  files?: OpFile[]
  invalidate?: unknown[][]
  meta?: Record<string, unknown>
  id: string
  idempotencyKey: string
}

/** Saves an operation for a later send (submit.ts). Throws when nobody is signed in. */
export async function enqueueOp(input: NewOp): Promise<QueuedOp> {
  const employeeId = currentEmployeeId()
  if (!employeeId) throw new Error('Sign in again to send this.')
  const now = Date.now()
  const op: QueuedOp = {
    id: input.id,
    employeeId,
    kind: input.kind,
    label: input.label,
    method: input.method,
    url: input.url,
    body: input.body ?? null,
    files: input.files ?? [],
    invalidate: input.invalidate ?? [],
    meta: input.meta ?? {},
    idempotencyKey: input.idempotencyKey,
    createdAt: now,
    status: 'pending',
    attempts: 0,
    lastError: null,
    lastTriedAt: null,
    // The first try waits a little: the send that just failed was the try.
    nextTryAt: now + 15_000,
  }
  await putOp(op)
  await refreshCounts()
  queueChanged()
  return op
}

/** One pass over the waiting operations (`force` = do not wait for their next-try time: "Sync now" / back online). */
export function syncNow(force = false): Promise<void> {
  if (running) return running
  running = (async () => {
    const employeeId = currentEmployeeId()
    if (!employeeId || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
      await refreshCounts()
      return
    }
    const due = dueOps(await allOps(), employeeId, Date.now(), force)
    if (due.length === 0) {
      await refreshCounts()
      return
    }
    setStatus({ syncing: true })
    let changed = false
    try {
      for (const op of due) {
        setStatus({ current: op.label })
        const outcome = await send(op)
        const verdict = classifySend(outcome, op.attempts)
        const now = Date.now()
        if (verdict.kind === 'done') {
          await deleteOp(op.id)
          invalidate(op)
          changed = true
          continue
        }
        if (verdict.kind === 'failed') {
          await putOp({ ...op, status: 'failed', attempts: op.attempts + 1, lastError: verdict.message, lastTriedAt: now })
          changed = true
          continue
        }
        if (verdict.kind === 'auth') break // the API client signs out
        await putOp({
          ...op,
          attempts: op.attempts + 1,
          lastError: verdict.reason,
          lastTriedAt: now,
          nextTryAt: now + nextTryDelayMs(op.attempts + 1),
        })
        break // keep the order: the rest would fail the same way
      }
    } finally {
      setStatus({ syncing: false, current: null, lastSyncedAt: Date.now() })
      await refreshCounts()
      if (changed) queueChanged()
    }
  })().finally(() => {
    running = null
  })
  return running
}

/** The employee's waiting and failed operations, oldest first (the Sync page). */
export async function listQueuedOps(): Promise<QueuedOp[]> {
  const employeeId = currentEmployeeId()
  if (!employeeId) return []
  return (await allOps()).filter((op) => op.employeeId === employeeId).sort((a, b) => a.createdAt - b.createdAt)
}

/** "Try again" on a failed (or waiting) operation. */
export async function retryOp(id: string): Promise<void> {
  const op = await getOp(id)
  if (!op) return
  await putOp({ ...op, status: 'pending', nextTryAt: 0, attempts: op.status === 'failed' ? 0 : op.attempts })
  queueChanged()
  await syncNow(true)
}

/** "Discard": the employee gives the operation up. It is deleted from this device and never sent. */
export async function discardOp(id: string): Promise<void> {
  await deleteOp(id)
  await refreshCounts()
  queueChanged()
}

/**
 * Starts the automatic sync (once, from AuthProvider): back online, the tab back in view, and every 30 seconds.
 * Returns a stop function.
 */
export function startOfflineSync(client: QueryClient): () => void {
  queryClient = client
  const onOnline = () => {
    setStatus({ online: true })
    void syncNow(true)
  }
  const onOffline = () => setStatus({ online: false })
  const onVisible = () => {
    if (document.visibilityState === 'visible') void syncNow(false)
  }
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  document.addEventListener('visibilitychange', onVisible)
  const timer = window.setInterval(() => void syncNow(false), TICK_MS)
  setStatus({ online: navigator.onLine !== false })
  void syncNow(true)
  return () => {
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
    document.removeEventListener('visibilitychange', onVisible)
    window.clearInterval(timer)
  }
}

/** Re-reads the counts (after a sign-in / sign-out changes whose queue is shown). */
export function refreshOfflineCounts(): Promise<void> {
  return refreshCounts()
}
