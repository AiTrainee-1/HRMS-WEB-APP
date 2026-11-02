// The "About UK Textiles" page (pages/employee/Company.tsx): its words and the small pure helpers it is drawn with.
//
// Every fact is from the company's own website, uktextiles.in (company, infrastructure, products, quality, human
// resources, clientele and contact pages, read 2026-11-02), lightly edited for clarity. Nothing is invented: no
// made-up figures, clients, awards or "live" numbers. The years figure is worked out from today, never hard-coded.
//
// Pure TypeScript with no browser globals, so Node's test runner loads it (`npm test`).
import { formatCount } from './money.ts'

export const FOUNDED_YEAR = 1993
/** "Nearly 4,00,000 pieces every month" (uktextiles.in). */
export const MONTHLY_PIECES = 400000
export const EMBROIDERY_HEADS = 20

/** Whole calendar years from `year` to today's year (1993 -> 33 in 2026). Never negative; junk gives 0. */
export function yearsSince(year: number, today: Date = new Date()): number {
  if (typeof year !== 'number' || !Number.isFinite(year)) return 0
  if (!(today instanceof Date) || Number.isNaN(today.getTime())) return 0
  return Math.max(0, today.getFullYear() - Math.trunc(year))
}

/** 1 -> "01", 7 -> "07", 12 -> "12". */
export function pad2(n: number): string {
  const r = Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0
  return String(r).padStart(2, '0')
}

// ── Hero ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The slider lines on uktextiles.in. */
export const TAGLINES = [
  'One stop shop for high fashion garment manufacturing',
  'High fashion, value-added garment manufacturers',
  'Modern, vertically integrated garment manufacturing facility',
  'Consistent quality and timely delivery are our focus',
  'Be in style',
] as const

export type StickerTone = 'butter' | 'periwinkle' | 'pink'

export interface Sticker {
  code: string
  text: string
  tone: StickerTone
}

/** The small tilted tags above the hero headline. */
export function heroStickers(): Sticker[] {
  return [
    { code: 'N1.01', text: `Knitwear since ${FOUNDED_YEAR}`, tone: 'butter' },
    { code: 'N1.02', text: 'Tirupur, India', tone: 'periwinkle' },
    { code: 'N1.03', text: `${formatCount(MONTHLY_PIECES)} pcs / month`, tone: 'pink' },
  ]
}

export const HERO_INTRO =
  `Since ${FOUNDED_YEAR} we have made and exported knitted garments for men, women and children from Tirupur, the ` +
  'hosiery capital of South India: a one-stop shop for high-fashion garment manufacturing, with consistent quality ' +
  'and timely delivery as our focus.'

// ── Stats ───────────────────────────────────────────────────────────────────────────────────────────────────────────

export type StatTone = 'butter' | 'pink' | 'periwinkle'

export interface CompanyStat {
  key: string
  value: number
  /** Short unit drawn after the figure ("years"); empty for none. */
  unit: string
  caption: string
  tone: StatTone
}

/** The count-up row under the hero. Only true figures from the website; the years are worked out from `today`. */
export function companyStats(today: Date = new Date()): CompanyStat[] {
  return [
    { key: 'years', value: yearsSince(FOUNDED_YEAR, today), unit: 'years', caption: `Making knitwear since ${FOUNDED_YEAR}`, tone: 'butter' },
    { key: 'pieces', value: MONTHLY_PIECES, unit: 'pcs', caption: 'Nearly this many pieces made every month', tone: 'pink' },
    { key: 'segments', value: SEGMENTS.length, unit: '', caption: 'Segments: men, women and children', tone: 'periwinkle' },
    { key: 'embroidery', value: EMBROIDERY_HEADS, unit: 'head', caption: 'Tajima embroidery machine', tone: 'butter' },
    { key: 'group', value: GROUP_COMPANIES.length, unit: '', caption: 'Group companies', tone: 'pink' },
    { key: 'certificates', value: CERTIFICATIONS.length, unit: '', caption: 'Certificates and approvals', tone: 'periwinkle' },
  ]
}

/** The big words that scroll across the band under the stats (decorative; every word is said again on the page). */
export const MARQUEE_WORDS = [
  'Knitwear',
  'Men',
  'Women',
  'Children',
  'Embroidery',
  'Printing',
  'Value additions',
  'On time, every time',
] as const

// ── About ───────────────────────────────────────────────────────────────────────────────────────────────────────────

export const ABOUT_PARAGRAPHS = [
  `The year ${FOUNDED_YEAR} saw our inception as a knitted garments manufacturer and exporter. We set up base in ` +
    'Tirupur, the hosiery capital of South India. Located near Coimbatore, Tirupur enjoys easy access to all major ' +
    'towns and cities.',
  'With a state-of-the-art manufacturing facility, we produce some of the finest quality garments for a discerning ' +
    'international clientele. Our specialisation is knitwear for all segments. From the latest ERP-enabled systems to ' +
    `the most advanced machinery, we are equipped to manufacture and export nearly ${formatCount(MONTHLY_PIECES)} ` +
    'pieces every month.',
  'Backed by a visionary, dynamic and professional management, we are motivated to excel in each of our endeavours.',
] as const

