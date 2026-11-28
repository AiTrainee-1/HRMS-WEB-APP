import * as React from 'react'
import { Link } from 'wouter'
import { format, parseISO } from 'date-fns'
import { motion } from 'framer-motion'
import { ArrowRight, CalendarCheck, CheckCircle2, ChevronRight, HandCoins, Headset, Info, UserCheck, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AnimatedNumber, BarList, EmptyState, GlassCard, SectionHeader, listItem } from '@/components/kit'
import { CompensationItemCard } from '@/components/employee/CompensationItemCard'
import { MarkerSymbol } from '@/components/employee/MarkerSymbol'
import { ContactBlockCard } from '@/components/support/ContactBlockCard'
import { focusKey } from '@/lib/focus-item'
import { formatINR } from '@/lib/money'
import { cn } from '@/lib/utils'
import {
  ASK_HR_TEXT,
  ASK_HR_TITLE,
  allowanceBanners,
  applyFilter,
  enabledNotice,
  filterOptions,
  groupItems,
  type AllowanceBanner,
  type CompensationFilterId,
  type CompensationItem,
  type CompensationPayload,
} from '@/lib/compensation'
import {
  FILTERS,
  formatShifts,
  monthSummary,
  otPayLine,
  type HistoryBalance,
  type MonthGroup,
  type SourceFilter,
} from '@/lib/compensation-history'
import { phoneChipClass, phoneCountClass } from './phone'

/** What the balance is and who can use it: HR only (an older backend), or the employee too (self-claims, `canClaim`). */
function balanceMeaning(canClaim: boolean | undefined): string {
  return canClaim
    ? 'Shifts credited to you for approved claims (extra hours, Sunday / holiday work), less the days off already taken from it. Use it with "Use my balance": your Department Head approves. A worked birthday is not added here: it is placed on a day of your birthday month (Birthday).'
    : 'Shifts credited to you (mainly from approved Sunday / holiday work), less the compensation days HR already gave you. Only HR can use your balance: ask HR to give you the day.'
}

/** The compensation balance: big figure, then credited / taken / alternative days as bars with their numbers.
 *  Phones show PhoneBalanceHero (in PageHero's KPI grid) instead. `onUse` (self-claims) adds "Use my balance". */
export function BalanceCard({
  shifts,
  balance,
  canClaim,
  onUse,
}: {
  shifts: number
  balance: HistoryBalance | null
  canClaim?: boolean
  onUse?: () => void
}) {
  const unit = shifts === 1 ? 'shift' : 'shifts'
  return (
    <GlassCard variant="stitched" tone="violet" className="flex h-full flex-col gap-4 max-md:hidden" data-testid="compensation-balance">
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-violet-border bg-violet-bg text-violet" aria-hidden="true">
          <MarkerSymbol name="bed" className="size-6" />
        </span>
        <div className="min-w-0">
          <p className="label-caps text-muted-foreground">Compensation balance</p>
          <p className="metric mt-1 flex items-baseline gap-1.5 text-[38px] leading-none">
            <AnimatedNumber value={shifts} format={(n) => n.toFixed(2)} />
            <span className="font-label text-[15px] font-semibold text-muted-foreground">{unit}</span>
          </p>
        </div>
      </div>
      {balance && (balance.creditedThisYear > 0 || balance.takenThisYear > 0 || balance.alternativeDaysAvailable > 0) && (
        <BarList
          format={(n) => n.toFixed(2)}
          items={[
            { key: 'credited', label: 'Credited this year', value: balance.creditedThisYear, tone: 'emerald' as const },
            { key: 'taken', label: 'Taken as days off this year', value: balance.takenThisYear, tone: 'violet' as const },
            { key: 'alt', label: 'Alternative days you can still take', value: balance.alternativeDaysAvailable, tone: 'sapphire' as const },
          ].filter((r) => r.value > 0)}
        />
      )}
      <p className="text-[12.5px] text-muted-foreground">{balanceMeaning(canClaim)}</p>
      {canClaim && onUse && (
        <Button variant="outline" size="sm" onClick={onUse} className="min-h-11 self-start sm:min-h-8">
          <CalendarCheck aria-hidden="true" /> Use my balance
        </Button>
      )}
    </GlassCard>
  )
}

function BalanceStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="max-md:min-w-[70px] max-md:grow max-md:basis-[22%] max-md:rounded-lg max-md:bg-white/[0.12] max-md:px-2 max-md:py-2">
      <p className="max-md:truncate max-md:font-[family-name:var(--font-display)] max-md:text-[13.5px] max-md:font-bold max-md:tabular-nums">{value}</p>
      <p className="max-md:mt-px max-md:truncate max-md:text-[10px] max-md:font-semibold max-md:text-white/75">{label}</p>
    </div>
  )
}

/**
 * Phones only (< 768px): the mobile app's gradient balance card - the balance in shifts, what it means, and the year's
 * figures as small translucent tiles. Sits in PageHero's KPI grid (the desktop KPI tiles are hidden on phones).
 */
export function PhoneBalanceHero({
  shifts,
  balance,
  year,
  givenByHr,
  otPay,
  canClaim,
  onUse,
}: {
  shifts: number
  balance: HistoryBalance | null
  year: number
  givenByHr: number
  otPay: number
  canClaim?: boolean
  onUse?: () => void
}) {
  const unit = shifts === 1 ? 'shift' : 'shifts'
  return (
    <div className="bg-brand-gradient hidden max-md:relative max-md:col-span-2 max-md:flex max-md:flex-col max-md:gap-1 max-md:overflow-hidden max-md:rounded-xl max-md:p-[18px] max-md:text-white max-md:shadow-[var(--m-shadow-low)]">
      <span aria-hidden="true" className="max-md:pointer-events-none max-md:absolute max-md:-top-[30px] max-md:-right-5 max-md:size-[120px] max-md:rounded-full max-md:bg-white/[0.08]" />
      <p className="max-md:relative max-md:text-[10.5px] max-md:font-[800] max-md:tracking-[0.08em] max-md:text-white/75">COMPENSATION BALANCE</p>
      <p className="max-md:relative max-md:flex max-md:items-baseline max-md:gap-2">
        <span className="max-md:font-[family-name:var(--font-display)] max-md:text-[36px] max-md:leading-10 max-md:font-bold max-md:tabular-nums">{shifts.toFixed(2)}</span>
        <span className="max-md:text-[15px] max-md:font-bold max-md:text-white/85">{unit}</span>
      </p>
      <p className="max-md:relative max-md:mt-1 max-md:text-[12px] max-md:leading-[17px] max-md:text-white/80">
        {canClaim
          ? 'Shifts credited to you for approved claims, less the days off already taken from it. Use it as a day off: your Department Head approves.'
          : 'Shifts credited to you for extra work, less the days off HR already gave you from it. Only HR can use your balance.'}
      </p>
      {balance && (
        <div className="max-md:relative max-md:mt-2.5 max-md:flex max-md:flex-wrap max-md:gap-2">
          <BalanceStat label={`Added in ${year}`} value={formatShifts(balance.creditedThisYear) || '0.00 shift'} />
          <BalanceStat label={`Taken in ${year}`} value={formatShifts(balance.takenThisYear) || '0.00 shift'} />
          <BalanceStat label="Given by HR" value={String(givenByHr)} />
          {otPay > 0 && <BalanceStat label="Overtime pay" value={formatINR(Math.round(otPay))} />}
        </div>
      )}
      {!!balance?.alternativeDaysAvailable && (
        <p className="max-md:relative max-md:mt-1 max-md:text-[12px] max-md:leading-[17px] max-md:text-white/80">
          Includes {balance.alternativeDaysAvailable} earlier alternative {balance.alternativeDaysAvailable === 1 ? 'day' : 'days'} off still available.
        </p>
      )}
      {canClaim && onUse && (
        <button
          type="button"
          onClick={onUse}
          className="focus-ring max-md:relative max-md:mt-2.5 max-md:inline-flex max-md:h-10 max-md:items-center max-md:justify-center max-md:gap-1.5 max-md:rounded-xl max-md:bg-white max-md:text-[13px] max-md:font-bold max-md:text-primary"
        >
          <CalendarCheck className="max-md:size-4" aria-hidden="true" /> Use my balance
        </button>
      )}
    </div>
  )
}

/** All / Given by HR / Automatic / For everyone, each with its count. Toggle buttons (aria-pressed).
 *  Phones: the app's chip row (white pills, a count pill in each), scrolling sideways. */
