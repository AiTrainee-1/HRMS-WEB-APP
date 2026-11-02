import * as React from 'react'
import { Link } from 'wouter'
import { ArrowLeft } from 'lucide-react'
import { WEB_APP_VERSION_LABEL } from '@/lib/auth-look'
import { UKTLogo } from './UKTLogo'

// The pieces of the coloured header, as the mobile screens draw them (white on the emerald, small glass chips).

/** Login: logo, "UK TEXTILES / EMPLOYEE PORTAL", and the version chip. */
export function AuthBrandRow() {
  return (
    <div className="auth-brand">
      <UKTLogo size={34} className="auth-logo" />
      <div className="auth-brand-text">
        <p className="auth-brand-name">UK TEXTILES</p>
        <p className="auth-brand-sub">EMPLOYEE PORTAL</p>
      </div>
      <span className="auth-chip">
        <span className="auth-dot" aria-hidden />
        <span className="sr-only">Version </span>
        {WEB_APP_VERSION_LABEL}
      </span>
    </div>
  )
}

/** Set Password / Forgot Password: "Back to Login" on the left, a pill (the step, or the channel) on the right. */
export function AuthTopRow({ right }: { right: React.ReactNode }) {
  return (
    <div className="auth-toprow">
      <Link href="/employee-login" className="auth-chip auth-backchip">
        <ArrowLeft aria-hidden /> Back to Login
      </Link>
      {right}
    </div>
  )
}

/** "UK TEXTILES PORTAL · v2.0.0" over the headline. */
export function AuthPortalChip() {
  return (
    <span className="auth-chip auth-portalchip">
      <span className="auth-dot" aria-hidden />
      UK TEXTILES PORTAL · {WEB_APP_VERSION_LABEL}
    </span>
  )
}

/** The big white headline and the sentence under it. The page's one <h1>. */
export function AuthHeadline({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <>
      <h1 className="auth-headline">{title}</h1>
      {children && <p className="auth-headsub">{children}</p>}
    </>
  )
}
