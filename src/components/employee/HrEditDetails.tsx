import { StatusPill } from '@/components/kit'
import { HR_EDIT_PANEL, hrEditBadgeClass, hrEditRows, hrEditStatusWord, hrEditTitle, hrEditTone, isHrEditApplied } from '@/lib/hr-edit'
import { cn } from '@/lib/utils'
import type { HrEdit } from '@/types'

/**
 * The "!" mark of a day HR edited (decorative: the words are in the cell's name, the popover and the day dialog).
 * Amber while the edit waits for approval, indigo once applied, rose when rejected.
 */
export function HrEditBang({ status, className }: { status: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('grid size-[18px] shrink-0 place-items-center rounded-full text-[11px] leading-none font-black', hrEditBadgeClass(status), className)}
    >
      !
    </span>
  )
}

/**
 * What HR changed on a day and where the approval stands (owner 2026-11-02): the "!" popover on the desktop calendar and
 * a section of the day dialog (desktop and phones). Lines: what HR changed, from -> to with shifts, the reason, who raised
 * it and when, the approval stage, who decided and when, and the reviewer's comment. An applied edit sits on the
 * "Edited by HR" indigo; any other on a neutral panel.
 */
export function HrEditDetails({
  edit,
  className,
  plain,
  headingId,
}: {
  edit: HrEdit
  className?: string
  /** No panel around it (the popover is already one). */
  plain?: boolean
  /** The heading's id, for an aria-labelledby around it. */
  headingId?: string
}) {
  const rows = hrEditRows(edit)
  const applied = isHrEditApplied(edit)
  return (
    <section
      aria-labelledby={headingId}
      data-testid="day-hr-edit"
      className={cn(
        'flex flex-col gap-2.5 text-[13px]',
        !plain && 'rounded-lg border p-3 max-md:rounded-xl max-md:p-3.5',
        !plain && (applied ? HR_EDIT_PANEL : 'hairline bg-foreground/[0.03] max-md:border-0 max-md:bg-muted'),
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <HrEditBang status={edit.status} />
        <h3 id={headingId} className="font-semibold text-foreground max-md:text-[14px]">
          {hrEditTitle(edit)}
        </h3>
        <StatusPill tone={hrEditTone(edit.status)} size="sm">
          {hrEditStatusWord(edit.status)}
        </StatusPill>
      </div>
      <dl className={cn('grid', plain ? 'gap-2' : 'gap-1.5')}>
        {rows.map((r) => (
          // The popover is narrow: label above value there (and on phones); side by side in the day dialog.
          <div key={r.key} className={cn('grid', plain ? 'gap-0.5' : 'grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] gap-x-3 max-md:grid-cols-1 max-md:gap-y-0.5')}>
            <dt className={cn('text-muted-foreground', plain ? 'text-[11.5px]' : 'max-md:text-[11.5px]')}>{r.label}</dt>
            <dd className={cn('min-w-0 break-words text-foreground', r.key === 'what' || r.key === 'change' ? 'font-semibold' : 'font-medium')}>
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
