import * as React from 'react'
import { Link, useLocation } from 'wouter'
import { toast } from 'sonner'
import { AlertCircle, ArrowLeft, KeyRound } from 'lucide-react'
import { authApi } from '@/api/resources'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthShell } from '@/components/layout/AuthShell'
import { ApiError } from '@/api/client'

export default function SetPassword() {
  const [, navigate] = useLocation()
  const [identifier, setIdentifier] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!identifier.trim()) return setError('Enter your employee code, phone, or email.')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirm) return setError('Passwords do not match.')

    setSubmitting(true)
    try {
      await authApi.setPassword(identifier.trim(), password)
      toast.success('Password set. You can now sign in.')
      navigate('/employee-login')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not set password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell width="max-w-lg">
      <p className="label-caps flex items-center gap-2 text-brand-gold">
        <span className="grid size-7 place-items-center rounded-md border border-amber-500/30 bg-amber-500/10">
          <KeyRound className="size-3.5" />
        </span>
        First-time access
      </p>
      <h1 className="font-display mt-3 text-[28px] leading-tight font-semibold">Set your password</h1>
      <p className="mt-1.5 text-[14px] text-muted-foreground [@media(max-height:720px)]:hidden">
        New to the portal, or forgot your password? Choose one using your employee code, registered phone or email.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="identifier">Employee code / phone / email</Label>
          <Input id="identifier" className="h-11" autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoFocus />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">New password</Label>
            <Input id="password" className="h-11" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input id="confirm" className="h-11" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
        </div>
        <p className="-mt-1.5 text-[12px] text-muted-foreground">At least 8 characters.</p>
        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[13px] font-medium text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={submitting} className="h-11">
          {submitting ? 'Saving…' : 'Set password'}
        </Button>
      </form>

      <Link href="/employee-login" className="font-label mt-5 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-blue hover:underline">
        <ArrowLeft className="size-4" /> Back to sign in
      </Link>
    </AuthShell>
  )
}
