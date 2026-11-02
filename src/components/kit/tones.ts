import { statusGroup } from '@/lib/request-views'

// Colour roles. Pages pick a ROLE, never a raw colour:
//   sapphire = action / information     amber  = waiting, alerts, needs attention
//   emerald  = approved, confirmed, live rose   = rejected, error, deduction
//   violet   = special / compensation     slate  = neutral, inactive

export type Tone = 'sapphire' | 'amber' | 'emerald' | 'rose' | 'violet' | 'slate'
export type StatusTone = 'waiting' | 'approved' | 'rejected' | 'info' | 'neutral' | 'live'

/** Soft fill + text + border (AA in both themes). */
export const TONE_SOFT: Record<Tone, string> = {
  sapphire: 'bg-info-bg text-info border-info-border',
  amber: 'bg-waiting-bg text-waiting border-waiting-border',
  emerald: 'bg-approved-bg text-approved border-approved-border',
  rose: 'bg-rejected-bg text-rejected border-rejected-border',
  violet: 'bg-violet-bg text-violet border-violet-border',
  slate: 'bg-neutral-bg text-neutral border-neutral-border',
}

/** Text only (icons, figures). AA on cards in both themes. */
export const TONE_TEXT: Record<Tone, string> = {
  sapphire: 'text-info',
  amber: 'text-waiting',
  emerald: 'text-approved',
  rose: 'text-rejected',
  violet: 'text-violet',
  slate: 'text-neutral',
}

/** A CSS colour for SVG strokes / fills (charts, rings, dials). */
export const TONE_COLOR: Record<Tone, string> = {
  sapphire: 'var(--primary)',
  amber: 'var(--warning)',
  emerald: 'var(--success)',
  rose: 'var(--destructive)',
  violet: 'var(--brand-violet)',
  slate: 'var(--muted-foreground)',
}

/** The glow a hovered card of that tone gets. */
export const TONE_GLOW: Record<Tone, string> = {
  sapphire: 'var(--glow-primary)',
  amber: 'var(--glow-warning)',
  emerald: 'var(--glow-success)',
  rose: 'var(--glow-danger)',
  violet: 'var(--glow-primary)',
  slate: 'var(--glow-primary)',
}

/** The stitched-seam colour per tone (GlassCard variant="stitched"). */
export const TONE_STITCH: Record<Tone | 'silk', string> = {
  sapphire: 'color-mix(in srgb, var(--primary) 55%, transparent)',
  amber: 'color-mix(in srgb, var(--warning) 60%, transparent)',
  emerald: 'color-mix(in srgb, var(--success) 55%, transparent)',
  rose: 'color-mix(in srgb, var(--destructive) 55%, transparent)',
  violet: 'color-mix(in srgb, var(--brand-violet) 60%, transparent)',
  slate: 'color-mix(in srgb, var(--muted-foreground) 45%, transparent)',
  silk: 'color-mix(in srgb, var(--silk-2) 60%, transparent)',
}

export const STATUS_TO_TONE: Record<StatusTone, Tone> = {
  waiting: 'amber',
  approved: 'emerald',
  rejected: 'rose',
  info: 'sapphire',
  neutral: 'slate',
  live: 'emerald',
}

/** A status string in any module's spelling -> the pill tone ("pending_hr" -> waiting, "out" -> approved). */
export function toneForStatus(status: string | null | undefined): StatusTone {
  const g = statusGroup(status)
  return g === 'other' ? 'neutral' : g
}
