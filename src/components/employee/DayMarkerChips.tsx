import { cn } from '@/lib/utils'
import type { DayMarkerHit } from '@/lib/attendance-flags'

/** Chips for a day's Late-In / Early Out / Permission states (see getDayMarkers).
 * Renders nothing for a clean day. The late reason, when the backend sends one,
 * is the Late-In chip's tooltip. */
export function DayMarkerChips({ markers, className }: { markers: DayMarkerHit[]; className?: string }) {
  if (markers.length === 0) return null
  return (
    <span className={cn('flex flex-wrap gap-1.5', className)}>
      {markers.map((m) => (
        <span key={m.key} className={cn('chip', m.chip)} title={m.detail}>
          {m.label}
        </span>
      ))}
    </span>
  )
}
