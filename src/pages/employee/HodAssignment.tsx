import * as React from 'react'
import { toast } from 'sonner'
import { Building2, Check, Copy, Mail, MapPin, Phone, RefreshCw, ShieldCheck, UserCheck, UserX, X } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { LoadErrorCard } from '@/components/employee/LoadErrorCard'
import { Reveal } from '@/components/employee/Reveal'
import { ContactBlockCard } from '@/components/support/ContactBlockCard'
import { API_BASE_URL } from '@/api/client'
import { useHod } from '@/hooks/useHod'
import { copyText } from '@/lib/clipboard'
import { approvalSummaryLine, initialsOf, resolvePhotoUrl, type HodApproval, type HodPayload } from '@/lib/hod'
import { loadErrorMessage } from '@/lib/load-error'
import { dialHref, mailHref } from '@/lib/support-contact'
import { cn } from '@/lib/utils'

export default function HodAssignment() {
  const query = useHod()
  const hod = query.data

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="System & Directory"
        title="HOD Assignment"
        subtitle="Your Department Head, and the requests they can approve for you."
        icon={<UserCheck />}
        actions={
          hod ? (
            <Button variant="glass" size="sm" onClick={() => query.refetch()} disabled={query.isFetching} aria-label="Refresh HOD assignment">
              <RefreshCw className={cn(query.isFetching && 'animate-spin')} /> Refresh
            </Button>
          ) : undefined
        }
      />

      {query.isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : !hod ? (
        <LoadErrorCard
          title="We could not load this page."
          message={loadErrorMessage(query.error, 'your Department Head details')}
          onRetry={() => query.refetch()}
          retrying={query.isFetching}
        />
      ) : (
        <>
          {query.isError && (
            <LoadErrorCard
              title="We could not refresh this page."
              message={loadErrorMessage(query.error, 'your Department Head details')}
              onRetry={() => query.refetch()}
              retrying={query.isFetching}
            />
          )}
          {hod.assigned ? <Assigned hod={hod} /> : <NotAssigned hod={hod} />}
        </>
      )}
    </div>
  )
}

// ---- No head / you are one yourself ---------------------------------------------------------------------------------

function NotAssigned({ hod }: { hod: HodPayload }) {
  const Icon = hod.isSelf ? ShieldCheck : UserX
  return (
    <>
      <Card data-testid={hod.isSelf ? 'hod-self' : 'hod-unassigned'} className="border-primary/30">
        <CardContent role="status" className="flex items-start gap-4 py-1">
          <span className="grid size-11 shrink-0 place-items-center rounded-md border border-primary/30 bg-primary/10 text-brand-blue">
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-[20px] font-semibold">
              {hod.isSelf ? 'You are a Department Head' : 'No Department Head assigned yet'}
            </h2>
            <p className="mt-1 text-[14px] text-foreground/85">{hod.message}</p>
          </div>
        </CardContent>
      </Card>
      <ContactBlockCard block={hod.hrContact} title="Contact HR" description={hod.contactNote} />
    </>
  )
}

// ---- The assigned head ----------------------------------------------------------------------------------------------

