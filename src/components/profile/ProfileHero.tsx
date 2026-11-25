import { Link } from 'wouter'
import { motion } from 'framer-motion'
import { ArrowRight, BadgeCheck, Briefcase, Building2, Factory, Hash, IdCard } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { popIn } from '@/components/kit'
import { cn } from '@/lib/utils'

/**
 * The top of My Profile (owner 2026-11-25 redesign, after the mobile app's src/components/profile/ProfileHero.tsx): the
 * photo (initials when there is none or it fails), the name with a verified mark once the employee has a portal password,
 * designation and department, department and branch, then pills for the employment status, the employee code and the
 * employment type; and the Digital ID with its verification QR. Drawn on the deep royal gradient in both themes, so its
 * text is white. Desktop: photo | identity | ID card in one row. Phones: centred, the ID card a full-width row under it.
 */
export function ProfileHero({
  name,
  photoUrl,
  initials,
  verified,
  roleLine,
  placeLine,
  status,
  code,
  typeLabel,
  qrValue,
}: {
  name: string
  photoUrl: string | null
  initials: string
  verified: boolean
  roleLine: string
  placeLine: string
  /** null = no status on the record (no pill). */
  status: { label: string; active: boolean } | null
  code: string
  typeLabel: string | null
  qrValue: string
}) {
  const production = typeLabel === 'Production'
  return (
    <section
      aria-labelledby="profile-name"
      className={cn(
        'relative overflow-hidden rounded-3xl p-6 text-white shadow-clay-lg ring-1 ring-white/10 sm:p-8',
        'bg-[linear-gradient(135deg,#0F172A,#1E3A8A,#2563EB)] dark:bg-[linear-gradient(135deg,#0B1220,#14213D,#1E3A8A)]',
        'max-md:p-5 max-md:shadow-[var(--m-shadow-mid)]!',
      )}
    >
      {/* soft light circles, like the app's hero */}
      <span aria-hidden="true" className="pointer-events-none absolute -top-16 -right-12 size-56 rounded-full bg-white/[0.08]" />
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-14 -left-10 size-40 rounded-full bg-white/[0.06]" />
      <span aria-hidden="true" className="pointer-events-none absolute top-8 left-8 size-2.5 rounded-full bg-white/20 max-md:hidden" />

      <div className="relative grid items-center gap-6 md:grid-cols-[auto_minmax(0,1fr)] lg:grid-cols-[auto_minmax(0,1fr)_auto] max-md:justify-items-center max-md:gap-4">
        {/* Photo */}
        <motion.div variants={popIn} initial="hidden" animate="show" className="shrink-0">
          <span className="grid place-items-center rounded-full bg-white/[0.08] p-1 ring-2 ring-white/45">
            <Avatar className="size-28 max-md:size-[92px]">
              {photoUrl && <AvatarImage src={photoUrl} alt="" className="object-cover" />}
              <AvatarFallback className="font-display bg-white/[0.18] text-[34px] font-bold tracking-wide text-white max-md:text-[30px]">
                {initials || 'EM'}
              </AvatarFallback>
            </Avatar>
          </span>
        </motion.div>

        {/* Identity */}
        <div className="min-w-0 max-md:w-full max-md:text-center">
          <div className="flex min-w-0 items-center gap-2 max-md:justify-center">
            <h2 id="profile-name" className="font-display min-w-0 text-[28px] leading-tight font-bold tracking-tight break-words max-md:text-[22px]">
              {name}
            </h2>
            {verified && (
              <BadgeCheck className="size-6 shrink-0 text-[#93C5FD] max-md:size-[18px]" aria-label="Verified portal account" role="img" />
            )}
          </div>
          {roleLine && <p className="mt-1 truncate text-[14.5px] text-white/85 max-md:text-[13px]">{roleLine}</p>}
          {placeLine && (
            <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[13px] text-white/70 max-md:justify-center max-md:text-[12px]">
              <Building2 className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{placeLine}</span>
            </p>
          )}
          <ul className="mt-4 flex flex-wrap gap-2 max-md:mt-3.5 max-md:justify-center" aria-label="About your record">
            {status && (
              <li
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold tracking-wide max-md:text-[11.5px]',
                  status.active ? 'bg-[rgb(52_211_153/0.2)]' : 'bg-[rgb(251_191_36/0.22)]',
                )}
              >
                <span aria-hidden="true" className={cn('size-[7px] rounded-full', status.active ? 'bg-[#34D399]' : 'bg-[#FBBF24]')} />
                {status.label}
              </li>
            )}
            {code && (
              <li className="font-label inline-flex items-center gap-1 rounded-full bg-white/[0.14] px-3 py-1 text-[12px] font-bold tracking-wide tabular-nums max-md:text-[11.5px]">
                <Hash className="size-3 text-white/85" aria-hidden="true" />
                <span className="sr-only">Employee code </span>
                {code}
              </li>
            )}
            {typeLabel && (
              <li className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.14] px-3 py-1 text-[12px] font-bold tracking-wide max-md:text-[11.5px]">
                {production ? <Factory className="size-3.5" aria-hidden="true" /> : <Briefcase className="size-3.5" aria-hidden="true" />}
                {typeLabel}
              </li>
            )}
          </ul>
        </div>

        {/* Digital ID: a card on the right on wide screens, a full-width row under the identity on smaller ones */}
        <Link
          href="/employee/id-card"
          className={cn(
            'group focus-ring flex items-center gap-3.5 rounded-2xl bg-white/10 p-3 ring-1 ring-white/15 transition-colors hover:bg-white/[0.15]',
            'md:col-span-2 lg:col-span-1 lg:flex-col lg:items-start lg:gap-3 lg:p-4',
            'max-md:w-full max-md:active:bg-white/[0.15]',
          )}
        >
          <span className="shrink-0 rounded-lg bg-white p-1.5 shadow-clay-sm max-md:p-1">
            <QRCodeSVG value={qrValue} size={72} fgColor="#0f172a" bgColor="#ffffff" className="max-md:size-[34px]" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="flex items-center gap-1.5 text-[14px] font-semibold">
              <IdCard className="size-4 shrink-0 text-white/80" aria-hidden="true" /> Digital ID Pass
            </span>
            <span className="mt-0.5 block truncate text-[12px] text-white/70">Your ID card and its verification QR</span>
            <span className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#6EE7B7] group-hover:underline max-md:hidden">
              Open ID card <ArrowRight className="size-3.5" aria-hidden="true" />
            </span>
          </span>
          <ArrowRight className="hidden size-[18px] shrink-0 text-white/85 max-md:block" aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}
