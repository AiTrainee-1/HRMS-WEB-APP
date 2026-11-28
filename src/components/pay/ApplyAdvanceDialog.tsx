import * as React from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, ArrowLeft, ArrowRight, CalendarClock, CheckCircle2, Info, Landmark, Loader2, LockKeyhole, Send, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { EASE_OUT, RingMeter, SegmentedControl, SuccessCheck, staggerDelay } from '@/components/kit'
import { ApiError } from '@/api/client'
import { EarnedBasisPanel, TermLoanBlockNote } from '@/components/pay/AdvanceParts'
import { useApplyAdvance } from '@/hooks/useAdvances'
import { formatINR, formatINRCompact } from '@/lib/money'
import { cn } from '@/lib/utils'
import {
  ABSOLUTE_MAX_MONTHS,
  MAX_PURPOSE,
  TYPE_LABEL,
  amountOf,
  applyForms,
  applyRefusal,
  approvalNoteText,
  defaultTermMonths,
  formatAmountInput,
  limitMeter,
  monthLabel,
  planSummary,
  ordinal,
  purposeProblem,
  reviewSentence,
  salaryAdvanceDaysOf,
  salaryAdvanceProblem,
  salaryAdvanceThroughDay,
  salaryAdvanceWindow,
  termAmountProblem,
  termLoanLimitText,
  termLoanWindow,
  termMonthChoices,
  termPlan,
  windowChip,
  type AdvanceEligibility,
  type AdvanceType,
  type ApplyField,
  type MyAdvance,
  type PlanItem,
} from '@/lib/advances'

type Step = 'form' | 'confirm' | 'done'

const METER_TONE = { empty: 'sapphire', ok: 'emerald', near: 'amber', over: 'rose' } as const

