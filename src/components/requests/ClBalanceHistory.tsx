import * as React from 'react'
import { CalendarPlus, CalendarX2, CheckCircle2, Clock, History, XCircle, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, GlassCard, SectionHeader, SkeletonList, Timeline } from '@/components/kit'
import { useCasualLeaveHistory } from '@/hooks/useCasualLeave'
import { balanceLine, historyRows, longDate } from '@/lib/casual-leave'

const ICON: Record<string, LucideIcon> = { opening: CalendarPlus, approved: CheckCircle2, pending: Clock, rejected: XCircle, lapsed: CalendarX2 }

/** How many lines show before "Show all". */
const FIRST = 6

/**
 * "Balance history" (owner 2026-11-02: the balance and its usage history are kept): the year's Casual Leave balance as a
 * running story, newest first - the fresh 12, every Casual Leave that took (or holds) days with the balance before and
 * after ("12 → 11"), rejected ones (no days used), and the unused days lapsing on 31 December. Casual Leave given or
 * proposed by HR on an attendance edit says so. An older server has no history: then this section is left out.
 */
export function ClBalanceHistory({ year }: { year: number }) {
  const q = useCasualLeaveHistory(year)
  const [all, setAll] = React.useState(false)
  React.useEffect(() => setAll(false), [year])
  if (q.isSuccess && q.data == null) return null

  const rows = q.data ? historyRows(q.data) : []
  const shown = all ? rows : rows.slice(0, FIRST)
  const cutOver = q.data?.balance?.cutOver

  return (
    <section aria-labelledby="cl-history-title" className="flex flex-col gap-4 max-md:gap-2.5">
      <SectionHeader
        id="cl-history-title"
        icon={History}
        tone="violet"
        title="Balance history"
        description={`How your ${year} Casual Leave balance moved, newest first.`}
      />
      <GlassCard className="flex flex-col gap-4 max-md:gap-3 max-md:p-3.5!">
        {q.isPending ? (
          <SkeletonList variant="rows" count={3} label="Loading the balance history" />
        ) : q.isError ? (
          <ErrorState compact error={q.error} what="your Casual Leave balance history" onRetry={() => void q.refetch()} retrying={q.isFetching} />
        ) : rows.length === 0 ? (
          <EmptyState
            compact
            icon={History}
            tone="violet"
            title={`No balance was kept for ${year}`}
            description={
              cutOver
                ? `The yearly balance of 12 days started on ${longDate(cutOver)}; Casual Leave before it is not counted.`
                : 'Casual Leave before the yearly balance started is not counted.'
            }
          />
        ) : (
          <>
            {q.data?.balance && (
              <p className="text-[13.5px] font-semibold text-foreground max-md:text-[13px]">
                Now: <span className="tabular-nums">{balanceLine(q.data.balance)}</span>
              </p>
            )}
            <Timeline
              ariaLabel={`Casual Leave balance history for ${year}`}
              items={shown.map((r, i) => ({
                key: r.key,
                title: r.title,
                time: (
                  <span className="flex flex-wrap items-baseline justify-end gap-x-2">
                    {r.change && <span className="font-semibold text-foreground">{r.change}</span>}
                    {r.on && <span>on {r.on}</span>}
                  </span>
                ),
                description:
                  r.detail || r.byHr ? (
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      {r.byHr && <span className="chip chip-indigo">by HR</span>}
                      {r.detail && <span>{r.detail}</span>}
                    </span>
                  ) : undefined,
                icon: ICON[r.kind] ?? Clock,
                tone: r.tone,
                current: i === 0 && r.kind === 'pending',
              }))}
            />
            {rows.length > FIRST && (
              <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setAll((v) => !v)} aria-expanded={all}>
                {all ? 'Show fewer' : `Show all ${rows.length}`}
              </Button>
            )}
          </>
        )}
      </GlassCard>
    </section>
  )
}
