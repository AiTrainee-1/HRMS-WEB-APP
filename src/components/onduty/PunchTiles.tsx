import { motion } from 'framer-motion'
import { Camera, CheckCircle2, Clock, Loader2, Moon, Sunrise, Utensils, UtensilsCrossed, type LucideIcon } from 'lucide-react'
import { listItem } from '@/components/kit'
import type { PunchNumber, PunchTile } from '@/lib/onduty-punches'
import { cn } from '@/lib/utils'

const ICONS: Record<PunchNumber, LucideIcon> = { 1: Sunrise, 2: Utensils, 3: UtensilsCrossed, 4: Moon }

/**
 * The four On-Duty punches as four cards (owner 2026-11-24): Morning Punch, Lunch Out, Lunch In, Night Punch, each with
 * its expected time and what happened to it. Any open one can be chosen, in any order (forgot the morning one? the Night
 * Punch can still be recorded). The rules are lib/onduty-punches.ts. Mirrors the mobile app's PunchTiles.
 */
export function PunchTiles({
  tiles,
  onSelect,
  disabled,
  busyNumber,
  photos,
}: {
  tiles: PunchTile[]
  onSelect: (tile: PunchTile) => void
  disabled?: boolean
  /** The punch being captured / sent right now (spinner on its card). */
  busyNumber?: number | null
  /** How many selfies a punch takes (1 or 2), for the hint line. */
  photos: 1 | 2
}) {
  const doneCount = tiles.filter((t) => t.state !== 'open').length
  return (
    <section aria-labelledby="od-punches-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="od-punches-title" className="font-display text-[17px] font-semibold">
          Geo-punches
        </h3>
        <p className="text-[13px] font-semibold text-muted-foreground tabular-nums">
          {doneCount} of 4 done · {4 - doneCount} left
        </p>
      </div>
      <p className="-mt-1 text-[12.5px] text-muted-foreground">
        Choose any punch to record it, in any order. Each needs {photos === 2 ? 'two selfies' : 'a selfie'} and your location.
      </p>
      <ul className="grid grid-cols-2 gap-3 max-md:gap-2.5">
        {tiles.map((t, i) => {
          const Icon = ICONS[t.punchNumber]
          const tappable = t.selectable && !disabled
          const busy = busyNumber === t.punchNumber
          const done = t.state === 'done'
          const approved = t.doneStatus === 'approved' || t.doneStatus === 'recorded'
          const fg = done ? (approved ? 'text-approved' : 'text-waiting') : 'text-primary'
          const label = `${t.name}, expected ${t.expected ?? 'any time'}. ${t.statusLabel}${t.time ? ` at ${t.time}` : ''}.${tappable ? ' Choose to record it.' : ''}`
          return (
            <motion.li key={t.punchNumber} {...listItem(i)} className="min-w-0">
              <button
                type="button"
                onClick={() => tappable && onSelect(t)}
                disabled={!tappable}
                aria-label={label}
                className={cn(
                  'focus-ring flex h-full min-h-[150px] w-full flex-col gap-1 rounded-xl border p-3 text-left transition-colors',
                  done
                    ? approved
                      ? 'border-approved-border bg-approved-bg/50'
                      : 'border-waiting-border bg-waiting-bg/50'
                    : t.selectable
                      ? 'border-primary/40 bg-card hover:border-primary hover:bg-primary/[0.04] active:scale-[0.99]'
                      : 'hairline bg-foreground/[0.03]',
                  !tappable && 'cursor-default',
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'grid size-9 place-items-center rounded-lg',
                      done ? (approved ? 'bg-approved-bg text-approved' : 'bg-waiting-bg text-waiting') : 'bg-primary/10 text-primary',
                    )}
                  >
                    <Icon className="size-[18px]" />
                  </span>
                  <span aria-hidden="true" className={fg}>
                    {busy ? (
                      <Loader2 className="size-[18px] animate-spin" />
                    ) : done ? (
                      approved ? <CheckCircle2 className="size-[18px]" /> : <Clock className="size-[18px]" />
                    ) : (
                      <Camera className="size-[18px]" />
                    )}
                  </span>
                </span>
                <span className="mt-1 truncate text-[14.5px] font-semibold">{t.name}</span>
                <span className="text-[12px] text-muted-foreground">
                  {t.expected ? `Expected ${t.expected}` : 'Any time'}
                  {t.kind === 'IN' ? ' · In' : ' · Out'}
                </span>
                <span className={cn('font-label text-[15px] font-bold tabular-nums', t.time ? fg : tappable ? 'text-primary' : 'text-muted-foreground')}>
                  {t.time ?? (tappable ? 'Record now' : '—')}
                </span>
                <span className={cn('text-[12px] font-semibold', done ? fg : 'text-muted-foreground')}>{t.statusLabel}</span>
                {t.note && <span className="text-[11.5px] leading-4 text-rejected">{t.note}</span>}
              </button>
            </motion.li>
          )
        })}
      </ul>
    </section>
  )
}