export function SourceFilterChips({
  value,
  onChange,
  counts,
}: {
  value: SourceFilter
  onChange: (f: SourceFilter) => void
  counts: Record<SourceFilter, number>
}) {
  return (
    <div
      role="group"
      aria-label="Show compensation from"
      className="flex flex-wrap gap-2 max-md:-mx-4 max-md:flex-nowrap max-md:overflow-x-auto max-md:px-4 max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden"
    >
      {FILTERS.map((f) => {
        const selected = f.key === value
        return (
          <button
            key={f.key}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(f.key)}
            className={cn(
              'font-label focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-semibold transition-colors pointer-coarse:min-h-11 max-md:min-h-9 max-md:shrink-0 max-md:pr-1.5 max-md:pl-3',
              selected
                ? 'border-transparent bg-brand-gradient text-white shadow-clay-sm'
                : 'border-foreground/15 text-foreground/80 hover:border-primary/50 hover:bg-primary/10',
              phoneChipClass(selected),
            )}
          >
            {f.label}
            <span className={cn('tabular-nums', selected ? 'text-white/85' : 'text-muted-foreground', phoneCountClass(selected))}>{counts[f.key]}</span>
          </button>
        )
      })}
    </div>
  )
}

/** One month of the year timeline: a month marker on the thread, the overtime pay (linking to its slip), the items.
 *  Phones: the app's month block - a dot, the month, the count at the right, the cards on a thin rail. */
export function MonthSection({
  group,
  index,
  onClaim,
  onPlace,
}: {
  group: MonthGroup
  index: number
  onClaim?: (item: CompensationItem) => void
  /** A worked birthday's "Use my birthday day" (2026-11-25). */
  onPlace?: (item: CompensationItem) => void
}) {
  const id = `comp-month-${group.month}`
  const n = group.items.length
  return (
    <motion.section {...listItem(index)} aria-labelledby={id} className="relative pl-7 max-md:pl-0! sm:pl-9">
      {/* The thread: one line down the month, with a knot at its head. */}
      <span aria-hidden="true" className="absolute top-2 bottom-0 left-[9px] w-[2px] rounded-full bg-linear-to-b from-violet/60 via-foreground/15 to-transparent max-md:hidden sm:left-[13px]" />
      <span
        aria-hidden="true"
        className="absolute top-1 left-0 grid size-5 place-items-center rounded-full border border-violet-border bg-violet-bg max-md:hidden sm:left-1"
      >
        <span className="size-2 rounded-full bg-violet" />
      </span>
      <div className="mb-3 max-md:mt-1.5 max-md:mb-2 max-md:flex max-md:items-center max-md:gap-2">
        <span aria-hidden="true" className="hidden max-md:block max-md:size-2.5 max-md:shrink-0 max-md:rounded-full max-md:bg-primary" />
        <h3 id={id} className="font-display text-[19px] leading-6 font-semibold max-md:text-[15px] max-md:leading-5">
          {group.label}
        </h3>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground max-md:hidden">{monthSummary(group)}</p>
        <p className="hidden max-md:block max-md:flex-1 max-md:text-right max-md:text-[11.5px] max-md:font-bold max-md:text-muted-foreground">
          {n} {n === 1 ? 'item' : 'items'}
          {group.hrShifts > 0 ? ` · ${formatShifts(group.hrShifts)} from HR` : ''}
        </p>
      </div>
      <div className="flex flex-col gap-3 max-md:ml-1 max-md:gap-2.5 max-md:border-l-2 max-md:border-input max-md:pl-3">
        {group.otPay && (
          <GlassCard
            variant={group.otPay.slipId ? 'interactive' : 'plain'}
            asChild={!!group.otPay.slipId}
            padding="sm"
            className="group border-approved-border max-md:min-h-11 max-md:border-0! max-md:bg-approved-bg! max-md:px-3 max-md:py-2.5 max-md:shadow-none!"
          >
            {group.otPay.slipId ? (
              <Link href={`/employee/salary/${group.otPay.slipId}`} className="flex items-center gap-3 max-md:gap-2">
                <OtPayBody line={otPayLine(group.otPay)} link />
              </Link>
            ) : (
              <div className="flex items-center gap-3 max-md:gap-2">
                <OtPayBody line={otPayLine(group.otPay)} />
              </div>
            )}
          </GlassCard>
        )}
        {/* Each item can be pointed at by a link (?focus=<item key>, e.g. "hw-2421": useFocusItem scope "comp"). */}
        {group.items.map((item) => (
          <div key={item.key} data-focus-key={focusKey('comp', item.key)}>
            <CompensationItemCard item={item} source={item.source} onClaim={onClaim} onPlace={onPlace} />
          </div>
        ))}
      </div>
    </motion.section>
  )
}

