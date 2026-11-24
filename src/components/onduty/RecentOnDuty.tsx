import { format, isValid, parseISO } from 'date-fns'
import { Briefcase, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GlassCard, SectionHeader, SkeletonList, StatusPill, type StatusTone } from '@/components/kit'
import { useOnDutyRecords } from '@/hooks/useOnDutyRecords'
import type { OnDutyRecord } from '@/lib/onduty-records'

const SHOWN = 5

function chip(item: OnDutyRecord): { label: string; tone: StatusTone } {
  const s = item.approvalStatus || item.status
  if (s === 'rejected') return { label: 'Rejected', tone: 'rejected' }
  if (s === 'pending_hod' || s === 'pending_hr') {
    return item.employeeEndedAt ? { label: 'Ended · waiting for approval', tone: 'waiting' } : { label: 'In progress · waiting for approval', tone: 'info' }
  }
  if (s === 'active' && !item.employeeEndedAt) return { label: 'In progress', tone: 'info' }
  return { label: 'Completed', tone: 'approved' }
}

function dayOf(item: OnDutyRecord): string {
  const raw = item.date ?? item.createdAt
  if (!raw) return ''
  const d = parseISO(raw)
  return isValid(d) ? format(d, 'EEE, d MMM') : ''
}

/**
 * "Previous On-Duty" under the Apply On-Duty form (owner 2026-11-24: earlier records on the same page): the last few
 * requests, each with its day, place, how it stands and its punches; "See all" opens View Records.
 */
export function RecentOnDuty({ onSeeAll, excludeId }: { onSeeAll: () => void; excludeId?: number | null }) {
  const { data, isLoading } = useOnDutyRecords(true, { poll: false })
  const items = (data?.pages[0]?.items ?? []).filter((i) => i.id !== excludeId).slice(0, SHOWN)

  if (!isLoading && !items.length) return null

  return (
    <GlassCard padding="lg" className="flex flex-col gap-3 max-md:p-4!">
      <SectionHeader
        as="h3"
        icon={Briefcase}
        title="Previous On-Duty"
        action={
          <Button variant="ghost" size="sm" onClick={onSeeAll} className="min-h-11 sm:min-h-8" aria-label="See all On-Duty records">
            See all <ChevronRight aria-hidden="true" />
          </Button>
        }
      />
      {isLoading ? (
        <SkeletonList variant="rows" count={3} label="Loading your previous On-Duty" />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => {
            const c = chip(item)
            const punches = item.punchCount
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={onSeeAll}
                  className="focus-ring flex w-full items-center gap-3 rounded-lg bg-foreground/[0.04] p-3 text-left transition-colors hover:bg-foreground/[0.07]"
                  aria-label={`${dayOf(item)}, ${item.destination}, ${c.label}, ${punches} of 4 punches`}
                >
                  <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Briefcase className="size-4" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[14px] font-semibold">{item.destination}</span>
                    <span className="text-[12px] text-muted-foreground tabular-nums">
                      {dayOf(item)} · {punches} of 4 punches
                    </span>
                  </span>
                  <StatusPill tone={c.tone} size="sm" dot={false} className="max-sm:hidden">
                    {c.label}
                  </StatusPill>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </GlassCard>
  )
}
