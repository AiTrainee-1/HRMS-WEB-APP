// Phone-view (< 768px) class sets shared by the request pages (Leave, Casual Leave, Permission, Missing Punch, Outpass)
// and their forms, so every request screen matches the Employee mobile app the same way (kit/MOBILE.md). Every class is
// `max-md:` - none of this reaches the desktop view.

/**
 * On a PageHero: drop the KPI grid on phones. The mobile request screens have no KPI tiles; the same counts are on the
 * four count cards (StatusViews) right above the list. PageHero renders the KPI grid as its LAST child div, so only pass
 * this when `kpis` is given.
 */
export const HERO_NO_KPIS_ON_PHONE = 'max-md:[&>div:last-child]:hidden'

/**
 * On a PageHero: drop the actions row on phones, for a screen whose phone layout puts its main button lower down (the
 * Casual Leave screen has "Apply for Casual Leave" inside its This month card). The actions are the second div of the
 * title row (the row is the header's second child, after the glow).
 */
export const HERO_NO_ACTIONS_ON_PHONE = 'max-md:[&>div:nth-child(2)>div:nth-child(2)]:hidden'

/** A form field's label on phones: the app's Input label - 13px semibold, textSecondary, sentence case. */
export const PHONE_FIELD_LABEL =
  'max-md:text-[13px] max-md:leading-4 max-md:font-semibold max-md:normal-case max-md:tracking-[0.02em] max-md:text-secondary-foreground'

/** A sheet's buttons row on phones: one column, so the primary button runs the full width. */
export const PHONE_BUTTON_ROW = 'max-md:flex-col!'

/** A sheet's Cancel on phones: the app's sheets have none (close with the X, a tap outside or Esc). */
export const PHONE_NO_CANCEL = 'max-md:hidden'

/** A sheet's submit button on phones: the app's full-width 48px primary button, 15px bold. */
export const PHONE_SUBMIT = 'max-md:h-12 max-md:w-full max-md:text-[15px] max-md:font-bold'
