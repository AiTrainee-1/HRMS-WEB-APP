# UKTextiles Employee Web App — UI kit ("Sovereign Loom" + LOOM)

This file is the contract for every page. Read it fully before you touch a page. Everything here is importable from
one place:

```tsx
import { PageShell, PageHero, GlassCard, KpiTile, StatusViews, useRequestViews, DecisionBadge, ... } from '@/components/kit'
```

Users are factory and office employees of UKTextiles (garments / textiles, Tamil Nadu) on office PCs and phone
browsers; many are not tech-savvy. **Plain English, short sentences, one obvious action per screen.**

---

## 1. The design language in one minute

- **Identity: "Sovereign Loom".** Dark-first midnight-navy canvas with glass surfaces; a light "ivory" companion theme.
  **Both themes are first-class** — every page must look right in both (the theme switch is in the top bar).
- **Signature: woven thread.** UKTextiles makes yarn, fabric and garments, so the one memorable visual idea is a loom:
  - a quiet animated **warp-and-weft thread field** behind the top of every page (the shell draws it — you never add it);
  - **stitched** (dashed "sewn seam") borders on the ONE highlighted card of a view;
  - a **thread-line progress** bar;
  - a **silk gradient** (sapphire → violet → amber) used *sparingly*: the hero underline, the primary-button sheen, the
    active nav thread, the active tab/segment foot, one signature ring per page at most. **Never behind body text.**
- **Colour = meaning** (section 3). **Motion = calm and quick** (section 4). **Readability always wins** over effect.

## 2. The shell (already done — what pages get for free)

`EmployeeLayout` wraps every signed-in page:
- **Sidebar** (desktop, collapsible to an icon rail; a drawer on phones) with groups *My day / Requests / Team / Pay /
  Me & company* and an active indicator that glides between items. Groups/labels live in `layout/nav-config.ts`.
- **Top bar**: "Good morning, Priya" + date + breadcrumb (group › page) — on phones just the page name; punch pill,
  notification bell, theme toggle, account menu.
- **Thread progress** under the top bar while any query's *first* load is pending (not on background polling).
- **The weave canvas** behind the top 440px of `<main>`; **route change** = a short cross-fade; scroll resets to top.
- Content area: `px-4 py-6 lg:px-8 lg:py-8`, max width 1400px. Skip-to-content link. `MotionConfig reducedMotion="user"`.

So a page renders **only its content**, starting with `<PageShell>` and `<PageHero>`.

**Phone view (under 768px):** its own shell and skin, modelled on the Employee mobile app. Read `MOBILE.md` in this
folder before you touch how a page looks on a phone; the desktop view must stay as it is.

## 3. Colour roles and tokens

Pick a **role**, never a raw colour. Do **not** use Tailwind palette colours (`text-green-600`, `bg-amber-100`,
`text-red-500` …) for status — they fail contrast in one of the themes.

| Role (kit `Tone`) | Status tone (`StatusTone`) | Means | Utilities (AA in both themes) |
|---|---|---|---|
| `sapphire` | `info` | action, information, "This month" | `text-info` `bg-info-bg` `border-info-border` |
| `amber` | `waiting` | waiting for a decision, alert, needs attention | `text-waiting` `bg-waiting-bg` `border-waiting-border` |
| `emerald` | `approved` / `live` | approved, confirmed, present, money in, live | `text-approved` `bg-approved-bg` `border-approved-border` |
| `rose` | `rejected` | rejected, error, absent, deduction, money out | `text-rejected` `bg-rejected-bg` `border-rejected-border` |
| `violet` | — | special / compensation / casual leave | `text-violet` `bg-violet-bg` `border-violet-border` |
| `slate` | `neutral` | inactive, not applicable, cancelled-ish | `text-neutral` `bg-neutral-bg` `border-neutral-border` |

- Pair `bg-*-bg` with `text-*` of the same role (that pair is ≥ 4.5:1 in both themes). `text-*` alone is AA on cards.
- Class maps for code: `TONE_SOFT[tone]` (bg + text + border), `TONE_TEXT[tone]`, `TONE_COLOR[tone]` (CSS colour for SVG),
  `TONE_GLOW[tone]`, `STATUS_TO_TONE`, `toneForStatus(rawStatus)`.
