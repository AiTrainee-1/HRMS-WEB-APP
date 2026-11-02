import {
  Banknote,
  Bell,
  Building2,
  BriefcaseBusiness,
  CalendarCheck,
  CalendarHeart,
  CircleUserRound,
  ClipboardCheck,
  Clock,
  DoorOpen,
  FileSignature,
  Fingerprint,
  Flag,
  Folder,
  Hand,
  House,
  IdCard,
  Landmark,
  LifeBuoy,
  MapPin,
  MessageCircle,
  ShieldUser,
  Umbrella,
  type LucideIcon,
} from 'lucide-react'
import { navGroups, type NavItem } from '../nav-config'

// The PHONE navigation (< 768px): the bottom tab bar and the side drawer, laid out like the Employee MOBILE APP
// (uktextiles-employee-app: app/(tabs)/_layout.tsx and src/components/SideDrawer.tsx). The desktop sidebar keeps using
// nav-config.ts. Who sees an entry (managerOnly / staffOnly) is still decided by the nav-config entry with the same href,
// so the gating rules live in one place.

/** The nav-config entry for a route (for its managerOnly / staffOnly flags). */
function navEntry(href: string): NavItem | undefined {
  for (const g of navGroups) {
    const hit = g.items.find((i) => i.href === href)
    if (hit) return hit
  }
  return undefined
}

export interface PhoneNavItem {
  href: string
  label: string
  icon: LucideIcon
  /**
   * The icon's colour - the mobile app's per-entry hex (SideDrawer NAV_GROUPS). `undefined` = the theme's primary.
   * The icon well behind it is the same colour at ~9% (the app's `${color}18`).
   */
  color?: string
  /** Red label + red well (Resignation). */
  danger?: boolean
  managerOnly?: boolean
  staffOnly?: boolean
}

export interface PhoneNavGroup {
  heading: string
  items: PhoneNavItem[]
  /** A hairline before the last item (the app's divider above Resignation). */
  dividerBeforeLast?: boolean
}

function item(href: string, label: string, icon: LucideIcon, extra: Partial<PhoneNavItem> = {}): PhoneNavItem {
  const nav = navEntry(href)
  return { href, label, icon, managerOnly: nav?.managerOnly, staffOnly: nav?.staffOnly, ...extra }
}

/**
 * The drawer, in the app's groups and order, with every web route the app also has. Labels: the app's word where the
 * page is the same page; the web's own label where the web page differs or was renamed for the web on 2026-10-31
 * (Geo Punch / On-Duty is one page here, two in the app; Outpass & Tea Break, My Department Head, Advances &
 * Settlement, About UKTextiles). Manager Approvals is not in the app's drawer: heads reach it from the tab bar.
 */
export const PHONE_DRAWER: PhoneNavGroup[] = [
  {
    heading: 'Home & Attendance',
    items: [
      item('/employee/dashboard', 'Home', House),
      item('/employee/attendance', 'Attendance', CalendarCheck, { color: '#059669' }),
      item('/employee/attendance-request', 'Geo Punch / On-Duty', MapPin, { color: '#0369A1' }),
      item('/employee/outpass', 'Outpass & Tea Break', DoorOpen, { color: '#009688' }),
      item('/employee/shift', 'My Shift', Clock, { color: '#E67E22' }),
      item('/employee/missing-punch', 'Missing Punch', Fingerprint, { color: '#5E35B1' }),
      item('/employee/holidays', 'Holidays', Flag, { color: '#C0392B' }),
    ],
  },
  {
    heading: 'HR Operations',
    items: [
      item('/employee/leave', 'Leave', Umbrella, { color: '#8E44AD' }),
      item('/employee/casual-leave', 'Casual Leave', CalendarHeart, { color: '#B7791F' }),
      item('/employee/permissions', 'Permissions', Hand, { color: '#2980B9' }),
      item('/employee/compensation', 'Compensation', BriefcaseBusiness, { color: '#047857' }),
      item('/employee/hod', 'My Department Head', ShieldUser, { color: '#6D28D9' }),
    ],
  },
  {
    heading: 'Payroll & Salary',
    items: [
      item('/employee/salary', 'Salary Slips', Banknote, { color: '#27AE60' }),
      item('/employee/settlement', 'Advances & Settlement', Landmark, { color: '#7F8C8D' }),
    ],
  },
  {
    heading: 'Records & Community',
    items: [
      item('/employee/id-card', 'Digital ID Card', IdCard, { color: '#2C3E50' }),
      item('/employee/documents', 'My Documents', Folder, { color: '#00897B' }),
      item('/employee/chat', 'Team Chat', MessageCircle, { color: '#0984E3' }),
    ],
  },
  {
    heading: 'Account & System',
    dividerBeforeLast: true,
    items: [
      item('/employee/notifications', 'Notifications', Bell, { color: '#D97706' }),
      item('/employee/profile', 'My Profile', CircleUserRound),
      item('/employee/company', 'About UKTextiles', Building2),
      item('/employee/help', 'Help & Support', LifeBuoy),
      item('/employee/resignation', 'Resignation', FileSignature, { danger: true }),
    ],
  },
]

export interface PhoneTab {
  href: string
  label: string
  icon: LucideIcon
  managerOnly?: boolean
}

/** The bottom tab bar: Home, Attendance, My Shift, Approvals (department heads only, with the waiting count), Profile. */
export const PHONE_TABS: PhoneTab[] = [
  { href: '/employee/dashboard', label: 'Home', icon: House },
  { href: '/employee/attendance', label: 'Attendance', icon: CalendarCheck },
  { href: '/employee/shift', label: 'My Shift', icon: Clock },
  { href: '/employee/approvals', label: 'Approvals', icon: ClipboardCheck, managerOnly: true },
  { href: '/employee/profile', label: 'Profile', icon: CircleUserRound },
]
