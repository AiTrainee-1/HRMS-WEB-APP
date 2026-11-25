import * as React from 'react'
import { Link } from 'wouter'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronRight, Lock, type LucideIcon } from 'lucide-react'
import { GlassCard, TONE_SOFT, TONE_TEXT, collapse, listItem, type Tone } from '@/components/kit'
import { cn } from '@/lib/utils'

/*
 * The pieces the My Profile page is built from (owner 2026-11-25 redesign, after the mobile app's
 * src/components/profile/ProfileParts.tsx): a section card (optionally collapsible), label / value items, quick stat chips
 * and settings rows. Kit tokens only, so both themes and the phone skin follow.
 */

/** A small pill in a section's header ("Confirmed", "2 members"). */
export interface SectionBadge {
  label: string
  tone: Tone
}

/**
 * One group of the record ("Personal details", "Bank & compliance"): a tinted icon well, the title and a one-line
 * subtitle, an optional badge / lock, and - when `collapsible` - a chevron that opens and closes it (the body slides).
 */
export function ProfileSection({
  id,
  icon: Icon,
  tone = 'sapphire',
  title,
  subtitle,
  badge,
  locked,
  collapsible = true,
  defaultOpen = true,
  children,
}: {
  id: string
  icon: LucideIcon
  tone?: Tone
  title: string
  subtitle?: string
  badge?: SectionBadge | null
  locked?: boolean
  collapsible?: boolean
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(!collapsible || defaultOpen)
  const titleId = `${id}-title`
  const bodyId = `${id}-body`

  const head = (
    <>
      <span aria-hidden="true" className={cn('grid size-10 shrink-0 place-items-center rounded-xl border max-md:size-9 max-md:border-0', TONE_SOFT[tone])}>
        <Icon className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="font-display block text-[17px] leading-6 font-semibold max-md:text-[15px] max-md:leading-5">{title}</span>
        {subtitle && <span className="mt-0.5 block truncate text-[12.5px] font-normal text-muted-foreground max-md:text-[11.5px]">{subtitle}</span>}
      </span>
      {badge && (
        <span className={cn('shrink-0 rounded-full border px-2.5 py-0.5 text-[11.5px] font-bold max-md:border-0 max-md:py-1 max-md:text-[10.5px]', TONE_SOFT[badge.tone])}>
          {badge.label}
        </span>
      )}
      {locked && <Lock className="size-4 shrink-0 text-muted-foreground" aria-label="Private" />}
      {collapsible && (
        <ChevronDown
          className={cn('size-5 shrink-0 text-muted-foreground transition-transform duration-200', open && 'rotate-180')}
          aria-hidden="true"
        />
      )}
    </>
  )

  return (
    <GlassCard asChild padding="none" className="overflow-hidden">
      <section aria-labelledby={titleId}>
        <h2 id={titleId} className="m-0">
          {collapsible ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls={bodyId}
              className="focus-ring flex min-h-14 w-full items-center gap-3 rounded-xl px-5 py-4 text-left transition-colors hover:bg-foreground/[0.03] max-md:gap-2.5 max-md:px-4 max-md:py-3.5 max-md:active:bg-foreground/[0.04]"
            >
              {head}
            </button>
          ) : (
            <span className="flex min-h-14 w-full items-center gap-3 px-5 py-4 max-md:gap-2.5 max-md:px-4 max-md:py-3.5">{head}</span>
          )}
        </h2>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div key="body" id={bodyId} variants={collapse} initial="hidden" animate="show" exit="hidden" className="overflow-hidden">
              <div className="border-t hairline px-5 pt-4 pb-5 max-md:px-4 max-md:pt-1 max-md:pb-2">{children}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </GlassCard>
  )
}