- Theme tokens still available: `text-foreground`, `text-muted-foreground` (secondary text, AA), `bg-card`, `border-border`,
  `hairline` (glass border colour), `text-brand-blue` (links/accents), `text-brand-emerald` (eyebrows), `bg-brand-gradient`
  (sapphire fill, white text OK), `bg-silk` / `text-silk` (silk; `text-silk` only for display text ≥ 24px).
- The legacy `.chip .chip-success|warning|danger|info|muted|teal|sky|indigo|pink|fuchsia|violet|excess` classes were retuned
  to the same AA pairs — fine to keep, but new code uses `StatusPill`.
- Shadows/glows: `shadow-clay-sm|shadow-clay|shadow-clay-lg`, `var(--glow-primary|success|warning|danger)`.
- Surfaces: `glass` (level 1), `glass-raised` (level 2). Prefer `GlassCard` over hand-rolled surfaces.
- Type: `font-display` (Playfair — titles and big figures only), `font-label` (Plus Jakarta — buttons/labels),
  `label-caps` (11px uppercase micro-labels), `metric` (big tabular figures). Body is Inter.

## 4. Motion rules

- **Page enter**: `PageShell` fades + rises (8px) each direct child, 260ms, 50ms apart, capped at 8. Lists inside: use
  `listItem(i)` / `fadeRise` with `custom={i}` (same capped stagger). Never stagger more than ~10 items visibly.
- **Shared-layout indicators** (`layoutId`): sidebar, `Tabs`, `SegmentedControl`, `StatusViews` already do it. Spring:
  `SPRING`.
- **Hover**: cards that are links/buttons use `GlassCard variant="interactive"` (spring lift + pointer-follow glow, pointer
  devices only via `@media (hover: hover)`). Don't add hover effects to non-interactive things.
- **Numbers**: KPI figures count up (`KpiTile`, `AnimatedNumber`, `MoneyText animate`). **Never** animate numbers in tables,
  forms or lists.
- **Success**: `SuccessCheck` (ring + tick draws) after a request is sent / saved.
- **Loading**: `SkeletonList` / `SkeletonBlock` (theme-coloured shimmer) shaped like the content; the app loader
  (`PageLoader`) only for whole-route suspense.
- **Durations**: `DURATION.fast 0.14s` (exits, small), `base 0.24s`, `enter 0.26s`, `slow 0.42s`; CSS twins
  `--dur-fast|--dur-base|--dur-slow`, easing `EASE_OUT` / `--ease-out`, `--ease-spring`.
- **Reduced motion is mandatory**: framer is gated globally (MotionConfig); CSS animations are cut by index.css; for anything
  else (timers, canvas, scroll effects) use `useReducedMotion()` from the kit — reduced = no movement, instant states.
- No infinite animations except: live/waiting dots, the current stepper step, the weave, the silk underline flow.

## 5. Accessibility rules (non-negotiable)

- One `<h1>` per page (PageHero). Sections `h2` (`SectionHeader`), card titles `h3` (`SectionHeader as="h3"`).
- Every interactive element is a real `<button>` / `<a>` (wouter `Link`) with a visible focus ring (`focus-ring` utility or
  the ui primitives) and a ≥ 44px touch target on phones (`min-h-11` / `tap-target`). No click handlers on divs.
- Icon-only buttons get `aria-label`. Decorative icons get `aria-hidden="true"`.
- Status is never colour alone: pills/bands always have words (and an icon or dot).
- Charts: every kit chart has an accessible name; also write the key numbers as text next to it.
- Errors: `ErrorState` (role="alert") with **Try again**. Every query-driven section has loading, error and empty states.
- Dialog forms: label every field (`<Label htmlFor>`), say what is wrong in words next to the field.

## 6. Layout rules

- `PageShell width`: `default` (1240px) for most pages, `narrow` (768px) for single-form pages (Resignation, Help),
  `wide` (1400px) for Dashboard / Attendance / tables.
