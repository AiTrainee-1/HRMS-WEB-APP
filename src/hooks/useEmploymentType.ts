import { useQuery } from '@tanstack/react-query'
import { employeeApi } from '@/api/resources'
import { useAuth } from '@/context/AuthContext'

/**
 * The signed-in employee's employment type ('staff' | 'production') from their own profile. Shares its query (key and
 * function) with the layout's profile read, so it costs no extra request. Staff-only screens (Compensation) use it to
 * hide their entry from production employees: `isStaff` is true only once the profile has said 'staff', so a production
 * employee never sees the entry flash up while it loads.
 */
export function useEmploymentType() {
  const { user } = useAuth()
  const query = useQuery({
    queryKey: ['employee', user?.employeeId],
    queryFn: () => employeeApi.get(user!.employeeId),
    enabled: !!user,
    staleTime: 5 * 60_000,
  })
  const employmentType = query.data?.employmentType ?? null
  return { employmentType, isStaff: employmentType === 'staff', isProduction: employmentType === 'production', isLoading: query.isLoading }
}
