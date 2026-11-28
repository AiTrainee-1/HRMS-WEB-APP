import * as React from 'react'
import { Link } from 'wouter'
import { motion } from 'framer-motion'
import {
  ArrowUpRight, BadgeCheck, Banknote, Bell, Briefcase, BriefcaseBusiness, Building2, CalendarCheck, CalendarClock, CalendarHeart,
  ChevronDown, ChevronUp, CircleUserRound, ClipboardCheck, Clock, DoorOpen, FileSignature, Fingerprint, Flag, Folder, FolderOpen,
  Hand, HandCoins, IdCard, Landmark, LayoutGrid, Leaf, LifeBuoy, MapPin, MessageCircle, MessageCircleQuestion, PartyPopper, Pointer, Route, Send, ShieldUser,
  Timer, Wallet, type LucideIcon,
} from 'lucide-react'
import { GlassCard, SectionHeader, TONE_SOFT, listItem, type Tone } from '@/components/kit'
import { cn } from '@/lib/utils'

interface Action {
  label: string
  hint: string
  href: string
  icon: LucideIcon
  tone: Tone
  staffOnly?: boolean
  /** An applying entry (Loan & Advance): left out when this employee cannot apply (owner 2026-11-28: a production
   *  employee keeps the page in the menu for the history, but gets no apply quick action). */
  applying?: boolean
}

const ACTIONS: Action[] = [
  { label: 'Geo Punch / On-Duty', hint: 'Punch from where you are', href: '/employee/attendance-request', icon: MapPin, tone: 'emerald' },
  { label: 'Leave', hint: 'Apply and track', href: '/employee/leave', icon: Send, tone: 'sapphire' },
  { label: 'Permission', hint: 'Come late or leave early', href: '/employee/permissions', icon: Timer, tone: 'amber' },
  { label: 'Casual Leave', hint: 'Your CL balance', href: '/employee/casual-leave', icon: CalendarClock, tone: 'violet', staffOnly: true },
  { label: 'Missing Punch', hint: 'Fix a missed punch', href: '/employee/missing-punch', icon: Fingerprint, tone: 'rose' },
  { label: 'Outpass', hint: 'Step out with a QR', href: '/employee/outpass', icon: DoorOpen, tone: 'sapphire' },
  { label: 'Salary Slips', hint: 'Month by month', href: '/employee/salary', icon: Wallet, tone: 'emerald' },
  { label: 'Loan & Advance', hint: 'Apply and repayments', href: '/employee/settlement', icon: HandCoins, tone: 'amber', applying: true },
  { label: 'Documents', hint: 'Your HR records', href: '/employee/documents', icon: FolderOpen, tone: 'slate' },
  { label: 'Digital ID', hint: 'Show at the gate', href: '/employee/id-card', icon: BadgeCheck, tone: 'sapphire' },
  { label: 'Holidays', hint: 'This year', href: '/employee/holidays', icon: PartyPopper, tone: 'violet' },
  { label: 'Team Chat', hint: 'Company & department', href: '/employee/chat', icon: MessageCircle, tone: 'emerald' },
  { label: 'Enquiries', hint: 'Ask HR a question', href: '/employee/enquiries', icon: MessageCircleQuestion, tone: 'sapphire' },
]

/** The things people open most, one click each. Casual Leave only for staff; Manager Approvals for heads (with a count);
 *  Loan & Advance not when `applyHidden` (an employee who cannot apply). */
