import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, CalendarCheck2, Clock, FileStack, HandCoins, Info, Landmark, LockKeyhole, Plus, TimerReset, TrendingDown, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  EmptyState,
  ErrorState,
  GlassCard,
  KpiTile,
  PageHero,
  PageShell,
  SectionHeader,
  SegmentedControl,
  SkeletonBlock,
  SkeletonList,
  StatusViews,
  emptyViewText,
  listItem,
  useRequestViews,
  type ViewOptions,
} from '@/components/kit'
import { AdvanceCard, AdvanceDetailDialog, RulesCard, TermLoanBlockNote, WindowBanner } from '@/components/pay/AdvanceParts'
import { ApplyAdvanceDialog } from '@/components/pay/ApplyAdvanceDialog'
import { phoneChipClass, phoneCountClass } from '@/components/pay/phone'
import { FocusMissNote } from '@/components/requests/FocusMissNote'
import { useAdvanceEligibility, useMyAdvances } from '@/hooks/useAdvances'
import { useFocusItem } from '@/hooks/useFocusItem'
import { focusKey } from '@/lib/focus-item'
import { formatINR } from '@/lib/money'
import { cn } from '@/lib/utils'
import {
  applyForms,
  filterByType,
  opensOnText,
  ordinal,
  recordTotals,
  reviewSentence,
  salaryAdvanceBasisText,
  salaryAdvanceDaysOf,
  salaryAdvancePercent,
  salaryAdvanceThroughDay,
  salaryAdvanceWindow,
  termLoanLimitText,
  termLoanServiceMonths,
  termLoanWindow,
  typeCounts,
  windowChip,
  TYPE_FILTERS,
  type AdvanceEligibility,
  type AdvanceType,
  type MyAdvance,
  type TypeFilter,
} from '@/lib/advances'

const rupees = (n: number) => formatINR(Math.round(n))

/**
 * Each form's window as its card and tab show it (owner 2026-11-26): a Salary Advance only on the 21st and 22nd
 * ("Opens 21 Dec · in 25 days" outside it), a Term Loan on any day ("Any day"). An older server's one window holds both.
 */
function formWindow(e: AdvanceEligibility, type: AdvanceType) {
  const w = type === 'general' ? salaryAdvanceWindow(e) : termLoanWindow(e)
  return { chip: windowChip(w), opens: opensOnText(w) }
}

/** Loan & Advance (owner 2026-11-28: the one name everywhere): apply for a Salary Advance (on the days Settings names, the
 *  21st and 22nd by default, up to a % of the salary earned from the 1st to the 20th) or a Term Loan (staff, any day,
 *  after the months of service, up to a % of the monthly salary) and follow every application, repayment and deduction.
 *  The server decides every rule (mobile_settlement_views.py); this page words it, with the server's numbers. A
 *  production employee (`applyAvailable` false) sees the history only, with the server's reason. */
