import { Headset, Mail, MessageCircle, Phone, type LucideIcon } from 'lucide-react'
import { useSupportContact } from '@/hooks/useSupportContact'
import { contactMethodLabel, primaryContactMethod } from '@/lib/contact-block'
import {
  DEFAULT_CONTACT_LABEL,
  contactFor,
  fallbackSentence,
  usableContactFor,
  type ContactMethod,
  type SupportSituation,
} from '@/lib/support-contact'

const ICON: Record<ContactMethod['key'], LucideIcon> = { call: Phone, whatsapp: MessageCircle, email: Mail }

/**
 * One tappable line for a screen with room for a single contact ("Need help? Call HR 0421 430 0800"), as the mobile
 * app's SupportInlineLink: the first way of reaching HR (or software support) that HR configured in Settings -> HR
 * Contact. Never hard-coded: with nothing loaded or configured it is plain wording with no number and no link.
 * The caller brings the classes.
 */
export function SupportInlineLink({
  situation,
  prefix,
  lead,
  showIcon = false,
  className,
  accentClassName,
}: {
  situation: SupportSituation
  /** Plain text before the link, e.g. "Need help? ". */
  prefix?: string
  /** Replaces "Call HR" / "Email HR" in the link text, e.g. "Contact HR". */
  lead?: string
  /** A small phone / WhatsApp / email icon before the text. */
  showIcon?: boolean
  className?: string
  /** The link part of the text. */
  accentClassName?: string
}) {
  const { data } = useSupportContact()
  const method = primaryContactMethod(usableContactFor(data, situation))
  const who = situation === 'hr' ? 'HR' : 'support'
  const text = method ? `${lead ?? `${method.action} ${who}`} ${method.value}` : fallbackSentence(situation)
  const label = contactFor(data, situation)?.label || DEFAULT_CONTACT_LABEL[situation]
  const Icon = method ? ICON[method.key] : Headset

  const content = (
    <>
      {showIcon && <Icon aria-hidden />}
      <span>
        {prefix}
        <span className={accentClassName}>{text}</span>
      </span>
    </>
  )

  if (!method?.href) {
    return (
      <p className={className} data-testid="support-inline" data-situation={situation}>
        {content}
      </p>
    )
  }
  return (
    <a
      href={method.href}
      className={className}
      aria-label={`${prefix ?? ''}${contactMethodLabel(method, label)}`.trim()}
      data-testid="support-inline"
      data-situation={situation}
      {...(method.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {content}
    </a>
  )
}
