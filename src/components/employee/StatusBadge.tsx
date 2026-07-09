import { Badge } from '@/components/ui/badge'
import type { RequestStatus } from '@/types'

const labelMap: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
}

const variantMap: Record<string, 'warning' | 'success' | 'destructive'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'destructive',
}

export function StatusBadge({ status }: { status: RequestStatus | string }) {
  return <Badge variant={variantMap[status] ?? 'secondary'}>{labelMap[status] ?? status}</Badge>
}
