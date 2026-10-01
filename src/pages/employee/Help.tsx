import { Info, LifeBuoy } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/layout/PageHeader'
import { SupportContactCard } from '@/components/support/SupportContactCard'
import { useSupportContact } from '@/hooks/useSupportContact'

/** Who to contact and for what, from the details HR keeps under Settings -> HR Contact. */
export default function Help() {
  const { data } = useSupportContact()
  const note = data?.configured ? (data.note ?? '') : ''

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Help & Support"
        subtitle="Who to contact when you can't sign in, something in the app isn't working, or the server is down."
        eyebrow="System & Directory"
        icon={<LifeBuoy />}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <SupportContactCard situation="hr" title="HR Department — sign-in and app problems" showNote={false} />
        <SupportContactCard situation="server" title="Software Support — server or system not working" showNote={false} />
      </div>
      {note && (
        <Card>
          <CardContent className="flex items-start gap-2.5 py-2 text-sm whitespace-pre-line text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" /> {note}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
