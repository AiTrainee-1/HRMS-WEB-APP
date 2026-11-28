import * as React from 'react'
import { useSearch } from 'wouter'
import { CakeSlice, CalendarClock, Hand, HandCoins, History, Info, MessageCircleQuestion, RefreshCw, Sparkles, UserCheck, Wallet } from 'lucide-react'
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
import { ClaimDialog, ClaimsPanel, ClaimsReadyBanner, UseBalanceDialog } from '@/components/pay/CompensationClaims'
import { BirthdayPanel, BirthdayReadyBanner, PlaceBirthdayDialog } from '@/components/pay/BirthdayCompensation'
import { useCompensation } from '@/hooks/useCompensation'
import { useMyCompensationClaims } from '@/hooks/useCompensationClaims'
import { useBirthdayEntitlement, useBirthdayUses } from '@/hooks/useBirthdayCompensation'
import { bdcReady } from '@/lib/birthday-compensation'
import { useFocusItem } from '@/hooks/useFocusItem'
import { useCompensationHistory } from '@/hooks/usePayCompensation'
import { STAFF_ONLY_MESSAGE, type CompensationItem, type CompensationPayload } from '@/lib/compensation'
import { claimableItems } from '@/lib/compensation-claims'
import { groupByMonth, sourceCounts, type SourceFilter } from '@/lib/compensation-history'
import { nextToTry, readFocusParams } from '@/lib/focus-item'
import { dayText } from '@/lib/my-requests'
import { formatINR } from '@/lib/money'
import { cn } from '@/lib/utils'

type Mode = 'year' | 'recent' | 'claims' | 'birthday' | 'ask'

/** The view a link opens: ?tab=claims / ?tab=birthday, else the year timeline. */
function modeFromSearch(search: string): Mode {
  const tab = new URLSearchParams(search).get('tab')
  return tab === 'claims' || tab === 'birthday' ? tab : 'year'
}

