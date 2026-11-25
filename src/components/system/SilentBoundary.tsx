import * as React from 'react'

/**
 * For the extras drawn over the app (the sign-in / sign-out transitions, the welcome tour, the "new version" card): if
 * one of them fails it disappears (and `onError` tidies up) instead of taking the whole app to the error page. Their
 * navigation and sign-out never depend on them (fallback timers in lib/auth-transition.ts).
 */
export class SilentBoundary extends React.Component<{ children: React.ReactNode; onError?: () => void }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('An overlay failed and was hidden:', error)
    try {
      this.props.onError?.()
    } catch {
      // tidying up must not fail again
    }
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
