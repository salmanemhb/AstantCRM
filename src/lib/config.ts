// ============================================
// APPLICATION CONFIGURATION
// Centralized config for settings that change
// ============================================

import { createLogger } from './logger'

const log = createLogger('[CONFIG]')

// ============================================
// EMAIL CONFIGURATION
// ============================================

/**
 * CC emails for all outgoing emails
 * These team members receive a copy of every sent email
 */
export const EMAIL_CONFIG = {
  // CC recipients - add/remove here instead of in code
  ccRecipients: [
    'salmane.mouhib@astantglobal.com',
    'jean.francois@astantglobal.com',
    'marcos.agustin@astantglobal.com',
    'salman@astantglobal.com',
    'miguel.eugene@astantglobal.com',
    'ana.birkenfeld@astantglobal.com',
  ],
  
  // From domain for sender verification
  fromDomain: 'astantglobal.com',
  
  // Default sender if none specified
  defaultSenderId: 'jean-francois',
  
  // Email banner settings
  banner: {
    enabled: true,
    imageUrl: 'https://res.cloudinary.com/dxjxfcrsr/image/upload/v1737655449/astant_banner_xzqdgh.png',
    linkUrl: 'https://astantglobal.com',
    alt: 'Astant Global Management',
    width: 600,
    height: 120,
  },
  
  // Rate limiting
  // Resend free tier: 2 requests/second
  // We use 700ms delay = ~1.4 emails/sec to stay safely under limit
  rateLimit: {
    batchSize: 1,           // Sequential sending (1 at a time)
    batchDelayMs: 700,      // 700ms = ~1.4 emails/sec (safely under 2/sec limit)
    maxRetries: 3,          // Retry count for failed sends
    retryDelayMs: 2000,     // Base delay before retry (exponential backoff)
  },
  
  // Tracking
  tracking: {
    openTracking: true,
    clickTracking: true,
  },
} as const

// ============================================
// API CONFIGURATION
// ============================================

export const API_CONFIG = {
  // Timeouts
  defaultTimeout: 30000,  // 30 seconds
  bulkOperationTimeout: 120000,  // 2 minutes for bulk ops
  
  // Pagination
  defaultPageSize: 50,
  maxPageSize: 200,
  
  // Generation
  generation: {
    batchSize: 5,         // Concurrent draft generations
    batchDelayMs: 500,    // Delay between batches
  },
} as const

// ============================================
// UI CONFIGURATION
// ============================================

export const UI_CONFIG = {
  // Modal sizes
  modals: {
    small: 'max-w-md',
    medium: 'max-w-2xl',
    large: 'max-w-4xl',
    xlarge: 'max-w-6xl',
    full: 'max-w-[95vw]',
  },
  
  // Toast/notification durations (ms)
  toasts: {
    success: 3000,
    error: 5000,
    warning: 4000,
    info: 3000,
  },
  
  // Animation durations (ms)
  animations: {
    fast: 150,
    normal: 300,
    slow: 500,
  },
  
  // Confirmation required for these actions
  confirmationRequired: [
    'delete_campaign',
    'delete_contact_list',
    'send_all_emails',
    'bulk_delete',
    'reset_campaign',
  ],
} as const

// ============================================
// VALIDATION CONFIGURATION
// ============================================

export const VALIDATION_CONFIG = {
  // Email validation
  email: {
    maxLength: 254,
    pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  },
  
  // Attachment limits
  attachments: {
    maxFileSize: 10 * 1024 * 1024,  // 10MB
    maxTotalSize: 25 * 1024 * 1024, // 25MB total per email
    maxCount: 10,
    allowedTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain',
      'text/csv',
    ],
  },
  
  // Subject line
  subject: {
    maxLength: 200,
    minLength: 3,
  },
  
  // Body
  body: {
    maxLength: 50000,  // 50KB
    minLength: 10,
  },
} as const

// ============================================
// PIPELINE CONFIGURATION
// ============================================

export const PIPELINE_CONFIG = {
  stages: [
    { id: 'sent', label: 'Sent', color: 'gray', order: 1 },
    { id: 'opened', label: 'Opened', color: 'blue', order: 2 },
    { id: 'replied', label: 'Replied', color: 'green', order: 3 },
    { id: 'interested', label: 'Interested', color: 'purple', order: 4 },
    { id: 'meeting', label: 'Meeting', color: 'orange', order: 5 },
    { id: 'closed', label: 'Closed', color: 'emerald', order: 6 },
    { id: 'not_interested', label: 'Passed', color: 'red', order: 7 },
  ],
  
  // Auto-advance rules
  autoAdvance: {
    // When email is opened, auto-advance to 'opened' stage
    onOpen: 'opened',
    // When email is clicked, auto-advance to 'opened' (click implies open)
    onClick: 'opened',
    // When reply detected, auto-advance to 'replied'
    onReply: 'replied',
  },
} as const

// ============================================
// LOGGING CONFIGURATION
// ============================================

export const LOG_CONFIG = {
  // Log levels by environment
  levels: {
    development: ['debug', 'info', 'warn', 'error'],
    production: ['warn', 'error'],
    test: ['error'],
  },
  
  // Modules to log (set to false to disable)
  modules: {
    api: true,
    email: true,
    webhook: true,
    auth: true,
    database: true,
    ui: true,
  },
} as const

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get the current environment
 */
export function getEnvironment(): 'development' | 'production' | 'test' {
  return (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development'
}

/**
 * Check if we're in development mode
 */
export function isDevelopment(): boolean {
  return getEnvironment() === 'development'
}

/**
 * Check if we're in production mode
 */
export function isProduction(): boolean {
  return getEnvironment() === 'production'
}

/**
 * Get CC emails for sending
 * Can be overridden by environment variable
 */
export function getCCEmails(): string[] {
  const envCC = process.env.EMAIL_CC_RECIPIENTS
  if (envCC) {
    log.info('Using CC recipients from environment variable')
    return envCC.split(',').map(e => e.trim()).filter(Boolean)
  }
  return [...EMAIL_CONFIG.ccRecipients]
}

/**
 * Log configuration on startup (only in development)
 */
export function logConfig(): void {
  if (isDevelopment()) {
    log.info('Configuration loaded:')
    log.info('- CC Recipients:', EMAIL_CONFIG.ccRecipients.length)
    log.info('- Rate Limit Batch Size:', EMAIL_CONFIG.rateLimit.batchSize)
    log.info('- Environment:', getEnvironment())
  }
}
