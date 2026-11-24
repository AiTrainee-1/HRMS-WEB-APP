import * as React from 'react'
import { motion } from 'framer-motion'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { toPng } from 'html-to-image'
import { format, isValid, parseISO } from 'date-fns'
import { QRCodeSVG } from 'qrcode.react'
import {
  BadgeCheck, BellRing, Briefcase, CalendarClock, Clock, Download, FileText, Footprints, Hourglass, Loader2, LogIn, LogOut,
  MapPin, OctagonX, QrCode, RefreshCw, ShieldCheck, TimerReset, type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useReducedMotion } from '@/components/kit'
import { UKTLogo } from '@/components/auth/UKTLogo'
import { outpassApi } from '@/api/resources'
import { ApiError } from '@/api/client'
import type { GatePass, GatePassPerson } from '@/api/onduty-actions'
import { waitingText } from '@/lib/approval'
import { gatePassApprovalText, gatePassFileName, gatePassPurpose, gatePassView, isOnDutyPass, type GatePassTone } from '@/lib/gate-pass'
import { cn } from '@/lib/utils'

/**
 * The gate pass as a standard, static card (owner 2026-11-24: no flip; every detail one after another; the QR on the card;
 * downloadable as a picture). The same card on the Outpass page and on the On-Duty page. Mirrors the mobile app's
 * components/outpass/GatePassCard.tsx.
 *
 * The card itself (what "Download" captures) uses fixed paper-like colours in both themes, the way a printed pass looks
 * the same everywhere; the buttons under it follow the theme. What the card says comes from lib/gate-pass.ts: a pass
 * waiting for approval never shows a QR, even if one was sent.
 */

const INK = '#0F172A'
const MUTED = '#64748B'
const PAPER = '#FFFFFF'
const BAND = '#1E3A8A'

const TONE: Record<GatePassTone, { fg: string; bg: string; icon: LucideIcon }> = {
  green: { fg: '#047857', bg: '#D1FAE5', icon: BadgeCheck },
  amber: { fg: '#B45309', bg: '#FEF3C7', icon: Clock },
  blue: { fg: '#1D4ED8', bg: '#DBEAFE', icon: Footprints },
  red: { fg: '#B91C1C', bg: '#FEE2E2', icon: OctagonX },
  grey: { fg: '#475569', bg: '#F1F5F9', icon: TimerReset },
}

function when(iso: string | null | undefined, pattern = 'd MMM yyyy, h:mm a'): string | null {
  if (!iso) return null
  const d = parseISO(iso)
  return isValid(d) ? format(d, pattern) : null
}

/**
 * The bell of a pass that waits for approval: it rings now and then, and a soft ring pulses out of it - "still pending" at
 * a glance. Still when the device asks for reduced motion.
 */
