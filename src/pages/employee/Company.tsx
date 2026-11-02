import * as React from 'react'
import { PageShell } from '@/components/kit'
import { useCompanyFonts, useTabHiddenFlag } from '@/components/company/hooks'
import { Hero, Stats, Tapes } from '@/components/company/HeroSections'
import { AboutSection, ProcessSection, ProductsSection, QualitySection } from '@/components/company/StorySections'
import { ClientsSection, ContactSection, PeopleSection, VisionSection } from '@/components/company/PeopleSections'
import '@/components/company/company.css'

// About UK Textiles. Every fact is from the company's own website, uktextiles.in (lib/company-about.ts holds the words).
// No images: the visuals are type, shapes, gradients and SVG. The page draws its own dark / colour-block skin in both
// app themes, inside one rounded panel in the content area (the shell's weave and sidebar stay as they are). Its own
// hero carries the page's only h1, so it does not use PageHero.
//
// Section rhythm: hero (dark) -> numbers -> crossed marquee tapes -> about (cream) -> how we make it (dark) ->
// what we make (royal) -> quality (dark) -> our people (cream) -> vision (dark) -> trusted by (crimson) -> contact.

const STORY_ID = 'ukt-story'

export default function Company() {
  const root = React.useRef<HTMLElement>(null)
  const [paused, setPaused] = React.useState(false)
  useCompanyFonts()
  useTabHiddenFlag(root)

  return (
    <PageShell width="wide">
      <article ref={root} className="ukt-about" aria-labelledby="ukt-hero-title" data-user-paused={paused ? 'true' : 'false'}>
        <Hero storyId={STORY_ID} paused={paused} onTogglePaused={() => setPaused((p) => !p)} />
        <Stats />
        <Tapes />
        <AboutSection id={STORY_ID} />
        <ProcessSection />
        <ProductsSection />
        <QualitySection />
        <PeopleSection />
        <VisionSection />
        <ClientsSection />
        <ContactSection />
      </article>
    </PageShell>
  )
}
