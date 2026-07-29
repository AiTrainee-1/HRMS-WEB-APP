import { Link, useLocation } from 'wouter'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { navGroups } from './nav-config'
import { useAuth } from '@/context/AuthContext'
import { useManagerStatus } from '@/hooks/useManagerStatus'

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation()
  const { logout } = useAuth()
  const { isManager } = useManagerStatus()

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-4">
        <img
          src="/UKT_Company_Logo.png"
          alt="UK Textiles"
          className="h-9 w-auto object-contain"
        />
        <span className="text-gradient-brand font-bold text-base">UKTextiles</span>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {navGroups.map((group, gi) => (
          <div key={gi} className="mb-3">
            <p className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {group.heading}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items
                .filter((item) => !item.managerOnly || isManager)
                .map((item) => {
                  const active = location === item.href || location.startsWith(item.href + '/')
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all',
                        active
                          ? 'bg-brand-gradient text-white shadow-clay'
                          : 'text-foreground/80 hover:bg-accent hover:text-accent-foreground',
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      {item.label}
                    </Link>
                  )
                })}
            </div>
          </div>
        ))}
      </nav>
      <div className="px-3 pb-4">
        <button
          onClick={() => {
            logout()
            onNavigate?.()
          }}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
        >
          <LogOut className="size-4" />
          Logout
        </button>
      </div>
    </div>
  )
}
