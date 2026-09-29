import * as React from 'react'

/** Counts down from `start()`'s argument to 0, once a second. `seconds` is 0 when idle or finished. */
export function useCountdown() {
  const [seconds, setSeconds] = React.useState(0)

  React.useEffect(() => {
    if (seconds <= 0) return
    const t = window.setTimeout(() => setSeconds((s) => s - 1), 1000)
    return () => window.clearTimeout(t)
  }, [seconds])

  const start = React.useCallback((from: number) => setSeconds(Math.max(0, Math.floor(from))), [])
  return { seconds, start }
}
