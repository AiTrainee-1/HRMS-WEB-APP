import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Check, ChevronRight, Loader2, Route, X } from 'lucide-react'
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
  claimFacts,
  empCode,
  empDepartment,
  empName,
  headSteps,
  itemApproval,
  itemDateLabel,
  itemNote,
  itemReason,
  onDutyJourneyId,
  onDutyPunches,
} from '@/lib/approvals-items'
import { describeClaim } from '@/lib/holiday-work'
import { cleanRejectRemark, rejectRemarkProblem } from '@/lib/reject-remark'
import { cn } from '@/lib/utils'
import type { PendingHolidayWorkClaim } from '@/types'
import { JourneyDialog } from '@/components/onduty/JourneyDialog'
import { FormError } from '@/components/requests/FormBits'
import { typeLabel } from './words'
import { CATEGORY_META } from './categoryMeta'
import { OnDutyPunchList } from './OnDutyPunchList'

export interface DialogTarget {
  category: ApprovalCategory
  status: ApprovalStatus
  item: ApprovalItem
  /** Open straight on the confirm step of this decision (the card's Approve / Reject). */
  decision?: 'approved' | 'rejected' | null
}

type Phase = 'view' | 'confirm' | 'done'

/**
 * What the page says about a decision it sent: true = the server accepted it; false = it did not (the page has shown the
 * server's words); a string = the server refused the rejection's reason (`remark_required`), shown under the reason box
 * while the dialog stays open for a better one.
 */
export type DecideResult = boolean | string

