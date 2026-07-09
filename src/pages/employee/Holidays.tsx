import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { PartyPopper } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/employee/EmptyState'
import { holidayApi } from '@/api/resources'
import { format, parseISO } from 'date-fns'

export default function Holidays() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = React.useState(currentYear)
  const today = format(new Date(), 'yyyy-MM-dd')

  const { data, isLoading } = useQuery({
    queryKey: ['holidays', year],
    queryFn: () => holidayApi.list(year),
  })

  const sorted = [...(data ?? [])].sort((a, b) => a.date.localeCompare(b.date))
  const thisMonth = sorted.filter((h) => parseISO(h.date).getMonth() === new Date().getMonth() && year === currentYear)
  const upcoming = sorted.filter((h) => h.date >= today).slice(0, 5)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Holidays"
        subtitle="Company holiday calendar"
        icon={<PartyPopper />}
        actions={
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28 bg-white/15 text-white border-white/25 [&_svg]:text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {isLoading && <Skeleton className="h-64 w-full" />}

      {!isLoading && sorted.length === 0 && (
        <EmptyState icon={PartyPopper} title={`No holidays published for ${year} yet`} />
      )}

      {!isLoading && sorted.length > 0 && (
        <>
          {year === currentYear && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">This Month ({thisMonth.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {thisMonth.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No holidays this month.</p>
                ) : (
                  thisMonth.map((h) => (
                    <div key={h.id} className="flex items-center justify-between border-b py-1.5 text-sm last:border-b-0">
                      <span>{h.name}</span>
                      <span className="text-muted-foreground">{format(parseISO(h.date), 'EEE, MMM d')}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upcoming</CardTitle>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming holidays.</p>
              ) : (
                upcoming.map((h) => (
                  <div key={h.id} className="flex items-center justify-between border-b py-1.5 text-sm last:border-b-0">
                    <span>{h.name}</span>
                    <span className="text-muted-foreground">{format(parseISO(h.date), 'EEE, MMM d')}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">All Holidays — {year}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">Date</th>
                      <th className="px-4 py-2 font-medium">Holiday</th>
                      <th className="px-4 py-2 font-medium">Day</th>
                      <th className="px-4 py-2 font-medium">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((h) => (
                      <tr key={h.id} className="border-b last:border-b-0">
                        <td className="px-4 py-2">{format(parseISO(h.date), 'MMM d, yyyy')}</td>
                        <td className="px-4 py-2">{h.name}</td>
                        <td className="px-4 py-2">{format(parseISO(h.date), 'EEEE')}</td>
                        <td className="px-4 py-2">
                          <Badge variant="outline" className="capitalize">
                            {h.holidayType}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
