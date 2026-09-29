import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Redirect } from 'wouter'
import { ClipboardCheck } from 'lucide-react'
import { PageLoader } from '@/components/ui/loader'
import { PageHeader } from '@/components/layout/PageHeader'
import { Reveal } from '@/components/employee/Reveal'
import { ApprovalCard, formatDateRange } from '@/components/employee/ApprovalCard'
import { EmptyState } from '@/components/employee/EmptyState'
import { managerApi } from '@/api/resources'
import { useManagerStatus } from '@/hooks/useManagerStatus'
import { ApiError } from '@/api/client'
import { permissionDurationLabel, permissionOutcome, permissionTypeLabel } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import type {
  MissingPunchSlot,
  PendingAttendanceRequest,
  PendingCasualLeaveRequest,
  PendingLeaveRequest,
  PendingMissingPunchRequest,
  PendingOutpassRequest,
  PendingPermissionRequest,
  PendingResignation,
  PendingOnDutySession,
  RequestStatus,
} from '@/types'

// Mirrors src/pages/employee/MissingPunch.tsx — purely descriptive label for
// which of the day's 4 punches this is, never the source of truth for real
// P1-P4 identity (the attendance engine derives that from punch time).
const PUNCH_SLOT_LABEL: Record<MissingPunchSlot, string> = {
  morning_in: 'Morning Check-In',
  lunch_out: 'Lunch Check-Out',
  lunch_in: 'Lunch Check-In',
  evening_out: 'Evening Check-Out',
}

