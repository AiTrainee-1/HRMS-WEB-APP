import * as React from 'react'
import { useSearch } from 'wouter'
import { CalendarClock, HandCoins, History, Info, MessageCircleQuestion, RefreshCw, Sparkles, UserCheck, Wallet } from 'lucide-react'
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
  SkeletonList,
} from '@/components/kit'
import { FocusMissNote } from '@/components/requests/FocusMissNote'
import { YearPicker } from '@/components/pay/YearPicker'
import {
  AskHrPanel,
  BalanceCard,
  CompensationAlerts,
  MonthSection,
  PhoneBalanceHero,
  RecentCompensation,
  SourceFilterChips,
} from '@/components/pay/CompensationParts'
import { useCompensation } from '@/hooks/useCompensation'
import { useFocusItem } from '@/hooks/useFocusItem'
import { useCompensationHistory } from '@/hooks/usePayCompensation'
import { STAFF_ONLY_MESSAGE, type CompensationPayload } from '@/lib/compensation'
import { groupByMonth, sourceCounts, type SourceFilter } from '@/lib/compensation-history'
import { nextToTry, readFocusParams } from '@/lib/focus-item'
import { dayText } from '@/lib/my-requests'
import { formatINR } from '@/lib/money'
import { cn } from '@/lib/utils'

type Mode = 'year' | 'recent' | 'ask'