function Assigned({ hod }: { hod: HodPayload }) {
  const name = hod.name ?? 'Your Department Head'
  // The API sends '/media/...' paths: they live on the API's host, not on this site (lib/hod.ts::resolvePhotoUrl).
  const photo = resolvePhotoUrl(hod.photoUrl, API_BASE_URL, window.location.origin)
  const summary = approvalSummaryLine(hod.approvals)

  return (
    <>
      <Reveal>
        <Card data-testid="hod-card">
          <CardContent className="flex flex-col gap-5 py-1 sm:flex-row sm:items-start sm:gap-6">
            <Avatar className="size-24 shrink-0 rounded-xl ring-1 ring-foreground/15 sm:size-28">
              {photo && <AvatarImage src={photo} alt={`Photo of ${name}`} className="object-cover" />}
              <AvatarFallback className="rounded-xl bg-primary/15 text-[28px] font-bold text-brand-blue">
                {initialsOf(hod.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="label-caps text-brand-emerald">Your Department Head</p>
              <h2 className="font-display mt-1 text-[26px] leading-tight font-semibold">{name}</h2>
              {(hod.designation || hod.employeeCode) && (
                <p className="mt-0.5 text-[14px] text-muted-foreground">
                  {[hod.designation, hod.employeeCode].filter(Boolean).join(' · ')}
                </p>
              )}
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                {hod.department && <Detail icon={Building2} label="Department" value={hod.department} />}
                {hod.branch && <Detail icon={MapPin} label="Branch" value={hod.branch} />}
                {hod.phone && <ContactRow icon={Phone} label="Phone" value={hod.phone} href={dialHref(hod.phone)} action="Call" copied="Phone number copied" />}
                {hod.email && <ContactRow icon={Mail} label="Email" value={hod.email} href={mailHref(hod.email)} action="Email" copied="Email address copied" />}
              </dl>
              {!hod.phone && !hod.email && (
                <p className="mt-4 text-[13px] text-muted-foreground">
                  No phone number or email is on file for your Department Head. Ask HR if you need to reach them.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </Reveal>

      <Reveal index={1}>
        <Card data-testid="hod-approvals">
          <CardHeader>
            <CardTitle className="text-[19px]">What your Department Head can approve</CardTitle>
            <CardDescription>
              {summary || 'The list of approvals is not available right now. Ask HR which requests your Department Head decides.'}
            </CardDescription>
          </CardHeader>
          {hod.approvals.length > 0 && (
            <CardContent>
              <ul className="grid gap-3 md:grid-cols-2">
                {hod.approvals.map((a) => (
                  <ApprovalRow key={a.key} approval={a} />
                ))}
              </ul>
            </CardContent>
          )}
        </Card>
      </Reveal>

      <Reveal index={2}>
        <ContactBlockCard block={hod.hrContact} title="Questions? Contact HR" description={hod.contactNote} />
      </Reveal>
    </>
  )
}

function ApprovalRow({ approval: a }: { approval: HodApproval }) {
  return (
    <li
      data-testid="hod-approval"
      data-can-approve={a.canApprove}
      className="flex items-start gap-3 rounded-md border hairline bg-foreground/[0.03] p-3"
    >
      <span
        className={cn(
          'mt-0.5 grid size-7 shrink-0 place-items-center rounded-full',
          a.canApprove ? 'bg-success/15 text-success' : 'bg-foreground/10 text-muted-foreground',
        )}
      >
        {a.canApprove ? <Check className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-[14.5px] font-semibold">{a.label}</p>
          {/* Words as well as an icon and a colour: the mark is never colour-only. */}
          <span className={cn('chip', a.canApprove ? 'chip-success' : 'chip-muted')}>
            {a.canApprove ? 'Can approve' : 'Cannot approve'}
          </span>
        </div>
        {!a.canApprove && a.reason && <p className="mt-1 text-[13px] text-muted-foreground">{a.reason}</p>}
        {a.path && <p className="mt-1 text-[12px] text-muted-foreground">Route: {a.path}</p>}
      </div>
    </li>
  )
}

// ---- Small pieces ---------------------------------------------------------------------------------------------------

function Detail({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-md border hairline bg-foreground/[0.03] px-3 py-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <dt className="label-caps text-muted-foreground">{label}</dt>
        <dd className="text-[14px] font-semibold [overflow-wrap:anywhere]">{value}</dd>
      </div>
    </div>
  )
}

/** A phone number or email: tap to call / write, plus a copy button. */
function ContactRow({
  icon: Icon,
  label,
  value,
  href,
  action,
  copied,
}: {
  icon: typeof Phone
  label: string
  value: string
  /** '' when the value cannot be linked (a phone with no digits): then only copying is offered. */
  href: string
  action: string
  copied: string
}) {
  const [busy, setBusy] = React.useState(false)
  async function copy() {
    setBusy(true)
    const ok = await copyText(value)
    setBusy(false)
    if (ok) toast.success(copied)
    else toast.error('Could not copy. Select the text and copy it by hand.')
  }
  return (
    // Narrow screens: the number / address gets its own full-width line (never cut short), the buttons sit under it.
    <div className="flex flex-col gap-2.5 rounded-md border hairline bg-foreground/[0.03] px-3 py-2.5 sm:col-span-2 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0">
          <dt className="label-caps text-muted-foreground">{label}</dt>
          <dd className="text-[14px] font-semibold tabular-nums [overflow-wrap:anywhere]">{value}</dd>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        {href && (
          <Button asChild variant="outline" size="sm">
            <a href={href} data-testid={`hod-${label.toLowerCase()}-link`}>
              <Icon /> {action}
            </a>
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={copy} disabled={busy} aria-label={`Copy ${label.toLowerCase()}`}>
          <Copy /> Copy
        </Button>
      </div>
    </div>
  )
}
