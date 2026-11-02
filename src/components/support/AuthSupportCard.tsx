import { Clock, Headset, LifeBuoy } from 'lucide-react'
import { useSupportContact } from '@/hooks/useSupportContact'
import { contactMethodLabel } from '@/lib/contact-block'
import { DEFAULT_CONTACT_LABEL, contactFor, fallbackSentence, usableContactFor, type SupportSituation } from '@/lib/support-contact'
import { methodsOf } from './contact-methods'

/**
 * The sign-in pages' contact card: the mobile app's compact SupportContactCard (a round icon, the heading and hours, a
 * line saying when to use it, and a pill for each way to reach them: Call / WhatsApp / Email). Same data and the same
 * three states as the app-wide SupportContactCard - what HR configured in Settings -> HR Contact, a skeleton while the
 * first copy loads, and a plain sentence (never a number) when nothing is configured - in the sign-in pages' colours,
 * which hold in both themes. Lives inside an `.auth-scope` (components/auth/auth.css).
 */
export function AuthSupportCard({
  situation,
  title,
  description,
  className,
}: {
  situation: SupportSituation
  /** Heading. Defaults to the contact's own label ("HR Department" / "Software Support"). */
  title?: string
  /** A line under the heading saying when to use this contact. */
  description?: string
  className?: string
}) {
  const { data, isPending } = useSupportContact()
  const usable = usableContactFor(data, situation)
  const label = contactFor(data, situation)?.label || DEFAULT_CONTACT_LABEL[situation]
  const state = usable ? 'ready' : isPending ? 'loading' : 'fallback'
  const methods = usable ? methodsOf(usable) : []
  const Icon = situation === 'hr' ? Headset : LifeBuoy

  return (
    <section
      data-testid="support-contact-card"
      data-situation={situation}
      data-state={state}
      aria-label={title ?? label}
      className={className ? `auth-contact ${className}` : 'auth-contact'}
    >
      <div className="auth-contact-head">
        <span className="auth-contact-icon">
          <Icon aria-hidden />
        </span>
        <div className="auth-contact-headtext">
          <h3 className="auth-contact-title">{title ?? label}</h3>
          {usable?.hours && (
            <p className="auth-contact-hours">
              <Clock aria-hidden /> {usable.hours}
            </p>
          )}
        </div>
        {situation === 'server' && usable?.usesHrFallback && <span className="auth-contact-badge">Same as HR</span>}
      </div>

      {description && <p className="auth-contact-desc">{description}</p>}

      {state === 'loading' && <div className="auth-pill-skeleton" aria-hidden />}
      {state === 'fallback' && <p className="auth-contact-fallback">{fallbackSentence(situation)}</p>}
      {state === 'ready' && methods.length > 0 && (
        <div className="auth-pills">
          {methods.map((m) =>
            m.href ? (
              <a
                key={m.key}
                href={m.href}
                className={`auth-pill auth-pill--${m.key}`}
                data-testid={m.testId}
                aria-label={contactMethodLabel(m, label)}
                {...(m.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              >
                <m.icon aria-hidden />
                <span>{m.value}</span>
              </a>
            ) : (
              <span key={m.key} className={`auth-pill auth-pill--${m.key}`}>
                <m.icon aria-hidden />
                <span>{m.value}</span>
              </span>
            ),
          )}
        </div>
      )}
    </section>
  )
}
