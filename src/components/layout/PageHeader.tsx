import * as React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  subtitle?: string
  /** Small uppercase line above the title, e.g. "Payroll & Ops". */
  eyebrow?: string
  icon?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

/**
 * Editorial page masthead from the Sovereign Loom screens: an emerald
 * micro-label, a Playfair Display headline, and actions on the right, set on
 * a glass panel with a soft sapphire glow in the corner.
 */
export function PageHeader({ title, subtitle, eyebrow, icon, actions, className }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={cn('glass-raised relative overflow-hidden rounded-lg px-5 py-6 sm:px-7', className)}
    >
      <div className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          {icon && (
            <div className="mt-1 hidden size-11 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-brand-blue sm:flex [&_svg]:size-5">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            {eyebrow && <p className="label-caps mb-2 text-brand-emerald">{eyebrow}</p>}
            <h1 className="font-display text-[26px] leading-[34px] font-semibold tracking-tight sm:text-[32px] sm:leading-10">
              {title}
            </h1>
            {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </motion.div>
  )
}
