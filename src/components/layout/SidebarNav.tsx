import { Link, useLocation } from 'wouter'
import { BadgeCheck, LogOut, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { navGroups } from './nav-config'
import { useAuth } from '@/context/AuthContext'
import { useManagerStatus } from '@/hooks/useManagerStatus'
import { useTheme } from '@/context/ThemeContext'
import { Switch } from '@/components/ui/switch'

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation()
  const { logout } = useAuth()
  const { isManager, flags } = useManagerStatus()
  const { isDark, mode, setMode, toggle } = useTheme()
  const pendingApprovals = flags?.pendingApprovalsCount ?? 0

  return (
    <div className="flex h-full flex-col">
      {/* Wordmark */}
      <Link href="/employee/dashboard" onClick={onNavigate} className="flex items-center gap-3 px-5 pt-6 pb-5">
        <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-md bg-white p-1">
          <img src="/UKT_Company_Logo.png" alt="" className="h-full w-full object-contain" />
        </span>
        <span className="leading-tight">
          <span className="font-display block text-[17px] font-semibold tracking-wide uppercase">UKTextiles</span>
          <span className="label-caps block text-brand-blue">Employee Portal</span>
        </span>
      </Link>

      <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-4" aria-label="Main">
        {navGroups.map((group) => {
          const items = group.items.filter((item) => !item.managerOnly || isManager)
          if (items.length === 0) return null
          return (
            <div key={group.heading} className="mb-4">
              <p className="label-caps px-3 pb-2 pt-2 text-muted-foreground/80">{group.heading}</p>
              <div className="flex flex-col gap-0.5">
                {items.map((item) => {
                  const active = location === item.href || location.startsWith(item.href + '/')
                  const Icon = item.icon
                  const showCount = item.href === '/employee/approvals' && pendingApprovals > 0
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group flex items-center gap-3 rounded-md px-3 py-2 text-[14px] font-medium transition-colors',
                        active
                          ? 'bg-brand-gradient text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_6px_18px_-6px_rgb(37_99_235/0.6)]'
                          : 'text-foreground/75 hover:bg-foreground/[0.05] hover:text-foreground',
                      )}
                    >
                      <Icon className={cn('size-[18px] shrink-0', !active && 'text-muted-foreground group-hover:text-brand-blue')} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {showCount && (
                        <span className="grid min-w-5 place-items-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-[#2a1700]">
                          {pendingApprovals > 99 ? '99+' : pendingApprovals}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      <div className="space-y-2 border-t hairline px-3 pt-3 pb-4">
        {/* Appearance. The switch is the fast path; "Auto" restores following the OS. */}
        <div className="flex items-center gap-2.5 rounded-md bg-foreground/[0.04] px-3 py-2">
          {isDark ? <Moon className="size-4 text-brand-blue" /> : <Sun className="size-4 text-brand-gold" />}
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold leading-tight">Dark mode</span>
            <span className="block text-[11px] text-muted-foreground">
              {mode === 'system' ? 'Following system' : isDark ? 'On' : 'Off'}
            </span>
          </span>
          {mode !== 'system' && (
            <button
              type="button"
              onClick={() => setMode('system')}
              className="rounded-full border border-foreground/15 px-2 py-0.5 text-[10px] font-bold text-muted-foreground hover:text-foreground"
            >
              Auto
            </button>
          )}
          <Switch checked={isDark} onCheckedChange={toggle} aria-label="Dark mode" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/employee/id-card"
            onClick={onNavigate}
            className="font-label flex items-center justify-center gap-1.5 rounded-md border hairline bg-foreground/[0.03] py-2 text-[13px] font-semibold text-foreground/85 hover:border-primary/50 hover:text-foreground"
          >
            <BadgeCheck className="size-4" /> Digital ID
          </Link>
          <button
            onClick={() => {
              logout()
              onNavigate?.()
            }}
            className="font-label flex items-center justify-center gap-1.5 rounded-md border border-destructive/25 bg-destructive/5 py-2 text-[13px] font-semibold text-destructive hover:bg-destructive/15"
          >
            <LogOut className="size-4" /> Logout
          </button>
        </div>
      </div>
    </div>
  )
}