export const GROUP_COMPANIES = ['UK Textiles', 'Exult Clothing Company', 'Vyshak Garments'] as const

// ── How we make it (the infrastructure page, as a chain) ────────────────────────────────────────────────────────────

export type StepIcon = 'sampling' | 'merchandising' | 'production' | 'embroidery' | 'printing' | 'value' | 'logistics'

export interface ProcessStep {
  number: string
  title: string
  text: string
  /** A short mono tag on the card. */
  tag: string
  icon: StepIcon
}

export const PROCESS_STEPS: ProcessStep[] = [
  {
    number: '01',
    title: 'Sampling',
    text: "An exclusive sampling department develops samples to each customer's requirements. Production starts on the sample the client approves.",
    tag: 'Client-approved sample',
    icon: 'sampling',
  },
  {
    number: '02',
    title: 'Merchandising',
    text: 'Merchandisers follow every step of production and work with customers, so their requirements are met.',
    tag: 'Every step followed',
    icon: 'merchandising',
  },
  {
    number: '03',
    title: 'Production',
    text: 'Some of the finest cutting and sewing machinery from around the world. A needle-detection facility makes sure every product is metal-free.',
    tag: 'Needle detection',
    icon: 'production',
  },
  {
    number: '04',
    title: 'Embroidery',
    text: `A highly advanced ${EMBROIDERY_HEADS}-head Tajima machine for the finest embroidery designs.`,
    tag: `${EMBROIDERY_HEADS}-head Tajima`,
    icon: 'embroidery',
  },
  {
    number: '05',
    title: 'Printing',
    text: 'Table and machine printing for a wide range of print patterns.',
    tag: 'Table + machine',
    icon: 'printing',
  },
  {
    number: '06',
    title: 'Value additions',
    text: 'Embroidery finishes, different washes, sequin and bead work, crochet work and more.',
    tag: 'Washes · sequins · crochet',
    icon: 'value',
  },
  {
    number: '07',
    title: 'Logistics',
    text: "An efficient logistics department dispatches every order on time, meeting each customer's specific needs.",
    tag: 'On time, every time',
    icon: 'logistics',
  },
]

// ── What we make ────────────────────────────────────────────────────────────────────────────────────────────────────

export type SegmentKey = 'men' | 'women' | 'children'

export interface Segment {
  key: SegmentKey
  title: string
  text: string
}

export const SEGMENTS: Segment[] = [
  { key: 'men', title: 'Men', text: 'High-fashion knitwear for the menswear segment.' },
  { key: 'women', title: 'Women', text: 'Fashion-led, value-added knitted womenswear.' },
  { key: 'children', title: 'Children', text: 'Knitted childrenswear, made to the same standards.' },
]

// ── Quality ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export const QUALITY_TEXT =
  'Quality has always been a way of life at UK Textiles. From procuring the yarn to producing the garment, rigorous ' +
  'quality control is ensured at every stage. A team of trained quality-control staff and the latest testing ' +
  'equipment make sure every product that leaves our premises meets world-class standards.'

export const CERTIFICATION_TEXT =
  'We are certified SA 8000 as a responsible apparel producer, and OEKO-TEX Standard 100 and Sedex for products free ' +
  'from harmful substances.'

/** "Certificates & approvals" on uktextiles.in. */
export const CERTIFICATIONS = ['SA 8000', 'OEKO-TEX Standard 100', 'Sedex', 'WRAP', 'Disney'] as const

/** The stages the quality visual walks through, yarn to garment. */
export const QUALITY_STAGES = ['Yarn', 'Knitted fabric', 'Garment'] as const

// ── Our people (the human resources page) ───────────────────────────────────────────────────────────────────────────

export const PEOPLE_INTRO =
  'Our people are not just our backbone; they lead us forward to new goals. We make sure everyone who works here has ' +
  'rewarding, satisfying employment and a comfortable presence on our premises.'

export type WelfareIcon = 'creche' | 'food' | 'medical' | 'awareness' | 'training' | 'social'

export interface WelfareItem {
  number: string
  title: string
  text: string
  icon: WelfareIcon
}

export const WELFARE: WelfareItem[] = [
  { number: '01', title: 'Baby crèche', text: 'A safe place on the premises where you can leave your baby while you work.', icon: 'creche' },
  { number: '02', title: 'Food court & drinking water', text: 'A spacious food court with clean drinking water and neat dining.', icon: 'food' },
  { number: '03', title: 'Medical care', text: 'Immediate medical care when it is needed.', icon: 'medical' },
  { number: '04', title: 'Awareness campaigns', text: 'Awareness campaigns run on the premises by NGOs.', icon: 'awareness' },
  { number: '05', title: 'Training', text: 'Training sessions that keep everyone up to date in their field.', icon: 'training' },
  {
    number: '06',
    title: "Women's empowerment, no child labour",
    text: "We work with social organisations for women's empowerment and the eradication of child labour.",
    icon: 'social',
  },
]

