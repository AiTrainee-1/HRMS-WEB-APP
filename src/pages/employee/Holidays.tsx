import * as React from 'react'
import { motion } from 'framer-motion'
import {
  BellRing, CalendarClock, CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Flag, Hourglass, PartyPopper,
} from 'lucide-react'
import {
  EmptyState, ErrorState, GlassCard, KpiTile, PageHero, PageShell, SectionHeader, SegmentedControl, SkeletonList,
  listItem, staggerDelay,
} from '@/components/kit'
import { useHolidays } from '@/hooks/useHomeSources'
import { calendarDaysUntil, dateKey, inDaysText, parseLocalDate } from '@/lib/home-attention'
import type { Holiday } from '@/types'
import { cn } from '@/lib/utils'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const TYPE_LABEL: Record<string, string> = { national: 'National', regional: 'Regional', company: 'Company' }

export default function Holidays() {
  const now = new Date()
  const currentYear = now.getFullYear()
  const [year, setYear] = React.useState(currentYear)
  const today = dateKey(now)
  const q = useHolidays(year)

  const sorted = React.useMemo(() => [...(q.data ?? [])].sort((a, b) => a.date.localeCompare(b.date)), [q.data])
  const upcoming = sorted.filter((h) => h.date >= today)
  const next = upcoming[0]
  const thisMonthKey = today.slice(0, 7)
  const thisMonth = sorted.filter((h) => h.date.startsWith(thisMonthKey))
  const byMonth = MONTHS.map((_, m) => sorted.filter((h) => parseLocalDate(h.date)?.getMonth() === m))
  const isCurrent = year === currentYear
  const daysToNext = next ? (calendarDaysUntil(next.date, now) ?? 0) : null
  // Phone-only filter (the app's "Filter by type" chips); desktop lists every holiday.
  const [typeFilter, setTypeFilter] = React.useState<string>('all')
  const types = Object.keys(TYPE_LABEL).filter((t) => sorted.some((h) => h.holidayType === t))
  // A type the chosen year does not have (after a year change) falls back to All.
  const activeType = types.includes(typeFilter) ? typeFilter : 'all'
  const filtered = activeType === 'all' ? sorted : sorted.filter((h) => h.holidayType === activeType)
  const phoneMonths = MONTHS.map((name, m) => ({ name, m, list: filtered.filter((h) => parseLocalDate(h.date)?.getMonth() === m) })).filter((g) => g.list.length > 0)
  const thisMonthNow = isCurrent ? thisMonth.length : 0

  return (
    // Phones (< 768px): the mobile app's Company Holidays screen (app/holidays/index.tsx, kit/MOBILE.md) - title, the year
    // card with the total, two stat cells, the sapphire "Next Holiday" card, type filter chips, then the holidays grouped
    // by month. PageShell's gap is off on phones; each phone block carries its own spacing.
    <PageShell className="max-md:gap-0">
      <>
        <PageHero
          className="max-md:hidden"
          icon={<PartyPopper />}
          title="Holidays"
          subtitle="The company holiday calendar. Paid holidays are marked on your attendance too."
          actions={
            <SegmentedControl
              ariaLabel="Year"
              value={String(year)}
              onChange={(v) => setYear(Number(v))}
              options={[currentYear - 1, currentYear, currentYear + 1].map((y) => ({ value: String(y), label: String(y) }))}
            />
          }
          kpis={
            q.isSuccess ? (
              <>
                <KpiTile label={`Holidays in ${year}`} value={sorted.length} icon={CalendarDays} tone="violet" hint="published by HR" />
                <KpiTile
                  label="Still to come"
                  value={upcoming.length}
                  icon={CalendarClock}
                  tone="sapphire"
                  hint={year < currentYear ? 'this year is over' : 'from today'}
                />
                {isCurrent && (
                  <KpiTile label="This month" value={thisMonth.length} icon={CalendarRange} tone="emerald" hint={MONTHS[now.getMonth()]} />
                )}
                {daysToNext != null && (
                  <KpiTile label="Next holiday" value={inDaysText(daysToNext)} icon={Hourglass} tone="amber" hint={next?.name} />
                )}
              </>
            ) : undefined
          }
        />
        <div className="hidden max-md:mb-3.5 max-md:block">
          <h1 className="max-md:font-[family-name:var(--font-display)] max-md:text-[20px] max-md:leading-7 max-md:font-bold max-md:tracking-[-0.01em]">Company Holidays</h1>
          <p className="max-md:mt-0.5 max-md:text-[12px] max-md:leading-4 max-md:text-muted-foreground">Annual Holiday Calendar</p>
          <div className="max-md:mt-3 max-md:flex max-md:min-h-[52px] max-md:items-center max-md:gap-1 max-md:rounded-xl max-md:border max-md:border-border max-md:bg-card max-md:px-1.5 max-md:py-1.5 max-md:pr-2.5 max-md:shadow-[var(--m-shadow-low)]">
            <button
              type="button"
              onClick={() => setYear(year - 1)}
              disabled={year <= currentYear - 1}
              aria-label="Previous year"
              className="focus-ring max-md:-my-1 max-md:grid max-md:size-10 max-md:place-items-center max-md:rounded-full max-md:text-foreground max-md:active:bg-foreground/[0.06] max-md:disabled:text-input"
            >
              <ChevronLeft className="max-md:size-5" aria-hidden="true" />
            </button>
            <span className="max-md:font-[family-name:var(--font-display)] max-md:text-[15px] max-md:font-bold max-md:tabular-nums" aria-live="polite">
              {year}
            </span>
            <button
              type="button"
              onClick={() => setYear(year + 1)}
              disabled={year >= currentYear + 1}
              aria-label="Next year"
              className="focus-ring max-md:-my-1 max-md:grid max-md:size-10 max-md:place-items-center max-md:rounded-full max-md:text-foreground max-md:active:bg-foreground/[0.06] max-md:disabled:text-input"
            >
              <ChevronRight className="max-md:size-5" aria-hidden="true" />
            </button>
            <span className="max-md:flex-1" aria-hidden="true" />
            {q.isSuccess && (
              <span className="max-md:rounded-full max-md:bg-accent max-md:px-2.5 max-md:py-[5px] max-md:text-[10.5px] max-md:font-[800] max-md:text-primary">
                {sorted.length} Total {sorted.length === 1 ? 'Holiday' : 'Holidays'}
              </span>
            )}
          </div>
        </div>
      </>

      {q.isPending ? (
        <SkeletonList variant="cards" count={3} label="Loading holidays" />
      ) : q.isError ? (
        <ErrorState error={q.error} what={`the ${year} holidays`} onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : sorted.length === 0 ? (
        <EmptyState icon={PartyPopper} title={`No holidays published for ${year} yet`} description="HR adds the year's holidays here. Check again later." />
      ) : (
        <>
          <PhoneHolidays
            year={year}
            now={now}
            thisMonthCount={thisMonthNow}
            remaining={upcoming.length}
            next={next}
            daysToNext={daysToNext}
            all={sorted}
            types={types}
            typeFilter={activeType}
            setTypeFilter={setTypeFilter}
            months={phoneMonths}
            today={today}
          />
          {next && (
            <GlassCard variant="stitched" tone="violet" padding="lg" className="flex flex-col gap-4 max-md:hidden sm:flex-row sm:items-center">
              <BigDate iso={next.date} />
              <div className="min-w-0 flex-1">
                <p className="label-caps text-muted-foreground">Next holiday</p>
                <h2 className="font-display mt-1 text-2xl font-semibold">{next.name}</h2>
                <p className="mt-1 text-[14px] text-muted-foreground">
                  {WEEKDAYS[parseLocalDate(next.date)?.getDay() ?? 0]} · {TYPE_LABEL[next.holidayType] ?? next.holidayType} holiday
                  {next.description ? ` · ${next.description}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-start sm:items-end">
                <span className="metric text-4xl text-violet">{daysToNext === 0 ? 'Today' : daysToNext}</span>
                {daysToNext !== 0 && <span className="text-[13px] text-muted-foreground">{daysToNext === 1 ? 'day to go' : 'days to go'}</span>}
              </div>
            </GlassCard>
          )}

          <section aria-labelledby="year-title" className="flex flex-col gap-4 max-md:hidden">
            <SectionHeader id="year-title" icon={CalendarRange} tone="violet" title={`${year} at a glance`} description="Each month and its holidays." />
            <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {byMonth.map((list, m) => {
                const current = isCurrent && m === now.getMonth()
                return (
                  <motion.li
                    key={m}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: staggerDelay(m, 0.03) }}
                    className={cn(
                      'glass flex min-h-24 flex-col gap-2 rounded-xl p-3',
                      current && 'border-primary/50 bg-primary/[0.07] shadow-clay',
                    )}
                    aria-label={`${MONTHS[m]}: ${list.length ? list.map((h) => h.name).join(', ') : 'no holidays'}`}
                  >
                    <div className="flex items-center justify-between" aria-hidden="true">
                      <span className={cn('label-caps', current ? 'text-info' : 'text-muted-foreground')}>{MONTHS[m].slice(0, 3)}</span>
                      {list.length > 0 && (
                        <span className="font-label rounded-full bg-violet-bg px-1.5 text-[11px] font-bold text-violet tabular-nums">{list.length}</span>
                      )}
                    </div>
                    <ul className="flex flex-col gap-1" aria-hidden="true">
                      {list.slice(0, 3).map((h) => (
                        <li key={h.id} className={cn('flex items-baseline gap-1.5 text-[12.5px] leading-4', h.date < today && 'opacity-60')}>
                          <span className="w-5 shrink-0 font-semibold tabular-nums">{parseLocalDate(h.date)?.getDate()}</span>
                          <span className="min-w-0 truncate">{h.name}</span>
                        </li>
                      ))}
                      {list.length > 3 && <li className="text-[12px] text-muted-foreground">+{list.length - 3} more</li>}
                      {list.length === 0 && <li className="text-[12px] text-muted-foreground">—</li>}
                    </ul>
                  </motion.li>
                )
              })}
            </ol>
          </section>

          <section aria-labelledby="all-title" className="flex flex-col gap-4 max-md:hidden">
            <SectionHeader id="all-title" icon={Flag} title={`Every holiday in ${year}`} count={sorted.length} />
            <ul className="grid gap-3 md:grid-cols-2">
              {sorted.map((h, i) => (
                <motion.li key={h.id} {...listItem(i)}>
                  <HolidayRow h={h} past={h.date < today} isNext={h.id === next?.id} />
                </motion.li>
              ))}
            </ul>
          </section>
        </>
      )}
    </PageShell>
  )
}

const PHONE_TYPE_TONE: Record<string, string> = {
  national: 'max-md:bg-info-bg max-md:text-info',
  regional: 'max-md:bg-waiting-bg max-md:text-waiting',
  company: 'max-md:bg-approved-bg max-md:text-approved',
}

/** PHONE ONLY (< 768px): everything under the app's year card, from the same list the desktop view shows. */
function PhoneHolidays({
  year,
  now,
  thisMonthCount,
  remaining,
  next,
  daysToNext,
  all,
  types,
  typeFilter,
  setTypeFilter,
  months,
  today,
}: {
  year: number
  now: Date
  thisMonthCount: number
  remaining: number
  next: Holiday | undefined
  daysToNext: number | null
  all: Holiday[]
  types: string[]
  typeFilter: string
  setTypeFilter: (t: string) => void
  months: { name: string; m: number; list: Holiday[] }[]
  today: string
}) {
  const nd = next ? parseLocalDate(next.date) : null
  const chips = [{ key: 'all', label: 'All', count: all.length }, ...types.map((t) => ({ key: t, label: TYPE_LABEL[t] ?? t, count: all.filter((h) => h.holidayType === t).length }))]
  return (
    <div className="hidden max-md:block">
      {/* Two stat cells */}
      <div className="max-md:mb-3.5 max-md:grid max-md:grid-cols-2 max-md:gap-2">
        <div className="max-md:flex max-md:items-center max-md:gap-2 max-md:rounded-xl max-md:border max-md:border-border max-md:bg-card max-md:p-2.5 max-md:shadow-[var(--m-shadow-low)]">
          <span aria-hidden="true" className="max-md:grid max-md:size-[30px] max-md:shrink-0 max-md:place-items-center max-md:rounded-[9px] max-md:bg-info-bg max-md:text-primary">
            <CalendarDays className="max-md:size-[15px]" />
          </span>
          <span className="max-md:min-w-0">
            <span className="max-md:block max-md:font-[family-name:var(--font-display)] max-md:text-[17px] max-md:leading-5 max-md:font-bold max-md:tabular-nums">{thisMonthCount}</span>
            <span className="max-md:block max-md:truncate max-md:text-[9.5px] max-md:font-semibold max-md:text-muted-foreground">{MONTHS[now.getMonth()]} · This Month</span>
          </span>
        </div>
        <div className="max-md:flex max-md:items-center max-md:gap-2 max-md:rounded-xl max-md:border max-md:border-border max-md:bg-card max-md:p-2.5 max-md:shadow-[var(--m-shadow-low)]">
          <span aria-hidden="true" className="max-md:grid max-md:size-[30px] max-md:shrink-0 max-md:place-items-center max-md:rounded-[9px] max-md:bg-approved-bg max-md:text-approved">
            <Hourglass className="max-md:size-[15px]" />
          </span>
          <span className="max-md:min-w-0">
            <span className="max-md:block max-md:font-[family-name:var(--font-display)] max-md:text-[17px] max-md:leading-5 max-md:font-bold max-md:tabular-nums">{remaining}</span>
            <span className="max-md:block max-md:truncate max-md:text-[9.5px] max-md:font-semibold max-md:text-muted-foreground">Remaining in {year}</span>
          </span>
        </div>
      </div>

      {/* The next holiday */}
      {next && nd && (
        <section aria-label="Next holiday" className="max-md:mb-[18px] max-md:flex max-md:flex-col max-md:gap-3 max-md:rounded-xl max-md:bg-[linear-gradient(135deg,var(--grad-from),var(--grad-to))] max-md:p-4 max-md:text-white max-md:shadow-[var(--m-shadow-low)]">
          <div className="max-md:flex max-md:items-center max-md:justify-between max-md:gap-2">
            <span className="max-md:flex max-md:items-center max-md:gap-[5px] max-md:rounded-full max-md:bg-white/16 max-md:px-[9px] max-md:py-1 max-md:text-[10px] max-md:font-bold">
              <BellRing className="max-md:size-3" aria-hidden="true" /> Next Holiday
            </span>
            <span className="max-md:rounded-full max-md:bg-[#F59E0B] max-md:px-[9px] max-md:py-1 max-md:text-[10px] max-md:font-[800] max-md:text-[#2A1700]">
              {daysToNext === 0 ? 'Today' : `In ${daysToNext} ${daysToNext === 1 ? 'day' : 'days'}`}
            </span>
          </div>
          <div className="max-md:flex max-md:items-start max-md:gap-3">
            <div className="max-md:min-w-0 max-md:flex-1">
              <h2 className="max-md:font-[family-name:var(--font-display)] max-md:text-[20px] max-md:leading-6 max-md:font-bold max-md:tracking-[-0.3px]">{next.name}</h2>
              <p className="max-md:mt-0.5 max-md:mb-2 max-md:text-[12.5px] max-md:text-white/85">
                {WEEKDAYS[nd.getDay()]}, {nd.getDate()} {MONTHS[nd.getMonth()]} {nd.getFullYear()}
                {next.description ? ` · ${next.description}` : ''}
              </p>
              <span className="max-md:inline-block max-md:rounded-full max-md:bg-white/16 max-md:px-[9px] max-md:py-1 max-md:text-[10px] max-md:font-bold">
                {TYPE_LABEL[next.holidayType] ?? next.holidayType} Holiday
              </span>
            </div>
            <span aria-hidden="true" className="max-md:flex max-md:h-14 max-md:w-[52px] max-md:shrink-0 max-md:flex-col max-md:items-center max-md:justify-center max-md:gap-px max-md:rounded-lg max-md:bg-white/14">
              <span className="max-md:text-[9px] max-md:font-[800] max-md:text-white/75 max-md:uppercase">{MONTHS[nd.getMonth()].slice(0, 3)}</span>
              <span className="max-md:font-[family-name:var(--font-display)] max-md:text-[20px] max-md:leading-6 max-md:font-bold max-md:tabular-nums">{nd.getDate()}</span>
            </span>
          </div>
        </section>
      )}

      {/* Filter by type */}
      {chips.length > 2 && (
        <>
          <p className="max-md:mb-2 max-md:text-[11px] max-md:font-[800] max-md:tracking-[0.6px] max-md:text-muted-foreground">FILTER BY TYPE</p>
          <div role="group" aria-label="Filter by type" className="max-md:mb-1 max-md:flex max-md:flex-wrap max-md:gap-2">
            {chips.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setTypeFilter(c.key)}
                aria-pressed={typeFilter === c.key}
                className={cn(
                  'focus-ring max-md:min-h-9 max-md:rounded-full max-md:border max-md:px-3 max-md:text-[11.5px] max-md:font-bold',
                  typeFilter === c.key
                    ? 'max-md:border-transparent max-md:bg-brand-gradient max-md:text-white'
                    : 'max-md:border-border max-md:bg-card max-md:text-secondary-foreground',
                )}
              >
                {c.label} {c.count}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Month by month */}
      {months.map((g) => (
        <section key={g.m} aria-labelledby={`m-hol-${g.m}`}>
          <div className="max-md:mt-[18px] max-md:mb-2 max-md:flex max-md:items-baseline max-md:justify-between max-md:gap-2">
            <h2 id={`m-hol-${g.m}`} className="max-md:font-[family-name:var(--font-display)] max-md:text-[15px] max-md:font-semibold">
              {g.name} {year}
            </h2>
            <span className="max-md:text-[11px] max-md:font-semibold max-md:text-muted-foreground">
              {g.list.length} {g.list.length === 1 ? 'Holiday' : 'Holidays'}
            </span>
          </div>
          <ul className="max-md:flex max-md:flex-col max-md:gap-2">
            {g.list.map((h) => {
              const d = parseLocalDate(h.date)
              const past = h.date < today
              const isNext = h.id === next?.id
              return (
                <li
                  key={h.id}
                  className={cn(
                    'max-md:flex max-md:items-center max-md:gap-3 max-md:rounded-xl max-md:border max-md:bg-card max-md:p-3 max-md:shadow-[var(--m-shadow-low)]',
                    isNext ? 'max-md:border-primary max-md:ring-[0.5px] max-md:ring-primary' : 'max-md:border-border',
                    past && 'max-md:opacity-55',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'max-md:flex max-md:h-[54px] max-md:w-12 max-md:shrink-0 max-md:flex-col max-md:items-center max-md:justify-center max-md:rounded-lg',
                      isNext ? 'max-md:bg-brand-gradient max-md:text-white' : 'max-md:bg-muted',
                    )}
                  >
                    <span className={cn('max-md:text-[8px] max-md:font-[800] max-md:uppercase', !isNext && 'max-md:text-muted-foreground')}>{d ? WEEKDAYS[d.getDay()].slice(0, 3) : ''}</span>
                    <span className="max-md:font-[family-name:var(--font-display)] max-md:text-[17px] max-md:leading-5 max-md:font-bold max-md:tabular-nums">{d?.getDate()}</span>
                    <span className={cn('max-md:text-[8px] max-md:font-[800] max-md:uppercase', !isNext && 'max-md:text-muted-foreground')}>{d ? MONTHS[d.getMonth()].slice(0, 3) : ''}</span>
                  </span>
                  <span className="max-md:min-w-0 max-md:flex-1">
                    <span className="max-md:mb-[5px] max-md:flex max-md:items-center max-md:gap-1.5">
                      <span className={cn('max-md:truncate max-md:text-[14px] max-md:font-semibold', past ? 'max-md:text-muted-foreground' : 'max-md:text-foreground')}>{h.name}</span>
                      {isNext && <span className="max-md:shrink-0 max-md:rounded-full max-md:bg-accent max-md:px-[7px] max-md:py-0.5 max-md:text-[9px] max-md:font-[800] max-md:text-primary">Next</span>}
                      {past && <span className="max-md:shrink-0 max-md:rounded-full max-md:bg-muted max-md:px-[7px] max-md:py-0.5 max-md:text-[9px] max-md:font-[800] max-md:text-muted-foreground">Passed</span>}
                    </span>
                    <span className="sr-only">{d ? `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}. ` : ''}</span>
                    <span className={cn('max-md:inline-block max-md:rounded-full max-md:px-[9px] max-md:py-[3px] max-md:text-[10px] max-md:font-bold', PHONE_TYPE_TONE[h.holidayType] ?? 'max-md:bg-muted max-md:text-secondary-foreground')}>
                      {TYPE_LABEL[h.holidayType] ?? h.holidayType} Holiday
                    </span>
                    {(h.branchName || h.departmentName) && (
                      <span className="max-md:mt-1 max-md:block max-md:truncate max-md:text-[11px] max-md:text-muted-foreground">
                        {[h.branchName, h.departmentName].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

function BigDate({ iso }: { iso: string }) {
  const d = parseLocalDate(iso)
  return (
    <div className="weave-static grid w-20 shrink-0 place-items-center rounded-2xl border border-violet-border bg-violet-bg py-3 text-violet" aria-hidden="true">
      <span className="label-caps">{d ? MONTHS[d.getMonth()].slice(0, 3) : ''}</span>
      <span className="metric text-4xl leading-none">{d?.getDate()}</span>
    </div>
  )
}

function HolidayRow({ h, past, isNext }: { h: Holiday; past: boolean; isNext: boolean }) {
  const d = parseLocalDate(h.date)
  return (
    <GlassCard padding="sm" className={cn('flex items-center gap-3', past && 'opacity-70', isNext && 'border-violet-border')}>
      <div
        className={cn(
          'grid w-14 shrink-0 place-items-center rounded-lg border py-1.5',
          past ? 'border-neutral-border bg-neutral-bg text-neutral' : 'border-violet-border bg-violet-bg text-violet',
        )}
        aria-hidden="true"
      >
        <span className="text-[10.5px] font-bold uppercase">{d ? MONTHS[d.getMonth()].slice(0, 3) : ''}</span>
        <span className="metric text-xl leading-none">{d?.getDate()}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{h.name}</p>
        <p className="text-[12.5px] text-muted-foreground">
          {d ? `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}` : h.date}
          {h.branchName ? ` · ${h.branchName}` : ''}
          {h.departmentName ? ` · ${h.departmentName}` : ''}
        </p>
      </div>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="font-label rounded-full border border-foreground/15 px-2 py-px text-[11px] font-bold text-foreground/80">
          {TYPE_LABEL[h.holidayType] ?? h.holidayType}
        </span>
        {past && <span className="text-[11px] text-muted-foreground">Passed</span>}
        {isNext && <span className="text-[11px] font-semibold text-violet">Next</span>}
      </span>
    </GlassCard>
  )
}
