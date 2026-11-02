import { Link } from 'wouter'
import { motion } from 'framer-motion'
import { ArrowUpRight, Baby, Globe, GraduationCap, HandHeart, HeartPulse, Mail, MapPin, Megaphone, Phone, Utensils, type LucideIcon } from 'lucide-react'
import {
  CLIENTELE_TEXT, CLIENTS, CONTACT, PEOPLE_INTRO, VISION, WELFARE, mailtoHref, mapsHref, telHref, type WelfareIcon,
} from '@/lib/company-about'
import { ContactRow, Eyebrow, Reveal, SectionTitle } from './CompanyBits'
import { REVEAL_VIEWPORT, revealGroup, revealUp } from './hooks'

const WELFARE_ICONS: Record<WelfareIcon, LucideIcon> = {
  creche: Baby,
  food: Utensils,
  medical: HeartPulse,
  awareness: Megaphone,
  training: GraduationCap,
  social: HandHeart,
}

/** "— OUR PEOPLE" on cream: the welfare facilities as numbered cards, and where to go with a work question. */
export function PeopleSection() {
  return (
    <section className="ukt-sec ukt-block--cream" aria-labelledby="ukt-people-title">
      <Reveal className="max-w-3xl">
        <Eyebrow>Our people</Eyebrow>
        <SectionTitle id="ukt-people-title" before="Our people" accent="lead us forward." />
        <p className="ukt-lead mt-6">{PEOPLE_INTRO}</p>
      </Reveal>
      <motion.ul
        className="m-0 mt-10 grid list-none gap-4 p-0 @xl:grid-cols-2 @4xl:grid-cols-3 @4xl:gap-5"
        variants={revealGroup}
        initial="hidden"
        whileInView="show"
        viewport={REVEAL_VIEWPORT}
      >
        {WELFARE.map((w) => {
          const Icon = WELFARE_ICONS[w.icon]
          return (
            <motion.li key={w.number} variants={revealUp}>
              <div className="ukt-welfare ukt-lift">
                <div className="flex items-start justify-between gap-3">
                  <span className="ukt-welfare__num" aria-hidden="true">
                    {w.number}
                  </span>
                  <span className="ukt-icon-ring" aria-hidden="true">
                    <Icon />
                  </span>
                </div>
                <h3 className="ukt-h3 ukt-welfare__title">{w.title}</h3>
                <p className="ukt-welfare__text">{w.text}</p>
              </div>
            </motion.li>
          )
        })}
      </motion.ul>
      <Reveal className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-3">
        <p className="ukt-body m-0 font-semibold">Need something at work? HR can help.</p>
        <Link href="/employee/help" className="ukt-pill ukt-pill--ink">
          Help &amp; Support
          <span className="ukt-pill__badge" aria-hidden="true">
            <ArrowUpRight />
          </span>
        </Link>
      </Reveal>
    </section>
  )
}

/** "— VISION": the five aims as big numbered lines; the last is the motto. */
export function VisionSection() {
  return (
    <section className="ukt-sec" aria-labelledby="ukt-vision-title">
      <div aria-hidden="true" className="ukt-glow ukt-glow--blue" style={{ bottom: '-20%', left: '-20%', width: 'max(70%, 440px)' }} />
      <div aria-hidden="true" className="ukt-glow ukt-glow--crimson" style={{ top: '-10%', right: '-25%', width: 'max(55%, 380px)' }} />
      <Reveal className="max-w-3xl">
        <Eyebrow>Vision</Eyebrow>
        <SectionTitle id="ukt-vision-title" before="What we" accent="aim for." />
      </Reveal>
      <motion.ol className="ukt-vision mt-10" variants={revealGroup} initial="hidden" whileInView="show" viewport={REVEAL_VIEWPORT}>
        {VISION.map((v) => (
          <motion.li key={v.number} variants={revealUp} className={`ukt-vision__item${v.accent ? ' ukt-vision__item--motto' : ''}`}>
            <span className="ukt-outline ukt-vision__num" aria-hidden="true">
              {v.number}
            </span>
            <p className="ukt-vision__text">
              {v.label && <span className="ukt-vision__label">{v.label}</span>}
              {v.text}
              {v.accent && (
                <>
                  {' '}
                  <span className="ukt-accent">{v.accent}</span>
                </>
              )}
            </p>
          </motion.li>
        ))}
      </motion.ol>
    </section>
  )
}