export function PendingBell({ size = 20 }: { size?: number }) {
  const reduced = useReducedMotion()
  const box = size + 16
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: box, height: box }} aria-hidden="true">
      {!reduced && (
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ backgroundColor: 'rgba(245,158,11,0.35)' }}
          initial={{ scale: 1, opacity: 0.8 }}
          animate={{ scale: [1, 1.9], opacity: [0.8, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
      <motion.span
        className="relative grid place-items-center"
        style={{ color: '#B45309', transformOrigin: '50% 10%' }}
        animate={reduced ? undefined : { rotate: [0, -14, 14, -10, 8, 0, 0] }}
        transition={reduced ? undefined : { duration: 2, times: [0, 0.045, 0.105, 0.16, 0.21, 0.255, 1], repeat: Infinity }}
      >
        <BellRing style={{ width: size, height: size }} />
      </motion.span>
    </span>
  )
}

function Row({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2.5 border-t py-2 first:border-t-0" style={{ borderColor: '#E2E8F0' }}>
      <Icon className="mt-0.5 size-4 shrink-0" style={{ color: MUTED }} aria-hidden="true" />
      <dt className="w-[104px] shrink-0 text-[12px] font-semibold" style={{ color: MUTED }}>
        {label}
      </dt>
      <dd className="min-w-0 flex-1 text-[13px] font-semibold break-words" style={{ color: INK }}>
        {value}
      </dd>
    </div>
  )
}

export function GatePassCard({
  pass,
  person,
  compact = false,
  showActions = true,
  onRefresh,
  refreshing,
  className,
}: {
  pass: GatePass
  /** The employee (the pass may carry one from the server too; this wins when given). */
  person?: GatePassPerson | null
  /** Smaller QR and fewer rows (inside the On-Duty page). */
  compact?: boolean
  showActions?: boolean
  /** "Refresh" on a pass waiting for approval: look for the decision now. */
  onRefresh?: () => unknown
  refreshing?: boolean
  className?: string
}) {
  const view = gatePassView(pass)
  const tone = TONE[view.tone]
  const StatusIcon = tone.icon
  const who: GatePassPerson = { ...(pass.employee ?? {}), ...(person ?? {}) }
  const onDuty = isOnDutyPass(pass)
  const cardRef = React.useRef<HTMLDivElement>(null)
  const [saving, setSaving] = React.useState(false)
  const qc = useQueryClient()

  const generateReturn = useMutation({
    mutationFn: () => outpassApi.generateReturnQr(String(pass.id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['outpass-requests'] })
      qc.invalidateQueries({ queryKey: ['on-duty-status'] })
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not make the return QR. Please try again.'),
  })

  const download = async () => {
    const el = cardRef.current
    if (!el) return
    setSaving(true)
    const save = (dataUrl: string) => {
      const link = document.createElement('a')
      link.download = gatePassFileName(pass)
      link.href = dataUrl
      link.click()
    }
    try {
      save(await toPng(el, { pixelRatio: 3, cacheBust: true, backgroundColor: PAPER }))
    } catch {
      // The photo may come from another site that does not allow it to be drawn: try once more without it.
      try {
        save(await toPng(el, { pixelRatio: 3, backgroundColor: PAPER, filter: (node) => !(node instanceof HTMLImageElement) }))
      } catch {
        toast.error('Could not make the picture. Please try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  const purpose = gatePassPurpose(pass)
  const validUntil = view.qr?.kind === 'exit' ? when(pass.expiresAt, onDuty ? 'h:mm a, d MMM' : 'h:mm a') : null
  const approval = gatePassApprovalText(pass, when(pass.approvedAt), waitingText(pass.approval) ?? null)
  const qrSize = compact ? 132 : 168
  const initials = (who.name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')

  return (
    <div className={cn('flex w-full flex-col gap-2.5', className)}>
      <div
        ref={cardRef}
        role="group"
        aria-label={`Gate pass OUT-${pass.id}. ${view.title}. ${view.note}`}
        className="overflow-hidden rounded-2xl border shadow-[0_8px_24px_-12px_rgba(15,23,42,0.35)]"
        style={{ backgroundColor: PAPER, color: INK, borderColor: '#CBD5E1' }}
      >
        {/* header band */}
        <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: BAND, color: '#FFFFFF' }}>
          <span className="grid shrink-0 place-items-center rounded-lg bg-white/95 px-1.5 py-1">
            <UKTLogo size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-bold tracking-[0.14em] text-white/80">UK TEXTILES</p>
            <p className="font-display text-[17px] leading-tight font-extrabold tracking-[0.06em]">GATE PASS</p>
          </div>
          <div className="text-right">
            <p className="text-[9.5px] font-bold tracking-[0.12em] text-white/70">PASS NO.</p>
            <p className="font-label text-[14px] font-bold tabular-nums">OUT-{pass.id}</p>
          </div>
        </div>

        {view.awaitingApproval && (
          <div className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-center text-[10.5px] font-extrabold tracking-[0.06em]" style={{ backgroundColor: '#FDE68A', color: '#92400E' }}>
            <Hourglass className="size-3.5 shrink-0" aria-hidden="true" />
            PENDING APPROVAL · NOT VALID AT THE GATE YET
          </div>
        )}

        {/* status */}
        <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ backgroundColor: tone.bg }}>
          {view.awaitingApproval ? <PendingBell size={20} /> : <StatusIcon className="size-5 shrink-0" style={{ color: tone.fg }} aria-hidden="true" />}
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-extrabold" style={{ color: tone.fg }}>
              {view.title}
            </p>
            <p className="text-[12px] leading-[17px]" style={{ color: '#334155' }}>
              {view.note}
            </p>
          </div>
        </div>

        {/* employee */}
        <div className="mx-4 mt-3 flex items-center gap-3">
          <span
            className={cn('grid shrink-0 place-items-center overflow-hidden rounded-full border-2 text-[15px] font-bold', compact ? 'size-11' : 'size-[54px]')}
            style={{ borderColor: '#E2E8F0', backgroundColor: '#EEF2FF', color: BAND }}
          >
            {who.photoUrl ? <img src={who.photoUrl} alt="" className="size-full object-cover" /> : initials || '?'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15.5px] font-extrabold">{who.name ?? 'Employee'}</p>
            {who.employeeCode && (
              <p className="text-[12px] font-semibold" style={{ color: MUTED }}>
                Emp. Code {who.employeeCode}
              </p>
            )}
            {(who.designation || who.department) && (
              <p className="truncate text-[12px]" style={{ color: MUTED }}>
                {[who.designation, who.department].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>

        {/* details, one after another */}
        <dl className="mx-4 mt-2">
          <Row icon={Briefcase} label="Purpose" value={purpose} />
          <Row icon={MapPin} label="Going to" value={pass.destination} />
          {!compact && pass.reason && pass.reason !== pass.destination && <Row icon={FileText} label="Reason" value={pass.reason} />}
          <Row icon={CalendarClock} label="Issued" value={when(pass.createdAt)} />
          <Row icon={Hourglass} label="Valid until" value={validUntil} />
          {!compact && <Row icon={Clock} label="Expected back" value={when(pass.expectedReturnAt, 'h:mm a')} />}
          <Row icon={ShieldCheck} label="Approval" value={approval} />
          <Row icon={LogOut} label="Gate exit" value={pass.exitedAt ? `${when(pass.exitedAt)}${pass.exitGateName ? ` · ${pass.exitGateName}` : ''}` : null} />
          <Row icon={LogIn} label="Gate return" value={pass.enteredAt ? `${when(pass.enteredAt)}${pass.entryGateName ? ` · ${pass.entryGateName}` : ''}` : null} />
        </dl>

        {/* QR: only on an approved pass that may be shown at the gate now */}
        {view.qr ? (
          <div className="flex flex-col items-center gap-2 px-4 pt-2 pb-3">
            <div className="rounded-xl border-2 p-2.5" style={{ borderColor: tone.fg, backgroundColor: PAPER }}>
              <QRCodeSVG value={view.qr.value} size={qrSize} fgColor={INK} bgColor={PAPER} title={view.qr.kind === 'exit' ? 'Exit QR code' : 'Return QR code'} />
            </div>
            <p className="text-[11px] font-extrabold tracking-[0.08em]" style={{ color: tone.fg }}>
              {view.qr.caption}
            </p>
          </div>
        ) : view.awaitingApproval ? (
          <div className="flex flex-col items-center gap-2 px-4 pt-2 pb-3">
            <div
              className="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-3 text-center"
              style={{ width: qrSize + 20, minHeight: qrSize + 20, borderColor: '#F59E0B', backgroundColor: '#FFFBEB' }}
              role="img"
              aria-label="QR code: available after approval"
            >
              <PendingBell size={26} />
              <p className="text-[13px] font-extrabold" style={{ color: '#B45309' }}>
                QR after approval
              </p>
              <p className="text-[11px] leading-[15px]" style={{ color: '#78716C' }}>
                The QR appears here once {onDuty ? 'your On-Duty' : 'this pass'} is approved.
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-4 my-3 flex items-center gap-2 rounded-lg px-3 py-2 text-[12px]" style={{ backgroundColor: '#F1F5F9', color: MUTED }}>
            <QrCode className="size-4 shrink-0" aria-hidden="true" /> No QR: this pass cannot be scanned now.
          </div>
        )}

        <p className="border-t px-4 py-2.5 text-center text-[10.5px] leading-[15px]" style={{ borderColor: '#E2E8F0', color: MUTED, backgroundColor: '#F8FAFC' }}>
          Show this pass to security at the gate. Valid only for the person named above.
        </p>
      </div>

      {showActions && (
        <div className="flex flex-wrap gap-2">
          {view.awaitingApproval && onRefresh && (
            <Button variant="outline" onClick={() => onRefresh()} disabled={refreshing} className="min-h-11 flex-1 sm:min-h-9">
              <RefreshCw className={cn(refreshing && 'animate-spin')} aria-hidden="true" /> {refreshing ? 'Checking…' : 'Refresh'}
            </Button>
          )}
          {pass.canGenerateReturnQr && !pass.returnQrToken && (
            <Button onClick={() => generateReturn.mutate()} disabled={generateReturn.isPending} className="min-h-11 flex-1 sm:min-h-9">
              {generateReturn.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <QrCode aria-hidden="true" />} Return QR
            </Button>
          )}
          <Button variant="outline" onClick={download} disabled={saving} className="min-h-11 flex-1 sm:min-h-9" aria-label="Download the gate pass as a picture">
            {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />} {saving ? 'Saving…' : 'Download'}
          </Button>
        </div>
      )}
    </div>
  )
}
