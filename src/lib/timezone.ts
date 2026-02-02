/**
 * Timezone Handling Utilities
 * Handles timezone detection, conversion, and time-based greeting logic
 */

// ============================================
// TIMEZONE DATA
// ============================================

/**
 * Common timezone mappings by country/region
 * Used for guessing timezone from location data
 */
export const TIMEZONE_MAPPINGS: Record<string, string> = {
  // US States
  'california': 'America/Los_Angeles',
  'ca': 'America/Los_Angeles',
  'oregon': 'America/Los_Angeles',
  'washington': 'America/Los_Angeles',
  'nevada': 'America/Los_Angeles',
  'arizona': 'America/Phoenix',
  'colorado': 'America/Denver',
  'utah': 'America/Denver',
  'montana': 'America/Denver',
  'new mexico': 'America/Denver',
  'texas': 'America/Chicago',
  'illinois': 'America/Chicago',
  'minnesota': 'America/Chicago',
  'wisconsin': 'America/Chicago',
  'missouri': 'America/Chicago',
  'new york': 'America/New_York',
  'ny': 'America/New_York',
  'massachusetts': 'America/New_York',
  'florida': 'America/New_York',
  'georgia': 'America/New_York',
  'north carolina': 'America/New_York',
  'pennsylvania': 'America/New_York',
  'virginia': 'America/New_York',
  'dc': 'America/New_York',
  'washington dc': 'America/New_York',
  'hawaii': 'Pacific/Honolulu',
  'alaska': 'America/Anchorage',
  
  // US Cities
  'san francisco': 'America/Los_Angeles',
  'sf': 'America/Los_Angeles',
  'los angeles': 'America/Los_Angeles',
  'la': 'America/Los_Angeles',
  'seattle': 'America/Los_Angeles',
  'portland': 'America/Los_Angeles',
  'denver': 'America/Denver',
  'chicago': 'America/Chicago',
  'austin': 'America/Chicago',
  'dallas': 'America/Chicago',
  'houston': 'America/Chicago',
  'new york city': 'America/New_York',
  'nyc': 'America/New_York',
  'boston': 'America/New_York',
  'miami': 'America/New_York',
  'atlanta': 'America/New_York',
  
  // Countries
  'uk': 'Europe/London',
  'united kingdom': 'Europe/London',
  'london': 'Europe/London',
  'england': 'Europe/London',
  'france': 'Europe/Paris',
  'paris': 'Europe/Paris',
  'germany': 'Europe/Berlin',
  'berlin': 'Europe/Berlin',
  'switzerland': 'Europe/Zurich',
  'zurich': 'Europe/Zurich',
  'israel': 'Asia/Jerusalem',
  'tel aviv': 'Asia/Jerusalem',
  'singapore': 'Asia/Singapore',
  'hong kong': 'Asia/Hong_Kong',
  'japan': 'Asia/Tokyo',
  'tokyo': 'Asia/Tokyo',
  'australia': 'Australia/Sydney',
  'sydney': 'Australia/Sydney',
  'india': 'Asia/Kolkata',
  'mumbai': 'Asia/Kolkata',
  'dubai': 'Asia/Dubai',
  'uae': 'Asia/Dubai',
}

// ============================================
// TIMEZONE DETECTION
// ============================================

/**
 * Guess timezone from location string
 */
export function guessTimezoneFromLocation(location: string | undefined | null): string | null {
  if (!location) return null
  
  const normalized = location.toLowerCase().trim()
  
  // Direct match
  if (TIMEZONE_MAPPINGS[normalized]) {
    return TIMEZONE_MAPPINGS[normalized]
  }
  
  // Partial match
  for (const [key, tz] of Object.entries(TIMEZONE_MAPPINGS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return tz
    }
  }
  
  return null
}

/**
 * Get timezone offset in hours from UTC
 */
export function getTimezoneOffset(timezone: string, date: Date = new Date()): number {
  try {
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }))
    const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }))
    return (tzDate.getTime() - utcDate.getTime()) / (1000 * 60 * 60)
  } catch {
    return 0
  }
}

/**
 * Get current time in a specific timezone
 */
export function getCurrentTimeInTimezone(timezone: string): Date {
  const now = new Date()
  const options: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }
  
  const formatter = new Intl.DateTimeFormat('en-US', options)
  const parts = formatter.formatToParts(now)
  
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0'
  
  return new Date(
    parseInt(getPart('year')),
    parseInt(getPart('month')) - 1,
    parseInt(getPart('day')),
    parseInt(getPart('hour')),
    parseInt(getPart('minute')),
    parseInt(getPart('second'))
  )
}

/**
 * Get hour of day in a specific timezone (0-23)
 */
export function getHourInTimezone(timezone: string, date: Date = new Date()): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    })
    return parseInt(formatter.format(date), 10)
  } catch {
    return date.getUTCHours()
  }
}

// ============================================
// TIME-BASED GREETINGS
// ============================================

export type GreetingType = 'morning' | 'afternoon' | 'evening'

