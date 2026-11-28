import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { birthdayCompensationApi } from '@/api/resources'
import { ApiError } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { normalizeUses, parseEntitlement, type PlaceBody } from '@/lib/birthday-compensation'
import { COMPENSATION_QUERY_KEY } from './useCompensation'
import { retryTransient } from './retry'

export const BIRTHDAY_COMP_KEY = 'birthday-compensation'

/** No such route on this server (an older backend): the page shows no Birthday view. */
const isMissingRoute = (err: unknown) => err instanceof ApiError && (err.status === 404 || err.status === 405)

const unreadable = () => new ApiError('The server sent an answer this page could not read.', 200)

/**
 * GET /employee/compensation/birthday (2026-11-25): this year's birthday and its 1.00 day of Birthday Compensation
 * (lib/birthday-compensation.ts). `data` is null on a server without the route; an answer that is not the contract is an
 * error (a retry is offered), never "nothing to place".
 */
export function useBirthdayEntitlement(enabled: boolean, year?: number) {
  const { user } = useAuth()
  return useQuery({
    queryKey: [BIRTHDAY_COMP_KEY, 'entitlement', user?.employeeId ?? null, year ?? null],
    queryFn: async () => {
      try {
        const ent = parseEntitlement(await birthdayCompensationApi.entitlement(year))
        if (!ent) throw unreadable()
        return ent
      } catch (err) {
        if (isMissingRoute(err)) return null
        throw err
      }
    },
    enabled: enabled && !!user,
    staleTime: 60_000,
    // The month's days change as punches arrive and as the head / HR decide: catch up when the person comes back.
    refetchOnWindowFocus: true,
    retry: retryTransient,
  })
}

/** GET /employee/compensation/birthday/uses: every placement (any birthday, any status), newest first; null without the route. */
export function useBirthdayUses(enabled: boolean) {
  const { user } = useAuth()
  return useQuery({
    queryKey: [BIRTHDAY_COMP_KEY, 'uses', user?.employeeId ?? null],
    queryFn: async () => {
      try {
        const list = normalizeUses(await birthdayCompensationApi.uses('all'))
        if (!list) throw unreadable()
        return list
      } catch (err) {
        if (isMissingRoute(err)) return null
        throw err
      }
    },
    enabled: enabled && !!user,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: retryTransient,
  })
}

/** After any placement change: the entitlement and its list, the 90-day list (the birthday item) and the year timeline. */
function useInvalidateBirthday() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: [BIRTHDAY_COMP_KEY] })
    void qc.invalidateQueries({ queryKey: [COMPENSATION_QUERY_KEY] })
    void qc.invalidateQueries({ queryKey: ['pay', 'compensation-history'] })
  }
}

/** POST /employee/compensation/birthday/uses. */
export function usePlaceBirthdayComp() {
  const invalidate = useInvalidateBirthday()
  return useMutation({
    mutationFn: (body: PlaceBody) => birthdayCompensationApi.place(body),
    // A refusal (the day was worked meanwhile, already placed, the month is over ...) also means the screen is out of
    // date: read it again either way.
    onSettled: invalidate,
  })
}

/** DELETE /employee/compensation/birthday/uses/<id>. */
export function useWithdrawBirthdayUse() {
  const invalidate = useInvalidateBirthday()
  return useMutation({
    mutationFn: (id: number | string) => birthdayCompensationApi.withdraw(id),
    onSettled: invalidate,
  })
}