- Vertical rhythm comes from PageShell (`gap-6 lg:gap-8`). Inside cards: `gap-3`/`gap-4`. Card padding: GlassCard `md`.
- Grids: KPIs `grid-cols-2 lg:grid-cols-4`; cards `grid gap-4 md:grid-cols-2 xl:grid-cols-3`. Test at 360px width:
  nothing may overflow horizontally; long names `truncate` or `break-words`.
- Put **dialogs / sheets outside `PageShell`'s direct children** (or inside a section) — PageShell wraps each direct child
  in an animated block with a gap; a bare `<Dialog>` there would add an empty gap.

---

## 7. Components

### PageShell
Frame of every page; staggers its direct children in. Props: `width?: 'default'|'narrow'|'wide'`, `className?`.

### PageHero
The page masthead — open on the woven field (no box), the page's only `<h1>`.
Props: `title`, `subtitle?` (one plain sentence), `eyebrow?` (defaults to the nav group; `""` hides it),
`icon?` (element: `<Send />`), `actions?` (buttons, right side; wraps under on phones), `kpis?` (KpiTile elements → a
responsive grid), `children?` (a notice or a SegmentedControl under the title), `className?`.
The older `layout/PageHeader` now renders PageHero (same look) — migrate to PageHero.

### SectionHeader
`title`, `description?`, `icon?: LucideIcon`, `tone?`, `count?`, `action?`, `as?: 'h2'|'h3'`, `id?`.
Use above every section of a page and as a card's title row (`as="h3"`).

