import * as React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { format, parseISO } from 'date-fns'

export interface ApprovalCardProps {
  type: string
  employeeName: string
  employeeCode: string
  department?: string
  dateRange: string
  reason: string
  disabled?: boolean
  onApprove: () => void
  onReject: (comment: string) => void
  isSubmitting?: boolean
}

export function ApprovalCard({
  type,
  employeeName,
  employeeCode,
  department,
  dateRange,
  reason,
  disabled,
  onApprove,
  onReject,
  isSubmitting,
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

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <Avatar>
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{employeeName}</span>
              <span className="text-muted-foreground text-xs">{employeeCode}</span>
              <Badge variant="outline">{type}</Badge>
            </div>
            {department && <p className="text-muted-foreground text-xs">{department}</p>}
            <p className="text-sm mt-1">{dateRange}</p>
            <p
              className={`text-sm text-muted-foreground mt-1 cursor-pointer ${expanded ? '' : 'line-clamp-1'}`}
              onClick={() => setExpanded((e) => !e)}
            >
              {reason}
            </p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" disabled={disabled || isSubmitting} onClick={() => setRejectOpen(true)}>
            Reject
          </Button>
          <Button size="sm" variant="gradient" disabled={disabled || isSubmitting} onClick={onApprove}>
            Approve
          </Button>
        </div>
      </CardContent>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject request</DialogTitle>
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
              Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export function formatDateRange(start: string, end?: string) {
  if (!end || end === start) return format(parseISO(start), 'MMM d, yyyy')
  return `${format(parseISO(start), 'MMM d, yyyy')} – ${format(parseISO(end), 'MMM d, yyyy')}`
}
