import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function getConfidenceColor(score: 'green' | 'yellow' | 'red'): string {
  switch (score) {
    case 'green':
      return 'bg-green-100 text-green-800'
    case 'yellow':
      return 'bg-yellow-100 text-yellow-800'
    case 'red':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

/**
 * Convert a numeric confidence value to the database enum value.
 * Accepts either percentage (0-100) or decimal (0-1) values.
 * @param confidence - Numeric confidence value (0-100 or 0-1)
 * @returns 'green' | 'yellow' | 'red'
 */
export function confidenceToEnum(confidence: number): 'green' | 'yellow' | 'red' {
  // Normalize to percentage if given as decimal
  const pct = confidence <= 1 ? confidence * 100 : confidence
  if (pct >= 80) return 'green'
  if (pct >= 50) return 'yellow'
  return 'red'
}

export function getConfidenceBadgeColor(score: 'green' | 'yellow' | 'red'): string {
  switch (score) {
    case 'green':
      return 'bg-green-500'
    case 'yellow':
      return 'bg-yellow-500'
    case 'red':
      return 'bg-red-500'
    default:
      return 'bg-gray-500'
  }
}

export function getConfidenceTextColor(score: 'green' | 'yellow' | 'red'): string {
  switch (score) {
    case 'green':
      return 'text-green-600'
    case 'yellow':
      return 'text-yellow-600'
    case 'red':
      return 'text-red-600'
    default:
      return 'text-gray-600'
  }
}

export function getStageLabel(stage: string): string {
  const labels: Record<string, string> = {
    drafted: 'Drafted',
    approved: 'Approved',
    sent: 'Sent',
    opened: 'Opened',
    replied: 'Replied',
    passed: 'Passed',
    meeting: 'Meeting',
    closed: 'Closed',
  }
  return labels[stage] || stage
}

export function getToneLabel(tone: string): string {
  const labels: Record<string, string> = {
    direct: 'Direct',
    warm: 'Warm',
    technical: 'Technical',
    visionary: 'Visionary',
  }
  return labels[tone] || tone
}
