// lib/approvals-items.ts plus the permission wording of lib/permissions.ts (the legacy type spellings, the fixed hour,
// Allowed / Overdue / Excess). Kept out of the pure lib because lib/permissions.ts imports the app's '@/types' alias,
// which Node's test runner cannot resolve.
import { itemBadge, itemTypeLabel, type BadgeTone } from '@/lib/approvals-items'
import { permissionDurationLabel, permissionOutcome, permissionTypeLabel, type PermissionOutcomeKind } from '@/lib/permissions'
import type { ApprovalCategory, ApprovalItem, ApprovalStatus } from '@/lib/approvals-history'
import type { PermissionCapStatus, PermissionTypeKey, RequestStatus } from '@/types'

const s = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** What the request is ("Morning Late-In · 1 hour", "Leave · Emergency", "Casual Leave · Half day (first half)"). */
export function typeLabel(category: ApprovalCategory, item: ApprovalItem): string {
  if (category !== 'permission') return itemTypeLabel(category, item)
  const label = permissionTypeLabel({
    type: s(item.type) || s(item.permissionType) || null,
    typeKey: (s(item.typeKey) || null) as PermissionTypeKey | null,
    typeLabel: s(item.typeLabel) || null,
  })
  const duration = permissionDurationLabel(typeof item.durationMinutes === 'number' ? item.durationMinutes : null)
  return duration ? `${label} · ${duration}` : label
}

const OUTCOME_TONE: Record<PermissionOutcomeKind, BadgeTone> = {
  pending: 'waiting',
  allowed: 'approved',
  approved: 'approved',
  excess: 'waiting',
  not_allowed: 'rejected',
}

/** The status pill: "With HR" for one a head approved that waits for HR; a decided permission's own outcome. */
export function badgeFor(category: ApprovalCategory, status: ApprovalStatus, item: ApprovalItem): { label: string; tone: BadgeTone } {
  const base = itemBadge(category, status, item)
  if (category !== 'permission' || status === 'pending' || base.label === 'With HR') return base
  const o = permissionOutcome({
    status: (s(item.status) || status) as RequestStatus,
    capStatus: (s(item.capStatus) || undefined) as PermissionCapStatus | undefined,
    statusLabel: s(item.statusLabel) || undefined,
  })
  return { label: o.label, tone: OUTCOME_TONE[o.kind] }
}
