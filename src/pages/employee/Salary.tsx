import * as React from 'react'
import { Link } from 'wouter'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, BarChart3, CalendarRange, Coins, Info, Layers, ReceiptText, TrendingDown, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  EmptyState,
  ErrorState,
  GlassCard,
  KpiTile,
  PageHero,
  PageShell,
  SectionHeader,
  SkeletonBlock,
  SkeletonList,
  listItem,
} from '@/components/kit'
import { YearPicker } from '@/components/pay/YearPicker'
import {
  FallbackSlipRow,
  MoneyWent,
  PeriodChart,
  PhoneCompareChart,
  PhoneLatestCard,
  PhoneMoneyWent,
  PhoneSalaryHero,
  SlipRow,
} from '@/components/pay/SalaryParts'
import { PhoneLabel } from '@/components/pay/PhoneParts'
import { usePaySlips, useSalaryInsights } from '@/hooks/usePaySalary'
import { formatINR } from '@/lib/money'
import { isProductionInsights, latestPeriod, lossSentence, periodsNewestFirst, sortSlipsNewestFirst } from '@/lib/salary-insights'
import { cn } from '@/lib/utils'

const rupees = (n: number) => formatINR(Math.round(n))

export default function Salary() {
  const [year, setYear] = React.useState<number | null>(null)
  const q = useSalaryInsights(year)
  const data = q.data
  // The year's figures could not load: still list every slip (GET /my/salary-slips), so nothing is out of reach.
  const fallback = usePaySlips(q.isError && !data)
  const production = data ? isProductionInsights(data) : false
  const latest = data ? latestPeriod(data.periods) : null
  const switching = q.isFetching && q.isPlaceholderData
  const s = data?.summary
  const trend = data && data.periods.length > 1 ? data.periods.map((p) => p.netPayable) : undefined
  // The years stay pickable even when one year fails to load (so the person can go back to a year that works).
  const [years, setYears] = React.useState<number[]>([])
  if (data && !q.isPlaceholderData && data.years.join() !== years.join()) setYears(data.years)
  const shownYear = year ?? data?.year ?? years[0]

  // Phones (< 768px) show the mobile app's gradient year card in place of the four KPI tiles (kit/MOBILE.md).
  const kpis =
    !data || !s ? undefined : production ? (
      <>
        <PhoneSalaryHero data={data} production />
        <KpiTile className="max-md:hidden" label="Earned" value={s.earnedGross} format={rupees} icon={Coins} tone="sapphire" hint="for the shifts you worked" />
        <KpiTile className="max-md:hidden" label="Overtime pay" value={s.otPay} format={rupees} icon={Layers} tone="violet" hint="added to your pay" />
        <KpiTile className="max-md:hidden" label="Payable" value={s.netPayable} format={rupees} icon={Wallet} tone="emerald" hint={`${data.year}, after deductions`} trend={trend} />
        <KpiTile
          className="max-md:hidden"
          label="Late deductions"
          value={s.lateDeduction ?? '—'}
          format={rupees}
          icon={TrendingDown}
          tone="rose"
          hint={s.lateDeduction == null ? 'not recorded on these slips' : 'for late arrivals'}
        />
      </>
    ) : (
      <>
        <PhoneSalaryHero data={data} production={false} />
        <KpiTile
          className="max-md:hidden"
          label="Allocated"
          value={s.allocated ?? '—'}
          format={rupees}
          icon={CalendarRange}
          tone="sapphire"
          hint={
            s.allocated == null
              ? 'not recorded on these slips'
              : `${s.allocatedPeriods} ${s.allocatedPeriods === 1 ? 'month' : 'months'} of full salary`
          }
        />
        <KpiTile className="max-md:hidden" label="Earned" value={s.earnedGross} format={rupees} icon={Coins} tone="violet" hint="for the days you were paid" />
        <KpiTile className="max-md:hidden" label="Payable" value={s.netPayable} format={rupees} icon={Wallet} tone="emerald" hint={`${data.year}, after deductions`} trend={trend} />
        <KpiTile
          className="max-md:hidden"
          label="Lost to attendance"
          value={s.attendanceLoss ?? '—'}
          format={rupees}
          icon={TrendingDown}
          tone="rose"
          hint={s.attendanceLoss == null ? 'not recorded on these slips' : 'absent days, late and permission'}
        />
      </>
    )

  return (
    <PageShell>
      <PageHero
        icon={<Wallet />}
        title={
          <>
            <span className="max-md:hidden">Salary</span>
            <span className="hidden max-md:inline">Salary Slips</span>
          </>
        }
        subtitle={
          <>
            <span className="max-md:hidden">What you were allocated, what you earned, and what was paid: every slip explained.</span>
            <span className="hidden max-md:inline">What you were given, what you earned, what you lost</span>
          </>
        }
        actions={
          years.length > 0 && shownYear != null ? (
            <YearPicker years={years} value={shownYear} onChange={setYear} ariaLabel="Show the year" />
          ) : undefined
        }
        kpis={kpis}
      >
        {q.isPending && <SkeletonList variant="tiles" count={4} label="Loading your salary" />}
      </PageHero>

      {q.isError && !data ? (
        <section aria-labelledby="slips-fallback" className="flex flex-col gap-4 max-md:gap-2.5">
          <ErrorState error={q.error} what="your salary figures" onRetry={() => q.refetch()} retrying={q.isFetching} />
          <SectionHeader className="max-md:hidden" id="slips-fallback" icon={ReceiptText} title="All your salary slips" description="Open a slip to see it and download the PDF." />
          <PhoneLabel className="max-md:mt-1.5">All salary slips</PhoneLabel>
          {fallback.isPending ? (
            <SkeletonList variant="rows" count={4} label="Loading your salary slips" />
          ) : fallback.isError ? (
            <ErrorState error={fallback.error} what="your salary slips" onRetry={() => fallback.refetch()} retrying={fallback.isFetching} compact />
          ) : fallback.data.length === 0 ? (
            <EmptyState icon={Wallet} title="No salary slips yet" description="Your slips appear here once HR runs payroll." />
          ) : (
            <ul className="flex flex-col gap-3">
              {sortSlipsNewestFirst(fallback.data).map((slip, i) => (
                <motion.li key={slip.id} {...listItem(i)}>
                  <FallbackSlipRow slip={slip} />
                </motion.li>
              ))}
            </ul>
          )}
        </section>
      ) : !data ? (
        <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          <GlassCard className="flex flex-col gap-4">
            <SkeletonBlock className="h-5 w-48" />
            {[0, 1, 2, 3].map((i) => (
              <SkeletonBlock key={i} className="h-3 w-full" />
            ))}
          </GlassCard>
          <SkeletonList variant="rows" count={3} />
        </div>
      ) : data.periods.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title={data.years.length > 1 ? `No salary slips in ${data.year}` : 'No salary slips yet'}
          description={data.years.length > 1 ? 'Pick another year above to see its slips.' : 'Your slips appear here once HR runs payroll.'}
        />
      ) : (
        <div className={cn('flex flex-col gap-6 transition-opacity max-md:gap-3 lg:gap-8', switching && 'opacity-60')} aria-busy={switching}>
          {q.isError && (
            <ErrorState
              title="Could not load that year"
              error={q.error}
              what="that year's salary figures"
              onRetry={() => q.refetch()}
              retrying={q.isFetching}
              compact
            />
          )}

          {/* The plain "latest" sentence: the one thing to read first. */}
          {latest && <PhoneLatestCard latest={latest} />}
          {latest && (
            <GlassCard variant="stitched" tone="silk" className="flex flex-col gap-3 max-md:hidden sm:flex-row sm:items-center sm:gap-5">
              <span
                aria-hidden="true"
                className={cn(
                  'grid size-12 shrink-0 place-items-center rounded-full border',
                  (latest.attendanceLoss ?? latest.lateDeduction ?? 0) > 0
                    ? 'border-rejected-border bg-rejected-bg text-rejected'
                    : 'border-approved-border bg-approved-bg text-approved',
                )}
              >
                <TrendingDown className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="label-caps text-muted-foreground">Latest slip · {latest.period.label}</p>
                <p className="mt-1 text-[15px] leading-6 font-semibold">{lossSentence(latest)}</p>
              </div>
              <Button asChild variant="outline" className="min-h-11 shrink-0 sm:min-h-9">
                <Link href={`/employee/salary/${latest.slipId}`}>
                  See the slip <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </GlassCard>
          )}

          {/* Phones: the first note is in the year card above (as in the app); the card keeps any further notes. */}
          {production && data.notes.length > 0 && (
            <GlassCard
              role="note"
              className={cn(
                'flex items-start gap-3 text-[13.5px] max-md:border-0! max-md:bg-info-bg! max-md:p-3! max-md:text-[12.5px] max-md:leading-[18px] max-md:shadow-none!',
                data.notes.length === 1 && 'max-md:hidden',
              )}
            >
              <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
              <div className="flex flex-col gap-1">
                {data.notes.map((n, i) => (
                  <p key={n} className={i === 0 ? 'max-md:hidden' : undefined}>
                    {n}
                  </p>
                ))}
              </div>
            </GlassCard>
          )}

          <div className="grid gap-4 max-md:gap-3 lg:grid-cols-[1.35fr_1fr]">
            <GlassCard className="flex min-w-0 flex-col gap-4 max-md:p-3.5!">
              <SectionHeader
                className="max-md:hidden"
                as="h3"
                icon={BarChart3}
                tone="emerald"
                title={production ? 'Pay for each period' : 'Allocated vs earned'}
                description={
                  production
                    ? 'What each pay period earned. Open a period to see its slip.'
                    : 'Each month: the full salary, and what you earned for attendance. Open a month to see its slip.'
                }
              />
              <PeriodChart className="max-md:hidden" periods={data.periods} production={production} />
              <PhoneCompareChart periods={data.periods} production={production} />
            </GlassCard>
            <GlassCard className="flex min-w-0 flex-col gap-4 max-md:p-3.5!">
              <SectionHeader className="max-md:hidden" as="h3" icon={Layers} tone="violet" title="Where the money went" description={`All of ${data.year}, added up from your slips.`} />
              <MoneyWent className="max-md:hidden" summary={data.summary} />
              <PhoneMoneyWent summary={data.summary} production={production} year={data.year} />
            </GlassCard>
          </div>

          <section aria-labelledby="slips-title" className="flex flex-col gap-4 max-md:gap-2.5">
            <SectionHeader
              className="max-md:hidden"
              id="slips-title"
              icon={ReceiptText}
              title={`Salary slips in ${data.year}`}
              count={data.periods.length}
              description="Newest first. Open a slip to see every line and download the PDF."
            />
            <PhoneLabel className="max-md:mt-1.5">All salary slips</PhoneLabel>
            <ul className="flex flex-col gap-3">
              <AnimatePresence initial={false}>
                {periodsNewestFirst(data.periods).map((p, i) => (
                  <motion.li key={p.slipId} {...listItem(i)}>
                    <SlipRow period={p} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </section>
        </div>
      )}
    </PageShell>
  )
}
