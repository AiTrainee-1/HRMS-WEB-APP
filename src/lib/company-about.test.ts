// Run with `npm test`. The About UK Textiles page's content (lib/company-about.ts): the years figure, the shape of
// every list the page draws, the contact links, the page-only font URL and the seeded thread particles.
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  ABOUT_PARAGRAPHS,
  CERTIFICATIONS,
  CLIENTS,
  COMPANY_FONTS_HREF,
  CONTACT,
  FOUNDED_YEAR,
  GROUP_COMPANIES,
  HERO_INTRO,
  MARQUEE_WORDS,
  MAX_THREADS,
  MONTHLY_PIECES,
  PROCESS_STEPS,
  QUALITY_STAGES,
  SEGMENTS,
  TAGLINES,
  VISION,
  WELFARE,
  companyStats,
  heroStickers,
  mailtoHref,
  mapsHref,
  pad2,
  telHref,
  threadParticles,
  yearsSince,
} from './company-about.ts'

const NOV_2_2026 = new Date(2026, 10, 2)

describe('yearsSince', () => {
  test('1993 is 33 years ago in 2026, all year round', () => {
    assert.equal(yearsSince(1993, NOV_2_2026), 33)
    assert.equal(yearsSince(1993, new Date(2026, 0, 1)), 33)
    assert.equal(yearsSince(1993, new Date(2026, 11, 31)), 33)
  })

  test('moves with the calendar instead of being hard-coded', () => {
    assert.equal(yearsSince(1993, new Date(2027, 0, 1)), 34)
    assert.equal(yearsSince(1993, new Date(2040, 5, 15)), 47)
  })

  test('this year is 0; a future year is never negative', () => {
    assert.equal(yearsSince(2026, NOV_2_2026), 0)
    assert.equal(yearsSince(2030, NOV_2_2026), 0)
  })

  test('junk gives 0', () => {
    assert.equal(yearsSince(Number.NaN, NOV_2_2026), 0)
    assert.equal(yearsSince(Number.POSITIVE_INFINITY, NOV_2_2026), 0)
    assert.equal(yearsSince(1993, new Date('not a date')), 0)
    assert.equal(yearsSince('1993' as unknown as number, NOV_2_2026), 0)
  })

  test('defaults to today', () => {
    assert.equal(yearsSince(FOUNDED_YEAR), new Date().getFullYear() - FOUNDED_YEAR)
  })
})

describe('pad2', () => {
  test('two digits', () => {
    assert.deepEqual([1, 7, 10, 12].map(pad2), ['01', '07', '10', '12'])
    assert.equal(pad2(-3), '00')
    assert.equal(pad2(Number.NaN), '00')
  })
})

describe('companyStats', () => {
  const stats = companyStats(NOV_2_2026)

  test('six figures, in order, keys unique', () => {
    assert.deepEqual(stats.map((s) => s.key), ['years', 'pieces', 'segments', 'embroidery', 'group', 'certificates'])
  })

  test('only the true figures from the website', () => {
    const by = Object.fromEntries(stats.map((s) => [s.key, s.value]))
    assert.deepEqual(by, { years: 33, pieces: 400000, segments: 3, embroidery: 20, group: 3, certificates: 5 })
  })

  test('the years follow the date it is drawn on', () => {
    assert.equal(companyStats(new Date(2031, 2, 1))[0].value, 38)
  })

  test('every figure is a whole positive number with a caption and a tone', () => {
    for (const s of stats) {
      assert.ok(Number.isInteger(s.value) && s.value > 0, s.key)
      assert.ok(s.caption.trim().length > 0, s.key)
      assert.ok(['butter', 'pink', 'periwinkle'].includes(s.tone), s.key)
    }
  })
})

