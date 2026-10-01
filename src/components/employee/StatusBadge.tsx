import { cn } from '@/lib/utils'
import { waitingText } from '@/lib/approval'
import { permissionOutcome } from '@/lib/permissions'
import type { ApprovalProgress, PermissionRequest, RequestStatus } from '@/types'

// What the legacy status strings say: only right for the pipeline the app used to assume, so a request that carries
// its own `approval` block is labelled by that instead (waitingText). These are the fallback for an older backend.
const labelMap: Record<string, string> = {
  pending: 'Pending',
  pending_hod: 'Pending HOD',
  pending_hr: 'Pending HR',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

const toneMap: Record<string, string> = {
  pending: 'chip-warning',
  pending_hod: 'chip-warning',
  pending_hr: 'chip-info',
  approved: 'chip-success',
  rejected: 'chip-danger',
}

/** Glass status chip with a leading pip; pending ones pulse. A waiting request says who it is waiting for. */
export function StatusBadge({
  status, approval, className,
}: {
  status: RequestStatus | string
  approval?: ApprovalProgress | null
  className?: string
}) {
  const waiting = waitingText(approval)
  const pending = status.startsWith('pending') || waiting !== null
  return (
    <span className={cn('chip', toneMap[status] ?? (waiting ? 'chip-info' : 'chip-muted'), className)}>
      <span className={cn('pip', pending && 'pip-live')} />
      {waiting ?? labelMap[status] ?? status.replace(/_/g, ' ')}
    </span>
  )
}

/** A permission's outcome chip: Pending (or who it is waiting for) / Allowed / Not Allowed / Overdue-Excess
 * (plain "Approved" when an older backend doesn't say which approved kind). */
export function PermissionOutcomeBadge({
  permission, className,
}: {
  permission: Pick<PermissionRequest, 'status' | 'capStatus' | 'statusLabel' | 'approval'>
  className?: string
}) {
  const outcome = permissionOutcome(permission)
  const waiting = outcome.kind === 'pending' ? waitingText(permission.approval) : null
  return (
    <span className={cn('chip', outcome.chipClass, className)}>
      <span className={cn('pip', outcome.kind === 'pending' && 'pip-live')} />
      {waiting ?? outcome.label}
    </span>
  )
}
