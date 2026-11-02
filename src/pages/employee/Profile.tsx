import * as React from 'react'
import { Link } from 'wouter'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowRight, BadgeCheck, Briefcase, Building2, CalendarDays, ChevronDown, ChevronRight, Factory, FileSignature, IdCard, Info,
  KeyRound, Landmark, LifeBuoy, Lock, LogOut, MapPin, Phone, ShieldCheck, UserRound, Users, type LucideIcon,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { format, parseISO, isValid } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from '@/components/ui/dialog'
import {
  ErrorState, GlassCard, PageHero, PageShell, RingMeter, SectionHeader, SkeletonBlock, SkeletonList, StatusPill, type Tone,
} from '@/components/kit'
import { employeeApi, authApi } from '@/api/resources'
import { verifyUrl } from '@/lib/verify'
import { employeeStatusInfo } from '@/lib/id-card'
import { useAuth } from '@/context/AuthContext'
import { ApiError } from '@/api/client'
import { cn } from '@/lib/utils'
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

function Field({ label, value, mono, wide }: { label: string; value?: string; mono?: boolean; wide?: boolean }) {
  return (
    <div className={wide ? 'min-w-0 sm:col-span-2' : 'min-w-0'}>
      <dt className="label-caps text-muted-foreground">{label}</dt>
      <dd className={`mt-1 text-[15px] font-medium break-words ${mono ? 'font-label tabular-nums' : ''} ${value ? '' : 'text-muted-foreground'}`}>
        {value || 'Not on record'}
      </dd>
    </div>
  )
}

function Section({ title, icon, tone = 'sapphire', children }: { title: string; icon: LucideIcon; tone?: Tone; children: React.ReactNode }) {
  return (
    <GlassCard padding="lg" className="flex flex-col gap-5">
      <SectionHeader as="h2" icon={icon} tone={tone} title={title} />
      <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">{children}</dl>
    </GlassCard>
  )
}

// The fields HR keeps for every employee; the ring shows how many are filled in.
const RECORD_FIELDS: (keyof Employee)[] = [
  'gender', 'dateOfBirth', 'bloodGroup', 'emergencyContact', 'phone', 'email', 'address', 'fatherName', 'motherName',
  'bankName', 'bankAccount', 'bankIfsc', 'pfNumber', 'esiNumber', 'uanNumber', 'photoUrl',
]