export default function Compensation() {
  // A notification's View button opens ?focus=hw-<claim id> (a compensation claim: every kind shares the Holiday-work
  // table, hence "hw-") and/or ?date=<the day>: the year of that day, the item scrolled to and ringed; a claim the year
  // timeline does not list (an overtime or birthday claim, a day off from the balance) is looked for under Claims.
  // ?tab=claims opens the Claims view; ?tab=birthday the Birthday view, where ?focus=bdcu-<use id> (a Birthday
  // Compensation placement, 2026-11-25) is looked for.
  const search = useSearch()
  const focusParams = React.useMemo(() => readFocusParams(search), [search])
  const [mode, setMode] = React.useState<Mode>(() => modeFromSearch(search))
  // A link followed while the page is already open (a notification's View) still opens the view it names.
  const linkedMode = modeFromSearch(search)
  React.useEffect(() => {
    if (linkedMode !== 'year') setMode(linkedMode)
  }, [linkedMode])
  const [year, setYear] = React.useState<number | null>(() => (focusParams.date ? Number(focusParams.date.slice(0, 4)) : null))
  const [filter, setFilter] = React.useState<SourceFilter>('all')
  const history = useCompensationHistory(year)
  // The 90-day list: today's / next working day's allowance (shown in every view), the ask-HR block, and the fallback when a year fails.
  const recent = useCompensation()
  const h = history.data
  const r = recent.data
  // Self-claims (2026-11-19): only when the server says so. An older backend sends no `canClaim`: read-only, as before.
  const canClaim = r?.canClaim === true
  const claimsQuery = useMyCompensationClaims(canClaim)
  const [claimItem, setClaimItem] = React.useState<CompensationItem | null>(null)
  const [useOpen, setUseOpen] = React.useState(false)
  const onClaim = canClaim ? setClaimItem : undefined
  const onUse = canClaim ? () => setUseOpen(true) : undefined
  const readyCount = claimableItems(r).length

  // The years stay pickable even when one year fails to load.
  const [years, setYears] = React.useState<number[]>([])
  if (h && !history.isPlaceholderData && h.years.join() !== years.join()) setYears(h.years)
  const shownYear = year ?? h?.year ?? years[0]

  const notStaff = h?.isStaff === false || r?.isStaff === false

  // Birthday Compensation on a chosen date (2026-11-25): this year's birthday, every placement, "Use my birthday day".
  // `data` null = a server without the routes: no Birthday view.
  const birthdayLink = !!focusParams.focus?.startsWith('bdcu-')
  const bday = useBirthdayEntitlement(!notStaff)
  const bdayOn = !!bday.data && bday.data.isStaff
  const bdayUses = useBirthdayUses(!notStaff && (mode === 'birthday' || birthdayLink))
  const [placeOpen, setPlaceOpen] = React.useState(false)
  // A worked birthday's item (and the banner) opens the Birthday view, and the day picker straight away when it can be placed.
  const onPlace = bdayOn
    ? () => {
        setMode('birthday')
        if (bdcReady(bday.data)) setPlaceOpen(true)
      }
    : undefined

  // The Claims view needs the server's say-so; while the 90-day answer loads it waits, without it it falls back. The
  // Birthday view likewise needs the server's birthday routes.
  const shownMode: Mode =
    (mode === 'claims' && r && !canClaim) || (mode === 'birthday' && (bday.data === null || bday.data?.isStaff === false)) ? 'year' : mode
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
    // A Birthday Compensation placement is never in the timeline: it is looked for in the Birthday view (below).
    enabled: !notStaff && !birthdayLink,
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

  // The fallback for a claim link: the employee's claims, once the year timeline has said it is not there.
  const claimLink = !!focusParams.focus?.startsWith('hw-')
  const claimFallback = claimLink && canClaim && focus.missing
  const claimFocus = useFocusItem({
    scope: 'claim',
    rows: claimFallback ? claimsQuery.data : undefined,
    idOf: (c) => c.key,
    enabled: claimFallback,
    reveal: () => setMode('claims'),
  })
  // A Birthday Compensation placement (?focus=bdcu-<id>): the Birthday view's list, scrolled to and ringed.
  const birthdayFocus = useFocusItem({
    scope: 'bdc',
    rows: birthdayLink && bdayUses.data ? bdayUses.data : undefined,
    idOf: (u) => u.key,
    enabled: birthdayLink && !notStaff,
    reveal: () => setMode('birthday'),
  })
  const showMissing =
    (focus.missing && !recent.isPending && !claimFocus.found && (!claimFallback || claimFocus.missing || (claimsQuery.isError && !claimsQuery.data))) ||
    birthdayFocus.missing

  const counts = sourceCounts(h?.items ?? [])
  const groups = h ? groupByMonth(h.items, h.otPayByMonth, filter) : []
  const otPayTotal = h?.totals?.otPay ?? h?.otPayByMonth.reduce((s, p) => s + p.amount, 0) ?? 0

  return (
    <>
      <PageShell>
        <PageHero
          icon={<HandCoins />}
          title="Compensation"
          subtitle={
            canClaim ? (
              <>
                <span className="max-md:hidden">
                  What the system found for you, what you claimed and what HR gave you: extra hours, Sunday and holiday work, birthdays, days off and overtime pay.
                </span>
                <span className="hidden max-md:inline">Found for you, claimed by you, given by HR</span>
              </>
            ) : (
              <>
                <span className="max-md:hidden">
                  Everything the system detected for you and everything HR gave you: extra hours, Sunday and holiday work, days off and overtime pay.
                </span>
                <span className="hidden max-md:inline">Everything detected for you and given by HR</span>
              </>
            )
          }
          actions={
            !notStaff && (h || r) ? (
              <Button
                variant="glass"
                className="min-h-11 max-md:h-9 max-md:min-h-9 max-md:px-3.5 max-md:text-[13px] sm:min-h-9"
                onClick={() => {
                  void history.refetch()
                  void recent.refetch()
                  if (canClaim) void claimsQuery.refetch()
                  void bday.refetch()
                  if (mode === 'birthday' || birthdayLink) void bdayUses.refetch()
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
                  canClaim={canClaim}
                  onUse={onUse}
                />
                <KpiTile className="max-md:hidden" label="Balance" value={balanceShifts} format={(n) => n.toFixed(2)} unit={balanceShifts === 1 ? 'shift' : 'shifts'} icon={Wallet} tone="violet" hint={canClaim ? 'to use as days off' : 'for HR to give as days off'} />
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
            value={shownMode}
            onChange={setMode}
            className="max-md:w-full max-md:[&>button]:min-h-[46px] max-md:[&>button]:flex-1 max-md:[&>button]:px-2 max-md:[&>button]:text-[12px] max-md:[&>button]:leading-4 max-md:[&>button]:whitespace-normal"
            options={[
              { value: 'year', label: 'Year timeline', icon: History },
              { value: 'recent', label: 'Last 90 days', icon: CalendarClock },
              ...(canClaim || shownMode === 'claims' ? [{ value: 'claims' as const, label: 'Claims', icon: Hand }] : []),
              ...(bdayOn || shownMode === 'birthday' ? [{ value: 'birthday' as const, label: 'Birthday', icon: CakeSlice }] : []),
              { value: 'ask', label: 'Ask HR', icon: MessageCircleQuestion },
            ]}
          />
        )}

        {!notStaff && showMissing && (
          <FocusMissNote
            onDismiss={() => {
              focus.dismiss()
              claimFocus.dismiss()
              birthdayFocus.dismiss()
            }}
          >
            {focus.missingBy === 'date' && focus.requested
              ? `Nothing is listed for ${dayText(focus.requested)} in your compensation.`
              : 'That compensation item is no longer in this list.'}
          </FocusMissNote>
        )}

        {/* Something to claim (self-claims): a way to the Claims view from every other view. */}
        {!notStaff && canClaim && shownMode !== 'claims' && <ClaimsReadyBanner count={readyCount} onOpen={() => setMode('claims')} />}
        {/* Birthday Compensation to place (2026-11-25): a way to the day picker from every other view. */}
        {!notStaff && bdayOn && shownMode !== 'birthday' && <BirthdayReadyBanner ent={bday.data} onOpen={() => onPlace?.()} />}

        {/* Time-sensitive (today's / next working day's allowance, features switched off): on top in every view. */}
        {!notStaff && r && <CompensationAlerts payload={r} />}

        {notStaff ? null : shownMode === 'ask' ? (
          <AskHrPanel payload={r} onOpenClaims={canClaim ? () => setMode('claims') : undefined} />
        ) : shownMode === 'recent' ? (
          <RecentPanel query={recent} onAsk={() => setMode('ask')} onClaim={onClaim} onPlace={onPlace} />
        ) : shownMode === 'birthday' ? (
          <BirthdayPanel entQuery={bday} usesQuery={bdayUses} onPlace={() => setPlaceOpen(true)} />
        ) : shownMode === 'claims' ? (
          r ? (
            <ClaimsPanel payload={r} claimsQuery={claimsQuery} onClaim={setClaimItem} onUseBalance={() => setUseOpen(true)} />
          ) : recent.isPending ? (
            <SkeletonList variant="cards" count={3} label="Loading your claims" />
          ) : (
            <ErrorState error={recent.error} what="your compensation" onRetry={() => recent.refetch()} retrying={recent.isFetching} />
          )
        ) : history.isError && !h ? (
          <div className="flex flex-col gap-4 max-md:gap-3">
            {/* Kept here too, so a year that fails to load never strands the user on it. */}
            {years.length > 0 && shownYear != null && <YearPicker years={years} value={shownYear} onChange={setYear} ariaLabel="Show the year" />}
            <ErrorState error={history.error} what="your compensation for this year" onRetry={() => history.refetch()} retrying={history.isFetching} />
            <SectionHeader icon={CalendarClock} title="Your last 90 days" description="While the year cannot load, here is what the last 90 days hold." />
            <RecentPanel query={recent} onAsk={() => setMode('ask')} onClaim={onClaim} onPlace={onPlace} />
          </div>
        ) : !h ? (
          <SkeletonList variant="cards" count={3} label="Loading your compensation" />
        ) : (
          <div className={cn('flex flex-col gap-6 transition-opacity max-md:gap-3', switching && 'opacity-60')} aria-busy={switching}>
            <div className="grid gap-4 lg:grid-cols-[1fr_1.6fr]">
              <BalanceCard shifts={balanceShifts} balance={h.balance} canClaim={canClaim} onUse={onUse} />
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
                groups.map((g, i) => <MonthSection key={`${filter}-${h.year}-${g.month}`} group={g} index={i} onClaim={onClaim} onPlace={onPlace} />)
              )}
            </section>
          </div>
        )}
      </PageShell>

      {/* Self-claims: claim one item; ask to use the balance (both go to the Department Head). */}
      <ClaimDialog item={claimItem} onClose={() => setClaimItem(null)} />
      <UseBalanceDialog open={useOpen} onOpenChange={setUseOpen} payload={r} />
      {/* Birthday Compensation: the day, the part, a reason (the Department Head, then HR, approve it). */}
      <PlaceBirthdayDialog open={placeOpen} onOpenChange={setPlaceOpen} ent={bday.data} />
    </>
  )
}

function RecentPanel({
  query,
  onAsk,
  onClaim,
  onPlace,
}: {
  query: ReturnType<typeof useCompensation>
  onAsk: () => void
  onClaim?: (item: CompensationItem) => void
  onPlace?: (item: CompensationItem) => void
}) {
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
      <RecentCompensation payload={payload} onAsk={onAsk} onClaim={onClaim} onPlace={onPlace} />
    </div>
  )
}
