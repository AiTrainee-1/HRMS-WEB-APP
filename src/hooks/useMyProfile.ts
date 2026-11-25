import { useQuery } from '@tanstack/react-query'
import { employeeApi } from '@/api/resources'
import { API_BASE_URL } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { resolvePhotoUrl } from '@/lib/hod'
import { initialsOf } from '@/lib/profile-view'
import type { Employee } from '@/types'

/**
 * The signed-in employee's own record (GET /employees/:id) under the key every page already shares
 * (['employee', id]: Dashboard, Profile, the account menu), so the header and the pages read one cached answer.
 */
export function useMyEmployee() {
  const { user } = useAuth()
  return useQuery<Employee>({
    queryKey: ['employee', user?.employeeId],
    queryFn: () => employeeApi.get(user!.employeeId),
    enabled: !!user,
    staleTime: 5 * 60_000,
  })
}

/**
 * The employee's photo for an avatar (owner 2026-11-25: the header showed a plain person icon, never the person), as an
 * address an <img> can load - an embedded data: image or https link as it is, a server path ('/media/...') resolved
 * against the API's origin (lib/hod.ts resolvePhotoUrl) - or null; plus their initials for the fallback ('' until a name
 * is known).
 */
export function useMyPhoto(): { photoUrl: string | null; initials: string; name: string } {
  const { user } = useAuth()
  const { data } = useMyEmployee()
  const name = data ? `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim() : ''
  const origin = typeof window !== 'undefined' ? window.location.origin : null
  return {
    photoUrl: resolvePhotoUrl(data?.photoUrl, API_BASE_URL, origin),
    initials: initialsOf(name || user?.name),
    name: name || user?.name || '',
  }
}
