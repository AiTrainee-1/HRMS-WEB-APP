import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronRight, Info, Loader2, Lock, Route, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ApprovalState, DecisionBadge, Stepper, SuccessCheck, TONE_SOFT, fadeIn } from '@/components/kit'
import { approveEffect, hodCanAct, hodCanReject } from '@/lib/approval'
import {
  CATEGORY_LABEL,
  decisionComments,
  fmtDay,
  normalizeOutcome,
  outcomeLine,
  waitingFor,
  type ApprovalCategory,
  type ApprovalItem,
  type ApprovalStatus,
} from '@/lib/approvals-history'
import {
  birthdayFacts,
  birthdayUse,
  claimFacts,
  empCode,
  empDepartment,
  empName,
  headSteps,
  itemApproval,
  itemNote,
  itemReason,
  onDutyJourneyId,
  onDutyPunches,
} from '@/lib/approvals-items'
import { describeClaim } from '@/lib/holiday-work'
import { placementApproveText } from '@/lib/birthday-compensation'
import { REJECT_REMARK_MIN, cleanRejectRemark, rejectRemarkProblem } from '@/lib/reject-remark'
import { cn } from '@/lib/utils'
import type { PendingHolidayWorkClaim } from '@/types'
import { JourneyDialog } from '@/components/onduty/JourneyDialog'
import { FormError } from '@/components/requests/FormBits'
import { typeLabel } from './words'
import { CATEGORY_META } from './categoryMeta'
import { OnDutyPunchList } from './OnDutyPunchList'
import { RequestTiming } from './RequestTiming'

export interface DialogTarget {
  category: ApprovalCategory
  status: ApprovalStatus
  item: ApprovalItem
  /** Opened from the card's Approve / Reject: 'rejected' puts the cursor in the reason box straight away. */
  decision?: 'approved' | 'rejected' | null
}

type Phase = 'view' | 'done'

/**
 * What the page says about a decision it sent: true = the server accepted it; false = it did not (the page has shown the
 * server's words); a string = the server refused the rejection's reason (`remark_required`), shown under the reason box
 * while the dialog stays open for a better one.
 */
export type DecideResult = boolean | string

/**
 * A request in full, and the place every decision is made: when it is for, when it was submitted and how far ahead
 * (RequestTiming), the details, the On-Duty punches with selfies and map links, the approval path, who decided it; on a
 * Pending request the comment box with Approve / Reject (owner 2026-11-25, mirror of the mobile app's DecisionSheet).
 * Approve is sent straight away, with the optional comment. Reject needs the reason (lib/reject-remark.ts, at least
 * REJECT_REMARK_MIN characters): the button stays disabled until it is written, and the line under the box says why and
 * how many characters are still missing; the server checks again (400 remark_required, its words shown under the box).
 * `onDecide` resolves true when the server accepted it - the dialog then shows a tick and closes - and false when it did
 * not (the page shows the server's words; the dialog stays for another try unless the page closes it because the request
 * has moved on), or with the server's words about the reason (see DecideResult).
 */
