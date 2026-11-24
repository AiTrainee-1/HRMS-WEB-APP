import axios from 'axios'
import { apiClient, ApiError } from '@/api/client'
import { newOpId, serverMessage, type OpFile, type OpKind, type OpMethod, type QueuedOp } from '@/lib/offline-ops'
import { enqueueOp, formFor } from '@/offline/engine'

/**
 * Send now, or keep it on this device (owner 2026-11-24, the web side of the mobile app's src/offline/submit.ts).
 *
 * Online, the request goes to the server at once with an Idempotency-Key. If no answer comes back (the connection
 * dropped mid-way) or the server is down (502/503/504), the SAME operation with the SAME key is saved in the offline
 * queue: if the first send did reach the server, the queued one only gets its answer back and nothing is created twice
 * (backend/api/idempotency.py). Offline, it goes straight to the queue.
 *
 * A refusal from the server (400 "reason is required", 409 "already decided" ...) is NOT queued: it is thrown as an
 * ApiError, exactly like apiRequest, so the form shows it right away as before.
 */
export interface QueueSpec {
  kind: OpKind
  /** What the employee reads in the "waiting to sync" list. */
  label: string
  method?: OpMethod
  url: string
  body?: Record<string, unknown> | null
  files?: OpFile[]
  /** TanStack Query keys to refresh once the server has it. */
  invalidate?: unknown[][]
  meta?: Record<string, unknown>
}

/** The marker a mutation returns when its operation was kept on this device. */
export interface QueuedResult {
  __queued: true
  op: QueuedOp
}

export function isQueued(value: unknown): value is QueuedResult {
  return typeof value === 'object' && value !== null && (value as { __queued?: unknown }).__queued === true
}

function noAnswer(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false
  if (axios.isCancel(err) || err.code === 'ERR_CANCELED') return false
  if (!err.response) return true // offline, DNS, timeout, connection dropped
  const status = err.response.status
  return status === 502 || status === 503 || status === 504
}

/** For a mutationFn: the server's answer, or the queued marker. */
export async function sendOrQueue<T = unknown>(spec: QueueSpec): Promise<T | QueuedResult> {
  const id = newOpId()
  const method = spec.method ?? 'POST'
  const files = spec.files ?? []
  const queue = async (): Promise<QueuedResult> => ({
    __queued: true,
    op: await enqueueOp({ ...spec, method, files, id, idempotencyKey: id }),
  })

  if (typeof navigator !== 'undefined' && navigator.onLine === false) return queue()
  try {
    const res = await apiClient.request<T>({
      method,
      url: spec.url,
      data: files.length ? formFor(spec.body, files) : (spec.body ?? {}),
      headers: { 'Idempotency-Key': id },
      timeout: files.length ? 60_000 : 20_000,
    })
    return res.data
  } catch (err) {
    if (noAnswer(err)) return queue()
    if (axios.isAxiosError(err)) {
      throw new ApiError(serverMessage(err.response?.data, err.response?.status), err.response?.status, err.response?.data)
    }
    throw err
  }
}
