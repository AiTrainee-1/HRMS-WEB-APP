import {
  LayoutDashboard,
  CalendarCheck,
  MapPin,
  Send,
  Timer,
  CalendarClock,
  ClipboardCheck,
  Wallet,
  Clock,
  BadgeCheck,
  PartyPopper,
  FileStack,
  FolderOpen,
  MessageCircle,
  Bell,
  UserRound,
  Building2,
  Fingerprint,
  FileSignature,
  DoorOpen,
  LifeBuoy,
  HandCoins,
  UserCheck,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  /** One plain-English line about the page (tooltips, search, a page's default subtitle). */
  description?: string
  managerOnly?: boolean
  /** Only for staff employees (production employees never see the entry); see hooks/useEmploymentType.ts. */
  staffOnly?: boolean
}

export interface NavGroup {
  heading: string
  items: NavItem[]
}

// Grouped by what the employee wants to do, in plain words. The group heading is also the eyebrow above each page's
// title (kit PageHero) and the first part of the top-bar breadcrumb. Every route in App.tsx that is a page of its own
// has exactly one entry here.
export const navGroups: NavGroup[] = [
  {
    heading: 'My day',
    items: [
      { label: 'Dashboard', href: '/employee/dashboard', icon: LayoutDashboard, description: 'Your day at a glance' },
      { label: 'Attendance', href: '/employee/attendance', icon: CalendarCheck, description: 'Your punches and days, month by month' },
      { label: 'My Shift', href: '/employee/shift', icon: Clock, description: 'Your shift timings and this week' },
      { label: 'Holidays', href: '/employee/holidays', icon: PartyPopper, description: 'Company holidays this year' },
    ],
  },
  {
    heading: 'Requests',
    items: [
      { label: 'Geo Punch / On-Duty', href: '/employee/attendance-request', icon: MapPin, description: 'Punch from your location or go on duty' },
      { label: 'Leave', href: '/employee/leave', icon: Send, description: 'Apply for leave and see decisions' },
      { label: 'Permission', href: '/employee/permissions', icon: Timer, description: 'Ask to come late or leave early' },
      { label: 'Casual Leave', href: '/employee/casual-leave', icon: CalendarClock, description: 'Your Casual Leave balance (12 a year)' },
      { label: 'Missing Punch', href: '/employee/missing-punch', icon: Fingerprint, description: 'Fix a punch the machine missed' },
      { label: 'Outpass & Tea Break', href: '/employee/outpass', icon: DoorOpen, description: 'Step out of the factory during work hours' },
      { label: 'Resignation', href: '/employee/resignation', icon: FileSignature, description: 'Send or track your resignation' },
    ],
  },
  {
    heading: 'Team',
    items: [
      { label: 'Manager Approvals', href: '/employee/approvals', icon: ClipboardCheck, description: 'Requests from your team', managerOnly: true },
      { label: 'My Department Head', href: '/employee/hod', icon: UserCheck, description: 'Who approves your requests' },
      { label: 'Team Chat', href: '/employee/chat', icon: MessageCircle, description: 'Company and department messages' },
    ],
  },
  {
    heading: 'Pay',
    items: [
      { label: 'Salary Slips', href: '/employee/salary', icon: Wallet, description: 'Your payslips, month by month' },
      { label: 'Compensation', href: '/employee/compensation', icon: HandCoins, description: 'Overtime and extra pay', staffOnly: true },
      { label: 'Advances & Settlement', href: '/employee/settlement', icon: FileStack, description: 'Salary advances and what is left to repay' },
    ],
  },
  {
    heading: 'Me & company',
    items: [
      { label: 'My Profile', href: '/employee/profile', icon: UserRound, description: 'Your details and password' },
      { label: 'Digital ID', href: '/employee/id-card', icon: BadgeCheck, description: 'Your ID card on your phone' },
      { label: 'Documents', href: '/employee/documents', icon: FolderOpen, description: 'Your documents and company forms' },
      { label: 'Notifications', href: '/employee/notifications', icon: Bell, description: 'Everything we told you' },
      { label: 'About UKTextiles', href: '/employee/company', icon: Building2, description: 'Our company, mills and story' },
      { label: 'Help & Support', href: '/employee/help', icon: LifeBuoy, description: 'Contact HR and IT' },
    ],
  },
]

/** The nav entry (and its group) for a location — drives the top-bar breadcrumb and PageHero's eyebrow. */
export function findNav(location: string): { group: NavGroup; item: NavItem } | null {
  for (const group of navGroups) {
    for (const item of group.items) {
      if (location === item.href || location.startsWith(item.href + '/')) return { group, item }
    }
  }
  return null
}

/** Is this nav entry the current page? (Also true on its sub-pages: /employee/salary/12 is Salary Slips.) */
export function isActiveHref(location: string, href: string): boolean {
  return location === href || location.startsWith(href + '/')
}
