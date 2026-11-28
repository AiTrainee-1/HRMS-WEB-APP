import * as React from 'react'
import { toast } from 'sonner'
import { Loader2, Trash2, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ApiError } from '@/api/client'
import { useWithdrawRequest } from '@/hooks/useWithdrawRequest'
import {
  isFinalWithdrawRefusal,
  showWithdraw,
  withdrawDoneText,
  withdrawErrorText,
  withdrawId,
  withdrawQuestion,
  type WithdrawModule,
} from '@/lib/withdraw'
import { cn } from '@/lib/utils'
import { FormError } from './FormBits'

/**
 * "Withdraw" on one of my own Leave / Permission / Casual Leave requests (owner 2026-11-24), shown only while it still
 * waits for an answer (and not on a Casual Leave HR wrote through an attendance edit). Asks first ("Withdraw this
 * request?" - Keep it / Withdraw); the server has the last word: a request decided meanwhile is refused (409) and its
 * sentence is shown in the dialog. The lists are asked again either way (hooks/useWithdrawRequest.ts).
 * A Salary Advance / Term Loan application (module "advance", 2026-11-26) says "Delete request" / "Delete this request?"
 * / "Delete" instead, and `onDone` lets its details dialog close once it is gone. `onRefused` (optional) takes a final
 * refusal (409 in_workflow / recorded_by_hr / not_pending, 404) out of the dialog: the caller shows the server's sentence
 * where the button was, since the refreshed row no longer offers the button.
 */
export function WithdrawButton({
  module,
  id,
  status,
  source,
  label,
  className,
  onDone,
  onRefused,
}: {
  module: WithdrawModule
  id: string | number
  status: unknown
  /** Casual Leave: "employee" | "hr_edit" (HR's own entry has no Withdraw). */
  source?: string | null
  /** "leave request for 28 Nov" - used in the question. */
  label?: string
  className?: string
  /** After the request is gone (a details dialog closes itself). */
  onDone?: () => void
  /** A refusal that a retry will not change, with the server's sentence (the confirm dialog closes). */
  onRefused?: (text: string) => void
}) {
  const withdraw = useWithdrawRequest()
  // An advance application is "deleted" (owner 2026-11-26); every other request is "withdrawn".
  const del = module === 'advance'
  const words = del
    ? { action: 'Delete request', title: 'Delete this request?', confirm: 'Delete', busy: 'Deleting…', toast: 'Deleted', Icon: Trash2 }
    : { action: 'Withdraw', title: 'Withdraw this request?', confirm: 'Withdraw', busy: 'Withdrawing…', toast: 'Withdrawn', Icon: Undo2 }
  const [open, setOpen] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  if (!showWithdraw({ id, status, source })) return null
  const numericId = withdrawId(id)!

  function confirm() {
    setError(null)
    withdraw.mutate(
      { module, id: numericId },
      {
        onSuccess: (result) => {
          toast.success(words.toast, { description: withdrawDoneText(module, result) })
          setOpen(false)
          onDone?.()
        },
        onError: (err) => {
          const e = err instanceof ApiError ? err : { message: String(err) }
          const text = withdrawErrorText(e)
          if (onRefused && err instanceof ApiError && isFinalWithdrawRefusal(err)) {
            setOpen(false)
            onRefused(text)
          } else {
            setError(text)
          }
        },
      },
    )
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          setError(null)
          setOpen(true)
        }}
        className={cn(
          'min-h-11 w-fit border-rejected-border text-rejected hover:bg-rejected-bg hover:text-rejected sm:min-h-8 max-md:h-9 max-md:min-h-9',
          className,
        )}
        aria-label={`${del ? 'Delete' : 'Withdraw'} this ${label ?? 'request'}`}
        data-testid={`withdraw-${module}-${numericId}`}
      >
        <words.Icon aria-hidden="true" /> {words.action}
      </Button>
      <Dialog open={open} onOpenChange={(o) => !withdraw.isPending && setOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{words.title}</DialogTitle>
            <DialogDescription>{withdrawQuestion(module, label)}</DialogDescription>
          </DialogHeader>
          <FormError>{error}</FormError>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={withdraw.isPending} className="min-h-11 sm:min-h-9">
              Keep it
            </Button>
            <Button variant="destructive" onClick={confirm} disabled={withdraw.isPending} className="min-h-11 sm:min-h-9">
              {withdraw.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <words.Icon aria-hidden="true" />}
              {withdraw.isPending ? words.busy : words.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