export function DecisionDialog({
  target,
  onClose,
  onDecide,
  busy,
}: {
  target: DialogTarget | null
  onClose: () => void
  onDecide: (decision: 'approved' | 'rejected', comment: string) => Promise<DecideResult>
  busy: boolean
}) {
  const [phase, setPhase] = React.useState<Phase>('view')
  // The decision on its way (or just made): the spinner on its button, the tick's words.
  const [decision, setDecision] = React.useState<'approved' | 'rejected'>('approved')
  const [comment, setComment] = React.useState('')
  // "Write the reason for rejecting ..." under the box: from the check below, or the server's own words.
  const [remarkError, setRemarkError] = React.useState<string | null>(null)
  const commentRef = React.useRef<HTMLTextAreaElement>(null)
  const [now] = React.useState(() => new Date())
  // "View route" on an On-Duty request: the day's recorded journey, opened over this dialog (closing it comes back here).
  const [routeOpen, setRouteOpen] = React.useState(false)

  // Each opening starts fresh. The key goes back to '' whenever the dialog closes, so reopening the very request just
  // decided starts over too, not on the old 'done' screen. The reset happens during render (not in an effect) so a stale
  // screen never shows, even for one frame.
  const key = target ? `${target.category}-${target.item.id}-${target.decision ?? ''}` : ''
  const [openedKey, setOpenedKey] = React.useState('')
  if (key !== openedKey) {
    setOpenedKey(key)
    setComment('')
    setRemarkError(null)
    setDecision(target?.decision ?? 'approved')
    setPhase('view')
    setRouteOpen(false)
  }

  // The tick's auto-close belongs to the opening that set it: it is dropped when the dialog closes or another request
  // opens, so a late timer can never close a dialog opened afterwards.
  const keyRef = React.useRef(key)
  const closeTimer = React.useRef<number | undefined>(undefined)
  React.useEffect(() => {
    keyRef.current = key
    return () => window.clearTimeout(closeTimer.current)
  }, [key])

  const item = target?.item
  const category = target?.category ?? 'leave'
  const pending = target?.status === 'pending'
  const approval = item ? itemApproval(item) : null
  const canApprove = pending && hodCanAct(approval, true)
  const canReject = pending && hodCanReject(approval, true)
  const line = item && !pending ? outcomeLine(normalizeOutcome(item.outcome)) : null
  const comments = item ? decisionComments(normalizeOutcome(item.outcome)) : []
  const name = item ? empName(item) : ''
  const first = name.split(/\s+/)[0]
  // A compensation claim says what approving does (adds to the balance / applies the allowance / takes the day off).
  const claimView = item && category === 'holiday_work' ? describeClaim(item as unknown as PendingHolidayWorkClaim) : null
  // Birthday Compensation: HR decides after the head, then the day (or half) is paid like a Casual Leave.
  const birthdayEffect = item && category === 'birthday_compensation' ? placementApproveText(birthdayUse(item)) : null
  const effect = claimView?.approveText ?? birthdayEffect ?? approveEffect(approval, 'hod')
  const meta = CATEGORY_META[category]
  const Icon = meta.icon
  const journeyId = item && category === 'on_duty' ? onDutyJourneyId(item) : null
  const routeTitle = item
    ? [name, typeof item.destination === 'string' ? item.destination : null, item.date || item.createdAt ? fmtDay(item.date ?? item.createdAt) : null]
        .filter(Boolean)
        .join(' · ')
    : ''

  // The box asks for the reason when the card's Reject opened the dialog, or when Reject is the only button.
  const reasonMode = canReject && (target?.decision === 'rejected' || !canApprove)
  // Reject is only possible once the reason is long enough; how many characters are still missing, for the hint.
  const reasonReady = !rejectRemarkProblem(comment)
  const missing = Math.max(0, REJECT_REMARK_MIN - cleanRejectRemark(comment).length)

  // The card's Reject: the cursor goes to the reason box once the dialog has opened.
  React.useEffect(() => {
    if (!target || target.decision !== 'rejected') return
    const t = window.setTimeout(() => commentRef.current?.focus(), 120)
    return () => window.clearTimeout(t)
  }, [target])

  const send = async (d: 'approved' | 'rejected') => {
    const rejecting = d === 'rejected'
    // Rejecting needs the reason (the button stays disabled without it; the rule is kept here for any other way in).
    const problem = rejecting ? rejectRemarkProblem(comment) : null
    if (problem) {
      setRemarkError(problem)
      commentRef.current?.focus()
      return
    }
    setRemarkError(null)
    setDecision(d)
    const sentFor = key
    const result = await onDecide(d, rejecting ? cleanRejectRemark(comment) : comment)
    // Closed (or moved to another request) while the decision was on its way: nothing left here to show.
    if (keyRef.current !== sentFor) return
    if (typeof result === 'string') {
      // The server refused the reason (remark_required): its words go under the box, the dialog stays.
      setRemarkError(result)
      commentRef.current?.focus()
      return
    }
    if (!result) return
    setPhase('done')
    window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(onClose, 1100)
  }

  // When it is for and when it was submitted are in the timing block above these rows (RequestTiming).
  const rows: [string, string | null][] = item
    ? [
        ['Request', typeLabel(category, item)],
        ['Department', empDepartment(item)],
        ['Waiting', pending && item.createdAt ? (waitingFor(item.createdAt, now)?.replace(/^Waiting /, '') ?? null) : null],
        // A compensation claim: who raised it (the employee or HR), the overtime times, the allowance, the shifts.
        ...(category === 'holiday_work' ? claimFacts(item) : []),
        // Birthday Compensation: who placed it, the birthday, the day and the part.
        ...(category === 'birthday_compensation' ? birthdayFacts(item) : []),
      ]
    : []

  return (
    // Closable on every step, the tick included (it closes itself shortly anyway), so the dialog can never get stuck.
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        {item && (
          <AnimatePresence mode="wait" initial={false}>
            {phase === 'done' ? (
              <motion.div key="done" variants={fadeIn} initial="hidden" animate="show" exit="exit" className="flex flex-col items-center gap-3 py-8 text-center">
                <SuccessCheck size={64} tone={decision === 'approved' ? 'emerald' : 'sapphire'} label={decision === 'approved' ? 'Approved' : 'Rejected'} />
                <DialogTitle className="font-display text-xl">{decision === 'approved' ? 'Approved' : 'Rejected'}</DialogTitle>
                <DialogDescription>{first} will be told.</DialogDescription>
              </motion.div>
            ) : (
              <motion.div key="view" variants={fadeIn} initial="hidden" animate="show" exit="exit" className="flex flex-col gap-4">
                {/* Phones: the app's DecisionSheet - the employee row over a hairline, then label / value rows. */}
                <DialogHeader className="max-md:border-b max-md:border-input max-md:pb-3.5">
                  <div className="flex items-center gap-3">
                    <span aria-hidden="true" className={cn('grid size-10 shrink-0 place-items-center rounded-xl border max-md:size-12 max-md:rounded-full max-md:border-0', TONE_SOFT[meta.tone])}>
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0 text-left">
                      <DialogTitle className="truncate">{name}</DialogTitle>
                      <DialogDescription>{[empCode(item), CATEGORY_LABEL[category]].filter(Boolean).join(' · ')}</DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                {pending ? <ApprovalState approval={approval} /> : line && <DecisionBadge text={line.text} tone={line.tone} note={line.note} />}

                <RequestTiming category={category} item={item} variant="dialog" />

                <dl className="grid gap-2 max-md:-mt-2 max-md:gap-0 sm:grid-cols-2 sm:max-md:grid-cols-1">
                  {rows
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div
                        key={k}
                        className="rounded-lg bg-foreground/[0.04] px-3 py-2 max-md:flex max-md:items-start max-md:justify-between max-md:gap-2.5 max-md:rounded-none max-md:border-b max-md:border-input max-md:bg-transparent max-md:px-0 max-md:py-2.5"
                      >
                        <dt className="label-caps text-muted-foreground max-md:shrink-0 max-md:text-[13px]! max-md:font-normal! max-md:tracking-[0]! max-md:normal-case!">{k}</dt>
                        <dd className="mt-0.5 text-[13.5px] font-semibold break-words max-md:mt-0 max-md:min-w-0 max-md:text-right max-md:text-[13px]">{v}</dd>
                      </div>
                    ))}
                </dl>

                {itemReason(category, item) && (
                  <div>
                    <p className="label-caps mb-1 text-muted-foreground">Reason</p>
                    <p className="rounded-lg border-l-2 border-primary/40 bg-foreground/[0.03] px-3 py-2 text-[14px] whitespace-pre-line">{itemReason(category, item)}</p>
                  </div>
                )}

                {category === 'on_duty' && (
                  <div>
                    <p className="label-caps mb-2 text-muted-foreground">Destination and punches</p>
                    {typeof item.destination === 'string' && <p className="mb-2 text-[14px] font-semibold">{item.destination}</p>}
                    {journeyId !== null && (
                      // Phones: the app sheet's outlined pill, full width.
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRouteOpen(true)}
                        className="mb-3 min-h-11 sm:min-h-8 max-md:h-11 max-md:w-full max-md:rounded-full max-md:border-[1.5px] max-md:border-primary max-md:font-[800] max-md:text-primary"
                      >
                        <Route aria-hidden="true" /> View route<span className="sr-only"> of {first}'s day</span>
                        <ChevronRight className="hidden max-md:block" aria-hidden="true" />
                      </Button>
                    )}
                    {Array.isArray(item.punches) ? (
                      <OnDutyPunchList punches={onDutyPunches(item)} />
                    ) : (
                      <p className="text-[13px] text-muted-foreground">The punches show here once the server is updated.</p>
                    )}
                  </div>
                )}

                {itemNote(category, item) && <p className="text-[12.5px] text-muted-foreground">{itemNote(category, item)}</p>}

                {headSteps(category, item).length > 1 && (
                  <div>
                    <p className="label-caps mb-2 text-muted-foreground">Approval path</p>
                    <Stepper steps={headSteps(category, item)} orientation="vertical" />
                  </div>
                )}

                {comments.length > 0 && (
                  <ul className="flex flex-col gap-1.5">
                    {comments.map((c) => (
                      <li key={c} className="rounded-md bg-foreground/[0.04] px-3 py-1.5 text-[12.5px] text-foreground/85 italic">
                        {c}
                      </li>
                    ))}
                  </ul>
                )}

                {(canApprove || canReject) && (
                  <div className="flex flex-col gap-2 border-t hairline pt-4 max-md:border-t-0 max-md:pt-1">
                    {/* Approving: an optional comment. Rejecting: the reason is required (lib/reject-remark.ts). */}
                    <Label htmlFor="decision-comment">
                      {reasonMode ? 'Reason for rejecting' : 'Comment'}{' '}
                      <span className="font-normal text-muted-foreground">
                        {reasonMode ? '(required)' : canReject ? '(optional to approve, required to reject)' : '(optional)'}
                      </span>
                    </Label>
                    <Textarea
                      ref={commentRef}
                      id="decision-comment"
                      value={comment}
                      onChange={(e) => {
                        setComment(e.target.value)
                        // The message goes once the reason is long enough (it never appears while typing).
                        if (remarkError && !rejectRemarkProblem(e.target.value)) setRemarkError(null)
                      }}
                      rows={3}
                      maxLength={500}
                      disabled={busy}
                      aria-invalid={remarkError ? true : undefined}
                      aria-describedby="decision-comment-hint"
                      placeholder={reasonMode ? 'Tell them why, so they know what to do next' : canReject ? 'Anything they or HR should know (to reject, the reason)' : 'Anything they or HR should know'}
                      data-testid="approvals-dialog-comment"
                    />
                    <div id="decision-comment-hint" aria-live="polite">
                      {remarkError ? (
                        <FormError>{remarkError}</FormError>
                      ) : canReject && !reasonReady ? (
                        <p className="flex items-start gap-1.5 text-[12px] text-muted-foreground" data-testid="approvals-dialog-reject-locked">
                          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                          <span>
                            {canApprove ? 'Approve needs no comment. ' : ''}Reject unlocks once you write the reason (at least {REJECT_REMARK_MIN} characters
                            {missing < REJECT_REMARK_MIN ? `, ${missing} more` : ''}).
                          </span>
                        </p>
                      ) : canReject ? (
                        <p className="text-[12px] text-muted-foreground">The employee will see this reason if you reject.</p>
                      ) : null}
                    </div>
                    {canApprove && effect && (
                      <p className="flex items-start gap-1.5 text-[12px] text-muted-foreground">
                        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                        <span>{effect}</span>
                      </p>
                    )}
                    {/* Phones: the app's two pill buttons side by side, Approve first. */}
                    <DialogFooter className="mt-1 gap-2 max-md:flex-row-reverse! max-md:gap-2.5">
                      {canReject && (
                        // Disabled until the reason is written (at least REJECT_REMARK_MIN characters): the line above says why.
                        <Button
                          variant="destructive"
                          onClick={() => void send('rejected')}
                          disabled={busy || !reasonReady}
                          aria-describedby={reasonReady ? undefined : 'decision-comment-hint'}
                          className="min-h-11 max-md:h-12 max-md:flex-1 max-md:border-[1.5px] max-md:font-[800] sm:min-h-9"
                          data-testid="approvals-dialog-reject"
                        >
                          {busy && decision === 'rejected' ? (
                            <Loader2 className="animate-spin" aria-hidden="true" />
                          ) : reasonReady ? (
                            <X aria-hidden="true" />
                          ) : (
                            <Lock aria-hidden="true" />
                          )}
                          {busy && decision === 'rejected' ? 'Rejecting…' : 'Reject'}
                        </Button>
                      )}
                      {canApprove && (
                        <Button
                          variant="success"
                          onClick={() => void send('approved')}
                          disabled={busy}
                          className="min-h-11 max-md:h-12 max-md:flex-1 max-md:border-[1.5px] max-md:font-[800] sm:min-h-9"
                          data-testid="approvals-dialog-approve"
                        >
                          {busy && decision === 'approved' ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
                          {busy && decision === 'approved' ? 'Approving…' : 'Approve'}
                        </Button>
                      )}
                    </DialogFooter>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </DialogContent>
      {/* Over this dialog (Radix stacks them: Escape / outside click close only the route), neutral words: a head reads it. */}
      <JourneyDialog journeyId={routeOpen ? journeyId : null} title={routeTitle} ownerName={name || null} onClose={() => setRouteOpen(false)} />
    </Dialog>
  )
}
