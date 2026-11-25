import * as React from 'react'
import { LocationError, locationProblemOf, problemFromCode, problemMessage, showsPopup, type LocationProblem } from '@/lib/location-off'

/** One position from the browser. */
export type Fix = { latitude: number; longitude: number; accuracy?: number; isMocked: boolean }

/**
 * The device's position, once, as accurately as it can (15 s at most). Fails with a LocationError that says why
 * (blocked / off / too slow / not supported / not https), which the "location is off" popup reads.
 */
export function getCurrentFix(): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      reject(new LocationError('insecure', problemMessage('insecure')))
      return
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new LocationError('unsupported', problemMessage('unsupported')))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          isMocked: !!(pos as unknown as { mocked?: boolean }).mocked,
        }),
      (err) => {
        const problem = problemFromCode(err?.code)
        reject(new LocationError(problem, problemMessage(problem)))
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  })
}

export interface LocationPromptState {
  problem: LocationProblem
  retry: () => void
}

/**
 * The "location is off / blocked" popup's state for one page (owner 2026-11-25). `offer(err, retry)` opens it when
 * `err` is a location failure the popup explains (true), or does nothing (false: show the error as before). The
 * popup's Try again closes it and runs `retry`.
 */
export function useLocationPrompt() {
  const [prompt, setPrompt] = React.useState<LocationPromptState | null>(null)
  const offer = React.useCallback((err: unknown, retry: () => void): boolean => {
    const problem = locationProblemOf(err)
    if (!showsPopup(problem)) return false
    setPrompt({ problem: problem as LocationProblem, retry })
    return true
  }, [])
  const close = React.useCallback(() => setPrompt(null), [])
  return { prompt, offer, close }
}
