import * as React from 'react'
import { AnimatePresence } from 'framer-motion'
import { RefreshCw } from 'lucide-react'
import { MangaButton, MangaCard, MangaTitle } from '@/components/kit/manga/MangaCard'
import { authTransitions } from '@/components/transitions/auth-transitions'
import { VERSION_CHECK_EVERY_MS, checkDue, entryScriptOf, isNewBuild, scriptPath } from '@/lib/app-version'

const LATER_KEY = 'uktex.update.later'

function runningEntry(): string | null {
  if (typeof document === 'undefined') return null
  const el = document.querySelector('script[type="module"][src]')
  return el?.getAttribute('src') ?? null
}

/**
 * "A new version is here - Reload" (owner 2026-11-25), in the manga card the mobile app's update prompt uses. The page
 * compares the entry script a fresh copy of index.html loads with its own (lib/app-version.ts) every 10 minutes and
 * when the tab comes back into view - at most once a minute, never in a loop, never on the dev server. "Later" hides
 * it until a newer build than that one appears (this tab only).
 */
export function UpdateAvailable() {
  const [deployed, setDeployed] = React.useState<string | null>(null)
  const [later, setLater] = React.useState<string | null>(() => {
    try {
      return sessionStorage.getItem(LATER_KEY)
    } catch {
      return null
    }
  })
  const [reloading, setReloading] = React.useState(false)
  const playing = React.useSyncExternalStore(authTransitions.subscribe, () => authTransitions.current() != null, () => false)

  React.useEffect(() => {
    if (import.meta.env.DEV) return
    const running = runningEntry()
    if (!running) return
    let last: number | null = null
    let busy = false
    let alive = true
    const check = async () => {
      if (busy || !checkDue(last, Date.now())) return
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return
      busy = true
      last = Date.now()
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}index.html?v=${Date.now()}`, { cache: 'no-store', credentials: 'same-origin' })
        if (!res.ok) return
        const next = entryScriptOf(await res.text())
        if (alive && isNewBuild(running, next)) setDeployed(scriptPath(next))
      } catch {
        // offline or a blocked request: asked again at the next turn
      } finally {
        busy = false
      }
    }
    const timer = window.setInterval(() => void check(), VERSION_CHECK_EVERY_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      alive = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [])

  const show = !!deployed && deployed !== later && !playing

  return (
    <AnimatePresence>
      {show && (
        <div
          key={deployed}
          role="dialog"
          aria-modal="false"
          aria-labelledby="update-title"
          aria-describedby="update-text"
          className="fixed right-4 bottom-4 z-[80] w-[min(360px,calc(100vw-40px))] max-md:right-1/2 max-md:bottom-[calc(var(--m-tabbar-h,0px)+14px)] max-md:translate-x-1/2"
        >
          <MangaCard bubble="A new version is here!" mood="excited" holding="star" panelHeight={132} mascotWidth={82}>
            <MangaTitle as="h2" className="text-[22px]">
              <span id="update-title">Update time!</span>
            </MangaTitle>
            <p id="update-text" className="mt-1 text-[13.5px] leading-[19px] text-muted-foreground">
              A newer version of the Employee Portal is ready. Reload to get it - anything you were typing on this page is
              cleared, so finish or copy it first.
            </p>
            <div className="mt-4 mr-1 mb-1 flex items-center gap-3">
              <MangaButton
                className="flex-1"
                busy={reloading}
                icon={<RefreshCw className="size-[18px]" aria-hidden="true" />}
                onClick={() => {
                  setReloading(true)
                  window.location.reload()
                }}
              >
                {reloading ? 'Reloading…' : 'Reload now'}
              </MangaButton>
              <button
                type="button"
                className="focus-ring min-h-11 rounded-full px-3 text-[13.5px] font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground"
                onClick={() => {
                  setLater(deployed)
                  try {
                    sessionStorage.setItem(LATER_KEY, deployed)
                  } catch {
                    // not remembered: it may ask again on this tab
                  }
                }}
              >
                Later
              </button>
            </div>
          </MangaCard>
        </div>
      )}
    </AnimatePresence>
  )
}
