import type { LucideIcon } from 'lucide-react'
import { Inbox } from 'lucide-react'
import { Empty, EmptyIcon, EmptyTitle, EmptyDescription } from '@/components/ui/empty'

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <Empty>
      <EmptyIcon>
        <Icon />
      </EmptyIcon>
      <EmptyTitle>{title}</EmptyTitle>
      {description && <EmptyDescription>{description}</EmptyDescription>}
      {action}
    </Empty>
  )
}
