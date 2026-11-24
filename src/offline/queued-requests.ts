import type { OpFile } from '@/lib/offline-ops'
import { sendOrQueue } from '@/offline/submit'

/**
 * The forms that work offline (owner 2026-11-24, the same scope as the mobile app: requests + On-Duty punches): each
 * goes to the server at once when it can, else it is saved on this device and sent automatically later (submit.ts).
 * Same URLs and bodies as the plain calls in api/*; the answer is the server's, or the queued marker (isQueued()).
 * Office Geo Punch stays online-only (it must be checked live against the office's location).
 */

const MY_PENDING: unknown[] = ['my-pending-requests']

function shortDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export const queuedRequests = {
  leave: <T>(body: { startDate: string; endDate?: string }) =>
    sendOrQueue<T>({
      kind: 'leave.apply',
      label: `Leave request · ${shortDate(body.startDate)}${body.endDate && body.endDate !== body.startDate ? ` to ${shortDate(body.endDate)}` : ''}`,
      url: '/leave-requests',
      body: body as Record<string, unknown>,
      invalidate: [['leave-requests'], MY_PENDING],
      meta: { date: body.startDate },
    }),

  permission: <T>(body: { date: string }) =>
    sendOrQueue<T>({
      kind: 'permission.submit',
      label: `Permission · ${shortDate(body.date)}`,
      url: '/permissions',
      body: body as Record<string, unknown>,
      invalidate: [['permissions'], MY_PENDING],
      meta: { date: body.date },
    }),

  missingPunch: <T>(body: { date: string }) =>
    sendOrQueue<T>({
      kind: 'missingPunch.submit',
      label: `Missing punch · ${shortDate(body.date)}`,
      url: '/missing-punch-requests',
      body: body as Record<string, unknown>,
      invalidate: [['missing-punch'], MY_PENDING],
      meta: { date: body.date },
    }),

  /** `portion` is left out for a full day, so an older server sees what it always did (as casualLeaveRequestsApi.apply). */
  casualLeave: <T>(body: { employeeId: string; date: string; reason: string; portion: string }) => {
    const { portion, ...rest } = body
    return sendOrQueue<T>({
      kind: 'casualLeave.apply',
      label: `Casual Leave · ${shortDate(body.date)}`,
      url: '/casual-leaves',
      body: portion === 'full' ? rest : { ...rest, portion },
      invalidate: [['casual-leaves'], ['cl-eligibility'], MY_PENDING],
      meta: { date: body.date },
    })
  },

  enquiry: <T>(body: { category: string; subject: string; message: string }) =>
    sendOrQueue<T>({
      kind: 'enquiry.submit',
      label: `Enquiry · ${body.subject}`,
      url: '/my/enquiries',
      body,
      invalidate: [['enquiries']],
      meta: { category: body.category },
    }),

  outpass: <T>(body: { destination: string; reason: string }) =>
    sendOrQueue<T>({
      kind: 'outpass.submit',
      label: `Outpass · ${body.destination}`,
      url: '/outpass-requests',
      body: body as Record<string, unknown>,
      invalidate: [['outpass-requests'], MY_PENDING],
    }),
}

// ---- On-Duty (the server accepts a capture made offline: capturedAt + sessionId, backend geo_attendance_views.py) ----

const ON_DUTY_KEYS: unknown[][] = [['on-duty-status'], ['geo-punch-status'], MY_PENDING, ['outpass-requests'], ['on-duty-records']]

export interface FieldCapture {
  latitude: number
  longitude: number
  accuracy?: number
  isMocked?: boolean
  photo: Blob
  photo2?: Blob | null
  sessionId: number | null
}

function photoFiles(c: FieldCapture): OpFile[] {
  const files: OpFile[] = [{ field: 'photo', name: 'selfie.jpg', type: c.photo.type || 'image/jpeg', blob: c.photo }]
  if (c.photo2) files.push({ field: 'photo2', name: 'selfie2.jpg', type: c.photo2.type || 'image/jpeg', blob: c.photo2 })
  return files
}

function captureFields(c: FieldCapture, capturedAt: string): Record<string, unknown> {
  return {
    latitude: c.latitude,
    longitude: c.longitude,
    ...(c.accuracy != null ? { accuracy: c.accuracy } : {}),
    isMocked: !!c.isMocked,
    capturedAt,
    ...(c.sessionId != null ? { sessionId: c.sessionId } : {}),
  }
}

function clockNow(d: Date): string {
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

export const queuedOnDuty = {
  request: <T>(destination: string) =>
    sendOrQueue<T>({
      kind: 'onDuty.request',
      label: `On-Duty request · ${destination}`,
      url: '/on-duty-sessions/request',
      body: { destination, capturedAt: new Date().toISOString() },
      invalidate: ON_DUTY_KEYS,
      meta: { destination },
    }),

  /** One of the four punches; autoEnd=false keeps the session open after the 4th (Complete / Continue Duty). */
  punch: <T>(c: FieldCapture & { punchNumber: number; name?: string }) => {
    const at = new Date()
    return sendOrQueue<T>({
      kind: 'onDuty.punch',
      label: `${c.name ?? `Punch ${c.punchNumber}`} · ${clockNow(at)}`,
      url: '/on-duty-sessions/punch',
      body: { ...captureFields(c, at.toISOString()), punchNumber: c.punchNumber, autoEnd: false },
      files: photoFiles(c),
      invalidate: ON_DUTY_KEYS,
      meta: { punchNumber: c.punchNumber, sessionId: c.sessionId, time: clockNow(at) },
    })
  },

  /** An overtime punch after the four: the server numbers it. */
  otPunch: <T>(c: FieldCapture & { sequence?: number }) => {
    const at = new Date()
    return sendOrQueue<T>({
      kind: 'onDuty.otPunch',
      label: `OT punch${c.sequence ? ` ${c.sequence}` : ''} · ${clockNow(at)}`,
      url: '/on-duty-sessions/ot-punch',
      body: captureFields(c, at.toISOString()),
      files: photoFiles(c),
      invalidate: ON_DUTY_KEYS,
      meta: { sessionId: c.sessionId, time: clockNow(at) },
    })
  },

  end: <T>(sessionId: number | null) =>
    sendOrQueue<T>({
      kind: 'onDuty.end',
      label: `End On-Duty · ${clockNow(new Date())}`,
      url: '/on-duty-sessions/complete',
      body: sessionId != null ? { sessionId, capturedAt: new Date().toISOString() } : { capturedAt: new Date().toISOString() },
      invalidate: ON_DUTY_KEYS,
      meta: { sessionId },
    }),
}
