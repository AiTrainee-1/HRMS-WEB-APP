import { Link } from 'wouter'
import { motion } from 'framer-motion'
import { ChevronRight, Fingerprint, Info, KeyRound, LifeBuoy, Send, Wallet, type LucideIcon } from 'lucide-react'
import { GlassCard, PageHero, PageShell, SectionHeader, TONE_SOFT, listItem, type Tone } from '@/components/kit'
import { SupportContactCard } from '@/components/support/SupportContactCard'
import { useSupportContact } from '@/hooks/useSupportContact'
import { AppTipsSection } from '@/components/system/AppTipsSection'
import { cn } from '@/lib/utils'

// Questions people usually call HR about that the app already answers: try these first.
const SELF_HELP: { icon: LucideIcon; tone: Tone; title: string; text: string; href: string }[] = [
  { icon: Fingerprint, tone: 'rose', title: 'A punch is missing', text: 'Ask for it to be added on Missing Punch.', href: '/employee/missing-punch' },
  { icon: Send, tone: 'sapphire', title: 'Where is my leave?', text: 'Leave shows who decided it and when.', href: '/employee/leave' },
  { icon: Wallet, tone: 'emerald', title: 'A question about pay', text: 'Your slip shows each amount and deduction.', href: '/employee/salary' },
  { icon: KeyRound, tone: 'amber', title: 'Change my password', text: 'Open your profile and choose Change password.', href: '/employee/profile' },
]

/**
 * Who to contact and for what, from the details HR keeps under Settings -> HR Contact.
 * Phones (< 768px): the mobile app's Help & Support screen (app/help/index.tsx) - "Who to contact, and when", the short
 * intro, the two contact cards 12px apart, the note in a blue tint; the web's "Try these first" links stay below.
 */
export default function Help() {
  const { data } = useSupportContact()
  const note = data?.configured ? (data.note ?? '') : ''

  return (
    <PageShell>
      <>
        <PageHero
          icon={<LifeBuoy />}
          title="Help & Support"
          subtitle={
            <>
              <span className="max-md:hidden">Who to contact when you can't sign in, something in the app isn't working, or the server is down.</span>
              <span className="hidden max-md:inline">Who to contact, and when</span>
            </>
          }
        />
        <p className="hidden max-md:mt-3 max-md:block max-md:text-[13px] max-md:leading-[19px] max-md:text-muted-foreground">
          Pick the contact that fits your problem. Both are kept up to date by HR.
        </p>
      </>

      <div className="grid gap-6 max-md:gap-3 lg:grid-cols-2">
        <SupportContactCard situation="hr" title="HR Department: sign-in and app problems" showNote={false} />
        <SupportContactCard situation="server" title="Software Support: server or system not working" showNote={false} />
      </div>

      {note && (
        <GlassCard
          padding="md"
          className="flex items-start gap-3 text-sm whitespace-pre-line text-muted-foreground max-md:gap-2 max-md:border-0! max-md:bg-accent! max-md:p-3! max-md:text-[12.5px] max-md:leading-[18px] max-md:text-foreground max-md:shadow-none!"
        >
          <Info className="mt-0.5 size-4 shrink-0 text-info max-md:text-primary" aria-hidden="true" /> {note}
        </GlassCard>
      )}

      <section aria-labelledby="self-help" className="flex flex-col gap-4">
        <SectionHeader id="self-help" icon={Info} title="Try these first" description="Most questions are answered on these pages." />
        <ul className="grid gap-3 max-md:gap-2 sm:grid-cols-2">
          {SELF_HELP.map((h, i) => (
            <motion.li key={h.href} {...listItem(i)}>
              <GlassCard variant="interactive" asChild padding="md" className="group flex items-center gap-3 max-md:p-3.5!">
                <Link href={h.href}>
                  <span className={cn('grid size-10 shrink-0 place-items-center rounded-lg border max-md:size-9 max-md:border-0', TONE_SOFT[h.tone])} aria-hidden="true">
                    <h.icon className="size-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold max-md:text-[13.5px]">{h.title}</span>
                    <span className="block text-[13px] text-muted-foreground max-md:text-[12px]">{h.text}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              </GlassCard>
            </motion.li>
          ))}
        </ul>
      </section>

      {/* owner 2026-11-25: replay the dashboard's welcome tour; the spoken welcome after sign-in on / off */}
      <AppTipsSection />
    </PageShell>
  )
}
