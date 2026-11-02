# UKTextiles Employee Web App - the PHONE view contract

The owner audited the Employee **mobile app** (`D:\Projects\UK-textile-Mobi\uktextiles-employee-app`, Expo) and wants
the web app, **at phone widths only**, to follow the same design, alignment, spacing and colours. The desktop view
stays exactly as it is. Read this with `KIT.md` (the kit's props and rules still apply on phones).

---

## 1. The hard rule: desktop does not change

"Phone view" = viewport **narrower than 768px** (Tailwind `md` = 48rem). Every visual change is one of:

1. a Tailwind class with the **`max-md:`** variant (compiles to `@media not all and (width>=48rem)`);
2. CSS inside **`@media (width < 48rem) { ... }`** in `src/index.css`, with scoped selectors;
3. a **new phone-only element** hidden on desktop: `className="hidden max-md:flex ..."` (or `max-md:block|grid`), and
   an existing desktop-only element hidden on phones with `max-md:hidden`.

Never change a base (unprefixed) class, an `sm:` / `md:` / `lg:` / `xl:` class, a prop, a behaviour, or a token value
outside the phone media query. If a phone needs different markup, render both branches and hide one with classes.
`useIsPhone()` (`src/hooks/useIsPhone.ts`) is for BEHAVIOUR only (close a drawer when the window grows) - never to
choose what renders at >= 768px.

**Prove it before you hand over** (both must print PASS / 0):

```bash
npm run build
node scripts/desktop-css-guard.mjs <baseline index-*.css> dist/assets
```

The guard drops every phone-only media block from both files and compares the rest selector by selector:
CHANGED / REMOVED / ORDER = fail; ADDED = new selectors outside phone media, each needs a reason (aim for 0 - phase A
left it at **0**). Run it against the lead's baseline, not against your own previous build.

---

## 2. How the phone skin is built (what you get for free)

| Layer | Where | What it does on phones |
|---|---|---|
| Tokens | `src/index.css`, the `PHONE VIEW` block at the end | Every theme token (`--background`, `--card`, `--primary`, `--status-*`, `--radius`, fonts, ...) remapped to the app's palettes. Light = app light (its default), `.dark` = app dark. |
| Scope | `data-shell="employee"` on `EmployeeLayout`'s root | Tokens use `:root:has([data-shell='employee'])`, so portals (dialogs, menus, toasts) follow, and the sign-in pages (their own violet look) do not. |
| Surfaces | `src/index.css`, `@layer utilities` -> `@media (width < 48rem)` | `.glass` / `.glass-raised` lose the frosting (solid card colour from tokens), `.shadow-clay*` become the app's three elevations, `.stitched` becomes a **4px coloured left border**, `.weave-static` and `.silk-line` disappear, `.chip` borders go transparent, dialogs slide up from the bottom. |
| Kit + ui | `max-md:` classes inside `kit/*` and `ui/*` | Section 5. Same props everywhere. |
| Shell | `layout/EmployeeLayout.tsx` + `layout/mobile/*` | Phone top bar, side drawer, bottom tab bar (section 3). The desktop header, weave and greeting are hidden on phones. |

So a page that already uses the kit (PageShell, PageHero, GlassCard, SectionHeader, StatusViews, StatusPill, KpiTile,
EmptyState, Dialog ...) is already 70% of the way there. Your job per page: **match the mobile screen's layout**
(order of blocks, which card holds what, density) with `max-md:` classes, and add phone-only blocks where the app shows
something the web page has no equivalent for.

---

## 3. The phone shell (already done)

```
┌──────────────────────────────────────────┐  52px  MobileTopBar (always visible; outside the scroller)
│ ≡  (UKT) UKTEXTILES          🔔•   (👤)   │        menu glyph · logo 28px · wordmark 13px / 8px · bell (red dot
│          EMPLOYEE PORTAL                 │        when unread) -> /employee/notifications · avatar -> /employee/profile
├──────────────────────────────────────────┤
│ 16px gutter, 8px top                     │  <main> scrolls. Pages start with PageHero (= the app's sub-header).
│ Title 20px bold            [+ Action]    │
│ subtitle 12px muted                      │
│ ...                                      │
├──────────────────────────────────────────┤
│  ⌂     📅      🕑      📋³      👤        │  MobileTabBar: Home · Attendance · My Shift · Approvals (heads only,
│ Home Attend. My Shift Approvals Profile  │  red count) · Profile. 56px + safe-area. Last child of the flex column,
└──────────────────────────────────────────┘  NOT fixed: <main> ends above it, pages need no bottom padding.
```

- **Drawer** (`layout/mobile/MobileDrawer.tsx`, from the menu glyph): the app's SideDrawer - sapphire gradient header
  (logo 44px, "UKTEXTILES", "Employee Self-Service"), groups *Home & Attendance / HR Operations / Payroll & Salary /
  Records & Community / Account & System*, 36px tinted icon wells in each entry's app colour, chevrons, unread count on
  Notifications, red Resignation under a divider, footer with Dark Mode switch + "Auto" and Sign out. Entries and labels:
  `layout/mobile/phone-nav.ts` (gating still from `nav-config.ts`).
- **Tab routes**: `PHONE_TABS` in `phone-nav.ts`. Active tab = the app's dock style (tinted well, icon x1.22 lifted 3px,
  dot under it, label in primary).