// Phones: two a row, the fifth across both. Tablets: three then two (a six-column grid). Wide: five in a row.
const CLIENT_SPANS = [
  '@3xl:col-span-2 @5xl:col-span-1',
  '@3xl:col-span-2 @5xl:col-span-1',
  '@3xl:col-span-2 @5xl:col-span-1',
  '@3xl:col-span-3 @5xl:col-span-1',
  'col-span-2 @3xl:col-span-3 @5xl:col-span-1',
]

/** "— TRUSTED BY" on crimson: the clientele line and the five client names set as text (no logos). */
export function ClientsSection() {
  return (
    <section className="ukt-sec ukt-block--crimson" aria-labelledby="ukt-clients-title">
      <div className="grid gap-8 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @4xl:items-end">
        <Reveal>
          <Eyebrow>Trusted by</Eyebrow>
          <SectionTitle id="ukt-clients-title" before="Eminent names," accent="continued trust." />
        </Reveal>
        <Reveal delay={0.1}>
          <blockquote className="ukt-quote">{CLIENTELE_TEXT}</blockquote>
        </Reveal>
      </div>
      <motion.ul
        className="m-0 mt-10 grid list-none grid-cols-2 gap-3 p-0 @3xl:grid-cols-6 @5xl:grid-cols-5"
        aria-label="Some of our clients"
        variants={revealGroup}
        initial="hidden"
        whileInView="show"
        viewport={REVEAL_VIEWPORT}
      >
        {CLIENTS.map((c, i) => (
          <motion.li key={c.name} variants={revealUp} className={CLIENT_SPANS[i]}>
            <span className="ukt-client ukt-lift" data-style={c.style}>
              {c.name}
            </span>
          </motion.li>
        ))}
      </motion.ul>
      <p className="ukt-fineprint mt-6">Names shown as plain text. Trademarks belong to their owners.</p>
    </section>
  )
}

/** The head office card (tap to call, email, website, directions), the Help & Support way to HR, and the sign-off. */
export function ContactSection() {
  return (
    <section className="ukt-sec" aria-labelledby="ukt-contact-title">
      <div aria-hidden="true" className="ukt-glow ukt-glow--blue" style={{ top: '-10%', left: '20%', width: 'max(70%, 440px)' }} />
      <Reveal>
        <div className="ukt-contact">
          <div className="grid gap-10 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] @4xl:gap-14">
            <div className="flex min-w-0 flex-col gap-6">
              <div>
                <Eyebrow>Head office</Eyebrow>
                <SectionTitle id="ukt-contact-title" before="Write, call or" accent="visit us." />
              </div>
              <address className="ukt-address">
                <strong className="font-bold">{CONTACT.name}</strong>
                {CONTACT.addressLines.map((l) => (
                  <span key={l} className="block">
                    {l}
                  </span>
                ))}
              </address>
              <div className="ukt-help mt-auto flex flex-col gap-4">
                <div>
                  <p className="ukt-h3 m-0 text-[19px]">Questions about your job, pay or leave?</p>
                  <p className="ukt-body m-0 mt-1 text-[14.5px]">HR answers those. Reach them from Help &amp; Support.</p>
                </div>
                <Link href="/employee/help" className="ukt-pill ukt-pill--butter self-start">
                  Help &amp; Support
                  <span className="ukt-pill__badge" aria-hidden="true">
                    <ArrowUpRight />
                  </span>
                </Link>
              </div>
            </div>
            <ul className="m-0 flex list-none flex-col gap-3 p-0" aria-label="Contact the head office">
              <li>
                <ContactRow icon={Phone} label="Call the head office" value={CONTACT.phone} href={telHref(CONTACT.phone)} />
              </li>
              <li>
                <ContactRow icon={Mail} label="Email" value={CONTACT.email} href={mailtoHref(CONTACT.email)} />
              </li>
              <li>
                <ContactRow icon={Globe} label="Website" value={CONTACT.websiteLabel} href={CONTACT.website} external />
              </li>
              <li>
                <ContactRow icon={MapPin} label="Directions" value="Open in Google Maps" href={mapsHref([CONTACT.name, ...CONTACT.addressLines])} external />
              </li>
            </ul>
          </div>
        </div>
      </Reveal>

      <Reveal className="mt-14 flex flex-col gap-4 @3xl:mt-20 @3xl:flex-row @3xl:items-end @3xl:justify-between">
        <p className="ukt-display ukt-signoff m-0">
          Be in <span className="ukt-accent">style.</span>
        </p>
        <p className="ukt-mono m-0 text-[11px]" style={{ color: 'var(--ukt-muted)' }}>
          © UK Textiles · Tirupur, Tamil Nadu · Details from uktextiles.in
        </p>
      </Reveal>
    </section>
  )
}
