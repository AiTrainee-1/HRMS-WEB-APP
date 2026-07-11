import * as React from 'react'
import { Redirect } from 'wouter'
import { useAuth } from '@/context/AuthContext'
import { ResignationGuard } from './ResignationGuard'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Redirect to="/employee-login" />
  return (
    <>
      <ResignationGuard />
      {children}
    </>
  )
}
