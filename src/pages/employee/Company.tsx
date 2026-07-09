import * as React from 'react'
import { useRef, useContext } from 'react'
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  useMotionValue,
  useSpring,
} from 'framer-motion'
import { MainScrollContext } from '@/components/layout/EmployeeLayout'
import {
  Award,
  Factory,
  Globe,
  Layers,
  ShieldCheck,
  Star,
  Truck,
  Users,
  Zap,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react'

// ─── assets ───────────────────────────────────────────────────────────────────
import heroImg from '@/assets/company/hero.png'
import aboutImg from '@/assets/company/about.png'
import infraImg from '@/assets/company/infrastructure.png'
import yarnImg from '@/assets/company/product-yarn.png'
import fabricImg from '@/assets/company/product-fabric.png'
import garmentImg from '@/assets/company/product-garment.png'

// ─── tiny helpers ─────────────────────────────────────────────────────────────
function FadeUp({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

// Parallax image with scroll-driven y movement
function ParallaxImage({
  src,
  alt,
  strength = 60,
  className = '',
  scrollContainer,
}: {
  src: string
  alt: string
  strength?: number
  className?: string
  scrollContainer?: React.RefObject<HTMLElement | null>
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
    ...(scrollContainer ? { container: scrollContainer } : {}),
  })
  const y = useTransform(scrollYProgress, [0, 1], [-strength, strength])

  return (
    <div ref={ref} className={`overflow-hidden ${className}`}>
      <motion.img
        src={src}
        alt={alt}
        style={{ y, scale: 1.15 }}
        className="h-full w-full object-cover"
      />
    </div>
  )
}

// Animated counter
function CountUp({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const raw = useMotionValue(0)
  const spring = useSpring(raw, { stiffness: 80, damping: 20 })
  const [display, setDisplay] = React.useState(0)

  React.useEffect(() => {
    if (inView) raw.set(to)
  }, [inView, to, raw])

  React.useEffect(() => {
    return spring.on('change', (v) => setDisplay(Math.round(v)))
  }, [spring])

  return (
    <span ref={ref}>
      {display}
      {suffix}
    </span>
  )
}

// ─── data ─────────────────────────────────────────────────────────────────────
const stats = [
  { label: 'Years of Excellence', value: 30, suffix: '+' },
  { label: 'Employees', value: 500, suffix: '+' },
  { label: 'Export Countries', value: 20, suffix: '+' },
  { label: 'Products', value: 200, suffix: '+' },
]

const products = [
  {
    title: 'Yarn',
    description:
      'Premium-quality spun and filament yarns crafted for strength, consistency and vibrant colour retention. Suitable for knitting and weaving applications across all textile segments.',
    img: yarnImg,
    accent: 'from-brand-blue to-brand-blue-light',
  },
  {
    title: 'Knitted Fabrics',
    description:
      'State-of-the-art circular and flat-bed knitting machines produce fabrics of superior elasticity and finish. Available in a wide range of GSM, patterns and fibre compositions.',
    img: fabricImg,
    accent: 'from-[#006496] to-[#00a3d4]',
  },
  {
    title: 'Garments',
    description:
      'End-to-end garment manufacturing — from cutting and stitching to finishing and packing. Export-quality apparel produced to international standards for global markets.',
    img: garmentImg,
    accent: 'from-[#735c00] to-[#fed65b]',
  },
]

const infraPoints = [
  { icon: Factory, text: 'Modern spinning & knitting plant spread over 2 lakh sq. ft.' },
  { icon: Zap, text: 'Fully automated production lines with minimal human error' },
  { icon: Layers, text: 'Integrated operations from fibre to finished garment' },
  { icon: Truck, text: 'In-house logistics and warehousing for faster dispatch' },
]

const qualityPoints = [
  'ISO 9001:2015 certified quality management system',
  'Rigorous in-process and final inspection at every stage',
  'State-of-the-art testing laboratory with advanced equipment',
  'Compliance with international textile safety standards',
  'Dedicated R&D team for continuous product improvement',
  'Zero-defect culture driven by trained quality personnel',
]

const clients = [
  'Reliance Retail', 'Arvind Limited', 'Raymond Group', 'Vardhman Textiles',
  'Aditya Birla Fashion', 'Madura Fashion', 'Export Markets', 'Pan-India Distributors',
]

// ─── page ─────────────────────────────────────────────────────────────────────
export default function Company() {
  const scrollContainer = useContext(MainScrollContext)

  return (
    <div className="-mx-4 -mt-4 lg:-mx-6 lg:-mt-6 overflow-hidden">

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section className="relative flex h-[90vh] min-h-[500px] items-center justify-center overflow-hidden">
        {/* parallax background */}
        <div className="absolute inset-0">
          <ParallaxImage src={heroImg} alt="UK Textiles hero" strength={80} className="h-full w-full" scrollContainer={scrollContainer} />
          {/* dark gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
        </div>

        {/* hero content */}
        <div className="relative z-10 flex flex-col items-center gap-6 px-6 text-center text-white">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <img src="/UKT_Company_Logo.png" alt="UK Textiles" className="mx-auto h-20 w-auto drop-shadow-2xl" />
          </motion.div>

          <motion.h1
            className="max-w-3xl text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            Weaving Excellence,{' '}
            <span className="bg-gradient-to-r from-brand-gold to-yellow-300 bg-clip-text text-transparent">
              Thread by Thread
            </span>
          </motion.h1>

          <motion.p
            className="max-w-xl text-base text-white/80 sm:text-lg"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            UK Textiles is a vertically integrated textile manufacturer delivering
            world-class yarn, fabrics and garments to clients across India and beyond.
          </motion.p>

          <motion.a
            href="https://www.uktextiles.in"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            Visit our website <ExternalLink className="size-3.5" />
          </motion.a>
        </div>

        {/* scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        >
          <div className="h-10 w-6 rounded-full border-2 border-white/40 flex items-start justify-center pt-1.5">
            <div className="h-2 w-1 rounded-full bg-white/60" />
          </div>
        </motion.div>
      </section>

      {/* ── STATS STRIP ──────────────────────────────────────────────────────── */}
      <section className="bg-brand-blue py-10">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 px-6 sm:grid-cols-4">
          {stats.map((s, i) => (
            <FadeUp key={s.label} delay={i * 0.1} className="text-center text-white">
              <div className="text-3xl font-bold sm:text-4xl">
                <CountUp to={s.value} suffix={s.suffix} />
              </div>
              <div className="mt-1 text-sm text-white/70">{s.label}</div>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* ── ABOUT US ─────────────────────────────────────────────────────────── */}
      <section className="bg-background py-20">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 lg:grid-cols-2">
          {/* text */}
          <div className="space-y-5">
            <FadeUp>
              <span className="text-xs font-semibold uppercase tracking-widest text-brand-blue-light">
                About Us
              </span>
              <h2 className="mt-2 text-3xl font-bold sm:text-4xl">
                A Legacy of{' '}
                <span className="text-gradient-brand">Textile Innovation</span>
              </h2>
            </FadeUp>
            <FadeUp delay={0.1}>
              <p className="text-muted-foreground leading-relaxed">
                Founded over three decades ago, UK Textiles has grown from a modest
                spinning unit into a fully integrated textile powerhouse. We combine
                time-tested craft with cutting-edge technology to deliver exceptional
                products that meet the demands of a dynamic global market.
              </p>
            </FadeUp>
            <FadeUp delay={0.2}>
              <p className="text-muted-foreground leading-relaxed">
                Our vertically integrated operations — spanning fibre processing,
                yarn spinning, fabric knitting and garment manufacturing — give us
                unmatched control over quality, cost and lead times. Every product that
                leaves our facility carries the assurance of UK Textiles' 30-year legacy.
              </p>
            </FadeUp>
            <FadeUp delay={0.3}>
              <div className="flex flex-wrap gap-3 pt-2">
                {['ISO Certified', 'Export Quality', '30+ Years', 'Pan-India Reach'].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-brand-blue-tint px-4 py-1.5 text-xs font-semibold text-brand-blue"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </FadeUp>
          </div>

          {/* image */}
          <FadeUp delay={0.15}>
            <ParallaxImage
              src={aboutImg}
              alt="UK Textiles manufacturing facility"
              strength={40}
              className="aspect-[4/3] rounded-2xl shadow-clay-lg"
              scrollContainer={scrollContainer}
            />
          </FadeUp>
        </div>
      </section>

      {/* ── PRODUCTS ─────────────────────────────────────────────────────────── */}
      <section className="bg-muted/40 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <FadeUp className="mb-12 text-center">
            <span className="text-xs font-semibold uppercase tracking-widest text-brand-blue-light">
              Our Products
            </span>
            <h2 className="mt-2 text-3xl font-bold sm:text-4xl">
              From Fibre to{' '}
              <span className="text-gradient-brand">Finished Garment</span>
            </h2>
          </FadeUp>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p, i) => (
              <FadeUp key={p.title} delay={i * 0.12}>
                <motion.div
                  className="group relative flex flex-col overflow-hidden rounded-2xl bg-card shadow-clay-sm transition-all"
                  whileHover={{ y: -6, boxShadow: '0 24px 48px -12px rgb(0 100 150 / 0.22)' }}
                >
                  {/* image */}
                  <div className="aspect-[16/10] overflow-hidden">
                    <motion.img
                      src={p.img}
                      alt={p.title}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
                  {/* gradient accent bar */}
                  <div className={`h-1 w-full bg-gradient-to-r ${p.accent}`} />
                  {/* content */}
                  <div className="flex flex-1 flex-col gap-2 p-5">
                    <h3 className="text-lg font-bold">{p.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{p.description}</p>
                  </div>
                </motion.div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── INFRASTRUCTURE ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-28 text-white">
        {/* parallax bg */}
        <div className="absolute inset-0">
          <ParallaxImage src={infraImg} alt="UK Textiles infrastructure" strength={60} className="h-full w-full" scrollContainer={scrollContainer} />
          <div className="absolute inset-0 bg-brand-blue/85" />
        </div>

        <div className="relative z-10 mx-auto max-w-5xl px-6">
          <FadeUp className="mb-12 text-center">
            <span className="text-xs font-semibold uppercase tracking-widest text-brand-gold">
              Infrastructure
            </span>
            <h2 className="mt-2 text-3xl font-bold sm:text-4xl">
              Built for Scale. Built for Quality.
            </h2>
          </FadeUp>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {infraPoints.map((pt, i) => {
              const Icon = pt.icon
              return (
                <FadeUp key={pt.text} delay={i * 0.1}>
                  <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-sm">
                    <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-gold/20">
                      <Icon className="size-5 text-brand-gold" />
                    </div>
                    <p className="text-sm leading-relaxed text-white/90">{pt.text}</p>
                  </div>
                </FadeUp>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── QUALITY ──────────────────────────────────────────────────────────── */}
      <section className="bg-background py-20">
        <div className="mx-auto max-w-5xl px-6">
          <FadeUp className="mb-12 text-center">
            <span className="text-xs font-semibold uppercase tracking-widest text-brand-blue-light">
              Quality
            </span>
            <h2 className="mt-2 text-3xl font-bold sm:text-4xl">
              Our Commitment to{' '}
              <span className="text-gradient-brand">Excellence</span>
            </h2>
          </FadeUp>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {qualityPoints.map((pt, i) => (
              <FadeUp key={pt} delay={i * 0.08}>
                <div className="flex items-start gap-3 rounded-xl border bg-card p-4 shadow-clay-sm">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
                  <p className="text-sm text-foreground/80 leading-relaxed">{pt}</p>
                </div>
              </FadeUp>
            ))}
          </div>

          {/* certifications row */}
          <FadeUp delay={0.2} className="mt-12 flex flex-wrap items-center justify-center gap-4">
            {[
              { icon: ShieldCheck, label: 'ISO 9001:2015' },
              { icon: Award, label: 'Export Excellence' },
              { icon: Star, label: 'Best Quality' },
              { icon: Globe, label: 'Global Standards' },
            ].map((cert) => {
              const Icon = cert.icon
              return (
                <div
                  key={cert.label}
                  className="flex items-center gap-2 rounded-full border border-brand-blue/20 bg-brand-blue-tint px-5 py-2.5 text-sm font-semibold text-brand-blue shadow-clay-sm"
                >
                  <Icon className="size-4" />
                  {cert.label}
                </div>
              )
            })}
          </FadeUp>
        </div>
      </section>

      {/* ── CLIENTELE ────────────────────────────────────────────────────────── */}
      <section className="bg-muted/40 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <FadeUp className="mb-10 text-center">
            <span className="text-xs font-semibold uppercase tracking-widest text-brand-blue-light">
              Clientele
            </span>
            <h2 className="mt-2 text-3xl font-bold sm:text-4xl">
              Trusted by Industry Leaders
            </h2>
          </FadeUp>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {clients.map((client, i) => (
              <FadeUp key={client} delay={i * 0.06}>
                <div className="flex h-16 items-center justify-center rounded-xl border bg-card px-4 text-center text-sm font-semibold text-foreground/70 shadow-clay-sm transition hover:bg-brand-blue-tint hover:text-brand-blue">
                  {client}
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FOOTER ───────────────────────────────────────────────────────── */}
      <section className="bg-brand-gradient py-16 text-white">
        <FadeUp className="mx-auto max-w-2xl px-6 text-center">
          <Users className="mx-auto mb-4 size-10 text-white/60" />
          <h2 className="text-2xl font-bold sm:text-3xl">
            Proud to be part of the UK Textiles family
          </h2>
          <p className="mt-3 text-white/75">
            As an employee, you are at the heart of everything we create.
            Thank you for weaving your commitment into every product we make.
          </p>
          <a
            href="https://www.uktextiles.in"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-brand-blue shadow-clay transition hover:bg-brand-gold hover:text-black"
          >
            Learn more at uktextiles.in <ExternalLink className="size-3.5" />
          </a>
        </FadeUp>
      </section>

    </div>
  )
}
