import * as React from 'react'
import { AnimatePresence, motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { Loader2, ChevronsRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Web counterpart to the mobile app's SlideToPunch — a drag-to-confirm thumb
 * instead of a plain click, so the final "commit the punch" action reads the
 * same deliberate way on both clients. Unlike the mobile control this one
 * doesn't own the location/permission flow (the wizard in AttendanceRequest
 * already captured and reviewed location before this renders) — it only
 * gates the actual submit behind a deliberate gesture.
 *
 * Two ways to commit, both deliberate:
 *  - Drag the thumb past FIRE_AT of the track (pointer users).
 *  - Activate the thumb without dragging (Enter / Space from the keyboard, a
 *    screen reader's double-tap, a switch or voice control, or a plain tap),
 *    or the visible "Can't slide?" link, which opens a confirm step with a
 *    real "Punch in / Punch out" button and a Cancel. Nothing is recorded
 *    until that confirm button is pressed, so a stray tap or keypress never
 *    punches on its own.
 *
 * `onCommit` is expected to already handle its own success/error feedback
 * (toast) and pending state; this component just triggers it and springs the
 * thumb back once it settles.
 */

const THUMB = 52
const PAD = 5
const FIRE_AT = 0.8

/** "Slide to punch in" -> "Punch in" (the action without the gesture wording). */
function actionText(label: string): string {
  const bare = label.replace(/^\s*slide\s+to\s+/i, '').trim() || label
  return bare.charAt(0).toUpperCase() + bare.slice(1)
}

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
  const thumbRef = React.useRef<HTMLButtonElement>(null)
  const confirmRef = React.useRef<HTMLButtonElement>(null)
  const mountedRef = React.useRef(true)
  const committingRef = React.useRef(false)
  // Set when a real drag starts; the click that ends a drag must not open the confirm step.
  const draggedRef = React.useRef(false)
  const [committing, setCommitting] = React.useState(false)
  const [confirming, setConfirming] = React.useState(false)
  const [maxX, setMaxX] = React.useState(0)
  const confirmId = React.useId()
  const hintId = React.useId()

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

  // Move focus onto the confirm button when the confirm step opens, so keyboard and
  // screen-reader users land on the decision rather than having to hunt for it.
  React.useEffect(() => {
    if (confirming) confirmRef.current?.focus()
  }, [confirming])

  const armed = !pending && !committing
  const action = actionText(label)
  const thumbName = subLabel ? `${action}. ${subLabel}` : action

  const springBack = () => animate(x, 0, { type: 'spring', stiffness: 320, damping: 32 })

  /** The single commit path shared by the drag and the confirm button. */
  const fire = () => {
    if (pending || committingRef.current) return
    committingRef.current = true
    // The confirm button is about to unmount; keep focus on the control instead of dropping it to <body>.
    if (confirmRef.current && document.activeElement === confirmRef.current) thumbRef.current?.focus()
    setCommitting(true)
    setConfirming(false)
    animate(x, maxX, { type: 'spring', stiffness: 420, damping: 40 })
    Promise.resolve()
      .then(onCommit)
      .catch(() => undefined) // onCommit owns its error feedback; never leave the thumb stuck
      .finally(() => {
        committingRef.current = false
        if (!mountedRef.current) return
        setCommitting(false)
        springBack()
      })
  }

  const handleDragStart = () => {
    draggedRef.current = true
    setConfirming(false)
  }

  const handleDragEnd = () => {
    if (pending || committingRef.current) return
    if (x.get() >= maxX * FIRE_AT) fire()
    else springBack()
  }

  const openConfirm = () => {
    if (!armed) return
    setConfirming(true)
  }

  const cancelConfirm = (returnFocus = true) => {
    setConfirming(false)
    if (returnFocus) thumbRef.current?.focus()
  }

  // A button's click also fires for Enter, Space, screen-reader / switch / voice activation and a
  // plain tap. None of those commits directly: they open the confirm step. The click that ends a
  // real drag is ignored (the drag itself already decided). detail === 0 marks a click that did not
  // come from a pointer (keyboard / assistive tech), which is never the tail of a drag.
  const handleThumbClick = (e: React.MouseEvent) => {
    const endOfDrag = draggedRef.current && e.detail !== 0
    draggedRef.current = false
    if (endOfDrag) return
    if (confirming) cancelConfirm(false)
    else openConfirm()
  }

  return (
    <div className="w-full space-y-2">
      <div
        ref={trackRef}
        className="relative h-[62px] w-full overflow-hidden rounded-full border bg-muted/40 select-none"
      >
        {/* Trail behind the thumb, grows with drag progress */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-primary"
          style={{ width: x, opacity: trailOpacity }}
        />

        {/* Visual label only; the thumb button carries the accessible name. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center"
        >
          <p className="text-sm font-bold text-primary">{label}</p>
          {subLabel && <p className="text-xs text-muted-foreground">{subLabel}</p>}
        </div>

        <motion.button
          ref={thumbRef}
          type="button"
          aria-label={thumbName}
          aria-describedby={hintId}
          aria-disabled={!armed || undefined}
          aria-expanded={confirming}
          aria-controls={confirmId}
          drag={armed ? 'x' : false}
          dragConstraints={{ left: 0, right: maxX }}
          dragElastic={0.04}
          dragMomentum={false}
          onPointerDownCapture={() => { draggedRef.current = false }}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onClick={handleThumbClick}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && confirming) {
              e.preventDefault()
              cancelConfirm(false)
            }
          }}
          style={{ x, width: THUMB, height: THUMB, left: PAD }}
          className={`focus-ring absolute top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ${
            armed ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed opacity-70'
          }`}
          whileTap={armed ? { scale: 0.96 } : undefined}
        >
          {pending || committing ? (
            <Loader2 aria-hidden className="size-5 animate-spin" />
          ) : (
            <motion.span
              aria-hidden
              className="flex"
              animate={armed ? { x: [0, 4, 0] } : { x: 0 }}
              transition={armed ? { repeat: Infinity, duration: 1.4, ease: 'easeInOut' } : undefined}
            >
              <ChevronsRight className="size-6" />
            </motion.span>
          )}
        </motion.button>
      </div>

      <p id={hintId} className="sr-only">
        Drag to the end to confirm, or press to open a confirm button.
      </p>

      {/* Announces the in-flight state to screen readers (the visual label is aria-hidden). */}
      <p className="sr-only" role="status" aria-live="polite">
        {pending || committing ? (subLabel ?? 'Recording your punch') : ''}
      </p>

      <div id={confirmId}>
        <AnimatePresence initial={false} mode="wait">
          {confirming ? (
            <motion.div
              key="confirm"
              role="group"
              aria-label={`Confirm: ${action.toLowerCase()}`}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border bg-muted/30 p-2"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  cancelConfirm()
                }
              }}
            >
              <p className="w-full text-center text-xs text-muted-foreground sm:w-auto sm:flex-1 sm:text-left sm:pl-2">
                {action} now?
              </p>
              <Button ref={confirmRef} type="button" size="sm" className="tap-target" onClick={fire} disabled={!armed}>
                {action}
              </Button>
              <Button type="button" size="sm" variant="ghost" className="tap-target" onClick={() => cancelConfirm()}>
                Cancel
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="fallback"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex justify-center"
            >
              <button
                type="button"
                onClick={openConfirm}
                disabled={!armed}
                className="focus-ring tap-target rounded-md px-2 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:pointer-events-none disabled:opacity-50"
              >
                Can't slide? Tap to {action.toLowerCase()}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