// ── Vision ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface VisionLine {
  number: string
  text: string
  /** An italic tail drawn after `text` (the motto's "on time, every time."). */
  accent?: string
  /** A small label above the line ("Our motto"). */
  label?: string
}

export const VISION: VisionLine[] = [
  {
    number: '01',
    text: 'Set a precedent in the global manufacturing industry through continuous innovation, exceptional products, focused services and enhanced customer satisfaction.',
  },
  { number: '02', text: 'Keep a sharp eye on quality and constantly raise the bar.' },
  { number: '03', text: 'Comply flawlessly with every statutory regulation our customers require, in any country.' },
  {
    number: '04',
    text: "Build and keep a logistics infrastructure of the highest efficiency, one that blends seamlessly with our customers' own supply chains.",
  },
  {
    number: '05',
    label: 'Our motto',
    text: 'The highest standards of quality at the best possible prices, with shipments delivered',
    accent: 'on time, every time.',
  },
]

// ── Trusted by ──────────────────────────────────────────────────────────────────────────────────────────────────────

export const CLIENTELE_TEXT =
  'Over the years we have won the patronage of some of the most eminent names across the globe. Their continued ' +
  'trust motivates us to keep delivering innovation in fashion.'

/** How a client's name is set: our own type, not their logos. */
export type WordmarkStyle = 'display' | 'serif' | 'mono' | 'wide'

export interface Client {
  name: string
  style: WordmarkStyle
}

export const CLIENTS: Client[] = [
  { name: 'Diesel', style: 'display' },
  { name: 'K&L Ruppert', style: 'serif' },
  { name: 's.Oliver', style: 'mono' },
  { name: "Levi's", style: 'display' },
  { name: "Marc O'Polo", style: 'wide' },
]

// ── Contact ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export const CONTACT = {
  name: 'U.K. Textiles',
  addressLines: ['199-E (New), Sivakami Nagar Main Road', 'A.B. Nagar, Gandhi Nagar Post', 'Tirupur – 641603, Tamil Nadu, India'],
  phone: '0421 430 0800',
  email: 'uktex@uktex.net',
  website: 'https://uktextiles.in',
  websiteLabel: 'uktextiles.in',
} as const

/** A tel: link from a typed number: digits only, keeping a leading "+". "0421 430 0800" -> "tel:04214300800". */
export function telHref(phone: string): string {
  const s = String(phone ?? '').trim()
  const digits = s.replace(/\D/g, '')
  return `tel:${s.startsWith('+') ? '+' : ''}${digits}`
}

export function mailtoHref(email: string): string {
  return `mailto:${String(email ?? '').trim()}`
}

/** A Google Maps search for the address (opens the app on phones). */
export function mapsHref(lines: readonly string[]): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lines.join(', '))}`
}

// ── Fonts (loaded on this page only) ────────────────────────────────────────────────────────────────────────────────

/** Bricolage Grotesque (variable: optical size, width, 700-800), Instrument Serif italic, JetBrains Mono 500. */
export const COMPANY_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,700..800' +
  '&family=Instrument+Serif:ital@1&family=JetBrains+Mono:wght@500&display=swap'

// ── Thread particles (the hero's falling fibres) ────────────────────────────────────────────────────────────────────

export const MAX_THREADS = 30

export type ThreadTone = 'cream' | 'butter' | 'periwinkle' | 'pink'

export interface ThreadParticle {
  /** Horizontal position, % of the hero's width. */
  left: number
  /** One fall, top to bottom, in seconds. */
  duration: number
  /** Negative, so the field starts mid-fall instead of empty. */
  delay: number
  /** Length of the fibre in px. */
  length: number
  opacity: number
  /** Glowing tip's twinkle period in seconds. */
  twinkle: number
  /** Where it rests when nothing moves (reduced motion), as a translateY % of the hero's height (-95..-10). */
  rest: number
  tone: ThreadTone
}

/** Mulberry32: a tiny seeded generator, so the field looks the same on every visit (and in tests). */
function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places

/**
 * `count` fibres (capped at MAX_THREADS), spread evenly across the width (one per column, jittered inside it) so they
 * never clump. Deterministic for a seed.
 */
export function threadParticles(count: number, seed: number = 1993): ThreadParticle[] {
  const n = Number.isFinite(count) ? Math.min(MAX_THREADS, Math.max(0, Math.trunc(count))) : 0
  const rand = seeded(Number.isFinite(seed) ? seed : 1993)
  const out: ThreadParticle[] = []
  for (let i = 0; i < n; i++) {
    const duration = round(12 + rand() * 12, 1)
    const t = rand()
    const tone: ThreadTone = t < 0.4 ? 'cream' : t < 0.65 ? 'butter' : t < 0.85 ? 'periwinkle' : 'pink'
    out.push({
      left: round(((i + 0.1 + rand() * 0.8) / n) * 100, 2),
      duration,
      delay: -round(rand() * duration, 1),
      length: Math.round(14 + rand() * 34),
      opacity: round(0.35 + rand() * 0.6, 2),
      twinkle: round(1.8 + rand() * 2.2, 1),
      rest: -Math.round(10 + rand() * 85),
      tone,
    })
  }
  return out
}
