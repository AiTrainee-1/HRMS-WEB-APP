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

export const navGroups: NavGroup[] = [
  {
    heading: 'Home & Attendance',
    items: [
      { label: 'Home', href: '/employee/dashboard', icon: LayoutDashboard },
      { label: 'Attendance', href: '/employee/attendance', icon: CalendarCheck },
      { label: 'Attendance Request', href: '/employee/attendance-request', icon: MapPin },
      { label: 'Leave', href: '/employee/leave', icon: Send },
      { label: 'Permission', href: '/employee/permissions', icon: Timer },
      { label: 'Casual Leave', href: '/employee/casual-leave', icon: CalendarClock },
      { label: 'Missing Punch', href: '/employee/missing-punch', icon: Fingerprint },
      { label: 'Approvals', href: '/employee/approvals', icon: ClipboardCheck, managerOnly: true },
    ],
  },
  {
    heading: 'Payroll & Records',
    items: [
      { label: 'Salary Slip', href: '/employee/salary', icon: Wallet },
      { label: 'My Shift', href: '/employee/shift', icon: Clock },
      { label: 'ID Card', href: '/employee/id-card', icon: BadgeCheck },
      { label: 'Holidays', href: '/employee/holidays', icon: PartyPopper },
      { label: 'Settlement', href: '/employee/settlement', icon: FileStack },
      { label: 'Documents', href: '/employee/documents', icon: FolderOpen },
    ],
  },
  {
    heading: 'Other',
    items: [
      { label: 'Chat', href: '/employee/chat', icon: MessageCircle },
      { label: 'Alerts', href: '/employee/notifications', icon: Bell },
      { label: 'Profile', href: '/employee/profile', icon: UserRound },
      { label: 'Company', href: '/employee/company', icon: Building2 },
      { label: 'Resignation', href: '/employee/resignation', icon: FileSignature },
    ],
  },
]
