import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { BellRing, CalendarDays, CheckCircle2, Clock, Coffee, DoorOpen, IdCard, LogIn, LogOut, Pin, Plus, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  GlassCard,
  KpiTile,
  PageHero,
  PageShell,
  SectionHeader,
  SegmentedControl,
  StatusPill,
  deciderFromFields,
  useRequestViews,
  viewCounts,
  type ViewOptions,
} from '@/components/kit'
import { GatePassCard } from '@/components/employee/GatePassCard'
import { TeaBreakPanel } from '@/components/employee/TeaBreakPanel'
import { FocusMissNote } from '@/components/requests/FocusMissNote'
import { OffNotice } from '@/components/requests/FormBits'
import { OpenPassBanner } from '@/components/requests/OpenPassBanner'
import { OutpassApplyDialog } from '@/components/requests/OutpassApplyDialog'
import { RequestCard } from '@/components/requests/RequestCard'
import { RequestList } from '@/components/requests/RequestList'
import { HERO_NO_KPIS_ON_PHONE } from '@/components/requests/phone'
import { showView } from '@/components/requests/show-view'
import { employeeApi } from '@/api/resources'
import type { OutpassRow } from '@/api/requests-api'
import type { GatePass } from '@/api/onduty-actions'
import { useAuth } from '@/context/AuthContext'
import { useApprovalWorkflow } from '@/hooks/useApprovalSummary'
import { useFocusItem } from '@/hooks/useFocusItem'
import { useNowTick, useOutpassRequests } from '@/hooks/useOutpassRequests'
import { useSelectedMonth } from '@/hooks/useSelectedMonth'
import { pipelineSentence } from '@/lib/approval'
import { currentMonth, inMonthText, monthOf, monthViewLabel } from '@/lib/month-switch'
import { istDateOf, outpassDay, outpassPassDay, outpassViewOptions } from '@/lib/my-requests'
import { personFromEmployee } from '@/lib/gate-pass'
import { outpassRowLabel, passTypeLabel, pickOpenPass, pickPendingPass } from '@/lib/outpass-open'

type Section = 'outpass' | 'teaBreak'

const time = (iso: string | null | undefined) => (iso ? format(new Date(iso), 'h:mm a') : null)

