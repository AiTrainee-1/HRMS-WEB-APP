import { useQuery, type QueryClient } from '@tanstack/react-query'
import { approvalApi } from '@/api/resources'
import { useAuth } from '@/context/AuthContext'
import { isWorkflowDisabled, parseApprovalSummary, workflowOffNote } from '@/lib/approval'
import type { ApprovalWorkflowKey } from '@/types'

export const APPROVAL_SUMMARY_QUERY_KEY = ['approval-summary'] as const

async function fetchApprovalSummary() {
  const summary = parseApprovalSummary(await approvalApi.summary())
  // Not the contract (e.g. an HTML error page from a proxy): throw, so the screen carries on without the hint.
  if (!summary) throw new Error('Unexpected response from /approval-summary')
  return summary
}

/**
 * The approval pipelines HR configured (Approval Workflow Control), used to explain a request's path and to warn that a
 * request type is switched off. Purely advisory: `data` is undefined when nothing is known (an older backend, a failed
 * call) and every screen then behaves as it did before pipelines; the server stays the authority on what is allowed.
 */
export function useApprovalSummary() {
  const { user } = useAuth()
  return useQuery({
    queryKey: APPROVAL_SUMMARY_QUERY_KEY,
    queryFn: fetchApprovalSummary,
    enabled: !!user,
    staleTime: 60_000,
    // A page left open catches up when the person comes back to it, not only on the next navigation.
    refetchOnWindowFocus: true,
    // A failure is not worth hammering: the next mount / window focus asks again.
    retry: false,
  })
}

/** One workflow's pipeline and, when HR has switched it off, the note to show instead of the way to raise a request. */
export function useApprovalWorkflow(key: ApprovalWorkflowKey) {
  const { data } = useApprovalSummary()
  const workflow = data?.[key] ?? null
  return { workflow, offNote: workflowOffNote(workflow) }
}

/** After the server refuses a new request because its workflow is switched off, re-read the summary (it can be up to a
 * minute old) so the screen stops offering it. The caller still shows the server's own message. */
export function refreshIfWorkflowOff(qc: QueryClient, err: unknown) {
  if (isWorkflowDisabled(err)) qc.invalidateQueries({ queryKey: APPROVAL_SUMMARY_QUERY_KEY })
}
