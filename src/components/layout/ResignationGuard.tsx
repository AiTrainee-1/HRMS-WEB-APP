import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation } from 'wouter'
import { resignationApi } from '@/api/resources'
import { useAuth } from '@/context/AuthContext'

/**
 * Polls the caller's own resignation record while any authenticated page is
 * mounted. The moment HR gives final approval (status === 'approved'), the
 * session is cleared and the employee is routed to a dedicated deactivated
 * screen — mirrors the mobile app's ResignationGuard exactly.
 */
export function ResignationGuard() {
  const { user, logout } = useAuth()
  const qc = useQueryClient()
  const [, navigate] = useLocation()
  const handledRef = React.useRef(false)

  const { data } = useQuery({
    queryKey: ['my-resignation-guard'],
    queryFn: resignationApi.get,
    enabled: !!user,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  })

  React.useEffect(() => {
    if (data?.status === 'approved' && !handledRef.current) {
      handledRef.current = true
      logout()
      qc.clear()
      navigate('/account-deactivated')
    }
  }, [data?.status, logout, qc, navigate])

  return null
}
