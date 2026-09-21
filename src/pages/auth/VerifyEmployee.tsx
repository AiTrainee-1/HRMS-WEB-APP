import { useParams } from 'wouter'
import { useQuery } from '@tanstack/react-query'
import { format, isValid, parseISO } from 'date-fns'
import { BadgeCheck, Ban, SearchX } from 'lucide-react'
import { apiRequest, ApiError } from '@/api/client'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { AuthShell } from '@/components/layout/AuthShell'
import { cn } from '@/lib/utils'

// Shape of backend/api/growth_views.py::verify_employee: a public endpoint
// the ID-card QR points at. Unknown codes come back as a 404 with
// { verified: false }; a known but non-active employee is 200 with
// verified: false and their status.
interface VerifyResponse {
  verified: boolean
  status?: string
  employee?: {
    code: string
    name: string
    designation: string | null
    department: string | null
    employmentType?: string | null
    photoUrl?: string | null
    bloodGroup?: string | null
    joinDate?: string | null
  }
  company?: { name?: string; address?: string; logo?: string }
}

type Outcome = { kind: 'verified' | 'inactive'; data: VerifyResponse } | { kind: 'not_found' }

export default function VerifyEmployee() {
  const { code } = useParams<{ code: string }>()
  const { data, isLoading, isError } = useQuery<Outcome>({
    queryKey: ['verify-employee', code],
    queryFn: async () => {
      try {
        const res = await apiRequest<VerifyResponse>({ method: 'GET', url: `/verify-employee/${encodeURIComponent(code)}` })
        if (!res.employee) return { kind: 'not_found' }
        return { kind: res.verified ? 'verified' : 'inactive', data: res }
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return { kind: 'not_found' }
        throw err
      }
    },
    retry: 0,
  })

  const emp = data && data.kind !== 'not_found' ? data.data.employee : undefined
  const joined = emp?.joinDate && isValid(parseISO(emp.joinDate)) ? format(parseISO(emp.joinDate), 'MMM yyyy') : null
  const scannedAt = format(new Date(), "d MMM yyyy, h:mm a")

  return (
    <AuthShell badge={<span className="chip chip-info">Public verification</span>}>
      <p className="label-caps text-muted-foreground">Employee credential check</p>
      <h1 className="font-display mt-2 text-[28px] leading-tight font-semibold">ID Verification</h1>
      <p className="font-label mt-1 text-[13px] text-muted-foreground">Code scanned: {code}</p>

      <div className="mt-6">
        {isLoading && <Skeleton className="h-56 w-full" />}

        {isError && (
          <div className="rounded-md border hairline bg-foreground/[0.03] p-5 text-center text-sm text-muted-foreground">
            Couldn't reach the verification service. Check your connection and scan again.
          </div>
        )}

        {data?.kind === 'not_found' && (
          <div className="flex flex-col items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-6 text-center">
            <SearchX className="size-10 text-destructive" />
            <p className="text-[17px] font-semibold">No employee record found</p>
            <p className="text-[13.5px] text-muted-foreground">
              This code doesn't match any UKTextiles employee. Do not accept this card as proof of employment.
            </p>
          </div>
        )}

        {emp && data && data.kind !== 'not_found' && (
          <div
            className={cn(
              'overflow-hidden rounded-md border',
              data.kind === 'verified' ? 'border-success/35' : 'border-destructive/35',
            )}
          >
            <div
              className={cn(
                'flex items-center gap-2.5 px-5 py-3',
                data.kind === 'verified' ? 'bg-success/12 text-success' : 'bg-destructive/12 text-destructive',
              )}
            >
              {data.kind === 'verified' ? <BadgeCheck className="size-5" /> : <Ban className="size-5" />}
              <p className="font-label text-[14px] font-bold tracking-wide uppercase">
                {data.kind === 'verified' ? 'Verified active employee' : `Credential not valid: ${data.data.status ?? 'inactive'}`}
              </p>
            </div>
            <div className="flex items-center gap-4 p-5">
              <Avatar className={cn('size-20 rounded-md ring-1 ring-foreground/15', data.kind === 'inactive' && 'grayscale')}>
                {emp.photoUrl && <AvatarImage src={emp.photoUrl} alt={emp.name} className="object-cover" />}
                <AvatarFallback className="font-display rounded-md bg-primary/15 text-2xl text-brand-blue">{emp.name[0]}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-[19px] font-semibold">{emp.name}</p>
                <p className="truncate text-[13.5px] text-muted-foreground">
                  {[emp.designation, emp.department].filter(Boolean).join(' • ')}
                </p>
                <p className="font-label mt-1 text-[13px] font-bold text-brand-blue">{emp.code}</p>
              </div>
            </div>
            <dl className="grid grid-cols-3 gap-3 border-t hairline px-5 py-4">
              {[
                ['Type', emp.employmentType === 'production' ? 'Production' : 'Staff'],
                ['Blood group', emp.bloodGroup || '—'],
                ['Joined', joined || '—'],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="label-caps text-muted-foreground">{k}</dt>
                  <dd className="mt-1 text-[14px] font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>

      <p className="mt-5 text-[12px] text-muted-foreground">
        Checked {scannedAt} against {data && data.kind !== 'not_found' ? data.data.company?.name || 'UKTextiles' : 'UKTextiles'} records.
      </p>
    </AuthShell>
  )
}
