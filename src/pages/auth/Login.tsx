import * as React from 'react'
import { useLocation } from 'wouter'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Eye, EyeOff, LogIn, User, Lock, AlertCircle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { ApiError } from '@/api/client'

// ─── Floating-label input with icon prefix ─────────────────────────────────
interface FieldProps {
  id: string
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  icon: React.ReactNode
  autoFocus?: boolean
  rightElement?: React.ReactNode
}

function Field({ id, label, type = 'text', value, onChange, icon, autoFocus, rightElement }: FieldProps) {
  const [focused, setFocused] = React.useState(false)
  const lifted = focused || value.length > 0

  return (
    <div className="relative">
      {/* glass input container */}
      <div
        className={[
          'relative flex items-center rounded-xl border transition-all duration-200',
          focused
            ? 'border-brand-blue bg-white/90 dark:bg-card/95 shadow-[0_0_0_3px_rgb(0,100,150,0.12)]'
            : 'border-white/40 dark:border-white/10 bg-white/60 dark:bg-white/5 hover:border-white/70 dark:hover:border-white/20 hover:bg-white/75 dark:hover:bg-white/10',
        ].join(' ')}
      >
        {/* leading icon */}
        <span
          className={[
            'pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200',
            focused ? 'text-brand-blue' : 'text-foreground/35',
          ].join(' ')}
        >
          {icon}
        </span>

        {/* floating label */}
        <label
          htmlFor={id}
          className={[
            'pointer-events-none absolute left-10 transition-all duration-200 select-none',
            lifted
              ? 'top-2 text-[10px] font-semibold tracking-wide text-brand-blue'
              : 'top-1/2 -translate-y-1/2 text-sm text-foreground/45',
          ].join(' ')}
        >
          {label}
        </label>

        <input
          id={id}
          type={type}
          value={value}
          autoFocus={autoFocus}
          autoComplete={type === 'password' ? 'current-password' : 'username'}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={[
            'h-14 w-full bg-transparent pl-10 text-sm font-medium text-foreground outline-none',
            rightElement ? 'pr-10' : 'pr-4',
            lifted ? 'pt-4' : 'pt-0',
          ].join(' ')}
        />

        {/* trailing element (show/hide password) */}
        {rightElement && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">{rightElement}</span>
        )}
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────
export default function Login() {
  const { login, isLoading } = useAuth()
  const [, navigate] = useLocation()
  const [identifier, setIdentifier] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [showPw, setShowPw] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!identifier || !password) {
      setError('Please fill in all fields.')
      return
    }
    try {
      await login(identifier, password)
      toast.success('Welcome back!')
      navigate('/employee/dashboard')
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Login failed. Please try again.'
      setError(message)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-blue-tint p-4">

      {/* ── background blobs (unchanged) ─────────────────────────────────── */}
      <div className="pointer-events-none absolute -top-24 -right-16 size-96 rounded-full bg-brand-gradient opacity-20 animate-blob" />
      <div
        className="pointer-events-none absolute -bottom-32 -left-20 size-80 rounded-full bg-brand-gradient opacity-15 animate-blob"
        style={{ animationDelay: '4s' }}
      />
      <div
        className="pointer-events-none absolute top-1/3 left-1/4 size-40 rounded-full bg-gold-gradient opacity-20 animate-blob"
        style={{ animationDelay: '2s' }}
      />

      {/* ── card ─────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[400px]"
      >
        {/* glassmorphic panel */}
        <div
          className="relative overflow-hidden rounded-3xl px-8 pt-8 pb-7"
          style={{
            background: 'rgba(255,255,255,0.55)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            boxShadow:
              '0 32px 64px -16px rgba(0,100,150,0.18), 0 8px 24px -4px rgba(0,100,150,0.10), inset 0 1px 0 rgba(255,255,255,0.9)',
            border: '1px solid rgba(255,255,255,0.65)',
          }}
        >
          {/* subtle inner shine */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)' }}
          />

          {/* ── logo + heading ────────────────────────────────────────────── */}
          <div className="mb-7 flex flex-col items-center gap-4">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 14, stiffness: 180, delay: 0.1 }}
              className="flex items-center justify-center rounded-2xl bg-white/90 dark:bg-card/95 shadow-clay-lg overflow-hidden"
              style={{ boxShadow: '0 8px 24px -6px rgba(0,100,150,0.22), inset 0 1px 0 rgba(255,255,255,1)' }}
            >
              <img
                src="/UKT_Company_Logo.png"
                alt="UK Textiles"
                className="h-14 w-auto object-contain px-3 py-1.5"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="text-center"
            >
              <h1 className="text-[22px] font-bold tracking-tight text-foreground">
                Employee Login
              </h1>
              <p className="mt-1 text-[13px] text-foreground/50 font-medium">
                Sign in to your workspace
              </p>
            </motion.div>
          </div>

          {/* ── form ─────────────────────────────────────────────────────── */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: 0.25 }}
            >
              <Field
                id="identifier"
                label="Employee Code / Phone / Email"
                value={identifier}
                onChange={setIdentifier}
                icon={<User className="size-4" />}
                autoFocus
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: 0.32 }}
            >
              <Field
                id="password"
                label="Password"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={setPassword}
                icon={<Lock className="size-4" />}
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPw((p) => !p)}
                    className="flex size-7 items-center justify-center rounded-lg text-foreground/35 transition hover:bg-black/5 hover:text-foreground/60"
                    tabIndex={-1}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                }
              />
            </motion.div>

            {/* error message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, height: 0, y: -4 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-start gap-2 rounded-xl bg-destructive/8 border border-destructive/15 px-3 py-2.5"
                >
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                  <p className="text-[12.5px] font-medium text-destructive leading-relaxed">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* submit button */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.38 }}
              className="mt-1"
            >
              <motion.button
                type="submit"
                disabled={isLoading}
                whileHover={{ scale: isLoading ? 1 : 1.015, y: isLoading ? 0 : -1 }}
                whileTap={{ scale: isLoading ? 1 : 0.97 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className="relative w-full overflow-hidden rounded-xl py-3.5 text-[14px] font-semibold text-white disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background: isLoading
                    ? 'linear-gradient(135deg,#006496,#0090d0)'
                    : 'linear-gradient(135deg,#006496,#0090d0)',
                  boxShadow: '0 8px 24px -6px rgba(0,100,150,0.45), 0 2px 8px -2px rgba(0,100,150,0.25)',
                }}
              >
                {/* shimmer overlay on hover */}
                <span
                  className="pointer-events-none absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300"
                  style={{
                    background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.18) 50%, transparent 70%)',
                  }}
                />
                <span className="relative flex items-center justify-center gap-2">
                  {isLoading ? (
                    <>
                      <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      Signing in…
                    </>
                  ) : (
                    <>
                      <LogIn className="size-4" />
                      Sign in
                    </>
                  )}
                </span>
              </motion.button>
            </motion.div>
          </form>

          {/* ── footer link ───────────────────────────────────────────────── */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.48 }}
            className="mt-5 text-center text-[12.5px] text-foreground/45"
          >
            New employee or forgot password?{' '}
            <a
              href="/set-password"
              className="font-semibold text-brand-blue underline-offset-4 hover:underline transition-colors"
            >
              Set Password
            </a>
          </motion.p>
        </div>
      </motion.div>
    </div>
  )
}