describe('hero', () => {
  test('stickers carry the year, the place and the monthly output in Indian grouping', () => {
    const s = heroStickers()
    assert.deepEqual(s.map((x) => x.code), ['N1.01', 'N1.02', 'N1.03'])
    assert.equal(s[0].text, 'Knitwear since 1993')
    assert.equal(s[1].text, 'Tirupur, India')
    assert.equal(s[2].text, '4,00,000 pcs / month')
  })

  test('the intro names the year and the place', () => {
    assert.match(HERO_INTRO, /1993/)
    assert.match(HERO_INTRO, /Tirupur/)
  })

  test('the five taglines from the site', () => {
    assert.equal(TAGLINES.length, 5)
    assert.equal(TAGLINES[4], 'Be in style')
  })

  test('marquee words', () => {
    assert.deepEqual([...MARQUEE_WORDS], ['Knitwear', 'Men', 'Women', 'Children', 'Embroidery', 'Printing', 'Value additions', 'On time, every time'])
  })
})

describe('content shape', () => {
  test('about: three paragraphs, the output written the Indian way', () => {
    assert.equal(ABOUT_PARAGRAPHS.length, 3)
    assert.match(ABOUT_PARAGRAPHS[1], /4,00,000 pieces every month/)
    assert.equal(MONTHLY_PIECES, 400000)
  })

  test('group companies', () => {
    assert.deepEqual([...GROUP_COMPANIES], ['UK Textiles', 'Exult Clothing Company', 'Vyshak Garments'])
  })

  test('the process chain is 01 to 07 in the order a garment is made', () => {
    assert.deepEqual(PROCESS_STEPS.map((s) => s.number), ['01', '02', '03', '04', '05', '06', '07'])
    assert.deepEqual(PROCESS_STEPS.map((s) => s.title), [
      'Sampling', 'Merchandising', 'Production', 'Embroidery', 'Printing', 'Value additions', 'Logistics',
    ])
    assert.equal(new Set(PROCESS_STEPS.map((s) => s.icon)).size, 7)
    assert.match(PROCESS_STEPS[3].text, /20-head Tajima/)
    assert.match(PROCESS_STEPS[2].text, /needle-detection/)
  })

  test('three segments', () => {
    assert.deepEqual(SEGMENTS.map((s) => s.key), ['men', 'women', 'children'])
  })

  test('quality: five certificates and approvals, three stages', () => {
    assert.deepEqual([...CERTIFICATIONS], ['SA 8000', 'OEKO-TEX Standard 100', 'Sedex', 'WRAP', 'Disney'])
    assert.deepEqual([...QUALITY_STAGES], ['Yarn', 'Knitted fabric', 'Garment'])
  })

  test('our people: six welfare cards numbered 01 to 06', () => {
    assert.deepEqual(WELFARE.map((w) => w.number), ['01', '02', '03', '04', '05', '06'])
    assert.equal(new Set(WELFARE.map((w) => w.icon)).size, 6)
    assert.match(WELFARE[0].title, /crèche/)
  })

  test('vision: five lines, the last is the motto with its accent', () => {
    assert.deepEqual(VISION.map((v) => v.number), ['01', '02', '03', '04', '05'])
    assert.equal(VISION[4].label, 'Our motto')
    assert.equal(VISION[4].accent, 'on time, every time.')
    assert.ok(VISION.slice(0, 4).every((v) => v.accent === undefined))
  })

  test('clients are the five names on the site, set as text', () => {
    assert.deepEqual(CLIENTS.map((c) => c.name), ['Diesel', 'K&L Ruppert', 's.Oliver', "Levi's", "Marc O'Polo"])
  })

  test('no empty or untrimmed strings anywhere', () => {
    const all: string[] = [
      ...TAGLINES, ...MARQUEE_WORDS, ...ABOUT_PARAGRAPHS, ...GROUP_COMPANIES, ...CERTIFICATIONS, ...QUALITY_STAGES,
      ...PROCESS_STEPS.flatMap((s) => [s.title, s.text, s.tag]),
      ...SEGMENTS.flatMap((s) => [s.title, s.text]),
      ...WELFARE.flatMap((w) => [w.title, w.text]),
      ...VISION.flatMap((v) => [v.text, v.accent ?? 'x', v.label ?? 'x']),
      ...CLIENTS.map((c) => c.name),
      ...CONTACT.addressLines, CONTACT.name, CONTACT.phone, CONTACT.email, CONTACT.website,
    ]
    for (const s of all) {
      assert.ok(s.length > 0 && s === s.trim(), JSON.stringify(s))
      assert.doesNotMatch(s, /undefined|NaN/)
    }
  })
})

