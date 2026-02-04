'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info, Loader2 } from 'lucide-react'
import { UI_CONFIG } from '@/lib/config'

// ============================================
// TOAST NOTIFICATION SYSTEM
// Provides global toast notifications
// ============================================

type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading'

interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => string
  removeToast: (id: string) => void
  updateToast: (id: string, updates: Partial<Toast>) => void
  // Convenience methods
  showToast: (message: string, type?: ToastType) => string
  success: (title: string, message?: string) => string
  error: (title: string, message?: string) => string
  warning: (title: string, message?: string) => string
  info: (title: string, message?: string) => string
  loading: (title: string, message?: string) => string
  promise: <T>(
    promise: Promise<T>,
    options: {
      loading: string
      success: string | ((data: T) => string)
      error: string | ((err: Error) => string)
    }
  ) => Promise<T>
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Omit<Toast, 'id'>): string => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const duration = toast.duration ?? (
      toast.type === 'error' ? UI_CONFIG.toasts.error :
      toast.type === 'warning' ? UI_CONFIG.toasts.warning :
      toast.type === 'loading' ? 0 : // Loading toasts don't auto-dismiss
      UI_CONFIG.toasts.success
    )

    setToasts(prev => [...prev, { ...toast, id }])

    // Auto-remove after duration (unless loading or duration is 0)
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, duration)
    }

    return id
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const updateToast = useCallback((id: string, updates: Partial<Toast>) => {
    setToasts(prev => prev.map(t => 
      t.id === id ? { ...t, ...updates } : t
    ))

    // If updating to a non-loading type, auto-dismiss
    if (updates.type && updates.type !== 'loading') {
      const duration = updates.duration ?? (
        updates.type === 'error' ? UI_CONFIG.toasts.error :
        updates.type === 'warning' ? UI_CONFIG.toasts.warning :
        UI_CONFIG.toasts.success
      )
      
      if (duration > 0) {
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== id))
        }, duration)
      }
    }
  }, [])

  // Convenience methods
  const showToast = useCallback((message: string, type: ToastType = 'info') =>
    addToast({ type, title: message }), [addToast])

  const success = useCallback((title: string, message?: string) => 
    addToast({ type: 'success', title, message }), [addToast])
  
  const error = useCallback((title: string, message?: string) => 
    addToast({ type: 'error', title, message }), [addToast])
  
  const warning = useCallback((title: string, message?: string) => 
    addToast({ type: 'warning', title, message }), [addToast])
  
  const info = useCallback((title: string, message?: string) => 
    addToast({ type: 'info', title, message }), [addToast])
  
  const loading = useCallback((title: string, message?: string) => 
    addToast({ type: 'loading', title, message, duration: 0 }), [addToast])

  // Promise helper
  const promiseToast = useCallback(async <T,>(
    promise: Promise<T>,
    options: {
      loading: string
      success: string | ((data: T) => string)
      error: string | ((err: Error) => string)
    }
  ): Promise<T> => {
    const id = loading(options.loading)

    try {
      const result = await promise
      updateToast(id, {
        type: 'success',
        title: typeof options.success === 'function' 
          ? options.success(result) 
          : options.success,
      })
      return result
    } catch (err) {
      updateToast(id, {
        type: 'error',
        title: typeof options.error === 'function'
          ? options.error(err as Error)
          : options.error,
        message: err instanceof Error ? err.message : undefined,
      })
      throw err
    }
  }, [loading, updateToast])

  return (
    <ToastContext.Provider
      value={{
        toasts,
        addToast,
        removeToast,
        updateToast,
        showToast,
        success,
        error,
        warning,
        info,
        loading,
        promise: promiseToast,
      }}
    >
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

// ============================================
// TOAST CONTAINER & INDIVIDUAL TOAST
// ============================================

function ToastContainer({ 
  toasts, 
  removeToast 
}: { 
  toasts: Toast[]
  removeToast: (id: string) => void 
}) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const icons = {
    success: <CheckCircle className="h-5 w-5 text-green-500" />,
    error: <AlertCircle className="h-5 w-5 text-red-500" />,
    warning: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
    info: <Info className="h-5 w-5 text-blue-500" />,
    loading: <Loader2 className="h-5 w-5 text-brand-500 animate-spin" />,
  }

  const backgrounds = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-yellow-50 border-yellow-200',
    info: 'bg-blue-50 border-blue-200',
    loading: 'bg-gray-50 border-gray-200',
  }

  return (
    <div
      className={`
        pointer-events-auto
        flex items-start gap-3 p-4 rounded-lg border shadow-lg
        animate-slide-in-right
        ${backgrounds[toast.type]}
      `}
      role="alert"
    >
      <div className="flex-shrink-0 mt-0.5">
        {icons[toast.type]}
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{toast.title}</p>
        {toast.message && (
          <p className="text-sm text-gray-600 mt-1">{toast.message}</p>
        )}
        {toast.action && (
          <button
            onClick={toast.action.onClick}
            className="mt-2 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      {toast.type !== 'loading' && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 p-1 rounded-full hover:bg-gray-200 transition-colors"
        >
          <X className="h-4 w-4 text-gray-400" />
        </button>
      )}
    </div>
  )
}