function OtPayBody({ line, link }: { line: string; link?: boolean }) {
  return (
    <>
      <span
        className="grid size-9 shrink-0 place-items-center rounded-lg border border-approved-border bg-approved-bg text-approved max-md:size-auto max-md:border-0 max-md:bg-transparent"
        aria-hidden="true"
      >
        <Wallet className="size-[18px] max-md:size-4" />
      </span>
      <span className="min-w-0 flex-1 text-[13.5px] font-semibold max-md:text-[12.5px] max-md:leading-[17px]">{line}</span>
      {link && (
        <>
          <span className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-brand-blue max-md:hidden">
            See the slip <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
          <span className="hidden max-md:inline-flex max-md:shrink-0 max-md:text-muted-foreground">
            <ChevronRight className="max-md:size-4" aria-hidden="true" />
            <span className="sr-only">See the slip</span>
          </span>
        </>
      )}
    </>
  )
}

// ---- the last 90 days (GET /employee/compensation): allowances, detected items, and the ask-HR panel -----------

/** `claimRules`: a newer backend (self-claims), where an allowance applies only after its claim is approved. */
function AllowanceCard({ banner, claimRules }: { banner: AllowanceBanner; claimRules?: boolean }) {
  return (
    <GlassCard
      className="flex items-start gap-3 border-info-border bg-info-bg/50 max-md:border-[1.5px]! max-md:border-[#4d7c0f]! max-md:bg-[#ecfccb]! max-md:p-3.5! max-md:shadow-none! max-md:dark:bg-[#65a30d38]!"
      data-testid={`compensation-allowance-${banner.when}`}
    >
      <MarkerSymbol name="timer" className="mt-0.5 size-5 text-info max-md:hidden" />
      <span aria-hidden="true" className="hidden max-md:grid max-md:size-9 max-md:shrink-0 max-md:place-items-center max-md:rounded-full max-md:bg-[#4d7c0f] max-md:text-white">
        <MarkerSymbol name="timer" className="max-md:size-[18px]" />
      </span>
      <div className="min-w-0">
        <p className="label-caps text-info max-md:text-[#3f6212] max-md:dark:text-[#bef264]">
          {banner.heading} · {format(parseISO(banner.date), 'EEE, d MMM')}
        </p>
        <p className="mt-1 text-[15px] font-semibold max-md:text-[14px]">{banner.headline}</p>
        {banner.detail && <p className="mt-1 text-[13px] text-muted-foreground max-md:text-[12.5px] max-md:leading-[18px] max-md:text-secondary-foreground">{banner.detail}</p>}
        <p className="mt-1 text-[12.5px] text-muted-foreground max-md:text-[12px]">
          {claimRules ? 'Your claim for it was approved: it applies on its own that day.' : 'It is automatic: there is nothing to claim.'}
        </p>
      </div>
    </GlassCard>
  )
}

/**
 * What matters today, shown at the top of the page in every view: HR switched compensation features off, and the
 * late-in allowance for today / the next working day (or a note that none applies). Renders nothing when empty.
 */
