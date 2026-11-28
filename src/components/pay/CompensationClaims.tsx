import * as React from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { ArrowRight, CalendarCheck, Hand, Inbox, Loader2, Undo2, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState, ErrorState, GlassCard, SectionHeader, SkeletonList, listItem } from '@/components/kit'
import { CompensationItemCard } from '@/components/employee/CompensationItemCard'
import { MarkerSymbol } from '@/components/employee/MarkerSymbol'
import { TextareaField } from '@/components/employee/TextareaField'
import { ChoiceTiles, FormError, FormNote, SentState, StepLabel } from '@/components/requests/FormBits'
import { PHONE_BUTTON_ROW, PHONE_NO_CANCEL, PHONE_SUBMIT } from '@/components/requests/phone'
import { ApiError } from '@/api/client'
import { useClaimCompensation, useSpendBalance, useWithdrawClaim, type useMyCompensationClaims } from '@/hooks/useCompensationClaims'
import { formatMinutes, formatShifts, kindInfo, type CompensationItem, type CompensationPayload } from '@/lib/compensation'
import {
  QUARTERS,
  QUARTER_HINT,
  REASON_MAX,
  applyClaimFilter,
  balanceUse,
  balanceUseProblem,
  claimAmount,
  claimBody,
  claimDateLine,
  claimDecisionLine,
  claimDraft,
  claimErrorText,
  claimFilterOptions,
  claimProblem,
  claimRaisedByText,
  claimStatusInfo,
  claimableItems,
  type ClaimFilterId,
  type MyClaim,
} from '@/lib/compensation-claims'
import { focusKey } from '@/lib/focus-item'
import { dayText } from '@/lib/my-requests'
import { getRequestWindow, windowHint } from '@/lib/request-window'
import { cn } from '@/lib/utils'
import { phoneChipClass, phoneCountClass } from './phone'

const errorText = (err: unknown, fallback: string) => claimErrorText(err instanceof ApiError ? err : null, fallback)

/** The item kind whose chip and symbol a claim kind borrows (an older birthday claim, from before Birthday Compensation
 *  replaced it on 2026-11-25, looks like the birthday credit it is for). */
const CLAIM_ITEM_KIND: Record<string, string> = { birthday: 'birthday_credit' }

// ---- the "ready to claim" note at the top of the page -------------------------------------------------------------

/** "You have 3 things to claim": shown on top of every view while something can be claimed, with a way to the Claims tab. */
export function ClaimsReadyBanner({ count, onOpen }: { count: number; onOpen: () => void }) {
  if (count <= 0) return null
  return (
    <GlassCard
      role="status"
      padding="sm"
      className="flex items-center gap-3 border-info-border bg-info-bg/60 max-md:flex-col max-md:items-stretch max-md:gap-2.5 max-md:border-0! max-md:bg-info-bg! max-md:shadow-none!"
      data-testid="compensation-claims-ready"
    >
      <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground max-md:hidden">
        <Hand className="size-[18px]" />
      </span>
      <p className="min-w-0 flex-1 text-[14px] font-semibold max-md:text-[13px]">
        {count === 1 ? 'You have 1 thing to claim.' : `You have ${count} things to claim.`}{' '}
        <span className="font-normal text-muted-foreground">Your Department Head approves each claim.</span>
      </p>
      <Button size="sm" onClick={onOpen} className="min-h-11 sm:min-h-8 max-md:h-10 max-md:w-full max-md:rounded-xl max-md:font-bold">
        See and claim <ArrowRight aria-hidden="true" />
      </Button>
    </GlassCard>
  )
}

// ---- claiming one item ----------------------------------------------------------------------------------------------

const quarterValue = (q: number) => String(q)

/**
 * Claim one item: what it is, the shifts where there is a choice (quarters; extra hours never above what the day
 * earned), a reason, what an approval does; then "sent". The server decides; its refusal is shown in its own words.
 */
