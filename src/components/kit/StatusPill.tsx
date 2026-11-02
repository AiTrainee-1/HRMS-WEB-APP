import * as React from 'react'
import { Ban, CheckCircle2, Clock, Info, Radio, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STATUS_TO_TONE, TONE_SOFT, toneForStatus, type StatusTone } from './tones'

const DEFAULT_ICON: Record<StatusTone, LucideIcon | null> = {
  waiting: Clock,
  approved: CheckCircle2,
  rejected: Ban,
  info: Info,
  neutral: null,
  live: Radio,
}

/**
 * A small rounded status label: "Waiting for HR", "Approved", "Rejected", "Live". Colour comes from the tone, never
 * from the words, and every tone passes AA in both themes. Waiting and live pills pulse a little dot (stops under
 * reduced motion). Give it `status` (any module's spelling) OR `tone`. Phones: the app's borderless badge.
 *
 *   <StatusPill tone="waiting">Waiting for HR</StatusPill>
 *   <StatusPill status={leave.status}>{label}</StatusPill>
 */
export function StatusPill({
  tone,
  status,
  children,
  icon,
  dot,
  size = 'md',
  className,
}: {
  tone?: StatusTone
  /** A raw status string; picks the tone when `tone` is not given ("pending_hr" -> waiting). */
  status?: string | null
  children: React.ReactNode
  /** An icon instead of the default one; `false` for none. */
  icon?: LucideIcon | false
  /** Show the pulsing dot instead of an icon (default for waiting and live). */
  dot?: boolean
  size?: 'sm' | 'md'
  className?: string
}) {
  const t: StatusTone = tone ?? toneForStatus(status)
  const showDot = dot ?? (t === 'waiting' || t === 'live')
  const Icon = icon === false || showDot ? null : (icon ?? DEFAULT_ICON[t])
  return (
    <span
      data-tone={t}
      className={cn(
        'font-label inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border font-bold whitespace-nowrap max-md:border-transparent',
        size === 'sm' ? 'px-2 py-px text-[11px] leading-[18px]' : 'px-2.5 py-0.5 text-[12px] leading-5',
        TONE_SOFT[STATUS_TO_TONE[t]],
        className,
      )}
    >
      {showDot && (
        <span className="relative flex size-2 shrink-0" aria-hidden="true">
          <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-50 motion-reduce:hidden" />
          <span className="relative size-2 rounded-full bg-current" />
        </span>
      )}
      {Icon && <Icon className={size === 'sm' ? 'size-3' : 'size-3.5'} aria-hidden="true" />}
      {children}
    </span>
  )
}
