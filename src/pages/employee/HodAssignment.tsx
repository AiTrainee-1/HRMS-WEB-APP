import * as React from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { useLocation, useSearch } from 'wouter'
import {
  BadgeCheck, Building2, Check, CheckCircle2, Copy, Hourglass, Mail, MapPin, Phone, RefreshCw, ShieldCheck, UserCheck, Users, UserX, X, XCircle,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  ErrorState,
  GlassCard,
  PageHero,
  PageShell,
  RingMeter,
  SectionHeader,
  SegmentedControl,
  SkeletonList,
  StatusPill,
  listItem,
} from '@/components/kit'
import { ContactBlockCard } from '@/components/support/ContactBlockCard'
import { MyRequestsPanel } from '@/components/approvals/MyRequestsPanel'
import { API_BASE_URL } from '@/api/client'
import { useHod } from '@/hooks/useHod'
import { useMyPendingRequests } from '@/hooks/useMyPendingRequests'
import { copyText } from '@/lib/clipboard'
import { approvalCounts, approvalSummaryLine, initialsOf, resolvePhotoUrl, type HodApproval, type HodPayload } from '@/lib/hod'
import { dialHref, mailHref } from '@/lib/support-contact'
import { cn } from '@/lib/utils'

type Tab = 'head' | 'requests'

// Phones (< 768px), kit/MOBILE.md: the round refresh stays at the right of the title (PageHero would give actions a row
// of their own), and the two tabs are the app's pill bar (a soft track, the chosen tab a filled pill, both halves equal).
const PHONE_HERO = 'max-md:[&>div.flex]:items-center max-md:[&>div.flex>div+div]:w-auto'
const PHONE_TABS =
  'max-md:w-full max-md:rounded-full max-md:bg-muted! max-md:[&>button]:flex-1 max-md:[&>button]:rounded-full max-md:[&>button]:px-2.5 max-md:[&>button]:text-[13px] max-md:[&_.bg-brand-gradient]:rounded-full'

/**
 * My Department Head, two tabs (mirror of the mobile app's HOD Assignment, 2026-10-31):
 *   Department Head - who it is, how to reach them, and which kinds of request they can approve for you;
 *   My Requests     - your requests still waiting for an answer, with "Remind Department Head / HR" (once a day each),
 *                     and HR's attendance changes of the last 30 days. `?tab=requests` opens it.
 */
export default function HodAssignment() {
  const query = useHod()
  const pending = useMyPendingRequests()
  const hod = query.data
  const search = useSearch()
  const [location, navigate] = useLocation()
  const tab: Tab = new URLSearchParams(search).get('tab') === 'requests' ? 'requests' : 'head'
  const setTab = (t: Tab) => navigate(t === 'requests' ? `${location}?tab=requests` : location, { replace: true })
  const waiting = pending.data?.count ?? 0

  const refreshing = query.isFetching || pending.isFetching
  return (
    <PageShell>
      <PageHero
        icon={<UserCheck />}
        title="My Department Head"
        subtitle={
          <>
            <span className="max-md:hidden">Who approves your requests, and where your waiting requests stand.</span>
            {/* Phones: the app's sub-line follows the open tab. */}
            <span className="hidden max-md:inline">{tab === 'requests' ? 'Your requests waiting for an answer' : 'Your Department Head and what they can approve'}</span>
          </>
        }
        className={PHONE_HERO}
        actions={
          <>
            <Button
              variant="glass"
              onClick={() => {
                void query.refetch()
                void pending.refetch()
              }}
              disabled={refreshing}
              aria-label="Refresh"
              className="max-md:hidden"
            >
              <RefreshCw className={cn(refreshing && 'animate-spin')} aria-hidden="true" /> Refresh
            </Button>
            <Button
              variant="glass"
              size="icon"
              onClick={() => {
                void query.refetch()
                void pending.refetch()
              }}
              disabled={refreshing}
              aria-label="Refresh"
              className="hidden max-md:inline-flex max-md:size-9 max-md:rounded-full"
            >
              <RefreshCw className={cn(refreshing && 'animate-spin')} aria-hidden="true" />
            </Button>
          </>
        }
      >
        <SegmentedControl<Tab>
          ariaLabel="Show"
          value={tab}
          onChange={setTab}
          className={PHONE_TABS}
          options={[
            { value: 'head', label: 'Department Head', icon: UserCheck },
            { value: 'requests', label: 'My Requests', icon: Hourglass, count: waiting > 0 ? Math.min(waiting, 99) : undefined },
          ]}
        />
      </PageHero>

      {tab === 'requests' ? (
        <MyRequestsPanel />
      ) : query.isPending ? (
        <SkeletonList variant="cards" count={2} label="Loading your Department Head" />
      ) : !hod ? (
        <ErrorState title="We could not load this page" error={query.error} what="your Department Head details" onRetry={() => query.refetch()} retrying={query.isFetching} />
      ) : (
        <div className="flex flex-col gap-6 max-md:gap-3.5">
          {query.isError && (
            <ErrorState compact title="We could not refresh this page" error={query.error} what="your Department Head details" onRetry={() => query.refetch()} retrying={query.isFetching} />
          )}
          {hod.assigned ? <Assigned hod={hod} waiting={waiting} onOpenRequests={() => setTab('requests')} /> : <NotAssigned hod={hod} />}
        </div>
      )}
    </PageShell>
  )
}

