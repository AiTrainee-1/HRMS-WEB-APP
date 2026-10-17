import { Mail, MessageCircle, Phone, type LucideIcon } from 'lucide-react'
import { contactMethods, type ContactMethod, type SupportContactBlock } from '@/lib/support-contact'

/** A way to reach a contact with its icon: the pure list from lib/support-contact.ts, dressed for the screen. */
export interface Method extends ContactMethod {
  icon: LucideIcon
}

const METHOD_ICON: Record<ContactMethod['key'], LucideIcon> = {
  call: Phone,
  whatsapp: MessageCircle,
  email: Mail,
}

/** The ways to reach this contact, only for the fields that are set. */
export function methodsOf(block: SupportContactBlock): Method[] {
  return contactMethods(block).map((m) => ({ ...m, icon: METHOD_ICON[m.key] }))
}
