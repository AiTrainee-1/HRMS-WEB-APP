import { Toaster as Sonner, type ToasterProps } from 'sonner'
import { useTheme } from '@/context/ThemeContext'

// Toasts follow the app's theme (they were pinned to light) and use the popover surface + status pairs.
const Toaster = ({ ...props }: ToasterProps) => {
  const { scheme } = useTheme()
  return (
    <Sonner
      theme={scheme}
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--glass-border)',
          '--success-bg': 'var(--popover)',
          '--success-text': 'var(--status-approved-fg)',
          '--success-border': 'var(--status-approved-border)',
          '--error-bg': 'var(--popover)',
          '--error-text': 'var(--status-rejected-fg)',
          '--error-border': 'var(--status-rejected-border)',
          '--warning-bg': 'var(--popover)',
          '--warning-text': 'var(--status-waiting-fg)',
          '--warning-border': 'var(--status-waiting-border)',
          '--info-bg': 'var(--popover)',
          '--info-text': 'var(--status-info-fg)',
          '--info-border': 'var(--status-info-border)',
          '--border-radius': '12px',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
