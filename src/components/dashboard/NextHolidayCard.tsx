import { Link } from 'wouter'
import { ChevronRight, PartyPopper } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GlassCard, SectionHeader } from '@/components/kit'
import { useHolidays } from '@/hooks/useHomeSources'
import { calendarDaysUntil, dateKey, inDaysText, parseLocalDate } from '@/lib/home-attention'
import type { Holiday } from '@/types'

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** The next company holiday (and the one after), from this year's list, or next year's in late December. */
export function NextHolidayCard({ now }: { now: Date }) {
  const year = now.getFullYear()
  const thisYear = useHolidays(year)
  const today = dateKey(now)
  const upcoming = (thisYear.data ?? []).filter((h) => h.date >= today).sort((a, b) => a.date.localeCompare(b.date))
  // Nothing left this year: look at next year (only then is that list asked for).
  const nextYear = useHolidays(thisYear.isSuccess && upcoming.length === 0 ? year + 1 : year)
  const list = upcoming.length ? upcoming : (nextYear.data ?? []).filter((h) => h.date >= today).sort((a, b) => a.date.localeCompare(b.date))
  if (thisYear.isPending || thisYear.isError) return null
  const [next, after] = list

  return (
    <>
      <GlassCard padding="lg" className="flex h-full flex-col gap-4 max-md:hidden">
        <SectionHeader
          as="h2"
          icon={PartyPopper}
          tone="violet"
          title="Next holiday"
          action={
            <Button asChild variant="ghost" size="sm" className="min-h-11 sm:min-h-8">
              <Link href="/employee/holidays">
                All holidays <ChevronRight />
              </Link>
            </Button>
          }
        />
        {!next ? (
          <p className="text-sm text-muted-foreground">No more holidays are published for this year.</p>
        ) : (
          <>
            <HolidayRow h={next} now={now} big />
            {after && (
              <p className="text-[12.5px] text-muted-foreground">
                Then <span className="font-semibold text-foreground">{after.name}</span> on {formatDay(after.date)}.
              </p>
            )}
          </>
        )}
      </GlassCard>
      {next && <PhoneHolidayCard h={next} now={now} />}
    </>
  )
}

/**
 * PHONE ONLY (< 768px): the mobile Home's holiday row - an amber party well, the name, "Mon, 25 Dec 2026 • National" and
 * an "in N days" pill; the whole card opens the holiday list. First in its column on phones (the app shows it above the
 * last-salary card).
 */
function PhoneHolidayCard({ h, now }: { h: Holiday; now: Date }) {
  const d = parseLocalDate(h.date)
  const days = calendarDaysUntil(h.date, now) ?? 0
  const type = h.holidayType ? `${h.holidayType.charAt(0).toUpperCase()}${h.holidayType.slice(1)}` : 'Holiday'
  return (
    <Link
      href="/employee/holidays"
      aria-label={`Next holiday: ${h.name}, ${d ? formatDay(h.date) : h.date}, ${inDaysText(days)}. Open all holidays`}
      className="focus-ring hidden max-md:order-first max-md:mb-5 max-md:flex max-md:items-center max-md:gap-3 max-md:rounded-xl max-md:border max-md:border-border max-md:bg-card max-md:p-3 max-md:shadow-[var(--m-shadow-low)] max-md:active:opacity-85"
    >
      <span aria-hidden="true" className="max-md:grid max-md:size-10 max-md:shrink-0 max-md:place-items-center max-md:rounded-lg max-md:bg-[#FEF3C7] max-md:text-[#D97706] max-md:dark:bg-[#5C2E0A] max-md:dark:text-[#FBBF24]">
        <PartyPopper className="max-md:size-[18px]" />
      </span>
      <span className="max-md:min-w-0 max-md:flex-1">
        <span className="max-md:block max-md:truncate max-md:text-[14px] max-md:font-semibold max-md:text-foreground">{h.name}</span>
        <span className="max-md:mt-0.5 max-md:block max-md:truncate max-md:text-[11px] max-md:text-muted-foreground">
          {d ? `${WEEKDAY[d.getDay()].slice(0, 3)}, ${String(d.getDate()).padStart(2, '0')} ${MONTH[d.getMonth()]} ${d.getFullYear()}` : h.date} • {type}
        </span>
      </span>
      <span className="max-md:shrink-0 max-md:rounded-full max-md:bg-accent max-md:px-2.5 max-md:py-[5px] max-md:text-[10px] max-md:font-[800] max-md:text-primary">
        {inDaysText(days)}
      </span>
    </Link>
  )
}

function HolidayRow({ h, now, big }: { h: Holiday; now: Date; big?: boolean }) {
  const d = parseLocalDate(h.date)
  const days = calendarDaysUntil(h.date, now) ?? 0
  return (
    <div className="flex items-center gap-4">
      <div
        className="weave-static grid w-16 shrink-0 place-items-center rounded-xl border border-violet-border bg-violet-bg py-2 text-center text-violet"
        aria-hidden="true"
      >
        <span className="label-caps">{d ? MONTH[d.getMonth()] : ''}</span>
        <span className="metric text-[28px] leading-none">{d?.getDate()}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className={big ? 'text-[17px] font-semibold' : 'font-semibold'}>{h.name}</p>
        <p className="text-[13px] text-muted-foreground">
          {d ? WEEKDAY[d.getDay()] : ''} · <span className="capitalize">{h.holidayType}</span> holiday
        </p>
      </div>
      <span className="font-label shrink-0 rounded-full border border-violet-border bg-violet-bg px-2.5 py-0.5 text-[12px] font-bold text-violet">
        {inDaysText(days)}
      </span>
    </div>
  )
}

function formatDay(iso: string): string {
  const d = parseLocalDate(iso)
  return d ? `${WEEKDAY[d.getDay()].slice(0, 3)}, ${d.getDate()} ${MONTH[d.getMonth()]}` : iso
}