// The backend does NOT return a uniform shape across categories: leaveRequests
// and permissions get an extra nested `employee{}` object bolted on, while
// casualLeaves/attendanceRequests/resignations/onDutySessions carry employee
// fields flat on the item itself. Each category needs its own accessor — do
// not assume a shared shape or `.employee` will be undefined for 4 of these 6 tabs.
const CATEGORIES = [
  {
    key: 'leaveRequests' as const,
    label: 'Leave',
    flag: 'canApproveLeaves' as const,
    action: managerApi.updateLeaveStatus,
    describe: (item: PendingLeaveRequest) => ({
      name: item.employee.name,
      code: item.employee.employeeCode,
      department: item.employee.department,
      dateRange: item.isHalfDay
        ? `${formatDateRange(item.startDate)} · Half day${item.halfDaySlot ? ` (${item.halfDaySlot})` : ''}`
        : formatDateRange(item.startDate, item.endDate),
      reason: item.reason,
    }),
  },
  {
    key: 'permissions' as const,
    label: 'Permission',
    flag: 'canApprovePermissions' as const,
    action: managerApi.updatePermissionStatus,
    describe: (item: PendingPermissionRequest) => {
      const outcome = permissionOutcome(item)
      const duration = permissionDurationLabel(item.durationMinutes)
      return {
        name: item.employee.name,
        code: item.employee.employeeCode,
        department: item.employee.department,
        dateRange: `${formatDateRange(item.date)}${item.permissionTime ? ` · ${item.permissionTime}` : ''}`,
        reason: item.reason,
        // The type label, never the raw legacy string the API may still send in `type`.
        badge: `${permissionTypeLabel(item)}${duration ? ` · ${duration}` : ''}`,
        // A pending request's outcome is just "Pending", which the card already says.
        outcome: outcome.kind === 'pending' ? undefined : { label: outcome.label, className: outcome.chipClass },
        // capStatus is only sent by a backend that applies the monthly limit.
        note: item.capStatus
          ? `Only an employee's first ${item.monthlyLimit ?? 3} approved permissions each month are Allowed; any beyond that are Overdue / Excess and do not protect the day.`
          : undefined,
      }
    },
  },
  {
    key: 'attendanceRequests' as const,
    label: 'Attendance',
    flag: 'canApproveAttendance' as const,
    action: managerApi.updateAttendanceStatus,
    describe: (item: PendingAttendanceRequest) => ({
      name: item.employeeName,
      code: item.employeeCode,
      department: item.department,
      dateRange: formatDateRange(item.date),
      reason: item.reason,
    }),
  },
  {
    key: 'casualLeaves' as const,
    label: 'Casual Leave',
    flag: 'canApproveCasualLeave' as const,
    action: managerApi.updateCasualLeaveStatus,
    describe: (item: PendingCasualLeaveRequest) => ({
      name: item.employeeName,
      code: item.employeeCode,
      department: item.department,
      dateRange: formatDateRange(item.date),
      reason: item.reason,
    }),
  },
  {
    key: 'resignations' as const,
    label: 'Resignation',
    flag: 'canApproveResignations' as const,
    action: managerApi.updateResignationAction,
    describe: (item: PendingResignation) => ({
      name: item.employeeName,
      code: item.employeeCode,
      department: item.departmentName,
      dateRange: item.lastWorkingDate ? formatDateRange(item.lastWorkingDate) : '—',
      reason: item.reason,
    }),
  },
  {
    key: 'onDutySessions' as const,
    label: 'On-Duty',
    flag: 'canApproveOnDuty' as const,
    action: managerApi.updateOnDutyStatus,
    describe: (item: PendingOnDutySession) => ({
      name: item.employeeName,
      code: item.employeeCode,
      department: item.department,
      dateRange: item.createdAt ? formatDateRange(item.createdAt.slice(0, 10)) : '—',
      reason: `Destination: ${item.destination}${item.pendingPunchCount ? ` • ${item.pendingPunchCount} punch${item.pendingPunchCount === 1 ? '' : 'es'} captured` : ''}`,
      note: 'Approving forwards the session to HR for final sign-off; rejecting voids its punches.',
    }),
  },
  {
    key: 'outpassRequests' as const,
    label: 'Outpass',
    flag: 'canApprovePermissions' as const,
    action: managerApi.updateOutpassStatus,
    describe: (item: PendingOutpassRequest) => ({
      name: item.employee.name,
      code: item.employee.employeeCode,
      department: item.employee.department,
      dateRange: formatDateRange(item.createdAt),
      reason: `${item.destination} · ${item.reason}`,
    }),
  },
  {
    key: 'missingPunchRequests' as const,
    label: 'Missing Punch',
    flag: 'canApproveMissingPunch' as const,
    action: managerApi.updateMissingPunchStatus,
    describe: (item: PendingMissingPunchRequest) => ({
      name: item.employeeName,
      code: item.employeeCode,
      department: item.department,
      dateRange: `${formatDateRange(item.date)} · ${item.punchTime}`,
      reason: `${item.punchSlot ? PUNCH_SLOT_LABEL[item.punchSlot] : (item.punchType === 'IN' ? 'Check-In' : 'Check-Out')} — ${item.reason}`,
      note: 'Approving forwards this to HR for final sign-off.',
    }),
  },
] as const

