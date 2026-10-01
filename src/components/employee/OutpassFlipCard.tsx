import * as React from 'react'
import { motion } from 'framer-motion'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { QRCodeSVG } from 'qrcode.react'
import { CheckCircle2, XCircle, Clock, RotateCw, MapPin, QrCode, CheckCheck } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ApprovalTrail } from '@/components/employee/ApprovalTrail'
import { outpassApi } from '@/api/resources'
import { ApiError } from '@/api/client'
import { hasTrail, waitingText } from '@/lib/approval'
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
 *
 * Card height is MEASURED, not guessed: each face reports its natural height
 * after layout, and the shared flip box sizes itself to the taller of the
 * two. A fixed height fights variable content (a two-line reason, an
 * optional QR block, an optional gate-exit line) -measuring once removes
 * that whole class of clipping/overflow bug.
 */

const APPROVER_LABEL: Record<string, string> = { hr: 'HR', dept_head: 'HOD', system: 'On-Duty approval' }
const SOURCE_LABEL: Record<string, string> = { manual: 'Manual request', on_duty: 'Auto-generated from On-Duty' }

const MIN_CARD_HEIGHT = 230

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
  const { expired: returnExpired, remainingMs: returnRemainingMs } = useCountdown(request.returnQrExpiresAt)
  const tone = toneFor(request.status)
  const qc = useQueryClient()

  const StatusIcon = request.status === 'approved' ? CheckCircle2 : request.status === 'rejected' ? XCircle : Clock
  const statusLabel = request.status === 'approved' ? 'Approved' : request.status === 'rejected' ? 'Not Approved' : 'Pending Review'
  // qrToken is only ever present while the pass is actually presentable at a
  // gate (approved, unexpired, not yet exited) -see backend/api/
  // outpass_request_views.py::_outpass_request_json.
  const showQr = !!request.qrToken
  // Return leg -mutually exclusive with showQr. returnQrToken only appears
  // once the employee has clicked "Generate Return QR" below and it hasn't
  // expired or been superseded by a newer one yet.
  const showReturnQr = !!request.returnQrToken
  const showGenerateReturnQr = !showReturnQr && !!request.canGenerateReturnQr
  const isReturned = !!request.enteredAt

  const generateReturnQr = useMutation({
    mutationFn: () => outpassApi.generateReturnQr(request.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['outpass-requests'] }),
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not generate the return QR'),
  })

  // Seed with a close estimate so the first paint is already approximately
  // right; the layout effect below then corrects it exactly.
  const [cardHeight, setCardHeight] = React.useState(showQr || showReturnQr ? 400 : showGenerateReturnQr || isReturned ? 330 : 270)
  const frontRef = React.useRef<HTMLDivElement>(null)
  const backRef = React.useRef<HTMLDivElement>(null)

  React.useLayoutEffect(() => {
    const frontH = frontRef.current?.scrollHeight ?? 0
    const backH = backRef.current?.scrollHeight ?? 0
    setCardHeight(Math.max(frontH, backH, MIN_CARD_HEIGHT))
  }, [request, employee])

  return (
    <div
      className="relative w-full cursor-pointer select-none"
      style={{ perspective: 1400, height: cardHeight }}
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
          ref={frontRef}
          className={`absolute inset-x-0 top-0 flex flex-col gap-4 rounded-2xl border-2 p-4 ${tone.border} ${tone.bg}`}
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className={`flex min-w-0 items-center gap-1.5 text-sm font-bold ${tone.text}`}>
              <StatusIcon className="size-4 shrink-0" />
              <span className="truncate">{statusLabel}</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {request.status === 'approved' && (
                <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${tone.chipBg} ${tone.text}`}>
                  <Clock className="size-3" /> {expired || remainingMs == null ? 'Expired' : formatRemaining(remainingMs)}
                </span>
              )}
              <RotateCw className="size-3.5 text-muted-foreground/60" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Avatar className="size-14 shrink-0 border-2 border-white shadow-clay dark:border-white/10">
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
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Going to</p>
              <p className="truncate font-medium">{request.destination}</p>
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Date</p>
              <p className="font-medium">{format(parseISO(request.createdAt), 'MMM d, yyyy')}</p>
            </div>
            <div className="col-span-2 min-w-0">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Reason</p>
              <p className="line-clamp-2 font-medium">{request.reason}</p>
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Time</p>
              <p className="font-medium">{format(parseISO(request.createdAt), 'h:mm a')}</p>
            </div>
          </div>

          {showQr && (
            <div className="flex flex-col items-center gap-2">
              <div className={`rounded-lg border bg-white p-2.5 ${tone.border}`}>
                <QRCodeSVG value={request.qrToken!} size={110} fgColor="#0f172a" bgColor="#ffffff" />
              </div>
              <p className={`text-[10px] font-bold tracking-wider ${tone.text}`}>SHOW THIS QR AT THE GATE</p>
            </div>
          )}

          {showReturnQr && (
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-lg border border-sky-300 bg-white p-2.5">
                <QRCodeSVG value={request.returnQrToken!} size={110} fgColor="#0f172a" bgColor="#ffffff" />
              </div>
              <p className="text-[10px] font-bold tracking-wider text-sky-600">SHOW THIS QR TO RETURN</p>
              {!returnExpired && returnRemainingMs != null && (
                <p className="text-[10px] tabular-nums text-muted-foreground">Valid for {formatRemaining(returnRemainingMs)}</p>
              )}
            </div>
          )}

          {showGenerateReturnQr && (
            <Button
              variant="outline"
              size="sm"
              className={`gap-1.5 border-dashed ${tone.border} ${tone.text}`}
              disabled={generateReturnQr.isPending}
              onClick={(e) => { e.stopPropagation(); generateReturnQr.mutate() }}
            >
              <QrCode className="size-3.5" /> {generateReturnQr.isPending ? 'Generating…' : 'Generate Return QR'}
            </Button>
          )}

          {isReturned && (
            <div className="flex items-center justify-center gap-1.5 rounded-lg bg-success/10 py-2 text-xs font-bold text-success">
              <CheckCheck className="size-3.5" /> Returned {format(parseISO(request.enteredAt!), 'h:mm a')}
            </div>
          )}

          <p className="self-end text-[11px] italic text-muted-foreground">Click to flip</p>
        </div>

        {/* ── Back ── */}
        <div
          ref={backRef}
          className={`absolute inset-x-0 top-0 flex flex-col gap-4 rounded-2xl border-2 p-4 ${tone.border} ${tone.bg}`}
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <div className="flex flex-col items-center gap-1.5 pt-1">
            <StatusIcon className={`size-8 ${tone.text}`} />
            <p className={`text-lg font-black ${tone.text}`}>{statusLabel}</p>
          </div>

          <div className="flex flex-col gap-3 text-sm">
            {request.approvedBy && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
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
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Comment</p>
                <p className="font-semibold">{request.reviewComment}</p>
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Source</p>
              <p className="flex items-center gap-1 font-semibold">
                <MapPin className="size-3.5" /> {SOURCE_LABEL[request.source] ?? request.source}
              </p>
            </div>
            {request.exitedAt && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Gate Exit</p>
                <p className="font-semibold">
                  {request.exitGateName ? `Via ${request.exitGateName}, ` : ''}
                  {format(parseISO(request.exitedAt), 'd MMM, h:mm a')}
                </p>
              </div>
            )}
            {request.enteredAt && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Gate Return</p>
                <p className="font-semibold">
                  {request.entryGateName ? `Via ${request.entryGateName}, ` : ''}
                  {format(parseISO(request.enteredAt), 'd MMM, h:mm a')}
                </p>
              </div>
            )}
            {hasTrail(request.approval) && request.approval.steps.length > 1 && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Approval steps</p>
                <ApprovalTrail approval={request.approval} className="mt-1" />
              </div>
            )}
            {request.status === 'pending' && (
              <p className="text-xs italic text-muted-foreground">
                {/* Older backend: no pipeline in the response, so the old fixed wording. */}
                {waitingText(request.approval) ?? 'Waiting for HOD or HR to review this request.'}
              </p>
            )}
          </div>

          <p className="self-end text-[11px] italic text-muted-foreground">Click to flip back</p>
        </div>
      </motion.div>
    </div>
  )
}
