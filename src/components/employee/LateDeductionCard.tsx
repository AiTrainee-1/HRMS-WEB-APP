import type { ReactNode } from 'react'
import { AlarmClock, AlertCircle, Hand, LogOut, MinusCircle, type LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { resolveDeductionPool } from '@/lib/deductions'
import { cn } from '@/lib/utils'
import type { DeductionPreview } from '@/types'

function Stat({ label, value, alert }: { label: string; value: ReactNode; alert?: boolean }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={`text-xl font-bold ${alert ? 'text-destructive' : ''}`}>{value}</p>
    </div>
  )
}

const WELL = {
  amber: 'max-md:bg-waiting-bg max-md:text-waiting',
  violet: 'max-md:bg-violet-bg max-md:text-violet',
  sapphire: 'max-md:bg-accent max-md:text-primary',
  rose: 'max-md:bg-rejected-bg max-md:text-rejected',
  emerald: 'max-md:bg-approved-bg max-md:text-approved',
} as const

/** Phones (< 768px): one figure of the mobile app's deduction grid - a 32px tinted circle, the number, a tiny label. */
function PhoneStat({ label, value, icon: Icon, tone }: { label: string; value: ReactNode; icon: LucideIcon; tone: keyof typeof WELL }) {
  return (
    <div className="max-md:flex max-md:w-1/4 max-md:flex-col-reverse max-md:items-center max-md:gap-1.5 max-md:py-1.5">
      <dt className="max-md:px-0.5 max-md:text-center max-md:text-[9px] max-md:leading-3 max-md:font-semibold max-md:text-muted-foreground">{label}</dt>
      <dd className="max-md:text-[15px] max-md:leading-5 max-md:font-black max-md:tabular-nums">{value}</dd>
      <dd aria-hidden="true" className={cn('max-md:grid max-md:size-8 max-md:place-items-center max-md:rounded-full', WELL[tone])}>
        <Icon className="max-md:size-4" />
      </dd>
    </div>
  )
}

/** The monthly late-deduction preview, shared by My Shift and the Permission
 * page. Same numbers HR sees on their Report Log. With a current backend it
 * shows the whole pool (late-ins + early-outs + excess permissions); with an
 * older one, or for a Production employee, the shorter classic view.
 * Phones: the mobile app's "Late & Permission Deductions" card (My Shift) -
 * icon figures four to a row and the salary impact on its own line. */
