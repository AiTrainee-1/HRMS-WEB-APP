import * as React from 'react'
import { authApi, type LoginOptions } from '@/api/resources'

/** Focus and "tab visible again" usually arrive together: one request for both. */
const RELOAD_GAP_MS = 1500

/**
 * GET /auth/login-options for the sign-in pages, always fresh: HR switches WhatsApp codes and SMS codes on and off
 * (WhatsApp Control / SMS Control) and the pages must follow at once. So nothing is cached: it is asked when the page
 * opens, every time the window gets focus or the tab becomes visible again (the employee was reading the code on their
 * phone, or HR changed something meanwhile), when the browser comes back online, and whenever a page calls `reload`
 * (a code request was refused because its channel was switched off).
 *
 * `options` stays null until the first answer; a later failed reload keeps the last answer. `failed` = the server
 * could not be asked and there is no answer at all (the pages then try a code anyway, as before).
 * `onLoaded(next, previous)` runs after every answer (the sign-in page uses it to pick its form).
 */
export function useLoginOptions(onLoaded?: (next: LoginOptions, previous: LoginOptions | null) => void) {
  const [options, setOptions] = React.useState<LoginOptions | null>(null)
  const [failed, setFailed] = React.useState(false)
  const latest = React.useRef<LoginOptions | null>(null)
  const callback = React.useRef(onLoaded)
  React.useEffect(() => {
    callback.current = onLoaded
  })
  // Answers can arrive out of order: an older answer never replaces a newer one.
  const sent = React.useRef(0)
  const applied = React.useRef(0)
  const lastStart = React.useRef(0)
  const mounted = React.useRef(true)

  const load = React.useCallback(async (force: boolean) => {
    const now = Date.now()
    if (!force && now - lastStart.current < RELOAD_GAP_MS) return
    lastStart.current = now
    const mine = ++sent.current
    try {
      const next = await authApi.loginOptions()
      if (!mounted.current || mine < applied.current) return
      applied.current = mine
      const previous = latest.current
      latest.current = next
      setOptions(next)
      setFailed(false)
      callback.current?.(next, previous)
    } catch {
      if (mounted.current && !latest.current) setFailed(true)
    }
  }, [])

  React.useEffect(() => {
    mounted.current = true
    void load(false)
    const onFocus = () => void load(false)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load(false)
    }
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      mounted.current = false
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  const reload = React.useCallback(() => void load(true), [load])
  return { options, failed, reload }
}
