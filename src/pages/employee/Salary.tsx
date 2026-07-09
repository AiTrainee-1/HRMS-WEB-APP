import { Link } from 'wouter'
import { useQuery } from '@tanstack/react-query'
import { Wallet, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/employee/EmptyState'
import { salaryApi } from '@/api/resources'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function Salary() {
  const { data, isLoading } = useQuery({ queryKey: ['salary-slips'], queryFn: salaryApi.list })

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Salary Slips" subtitle="Your monthly pay history" icon={<Wallet />} />

      {isLoading && <Skeleton className="h-64 w-full" />}

      {!isLoading && (data?.length ?? 0) === 0 && (
        <EmptyState icon={Wallet} title="No salary slips yet" description="Slips will appear here once payroll is processed." />
      )}

      <div className="flex flex-col gap-2">
        {data?.map((slip) => (
          <Link key={slip.id} href={`/employee/salary/${slip.id}`}>
            <Card className="cursor-pointer transition-colors hover:bg-accent">
              <CardContent className="flex items-center justify-between py-1">
                <div>
                  <p className="font-medium">
                    {MONTH_NAMES[slip.month - 1]} {slip.year}
                  </p>
                  <p className="text-muted-foreground text-sm">Net Pay: ₹{slip.netSalary.toLocaleString()}</p>
                </div>
                <ChevronRight className="text-muted-foreground size-4" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
