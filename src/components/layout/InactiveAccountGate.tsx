// "Your account is inactive" (owner 2026-11-25, mirror of the mobile app's InactiveAccountGate). An employee whose HRMS
// account is inactive may sign in (or still be signed in), but cannot use the app: the page they are on stays under a
// full-screen cover that says why, shows HR's contact to get the account made active again, and counts 30 seconds down on
// a ring before the normal sign-out. Rules (pure, tested): lib/inactive-account.ts. Status: hooks/useAccountStatus.ts
// (GET /auth/me and the sign-in reply's `accountStatus`). Mounted by ProtectedRoute next to ResignationGuard; the
// approved-resignation flow keeps its own screen (/account-deactivated) and this cover stays out of its way.
import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useLocation } from 'wouter'
import { Info, LogOut, UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useReducedMotion } from '@/components/kit'
import { ContactBlockCard } from '@/components/support/ContactBlockCard'
import { resignationApi } from '@/api/resources'
import { useAuth } from '@/context/AuthContext'
import { useAccountStatus } from '@/hooks/useAccountStatus'
import { INACTIVE_LOGOUT_SECONDS, countdownAt, countdownSentence, shouldBlock } from '@/lib/inactive-account'
import { cn } from '@/lib/utils'

const RING = 148
const STROKE = 10
const RADIUS = (RING - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function InactiveAccountGate() {
  const { user, logout } = useAuth()
  const [path] = useLocation()
  const employeeId = user?.employeeId != null ? String(user.employeeId) : null
  const { status } = useAccountStatus(employeeId)
  // The same query ResignationGuard polls (one request for both).
  const resignation = useQuery({
    queryKey: ['my-resignation-guard'],
    queryFn: resignationApi.get,
    enabled: !!user,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  })

  const block = shouldBlock({
    signedIn: !!employeeId,
    status,
    resignationSettled: !resignation.isPending,
    resignationApproved: resignation.data?.status === 'approved',
    path,
  })

  // The deadline is set once when the cover appears; an account made active again meanwhile clears it.
  const [deadline, setDeadline] = React.useState<number | null>(null)
  React.useEffect(() => {
    setDeadline(block ? Date.now() + INACTIVE_LOGOUT_SECONDS * 1000 : null)
  }, [block])

  const signedOut = React.useRef(false)
  React.useEffect(() => {
    if (!block) signedOut.current = false
  }, [block])
  const signOut = React.useCallback(() => {
    if (signedOut.current) return
    signedOut.current = true
    // A forced sign-out: no "leaving home" farewell (that is for the employee's own Logout click).
    logout({ silent: true })
  }, [logout])

  if (!block || deadline == null) return null
  return <InactiveCover deadline={deadline} onSignOut={signOut} />
}

function InactiveCover({ deadline, onSignOut }: { deadline: number; onSignOut: () => void }) {
  const reduced = useReducedMotion()
  // The number: worked out from the clock four times a second, so it is right again after the tab was hidden.
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(t)
  }, [])
  const c = countdownAt(deadline, now)
  React.useEffect(() => {
    if (c.done) onSignOut()
  }, [c.done, onSignOut])

  // The ring empties smoothly: the clock is read four times a second and each step glides into the next (a linear CSS
  // transition as long as the step), so it is right again at once after the tab was hidden. Under reduced motion it
  // steps once a second instead, without the glide.
  const shownRemaining = reduced ? c.secondsLeft / INACTIVE_LOGOUT_SECONDS : c.remaining
  const dashOffset = CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, shownRemaining)))

  // The last 10 seconds turn the ring red.
  const urgent = c.secondsLeft <= 10
  // Screen readers hear the time at a few steps, not every second.
  const spoken = c.secondsLeft === INACTIVE_LOGOUT_SECONDS || c.secondsLeft % 10 === 0 || c.secondsLeft <= 5 ? countdownSentence(c.secondsLeft) : null
  const [announce, setAnnounce] = React.useState(countdownSentence(INACTIVE_LOGOUT_SECONDS))
  if (spoken && spoken !== announce) setAnnounce(spoken)

  return (
    <DialogPrimitive.Root open modal>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="ui-fade fixed inset-0 z-[150] bg-background" />
        <DialogPrimitive.Content
          // The app is not usable while the account is inactive: Escape and clicks outside do not close this.
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className="fixed inset-0 z-[151] overflow-y-auto outline-none"
          data-testid="inactive-account-cover"
        >
          <div className="mx-auto flex min-h-full max-w-md flex-col items-center gap-4 px-6 pt-[calc(env(safe-area-inset-top)+40px)] pb-[calc(env(safe-area-inset-bottom)+28px)] text-center max-md:px-[22px] max-md:pt-[calc(env(safe-area-inset-top)+28px)]">
            <motion.span
              aria-hidden="true"
              className="grid size-[92px] place-items-center rounded-full bg-rejected-bg"
              initial={reduced ? false : { scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            >
              <span className="grid size-[68px] place-items-center rounded-full border bg-card text-rejected">
                <UserX className="size-[34px]" />
              </span>
            </motion.span>

            <DialogPrimitive.Title className="font-display text-[26px] leading-8 font-bold max-md:text-[24px]">Your account is inactive</DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-[15px] leading-6 text-secondary-foreground">
              Your account in HRMS is not active right now, so you cannot use the app while it is inactive.
            </DialogPrimitive.Description>

            <div role="timer" aria-label={countdownSentence(c.secondsLeft)} className="relative my-1 grid size-[148px] place-items-center" data-testid="inactive-account-countdown">
              <svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`} className="absolute inset-0 -rotate-90" aria-hidden="true">
                <circle cx={RING / 2} cy={RING / 2} r={RADIUS} fill="none" strokeWidth={STROKE} className="stroke-foreground/[0.08]" />
                <circle
                  cx={RING / 2}
                  cy={RING / 2}
                  r={RADIUS}
                  fill="none"
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                  style={{
                    strokeDashoffset: dashOffset,
                    transition: reduced ? 'stroke 500ms' : 'stroke-dashoffset 250ms linear, stroke 500ms',
                  }}
                  className={urgent ? 'stroke-destructive' : 'stroke-warning'}
                />
              </svg>
              <span aria-hidden="true" className="flex flex-col items-center">
                <motion.span
                  key={reduced ? 'n' : c.secondsLeft}
                  initial={reduced ? false : { scale: 1.12 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className={cn('font-display text-[46px] leading-[50px] font-bold tabular-nums', urgent ? 'text-rejected' : 'text-waiting')}
                >
                  {c.secondsLeft}
                </motion.span>
                <span className="text-[12px] font-semibold text-muted-foreground">{c.secondsLeft === 1 ? 'second' : 'seconds'}</span>
              </span>
            </div>
            <p className="text-[14px] font-semibold text-foreground/85" aria-hidden="true">
              {countdownSentence(c.secondsLeft)}
            </p>
            <p className="sr-only" aria-live="polite">
              {announce}
            </p>

            <p className="flex items-start gap-2 rounded-xl border bg-card px-3.5 py-3 text-left text-[13px] leading-5 text-secondary-foreground">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              To make your account active again, please contact HR. Once HR has done it, sign in again.
            </p>
            <ContactBlockCard block={null} title="Contact HR" className="w-full" />

            <Button onClick={onSignOut} className="mt-1 min-h-12 w-full text-[15px] font-bold" data-testid="inactive-account-sign-out">
              <LogOut aria-hidden="true" /> Sign out now
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
