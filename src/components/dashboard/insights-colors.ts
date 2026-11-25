// The chart colours of the Dashboard's "My Insights" (InsightsSection / InsightsCharts), as validated for the mobile app in
// light and dark: attendance = sapphire (--primary) vs on time = amber (--warning); pay earned = teal vs lost = rose (red
// vs green fails the colour-blind check). The teal has no theme token, so the section sets it as --ins-kept on its root
// (INSIGHTS_VARS), with a lighter tint in dark mode.

/** Put on the section's root: the chart colours as CSS variables, for light and dark. */
export const INSIGHTS_VARS =
  '[--ins-att:var(--primary)] [--ins-ontime:var(--warning)] [--ins-kept:#0d9488] dark:[--ins-kept:#2dd4bf] [--ins-lost:var(--destructive)]'

export const SERIES = {
  attendance: 'var(--ins-att)',
  onTime: 'var(--ins-ontime)',
  kept: 'var(--ins-kept)',
  lost: 'var(--ins-lost)',
} as const
