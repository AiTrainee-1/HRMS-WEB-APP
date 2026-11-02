import * as React from 'react'

/** "Now", moved on every `everyMs` (default a minute), so "Waiting 3 hours" or a countdown stays true while a page is
 *  open. Pass a shorter interval only while something visibly counts (a reminder cooldown). */
export function useNow(everyMs = 60_000): number {
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), everyMs)
    return () => window.clearInterval(t)
  }, [everyMs])
  return now
}