/** The grid an InfoItem list sits in: two columns from `sm`, one list with dividers on phones. */
export function InfoGrid({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 max-md:grid-cols-1! max-md:gap-0">{children}</dl>
}

/**
 * One label / value: a muted icon, the label, the value (or "Not on record"), and an optional action at the end (call,
 * email). `wide` spans both columns (an address). `mono` sets the value in tabular figures (codes, numbers).
 */
export function InfoItem({
  icon: Icon,
  label,
  value,
  hint,
  mono,
  wide,
  action,
}: {
  icon?: LucideIcon
  label: string
  value?: string | null
  /** A small muted note after the value ("(36 yrs)", "3 yrs 2 mos"). */
  hint?: string | null
  mono?: boolean
  wide?: boolean
  action?: React.ReactNode
}) {
  const shown = value != null && String(value).trim() !== '' ? String(value) : null
  return (
    <div
      className={cn(
        'flex min-w-0 items-start gap-3 rounded-xl bg-foreground/[0.03] px-3.5 py-3 dark:bg-white/[0.03]',
        'max-md:rounded-none max-md:border-b max-md:border-input max-md:bg-transparent! max-md:px-0 max-md:py-3 max-md:last:border-b-0',
        wide && 'sm:col-span-2 max-md:col-span-1!',
      )}
    >
      {Icon && <Icon className="mt-0.5 size-[18px] shrink-0 text-muted-foreground" aria-hidden="true" />}
      <div className="min-w-0 flex-1">
        <dt className="label-caps text-muted-foreground max-md:text-[11px]! max-md:font-semibold! max-md:tracking-[0.1px]! max-md:normal-case!">{label}</dt>
        <dd
          className={cn(
            'mt-1 text-[14.5px] font-semibold break-words max-md:mt-0.5 max-md:text-[14px]',
            mono && 'font-label tabular-nums',
            !shown && 'font-normal text-muted-foreground',
          )}
        >
          {shown ?? 'Not on record'}
          {shown && hint && <span className="ml-1.5 text-[12.5px] font-normal text-muted-foreground">{hint}</span>}
        </dd>
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  )
}

/** A small round action at the end of an item: a tel: / mailto: link. */
export function RowAction({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <a
      href={href}
      aria-label={label}
      title={label}
      className="focus-ring grid size-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-clay-sm transition-transform hover:scale-105 active:scale-95 max-md:size-10 max-md:shadow-none!"
    >
      <Icon className="size-4" aria-hidden="true" />
    </a>
  )
}

/** A quick fact under the hero: an icon well, a tiny uppercase label, the value. Sits in a <dl>; `index` staggers it in. */
export function StatChip({
  icon: Icon,
  label,
  value,
  tone = 'sapphire',
  index = 0,
}: {
  icon: LucideIcon
  label: string
  value: string
  tone?: Tone
  index?: number
}) {
  return (
    <motion.div
      {...listItem(index)}
      className="glass flex min-w-0 items-center gap-3 rounded-xl py-2.5 pr-4 pl-2.5 shadow-clay-sm max-md:shrink-0 max-md:border max-md:border-border"
    >
      <span aria-hidden="true" className={cn('grid size-9 shrink-0 place-items-center rounded-lg bg-foreground/[0.05] dark:bg-white/[0.06]', TONE_TEXT[tone])}>
        <Icon className="size-[17px]" />
      </span>
      <div className="min-w-0">
        <dt className="label-caps max-w-44 truncate text-muted-foreground max-md:text-[10.5px]!">{label}</dt>
        <dd className="mt-0.5 max-w-44 truncate text-[13.5px] font-semibold max-md:text-[13px]">{value}</dd>
      </div>
    </motion.div>
  )
}

/**
 * One row of the Settings & account card: a tinted icon well, the label and a line under it, then a chevron (a link or a
 * button) or the `right` control (a switch). `tone` tints the well.
 */
export function SettingsRow({
  icon: Icon,
  label,
  sub,
  tone = 'sapphire',
  href,
  onClick,
  right,
}: {
  icon: LucideIcon
  label: string
  sub?: string
  tone?: Tone
  href?: string
  onClick?: () => void
  right?: React.ReactNode
}) {
  const inner = (
    <>
      <span aria-hidden="true" className={cn('grid size-10 shrink-0 place-items-center rounded-xl border max-md:size-[38px] max-md:border-0', TONE_SOFT[tone])}>
        <Icon className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-semibold text-foreground">{label}</span>
        {sub && <span className="mt-px block text-[12px] text-muted-foreground max-md:text-[11.5px]">{sub}</span>}
      </span>
      {right ?? ((href || onClick) && <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />)}
    </>
  )
  const rowCls =
    'focus-ring flex min-h-14 w-full items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-foreground/[0.03] max-md:active:bg-foreground/[0.05]'
  if (href) {
    return (
      <Link href={href} className={rowCls}>
        {inner}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={rowCls}>
        {inner}
      </button>
    )
  }
  return <div className={cn(rowCls, 'hover:bg-transparent')}>{inner}</div>
}
