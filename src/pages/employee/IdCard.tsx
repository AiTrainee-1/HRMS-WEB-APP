import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { toPng } from 'html-to-image'
import { Download } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/employee/EmptyState'
import { IdCardFront, IdCardBack } from '@/components/idcard/IdCardViews'
import { idCardApi } from '@/api/resources'
import { useAuth } from '@/context/AuthContext'
import { BadgeCheck } from 'lucide-react'

export default function IdCard() {
  const { user } = useAuth()
  const frontRef = React.useRef<HTMLDivElement>(null)
  const backRef = React.useRef<HTMLDivElement>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['idcard', user?.employeeId],
    queryFn: () => idCardApi.get(user!.employeeId),
    enabled: !!user,
  })

  async function downloadSide(ref: React.RefObject<HTMLDivElement | null>, name: string) {
    if (!ref.current) return
    const dataUrl = await toPng(ref.current, { pixelRatio: 3 })
    const link = document.createElement('a')
    link.download = `${data?.code ?? 'id-card'}-${name}.png`
    link.href = dataUrl
    link.click()
  }

  if (isLoading) return <Skeleton className="h-96 w-full" />

  if (isError || !data) {
    return <EmptyState icon={BadgeCheck} title="Couldn't load your ID card" description="Please try again later or contact HR." />
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Digital ID Card" subtitle="Your official employee identification" icon={<BadgeCheck />} />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col items-center gap-3">
          <div ref={frontRef}>
            <IdCardFront data={data} />
          </div>
          <Button variant="outline" size="sm" onClick={() => downloadSide(frontRef, 'front')}>
            <Download /> Download Front
          </Button>
        </div>
        <div className="flex flex-col items-center gap-3">
          <div ref={backRef}>
            <IdCardBack data={data} />
          </div>
          <Button variant="outline" size="sm" onClick={() => downloadSide(backRef, 'back')}>
            <Download /> Download Back
          </Button>
        </div>
      </div>
      <Card>
        <CardContent className="py-2 text-sm text-muted-foreground">
          Both sides of your ID card are shown side by side for easy reference — no need to flip. Scan the QR code on the back to verify
          this card publicly.
        </CardContent>
      </Card>
    </div>
  )
}
