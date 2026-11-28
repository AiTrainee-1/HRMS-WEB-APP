import { Bot, Briefcase, ClockPlus, FilePen, Fingerprint, MapPin, UserCog, type LucideIcon } from 'lucide-react'
import { punchCountText, type DayPunchView, type PunchKind } from '@/lib/day-punches'
import { cn } from '@/lib/utils'

// One colour per punch source (the mobile app's hues; lighter ink in dark mode so it stays readable).
const KIND_LOOK: Record<PunchKind, { icon: LucideIcon; ink: string; border: string; pill: string }> = {
  biometric: { icon: Fingerprint, ink: 'text-[#2563EB] dark:text-[#93C5FD]', border: 'border-[#2563EB]/35', pill: 'bg-[#2563EB]/10' },
  geo: { icon: MapPin, ink: 'text-[#0E7490] dark:text-[#67E8F9]', border: 'border-[#0891B2]/35', pill: 'bg-[#0891B2]/10' },
  on_duty: { icon: Briefcase, ink: 'text-[#975A16] dark:text-[#F6C177]', border: 'border-[#B7791F]/35', pill: 'bg-[#B7791F]/10' },
  ot: { icon: ClockPlus, ink: 'text-[#C2410C] dark:text-[#FDBA74]', border: 'border-[#C2410C]/35', pill: 'bg-[#C2410C]/10' },
  missing_punch: { icon: FilePen, ink: 'text-[#6D28D9] dark:text-[#C4B5FD]', border: 'border-[#7C3AED]/35', pill: 'bg-[#7C3AED]/10' },
  hr: { icon: UserCog, ink: 'text-[#4338CA] dark:text-[#A5B4FC]', border: 'border-[#4F46E5]/35', pill: 'bg-[#4F46E5]/10' },
  auto: { icon: Bot, ink: 'text-[#475569] dark:text-[#CBD5E1]', border: 'border-[#64748B]/35', pill: 'bg-[#64748B]/10' },
}

/**
 * Every punch of the day side by side (owner 2026-11-24), in time order: "#n", In / Out / OT, the time, where it came
 * from (Biometric, Geo Punch, On-Duty, OT Punch n, Missing Punch, HR entry, Auto) and anything special about it
 * (waiting for HR, rejected, not counted, the previous night's shift, the next day). A punch that does not count toward
 * the day has a dashed border. Scrolls sideways when there are more than fit. `inProgress` (today, its shift still
 * running: lib/day-progress.ts) says the day is still open, so its last punch is not yet the day's exit.
 */
export function DayPunchStrip({ punches, inProgress = false }: { punches: readonly DayPunchView[]; inProgress?: boolean }) {
  return (
    <section aria-labelledby="day-punches-title" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id="day-punches-title" className="label-caps text-foreground/80">
          Punches
        </h3>
        <p className="text-[12px] text-muted-foreground tabular-nums">
          {punchCountText(punches)}
          {inProgress && ' · day still open'}
        </p>
      </div>
      {punches.length === 0 ? (
        <p className="text-sm text-muted-foreground">No punches were recorded on this day.</p>
      ) : (
        <ol className="scrollbar-none -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1" aria-label="Punches on this day, in time order">
          {punches.map((p, i) => {
            const look = KIND_LOOK[p.kind]
            return (
              <li
                key={p.key}
                className={cn(
                  'flex w-[136px] shrink-0 snap-start flex-col gap-1 rounded-lg border bg-foreground/[0.02] p-2.5',
                  look.border,
                  !p.counted && 'border-dashed opacity-85',
                )}
              >
                <span className="sr-only">{`Punch ${i + 1}: ${p.direction} at ${p.time}, ${p.source}${p.detail ? `, ${p.detail}` : ''}${p.counted ? '' : ', not counted'}`}</span>
                <div className="flex items-center justify-between gap-1" aria-hidden="true">
                  <span className="text-[11px] font-bold text-muted-foreground tabular-nums">#{i + 1}</span>
                  <span className={cn('rounded-full px-2 py-px text-[11px] font-bold', look.pill, look.ink)}>{p.direction}</span>
                </div>
                <p className="text-[15px] leading-5 font-semibold tabular-nums" aria-hidden="true">
                  {p.time}
                </p>
                <p className={cn('flex min-w-0 items-center gap-1 text-[12px] font-semibold', look.ink)} aria-hidden="true">
                  <look.icon className="size-3.5 shrink-0" />
                  <span className="truncate">{p.source}</span>
                </p>
                {p.detail && (
                  <p className="line-clamp-2 text-[11.5px] leading-4 text-muted-foreground" aria-hidden="true">
                    {p.detail}
                  </p>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
