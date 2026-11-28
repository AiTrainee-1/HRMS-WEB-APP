import * as React from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { ArrowRight, CakeSlice, CalendarCheck, CheckCircle2, Inbox, Info, Loader2, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState, ErrorState, GlassCard, SectionHeader, SkeletonList, listItem } from '@/components/kit'
import { TextareaField } from '@/components/employee/TextareaField'
import { ChoiceTiles, FormError, FormNote, SentState, StepLabel } from '@/components/requests/FormBits'
import { PHONE_BUTTON_ROW, PHONE_NO_CANCEL, PHONE_SUBMIT } from '@/components/requests/phone'
import { ApiError } from '@/api/client'
import { usePlaceBirthdayComp, useWithdrawBirthdayUse, type useBirthdayEntitlement, type useBirthdayUses } from '@/hooks/useBirthdayCompensation'
import {
  BDC_REASON_MAX,
  WEEKDAYS,
  bdcBalanceText,
  bdcCalendar,
  bdcFigures,
  bdcReady,
  dayLine,
  daysText,
  defaultPortion,
  placeBlocked,
  placeBody,
  placeProblem,
  placedText,
  placementDecisionLine,
  placementRaisedText,
  placementStatusInfo,
  placementWhatLine,
  portionChoices,
  shortDay,
  stateInfo,
  withdrawEffectText,
  type BdcCell,
  type BdcEntitlement,
  type BdcUse,
  type Portion,
} from '@/lib/birthday-compensation'
import { claimErrorText } from '@/lib/compensation-claims'
import { focusKey } from '@/lib/focus-item'
import { dayText } from '@/lib/my-requests'
import { cn } from '@/lib/utils'

const errorText = (err: unknown, fallback: string) => claimErrorText(err instanceof ApiError ? err : null, fallback)

// ---- the note on top of the other views -------------------------------------------------------------------------------

/** "You have 1.00 day of Birthday Compensation to place by 31 Mar.": on top of every other view while it can be placed. */
export function BirthdayReadyBanner({ ent, onOpen }: { ent: BdcEntitlement | null | undefined; onOpen: () => void }) {
  if (!ent || !bdcReady(ent)) return null
  const by = shortDay(ent.lapsesOn)
  return (
    <GlassCard
      role="status"
      padding="sm"
      className="flex items-center gap-3 border-violet-border bg-violet-bg/60 max-md:flex-col max-md:items-stretch max-md:gap-2.5 max-md:border-0! max-md:bg-violet-bg! max-md:shadow-none!"
      data-testid="birthday-comp-ready"
    >
      <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--brand-violet)] text-background max-md:hidden">
        <CakeSlice className="size-[18px]" />
      </span>
      <p className="min-w-0 flex-1 text-[14px] font-semibold max-md:text-[13px]">
        You have {daysText(ent.days.available)} of Birthday Compensation to place{by ? ` by ${by}` : ''}.{' '}
        <span className="font-normal text-muted-foreground">Your Department Head, then HR, approve it.</span>
      </p>
      <Button size="sm" onClick={onOpen} className="min-h-11 sm:min-h-8 max-md:h-10 max-md:w-full max-md:rounded-xl max-md:font-bold">
        Use my birthday day <ArrowRight aria-hidden="true" />
      </Button>
    </GlassCard>
  )
}

// ---- the card: the birthday and its 1.00 day ----------------------------------------------------------------------------

const BAR_TONE: Record<string, string> = {
  used: 'bg-success',
  held: 'bg-warning',
  available: 'bg-primary',
  lapsed: 'bg-muted-foreground/50',
}

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-lg bg-foreground/[0.04] px-3 py-2 max-md:px-2.5">
      <dt className="label-caps text-muted-foreground max-md:text-[10.5px]">{label}</dt>
      <dd className={cn('mt-0.5 text-[14px] font-semibold tabular-nums max-md:text-[13px]', strong && 'text-violet')}>{value}</dd>
    </div>
  )
}

