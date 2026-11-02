import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import {
  EmptyState,
  ErrorState,
  SectionHeader,
  SkeletonList,
  StatusViews,
  emptyViewText,
  listItem,
  monthEmptyText,
  type RequestView,
  type RequestViewsState,
  type Tone,
} from '@/components/kit'
import { MonthYearPicker, PhoneMonthBar } from '@/components/employee/MonthYearPicker'
import { focusKey } from '@/lib/focus-item'
import { isCurrentMonth, monthViewHint, monthViewLabel, type CalMonth } from '@/lib/month-switch'
import { monthSections } from '@/lib/my-requests'
import { WaitingElsewhereNote } from './MonthBits'
import { monthPickerProps } from './month-picker'

/**
 * A request page's list: a section heading, the four views (Waiting / This month / Approved / Rejected) and the cards
 * of the open view, with the standard states: skeleton cards while loading, Try again when the first load failed (a
 * failed load never looks empty), a small warning above the old list when only a refresh failed, and an empty state
 * that says what the view holds. Approved / Rejected lists are grouped under month headings when `dateOf` is given.
 * Each card's item carries `data-focus-key="<id>:<key>"`, so a link's `?focus=<key>` can point at it (useFocusItem with
 * `scope` = this `id`); `notice` shows above the cards (the "no longer in this list" note).
 *
 * `monthSwitch` (owner 2026-11-02, with month-scoped `views` - useRequestViews with `scope`): the Attendance page's month
 * control for this list - "‹ November 2026 ›" beside the heading on desktop, the phone month bar right above the four
 * count cards - the second view reads "This month" / "All in Sep", empty states name the month, and a note says when
 * requests of other months are still waiting.
 */
export function RequestList<T>({
  id,
  title,
  description,
  icon,
  tone,
  noun,
  monthKind,
  labels,
  views,
  query,
  keyOf,
  dateOf,
  renderItem,
  emptyIcon,
  emptyAction,
  notice,
  monthSwitch,
}: {
  /** Base id for the heading and the list panel (and the focus scope of its items). */
  id: string
  title: string
  description?: React.ReactNode
  icon?: LucideIcon
  tone?: Tone
  /** Plural, lower case: "leave requests". */
  noun: string
  monthKind: 'taken' | 'submitted'
  labels?: Partial<Record<RequestView, string>>
  views: RequestViewsState<T>
  query: { isPending: boolean; isError: boolean; error: unknown; isFetching: boolean; refetch: () => unknown; data?: unknown }
  keyOf: (row: T) => string | number
  /** Groups the Approved / Rejected views by month (newest first) when given. */
  dateOf?: (row: T) => string | null | undefined
  renderItem: (row: T, index: number) => React.ReactNode
  emptyIcon?: LucideIcon
  emptyAction?: React.ReactNode
  /** A note above the cards (e.g. <FocusMissNote>). */
  notice?: React.ReactNode
  /** The month switcher: moves the month of the (month-scoped) views. `min` / `max`: how far the arrows go (default:
   *  back without limit, forward to the current month). */
  monthSwitch?: { onChange: (month: CalMonth) => void; min?: CalMonth | null; max?: CalMonth | null }
}) {
  const headingId = `${id}-title`
  const panelId = `${id}-panel`
  const hasData = query.data !== undefined
  const failedFirst = query.isError && !hasData
  const month = monthSwitch && views.scope ? views.scope : null
  // One month on screen: no month headings inside it.
  const grouped = !month && !!dateOf && (views.view === 'approved' || views.view === 'rejected') && views.rows.length > 4
  const sections = grouped ? monthSections(views.rows, dateOf!) : [{ key: 'all', title: '', rows: views.rows }]
  const picker = month && monthSwitch ? monthPickerProps(month, monthSwitch.onChange, monthSwitch.min, monthSwitch.max) : null
  const pickerLabel = noun.charAt(0).toUpperCase() + noun.slice(1)
  const empty = month
    ? monthEmptyText(views.view, noun, month, views.counts.month)
    : {
        title: views.view === 'waiting' ? 'Nothing waiting' : views.view === 'month' ? 'Nothing this month' : views.view === 'approved' ? 'Nothing approved yet' : 'Nothing rejected',
        subtitle: emptyViewText(views.view, noun, monthKind),
      }
  let index = 0

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4 max-md:gap-2">
      {/* Phones: the app's bare section title (no description line; the approval steps are always open there). */}
      <SectionHeader
        id={headingId}
        title={title}
        description={description}
        icon={icon}
        tone={tone}
        className="max-md:[&_p]:hidden"
        action={picker ? <MonthYearPicker {...picker} label={pickerLabel} className="max-md:hidden" /> : undefined}
      />
      {picker && <PhoneMonthBar {...picker} label={pickerLabel} />}
      {!failedFirst && (
        <StatusViews
          value={views.view}
          onChange={views.setView}
          counts={views.counts}
          labels={month ? { ...labels, month: monthViewLabel(month) } : labels}
          monthKind={monthKind}
          hint={month ? monthViewHint(noun, month) : undefined}
          panelId={panelId}
          ariaLabel={`Show ${noun}`}
        />
      )}
      {month && monthSwitch && hasData && views.elsewhere && (
        <WaitingElsewhereNote
          count={views.elsewhere.count}
          month={views.elsewhere.month}
          onShow={(m) => {
            monthSwitch.onChange(m)
            views.setView('waiting')
          }}
        />
      )}
      {notice}
      <div id={panelId} role="tabpanel" aria-label={title} aria-busy={query.isPending || undefined}>
        {query.isPending ? (
          <SkeletonList variant="cards" count={3} label={`Loading your ${noun}`} />
        ) : failedFirst ? (
          <ErrorState error={query.error} what={`your ${noun}`} onRetry={() => void query.refetch()} retrying={query.isFetching} />
        ) : (
          <div className="flex flex-col gap-4 max-md:gap-2.5">
            {query.isError && (
              <ErrorState
                compact
                title="Could not refresh"
                message={`This list may be out of date. Your ${noun} could not be reloaded just now.`}
                onRetry={() => void query.refetch()}
                retrying={query.isFetching}
              />
            )}
            {views.rows.length === 0 ? (
              <EmptyState
                icon={emptyIcon}
                title={empty.title}
                description={empty.subtitle}
                // The Apply button belongs to now: not under an empty past month.
                action={(views.view === 'waiting' || views.view === 'month') && (!month || isCurrentMonth(month)) ? emptyAction : undefined}
                tone={views.view === 'rejected' ? 'slate' : views.view === 'approved' ? 'emerald' : views.view === 'waiting' ? 'amber' : 'sapphire'}
              />
            ) : (
              sections.map((s) => (
                <div key={s.key} className="flex flex-col gap-3 max-md:gap-2.5">
                  {s.title && (
                    <h3 className="label-caps flex items-center gap-2 text-muted-foreground">
                      {s.title}
                      <span className="rounded-full bg-foreground/[0.06] px-1.5 text-[11px] tabular-nums">{s.rows.length}</span>
                    </h3>
                  )}
                  <ul className="grid gap-4 max-md:gap-2.5 md:grid-cols-2">
                    <AnimatePresence mode="popLayout" initial={false}>
                      {s.rows.map((row) => {
                        const i = index++
                        return (
                          <motion.li key={keyOf(row)} {...listItem(i)} layout="position" className="min-w-0" data-focus-key={focusKey(id, keyOf(row))}>
                            {renderItem(row, i)}
                          </motion.li>
                        )
                      })}
                    </AnimatePresence>
                  </ul>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </section>
  )
}
