import { Component, type ErrorInfo, type ReactNode } from 'react'
import { captureException } from '../../shared/observability/observability'

interface AppErrorBoundaryProps {
  children: ReactNode
}

interface AppErrorBoundaryState {
  hasError: boolean
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
  }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('SunCast runtime error', error, errorInfo)
    captureException(error, {
      area: 'app-error-boundary',
      componentStack: errorInfo.componentStack,
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="app-runtime-fallback" role="alert" data-testid="app-runtime-fallback">
          <h1>SunCast is running in degraded mode</h1>
          <p>The app hit an unexpected runtime error. Refresh to recover normal mode.</p>
          <p>If this repeats, capture console logs and include reproduction steps for vendor support.</p>
        </main>
      )
    }

    return this.props.children
  }
}
