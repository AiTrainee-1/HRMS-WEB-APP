// The photos of an On-Duty punch. HR chooses, in the HRMS, whether a punch needs one selfie or two:
//   GET  /on-duty-sessions/status  -> { session, punchVerifications, punchSlots, requiredPhotos: 1 | 2 }
//   POST /on-duty-sessions/punch   -> multipart: latitude, longitude, accuracy, isMocked, punchNumber, photo [, photo2]
// An older server sends no `requiredPhotos` (it only ever took one photo), so a missing or unreadable value means 1.
// The first photo keeps the field name `photo` it always had, so the old server and the old behaviour keep working;
// the second goes in `photo2`. When the policy is 2 and `photo2` is missing the server answers 400 with the code
// PHOTO2_REQUIRED (this page was opened before HR switched the policy): see isPhoto2Required.
//
// Pure on purpose (no React, no imports): Node's test runner loads it directly, see onduty-photos.test.ts.

/** How many photos one punch takes: what the status payload says (1 or 2). */
export type RequiredPhotos = 1 | 2

/** The sentence under the On-Duty request form: browsers cannot track a journey in the background. */
export const ON_DUTY_WEB_TRACKING_NOTE =
  'Journey tracking runs only in the UKTextiles mobile app; requests made here are not tracked.'

/**
 * The photo count the server asks for: 2 when the status payload says `requiredPhotos` is 2 (a number, or "2" as text),
 * else 1. A missing key (an older server), null, junk, 0 or a negative number all mean 1; a whole number above 2 means
 * "more than one" and is read as 2, the most a punch takes.
 */
export function requiredPhotoCount(status: { requiredPhotos?: unknown } | null | undefined): RequiredPhotos {
  const raw = status?.requiredPhotos
  const n = typeof raw === 'string' ? Number(raw.trim()) : raw
  return typeof n === 'number' && Number.isInteger(n) && n >= 2 ? 2 : 1
}

/** What a photo is called on screen: "Photo 2 of 2", or just "Selfie" when the punch takes a single one. */
export function photoLabel(index: number, total: number): string {
  return total <= 1 ? 'Selfie' : `Photo ${index + 1} of ${total}`
}

// The photos taken so far, in order: one entry per required photo, null while it is not taken. Generic in the entry
// (the dialog keeps { blob, previewUrl }, the tests plain strings); every function returns a NEW array.

/** The empty list for a punch of `required` photos. */
export function emptyPhotoSlots<T>(required: number): Array<T | null> {
  return Array.from({ length: Math.max(0, Math.floor(required)) }, () => null)
}

/** The list with `photo` stored in slot `index`; an index outside the list changes nothing. */
export function putPhoto<T>(slots: ReadonlyArray<T | null>, index: number, photo: T): Array<T | null> {
  return slots.map((slot, i) => (i === index ? photo : slot))
}

/** The list with slot `index` emptied: "Retake". An index outside the list changes nothing. */
export function clearPhoto<T>(slots: ReadonlyArray<T | null>, index: number): Array<T | null> {
  return slots.map((slot, i) => (i === index ? null : slot))
}

/** The first slot with no photo (the one the camera shoots next), or null when every slot is filled. */
export function nextEmptySlot<T>(slots: ReadonlyArray<T | null>): number | null {
  const i = slots.findIndex((slot) => slot == null)
  return i === -1 ? null : i
}

/** Whether the list holds all `required` photos: the only state in which the punch may be submitted. */
export function photosComplete<T>(slots: ReadonlyArray<T | null>, required: number): boolean {
  return required >= 1 && slots.length === required && slots.every((slot) => slot != null)
}

/** The photos in order when all `required` are there, else null. */
export function completePhotos<T>(slots: ReadonlyArray<T | null>, required: number): T[] | null {
  return photosComplete(slots, required) ? (slots as T[]) : null
}

/**
 * The state of the "Submit punch" button: enabled only when every required photo is present (and nothing is being
 * sent), plus the line that says what is missing.
 */
export function punchSubmitState<T>(
  slots: ReadonlyArray<T | null>,
  required: number,
  pending = false,
): { enabled: boolean; hint: string } {
  if (photosComplete(slots, required)) return { enabled: !pending, hint: '' }
  const next = slots.length === required ? nextEmptySlot(slots) : 0
  return { enabled: false, hint: `Take ${photoLabel(next ?? 0, required).toLowerCase()} to continue.` }
}

/** The fields of one punch as the screen has them. */
export interface PunchBody {
  latitude: number
  longitude: number
  accuracy?: number
  isMocked?: boolean
  punchNumber?: number
  /** The first (or only) photo: the multipart field `photo`. */
  photo: Blob
  /** The second photo: the multipart field `photo2`, sent only when the punch took two. */
  photo2?: Blob | null
}

/** The multipart body of POST /on-duty-sessions/punch. `photo2` is in it exactly when the caller has a second photo. */
export function buildPunchForm(body: PunchBody): FormData {
  const form = new FormData()
  form.append('latitude', String(body.latitude))
  form.append('longitude', String(body.longitude))
  if (body.accuracy != null) form.append('accuracy', String(body.accuracy))
  form.append('isMocked', String(!!body.isMocked))
  if (body.punchNumber != null) form.append('punchNumber', String(body.punchNumber))
  form.append('photo', body.photo, 'selfie.jpg')
  if (body.photo2) form.append('photo2', body.photo2, 'selfie2.jpg')
  return form
}

/** The error code the server sends when the policy asks for two photos and the punch brought one. */
export const PHOTO2_REQUIRED_CODE = 'PHOTO2_REQUIRED'

/** What the employee reads then. (The server's own sentence says "update the app": on the web it is a refresh.) */
export const PHOTO2_REQUIRED_MESSAGE =
  'Two photos are now required for an On-Duty punch. Refresh this page, then take both photos.'

/** Whether a failed punch is the server saying "two photos are required": a 400 whose body carries PHOTO2_REQUIRED. */
export function isPhoto2Required(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const { status, data } = err as { status?: unknown; data?: unknown }
  return status === 400 && !!data && typeof data === 'object' && (data as { code?: unknown }).code === PHOTO2_REQUIRED_CODE
}

/** The sentence to show for a failed punch: the two-photo message, else the error's own text, else `fallback`. */
export function punchErrorMessage(err: unknown, fallback: string): string {
  if (isPhoto2Required(err)) return PHOTO2_REQUIRED_MESSAGE
  return err instanceof Error && err.message ? err.message : fallback
}
