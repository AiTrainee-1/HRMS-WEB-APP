import * as React from 'react'
import { RotateCcw } from 'lucide-react'
import { MangaButton, MangaCard, MangaDialog, MangaTitle } from '@/components/kit/manga/MangaCard'
import { locationOffCopy, type LocationReason } from '@/lib/location-off'
import type { LocationPromptState } from '@/hooks/useLocationPrompt'

/**
 * "Your location is off / blocked" (owner 2026-11-25), in the manga card: why the page needs it, the steps for this
 * browser and device (lib/location-off.ts), and Try again. When the browser reports the permission switching to
 * "allowed" while it is open, it tries again by itself.
 */
export function LocationOffPopup({ prompt, reason, onClose }: { prompt: LocationPromptState | null; reason: LocationReason; onClose: () => void }) {
  const copy = prompt ? locationOffCopy(prompt.problem, reason, typeof navigator === 'undefined' ? '' : navigator.userAgent) : null
  const retry = React.useCallback(() => {
    if (!prompt) return
    onClose()
    prompt.retry()
  }, [prompt, onClose])

  // Allowed in the site settings while the popup is open: carry on at once.
  const retryRef = React.useRef(retry)
  React.useEffect(() => {
    retryRef.current = retry
  }, [retry])
  const blocked = prompt?.problem === 'blocked'
  React.useEffect(() => {
    if (!blocked || !navigator.permissions?.query) return
    let status: PermissionStatus | null = null
    let alive = true
    const onChange = () => {
      if (alive && status?.state === 'granted') retryRef.current()
    }
    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((s) => {
        if (!alive) return
        status = s
        s.addEventListener('change', onChange)
      })
      .catch(() => undefined)
    return () => {
      alive = false
      status?.removeEventListener('change', onChange)
    }
  }, [blocked])

  return (
    <MangaDialog open={!!prompt} onOpenChange={(o) => !o && onClose()} title={copy?.title ?? 'Location'} description={copy?.body}>
      {copy && (
        <MangaCard bubble={copy.bubble} mood="worried" holding="pin" stamp={copy.stamp} onClose={onClose} closeLabel="Close">
          <MangaTitle>{copy.title}</MangaTitle>
          <p className="mt-1 text-[13.5px] leading-[19px] text-muted-foreground">{copy.body}</p>
          <ol className="mt-3 flex flex-col gap-2 rounded-xl border-[1.5px] border-dashed border-input bg-muted/60 p-3">
            {copy.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[13px] leading-[18px]">
                <span
                  aria-hidden="true"
                  className="font-label grid size-6 shrink-0 place-items-center rounded-full border-2 border-[var(--manga-ink)] bg-primary text-[11.5px] font-extrabold text-primary-foreground"
                >
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-4 mr-1 mb-1 flex items-center gap-3">
            <MangaButton data-autofocus className="flex-1" icon={<RotateCcw className="size-[18px]" aria-hidden="true" />} onClick={retry}>
              Try again
            </MangaButton>
            <button
              type="button"
              onClick={onClose}
              className="focus-ring min-h-11 rounded-full px-3 text-[13.5px] font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Not now
            </button>
          </div>
        </MangaCard>
      )}
    </MangaDialog>
  )
}
