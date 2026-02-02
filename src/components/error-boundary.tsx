'use client'

import React, { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp, Bug } from 'lucide-react'

// ============================================
// ERROR BOUNDARY COMPONENT
// Catches React errors and displays friendly UI
// ============================================

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  showDetails?: boolean
  resetKeys?: unknown[] // Reset when these change
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
  showStack: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showStack: false,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ERROR BOUNDARY] Caught error:', error)
    console.error('[ERROR BOUNDARY] Component stack:', errorInfo.componentStack)
    
    this.setState({ errorInfo })
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
    
    // Log to external service in production
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to error tracking service (Sentry, etc.)
      console.error('[ERROR BOUNDARY] Production error - should log to external service')
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    // Reset error state when resetKeys change
    if (this.state.hasError && this.props.resetKeys) {
      const resetKeysChanged = this.props.resetKeys.some(
        (key, index) => key !== prevProps.resetKeys?.[index]
      )
      if (resetKeysChanged) {
        this.reset()
      }
    }
  }

  reset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showStack: false,
    })
  }

  toggleStack = () => {
    this.setState(prev => ({ showStack: !prev.showStack }))
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="max-w-lg w-full bg-white rounded-xl shadow-lg border border-red-100 overflow-hidden">
            {/* Header */}
            <div className="bg-red-50 px-6 py-4 border-b border-red-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-red-900">Something went wrong</h2>
                  <p className="text-sm text-red-600">An error occurred while rendering this component</p>
                </div>
              </div>
            </div>

            {/* Error Message */}
            <div className="px-6 py-4">
              <div className="bg-red-50 rounded-lg p-4 mb-4">
                <p className="text-sm font-mono text-red-800 break-words">
                  {this.state.error?.message || 'Unknown error'}
                </p>
              </div>

              {/* Stack trace (collapsible) */}
              {this.props.showDetails !== false && this.state.errorInfo && (
                <div className="mb-4">
                  <button
                    onClick={this.toggleStack}
                    className="flex items-center space-x-2 text-sm text-gray-500 hover:text-gray-700"
                  >
                    <Bug className="h-4 w-4" />
                    <span>Technical Details</span>
                    {this.state.showStack ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                  
                  {this.state.showStack && (
                    <pre className="mt-2 p-3 bg-gray-900 text-gray-100 rounded-lg text-xs overflow-auto max-h-48">
                      {this.state.error?.stack}
                      {'\n\nComponent Stack:\n'}
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={this.reset}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Try Again</span>
                </button>
                <a
                  href="/"
                  className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Home className="h-4 w-4" />
                  <span>Go Home</span>
                </a>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
              <p className="text-xs text-gray-500 text-center">
                If this keeps happening, please contact support or refresh the page
              </p>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// ============================================
// HOOK FOR FUNCTIONAL COMPONENTS
// ============================================

interface UseErrorBoundaryReturn {
  showBoundary: (error: Error) => void
  reset: () => void
}

/**
 * Hook to imperatively show error boundary
 * Usage: const { showBoundary } = useErrorBoundary()
 */
export function useErrorBoundary(): UseErrorBoundaryReturn {
  const [, setError] = React.useState<Error | null>(null)

  return {
    showBoundary: (error: Error) => {
      setError(() => {
        throw error
      })
    },
    reset: () => {
      setError(null)
    },
  }
}

// ============================================
// SPECIALIZED ERROR BOUNDARIES
// ============================================

/**
 * Error boundary for individual email cards
 */
export function EmailCardErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <AlertTriangle className="h-6 w-6 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-red-700">Failed to load email</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
          >
            Reload page
          </button>
        </div>
      }
      showDetails={false}
    >
      {children}
    </ErrorBoundary>
  )
}

/**
 * Error boundary for the entire page
 */
export function PageErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('[PAGE ERROR]', error, errorInfo)
        // Could send to error tracking here
      }}
    >
      {children}
    </ErrorBoundary>
  )
}

/**
 * Error boundary for modals/dialogs
 */
export function ModalErrorBoundary({ 
  children, 
  onClose 
}: { 
  children: ReactNode
  onClose?: () => void 
}) {
  return (
    <ErrorBoundary
      fallback={
        <div className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Content</h3>
          <p className="text-gray-600 mb-4">Something went wrong while loading this content.</p>
          <div className="flex justify-center space-x-3">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700"
            >
              Reload Page
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Close
              </button>
            )}
          </div>
        </div>
      }
      showDetails={false}
    >
      {children}
    </ErrorBoundary>
  )
}

export default ErrorBoundary