export function ClaimDialog({ item, onClose }: { item: CompensationItem | null; onClose: () => void }) {
  const claim = useClaimCompensation()
  const draft = React.useMemo(() => (item ? claimDraft(item) : null), [item])
  const [shifts, setShifts] = React.useState<number | null>(null)
  const [reason, setReason] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [sent, setSent] = React.useState(false)

  // Each opening starts fresh (reset during render, so a stale form never shows for a frame).
  const key = item?.key ?? ''
  const [openedKey, setOpenedKey] = React.useState('')
  if (key !== openedKey) {
    setOpenedKey(key)
    setShifts(draft?.defaultShifts ?? null)
    setReason('')
    setError(null)
    setSent(false)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!draft) return
    setError(null)
    const problem = claimProblem(draft, shifts, reason)
    if (problem) return setError(problem)
    claim.mutate(claimBody(draft, shifts, reason), {
      onSuccess: () => {
        setSent(true)
        toast.success('Claim sent', { description: 'It is waiting for your Department Head.' })
      },
      onError: (err) => setError(errorText(err, 'Could not send your claim. Check your connection and try again.')),
    })
  }

  const kind = item ? kindInfo(item.kind) : null
  const passed = item?.minutes && item.kind !== 'ot_allowance' ? formatMinutes(item.minutes) : ''

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{sent ? 'Claim sent' : 'Claim compensation'}</DialogTitle>
          {!sent && <DialogDescription>{draft ? draft.what : 'This can no longer be claimed.'}</DialogDescription>}
        </DialogHeader>
        {sent ? (
          <SentState
            title="Your claim was sent."
            detail="It is waiting for your Department Head. You can follow it, or withdraw it while it waits, under Claims."
            onDone={onClose}
          />
        ) : !draft || !item ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">It may have been claimed already, or the time to claim it has passed. Refresh the page to see where it stands.</p>
            <Button variant="outline" onClick={onClose} className="min-h-11 sm:min-h-9">
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="flex flex-col gap-5">
            <div className="flex items-start gap-3 rounded-xl border border-foreground/10 bg-foreground/[0.03] p-3">
              {kind && (
                <span className={cn('grid size-10 shrink-0 place-items-center rounded-lg border', kind.chip)} aria-hidden="true">
                  <MarkerSymbol name={kind.symbol} className="size-5" />
                </span>
              )}
              <div className="min-w-0">
                <p className="label-caps text-muted-foreground">{draft.label}</p>
                <p className="mt-0.5 text-[14.5px] leading-snug font-semibold break-words">{item.title}</p>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  {dayText(draft.date)}
                  {passed ? ` · ${passed} past your shift end` : ''}
                  {draft.minutes ? ` · ${formatMinutes(draft.minutes)} allowance` : ''}
                  {draft.fixedShifts ? ` · ${formatShifts(draft.fixedShifts)}` : ''}
                </p>
              </div>
            </div>

            {draft.rejectedBefore && (
              <FormNote tone="waiting">Your earlier claim for this day was not approved. You can claim it again with a new reason.</FormNote>
            )}

            {draft.choices.length > 0 && (
              <div className="flex flex-col gap-2">
                <StepLabel
                  n={1}
                  id="claim-shifts"
                  hint={draft.kind === 'ot_shift' ? `Up to ${formatShifts(draft.choices[draft.choices.length - 1])} for this day` : 'Up to a full shift'}
                >
                  How much to claim?
                </StepLabel>
                <ChoiceTiles
                  name="claim-shifts"
                  labelledBy="claim-shifts"
                  columns={4}
                  value={shifts === null ? null : quarterValue(shifts)}
                  onChange={(v) => {
                    setShifts(Number(v))
                    setError(null)
                  }}
                  choices={QUARTERS.map((q) => ({
                    value: quarterValue(q),
                    label: formatShifts(q),
                    hint: QUARTER_HINT[quarterValue(q)],
                    disabled: !draft.choices.includes(q),
                    why: draft.choices.includes(q) ? null : 'More than this day earned',
                  }))}
                />
              </div>
            )}

            <TextareaField
              id="claim-reason"
              label="Reason"
              rows={3}
              maxLength={REASON_MAX}
              value={reason}
              placeholder="What was the work? Your Department Head reads this before deciding."
              onChange={(e) => {
                setReason(e.target.value)
                setError(null)
              }}
            />

            <FormNote>{draft.effect}</FormNote>
            <FormError>{error}</FormError>
            <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', PHONE_BUTTON_ROW)}>
              <Button type="button" variant="ghost" className={cn('min-h-11 sm:min-h-9', PHONE_NO_CANCEL)} onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" className={cn('min-h-11 sm:min-h-9', PHONE_SUBMIT)} disabled={claim.isPending}>
                {claim.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Hand aria-hidden="true" />}
                {claim.isPending ? 'Sending…' : 'Send claim'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ---- using the balance ----------------------------------------------------------------------------------------------

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-lg bg-foreground/[0.04] px-3 py-2 max-md:px-2.5">
      <dt className="label-caps text-muted-foreground max-md:text-[10.5px]">{label}</dt>
      <dd className={cn('mt-0.5 text-[14px] font-semibold tabular-nums max-md:text-[13px]', strong && 'text-violet')}>{value}</dd>
    </div>
  )
}