export function CompensationAlerts({ payload }: { payload: CompensationPayload }) {
  // The wording follows the backend's rules (claimsSupported), not whether this employee may claim right now (canClaim).
  const claimRules = payload.claimsSupported
  const notice = enabledNotice(payload.enabled)
  const banners = allowanceBanners(payload)
  const noAllowanceHint = banners.length === 0 && !!payload.enabled?.allowance
  if (!notice && banners.length === 0 && !noAllowanceHint) return null

  return (
    <div className="flex flex-col gap-4 max-md:gap-3" data-testid="compensation-alerts">
      {notice && (
        <GlassCard
          role="status"
          padding="sm"
          className="flex items-center gap-2 border-waiting-border bg-waiting-bg/60 text-sm text-waiting max-md:items-start max-md:border-0! max-md:bg-info-bg! max-md:text-[12.5px] max-md:leading-[18px] max-md:text-foreground max-md:shadow-none!"
          data-testid="compensation-off-notice"
        >
          <Info className="size-4 shrink-0 max-md:mt-px max-md:text-primary" aria-hidden="true" />
          {notice}
        </GlassCard>
      )}
      {banners.map((b) => (
        <AllowanceCard key={b.when} banner={b} claimRules={claimRules} />
      ))}
      {noAllowanceHint && (
        <GlassCard className="flex items-start gap-3 text-sm text-muted-foreground max-md:p-3.5! max-md:text-[12.5px] max-md:leading-[18px]">
          <MarkerSymbol name="timer" className="mt-0.5 text-info" />
          <p>
            {payload.canClaim
              ? 'No approved late-in allowance applies today or on your next working day. When you work past your shift end, claim the allowance under Claims: once your Department Head approves it, it applies on your next working day.'
              : claimRules
                ? 'No approved late-in allowance applies today or on your next working day. A late-in allowance applies only after its claim is approved by your Department Head.'
                : 'No late-in allowance applies today or on your next working day. When you work past your shift end, you get one for your next working day automatically.'}
          </p>
        </GlassCard>
      )}
    </div>
  )
}

/** The 90-day list: everything detected or assigned, by kind. (Today's allowance sits above, in CompensationAlerts.) */
export function RecentCompensation({
  payload,
  onAsk,
  onClaim,
  onPlace,
}: {
  payload: CompensationPayload
  onAsk?: () => void
  /** Self-claims: the Claim button on claimable items (only passed while the server says `canClaim`). */
  onClaim?: (item: CompensationItem) => void
  /** A worked birthday's "Use my birthday day" (2026-11-25). */
  onPlace?: (item: CompensationItem) => void
}) {
  const [filter, setFilter] = React.useState<CompensationFilterId>('all')
  const options = filterOptions(payload.items)
  // A filter whose items have gone (a refresh) falls back to "all" instead of showing an empty page.
  const active = options.some((o) => o.id === filter) ? filter : 'all'
  const groups = groupItems(applyFilter(payload.items, active), { canClaim: payload.canClaim })

  return (
    <div className="flex flex-col gap-4 max-md:gap-3">
      {payload.items.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          tone="violet"
          title="Nothing in the last 90 days"
          description={
            payload.canClaim
              ? 'When you work past your shift end, or on a Sunday or a company holiday, it shows up here to claim; a worked birthday shows up with its Birthday Compensation to place. If you think something is missing, ask HR.'
              : 'When you work past your shift end, or on a Sunday or a company holiday, it shows up here. If you think something is missing, ask HR.'
          }
          action={
            onAsk && (
              <Button variant="outline" size="sm" onClick={onAsk}>
                Ask HR about compensation
              </Button>
            )
          }
        />
      ) : (
        <>
          <div role="group" aria-label="Filter by kind" className="flex flex-wrap gap-2 max-md:-mx-4 max-md:flex-nowrap max-md:overflow-x-auto max-md:px-4 max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden">
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
                    selected
                      ? 'border-transparent bg-brand-gradient text-white'
                      : 'border-foreground/15 text-foreground/80 hover:border-primary/50 hover:bg-primary/10',
                    phoneChipClass(selected),
                  )}
                >
                  {o.label}
                  <span className={cn('tabular-nums', selected ? 'text-white/85' : 'text-muted-foreground', phoneCountClass(selected))}>{o.count}</span>
                </button>
              )
            })}
          </div>
          {groups.map((group) => (
            <section key={group.id} aria-labelledby={`comp-group-${group.id}`} className="flex flex-col gap-3 max-md:gap-2.5">
              <SectionHeader id={`comp-group-${group.id}`} as="h3" title={group.title} count={group.items.length} description={group.hint} />
              {group.items.map((item, i) => (
                <motion.div key={item.key} {...listItem(i)}>
                  <CompensationItemCard item={item} onClaim={onClaim} onPlace={onPlace} />
                </motion.div>
              ))}
            </section>
          ))}
        </>
      )}
    </div>
  )
}

/** How to ask HR: the server's wording, who may claim (HR only on an older backend; the employee too with `canClaim`),
 *  HR's contacts. Phones: the app's "ask" card - a headset well and title, the points with green ticks, the rule as a
 *  blue note. `onOpenClaims` (self-claims) links to the Claims view. */
