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
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  managerOnly?: boolean
}

export interface NavGroup {
  heading: string
  items: NavItem[]
}

// Grouping follows the Sovereign Loom sidebar: Overview, HR & Workflows,
// Payroll & Ops, System & Directory.
export const navGroups: NavGroup[] = [
  {
    heading: 'Overview',
    items: [
      { label: 'Dashboard', href: '/employee/dashboard', icon: LayoutDashboard },
      { label: 'Attendance', href: '/employee/attendance', icon: CalendarCheck },
      { label: 'My Shift', href: '/employee/shift', icon: Clock },
    ],
  },
  {
    heading: 'HR & Workflows',
    items: [
      { label: 'Geo Punch / On-Duty', href: '/employee/attendance-request', icon: MapPin },
      { label: 'Leave', href: '/employee/leave', icon: Send },
      { label: 'Permission', href: '/employee/permissions', icon: Timer },
      { label: 'Casual Leave', href: '/employee/casual-leave', icon: CalendarClock },
      { label: 'Missing Punch', href: '/employee/missing-punch', icon: Fingerprint },
      { label: 'Manager Approvals', href: '/employee/approvals', icon: ClipboardCheck, managerOnly: true },
      { label: 'Documents', href: '/employee/documents', icon: FolderOpen },
    ],
  },
  {
    heading: 'Payroll & Ops',
    items: [
      { label: 'Salary Slips', href: '/employee/salary', icon: Wallet },
      { label: 'Settlement & Advances', href: '/employee/settlement', icon: FileStack },
      { label: 'Outpass & Gates', href: '/employee/outpass', icon: DoorOpen },
      { label: 'Resignation', href: '/employee/resignation', icon: FileSignature },
    ],
  },
  {
    heading: 'System & Directory',
    items: [
      { label: 'Holidays', href: '/employee/holidays', icon: PartyPopper },
      { label: 'Team Chat', href: '/employee/chat', icon: MessageCircle },
      { label: 'Notifications', href: '/employee/notifications', icon: Bell },
      { label: 'Digital ID', href: '/employee/id-card', icon: BadgeCheck },
      { label: 'My Profile', href: '/employee/profile', icon: UserRound },
      { label: 'Company Directory', href: '/employee/company', icon: Building2 },
      { label: 'Help & Support', href: '/employee/help', icon: LifeBuoy },
    ],
  },
]

/** The nav entry (and its group) for a location — drives the top-bar breadcrumb. */
export function findNav(location: string): { group: NavGroup; item: NavItem } | null {
  for (const group of navGroups) {
    for (const item of group.items) {
      if (location === item.href || location.startsWith(item.href + '/')) return { group, item }
    }
  }
  return null
}
