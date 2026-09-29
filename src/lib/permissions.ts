import type { PermissionCapStatus, PermissionRequest, PermissionTypeKey, PermissionWireType } from '@/types'

// The one place permission labels, wire values and outcomes are decided. The
// backend now sends typeKey / typeLabel / capStatus / statusLabel, but an
// older backend (and rows saved before the rewrite) sends only the legacy
// `type` + `status`, so every helper here falls back to those. Raw legacy
// strings ("Late In", "Short Leave") are never shown to a person.

export interface PermissionTypeOption {
  key: PermissionTypeKey
  label: string
  /** What POST /permissions receives. Deliberately the legacy spelling: an old
   * backend rejects the new labels, the new backend accepts both. */
  wire: PermissionWireType
  hint: string
  /** What the requested `permissionTime` means for this type. */
  timeLabel: string
  /** What an Allowed (within the monthly limit) permission does to that day. */
  effect: string
}

export const PERMISSION_TYPES: readonly PermissionTypeOption[] = [
  {
    key: 'morning_late_in',
    label: 'Morning Late-In',
    wire: 'Late In',
    hint: 'Arriving up to 1 hour after shift start',
    timeLabel: 'Arrival time',
    effect: 'Your shift start moves 60 minutes later that day.',
  },
  {
    key: 'evening_early_out',
    label: 'Evening Early-Out',
    wire: 'Early Out',
    hint: 'Leaving up to 1 hour before shift end',
    timeLabel: 'Leaving time',
    effect: 'Your shift end moves 60 minutes earlier that day.',
  },
  {
    key: 'middle_permission',
    label: 'Middle One-Hour Permission',
    wire: 'Short Leave',
    hint: 'Stepping out for 1 hour during the shift',
    timeLabel: 'Step-out time',
    effect: 'An excused one-hour gap. It does not move your shift.',
  },
]

// Every spelling the backend normalizes onto a type (models/leave.py::_TYPE_ALIASES),
// keyed by the lower-cased, underscore-joined form.
const TYPE_ALIASES: Record<string, PermissionTypeKey> = {
  morning_late_in: 'morning_late_in',
  late_in: 'morning_late_in',
  evening_early_out: 'evening_early_out',
  early_out: 'evening_early_out',
  middle_permission: 'middle_permission',
  middle_one_hour_permission: 'middle_permission',
  middle_one_hour: 'middle_permission',
  short_leave: 'middle_permission',
}

function normalizeType(raw: string | null | undefined): PermissionTypeKey | null {
  if (!raw) return null
  return TYPE_ALIASES[raw.trim().toLowerCase().replace(/-/g, ' ').split(/\s+/).join('_')] ?? null
}

type TypedRequest = Pick<PermissionRequest, 'type' | 'typeKey' | 'typeLabel'>

/** Canonical type of a request, or null for an untyped (pre-rewrite) row. */
export function permissionTypeKey(p: TypedRequest): PermissionTypeKey | null {
  return normalizeType(p.typeKey) ?? normalizeType(p.type)
}

export function permissionTypeOption(key: PermissionTypeKey | null): PermissionTypeOption | undefined {
  return PERMISSION_TYPES.find((t) => t.key === key)
}

/** "Morning Late-In" / "Evening Early-Out" / "Middle One-Hour Permission". */
export function permissionTypeLabel(p: TypedRequest): string {
  return p.typeLabel?.trim() || permissionTypeOption(permissionTypeKey(p))?.label || 'Permission'
}

/** "1 hour" for the fixed 60 minutes, "45 min" for an older variable-duration row, '' when unknown. */
export function permissionDurationLabel(minutes: number | null | undefined): string {
  if (!minutes) return ''
  return minutes === 60 ? '1 hour' : `${minutes} min`
}

export type PermissionOutcomeKind = 'pending' | 'allowed' | 'approved' | 'excess' | 'not_allowed'

export interface PermissionOutcome {
  kind: PermissionOutcomeKind
  label: string
  /** Existing chip tone classes (index.css). Excess gets its own orange tone. */
  chipClass: string
}

const OUTCOME_LABEL: Record<PermissionOutcomeKind, string> = {
  pending: 'Pending',
  allowed: 'Allowed',
  // Approved by an older backend that does not say whether it is within the
  // monthly limit. Not "Allowed": we can't claim it protects the day.
  approved: 'Approved',
  excess: 'Overdue / Excess',
  not_allowed: 'Not Allowed',
}

const OUTCOME_CHIP: Record<PermissionOutcomeKind, string> = {
  pending: 'chip-warning',
  allowed: 'chip-success',
  approved: 'chip-success',
  excess: 'chip-excess',
  not_allowed: 'chip-danger',
}

export function permissionOutcome(
  p: Pick<PermissionRequest, 'status'> & { capStatus?: PermissionCapStatus; statusLabel?: string },
): PermissionOutcome {
  let kind: PermissionOutcomeKind
  if (p.status === 'pending') kind = 'pending'
  else if (p.status === 'rejected') kind = 'not_allowed'
  else if (p.capStatus === 'excess') kind = 'excess'
  else if (p.capStatus === 'within_cap') kind = 'allowed'
  else kind = 'approved'
  return { kind, label: p.statusLabel?.trim() || OUTCOME_LABEL[kind], chipClass: OUTCOME_CHIP[kind] }
}