/** The birthday, where its 1.00 day stands (to place / waiting / approved / lapsed) and the "Choose the day" button. */
function BirthdayCard({ ent, onPlace }: { ent: BdcEntitlement; onPlace: () => void }) {
  const state = stateInfo(ent)
  const figures = bdcFigures(ent)
  const balance = bdcBalanceText(ent)
  const blocked = placeBlocked(ent)
  const ready = bdcReady(ent)
  const total = ent.days.total || 1
  return (
    <GlassCard variant="stitched" tone="violet" className="flex min-w-0 flex-col gap-4 self-start max-md:gap-3" data-testid="birthday-comp-card">
      <SectionHeader
        as="h3"
        icon={CakeSlice}
        tone="violet"
        title="Use my birthday day"
        description="Worked on your birthday? Place its 1.00 day on working days of your birthday month: a full day, or two halves."
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[14.5px] font-semibold max-md:text-[13.5px]">
          <span className="font-normal text-muted-foreground">Your birthday: </span>
          {ent.birthdayText ?? (ent.birthday ? dayText(ent.birthday) : 'not on your record')}
        </p>
        <span className={cn('chip', state.chip)}>
          <span className={cn('pip', state.live && 'pip-live')} />
          {state.label}
        </span>
      </div>
      {ent.message && <p className="text-[13.5px] text-foreground/85 max-md:text-[12.5px] max-md:leading-[18px]">{ent.message}</p>}
      {figures.length > 0 && (
        <>
          <dl className={cn('grid gap-2', figures.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3')}>
            {figures.map((f) => (
              <Figure key={f.key} label={f.label} value={f.text} strong={f.key === 'available'} />
            ))}
          </dl>
          {/* The 1.00 day as one bar (the figures above say the same in words). */}
          <div aria-hidden="true" className="flex h-2 overflow-hidden rounded-full bg-foreground/[0.06]">
            {(['used', 'held', 'available', 'lapsed'] as const).map((k) =>
              ent.days[k] > 0 ? <span key={k} className={BAR_TONE[k]} style={{ width: `${Math.min(100, (ent.days[k] / total) * 100)}%` }} /> : null,
            )}
          </div>
          {balance && <p className="text-[12.5px] font-semibold text-muted-foreground">{balance}</p>}
        </>
      )}
      {blocked && blocked !== ent.message && <p className="text-[13px] text-muted-foreground max-md:text-[12.5px]">{blocked}</p>}
      {(ready || figures.length > 0) && (
        <Button onClick={onPlace} disabled={!ready} className="min-h-11 sm:min-h-9 max-md:h-11 max-md:rounded-xl max-md:font-bold" data-testid="birthday-comp-place">
          <CalendarCheck aria-hidden="true" /> Choose the day
        </Button>
      )}
    </GlassCard>
  )
}

const RULES = [
  'Not at work on your birthday (absent or on approved leave): it is paid birthday leave on the day, on its own.',
  'Worked on your birthday, even half a day: you get 1.00 day of Birthday Compensation to place, as a full day or as a first and a second half (the two halves may go on different days).',
  'Only working days of your birthday month: a day still to come, or a past day you were absent, on leave or worked only half of.',
  'Your Department Head approves it first, then HR. Once HR approves, that day (or half) is paid like a Casual Leave: no leave balance is used.',
  'Whatever is not placed by the last day of the month lapses.',
]

function RulesCard({ path }: { path: string | null }) {
  return (
    <GlassCard className="flex min-w-0 flex-col gap-3 self-start max-md:gap-2.5" data-testid="birthday-comp-rules">
      <SectionHeader as="h3" icon={Info} title="How it works" description={path ? `Approval: ${path}` : undefined} />
      <ul className="flex flex-col gap-2 text-[13px] text-muted-foreground max-md:gap-[9px] max-md:text-[12.5px] max-md:leading-[18px] max-md:text-secondary-foreground">
        {RULES.map((r) => (
          <li key={r} className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-[15px] shrink-0 text-approved" aria-hidden="true" />
            <span>{r}</span>
          </li>
        ))}
      </ul>
    </GlassCard>
  )
}

// ---- the placements -------------------------------------------------------------------------------------------------------

function WithdrawPlacementDialog({ use, onClose }: { use: BdcUse | null; onClose: () => void }) {
  const withdraw = useWithdrawBirthdayUse()
  const [error, setError] = React.useState<string | null>(null)
  const key = use ? use.key : ''
  const [openedKey, setOpenedKey] = React.useState('')
  if (key !== openedKey) {
    setOpenedKey(key)
    setError(null)
  }

  function confirm() {
    if (!use) return
    setError(null)
    withdraw.mutate(use.id, {
      onSuccess: () => {
        toast.success('Request withdrawn', { description: 'You can place that part again while the month lasts.' })
        onClose()
      },
      onError: (err) => setError(errorText(err, 'Could not withdraw it. Check your connection and try again.')),
    })
  }

  return (
    <Dialog open={!!use} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Withdraw this request?</DialogTitle>
          <DialogDescription>{use ? `Birthday compensation · ${placementWhatLine(use)}` : ''}</DialogDescription>
        </DialogHeader>
        <p className="text-[13.5px] text-muted-foreground">{use ? withdrawEffectText(use) : ''}</p>
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

function PlacementRow({ use, onWithdraw }: { use: BdcUse; onWithdraw: (u: BdcUse) => void }) {
  const status = placementStatusInfo(use)
  const decision = placementDecisionLine(use)
  const raised = placementRaisedText(use)
  const sentOn = use.createdAt && /^\d{4}-\d{2}-\d{2}/.test(use.createdAt) ? dayText(use.createdAt.slice(0, 10)) : null
  return (
    <GlassCard
      padding="sm"
      className="flex flex-col gap-2 max-md:p-3.5!"
      data-testid="birthday-comp-use"
      data-focus-key={focusKey('bdc', use.key)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="chip chip-rose">
          <CakeSlice className="size-[13px]" aria-hidden="true" />
          Birthday compensation
        </span>
        <span className={cn('chip', status.chip)}>
          <span className={cn('pip', status.live && 'pip-live')} />
          {status.label}
        </span>
      </div>
      <p className="text-[14.5px] font-semibold max-md:text-[13.5px]">{placementWhatLine(use)}</p>
      {use.birthdayText && <p className="text-[12.5px] text-muted-foreground">For your birthday, {use.birthdayText}</p>}
      {use.reason && <p className="line-clamp-3 text-[13px] text-foreground/80 italic max-md:text-[12.5px]">“{use.reason}”</p>}
      {decision && (
        <p
          className={cn(
            'text-[13px] font-medium max-md:text-[12.5px]',
            use.status === 'approved' ? 'text-approved' : use.status === 'rejected' ? 'text-rejected' : 'text-info',
          )}
        >
          {decision}
        </p>
      )}
      {(raised || sentOn || use.canWithdraw) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px] text-muted-foreground">
          <span className="min-w-0 flex-1">{[raised, sentOn ? `sent ${sentOn}` : null].filter(Boolean).join(' · ')}</span>
          {use.canWithdraw && (
            <Button variant="outline" size="sm" onClick={() => onWithdraw(use)} className="min-h-11 sm:min-h-8 max-md:h-9 max-md:min-h-9">
              <Undo2 aria-hidden="true" /> Withdraw
            </Button>
          )}
        </div>
      )}
    </GlassCard>
  )
}

function PlacementsList({ query }: { query: ReturnType<typeof useBirthdayUses> }) {
  const [withdrawing, setWithdrawing] = React.useState<BdcUse | null>(null)
  const uses = query.data
  return (
    <section aria-labelledby="bdc-uses-title" className="flex flex-col gap-3">
      <SectionHeader
        id="bdc-uses-title"
        icon={Inbox}
        title="My birthday compensation"
        count={uses?.length}
        description="Every day you (or HR) placed it on, newest first. Withdraw one while it is still waiting."
      />
      {query.isPending ? (
        <SkeletonList variant="cards" count={2} label="Loading your birthday compensation" />
      ) : uses === null ? (
        <p className="text-[13px] text-muted-foreground">This list shows once the server is updated.</p>
      ) : !uses ? (
        <ErrorState error={query.error} what="your birthday compensation" onRetry={() => query.refetch()} retrying={query.isFetching} />
      ) : uses.length === 0 ? (
        <EmptyState compact icon={CakeSlice} tone="violet" title="Nothing placed yet" description="The days you place your Birthday Compensation on show up here, with where each one stands." />
      ) : (
        <>
          {query.isError && (
            <ErrorState title="Could not refresh" error={query.error} what="your birthday compensation" onRetry={() => query.refetch()} retrying={query.isFetching} compact />
          )}
          <ul className="grid gap-3 max-md:gap-2.5 xl:grid-cols-2">
            {uses.map((u, i) => (
              <motion.li key={u.key} {...listItem(i)} className="min-w-0">
                <PlacementRow use={u} onWithdraw={setWithdrawing} />
              </motion.li>
            ))}
          </ul>
        </>
      )}
      <WithdrawPlacementDialog use={withdrawing} onClose={() => setWithdrawing(null)} />
    </section>
  )
}

// ---- the Birthday view ------------------------------------------------------------------------------------------------------

/**
 * The Birthday view of the Compensation page (2026-11-25): this year's birthday with its 1.00 day of Birthday
 * Compensation and "Choose the day", how it works, and every placement with where it stands (Withdraw while waiting).
 */
export function BirthdayPanel({
  entQuery,
  usesQuery,
  onPlace,
}: {
  entQuery: ReturnType<typeof useBirthdayEntitlement>
  usesQuery: ReturnType<typeof useBirthdayUses>
  onPlace: () => void
}) {
  const ent = entQuery.data
  return (
    <div className="flex flex-col gap-6 max-md:gap-4" data-testid="birthday-compensation">
      {entQuery.isPending ? (
        <SkeletonList variant="cards" count={2} label="Loading your birthday compensation" />
      ) : !ent ? (
        <ErrorState error={entQuery.error} what="your birthday compensation" onRetry={() => entQuery.refetch()} retrying={entQuery.isFetching} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <BirthdayCard ent={ent} onPlace={onPlace} />
          <RulesCard path={ent.approvalPath} />
        </div>
      )}
      {entQuery.isError && ent && (
        <ErrorState title="Could not refresh" error={entQuery.error} what="your birthday compensation" onRetry={() => entQuery.refetch()} retrying={entQuery.isFetching} compact />
      )}
      <PlacementsList query={usesQuery} />
    </div>
  )
}

// ---- choosing the day -------------------------------------------------------------------------------------------------------

/** Past days to make up (absent, on leave, half day) in amber; days still to come in sapphire. */
const PAST_TO_MAKE_UP = new Set(['absent', 'on_leave', 'half_shift'])

function cellAria(cell: BdcCell, selected: boolean): string {
  const parts = [dayText(cell.date), cell.today ? 'today' : null, cell.birthday ? 'your birthday' : null, cell.info?.label ?? null]
  parts.push(cell.selectable ? (selected ? 'chosen' : 'can be chosen') : 'cannot be chosen')
  if (cell.placed.length) parts.push('already has Birthday Compensation')
  return parts.filter(Boolean).join(', ')
}

/** The birthday month as a calendar: days that can take it stand out, the others are greyed (a tap says why). */
function BirthdayCalendar({
  cells,
  selected,
  onTap,
}: {
  cells: (BdcCell | null)[]
  selected: string
  onTap: (cell: BdcCell) => void
}) {
  return (
    <div>
      <div className="mb-1.5 grid grid-cols-7 gap-1 sm:gap-1.5" aria-hidden="true">
        {WEEKDAYS.map((w) => (
          <div key={w} className="label-caps py-1 text-center text-muted-foreground max-md:py-0 max-md:text-[10px]! max-md:font-[800]!">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5" role="group" aria-label="Days of your birthday month">
        {cells.map((cell, i) => {
          if (!cell) return <div key={`blank-${i}`} aria-hidden="true" />
          const isSelected = cell.date === selected
          const past = !!cell.info && PAST_TO_MAKE_UP.has(cell.info.status)
          return (
            <button
              key={cell.date}
              type="button"
              onClick={() => onTap(cell)}
              aria-pressed={cell.selectable ? isSelected : undefined}
              aria-disabled={cell.selectable ? undefined : true}
              aria-label={cellAria(cell, isSelected)}
              title={cell.selectable ? cell.info?.label : (cell.info?.reason ?? cell.info?.label ?? undefined)}
              className={cn(
                'focus-ring relative flex aspect-square w-full min-h-10 items-center justify-center rounded-lg border text-[13px] font-semibold tabular-nums transition-colors max-md:min-h-9 max-md:rounded-md max-md:text-[12px]',
                isSelected
                  ? 'border-transparent bg-brand-gradient text-white shadow-clay-sm'
                  : cell.selectable
                    ? past
                      ? 'border-waiting-border bg-waiting-bg text-waiting hover:border-warning'
                      : 'border-info-border bg-info-bg text-info hover:border-primary'
                    : 'cursor-default border-transparent bg-foreground/[0.03] text-muted-foreground/55',
                cell.today && 'outline-2 outline-offset-2 outline-primary',
              )}
            >
              <span>{cell.day}</span>
              {cell.birthday && (
                <CakeSlice className={cn('absolute top-0.5 right-0.5 size-3 sm:top-1 sm:right-1', isSelected ? 'text-white' : 'text-rose-600 dark:text-rose-300')} aria-hidden="true" />
              )}
              {cell.placed.length > 0 && (
                <span className={cn('absolute bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full ring-1 ring-card', isSelected ? 'bg-white' : 'bg-violet-500')} aria-hidden="true" />
              )}
            </button>
          )
        })}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px] text-muted-foreground" aria-label="What the colours mean">
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm border border-info-border bg-info-bg" aria-hidden="true" /> Still to come
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm border border-waiting-border bg-waiting-bg" aria-hidden="true" /> Missed (absent, leave, half day)
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-foreground/[0.06]" aria-hidden="true" /> Cannot be chosen
        </li>
        <li className="flex items-center gap-1.5">
          <CakeSlice className="size-3 text-rose-600 dark:text-rose-300" aria-hidden="true" /> Your birthday
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-violet-500" aria-hidden="true" /> Already placed
        </li>
      </ul>
    </div>
  )
}

/**
 * "Use my birthday day": the day (the birthday month as a calendar; a greyed day says why it cannot be chosen), the part
 * (full day / first half / second half, only what that day and what is left allow), an optional reason; then "sent".
 * The server checks everything again; its refusal is shown in its own words.
 */
export function PlaceBirthdayDialog({
  open,
  onOpenChange,
  ent,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  ent: BdcEntitlement | null | undefined
}) {
  const place = usePlaceBirthdayComp()
  const [date, setDate] = React.useState('')
  // A greyed day the person tapped: its reason shows under the calendar.
  const [tapped, setTapped] = React.useState('')
  const [portion, setPortion] = React.useState<Portion | null>(null)
  const [reason, setReason] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [sent, setSent] = React.useState<string | null>(null)

  // A fresh form every time the dialog opens.
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setDate('')
      setTapped('')
      setPortion(null)
      setReason('')
      setError(null)
      setSent(null)
    }
  }

  const cells = bdcCalendar(ent)
  const available = ent?.days.available ?? 0
  const day = ent?.eligibleDates.find((d) => d.date === date) ?? null
  const tappedDay = ent?.eligibleDates.find((d) => d.date === tapped) ?? null
  const choices = portionChoices(day, available)
  const blocked = ent && !bdcReady(ent) ? placeBlocked(ent) : null
  const month = ent?.month?.label ?? 'your birthday month'

  function tap(cell: BdcCell) {
    setError(null)
    setTapped(cell.date)
    if (!cell.selectable || !cell.info) return
    setDate(cell.date)
    setPortion(defaultPortion(cell.info, available))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const form = { date, portion, reason }
    const problem = placeProblem(form, ent)
    if (problem || !portion) return setError(problem ?? 'Pick a full day, a first half or a second half.')
    place.mutate(placeBody({ ...form, portion }), {
      onSuccess: () => {
        setSent(`${placedText({ date, portion })}. It is waiting for your Department Head, then HR. You can withdraw it while it waits.`)
        toast.success('Request sent', { description: 'It is waiting for your Department Head.' })
      },
      onError: (err) => setError(errorText(err, 'Could not send your request. Check your connection and try again.')),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{sent ? 'Request sent' : 'Use my birthday day'}</DialogTitle>
          {!sent && (
            <DialogDescription>
              Place your Birthday Compensation on a working day of {month}. Your Department Head approves it, then HR.
            </DialogDescription>
          )}
        </DialogHeader>
        {sent ? (
          <SentState title="Your request was sent." detail={sent} onDone={() => onOpenChange(false)} />
        ) : !ent || !cells ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">Your birthday month could not be read. Refresh the page and try again.</p>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="min-h-11 sm:min-h-9">
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="flex flex-col gap-5">
            <dl className="grid grid-cols-3 gap-2">
              <Figure label="To place" value={daysText(available)} strong />
              <Figure label="Waiting" value={daysText(ent.days.held)} />
              <Figure label="Lapses" value={shortDay(ent.lapsesOn) || '—'} />
            </dl>
            {blocked && <FormNote tone="waiting">{blocked}</FormNote>}

            <div className="flex flex-col gap-2">
              <StepLabel n={1} id="bdc-day" hint={month}>
                Which day?
              </StepLabel>
              <BirthdayCalendar cells={cells} selected={date} onTap={tap} />
              <div aria-live="polite">
                {tappedDay && !tappedDay.selectable ? (
                  <FormNote tone="waiting">{dayLine(tappedDay)}</FormNote>
                ) : day ? (
                  <p className="text-[13px] font-semibold text-foreground/85" data-testid="bdc-picked-day">
                    {dayLine(day)}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Tap a coloured day. Tap a grey one to see why it cannot be chosen.</p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <StepLabel n={2} id="bdc-part" hint={`${daysText(available)} left`}>
                Which part?
              </StepLabel>
              <ChoiceTiles
                name="bdc-part"
                labelledBy="bdc-part"
                columns={3}
                value={portion}
                onChange={(v) => {
                  setPortion(v)
                  setError(null)
                }}
                choices={choices.map((c) => ({ value: c.portion, label: c.label, hint: c.hint, disabled: !c.allowed, why: day ? c.why : null }))}
              />
            </div>

            <TextareaField
              id="bdc-reason"
              label="Reason (optional)"
              rows={3}
              maxLength={BDC_REASON_MAX}
              value={reason}
              placeholder="Anything your Department Head and HR should know"
              onChange={(e) => {
                setReason(e.target.value)
                setError(null)
              }}
            />

            <FormNote>
              Once your Department Head and then HR approve it, that day (or half) is paid like a Casual Leave: no leave balance is
              used. Until then it is held, so the same part cannot be placed twice.
              {ent.lapsesOn ? ` What is not placed by ${shortDay(ent.lapsesOn)} lapses.` : ''}
            </FormNote>
            <FormError>{error}</FormError>
            <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', PHONE_BUTTON_ROW)}>
              <Button type="button" variant="ghost" className={cn('min-h-11 sm:min-h-9', PHONE_NO_CANCEL)} onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" className={cn('min-h-11 sm:min-h-9', PHONE_SUBMIT)} disabled={place.isPending || !bdcReady(ent)}>
                {place.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CalendarCheck aria-hidden="true" />}
                {place.isPending ? 'Sending…' : 'Send request'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