export default function Outpass() {
  const { user } = useAuth()
  const [section, setSection] = React.useState<Section>('outpass')
  const [applyOpen, setApplyOpen] = React.useState(false)
  const [previewId, setPreviewId] = React.useState<string | null>(null)
  // The pipeline HR configured for outpasses, and the note when HR has switched them off.
  const { workflow, offNote } = useApprovalWorkflow('outpass')
  const pipeline = pipelineSentence(workflow, 'outpass request')

  const list = useOutpassRequests()
  const employee = useQuery({
    queryKey: ['employee', user?.employeeId],
    queryFn: () => employeeApi.get(user!.employeeId),
    enabled: !!user,
  })
  // Re-checks every 10 s which pass is open, so a pass whose 60-minute exit window ran out stops being pinned.
  const now = useNowTick(10_000)
  const items = list.data ?? []
  const baseOptions = outpassViewOptions<OutpassRow>(new Date(now))
  // The month switcher (owner 2026-11-02), one month for both sections: the outpass views hold only the passes of the
  // chosen month (the day the employee went out, else the day it was asked); Tea Break lists that month's breaks. The
  // pinned open gate pass is about right now and stays.
  const [month, setMonth] = useSelectedMonth()
  const viewOptions: ViewOptions<OutpassRow> = { ...baseOptions, scope: { ...month, daysOf: outpassPassDay } }
  const views = useRequestViews(list.data, viewOptions)
  // The KPI tiles follow the month on screen too (owner 2026-11-02): the four views' counts of that month; a tile opens
  // its view in that month. The Outpass tab's badge keeps counting every pass still waiting, whatever its month.
  const inMonth = inMonthText(month)
  const waitingAnyMonth = viewCounts(items, baseOptions).waiting
  // A notification's View button opens ?focus=<outpass id>: the Outpass tab, its month, the view holding it, scrolled to
  // and ringed.
  const focus = useFocusItem({ scope: 'outpass', rows: list.data, idOf: (r) => r.id, views, viewOptions, setMonth, reveal: () => setSection('outpass') })
  // The gate pass open right now - out and not back yet, or approved with its exit QR still valid (a manual request or
  // one an On-Duty approval raised). Pinned at the top (owner 2026-10-31).
  // Only an APPROVED pass is open (owner 2026-11-24: no QR before approval). With none open, today's newest pass still
  // waiting for approval is pinned instead (an On-Duty's pass appears the moment the On-Duty is submitted).
  const openPass = pickOpenPass(items, now)
  const pendingPass = openPass ? null : pickPendingPass(items, now)
  const person = personFromEmployee(employee.data)
  // Looked up by id, so the card follows a refresh (a return QR just made, a gate scan).
  const preview = previewId ? (items.find((i) => i.id === previewId) ?? null) : null

  return (
    <>
      <PageShell>
        {/* Phones: the mobile app's "Gate Outpass" sub-header over both sections, the Outpass / Tea Break bar under it, no
            KPI tiles (the counts are on the four count cards above the list). */}
        <PageHero
          icon={section === 'outpass' ? <DoorOpen /> : <Coffee />}
          className={section === 'outpass' ? HERO_NO_KPIS_ON_PHONE : undefined}
          title={
            <>
              <span className="max-md:hidden">{section === 'outpass' ? 'Outpass' : 'Tea Break'}</span>
              <span className="hidden max-md:inline">Gate Outpass</span>
            </>
          }
          subtitle={
            <>
              <span className="max-md:hidden">
                {section === 'outpass'
                  ? 'Ask to step out of the factory during work hours. Once approved, show the QR at the gate.'
                  : 'Scan your own permanent QR at the gate when you go for tea and when you come back. No approval needed.'}
              </span>
              <span className="hidden max-md:inline">Digital Transit Clearance</span>
            </>
          }
          actions={
            section === 'outpass' ? (
              <Button size="lg" onClick={() => setApplyOpen(true)} disabled={!!offNote} className="max-md:h-11 max-md:px-5 max-md:text-[13.5px] max-md:font-semibold">
                <Plus aria-hidden="true" /> Ask for an outpass
              </Button>
            ) : undefined
          }
          kpis={
            section === 'outpass' ? (
              <>
                <KpiTile label="Waiting" value={list.data ? views.counts.waiting : null} icon={Clock} tone="amber" hint={`for a decision · ${inMonth}`} onClick={() => showView(views, 'waiting', 'outpass')} />
                <KpiTile label={monthViewLabel(month)} value={list.data ? views.counts.month : null} icon={CalendarDays} tone="sapphire" hint="every pass · any status" onClick={() => showView(views, 'month', 'outpass')} />
                <KpiTile label="Approved" value={list.data ? views.counts.approved : null} icon={CheckCircle2} tone="emerald" hint={inMonth} onClick={() => showView(views, 'approved', 'outpass')} />
                <KpiTile label="Rejected" value={list.data ? views.counts.rejected : null} icon={XCircle} tone="rose" hint={inMonth} onClick={() => showView(views, 'rejected', 'outpass')} />
              </>
            ) : undefined
          }
        >
          <div className="flex flex-col gap-3">
            <SegmentedControl<Section>
              ariaLabel="Outpass or Tea Break"
              value={section}
              onChange={setSection}
              options={[
                { value: 'outpass', label: 'Outpass', icon: DoorOpen, count: waitingAnyMonth || undefined },
                { value: 'teaBreak', label: 'Tea Break', icon: Coffee },
              ]}
            />
            {section === 'outpass' && offNote && <OffNotice text={offNote} />}
          </div>
        </PageHero>

        {section === 'outpass' && openPass && (
          <section aria-labelledby="open-pass-title" className="flex flex-col gap-4 max-md:gap-2">
            <SectionHeader
              id="open-pass-title"
              icon={Pin}
              tone="emerald"
              title={
                <>
                  <span className="max-md:hidden">Open gate pass</span>
                  {/* Phones: the app's small pinned label. */}
                  <span className="hidden max-md:inline max-md:font-[family-name:var(--font-label)] max-md:text-[10.5px] max-md:font-black max-md:tracking-[0.08em] max-md:text-primary">
                    OPEN GATE PASS
                  </span>
                </>
              }
              description="Pinned while you can use it or until you are back."
              className="max-md:[&_p]:hidden max-md:[&_svg]:size-3.5 max-md:[&_svg]:text-primary"
            />
            {/* Phones: no card around the pinned pass - the banner and the flip card sit on the page, as in the app. */}
            <GlassCard
              variant="stitched"
              tone="emerald"
              className="grid gap-5 max-md:gap-2.5 max-md:border-0! max-md:bg-transparent! max-md:p-0! max-md:shadow-none! lg:grid-cols-[1fr_minmax(0,420px)] lg:items-start"
            >
              <div className="flex flex-col gap-3">
                <OpenPassBanner pass={openPass} />
                <dl className="grid grid-cols-2 gap-3 text-[13px]">
                  <div className="min-w-0">
                    <dt className="label-caps text-muted-foreground">Going to</dt>
                    <dd className="truncate font-semibold">{openPass.destination}</dd>
                  </div>
                  {passTypeLabel(openPass.passType) && (
                    <div className="min-w-0">
                      <dt className="label-caps text-muted-foreground">Pass</dt>
                      <dd className="truncate font-semibold">{passTypeLabel(openPass.passType)}</dd>
                    </div>
                  )}
                  {openPass.exitedAt && (
                    <div>
                      <dt className="label-caps text-muted-foreground">Went out</dt>
                      <dd className="font-semibold">
                        {time(openPass.exitedAt)}
                        {openPass.exitGateName ? ` · ${openPass.exitGateName}` : ''}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
              <GatePassCard pass={openPass as GatePass} person={person} />
            </GlassCard>
          </section>
        )}

        {section === 'outpass' && pendingPass && (
          <section aria-labelledby="pending-pass-title" className="flex flex-col gap-4 max-md:gap-2">
            <SectionHeader
              id="pending-pass-title"
              icon={BellRing}
              tone="amber"
              title={
                <>
                  <span className="max-md:hidden">Waiting for approval</span>
                  <span className="hidden max-md:inline max-md:font-[family-name:var(--font-label)] max-md:text-[10.5px] max-md:font-black max-md:tracking-[0.08em] max-md:text-waiting">
                    WAITING FOR APPROVAL
                  </span>
                </>
              }
              description="Your newest pass of today. Its QR appears on the card as soon as it is approved."
              className="max-md:[&_p]:hidden max-md:[&_svg]:size-3.5 max-md:[&_svg]:text-waiting"
            />
            <GlassCard
              variant="stitched"
              tone="amber"
              className="grid gap-5 max-md:gap-2.5 max-md:border-0! max-md:bg-transparent! max-md:p-0! max-md:shadow-none! lg:grid-cols-[1fr_minmax(0,420px)] lg:items-start"
            >
              <div className="flex flex-col gap-3">
                <dl className="grid grid-cols-2 gap-3 text-[13px]">
                  <div className="min-w-0">
                    <dt className="label-caps text-muted-foreground">Going to</dt>
                    <dd className="truncate font-semibold">{pendingPass.destination}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="label-caps text-muted-foreground">Pass</dt>
                    <dd className="truncate font-semibold">{pendingPass.source === 'on_duty' ? 'On-Duty' : (passTypeLabel(pendingPass.passType) ?? 'Gate pass')}</dd>
                  </div>
                  <div>
                    <dt className="label-caps text-muted-foreground">Asked</dt>
                    <dd className="font-semibold">{time(pendingPass.createdAt)}</dd>
                  </div>
                </dl>
                <p className="text-[13px] text-muted-foreground">
                  {pendingPass.source === 'on_duty'
                    ? 'This pass came with your On-Duty request. It is approved (or not) together with the On-Duty; until then it is not valid at the gate.'
                    : 'Not valid at the gate yet. You will see the QR here once HR / your Department Head approves it.'}
                </p>
              </div>
              <GatePassCard pass={pendingPass as GatePass} person={person} onRefresh={() => list.refetch()} refreshing={list.isRefetching} />
            </GlassCard>
          </section>
        )}

        {section === 'outpass' ? (
          <RequestList<OutpassRow>
            id="outpass"
            title="Your outpasses"
            description="Newest first. Open a card to see the pass a guard would check."
            icon={DoorOpen}
            noun="outpasses"
            monthKind="taken"
            labels={{ month: 'Taken this month' }}
            views={views}
            monthSwitch={{ onChange: setMonth }}
            query={list}
            keyOf={(r) => r.id}
            dateOf={(r) => outpassDay(r)}
            notice={focus.missing ? <FocusMissNote onDismiss={focus.dismiss} /> : undefined}
            emptyIcon={DoorOpen}
            emptyAction={
              <Button variant="outline" onClick={() => setApplyOpen(true)} disabled={!!offNote}>
                <Plus aria-hidden="true" /> Ask for an outpass
              </Button>
            }
            renderItem={(r) => {
              const badge = outpassRowLabel(r)
              const isOpen = openPass?.id === r.id
              const kind = passTypeLabel(r.passType)
              return (
                <RequestCard
                  icon={DoorOpen}
                  tone={isOpen ? 'emerald' : 'sapphire'}
                  highlight={isOpen}
                  title={r.destination}
                  when={
                    <>
                      {format(new Date(r.createdAt), 'EEE, d MMM yyyy · h:mm a')}
                      {(kind || r.source === 'on_duty') && <span className="text-foreground/75"> · {r.source === 'on_duty' ? 'From On-Duty' : kind}</span>}
                      {r.source === 'on_duty' && r.status === 'pending' && <span className="text-waiting"> · On-Duty, QR after approval</span>}
                    </>
                  }
                  pill={<StatusPill tone={badge.tone} size="sm">{badge.label}</StatusPill>}
                  reason={r.reason}
                  status={r.status}
                  approval={r.approval}
                  sentAt={r.createdAt}
                  comment={r.reviewComment}
                  fallback={deciderFromFields({ status: r.status, name: r.approvedBy, role: r.approverRole === 'system' ? null : r.approverRole, at: r.approvedAt })}
                  footer={
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-foreground/10 pt-2.5">
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-muted-foreground">
                        {r.exitedAt && (
                          <span className="inline-flex items-center gap-1">
                            <LogOut className="size-3.5" aria-hidden="true" /> Out {time(r.exitedAt)}
                          </span>
                        )}
                        {r.enteredAt && (
                          <span className="inline-flex items-center gap-1">
                            <LogIn className="size-3.5" aria-hidden="true" /> Back {time(r.enteredAt)}
                          </span>
                        )}
                        {r.expectedReturnAt && !r.enteredAt && <span>Back by {time(r.expectedReturnAt)}</span>}
                      </div>
                      <Button variant="ghost" size="sm" className="min-h-11 gap-1.5 sm:min-h-8" onClick={() => setPreviewId(r.id)} aria-label={`Open the pass card for ${r.destination}`}>
                        <IdCard aria-hidden="true" /> Open card
                      </Button>
                    </div>
                  }
                />
              )
            }}
          />
        ) : (
          <section aria-label="Tea Break">
            <TeaBreakPanel month={month} onMonthChange={setMonth} />
          </section>
        )}
      </PageShell>

      <OutpassApplyDialog
        open={applyOpen}
        onOpenChange={setApplyOpen}
        pipeline={pipeline}
        offNote={offNote}
        // The new request: its month (the India day it was asked), in Waiting.
        onSent={(day) => {
          setMonth(monthOf(istDateOf(day)) ?? currentMonth())
          views.setView('waiting')
        }}
      />

      {/* The pass card of any request, any status, opened from its row */}
      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreviewId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gate pass</DialogTitle>
            <DialogDescription>The pass a guard checks at the gate. Download it as a picture if you need to.</DialogDescription>
          </DialogHeader>
          {preview && <GatePassCard pass={preview as GatePass} person={person} onRefresh={() => list.refetch()} refreshing={list.isRefetching} />}
        </DialogContent>
      </Dialog>
    </>
  )
}
