// One contact (HR's, or software support's) as the server describes it, and the ways to reach it. The block is the
// `hr` / `support` part of GET /support-contact (lib/support-contact.ts) and the same shape is embedded by the
// compensation page (`askHr.contact`) and the HOD page (`hrContact`).
//
// Pure TypeScript with no imports and no browser globals, so Node's test runner can load it (`npm test`); the parts of
// lib/support-contact.ts that touch localStorage stay there, which re-exports everything below.

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

type PlainObject = Record<string, unknown>

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** Coerces a block known to be an object to its expected types (every field a string, hasContact worked out). */
export function normalizeBlock(raw: PlainObject): SupportContactBlock {
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

/** One contact block (the `hr` / `support` part of /support-contact, or the `contact` / `hrContact` block the
 * compensation and HOD endpoints embed: same shape), coerced to its expected types; null when it is not an object. */
export function normalizeContactBlock(value: unknown): SupportContactBlock | null {
  return isPlainObject(value) ? normalizeBlock(value) : null
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

/** One way to reach a contact (call / WhatsApp / email), ready to draw. */
export interface ContactMethod {
  key: 'call' | 'whatsapp' | 'email'
  testId: string
  /** Row caption in a full card. */
  name: string
  /** Button caption. */
  action: string
  /** As HR entered it (never the normalised digits). */
  value: string
  /** '' when the field is set but nothing can be linked from it. */
  href: string
  external: boolean
}

/** The ways to reach this contact, only for the fields that are set, in the order call, WhatsApp, email. */
export function contactMethods(block: SupportContactBlock): ContactMethod[] {
  const methods: ContactMethod[] = []
  if (block.phone) {
    methods.push({
      key: 'call',
      testId: 'support-call',
      name: 'Phone',
      action: 'Call',
      value: block.phone,
      href: dialHref(block.phoneDial),
      external: false,
    })
  }
  if (block.whatsapp) {
    methods.push({
      key: 'whatsapp',
      testId: 'support-whatsapp',
      name: 'WhatsApp',
      action: 'WhatsApp',
      value: block.whatsapp,
      href: whatsappHref(block.whatsappNumber),
      external: true,
    })
  }
  if (block.email) {
    methods.push({
      key: 'email',
      testId: 'support-email',
      name: 'Email',
      action: 'Email',
      value: block.email,
      href: mailHref(block.email),
      external: false,
    })
  }
  return methods
}
