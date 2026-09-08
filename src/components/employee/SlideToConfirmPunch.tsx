import * as React from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { Loader2, ChevronsRight } from 'lucide-react'

/**
 * Web counterpart to the mobile app's SlideToPunch — a drag-to-confirm thumb
 * instead of a plain click, so the final "commit the punch" action reads the
 * same deliberate way on both clients. Unlike the mobile control this one
 * doesn't own the location/permission flow (the wizard in AttendanceRequest
 * already captured and reviewed location before this renders) — it only
 * gates the actual submit behind a drag gesture instead of a tap.
 *
 * `onCommit` is expected to already handle its own success/error feedback
 * (toast) and pending state; this component just triggers it at the drag
 * threshold and springs the thumb back once it settles.
 */

const THUMB = 52
const PAD = 5
const FIRE_AT = 0.8

export function SlideToConfirmPunch({
  label,
  subLabel,
  onCommit,
  pending = false,
}: {
  label: string
  subLabel?: string
  onCommit: () => void | Promise<void>
  pending?: boolean
}) {
  const trackRef = React.useRef<HTMLDivElement>(null)
  const mountedRef = React.useRef(true)
  const committingRef = React.useRef(false)
  const [maxX, setMaxX] = React.useState(0);

  const x = useMotionValue(0)
  const progress = useTransform(x, [0, Math.max(maxX, 1)], [0, 1])
  const trailOpacity = useTransform(progress, [0, 1], [0.08, 0.28])

  React.useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  React.useEffect(() => {
    const measure = () => {
      const w = trackRef.current?.getBoundingClientRect().width ?? 0
      setMaxX(Math.max(1, w - THUMB - PAD * 2))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const springBack = () => animate(x, 0, { type: 'spring', stiffness: 320, damping: 32 })

  const handleDragEnd = () => {
    if (pending || committingRef.current) return
    if (x.get() >= maxX * FIRE_AT) {
      committingRef.current = true
      animate(x, maxX, { type: 'spring', stiffness: 420, damping: 40 })
      Promise.resolve(onCommit()).finally(() => {
        committingRef.current = false
        if (mountedRef.current) springBack()
      })
    } else {
      springBack()
    }
  }

  const armed = !pending && !committingRef.current

  return (
    <div
      ref={trackRef}
      className="relative h-[62px] w-full overflow-hidden rounded-full border bg-muted/40 select-none"
    >
      {/* Trail behind the thumb, grows with drag progress */}
      <motion.div
        className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-primary"
        style={{ width: x, opacity: trailOpacity }}
      />

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
        <p className="text-sm font-bold text-primary">{label}</p>
        {subLabel && <p className="text-xs text-muted-foreground">{subLabel}</p>}
      </div>

      <motion.div
        drag={armed ? 'x' : false}
        dragConstraints={{ left: 0, right: maxX }}
        dragElastic={0.04}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        style={{ x, width: THUMB, height: THUMB, left: PAD }}
        className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ${
          armed ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed opacity-70'
        }`}
        whileTap={armed ? { scale: 0.96 } : undefined}
      >
        {pending ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <motion.div
            animate={armed ? { x: [0, 4, 0] } : { x: 0 }}
            transition={armed ? { repeat: Infinity, duration: 1.4, ease: 'easeInOut' } : undefined}
          >
            <ChevronsRight className="size-6" />
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
