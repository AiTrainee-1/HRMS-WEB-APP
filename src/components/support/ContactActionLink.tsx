import { Button } from '@/components/ui/button'
import type { ContactMethod } from '@/lib/support-contact'

/** An outlined button that opens one way to reach a contact (tel:, WhatsApp, mailto:). */
export function ActionLink({
  method,
  className,
  children,
}: {
  method: Pick<ContactMethod, 'href' | 'testId' | 'external'>
  className?: string
  children: React.ReactNode
}) {
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
