import * as React from 'react'
import { rovingKeyDown } from '@/components/kit/roving'
import { HIDDEN_SHORT, pctText, type PayChart as PayChartData, type TrendBar } from '@/lib/my-insights'
import { cn } from '@/lib/utils'
import { SERIES } from './insights-colors'

/*
 * The charts of the Dashboard's "My Insights" (owner 2026-11-25; the mobile app's components/home/InsightsCharts.tsx),
 * hand-drawn SVG sized to their box. They draw themselves (bars grow, the line traces in) once the section scrolls into
 * view (`revealed`, set by InsightsSection; straight away under reduced motion, where index.css also cuts every CSS
 * transition). Each chart has a legend, a readout of the chosen month (hover, click or arrow keys over the months) and an
 * accessible name, so nothing is told by colour alone.
 *
 * Colours: ./insights-colors.ts.
 */

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'

/** The element's width in CSS pixels, kept up to date (0 until measured). */
function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = React.useRef<T>(null)
  const [width, setWidth] = React.useState(0)
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(Math.round(el.getBoundingClientRect().width))
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (typeof w === 'number') setWidth(Math.round(w))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

/** A bar whose top corners are rounded and whose foot sits square on the baseline. */
function barPath(x: number, bottom: number, w: number, h: number, r: number): string {
  if (h <= 0.5 || w <= 0) return `M${x},${bottom} L${x + w},${bottom} Z`
  const top = bottom - h
  const rr = Math.min(r, w / 2, h)
  return (
    `M${x},${bottom} L${x},${top + rr} Q${x},${top} ${x + rr},${top} ` +
    `L${x + w - rr},${top} Q${x + w},${top} ${x + w},${top + rr} L${x + w},${bottom} Z`
  )
}

/** Grows from the baseline (CSS transform on the SVG element's own box), staggered left to right. */
function growStyle(revealed: boolean, i: number): React.CSSProperties {
  return {
    transformBox: 'fill-box',
    transformOrigin: '50% 100%',
    transform: revealed ? 'scaleY(1)' : 'scaleY(0)',
    transition: `transform 700ms ${EASE} ${i * 60}ms, opacity 200ms ease`,
  }
}

// ── the frame both charts share ─────────────────────────────────────────────

const CHART_H = 168
const TOP_PAD = 20 // room for the chosen bar's value
const BOTTOM_PAD = 2
const PLOT_H = CHART_H - TOP_PAD - BOTTOM_PAD
const BASE_Y = CHART_H - BOTTOM_PAD
/** Room on the left for the trend chart's 50% / 100% labels. */
const AXIS_W = 34