/** The Term Loan's months as small columns (one per EMI, the last one smaller), amounts written under them. */
function PlanBars({ plan }: { plan: readonly PlanItem[] }) {
  const top = Math.max(1, ...plan.map((p) => p.amount))
  return (
    <div>
      <ol aria-label="Deductions month by month" className="flex h-28 items-end gap-1 sm:gap-1.5">
        {plan.map((p, i) => (
          <li key={`${p.year}-${p.month}`} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[10px] font-semibold text-muted-foreground tabular-nums max-sm:hidden">{formatINRCompact(p.amount)}</span>
            <motion.span
              aria-hidden="true"
              className="w-full origin-bottom rounded-t-md bg-linear-to-t from-primary/70 to-violet/70"
              style={{ height: `${Math.max(8, (p.amount / top) * 70)}%` }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.4, ease: EASE_OUT, delay: staggerDelay(i, 0.03, 12) }}
            />
            <span className="w-full truncate text-center text-[10px] text-muted-foreground">
              {p.label.split(' ')[0]}
              <span className="sr-only">
                {' '}
                {p.year}: {formatINR(p.amount)}
              </span>
            </span>
          </li>
        ))}
      </ol>
      {/* Phones: every deduction month written out under the columns, as in the app (the column amounts are hidden there). */}
      <ul className="hidden max-md:mt-2 max-md:block max-md:border-t max-md:border-border max-md:pt-1.5" aria-hidden="true">
        {plan.map((p) => (
          <li key={`row-${p.year}-${p.month}`} className="max-md:flex max-md:justify-between max-md:py-[5px] max-md:text-[13px]">
            <span className="max-md:text-secondary-foreground">{monthLabel(p.month, p.year)} salary</span>
            <span className="max-md:font-semibold max-md:tabular-nums">{formatINR(p.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The months grid's columns: one per choice up to 6 (a phone row holds 6), then 6 on phones and one per choice from
 *  640px. Whole class names, so Tailwind sees them. */
const MONTH_COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
  7: 'grid-cols-6 sm:grid-cols-7',
  8: 'grid-cols-6 sm:grid-cols-8',
  9: 'grid-cols-6 sm:grid-cols-9',
  10: 'grid-cols-6 sm:grid-cols-10',
  11: 'grid-cols-6 sm:grid-cols-11',
  12: 'grid-cols-6 sm:grid-cols-12',
}

/**
 * Salary Advance / Term Loan application: the form (live ₹ formatting, the limit ring with what the limit is taken from -
 * a % of the salary earned 1st-20th - the Term Loan's limit, months and EMI preview), a confirmation in plain words, then
 * the success state. The server decides; a refusal is shown in its own words, next to the field it names (`field`), and
 * any answer from the server takes the employee back to the form with the eligibility asked again (409 duplicate /
 * active / yearly, 400 window_closed / over_limit, 403 service ...).
 */
export function ApplyAdvanceDialog({
  open,
  onOpenChange,
  initialType,
  eligibility,
  onSeeRecord,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialType: AdvanceType
  eligibility: AdvanceEligibility
  onSeeRecord: (id: number) => void
}) {
  const apply = useApplyAdvance()
  const [kind, setKind] = React.useState<AdvanceType>(initialType)
  const [amountText, setAmountText] = React.useState('')
  const [months, setMonths] = React.useState(6)
  const [purpose, setPurpose] = React.useState('')
  const [step, setStep] = React.useState<Step>('form')
  const [showErrors, setShowErrors] = React.useState(false)
  const [serverError, setServerError] = React.useState<string | null>(null)
  // A refusal about one input (`field` of the server's answer): shown next to that input until it is changed.
  const [serverField, setServerField] = React.useState<{ field: ApplyField; text: string } | null>(null)
  const [created, setCreated] = React.useState<MyAdvance | null>(null)
  const ids = React.useId()

  // The forms this employee may use: a Term Loan is for staff only (the dialog is never opened when applying is not
  // available at all).
  const forms = applyForms(eligibility)
  const termOffered = forms.includes('term')
  // Each form's window: a Salary Advance only on its days ("Opens 21 Dec · in 25 days" outside them), a Term Loan on
  // any day ("Any day"). A form outside its window cannot be chosen while the other one is open (an older server's one
  // shared window closes both: then both stay choosable, to work out the amount).
  const chips = { general: windowChip(salaryAdvanceWindow(eligibility)), term: windowChip(termLoanWindow(eligibility)) }
  const tabClosed = (k: AdvanceType) => !chips[k].open && termOffered && chips[k === 'general' ? 'term' : 'general'].open

  // A fresh form every time the dialog opens (on the form that is open now when the asked one is closed).
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      const asked = termOffered ? initialType : 'general'
      setKind(tabClosed(asked) ? (asked === 'general' ? 'term' : 'general') : asked)
      setAmountText('')
      setMonths(defaultTermMonths(eligibility.termLoan))
      setPurpose('')
      setStep('form')
      setShowErrors(false)
      setServerError(null)
      setServerField(null)
      setCreated(null)
    }
  }

  const g = eligibility.salaryAdvance
  const t = eligibility.termLoan
  const earned = g.earned ?? null
  // The server's over_limit sentence names the earned figures' own last day; the rules' day otherwise.
  const throughDay = earned?.throughDay ?? salaryAdvanceThroughDay(eligibility)
  const section = kind === 'general' ? g : t
  const amount = amountOf(amountText)
  const amountError =
    kind === 'general'
      ? salaryAdvanceProblem(amountText, g.limit, earned?.earnedAmount ?? null, earned?.percent ?? g.percent, throughDay)
      : termAmountProblem(amountText, t.minAmount, t.limit, t.limitPercent, t.monthlySalary)
  const purposeError = purposeProblem(purpose)
  const meter = limitMeter(amount, g.limit)
  const plan =
    kind === 'term' && Number.isFinite(amount) && amount > 0 && amount >= t.minAmount
      ? termPlan(amount, months, t.firstDeductionMonth, t.firstDeductionYear)
      : []
  const monthOptions = termMonthChoices(t)
  const termLimit = termLoanLimitText(t)
  const fieldError = (field: ApplyField) => (serverField?.field === field ? serverField.text : null)
  const amountShown = fieldError('amount') ?? (showErrors ? amountError : null)
  const purposeShown = fieldError('purpose') ?? (showErrors ? purposeError : null)
  const monthsShown = fieldError('repaymentMonths')

  const what =
    kind === 'general'
      ? `${formatINR(amount)} Salary Advance, deducted in full from your ${g.deductionLabel} salary.`
      : `${formatINR(amount)} Term Loan over ${months} ${months === 1 ? 'month' : 'months'}: ${planSummary(plan)}.`
  const note = approvalNoteText(eligibility.method, kind)

  function switchKind(k: AdvanceType) {
    setKind(k)
    setServerError(null)
    setServerField(null)
    setShowErrors(false)
  }

  function review(e: React.FormEvent) {
    e.preventDefault()
    setShowErrors(true)
    setServerError(null)
    setServerField(null)
    if (!section.canApply || amountError || purposeError) return
    setStep('confirm')
  }

  async function send() {
    setServerError(null)
    setServerField(null)
    try {
      const row = await apply.mutateAsync({
        advanceType: kind,
        amount,
        ...(kind === 'term' ? { repaymentMonths: months } : {}),
        purpose: purpose.trim(),
      })
      setCreated(row)
      setStep('done')
    } catch (err) {
      // The server's own sentence ("You already have a Salary Advance for October 2026..."), next to the field it names.
      // Any answer from the server goes back to the form: the eligibility is asked again (useApplyAdvance), so a form that
      // can no longer be sent shows why. Nothing answered: stay here, so Send can be tried again.
      const refusal = applyRefusal(err instanceof ApiError ? err : null)
      if (refusal.toForm) {
        setStep('form')
        setShowErrors(true)
      }
      if (refusal.field && refusal.field !== 'advanceType') setServerField({ field: refusal.field, text: refusal.text })
      else setServerError(refusal.text)
    }
  }

  const amountErrId = `${ids}-amount-err`
  const purposeErrId = `${ids}-purpose-err`
  const monthsErrId = `${ids}-months-err`
  const blocked = !section.canApply

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        {step === 'done' ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <SuccessCheck size={64} label="Application sent" />
            <DialogTitle>Your application was sent to HR</DialogTitle>
            <DialogDescription className="max-w-sm">{what}</DialogDescription>
            <p className="max-w-sm text-[13px] text-muted-foreground">{note} You can follow it under Your applications.</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2 max-md:w-full max-md:flex-col-reverse">
              {created && (
                <Button
                  variant="outline"
                  className="min-h-11 max-md:h-12 max-md:w-full sm:min-h-9"
                  onClick={() => {
                    onOpenChange(false)
                    onSeeRecord(created.id)
                  }}
                >
                  See the application
                </Button>
              )}
              <Button className="min-h-11 max-md:h-12 max-md:w-full max-md:text-[15px] max-md:font-bold sm:min-h-9" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </div>
          </div>
        ) : step === 'confirm' ? (
          <>
            <DialogHeader>
              <DialogTitle>Send to HR?</DialogTitle>
              <DialogDescription>Check the details. Nothing is deducted until it is approved.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary/[0.04] p-4">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-lg border border-info-border bg-info-bg text-info" aria-hidden="true">
                  {kind === 'general' ? <Wallet className="size-5" /> : <Landmark className="size-5" />}
                </span>
                <div>
                  <p className="font-semibold">{TYPE_LABEL[kind]}</p>
                  <p className="metric text-[26px] leading-8">{formatINR(amount)}</p>
                </div>
              </div>
              <p className="text-[13.5px]">{what}</p>
              <p className="text-[13px] text-muted-foreground">
                For: <span className="break-words text-foreground">{purpose.trim()}</span>
              </p>
              {eligibility.approvalPath && <p className="text-[12.5px] text-muted-foreground">Who approves: {eligibility.approvalPath}</p>}
            </div>
            <p className="flex items-start gap-2 text-[12.5px] text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {note}
            </p>
            {serverError && <ServerError text={serverError} />}
            <DialogFooter>
              <Button variant="outline" className="min-h-11 max-md:h-12 max-md:w-full sm:min-h-9" onClick={() => setStep('form')} disabled={apply.isPending}>
                <ArrowLeft aria-hidden="true" /> Change
              </Button>
              <Button className="min-h-11 max-md:h-12 max-md:w-full max-md:text-[15px] max-md:font-bold sm:min-h-9" onClick={send} disabled={apply.isPending}>
                {apply.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
                {apply.isPending ? 'Sending…' : 'Send to HR'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={review} noValidate className="flex flex-col gap-5">
            <DialogHeader>
              <DialogTitle>{termOffered ? 'Apply for a Salary Advance or a Term Loan' : 'Apply for a Salary Advance'}</DialogTitle>
              <DialogDescription>
                {reviewSentence(eligibility.method)} A Salary Advance can be applied for on {salaryAdvanceDaysOf(eligibility)} of each month
                {termOffered ? ', a Term Loan on any day.' : '.'}
              </DialogDescription>
            </DialogHeader>

            {forms.length > 1 && (
              <SegmentedControl
                ariaLabel="What to apply for"
                fullWidth
                value={kind}
                onChange={switchKind}
                options={forms.map((k) => ({
                  value: k,
                  icon: k === 'general' ? Wallet : Landmark,
                  disabled: tabClosed(k),
                  ariaLabel: `${TYPE_LABEL[k]}, ${chips[k].text}`,
                  label: (
                    <span className="flex flex-col items-start leading-tight">
                      <span>{TYPE_LABEL[k]}</span>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 text-[10.5px] font-bold',
                          kind === k ? 'text-white/85' : chips[k].open ? 'text-approved' : 'text-waiting',
                        )}
                        data-testid={`settlement-tab-${k}-window`}
                      >
                        {tabClosed(k) && <LockKeyhole className="size-2.5" aria-hidden="true" />}
                        {chips[k].text}
                      </span>
                    </span>
                  ),
                }))}
              />
            )}

            {blocked && section.reason && (
              <div
                role="status"
                className="flex items-start gap-2 rounded-lg border border-waiting-border bg-waiting-bg px-3 py-2.5 text-[13.5px] text-waiting max-md:gap-2.5 max-md:rounded-xl max-md:border-0 max-md:p-3"
              >
                <Info className="mt-0.5 size-4 shrink-0 max-md:hidden" aria-hidden="true" />
                <LockKeyhole className="hidden max-md:mt-px max-md:block max-md:size-[18px] max-md:shrink-0" aria-hidden="true" />
                <div>
                  <p className="hidden max-md:block max-md:text-[13px] max-md:font-semibold">You cannot send this application right now</p>
                  <p className="max-md:text-[12px] max-md:leading-[17px]">{section.reason}</p>
                  {/* Term Loan: the next step by its code - the service bar (service only), the date it can be asked for
                      again, or the request still waiting / the loan being repaid (its details open instead of this form). */}
                  {kind === 'term' && (
                    <TermLoanBlockNote
                      eligibility={eligibility}
                      showReason={false}
                      onOpen={(id) => {
                        onOpenChange(false)
                        onSeeRecord(id)
                      }}
                    />
                  )}
                </div>
              </div>
            )}

            <fieldset disabled={blocked} className="flex flex-col gap-5 disabled:opacity-60 max-md:gap-3.5">
              {kind === 'general' ? (
                <div className="hidden max-md:flex max-md:items-center max-md:gap-3">
                  <span aria-hidden="true" className="max-md:grid max-md:size-10 max-md:shrink-0 max-md:place-items-center max-md:rounded-[13px] max-md:bg-info-bg max-md:text-info">
                    <Wallet className="max-md:size-5" />
                  </span>
                  <div className="max-md:min-w-0 max-md:flex-1">
                    <p className="max-md:text-[10.5px] max-md:font-bold max-md:tracking-[0.03em] max-md:text-muted-foreground max-md:uppercase">Your monthly salary</p>
                    <p className="max-md:mt-px max-md:font-[family-name:var(--font-display)] max-md:text-[18px] max-md:font-bold max-md:tabular-nums">
                      {eligibility.monthlySalary != null ? formatINR(eligibility.monthlySalary) : 'Not recorded'}
                    </p>
                  </div>
                  <div className="max-md:text-right">
                    <p className="max-md:text-[10.5px] max-md:font-bold max-md:tracking-[0.03em] max-md:text-muted-foreground max-md:uppercase">{g.percent}% limit</p>
                    <p className="max-md:mt-px max-md:font-[family-name:var(--font-display)] max-md:text-[18px] max-md:font-bold max-md:text-ring max-md:tabular-nums">
                      {g.limit != null ? formatINR(g.limit) : '—'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="hidden max-md:flex max-md:items-center max-md:gap-3">
                  <span aria-hidden="true" className="max-md:grid max-md:size-10 max-md:shrink-0 max-md:place-items-center max-md:rounded-[13px] max-md:bg-violet-bg max-md:text-violet">
                    <Landmark className="max-md:size-5" />
                  </span>
                  <div className="max-md:min-w-0 max-md:flex-1">
                    <p className="max-md:text-[10.5px] max-md:font-bold max-md:tracking-[0.03em] max-md:text-muted-foreground max-md:uppercase">Loan amount</p>
                    <p className="max-md:mt-0.5 max-md:text-[12px] max-md:text-muted-foreground">
                      {termLimit ? `${termLimit}, from ${formatINR(t.minAmount)}.` : `From ${formatINR(t.minAmount)}.`} Whole rupees only.
                    </p>
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${ids}-amount`}>Amount</Label>
                <div className="relative">
                  <span
                    className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[17px] font-semibold text-muted-foreground max-md:left-3.5 max-md:font-[family-name:var(--font-display)] max-md:text-[26px] max-md:font-bold"
                    aria-hidden="true"
                  >
                    ₹
                  </span>
                  <Input
                    id={`${ids}-amount`}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder={kind === 'general' ? (g.limit ? formatAmountInput(String(g.limit)) : '0') : formatAmountInput(String(t.minAmount))}
                    value={amountText}
                    onChange={(e) => {
                      setAmountText(formatAmountInput(e.target.value))
                      if (serverField?.field === 'amount') setServerField(null)
                    }}
                    aria-invalid={!!amountShown}
                    aria-describedby={amountShown ? amountErrId : undefined}
                    className="h-12 pl-8 text-[18px] font-semibold tabular-nums max-md:h-[60px] max-md:rounded-xl max-md:border-[1.5px] max-md:pl-10 max-md:font-[family-name:var(--font-display)] max-md:text-[28px] max-md:font-bold"
                  />
                </div>
                {amountShown && (
                  <p id={amountErrId} className="text-[12.5px] font-semibold text-rejected">
                    {amountShown}
                  </p>
                )}
                {/* The Term Loan's limit (a % of the monthly salary, 2026-11-27) and minimum; phones say it in the header above. */}
                {kind === 'term' && !amountShown && (
                  <p className="text-[12.5px] text-muted-foreground max-md:hidden" data-testid="term-loan-limit">
                    {termLimit ? `${termLimit}, from ${formatINR(t.minAmount)}.` : `From ${formatINR(t.minAmount)}.`}
                  </p>
                )}
              </div>

              {kind === 'general' ? (
                <div className="flex items-center gap-4 rounded-xl bg-foreground/[0.04] p-3 max-md:gap-3.5 max-md:bg-transparent max-md:p-0">
                  {g.limit ? (
                    <RingMeter
                      value={Number.isFinite(amount) ? Math.min(amount, g.limit) : 0}
                      max={g.limit}
                      tone={METER_TONE[meter.state]}
                      label={`Part of your ${g.percent}% limit used`}
                      size={88}
                      thickness={9}
                    >
                      <span className={cn('metric text-[17px]', meter.state === 'over' && 'text-rejected')}>
                        {Number.isFinite(amount) && amount > 0 ? `${Math.round((amount / g.limit) * 100)}%` : '0%'}
                      </span>
                      <span className="text-[10px] text-muted-foreground">of limit</span>
                    </RingMeter>
                  ) : null}
                  <div className="min-w-0 text-[13px] max-md:text-[12px] max-md:leading-[17px]">
                    {g.limit ? (
                      <>
                        <p>
                          Up to <span className="font-bold">{formatINR(g.limit)}</span>
                          {earned
                            ? ` (${g.percent}% of the ${formatINR(earned.earnedAmount)} you earned ${earned.final ? '' : 'so far '}from the 1st to the ${ordinal(throughDay)})`
                            : ''}
                          .
                        </p>
                        <p className={cn('mt-1 font-semibold', meter.state === 'over' ? 'text-rejected' : meter.state === 'near' ? 'text-waiting' : 'text-muted-foreground')}>
                          {meter.state === 'over'
                            ? `${formatINR(amount - g.limit)} over the limit`
                            : meter.state === 'empty'
                              ? 'Type an amount to see how much of the limit it uses.'
                              : `${formatINR(meter.left)} of the limit left`}
                        </p>
                      </>
                    ) : (
                      <p className="text-muted-foreground">Your limit is not known.</p>
                    )}
                    <p className="mt-1 text-muted-foreground">
                      Deducted in full from your <span className="font-semibold text-foreground">{g.deductionLabel}</span> salary.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label id={`${ids}-months`}>Repay in</Label>
                    {/* As many columns as months to choose from (1 to Settings' most, 6 by default), so the row is full. */}
                    <div
                      role="group"
                      aria-labelledby={`${ids}-months`}
                      aria-describedby={monthsShown ? monthsErrId : undefined}
                      className={cn('grid gap-1.5', MONTH_COLS[Math.min(ABSOLUTE_MAX_MONTHS, Math.max(1, monthOptions.length))])}
                    >
                      {monthOptions.map((m) => {
                        const on = m === months
                        return (
                          <button
                            key={m}
                            type="button"
                            aria-pressed={on}
                            aria-label={`${m} ${m === 1 ? 'month' : 'months'}`}
                            onClick={() => {
                              setMonths(m)
                              if (serverField?.field === 'repaymentMonths') setServerField(null)
                            }}
                            className={cn(
                              'font-label focus-ring grid min-h-11 place-items-center rounded-lg border text-[14px] font-bold tabular-nums transition-colors max-md:content-center max-md:py-1.5 max-md:font-[family-name:var(--font-display)] max-md:text-[15px] sm:min-h-10',
                              on ? 'border-transparent bg-brand-gradient text-white shadow-clay-sm' : 'border-foreground/15 hover:border-primary/50 hover:bg-primary/10',
                              on ? 'max-md:bg-primary max-md:bg-none max-md:text-primary-foreground' : 'max-md:border-border max-md:bg-muted',
                            )}
                          >
                            {m}
                            <span className={cn('hidden max-md:block max-md:text-[9px] max-md:leading-3 max-md:font-normal', on ? 'max-md:text-primary-foreground' : 'max-md:text-muted-foreground')}>
                              {m === 1 ? 'month' : 'months'}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    {monthsShown && (
                      <p id={monthsErrId} className="text-[12.5px] font-semibold text-rejected">
                        {monthsShown}
                      </p>
                    )}
                    <p className="text-[12.5px] text-muted-foreground">
                      {months} {months === 1 ? 'month' : 'months'}, starting from your {t.firstDeductionLabel} salary.
                    </p>
                  </div>
                  <div className="rounded-xl bg-foreground/[0.04] p-3 max-md:border max-md:bg-card max-md:p-3.5 max-md:shadow-[var(--m-shadow-low)]" aria-live="polite">
                    {plan.length ? (
                      <>
                        <div className="max-md:flex max-md:items-end max-md:justify-between max-md:gap-3">
                          <div>
                            <p className="text-[13px] text-muted-foreground max-md:text-[10.5px] max-md:font-bold max-md:tracking-[0.03em] max-md:uppercase">Each month</p>
                            <p className="metric text-[26px] leading-8 max-md:text-[28px] max-md:text-primary">{formatINR(plan[0].amount)}</p>
                          </div>
                          <div className="hidden max-md:block max-md:text-right">
                            <p className="max-md:text-[10.5px] max-md:font-bold max-md:tracking-[0.03em] max-md:text-muted-foreground max-md:uppercase">First EMI</p>
                            <p className="max-md:mt-0.5 max-md:inline-flex max-md:items-center max-md:gap-1 max-md:text-[14px] max-md:font-semibold">
                              <CalendarClock className="max-md:size-3.5 max-md:text-muted-foreground" aria-hidden="true" />
                              {t.firstDeductionLabel}
                            </p>
                          </div>
                        </div>
                        <p className="mt-0.5 text-[13px]">{planSummary(plan)}</p>
                        <div className="mt-3">
                          <PlanBars plan={plan} />
                        </div>
                      </>
                    ) : (
                      <p className="text-[13px] text-muted-foreground">
                        Type an amount from {formatINR(t.minAmount)}
                        {t.limit != null && t.limit >= t.minAmount ? ` up to ${formatINR(t.limit)}` : ''} to see the monthly EMI and when each
                        one is deducted.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* 2026-11-26: what the limit is taken from (earned 1st-20th, working days, monthly salary, the limit). */}
              {kind === 'general' && <EarnedBasisPanel earned={earned} monthlySalary={eligibility.monthlySalary} />}

              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-3">
                  <Label htmlFor={`${ids}-purpose`}>What is it for?</Label>
                  <span className={cn('text-[11.5px] tabular-nums', purpose.length > MAX_PURPOSE ? 'text-rejected' : 'text-muted-foreground')}>
                    {purpose.length}/{MAX_PURPOSE}
                  </span>
                </div>
                <Textarea
                  id={`${ids}-purpose`}
                  value={purpose}
                  onChange={(e) => {
                    setPurpose(e.target.value)
                    if (serverField?.field === 'purpose') setServerField(null)
                  }}
                  placeholder="For example: school fees, medical bills"
                  rows={3}
                  aria-invalid={!!purposeShown}
                  aria-describedby={purposeShown ? purposeErrId : undefined}
                />
                {purposeShown && (
                  <p id={purposeErrId} className="text-[12.5px] font-semibold text-rejected">
                    {purposeShown}
                  </p>
                )}
              </div>
              <div className="hidden max-md:flex max-md:flex-col max-md:gap-1.5 max-md:rounded-xl max-md:bg-muted max-md:p-3">
                <p className="max-md:text-[13px] max-md:font-semibold">What happens next</p>
                {[
                  eligibility.method === 'automation'
                    ? 'HR reviews your application first; then it is under review for approval.'
                    : 'HR reviews your application.',
                  `${note} You will see both amounts.`,
                  'You get a notification when it is decided. Follow it any time under Your applications.',
                ].map((line) => (
                  <p key={line} className="max-md:flex max-md:items-start max-md:gap-2 max-md:text-[12px] max-md:leading-[17px] max-md:text-secondary-foreground">
                    <CheckCircle2 className="max-md:mt-px max-md:size-3.5 max-md:shrink-0 max-md:text-ring" aria-hidden="true" />
                    {line}
                  </p>
                ))}
                {eligibility.approvalPath && <p className="max-md:mt-0.5 max-md:text-[11px] max-md:text-muted-foreground">Who approves: {eligibility.approvalPath}</p>}
              </div>
            </fieldset>

            {serverError && <ServerError text={serverError} />}

            <DialogFooter>
              <Button type="button" variant="outline" className="min-h-11 max-md:hidden sm:min-h-9" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" className="min-h-11 max-md:h-12 max-md:w-full max-md:text-[15px] max-md:font-bold sm:min-h-9" disabled={blocked}>
                {blocked ? (
                  <>
                    <span className="max-md:hidden">Review</span>
                    <span className="hidden max-md:inline">{chips[kind].open ? 'Not available now' : 'Not open right now'}</span>
                  </>
                ) : (
                  'Review'
                )}
                <ArrowRight aria-hidden="true" />
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ServerError({ text }: { text: string }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-rejected-border bg-rejected-bg px-3 py-2.5 text-[13.5px] text-rejected">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>{text}</p>
    </div>
  )
}