export default function Approvals() {
  const { isManager, flags, isLoading: managerLoading } = useManagerStatus()
  const qc = useQueryClient()
  const [active, setActive] = React.useState<(typeof CATEGORIES)[number]['key']>(CATEGORIES[0].key)
  const [busyId, setBusyId] = React.useState<string | null>(null)

  const query = useQuery({
    queryKey: ['manager-pending-requests'],
    queryFn: managerApi.pendingRequests,
    enabled: isManager,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  })

  const mutation = useMutation({
    mutationFn: async ({ action, id, status, comment }: { action: (id: string, status: RequestStatus, comment?: string) => Promise<unknown>; id: string; status: RequestStatus; comment?: string }) =>
      action(id, status, comment),
    onMutate: ({ id }) => setBusyId(id),
    onSuccess: (_d, { status }) => {
      toast.success(status === 'approved' ? 'Request approved' : 'Request rejected')
      qc.invalidateQueries({ queryKey: ['manager-pending-requests'] })
      qc.invalidateQueries({ queryKey: ['manager-me'] })
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update the request'),
    onSettled: () => setBusyId(null),
  })

  if (!managerLoading && !isManager) {
    return <Redirect to="/employee/dashboard" />
  }

  if (managerLoading || query.isLoading) {
    return <PageLoader label="Loading pending approvals" />
  }

  const data = query.data
  const count = (key: (typeof CATEGORIES)[number]['key']) => ((data?.[key] ?? []) as unknown[]).length
  const cat = CATEGORIES.find((c) => c.key === active) ?? CATEGORIES[0]
  const items = (data?.[cat.key] ?? []) as unknown[]
  const disabled = flags ? (flags as unknown as Record<string, boolean | undefined>)[cat.flag] === false : false

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="HR & Workflows • Department head"
        title="Manager Approvals Center"
        subtitle="Review and action pending requests from your team. Updates every 30 seconds."
        icon={<ClipboardCheck />}
        actions={
          data && (
            <div className="glass flex items-center gap-3 rounded-md px-4 py-2">
              <span className="metric text-[30px] leading-none text-brand-gold">{data.totalPending}</span>
              <span className="label-caps text-muted-foreground">
                Pending
                <br />
                actions
              </span>
            </div>
          )
        }
      />

      {query.isError && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Couldn't load pending requests. {query.error instanceof ApiError ? query.error.message : 'Please refresh.'}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Category rail */}
        <nav aria-label="Request categories" className="glass flex gap-1 overflow-x-auto rounded-lg p-2 lg:flex-col lg:self-start">
          {CATEGORIES.map((c) => {
            const n = count(c.key)
            const selected = c.key === active
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setActive(c.key)}
                aria-current={selected ? 'true' : undefined}
                className={cn(
                  'flex shrink-0 items-center gap-3 rounded-md px-3 py-2.5 text-left text-[14px] font-medium transition-colors lg:w-full',
                  selected ? 'bg-brand-gradient text-white' : 'text-foreground/80 hover:bg-foreground/[0.05]',
                )}
              >
                <span className="flex-1 whitespace-nowrap">{c.label}</span>
                <span
                  className={cn(
                    'grid min-w-6 place-items-center rounded-full px-1.5 text-[11px] font-bold',
                    n > 0 ? (selected ? 'bg-white/25 text-white' : 'bg-amber-500 text-[#2a1700]') : 'text-muted-foreground',
                  )}
                >
                  {n}
                </span>
              </button>
            )
          })}
        </nav>

        <section className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[22px] font-semibold">{cat.label} requests</h2>
            {disabled && <span className="chip chip-muted">Approval not enabled for your account</span>}
          </div>
          {items.length === 0 ? (
            <EmptyState icon={ClipboardCheck} title={`No pending ${cat.label.toLowerCase()} requests`} />
          ) : (
            items.map((item, i) => {
              // TypeScript can't narrow `item` per-category through a mapped
              // array of differently-shaped describe functions; each
              // category's own `describe` is typed at its definition above.
              const info = (cat.describe as (i: unknown) => {
                name: string; code: string; department?: string | null; dateRange: string; reason: string; note?: string
                badge?: string; outcome?: { label: string; className: string }
              })(item)
              const id = String((item as { id: string | number }).id)
              return (
                <Reveal key={id} index={i}>
                  <ApprovalCard
                    type={cat.label}
                    employeeName={info.name}
                    employeeCode={info.code}
                    department={info.department ?? undefined}
                    dateRange={info.dateRange}
                    reason={info.reason}
                    note={info.note}
                    badge={info.badge}
                    outcome={info.outcome}
                    disabled={disabled}
                    isSubmitting={busyId === id}
                    onApprove={() => mutation.mutate({ action: cat.action, id, status: 'approved' })}
                    onReject={(comment) => mutation.mutate({ action: cat.action, id, status: 'rejected', comment })}
                  />
                </Reveal>
              )
            })
          )}
        </section>
      </div>
    </div>
  )
}
