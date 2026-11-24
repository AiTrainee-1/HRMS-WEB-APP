import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { format, isValid, parseISO } from 'date-fns'
import {
  Banknote, CalendarClock, ChevronDown, CircleHelp, Ellipsis, FileText, Info, MessageCircleQuestion, PauseCircle, Plus, UserRoundCog, Umbrella,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  EmptyState, ErrorState, GlassCard, PageHero, PageShell, SegmentedControl, SkeletonList, StatusPill, collapse, listItem,
  type StatusTone,
} from '@/components/kit'
import { TextareaField } from '@/components/employee/TextareaField'
import { FocusMissNote } from '@/components/requests/FocusMissNote'
import { ChoiceTiles, FormError, SentState, StepLabel } from '@/components/requests/FormBits'
import { PHONE_BUTTON_ROW, PHONE_FIELD_LABEL, PHONE_NO_CANCEL, PHONE_SUBMIT } from '@/components/requests/phone'
import { ApiError } from '@/api/client'
import { useFocusItem } from '@/hooks/useFocusItem'
import { useMyEnquiries, useRaiseEnquiry } from '@/hooks/useEnquiries'
import {
  ENQUIRY_CATEGORIES, ENQUIRY_FILTERS, MESSAGE_MAX, SUBJECT_MAX, enquiryCounts, enquiryProblem, enquiryStatusOf, filterEnquiries, statusWords,
  type Enquiry, type EnquiryFilter, type EnquiryStatus,
} from '@/lib/enquiries'
import { focusKey } from '@/lib/focus-item'
import { cn } from '@/lib/utils'
import { isQueued } from '@/offline/submit'

const CATEGORY_ICON: Record<string, LucideIcon> = {
  general: CircleHelp,
  salary: Banknote,
  attendance: CalendarClock,
  leave: Umbrella,
  documents: FileText,
  other: Ellipsis,
}

const STATUS_TONE: Record<EnquiryStatus, { tone: StatusTone; icon?: LucideIcon; text: string }> = {
  pending: { tone: 'waiting', text: 'text-waiting' },
  on_hold: { tone: 'info', icon: PauseCircle, text: 'text-info' },
  done: { tone: 'approved', text: 'text-approved' },
}

/** "24 Nov 2026, 10:05 AM" for an ISO time; '' when there is none. */
function when(iso: string | null): string {
  if (!iso) return ''
  const d = parseISO(iso)
  return isValid(d) ? format(d, 'd MMM yyyy, h:mm a') : ''
}

/**
 * Enquiries (owner 2026-11-24; the mobile app's "Ask HR" was replaced by it): raise a question or concern to HR and follow
 * it - Pending, On Hold, Done - with HR's reply and every update. HR handles them on the HR portal's Enquiries page; each
 * change comes as a notification whose View opens the enquiry here (?focus=<id>: all filters, scrolled to it, ringed).
 */
