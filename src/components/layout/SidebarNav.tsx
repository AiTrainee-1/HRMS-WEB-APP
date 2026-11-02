import * as React from 'react'
import { Link, useLocation } from 'wouter'
import { motion } from 'framer-motion'
import { BadgeCheck, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isActiveHref, navGroups } from './nav-config'
import { useAuth } from '@/context/AuthContext'
import { useManagerStatus } from '@/hooks/useManagerStatus'
import { useEmploymentType } from '@/hooks/useEmploymentType'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { SPRING } from '@/components/kit/motion'

const SILK_V = { backgroundImage: 'linear-gradient(180deg, var(--silk-1), var(--silk-2) 55%, var(--silk-3))' }

/** A tooltip with the label, only while the rail is collapsed (the label is hidden then). */
function RailTip({ show, label, children }: { show: boolean; label: string; children: React.ReactElement }) {
  if (!show) return children
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

/**
 * The app's navigation: wordmark, grouped links with an active indicator that glides between items (shared layout: a
 * soft sapphire pill with a silk thread on its left edge), and Digital ID / Sign out at the foot. Used twice: the
 * desktop sidebar (collapsible to an icon rail) and the phone drawer — each instance has its own indicator.
 */
export function SidebarNav({
  onNavigate,
  collapsed = false,
  onToggleCollapsed,
}: {
  onNavigate?: () => void
  /** Icon rail (desktop only). */
  collapsed?: boolean
  /** Shows the collapse button (desktop only). */
  onToggleCollapsed?: () => void
}) {
  const [location] = useLocation()
  const { logout } = useAuth()
  const { isManager, flags } = useManagerStatus()
  const { isStaff } = useEmploymentType()
  const pendingApprovals = flags?.pendingApprovalsCount ?? 0
  const instance = React.useId()

  return (
    <div className="flex h-full flex-col">
      {/* Wordmark */}
      <div className={cn('flex items-center gap-2 pt-5 pb-4', collapsed ? 'flex-col px-2' : 'px-4')}>
        <Link
          href="/employee/dashboard"
          onClick={onNavigate}
          className="focus-ring flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1"
          aria-label="UKTextiles Employee Portal — go to Dashboard"
        >
          <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-white p-1 shadow-clay-sm">
            <img src="/UKT_Company_Logo.png" alt="" className="h-full w-full object-contain" />
          </span>
          {!collapsed && (
            <span className="min-w-0 leading-tight">
              <span className="font-display block truncate text-[17px] font-semibold tracking-wide uppercase">UKTextiles</span>
              <span className="label-caps block text-brand-blue">Employee Portal</span>
            </span>
          )}
        </Link>
        {onToggleCollapsed && !collapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            className="focus-ring grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
          >
            <PanelLeftClose className="size-[18px]" />
          </button>
        )}
      </div>

      <nav className={cn('scrollbar-thin flex-1 overflow-y-auto pb-4', collapsed ? 'px-2' : 'px-3')} aria-label="Main">
        {navGroups.map((group, gi) => {
          const items = group.items.filter((item) => (!item.managerOnly || isManager) && (!item.staffOnly || isStaff))
          if (items.length === 0) return null
          return (
            <div key={group.heading} className={cn(collapsed ? 'mb-2' : 'mb-4')}>
              {collapsed ? (
                gi > 0 && <div className="mx-3 mb-2 h-px bg-foreground/10" role="presentation" />
              ) : (
                <p className="label-caps flex items-center gap-2 px-3 pt-2 pb-2 text-muted-foreground">
                  {group.heading}
                  <span className="h-px flex-1 bg-linear-to-r from-foreground/10 to-transparent" aria-hidden="true" />
                </p>
              )}
              <ul className="flex flex-col gap-0.5">
                {items.map((item) => {
                  const active = isActiveHref(location, item.href)
                  const Icon = item.icon
                  const showCount = item.href === '/employee/approvals' && pendingApprovals > 0
                  const countText = pendingApprovals > 99 ? '99+' : String(pendingApprovals)
                  return (
                    <li key={item.href}>
                      <RailTip show={collapsed} label={showCount ? `${item.label} (${countText} waiting)` : item.label}>
                        <Link
                          href={item.href}
                          onClick={onNavigate}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'group focus-ring relative flex min-h-11 items-center rounded-lg text-[14px] font-medium transition-colors duration-200',
                            collapsed ? 'justify-center px-0' : 'gap-3 px-3 lg:min-h-10',
                            active ? 'text-foreground' : 'text-foreground/75 hover:bg-foreground/[0.05] hover:text-foreground',
                          )}
                        >
                          {active && (
                            <motion.span
                              layoutId={`nav-active-${instance}`}
                              transition={SPRING}
                              aria-hidden="true"
                              className="absolute inset-0 rounded-lg bg-primary/12 ring-1 ring-primary/25 dark:bg-primary/20"
                            >
                              <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-full" style={SILK_V} />
                            </motion.span>
                          )}
                          <Icon
                            className={cn(
                              'relative size-[18px] shrink-0 transition-transform duration-200 group-hover:scale-110',
                              active ? 'text-brand-blue' : 'text-muted-foreground group-hover:text-brand-blue',
                            )}
                            aria-hidden="true"
                          />
                          {/* The link's name always comes from its contents (no aria-label), so the badge's
                              "N waiting" stays part of it on the collapsed rail too. */}
                          {collapsed ? (
                            <span className="sr-only">{item.label}</span>
                          ) : (
                            <span className="relative flex-1 truncate">{item.label}</span>
                          )}
                          {showCount && (
                            <span
                              className={cn(
                                'relative grid min-w-5 place-items-center rounded-full bg-amber-400 px-1.5 text-[11px] leading-5 font-bold text-[#2a1700]',
                                collapsed && 'absolute -top-0.5 right-0.5 min-w-4 px-1 text-[10px] leading-4',
                              )}
                            >
                              {countText}
                              <span className="sr-only"> waiting</span>
                            </span>
                          )}
                        </Link>
                      </RailTip>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      <div className={cn('border-t hairline pt-3 pb-4', collapsed ? 'flex flex-col items-center gap-2 px-2' : 'grid grid-cols-2 gap-2 px-3')}>
        {collapsed && onToggleCollapsed && (
          <RailTip show label="Expand sidebar">
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label="Expand sidebar"
              className="focus-ring grid size-11 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
            >
              <PanelLeftOpen className="size-[18px]" />
            </button>
          </RailTip>
        )}
        <RailTip show={collapsed} label="Digital ID">
          <Link
            href="/employee/id-card"
            onClick={onNavigate}
            aria-label={collapsed ? 'Digital ID' : undefined}
            className={cn(
              'font-label focus-ring flex min-h-11 items-center justify-center gap-1.5 rounded-lg border hairline bg-foreground/[0.03] text-[13px] font-semibold text-foreground/85 transition-colors hover:border-primary/50 hover:text-foreground lg:min-h-10',
              collapsed && 'size-11 lg:min-h-11',
            )}
          >
            <BadgeCheck className="size-4" aria-hidden="true" /> {!collapsed && 'Digital ID'}
          </Link>
        </RailTip>
        <RailTip show={collapsed} label="Sign out">
          <button
            type="button"
            onClick={() => {
              logout()
              onNavigate?.()
            }}
            aria-label={collapsed ? 'Sign out' : undefined}
            className={cn(
              'font-label focus-ring flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-rejected-border bg-rejected-bg/60 text-[13px] font-semibold text-rejected transition-colors hover:bg-rejected-bg lg:min-h-10',
              collapsed && 'size-11 lg:min-h-11',
            )}
          >
            <LogOut className="size-4" aria-hidden="true" /> {!collapsed && 'Sign out'}
          </button>
        </RailTip>
      </div>
    </div>
  )
}