export default function Compensation() {
  // A notification's View button opens ?focus=hw-<claim id> (a Sunday / holiday work claim) and/or ?date=<the day>: the
  // year of that day, the item scrolled to and ringed.
  const search = useSearch()
  const focusParams = React.useMemo(() => readFocusParams(search), [search])
  const [mode, setMode] = React.useState<Mode>('year')
  const [year, setYear] = React.useState<number | null>(() => (focusParams.date ? Number(focusParams.date.slice(0, 4)) : null))
  const [filter, setFilter] = React.useState<SourceFilter>('all')
  const history = useCompensationHistory(year)
  // The 90-day list: today's / next working day's allowance (shown in every view), the ask-HR block, and the fallback when a year fails.
  const recent = useCompensation()
  const h = history.data
  const r = recent.data

  // The years stay pickable even when one year fails to load.
  const [years, setYears] = React.useState<number[]>([])
  if (h && !history.isPlaceholderData && h.years.join() !== years.join()) setYears(h.years)
  const shownYear = year ?? h?.year ?? years[0]

  const notStaff = h?.isStaff === false || r?.isStaff === false
  const staffMessage = h?.message ?? r?.message ?? STAFF_ONLY_MESSAGE
  const balanceShifts = h?.balance?.shifts ?? r?.balanceShifts ?? 0
  const switching = history.isFetching && history.isPlaceholderData

  // Without a day to go by, an item not in the year shown is looked for in the other years (newest first).
  const [focusTried, setFocusTried] = React.useState<number[]>([])
  const nextYear =
    focusParams.focus && !focusParams.date && shownYear != null
      ? nextToTry(years.map(String), [...focusTried, shownYear].map(String))
      : null
  const focus = useFocusItem({
    scope: 'comp',
    rows: h && !history.isPlaceholderData ? h.items : undefined,
    idOf: (i) => i.key,
    dateOf: (i) => i.workDate ?? i.date,
    enabled: !notStaff,
    reveal: () => {
      setMode('year')
      setFilter('all')
    },
    hasMore: nextYear !== null,
    loadMore: () => {
      if (nextYear === null || shownYear == null) return
      setFocusTried((t) => [...t, shownYear])
      setYear(Number(nextYear))
    },
  })

  const counts = sourceCounts(h?.items ?? [])
  const groups = h ? groupByMonth(h.items, h.otPayByMonth, filter) : []
  const otPayTotal = h?.totals?.otPay ?? h?.otPayByMonth.reduce((s, p) => s + p.amount, 0) ?? 0

  return (
    <PageShell>
      <PageHero
        icon={<HandCoins />}
        title="Compensation"
        subtitle={
          <>
            <span className="max-md:hidden">
              Everything the system detected for you and everything HR gave you: extra hours, Sunday and holiday work, days off and overtime pay.
            </span>
            <span className="hidden max-md:inline">Everything detected for you and given by HR</span>
          </>
        }
        actions={
          !notStaff && (h || r) ? (
            <Button
              variant="glass"
              className="min-h-11 max-md:h-9 max-md:min-h-9 max-md:px-3.5 max-md:text-[13px] sm:min-h-9"
              onClick={() => {
                void history.refetch()
                void recent.refetch()
              }}
              disabled={history.isFetching || recent.isFetching}
            >
              <RefreshCw className={cn((history.isFetching || recent.isFetching) && 'animate-spin')} aria-hidden="true" /> Refresh
            </Button>
          ) : undefined
        }
        kpis={
          h && !notStaff ? (
            <>
              {/* Phones: the app's gradient balance card in place of the four tiles (kit/MOBILE.md). */}
              <PhoneBalanceHero
                shifts={balanceShifts}
                balance={h.balance}
                year={h.year}
                givenByHr={h.totals?.givenByHr ?? counts.hr}
                otPay={otPayTotal}
              />
              <KpiTile className="max-md:hidden" label="Balance" value={balanceShifts} format={(n) => n.toFixed(2)} unit={balanceShifts === 1 ? 'shift' : 'shifts'} icon={Wallet} tone="violet" hint="for HR to give as days off" />
              <KpiTile className="max-md:hidden" label="Given by HR" value={h.totals?.givenByHr ?? counts.hr} icon={UserCheck} tone="sapphire" hint={`in ${h.year}`} />
              <KpiTile className="max-md:hidden" label="Automatic" value={h.totals?.automatic ?? counts.automatic} icon={Sparkles} tone="amber" hint="detected from your punches" />
              <KpiTile className="max-md:hidden" label="Overtime pay" value={otPayTotal} format={(n) => formatINR(Math.round(n))} icon={HandCoins} tone="emerald" hint={`paid in your ${h.year} slips`} />
            </>
          ) : undefined
        }
      >
        {history.isPending && recent.isPending && <SkeletonList variant="tiles" count={4} label="Loading your compensation" />}
      </PageHero>

      {notStaff ? (
        <GlassCard role="status" className="flex items-start gap-3 text-sm" data-testid="compensation-staff-only">
          <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
          <p>{staffMessage}</p>
        </GlassCard>
      ) : (
        <SegmentedControl
          ariaLabel="Show"
          value={mode}
          onChange={setMode}
          className="max-md:w-full max-md:[&>button]:min-h-[46px] max-md:[&>button]:flex-1 max-md:[&>button]:px-2 max-md:[&>button]:text-[12px] max-md:[&>button]:leading-4 max-md:[&>button]:whitespace-normal"
          options={[
            { value: 'year', label: 'Year timeline', icon: History },
            { value: 'recent', label: 'Last 90 days', icon: CalendarClock },
            { value: 'ask', label: 'Ask HR', icon: MessageCircleQuestion },
          ]}
        />
      )}

      {!notStaff && focus.missing && (
        <FocusMissNote onDismiss={focus.dismiss}>
          {focus.missingBy === 'date' && focus.requested
            ? `Nothing is listed for ${dayText(focus.requested)} in your compensation.`
            : 'That compensation item is no longer in this list.'}
        </FocusMissNote>
      )}

      {/* Time-sensitive (today's / next working day's allowance, features switched off): on top in every view. */}
      {!notStaff && r && <CompensationAlerts payload={r} />}

      {notStaff ? null : mode === 'ask' ? (
        <AskHrPanel payload={r} />
      ) : mode === 'recent' ? (
        <RecentPanel query={recent} onAsk={() => setMode('ask')} />
      ) : history.isError && !h ? (
        <div className="flex flex-col gap-4 max-md:gap-3">
          {/* Kept here too, so a year that fails to load never strands the user on it. */}
          {years.length > 0 && shownYear != null && <YearPicker years={years} value={shownYear} onChange={setYear} ariaLabel="Show the year" />}
          <ErrorState error={history.error} what="your compensation for this year" onRetry={() => history.refetch()} retrying={history.isFetching} />
          <SectionHeader icon={CalendarClock} title="Your last 90 days" description="While the year cannot load, here is what the last 90 days hold." />
          <RecentPanel query={recent} onAsk={() => setMode('ask')} />
        </div>
      ) : !h ? (
        <SkeletonList variant="cards" count={3} label="Loading your compensation" />
      ) : (
        <div className={cn('flex flex-col gap-6 transition-opacity max-md:gap-3', switching && 'opacity-60')} aria-busy={switching}>
          <div className="grid gap-4 lg:grid-cols-[1fr_1.6fr]">
            <BalanceCard shifts={balanceShifts} balance={h.balance} />
            {/* Phones: no card - the year chips and the source chips sit straight on the page, as in the app. */}
            <GlassCard className="flex flex-col gap-4 max-md:gap-2.5 max-md:border-0! max-md:bg-transparent! max-md:p-0! max-md:shadow-none!">
              <SectionHeader
                className="max-md:hidden"
                as="h3"
                icon={History}
                tone="violet"
                title={`Your ${h.year}`}
                description="Pick a year and who it came from. Months are newest first."
              />
              {years.length > 0 && shownYear != null && <YearPicker years={years} value={shownYear} onChange={setYear} ariaLabel="Show the year" />}
              <SourceFilterChips value={filter} onChange={setFilter} counts={counts} />
              {h.totals && h.totals.shiftsGivenByHr > 0 && (
                <p className="text-[13px] text-muted-foreground max-md:text-[12px]">
                  HR gave you <span className="font-semibold text-foreground">{h.totals.shiftsGivenByHr.toFixed(2)} shifts</span> of
                  compensation in {h.year}.
                </p>
              )}
            </GlassCard>
          </div>

          <section aria-label={`Compensation in ${h.year}`} className="flex flex-col gap-6 max-md:gap-2">
            {groups.length === 0 ? (
              <EmptyState
                icon={HandCoins}
                tone="violet"
                title={filter === 'all' ? `Nothing in ${h.year}` : 'Nothing of this kind'}
                description={
                  filter === 'all'
                    ? 'When you work past your shift end, or on a Sunday or a company holiday, it shows up here.'
                    : 'Try another filter, or show everything.'
                }
                action={
                  filter !== 'all' ? (
                    <Button variant="outline" size="sm" onClick={() => setFilter('all')}>
                      Show everything
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              // Keyed by the filter too, so a new filter replays the months' entrance (capped stagger).
              groups.map((g, i) => <MonthSection key={`${filter}-${h.year}-${g.month}`} group={g} index={i} />)
            )}
          </section>
        </div>
      )}
    </PageShell>
  )
}

function RecentPanel({ query, onAsk }: { query: ReturnType<typeof useCompensation>; onAsk: () => void }) {
  const payload: CompensationPayload | undefined = query.data
  if (query.isPending) return <SkeletonList variant="cards" count={3} label="Loading the last 90 days" />
  if (!payload) {
    return <ErrorState error={query.error} what="your compensation" onRetry={() => query.refetch()} retrying={query.isFetching} />
  }
  return (
    <div className="flex flex-col gap-4 max-md:gap-3">
      {query.isError && (
        <ErrorState title="Could not refresh" error={query.error} what="your compensation" onRetry={() => query.refetch()} retrying={query.isFetching} compact />
      )}
      <RecentCompensation payload={payload} onAsk={onAsk} />
    </div>
  )
}
