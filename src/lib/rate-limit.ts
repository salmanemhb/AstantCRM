/**
 * Rate Limiting Middleware
 * Simple in-memory rate limiter for API routes
 * For production, consider using Redis or Upstash
 */

import { NextRequest, NextResponse } from 'next/server'
import { API_CONFIG } from './config'

// ============================================
// IN-MEMORY RATE LIMITER
// Simple implementation - resets on server restart
// ============================================

interface RateLimitEntry {
  count: number
  resetAt: number
}

// In-memory store (per-server instance)
const rateLimitStore = new Map<string, RateLimitEntry>()

// Cleanup old entries periodically
const CLEANUP_INTERVAL = 60 * 1000 // 1 minute
let lastCleanup = Date.now()

function cleanupOldEntries() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  
  lastCleanup = now
  const entries = Array.from(rateLimitStore.entries())
  for (const [key, entry] of entries) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key)
    }
  }
}

// ============================================
// RATE LIMIT CONFIGURATION
// ============================================

export interface RateLimitConfig {
  windowMs: number      // Time window in milliseconds
  maxRequests: number   // Max requests per window
  keyGenerator?: (req: NextRequest) => string  // Custom key generator
  skipFailedRequests?: boolean  // Don't count failed requests
  message?: string      // Custom error message
}

// Default configs for different routes
export const RATE_LIMIT_CONFIGS = {
  // Email sending - strict limit
  sendEmail: {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 10,      // 10 emails per minute
    message: 'Too many emails sent. Please wait before sending more.',
  },
  
  // AI generation - moderate limit
  generateEmail: {
    windowMs: 60 * 1000,
    maxRequests: 30,
    message: 'Too many generation requests. Please slow down.',
  },
  
  // Bulk operations - strict limit
  bulkOperations: {
    windowMs: 60 * 1000,
    maxRequests: 5,
    message: 'Too many bulk operations. Please wait.',
  },
  
  // General API - relaxed limit
  general: {
    windowMs: 60 * 1000,
    maxRequests: 100,
    message: 'Too many requests. Please slow down.',
  },
}

// ============================================
// RATE LIMIT CHECKER
// ============================================

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetIn: number  // milliseconds until reset
  limit: number
}

/**
 * Check if request is within rate limit
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanupOldEntries()
  
  const now = Date.now()
  const entry = rateLimitStore.get(key)
  
  if (!entry || entry.resetAt < now) {
    // Create new entry
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    })
    
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetIn: config.windowMs,
      limit: config.maxRequests,
    }
  }
  
  // Entry exists and is still valid
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: entry.resetAt - now,
      limit: config.maxRequests,
    }
  }
  
  // Increment count
  entry.count++
  
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetIn: entry.resetAt - now,
    limit: config.maxRequests,
  }
}

/**
 * Decrement rate limit count (for failed requests when skipFailedRequests=true)
 */
export function decrementRateLimit(key: string): void {
  const entry = rateLimitStore.get(key)
  if (entry && entry.count > 0) {
    entry.count--
  }
}

// ============================================
// RATE LIMIT MIDDLEWARE
// ============================================

/**
 * Create rate limit middleware for API routes
 */
export function createRateLimiter(config: RateLimitConfig = RATE_LIMIT_CONFIGS.general) {
  return function rateLimitMiddleware(
    handler: (req: NextRequest) => Promise<NextResponse>
  ) {
    return async function (req: NextRequest): Promise<NextResponse> {
      // Generate rate limit key
      const keyGenerator = config.keyGenerator || defaultKeyGenerator
      const key = keyGenerator(req)
      
      // Check rate limit
      const result = checkRateLimit(key, config)
      
      if (!result.allowed) {
        return NextResponse.json(
          {
            error: config.message || 'Too many requests',
            retryAfter: Math.ceil(result.resetIn / 1000),
          },
          {
            status: 429,
            headers: {
              'X-RateLimit-Limit': String(result.limit),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(Math.ceil(result.resetIn / 1000)),
              'Retry-After': String(Math.ceil(result.resetIn / 1000)),
            },
          }
        )
      }
      
      // Execute handler
      const response = await handler(req)
      
      // If failed and skipFailedRequests, decrement count
      if (config.skipFailedRequests && response.status >= 400) {
        decrementRateLimit(key)
      }
      
      // Add rate limit headers
      const headers = new Headers(response.headers)
      headers.set('X-RateLimit-Limit', String(result.limit))
      headers.set('X-RateLimit-Remaining', String(result.remaining))
      headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetIn / 1000)))
      
      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      })
    }
  }
}

/**
 * Default key generator - uses IP address
 */
function defaultKeyGenerator(req: NextRequest): string {
  // Try to get real IP from headers (for proxied requests)
  const forwarded = req.headers.get('x-forwarded-for')
  const realIp = req.headers.get('x-real-ip')
  const ip = forwarded?.split(',')[0] || realIp || 'unknown'
  
  // Include route path for route-specific limiting
  const path = new URL(req.url).pathname
  
  return `ratelimit:${ip}:${path}`
}

/**
 * Key generator that includes user ID (for authenticated routes)
 */
export function userKeyGenerator(userId: string) {
  return (req: NextRequest): string => {
    const path = new URL(req.url).pathname
    return `ratelimit:user:${userId}:${path}`
  }
}

/**
 * Key generator for campaign-specific limiting
 */
export function campaignKeyGenerator(req: NextRequest): string {
  const body = req.clone().json().then(b => b.campaign_id).catch(() => 'unknown')
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  return `ratelimit:campaign:${ip}`
}

// ============================================
// HELPER: Apply Rate Limit to Response
// ============================================

/**
 * Helper to manually check rate limit in API route handlers
 * Use when you need more control than the middleware provides
 */
export function withRateLimit(
  req: NextRequest,
  config: RateLimitConfig = RATE_LIMIT_CONFIGS.general
): { allowed: boolean; response?: NextResponse; remaining: number } {
  const key = (config.keyGenerator || defaultKeyGenerator)(req)
  const result = checkRateLimit(key, config)
  
  if (!result.allowed) {
    return {
      allowed: false,
      remaining: 0,
      response: NextResponse.json(
        {
          error: config.message || 'Too many requests',
          retryAfter: Math.ceil(result.resetIn / 1000),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(result.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(result.resetIn / 1000)),
            'Retry-After': String(Math.ceil(result.resetIn / 1000)),
          },
        }
      ),
    }
  }
  
  return {
    allowed: true,
    remaining: result.remaining,
  }
}
