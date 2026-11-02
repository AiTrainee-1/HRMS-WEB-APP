import * as React from 'react'
import { motion } from 'framer-motion'
import { useLocation } from 'wouter'
import { findNav } from '@/components/layout/nav-config'
import { cn } from '@/lib/utils'
import { DURATION, EASE_OUT, fadeRise } from './motion'

const WIDTH = { default: 'max-w-[1240px]', narrow: 'max-w-3xl', wide: 'max-w-[1400px]' } as const

/**
 * The frame of every signed-in page. Its direct children enter one after another (fade + 8px rise, 50 ms apart, capped)
 * and are spaced evenly. Put <PageHero> first. The woven background is already behind the top of the page (the shell
 * draws it) — do not add another.
 *
 *   <PageShell>
 *     <PageHero title="Leave" ... />
 *     <StatusViews ... />
 *     <section>...</section>
 *   </PageShell>
 */
export function PageShell({
  children,
  width = 'default',
  className,
}: {
  children: React.ReactNode
  /** default 1240px; narrow (768px) for forms and single-column pages; wide (1400px) for dashboards and tables. */
  width?: keyof typeof WIDTH
  className?: string
}) {
  let index = 0
  return (
    <div className={cn('mx-auto flex w-full flex-col gap-6 max-md:gap-4 lg:gap-8', WIDTH[width], className)}>
      {React.Children.map(children, (child) => {
        if (child === null || child === undefined || typeof child === 'boolean') return child
        const i = index++
        return (
          <motion.div variants={fadeRise} initial="hidden" animate="show" custom={i} className="min-w-0">
            {child}
          </motion.div>
        )
      })}
    </div>
  )
}

/**
 * The page masthead, open on the woven field (no box): an eyebrow (defaults to the nav group, e.g. "Requests"), a
 * Playfair title with a silk thread drawn under it, a one-line plain-English subtitle, actions on the right, and an
 * optional KPI row (2 per row on phones, up to 4 on desktop). The page's only <h1>.
 *
 * Phones (< 768px): the mobile app's sub-header - a 20px Plus Jakarta bold title, a 12px muted subtitle, the actions at
 * the right as pills; no eyebrow, icon tile, glow or silk thread (kit/MOBILE.md).
 *
 *   <PageHero icon={<Send />} title="Leave" subtitle="Apply for leave and see what was decided."
 *     actions={<Button>Apply for leave</Button>}
 *     kpis={<><KpiTile .../><KpiTile .../></>} />
 */
export function PageHero({
  title,
  subtitle,
  eyebrow,
  icon,
  actions,
  kpis,
  children,
  className,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Small caps line above the title; defaults to the page's nav group. Pass "" for none. */
  eyebrow?: string
  /** A lucide icon element: icon={<Wallet />}. */
  icon?: React.ReactNode
  actions?: React.ReactNode
  /** KpiTile elements; laid out as a responsive grid under the title. */
  kpis?: React.ReactNode
  /** Anything else under the title block (a notice, a SegmentedControl). */
  children?: React.ReactNode
  className?: string
}) {
  const [location] = useLocation()
  const crumb = findNav(location)
  const line = eyebrow ?? crumb?.group.heading ?? ''

  return (
    <header className={cn('relative', className)}>
      {/* A low sapphire glow behind the title, on top of the shell's weave. */}
      <div aria-hidden="true" className="pointer-events-none absolute -top-16 -left-10 h-56 w-[28rem] max-w-full rounded-full bg-primary/10 blur-3xl max-md:hidden" />
      <div className="relative flex flex-wrap items-end justify-between gap-x-6 gap-y-4 max-md:items-start max-md:gap-x-3 max-md:gap-y-3">
        <div className="flex min-w-0 items-start gap-4 max-md:flex-[1_1_12rem]">
          {icon && (
            <span
              aria-hidden="true"
              className="relative mt-1 hidden size-12 shrink-0 place-items-center rounded-xl border border-primary/30 bg-card/70 text-brand-blue shadow-clay-sm max-md:hidden! sm:grid dark:bg-white/[0.05] [&_svg]:size-[22px]"
            >
              {icon}
              <span className="bg-silk absolute inset-x-2 -bottom-px h-[2px] rounded-full" />
            </span>
          )}
          <div className="min-w-0">
            {line && <p className="label-caps mb-1.5 text-brand-emerald max-md:hidden">{line}</p>}
            <h1 className="font-display text-[28px] leading-[34px] font-semibold tracking-tight max-md:text-[20px]! max-md:leading-7! max-md:font-bold max-md:tracking-[-0.01em] sm:text-[34px] sm:leading-[42px]">
              {title}
            </h1>
            <motion.span
              aria-hidden="true"
              className="silk-line mt-2 block w-20 origin-left max-md:hidden"
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ duration: DURATION.slow * 1.6, ease: EASE_OUT, delay: 0.15 }}
            />
            {subtitle && (
              <p className="mt-2.5 max-w-2xl text-[14.5px] leading-6 text-muted-foreground max-md:mt-0.5 max-md:text-[12px] max-md:leading-4">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 max-md:w-full max-md:min-w-0">{actions}</div>}
      </div>
      {children && <div className="relative mt-5 max-md:mt-3">{children}</div>}
      {kpis && (
        <div className="relative mt-6 grid grid-cols-2 gap-3 max-md:mt-4 max-md:gap-2.5 sm:gap-4 lg:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
          {kpis}
        </div>
      )}
    </header>
  )
}
