import * as React from 'react'
import { Redirect } from 'wouter'
import { useAuth } from '@/context/AuthContext'
import { ResignationGuard } from './ResignationGuard'
import { InactiveAccountGate } from './InactiveAccountGate'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
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