// ============================================
// CONFIRMATION DIALOG
// ============================================

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'default'
  loading?: boolean
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  loading = false,
}: ConfirmDialogProps) {
  if (!isOpen) return null

  const variantStyles = {
    danger: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    warning: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
    default: 'bg-brand-600 hover:bg-brand-700 focus:ring-brand-500',
  }

  const icons = {
    danger: <AlertCircle className="h-6 w-6 text-red-600" />,
    warning: <AlertTriangle className="h-6 w-6 text-yellow-600" />,
    default: <Info className="h-6 w-6 text-brand-600" />,
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full animate-scale-in">
        <div className="p-6">
          <div className="flex items-start space-x-4">
            <div className={`
              flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center
              ${variant === 'danger' ? 'bg-red-100' : 
                variant === 'warning' ? 'bg-yellow-100' : 'bg-brand-100'}
            `}>
              {icons[variant]}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              <p className="mt-2 text-sm text-gray-600">{message}</p>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`
              px-4 py-2 text-sm font-medium text-white rounded-lg
              focus:outline-none focus:ring-2 focus:ring-offset-2
              disabled:opacity-50 flex items-center gap-2
              ${variantStyles[variant]}
            `}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================
// PROGRESS INDICATOR
// ============================================

interface ProgressProps {
  current: number
  total: number
  label?: string
  showPercentage?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function Progress({ 
  current, 
  total, 
  label,
  showPercentage = true,
  size = 'md'
}: ProgressProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0
  
  const heights = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  }

  return (
    <div className="w-full">
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-1">
          {label && <span className="text-sm font-medium text-gray-700">{label}</span>}
          {showPercentage && (
            <span className="text-sm text-gray-500">{percentage}%</span>
          )}
        </div>
      )}
      <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${heights[size]}`}>
        <div
          className={`bg-brand-600 ${heights[size]} rounded-full transition-all duration-300 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {size !== 'sm' && (
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-500">{current} of {total}</span>
        </div>
      )}
    </div>
  )
}

// ============================================
// BULK OPERATION PROGRESS MODAL
// ============================================

interface BulkProgressModalProps {
  isOpen: boolean
  title: string
  current: number
  total: number
  status: 'running' | 'success' | 'error' | 'cancelled'
  errors?: string[]
  skipped?: number
  failed?: number
  onClose?: () => void
  onCancel?: () => void
}

export function BulkProgressModal({
  isOpen,
  title,
  current,
  total,
  status,
  errors = [],
  skipped = 0,
  failed = 0,
  onClose,
  onCancel,
}: BulkProgressModalProps) {
  if (!isOpen) return null

  // Build summary message
  const buildSummary = () => {
    const parts = []
    if (current > 0) parts.push(`${current} sent`)
    if (skipped > 0) parts.push(`${skipped} skipped`)
    if (failed > 0) parts.push(`${failed} failed`)
    return parts.join(', ') || 'Processing...'
  }

  const statusConfig = {
    running: {
      icon: <Loader2 className="h-8 w-8 text-brand-600 animate-spin" />,
      color: 'text-brand-600',
      message: `Processing... ${current + skipped + failed} of ${total}`,
    },
    success: {
      icon: <CheckCircle className="h-8 w-8 text-green-600" />,
      color: 'text-green-600',
      message: buildSummary(),
    },
    error: {
      icon: <AlertCircle className="h-8 w-8 text-amber-600" />,
      color: 'text-amber-600',
      message: buildSummary(),
    },
    cancelled: {
      icon: <AlertTriangle className="h-8 w-8 text-yellow-600" />,
      color: 'text-yellow-600',
      message: `Cancelled: ${buildSummary()}`,
    },
  }

  const config = statusConfig[status]

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      
      <div className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full">
        <div className="p-6">
          <div className="text-center">
            <div className="mb-4 flex justify-center">{config.icon}</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
            <p className={`text-sm ${config.color}`}>{config.message}</p>
          </div>

          {/* Progress bar */}
          <div className="mt-6">
            <Progress current={current + skipped + failed} total={total} />
          </div>

          {/* Stats breakdown */}
          {(status !== 'running' || current + skipped + failed > 0) && (
            <div className="mt-4 flex justify-center gap-6 text-sm">
              <div className="text-center">
                <span className="font-semibold text-green-600">{current}</span>
                <span className="text-gray-500 ml-1">sent</span>
              </div>
              {skipped > 0 && (
                <div className="text-center">
                  <span className="font-semibold text-yellow-600">{skipped}</span>
                  <span className="text-gray-500 ml-1">skipped</span>
                </div>
              )}
              {failed > 0 && (
                <div className="text-center">
                  <span className="font-semibold text-red-600">{failed}</span>
                  <span className="text-gray-500 ml-1">failed</span>
                </div>
              )}
            </div>
          )}

          {errors.length > 0 && (
            <div className="mt-4 max-h-32 overflow-y-auto bg-red-50 rounded-lg p-3">
              <p className="text-xs font-medium text-red-800 mb-1">Errors:</p>
              {errors.slice(0, 5).map((err, i) => (
                <p key={i} className="text-xs text-red-600">{err}</p>
              ))}
              {errors.length > 5 && (
                <p className="text-xs text-red-500 mt-1">...and {errors.length - 5} more</p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 rounded-b-xl">
          {status === 'running' && onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Stop Sending
            </button>
          )}
          {status !== 'running' && onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
