import * as React from 'react'
import { Redirect } from 'wouter'
import { useAuth } from '@/context/AuthContext'
import { PageLoader } from '@/components/ui/loader'
import { ResignationGuard } from './ResignationGuard'
import { InactiveAccountGate } from './InactiveAccountGate'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isRestoring } = useAuth()
  // a browser that lost its stored token is asking the server for its saved sign-in first (owner 2026-11-25)
  if (isRestoring) return <PageLoader label="Signing you in" />
  if (!user) return <Redirect to="/employee-login" />
  return (
    <>
      <ResignationGuard />
      {/* An inactive HRMS account: a full-page cover and a 30-second countdown to sign-out (owner 2026-11-25). */}
      <InactiveAccountGate />
      {children}
    </>
  )
}