export interface GreetingConfig {
  morningStart: number  // Hour to start saying "Good morning" (default: 5)
  morningEnd: number    // Hour to stop saying "Good morning" (default: 12)
  afternoonEnd: number  // Hour to stop saying "Good afternoon" (default: 17)
}

const DEFAULT_GREETING_CONFIG: GreetingConfig = {
  morningStart: 5,
  morningEnd: 12,
  afternoonEnd: 17,
}

/**
 * Get appropriate greeting type based on hour
 */
export function getGreetingType(
  hour: number,
  config: GreetingConfig = DEFAULT_GREETING_CONFIG
): GreetingType {
  if (hour >= config.morningStart && hour < config.morningEnd) {
    return 'morning'
  } else if (hour >= config.morningEnd && hour < config.afternoonEnd) {
    return 'afternoon'
  } else {
    return 'evening'
  }
}

/**
 * Get greeting string based on timezone
 */
export function getGreeting(
  timezone: string = 'America/New_York',
  date: Date = new Date(),
  config: GreetingConfig = DEFAULT_GREETING_CONFIG
): string {
  const hour = getHourInTimezone(timezone, date)
  const type = getGreetingType(hour, config)
  
  switch (type) {
    case 'morning':
      return 'Good morning'
    case 'afternoon':
      return 'Good afternoon'
    case 'evening':
      return 'Good evening'
  }
}

/**
 * Get personalized greeting with name
 */
export function getPersonalizedGreeting(
  firstName: string | undefined | null,
  timezone: string = 'America/New_York',
  date: Date = new Date()
): string {
  const greeting = getGreeting(timezone, date)
  
  if (firstName && firstName.trim()) {
    return `${greeting} ${firstName.trim()}`
  }
  
  return greeting
}

// ============================================
// SCHEDULED SEND HELPERS
// ============================================

export interface OptimalSendTime {
  timezone: string
  localTime: string  // HH:MM format
  utcTime: Date
  reason: string
}

/**
 * Get optimal send time for a recipient
 * Business hours: 9 AM - 5 PM in recipient's timezone
 * Best times: 9-10 AM, 2-3 PM
 */
export function getOptimalSendTime(
  recipientTimezone: string = 'America/New_York',
  preferredSlot: 'morning' | 'afternoon' = 'morning'
): OptimalSendTime {
  const now = new Date()
  const currentHour = getHourInTimezone(recipientTimezone, now)
  
  // Target hours
  const morningTarget = 9  // 9 AM
  const afternoonTarget = 14  // 2 PM
  
  let targetHour = preferredSlot === 'morning' ? morningTarget : afternoonTarget
  let targetDate = new Date(now)
  
  // If current time is past target, schedule for tomorrow
  if (currentHour >= targetHour) {
    targetDate.setDate(targetDate.getDate() + 1)
  }
  
  // Skip weekends
  const dayOfWeek = targetDate.getDay()
  if (dayOfWeek === 0) {
    targetDate.setDate(targetDate.getDate() + 1) // Sunday -> Monday
  } else if (dayOfWeek === 6) {
    targetDate.setDate(targetDate.getDate() + 2) // Saturday -> Monday
  }
  
  // Calculate UTC time for the target local time
  const offset = getTimezoneOffset(recipientTimezone, targetDate)
  const utcHour = targetHour - offset
  
  const utcTime = new Date(targetDate)
  utcTime.setUTCHours(Math.floor(utcHour), (utcHour % 1) * 60, 0, 0)
  
  return {
    timezone: recipientTimezone,
    localTime: `${String(targetHour).padStart(2, '0')}:00`,
    utcTime,
    reason: `${preferredSlot === 'morning' ? 'Morning' : 'Afternoon'} slot in recipient's timezone`,
  }
}

/**
 * Check if current time is within business hours
 */
export function isBusinessHours(
  timezone: string = 'America/New_York',
  date: Date = new Date()
): boolean {
  const hour = getHourInTimezone(timezone, date)
  const dayOfWeek = new Date(date.toLocaleString('en-US', { timeZone: timezone })).getDay()
  
  // Weekend check
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false
  }
  
  // Business hours: 9 AM - 5 PM
  return hour >= 9 && hour < 17
}

// ============================================
// FORMATTING HELPERS
// ============================================

/**
 * Format date in recipient's timezone
 */
export function formatDateInTimezone(
  date: Date,
  timezone: string = 'America/New_York',
  options: Intl.DateTimeFormatOptions = {}
): string {
  return date.toLocaleString('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...options,
  })
}

/**
 * Get timezone abbreviation (EST, PST, etc.)
 */
export function getTimezoneAbbr(timezone: string, date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    })
    const parts = formatter.formatToParts(date)
    return parts.find(p => p.type === 'timeZoneName')?.value || timezone
  } catch {
    return timezone
  }
}

/**
 * List of common US timezones
 */
export const US_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Phoenix', label: 'Arizona (no DST)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
]

/**
 * List of common international timezones
 */
export const INTL_TIMEZONES = [
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Asia/Jerusalem', label: 'Israel (IST/IDT)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
]
