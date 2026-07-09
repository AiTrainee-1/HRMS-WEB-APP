import * as React from 'react'
import { useLocation } from 'wouter'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { authApi } from '@/api/resources'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
    if (!identifier) return setError('Enter your employee code, phone, or email.')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirm) return setError('Passwords do not match.')

    setSubmitting(true)
    try {
      await authApi.setPassword(identifier, password)
      toast.success('Password set. You can now sign in.')
      navigate('/employee-login')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not set password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-blue-tint p-4">
      <div className="pointer-events-none absolute -top-24 -right-16 size-96 rounded-full bg-brand-gradient opacity-20 animate-blob" />
      <div
        className="pointer-events-none absolute -bottom-32 -left-20 size-80 rounded-full bg-brand-gradient opacity-15 animate-blob"
        style={{ animationDelay: '4s' }}
      />
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex w-full max-w-sm flex-col items-center gap-6"
      >
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 12, stiffness: 160, delay: 0.1 }}
          className="flex items-center justify-center rounded-2xl overflow-hidden shadow-clay-lg bg-white"
        >
          <img
            src="/UKT_Company_Logo.png"
            alt="UK Textiles"
            className="h-16 w-auto object-contain px-2 py-1"
          />
        </motion.div>

        <Card className="relative z-10 w-full">
        <CardHeader>
          <CardTitle className="text-xl">Set Password</CardTitle>
          <CardDescription>Create or reset your account password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="identifier">Employee code / Phone / Email</Label>
              <Input id="identifier" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">New Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirm">Confirm Password</Label>
              <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" variant="gradient" size="lg" disabled={submitting} className="mt-2">
              {submitting ? 'Saving…' : 'Set Password'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have a password?{' '}
              <a
                href="/employee-login"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Back to Login
              </a>
            </p>
          </form>
        </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
