import * as React from 'react'
import { cn } from '@/lib/utils'
import { isLowPowerDevice, useReducedMotion } from './useReducedMotion'

/**
 * The LOOM signature: a quiet warp-and-weft thread field. Thin vertical (warp) and horizontal (weft) threads that
 * undulate slowly, every few threads a silk-tinted one, a "shuttle" of light that glides along one weft thread now and
 * then, and — on pointer devices — the threads near the cursor gently brighten.
 *
 * Cheap on purpose: ONE canvas, four stroke calls a frame, ~30 fps, devicePixelRatio capped at 1.5, paused when the tab
 * is hidden or the canvas is scrolled out of view, and a single still frame under reduced motion / on low-power
 * devices. The app shell already renders one behind the top of every page — pages must NOT add another (KIT.md).
 *
 * Fills its positioned parent (`absolute inset-0` by default); size and fade it with className / `fade`.
 */
export function WeaveBackground({
  className,
  spacing = 30,
  fade = 'bottom',
  interactive = true,
}: {
  className?: string
  /** Distance between threads in CSS px (default 30). */
  spacing?: number
  /** How the field fades out: towards the bottom (page top), from the centre outwards, or not at all. */
  fade?: 'bottom' | 'radial' | 'none'
  /** Brighten near the cursor (pointer devices only). */
  interactive?: boolean
}) {
  const ref = React.useRef<HTMLCanvasElement>(null)
  const reduced = useReducedMotion()

  React.useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const animate = !reduced && !isLowPowerDevice()
    const hoverCapable = interactive && animate && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)

    let w = 0
    let h = 0
    let raf = 0
    let last = 0
    let inView = true
    let colors = readColors()
    // Pointer in viewport coords, and the smoothed glow centre in canvas coords.
    const pointer = { x: 0, y: 0, active: false }
    const glow = { x: -9999, y: -9999, strength: 0 }

    function readColors() {
      const s = getComputedStyle(document.documentElement)
      const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback
      return {
        warp: v('--weave-warp', 'rgba(148,170,214,0.075)'),
        weft: v('--weave-weft', 'rgba(148,170,214,0.06)'),
        glow: v('--weave-glow', 'rgba(147,180,255,0.5)'),
        shuttle: v('--weave-shuttle', 'rgba(196,181,253,0.6)'),
        silk1: v('--silk-1', '#5b8bff'),
        silk2: v('--silk-2', '#a78bfa'),
        silk3: v('--silk-3', '#fbbf24'),
        accent: Number.parseFloat(v('--weave-accent', '0.5')) || 0.5,
      }
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      w = Math.max(1, rect.width)
      h = Math.max(1, rect.height)
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      draw(last)
    }

    // One thread as a gentle wave. Vertical (warp) threads sway in x, horizontal (weft) threads in y.
    const SEG = 26
    const AMP = 2.4
    function warpPath(t: number, onlyAccent: boolean): Path2D {
      const p = new Path2D()
      const count = Math.ceil(w / spacing) + 2
      for (let i = -1; i < count; i++) {
        if (onlyAccent !== (i % 6 === 2)) continue
        const x0 = i * spacing + spacing / 2
        const phase = i * 0.7 + t * 0.00028
        p.moveTo(x0 + Math.sin(phase) * AMP, 0)
        for (let y = SEG; y <= h + SEG; y += SEG) p.lineTo(x0 + Math.sin(y * 0.013 + phase) * AMP, y)
      }
      return p
    }
    function weftPath(t: number, onlyAccent: boolean): Path2D {
      const p = new Path2D()
      const count = Math.ceil(h / spacing) + 2
      // The weft slides very slowly sideways, like cloth moving through the loom.
      const slide = (t * 0.003) % SEG
      for (let j = -1; j < count; j++) {
        if (onlyAccent !== (j % 5 === 1)) continue
        const y0 = j * spacing + spacing / 2
        const phase = j * 0.9 + t * 0.00022
        p.moveTo(-SEG, y0 + Math.cos(phase) * AMP)
        for (let x = -SEG + slide; x <= w + SEG; x += SEG) p.lineTo(x, y0 + Math.cos(x * 0.011 + phase) * AMP)
      }
      return p
    }

    function draw(t: number) {
      ctx!.clearRect(0, 0, w, h)
      ctx!.lineWidth = 1
      const warp = warpPath(t, false)
      const weft = weftPath(t, false)
      ctx!.strokeStyle = colors.warp
      ctx!.stroke(warp)
      ctx!.strokeStyle = colors.weft
      ctx!.stroke(weft)

      // Silk-tinted accent threads: one stroke each, a horizontal silk gradient across the field.
      const silk = ctx!.createLinearGradient(0, 0, w, 0)
      silk.addColorStop(0, colors.silk1)
      silk.addColorStop(0.55, colors.silk2)
      silk.addColorStop(1, colors.silk3)
      ctx!.globalAlpha = 0.16 * colors.accent
      ctx!.strokeStyle = silk
      ctx!.stroke(warpPath(t, true))
      ctx!.stroke(weftPath(t, true))
      ctx!.globalAlpha = 1

      // The shuttle: a short bright run gliding along one weft thread, a new thread every pass.
      if (animate) {
        const PASS = 9000
        const rows = Math.max(1, Math.floor(h / spacing))
        const row = Math.floor(t / PASS) % rows
        const p = (t % PASS) / PASS
        const y = row * spacing + spacing / 2
        const x = p * (w + 320) - 160
        const g = ctx!.createLinearGradient(x - 160, 0, x, 0)
        g.addColorStop(0, 'rgba(0,0,0,0)')
        g.addColorStop(1, colors.shuttle)
        ctx!.strokeStyle = g
        ctx!.lineWidth = 1.4
        ctx!.beginPath()
        ctx!.moveTo(x - 160, y)
        ctx!.lineTo(x, y)
        ctx!.stroke()
        ctx!.lineWidth = 1
      }

      // Brighter near the cursor: re-stroke the same threads through a radial gradient.
      if (glow.strength > 0.02) {
        const r = 200
        const g = ctx!.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, r)
        g.addColorStop(0, colors.glow)
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx!.globalAlpha = glow.strength
        ctx!.strokeStyle = g
        ctx!.stroke(warp)
        ctx!.stroke(weft)
        ctx!.globalAlpha = 1
      }
    }

    function tick(now: number) {
      raf = requestAnimationFrame(tick)
      if (now - last < 33) return // ~30 fps
      last = now
      if (hoverCapable) {
        const rect = canvas!.getBoundingClientRect()
        const tx = pointer.x - rect.left
        const ty = pointer.y - rect.top
        const inside = pointer.active && tx >= -50 && ty >= -50 && tx <= rect.width + 50 && ty <= rect.height + 50
        if (glow.x < -9000) {
          glow.x = tx
          glow.y = ty
        }
        glow.x += (tx - glow.x) * 0.18
        glow.y += (ty - glow.y) * 0.18
        glow.strength += ((inside ? 1 : 0) - glow.strength) * 0.12
      }
      draw(now)
    }

    function start() {
      if (!animate || raf || document.hidden || !inView) return
      raf = requestAnimationFrame(tick)
    }
    function stop() {
      if (raf) cancelAnimationFrame(raf)
      raf = 0
    }

    const ro = new ResizeObserver(() => resize())
    ro.observe(canvas)
    resize()

    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting
      if (inView) start()
      else stop()
    })
    io.observe(canvas)

    const onVisibility = () => (document.hidden ? stop() : start())
    document.addEventListener('visibilitychange', onVisibility)

    // Theme switch: re-read the colours and repaint (a still canvas included).
    const mo = new MutationObserver(() => {
      colors = readColors()
      draw(last)
    })
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX
      pointer.y = e.clientY
      pointer.active = true
    }
    const onLeave = () => {
      pointer.active = false
    }
    if (hoverCapable) {
      window.addEventListener('pointermove', onMove, { passive: true })
      document.documentElement.addEventListener('pointerleave', onLeave)
    }

    start()
    return () => {
      stop()
      ro.disconnect()
      io.disconnect()
      mo.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
    }
  }, [reduced, spacing, interactive])

  const mask =
    fade === 'bottom'
      ? 'linear-gradient(to bottom, black 0%, black 35%, transparent 100%)'
      : fade === 'radial'
        ? 'radial-gradient(ellipse 70% 70% at 50% 40%, black 20%, transparent 100%)'
        : undefined

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}
      style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
    />
  )
}