describe('contact links', () => {
  test('tel: keeps digits (and a leading +) only', () => {
    assert.equal(telHref(CONTACT.phone), 'tel:04214300800')
    assert.equal(telHref(' +91 421-430-0800 '), 'tel:+914214300800')
    assert.equal(telHref(''), 'tel:')
  })

  test('mailto and the website', () => {
    assert.equal(mailtoHref(CONTACT.email), 'mailto:uktex@uktex.net')
    assert.equal(CONTACT.website, 'https://uktextiles.in')
  })

  test('maps link encodes the whole address', () => {
    const href = mapsHref(CONTACT.addressLines)
    assert.ok(href.startsWith('https://www.google.com/maps/search/?api=1&query='))
    assert.equal(decodeURIComponent(href.split('query=')[1]), CONTACT.addressLines.join(', '))
    assert.match(decodeURIComponent(href), /641603/)
  })
})

describe('page-only fonts', () => {
  test('one Google Fonts stylesheet with the three families and swap', () => {
    const url = new URL(COMPANY_FONTS_HREF)
    assert.equal(url.origin, 'https://fonts.googleapis.com')
    const families = url.searchParams.getAll('family')
    assert.equal(families.length, 3)
    assert.match(families[0], /^Bricolage Grotesque:/)
    assert.match(families[0], /700\.\.800/)
    assert.equal(families[1], 'Instrument Serif:ital@1')
    assert.equal(families[2], 'JetBrains Mono:wght@500')
    assert.equal(url.searchParams.get('display'), 'swap')
  })
})

describe('threadParticles', () => {
  test('never more than 30, never negative, junk gives none', () => {
    assert.equal(threadParticles(24).length, 24)
    assert.equal(threadParticles(100).length, MAX_THREADS)
    assert.equal(MAX_THREADS, 30)
    assert.equal(threadParticles(-4).length, 0)
    assert.equal(threadParticles(Number.NaN).length, 0)
  })

  test('the same seed draws the same field; another seed a different one', () => {
    assert.deepEqual(threadParticles(20, 7), threadParticles(20, 7))
    assert.notDeepEqual(threadParticles(20, 7), threadParticles(20, 8))
  })

  test('every value stays in its range', () => {
    for (const p of threadParticles(30)) {
      assert.ok(p.left >= 0 && p.left <= 100, `left ${p.left}`)
      assert.ok(p.duration >= 12 && p.duration <= 24, `duration ${p.duration}`)
      assert.ok(p.delay <= 0 && p.delay >= -p.duration, `delay ${p.delay}`)
      assert.ok(p.length >= 14 && p.length <= 48, `length ${p.length}`)
      assert.ok(p.opacity >= 0.35 && p.opacity <= 0.95, `opacity ${p.opacity}`)
      assert.ok(p.twinkle >= 1.8 && p.twinkle <= 4, `twinkle ${p.twinkle}`)
      assert.ok(p.rest <= -10 && p.rest >= -95, `rest ${p.rest}`)
      assert.ok(['cream', 'butter', 'periwinkle', 'pink'].includes(p.tone))
    }
  })

  test('spread across the width: one per column, left to right', () => {
    const ps = threadParticles(10)
    ps.forEach((p, i) => {
      assert.ok(p.left >= i * 10 && p.left <= (i + 1) * 10, `#${i} at ${p.left}`)
    })
  })
})