export function QuickActions({
  isStaff,
  isManager,
  pendingApprovals,
  applyHidden = false,
}: {
  isStaff: boolean
  isManager: boolean
  pendingApprovals: number
  applyHidden?: boolean
}) {
  const list: (Action & { badge?: number })[] = ACTIONS.filter((a) => (!a.staffOnly || isStaff) && (!a.applying || !applyHidden))
  if (isManager) {
    list.unshift({
      label: 'Manager Approvals',
      hint: pendingApprovals > 0 ? `${pendingApprovals} waiting for you` : 'Requests from your team',
      href: '/employee/approvals',
      icon: ClipboardCheck,
      tone: 'amber',
      badge: pendingApprovals,
    })
  }

  return (
    <section aria-labelledby="quick-title" className="flex flex-col gap-4 max-md:hidden">
      <SectionHeader id="quick-title" icon={LayoutGrid} title="Quick actions" description="Everything you do most, one click away." />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
        {list.map((a, i) => (
          <motion.li key={a.href} {...listItem(i)} className="min-w-0">
            <GlassCard variant="interactive" asChild padding="none" className="group relative flex h-full flex-col gap-3 p-4">
              <Link href={a.href} aria-label={a.badge ? `${a.label}, ${a.badge} waiting` : undefined}>
                <span className="flex items-start justify-between gap-2">
                  <span
                    className={cn(
                      'grid size-11 place-items-center rounded-xl border shadow-clay-sm transition-transform duration-300 ease-[var(--ease-spring)] group-hover:-translate-y-0.5 group-hover:-rotate-6 group-hover:scale-110',
                      TONE_SOFT[a.tone],
                    )}
                    aria-hidden="true"
                  >
                    <a.icon className="size-5" />
                  </span>
                  {a.badge ? (
                    <span className="font-label rounded-full border border-waiting-border bg-waiting-bg px-2 py-px text-[12px] font-bold text-waiting tabular-nums" aria-hidden="true">
                      {a.badge}
                    </span>
                  ) : (
                    <ArrowUpRight className="size-4 text-muted-foreground opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" aria-hidden="true" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-[14.5px] leading-5 font-semibold">{a.label}</span>
                  <span className="block text-[12.5px] leading-4 text-muted-foreground">{a.hint}</span>
                </span>
              </Link>
            </GlassCard>
          </motion.li>
        ))}
      </ul>
    </section>
  )
}

// ── PHONE ONLY (< 768px) ─────────────────────────────────────────────────────────────────────────────────────────────
// The mobile app's Home "Quick Actions" (app/(tabs)/home.tsx makeQuickActions): 3-column white tiles with a 46px pastel
// well (the app's own colour pair per tile), an 11px label, the first six shown and a "Show all N actions" pill. Same
// order and words as the app, pointed at the web's pages; the app's Live Tracking has no web page and is left out, and
// the web's Casual Leave (staff) and Help & Support join the list. Department heads reach Approvals from the tab bar.

interface PhoneAction {
  label: string
  href: string
  icon: LucideIcon
  /** The icon colour (the app's hex); the well is `bg` in light mode, this colour at 20% in dark mode. */
  color: string
  bg: string
  /** Shown only once the profile says 'staff' (Compensation, Casual Leave). */
  staffOnly?: boolean
  /** Left out for a production employee, as in the app (its Apply Leave / Permission tiles are `staffOnly`); shown while
   * the profile is still loading. */
  notForProduction?: boolean
  /** An applying entry (Loan & Advance): left out when this employee cannot apply (`applyHidden`, owner 2026-11-28). */
  applying?: boolean
}

const PHONE_ACTIONS: PhoneAction[] = [
  { label: 'On-Duty', href: '/employee/attendance-request?mode=onduty', icon: Briefcase, color: '#B7791F', bg: '#FDF3E3' },
  { label: 'On-Duty Journey', href: '/employee/attendance-request?mode=records', icon: Route, color: '#0E7490', bg: '#E1F3F7' },
  { label: 'Missing Punch', href: '/employee/missing-punch', icon: Pointer, color: '#6D4AFF', bg: '#EFEBFF' },
  { label: 'Apply Leave', href: '/employee/leave', icon: Leaf, color: '#D6408C', bg: '#FCE9F3', notForProduction: true },
  { label: 'Permission', href: '/employee/permissions', icon: Hand, color: '#2980B9', bg: '#E7F3FB', notForProduction: true },
  { label: 'Gate Outpass', href: '/employee/outpass', icon: DoorOpen, color: '#009688', bg: '#E4F5F3' },
  { label: 'Salary Slips', href: '/employee/salary', icon: Banknote, color: '#27AE60', bg: '#E7F7EE' },
  { label: 'Casual Leave', href: '/employee/casual-leave', icon: CalendarHeart, color: '#B7791F', bg: '#FDF3E3', staffOnly: true },
  { label: 'Attendance', href: '/employee/attendance', icon: CalendarCheck, color: '#059669', bg: '#ECFDF5' },
  { label: 'Attendance Request', href: '/employee/attendance-request', icon: MapPin, color: '#0369A1', bg: '#DBEAFE' },
  { label: 'My Shift', href: '/employee/shift', icon: Clock, color: '#E67E22', bg: '#FDEEE3' },
  { label: 'Loan & Advance', href: '/employee/settlement', icon: Landmark, color: '#7F8C8D', bg: '#F1F5F9', notForProduction: true, applying: true },
  { label: 'Digital ID Card', href: '/employee/id-card', icon: IdCard, color: '#2C3E50', bg: '#F1F5F9' },
  { label: 'My Documents', href: '/employee/documents', icon: Folder, color: '#00897B', bg: '#E1F4F2' },
  { label: 'Holidays', href: '/employee/holidays', icon: Flag, color: '#C0392B', bg: '#FFF1F2' },
  { label: 'Compensation', href: '/employee/compensation', icon: BriefcaseBusiness, color: '#047857', bg: '#E1F5EC', staffOnly: true },
  { label: 'Department Head', href: '/employee/hod', icon: ShieldUser, color: '#6D28D9', bg: '#EFEBFF' },
  { label: 'Enquiries', href: '/employee/enquiries', icon: MessageCircleQuestion, color: '#0F766E', bg: '#E0F2F1' },
  { label: 'Notifications', href: '/employee/notifications', icon: Bell, color: '#D97706', bg: '#FEF3C7' },
  { label: 'Team Chat', href: '/employee/chat', icon: MessageCircle, color: '#0984E3', bg: '#DBEAFE' },
  { label: 'My Profile', href: '/employee/profile', icon: CircleUserRound, color: '#2C3E50', bg: '#F1F5F9' },
  { label: 'About Company', href: '/employee/company', icon: Building2, color: '#1E3A8A', bg: '#DBEAFE' },
  { label: 'Help & Support', href: '/employee/help', icon: LifeBuoy, color: '#1E3A8A', bg: '#DBEAFE' },
  { label: 'Resignation', href: '/employee/resignation', icon: FileSignature, color: '#C62828', bg: '#FFF1F2' },
]

/** First tiles visible, like the app (two rows of three). */
const PHONE_VISIBLE = 6

export function QuickActionsPhone({
  isStaff,
  isProduction,
  applyHidden = false,
}: {
  isStaff: boolean
  isProduction: boolean
  applyHidden?: boolean
}) {
  const [showAll, setShowAll] = React.useState(false)
  const list = PHONE_ACTIONS.filter(
    (a) => (!a.staffOnly || isStaff) && (!a.notForProduction || !isProduction) && (!a.applying || !applyHidden),
  )
  const visible = showAll ? list : list.slice(0, PHONE_VISIBLE)
  return (
    <section aria-labelledby="m-quick-title" className="hidden max-md:mb-[18px] max-md:block">
      <div className="max-md:mb-3 max-md:flex max-md:items-baseline max-md:justify-between max-md:gap-2">
        <h2 id="m-quick-title" className="max-md:font-[family-name:var(--font-display)] max-md:text-[17px] max-md:font-semibold max-md:text-foreground">
          Quick Actions
        </h2>
        <span className="max-md:text-[11px] max-md:font-semibold max-md:text-muted-foreground">Essential Workflows</span>
      </div>
      <ul id="m-quick-list" className="max-md:mb-3 max-md:grid max-md:grid-cols-3 max-md:gap-2.5">
        {visible.map((a) => (
          <li key={a.href} className="max-md:min-w-0">
            <Link
              href={a.href}
              style={{ '--c': a.color, '--w': a.bg } as React.CSSProperties}
              className="focus-ring max-md:flex max-md:min-h-24 max-md:w-full max-md:flex-col max-md:items-center max-md:justify-center max-md:gap-2 max-md:rounded-xl max-md:border max-md:border-border max-md:bg-card max-md:px-1.5 max-md:py-4 max-md:shadow-[var(--m-shadow-low)] max-md:transition-opacity max-md:active:opacity-85"
            >
              <span
                aria-hidden="true"
                className="max-md:grid max-md:size-[46px] max-md:place-items-center max-md:rounded-xl max-md:bg-[var(--w)] max-md:text-[var(--c)] max-md:dark:bg-[color-mix(in_srgb,var(--c)_20%,transparent)] max-md:dark:text-[color-mix(in_srgb,var(--c)_55%,white)]"
              >
                <a.icon className="max-md:size-[22px]" />
              </span>
              <span className="max-md:w-full max-md:truncate max-md:text-center max-md:text-[11px] max-md:font-semibold max-md:text-foreground">{a.label}</span>
            </Link>
          </li>
        ))}
      </ul>
      {list.length > PHONE_VISIBLE && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          aria-controls="m-quick-list"
          className="focus-ring max-md:flex max-md:min-h-11 max-md:w-full max-md:items-center max-md:justify-center max-md:gap-1 max-md:rounded-full max-md:bg-accent max-md:py-3 max-md:text-[13px] max-md:font-semibold max-md:text-primary max-md:active:opacity-85"
        >
          {showAll ? 'Show less' : `Show all ${list.length} actions`}
          {showAll ? <ChevronUp className="max-md:size-4" aria-hidden="true" /> : <ChevronDown className="max-md:size-4" aria-hidden="true" />}
        </button>
      )}
    </section>
  )
}
