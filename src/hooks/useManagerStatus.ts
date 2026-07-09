import { useQuery } from '@tanstack/react-query'
import { managerApi } from '@/api/resources'
import { useAuth } from '@/context/AuthContext'
import { ApiError } from '@/api/client'

export function useManagerStatus() {
  const { user } = useAuth()
  const query = useQuery({
    queryKey: ['manager-me'],
    queryFn: async () => {
      try {
        return await managerApi.me()
      } catch (err) {
        if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
          return null
        }
        throw err
      }
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })

  return {
    isManager: !!query.data?.isManager,
    flags: query.data ?? null,
    isLoading: query.isLoading,
  }
}
