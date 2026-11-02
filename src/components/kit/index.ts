// The UKTextiles Employee Web App kit ("Sovereign Loom" + the LOOM signature). Read KIT.md before using it.

// Page frame
export { PageShell, PageHero } from './PageShell'
export { SectionHeader } from './SectionHeader'
export { GlassCard, type GlassCardProps } from './GlassCard'
export { WeaveBackground } from './WeaveBackground'
export { ThreadProgress } from './ThreadProgress'

// Figures
export { KpiTile } from './KpiTile'
export { AnimatedNumber } from './AnimatedNumber'
export { MoneyText } from './MoneyText'

// Status and requests
export { StatusPill } from './StatusPill'
export { StatusViews } from './StatusViews'
export { useRequestViews, type RequestViewsState } from './useRequestViews'
export { DecisionBadge, ApprovalState } from './DecisionBadge'
export { Stepper, type StepperStep } from './Stepper'
export { SegmentedControl, type SegmentOption } from './SegmentedControl'

// States
export { EmptyState, ErrorState, SkeletonList, SkeletonBlock } from './States'
export { SuccessCheck } from './SuccessCheck'

// Visualisation
export { Sparkline } from './Sparkline'
export { BarCompare, BarList, type CompareItem, type BarListItem } from './Bars'
export { RingMeter } from './RingMeter'
export { MonthDial, type DialFill } from './MonthDial'
export { Waterfall, type WaterfallStep } from './Waterfall'
export { Timeline, type TimelineItem } from './Timeline'

// Motion and colour
export { useReducedMotion, isLowPowerDevice } from './useReducedMotion'
export * from './motion'
export * from './tones'

// Pure helpers the kit is built on (also importable from '@/lib/...')
export { formatINR, formatINRCompact, formatCount, toAmount } from '@/lib/money'
export { relativeTime, waitingSince, waitingDays, greetingFor } from '@/lib/relative-time'
export {
  REQUEST_VIEWS,
  VIEW_LABELS,
  MONTH_HINT,
  statusGroup,
  rowsForView,
  viewCounts,
  defaultView,
  emptyViewText,
  inMonthScope,
  rowsInScope,
  monthForRow,
  scopeToRow,
  waitingInOtherMonths,
  monthEmptyText,
  type MonthScope,
  type RequestView,
  type StatusGroup,
  type ViewOptions,
} from '@/lib/request-views'
export {
  deciderFromApproval,
  deciderFromFields,
  deciderFromStamps,
  deciderForAdvance,
  deciderText,
  decisionLineFor,
  approvalPath,
  formatWhen,
  type Decider,
  type DecisionTone,
} from '@/lib/decider'