- Layout numbers as CSS variables (phones only): `--m-gutter` 16px, `--m-topbar-h` 52px, `--m-tabbar-h`
  (56px + safe area). Use `--m-tabbar-h` only for something `position: fixed` at the bottom of the screen.
- Root height is `100dvh` on phones (`max-md:h-dvh`), so the tab bar is never under the browser's toolbar.
- The loading thread runs along the bottom of the phone top bar too. Route changes still cross-fade; scroll resets.
- The About page (`/employee/company`) keeps its own committed look; it sits inside the phone shell unchanged.

---

## 4. Tokens - web name -> mobile app palette key

Light (app `src/constants/colors.ts`, the app's default) / Dark (app `src/theme/palettes.ts`):

| Web token (utility) | App key | Light | Dark |
|---|---|---|---|
| `--background` (`bg-background`) | bgLight | `#F8FAFC` | `#0B1220` |
| `--card` / `--popover` (`bg-card`) | bgCard | `#FFFFFF` | `#111827` |
| `--foreground` | textPrimary | `#0F172A` | `#F1F5F9` |
| `--secondary-foreground` (`text-secondary-foreground`) | textSecondary | `#334155` | `#CBD5E1` |
| `--muted-foreground` | textMuted | `#64748B` | `#94A3B8` |
| `--muted` / `--secondary` (`bg-muted`) | bgSurfaceLow / Mid | `#F1F5F9` | `#0F172A` / `#152238` |
| `--primary` (`bg-primary`, `text-primary`) | primary | `#1E3A8A` | `#60A5FA` (+ dark text on it) |
| `--accent` (`bg-accent`) | primaryFixed (blue tint) | `#DBEAFE` | `#1E3A5F` |
| `--ring` | primaryLight | `#2563EB` | `#60A5FA` |
| `--border` (`border-border`, `hairline`) | border | `#E2E8F0` | `#1E293B` |
| `--input` (`border-input`, `bg-input`, `text-input`) | outlineVariant | `#CBD5E1` | `#334155` |
| `--grad-from/to` (`bg-brand-gradient`) | gradientPrimary | `#1E3A8A -> #2563EB` | `#2563EB -> #1D4ED8` (white text AA) |
| `--destructive` | statusRed | `#E11D48` (white text) | `#FB7185` (dark text) |
| `--success` / `--warning` | statusGreen / statusYellow | `#047857` / `#B45309` (white text) | `#34D399` / `#FBBF24` (dark text) |
| `waiting-bg` / `waiting` | badgeYellowBg / Text | `#FFFBEB` / `#B45309` | `#3D2E0A` / `#FCD34D` |
| `approved-bg` / `approved` | badgeGreenBg / Text | `#ECFDF5` / `#047857` | `#0F2E22` / `#6EE7B7` |
| `rejected-bg` / `rejected` | badgeRedBg / Text | `#FFF1F2` / `#BE123C` | `#3F1720` / `#FCA5A5` |
| `info-bg` / `info` | badgeBlueBg / Text | `#DBEAFE` / `#1E3A8A` | `#0F2A4A` / `#93C5FD` |
| `neutral-bg` / `neutral` | badgePendingBg / Text | `#F1F5F9` / `#475569` | `#1E293B` / `#94A3B8` |
| `violet-bg` / `violet` | badgeLeaveBg / Text | `#FAF5FF` / `#7E22CE` | `#2E1065` / `#D8B4FE` |
| `--radius` | BorderRadius | `0.75rem` -> `rounded-lg` 12 (md), `rounded-xl` **16** (lg/xl, cards), `rounded-3xl` 24 (xxl, sheets) | same |

Where the app puts white text on a vivid fill that fails WCAG AA (statusYellow `#D97706`, statusGreen `#059669`, dark
primary `#60A5FA`), the web uses the AA pair above. Keep using **roles** (`text-waiting`, `bg-approved-bg`, `TONE_SOFT`)
- never raw hex, never Tailwind palette colours. The app's per-feature category colours (Leave `#8E44AD`, Outpass
`#009688`, Salary `#27AE60`, ...) live in `phone-nav.ts`; use them only for icon wells, like the app does.

