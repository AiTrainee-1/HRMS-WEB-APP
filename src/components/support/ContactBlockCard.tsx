import { Clock, LifeBuoy } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { DEFAULT_CONTACT_LABEL, type SupportContactBlock } from '@/lib/support-contact'
import { methodsOf } from './contact-methods'
import { ActionLink } from './ContactActionLink'
import { SupportContactCard } from './SupportContactCard'

/**
 * Who to contact, from a contact block an endpoint already embedded (the compensation page's `askHr.contact`, the HOD
 * page's `hrContact`: both are Settings -> HR Contact, the same data /support-contact publishes). Call / WhatsApp /
 * email buttons for every field HR filled in, never a link for an empty one. A block with nothing reachable (or none
 * at all) falls back to the shared HR card, which reads /support-contact and says who to ask in words when even that
 * has nothing.
 */
export function ContactBlockCard({
  block,
  title,
  description,
  className,
}: {
  block: SupportContactBlock | null | undefined
  /** Heading; defaults to the contact's own label ("HR Desk"). */
  title?: string
  description?: string
  className?: string
}) {
  if (!block?.hasContact) {
    return <SupportContactCard situation="hr" title={title} className={className} />
  }
  const methods = methodsOf(block)
  const heading = title || block.label || DEFAULT_CONTACT_LABEL.hr
  return (
    <Card data-testid="contact-block-card" className={cn('text-left', className)}>
      <CardHeader>
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-md border border-primary/30 bg-primary/10 text-brand-blue">
            <LifeBuoy className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base">{heading}</CardTitle>
            {(description || (title && block.label && block.label !== heading)) && (
              <CardDescription className="mt-1">{description ?? `Contact ${block.label}`}</CardDescription>
            )}
          </div>
          {block.usesHrFallback && <Badge variant="secondary">Same as HR</Badge>}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {methods.map((m) => (
          // Narrow screens: the number / address keeps a full-width line of its own (never cut short), the button sits under it.
          <div key={m.key} className="flex flex-col gap-2.5 rounded-md border hairline bg-foreground/[0.03] px-3 py-2.5 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <m.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="label-caps text-muted-foreground">{m.name}</p>
                <p className="text-[14px] font-semibold tabular-nums [overflow-wrap:anywhere]">{m.value}</p>
              </div>
            </div>
            {m.href && (
              <ActionLink method={m} className="w-full shrink-0 sm:w-auto">
                {m.action}
              </ActionLink>
            )}
          </div>
        ))}
        {block.hours && (
          <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <Clock className="size-4 shrink-0" /> {block.hours}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