// ---- No head / you are one yourself ---------------------------------------------------------------------------------

function NotAssigned({ hod }: { hod: HodPayload }) {
  const Icon = hod.isSelf ? ShieldCheck : UserX
  return (
    <>
      {/* Phones: the app's centred empty card (68px tinted circle, 16px title, 13px muted line), no accent edge. */}
      <GlassCard
        variant="stitched"
        tone={hod.isSelf ? 'sapphire' : 'amber'}
        data-testid={hod.isSelf ? 'hod-self' : 'hod-unassigned'}
        className="max-md:border-l-[1px]! max-md:border-l-[var(--glass-border)]! max-md:p-6!"
      >
        <div role="status" className="flex items-start gap-4 max-md:flex-col max-md:items-center max-md:gap-2 max-md:text-center">
          <span
            aria-hidden="true"
            className={cn(
              'grid size-12 shrink-0 place-items-center rounded-xl border max-md:mb-1 max-md:size-[68px] max-md:rounded-full max-md:border-0 max-md:bg-accent max-md:text-primary',
              hod.isSelf ? 'border-info-border bg-info-bg text-info' : 'border-waiting-border bg-waiting-bg text-waiting',
            )}
          >
            <Icon className="size-6 max-md:size-8" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-[20px] font-semibold max-md:text-[16px]">{hod.isSelf ? 'You are a Department Head' : 'No Department Head assigned yet'}</h2>
            <p className="mt-1 text-[14px] text-foreground/85 max-md:text-[13px] max-md:leading-5 max-md:text-muted-foreground">{hod.message}</p>
          </div>
        </div>
      </GlassCard>
      <ContactBlockCard block={hod.hrContact} title="Contact HR" description={hod.contactNote} />
    </>
  )
}

// ---- The assigned head ----------------------------------------------------------------------------------------------

