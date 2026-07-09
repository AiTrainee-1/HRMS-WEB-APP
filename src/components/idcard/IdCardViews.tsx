import { QRCodeSVG } from 'qrcode.react'
import type { IdCardData } from '@/types'

const PRIMARY = '#006496'
const SECONDARY = '#4fb8f0'

function verifyUrl(code: string) {
  const origin = import.meta.env.VITE_WEB_ORIGIN || window.location.origin
  return `${origin}/verify/${code}`
}

function KeyValueRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-dashed border-slate-300 py-1 text-[10px]">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800 text-right">{value || '—'}</span>
    </div>
  )
}

export function IdCardFront({ data, scale = 1 }: { data: IdCardData; scale?: number }) {
  const isStaff = data.employmentType !== 'production'
  const w = isStaff ? 240 : 380
  const h = isStaff ? 380 : 240

  return (
    <div
      className="relative overflow-hidden rounded-xl border shadow-md bg-white"
      style={{ width: w * scale, height: h * scale, transform: scale !== 1 ? undefined : undefined }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ background: `linear-gradient(90deg, ${PRIMARY}, ${SECONDARY})` }}
      >
        <div className="flex size-6 items-center justify-center rounded-full bg-white text-[10px] font-bold" style={{ color: PRIMARY }}>
          {data.company?.name?.[0] ?? 'U'}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-bold text-white leading-tight">{data.company?.name ?? 'UKTextiles'}</p>
          <p className="truncate text-[7px] text-white/85 leading-tight">{data.company?.address}</p>
        </div>
      </div>
      <div className="bg-[#eaf6fd] py-1 text-center">
        <span className="text-[8px] font-bold tracking-widest" style={{ color: PRIMARY }}>
          EMPLOYEE IDENTITY CARD
        </span>
      </div>

      {isStaff ? (
        <div className="flex flex-col items-center px-3 py-2">
          <div
            className="size-24 overflow-hidden rounded-lg border-[3px] bg-slate-100"
            style={{ borderColor: SECONDARY }}
          >
            {data.photoUrl ? (
              <img src={data.photoUrl} alt={data.name} className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-2xl font-bold text-slate-400">
                {data.name?.[0]}
              </div>
            )}
          </div>
          <p className="mt-2 text-[13px] font-bold text-slate-900">{data.name}</p>
          <span className="mt-1 rounded-full px-2 py-0.5 text-[9px] font-medium" style={{ background: `${PRIMARY}1a`, color: PRIMARY }}>
            {data.designation}
          </span>
          <div
            className="mt-2 w-full rounded-md py-1.5 text-center"
            style={{ background: `linear-gradient(90deg, ${PRIMARY}, ${SECONDARY})` }}
          >
            <p className="text-[7px] text-white/80 tracking-wide">EMPLOYEE CODE</p>
            <p className="font-mono text-[12px] font-bold text-white">{data.code}</p>
          </div>
          <div className="mt-2 w-full">
            <KeyValueRow label="Department" value={data.department} />
            <KeyValueRow label="Joined" value={data.joinDate} />
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-3 py-3">
          <div className="size-20 shrink-0 overflow-hidden rounded-lg border-[3px] bg-slate-100" style={{ borderColor: SECONDARY }}>
            {data.photoUrl ? (
              <img src={data.photoUrl} alt={data.name} className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-xl font-bold text-slate-400">{data.name?.[0]}</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-slate-900">{data.name}</p>
            <span className="mt-0.5 inline-block rounded-full px-2 py-0.5 text-[9px] font-medium" style={{ background: `${PRIMARY}1a`, color: PRIMARY }}>
              {data.designation}
            </span>
            <div className="mt-1.5">
              <KeyValueRow label="Code" value={data.code} />
              <KeyValueRow label="Department" value={data.department} />
              <KeyValueRow label="Joined" value={data.joinDate} />
            </div>
          </div>
        </div>
      )}

      <div
        className="absolute bottom-0 h-1.5 w-full"
        style={{ background: `linear-gradient(90deg, ${PRIMARY}, ${SECONDARY}, ${PRIMARY})` }}
      />
    </div>
  )
}

export function IdCardBack({ data, scale = 1 }: { data: IdCardData; scale?: number }) {
  const isStaff = data.employmentType !== 'production'
  const w = isStaff ? 240 : 380
  const h = isStaff ? 380 : 240

  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-xl border shadow-md bg-white p-3"
      style={{ width: w * scale, height: h * scale }}
    >
      <div className={isStaff ? 'flex flex-col gap-2' : 'flex gap-4'}>
        <div className="flex-1">
          <KeyValueRow label="Blood Group" value={data.bloodGroup} />
          <KeyValueRow label="DOB" value={data.dateOfBirth} />
          <KeyValueRow label="Emergency Contact" value={data.emergencyContact} />
          <KeyValueRow label="Address" value={data.address} />
        </div>
        {data.template?.showQrOnBack !== false && (
          <div className="flex flex-col items-center justify-start mt-2">
            <div className="rounded-md border p-1.5 bg-white">
              <QRCodeSVG value={verifyUrl(data.code)} size={isStaff ? 72 : 80} fgColor="#0f172a" bgColor="#ffffff" />
            </div>
            <p className="mt-1 text-center text-[7px] font-semibold tracking-wide text-slate-500">SCAN TO VERIFY EMPLOYEE</p>
          </div>
        )}
      </div>
      <p className="mt-2 text-[7px] leading-snug text-slate-400">
        This card is the property of {data.company?.name}. If found, please return to the nearest branch office. Unauthorized use is
        prohibited.
      </p>
      <div className="mt-auto flex items-center justify-between pt-2">
        {data.company?.signature ? (
          <img src={data.company.signature} alt="Authorized signature" className="h-6 object-contain" />
        ) : (
          <div className="h-6" />
        )}
        <span className="text-[7px] text-slate-400">Authorised Signatory</span>
      </div>
    </div>
  )
}
