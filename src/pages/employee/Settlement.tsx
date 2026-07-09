import { useQuery } from '@tanstack/react-query'
import { FileStack } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatusBadge } from '@/components/employee/StatusBadge'
import { EmptyState } from '@/components/employee/EmptyState'
import { settlementApi } from '@/api/resources'
import { useAuth } from '@/context/AuthContext'
import { format, parseISO } from 'date-fns'

const ADVANCE_TYPE_LABELS: Record<string, string> = {
  general: 'General Advance',
  term: 'Term Loan',
}

export default function Settlement() {
  const { user } = useAuth()
  const { data, isLoading } = useQuery({
    queryKey: ['advances', user?.employeeId],
    queryFn: () => settlementApi.list(user!.employeeId),
    enabled: !!user,
  })

  if (isLoading) return <Skeleton className="h-64 w-full" />

  const advances = data ?? []

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Settlement" subtitle="Advances and loan repayment status" icon={<FileStack />} />

      {advances.length === 0 ? (
        <EmptyState icon={FileStack} title="No advances on record" description="Advances or loans HR processes for you will appear here." />
      ) : (
        advances.map((adv) => (
          <Card key={adv.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{ADVANCE_TYPE_LABELS[adv.advanceType] ?? adv.advanceType}</CardTitle>
              <StatusBadge status={adv.status} />
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Amount</span>
                <span className="text-2xl font-bold">₹{adv.amount.toLocaleString()}</span>
              </div>
              {adv.purpose && <p className="text-sm text-muted-foreground">{adv.purpose}</p>}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Repaid So Far</p>
                  <p className="font-medium">₹{adv.totalRepaid.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Outstanding</p>
                  <p className={`font-medium ${adv.outstanding > 0 ? 'text-warning-foreground' : ''}`}>
                    ₹{adv.outstanding.toLocaleString()}
                  </p>
                </div>
              </div>
              <p className="text-muted-foreground text-xs">Requested {format(parseISO(adv.createdAt), 'MMM d, yyyy')}</p>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