### GlassCard
The surface. `variant`: `plain` (default) · `raised` (sapphire hairline + deep shadow — the page's key panel) ·
`interactive` (whole card clickable: lift + glow; use with `asChild` around a `Link`/`button`) · `stitched` (dashed seam —
the ONE highlighted card in a view, `tone` sets the seam colour incl. `'silk'`). `padding`: `none|sm|md|lg` (default md).
`hover` adds the lift to a non-interactive variant. All div props pass through.
```tsx
<GlassCard variant="interactive" asChild><Link href={`/employee/salary/${s.id}`}>…</Link></GlassCard>
```
`ui/card` (`Card`, `CardHeader`…) still works and matches; prefer GlassCard in new code.

### KpiTile
Headline figure. `label`, `value: number|string|null` (numbers count up), `format?` (e.g. `(n) => formatINR(Math.round(n))`),
`icon?`, `tone?`, `hint?`, `unit?` ("days"), `trend?: number[]` (sparkline), `href?` / `onClick?` (makes it interactive).
Use 2–4 per row; at most one row per page (in PageHero `kpis` or a dashboard section).

### AnimatedNumber
`value`, `format?`, `duration?` (s). Counts from 0 on mount and from the old value on change; screen readers get the
final value only. KPIs only.

### MoneyText
`value` (number or numeric string; null → "—"), `decimals?: 'auto'|0|2` (auto: no paise for whole rupees), `sign?` ("+"),
`compact?` (₹3.4 L), `tone?: 'none'|'auto'` (green in / rose out), `animate?`. Indian grouping `₹12,34,567`. **Every rupee
amount on every page goes through MoneyText or `formatINR`.**

### StatusPill
`tone?: StatusTone` **or** `status?: rawStatus` (mapped by `toneForStatus`), `children` (the words), `icon?: LucideIcon|false`,
`dot?` (pulsing dot; default for waiting/live), `size?: 'sm'|'md'`.
```tsx
<StatusPill tone="waiting">Waiting for HR</StatusPill>   <StatusPill status={o.status}>{o.statusLabel}</StatusPill>
```

### StatusViews + useRequestViews  (every request page)
The four-view switcher **Waiting / This month / Approved / Rejected** with counts. `StatusViews` props: `value`, `onChange`,
`counts`, `labels?` (override any label), `views?` (subset/order), `monthKind?: 'taken'|'submitted'` (shows the hint
"Approved and taken this month" / "Sent this month" under it), `panelId?`, `ariaLabel?`.
`useRequestViews(rows | undefined, opts)` → `{ view, setView, counts, rows }`. `opts` (`ViewOptions`):
`statusOf(row)`, `month: { dateOf(row), kind }`, optional `groupOf(row)` override, `today` (tests).
**Which "This month"**: leave / permission / outpass / casual leave = `kind: 'taken'`, `dateOf` = the day it is FOR
(approved rows only). Missing punch / on-duty / resignation = `kind: 'submitted'`, `dateOf` = `createdAt` (any status).
Opens on Waiting when something waits, else This month (chosen once when data arrives). Status spellings handled:
waiting = pending, pending_hod, pending_hr, waiting, in_review, hod_approved, dept_approved, forwarded, submitted,
requested, review · approved = approved, hr_approved, out, returned, completed, closed, active, done, accepted ·
rejected = rejected, declined, denied, cancelled/canceled, expired, withdrawn. Anything else is in no status view
(use `groupOf` for a page's own statuses, e.g. a permission's "excess").
Empty view text: `emptyViewText(view, 'leave requests', kind)`.

**Month switcher (owner 2026-11-02; mirrors the mobile app's monthSwitch.ts / requestViews.ts).** Leave, Permission,
Casual Leave, Missing Punch, Outpass & Tea Break and On-Duty records show one month at a time. Add
`scope: { year, month, daysOf }` to the `ViewOptions` (`daysOf(row)` = the day the row is FOR, or a `[first, last]` range:
a 30 Sep - 2 Oct leave is in both months). Then every view and count is about that month only, the second view holds
EVERY row of the month (any status) and reads "This month" / "All in Sep" (`monthViewLabel`), and `useRequestViews`
also returns `scope` and `elsewhere` (rows still waiting in other months, `waitingInOtherMonths`). Month state:
`useSelectedMonth(initial?)` (`hooks/`; follows the clock until a month is picked). Controls: the Attendance page's own
`MonthYearPicker` (desktop) and `PhoneMonthBar` (phones), both with optional `min` / `max` (default: back without limit,
forward to the current month; Leave / Permission / Casual Leave pass `max` = the later of now and their latest record's
month). `RequestList` draws both when given `monthSwitch={{ onChange, min?, max? }}` - desktop beside the list heading,
the phone bar right above the four count cards - plus the "1 request waiting in October 2026 · Show" note
(`requests/MonthBits` `WaitingElsewhereNote`) and month-named empty states (`monthEmptyText`). **The KPI tiles in
PageHero follow the month on screen too** (owner 2026-11-02, desktop; phones show no KPI tiles on these pages): use the
same `views.counts` as the four views ("Taken" = that month's `approved`), name the month in the tile
(`inMonthText(month)` = "this month" / "in September 2026", `monthTileLabel('Taken', month)` = "Taken this month" /
"Taken in Sep 2026", or `monthViewLabel` for the every-row count), and open the view with `showView(views, view, listId)`
- a tile never moves the month. A figure that is not about the month (Casual Leave's yearly total, the permission
allowance of the current month) stays as it is and its hint says so ("the whole year", "always the current month").
Pure helpers: `lib/month-switch.ts` (`CalMonth`, `monthKey`, `monthOf`, `daysTouchMonth`, `monthToShow`,
`latestMonthOf`, `monthLabel`, `inMonthText`, `monthTileLabel` ...), tested in `month-switch.test.ts` /
`request-views.test.ts`.

### DecisionBadge / ApprovalState  (who decided — owner requirement)
Every decided request must show WHO decided it, prominently.
- `DecisionBadge`: `decider?: Decider` or `text?` + `tone?: 'approved'|'rejected'|'waiting'`, `note?`. Green/rose/blue band:
  "Approved by HR (Meena) · 31 Oct, 10:05 AM", "Rejected by Department Head (Kavya)", "Approved by you · waiting for HR".
- `ApprovalState`: one element for a request card — amber "Waiting for HR" pill while waiting, the DecisionBadge once
  decided. Props: `approval`, `fallback?: Decider` (old rows), `status?` + `pendingLabel?` (old waiting rows without a block).
- Building deciders (lib/decider, re-exported by the kit): `deciderFromApproval(approval)`;
  old rows: `deciderFromFields({ status, name, role, at })` (e.g. `approvedBy`/`reviewedBy`),
  `deciderFromStamps({ status, hodBy, hodAt, hrBy, hrAt })` (missing punch / on-duty),
  `deciderForAdvance({ status, approvedBy, approvedAt, timeline })` (advances);
  a head's Approvals page: `decisionLineFor(approval, 'hod')` → `{ text, tone }` → `<DecisionBadge text={l.text} tone={l.tone} />`.
```tsx
<ApprovalState approval={r.approval} fallback={deciderFromFields({ status: r.status, name: r.approvedBy, role: 'hr', at: r.approvedAt })} />
```

### Stepper
The approval path: You → Department Head → HR. `approval` + `sentAt` (builds steps via `approvalPath`) or `steps`;
`orientation: 'horizontal'` (cards; labels under dots) | `'vertical'` (detail dialogs; shows who/when and comments).
Done = green tick, current = amber breathing ring, rejected = rose cross, skipped = dashed. Renders nothing without
an `approval` block. (The older `employee/ApprovalTrail` text list still works; prefer Stepper.)

### SegmentedControl
Pick one of 2–5 options with a springing sapphire pill. `options: { value, label, icon?, count?, disabled?, ariaLabel? }[]`,
`value`, `onChange`, `ariaLabel` (required), `size?: 'sm'|'md'`, `fullWidth?`. Arrow keys move. Use for page-level mode
switches (Office / On-Duty, List / Calendar). Content tabs inside a card can keep `ui/tabs` (also restyled).

### EmptyState / ErrorState / SkeletonList / SkeletonBlock
- `EmptyState`: `icon?`, `title`, `description?`, `action?`, `tone?`, `compact?`. Say what the person can do.
- `ErrorState`: `error?` + `what?` ("your leave requests") → the standard sentence, or `message?`; `onRetry`, `retrying`,
  `title?`, `compact?`. role="alert".
- `SkeletonList`: `variant: 'rows'|'cards'|'tiles'`, `count?`, `label?`. `SkeletonBlock className="h-4 w-32"`.
The standard query pattern:
```tsx
if (q.isPending) return <SkeletonList variant="cards" count={3} />
if (q.isError) return <ErrorState error={q.error} what="your leave requests" onRetry={() => q.refetch()} retrying={q.isFetching} />
if (!q.data.length) return <EmptyState icon={Send} title="No leave requests yet" description="When you apply for leave, it shows here." />
```

### SuccessCheck
`size?`, `tone?: 'emerald'|'sapphire'`, `label?`. Ring + tick draw (~0.6s). Use in a dialog's "sent" state.

### ThreadProgress
`value?` (0–100; omit = running), `label`. Uploads, multi-step forms, "3 of 5 documents".

### Visualisation (pure SVG, no chart library — always also write the numbers as text)
- **Sparkline** `data` (oldest first), `color?` (`TONE_COLOR.emerald` …), `label` (required), `area?`, `className` sizes it
  (`h-10 w-full`). Trends only — no axes.
- **BarCompare** `items: { key, label, total, value, hint? }[]`, `totalLabel` / `valueLabel` ("Allocated"/"Earned",
  "Entitled"/"Used"), `format?`, `tone?`. Over the total turns amber at the tip.
- **BarList** `items: { key, label, value, tone?, hint? }[]`, `max?`, `format?`. Ranked bars (days by type, deductions by kind).
- **RingMeter** `value`, `max`, `label` (required), `size?`, `thickness?`, `tone?`, `silk?` (one per page), `children` = centre.
- **MonthDial** `fill: 'none'|'first'|'second'|'full'` (`'left'|'right'` aliases), `label` ("Oct"), `title?` ("October 2026"),
  `tone?` (default violet), `current?`, `locked?`, `size?`. Casual leave: a row of dials = the year at a glance.
- **Waterfall** `steps: { key, label, amount, kind: 'start'|'add'|'subtract'|'total', hint? }[]`, `format?`. Gross → net pay.
- **Timeline** `items: { key, title, time?, description?, icon?, tone?, current? }[]`, `ariaLabel?`. Punches, advance history.

### WeaveBackground
`spacing?`, `fade?: 'bottom'|'radial'|'none'`, `interactive?`, `className`. **The shell already renders one. Pages must not
add another.** Only standalone screens outside the shell (auth, not-found) may use it.

### Hooks and helpers
`useReducedMotion()`, `isLowPowerDevice()`; motion presets `fadeRise`, `fadeIn`, `popIn`, `collapse`, `listItem(i)`,
`staggerDelay(i)`, `SPRING`, `SPRING_SOFT`, `EASE_OUT`, `DURATION`; money `formatINR(v, { decimals, sign, symbol })`,
`formatINRCompact`, `formatCount`, `toAmount`; time `relativeTime(iso)` ("3 days ago", "yesterday", "on 12 Oct"),
`waitingSince(createdAt)` ("waiting 3 days"), `waitingDays(createdAt)` (number — turn amber at ≥ 3), `greetingFor()`.
All pure helpers live in `src/lib/{money,relative-time,request-views,decider}.ts` with `node --test` tests.

### Links to one item (`?focus=` / `?date=` / `?highlight=`)
A notification's View button opens the exact item (`lib/notification-target.ts` maps the server's `target` to a route).
A page that lists items supports it with `useFocusItem({ scope, rows, idOf, views?, viewOptions?, reveal?, dateOf?,
hasMore?/loadMore? })` (`hooks/useFocusItem.ts`): it opens the view / tab holding the item, scrolls to the element with
`data-focus-key={focusKey(scope, id)}` and rings its card (`lib/focus-item.ts`; a still ring under reduced motion), and
returns `missing` for `<FocusMissNote>` ("That request is no longer in this list"). `RequestList` already tags its items
(scope = its `id`) and takes the note as `notice`. Pass the SAME `viewOptions` object to `useRequestViews` and the hook.
A month-scoped page also passes `setMonth`: the hook opens the row's own month FIRST (`monthForRow`), then the view
(`viewForRow` reads the views as they are in that month), the scroll and the ring; a `date=` link with nothing on that
day still opens that day's month. Give the hook EVERY row (not only the month's) so it can find rows of other months.

### CSS utilities (index.css)
`stitched` (+ `--stitch` colour) · `weave-static` (static woven texture for small surfaces) · `silk-line` (flowing silk
underline) · `bg-silk` / `text-silk` · `lift` (spring hover lift) · `glow-follow` (needs `--mx/--my`; GlassCard sets them) ·
`thread-progress` · `skeleton-shimmer` · `pulse-ring` (breathing ring in currentColor) · `focus-ring` · `tap-target` ·
`btn-sheen` (on default Button already) · `ui-fade|ui-pop|ui-slide-*` (Radix enter/exit) · `scrollbar-thin|scrollbar-none`.

### Restyled primitives (`@/components/ui/*`, same props as before)
`Button` (default/gradient: sapphire + silk sheen; destructive/success use the status pairs; ring focus on all) ·
`Input`/`Textarea`/`SelectTrigger` (inset field, stronger focus, `aria-invalid` turns rose) · `Tabs` (springing sapphire
pill with silk foot; still Radix — `value`/`defaultValue`/`onValueChange`) · `Dialog` (pop-in, silk thread on top, 40px
close button) · `Sheet` (slides from its side) · `Select`/`DropdownMenu`/`Popover`/`Tooltip` (pop-in, 44px items on
touch) · `Badge` (chips, retuned) · `Switch`/`Checkbox` (focus rings) · `Progress` (sapphire gradient) · `Toaster` follows
the theme. `Skeleton` still shows the app loader (unchanged); use the kit's SkeletonList for list placeholders.

---

## 8. Recipes

### A typical request page (Leave)
```tsx
import { Send, CalendarCheck, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  PageShell, PageHero, KpiTile, StatusViews, useRequestViews, GlassCard, ApprovalState, Stepper, StatusPill,
  SkeletonList, ErrorState, EmptyState, emptyViewText, waitingSince, listItem,
} from '@/components/kit'
import { motion, AnimatePresence } from 'framer-motion'

export default function Leave() {
  const q = useQuery({ queryKey: ['leave', user.employeeId], queryFn: () => leaveApi.list(user.employeeId) })
  const v = useRequestViews(q.data, {
    statusOf: (l) => l.status,
    month: { dateOf: (l) => l.startDate, kind: 'taken' },
  })
  return (
    <>
      <PageShell>
        <PageHero
          icon={<Send />}
          title="Leave"
          subtitle="Apply for leave and see who decided it."
          actions={<Button onClick={() => setApplyOpen(true)}>Apply for leave</Button>}
          kpis={<>
            <KpiTile label="Waiting" value={v.counts.waiting} icon={Clock} tone="amber" hint="for a decision" />
            <KpiTile label="Taken this month" value={v.counts.month} icon={CalendarCheck} tone="emerald" />
          </>}
        />
        <StatusViews value={v.view} onChange={v.setView} counts={v.counts} monthKind="taken" panelId="leave-list" />
        <section id="leave-list" role="tabpanel" aria-label="Leave requests">
          {q.isPending ? <SkeletonList variant="cards" count={3} />
            : q.isError ? <ErrorState error={q.error} what="your leave requests" onRetry={() => q.refetch()} retrying={q.isFetching} />
            : v.rows.length === 0 ? <EmptyState icon={Send} title="Nothing here" description={emptyViewText(v.view, 'leave requests')} />
            : (
              <ul className="grid gap-4 md:grid-cols-2">
                <AnimatePresence mode="popLayout">
                  {v.rows.map((l, i) => (
                    <motion.li key={l.id} {...listItem(i)} layout>
                      <GlassCard className="flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-semibold">{l.type} · {l.totalDays} {l.totalDays === 1 ? 'day' : 'days'}</h3>
                          {v.view === 'waiting' && <StatusPill tone="waiting" size="sm">{waitingSince(l.createdAt)}</StatusPill>}
                        </div>
                        <Stepper approval={l.approval} sentAt={l.createdAt} />
                        {/* Old rows without an approval block: pass `fallback={deciderFromFields(...)}` ONLY when the row
                            really names who decided (approvedBy / reviewedBy) — never guess a role. */}
                        <ApprovalState approval={l.approval} status={l.status} pendingLabel="Pending" />
                      </GlassCard>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
        </section>
      </PageShell>
      <ApplyLeaveDialog open={applyOpen} onOpenChange={setApplyOpen} />  {/* outside PageShell */}
    </>
  )
}
```

### A typical dashboard section
```tsx
<section aria-labelledby="pay-title" className="flex flex-col gap-4">
  <SectionHeader id="pay-title" icon={Wallet} tone="emerald" title="This month's pay"
    action={<Button variant="ghost" size="sm" asChild><Link href="/employee/salary">All slips</Link></Button>} />
  <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
    <GlassCard variant="stitched" tone="silk" className="flex flex-col gap-4">
      <p className="label-caps text-muted-foreground">Net pay · October</p>
      <MoneyText value={slip.netPay} animate className="metric text-4xl" />
      <Waterfall steps={[
        { key: 'g', label: 'Gross salary', amount: slip.gross, kind: 'start' },
        { key: 'ot', label: 'Overtime', amount: slip.overtime, kind: 'add' },
        { key: 'd', label: 'Deductions', amount: slip.deductions, kind: 'subtract' },
        { key: 'n', label: 'Net pay', amount: slip.netPay, kind: 'total' },
      ]} />
    </GlassCard>
    <GlassCard className="flex items-center gap-5">
      <RingMeter value={daysPresent} max={workingDays} tone="emerald" label="Days present this month">
        <span className="metric text-2xl">{daysPresent}</span><span className="text-xs text-muted-foreground">of {workingDays}</span>
      </RingMeter>
      <BarList items={[
        { key: 'p', label: 'Present', value: daysPresent, tone: 'emerald' },
        { key: 'l', label: 'Leave', value: leaveDays, tone: 'amber' },
        { key: 'a', label: 'Absent', value: absentDays, tone: 'rose' },
      ]} className="flex-1" />
    </GlassCard>
  </div>
</section>
```

### A detail dialog / success state
```tsx
<DialogContent>
  <DialogHeader><DialogTitle>Leave on 4–5 Nov</DialogTitle></DialogHeader>
  <ApprovalState approval={r.approval} status={r.status} />
  <Stepper approval={r.approval} sentAt={r.createdAt} orientation="vertical" />
</DialogContent>

{sent ? (
  <div className="flex flex-col items-center gap-3 py-4 text-center">
    <SuccessCheck size={56} label="Request sent" />
    <p className="font-semibold">Your request was sent.</p>
    <p className="text-sm text-muted-foreground">{pipelineSentence(summary?.leave) ?? 'HR will review it.'}</p>
  </div>
) : <form>…</form>}
```

---

## 9. Do / Don't

**Do**
- Start every page with `PageShell` + `PageHero`; give every section a `SectionHeader`.
- Use `StatusViews` + `useRequestViews` on every request list; `ApprovalState` / `DecisionBadge` on every request card.
- Use `MoneyText` / `formatINR` for every rupee amount; `relativeTime` / `waitingSince` for "how long ago".
- Use `ErrorState` (with Try again), `SkeletonList`, `EmptyState` for every query.
- Keep one `stitched` card per view (the thing to look at first) and one silk accent (ring or underline) per page.
- Write words for every status and number; test both themes and a 360px-wide phone.

**Don't**
- Don't add a second `WeaveBackground`, decorative blobs, or gradient text on body copy.
- Don't use raw palette colours for status, or white text on amber/emerald/rose fills — pair `bg-success` /
  `bg-warning` / `bg-destructive` with `text-success-foreground` / `text-warning-foreground` / `text-destructive-foreground`.
- Don't animate list numbers, table cells, or anything continuously except live dots / current step.
- Don't put hover-only information (tooltips on touch are unreachable) — show it inline or on tap.
- Don't change `ui/*` primitives or `index.css` from a page; ask the kit owner. Page-specific CSS goes in Tailwind classes.
- Don't put a bare `<Dialog>` as a direct child of `PageShell`.

## 10. Gotchas

- `PageHero` reads the nav group for its eyebrow from the URL (`layout/nav-config.ts`). New nav labels (2026-10-31):
  *My Department Head* (/employee/hod), *Outpass & Tea Break*, *Loan & Advance* (renamed 2026-11-28), *About UKTextiles*; groups
  *My day / Requests / Team / Pay / Me & company*. Breadcrumb and eyebrow follow automatically.
- `useRequestViews` picks the opening view once; switching views keeps the user's choice across refetches.
- `ui/tabs` `Tabs` is now a thin wrapper that tracks the value (for the sliding pill). API unchanged; `TabsTrigger` wraps
  its children in a `<span>` (z-index above the pill) — a trigger's own `className` still applies to the button.
- Default/gradient `Button`s carry `.btn-sheen` (position relative, overflow hidden at zero specificity — your
  `absolute`/`overflow-visible` classes still win). A page's `bg-*` class on a Button still works (the sheen is an overlay).
- `GlassCard` `asChild` merges onto the child (`Link`): the child must accept `className`, `style`, `onPointerMove`.
- `MoneyText` with a string like `"1234.50"` is fine; `null`/`""` shows "—". Negative shows `-₹500` and is read "minus ₹500".
- Dates: `relativeTime`/`waitingSince` read bare `YYYY-MM-DD` as local midnight (no UTC shift).
- The legacy `components/employee/{StatusBadge,RequestTabs,Reveal,EmptyState,LoadErrorCard}` still compile; replace them
  with `StatusPill`/`ApprovalState`, `StatusViews`, `listItem`, `EmptyState`, `ErrorState` as you rebuild a page.
- `Skeleton` (ui) shows the tumbling loader by design; for lists use `SkeletonList`.
- White text on `bg-primary` in dark mode is 4.44:1 — use `bg-brand-gradient` (5.2:1) for filled text surfaces.
- White on the dark theme's solid `bg-success` / `bg-destructive` / `bg-warning` is 1.6–2.8:1. Use the matching
  `text-*-foreground` (near-white in light, near-black in dark). `index.css` also forces that foreground in dark mode when
  one of those fills is paired with `text-white`, as a safety net — don't rely on it in new code.
- A collapsed-rail nav link gets its accessible name from its contents (an `sr-only` label plus the badge's "N waiting"),
  never from `aria-label`, which would hide the count from screen readers.
