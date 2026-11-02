import * as React from 'react'
import { PageHero } from '@/components/kit/PageShell'

interface PageHeaderProps {
  title: string
  subtitle?: string
  /** Small uppercase line above the title, e.g. "Payroll & Ops". Defaults to the page's nav group. */
  eyebrow?: string
  icon?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

/**
 * The older page masthead, kept so pages that have not moved to the kit yet look the same as those that have: it is
 * now the kit's PageHero (open on the woven field, Playfair title, silk thread underline). New pages: use
 * `PageHero` from '@/components/kit' directly (it also takes a KPI row).
 */
export function PageHeader({ title, subtitle, eyebrow, icon, actions, className }: PageHeaderProps) {
  return <PageHero title={title} subtitle={subtitle} eyebrow={eyebrow} icon={icon} actions={actions} className={className} />
}
