import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { approvalsHistoryApi } from '@/api/approvals-history'
import { retryTransient } from '@/hooks/retry'

/**
 * An On-Duty punch selfie as an object URL an <img> can show. The photo is only served through an authenticated route,
 * so it is fetched as a blob (the request carries the token) and turned into a URL that is released when the component
 * goes away. `url` is null while loading or when it failed (`failed`).
 */
export function useOnDutyPhoto(verificationId: number, n: 1 | 2, enabled = true) {
  const q = useQuery({
    queryKey: ['on-duty-photo', verificationId, n],
    queryFn: () => approvalsHistoryApi.onDutyPhoto(verificationId, n),
    enabled,
    staleTime: 10 * 60_000,
    gcTime: 10 * 60_000,
    retry: retryTransient,
  })
  const blob = q.data
  const [url, setUrl] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (!(blob instanceof Blob) || !blob.size) {
      setUrl(null)
      return
    }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return { url, loading: q.isPending && enabled, failed: q.isError || (q.isSuccess && !(blob instanceof Blob && blob.size)) }
}
