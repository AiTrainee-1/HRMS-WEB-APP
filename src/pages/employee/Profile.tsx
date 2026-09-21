import * as React from 'react'
import { Link } from 'wouter'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  BadgeCheck, Briefcase, Building2, CalendarDays, Factory, FileSignature, Info, KeyRound,
  Landmark, LogOut, MapPin, Phone, ShieldCheck, UserRound, Users,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { format, parseISO, isValid } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { PageLoader } from '@/components/ui/loader'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from '@/components/ui/dialog'
import { employeeApi, authApi } from '@/api/resources'
import { verifyUrl } from '@/lib/verify'
import { useAuth } from '@/context/AuthContext'
import { ApiError } from '@/api/client'
import type { Employee } from '@/types'

function fmtDate(v?: string) {
  if (!v) return undefined
  const d = parseISO(v)
  return isValid(d) ? format(d, 'd MMM yyyy') : v
}

/** Masks all but the last 4 characters: account numbers stay recognisable, not readable over a shoulder. */
function mask(v?: string) {
  if (!v) return undefined
  return v.length <= 4 ? v : `${'•'.repeat(Math.min(8, v.length - 4))}${v.slice(-4)}`
}

function Field({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="label-caps text-muted-foreground">{label}</dt>
      <dd className={`mt-1 truncate text-[15px] font-medium ${mono ? 'font-label tabular-nums' : ''} ${value ? '' : 'text-muted-foreground'}`}>
        {value || '—'}
      </dd>
    </div>
  )
}

function Section({
  title, icon: Icon, tone = 'text-brand-blue', children,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  tone?: string
  children: React.ReactNode
}) {
  return (
    <section className="glass-raised rounded-lg p-5 sm:p-6">
      <h2 className="font-display flex items-center gap-2.5 text-[20px] font-semibold">
        <Icon className={`size-5 ${tone}`} /> {title}
      </h2>
      <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">{children}</dl>
    </section>
  )
}

