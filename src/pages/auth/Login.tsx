import * as React from 'react'
import { Link, useLocation } from 'wouter'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  AlertCircle, ArrowRight, Eye, EyeOff, Factory, IdCard, KeyRound, Lock,
  MapPin, MessageCircle, ShieldCheck, Wallet, CalendarCheck,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { authApi, type LoginOptions } from '@/api/resources'
import { OtpFlow } from '@/components/auth/OtpFlow'
import { ApiError } from '@/api/client'
import heroImage from '@/assets/company/infrastructure.png'
import { AuthBackground } from '@/components/backgrounds/AuthBackground'

function useClock() {
  const [now, setNow] = React.useState(() => new Date())
  React.useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])
  return now
}

const pillars = [
  { label: 'Attendance', value: 'Geo-verified', note: 'Office & on-duty punches', icon: MapPin, tone: 'text-brand-emerald' },
  { label: 'Payroll', value: 'Monthly', note: 'Salary slips & advances', icon: Wallet, tone: 'text-brand-gold' },
  { label: 'Requests', value: 'Tracked', note: 'Leave, permission & outpass', icon: CalendarCheck, tone: 'text-brand-blue' },
]

export default function Login() {
  const { login, loginWithOtp, isLoading } = useAuth()
  const [, navigate] = useLocation()
  const [identifier, setIdentifier] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [showPw, setShowPw] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const now = useClock()
  // Which sign-in methods the server offers. Until it answers (or if it can't), password sign-in works as before.
  const [options, setOptions] = React.useState<LoginOptions | null>(null)
  const [mode, setMode] = React.useState<'otp' | 'password'>('password')
  React.useEffect(() => {
    authApi
      .loginOptions()
      .then((o) => {
        setOptions(o)
        setMode(o.otpLogin ? 'otp' : 'password')
      })
      .catch(() => {})
  }, [])
  const showOtp = mode === 'otp' && options?.otpLogin === true
  const canSwitch = options?.otpLogin === true && options.passwordLogin

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!identifier || !password) {
      setError('Enter your employee code and password.')
      return
    }
    try {
      await login(identifier.trim(), password)
      toast.success('Welcome back!')
      navigate('/employee/dashboard')
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Login failed. Please try again.'
      setError(message)
    }
  }

  return (
    <div className="dark auth-theme relative isolate flex min-h-dvh flex-col text-foreground lg:h-dvh lg:overflow-hidden">
      <AuthBackground />
      <main className="flex min-h-0 flex-1 items-center justify-center px-4 py-4 sm:px-8 lg:py-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="grid w-full max-w-6xl gap-5 rounded-xl border border-white/15 bg-white/[0.06] p-4 shadow-[0_30px_80px_-20px_rgb(0_0_0/0.6)] backdrop-blur-md sm:p-5 lg:h-full lg:max-h-[780px] lg:grid-cols-[1.25fr_1fr]"
        >
          {/* ── Left: editorial hero ─────────────────────────────────────── */}
          <section className="relative hidden overflow-hidden rounded-lg border hairline bg-gradient-to-br from-[#241257]/80 via-[#150b38]/80 to-[#0b0620]/85 p-8 backdrop-blur-md text-[#dae2fd] lg:flex lg:min-h-0 lg:flex-col xl:p-9">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage:
                  'linear-gradient(rgb(255 255 255) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255) 1px, transparent 1px)',
                backgroundSize: '48px 48px',
              }}
            />
            <div className="pointer-events-none absolute -top-32 -right-24 size-96 rounded-full bg-[#7c5cff]/30 blur-3xl" />

            <div className="relative flex items-center justify-between gap-3">
              <span className="label-caps inline-flex items-center gap-2 rounded bg-white/[0.06] px-2.5 py-1.5 text-[#dae2fd]">
                <Factory className="size-3.5 text-[#fbbf24]" /> UKTextiles workforce
              </span>
              <span className="inline-flex items-center gap-2 rounded bg-black/30 px-3 py-1.5">
                <span className="pip pip-live text-[#34d399]" />
                <span className="font-label text-[15px] font-semibold tabular-nums">
                  {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                </span>
              </span>
            </div>

            <p className="label-caps relative mt-5 text-[12px] tracking-[0.14em] text-[#fbbf24]">Employee self-service</p>
            <h1 className="font-display relative mt-2 text-[clamp(32px,4.6vh,50px)] leading-[1.06] font-semibold tracking-tight">
              Precision Weaving.
              <br />
              <em className="font-medium text-[#d4c4ff]">Unified Workforce</em>
              <br />
              Intelligence.
            </h1>
            <p className="relative mt-3 max-w-xl text-[15px] leading-relaxed text-[#c3c6d7]">
              Your attendance, shifts, leave, outpasses and salary slips, all in one place.
            </p>

            <figure className="relative mt-5 min-h-[100px] flex-1 overflow-hidden rounded-md border border-white/10">
              <img src={heroImage} alt="UKTextiles mill floor" className="absolute inset-0 h-full w-full object-cover opacity-80" />
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#060e20] via-[#060e20]/70 to-transparent px-5 pt-10 pb-4">
                <p className="label-caps text-[#fbbf24]">UKTextiles • Infrastructure</p>
                <p className="mt-1 text-[15px] font-semibold">Coimbatore & Tirupur mill units</p>
              </figcaption>
            </figure>

            <div className="relative mt-4 grid shrink-0 grid-cols-3 gap-3">
              {pillars.map((p) => (
                <div key={p.label} className="rounded-md border border-white/[0.08] bg-white/[0.04] p-3.5">
                  <p className="label-caps text-[#94a3b8]">{p.label}</p>
                  <p className="font-display mt-1.5 text-[20px] leading-tight font-semibold">{p.value}</p>
                  <p className={`mt-1 flex items-center gap-1.5 text-[12.5px] [@media(max-height:720px)]:hidden ${p.tone}`}>
                    <p.icon className="size-3.5" /> {p.note}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Right: sign-in form ──────────────────────────────────────── */}
          <section className="auth-card flex min-h-0 flex-col overflow-y-auto rounded-lg p-6 sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center overflow-hidden rounded-md bg-white p-1">
                  <img src="/UKT_Company_Logo.png" alt="UKTextiles" className="h-full w-full object-contain" />
                </span>
                <div className="leading-tight">
                  <p className="font-display text-[18px] font-semibold">UKTextiles</p>
                  <p className="label-caps text-muted-foreground">Employee portal</p>
                </div>
              </div>
              <span className="chip chip-success">
                <span className="pip pip-live" /> Portal active
              </span>
            </div>

            <h2 className="font-display mt-6 text-[30px] leading-tight font-semibold [@media(max-height:720px)]:mt-4">Employee Sign In</h2>
            <p className="mt-2 text-[14.5px] text-muted-foreground [@media(max-height:720px)]:hidden">
              {showOtp
                ? 'Sign in with a one-time code sent to your registered WhatsApp number.'
                : 'Use your employee code, registered phone or email to access your shifts, requests and payroll records.'}
            </p>

            {showOtp ? (
              <OtpFlow
                purpose="login"
                submitLabel="Verify & sign in"
                submittingLabel="Signing in…"
                onSubmit={async (employeeCode, otp) => {
                  await loginWithOtp(employeeCode, otp)
                  toast.success('Welcome back!')
                  navigate('/employee/dashboard')
                }}
              />
            ) : (
            <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4" noValidate>
              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <label htmlFor="identifier" className="label-caps text-foreground/85">
                    Employee code / phone / email
                  </label>
                </div>
                <div className="relative">
                  <IdCard className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="identifier"
                    value={identifier}
                    autoFocus
                    autoComplete="username"
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="e.g. UKT-4092"
                    className="h-12 w-full rounded-md border border-input bg-background/70 pr-4 pl-11 text-[15px] text-foreground caret-primary outline-none transition placeholder:text-muted-foreground/60 hover:border-foreground/25 focus:border-primary focus:ring-[3px] focus:ring-primary/20"
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <label htmlFor="password" className="label-caps text-foreground/85">
                    Portal password
                  </label>
                  <Link href={options?.otpReset ? '/forgot-password' : '/set-password'} className="font-label text-[12px] font-semibold text-brand-gold hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="password"
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    autoComplete="current-password"
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••"
                    className="h-12 w-full rounded-md border border-input bg-background/70 pr-12 pl-11 text-[15px] text-foreground caret-primary outline-none transition placeholder:text-muted-foreground/60 hover:border-foreground/25 focus:border-primary focus:ring-[3px] focus:ring-primary/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((p) => !p)}
                    className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded text-muted-foreground transition hover:bg-foreground/[0.06] hover:text-foreground"
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5"
                    role="alert"
                  >
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                    <p className="text-[13px] font-medium text-destructive">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={isLoading}
                className="bg-brand-gradient glow-primary font-label mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-md text-[15px] font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in to portal <ArrowRight className="size-4" />
                  </>
                )}
              </button>
            </form>
            )}

            {canSwitch && (
              <button
                type="button"
                onClick={() => setMode(showOtp ? 'password' : 'otp')}
                className="font-label mt-4 inline-flex items-center gap-1.5 self-start text-[13.5px] font-semibold text-brand-gold hover:underline"
              >
                {showOtp ? (
                  <>
                    <Lock className="size-3.5" /> Use my password instead
                  </>
                ) : (
                  <>
                    <MessageCircle className="size-3.5" /> Sign in with a WhatsApp code
                  </>
                )}
              </button>
            )}

            <div className="mt-auto pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border hairline bg-foreground/[0.03] px-4 py-3">
                <span className="flex items-center gap-2 text-[13.5px] text-foreground/85">
                  <KeyRound className="size-4 text-muted-foreground" /> First time using the portal?
                </span>
                <Link href="/set-password" className="font-label flex items-center gap-1 text-[14px] font-bold text-brand-gold hover:underline">
                  Set password <ArrowRight className="size-3.5" />
                </Link>
              </div>
              <p className="label-caps mt-3 flex items-center gap-2 text-muted-foreground">
                <ShieldCheck className="size-3.5 text-brand-emerald" /> Encrypted session • Employee access only
              </p>
            </div>
          </section>
        </motion.div>
      </main>

    </div>
  )
}
