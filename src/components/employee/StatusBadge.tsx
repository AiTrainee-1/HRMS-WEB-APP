import { cn } from '@/lib/utils'
import type { RequestStatus } from '@/types'

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

/** Glass status chip with a leading pip; pending ones pulse. */
export function StatusBadge({ status, className }: { status: RequestStatus | string; className?: string }) {
  const pending = status.startsWith('pending')
  return (
    <span className={cn('chip', toneMap[status] ?? 'chip-muted', className)}>
      <span className={cn('pip', pending && 'pip-live')} />
      {labelMap[status] ?? status.replace(/_/g, ' ')}
    </span>
  )
}
