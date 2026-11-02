import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'
import { TONE_STITCH, type Tone } from './tones'

const PADDING = { none: '', sm: 'p-3', md: 'p-4 sm:p-5', lg: 'p-5 sm:p-6' } as const

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * plain       glass work surface (most cards)
   * raised      a level up: sapphire hairline on top + deeper shadow (dialog-like panels, the one key card)
   * interactive the whole card is a link / button: spring lift + glow that follows the pointer (pointer devices only)
   * stitched    highlighted: a dashed "sewn" seam inside the edge. One per view.
   */
  variant?: 'plain' | 'raised' | 'interactive' | 'stitched'
  /** Seam colour for `stitched` (default sapphire; 'silk' = violet seam). */
  tone?: Tone | 'silk'
  padding?: keyof typeof PADDING
  /** Render the child element instead (a wouter <Link>, a <button>) with the card's look: <GlassCard asChild><Link/></GlassCard>. */
  asChild?: boolean
  /** Also lift on hover for a non-interactive variant (e.g. a stitched card that is a link). */
  hover?: boolean
}

/**
 * The surface every page is built from. Glass in both themes, rounded-xl, hairline border.
 * Phones (< 768px): the mobile app's flat card - solid bgCard, 16px radius, hairline border, soft shadow, no frosting (the
 * phone tokens + index.css do it); `stitched` becomes a coloured left accent border; interactive cards dim a little
 * while pressed, like the app's TouchableOpacity (kit/MOBILE.md).
 *
 *   <GlassCard>...</GlassCard>
 *   <GlassCard variant="interactive" asChild><Link href="/employee/leave">...</Link></GlassCard>
 *   <GlassCard variant="stitched" tone="amber">The next step</GlassCard>
 */
export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(function GlassCard(
  { variant = 'plain', tone = 'sapphire', padding = 'md', asChild, hover, className, style, onPointerMove, ...props },
  ref,
) {
  const Comp = asChild ? Slot : 'div'
  const interactive = variant === 'interactive' || hover

  // The pointer-follow glow: write CSS variables straight to the element (no React re-render per move).
  const handleMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      onPointerMove?.(e)
      if (!interactive || e.pointerType !== 'mouse') return
      const el = e.currentTarget
      const r = el.getBoundingClientRect()
      el.style.setProperty('--mx', `${e.clientX - r.left}px`)
      el.style.setProperty('--my', `${e.clientY - r.top}px`)
    },
    [interactive, onPointerMove],
  )

  return (
    <Comp
      ref={ref}
      data-slot="glass-card"
      data-variant={variant}
      className={cn(
        'text-card-foreground block rounded-xl',
        variant === 'raised' ? 'glass-raised' : 'glass shadow-clay-sm',
        variant === 'stitched' && 'stitched',
        interactive && 'lift glow-follow focus-ring cursor-pointer max-md:active:opacity-85',
        PADDING[padding],
        className,
      )}
      style={variant === 'stitched' ? ({ '--stitch': TONE_STITCH[tone], ...style } as React.CSSProperties) : style}
      onPointerMove={interactive ? handleMove : onPointerMove}
      {...props}
    />
  )
})
