import { motion } from 'framer-motion'
import { Clock, ExternalLink, Flag, MapPin, Navigation, PauseCircle, Route } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ErrorState, SkeletonBlock, Timeline, useReducedMotion, type TimelineItem } from '@/components/kit'
import { useJourney } from '@/hooks/useOnDutyRecords'
import { formatDistance, formatDuration, projectRoute, routeMapLink, type Journey } from '@/lib/onduty-records'
import { timeOfDay } from '@/lib/notifications'

const W = 560
const H = 300

/** The day's path drawn in a box (north up), the start green, the end a flag, every stop a ringed dot. Pure SVG: no map
 *  tiles, so nothing is loaded from a map service; "Open in Google Maps" shows the streets. */
function RouteDrawing({ journey }: { journey: Journey }) {
  const reduced = useReducedMotion()
  const r = projectRoute(journey.path, journey.stops, W, H, 24)
  if (!r.points) {
    return <p className="rounded-xl border border-dashed border-foreground/15 px-4 py-10 text-center text-sm text-muted-foreground">No location points were recorded for this day.</p>
  }
  return (
    <figure className="weave-static relative overflow-hidden rounded-xl border hairline bg-card/60">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Route of the day, ${formatDistance(journey.distanceM)} with ${journey.stopCount} stops`} className="block h-auto w-full">
        <defs>
          <linearGradient id="route-silk" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--success)" />
            <stop offset="60%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="var(--brand-violet)" />
          </linearGradient>
        </defs>
        <polyline points={r.points} fill="none" stroke="var(--primary)" strokeOpacity={0.15} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
        <motion.polyline
          points={r.points}
          fill="none"
          stroke="url(#route-silk)"
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: reduced ? 1 : 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: reduced ? 0 : 1.6, ease: [0.16, 1, 0.3, 1] }}
        />
        {r.stops.map((s) => (
          <g key={s.key}>
            <circle cx={s.x} cy={s.y} r={9} fill="var(--warning)" fillOpacity={0.18} />
            <circle cx={s.x} cy={s.y} r={4.5} fill="var(--warning)" stroke="var(--card)" strokeWidth={2} />
          </g>
        ))}
        {r.start && <circle cx={r.start[0]} cy={r.start[1]} r={7} fill="var(--success)" stroke="var(--card)" strokeWidth={3} />}
        {r.end && (
          <motion.g initial={{ opacity: reduced ? 1 : 0 }} animate={{ opacity: 1 }} transition={{ delay: reduced ? 0 : 1.4 }}>
            <circle cx={r.end[0]} cy={r.end[1]} r={8} fill="var(--destructive)" stroke="var(--card)" strokeWidth={3} />
          </motion.g>
        )}
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 border-t hairline px-3 py-2 text-[12px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-success" aria-hidden="true" /> Start</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-warning" aria-hidden="true" /> Stop</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-destructive" aria-hidden="true" /> End</span>
      </figcaption>
    </figure>
  )
}

/**
 * "See route": the recorded journey of one On-Duty day (GET /tracking/journeys/<id>, which lets an employee read their
 * own journeys, and a Department Head the journeys of the team members whose On-Duty requests their Approvals list):
 * distance, time moving and stopped, the drawn path, every stop with its place, and a link to the same route in Google
 * Maps. `ownerName`: opened by someone else (a head, from Approvals) - the words name whose phone it was, never "your".
 */
export function JourneyDialog({
  journeyId,
  title,
  onClose,
  ownerName = null,
}: {
  journeyId: number | null
  title: string
  onClose: () => void
  ownerName?: string | null
}) {
  const q = useJourney(journeyId)
  const j = q.data
  const map = j ? routeMapLink(j.path, j.stops) : null
  const stops: TimelineItem[] = j
    ? [
        ...(j.startedAt ? [{ key: 'start', title: 'Started', time: timeOfDay(j.startedAt), icon: Navigation, tone: 'emerald' as const }] : []),
        ...j.stops.map((s) => ({
          key: s.key,
          title: s.address || 'Stopped',
          time: timeOfDay(s.startedAt),
          description: `Stayed ${formatDuration(s.durationS)}`,
          icon: PauseCircle,
          tone: 'amber' as const,
        })),
        ...(j.endedAt ? [{ key: 'end', title: 'Ended', time: timeOfDay(j.endedAt), icon: Flag, tone: 'rose' as const }] : []),
      ]
    : []

  return (
    <Dialog open={journeyId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Route className="size-5 text-brand-blue" aria-hidden="true" /> Route of the day
          </DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        {q.isPending ? (
          <div className="flex flex-col gap-3" role="status" aria-label="Loading the route">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <SkeletonBlock key={i} className="h-14 rounded-lg" />
              ))}
            </div>
            <SkeletonBlock className="h-56 rounded-xl" />
          </div>
        ) : q.isError || !j ? (
          <ErrorState compact error={q.error} what="the route" onRetry={() => q.refetch()} retrying={q.isFetching} />
        ) : (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['Distance', formatDistance(j.distanceM), Route],
                ['Moving', formatDuration(j.travelS), Navigation],
                ['Stopped', formatDuration(j.stopS), PauseCircle],
                ['Stops', String(j.stopCount), MapPin],
              ].map(([k, v, Icon]) => {
                const I = Icon as typeof Route
                return (
                  <div key={k as string} className="rounded-lg bg-foreground/[0.04] px-3 py-2">
                    <dt className="label-caps flex items-center gap-1 text-muted-foreground">
                      <I className="size-3" aria-hidden="true" /> {k as string}
                    </dt>
                    <dd className="mt-0.5 text-[16px] font-semibold tabular-nums">{v as string}</dd>
                  </div>
                )
              })}
            </dl>
            <RouteDrawing journey={j} />
            {stops.length > 0 && <Timeline items={stops} ariaLabel="Stops through the day" />}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t hairline pt-3">
              <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <Clock className="size-3.5" aria-hidden="true" /> Total {formatDuration(j.durationS)}, drawn from{' '}
                {ownerName ? `the location points of ${ownerName}'s phone.` : "your phone's location points."}
              </p>
              {map && (
                <Button asChild variant="outline" size="sm" className="min-h-11 sm:min-h-8">
                  <a href={map} target="_blank" rel="noopener noreferrer">
                    <ExternalLink aria-hidden="true" /> Open in Google Maps<span className="sr-only"> (new tab)</span>
                  </a>
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
