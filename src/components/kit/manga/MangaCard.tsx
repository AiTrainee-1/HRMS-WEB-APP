import * as React from 'react'
import { motion } from 'framer-motion'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Loader2, X } from 'lucide-react'
import { useReducedMotion } from '@/components/kit/useReducedMotion'
import { cn } from '@/lib/utils'
import { MangaMascot, type MascotMood, type MascotProp } from './MangaMascot'
import './manga.css'

/*
 * The manga card kit (owner 2026-11-25: "the owner loves this style" - the mobile app's UpdatePrompt). A 2D anime /
 * manga panel: thick ink border with an offset "hard shadow" in the brand colour, a top panel with halftone dots and
 * slowly turning speed lines, an original chibi mascot (MangaMascot) and a speech bubble, then the words and big ink
 * buttons. It pops in with a bounce, the mascot hops in, waves and blinks, sparkles twinkle; under reduced motion it
 * simply fades in and stays still. Light and dark: ink is the theme's foreground, paper a tint of the primary colour.
 *
 * Pieces: <MangaCard> (the card itself, place it anywhere), <MangaDialog> (a modal holding one), <MangaButton>.
 */

// ── the panel's background ──────────────────────────────────────────────────

/** Halftone dots over the panel's tint, cleared around the mascot by a soft glow. */
function Halftone({ id, focusX }: { id: string; focusX: string }) {
  return (
    <svg aria-hidden="true" className="absolute inset-0 size-full" preserveAspectRatio="none">
      <defs>
        <pattern id={`${id}-dots`} x={0} y={0} width={9} height={9} patternUnits="userSpaceOnUse">
          <circle cx={4.5} cy={4.5} r={1.5} fill="var(--primary)" />
        </pattern>
        <radialGradient id={`${id}-clear`} cx={focusX} cy="62%" r="45%">
          <stop offset="0" stopColor="var(--manga-paper)" stopOpacity={1} />
          <stop offset="0.7" stopColor="var(--manga-paper)" stopOpacity={0.85} />
          <stop offset="1" stopColor="var(--manga-paper)" stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="var(--manga-paper)" />
      <rect width="100%" height="100%" fill={`url(#${id}-dots)`} opacity={0.22} />
      <rect width="100%" height="100%" fill={`url(#${id}-clear)`} />
    </svg>
  )
}

/** Manga "focus lines": thin wedges pointing at the mascot. A fixed pseudo-random pattern, computed once. */
const FOCUS_LINES = (() => {
  const size = 560
  const c = size / 2
  let seed = 7
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
  const parts: string[] = []
  const count = 46
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2 + rand() * 0.08
    const inner = 78 + rand() * 40
    const w = 0.012 + rand() * 0.02
    const p = (r: number, ang: number) => `${(c + Math.cos(ang) * r).toFixed(1)} ${(c + Math.sin(ang) * r).toFixed(1)}`
    parts.push(`M${p(inner, a)} L${p(c, a - w)} L${p(c, a + w)} Z`)
  }
  return parts.join(' ')
})()

const SPARKLE = 'M8 0 L9.8 6.2 L16 8 L9.8 9.8 L8 16 L6.2 9.8 L0 8 L6.2 6.2 Z'
const SPARKLE_SPOTS = [
  { left: '5%', top: 22, size: 16, delay: 0, accent: false },
  { left: '46%', top: 92, size: 12, delay: 0.72, accent: true },
  { left: '40%', top: 30, size: 10, delay: 1.32, accent: false },
  { left: '84%', top: 128, size: 14, delay: 1.8, accent: true },
]

// ── the card ────────────────────────────────────────────────────────────────

export interface MangaCardProps {
  /** The words in the speech bubble ("A new version is here!"). */
  bubble: React.ReactNode
  mood?: MascotMood
  holding?: MascotProp
  /** A rubber stamp over the panel's corner ("MUST UPDATE", "LOCATION OFF"). */
  stamp?: string
  /** The panel's height in px (default 178; the compact cards use less). */
  panelHeight?: number
  /** The mascot's width in px (default 104). */
  mascotWidth?: number
  /** A close (X) button on the panel. */
  onClose?: () => void
  closeLabel?: string
  /** Pop in with a bounce (default); false for a card that is already on screen and only changes. */
  animateIn?: boolean
  className?: string
  children: React.ReactNode
}