**Typography (phones):** `font-display` and `metric` -> **Plus Jakarta Sans** (the app's displayBold / headlineSemibold);
`font-label`, `label-caps`, `chip`, buttons and body -> **Inter**. Sizes the app uses:

| Role | Size / weight | Web on phones |
|---|---|---|
| Page title (sub-header) | 20px Plus Jakarta bold (Home greeting 22) | PageHero `h1` |
| Page subtitle | 12px textMuted | PageHero `subtitle` |
| Section title | 16px Plus Jakarta semibold (Home "Quick Actions" 17) | SectionHeader `h2` |
| Card title | 15px Plus Jakarta semibold (some 14) | SectionHeader `as="h3"` |
| Body | 13-14px Inter | `text-[13px]` / `text-sm` |
| Secondary line | 11.5-12px textMuted | `text-xs text-muted-foreground` |
| Figure label | 10.5px bold UPPERCASE textMuted | `label-caps` |
| Big figure | 20-22px Plus Jakarta bold, tabular | `metric text-[22px]` |
| Badge / pill text | 10-12px bold | StatusPill |

**Spacing (phones):** 16px page gutter (the shell gives it); 8-12px between cards (`gap-2.5` / `gap-3`); PageShell
gives 16px between top-level blocks; card padding 14-16px (`p-3.5` / `p-4`); list rows ≥ 52px, touch targets ≥ 44px.
**Elevation:** cards = hairline border + `--m-shadow-low` (dark: border only); floating = `--m-shadow-mid`;
sheets = `--m-shadow-high`. No glows, no glass, no weave, no silk.

---

## 5. Component mapping: web kit -> mobile app

| Web | Mobile app equivalent | What it does on phones |
|---|---|---|
| `EmployeeLayout` | `app/(tabs)/_layout.tsx`, tab-screen top bar, `SideDrawer` | Section 3 |
| `PageHero` | the sub-header (`notifications.tsx` `subHeader`, `leave.tsx` `pageTitleRow`) | 20px bold title, 12px muted subtitle, actions at the right (pill buttons); no eyebrow, icon tile, glow, silk thread; KPI grid 2-up with 10px gaps |
| `PageShell` | the screen's ScrollView content | 16px between blocks |
| `GlassCard` | `Card` (bgCard, radius 16, 1px border, low shadow) | flat white card; `stitched` -> 4px left accent border in the tone (the app's LeaveCard look); `interactive` dims to 85% while pressed |
| `SectionHeader` | `sectionTitle` / `cardTitle` | 16px (h2) / 15px (h3) Plus Jakarta semibold, icon bare in its tone colour (no tile), description 12px |
| `StatusViews` | `components/requests/RequestViewSwitcher.tsx` | horizontal scroll of four **104px count cards** bleeding to the screen edges: icon + 20px count on top, 11px label under; every card tinted with its colour, the chosen one **filled** (lifts 2px; others at 97%) |
| `StatusPill`, `.chip` | `ui/Badge` | borderless pill on the status tint |
| `KpiTile` | Home attendance tiles / stat cards | 22px figure, 11.5px hint |
| `SegmentedControl`, `ui/tabs` | `outpass` `sectionBar` | white card track (radius 16, padding 4), chosen option filled sapphire, no silk foot |
| `EmptyState` | `ui/EmptyState` | no dashed box; 80px tinted circle with a 40px icon (compact: 48px), 17px bold title in textSecondary, 13px muted line |
| `ErrorState` | `RetryPanel` / `inlineError` | solid rejected tint, no border |
| `SkeletonList` | `SkeletonCard` | 10px gaps, flat cards |
| `ui/dialog` `DialogContent` | `ui/BottomSheet` | **bottom sheet**: full width, 24px top corners, drag-handle bar, max 88% tall (scrolls inside), clears the home indicator, slides up; title 18px bold left-aligned; footer buttons stack full width |
| `ui/sheet` | drawer / `BottomSheet` | solid surface; `side="bottom"` = the BottomSheet look with handle |
| `ui/button` | `ui/Button` (BorderRadius.full) | **pill**; `default` size 44px tall, `sm` 36px, `lg` 48px bold; filled buttons lose the coloured glow |
| `ui/input`, `textarea`, `select` | `ui/Input` | 48px white field, radius 12, **16px text** (stops iOS zooming on focus) |

---

## 6. Class patterns and the traps in them

- **`max-md:` for every phone change.** Phone-only blocks: `hidden max-md:flex` on the wrapper (zero new desktop CSS);
  `md:hidden` also works but adds a desktop rule the guard lists. Inside a phone-only block you may use plain classes,
  but every class Tailwind has not generated before becomes an ADDED rule in the guard - prefix them with `max-md:` too
  (see `layout/mobile/*`), except plain index.css classes that cannot take a variant (next point).
- **index.css classes beat `max-md:` utilities.** `glass`, `glass-raised`, `chip`, `shadow-clay*`, `label-caps`,
  `metric`, `font-display`, `font-label`, `stitched`, `lift`, `ui-*`, `scrollbar-*` are emitted AFTER Tailwind's
  utilities, so on the same element `max-md:bg-transparent` loses to `glass`. Add `!` (`max-md:bg-transparent!`,
  `max-md:border-0!`) or change the token. These classes also cannot take a variant (`max-md:glass` does not exist).
- **`sm:` beats `max-md:` between 640 and 767px.** Tailwind emits `max-md:` before `sm:`. If the element has
  `sm:text-[34px]` and you add `max-md:text-[20px]`, phones under 640 get 20px but 640-767 get 34px. Fix with `!`
  (`max-md:text-[20px]!`) or the range variant `sm:max-md:text-[20px]`. Design for 360-430px; check the 640-767 sliver.
- **`max-md:font-display` is Playfair, not Plus Jakarta.** The theme inlines font utilities; the plain class
  `font-display` reads `var(--font-display)` (Plus Jakarta on phones) and is what you want. Inside `max-md:` write
  `max-md:font-[family-name:var(--font-display)]`.
- **Stacking:** `max-md:dark:bg-x`, `max-md:active:opacity-85`, `max-md:data-[state=open]:x`, `max-md:[&>li]:x` all work.
- **`cn()` / tailwind-merge** keeps `max-md:x` and a base `y` side by side (different variants), so a page's own
  `className` overrides the base and a page's `max-md:` overrides the kit's `max-md:`. A kit class with `!` can only be
  overridden by a page class with `!`.
- **Buttons are pills on phones.** A Button used as a tile (`h-auto flex-col ...`) adds `max-md:rounded-xl`. Icon
  buttons are circles. Default buttons are 44px tall - a page that forced `h-8` on a Button gets 44px on phones unless
  it also sets `max-md:h-8`.
- **Bleeding to the screen edge:** `max-md:-mx-4 max-md:px-4` (what StatusViews does). `<main>` clips sideways overflow.
- **Fixed bottom things:** the tab bar is part of the layout, not fixed. Anything you make `fixed bottom-0` on phones
  must sit at `max-md:bottom-[var(--m-tabbar-h)]` or it covers the tabs (the app's SlideToPunch sits above its tab bar).
  `ConnectivityNotice` (offline banner) does cover the tabs while offline - on purpose.
- **Sticky inside a page** sticks under the phone top bar (the scroller is `<main>`), so `sticky top-0` is right.
- **Dialogs are bottom sheets automatically.** Do not hand-build sheets. A wide dialog (`w-[min(96vw,1000px)]`,
  `sm:max-w-2xl`) becomes full width on phones. Inputs in a sheet: the iOS keyboard does not shrink `dvh`; keep forms short
  or let the sheet scroll.
- **Do not add a second top bar, back button bar, greeting, or bottom nav in a page** - the shell owns them. The app's
  stack screens have a back-arrow header; on the web the browser's back does that, and PageHero is the sub-header.
  A sub-page (Salary slip detail) may put a small "Back" pill in PageHero `actions`.
- **Dark mode:** both phone themes are first-class - check every page in both (the drawer's switch flips them). The
  web's default theme is still DARK (see section 9).
- **Hover-only effects do nothing on phones** (`@media (hover: hover)`); use `active:` for press feedback.
- **Never hide content on phones** that desktop shows unless the mobile screen genuinely leaves it out - move it lower
  or into a sheet instead.
- **Tailwind scans prose too.** This file is excluded (`@source not` at the top of `index.css`), but `KIT.md`, comments
  and string literals are scanned: a bare utility word in a comment (`blur`, `shrink`, `hidden` ...) generates a rule the
  guard reports as ADDED. Reword the comment.
- **Kit components with `!` on phones:** PageHero title size, KpiTile figure size, PageHero icon tile, StatusViews track,
  Dialog `max-w-none` - each beats an `sm:` class between 640 and 767px.

---

## 7. Recipes

**Sub-header with a pill action** (just PageHero - nothing phone-specific needed):
```tsx
<PageHero title="Leave" subtitle="Your leave and Casual Leave" actions={<Button><Plus /> Apply Leave</Button>} />
```

**A list card like the app's request cards** (white card, 4px left accent by status, title row + badge, meta row):
```tsx
<GlassCard className="flex flex-col gap-3 max-md:gap-2 max-md:border-l-4 max-md:border-l-approved-border max-md:p-3.5">
  <div className="flex items-center justify-between gap-2">
    <h3 className="font-semibold max-md:text-[14px] max-md:font-bold">Casual leave</h3>
    <StatusPill tone="approved" size="sm">Approved</StatusPill>
  </div>
  <p className="text-sm text-muted-foreground max-md:text-[13px] max-md:text-secondary-foreground">Mon, 4 Nov 2026</p>
</GlassCard>
```
(`variant="stitched" tone="emerald"` gives the same left accent for the ONE highlighted card.)

**A phone-only block** (e.g. Home's quick-action grid that desktop does not have):
```tsx
<section aria-label="Quick actions" className="hidden max-md:block">
  <div className="max-md:grid max-md:grid-cols-3 max-md:gap-2.5">
    <Link href="/employee/leave" className="max-md:flex max-md:min-h-24 max-md:flex-col max-md:items-center max-md:justify-center max-md:gap-2 max-md:rounded-xl max-md:border max-md:bg-card max-md:shadow-[var(--m-shadow-low)]">
      <span className="max-md:grid max-md:size-[46px] max-md:place-items-center max-md:rounded-xl max-md:bg-[#FCE9F3] max-md:text-[#D6408C]"><Leaf className="max-md:size-[22px]" /></span>
      <span className="max-md:text-[11px] max-md:font-semibold">Apply Leave</span>
    </Link>
  </div>
</section>
```
(In dark mode give pastel wells a dark alternative: `max-md:dark:bg-[color-mix(in_srgb,#D6408C_20%,transparent)]`.)

**A desktop block the phone screen does not have:** `className="... max-md:hidden"`.

**Section title row like the app's** ("Quick Actions" ... "Essential Workflows"):
```tsx
<SectionHeader title="Quick Actions" action={<span className="text-[11px] font-semibold text-muted-foreground">Essential Workflows</span>} />
```

---

## 8. Per page: the matching mobile screen (paths under the mobile repo)

The web shell already provides the app's tab-screen top bar on every page, so where a mobile screen has a back-arrow
header (`header` + `backBtn`), the web page shows the same title/subtitle in PageHero instead.

| Web page | Mobile screen | What the phone view should look like |
|---|---|---|
| Dashboard | `app/(tabs)/home.tsx` (+ `src/components/home/*`, `SlideToPunch`) | Date line 12px muted; greeting 22px bold + punched-in dot; profile card (44px avatar, name 15px, code • designation, 40px QR button -> ID card); **deep-navy attendance card** (gradient `#0F172A -> #1E3A8A -> #2563EB`, radius 24, "October Attendance" + "Day 2/30" pill, 4 translucent tiles Work Days / Present (teal) / Absent (red tile) / Leaves); **Right now / Today's punches** panel (`dashboard/PhoneTodayPanel.tsx` = the app's `home/TodayPanel.tsx`, 2026-11-02: RIGHT NOW + day-off / night chip, 46px clock, presence line with dot, shift card with sapphire progress bar, day bar with shift window / time inside / punch dots / now marker + legend, punch rows labelled by what they are; it replaced the shift pill and the 4-slot tracker); Needs your attention strip; **Quick Actions** 3-column tiles (46px pastel wells, 11px labels, first 6 + "Show all N actions" pill; Apply Leave + Permission left out for production); next holiday card ("in N days" pill); last salary card (amounts hidden behind an eye). Desktop-only greeting/hero pieces: `max-md:hidden`. |
| Attendance | `app/(tabs)/attendance.tsx` (+ `AttendanceCalendar`, `AttendanceOverview`) | Month card with prev/next buttons and the month name; Attendance Request card (icon well, title, 11.5px subtitle, "View Details"); "Monthly Overview" card; "Attendance Calendar" card (the app's calendar colours); Casual Leave card. |
| MyShift | `app/shift/index.tsx` | Title "My Shift", subtitle "October 2026 · Assigned Schedule & Monthly Timing"; cards: Shift Details, This Month's Summary, Late & Permission Deductions, Weekly Schedule (14px semibold card titles). |
| Leave | `app/(tabs)/leave.tsx` (+ `LeaveCard`, `casualLeave/*`) | Title row "Leave Portal" + subtitle + "Apply Leave" pill (plus icon); workflow-off note; Casual Leave entry card; "Your leave requests" section title; StatusViews (month label "Taken this month"); LeaveCards (left accent by status, type + icon + badge, date row, "Nd" pill, italic reason, approver note, waiting chip / who decided, trail); upcoming holiday card. Apply = bottom sheet (2-column category cards, chips). |
| CasualLeave | `app/casual-leave/index.tsx` | "Casual Leave" / "One paid day a month, or two half-days"; "Your year" (month dials) section; "Your applications in 2026" + StatusViews + cards. |
| Permissions | `app/requests/index.tsx`, `app/requests/new.tsx` | "Permission Requests" / "Morning Late-In • Evening Early-Out • Middle One-Hour"; segmented bar; StatusViews; request cards. The new request is a separate screen in the app - a bottom sheet on the web. |
| MissingPunch | `app/missing-punch/index.tsx` | "Missing Punch" / "Biometric punch regularization"; StatusViews; request cards with left accents. |
| Outpass | `app/outpass/index.tsx`, `app/outpass/request.tsx` (+ `outpass/OutpassFlipCard`, `tea-break/*`) | "Gate Outpass" / "Digital Transit Clearance"; section bar **Outpass / Tea Break** (white track, filled active); StatusViews; flip cards; request in a bottom sheet. |
| AttendanceRequest | `app/geo-punch/index.tsx` + `app/on-duty/index.tsx` (+ `onduty/*`) | Office (geo punch) as the app's stepper: allow location -> capture location -> review grid (Branch / Distance / Punch / Time) + policy banner, step dots, "Start Over"; On-Duty = apply flow + records list. Keep the web's Office / On-Duty switch (SegmentedControl). |
| Approvals | `app/(tabs)/approvals.tsx` (+ `components/approvals/*`) | Header; horizontal **category rail** (chips with counts); status switcher; search bar; notices; approval cards; decide in a bottom sheet (DecisionSheet). It is a tab for heads (badge in the tab bar). |
| HodAssignment | `app/hod-assignment/index.tsx` (+ `hodAssignment/*`, `support/ContactBlockCard`) | My requests panel; "Your Department Head" card (avatar row + badge, name, sub-line); contact block card. |
| Notifications | `app/(tabs)/notifications.tsx` (+ `notifications/NotificationCard`) | Sub-header "Notifications" + "N New" pill (primary, white 10px) + "N unread" / "All caught up", "Read All" pill (blue tint, check-all icon) at the right; filter pills **All N / Unread N** (white + border; active filled primary); push-setup banner (amber tint); cards 8px apart. |
| Salary | `app/salary/index.tsx` (+ `SalarySlipCard`) | "Salary Slips" / "What you were given, what you earned, what you lost"; year chips; charts; "All salary slips" list title; slip cards. |
| SalaryDetail | `app/salary/[id].tsx` | Month title + subtitle; sections "Changed by HR after this slip", "Earnings on the slip", "Deductions & Recoveries", "How your pay was worked out". |
| Compensation | `app/compensation/index.tsx` | Title + "Everything detected for you and given by HR"; one section per kind with its cards. |
| Settlement | `app/settlement/index.tsx`, `apply.tsx`, `[id].tsx` (+ `settlement/RecordCard`) | "Advances & Loans" / "Salary Advance · Term Loan"; "My applications" list (figure labels 10.5px uppercase muted); apply and details as sheets / sections. |
| Documents | `app/documents/index.tsx` (+ `DocumentCategoryCard`, `documents/*`) | Gradient hero card (avatar, name, meta, "Private to you" lock, stat row with dividers incl. "Last added"); Save / Share tip banner; stale banner; category cards. |
| IdCard | `app/idcard/index.tsx` (+ `idcard/*`) | "Digital ID Card" / "Show this when someone asks for your ID"; title row with the UKT mark; warning line; the flip card full width; hint under it. |
| Holidays | `app/holidays/index.tsx` | "Company Holidays" / "Annual Holiday Calendar"; month-grouped holiday cards. |
| Chat | `app/chat/index.tsx` (+ `chat/*`) | Full-height conversation between the top bar and the tab bar: day dividers, bubbles, "load earlier", composer pinned at the bottom of the page area. Size it with `max-md:h-[calc(100dvh-var(--m-topbar-h)-var(--m-tabbar-h)-...)]` or a flex column, never `fixed`. |
| Company | `app/company/index.tsx` | **Do not restyle** - the web About page keeps its own committed look (`components/company/*`). |
| Help | `app/help/index.tsx` (+ `support/*`) | "Help & Support" / "Who to contact, and when"; contact cards. |
| Profile | `app/(tabs)/profile.tsx` | Royal-gradient hero card (avatar with edit badge, name, sub-line, plant row, tags); "Digital ID Pass" link card; detail sections; small uppercase **section labels** ("SECURITY & ACCOUNT", 11px bold muted) above grouped white action cards (rows divided by hairlines); sheets for edits. |
| Resignation | `app/resignation/warning.tsx` -> `survey.tsx` -> `confirm.tsx` -> `success.tsx` | "Before You Continue" warning, survey, "Review & Submit", "Resignation Submitted" - a step flow; on the web keep one page but follow that order and look. |

---

## 9. Open decisions (for the lead / owner)

- **Default theme on phones.** The app opens in LIGHT; the web opens in DARK for everyone (`context/ThemeContext.tsx`
  `DEFAULT_MODE`). On a phone with no saved choice the web therefore shows the app's dark palette until the person flips
  the drawer switch. A phone-only default (`readStored()` returning `'light'` when nothing is stored and
  `matchMedia('(width < 48rem)')` matches) would match the app; it is a behaviour change, so phase A did not make it.
- **Drawer labels.** The app's words where the page is the same page (Home, Permissions, Salary Slips, Digital ID Card,
  My Documents, Notifications, My Profile ...); the web's 2026-10-31 labels where the web page differs or was renamed
  (Geo Punch / On-Duty, Outpass & Tea Break, My Department Head, Advances & Settlement, About UKTextiles). One file:
  `layout/mobile/phone-nav.ts`.
- **SectionHeader on phones** follows the app's real section titles (16px semibold, mixed case). The app's small
  uppercase label exists too (Profile "SECURITY & ACCOUNT", drawer groups) - use `label-caps` for that.
- `theme-color` meta (`#0b1326`) still paints the phone browser's toolbar navy in light mode.
