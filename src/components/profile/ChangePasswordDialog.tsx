import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { authApi } from '@/api/resources'
import { ApiError } from '@/api/client'

/**
 * Change the portal password (unchanged behaviour, moved out of the page): at least 8 characters, typed twice.
 * /auth/set-password looks the employee up by code, phone or email; the internal numeric id matches none of those, so
 * the employee code is sent.
 */
export function ChangePasswordDialog({
  open,
  onOpenChange,
  employeeCode,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  employeeCode: string
}) {
  const [newPassword, setNewPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [pwdError, setPwdError] = React.useState<string | null>(null)

  const close = (next: boolean) => {
    onOpenChange(next)
    if (!next) {
      setNewPassword('')
      setConfirmPassword('')
      setPwdError(null)
    }
  }

  const setPasswordMutation = useMutation({
    mutationFn: () => authApi.setPassword(employeeCode, newPassword),
    onSuccess: () => {
      toast.success('Password updated')
      close(false)
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update password'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPwdError(null)
    if (newPassword.length < 8) return setPwdError('Password must be at least 8 characters.')
    if (newPassword !== confirmPassword) return setPwdError('Passwords do not match.')
    setPasswordMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Password</DialogTitle>
          <DialogDescription>At least 8 characters. You'll use it the next time you sign in.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="pwd-emp-code">Employee code</Label>
            <Input id="pwd-emp-code" value={employeeCode} disabled />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-pwd">New password</Label>
            <Input
              id="new-pwd"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              aria-invalid={!!pwdError && newPassword.length < 8}
              aria-describedby={pwdError ? 'pwd-error' : undefined}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm-pwd">Confirm password</Label>
            <Input
              id="confirm-pwd"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              aria-invalid={!!pwdError && newPassword !== confirmPassword}
              aria-describedby={pwdError ? 'pwd-error' : undefined}
            />
          </div>
          {pwdError && (
            <p id="pwd-error" className="text-sm font-medium text-rejected" role="alert">
              {pwdError}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={setPasswordMutation.isPending}>
              {setPasswordMutation.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {setPasswordMutation.isPending ? 'Saving…' : 'Update password'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
