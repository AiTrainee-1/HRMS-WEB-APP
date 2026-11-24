// The redesigned On-Duty page's own API calls and shapes (owner 2026-11-24), mirroring the mobile app's
// src/hooks/useOnDutyActions.ts. The shared api/resources.ts keeps its older onDutyApi for anything else.
//
//   GET  /on-duty-sessions/status    -> + punchSlots[].name / expectedTime / expectedSource / punchTime / punchSource,
//                                       gatePass (the session's pass, raised at submission), otPunches, otMinutes,
//                                       regularPunchesDone
//   POST /on-duty-sessions/request   {destination, capturedAt} -> 201 {sessionId, session, gatePass, message};
//                                       409 "You already have an On-Duty session in progress"
//   POST /on-duty-sessions/punch     multipart (lib/onduty-photos buildPunchForm) with punchNumber, capturedAt, sessionId
//                                       and autoEnd=false: the 4th punch keeps the session open (allPunchesIn: true)
//   POST /on-duty-sessions/complete  {sessionId, capturedAt} -> the session (alreadyEnded: true when it already was)
//   POST /on-duty-sessions/ot-punch  multipart without punchNumber -> 201 {otPunch, otMinutes};
//                                       409 code regular_punches_missing before the four are in
// See backend/api/geo_attendance_views.py.

import { apiRequest } from './client'
import type { OutpassRow } from './requests-api'
import { buildPunchForm, type PunchBody } from '@/lib/onduty-photos'
import type { OnDutyPunchResult, OnDutySession, OnDutyStatusResponse, PunchSlot } from '@/types'

/** A punch slot as the 2026-11-24 server sends it (an older one sends only the PunchSlot fields). */
export interface OnDutySlot extends PunchSlot {
  /** "Morning Punch" | "Lunch Out" | "Lunch In" | "Night Punch" */
  name?: string | null
  /** "HH:MM", from the employee's shift (expectedSource "shift") or the usual day ("default"). */
  expectedTime?: string | null
  expectedSource?: 'shift' | 'default' | string | null
  /** "HH:MM:SS" once the slot is filled. */
  punchTime?: string | null
  punchSource?: string | null
}

/** An overtime punch after the four (backend OnDutyOvertimePunch): never attendance. */
export interface OtPunch {
  id: number
  sequence: number
  punchDate?: string | null
  /** "HH:MM:SS" */
  punchTime: string
  status: 'pending' | 'approved' | 'rejected' | string
  accuracyM?: number | null
  createdAt?: string | null
}

/** The employee on a gate pass (the server sends it with the On-Duty page's pass). */
export interface GatePassPerson {
  name?: string | null
  employeeCode?: string | null
  department?: string | null
  designation?: string | null
  photoUrl?: string | null
}

/** A gate pass as the Outpass list and the On-Duty status send it (backend outpass_request_views._outpass_request_json). */
export interface GatePass extends OutpassRow {
  /** The On-Duty request the pass belongs to (raised the moment it is submitted), and that request's state. */
  onDutySessionId?: number | null
  onDutyStatus?: string | null
  validFrom?: string | null
  employee?: GatePassPerson | null
}

export interface OnDutyStatusNow extends Omit<OnDutyStatusResponse, 'punchSlots'> {
  punchSlots?: OnDutySlot[]
  gatePass?: GatePass | null
  otPunches?: OtPunch[]
  otMinutes?: number
  regularPunchesDone?: boolean
}

export interface OnDutyRequestResult {
  sessionId: number
  session: OnDutySession
  gatePass?: GatePass | null
  message?: string
}

export type OnDutyPunchNowResult = Omit<OnDutyPunchResult, 'punchSlots'> & {
  /** All four are in and the session stays open (autoEnd=false): the page asks Complete Duty / Continue Duty. */
  allPunchesIn?: boolean
  punchSlots?: OnDutySlot[]
}

export interface OtPunchResult {
  otPunch: OtPunch
  otMinutes: number
  message?: string
}

/** One of the four punches, or an OT punch: the location, the photo(s) and the session. */
export type FieldPunchBody = Omit<PunchBody, 'capturedAt' | 'autoEnd'> & { sessionId: number | null }

const now = () => new Date().toISOString()

export const onDutyActionsApi = {
  status: () => apiRequest<OnDutyStatusNow>({ method: 'GET', url: '/on-duty-sessions/status' }),
  request: (destination: string) =>
    apiRequest<OnDutyRequestResult>({ method: 'POST', url: '/on-duty-sessions/request', data: { destination, capturedAt: now() } }),
  punch: (body: FieldPunchBody & { punchNumber: number }) =>
    apiRequest<OnDutyPunchNowResult>({
      method: 'POST',
      url: '/on-duty-sessions/punch',
      data: buildPunchForm({ ...body, capturedAt: now(), autoEnd: false }),
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  // No punchNumber: the server numbers OT punches itself.
  otPunch: (body: FieldPunchBody) =>
    apiRequest<OtPunchResult>({
      method: 'POST',
      url: '/on-duty-sessions/ot-punch',
      data: buildPunchForm({ ...body, punchNumber: undefined, capturedAt: now() }),
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  complete: (sessionId: number | null) =>
    apiRequest<OnDutySession & { alreadyEnded?: boolean }>({
      method: 'POST',
      url: '/on-duty-sessions/complete',
      data: sessionId != null ? { sessionId, capturedAt: now() } : { capturedAt: now() },
    }),
}
