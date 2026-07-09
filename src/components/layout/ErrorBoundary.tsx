import * as React from 'react'

interface State {
  error: Error | null
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-8 text-center">
          <h1 className="text-xl font-bold">Something went wrong</h1>
          <p className="text-muted-foreground max-w-md text-sm">{this.state.error.message}</p>
        </div>
      )
    }
    return this.props.children
  }
}