function Assigned({ hod, waiting, onOpenRequests }: { hod: HodPayload; waiting: number; onOpenRequests: () => void }) {
  const name = hod.name ?? 'Your Department Head'
  // The API sends '/media/...' paths: they live on the API's host, not on this site (lib/hod.ts::resolvePhotoUrl).
  const photo = resolvePhotoUrl(hod.photoUrl, API_BASE_URL, window.location.origin)
  const summary = approvalSummaryLine(hod.approvals)
  const counts = approvalCounts(hod.approvals)
  const sorted = [...hod.approvals].sort((a, b) => Number(b.canApprove) - Number(a.canApprove))

  return (
    <>
      <GlassCard variant="raised" padding="lg" data-testid="hod-card" className="relative overflow-hidden max-md:hidden">
        <div aria-hidden="true" className="weave-static pointer-events-none absolute -top-10 -right-10 size-48 rounded-full opacity-60" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
          <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 24 }} className="relative w-fit shrink-0">
            <span aria-hidden="true" className="bg-silk absolute -inset-[3px] rounded-[18px] opacity-80" />
            <Avatar className="relative size-24 rounded-2xl ring-2 ring-card sm:size-28">
              {photo && <AvatarImage src={photo} alt={`Photo of ${name}`} className="object-cover" />}
              <AvatarFallback className="rounded-2xl bg-primary/15 text-[28px] font-bold text-brand-blue">{initialsOf(hod.name)}</AvatarFallback>
            </Avatar>
          </motion.div>
          <div className="min-w-0 flex-1">
            <p className="label-caps text-brand-emerald">Your Department Head</p>
            <h2 className="font-display mt-1 text-[26px] leading-tight font-semibold break-words">{name}</h2>
            {(hod.designation || hod.employeeCode) && <p className="mt-0.5 text-[14px] text-muted-foreground">{[hod.designation, hod.employeeCode].filter(Boolean).join(' · ')}</p>}
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              {hod.department && <Detail icon={Building2} label="Department" value={hod.department} />}
              {hod.branch && <Detail icon={MapPin} label="Branch" value={hod.branch} />}
              {hod.phone && <ContactRow icon={Phone} label="Phone" value={hod.phone} href={dialHref(hod.phone)} action="Call" copied="Phone number copied" />}
              {hod.email && <ContactRow icon={Mail} label="Email" value={hod.email} href={mailHref(hod.email)} action="Email" copied="Email address copied" />}
            </dl>
            {!hod.phone && !hod.email && (
              <p className="mt-4 text-[13px] text-muted-foreground">No phone number or email is on file for your Department Head. Ask HR if you need to reach them.</p>
            )}
            {waiting > 0 && (
              <button
                type="button"
                onClick={onOpenRequests}
                className="focus-ring mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-waiting-border bg-waiting-bg px-3 text-[13px] font-semibold text-waiting transition-transform hover:-translate-y-0.5"
              >
                <Hourglass className="size-4" aria-hidden="true" />
                {waiting} of your {waiting === 1 ? 'requests is' : 'requests are'} waiting · see where {waiting === 1 ? 'it stands' : 'they stand'}
              </button>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Phones: the app's person card (same data; the desktop card above is hidden there). */}
      <PhoneHeadCard hod={hod} name={name} photo={photo} waiting={waiting} onOpenRequests={onOpenRequests} />

      <section aria-labelledby="hod-approvals-title" data-testid="hod-approvals" className="flex flex-col gap-4 max-md:hidden">
        <SectionHeader
          id="hod-approvals-title"
          icon={ShieldCheck}
          tone="emerald"
          title="What your Department Head can approve"
          description={summary || 'The list of approvals is not available right now. Ask HR which requests your Department Head decides.'}
        />
        {hod.approvals.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
            <GlassCard className="flex flex-row items-center gap-4 lg:flex-col lg:justify-center lg:text-center">
              <RingMeter value={counts.can} max={Math.max(1, counts.total)} silk size={112} label={`Your Department Head can approve ${counts.can} of ${counts.total} kinds of request`}>
                <span className="metric text-[28px] leading-none">{counts.can}</span>
                <span className="text-[11px] text-muted-foreground">of {counts.total}</span>
              </RingMeter>
              <p className="text-[13px] text-muted-foreground">
                kinds of request your Department Head decides.
                {counts.cannot > 0 && <span className="font-semibold text-foreground"> HR decides the other {counts.cannot}.</span>}
              </p>
            </GlassCard>
            <ul className="grid gap-3 md:grid-cols-2">
              {sorted.map((a, i) => (
                <motion.li key={a.key} {...listItem(i)}>
                  <ApprovalRow approval={a} />
                </motion.li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <PhoneApprovalsCard approvals={hod.approvals} summary={summary} />

      <ContactBlockCard block={hod.hrContact} title="Questions? Contact HR" description={hod.contactNote} />
    </>
  )
}

// ---- Phones (< 768px): the app's person card and approvals list ------------------------------------------------------

/** The mobile app's Department Head card: a 72px photo, the "Your Department Head" badge, the name, then one row per
 *  contact detail (round icon well, small label, value) with round call / copy / email buttons. Phone-only. */
function PhoneHeadCard({
  hod,
  name,
  photo,
  waiting,
  onOpenRequests,
}: {
  hod: HodPayload
  name: string
  photo: string | null
  waiting: number
  onOpenRequests: () => void
}) {
  const sub = [hod.designation, hod.department].filter(Boolean).join(' · ')
  const phoneHref = hod.phone ? dialHref(hod.phone) : ''
  const emailHref = hod.email ? mailHref(hod.email) : ''
  async function copyPhone() {
    if (!hod.phone) return
    const ok = await copyText(hod.phone)
    if (ok) toast.success('Phone number copied')
    else toast.error('Could not copy. Select the text and copy it by hand.')
  }
  const rows = (
    [
      ['Designation', hod.designation, BadgeCheck],
      ['Department', hod.department, Users],
      ['Branch', hod.branch, Building2],
    ] as const
  ).filter(([, value]) => !!value)

  return (
    <div className="hidden max-md:block max-md:rounded-xl max-md:border max-md:bg-card max-md:p-4 max-md:shadow-[var(--m-shadow-low)]">
      <div className="max-md:flex max-md:items-center max-md:gap-3.5">
        <Avatar className="max-md:size-[72px] max-md:border max-md:border-border">
          {photo && <AvatarImage src={photo} alt={`Photo of ${name}`} className="object-cover" />}
          <AvatarFallback className="max-md:bg-accent max-md:text-[24px] max-md:font-bold max-md:text-primary">{initialsOf(hod.name)}</AvatarFallback>
        </Avatar>
        <div className="max-md:min-w-0 max-md:flex-1">
          <p className="max-md:mb-1.5 max-md:inline-flex max-md:items-center max-md:gap-[5px] max-md:rounded-full max-md:bg-accent max-md:px-[9px] max-md:py-[3px] max-md:text-[10.5px] max-md:font-[800] max-md:text-primary">
            <ShieldCheck className="max-md:size-3" aria-hidden="true" /> Your Department Head
          </p>
          <h2 className="font-display max-md:line-clamp-2 max-md:text-[19px] max-md:leading-[25px] max-md:font-bold max-md:break-words">{name}</h2>
          {sub && <p className="max-md:mt-0.5 max-md:text-[12.5px] max-md:leading-[18px] max-md:text-muted-foreground">{sub}</p>}
        </div>
      </div>

      <div className="max-md:mt-3.5 max-md:flex max-md:flex-col max-md:gap-1">
        {hod.phone && (
          <div className="max-md:flex max-md:min-h-[52px] max-md:items-center max-md:gap-2.5 max-md:py-1">
            <PhoneDetail icon={Phone} label={phoneHref ? 'Phone · tap to call' : 'Phone'} value={hod.phone} href={phoneHref} tabular />
            {phoneHref && (
              <a
                href={phoneHref}
                aria-label={`Call ${name}`}
                className="focus-ring max-md:grid max-md:size-11 max-md:shrink-0 max-md:place-items-center max-md:rounded-full max-md:bg-approved-bg max-md:text-approved max-md:active:opacity-80"
              >
                <Phone className="max-md:size-[18px]" aria-hidden="true" />
              </a>
            )}
            <button
              type="button"
              onClick={copyPhone}
              aria-label={`Copy the phone number ${hod.phone}`}
              className="focus-ring max-md:grid max-md:size-11 max-md:shrink-0 max-md:place-items-center max-md:rounded-full max-md:bg-accent max-md:text-primary max-md:active:opacity-80"
            >
              <Copy className="max-md:size-[17px]" aria-hidden="true" />
            </button>
          </div>
        )}
        {hod.email && (
          <div className="max-md:flex max-md:min-h-[52px] max-md:items-center max-md:gap-2.5 max-md:py-1">
            <PhoneDetail icon={Mail} label="Email" value={hod.email} />
            {emailHref && (
              <a
                href={emailHref}
                aria-label={`Email ${name} at ${hod.email}`}
                className="focus-ring max-md:grid max-md:size-11 max-md:shrink-0 max-md:place-items-center max-md:rounded-full max-md:bg-info-bg max-md:text-info max-md:active:opacity-80"
              >
                <Mail className="max-md:size-[17px]" aria-hidden="true" />
              </a>
            )}
          </div>
        )}
        {rows.map(([label, value, Icon]) => (
          <div key={label} className="max-md:flex max-md:min-h-[52px] max-md:items-center max-md:py-1">
            <PhoneDetail icon={Icon} label={label} value={value ?? ''} />
          </div>
        ))}
      </div>
      {!hod.phone && !hod.email && (
        <p className="max-md:mt-2 max-md:text-[12.5px] max-md:text-muted-foreground">
          No phone number or email is on file for your Department Head. Ask HR if you need to reach them.
        </p>
      )}
      {waiting > 0 && (
        <button
          type="button"
          onClick={onOpenRequests}
          className="focus-ring max-md:mt-3 max-md:flex max-md:min-h-11 max-md:w-full max-md:items-center max-md:gap-2 max-md:rounded-lg max-md:bg-waiting-bg max-md:px-3 max-md:text-left max-md:text-[12.5px] max-md:font-semibold max-md:text-waiting max-md:active:opacity-85"
        >
          <Hourglass className="max-md:size-4 max-md:shrink-0" aria-hidden="true" />
          {waiting} of your {waiting === 1 ? 'requests is' : 'requests are'} waiting · see where {waiting === 1 ? 'it stands' : 'they stand'}
        </button>
      )}
    </div>
  )
}

function PhoneDetail({
  icon: Icon,
  label,
  value,
  href,
  tabular,
}: {
  icon: typeof Phone
  label: string
  value: string
  /** The value is itself the tap-to-call link (the round buttons repeat it as a bigger target). */
  href?: string
  tabular?: boolean
}) {
  const body = (
    <>
      <span aria-hidden="true" className="max-md:grid max-md:size-[34px] max-md:shrink-0 max-md:place-items-center max-md:rounded-full max-md:bg-accent max-md:text-primary">
        <Icon className="max-md:size-[17px]" />
      </span>
      <span className="max-md:min-w-0 max-md:flex-1">
        <span className="max-md:block max-md:text-[11px] max-md:font-semibold max-md:tracking-[0.2px] max-md:text-muted-foreground">{label}</span>
        <span className={cn('max-md:mt-px max-md:block max-md:text-[14px] max-md:font-semibold max-md:[overflow-wrap:anywhere]', tabular && 'tabular-nums')}>{value}</span>
      </span>
    </>
  )
  return href ? (
    <a href={href} className="focus-ring max-md:flex max-md:min-w-0 max-md:flex-1 max-md:items-center max-md:gap-3 max-md:self-stretch max-md:rounded-lg">
      {body}
    </a>
  ) : (
    <div className="max-md:flex max-md:min-w-0 max-md:flex-1 max-md:items-center max-md:gap-3">{body}</div>
  )
}

/** The mobile app's "What your Department Head can approve" card: one list, hairlines between rows, a green / red mark
 *  at the right of each. Phone-only (the desktop ring + grid is hidden there). */
function PhoneApprovalsCard({ approvals, summary }: { approvals: HodApproval[]; summary: string }) {
  return (
    <section
      aria-label="What your Department Head can approve"
      className="hidden max-md:block max-md:rounded-xl max-md:border max-md:bg-card max-md:p-4 max-md:shadow-[var(--m-shadow-low)]"
    >
      <h2 className="font-display max-md:text-[15px] max-md:font-semibold">What your Department Head can approve</h2>
      {summary && <p className="max-md:mt-[3px] max-md:text-[12px] max-md:leading-[17px] max-md:text-muted-foreground">{summary}</p>}
      {approvals.length === 0 ? (
        <p className="max-md:mt-[3px] max-md:text-[12px] max-md:leading-[17px] max-md:text-muted-foreground">
          The list of approvals is not available right now. Ask HR which requests your Department Head decides.
        </p>
      ) : (
        <ul className="max-md:mt-2">
          {approvals.map((a, i) => (
            <li key={a.key} className={cn('max-md:flex max-md:items-center max-md:gap-2.5 max-md:py-[11px]', i > 0 && 'max-md:border-t max-md:border-input')}>
              <div className="max-md:min-w-0 max-md:flex-1">
                <p className="max-md:text-[13.5px] max-md:leading-[19px] max-md:font-semibold">{a.label}</p>
                {!a.canApprove && a.reason && <p className="max-md:mt-0.5 max-md:text-[12px] max-md:leading-[17px] max-md:text-secondary-foreground">{a.reason}</p>}
                {a.path && <p className="max-md:mt-0.5 max-md:text-[11px] max-md:text-muted-foreground">Route: {a.path}</p>}
              </div>
              <span
                className={cn(
                  'max-md:inline-flex max-md:shrink-0 max-md:items-center max-md:gap-[5px] max-md:rounded-full max-md:px-[9px] max-md:py-[5px] max-md:text-[11px] max-md:font-[800]',
                  a.canApprove ? 'max-md:bg-approved-bg max-md:text-approved' : 'max-md:bg-rejected-bg max-md:text-rejected',
                )}
              >
                {a.canApprove ? <CheckCircle2 className="max-md:size-[15px]" aria-hidden="true" /> : <XCircle className="max-md:size-[15px]" aria-hidden="true" />}
                {a.canApprove ? 'Can approve' : 'HR decides'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ApprovalRow({ approval: a }: { approval: HodApproval }) {
  return (
    <div data-testid="hod-approval" data-can-approve={a.canApprove} className="glass flex h-full items-start gap-3 rounded-xl p-3 shadow-clay-sm">
      <span
        aria-hidden="true"
        className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border', a.canApprove ? 'border-approved-border bg-approved-bg text-approved' : 'border-neutral-border bg-neutral-bg text-neutral')}
      >
        {a.canApprove ? <Check className="size-4" /> : <X className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-[14.5px] font-semibold">{a.label}</p>
          {/* Words as well as an icon and a colour: the mark is never colour-only. */}
          <StatusPill tone={a.canApprove ? 'approved' : 'neutral'} size="sm" icon={false}>
            {a.canApprove ? 'Can approve' : 'HR decides'}
          </StatusPill>
        </div>
        {!a.canApprove && a.reason && <p className="mt-1 text-[13px] text-muted-foreground">{a.reason}</p>}
        {a.path && <p className="mt-1 text-[12px] text-muted-foreground">Route: {a.path}</p>}
      </div>
    </div>
  )
}

// ---- Small pieces ---------------------------------------------------------------------------------------------------

function Detail({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border hairline bg-foreground/[0.03] px-3 py-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
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
    <div className="flex flex-col gap-2.5 rounded-lg border hairline bg-foreground/[0.03] px-3 py-2.5 sm:col-span-2 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0">
          <dt className="label-caps text-muted-foreground">{label}</dt>
          <dd className="text-[14px] font-semibold tabular-nums [overflow-wrap:anywhere]">{value}</dd>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        {href && (
          <Button asChild variant="outline" size="sm" className="min-h-11 sm:min-h-8">
            <a href={href} data-testid={`hod-${label.toLowerCase()}-link`}>
              <Icon aria-hidden="true" /> {action}
            </a>
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={copy} disabled={busy} aria-label={`Copy ${label.toLowerCase()}`} className="min-h-11 sm:min-h-8">
          <Copy aria-hidden="true" /> Copy
        </Button>
      </div>
    </div>
  )
}
