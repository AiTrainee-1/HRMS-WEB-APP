import * as React from 'react'
import { motion } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { QRCodeSVG } from 'qrcode.react'
import { CheckCircle2, XCircle, Clock, RotateCw, MapPin } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { Employee, OutpassRequest } from '@/types'

/**
 * A genuine two-sided ID card for an Outpass request. The front carries the
 * employee/trip details a gate guard would check; the back carries the
 * approval/rejection paper trail. Clicking the card flips it between the
 * two -mirrors the mobile app's OutpassFlipCard so both clients present the
 * same object.
 *
 * Colour identity is dynamic: neutral while pending, green once approved,
 * red once rejected -recomputed from `request.status`, never fixed.
 */

const APPROVER_LABEL: Record<string, string> = { hr: 'HR', dept_head: 'HOD', system: 'On-Duty approval' }
const SOURCE_LABEL: Record<string, string> = { manual: 'Manual request', on_duty: 'Auto-generated from On-Duty' }

function useCountdown(expiresAt: string | null | undefined) {
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    if (!expiresAt) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [expiresAt])
  if (!expiresAt) return { expired: false, remainingMs: null as number | null }
  const remainingMs = new Date(expiresAt).getTime() - now
  return { expired: remainingMs <= 0, remainingMs }
}

function formatRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function toneFor(status: string) {
  if (status === 'approved') {
    return { border: 'border-success/50', bg: 'bg-success/5', text: 'text-success', chipBg: 'bg-success/10' }
  }
  if (status === 'rejected') {
    return { border: 'border-destructive/50', bg: 'bg-destructive/5', text: 'text-destructive', chipBg: 'bg-destructive/10' }
  }
  return { border: 'border-muted-foreground/30', bg: 'bg-muted/30', text: 'text-muted-foreground', chipBg: 'bg-muted' }
}

export function OutpassFlipCard({
  request,
  employee,
  startFlipped = false,
}: {
  request: OutpassRequest
  employee?: Employee
  startFlipped?: boolean
}) {
  const [flipped, setFlipped] = React.useState(startFlipped)
  const { expired, remainingMs } = useCountdown(request.expiresAt)
  const tone = toneFor(request.status)

  const StatusIcon = request.status === 'approved' ? CheckCircle2 : request.status === 'rejected' ? XCircle : Clock
  const statusLabel = request.status === 'approved' ? 'Approved' : request.status === 'rejected' ? 'Not Approved' : 'Pending Review'
  // qrToken is only ever present while the pass is actually presentable at a
  // gate (approved, unexpired, not yet exited) -see backend/api/
  // outpass_request_views.py::_outpass_request_json.
  const showQr = !!request.qrToken

  return (
    <div
      className={`relative w-full cursor-pointer select-none ${showQr ? 'h-[350px]' : 'h-[260px]'}`}
      style={{ perspective: 1400 }}
      onClick={() => setFlipped((f) => !f)}
      role="button"
      aria-label="Outpass card, click to flip"
    >
      <motion.div
        className="relative h-full w-full"
        style={{ transformStyle: 'preserve-3d' }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
      >
        {/* ── Front ── */}
        <div
          className={`absolute inset-0 flex flex-col gap-3 rounded-2xl border-2 p-4 ${tone.border} ${tone.bg}`}
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-1.5 text-sm font-bold ${tone.text}`}>
              <StatusIcon className="size-4" />
              {statusLabel}
            </div>
            {request.status === 'approved' && (
              <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${tone.chipBg} ${tone.text}`}>
                <Clock className="size-3" /> {expired || remainingMs == null ? 'Expired' : formatRemaining(remainingMs)}
              </span>
            )}
            <RotateCw className="size-3.5 text-muted-foreground/60" />
          </div>

          <div className="flex items-center gap-3">
            <Avatar className="size-14 border-2 border-white shadow-clay dark:border-white/10">
              <AvatarImage src={employee?.photoUrl} alt={employee?.firstName} />
              <AvatarFallback>
                {employee?.firstName?.[0]}
                {employee?.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-bold">{employee ? `${employee.firstName} ${employee.lastName}` : '—'}</p>
              <p className="text-xs text-muted-foreground">{employee?.employeeCode}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Going to</p>
              <p className="truncate font-medium">{request.destination}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Date</p>
              <p className="font-medium">{format(parseISO(request.createdAt), 'MMM d, yyyy')}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground">Reason</p>
              <p className="line-clamp-2 font-medium">{request.reason}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Time</p>
              <p className="font-medium">{format(parseISO(request.createdAt), 'h:mm a')}</p>
            </div>
          </div>

          {showQr && (
            <div className="flex flex-col items-center gap-1.5">
              <div className="rounded-lg bg-white p-1.5">
                <QRCodeSVG value={request.qrToken!} size={104} fgColor="#0f172a" bgColor="#ffffff" />
              </div>
              <p className={`text-[10px] font-bold tracking-wide ${tone.text}`}>SHOW THIS QR AT THE GATE</p>
            </div>
          )}

          <p className="mt-auto text-right text-[11px] italic text-muted-foreground">Click to flip</p>
        </div>

        {/* ── Back ── */}
        <div
          className={`absolute inset-0 flex flex-col gap-3 rounded-2xl border-2 p-4 ${tone.border} ${tone.bg}`}
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <div className="flex flex-col items-center gap-1.5 pt-2">
            <StatusIcon className={`size-8 ${tone.text}`} />
            <p className={`text-lg font-black ${tone.text}`}>{statusLabel}</p>
          </div>

          <div className="mt-2 flex flex-col gap-2.5 text-sm">
            {request.approvedBy && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  {request.status === 'rejected' ? 'Rejected by' : 'Approved by'}
                </p>
                <p className="font-semibold">
                  {request.approvedBy}
                  {request.approverRole ? ` (${APPROVER_LABEL[request.approverRole] ?? request.approverRole})` : ''}
                </p>
              </div>
            )}
            {request.reviewComment && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Comment</p>
                <p className="font-semibold">{request.reviewComment}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Source</p>
              <p className="flex items-center gap-1 font-semibold">
                <MapPin className="size-3.5" /> {SOURCE_LABEL[request.source] ?? request.source}
              </p>
            </div>
            {request.exitedAt && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Gate Exit</p>
                <p className="font-semibold">
                  {request.exitGateName ? `Via ${request.exitGateName}, ` : ''}
                  {format(parseISO(request.exitedAt), 'd MMM, h:mm a')}
                </p>
              </div>
            )}
            {request.status === 'pending' && (
              <p className="text-xs italic text-muted-foreground">Waiting for HOD or HR to review this request.</p>
            )}
          </div>

          <p className="mt-auto text-right text-[11px] italic text-muted-foreground">Click to flip back</p>
        </div>
      </motion.div>
    </div>
  )
}