export default function Enquiries() {
  const list = useMyEnquiries()
  const [filter, setFilter] = React.useState<EnquiryFilter>('all')
  const [newOpen, setNewOpen] = React.useState(false)

  const all = list.data
  const counts = enquiryCounts(all ?? [])
  const shown = filterEnquiries(all ?? [], filter)
  const focus = useFocusItem({
    scope: 'enquiry',
    rows: all,
    idOf: (e) => e.id,
    // A filter that hides the enquiry would leave nothing to ring: show them all.
    reveal: (e) => setFilter((f) => (f === 'all' || f === enquiryStatusOf(e.status) ? f : 'all')),
  })

  return (
    <>
      <PageShell>
        <PageHero
          icon={<MessageCircleQuestion />}
          title="Enquiries"
          subtitle={
            <>
              <span className="max-md:hidden">Ask HR a question or raise a concern, and follow the answer here.</span>
              <span className="hidden max-md:inline">Ask HR and track the answer</span>
            </>
          }
          actions={
            <Button size="lg" onClick={() => setNewOpen(true)} className="max-md:h-11 max-md:px-5 max-md:text-[13.5px] max-md:font-semibold">
              <Plus aria-hidden="true" /> New enquiry
            </Button>
          }
        />

        <GlassCard className="flex items-start gap-3 text-[13.5px] text-muted-foreground max-md:gap-2 max-md:border-0! max-md:bg-accent! max-md:p-3! max-md:text-[12.5px] max-md:leading-[18px] max-md:text-foreground max-md:shadow-none!">
          <Info className="mt-0.5 size-4 shrink-0 text-info max-md:text-primary" aria-hidden="true" />
          <p>
            Raise any question or concern for HR. You can follow it here: Pending, On Hold or Done, with HR's answer. You also get a
            notification when HR updates it. For leave, permission or an advance, use their own pages.
          </p>
        </GlassCard>

        <section aria-labelledby="enquiries-title" className="flex flex-col gap-4 max-md:gap-3">
          <h2 id="enquiries-title" className="sr-only">
            Your enquiries
          </h2>
          <SegmentedControl
            ariaLabel="Show enquiries"
            value={filter}
            onChange={setFilter}
            options={ENQUIRY_FILTERS.map((f) => ({ value: f.key, label: f.label, count: all ? counts[f.key] : undefined }))}
          />
          {focus.missing && <FocusMissNote onDismiss={focus.dismiss}>That enquiry is no longer in your list.</FocusMissNote>}

          {list.isPending ? (
            <SkeletonList variant="cards" count={3} label="Loading your enquiries" />
          ) : list.isError && !all ? (
            <ErrorState error={list.error} what="your enquiries" onRetry={() => void list.refetch()} retrying={list.isFetching} />
          ) : shown.length === 0 ? (
            <EmptyState
              icon={MessageCircleQuestion}
              title={filter === 'all' ? 'No enquiries yet' : 'Nothing here'}
              description={filter === 'all' ? 'Ask HR anything with “New enquiry”.' : 'Try another filter.'}
              action={
                filter === 'all' ? (
                  <Button variant="outline" onClick={() => setNewOpen(true)}>
                    <Plus aria-hidden="true" /> New enquiry
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul className="grid gap-3 max-md:gap-2.5 lg:grid-cols-2">
              {shown.map((e, i) => (
                <motion.li key={e.id} {...listItem(i)} className="min-w-0" data-focus-key={focusKey('enquiry', e.id)}>
                  <EnquiryCard item={e} />
                </motion.li>
              ))}
            </ul>
          )}
        </section>
      </PageShell>
      <NewEnquiryDialog open={newOpen} onOpenChange={setNewOpen} onSent={() => setFilter('all')} />
    </>
  )
}

function EnquiryCard({ item }: { item: Enquiry }) {
  const [historyOpen, setHistoryOpen] = React.useState(false)
  const panelId = React.useId()
  const status = enquiryStatusOf(item.status)
  const tone = STATUS_TONE[status]
  const words = statusWords(item)
  const Icon = CATEGORY_ICON[item.category] ?? MessageCircleQuestion
  const raised = when(item.createdAt)
  const answeredAt = when(item.handledAt)
  return (
    <GlassCard className="flex h-full flex-col gap-3 max-md:gap-2 max-md:p-3.5!" data-testid={`enquiry-${item.id}`}>
      <div className="flex items-center gap-3 max-md:gap-2.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-info-border bg-info-bg text-info max-md:size-8 max-md:rounded-[10px] max-md:border-0" aria-hidden="true">
          <Icon className="size-[18px] max-md:size-4" />
        </span>
        <p className="label-caps min-w-0 flex-1 truncate text-muted-foreground">{item.categoryLabel}</p>
        <StatusPill tone={tone.tone} icon={tone.icon} size="sm">
          {words.label}
        </StatusPill>
      </div>
      <h3 className="text-[15px] leading-5 font-semibold break-words max-md:text-[14px] max-md:leading-[18px]">{item.subject}</h3>
      {item.message && <p className="text-[13.5px] leading-5 break-words whitespace-pre-line text-foreground/85 max-md:text-[12.5px] max-md:leading-[18px]">{item.message}</p>}
      <p className={cn('text-[13px] font-semibold max-md:text-[12px]', tone.text)}>{words.employeeText}</p>

      {item.hrReply && (
        <div className="flex items-start gap-2.5 rounded-lg border hairline bg-foreground/[0.03] p-3 max-md:border-0 max-md:bg-muted">
          <UserRoundCog className="mt-0.5 size-4 shrink-0 text-brand-blue" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-muted-foreground">
              HR{item.handledBy ? ` (${item.handledBy})` : ''}
              {answeredAt ? ` · ${answeredAt}` : ''}
            </p>
            <p className="mt-0.5 text-[13.5px] leading-5 break-words whitespace-pre-line max-md:text-[12.5px] max-md:leading-[18px]">{item.hrReply}</p>
          </div>
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-1">
        <p className="text-[12px] text-muted-foreground max-md:text-[11px]">
          Raised {raised || 'recently'} · #{item.id}
        </p>
        {item.history.length > 0 && (
          <button
            type="button"
            aria-expanded={historyOpen}
            aria-controls={historyOpen ? panelId : undefined}
            onClick={() => setHistoryOpen((v) => !v)}
            className="focus-ring -mx-1 inline-flex min-h-11 items-center gap-1 rounded-md px-1 text-[12.5px] font-semibold text-brand-blue sm:min-h-8"
          >
            <ChevronDown className={cn('size-4 transition-transform duration-200', historyOpen && 'rotate-180')} aria-hidden="true" />
            {historyOpen ? 'Hide updates' : `Updates (${item.history.length})`}
          </button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {historyOpen && (
          <motion.div id={panelId} key="history" variants={collapse} initial="hidden" animate="show" exit="hidden" className="overflow-hidden">
            <ol className="flex flex-col gap-2 rounded-lg bg-foreground/[0.03] p-3 max-md:bg-muted">
              {item.history.map((h, i) => (
                <li key={i} className="text-[12.5px] leading-5 text-muted-foreground">
                  <span className="font-semibold text-foreground">{statusWords({ status: h.status, statusLabel: h.status }).label}</span>
                  {` · ${h.by}`}
                  {when(h.at) ? ` · ${when(h.at)}` : ''}
                  {h.reply && <span className="block break-words text-foreground/85 italic">“{h.reply}”</span>}
                </li>
              ))}
            </ol>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  )
}

function NewEnquiryDialog({ open, onOpenChange, onSent }: { open: boolean; onOpenChange: (open: boolean) => void; onSent: () => void }) {
  const raise = useRaiseEnquiry()
  const [category, setCategory] = React.useState('general')
  const [subject, setSubject] = React.useState('')
  const [message, setMessage] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [sent, setSent] = React.useState(false)

  // Every opening starts fresh.
  React.useEffect(() => {
    if (!open) return
    setCategory('general')
    setSubject('')
    setMessage('')
    setError(null)
    setSent(false)
  }, [open])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const problem = enquiryProblem(subject, message)
    if (problem) return setError(problem)
    setError(null)
    raise.mutate(
      { category, subject, message },
      {
        onSuccess: (result) => {
          if (isQueued(result)) {
            toast.info('Saved on this device', { description: 'It will be sent automatically when you are back online.' })
            onOpenChange(false)
            onSent()
            return
          }
          setSent(true)
          toast.success('Enquiry sent to HR')
          onSent()
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not send it. Please try again.'),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !raise.isPending && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{sent ? 'Enquiry sent' : 'New enquiry'}</DialogTitle>
          {!sent && <DialogDescription>HR reads it on their Enquiries list and replies here.</DialogDescription>}
        </DialogHeader>
        {sent ? (
          <SentState
            title="Your enquiry was sent to HR."
            detail="You will get a notification when HR updates it."
            onDone={() => onOpenChange(false)}
          />
        ) : (
          <form onSubmit={submit} noValidate className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <StepLabel n={1} id="enquiry-topic">What is it about?</StepLabel>
              <ChoiceTiles
                name="enquiry-topic"
                labelledBy="enquiry-topic"
                value={category}
                columns={2}
                onChange={(v) => {
                  setCategory(v)
                  setError(null)
                }}
                choices={ENQUIRY_CATEGORIES.map((c) => ({ value: c.key, label: c.label, hint: c.hint, icon: CATEGORY_ICON[c.key] }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="enquiry-subject" className={PHONE_FIELD_LABEL}>
                Subject
              </Label>
              <Input
                id="enquiry-subject"
                value={subject}
                maxLength={SUBJECT_MAX}
                placeholder="In a few words"
                autoComplete="off"
                onChange={(e) => {
                  setSubject(e.target.value)
                  setError(null)
                }}
              />
            </div>
            <TextareaField
              id="enquiry-message"
              label="Details"
              rows={5}
              maxLength={MESSAGE_MAX}
              value={message}
              placeholder="Anything that helps HR answer (optional)"
              onChange={(e) => {
                setMessage(e.target.value)
                setError(null)
              }}
            />
            <FormError>{error}</FormError>
            <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', PHONE_BUTTON_ROW)}>
              <Button type="button" variant="ghost" className={cn('min-h-11 sm:min-h-9', PHONE_NO_CANCEL)} onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" className={cn('min-h-11 sm:min-h-9', PHONE_SUBMIT)} disabled={raise.isPending}>
                {raise.isPending ? 'Sending…' : 'Send to HR'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
