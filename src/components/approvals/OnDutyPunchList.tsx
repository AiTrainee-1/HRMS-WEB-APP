import * as React from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Clock, ExternalLink, ImageOff, LogIn, LogOut, MapPin, XCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SkeletonBlock, listItem } from '@/components/kit'
import { useOnDutyPhoto } from '@/hooks/useAuthedPhoto'
import { fmtDay } from '@/lib/approvals-history'
import { clock12, mapLink, type OnDutyPunchRow } from '@/lib/approvals-items'
import { cn } from '@/lib/utils'

const STATUS = {
  approved: { label: 'Counted', icon: CheckCircle2, cls: 'text-approved' },
  rejected: { label: 'Not counted', icon: XCircle, cls: 'text-rejected' },
  pending: { label: 'Waiting', icon: Clock, cls: 'text-waiting' },
} as const

/** One selfie: fetched with the sign-in token, shown as a thumbnail that opens large. */
function Thumb({ id, n, label, onOpen }: { id: number; n: 1 | 2; label: string; onOpen: (url: string, label: string) => void }) {
  const { url, loading, failed } = useOnDutyPhoto(id, n)
  if (failed) {
    return (
      <span className="grid size-16 place-items-center rounded-lg border border-dashed border-foreground/20 text-muted-foreground" role="img" aria-label={`${label} is not available`}>
        <ImageOff className="size-5" aria-hidden="true" />
      </span>
    )
  }
  if (loading || !url) return <SkeletonBlock className="size-16 rounded-lg" />
  return (
    <button
      type="button"
      onClick={() => onOpen(url, label)}
      className="focus-ring group relative size-16 overflow-hidden rounded-lg border hairline shadow-clay-sm"
      aria-label={`Open ${label}`}
    >
      <img src={url} alt={label} className="size-full object-cover transition-transform duration-300 group-hover:scale-110" />
    </button>
  )
}

/**
 * Every punch the employee recorded under an On-Duty request: In / Out, the time, whether it counts, where (opens Google
 * Maps), a warning when the phone said the location may be faked, and the selfies taken with it - what the head approves.
 */
export function OnDutyPunchList({ punches }: { punches: OnDutyPunchRow[] }) {
  const [viewer, setViewer] = React.useState<{ url: string; label: string } | null>(null)

  if (!punches.length) {
    return <p className="rounded-lg border border-dashed border-foreground/15 px-3 py-4 text-center text-[13px] text-muted-foreground">No punches recorded under this request yet.</p>
  }

  return (
    <>
      <ol aria-label="Punches recorded" className="flex flex-col gap-2">
        {punches.map((p, i) => {
          const st = STATUS[p.status]
          const StatusIcon = st.icon
          const map = mapLink(p.latitude, p.longitude)
          const label = `${p.punchType === 'OUT' ? 'Check-out' : 'Check-in'} photo`
          return (
            <motion.li
              key={p.id}
              {...listItem(i)}
              className={cn('flex flex-wrap items-start gap-3 rounded-lg border p-3', p.isMocked ? 'border-rejected-border bg-rejected-bg/40' : 'hairline bg-foreground/[0.03]')}
            >
              <span
                aria-hidden="true"
                className={cn('grid size-9 shrink-0 place-items-center rounded-full border', p.punchType === 'OUT' ? 'bg-waiting-bg text-waiting border-waiting-border' : 'bg-approved-bg text-approved border-approved-border')}
              >
                {p.punchType === 'OUT' ? <LogOut className="size-4" /> : <LogIn className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold tabular-nums">
                  {p.punchType === 'OUT' ? 'Out' : 'In'} · {clock12(p.punchTime)}
                  {p.punchDate && <span className="ml-2 text-[12px] font-medium text-muted-foreground">{fmtDay(p.punchDate, { year: false })}</span>}
                </p>
                <p className={cn('mt-0.5 flex items-center gap-1 text-[12.5px] font-medium', st.cls)}>
                  <StatusIcon className="size-3.5" aria-hidden="true" /> {st.label}
                  {p.accuracyM != null && <span className="text-muted-foreground"> · within {Math.round(p.accuracyM)} m</span>}
                </p>
                {p.isMocked && (
                  <p className="mt-1 flex items-center gap-1 text-[12.5px] font-semibold text-rejected">
                    <AlertTriangle className="size-3.5" aria-hidden="true" /> The phone said this location may be faked
                  </p>
                )}
                {map && (
                  <a
                    href={map}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="focus-ring mt-1.5 inline-flex min-h-8 items-center gap-1 rounded text-[12.5px] font-semibold text-brand-blue hover:underline"
                  >
                    <MapPin className="size-3.5" aria-hidden="true" /> Show on map <ExternalLink className="size-3" aria-hidden="true" />
                    <span className="sr-only">(opens Google Maps in a new tab)</span>
                  </a>
                )}
              </div>
              {(p.hasPhoto || p.hasPhoto2) && (
                <div className="flex gap-2">
                  {p.hasPhoto && <Thumb id={p.id} n={1} label={label} onOpen={(url, l) => setViewer({ url, label: l })} />}
                  {p.hasPhoto2 && <Thumb id={p.id} n={2} label={`Second ${label.toLowerCase()}`} onOpen={(url, l) => setViewer({ url, label: l })} />}
                </div>
              )}
            </motion.li>
          )
        })}
      </ol>

      <Dialog open={!!viewer} onOpenChange={(o) => !o && setViewer(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewer?.label}</DialogTitle>
            <DialogDescription>Taken with the punch, on the employee's phone.</DialogDescription>
          </DialogHeader>
          {viewer && <img src={viewer.url} alt={viewer.label} className="max-h-[70vh] w-full rounded-lg object-contain" />}
        </DialogContent>
      </Dialog>
    </>
  )
}
