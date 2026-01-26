// ============================================
// LOGGER UTILITY
// Provides conditional logging based on environment
// ============================================

const isDevelopment = process.env.NODE_ENV === 'development'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface Logger {
  debug: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
  log: (...args: unknown[]) => void
}

/**
 * Creates a logger with a specific prefix
 * @param prefix - The prefix to add to all log messages (e.g., '[SEND-EMAIL]')
 */
export function createLogger(prefix: string): Logger {
  const formatArgs = (args: unknown[]): unknown[] => {
    if (prefix) {
      return [prefix, ...args]
    }
    return args
  }

  return {
    debug: (...args: unknown[]) => {
      if (isDevelopment) {
        console.log(...formatArgs(args))
      }
    },
    info: (...args: unknown[]) => {
      if (isDevelopment) {
        console.log(...formatArgs(args))
      }
    },
    warn: (...args: unknown[]) => {
      // Warnings always show
      console.warn(...formatArgs(args))
    },
    error: (...args: unknown[]) => {
      // Errors always show
      console.error(...formatArgs(args))
    },
    log: (...args: unknown[]) => {
      if (isDevelopment) {
        console.log(...formatArgs(args))
      }
    },
  }
}

// Default logger without prefix
export const logger: Logger = createLogger('')

// Named loggers for different modules
export const apiLogger = createLogger('[API]')
export const emailLogger = createLogger('[EMAIL]')
export const webhookLogger = createLogger('[WEBHOOK]')
