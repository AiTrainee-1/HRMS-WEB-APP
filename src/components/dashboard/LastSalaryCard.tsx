import { Link } from 'wouter'
import { motion } from 'framer-motion'
import { ArrowDownCircle, Banknote, CheckCircle2, ChevronRight, Eye, EyeOff, Info, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GlassCard, MoneyText, SectionHeader, EASE_OUT, useReducedMotion } from '@/components/kit'
import { useSalaryPeriodsLite } from '@/hooks/useHomeSources'
import { useSalaryShown } from '@/hooks/useSalaryShown'
import { lastSalary } from '@/lib/home-attention'
import { cn } from '@/lib/utils'

const SHOW_KEY = 'uktex_home_salary_shown_v1'
const HIDDEN = '₹ • • • • •'

/**
 * "Last salary": what the newest slip paid, paid vs allocated, and what attendance cost, one click from the slip. The
 * same figures as the mobile app (GET /my/salary-insights: payable = the slip's net, loss = allocated - earned + late +
 * permission). Amounts are HIDDEN until the eye button shows them (an office PC is often seen by others); the choice is
 * remembered on this browser. Nothing renders until there is a slip, and a failed load renders nothing.
 */
export function LastSalaryCard() {
  const { data } = useSalaryPeriodsLite()
  const reduced = useReducedMotion()
  // Shared with My Insights below (hooks/useSalaryShown.ts): one eye shows or hides the amounts on both.
  const [shown, setShown] = useSalaryShown()
  const s = lastSalary(data)
  if (!s) return null

  const toggle = () => {
    const next = !shown
    setShown(next)
    try {
      localStorage.setItem(SHOW_KEY, next ? '1' : '0')
    } catch {
      /* only a preference */
    }
  }
  const money = (v: number | null) => (shown ? <MoneyText value={v} /> : <span aria-label="hidden amount">{HIDDEN}</span>)

  return (
    <>
      <GlassCard padding="lg" className="flex h-full flex-col gap-4 max-md:hidden">
        <SectionHeader
          as="h2"
          icon={Wallet}
          tone="emerald"
          title="Last salary"
          description={s.periodLabel}
          action={
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-pressed={shown}
              aria-label={shown ? 'Hide salary amounts' : 'Show salary amounts'}
              className="size-11 rounded-full sm:size-9"
            >
              {shown ? <EyeOff /> : <Eye />}
            </Button>
          }
        />

        <div>
          <p className="label-caps text-muted-foreground">Paid to you</p>
          <p className="metric mt-1 text-[34px] leading-none">
            {shown ? <MoneyText value={s.net} animate /> : <span aria-label="Amount hidden">{HIDDEN}</span>}
          </p>
        </div>

        {s.paidRatio != null && (
          <div>
            <div
              className="flex h-2.5 overflow-hidden rounded-full bg-rejected-bg"
              role="img"
              aria-label={`Earned ${Math.round(s.paidRatio * 100)} percent of the allocated salary`}
            >
              <motion.span
                className="h-full rounded-full bg-success"
                initial={reduced ? false : { width: 0 }}
                animate={{ width: `${s.paidRatio * 100}%` }}
                transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.2 }}
              />
            </div>
            <p className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-[12px] text-muted-foreground">
              <span>
                Earned {money(s.earned)} ({Math.round(s.paidRatio * 100)}%)
              </span>
              <span>Allocated {money(s.allocated)}</span>
            </p>
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
          {s.lossKind !== 'neutral' && (
            <p className={cn('flex items-center gap-1.5 text-[13px] font-semibold', s.lossKind === 'loss' ? 'text-rejected' : 'text-approved')}>
              {s.lossKind === 'loss' ? <ArrowDownCircle className="size-4" aria-hidden="true" /> : <CheckCircle2 className="size-4" aria-hidden="true" />}
              {s.lossKind === 'loss' ? (
                <span>
                  {money(s.lossAmount)} {s.lossLabel === 'late' ? 'late deduction' : 'lost to attendance'}
                </span>
              ) : (
                'Nothing lost to attendance'
              )}
            </p>
          )}
          <Button asChild variant="outline" size="sm" className="min-h-11 sm:min-h-8">
            <Link href={`/employee/salary/${s.slipId}`}>
              See slip <ChevronRight />
            </Link>
          </Button>
        </div>
        {s.hrChanged && (
          <p className="flex items-start gap-1.5 text-[12px] text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /> HR changed this pay after the slip. Open the slip for the details.
          </p>
        )}
      </GlassCard>

      {/* PHONE ONLY (< 768px): the mobile Home's last-salary card (src/components/home/LastSalaryCard.tsx) - green cash well,
          title + period, the eye button, the paid amount, the earned bar, what attendance cost and "See slip". Same state. */}
      <section
        aria-labelledby="m-salary-title"
        className="hidden max-md:mb-5 max-md:block max-md:rounded-xl max-md:border max-md:border-border max-md:bg-card max-md:p-3.5 max-md:shadow-[var(--m-shadow-low)]"
      >
        <div className="max-md:flex max-md:items-center max-md:gap-2.5">
          <span aria-hidden="true" className="max-md:grid max-md:size-9 max-md:shrink-0 max-md:place-items-center max-md:rounded-lg max-md:bg-approved-bg max-md:text-approved">
            <Banknote className="max-md:size-[18px]" />
          </span>
          <div className="max-md:min-w-0 max-md:flex-1">
            <h2 id="m-salary-title" className="max-md:font-[family-name:var(--font-display)] max-md:text-[15px] max-md:font-semibold">Last salary</h2>
            <p className="max-md:mt-px max-md:truncate max-md:text-[11px] max-md:text-muted-foreground">{s.periodLabel}</p>
          </div>
          <button
            type="button"
            onClick={toggle}
            aria-pressed={shown}
            aria-label={shown ? 'Hide salary amounts' : 'Show salary amounts'}
            className="focus-ring max-md:-mr-1.5 max-md:grid max-md:size-11 max-md:shrink-0 max-md:place-items-center max-md:rounded-full"
          >
            <span className="max-md:grid max-md:size-[34px] max-md:place-items-center max-md:rounded-full max-md:bg-muted max-md:text-secondary-foreground">
              {shown ? <EyeOff className="max-md:size-[18px]" aria-hidden="true" /> : <Eye className="max-md:size-[18px]" aria-hidden="true" />}
            </span>
          </button>
        </div>
        <p className="max-md:mt-3 max-md:flex max-md:items-baseline max-md:gap-1.5">
          <span className="max-md:truncate max-md:font-[family-name:var(--font-display)] max-md:text-[24px] max-md:leading-7 max-md:font-bold max-md:tracking-[-0.3px] max-md:tabular-nums">
            {shown ? <MoneyText value={s.net} /> : <span aria-label="Amount hidden">{HIDDEN}</span>}
          </span>
          <span className="max-md:text-[12px] max-md:font-semibold max-md:text-muted-foreground">paid</span>
        </p>
        {s.paidRatio != null && (
          <div
            className="max-md:mt-2.5 max-md:flex max-md:h-1.5 max-md:overflow-hidden max-md:rounded-full max-md:bg-rejected-bg"
            role="img"
            aria-label={`Earned ${Math.round(s.paidRatio * 100)} percent of the allocated salary`}
          >
            <span className="max-md:h-full max-md:bg-success" style={{ width: `${s.paidRatio * 100}%` }} />
          </div>
        )}
        <div className="max-md:mt-2.5 max-md:flex max-md:items-center max-md:gap-1">
          {s.lossKind !== 'neutral' && (
            <p className={cn('max-md:flex max-md:min-w-0 max-md:items-center max-md:gap-[5px] max-md:text-[12px] max-md:font-semibold', s.lossKind === 'loss' ? 'max-md:text-rejected' : 'max-md:text-approved')}>
              {s.lossKind === 'loss' ? <ArrowDownCircle className="max-md:size-3.5 max-md:shrink-0" aria-hidden="true" /> : <CheckCircle2 className="max-md:size-3.5 max-md:shrink-0" aria-hidden="true" />}
              <span className="max-md:truncate">
                {s.lossKind === 'loss' ? (
                  <>
                    {money(s.lossAmount)} {s.lossLabel === 'late' ? 'late deduction' : 'lost to attendance'}
                  </>
                ) : (
                  'Nothing lost to attendance'
                )}
              </span>
            </p>
          )}
          <span className="max-md:flex-1" aria-hidden="true" />
          <Link
            href={`/employee/salary/${s.slipId}`}
            className="focus-ring max-md:-my-2 max-md:flex max-md:min-h-11 max-md:shrink-0 max-md:items-center max-md:gap-0.5 max-md:rounded-full max-md:pl-2 max-md:text-[12px] max-md:font-semibold max-md:text-primary"
          >
            See slip <ChevronRight className="max-md:size-4" aria-hidden="true" />
          </Link>
        </div>
        {s.hrChanged && (
          <p className="max-md:mt-2 max-md:text-[11px] max-md:text-muted-foreground">HR changed this pay after the slip: open the slip for the details.</p>
        )}
      </section>
    </>
  )
}
