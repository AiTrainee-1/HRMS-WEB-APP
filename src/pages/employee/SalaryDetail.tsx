import { useParams } from 'wouter'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { salaryApi } from '@/api/resources'
import { toast } from 'sonner'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function SalaryDetail() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading } = useQuery({
    queryKey: ['salary-slip', id],
    queryFn: () => salaryApi.detail(id),
  })

  function handleDownload() {
    // No PDF-generation endpoint exists on the backend yet — surface that
    // clearly instead of opening a dead link to a 404.
    toast.info('PDF download is not available yet. Contact HR for a physical copy.')
  }

  if (isLoading || !data) {
    return <Skeleton className="h-96 w-full" />
  }

  const earnings = [
    { label: 'Basic', amount: data.basic },
    { label: 'HRA', amount: data.hra },
    { label: 'Allowances', amount: data.allowances },
    { label: 'Incentives', amount: data.incentives },
    { label: 'Bonuses', amount: data.bonuses },
    { label: 'Overtime', amount: data.otAmount },
  ].filter((e) => e.amount)

  const deductions = [
    { label: 'PF', amount: data.pfDeduction },
    { label: 'ESI', amount: data.esiDeduction },
    { label: 'Advance Recovery', amount: data.advanceDeduction },
    { label: 'Other Deductions', amount: data.otherDeductions },
  ].filter((d) => d.amount)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`${MONTH_NAMES[data.month - 1]} ${data.year}`}
        subtitle="Salary slip breakdown"
        icon={<Download />}
        actions={
          <Button onClick={handleDownload} className="bg-white dark:bg-card/95 text-brand-blue hover:bg-white/90 dark:hover:bg-white/10 shadow-clay">
            <Download /> Download PDF
          </Button>
        }
      />

      <Card>
        <CardContent className="flex items-center justify-between py-1">
          <span className="text-muted-foreground text-sm">Net Pay</span>
          <span className="text-2xl font-bold">₹{data.netSalary.toLocaleString()}</span>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Earnings</CardTitle>
          </CardHeader>
          <CardContent>
            {earnings.length === 0 && <p className="text-sm text-muted-foreground">No earnings breakdown available.</p>}
            {earnings.map((e, i) => (
              <div key={i}>
                <div className="flex justify-between py-1.5 text-sm">
                  <span className="text-muted-foreground">{e.label}</span>
                  <span className="font-medium">₹{e.amount.toLocaleString()}</span>
                </div>
                {i < earnings.length - 1 && <Separator />}
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Deductions</CardTitle>
          </CardHeader>
          <CardContent>
            {deductions.length === 0 && <p className="text-sm text-muted-foreground">No deductions this period.</p>}
            {deductions.map((d, i) => (
              <div key={i}>
                <div className="flex justify-between py-1.5 text-sm">
                  <span className="text-muted-foreground">{d.label}</span>
                  <span className="font-medium">₹{d.amount.toLocaleString()}</span>
                </div>
                {i < deductions.length - 1 && <Separator />}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Attendance Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground text-xs">Working Days</p>
            <p className="text-lg font-bold">{data.workingDays}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Present Days</p>
            <p className="text-lg font-bold">{data.presentDays}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Absent Days</p>
            <p className="text-lg font-bold">{data.absentDays}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Late Days</p>
            <p className="text-lg font-bold">{data.lateDays}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
