import * as React from 'react'
import { useLocation } from 'wouter'
import { Compass, PlayCircle, Sparkles, Volume2 } from 'lucide-react'
import { GlassCard, SectionHeader } from '@/components/kit'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { MangaMascot } from '@/components/kit/manga/MangaMascot'
import { readWelcomeVoice, saveWelcomeVoice, speakWelcome } from '@/components/transitions/auth-transitions'
import { firstNameOf } from '@/lib/auth-transition'
import { useAuth } from '@/context/AuthContext'
import { requestTourReplay } from './tour-replay'

/**
 * Help page: "Replay the welcome tour" and the "Spoken welcome" setting (owner 2026-11-25). The setting lives in this
 * browser only; it is on unless turned off here.
 */
export function AppTipsSection() {
  const [, navigate] = useLocation()
  const { user } = useAuth()
  const [voice, setVoice] = React.useState(readWelcomeVoice)
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window

  return (
    <section aria-labelledby="app-tips" className="flex flex-col gap-4">
      <SectionHeader id="app-tips" icon={Sparkles} title="Getting around" description="A quick tour of the dashboard, and how it greets you." />
      <div className="grid gap-3 max-md:gap-2 sm:grid-cols-2">
        <GlassCard padding="md" className="flex items-center gap-3 max-md:p-3.5!">
          <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-accent" aria-hidden="true">
            <MangaMascot width={40} mood="happy" still label="" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 font-semibold max-md:text-[13.5px]">
              <Compass className="size-4 text-primary" aria-hidden="true" /> Welcome tour
            </span>
            <span className="block text-[13px] text-muted-foreground max-md:text-[12px]">A few short steps around your dashboard.</span>
          </span>
          <Button
            variant="outline"
            className="min-h-11 shrink-0 sm:min-h-9"
            onClick={() => {
              requestTourReplay()
              navigate('/employee/dashboard')
            }}
          >
            <PlayCircle /> Replay
          </Button>
        </GlassCard>
        <GlassCard padding="md" className="flex items-center gap-3 max-md:p-3.5!">
          <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-accent text-primary" aria-hidden="true">
            <Volume2 className="size-6" />
          </span>
          <span className="min-w-0 flex-1">
            <label htmlFor="welcome-voice" className="block font-semibold max-md:text-[13.5px]">
              Spoken welcome
            </label>
            <span id="welcome-voice-hint" className="block text-[13px] text-muted-foreground max-md:text-[12px]">
              {canSpeak ? 'Says “Welcome back” out loud after you sign in, on this browser.' : 'This browser cannot speak, so the welcome stays silent.'}
            </span>
            {canSpeak && voice && (
              <button
                type="button"
                onClick={() => speakWelcome(firstNameOf(user?.name))}
                className="focus-ring mt-1 rounded text-[12.5px] font-semibold text-primary underline underline-offset-2"
              >
                Hear it
              </button>
            )}
          </span>
          <Switch
            id="welcome-voice"
            checked={voice && canSpeak}
            disabled={!canSpeak}
            aria-describedby="welcome-voice-hint"
            onCheckedChange={(on) => {
              setVoice(on)
              saveWelcomeVoice(on)
            }}
          />
        </GlassCard>
      </div>
    </section>
  )
}
