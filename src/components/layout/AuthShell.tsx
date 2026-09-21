import * as React from 'react'
import { motion } from 'framer-motion'
import { AuthBackground } from '@/components/backgrounds/AuthBackground'

/** Shared chrome for the signed-out pages (set password, deactivated,
 *  verification): a centred frosted-violet panel carrying the logo over the
 *  GradientWaves backdrop, matching the Login screen. */
export function AuthShell({ children, badge, width = 'max-w-md' }: { children: React.ReactNode; badge?: React.ReactNode; width?: string }) {
  return (
    <div className="dark auth-theme relative isolate flex min-h-dvh flex-col text-foreground sm:h-dvh sm:overflow-hidden">
      <AuthBackground />
      <main className="flex min-h-0 flex-1 items-center justify-center px-4 py-4 sm:py-6">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className={`auth-card scrollbar-thin max-h-full w-full overflow-y-auto ${width} rounded-lg p-6 sm:p-8`}
        >
          <div className="mb-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center overflow-hidden rounded-md bg-white p-1">
                <img src="/UKT_Company_Logo.png" alt="UKTextiles" className="h-full w-full object-contain" />
              </span>
              <div className="leading-tight">
                <p className="font-display text-[18px] font-semibold">UKTextiles</p>
                <p className="label-caps text-muted-foreground">Employee portal</p>
              </div>
            </div>
            {badge}
          </div>
          {children}
        </motion.div>
      </main>
    </div>
  )
}