export default function Profile() {
  const { user, logout } = useAuth()
  const [pwdOpen, setPwdOpen] = React.useState(false)
  const [newPassword, setNewPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [pwdError, setPwdError] = React.useState<string | null>(null)

  const { data, isLoading, isError } = useQuery<Employee>({
    queryKey: ['employee', user?.employeeId],
    queryFn: () => employeeApi.get(user!.employeeId),
    enabled: !!user,
  })

  // /auth/set-password looks the employee up by code, phone or email; the
  // internal numeric id matches none of those, so send the employee code.
  const setPasswordMutation = useMutation({
    mutationFn: () => authApi.setPassword(data!.employeeCode, newPassword),
    onSuccess: () => {
      toast.success('Password updated')
      setPwdOpen(false)
      setNewPassword('')
      setConfirmPassword('')
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update password'),
  })

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPwdError(null)
    if (newPassword.length < 8) return setPwdError('Password must be at least 8 characters.')
    if (newPassword !== confirmPassword) return setPwdError('Passwords do not match.')
    setPasswordMutation.mutate()
  }

  if (isError) {
    return (
      <div className="glass rounded-lg p-10 text-center text-sm text-muted-foreground">
        Couldn't load your profile right now. Please refresh the page.
      </div>
    )
  }

  if (isLoading || !data) {
    return <PageLoader label="Loading your profile" />
  }

  const fullName = `${data.firstName} ${data.lastName}`.trim()
  const isProduction = data.employmentType === 'production'

  return (
    <div className="flex flex-col gap-6">
      {/* ── Identity masthead ─────────────────────────────────────────── */}
      <section className="glass-raised relative overflow-hidden rounded-lg p-6 sm:p-8">
        <div className="pointer-events-none absolute -top-24 -right-10 size-80 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
            <div className="relative shrink-0">
              <Avatar className="size-28 rounded-lg ring-1 ring-foreground/15">
                {data.photoUrl && <AvatarImage src={data.photoUrl} alt={fullName} className="object-cover" />}
                <AvatarFallback className="font-display rounded-lg bg-primary/15 text-3xl text-brand-blue">
                  {data.firstName?.[0]}
                  {data.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <span className="chip chip-success absolute -bottom-2 left-1/2 -translate-x-1/2 !bg-[var(--card)] !text-[10px] uppercase">
                <span className="pip" /> {data.status || 'Active'}
              </span>
            </div>
            <div className="min-w-0">
              <p className="label-caps text-brand-emerald">
                {isProduction ? 'Production workforce' : 'Staff'} • {data.employeeCode}
              </p>
              <h1 className="font-display mt-2 text-[32px] leading-tight font-semibold sm:text-[40px]">{fullName}</h1>
              <p className="mt-1 text-[15px] text-foreground/80">
                {[data.designationTitle, data.departmentName].filter(Boolean).join(' • ')}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[13px] text-muted-foreground sm:justify-start">
                {data.branchName && (
                  <span className="flex items-center gap-1.5"><MapPin className="size-3.5" /> {data.branchName}</span>
                )}
                {data.joinDate && (
                  <span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" /> Joined {fmtDate(data.joinDate)}</span>
                )}
                <span className="flex items-center gap-1.5">
                  {isProduction ? <Factory className="size-3.5" /> : <Briefcase className="size-3.5" />}
                  {isProduction ? 'Production' : 'Staff'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 sm:flex-row lg:flex-col lg:items-stretch">
            <div className="flex items-center gap-4 rounded-md bg-[#060e20] p-4 text-[#dae2fd]">
              <div className="rounded bg-white p-1.5">
                <QRCodeSVG value={verifyUrl(data.employeeCode)} size={72} fgColor="#0f172a" bgColor="#ffffff" />
              </div>
              <div>
                <p className="label-caps text-[#94a3b8]">Digital ID</p>
                <p className="font-label mt-1 text-[15px] font-bold">{data.employeeCode}</p>
                <Link href="/employee/id-card" className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#4edea3] hover:underline">
                  <BadgeCheck className="size-3.5" /> Open ID card
                </Link>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Dialog open={pwdOpen} onOpenChange={setPwdOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <KeyRound /> Change password
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Change Password</DialogTitle>
                    <DialogDescription>At least 8 characters. You'll use it the next time you sign in.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="pwd-emp-code">Employee code</Label>
                      <Input id="pwd-emp-code" value={data.employeeCode} disabled />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="new-pwd">New password</Label>
                      <Input id="new-pwd" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="confirm-pwd">Confirm password</Label>
                      <Input id="confirm-pwd" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                    </div>
                    {pwdError && <p className="text-sm text-destructive">{pwdError}</p>}
                    <DialogFooter>
                      <Button type="submit" disabled={setPasswordMutation.isPending}>
                        {setPasswordMutation.isPending ? 'Saving…' : 'Update password'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
              <Button size="sm" variant="outline" asChild>
                <Link href="/employee/resignation">
                  <FileSignature /> Resignation
                </Link>
              </Button>
              <Button size="sm" variant="destructive" onClick={logout}>
                <LogOut /> Logout
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Personal Information" icon={UserRound}>
          <Field label="First name" value={data.firstName} />
          <Field label="Last name" value={data.lastName} />
          <Field label="Gender" value={data.gender} />
          <Field label="Date of birth" value={fmtDate(data.dateOfBirth)} />
          <Field label="Blood group" value={data.bloodGroup} />
          <Field label="Emergency contact" value={data.emergencyContact} mono />
        </Section>

        <Section title="Contact" icon={Phone} tone="text-brand-emerald">
          <Field label="Phone" value={data.phone} mono />
          <Field label="Email" value={data.email} />
          <div className="sm:col-span-2">
            <Field label="Address" value={data.address} />
          </div>
          {data.branchAddress && (
            <div className="sm:col-span-2">
              <Field label="Branch address" value={data.branchAddress} />
            </div>
          )}
        </Section>

        <Section title="Employment" icon={Building2}>
          <Field label="Employee code" value={data.employeeCode} mono />
          <Field label="Employment type" value={isProduction ? 'Production' : data.employmentType ? 'Staff' : undefined} />
          <Field label="Department" value={data.departmentName} />
          <Field label="Designation" value={data.designationTitle} />
          <Field label="Branch" value={data.branchName} />
          <Field label="Join date" value={fmtDate(data.joinDate)} />
        </Section>

        <Section title="Family" icon={Users} tone="text-brand-gold">
          <Field label="Father's name" value={data.fatherName} />
          <Field label="Mother's name" value={data.motherName} />
        </Section>

        <Section title="Bank Details" icon={Landmark} tone="text-brand-gold">
          <Field label="Bank name" value={data.bankName} />
          <Field label="Account number" value={mask(data.bankAccount)} mono />
          <Field label="IFSC code" value={data.bankIfsc} mono />
        </Section>

        <Section title="Statutory & Compliance" icon={ShieldCheck} tone="text-brand-emerald">
          <Field label="PF number" value={data.pfNumber} mono />
          <Field label="ESI number" value={data.esiNumber} mono />
          <Field label="UAN" value={data.uanNumber} mono />
        </Section>
      </div>

      <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <Info className="size-4 shrink-0" /> Something out of date? Your profile and photo are maintained by HR. Contact them to make changes.
      </p>
    </div>
  )
}
