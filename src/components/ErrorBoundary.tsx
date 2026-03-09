import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App error:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div style={{
          padding: 24,
          margin: 20,
          background: '#1B2A3B',
          border: '2px solid #E74C3C',
          borderRadius: 8,
          color: '#E8F4FF',
          fontFamily: "'Segoe UI', Arial, sans-serif",
        }}>
          <h2 style={{ color: '#E74C3C', marginBottom: 8 }}>Σφάλμα εφαρμογής</h2>
          <pre style={{ fontSize: 14, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
            {this.state.error.message}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}