/** Ask to use the balance as a paid day off: the day (the request window), how much (quarters, up to what is free), a reason. */
export function UseBalanceDialog({
  open,
  onOpenChange,
  payload,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  payload: CompensationPayload | undefined
}) {
  const spend = useSpendBalance()
  const use = balanceUse(payload)
  const [date, setDate] = React.useState('')
  const [shifts, setShifts] = React.useState<number | null>(null)
  const [reason, setReason] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [sent, setSent] = React.useState<string | null>(null)

  // A fresh form every time the dialog opens (the largest amount the free balance allows, up to a full shift).
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setDate('')
      setShifts(use.choices.length ? use.choices[use.choices.length - 1] : null)
      setReason('')
      setError(null)
      setSent(null)
    }
  }

  const w = getRequestWindow(new Date())

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!use.allowed) return setError(use.blocked)
    const problem = balanceUseProblem({ date, shifts, reason }, use, new Date())
    if (problem || shifts === null) return setError(problem ?? 'Pick how much of your balance to use.')
    spend.mutate(
      { date, shifts, reason: reason.trim() },
      {
        onSuccess: () => {
          setSent(`${formatShifts(shifts)} for ${dayText(date)}. It is waiting for your Department Head; the shifts are held until then.`)
          toast.success('Request sent', { description: 'It is waiting for your Department Head.' })
        },
        onError: (err) => setError(errorText(err, 'Could not send your request. Check your connection and try again.')),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{sent ? 'Request sent' : 'Use my balance'}</DialogTitle>
          {!sent && <DialogDescription>Take a paid day off, or part of one, from your compensation balance. Your Department Head approves it.</DialogDescription>}
        </DialogHeader>
        {sent ? (
          <SentState title="Your request was sent." detail={sent} onDone={() => onOpenChange(false)} />
        ) : (
          <form onSubmit={submit} noValidate className="flex flex-col gap-5">
            <dl className="grid grid-cols-3 gap-2">
              <Figure label="Balance" value={formatShifts(use.balance) || '0.00 shift'} />
              <Figure label="Waiting" value={formatShifts(use.pending) || '0.00 shift'} />
              <Figure label="Free to use" value={formatShifts(use.available) || '0.00 shift'} strong />
            </dl>
            {use.blocked && <FormNote tone="waiting">{use.blocked}</FormNote>}

            <div className="flex flex-col gap-1.5">
              <StepLabel n={1}>Which day off?</StepLabel>
              <Label htmlFor="use-date" className="sr-only">
                Day off
              </Label>
              <Input
                id="use-date"
                type="date"
                min={w.min}
                max={w.max}
                value={date}
                aria-describedby="use-date-hint"
                disabled={!use.allowed}
                onChange={(e) => {
                  setDate(e.target.value)
                  setError(null)
                }}
              />
              <p id="use-date-hint" className="text-xs text-muted-foreground">
                {windowHint(w)}. A working day that is not already a full day off.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <StepLabel n={2} id="use-shifts" hint={`Up to ${formatShifts(Math.min(1, use.available)) || '0.00 shift'}`}>
                How much?
              </StepLabel>
              <ChoiceTiles
                name="use-shifts"
                labelledBy="use-shifts"
                columns={4}
                value={shifts === null ? null : quarterValue(shifts)}
                onChange={(v) => {
                  setShifts(Number(v))
                  setError(null)
                }}
                choices={QUARTERS.map((q) => ({
                  value: quarterValue(q),
                  label: formatShifts(q),
                  hint: QUARTER_HINT[quarterValue(q)],
                  disabled: !use.choices.includes(q),
                  why: use.choices.includes(q) ? null : 'More than you have free',
                }))}
              />
            </div>

            <TextareaField
              id="use-reason"
              label="Reason"
              rows={3}
              maxLength={REASON_MAX}
              value={reason}
              placeholder="Why you want the day off"
              disabled={!use.allowed}
              onChange={(e) => {
                setReason(e.target.value)
                setError(null)
              }}
            />

            <FormNote>
              Once your Department Head approves it, the shifts come off your balance and the day counts as paid. Until then they are
              held, so the same shifts cannot be asked for twice.
            </FormNote>
            <FormError>{error}</FormError>
            <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', PHONE_BUTTON_ROW)}>
              <Button type="button" variant="ghost" className={cn('min-h-11 sm:min-h-9', PHONE_NO_CANCEL)} onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" className={cn('min-h-11 sm:min-h-9', PHONE_SUBMIT)} disabled={spend.isPending || !use.allowed}>
                {spend.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CalendarCheck aria-hidden="true" />}
                {spend.isPending ? 'Sending…' : 'Send request'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** The balance, what is waiting and what is free, and the "Use my balance" button (off, with the reason, when it cannot be used). */
function BalanceUseCard({ payload, onUse }: { payload: CompensationPayload; onUse: () => void }) {
  const use = balanceUse(payload)
  return (
    <GlassCard variant="stitched" tone="violet" className="flex flex-col gap-4 self-start max-md:gap-3" data-testid="compensation-use-balance">
      <SectionHeader
        as="h3"
        icon={Wallet}
        tone="violet"
        title="Use my balance"
        description="Take a paid day off, or part of one, from your compensation balance. Your Department Head approves it."
      />
      <dl className="grid grid-cols-3 gap-2">
        <Figure label="Balance" value={formatShifts(use.balance) || '0.00 shift'} />
        <Figure label="Waiting" value={formatShifts(use.pending) || '0.00 shift'} />
        <Figure label="Free to use" value={formatShifts(use.available) || '0.00 shift'} strong />
      </dl>
      {use.blocked && <p className="text-[13px] text-muted-foreground max-md:text-[12.5px]">{use.blocked}</p>}
      <Button onClick={onUse} disabled={!use.allowed} className="min-h-11 sm:min-h-9 max-md:h-11 max-md:rounded-xl max-md:font-bold">
        <CalendarCheck aria-hidden="true" /> Use my balance
      </Button>
    </GlassCard>
  )
}

// ---- my claims ------------------------------------------------------------------------------------------------------

function WithdrawDialog({ claim, onClose }: { claim: MyClaim | null; onClose: () => void }) {
  const withdraw = useWithdrawClaim()
  const [error, setError] = React.useState<string | null>(null)
  const key = claim ? claim.key : ''
  const [openedKey, setOpenedKey] = React.useState('')
  if (key !== openedKey) {
    setOpenedKey(key)
    setError(null)
  }

  function confirm() {
    if (!claim) return
    setError(null)
    withdraw.mutate(claim.id, {
      onSuccess: () => {
        toast.success('Claim withdrawn')
        onClose()
      },
      onError: (err) => setError(errorText(err, 'Could not withdraw it. Check your connection and try again.')),
    })
  }

  return (
    <Dialog open={!!claim} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Withdraw this claim?</DialogTitle>
          <DialogDescription>
            {claim ? [claim.kindLabel, claimAmount(claim), claim.date ? dayText(claim.date) : ''].filter(Boolean).join(' · ') : ''}
          </DialogDescription>
        </DialogHeader>
        <p className="text-[13.5px] text-muted-foreground">
          It stops waiting for your Department Head. {claim?.kind === 'use_balance' ? 'The held shifts go back to your balance.' : 'You can claim the day again while it is still open.'}
        </p>
        <FormError>{error}</FormError>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={withdraw.isPending} className="min-h-11 sm:min-h-9">
            Keep it
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={withdraw.isPending} className="min-h-11 sm:min-h-9">
            {withdraw.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Undo2 aria-hidden="true" />}
            {withdraw.isPending ? 'Withdrawing…' : 'Yes, withdraw'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ClaimRow({ claim, onWithdraw }: { claim: MyClaim; onWithdraw: (c: MyClaim) => void }) {
  const kind = kindInfo(CLAIM_ITEM_KIND[claim.kind] ?? claim.kind)
  const status = claimStatusInfo(claim)
  const amount = claimAmount(claim)
  const when = claimDateLine(claim)
  const raised = claimRaisedByText(claim)
  const decision = claimDecisionLine(claim)
  const sentOn = claim.createdAt && /^\d{4}-\d{2}-\d{2}/.test(claim.createdAt) ? dayText(claim.createdAt.slice(0, 10)) : null
  return (
    <GlassCard padding="sm" className="flex flex-col gap-2 max-md:p-3.5!" data-testid="my-claim" data-focus-key={focusKey('claim', claim.key)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={cn('chip', kind.chip)}>
          <MarkerSymbol name={kind.symbol} className="size-[13px]" />
          {claim.kindLabel}
        </span>
        <span className={cn('chip', status.chip)}>
          <span className={cn('pip', status.live && 'pip-live')} />
          {status.label}
        </span>
      </div>
      <p className="text-[14.5px] font-semibold max-md:text-[13.5px]">{[amount, when].filter(Boolean).join(' · ') || claim.kindLabel}</p>
      {claim.reason && <p className="line-clamp-3 text-[13px] text-foreground/80 italic max-md:text-[12.5px]">“{claim.reason}”</p>}
      {decision && (
        <p className={cn('text-[13px] font-medium max-md:text-[12.5px]', claim.status === 'approved' ? 'text-approved' : 'text-rejected')}>{decision}</p>
      )}
      {(raised || sentOn || claim.canWithdraw) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px] text-muted-foreground">
          <span className="min-w-0 flex-1">{[raised, sentOn ? `sent ${sentOn}` : null].filter(Boolean).join(' · ')}</span>
          {claim.canWithdraw && (
            <Button variant="outline" size="sm" onClick={() => onWithdraw(claim)} className="min-h-11 sm:min-h-8 max-md:h-9 max-md:min-h-9">
              <Undo2 aria-hidden="true" /> Withdraw
            </Button>
          )}
        </div>
      )}
    </GlassCard>
  )
}

function MyClaimsList({ query }: { query: ReturnType<typeof useMyCompensationClaims> }) {
  const [filter, setFilter] = React.useState<ClaimFilterId>('all')
  const [withdrawing, setWithdrawing] = React.useState<MyClaim | null>(null)
  const claims = query.data
  const options = claims ? claimFilterOptions(claims) : []
  const active = options.some((o) => o.id === filter) ? filter : 'all'
  const shown = claims ? applyClaimFilter(claims, active) : []

  return (
    <section aria-labelledby="my-claims-title" className="flex flex-col gap-3">
      <SectionHeader
        id="my-claims-title"
        icon={Inbox}
        title="My claims"
        count={claims?.length}
        description="Everything you or HR claimed for you, newest first. Withdraw one while it is still waiting."
      />
      {query.isPending ? (
        <SkeletonList variant="cards" count={2} label="Loading your claims" />
      ) : !claims ? (
        <ErrorState error={query.error} what="your claims" onRetry={() => query.refetch()} retrying={query.isFetching} />
      ) : claims.length === 0 ? (
        <EmptyState compact icon={Inbox} tone="violet" title="No claims yet" description="Claims you send, and the ones HR raises for you, show up here." />
      ) : (
        <>
          {query.isError && (
            <ErrorState title="Could not refresh" error={query.error} what="your claims" onRetry={() => query.refetch()} retrying={query.isFetching} compact />
          )}
          {options.length > 2 && (
            <div
              role="group"
              aria-label="Show claims"
              className="flex flex-wrap gap-2 max-md:-mx-4 max-md:flex-nowrap max-md:overflow-x-auto max-md:px-4 max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden"
            >
              {options.map((o) => {
                const selected = o.id === active
                return (
                  <button
                    key={o.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setFilter(o.id)}
                    className={cn(
                      'font-label focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition-colors pointer-coarse:min-h-11 max-md:min-h-9 max-md:shrink-0 max-md:pr-1.5 max-md:pl-3',
                      selected ? 'border-transparent bg-brand-gradient text-white' : 'border-foreground/15 text-foreground/80 hover:border-primary/50 hover:bg-primary/10',
                      phoneChipClass(selected),
                    )}
                  >
                    {o.label}
                    <span className={cn('tabular-nums', selected ? 'text-white/85' : 'text-muted-foreground', phoneCountClass(selected))}>{o.count}</span>
                  </button>
                )
              })}
            </div>
          )}
          <ul className="grid gap-3 max-md:gap-2.5 xl:grid-cols-2">
            {shown.map((c, i) => (
              <motion.li key={c.key} {...listItem(i)} className="min-w-0">
                <ClaimRow claim={c} onWithdraw={setWithdrawing} />
              </motion.li>
            ))}
          </ul>
        </>
      )}
      <WithdrawDialog claim={withdrawing} onClose={() => setWithdrawing(null)} />
    </section>
  )
}

// ---- the Claims view ------------------------------------------------------------------------------------------------

/**
 * The Claims view (only while the server says `canClaim`): what can be claimed now (each with Claim), the balance with
 * "Use my balance", and every claim with where it stands (Withdraw while waiting).
 */
export function ClaimsPanel({
  payload,
  claimsQuery,
  onClaim,
  onUseBalance,
}: {
  payload: CompensationPayload
  claimsQuery: ReturnType<typeof useMyCompensationClaims>
  onClaim: (item: CompensationItem) => void
  onUseBalance: () => void
}) {
  const ready = claimableItems(payload)
  const days = payload.claimWindowDays
  return (
    <div className="flex flex-col gap-6 max-md:gap-4" data-testid="compensation-claims">
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <section aria-labelledby="ready-title" className="flex min-w-0 flex-col gap-3">
          <SectionHeader
            id="ready-title"
            icon={Hand}
            title="Ready to claim"
            count={ready.length}
            description={`${days ? `Claim within ${days} days of the day. ` : ''}Your Department Head approves each claim.`}
          />
          {ready.length === 0 ? (
            <EmptyState
              compact
              icon={Hand}
              tone="emerald"
              title="Nothing to claim right now"
              description="When you work past your shift end, or on a Sunday or a company holiday, it shows up here to claim. A worked birthday is not claimed: place its day under Birthday."
            />
          ) : (
            ready.map((item, i) => (
              <motion.div key={item.key} {...listItem(i)}>
                <CompensationItemCard item={item} onClaim={onClaim} />
              </motion.div>
            ))
          )}
        </section>
        <BalanceUseCard payload={payload} onUse={onUseBalance} />
      </div>
      <MyClaimsList query={claimsQuery} />
    </div>
  )
}
