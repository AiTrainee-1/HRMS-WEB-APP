import { format, isValid, parseISO } from 'date-fns'
import { AlertTriangle, CheckCheck, CheckCircle2, Circle, Clock, ClockPlus, Loader2, MapPin, Route, ShieldCheck, Timer, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDistance } from '@/lib/onduty-records'
import { durationText, endSummary, type PunchTile } from '@/lib/onduty-punches'
import { cn } from '@/lib/utils'

function Fact({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <dt className="w-24 shrink-0 text-[13px] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 text-[13.5px] font-semibold break-words">{value}</dd>
    </div>
  )
}

const clockOf = (iso: string | null) => {
  if (!iso) return '—'
  const d = parseISO(iso)
  return isValid(d) ? format(d, 'h:mm a') : '—'
}

/**
 * "End On-Duty" / "Complete Duty" (owner 2026-11-24): the whole day at a glance before it is closed - where, since when,
 * how long, the distance when the route was recorded (mobile app), the four punches (done / not recorded) and the OT
 * punches - and only then "Yes, end On-Duty". Missing punches are named: once the session ends they can no longer be
 * added to it. Mirrors the mobile app's EndOnDutySheet.
 */
export function EndOnDutyDialog({
  open,
  onOpenChange,
  onConfirm,
  ending,
  destination,
  startedAt,
  approvalText,
  tiles,
  distanceM,
  now,
  otCount = 0,
  otText = null,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  ending: boolean
  destination: string
  startedAt: string | null
  approvalText: string | null
  tiles: PunchTile[]
  distanceM?: number | null
  now: number
  otCount?: number
  otText?: string | null
}) {
  const summary = endSummary(tiles, startedAt, now)
  return (
    <Dialog open={open} onOpenChange={(o) => !ending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>End On-Duty?</DialogTitle>
          <DialogDescription>Check your day before you end it.</DialogDescription>
        </DialogHeader>

        <dl className="rounded-lg bg-foreground/[0.04] px-3 py-1.5">
          <Fact icon={MapPin} label="Where" value={destination || '—'} />
          <Fact icon={Clock} label="Started" value={clockOf(startedAt)} />
          <Fact icon={Timer} label="Duration" value={durationText(summary.durationMs)} />
          {distanceM != null && distanceM > 0 && <Fact icon={Route} label="Travelled" value={formatDistance(distanceM)} />}
          {approvalText && <Fact icon={ShieldCheck} label="Approval" value={approvalText} />}
        </dl>

        <div>
          <p className="label-caps mb-1.5 text-muted-foreground">
            Geo-punches · {summary.done.length} done, {summary.missing.length} not recorded
          </p>
          <ul className="divide-y divide-[var(--glass-border)] rounded-lg border hairline">
            {tiles.map((t) => {
              const done = t.state !== 'open'
              return (
                <li key={t.punchNumber} className="flex items-center gap-2.5 px-3 py-2 text-[13.5px]">
                  {done ? (
                    <CheckCircle2 className="size-4 shrink-0 text-approved" aria-hidden="true" />
                  ) : (
                    <Circle className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  )}
                  <span className="min-w-0 flex-1 font-semibold">{t.name}</span>
                  <span className={cn('text-right text-[12.5px]', done ? 'text-foreground/85' : 'text-muted-foreground')}>
                    {done ? `${t.time ? `${t.time} · ` : ''}${t.statusLabel}` : `Not recorded (expected ${t.expected ?? '—'})`}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>

        {otCount > 0 && (
          <p className="flex items-start gap-2 rounded-lg bg-info-bg px-3 py-2 text-[13px]">
            <ClockPlus className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
            <span>
              <span className="font-semibold">Overtime: </span>
              {otCount} OT punch{otCount === 1 ? '' : 'es'}
              {otText ? ` · ${otText}` : ''}
            </span>
          </p>
        )}

        {summary.missingNames ? (
          <p role="alert" className="flex items-start gap-2 rounded-lg border border-waiting-border bg-waiting-bg px-3 py-2 text-[13px] text-waiting">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              {summary.missingNames} {summary.missing.length === 1 ? 'is' : 'are'} not recorded. After you end this On-Duty you cannot add{' '}
              {summary.missing.length === 1 ? 'it' : 'them'} to it. If you missed one, record it first, or ask for a missing punch later.
            </span>
          </p>
        ) : (
          <p className="flex items-center gap-2 rounded-lg border border-approved-border bg-approved-bg px-3 py-2 text-[13px] font-semibold text-approved">
            <CheckCheck className="size-4 shrink-0" aria-hidden="true" /> All four punches are in.
          </p>
        )}

        <p className="text-[12px] text-muted-foreground">
          Your punches stay with HR for approval as usual. You can apply for a new On-Duty after this one is closed.
        </p>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={ending}>
            Not yet
          </Button>
          <Button onClick={onConfirm} disabled={ending}>
            {ending && <Loader2 className="animate-spin" aria-hidden="true" />} Yes, end On-Duty
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
