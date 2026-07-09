import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Redirect } from 'wouter'
import { ClipboardCheck } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { Reveal } from '@/components/employee/Reveal'
import { ApprovalCard, formatDateRange } from '@/components/employee/ApprovalCard'
import { EmptyState } from '@/components/employee/EmptyState'
import { managerApi } from '@/api/resources'
import { useManagerStatus } from '@/hooks/useManagerStatus'
import { ApiError } from '@/api/client'
import type {
  PendingAttendanceRequest,
  PendingCasualLeaveRequest,
  PendingLeaveRequest,
  PendingPermissionRequest,
  PendingResignation,
  PendingShiftApproval,
  RequestStatus,
} from '@/types'

// The backend does NOT return a uniform shape across categories: leaveRequests
// and permissions get an extra nested `employee{}` object bolted on, while
// casualLeaves/attendanceRequests/resignations/shiftApprovals carry employee
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
      dateRange: formatDateRange(item.startDate, item.endDate),
      reason: item.reason,
    }),
  },
  {
    key: 'permissions' as const,
    label: 'Permission',
    flag: 'canApprovePermissions' as const,
    action: managerApi.updatePermissionStatus,
    describe: (item: PendingPermissionRequest) => ({
      name: item.employee.name,
      code: item.employee.employeeCode,
      department: item.employee.department,
      dateRange: formatDateRange(item.date),
      reason: item.reason,
    }),
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
    key: 'shiftApprovals' as const,
    label: 'Shift',
    flag: 'canApproveShifts' as const,
    action: managerApi.updateShiftStatus,
    describe: (item: PendingShiftApproval) => ({
      name: item.employeeName,
      code: item.employeeCode,
      department: item.department,
      dateRange: item.effectiveFrom ? formatDateRange(item.effectiveFrom) : '—',
      reason: item.shiftName ? `New shift: ${item.shiftName}` : 'Shift reassignment request',
    }),
  },
] as const

export default function Approvals() {
  const { isManager, flags, isLoading: managerLoading } = useManagerStatus()
  const qc = useQueryClient()

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manager-pending-requests'] })
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update the request'),
  })

  if (!managerLoading && !isManager) {
    return <Redirect to="/employee/dashboard" />
  }

  if (managerLoading || query.isLoading) {
    return <Skeleton className="h-96 w-full" />
  }

  const data = query.data

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Approvals"
        subtitle="Review pending requests from your team"
        icon={<ClipboardCheck />}
        actions={data && <Badge className="bg-white/20 text-white border-white/30">{data.totalPending} pending</Badge>}
      />

      <Tabs defaultValue={CATEGORIES[0].key}>
        <TabsList className="flex-wrap h-auto">
          {CATEGORIES.map((cat) => {
            const items = (data?.[cat.key] ?? []) as unknown[]
            return (
              <TabsTrigger key={cat.key} value={cat.key}>
                {cat.label} {items.length > 0 && <span className="ml-1 opacity-70">({items.length})</span>}
              </TabsTrigger>
            )
          })}
        </TabsList>

        {CATEGORIES.map((cat) => {
          const items = (data?.[cat.key] ?? []) as unknown[]
          const disabled = flags ? flags[cat.flag] === false : false
          return (
            <TabsContent key={cat.key} value={cat.key} className="mt-4 flex flex-col gap-3">
              {items.length === 0 ? (
                <EmptyState icon={ClipboardCheck} title={`No pending ${cat.label.toLowerCase()} requests`} />
              ) : (
                items.map((item, i) => {
                  // TypeScript can't narrow `item` per-category through a
                  // mapped array of differently-shaped describe functions —
                  // each category's own `describe` is still correctly typed
                  // at its definition above, this cast just satisfies the loop.
                  const info = (cat.describe as (i: unknown) => ReturnType<(typeof cat)['describe']>)(item)
                  const id = (item as { id: string }).id
                  return (
                    <Reveal key={id} index={i}>
                      <ApprovalCard
                        type={cat.label}
                        employeeName={info.name}
                        employeeCode={info.code}
                        department={info.department ?? undefined}
                        dateRange={info.dateRange}
                        reason={info.reason}
                        disabled={disabled}
                        isSubmitting={mutation.isPending}
                        onApprove={() => mutation.mutate({ action: cat.action, id, status: 'approved' })}
                        onReject={(comment) => mutation.mutate({ action: cat.action, id, status: 'rejected', comment })}
                      />
                    </Reveal>
                  )
                })
              )}
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}
