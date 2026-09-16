import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  fallback: ReactNode
  onError?: (message: string) => void
}

type State = { hasError: boolean; message: string }

export default class AaErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'AA SDK 載入失敗',
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[MapMap AA]', error, info)
    this.props.onError?.(error?.message || 'AA SDK 載入失敗')
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}
