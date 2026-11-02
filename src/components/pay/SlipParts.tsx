import { motion } from 'framer-motion'
import { AlertTriangle, CalendarCheck, CheckCircle2, Clock, FileWarning, Minus, PenLine, Plus, ShieldCheck } from 'lucide-react'
import { EASE_OUT, GlassCard, MoneyText, RingMeter, SectionHeader, StatusPill, Waterfall } from '@/components/kit'
import { formatINR } from '@/lib/money'
import { cn } from '@/lib/utils'
import { attendanceFacts, plainCount, waterfallFor, type SalaryPeriod, type SalaryStep } from '@/lib/salary-insights'
import { PhoneCardTitle, PhoneLabel, PhoneRow } from './PhoneParts'

/**
 * The slip as a waterfall: monthly salary -> minus days not paid -> earned -> plus overtime -> minus late -> minus
 * permission -> minus PF / ESI / TDS / advance -> final payable, each line with the server's one sentence under it.
 * A line the slip does not record is listed underneath with the reason, never drawn as ₹0.
 * Phones (< 768px): the mobile app's rows instead (label + signed figure, a thin running bar, the note), a line the slip
 * does not record shown in place as "Not recorded".
 */
export function SlipWaterfall({ period: p }: { period: SalaryPeriod }) {
  const { chart, missing } = waterfallFor(p.steps)
  return (
    <div className="flex flex-col gap-4 max-md:gap-0">
      {chart.length > 0 ? (
        <Waterfall className="max-md:hidden" steps={chart} format={(n) => formatINR(n)} />
      ) : (
        <p className="text-sm text-muted-foreground">This slip does not record how the pay was worked out.</p>
      )}
      {missing.length > 0 && (
        <div className="rounded-lg border border-dashed border-foreground/15 p-3 max-md:hidden">
          <p className="label-caps text-muted-foreground">Not recorded on this slip</p>
          <ul className="mt-2 flex flex-col gap-1.5 text-[13px]">
            {missing.map((m) => (
              <li key={m.key || m.label}>
                <span className="font-semibold">{m.label}</span>
                {m.note && <span className="text-muted-foreground">: {m.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {chart.length > 0 && <PhoneWaterfall steps={p.steps} />}
      {!p.reconciles && chart.length > 0 && (
        <p className="flex items-start gap-2 text-[12.5px] text-muted-foreground max-md:mt-2.5 max-md:rounded-lg max-md:bg-waiting-bg max-md:p-2.5 max-md:text-[12px] max-md:leading-[17px] max-md:text-waiting">
          <FileWarning className="mt-0.5 size-4 shrink-0 max-md:hidden" aria-hidden="true" />
          <AlertTriangle className="hidden max-md:mt-px max-md:block max-md:size-[15px] max-md:shrink-0" aria-hidden="true" />
          These lines do not add up exactly on this older slip. The final payable shown is the figure the slip itself records.
        </p>
      )}
    </div>
  )
}

interface PhoneStepRow {
  step: SalaryStep
  from: number
  to: number
}

/** The running bar of each step as fractions 0..1 of the biggest running total (the mobile app's waterfallRows). */
function phoneRows(steps: readonly SalaryStep[]): PhoneStepRow[] {
  let running = 0
  let peak = 0
  const raw = steps.map((s) => {
    const amount = s.amount ?? 0
    let from = running
    let to = running
    if (s.op === 'start') {
      from = 0
      to = amount
      running = amount
    } else if (s.op === 'minus') {
      to = running - amount
      running = to
    } else if (s.op === 'plus') {
      to = running + amount
      running = to
    } else {
      from = 0
      to = amount
      running = amount
    }
    peak = Math.max(peak, from, to)
    return { step: s, from, to }
  })
  const scale = peak > 0 ? peak : 1
  const clamp = (n: number) => Math.max(0, Math.min(1, n))
  return raw.map(({ step, from, to }) => ({ step, from: clamp(Math.min(from, to) / scale), to: clamp(Math.max(from, to) / scale) }))
}

function phoneAmountText(s: SalaryStep): string {
  if (s.amount == null) return 'Not recorded'
  const a = Math.abs(s.amount)
  if (s.op === 'minus') return a ? `- ${formatINR(a)}` : formatINR(0)
  if (s.op === 'plus') return `+ ${formatINR(a)}`
  if (s.op === 'subtotal' || s.op === 'total') return `= ${formatINR(s.amount)}`
  return formatINR(s.amount)
}

const STEP_LOOK = {
  start: { text: 'max-md:text-muted-foreground', bar: 'var(--input)' },
  minus: { text: 'max-md:text-rejected', bar: 'var(--destructive)' },
  plus: { text: 'max-md:text-approved', bar: 'var(--success)' },
  subtotal: { text: 'max-md:text-primary', bar: 'var(--primary)' },
  total: { text: 'max-md:text-primary', bar: 'var(--primary)' },
} as const

function PhoneWaterfall({ steps }: { steps: readonly SalaryStep[] }) {
  const rows = phoneRows(steps)
  return (
    <ol className="hidden max-md:block" aria-label="How your pay was worked out">
      {rows.map(({ step: s, from, to }, i) => {
        const strong = s.op === 'start' || s.op === 'subtotal' || s.op === 'total'
        const quiet = s.amount == null || (s.op === 'minus' && !s.amount)
        const look = STEP_LOOK[s.op]
        return (
          <li
            key={`${s.key}-${i}`}
            className={cn(
              'max-md:flex max-md:flex-col max-md:gap-[5px] max-md:border-b max-md:border-input max-md:py-[9px]',
              s.op === 'total' && 'max-md:mt-1.5 max-md:rounded-lg max-md:border-b-0 max-md:bg-accent max-md:px-2.5',
            )}
          >
            <div className="max-md:flex max-md:items-baseline max-md:justify-between max-md:gap-2.5">
              <span className={cn('max-md:flex-1 max-md:text-[13px]', strong && 'max-md:font-semibold')}>{s.label || 'Line'}</span>
              <span
                className={cn(
                  'max-md:shrink-0 max-md:text-[13px] max-md:font-bold max-md:tabular-nums',
                  strong && 'max-md:text-[14.5px] max-md:font-[800]',
                  quiet ? 'max-md:text-muted-foreground' : look.text,
                )}
              >
                {phoneAmountText(s)}
              </span>
            </div>
            <div className="max-md:relative max-md:h-1.5 max-md:overflow-hidden max-md:rounded-full max-md:bg-muted" aria-hidden="true">
              {to > from && (
                <motion.span
                  className="max-md:absolute max-md:inset-y-0 max-md:origin-left max-md:rounded-full"
                  style={{ left: `${from * 100}%`, width: `${(to - from) * 100}%`, background: look.bar }}
                  initial={{ opacity: 0, scaleX: 0.6 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  transition={{ duration: 0.38, ease: EASE_OUT, delay: Math.min(i, 10) * 0.045 }}
                />
              )}
            </div>
            {s.note && <p className="max-md:text-[11.5px] max-md:leading-4 max-md:text-muted-foreground">{s.note}</p>}
          </li>
        )
      })}
    </ol>
  )
}

/** Only when HR added a bonus or changed the deductions after the slip was made. */
export function ChangedByHrCard({ period: p }: { period: SalaryPeriod }) {
  const pr = p.payroll
  if (!pr?.hrChanged) return null
  return (
    <GlassCard variant="raised" className="flex flex-col gap-3 border-waiting-border max-md:gap-0 max-md:border-border max-md:p-4">
      <SectionHeader
        className="max-md:hidden"
        as="h3"
        icon={PenLine}
        tone="amber"
        title="Changed by HR after this slip"
        description="HR changed this month's payroll after the slip was made. The slip above shows what it said at the time."
      />
      <PhoneCardTitle icon={PenLine} tone="info" title="Changed by HR after this slip" />
      <p className="hidden max-md:mb-1 max-md:block max-md:text-[12px] max-md:leading-[17px] max-md:text-secondary-foreground">
        HR changed this month&apos;s payroll after the slip was made. The slip above shows what it said at the time. Ask HR if anything is
        unclear.
      </p>
      <dl className="grid grid-cols-2 gap-3 text-[13px] max-md:hidden sm:grid-cols-3">
        {pr.bonus !== 0 && (
          <div>
            <dt className="text-muted-foreground">Bonus added</dt>
            <dd className="font-bold">
              <MoneyText value={pr.bonus} sign tone="auto" />
            </dd>
          </div>
        )}
        {pr.deductionChange !== 0 && (
          <div>
            <dt className="text-muted-foreground">Deductions changed by</dt>
            <dd className="font-bold">
              <MoneyText value={pr.deductionChange} sign />
            </dd>
          </div>
        )}
        <div>
          <dt className="text-muted-foreground">Payroll now pays</dt>
          <dd className="font-bold">
            <MoneyText value={pr.net} />
          </dd>
        </div>
      </dl>
      <div className="hidden max-md:block">
        {pr.bonus !== 0 && (
          <PhoneRow label="Bonus added by HR" value={`${pr.bonus > 0 ? '+ ' : '- '}${formatINR(Math.abs(pr.bonus))}`} tone={pr.bonus > 0 ? 'gain' : 'loss'} />
        )}
        {pr.deductionChange !== 0 && (
          <PhoneRow
            label="Change to deductions"
            value={`${pr.deductionChange > 0 ? '- ' : '+ '}${formatINR(Math.abs(pr.deductionChange))}`}
            tone={pr.deductionChange > 0 ? 'loss' : 'gain'}
          />
        )}
        <PhoneRow label="Amount on the payroll now" value={formatINR(pr.net)} highlight />
      </div>
      {pr.statusLabel && (
        <StatusPill status={pr.status} size="sm" className="max-md:mt-2">
          Payroll: {pr.statusLabel}
        </StatusPill>
      )}
    </GlassCard>
  )
}

const CELL_TONE = {
  good: 'max-md:text-approved',
  bad: 'max-md:text-rejected',
  warn: 'max-md:text-waiting',
} as const

/** The attendance behind the pay: a ring of days paid (staff) or shifts worked (production) and the counts as text.
 *  Phones: the app's "ATTENDANCE BEHIND THIS PAY" label over a grid of small count cards (four a row). */
export function AttendanceCard({ period: p }: { period: SalaryPeriod }) {
  const facts = attendanceFacts(p)
  const c = p.counts
  const production = p.kind === 'production'
  const ringValue = production ? c.daysWorked : c.paidDays
  const ringMax = production ? c.totalDays : c.workingDays
  const cells: { label: string; value: string; tone?: keyof typeof CELL_TONE }[] = production
    ? [
        { label: 'Days in period', value: plainCount(c.totalDays) },
        { label: 'Days worked', value: plainCount(c.daysWorked) },
        { label: 'Absent', value: plainCount(c.absentDays), tone: 'bad' },
        { label: 'Shifts earned', value: plainCount(c.totalShifts), tone: 'good' },
        { label: 'Late days', value: plainCount(c.lateInDays ?? c.lateMarks), tone: 'warn' },
        { label: 'Rate / shift', value: c.ratePerShift != null ? formatINR(c.ratePerShift) : '—' },
      ]
    : [
        { label: 'Working days', value: plainCount(c.workingDays) },
        { label: 'Days paid', value: plainCount(c.paidDays), tone: 'good' },
        { label: 'Absent', value: plainCount(c.absentDays), tone: 'bad' },
        { label: 'Half days', value: plainCount(c.halfDays) },
        { label: 'Late marks', value: plainCount(c.lateMarks), tone: 'warn' },
        { label: 'Permissions', value: plainCount(c.permissionsApproved) },
        { label: 'Paid leave', value: plainCount(c.paidLeaveDays) },
        { label: 'Unpaid leave', value: plainCount(c.unpaidLeaveDays) },
      ]
  return (
    <GlassCard className="flex flex-col gap-4 max-md:gap-2 max-md:border-0! max-md:bg-transparent! max-md:p-0! max-md:shadow-none!">
      <SectionHeader className="max-md:hidden" as="h3" icon={CalendarCheck} tone="emerald" title="Attendance on this slip" />
      <PhoneLabel as="h3" className="max-md:mt-1">
        ATTENDANCE BEHIND THIS PAY
      </PhoneLabel>
      {facts.length === 0 ? (
        <p className="text-sm text-muted-foreground">This slip does not record attendance counts.</p>
      ) : (
        <>
          <div className="flex flex-col items-center gap-5 max-md:hidden sm:flex-row sm:items-start">
            {ringValue != null && ringMax != null && ringMax > 0 && (
              <RingMeter
                value={ringValue}
                max={ringMax}
                tone="emerald"
                label={production ? 'Days worked in the period' : 'Days paid of working days'}
              >
                <span className="metric text-2xl">{plainCount(ringValue)}</span>
                <span className="text-[11px] text-muted-foreground">of {plainCount(ringMax)} days</span>
              </RingMeter>
            )}
            <dl className="grid w-full flex-1 grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
              {facts.map((f) => (
                <div key={f.key} className="min-w-0">
                  <dt className="text-muted-foreground">{f.label}</dt>
                  <dd className="text-[15px] font-bold tabular-nums">{f.value}</dd>
                  {f.hint && <dd className="text-[12px] text-muted-foreground">{f.hint}</dd>}
                </div>
              ))}
            </dl>
          </div>
          <dl className="hidden max-md:flex max-md:flex-wrap max-md:gap-2">
            {cells.map((cell) => (
              <div
                key={cell.label}
                className="max-md:flex max-md:grow max-md:basis-[22%] max-md:flex-col-reverse max-md:items-center max-md:gap-0.5 max-md:rounded-lg max-md:border max-md:bg-card max-md:px-1 max-md:py-3 max-md:shadow-[var(--m-shadow-low)]"
              >
                <dt className="max-md:text-center max-md:text-[9.5px] max-md:leading-3 max-md:font-bold max-md:text-muted-foreground">{cell.label}</dt>
                <dd
                  className={cn(
                    'max-md:font-[family-name:var(--font-display)] max-md:text-[17px] max-md:leading-6 max-md:font-bold max-md:tabular-nums',
                    cell.tone && cell.value !== '—' && CELL_TONE[cell.tone],
                  )}
                >
                  {cell.value}
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </GlassCard>
  )
}

/** Phones only: what the slip pays you before deductions (the app's "Earnings on the slip"). */
export function PhoneEarningsCard({ period: p }: { period: SalaryPeriod }) {
  const production = p.kind === 'production'
  return (
    <GlassCard className="hidden max-md:block max-md:p-4">
      <PhoneCardTitle icon={Plus} tone="emerald" title="Earnings on the slip" />
      {production ? (
        <PhoneRow label="Pay for shifts worked" value={formatINR(p.earnedGross)} highlight />
      ) : (
        <>
          {p.allocated != null && <PhoneRow label="Monthly salary" sub="Your full salary for the month" value={formatINR(p.allocated)} />}
          <PhoneRow label="Salary earned" sub="For the days you were paid" value={formatINR(p.earnedGross)} highlight />
        </>
      )}
      {p.otPay > 0 && <PhoneRow label="Overtime pay" value={`+ ${formatINR(p.otPay)}`} tone="gain" />}
    </GlassCard>
  )
}

/** Phones only: the deductions on the slip as rows, ending with the slip's own total (the app's "Deductions & Recoveries"). */
export function PhoneDeductionsCard({ period: p }: { period: SalaryPeriod }) {
  const staff = p.kind !== 'production'
  return (
    <GlassCard className="hidden max-md:block max-md:p-4">
      <PhoneCardTitle icon={Minus} tone="rose" title="Deductions & Recoveries" />
      <PhoneRow label="Provident Fund (PF)" value={formatINR(p.pf)} />
      <PhoneRow label="Employee State Insurance (ESI)" value={formatINR(p.esi)} />
      {p.tds > 0 && <PhoneRow label="Income tax (TDS)" sub={p.tdsPercent != null ? `${plainCount(p.tdsPercent)}%` : undefined} value={formatINR(p.tds)} />}
      <PhoneRow label="Advance / loan recovery" value={formatINR(p.advance)} />
      {staff && p.lateDeduction != null && <PhoneRow label="Late deduction" value={formatINR(p.lateDeduction)} />}
      {staff && p.permissionDeduction != null && <PhoneRow label="Permission deduction" value={formatINR(p.permissionDeduction)} />}
      {p.otherDeductions > 0 && <PhoneRow label="Other deductions" value={formatINR(p.otherDeductions)} />}
      <PhoneRow label="Total deductions" value={formatINR(p.totalDeductions)} highlight />
    </GlassCard>
  )
}

/** Phones only: the figures-come-from-payroll note under the slip. */
export function PhoneVerifyNote() {
  return (
    <p className="hidden max-md:flex max-md:gap-2 max-md:rounded-xl max-md:bg-muted max-md:p-3 max-md:text-[11px] max-md:leading-4 max-md:text-muted-foreground">
      <ShieldCheck className="max-md:size-4 max-md:shrink-0" aria-hidden="true" />
      Every figure on this page is what the UKTextiles payroll stored for this slip. If something looks wrong, please contact HR.
    </p>
  )
}

/** Phones only: the slip's final payable as the app's sapphire card (in PageHero's KPI grid, both columns). */
export function PhoneNetHero({ period: p }: { period: SalaryPeriod }) {
  const production = p.kind === 'production'
  const pr = p.payroll
  const hint =
    p.attendanceLoss != null
      ? p.attendanceLoss > 0
        ? `Attendance cost you ${formatINR(p.attendanceLoss)} this period.`
        : 'You lost nothing to attendance this period.'
      : production && p.lateDeduction != null
        ? p.lateDeduction > 0
          ? `Late arrivals cost you ${formatINR(p.lateDeduction)} this period.`
          : 'No late deduction this period.'
        : null
  return (
    <div className="hidden max-md:col-span-2 max-md:flex max-md:flex-col max-md:gap-2 max-md:rounded-xl max-md:bg-primary max-md:p-[18px] max-md:text-white max-md:shadow-[var(--m-shadow-low)] max-md:dark:bg-[#1d4ed8]">
      <p className="max-md:text-[10.5px] max-md:font-[800] max-md:tracking-[0.06em] max-md:text-white/75">FINAL PAYABLE SALARY</p>
      <MoneyText value={p.netPayable} className="max-md:font-[family-name:var(--font-display)] max-md:text-[30px] max-md:leading-9 max-md:font-bold max-md:tracking-[-0.4px]" />
      {pr && (pr.statusLabel || pr.status) && (
        <p className="max-md:flex max-md:items-center max-md:gap-[5px] max-md:text-[12px] max-md:font-bold max-md:text-white/90">
          {pr.status === 'paid' ? <CheckCircle2 className="max-md:size-3.5" aria-hidden="true" /> : <Clock className="max-md:size-3.5" aria-hidden="true" />}
          {pr.statusLabel || (pr.status === 'paid' ? 'Paid' : 'Not paid yet')}
        </p>
      )}
      {hint && <p className="max-md:text-[12px] max-md:leading-[17px] max-md:text-white/85">{hint}</p>}
    </div>
  )
}