export default function Profile() {
  const { user, logout } = useAuth()
  const [pwdOpen, setPwdOpen] = React.useState(false)
  const [newPassword, setNewPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [pwdError, setPwdError] = React.useState<string | null>(null)

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<Employee>({
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
      <PageShell>
        <PageHero icon={<UserRound />} title="My Profile" subtitle="Your details as HR keeps them." />
        <ErrorState error={error} what="your profile" onRetry={() => refetch()} retrying={isFetching} />
      </PageShell>
    )
  }

  if (isLoading || !data) {
    return (
      <PageShell>
        <div className="flex items-center gap-5" role="status" aria-label="Loading your profile">
          <SkeletonBlock className="size-24 rounded-2xl" />
          <div className="flex flex-1 flex-col gap-3">
            <SkeletonBlock className="h-3 w-32" />
            <SkeletonBlock className="h-8 w-64" />
            <SkeletonBlock className="h-4 w-48" />
          </div>
        </div>
        <SkeletonList variant="cards" count={3} />
      </PageShell>
    )
  }

  const fullName = `${data.firstName} ${data.lastName}`.trim()
  const isProduction = data.employmentType === 'production'
  const status = employeeStatusInfo(data.status)
  const filled = RECORD_FIELDS.filter((k) => !!data[k]).length

  return (
    // Phones (< 768px): the mobile app's Profile tab (app/(tabs)/profile.tsx, kit/MOBILE.md) - the royal-gradient hero,
    // the Digital ID Pass link, three stat cards, expandable detail cards, the "SECURITY & ACCOUNT" group and Sign Out.
    // One phone-only block; the desktop hero, identity card, sections and note are hidden there.
    <PageShell className="max-md:gap-0">
      <>
        <PageHero
          className="max-md:hidden"
          icon={<UserRound />}
          title={fullName}
          subtitle={[data.designationTitle, data.departmentName].filter(Boolean).join(' · ') || 'Your details as HR keeps them.'}
          actions={
            <>
              <Dialog open={pwdOpen} onOpenChange={setPwdOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="min-h-11 sm:min-h-9">
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
                      <Input id="new-pwd" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} aria-invalid={!!pwdError && newPassword.length < 8} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="confirm-pwd">Confirm password</Label>
                      <Input id="confirm-pwd" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} aria-invalid={!!pwdError && newPassword !== confirmPassword} />
                    </div>
                    {pwdError && <p className="text-sm font-medium text-rejected" role="alert">{pwdError}</p>}
                    <DialogFooter>
                      <Button type="submit" disabled={setPasswordMutation.isPending}>
                        {setPasswordMutation.isPending ? 'Saving…' : 'Update password'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
              <Button variant="destructive" onClick={logout} className="min-h-11 sm:min-h-9">
                <LogOut /> Sign out
              </Button>
            </>
          }
        />
        <PhoneProfile
          data={data}
          fullName={fullName}
          isProduction={isProduction}
          filledPct={Math.round((filled / RECORD_FIELDS.length) * 100)}
          onPassword={() => setPwdOpen(true)}
          onSignOut={logout}
        />
      </>

      {/* Identity */}
      <GlassCard variant="raised" padding="lg" className="relative overflow-hidden max-md:hidden">
        <div aria-hidden="true" className="pointer-events-none absolute -top-24 -right-10 size-72 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
          <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
            <div className="relative shrink-0">
              <Avatar className="size-28 rounded-2xl ring-2 ring-primary/30 ring-offset-2 ring-offset-card">
                {data.photoUrl && <AvatarImage src={data.photoUrl} alt={fullName} className="object-cover" />}
                <AvatarFallback className="font-display rounded-2xl bg-info-bg text-3xl text-info">
                  {data.firstName?.[0]}
                  {data.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              {!status.unknown && (
                <StatusPill tone={status.isActive ? 'approved' : 'rejected'} size="sm" className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-card">
                  {status.label}
                </StatusPill>
              )}
            </div>
            <div className="min-w-0">
              <p className="label-caps text-brand-emerald">
                {isProduction ? 'Production' : 'Staff'} · {data.employeeCode}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[13.5px] text-muted-foreground sm:justify-start">
                {data.branchName && (
                  <span className="flex items-center gap-1.5"><MapPin className="size-4" aria-hidden="true" /> {data.branchName}</span>
                )}
                {data.joinDate && (
                  <span className="flex items-center gap-1.5"><CalendarDays className="size-4" aria-hidden="true" /> Joined {fmtDate(data.joinDate)}</span>
                )}
                <span className="flex items-center gap-1.5">
                  {isProduction ? <Factory className="size-4" aria-hidden="true" /> : <Briefcase className="size-4" aria-hidden="true" />}
                  {isProduction ? 'Production' : 'Staff'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4">
            <RingMeter value={filled} max={RECORD_FIELDS.length} silk size={92} thickness={9} label="Details on your HR record">
              <span className="metric text-xl leading-none">{Math.round((filled / RECORD_FIELDS.length) * 100)}%</span>
            </RingMeter>
            <div className="max-w-40 text-[12.5px] text-muted-foreground">
              <p className="font-semibold text-foreground">Record complete</p>
              {filled}/{RECORD_FIELDS.length} details on file.{' '}
              {filled < RECORD_FIELDS.length && (
                <Link href="/employee/help" className="font-semibold text-brand-blue underline-offset-2 hover:underline">
                  Ask HR to add the rest
                </Link>
              )}
            </div>
          </div>

          <Link
            href="/employee/id-card"
            className="group focus-ring flex items-center gap-4 rounded-xl bg-[#060e20] p-4 text-[#dae2fd] transition-transform duration-200 hover:-translate-y-0.5"
          >
            <span className="rounded-md bg-white p-1.5">
              <QRCodeSVG value={verifyUrl(data.employeeCode)} size={64} fgColor="#0f172a" bgColor="#ffffff" />
            </span>
            <span>
              <span className="label-caps block text-[#94a3b8]">Digital ID</span>
              <span className="font-label mt-1 block text-[15px] font-bold">{data.employeeCode}</span>
              <span className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#4edea3] group-hover:underline">
                <BadgeCheck className="size-3.5" aria-hidden="true" /> Open ID card
              </span>
            </span>
          </Link>
        </div>
      </GlassCard>

      <div className="grid gap-6 max-md:hidden lg:grid-cols-2">
        <Section title="Personal" icon={UserRound}>
          <Field label="First name" value={data.firstName} />
          <Field label="Last name" value={data.lastName} />
          <Field label="Gender" value={data.gender} />
          <Field label="Date of birth" value={fmtDate(data.dateOfBirth)} />
          <Field label="Blood group" value={data.bloodGroup} />
          <Field label="Emergency contact" value={data.emergencyContact} mono />
        </Section>

        <Section title="Contact" icon={Phone} tone="emerald">
          <Field label="Phone" value={data.phone} mono />
          <Field label="Email" value={data.email} />
          <Field label="Address" value={data.address} wide />
          {data.branchAddress && <Field label="Branch address" value={data.branchAddress} wide />}
        </Section>

        <Section title="Employment" icon={Building2}>
          <Field label="Employee code" value={data.employeeCode} mono />
          <Field label="Employment type" value={isProduction ? 'Production' : data.employmentType ? 'Staff' : undefined} />
          <Field label="Department" value={data.departmentName} />
          <Field label="Designation" value={data.designationTitle} />
          <Field label="Branch" value={data.branchName} />
          <Field label="Join date" value={fmtDate(data.joinDate)} />
        </Section>

        <Section title="Family" icon={Users} tone="violet">
          <Field label="Father's name" value={data.fatherName} />
          <Field label="Mother's name" value={data.motherName} />
        </Section>

        <Section title="Bank" icon={Landmark} tone="amber">
          <Field label="Bank name" value={data.bankName} />
          <Field label="Account number" value={mask(data.bankAccount)} mono />
          <Field label="IFSC code" value={data.bankIfsc} mono />
        </Section>

        <Section title="PF, ESI and UAN" icon={ShieldCheck} tone="emerald">
          <Field label="PF number" value={data.pfNumber} mono />
          <Field label="ESI number" value={data.esiNumber} mono />
          <Field label="UAN" value={data.uanNumber} mono />
        </Section>
      </div>

      <GlassCard padding="md" className="flex flex-col gap-3 max-md:hidden sm:flex-row sm:items-center">
        <Info className="size-5 shrink-0 text-info" aria-hidden="true" />
        <p className="flex-1 text-[13.5px] text-muted-foreground">
          Something out of date? HR keeps your profile and photo. Contact them to change anything.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="min-h-11 sm:min-h-8">
            <Link href="/employee/help">
              <LifeBuoy /> Contact HR
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="min-h-11 sm:min-h-8">
            <Link href="/employee/resignation">
              <FileSignature /> Resignation
            </Link>
          </Button>
        </div>
      </GlassCard>
    </PageShell>
  )
}

// ── PHONE ONLY (< 768px) ─────────────────────────────────────────────────────────────────────────────────────────────

function ageOf(dob?: string): number | null {
  if (!dob) return null
  const d = parseISO(dob)
  if (!isValid(d)) return null
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000))
}

/** The app's grey field box (ExpandableCard DetailBox): a small muted label over the value. */
function PhoneBox({ label, value, mono, wide }: { label: string; value?: string; mono?: boolean; wide?: boolean }) {
  return (
    <div className={cn('max-md:min-w-0 max-md:rounded-lg max-md:bg-muted max-md:p-2.5', wide && 'max-md:col-span-2')}>
      <dt className="max-md:mb-0.5 max-md:text-[10.5px] max-md:font-semibold max-md:text-muted-foreground">{label}</dt>
      <dd className={cn('max-md:text-[13px] max-md:font-semibold max-md:break-words', mono && 'max-md:tabular-nums', value ? 'max-md:text-foreground' : 'max-md:text-muted-foreground')}>
        {value || '—'}
      </dd>
    </div>
  )
}

/** The app's ExpandableCard: an icon circle, title + one-line subtitle, an optional badge, and a chevron that opens it. */
function PhoneExpandable({
  id,
  icon: Icon,
  title,
  subtitle,
  badge,
  locked,
  defaultOpen = false,
  children,
}: {
  id: string
  icon: LucideIcon
  title: string
  subtitle: string
  badge?: string
  locked?: boolean
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(defaultOpen)
  return (
    <section className="max-md:mb-2.5 max-md:overflow-hidden max-md:rounded-xl max-md:border max-md:border-border max-md:bg-card max-md:shadow-[var(--m-shadow-low)]">
      <h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={id}
          className="focus-ring max-md:flex max-md:w-full max-md:items-center max-md:gap-2.5 max-md:p-3.5 max-md:text-left max-md:active:bg-foreground/[0.04]"
        >
          <span aria-hidden="true" className="max-md:grid max-md:size-9 max-md:shrink-0 max-md:place-items-center max-md:rounded-full max-md:bg-accent max-md:text-primary">
            <Icon className="max-md:size-[18px]" />
          </span>
          <span className="max-md:min-w-0 max-md:flex-1">
            <span className="max-md:block max-md:text-[15px] max-md:font-semibold max-md:text-foreground">{title}</span>
            <span className="max-md:mt-px max-md:block max-md:text-[11.5px] max-md:font-normal max-md:text-muted-foreground">{subtitle}</span>
          </span>
          {badge && (
            <span className="max-md:shrink-0 max-md:rounded-full max-md:bg-violet-bg max-md:px-2.5 max-md:py-1 max-md:text-[11px] max-md:font-bold max-md:text-violet">{badge}</span>
          )}
          {locked && <Lock className="max-md:ml-1.5 max-md:size-4 max-md:shrink-0 max-md:text-muted-foreground" aria-hidden="true" />}
          <ChevronDown className={cn('max-md:ml-1.5 max-md:size-5 max-md:shrink-0 max-md:text-input max-md:transition-transform', open && 'max-md:rotate-180')} aria-hidden="true" />
        </button>
      </h2>
      {open && (
        <dl id={id} className="max-md:grid max-md:grid-cols-2 max-md:gap-2 max-md:border-t max-md:border-input max-md:p-3">
          {children}
        </dl>
      )}
    </section>
  )
}

function PhoneProfile({
  data,
  fullName,
  isProduction,
  filledPct,
  onPassword,
  onSignOut,
}: {
  data: Employee
  fullName: string
  isProduction: boolean
  filledPct: number
  onPassword: () => void
  onSignOut: () => void
}) {
  const status = employeeStatusInfo(data.status)
  const age = ageOf(data.dateOfBirth)
  const tags = [isProduction ? 'Production' : data.employmentType ? 'Staff' : null, data.joinDate ? `Joined ${fmtDate(data.joinDate)}` : null, `Record ${filledPct}% complete`].filter(
    (t): t is string => !!t,
  )
  const rows: { href?: string; onClick?: () => void; icon: LucideIcon; label: string; sub: string }[] = [
    { onClick: onPassword, icon: KeyRound, label: 'Change Portal Password', sub: 'At least 8 characters' },
    { href: '/employee/help', icon: LifeBuoy, label: 'Help & Support', sub: 'Contact HR or software support' },
    { href: '/employee/resignation', icon: FileSignature, label: 'Resignation & Exit', sub: 'View resignation & notice details' },
  ]
  const rowCls =
    'focus-ring max-md:flex max-md:w-full max-md:items-center max-md:gap-3.5 max-md:px-4 max-md:py-3.5 max-md:text-left max-md:active:bg-foreground/[0.04]'

  return (
    <div className="hidden max-md:block">
      {/* Hero */}
      <section className="max-md:relative max-md:flex max-md:flex-col max-md:gap-3.5 max-md:overflow-hidden max-md:rounded-3xl max-md:bg-[linear-gradient(135deg,#0F172A,#1E3A8A,#2563EB)] max-md:p-5 max-md:text-white max-md:shadow-[var(--m-shadow-mid)] max-md:dark:bg-[linear-gradient(135deg,#0B1220,#111827,#1E3A5F)]">
        <span aria-hidden="true" className="max-md:pointer-events-none max-md:absolute max-md:-top-[30px] max-md:-right-[30px] max-md:size-[120px] max-md:rounded-full max-md:bg-white/10" />
        <span aria-hidden="true" className="max-md:pointer-events-none max-md:absolute max-md:-bottom-5 max-md:-left-2.5 max-md:size-20 max-md:rounded-full max-md:bg-white/8" />
        <div className="max-md:relative max-md:flex max-md:flex-col max-md:items-end">
          {!status.unknown && (
            <span
              className={cn(
                'max-md:flex max-md:items-center max-md:gap-[5px] max-md:rounded-full max-md:px-[9px] max-md:py-1 max-md:text-[10.5px] max-md:font-bold',
                status.isActive ? 'max-md:bg-[rgb(52_211_153/0.2)]' : 'max-md:bg-[rgb(251_191_36/0.25)]',
              )}
            >
              <span aria-hidden="true" className={cn('max-md:size-1.5 max-md:rounded-full', status.isActive ? 'max-md:bg-[#34D399]' : 'max-md:bg-[#FBBF24]')} />
              {status.label}
            </span>
          )}
          <span className="max-md:mt-[5px] max-md:text-[10px] max-md:font-bold max-md:tracking-[0.5px] max-md:text-white/65">ROLL #{data.employeeCode}</span>
        </div>
        <div className="max-md:relative max-md:flex max-md:items-center max-md:gap-3">
          <Avatar className="max-md:size-16 max-md:border-2 max-md:border-white/50">
            {data.photoUrl && <AvatarImage src={data.photoUrl} alt="" className="max-md:object-cover" />}
            <AvatarFallback className="max-md:bg-white/15 max-md:text-[20px] max-md:font-bold max-md:text-white">
              {data.firstName?.[0]}
              {data.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
          <div className="max-md:min-w-0 max-md:flex-1">
            <h1 className="max-md:truncate max-md:font-[family-name:var(--font-display)] max-md:text-[19px] max-md:leading-6 max-md:font-semibold">{fullName}</h1>
            <p className="max-md:mt-0.5 max-md:truncate max-md:text-[12.5px] max-md:text-white/80">
              {[data.designationTitle, data.departmentName].filter(Boolean).join(' • ') || 'Your details as HR keeps them.'}
            </p>
            {(data.departmentName || data.branchName) && (
              <p className="max-md:mt-1 max-md:flex max-md:items-center max-md:gap-[5px] max-md:text-[11px] max-md:text-white/70">
                <Building2 className="max-md:size-3 max-md:shrink-0" aria-hidden="true" />
                <span className="max-md:truncate">{[data.departmentName, data.branchName].filter(Boolean).join(' • ')}</span>
              </p>
            )}
          </div>
        </div>
        {tags.length > 0 && (
          <ul className="max-md:relative max-md:flex max-md:flex-wrap max-md:gap-2" aria-label="About you">
            {tags.map((t) => (
              <li key={t} className="max-md:rounded-full max-md:bg-white/15 max-md:px-2.5 max-md:py-[5px] max-md:text-[10.5px] max-md:font-bold">
                {t}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Digital ID Pass */}
      <Link
        href="/employee/id-card"
        className="focus-ring max-md:mt-3.5 max-md:mb-3 max-md:flex max-md:items-center max-md:gap-3 max-md:rounded-xl max-md:bg-accent max-md:p-3.5 max-md:active:opacity-85"
      >
        <span aria-hidden="true" className="max-md:grid max-md:size-[38px] max-md:shrink-0 max-md:place-items-center max-md:rounded-xl max-md:bg-card max-md:text-primary">
          <IdCard className="max-md:size-5" />
        </span>
        <span className="max-md:min-w-0 max-md:flex-1">
          <span className="max-md:flex max-md:items-center max-md:gap-1.5">
            <span className="max-md:text-[14px] max-md:font-semibold max-md:text-foreground">Digital ID Pass</span>
            <span className="max-md:rounded-full max-md:bg-info-bg max-md:px-[7px] max-md:py-0.5 max-md:text-[9px] max-md:font-[800] max-md:text-info">QR</span>
          </span>
          <span className="max-md:mt-0.5 max-md:block max-md:truncate max-md:text-[11px] max-md:text-muted-foreground">Your ID card and its verification QR</span>
        </span>
        <span className="max-md:shrink-0 max-md:rounded-md max-md:bg-white max-md:p-1" aria-hidden="true">
          <QRCodeSVG value={verifyUrl(data.employeeCode)} size={30} fgColor="#0f172a" bgColor="#ffffff" />
        </span>
        <ArrowRight className="max-md:size-[18px] max-md:shrink-0 max-md:text-primary" aria-hidden="true" />
      </Link>

      {/* Stats row */}
      <dl className="max-md:mb-3 max-md:grid max-md:grid-cols-3 max-md:gap-2.5">
        {[
          { label: 'Work Contact', value: data.phone, icon: Phone },
          { label: 'Join Date', value: fmtDate(data.joinDate), icon: CalendarDays },
          { label: 'Branch', value: data.branchName, icon: MapPin },
        ].map((st) => (
          <div
            key={st.label}
            className="max-md:flex max-md:min-w-0 max-md:flex-col-reverse max-md:items-center max-md:gap-1 max-md:rounded-xl max-md:border max-md:border-border max-md:bg-card max-md:p-3 max-md:text-center max-md:shadow-[var(--m-shadow-low)]"
          >
            <dt className="max-md:text-[9.5px] max-md:font-semibold max-md:text-muted-foreground">{st.label}</dt>
            <dd className="max-md:flex max-md:w-full max-md:flex-col max-md:items-center max-md:gap-1">
              <st.icon className="max-md:size-[18px] max-md:text-primary" aria-hidden="true" />
              <span className="max-md:w-full max-md:truncate max-md:text-[12.5px] max-md:font-semibold max-md:text-foreground max-md:tabular-nums">{st.value || '—'}</span>
            </dd>
          </div>
        ))}
      </dl>

      {/* Detail cards */}
      <PhoneExpandable id="m-prof-personal" icon={UserRound} title="Personal Details" subtitle="Who you are and how to reach you" defaultOpen>
        <PhoneBox label="Legal Full Name" value={fullName} />
        <PhoneBox label="Gender • Blood Group" value={[data.gender, data.bloodGroup].filter(Boolean).join(' • ')} />
        <PhoneBox label="Date of Birth" value={data.dateOfBirth ? `${fmtDate(data.dateOfBirth)}${age != null ? ` (${age}y)` : ''}` : undefined} />
        <PhoneBox label="Phone" value={data.phone} mono />
        <PhoneBox label="Email" value={data.email} wide />
        <PhoneBox label="Emergency Contact" value={data.emergencyContact} mono wide />
        <PhoneBox label="Address" value={data.address} wide />
      </PhoneExpandable>
      <PhoneExpandable id="m-prof-family" icon={Users} title="Family" subtitle="Parents on your HR record">
        <PhoneBox label="Father's Name" value={data.fatherName} />
        <PhoneBox label="Mother's Name" value={data.motherName} />
      </PhoneExpandable>
      <PhoneExpandable
        id="m-prof-work"
        icon={Building2}
        title="Employment"
        subtitle="Department, designation and branch"
        badge={isProduction ? 'Production' : data.employmentType ? 'Staff' : undefined}
      >
        <PhoneBox label="Employee Code" value={data.employeeCode} mono />
        <PhoneBox label="Join Date" value={fmtDate(data.joinDate)} />
        <PhoneBox label="Department" value={data.departmentName} />
        <PhoneBox label="Designation" value={data.designationTitle} />
        <PhoneBox label="Branch" value={data.branchName} wide />
        {data.branchAddress && <PhoneBox label="Branch Address" value={data.branchAddress} wide />}
      </PhoneExpandable>
      <PhoneExpandable id="m-prof-bank" icon={Landmark} title="Bank & Compliance" subtitle="Salary account, PF, ESI and UAN" locked>
        <PhoneBox label="Bank Name" value={data.bankName} />
        <PhoneBox label="IFSC Code" value={data.bankIfsc} mono />
        <PhoneBox label="Account Number" value={mask(data.bankAccount)} mono wide />
        <PhoneBox label="PF Number" value={data.pfNumber} mono />
        <PhoneBox label="ESI Number" value={data.esiNumber} mono />
        <PhoneBox label="UAN Number" value={data.uanNumber} mono wide />
      </PhoneExpandable>

      {/* Security & account */}
      <p className="max-md:mt-1 max-md:mb-2 max-md:text-[11px] max-md:font-bold max-md:tracking-[0.5px] max-md:text-muted-foreground">SECURITY & ACCOUNT</p>
      <ul className="max-md:mb-3 max-md:overflow-hidden max-md:rounded-xl max-md:border max-md:border-border max-md:bg-card max-md:shadow-[var(--m-shadow-low)] max-md:[&>li+li]:border-t max-md:[&>li+li]:border-input">
        {rows.map((r) => {
          const inner = (
            <>
              <span aria-hidden="true" className="max-md:grid max-md:size-[38px] max-md:shrink-0 max-md:place-items-center max-md:rounded-full max-md:bg-accent max-md:text-primary">
                <r.icon className="max-md:size-5" />
              </span>
              <span className="max-md:min-w-0 max-md:flex-1">
                <span className="max-md:block max-md:text-[14.5px] max-md:font-semibold max-md:text-foreground">{r.label}</span>
                <span className="max-md:mt-px max-md:block max-md:text-[11px] max-md:text-muted-foreground">{r.sub}</span>
              </span>
              <ChevronRight className="max-md:size-5 max-md:shrink-0 max-md:text-input" aria-hidden="true" />
            </>
          )
          return (
            <li key={r.label}>
              {r.href ? (
                <Link href={r.href} className={rowCls}>
                  {inner}
                </Link>
              ) : (
                <button type="button" onClick={r.onClick} className={rowCls}>
                  {inner}
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <p className="max-md:mb-3 max-md:flex max-md:items-start max-md:gap-2 max-md:px-1 max-md:text-[11.5px] max-md:leading-4 max-md:text-muted-foreground">
        <ShieldCheck className="max-md:mt-px max-md:size-3.5 max-md:shrink-0" aria-hidden="true" />
        HR keeps your profile and photo. Contact them to change anything.
      </p>

      <button
        type="button"
        onClick={onSignOut}
        className="focus-ring max-md:flex max-md:min-h-12 max-md:w-full max-md:items-center max-md:justify-center max-md:gap-2 max-md:rounded-full max-md:bg-rejected-bg max-md:py-3.5 max-md:text-[14.5px] max-md:font-semibold max-md:text-rejected max-md:active:opacity-85"
      >
        <LogOut className="max-md:size-[18px]" aria-hidden="true" /> Sign Out of UKTextiles
      </button>
      <p className="max-md:mt-2.5 max-md:text-center max-md:text-[10.5px] max-md:text-muted-foreground">UKTextiles Employee Portal</p>
    </div>
  )
}
