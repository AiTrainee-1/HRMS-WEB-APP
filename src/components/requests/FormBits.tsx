import * as React from 'react'
import { AlertCircle, Info, PowerOff, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SuccessCheck } from '@/components/kit'
import { cn } from '@/lib/utils'

/**
 * "Leave requests are switched off by HR right now." An amber notice (role="status"), shown on the page and in forms.
 * Phones: the app's WorkflowOffNote - a borderless amber box, 12px semibold.
 */
export function OffNotice({ text, className }: { text: string; className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-2.5 rounded-xl border border-waiting-border bg-waiting-bg px-4 py-3 text-sm text-waiting',
        'max-md:gap-2 max-md:border-transparent max-md:p-3 max-md:text-[12px] max-md:leading-[17px]',
        className,
      )}
    >
      <PowerOff className="mt-0.5 size-4 shrink-0 max-md:mt-px" aria-hidden="true" />
      <p className="font-medium max-md:font-semibold">{text}</p>
    </div>
  )
}

/** A problem in a form, in words, next to the action (role="alert" so it is read out when it appears). */
export function FormError({ children, id }: { children: React.ReactNode; id?: string }) {
  if (!children) return null
  return (
    <p id={id} role="alert" className="flex items-start gap-2 rounded-lg border border-rejected-border bg-rejected-bg px-3 py-2 text-[13px] font-medium text-rejected">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}

/** A gentle note in a form (amber = check this, sapphire = good to know). Never blocks. */
export function FormNote({ children, tone = 'info', icon: Icon = Info }: { children: React.ReactNode; tone?: 'info' | 'waiting'; icon?: LucideIcon }) {
  return (
    <p
      className={cn(
        'flex items-start gap-2 rounded-lg border px-3 py-2 text-[13px] leading-5',
        tone === 'waiting' ? 'border-waiting-border bg-waiting-bg text-waiting' : 'border-info-border bg-info-bg text-info',
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}

/** A small caps step label in a form: "1 · Which day?". Phones: the app's section label (muted caps, no step number). */
export function StepLabel({ n, children, id, hint }: { n?: number; children: React.ReactNode; id?: string; hint?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <p id={id} className="label-caps text-foreground/80 max-md:text-muted-foreground">
        {n != null && <span className="text-brand-blue max-md:hidden">{n} · </span>}
        {children}
      </p>
      {hint && <span className="text-xs text-muted-foreground max-md:text-[10.5px] max-md:font-semibold">{hint}</span>}
    </div>
  )
}

export interface Choice<V extends string> {
  value: V
  label: React.ReactNode
  hint?: React.ReactNode
  icon?: LucideIcon
  disabled?: boolean
  /** Why it cannot be picked (shown under it when disabled). */
  why?: string | null
}

/**
 * Pick one of a few options as big tiles. Real radio inputs under the hood (arrow keys move, the group is announced),
 * a sapphire ring + tick on the chosen one, a greyed tile with its reason when it cannot be picked.
 * Phones: the app's type cards - white card, 1.5px border, 34px icon well, radio at the right, the chosen one filled
 * sapphire; two or three columns stay side by side as the app's slot cards (icon and radio on top, words under).
 */
export function ChoiceTiles<V extends string>({
  name,
  value,
  onChange,
  choices,
  labelledBy,
  columns = 2,
  invalid,
}: {
  name: string
  value: V | '' | null
  onChange: (value: V) => void
  choices: readonly Choice<V>[]
  labelledBy: string
  columns?: 1 | 2 | 3 | 4
  invalid?: boolean
}) {
  const stacked = columns > 1
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-invalid={invalid || undefined}
      className={cn(
        'grid gap-2',
        columns === 1 && 'grid-cols-1',
        columns === 2 && 'grid-cols-1 min-[420px]:grid-cols-2 max-md:grid-cols-2',
        columns === 3 && 'grid-cols-1 sm:grid-cols-3 max-md:grid-cols-3',
        columns === 4 && 'grid-cols-2 sm:grid-cols-4',
      )}
    >
      {choices.map((c) => {
        const checked = value === c.value
        const Icon = c.icon
        return (
          <label
            key={c.value}
            className={cn(
              'group relative flex min-h-11 cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-[border-color,background-color,box-shadow,transform] duration-200',
              'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background',
              'max-md:border-[1.5px] max-md:p-3',
              stacked
                ? 'max-md:grid max-md:min-h-[76px] max-md:grid-cols-[1fr_auto] max-md:content-start max-md:gap-x-2 max-md:gap-y-1.5'
                : 'max-md:items-center max-md:gap-3',
              checked
                ? 'border-primary bg-primary/10 shadow-[0_6px_18px_-10px_rgb(37_99_235/0.8)] max-md:bg-primary max-md:text-primary-foreground max-md:shadow-none'
                : 'border-foreground/15 bg-foreground/[0.02] hover:border-primary/40 hover:bg-primary/[0.05] max-md:bg-card',
              !checked && !invalid && 'max-md:border-border',
              invalid && !checked && 'border-rejected-border',
              c.disabled && 'cursor-not-allowed opacity-55 hover:border-foreground/15 hover:bg-foreground/[0.02]',
            )}
          >
            <input
              type="radio"
              name={name}
              value={c.value}
              checked={checked}
              disabled={c.disabled}
              onChange={() => onChange(c.value)}
              className="sr-only"
            />
            {Icon && (
              <span
                className={cn(
                  'mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border transition-colors',
                  'max-md:mt-0 max-md:size-[34px] max-md:rounded-[10px] max-md:border-0',
                  stacked && 'max-md:col-start-1 max-md:row-start-1',
                  checked
                    ? 'border-primary/40 bg-primary/15 text-brand-blue max-md:bg-primary-foreground/[0.18] max-md:text-primary-foreground'
                    : 'border-foreground/10 text-muted-foreground max-md:bg-muted max-md:text-primary',
                )}
                aria-hidden="true"
              >
                <Icon className="size-4" />
              </span>
            )}
            <span className={cn('min-w-0 flex-1', stacked && 'max-md:col-span-2 max-md:row-start-2')}>
              <span className="block text-[13.5px] leading-5 font-semibold max-md:leading-[18px]">{c.label}</span>
              {c.hint && (
                <span className={cn('mt-0.5 block text-xs leading-4 text-muted-foreground max-md:text-[11px] max-md:leading-[15px]', checked && 'max-md:text-primary-foreground/80')}>
                  {c.hint}
                </span>
              )}
              {c.disabled && c.why && <span className="mt-1 block text-xs leading-4 font-medium text-foreground/75">{c.why}</span>}
            </span>
            <span
              aria-hidden="true"
              className={cn(
                'mt-1 grid size-4 shrink-0 place-items-center rounded-full border-2 transition-colors',
                'max-md:mt-0 max-md:size-5',
                stacked && 'max-md:col-start-2 max-md:row-start-1 max-md:self-center',
                checked ? 'border-primary bg-primary max-md:border-primary-foreground max-md:bg-transparent' : 'border-foreground/25 max-md:border-input',
              )}
            >
              {checked && <span className="size-1.5 rounded-full bg-white max-md:size-2.5 max-md:bg-primary-foreground" />}
            </span>
          </label>
        )
      })}
    </div>
  )
}

/** The "it was sent" state inside a dialog: the drawn tick, one sentence, what happens next, and Done. */
export function SentState({ title, detail, onDone }: { title: string; detail?: React.ReactNode; onDone: () => void }) {
  const done = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    done.current?.focus()
  }, [])
  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center" role="status">
      <SuccessCheck size={64} label={title} />
      <p className="font-display text-lg font-semibold">{title}</p>
      {detail && <p className="max-w-sm text-sm text-muted-foreground">{detail}</p>}
      <Button ref={done} onClick={onDone} className="mt-2 min-h-11 min-w-32">
        Done
      </Button>
    </div>
  )
}
