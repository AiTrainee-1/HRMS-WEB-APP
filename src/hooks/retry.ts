import { ApiError } from '@/api/client'

/** A refusal (4xx) or a missing route will answer the same again: only a server-side or network failure is worth a second try. */
export function retryTransient(failureCount: number, error: unknown): boolean {
  const status = error instanceof ApiError ? error.status : undefined
  return failureCount < 1 && (status === undefined || status >= 500)
}
