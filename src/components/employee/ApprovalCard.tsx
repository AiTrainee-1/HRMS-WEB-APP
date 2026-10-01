import * as React from 'react'
import { Check, X } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ApprovalTrail } from '@/components/employee/ApprovalTrail'
import { hasTrail, waitingText } from '@/lib/approval'
import { cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import type { ApprovalProgress } from '@/types'

export interface ApprovalCardProps {
  type: string
  employeeName: string
  employeeCode: string
  department?: string
  dateRange: string
  reason: string
  /** Extra context under the reason, e.g. "Approving forwards this to HR". */
  note?: string
  /** Second chip after the category, e.g. a permission's type ("Morning Late-In · 1 hour"). */
  badge?: string
  /** Outcome chip (e.g. "Overdue / Excess") when the request already has one; className is a chip tone. */
  outcome?: { label: string; className: string }
  /** Where the request stands in its approval pipeline; absent on an older backend (the card then behaves as before). */
  approval?: ApprovalProgress | null
  /** Whether the pipeline lets this Department Head approve / reject right now; an action it forbids is not offered. */
  canApprove?: boolean
  canReject?: boolean
  disabled?: boolean
  onApprove: () => void
  onReject: (comment: string) => void
  isSubmitting?: boolean
}

export function ApprovalCard({
  type, employeeName, employeeCode, department, dateRange, reason, note, badge, outcome, approval, canApprove = true,
  canReject = true, disabled, onApprove, onReject, isSubmitting,
}: ApprovalCardProps) {
  const [rejectOpen, setRejectOpen] = React.useState(false)
  const [comment, setComment] = React.useState('')
  const [expanded, setExpanded] = React.useState(false)

  const initials = employeeName
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  // Where the request stands: the step trail says it for a multi-step pipeline, this chip for a one-step one.
  const waiting = hasTrail(approval) ? null : waitingText(approval)

  return (
    <article className="glass-raised flex flex-col gap-4 rounded-lg p-5 transition hover:border-primary/30 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <Avatar className="size-11 rounded-md">
          <AvatarFallback className="rounded-md bg-primary/15 font-bold text-brand-blue">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[16px] font-semibold">{employeeName}</span>
            <span className="font-label text-[12px] text-muted-foreground">{employeeCode}</span>
            <span className="chip chip-warning">
              <span className="pip pip-live" /> {type}
            </span>
            {badge && <span className="chip chip-info">{badge}</span>}
            {outcome && <span className={cn('chip', outcome.className)}>{outcome.label}</span>}
            {waiting && <span className="chip chip-muted">{waiting}</span>}
          </div>
          {department && <p className="mt-0.5 text-[12.5px] text-muted-foreground">{department}</p>}
          <p className="font-label mt-2 text-[13.5px] font-semibold text-brand-blue">{dateRange}</p>
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className={`mt-1 block text-left text-[14px] text-foreground/80 ${expanded ? '' : 'line-clamp-2'}`}
            title={expanded ? undefined : 'Show full reason'}
          >
            {reason}
          </button>
          {note && <p className="mt-2 text-[12px] text-muted-foreground">{note}</p>}
          <ApprovalTrail approval={approval} viewer="hod" className="mt-2" />
        </div>
      </div>
      {canApprove || canReject ? (
        <div className="flex shrink-0 gap-2 sm:flex-col lg:flex-row">
          {canReject && (
            <Button size="sm" variant="destructive" disabled={disabled || isSubmitting} onClick={() => setRejectOpen(true)} className="flex-1">
              <X /> Reject
            </Button>
          )}
          {canApprove && (
            <Button size="sm" variant="success" disabled={disabled || isSubmitting} onClick={onApprove} className="flex-1">
              <Check /> Approve
            </Button>
          )}
        </div>
      ) : (
        <p className="shrink-0 text-[12.5px] text-muted-foreground">
          {waiting ? 'Not yours to decide right now' : (waitingText(approval) ?? 'Not yours to decide right now')}
        </p>
      )}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {type.toLowerCase()} request</DialogTitle>
            <DialogDescription>
              {employeeName} ({employeeCode}) will be notified. Add a note so they know why.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="reject-comment">Comment (optional)</Label>
            <Textarea id="reject-comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onReject(comment)
                setRejectOpen(false)
                setComment('')
              }}
            >
              Confirm reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function formatDateRange(start: string, end?: string) {
  if (!end || end === start) return format(parseISO(start), 'MMM d, yyyy')
  return `${format(parseISO(start), 'MMM d, yyyy')} – ${format(parseISO(end), 'MMM d, yyyy')}`
}