export default function Settlement() {
  const records = useMyAdvances()
  const eligibility = useAdvanceEligibility()
  const e = eligibility.data
  const [applyType, setApplyType] = React.useState<AdvanceType | null>(null)
  const [openId, setOpenId] = React.useState<number | null>(null)
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>('all')

  const rows = records.data
  const totals = recordTotals(rows ?? [])
  const tCounts = typeCounts(rows ?? [])
  const viewOptions: ViewOptions<MyAdvance> = {
    statusOf: (a) => a.status,
    month: { dateOf: (a) => a.createdAt, kind: 'submitted' },
  }
  const v = useRequestViews(rows ? filterByType(rows, typeFilter) : undefined, viewOptions)
  // A notification's View button opens ?focus=<advance id>: its detail opens straight away, and the list behind it
  // shows the view holding it (every type).
  const focus = useFocusItem({
    scope: 'advance',
    rows,
    idOf: (a) => a.id,
    views: v,
    viewOptions,
    highlight: false,
    reveal: (a) => {
      setTypeFilter('all')
      setOpenId(a.id)
    },
  })

  // The forms this employee may use: none for a production employee (`applyAvailable` false), no Term Loan when it is
  // for staff only.
  const forms = e ? applyForms(e) : []
  const termOffered = forms.includes('term')
  const canApplyAny = !!e && ((forms.includes('general') && e.salaryAdvance.canApply) || (termOffered && e.termLoan.canApply))
  // "the 21st and 22nd" and "50% of the salary you earned from the 1st to the 20th" from Settings (the defaults when the
  // server does not say).
  const saDays = salaryAdvanceDaysOf(e)
  const startApply = (type?: AdvanceType) => {
    if (!e || forms.length === 0) return
    // The header's Apply: the form that can be sent now (a Salary Advance outside its window cannot).
    setApplyType(
      type ??
        (e.salaryAdvance.canApply || !termOffered ? 'general' : e.termLoan.canApply || formWindow(e, 'general').chip.open ? 'term' : 'general'),
    )
  }

  return (
    <>
      <PageShell>
        <PageHero
          icon={<FileStack />}
          title="Loan & Advance"
          subtitle={
            <>
              <span className="max-md:hidden">
                {!e || forms.length > 0
                  ? `Ask HR for a Salary Advance (${saDays} of each month)${termOffered || !e ? ' or a Term Loan (any day),' : ''} and see what is left to repay.`
                  : 'Your Salary Advance and Term Loan requests, and what is left to repay.'}
              </span>
              <span className="hidden max-md:inline">Salary Advance · Term Loan</span>
            </>
          }
          actions={
            e && forms.length > 0 ? (
              <Button className="min-h-11 max-md:h-9 max-md:min-h-9 max-md:px-3.5 max-md:text-[13px] sm:min-h-9" onClick={() => startApply()} disabled={!canApplyAny}>
                <Plus aria-hidden="true" /> Apply
              </Button>
            ) : undefined
          }
          kpis={
            rows ? (
              <>
                <div className="hidden max-md:col-span-2 max-md:flex max-md:flex-col max-md:gap-1.5">
                  {e && forms.length === 0 ? (
                    <p className="max-md:text-[13px] max-md:leading-[19px] max-md:text-secondary-foreground">
                      {e.applyUnavailableReason ?? 'You cannot apply for a Salary Advance or a Term Loan. Your earlier requests stay here.'}
                    </p>
                  ) : (
                    <>
                      <p className="max-md:font-[family-name:var(--font-display)] max-md:text-[20px] max-md:leading-7 max-md:font-bold">Need money before payday?</p>
                      <p className="max-md:text-[13px] max-md:leading-[19px] max-md:text-secondary-foreground">
                        A <span className="max-md:font-semibold max-md:text-foreground">Salary Advance</span> is up to {salaryAdvanceBasisText(e)},
                        taken back in full from that month&apos;s salary. You can apply for it on {saDays} of each month.
                        {termOffered || !e ? (
                          <>
                            {' '}
                            A <span className="max-md:font-semibold max-md:text-foreground">Term Loan</span> is a larger amount you repay in monthly
                            EMIs ({e ? `${e.termLoan.minMonths} to ${e.termLoan.maxMonths}` : '1 to 6'} months), and you can apply for it on any
                            day once you have {termLoanServiceMonths(e)} months of service.
                          </>
                        ) : null}{' '}
                        {reviewSentence(e?.method ?? 'normal')}
                      </p>
                    </>
                  )}
                </div>
                <KpiTile className="max-md:hidden" label="Still owed" value={totals.owed} format={rupees} icon={TrendingDown} tone="rose" hint={totals.active ? `on ${totals.active} being repaid` : 'nothing to repay'} />
                <KpiTile className="max-md:hidden" label="Repaid so far" value={totals.repaid} format={rupees} icon={Wallet} tone="emerald" hint="taken from your salary" />
                <KpiTile className="max-md:hidden" label="Waiting" value={totals.waiting} icon={Clock} tone="amber" hint={totals.waiting === 1 ? 'application not decided yet' : 'applications not decided yet'} />
                <KpiTile
                  className="max-md:hidden"
                  label="Advance limit"
                  value={e?.salaryAdvance.limit ?? '—'}
                  format={rupees}
                  icon={HandCoins}
                  tone="sapphire"
                  hint={
                    e && forms.length === 0
                      ? 'for staff on a monthly salary'
                      : e?.salaryAdvance.limit != null
                        ? `${salaryAdvancePercent(e)}% of the salary earned 1st–${ordinal(salaryAdvanceThroughDay(e))}`
                        : e
                          ? 'not available: see Apply below'
                          : undefined
                  }
                />
              </>
            ) : undefined
          }
        >
          {records.isPending && <SkeletonList variant="tiles" count={4} label="Loading your advances" />}
        </PageHero>

        {eligibility.isError && !e ? (
          <ErrorState
            title="Could not check whether you can apply"
            error={eligibility.error}
            what="the advance rules"
            onRetry={() => eligibility.refetch()}
            retrying={eligibility.isFetching}
          />
        ) : !e ? (
          <GlassCard className="flex items-center gap-4">
            <SkeletonBlock className="size-14 rounded-2xl" />
            <div className="flex flex-1 flex-col gap-2">
              <SkeletonBlock className="h-3 w-24" />
              <SkeletonBlock className="h-6 w-56" />
              <SkeletonBlock className="h-2 w-full rounded-full" />
            </div>
          </GlassCard>
        ) : forms.length === 0 ? (
          // A production employee (owner 2026-11-28): no applying here, only the history below - and the server's reason.
          <GlassCard className="flex items-start gap-3 max-md:p-3.5!" data-testid="settlement-apply-unavailable">
            <Info className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="text-[13.5px] text-muted-foreground">
              {e.applyUnavailableReason ?? 'You cannot apply for a Salary Advance or a Term Loan. Your earlier requests stay here.'}
            </p>
          </GlassCard>
        ) : (
          <WindowBanner eligibility={e} />
        )}

        {e && forms.length > 0 && (
          <section aria-labelledby="apply-title" className="flex flex-col gap-4 max-md:gap-2.5">
            <SectionHeader
              className="max-md:hidden"
              id="apply-title"
              icon={Plus}
              title="Apply"
              description={
                termOffered
                  ? `Pick what you need. A Salary Advance opens on ${saDays}; a Term Loan any day, after ${termLoanServiceMonths(e)} months of service. ${reviewSentence(e.method)}`
                  : `A Salary Advance opens on ${saDays}. ${reviewSentence(e.method)}`
              }
            />
            <h2 className="sr-only hidden max-md:block">Apply</h2>
            <div className="grid gap-4 max-md:grid-cols-2 max-md:gap-3 md:grid-cols-2">
              {forms.map((type) => (
                <ApplyOption key={type} type={type} eligibility={e} onApply={() => startApply(type)} onOpen={setOpenId} />
              ))}
            </div>
            <PhoneApplyReasons eligibility={e} forms={forms} />
            <RulesCard eligibility={e} />
          </section>
        )}

        <section aria-labelledby="records-title" className="flex flex-col gap-4 max-md:gap-3">
          <SectionHeader
            className="max-md:hidden"
            id="records-title"
            icon={FileStack}
            title="Your applications"
            count={rows?.length}
            description="Salary Advances and Term Loans you applied for, and those HR recorded for you."
            action={
              rows && rows.length > 0 ? (
                <SegmentedControl
                  ariaLabel="Show type"
                  size="sm"
                  value={typeFilter}
                  onChange={setTypeFilter}
                  options={TYPE_FILTERS.map((f) => ({ value: f.key, label: f.label, count: tCounts[f.key] }))}
                />
              ) : undefined
            }
          />
          <div className="hidden max-md:mt-1.5 max-md:flex max-md:items-baseline max-md:justify-between max-md:gap-3">
            <h2 className="max-md:font-[family-name:var(--font-display)] max-md:text-[16px] max-md:font-bold">My applications</h2>
            {rows && rows.length > 0 && (
              <span className="max-md:text-[12px] max-md:text-muted-foreground">
                {rows.length} {rows.length === 1 ? 'record' : 'records'}
              </span>
            )}
          </div>
          {rows && rows.length > 0 && (
            <div className="hidden max-md:flex max-md:rounded-xl max-md:border max-md:bg-card max-md:py-3.5 max-md:shadow-[var(--m-shadow-low)]">
              <PhoneTotal label="Still owed" value={rupees(totals.owed)} className={totals.owed > 0 ? 'max-md:text-rejected' : 'max-md:text-approved'} />
              <span aria-hidden="true" className="max-md:w-px max-md:bg-input" />
              <PhoneTotal label="Repaid so far" value={rupees(totals.repaid)} />
              <span aria-hidden="true" className="max-md:w-px max-md:bg-input" />
              <PhoneTotal label="Waiting" value={String(totals.waiting)} className={totals.waiting ? 'max-md:text-waiting' : undefined} />
            </div>
          )}
          {rows && rows.length > 0 && (
            <div
              role="group"
              aria-label="Show type"
              className="hidden max-md:-mx-4 max-md:flex max-md:gap-2 max-md:overflow-x-auto max-md:px-4 max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden"
            >
              {TYPE_FILTERS.map((f) => {
                const selected = typeFilter === f.key
                return (
                  <button
                    key={f.key}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setTypeFilter(f.key)}
                    className={cn(
                      'focus-ring max-md:inline-flex max-md:min-h-9 max-md:shrink-0 max-md:items-center max-md:gap-1.5 max-md:rounded-full max-md:border max-md:pr-1.5 max-md:pl-3 max-md:text-[12.5px] max-md:font-semibold max-md:transition-colors',
                      phoneChipClass(selected),
                    )}
                  >
                    {f.label}
                    <span className={phoneCountClass(selected)}>{tCounts[f.key]}</span>
                  </button>
                )
              })}
            </div>
          )}
          {rows && rows.length > 0 && (
            <StatusViews value={v.view} onChange={v.setView} counts={v.counts} monthKind="submitted" panelId="advance-list" ariaLabel="Show applications" />
          )}
          {focus.missing && <FocusMissNote onDismiss={focus.dismiss}>That advance or loan is no longer in this list.</FocusMissNote>}
          <div id="advance-list" role="tabpanel" aria-label="Applications">
            {records.isPending ? (
              <SkeletonList variant="cards" count={2} />
            ) : records.isError ? (
              <ErrorState error={records.error} what="your advances and loans" onRetry={() => records.refetch()} retrying={records.isFetching} />
            ) : rows!.length === 0 ? (
              <EmptyState
                icon={FileStack}
                title="No advances or loans yet"
                description={
                  e && forms.length === 0
                    ? 'When HR records an advance for you, it shows here with every repayment.'
                    : 'When you apply, or HR records an advance for you, it shows here with every repayment.'
                }
                action={
                  canApplyAny ? (
                    <Button onClick={() => startApply()}>
                      <Plus aria-hidden="true" /> Apply now
                    </Button>
                  ) : undefined
                }
              />
            ) : v.rows.length === 0 ? (
              <EmptyState icon={FileStack} compact title="Nothing here" description={emptyViewText(v.view, 'applications', 'submitted')} />
            ) : (
              <ul className="grid gap-4 max-md:gap-3 md:grid-cols-2">
                <AnimatePresence mode="popLayout" initial={false}>
                  {v.rows.map((a, i) => (
                    <motion.li key={a.id} {...listItem(i)} layout data-focus-key={focusKey('advance', a.id)}>
                      <AdvanceCard advance={a} onOpen={setOpenId} />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </section>
      </PageShell>

      {e && (
        <ApplyAdvanceDialog
          open={applyType != null}
          onOpenChange={(o) => !o && setApplyType(null)}
          initialType={applyType ?? 'general'}
          eligibility={e}
          onSeeRecord={setOpenId}
        />
      )}
      <AdvanceDetailDialog id={openId} onOpenChange={(o) => !o && setOpenId(null)} />
    </>
  )
}

/** The window chip on a form's card: "Open · 2 days left" / "Any day" (green), "Opens 20 Dec · in 25 days" (amber). */
function WindowChip({ chip, className }: { chip: { open: boolean; text: string }; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex w-fit max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] font-bold',
        chip.open ? 'border-approved-border bg-approved-bg text-approved' : 'border-waiting-border bg-waiting-bg text-waiting',
        'max-md:border-0 max-md:px-[7px] max-md:text-[10.5px] max-md:font-extrabold',
        className,
      )}
    >
      {chip.open ? <CalendarCheck2 className="size-3 shrink-0" aria-hidden="true" /> : <TimerReset className="size-3 shrink-0" aria-hidden="true" />}
      <span className="truncate">{chip.text}</span>
    </span>
  )
}

/** One of the two things to apply for: what it is, its window ("Any day", "Opens 20 Dec · in 25 days"), the server's
 *  figures (a Term Loan's limit: "Up to ₹26,000 (100% of your monthly salary)"), and either the Apply button or the
 *  server's plain reason why not - for a Term Loan with the next step by its code (the date it can be asked for again, or
 *  the request still waiting / the loan being repaid, `onOpen`). Outside its window the card is closed. */
function ApplyOption({
  type,
  eligibility: e,
  onApply,
  onOpen,
}: {
  type: AdvanceType
  eligibility: AdvanceEligibility
  onApply: () => void
  onOpen: (id: number) => void
}) {
  const Icon = type === 'term' ? Landmark : Wallet
  const s = type === 'general' ? e.salaryAdvance : e.termLoan
  const title = type === 'general' ? 'Salary Advance' : 'Term Loan'
  const { chip, opens } = formWindow(e, type)
  const closed = !chip.open
  const termLimit = termLoanLimitText(e.termLoan)
  const line =
    type === 'general'
      ? e.salaryAdvance.limit != null
        ? `Up to ${formatINR(e.salaryAdvance.limit)}`
        : `Up to ${salaryAdvancePercent(e)}% of earned salary`
      : e.termLoan.limit != null
        ? `Up to ${formatINR(e.termLoan.limit)}`
        : `${e.termLoan.minMonths} to ${e.termLoan.maxMonths} months EMI`
  const sub = type === 'general' ? `Deducted from ${e.salaryAdvance.deductionLabel} salary` : `EMIs start ${e.termLoan.firstDeductionLabel}`
  return (
    <GlassCard className="flex h-full flex-col gap-3 max-md:p-0!">
      {/* Phones: the whole card is the button (Apply, or See details with the reason), as in the app. */}
      <button
        type="button"
        onClick={onApply}
        disabled={closed}
        aria-label={`${title}. ${line}. ${sub}. ${chip.text}. ${s.canApply ? 'Apply' : closed ? opens : (s.reason ?? 'Not available now')}`}
        className={cn(
          'focus-ring hidden max-md:flex max-md:h-full max-md:w-full max-md:flex-col max-md:items-start max-md:gap-1 max-md:rounded-xl max-md:p-3.5 max-md:text-left max-md:active:opacity-85',
          !s.canApply && 'max-md:opacity-90',
          closed && 'max-md:opacity-75',
        )}
        data-testid={`settlement-apply-${type}`}
      >
        <span
          aria-hidden="true"
          className={cn(
            'max-md:grid max-md:size-[42px] max-md:place-items-center max-md:rounded-[14px]',
            type === 'term' ? 'max-md:bg-violet-bg max-md:text-violet' : 'max-md:bg-info-bg max-md:text-info',
          )}
        >
          <Icon className="max-md:size-[22px]" />
        </span>
        <span className="max-md:mt-2 max-md:font-[family-name:var(--font-display)] max-md:text-[15px] max-md:leading-5 max-md:font-bold">{title}</span>
        <WindowChip chip={chip} className="max-md:mt-0.5" />
        <span className="max-md:text-[13px] max-md:font-semibold max-md:tabular-nums">{line}</span>
        <span className="max-md:min-h-8 max-md:text-[11.5px] max-md:leading-4 max-md:text-muted-foreground">{sub}</span>
        <span
          aria-hidden="true"
          className={cn(
            'max-md:mt-auto max-md:flex max-md:w-full max-md:items-center max-md:justify-center max-md:gap-1 max-md:rounded-lg max-md:py-[9px] max-md:text-[13px] max-md:font-semibold',
            s.canApply ? 'max-md:bg-primary max-md:text-primary-foreground' : 'max-md:bg-muted max-md:text-muted-foreground',
          )}
        >
          <span className="max-md:truncate">{s.canApply ? 'Apply' : closed ? opens || 'Closed now' : 'See details'}</span>
          {closed ? <LockKeyhole className="max-md:size-3.5 max-md:shrink-0" /> : <ArrowRight className="max-md:size-3.5 max-md:shrink-0" />}
        </span>
      </button>
      <div className="flex items-start gap-3 max-md:hidden">
        <span
          aria-hidden="true"
          className={cn(
            'grid size-11 shrink-0 place-items-center rounded-xl border',
            type === 'term' ? 'border-violet-border bg-violet-bg text-violet' : 'border-info-border bg-info-bg text-info',
          )}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h3 className="font-display text-[18px] font-semibold">{type === 'general' ? 'Salary Advance' : 'Term Loan'}</h3>
            <WindowChip chip={chip} />
          </div>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {type === 'general'
              ? e.salaryAdvance.limit != null
                ? `Up to ${formatINR(e.salaryAdvance.limit)}, deducted in full from your ${e.salaryAdvance.deductionLabel} salary.`
                : `Deducted in full from that month's salary.`
              : `${termLimit ? `${termLimit}. From` : 'From'} ${formatINR(e.termLoan.minAmount)}, repaid in ${e.termLoan.minMonths} to ${e.termLoan.maxMonths} monthly EMIs from your ${e.termLoan.firstDeductionLabel} salary.`}
          </p>
        </div>
      </div>
      {s.canApply ? (
        <Button className="mt-auto min-h-11 self-start max-md:hidden sm:min-h-9" onClick={onApply}>
          Apply for a {type === 'general' ? 'Salary Advance' : 'Term Loan'}
        </Button>
      ) : closed ? (
        // Outside its window: the button says when it opens (the banner above says the rest).
        <Button variant="outline" className="mt-auto min-h-11 self-start max-md:hidden sm:min-h-9" disabled>
          <LockKeyhole aria-hidden="true" /> {opens || 'Closed now'}
        </Button>
      ) : (
        <div role="status" className="mt-auto rounded-lg border border-waiting-border bg-waiting-bg px-3 py-2 text-[13px] text-waiting max-md:hidden">
          <p>{s.reason ?? 'You cannot apply for this right now.'}</p>
          {/* Term Loan: the next step by its code - the service bar (service only), the date it can be asked for again, or
              the request still waiting / the loan being repaid. */}
          {type === 'term' && <TermLoanBlockNote eligibility={e} onOpen={onOpen} showReason={false} />}
        </div>
      )}
    </GlassCard>
  )
}

/** Phones only: why a card cannot be used, under the two half-width cards (one line when both share the reason). */
function PhoneApplyReasons({ eligibility: e, forms }: { eligibility: AdvanceEligibility; forms: readonly AdvanceType[] }) {
  // A switched-off workflow is already said by the window banner above (as in the app), and a closed window is said on
  // the card itself ("Opens on 20 Dec") and in the banner: only a card's OWN reason (no salary on record, one already this
  // month, a loan still waiting) is spelled out here - for the forms this employee is offered.
  if (e.workflowMessage) return null
  const blocked = [
    { key: 'general' as const, title: 'Salary Advance', s: e.salaryAdvance },
    { key: 'term' as const, title: 'Term Loan', s: e.termLoan },
  ].filter((c) => forms.includes(c.key) && !c.s.canApply && formWindow(e, c.key).chip.open)
  if (blocked.length === 0) return null
  const lines =
    blocked.length === 2 && (blocked[0].s.reason ?? '') === (blocked[1].s.reason ?? '')
      ? [{ key: 'both', title: null, text: blocked[0].s.reason ?? 'You cannot apply right now.' }]
      : blocked.map((c) => ({ key: c.key, title: c.title, text: c.s.reason ?? 'You cannot apply for this right now.' }))
  return (
    <div role="status" className="hidden max-md:flex max-md:flex-col max-md:gap-2">
      {lines.map((l) => (
        <p key={l.key} className="max-md:flex max-md:items-start max-md:gap-2 max-md:rounded-xl max-md:bg-muted max-md:p-2.5 max-md:text-[12px] max-md:leading-[17px] max-md:text-secondary-foreground">
          <Info className="max-md:mt-px max-md:size-[15px] max-md:shrink-0" aria-hidden="true" />
          <span>
            {l.title && <span className="max-md:font-semibold max-md:text-foreground">{l.title}: </span>}
            {l.text}
          </span>
        </p>
      ))}
    </div>
  )
}

/** Phones only: one cell of the totals strip above the list. */
function PhoneTotal({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <p className="max-md:flex max-md:min-w-0 max-md:flex-1 max-md:flex-col max-md:items-center max-md:gap-[3px] max-md:px-1.5">
      <span className="max-md:text-[10.5px] max-md:font-bold max-md:text-muted-foreground">{label}</span>
      <span className={cn('max-md:max-w-full max-md:truncate max-md:font-[family-name:var(--font-display)] max-md:text-[17px] max-md:font-bold max-md:tabular-nums', className)}>
        {value}
      </span>
    </p>
  )
}