/**
 * A request in full, and the place every decision is made: the details, the On-Duty punches with selfies and map links,
 * the approval path, who decided it; on a Pending request Approve / Reject, each confirmed in a second step. Approving
 * takes an optional comment; rejecting needs the reason (owner, 2026-11-21: at least 3 characters, lib/reject-remark.ts) -
 * a short one shows the rule under the box and nothing is sent. Either is sent with the decision as its `comment`.
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
  const [decision, setDecision] = React.useState<'approved' | 'rejected'>('approved')
  const [comment, setComment] = React.useState('')
  // "Write the reason for rejecting ..." under the box: from the check below, or the server's own words.
  const [remarkError, setRemarkError] = React.useState<string | null>(null)
  const commentRef = React.useRef<HTMLTextAreaElement>(null)
  const [now] = React.useState(() => new Date())
  // "View route" on an On-Duty request: the day's recorded journey, opened over this dialog (closing it comes back here).
  const [routeOpen, setRouteOpen] = React.useState(false)

  // Each opening starts fresh (on its confirm step when the card's button opened it). The key goes back to '' whenever
  // the dialog closes, so reopening the very request just decided starts over too, not on the old 'done' screen. The
  // reset happens during render (not in an effect) so a stale screen never shows, even for one frame.
  const key = target ? `${target.category}-${target.item.id}-${target.decision ?? ''}` : ''
  const [openedKey, setOpenedKey] = React.useState('')
  if (key !== openedKey) {
    setOpenedKey(key)
    setComment('')
    setRemarkError(null)
    setDecision(target?.decision ?? 'approved')
    setPhase(target?.decision ? 'confirm' : 'view')
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
  const effect = claimView?.approveText ?? approveEffect(approval, 'hod')
  const meta = CATEGORY_META[category]
  const Icon = meta.icon
  const journeyId = item && category === 'on_duty' ? onDutyJourneyId(item) : null
  const routeTitle = item
    ? [name, typeof item.destination === 'string' ? item.destination : null, item.date || item.createdAt ? fmtDay(item.date ?? item.createdAt) : null]
        .filter(Boolean)
        .join(' · ')
    : ''

  const rejecting = decision === 'rejected'

  // The view step's Approve / Reject start the confirm step clean: no leftover reason message.
  const openConfirm = (d: 'approved' | 'rejected') => {
    setDecision(d)
    setRemarkError(null)
    setPhase('confirm')
  }

  const confirm = async () => {
    // Rejecting needs the reason: a short one shows the rule under the box and nothing is sent.
    const problem = rejecting ? rejectRemarkProblem(comment) : null
    if (problem) {
      setRemarkError(problem)
      commentRef.current?.focus()
      return
    }
    setRemarkError(null)
    const sentFor = key
    const result = await onDecide(decision, rejecting ? cleanRejectRemark(comment) : comment)
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

  const rows: [string, string | null][] = item
    ? [
        ['Request', typeLabel(category, item)],
        ['When', itemDateLabel(category, item)],
        ['Department', empDepartment(item)],
        ['Sent', item.createdAt ? `${fmtDay(item.createdAt)}${pending ? ` · ${waitingFor(item.createdAt, now)?.toLowerCase() ?? ''}` : ''}` : null],
        // A compensation claim: who raised it (the employee or HR), the overtime times, the allowance, the shifts.
        ...(category === 'holiday_work' ? claimFacts(item) : []),
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
            ) : phase === 'confirm' ? (
              <motion.div key="confirm" variants={fadeIn} initial="hidden" animate="show" exit="exit" className="flex flex-col gap-4">
                <DialogHeader>
                  <DialogTitle>
                    {decision === 'approved' ? 'Approve' : 'Reject'} {first}'s {CATEGORY_LABEL[category].toLowerCase().replace(/s$/, '')} request?
                  </DialogTitle>
                  <DialogDescription>
                    {typeLabel(category, item)} · {itemDateLabel(category, item)}
                  </DialogDescription>
                </DialogHeader>
                <div
                  className={cn(
                    'rounded-lg border px-3 py-2.5 text-[13px] font-medium max-md:border-0 max-md:text-[12.5px]',
                    decision === 'approved' ? 'border-approved-border bg-approved-bg text-approved' : 'border-rejected-border bg-rejected-bg text-rejected',
                  )}
                >
                  {decision === 'approved'
                    ? (effect ?? 'Your approval is sent straight away.')
                    : category === 'on_duty'
                      ? 'Rejecting voids every punch recorded under it. This cannot be undone.'
                      : 'Rejecting is final. The employee will be told.'}
                </div>
                <div className="flex flex-col gap-2">
                  {/* Approving: an optional comment. Rejecting: the reason is required (lib/reject-remark.ts). */}
                  <Label htmlFor="decision-comment">
                    {rejecting ? 'Reason for rejecting' : 'Comment'}{' '}
                    <span className="font-normal text-muted-foreground">{rejecting ? '(required)' : '(optional)'}</span>
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
                    required={rejecting}
                    aria-invalid={rejecting && remarkError ? true : undefined}
                    aria-describedby={rejecting && remarkError ? 'decision-comment-error' : undefined}
                    placeholder={rejecting ? 'Tell them why, so they know what to do next' : 'Anything they or HR should know'}
                  />
                  {rejecting && <FormError id="decision-comment-error">{remarkError}</FormError>}
                </div>
                <DialogFooter className="gap-2 sm:justify-between">
                  <Button variant="ghost" onClick={() => (target?.decision ? onClose() : setPhase('view'))} disabled={busy}>
                    <ArrowLeft aria-hidden="true" /> {target?.decision ? 'Cancel' : 'Back'}
                  </Button>
                  <Button variant={decision === 'approved' ? 'success' : 'destructive'} onClick={confirm} disabled={busy} className="min-h-11 sm:min-h-9">
                    {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : decision === 'approved' ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}
                    {busy ? 'Sending…' : decision === 'approved' ? 'Yes, approve' : 'Yes, reject'}
                  </Button>
                </DialogFooter>
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
                  // Phones: the app's two pill buttons side by side, Approve first.
                  <DialogFooter className="gap-2 border-t hairline pt-4 max-md:flex-row-reverse! max-md:gap-2.5 max-md:border-t-0 max-md:pt-1">
                    {canReject && (
                      <Button
                        variant="destructive"
                        onClick={() => openConfirm('rejected')}
                        className="min-h-11 max-md:h-12 max-md:flex-1 max-md:border-[1.5px] max-md:font-[800] sm:min-h-9"
                      >
                        <X aria-hidden="true" /> Reject
                      </Button>
                    )}
                    {canApprove && (
                      <Button
                        variant="success"
                        onClick={() => openConfirm('approved')}
                        className="min-h-11 max-md:h-12 max-md:flex-1 max-md:border-[1.5px] max-md:font-[800] sm:min-h-9"
                      >
                        <Check aria-hidden="true" /> Approve
                      </Button>
                    )}
                  </DialogFooter>
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