export function LateDeductionCard({
  deductions, monthlyLimit, lateCount,
}: {
  deductions: DeductionPreview
  /** Allowed-permission cap from a permission row, used only if the stats carry none. */
  monthlyLimit?: number
  /** Total late days; shown only when there is no late-in / early-out split. */
  lateCount?: number
}) {
  const { freeAllowance, permissionCap, breakdown, showLateIn, showEarlyOut } = resolveDeductionPool(deductions, monthlyLimit)
  // Only name the kinds of occurrence the company actually checks.
  const kinds = [showLateIn && 'morning late-ins', showEarlyOut && 'evening early-outs', 'Overdue / Excess permissions']
    .filter((k): k is string => !!k)
  const kindList = kinds.length > 1 ? `${kinds.slice(0, -1).join(', ')} and ${kinds[kinds.length - 1]}` : kinds[0]
  const money = deductions.salaryDeductionAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const billable = deductions.billableLateCount
  const shiftCut = deductions.shiftDeductions

  const outcome = (
    <>
      <Stat label="Billable" value={deductions.billableLateCount} alert={deductions.billableLateCount > 0} />
      <Stat label="Shift Deductions" value={deductions.shiftDeductions} alert={deductions.shiftDeductions > 0} />
      <Stat label="Salary Impact" value={`₹${money}`} alert={deductions.salaryDeductionAmount > 0} />
    </>
  )

  const phoneOutcome = (
    <>
      <PhoneStat label="Free Allowance" value={`${deductions.permissionsUsed}/${freeAllowance}`} icon={Hand} tone="sapphire" />
      <PhoneStat label="Billable" value={billable} icon={AlertCircle} tone={billable > 0 ? 'rose' : 'emerald'} />
      <PhoneStat label="Shift Deductions" value={shiftCut} icon={MinusCircle} tone={shiftCut > 0 ? 'rose' : 'emerald'} />
    </>
  )

  const phoneImpact = (
    <p className="hidden max-md:mt-2.5! max-md:mb-0! max-md:flex max-md:items-center max-md:justify-between max-md:border-t max-md:border-input max-md:pt-3">
      <span className="max-md:text-[13px] max-md:font-bold max-md:text-secondary-foreground">Salary Impact</span>
      <span
        className={cn(
          'max-md:text-[18px] max-md:font-black max-md:tabular-nums',
          deductions.salaryDeductionAmount > 0 ? 'max-md:text-rejected' : 'max-md:text-primary',
        )}
      >
        ₹{money}
      </span>
    </p>
  )

  return (
    <Card className="max-md:gap-1 max-md:p-4 max-md:shadow-[var(--m-shadow-low)]!">
      <CardHeader className="max-md:px-0">
        <CardTitle className="text-base max-md:mb-1 max-md:text-[14px] max-md:leading-5">
          <span className="max-md:hidden">Lateness & Deductions</span>
          <span className="hidden max-md:inline">Late & Permission Deductions</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0 max-md:space-y-2 max-md:px-0">
        {breakdown ? (
          <>
            <p className="text-xs text-muted-foreground max-md:text-[11.5px] max-md:leading-4">
              Your monthly pool counts {kindList} together. The first {freeAllowance} each month are free; every
              one after that is billable and can cost a shift deduction from your salary.
            </p>
            <p className="text-xs text-muted-foreground max-md:text-[11.5px] max-md:leading-4">
              Only your first {permissionCap} approved permissions each month are Allowed. Any beyond that are
              Overdue / Excess: they do not protect the day and are counted here.
              {' '}These figures are what counts toward deductions, so they can be lower than the days flagged late
              or early on your attendance: a day that also has an Excess permission on the same side is counted
              once, as that permission, and non-working days are left out.
            </p>
            <dl className="hidden max-md:flex max-md:flex-wrap">
              {showLateIn && <PhoneStat label="Late-Ins" value={breakdown.lateIn} icon={AlarmClock} tone="amber" />}
              {showEarlyOut && <PhoneStat label="Early-Outs" value={breakdown.earlyOut} icon={LogOut} tone="violet" />}
              <PhoneStat label="Excess Permissions" value={breakdown.excess} icon={AlertCircle} tone="amber" />
              {phoneOutcome}
            </dl>
            {phoneImpact}
            <div className="grid grid-cols-2 gap-3 max-md:hidden sm:grid-cols-4">
              {showLateIn && <Stat label="Late-Ins" value={breakdown.lateIn} />}
              {showEarlyOut && <Stat label="Early-Outs" value={breakdown.earlyOut} />}
              <Stat label="Excess Permissions" value={breakdown.excess} />
              <Stat label="Free Allowance Used" value={`${deductions.permissionsUsed}/${freeAllowance}`} />
            </div>
            <div className="grid grid-cols-2 gap-3 max-md:hidden sm:grid-cols-4">{outcome}</div>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground max-md:text-[11.5px] max-md:leading-4">
              You get {freeAllowance} free lates/permissions per month (combined). Every 3 beyond that costs a
              ¼ shift deduction from salary.
            </p>
            <dl className="hidden max-md:flex max-md:flex-wrap">
              {lateCount != null && <PhoneStat label="Late Count" value={lateCount} icon={AlarmClock} tone="amber" />}
              {phoneOutcome}
            </dl>
            {phoneImpact}
            <div className="grid grid-cols-2 gap-3 max-md:hidden sm:grid-cols-4">
              {lateCount != null && <Stat label="Late Count" value={lateCount} />}
              <Stat label="Free Allowance Used" value={`${deductions.permissionsUsed}/${freeAllowance}`} />
              {outcome}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
