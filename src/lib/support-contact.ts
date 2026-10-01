/**
 * HR / software-support contact details, as HR configures them (Settings -> HR Contact in the HR portal) and the
 * public GET /support-contact endpoint publishes them. Nothing here is hard-coded: every number and address shown
 * to an employee comes from that response (or from the copy of it kept on this device).
 *
 * Which contact answers which situation is the same in every client:
 *   'hr'      cannot sign in, password / OTP problems, not registered, account inactive or deactivated, a problem
 *             with the web app, anything about the employee's own data
 *   'server'  the server is not working / unreachable / returns 5xx / the database is offline
 *
 * This module is pure apart from the two localStorage helpers, which never throw.
 */

export type SupportSituation = 'hr' | 'server'

export interface SupportContactBlock {
  label: string
  phone: string
  phoneDial: string
  whatsapp: string
  whatsappNumber: string
  email: string
  hours: string
  hasContact: boolean
  usesHrFallback: boolean
}

export interface SupportContact {
  hr: SupportContactBlock
  support: SupportContactBlock
  note: string
  companyName: string
  configured: boolean
  updatedAt: string | null
}

export const SUPPORT_CONTACT_STORAGE_KEY = 'uktex_support_contact_v1'

export const DEFAULT_CONTACT_LABEL: Record<SupportSituation, string> = {
  hr: 'HR Department',
  server: 'Software Support',
}

// ---- Validation -----------------------------------------------------------------------------------------------

type PlainObject = Record<string, unknown>

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Does this look like the /support-contact contract? Only the two contact objects are required. */
export function isSupportContact(value: unknown): value is PlainObject & { hr: PlainObject; support: PlainObject } {
  return isPlainObject(value) && isPlainObject(value.hr) && isPlainObject(value.support)
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeBlock(raw: PlainObject): SupportContactBlock {
  const phone = text(raw.phone)
  const whatsapp = text(raw.whatsapp)
  const email = text(raw.email)
  return {
    label: text(raw.label),
    phone,
    // The server sends the normalised number; if it ever did not, the digits of what HR typed still dial.
    phoneDial: text(raw.phoneDial) || phone.replace(/[^\d+]/g, ''),
    whatsapp,
    whatsappNumber: text(raw.whatsappNumber),
    email,
    hours: text(raw.hours),
    hasContact: Boolean(phone || whatsapp || email),
    usesHrFallback: raw.usesHrFallback === true,
  }
}

/** Validates a response (or a stored copy) and coerces every field to its expected type; null when it is not one. */
export function parseSupportContact(value: unknown): SupportContact | null {
  if (!isSupportContact(value)) return null
  return {
    hr: normalizeBlock(value.hr),
    support: normalizeBlock(value.support),
    note: text(value.note),
    companyName: text(value.companyName),
    configured: value.configured === true,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : null,
  }
}

// ---- Device copy (the server cannot be asked for it when it is down) ------------------------------------------

export function readCachedSupportContact(): SupportContact | null {
  try {
    const raw = window.localStorage.getItem(SUPPORT_CONTACT_STORAGE_KEY)
    return raw ? parseSupportContact(JSON.parse(raw)) : null
  } catch {
    // Storage blocked / unavailable, or the stored text is not JSON.
    return null
  }
}

export function writeCachedSupportContact(contact: SupportContact): void {
  try {
    window.localStorage.setItem(SUPPORT_CONTACT_STORAGE_KEY, JSON.stringify(contact))
  } catch {
    // Storage blocked or full: the live copy still works, there is just nothing to fall back on later.
  }
}

// ---- Links ----------------------------------------------------------------------------------------------------

/** tel: link from the normalised number ('' when there is nothing dialable). */
export function dialHref(phoneDial: string): string {
  const number = (phoneDial || '').replace(/[^\d+]/g, '')
  return /\d/.test(number) ? `tel:${number}` : ''
}

/** https://wa.me link from the country-code number ('' when there is none). */
export function whatsappHref(whatsappNumber: string): string {
  const digits = (whatsappNumber || '').replace(/\D/g, '')
  return digits ? `https://wa.me/${digits}` : ''
}

export function mailHref(email: string): string {
  const address = (email || '').trim()
  return address ? `mailto:${address}` : ''
}

// ---- Choosing what to show ------------------------------------------------------------------------------------

/** The block that answers this situation, or null when nothing is known yet. */
export function contactFor(data: SupportContact | null | undefined, situation: SupportSituation): SupportContactBlock | null {
  if (!data) return null
  return situation === 'hr' ? data.hr : data.support
}

/** The block for this situation only if HR has configured something reachable in it; null means "show the fallback". */
export function usableContactFor(data: SupportContact | null | undefined, situation: SupportSituation): SupportContactBlock | null {
  const block = contactFor(data, situation)
  return data?.configured && block?.hasContact ? block : null
}

/** What to say when there is no contact to show (HR has not set one up yet, or nothing has ever loaded). */
export function fallbackSentence(situation: SupportSituation): string {
  return situation === 'hr' ? 'Please contact your HR department.' : 'Please contact your software support team.'
}
