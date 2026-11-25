import * as React from 'react'
import { Link } from 'wouter'
import { useQuery } from '@tanstack/react-query'
import {
  Award, BadgeCheck, Barcode, Briefcase, Building2, Cake, CalendarDays, Clock, Contact, CreditCard, Droplet, Factory,
  FileSignature, Flag, Hash, HeartPulse, KeyRound, Landmark, LifeBuoy, LogOut, Mail, Map as MapIcon, MapPin, Monitor, Moon, Network,
  Phone, ScanLine, ShieldCheck, Siren, Star, Sun, UserCog, UserRound, Users, type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { ErrorState, GlassCard, PageHero, PageShell, RingMeter, SkeletonBlock, SkeletonList, type Tone } from '@/components/kit'
import { ProfileHero } from '@/components/profile/ProfileHero'
import { InfoGrid, InfoItem, ProfileSection, RowAction, SettingsRow, StatChip } from '@/components/profile/ProfileParts'
import { ChangePasswordDialog } from '@/components/profile/ChangePasswordDialog'
import { resignationApi } from '@/api/resources'
import { API_BASE_URL } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { useIsPhone } from '@/hooks/useIsPhone'
import { useMyShiftSummary } from '@/hooks/useMyShiftSummary'
import { useMyEmployee } from '@/hooks/useMyProfile'
import { waitingText } from '@/lib/approval'
import { resolvePhotoUrl } from '@/lib/hod'
import { employeeStatusInfo } from '@/lib/id-card'
import {
  calcAge,
  capitalize,
  displayDate,
  employmentTypeLabel,
  extractPhone,
  initialsOf,
  maskAccount,
  passwordAgeLabel,
  readExtras,
  recordCompleteness,
  resignationLine,
  serviceLength,
  shiftWindow,
} from '@/lib/profile-view'
import { verifyUrl } from '@/lib/verify'
import type { Employee } from '@/types'
import { AppTipsSection } from '@/components/system/AppTipsSection'

// The fields HR keeps for every employee; the ring shows how many are filled in.
const RECORD_FIELDS: (keyof Employee)[] = [
  'gender', 'dateOfBirth', 'bloodGroup', 'emergencyContact', 'phone', 'email', 'address', 'fatherName', 'motherName',
  'bankName', 'bankAccount', 'bankIfsc', 'pfNumber', 'esiNumber', 'uanNumber', 'photoUrl',
]

interface Chip {
  key: string
  icon: LucideIcon
  label: string
  value: string
  tone?: Tone
}

/**
 * My Profile (owner 2026-11-25 redesign, mirroring the mobile app's Profile tab): a royal hero with the photo, name,
 * role, status, code and the Digital ID; quick fact chips (service, shift, type, confirmation, tier, zone); the record
 * grouped as Personal, Contact, Employment & hierarchy, Family and Bank & compliance; then how complete the HR record is
 * and Settings & account (dark mode, password, help, resignation) and Sign out. Everything the page showed and did before
 * is still here. HR keeps the record: nothing is edited from this page except the password.
 * Desktop: the sections on the left, the record and settings in a column on the right. Phones: one column, the private
 * groups (Family, Bank) start closed like the app.
 */
export default function Profile() {
  const { user, logout } = useAuth()
  const theme = useTheme()
  const isPhone = useIsPhone()
  const [pwdOpen, setPwdOpen] = React.useState(false)

  const { data, isLoading, isError, error, refetch, isFetching } = useMyEmployee()
  // The shift and the resignation: both read from the caches the Dashboard / My Shift and the resignation guard share.
  const now = React.useMemo(() => new Date(), [])
  const shiftQuery = useMyShiftSummary(now.getMonth() + 1, now.getFullYear())
  const resignationQuery = useQuery({
    queryKey: ['my-resignation-guard'],
    queryFn: resignationApi.get,
    enabled: !!user,
    staleTime: 60_000,
  })

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
        <PageHero icon={<UserRound />} title="My Profile" subtitle="Your details as HR keeps them." />
        <div role="status" aria-label="Loading your profile" className="flex flex-col gap-4">
          <SkeletonBlock className="h-56 w-full rounded-3xl max-md:h-72" />
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-14 w-40 shrink-0 rounded-xl" />
            ))}
          </div>
        </div>
        <SkeletonList variant="cards" count={3} />
      </PageShell>
    )
  }

  const extras = readExtras(data)
  const fullName = `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim() || user?.name || 'Employee'
  const typeLabel = employmentTypeLabel(data.employmentType)
  const isProduction = typeLabel === 'Production'
  const status = employeeStatusInfo(data.status)
  const record = recordCompleteness(data, RECORD_FIELDS)
  const age = calcAge(data.dateOfBirth)
  const tenure = serviceLength(data.joinDate)
  const workPhone = extractPhone(data.phone)
  const emergencyPhone = extractPhone(data.emergencyContact)
  const photoUrl = resolvePhotoUrl(data.photoUrl, API_BASE_URL, window.location.origin)
  const shift = shiftQuery.data?.assignedShift ?? null
  const shiftTimes = shift ? shiftWindow(shift.startTime, shift.endTime) : null
  const resignation = resignationQuery.data ?? null
  const confirmation =
    extras.isConfirmed === null ? null : extras.isConfirmed ? { label: 'Confirmed', tone: 'emerald' as Tone } : { label: 'On probation', tone: 'amber' as Tone }

  const chips: Chip[] = [
    data.joinDate
      ? { key: 'joined', icon: CalendarDays, label: tenure ? `Joined · ${tenure}` : 'Joined', value: displayDate(data.joinDate) ?? data.joinDate }
      : null,
    shiftTimes ? { key: 'shift', icon: Clock, label: 'Shift', value: shiftTimes } : null,
    typeLabel ? { key: 'type', icon: isProduction ? Factory : Briefcase, label: 'Type', value: typeLabel } : null,
    confirmation ? { key: 'confirmed', icon: BadgeCheck, label: 'Confirmation', value: confirmation.label, tone: confirmation.tone } : null,
    extras.staffTier ? { key: 'tier', icon: Star, label: 'Tier', value: extras.staffTier, tone: 'violet' as Tone } : null,
    extras.zone ? { key: 'zone', icon: MapIcon, label: 'Zone', value: `Zone ${extras.zone}` } : null,
  ].filter((c): c is Chip => c !== null)

  const passwordSub = extras.passwordUpdatedAt || extras.hasPassword ? passwordAgeLabel(extras.passwordUpdatedAt) : 'At least 8 characters'
  const resignationSub = resignationLine(resignation?.status, waitingText(resignation?.approval))

  return (
    <>
      <PageShell className="max-md:gap-3">
        <PageHero
          icon={<UserRound />}
          title="My Profile"
          subtitle="Your details as HR keeps them."
          actions={
            <>
              <Button variant="outline" onClick={() => setPwdOpen(true)} className="min-h-11 max-md:hidden sm:min-h-9">
                <KeyRound /> Change password
              </Button>
              <Button variant="destructive" onClick={logout} className="min-h-11 max-md:hidden sm:min-h-9">
                <LogOut /> Sign out
              </Button>
            </>
          }
        />

        <ProfileHero
          name={fullName}
          photoUrl={photoUrl}
          initials={initialsOf(fullName)}
          verified={extras.hasPassword}
          roleLine={[data.designationTitle, data.departmentName].filter(Boolean).join(' · ')}
          placeLine={[data.departmentName, data.branchName].filter(Boolean).join(' · ')}
          status={status.unknown ? null : { label: status.label, active: status.isActive }}
          code={data.employeeCode}
          typeLabel={typeLabel}
          qrValue={verifyUrl(data.employeeCode)}
        />

        {chips.length > 0 && (
          <dl
            aria-label="Quick facts"
            className="flex flex-wrap gap-3 max-md:-mx-4 max-md:flex-nowrap max-md:gap-2.5 max-md:overflow-x-auto max-md:px-4 max-md:py-1 max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden"
          >
            {chips.map((c, i) => (
              <StatChip key={c.key} index={i} icon={c.icon} label={c.label} value={c.value} tone={c.tone} />
            ))}
          </dl>
        )}

        <div className="grid items-start gap-6 max-md:gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* The record */}
          <div className="flex min-w-0 flex-col gap-5 max-md:gap-3">
            <ProfileSection id="prof-personal" icon={UserRound} title="Personal details" subtitle="Who you are">
              <InfoGrid>
                <InfoItem icon={Contact} label="First name" value={data.firstName} />
                <InfoItem icon={Contact} label="Last name" value={data.lastName} />
                <InfoItem icon={Users} label="Gender" value={capitalize(data.gender)} />
                <InfoItem icon={Droplet} label="Blood group" value={data.bloodGroup} />
                <InfoItem icon={Cake} label="Date of birth" value={displayDate(data.dateOfBirth)} hint={age != null ? `(${age} yrs)` : null} />
                <InfoItem icon={Flag} label="Nationality" value={extras.nationality} />
              </InfoGrid>
            </ProfileSection>

            <ProfileSection id="prof-contact" icon={Phone} tone="emerald" title="Contact" subtitle="How the company reaches you">
              <InfoGrid>
                <InfoItem
                  icon={Phone}
                  label="Phone"
                  value={data.phone}
                  mono
                  action={workPhone ? <RowAction href={`tel:${workPhone}`} icon={Phone} label="Call your phone number" /> : undefined}
                />
                <InfoItem
                  icon={Mail}
                  label="Email"
                  value={data.email}
                  action={data.email ? <RowAction href={`mailto:${data.email}`} icon={Mail} label="Write an email" /> : undefined}
                />
                <InfoItem
                  icon={Siren}
                  label="Emergency contact"
                  value={data.emergencyContact}
                  mono
                  wide
                  action={emergencyPhone ? <RowAction href={`tel:${emergencyPhone}`} icon={Phone} label="Call your emergency contact" /> : undefined}
                />
                <InfoItem icon={MapPin} label="Address" value={data.address} wide />
                {data.branchAddress && <InfoItem icon={Building2} label="Branch address" value={data.branchAddress} wide />}
              </InfoGrid>
            </ProfileSection>

            <ProfileSection
              id="prof-work"
              icon={Building2}
              title="Employment & hierarchy"
              subtitle="Department, designation, branch and supervisor"
              badge={confirmation}
            >
              <InfoGrid>
                <InfoItem icon={Hash} label="Employee code" value={data.employeeCode} mono />
                <InfoItem icon={isProduction ? Factory : Briefcase} label="Employment type" value={typeLabel} />
                <InfoItem icon={Network} label="Department" value={data.departmentName} />
                <InfoItem icon={Award} label="Designation" value={data.designationTitle} />
                <InfoItem icon={Building2} label="Branch" value={data.branchName} />
                <InfoItem icon={CalendarDays} label="Join date" value={displayDate(data.joinDate)} hint={tenure ? `(${tenure})` : null} />
                {extras.workstation && <InfoItem icon={Monitor} label="Workstation" value={extras.workstation} />}
                {shift && <InfoItem icon={Clock} label="Shift" value={shift.name} hint={shiftTimes ? `(${shiftTimes})` : null} />}
                <InfoItem icon={UserCog} label="Supervisor" value={extras.supervisor} wide />
              </InfoGrid>
            </ProfileSection>

            <ProfileSection
              key={`family-${isPhone}`}
              id="prof-family"
              icon={Users}
              tone="violet"
              title="Family"
              subtitle="Parents on your HR record"
              defaultOpen={!isPhone}
            >
              <InfoGrid>
                <InfoItem icon={UserRound} label="Father's name" value={data.fatherName} />
                <InfoItem icon={UserRound} label="Mother's name" value={data.motherName} />
              </InfoGrid>
            </ProfileSection>

            <ProfileSection
              key={`bank-${isPhone}`}
              id="prof-bank"
              icon={Landmark}
              tone="amber"
              title="Bank & compliance"
              subtitle="Salary account, PF, ESI and UAN"
              locked
              defaultOpen={!isPhone}
            >
              <InfoGrid>
                <InfoItem icon={Landmark} label="Bank name" value={data.bankName} />
                <InfoItem icon={Barcode} label="IFSC code" value={data.bankIfsc} mono />
                <InfoItem icon={CreditCard} label="Account number" value={maskAccount(data.bankAccount)} mono wide />
                <InfoItem icon={ShieldCheck} label="PF number" value={data.pfNumber} mono />
                <InfoItem icon={HeartPulse} label="ESI number" value={data.esiNumber} mono />
                <InfoItem icon={ScanLine} label="UAN" value={data.uanNumber} mono wide />
              </InfoGrid>
            </ProfileSection>
          </div>

          {/* The record's completeness, settings and sign out */}
          <aside aria-label="Your record and account" className="flex min-w-0 flex-col gap-5 max-md:gap-3 lg:sticky lg:top-6">
            <GlassCard padding="lg" className="flex flex-col gap-4 max-md:p-4!">
              <div className="flex items-center gap-4">
                <RingMeter value={record.filled} max={record.total} silk size={88} thickness={9} label="Details on your HR record">
                  <span className="metric text-xl leading-none max-md:text-[18px]">{record.pct}%</span>
                </RingMeter>
                <div className="min-w-0 text-[13px] text-muted-foreground">
                  <h2 className="font-display text-[17px] font-semibold text-foreground max-md:text-[15px]">Record complete</h2>
                  <p className="mt-0.5">
                    {record.filled}/{record.total} details on file.{' '}
                    {record.filled < record.total && (
                      <Link href="/employee/help" className="font-semibold text-brand-blue underline-offset-2 hover:underline">
                        Ask HR to add the rest
                      </Link>
                    )}
                  </p>
                </div>
              </div>
              <p className="flex items-start gap-2 rounded-lg bg-info-bg px-3 py-2.5 text-[12.5px] text-info">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                Something out of date? HR keeps your profile and photo. Contact them to change anything.
              </p>
            </GlassCard>

            <GlassCard asChild padding="none" className="overflow-hidden">
              <section aria-labelledby="prof-settings-title">
                <h2 id="prof-settings-title" className="label-caps px-4 pt-4 pb-2 text-muted-foreground">
                  Settings &amp; account
                </h2>
                <ul className="[&>li+li]:border-t [&>li+li]:border-border/60 max-md:[&>li+li]:border-input">
                  <li>
                    <SettingsRow
                      icon={theme.isDark ? Moon : Sun}
                      tone={theme.isDark ? 'violet' : 'amber'}
                      label="Dark mode"
                      sub={theme.mode === 'system' ? 'Following your device' : theme.isDark ? 'On' : 'Off'}
                      right={
                        <span className="flex shrink-0 items-center gap-2">
                          {theme.mode !== 'system' && (
                            <button
                              type="button"
                              onClick={() => theme.setMode('system')}
                              className="focus-ring rounded-full border border-input px-2.5 py-1 text-[11px] font-bold text-muted-foreground hover:text-foreground"
                              aria-label="Follow your device's setting"
                            >
                              Auto
                            </button>
                          )}
                          <Switch checked={theme.isDark} onCheckedChange={theme.toggle} aria-label="Dark mode" />
                        </span>
                      }
                    />
                  </li>
                  <li>
                    <SettingsRow icon={KeyRound} label="Change portal password" sub={passwordSub} onClick={() => setPwdOpen(true)} />
                  </li>
                  <li>
                    <SettingsRow icon={LifeBuoy} tone="emerald" label="Help & Support" sub="Contact HR or software support" href="/employee/help" />
                  </li>
                  <li>
                    <SettingsRow icon={FileSignature} tone="rose" label="Resignation & Exit" sub={resignationSub} href="/employee/resignation" />
                  </li>
                </ul>
              </section>
            </GlassCard>

            {/* Replay the welcome tour + the spoken-welcome switch, as the mobile app's Profile has them (owner 2026-11-25). */}
            <AppTipsSection />

            {/* Phones: the app's Sign Out pill at the end of the page (desktop has it at the top). */}
            <button
              type="button"
              onClick={logout}
              className="focus-ring hidden max-md:flex max-md:min-h-12 max-md:w-full max-md:items-center max-md:justify-center max-md:gap-2 max-md:rounded-full max-md:bg-rejected-bg max-md:py-3.5 max-md:text-[14.5px] max-md:font-semibold max-md:text-rejected max-md:active:opacity-85"
            >
              <LogOut className="max-md:size-[18px]" aria-hidden="true" /> Sign Out of UKTextiles
            </button>
            <p className="text-center text-[11.5px] text-muted-foreground max-md:text-[10.5px]">UKTextiles Employee Portal</p>
          </aside>
        </div>
      </PageShell>

      <ChangePasswordDialog open={pwdOpen} onOpenChange={setPwdOpen} employeeCode={data.employeeCode} />
    </>
  )
}
