// What a gate pass card says (pure; tested in gate-pass.test.ts). One reading for the Outpass page and the On-Duty page
// (owner 2026-11-24: "a standard, static, professional Gatepass card", the same card in both places). Mirrors the mobile
// app's src/lib/gatePass.ts.
//
// The server decides everything that matters (backend outpass_request_views._outpass_request_json): `qrToken` is there only
// while the pass may be shown at the gate, `returnQrToken` only while the way back in is open. A pass is shown as soon as it
// is asked for (an On-Duty's pass the moment the On-Duty is submitted) but its QR ONLY after HR / the HOD approved it
// (owner 2026-11-24): a pending pass never shows a QR, even if an older server sent one.
import type { Employee } from '../types/index.ts'
import { passTypeLabel } from './outpass-open.ts'

export interface GatePassLike {
  id: number | string
  status: 'pending' | 'approved' | 'rejected' | string
  source?: 'manual' | 'on_duty' | string | null
  passType?: string | null
  qrToken?: string | null
  returnQrToken?: string | null
  exitedAt?: string | null
  enteredAt?: string | null
  expiresAt?: string | null
  scanStatus?: string | null
  onDutyStatus?: string | null
  approvedBy?: string | null
  approvedAt?: string | null
}

export type GatePassState = 'valid' | 'waiting' | 'out' | 'return-ready' | 'returned' | 'expired' | 'rejected'

export type GatePassTone = 'green' | 'amber' | 'blue' | 'red' | 'grey'

export interface GatePassView {
  state: GatePassState
  /** The status line on the card ("Valid at the gate"). */
  title: string
  /** One sentence under it. */
  note: string
  tone: GatePassTone
  qr: { value: string; caption: string; kind: 'exit' | 'return' } | null
  /** Pending approval: no QR; the pending design (ringing bell + Refresh). */
  awaitingApproval: boolean
  /** Can be used / is in use today. */
  live: boolean
}

export function isOnDutyPass(pass: Pick<GatePassLike, 'source'>): boolean {
  return pass.source === 'on_duty'
}

const statusOf = (pass: GatePassLike) => String(pass.status ?? '').toLowerCase()

export function gatePassView(pass: GatePassLike): GatePassView {
  const onDuty = isOnDutyPass(pass)
  const status = statusOf(pass)
  const awaitingApproval = status === 'pending'

  if (status === 'rejected') {
    return {
      state: 'rejected',
      title: onDuty ? 'On-Duty not approved' : 'Not approved',
      note: onDuty ? 'The On-Duty request was rejected, so this pass cannot be used.' : 'This gate pass was not approved.',
      tone: 'red',
      qr: null,
      awaitingApproval: false,
      live: false,
    }
  }
  if (awaitingApproval) {
    // Checked before the gate legs: a pending pass is never valid at the gate, whatever else the server sent.
    return {
      state: 'waiting',
      title: 'Pending approval',
      note: onDuty
        ? 'Your On-Duty is waiting for HR / your Department Head. The QR appears here as soon as it is approved.'
        : 'Waiting for HR / your Department Head. The QR appears here as soon as the pass is approved.',
      tone: 'amber',
      qr: null,
      awaitingApproval: true,
      live: true,
    }
  }
  if (pass.enteredAt) {
    return { state: 'returned', title: 'Back in', note: 'You went out and came back. This pass is complete.', tone: 'grey', qr: null, awaitingApproval: false, live: false }
  }
  if (pass.returnQrToken) {
    return {
      state: 'return-ready',
      title: 'Ready to come back in',
      note: 'Show this QR at the gate when you return.',
      tone: 'blue',
      qr: { value: pass.returnQrToken, caption: 'SHOW THIS QR TO COME BACK IN', kind: 'return' },
      awaitingApproval: false,
      live: true,
    }
  }
  if (pass.exitedAt) {
    return {
      state: 'out',
      title: 'Out of the gate',
      note: 'When you come back, make a return QR and show it at the gate.',
      tone: 'blue',
      qr: null,
      awaitingApproval: false,
      live: true,
    }
  }
  if (pass.qrToken && status === 'approved') {
    return {
      state: 'valid',
      title: 'Valid at the gate',
      note: onDuty ? 'Approved with your On-Duty. Show the QR at the gate.' : 'Approved. Show the QR at the gate.',
      tone: 'green',
      qr: { value: pass.qrToken, caption: 'SHOW THIS QR AT THE GATE', kind: 'exit' },
      awaitingApproval: false,
      live: true,
    }
  }
  return {
    state: 'expired',
    title: 'Not valid now',
    note: onDuty
      ? 'The On-Duty has ended, so this pass can no longer be used at the gate.'
      : 'This pass was not used in time. Ask for a new one if you still need to go out.',
    tone: 'grey',
    qr: null,
    awaitingApproval: false,
    live: false,
  }
}

/** A file name for the downloaded card image: "gate-pass-OUT-123.png". */
export function gatePassFileName(pass: Pick<GatePassLike, 'id'>): string {
  return `gate-pass-OUT-${pass.id}.png`
}

/** The "Purpose" row: "On-Duty (official work outside)", the pass type, or plain "Gate pass". */
export function gatePassPurpose(pass: Pick<GatePassLike, 'source' | 'passType'>): string {
  if (isOnDutyPass(pass)) return 'On-Duty (official work outside)'
  return passTypeLabel(pass.passType) ?? 'Gate pass'
}

/**
 * The "Approval" row. `approvedAt` is already formatted by the caller (dates are the screen's business); `waiting` is the
 * pipeline's own "Waiting for ..." sentence of a manual pass, when the server sent one.
 */
export function gatePassApprovalText(pass: GatePassLike, approvedAtText: string | null, waiting: string | null): string {
  const status = statusOf(pass)
  if (status === 'approved') return `Approved${pass.approvedBy ? ` by ${pass.approvedBy}` : ''}${approvedAtText ? ` · ${approvedAtText}` : ''}`
  if (status === 'rejected') return `Not approved${pass.approvedBy ? ` (${pass.approvedBy})` : ''}`
  if (isOnDutyPass(pass)) return 'Waiting for the On-Duty approval'
  return waiting ?? 'Waiting for approval'
}

/** The employee on a card: name, code, designation · department, photo. */
export interface GatePassPersonView {
  name: string | null
  employeeCode: string | null
  department: string | null
  designation: string | null
  photoUrl: string | null
}

/** The person on the card from the employee record the pages already load (null while it loads). */
export function personFromEmployee(
  e: Pick<Employee, 'firstName' | 'lastName' | 'employeeCode' | 'departmentName' | 'designationTitle' | 'photoUrl'> | null | undefined,
): GatePassPersonView | null {
  if (!e) return null
  return {
    name: [e.firstName, e.lastName].filter(Boolean).join(' ') || null,
    employeeCode: e.employeeCode || null,
    department: e.departmentName || null,
    designation: e.designationTitle || null,
    photoUrl: e.photoUrl || null,
  }
}
