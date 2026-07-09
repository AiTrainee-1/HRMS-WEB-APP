import * as React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, icon, actions, className }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'relative overflow-hidden rounded-2xl bg-brand-gradient px-5 py-5 text-white shadow-clay-lg sm:px-6',
        className,
      )}
    >
      <div className="pointer-events-none absolute -top-10 -right-8 size-40 rounded-full bg-white/10 animate-blob" />
      <div
        className="pointer-events-none absolute -bottom-14 left-16 size-28 rounded-full bg-white/5 animate-blob"
        style={{ animationDelay: '3s' }}
      />
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/15 [&_svg]:size-5">{icon}</div>
          )}
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
            {subtitle && <p className="text-sm text-white/80">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </motion.div>
  )
}
