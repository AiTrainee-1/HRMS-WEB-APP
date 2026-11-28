import {
  AlertCircle,
  ArrowDownCircle,
  CheckCircle2,
  Hourglass,
  Info,
  MessageSquareText,
  OctagonX,
  Scale,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { SectionHeader, Timeline, formatWhen, type TimelineItem } from '@/components/kit'
import { cn } from '@/lib/utils'
import {
  remarksNotInSteps,
  reviewRows,
  roundingLine,
  storyFigures,
  waitingText,
  type AmountStory,
  type FigureTone,
  type ReviewRow,
} from '@/lib/advance-story'

const FIGURE_TONE: Record<FigureTone, string | undefined> = {
  plain: undefined,
  less: 'text-waiting',
  more: 'text-approved',
  rejected: 'text-rejected',
  waiting: 'text-muted-foreground',
}

const REVIEW_LOOK: Record<ReviewRow['tone'], { icon: LucideIcon; tone: TimelineItem['tone'] }> = {
  ok: { icon: CheckCircle2, tone: 'emerald' },
  less: { icon: ArrowDownCircle, tone: 'amber' },
  more: { icon: TrendingUp, tone: 'emerald' },
  rejected: { icon: OctagonX, tone: 'rose' },
  remark: { icon: MessageSquareText, tone: 'slate' },
}

/** One review decision on the thread: who decided and the amount, the stage (and round), the change, its remark once. */
function decisionItems(rows: readonly ReviewRow[]): TimelineItem[] {
  return rows.map((r) => ({
    key: r.key,
    title: r.title,
    time: r.at ? (formatWhen(r.at) ?? undefined) : undefined,
    description:
      r.meta || r.change || r.remark ? (
        <>
          {(r.meta || r.change) && <span className="block">{[r.meta, r.change].filter(Boolean).join(' · ')}</span>}
          {r.remark && <span className="mt-0.5 block break-words text-foreground/85 italic">“{r.remark}”</span>}
        </>
      ) : undefined,
    icon: REVIEW_LOOK[r.tone].icon,
    tone: REVIEW_LOOK[r.tone].tone,
    current: false,
  }))
}

/**
 * "How the amount was decided" (owner 2026-11-28; the mobile app's AmountStoryCard), in an application's details: what
 * was asked, the most the employee was eligible for and what it is based on, the amount before and after the Salary
 * Advance rounding, the final approved amount and how far it is from the ask; the rounding rule in the server's words (a
 * Term Loan: that it is not rounded); why it is lower than asked, or why it was rejected; every review decision by ROLE
 * (HR, Management, Auditor) with its remark shown once, next to it. All of it is the server's `amountStory`: while the
 * request waits the server sends only the ask, the limit and the rounding, and this says the rest comes once decided.
 */
export function AmountStorySection({ story }: { story: AmountStory }) {
  const figures = storyFigures(story)
  const rounding = roundingLine(story)
  const decisions = reviewRows(story)
  const extraRemarks = remarksNotInSteps(story)
  const waiting = waitingText(story)
  return (
    <section
      aria-label="How the amount was decided"
      className="flex flex-col gap-3 max-md:rounded-xl max-md:border max-md:p-3.5 max-md:shadow-[var(--m-shadow-low)]"
      data-testid="advance-amount-story"
    >
      <SectionHeader as="h3" icon={Scale} title="How the amount was decided" />
      <dl className="flex flex-col rounded-xl border border-border px-3">
        {figures.map((f) => (
          <div key={f.key} className="border-b hairline py-2 last:border-b-0 max-md:border-input" data-testid={`amount-story-${f.key}`}>
            <div className="flex items-baseline justify-between gap-3">
              <dt className={cn('min-w-0 text-[13px]', f.key === 'final' ? 'font-semibold' : 'text-muted-foreground')}>{f.label}</dt>
              <dd className={cn('shrink-0 font-bold tabular-nums', f.key === 'final' ? 'text-[16px]' : 'text-[14px]', FIGURE_TONE[f.tone])}>{f.value}</dd>
            </div>
            {f.sub && <dd className="mt-0.5 text-[12px] text-muted-foreground">{f.sub}</dd>}
          </div>
        ))}
      </dl>

      {rounding &&
        (rounding.tone === 'muted' ? (
          <p className="text-[12.5px] text-muted-foreground" data-testid="amount-story-rounding">
            {rounding.text}
          </p>
        ) : (
          <p
            className={cn(
              'flex items-start gap-2 rounded-lg border px-3 py-2 text-[13px]',
              rounding.tone === 'warn' ? 'border-rejected-border bg-rejected-bg text-rejected' : 'border-info-border bg-info-bg text-info',
            )}
            data-testid="amount-story-rounding"
          >
            {rounding.tone === 'warn' ? <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
            <span>{rounding.text}</span>
          </p>
        ))}

      {story.reductionReason && (
        <div className="rounded-lg border border-waiting-border bg-waiting-bg px-3 py-2 text-[13px] text-waiting" data-testid="amount-story-reduction">
          <p className="font-semibold">Why it is lower than asked</p>
          <p className="mt-0.5 break-words">{story.reductionReason}</p>
        </div>
      )}
      {story.rejectionReason && (
        <div className="rounded-lg border border-rejected-border bg-rejected-bg px-3 py-2 text-[13px] text-rejected" data-testid="amount-story-rejection">
          <p className="font-semibold">Why it was rejected</p>
          <p className="mt-0.5 break-words">{story.rejectionReason}</p>
        </div>
      )}

      {decisions.length > 0 && (
        <div className="flex flex-col gap-2" data-testid="amount-story-decisions">
          <p className="label-caps text-muted-foreground">Decisions and remarks</p>
          <Timeline items={decisionItems(decisions)} ariaLabel="Decisions and remarks" />
        </div>
      )}

      {extraRemarks.length > 0 && (
        <div className="flex flex-col gap-1.5" data-testid="amount-story-remarks">
          <p className="label-caps text-muted-foreground">Remarks</p>
          <ul className="flex flex-col gap-1.5 text-[13px]">
            {extraRemarks.map((r, i) => (
              <li key={`${r.role}-${i}`} className="break-words">
                <span className="font-semibold">{r.by}</span>
                {r.at && formatWhen(r.at) && <span className="text-[12px] text-muted-foreground"> · {formatWhen(r.at)}</span>}
                <span className="block italic">“{r.text}”</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {waiting && (
        <p className="flex items-center gap-2 text-[12.5px] text-muted-foreground" data-testid="amount-story-waiting">
          <Hourglass className="size-3.5 shrink-0" aria-hidden="true" />
          {waiting}
        </p>
      )}
    </section>
  )
}