export function AskHrPanel({ payload, onOpenClaims }: { payload: CompensationPayload | undefined; onOpenClaims?: () => void }) {
  const canClaim = !!payload?.canClaim
  // a newer backend that says this employee cannot claim right now (no Department Head, switched off ...)
  const claimRules = !!payload?.claimsSupported
  const ask = payload?.askHr
  const points = ask?.points ?? []
  const title = ask?.title ?? ASK_HR_TITLE
  return (
    <div className="flex flex-col gap-4 max-md:gap-3.5">
      <GlassCard className="flex flex-col gap-4 max-md:gap-2.5" data-testid="compensation-ask">
        <SectionHeader className="max-md:hidden" as="h3" icon={HandCoins} title={title} />
        <div className="hidden max-md:flex max-md:items-center max-md:gap-3">
          <span aria-hidden="true" className="max-md:grid max-md:size-[38px] max-md:shrink-0 max-md:place-items-center max-md:rounded-full max-md:bg-accent max-md:text-primary">
            <Headset className="max-md:size-5" />
          </span>
          <h3 className="max-md:flex-1 max-md:font-[family-name:var(--font-display)] max-md:text-[16px] max-md:leading-[22px] max-md:font-bold">{title}</h3>
        </div>
        <p className="text-[14px] text-foreground/85 max-md:text-[13px] max-md:leading-5 max-md:text-secondary-foreground">{ask?.text ?? ASK_HR_TEXT}</p>
        {points.length > 0 && (
          <ul className="flex list-disc flex-col gap-2 pl-5 text-[13.5px] text-muted-foreground marker:text-brand-blue max-md:mt-0.5 max-md:list-none max-md:gap-[9px] max-md:pl-0 max-md:text-[12.5px] max-md:leading-[18px] max-md:text-secondary-foreground">
            {points.map((p) => (
              <li key={p} className="max-md:flex max-md:items-start max-md:gap-2">
                <CheckCircle2 className="hidden max-md:mt-0.5 max-md:block max-md:size-[15px] max-md:shrink-0 max-md:text-approved" aria-hidden="true" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-start gap-2 rounded-lg border border-waiting-border bg-waiting-bg px-3 py-2.5 text-[13.5px] text-waiting max-md:mt-1 max-md:border-0 max-md:bg-info-bg max-md:p-3 max-md:text-[12.5px] max-md:leading-[18px] max-md:text-foreground">
          <Info className="mt-0.5 size-4 shrink-0 max-md:text-primary" aria-hidden="true" />
          {canClaim ? (
            <p>
              <span className="font-semibold">You can claim compensation yourself.</span> Claim what the system found for you under
              Claims, or ask to use your balance as a day off; your Department Head approves each one. If you worked extra and it is
              missing, tell HR the date and the time you worked until, and HR will check it.
            </p>
          ) : claimRules ? (
            <p data-testid="compensation-claims-closed">
              <span className="font-semibold">You cannot claim compensation yourself right now.</span>{' '}
              {payload?.claimMessage ?? 'Ask HR: HR can raise a claim for you, and your Department Head approves it.'} If you worked
              extra and it is missing, tell HR the date and the time you worked until, and HR will check it.
            </p>
          ) : (
            <p>
              <span className="font-semibold">You cannot assign compensation to yourself.</span> Only HR can. If you worked extra and it
              is missing, tell HR the date and the time you worked until, and HR will check it.
            </p>
          )}
        </div>
        {canClaim && onOpenClaims && (
          <Button variant="outline" size="sm" onClick={onOpenClaims} className="min-h-11 self-start sm:min-h-8">
            Go to Claims <ArrowRight aria-hidden="true" />
          </Button>
        )}
      </GlassCard>
      <ContactBlockCard block={ask?.contact} title="Contact HR" description="Call, message or email HR to request or claim compensation." />
      <p className="text-[13px] text-muted-foreground max-md:text-[12.5px]">
        {canClaim || claimRules
          ? 'Your claims and requests to use your balance are approved by your Department Head.'
          : 'Sunday and holiday work is approved by your Department Head after HR raises it.'}{' '}
        <Link href="/employee/hod" className="focus-ring inline-flex items-center gap-1 rounded-sm font-semibold text-brand-blue hover:underline">
          <UserCheck className="size-3.5" aria-hidden="true" /> See who your Department Head is
        </Link>
      </p>
    </div>
  )
}
