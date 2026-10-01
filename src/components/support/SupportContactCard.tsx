import { Clock, Headset, Info, LifeBuoy, Mail, MessageCircle, Phone, type LucideIcon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useSupportContact } from '@/hooks/useSupportContact'
import {
  DEFAULT_CONTACT_LABEL,
  contactFor,
  dialHref,
  fallbackSentence,
  mailHref,
  usableContactFor,
  whatsappHref,
  type SupportContactBlock,
  type SupportSituation,
} from '@/lib/support-contact'

interface Method {
  key: 'call' | 'whatsapp' | 'email'
  testId: string
  icon: LucideIcon
  /** Row caption in the full card. */
  name: string
  /** Button caption. */
  action: string
  /** As HR entered it (never the normalised digits). */
  value: string
  /** '' when the field is set but nothing can be linked from it. */
  href: string
  external: boolean
}

/** The ways to reach this contact, only for the fields that are set. */
function methodsOf(block: SupportContactBlock): Method[] {
  const methods: Method[] = []
  if (block.phone) {
    methods.push({
      key: 'call',
      testId: 'support-call',
      icon: Phone,
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
      icon: MessageCircle,
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
      icon: Mail,
      name: 'Email',
      action: 'Email',
      value: block.email,
      href: mailHref(block.email),
      external: false,
    })
  }
  return methods
}

function ActionLink({ method, className, children }: { method: Method; className?: string; children: React.ReactNode }) {
  return (
    <Button asChild variant="outline" size="sm" className={className}>
      <a
        href={method.href}
        data-testid={method.testId}
        {...(method.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {children}
      </a>
    </Button>
  )
}

/**
 * Who to contact for this situation, from what HR configured (Settings -> HR Contact); never hard-coded.
 *
 *  situation 'hr'      cannot sign in, password / OTP, not registered, account inactive, a web-app or own-data problem
 *  situation 'server'  the server is unreachable / returns 5xx / the database is offline
 *
 * `compact` is one tidy block with a single row of buttons (sign-in screens, empty states, the offline banner); the
 * full card lists each way to reach them with the hours and HR's note. With nothing configured yet (or nothing ever
 * loaded on this device) it says who to ask in words instead, and it never renders a link for an empty field.
 */
export function SupportContactCard({
  situation,
  title,
  compact = false,
  showNote = true,
  className,
}: {
  situation: SupportSituation
  /** Heading. Defaults to the contact's own label ("HR Department" / "Software Support"). */
  title?: string
  compact?: boolean
  /** The full card shows HR's note by default; a page that shows it once for several cards can turn it off. */
  showNote?: boolean
  className?: string
}) {
  const { data, isPending } = useSupportContact()
  const usable = usableContactFor(data, situation)
  const label = contactFor(data, situation)?.label || DEFAULT_CONTACT_LABEL[situation]
  const state = usable ? 'ready' : isPending ? 'loading' : 'fallback'
  const heading = title || label
  const hours = usable?.hours ?? ''
  const note = usable && showNote ? (data?.note ?? '') : ''
  const methods = usable ? methodsOf(usable) : []
  // Who to ask for, under a heading that is not itself the name. In the full card only when HR renamed the contact
  // (the default label would just repeat the heading).
  const contactLine = title && (compact || label !== DEFAULT_CONTACT_LABEL[situation]) ? `Contact ${label}` : ''

  if (compact) {
    const linked = methods.filter((m) => m.href)
    return (
      <div
        data-testid="support-contact-card"
        data-situation={situation}
        data-state={state}
        className={cn('rounded-md border hairline bg-foreground/[0.03] px-3.5 py-3 text-left', className)}
      >
        <div className="flex items-start gap-2.5">
          <LifeBuoy className="mt-0.5 size-4 shrink-0 text-brand-gold" />
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] leading-tight font-semibold">{heading}</p>
            {state === 'ready' && (contactLine || hours) && (
              <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] text-muted-foreground">
                {contactLine && <span>{contactLine}</span>}
                {contactLine && hours && <span aria-hidden>·</span>}
                {hours && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3" /> {hours}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
        {state === 'loading' && <div className="mt-2.5 h-9 w-56 max-w-full animate-pulse rounded-md bg-foreground/[0.06]" aria-hidden />}
        {state === 'fallback' && <p className="mt-2 text-[13px] text-foreground/85">{fallbackSentence(situation)}</p>}
        {state === 'ready' && linked.length === 0 && methods.length > 0 && (
          <p className="mt-2 text-[13px] font-semibold tabular-nums">{methods.map((m) => m.value).join(' · ')}</p>
        )}
        {state === 'ready' && linked.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {linked.map((m) => (
              <ActionLink key={m.key} method={m} className="h-9 max-w-full text-[13px]">
                <m.icon />
                <span className="truncate">
                  {m.action} <span className="font-normal opacity-80 tabular-nums">{m.value}</span>
                </span>
              </ActionLink>
            ))}
          </div>
        )}
      </div>
    )
  }

  const Icon = situation === 'hr' ? LifeBuoy : Headset
  return (
    <Card data-testid="support-contact-card" data-situation={situation} data-state={state} className={cn('text-left', className)}>
      <CardHeader>
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-md border border-primary/30 bg-primary/10 text-brand-blue">
            <Icon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base">{heading}</CardTitle>
            {state === 'ready' && contactLine && <CardDescription className="mt-1">{contactLine}</CardDescription>}
          </div>
          {usable?.usesHrFallback && <Badge variant="secondary">Same as HR</Badge>}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {state === 'loading' && <div className="h-14 animate-pulse rounded-md bg-foreground/[0.06]" aria-hidden />}
        {state === 'fallback' && <p className="text-[13.5px] text-muted-foreground">{fallbackSentence(situation)}</p>}
        {state === 'ready' &&
          methods.map((m) => (
            <div key={m.key} className="flex items-center gap-3 rounded-md border hairline bg-foreground/[0.03] px-3 py-2.5">
              <m.icon className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="label-caps text-muted-foreground">{m.name}</p>
                <p className="truncate text-[14px] font-semibold tabular-nums" title={m.value}>
                  {m.value}
                </p>
              </div>
              {m.href && (
                <ActionLink method={m} className="shrink-0">
                  {m.action}
                </ActionLink>
              )}
            </div>
          ))}
        {hours && (
          <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <Clock className="size-4 shrink-0" /> {hours}
          </p>
        )}
        {note && (
          <p className="flex items-start gap-2 rounded-md bg-foreground/[0.04] px-3 py-2.5 text-[13px] whitespace-pre-line text-foreground/85">
            <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> {note}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
