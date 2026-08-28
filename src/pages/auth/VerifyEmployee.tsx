import { useParams } from 'wouter'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { apiRequest } from '@/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CheckCircle2, XCircle } from 'lucide-react'

interface VerifyResponse {
  valid: boolean
  name?: string
  employeeCode?: string
  designation?: string
  department?: string
  status?: string
  photoUrl?: string
}

export default function VerifyEmployee() {
  const { code } = useParams<{ code: string }>()
  const { data, isLoading } = useQuery({
    queryKey: ['verify-employee', code],
    queryFn: () => apiRequest<VerifyResponse>({ method: 'GET', url: `/verify-employee/${code}` }),
  })

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4 gap-6">
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', damping: 12, stiffness: 160 }}
        className="flex items-center justify-center rounded-2xl overflow-hidden shadow-clay-lg bg-white dark:bg-card/95"
      >
        <img
          src="/UKT_Company_Logo.png"
          alt="UK Textiles"
          className="h-16 w-auto object-contain px-2 py-1"
        />
      </motion.div>
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle>Employee Verification</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <Skeleton className="h-32 w-full" />}
          {!isLoading && data?.valid && (
            <div className="flex flex-col items-center gap-2">
              <CheckCircle2 className="size-10 text-success" />
              <p className="font-semibold text-lg">{data.name}</p>
              <p className="text-sm text-muted-foreground">{data.employeeCode}</p>
              <p className="text-sm">{data.designation} · {data.department}</p>
            </div>
          )}
          {!isLoading && !data?.valid && (
            <div className="flex flex-col items-center gap-2">
              <XCircle className="size-10 text-destructive" />
              <p className="font-semibold">Not a valid employee record</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