export function MangaCard({
  bubble,
  mood = 'happy',
  holding = null,
  stamp,
  panelHeight = 178,
  mascotWidth = 104,
  onClose,
  closeLabel = 'Close',
  animateIn = true,
  className,
  children,
}: MangaCardProps) {
  const reduced = useReducedMotion()
  const id = React.useId().replace(/:/g, '')
  const still = reduced
  const pop = animateIn && !reduced
  const mascotLeft = 22
  // the speed lines are centred on the mascot's face
  const faceX = mascotLeft + (mascotWidth * 60) / 120
  const faceY = panelHeight - (mascotWidth * 150) / 120 + (mascotWidth * 58) / 120 + 6

  return (
    <motion.div
      initial={pop ? { opacity: 0, scale: 0.55, rotate: -7 } : animateIn ? { opacity: 0 } : false}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={pop ? { type: 'spring', damping: 11, stiffness: 190, mass: 0.8, opacity: { duration: 0.16 } } : { duration: 0.22 }}
      className={cn('manga-ink relative w-full', className)}
    >
      <div className="manga-shadow relative overflow-hidden rounded-[20px] border-[3px] border-[var(--manga-ink)] bg-card text-card-foreground">
        {/* ── panel 1: the mascot ── */}
        <div className="relative overflow-hidden border-b-[3px] border-[var(--manga-ink)]" style={{ height: panelHeight }}>
          <Halftone id={id} focusX="28%" />
          <svg
            aria-hidden="true"
            width={560}
            height={560}
            className={cn('pointer-events-none absolute', !still && 'manga-lines')}
            style={{ left: faceX - 280, top: faceY - 280 }}
          >
            <path d={FOCUS_LINES} fill="var(--manga-ink)" opacity={0.09} />
          </svg>
          {!still &&
            SPARKLE_SPOTS.map((s, i) => (
              <svg
                key={i}
                aria-hidden="true"
                width={s.size}
                height={s.size}
                viewBox="0 0 16 16"
                className="pointer-events-none absolute"
                style={{ left: s.left, top: Math.min(s.top, panelHeight - s.size - 6) }}
              >
                <path className="manga-sparkle" style={{ animationDelay: `${s.delay}s` }} d={SPARKLE} fill={s.accent ? 'var(--primary)' : 'var(--silk-3)'} />
              </svg>
            ))}

          <motion.div
            className="absolute"
            style={{ left: mascotLeft, bottom: -6 }}
            initial={pop ? { y: 70, scale: 0.7 } : false}
            animate={{ y: 0, scale: 1 }}
            transition={{ type: 'spring', damping: 8, stiffness: 150, delay: 0.22 }}
          >
            <div className={cn(!still && 'manga-bob')}>
              <MangaMascot mood={mood} holding={holding} still={still} width={mascotWidth} label="" />
            </div>
          </motion.div>

          <motion.div
            className="absolute top-4 right-3.5 max-w-[min(190px,52%)] rounded-[18px] border-[2.5px] border-[var(--manga-ink)] bg-card px-3 py-2"
            style={{ transformOrigin: '12% 100%' }}
            initial={pop ? { opacity: 0, scale: 0, rotate: 12 } : false}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ type: 'spring', damping: 7, stiffness: 190, delay: pop ? 0.48 : 0 }}
          >
            <p className="font-label text-[14px] leading-[19px] font-extrabold text-[var(--manga-ink)]">{bubble}</p>
            <svg aria-hidden="true" width={24} height={16} className="absolute -bottom-[14.5px] left-3.5">
              <path d="M3 0 L23 0 L5 15 Z" fill="var(--card)" />
              <path d="M3 1 L5 15 L23 1" stroke="var(--manga-ink)" strokeWidth={2.5} fill="none" strokeLinejoin="round" />
            </svg>
          </motion.div>

          {stamp && (
            <span className="font-label absolute right-3.5 bottom-3.5 -rotate-[8deg] rounded-md border-[2.5px] border-destructive bg-card px-2 py-0.5 text-[11px] font-extrabold tracking-[0.12em] text-destructive">
              {stamp}
            </span>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="focus-ring absolute top-2 left-2 grid size-9 place-items-center rounded-full border-2 border-[var(--manga-ink)] bg-card text-[var(--manga-ink)] transition-transform hover:scale-105"
            >
              <X className="size-4" strokeWidth={3} />
            </button>
          )}
        </div>

        {/* ── panel 2: the words ── */}
        <div className="p-[18px] pt-4">{children}</div>
      </div>
    </motion.div>
  )
}

/** The card's big title, slanted like a manga caption. */
export function MangaTitle({ children, className, as: Tag = 'h2' }: { children: React.ReactNode; className?: string; as?: 'h2' | 'h3' | 'p' }) {
  return <Tag className={cn('manga-title font-label text-[24px] leading-tight font-extrabold text-[var(--manga-ink)]', className)}>{children}</Tag>
}

/** A chunky ink-outlined button with an offset shadow that presses in. */
export const MangaButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'plain'; busy?: boolean; icon?: React.ReactNode }
>(function MangaButton({ tone = 'primary', busy = false, icon, className, children, disabled, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cn(
        'manga-btn focus-ring font-label inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-[2.5px] border-[var(--manga-ink)] px-5 text-[15px] font-extrabold tracking-[0.01em] disabled:opacity-70',
        tone === 'primary' ? 'bg-primary text-primary-foreground' : 'bg-card text-[var(--manga-ink)]',
        className,
      )}
      {...props}
    >
      {busy ? <Loader2 className="size-[18px] animate-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  )
})

/**
 * A modal holding one manga card: a dimmed backdrop, focus kept inside, Esc / the X close it (unless `dismissible` is
 * false). `title` and `description` name it for screen readers (draw them inside the card too).
 */
export function MangaDialog({
  open,
  onOpenChange,
  title,
  description,
  dismissible = true,
  children,
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  dismissible?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => (o || dismissible ? onOpenChange(o) : undefined)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="ui-fade fixed inset-0 z-[90] bg-[rgb(15_23_42/0.66)]" />
        <DialogPrimitive.Content
          {...(description ? {} : { 'aria-describedby': undefined })}
          onOpenAutoFocus={(e) => {
            // the card's main action takes the focus (mark it data-autofocus), not the X in its corner
            const main = (e.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>('[data-autofocus]')
            if (main) {
              e.preventDefault()
              main.focus({ preventScroll: true })
            }
          }}
          onEscapeKeyDown={(e) => {
            if (!dismissible) e.preventDefault()
          }}
          onPointerDownOutside={(e) => {
            if (!dismissible) e.preventDefault()
          }}
          // the content fills the screen (to centre the card): a click on the dimmed space around the card closes it
          onClick={(e) => {
            if (dismissible && e.target === e.currentTarget) onOpenChange(false)
          }}
          className={cn(
            'fixed inset-0 z-[91] grid place-items-center overflow-y-auto p-[22px] pr-[29px] pb-[29px] outline-none',
            className,
          )}
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          {description ? <DialogPrimitive.Description className="sr-only">{description}</DialogPrimitive.Description> : null}
          <div className="w-full max-w-[380px]">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