function Legend({ items }: { items: { key: string; label: string; color: string; dot?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-hidden="true">
      {items.map((it) => (
        <li key={it.key} className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground max-md:text-[11.5px]">
          <span
            className={cn('size-2.5 shrink-0', it.dot ? 'rounded-full ring-2 ring-card' : 'rounded-[3px]')}
            style={{ backgroundColor: it.color }}
          />
          {it.label}
        </li>
      ))}
    </ul>
  )
}

/**
 * One button per month over the plot (as wide as the month's column, the full height): hover, click or the arrow keys
 * choose the month the readout describes. One tab stop for the row (roving focus).
 */
function MonthColumns({
  count,
  selected,
  onSelect,
  labelOf,
  groupLabel,
  left = 0,
}: {
  count: number
  selected: number
  onSelect: (i: number) => void
  labelOf: (i: number) => string
  groupLabel: string
  left?: number
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([])
  const indexes = React.useMemo(() => Array.from({ length: count }, (_, i) => i), [count])
  return (
    <div
      role="group"
      aria-label={groupLabel}
      className="absolute inset-y-0 right-0 flex"
      style={{ left }}
      onKeyDown={(e) => rovingKeyDown(e, indexes, selected, () => false, onSelect, refs.current)}
    >
      {indexes.map((i) => (
        <button
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          type="button"
          tabIndex={i === selected ? 0 : -1}
          aria-pressed={i === selected}
          aria-label={labelOf(i)}
          onClick={() => onSelect(i)}
          onMouseEnter={() => onSelect(i)}
          onFocus={() => onSelect(i)}
          className="focus-ring flex-1 cursor-pointer rounded-md transition-colors hover:bg-foreground/[0.03]"
        />
      ))}
    </div>
  )
}

function MonthLabels({ labels, selected, current, left = 0 }: { labels: string[]; selected: number; current?: number; left?: number }) {
  return (
    <div className="mt-1.5 flex" style={{ paddingLeft: left }} aria-hidden="true">
      {labels.map((l, i) => (
        <span
          key={`${l}-${i}`}
          className={cn(
            'flex-1 truncate text-center text-[11.5px] font-semibold text-muted-foreground tabular-nums max-md:text-[11px]',
            i === selected && 'font-extrabold text-foreground',
            i === current && i !== selected && 'text-secondary-foreground',
          )}
        >
          {l}
        </span>
      ))}
    </div>
  )
}

// ── attendance trend: bars (attendance %) + a line (on time %) ───────────────

export function TrendChart({ bars, revealed }: { bars: TrendBar[]; revealed: boolean }) {
  const [boxRef, width] = useWidth<HTMLDivElement>()
  const n = bars.length
  const currentIdx = Math.max(0, bars.findIndex((b) => b.current))
  const [picked, setPicked] = React.useState<number | null>(null)
  const selected = picked != null && picked < n ? picked : currentIdx

  const plotW = Math.max(0, width - AXIS_W)
  const slot = n > 0 ? plotW / n : 0
  const barW = Math.min(30, slot * 0.42)
  const yOf = (pct: number) => BASE_Y - (Math.max(0, Math.min(100, pct)) / 100) * PLOT_H
  const cx = (i: number) => AXIS_W + slot * i + slot / 2

  // The on-time line: one path per run of months that have arrivals (a month with none is a gap, not a zero).
  const runs: string[] = []
  let pts: [number, number][] = []
  const flush = () => {
    if (pts.length >= 2) runs.push(pts.map((p, k) => `${k ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '))
    pts = []
  }
  bars.forEach((b, i) => {
    if (b.onTime == null) flush()
    else pts.push([cx(i), yOf(b.onTime)])
  })
  flush()

  const sel = bars[selected]
  const summary = bars.map((b) => `${b.label}: attendance ${pctText(b.attendance)}, on time ${pctText(b.onTime)}`).join('; ')

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <Legend
          items={[
            { key: 'a', label: 'Attendance', color: SERIES.attendance },
            { key: 'o', label: 'On time', color: SERIES.onTime, dot: true },
          ]}
        />
        {sel && (
          <p className="text-[12.5px] text-muted-foreground tabular-nums max-md:text-[12px]" aria-live="polite">
            <span className="font-semibold text-foreground">{sel.longLabel}</span>
            {' · '}Attendance {pctText(sel.attendance)}
            {' · '}On time {pctText(sel.onTime)}
          </p>
        )}
      </div>
      <div ref={boxRef} className="relative" style={{ height: CHART_H }}>
        {width > 0 && (
          <svg width={width} height={CHART_H} role="img" aria-label={`Attendance and on-time trend, month by month. ${summary}`} className="block overflow-visible">
            {[0, 50, 100].map((g) => (
              <g key={g}>
                <line
                  x1={AXIS_W}
                  x2={width}
                  y1={yOf(g)}
                  y2={yOf(g)}
                  stroke="var(--border)"
                  strokeWidth={1}
                  strokeDasharray={g === 0 ? undefined : '3 4'}
                />
                {g > 0 && (
                  <text x={AXIS_W - 6} y={yOf(g) + 3.5} textAnchor="end" fontSize={10.5} fontWeight={600} fill="var(--muted-foreground)">
                    {g}%
                  </text>
                )}
              </g>
            ))}
            {bars.map((b, i) =>
              b.attendance == null ? null : (
                <path
                  key={b.key}
                  d={barPath(AXIS_W + slot * i + (slot - barW) / 2, BASE_Y, barW, (b.attendance / 100) * PLOT_H, 5)}
                  fill={SERIES.attendance}
                  opacity={i === selected ? 1 : 0.5}
                  style={growStyle(revealed, i)}
                />
              ),
            )}
            {runs.map((d, k) => (
              <path
                key={k}
                d={d}
                pathLength={1}
                fill="none"
                stroke={SERIES.onTime}
                strokeWidth={2.25}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="1 1"
                strokeDashoffset={revealed ? 0 : 1}
                style={{ transition: `stroke-dashoffset 900ms ${EASE} 250ms` }}
              />
            ))}
            {bars.map((b, i) =>
              b.onTime == null ? null : (
                <circle
                  key={`dot-${b.key}`}
                  cx={cx(i)}
                  cy={yOf(b.onTime)}
                  r={i === selected ? 5 : 4}
                  fill={SERIES.onTime}
                  stroke="var(--card)"
                  strokeWidth={2}
                  style={{ opacity: revealed ? 1 : 0, transition: `opacity 300ms ease ${700 + i * 40}ms` }}
                />
              ),
            )}
            {sel?.attendance != null && (
              <text
                x={cx(selected)}
                y={Math.max(12, yOf(sel.attendance) - 7)}
                textAnchor="middle"
                fontSize={11}
                fontWeight={700}
                fill="var(--foreground)"
                style={{ opacity: revealed ? 1 : 0, transition: 'opacity 300ms ease 600ms' }}
              >
                {pctText(sel.attendance)}
              </text>
            )}
          </svg>
        )}
        <MonthColumns
          count={n}
          selected={selected}
          onSelect={setPicked}
          left={AXIS_W}
          groupLabel="Choose a month to read its attendance"
          labelOf={(i) => `${bars[i].longLabel}: attendance ${pctText(bars[i].attendance)}, on time ${pctText(bars[i].onTime)}`}
        />
      </div>
      <MonthLabels labels={bars.map((b) => b.label)} selected={selected} current={currentIdx} left={AXIS_W} />
    </div>
  )
}

// ── pay: earned vs lost to attendance, stacked per month ─────────────────────

export function PayBars({ chart, revealed, hidden }: { chart: PayChartData; revealed: boolean; hidden: boolean }) {
  const [boxRef, width] = useWidth<HTMLDivElement>()
  const bars = chart.bars
  const n = bars.length
  let lastWithSlip = Math.max(0, n - 1)
  for (let i = n - 1; i >= 0; i--) {
    if (bars[i].hasSlip) {
      lastWithSlip = i
      break
    }
  }
  const [picked, setPicked] = React.useState<number | null>(null)
  const selected = picked != null && picked < n ? picked : lastWithSlip

  const slot = n > 0 ? width / n : 0
  const barW = Math.min(30, slot * 0.42)
  const GAP = 2 // surface gap between the earned and lost segments
  const sel = bars[selected]
  const nothing = hidden ? HIDDEN_SHORT : '₹0'
  const readout = (i: number) => {
    const b = bars[i]
    return b.hasSlip ? `${b.longLabel}: earned ${hidden ? 'hidden' : b.earnedText}, lost ${hidden ? 'hidden' : b.lostText || 'nothing'}` : `${b.longLabel}: no salary slip yet`
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <Legend
          items={[
            { key: 'k', label: 'Earned', color: SERIES.kept },
            { key: 'l', label: 'Lost to attendance', color: SERIES.lost },
          ]}
        />
        {sel && (
          <p className="text-[12.5px] text-muted-foreground tabular-nums max-md:text-[12px]" aria-live="polite">
            <span className="font-semibold text-foreground">{sel.longLabel}</span>
            {sel.hasSlip ? (
              <>
                {' · '}Earned {sel.earnedText}
                {' · '}Lost {sel.lostText || nothing}
              </>
            ) : (
              ' · No salary slip yet'
            )}
          </p>
        )}
      </div>
      <div ref={boxRef} className="relative" style={{ height: CHART_H }}>
        {width > 0 && (
          <svg
            width={width}
            height={CHART_H}
            role="img"
            aria-label={`Pay earned and lost to attendance, month by month. ${bars.map((_, i) => readout(i)).join('; ')}`}
            className="block"
          >
            <line x1={0} x2={width} y1={BASE_Y} y2={BASE_Y} stroke="var(--border)" strokeWidth={1} />
            {bars.map((b, i) => {
              const x = slot * i + (slot - barW) / 2
              if (!b.hasSlip) {
                return (
                  <path key={b.key} d={barPath(x, BASE_Y, barW, 12, 3)} fill="none" stroke="var(--input)" strokeDasharray="2 3" strokeWidth={1} />
                )
              }
              const keptH = b.earnedRatio * PLOT_H
              const lostH = b.lostRatio * PLOT_H
              const hasLost = lostH > 0.5
              return (
                <g key={b.key} opacity={i === selected ? 1 : 0.5} style={growStyle(revealed, i)}>
                  {/* Only the topmost segment gets the rounded end; the lower one stays square under the gap. */}
                  <path d={barPath(x, BASE_Y, barW, keptH, hasLost ? 0 : 5)} fill={SERIES.kept} />
                  {hasLost && <path d={barPath(x, BASE_Y - keptH - GAP, barW, Math.max(1, lostH - 0.5), 5)} fill={SERIES.lost} />}
                </g>
              )
            })}
          </svg>
        )}
        <MonthColumns count={n} selected={selected} onSelect={setPicked} groupLabel="Choose a month to read its pay" labelOf={readout} />
      </div>
      <MonthLabels labels={bars.map((b) => b.label)} selected={selected} />
    </div>
  )
}

// ── a thin meter (0-100) ─────────────────────────────────────────────────────

export function Meter({ value, color, revealed }: { value: number | null; color: string; revealed: boolean }) {
  const target = Math.max(0, Math.min(100, value ?? 0))
  return (
    <span className="block h-1.5 overflow-hidden rounded-full bg-foreground/[0.08]" aria-hidden="true">
      <span
        className="block h-full rounded-full"
        style={{ width: `${revealed ? target : 0}%`, backgroundColor: color, transition: `width 900ms ${EASE} 150ms` }}
      />
    </span>
  )
}
