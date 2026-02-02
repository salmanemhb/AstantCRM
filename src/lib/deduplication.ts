/**
 * Contact Deduplication System
 * Handles duplicate detection and merging for contacts
 */

import { createClient } from './supabase/server'
import { createLogger } from './logger'

const logger = createLogger('deduplication')

// ============================================
// TYPES
// ============================================

export interface Contact {
  id: string
  email: string
  first_name?: string
  last_name?: string
  firm_name?: string
  title?: string
  phone?: string
  linkedin_url?: string
  website?: string
  notes?: string
  created_at?: string
  updated_at?: string
  [key: string]: unknown
}

export interface DuplicateGroup {
  primary: Contact
  duplicates: Contact[]
  matchType: 'email' | 'name_firm' | 'linkedin'
  confidence: number // 0-100
}

export interface DeduplicationResult {
  processed: number
  duplicatesFound: number
  groups: DuplicateGroup[]
}

export interface MergeResult {
  success: boolean
  mergedContact?: Contact
  removedIds?: string[]
  error?: string
}

// ============================================
// DUPLICATE DETECTION
// ============================================

/**
 * Normalize email for comparison
 */
export function normalizeEmail(email: string): string {
  if (!email) return ''
  
  // Lowercase and trim
  let normalized = email.toLowerCase().trim()
  
  // Handle Gmail's dot-insensitivity (optional - can be aggressive)
  // if (normalized.includes('@gmail.com')) {
  //   const [local, domain] = normalized.split('@')
  //   normalized = local.replace(/\./g, '') + '@' + domain
  // }
  
  // Remove plus addressing (user+tag@domain.com -> user@domain.com)
  const plusIndex = normalized.indexOf('+')
  if (plusIndex > 0 && normalized.indexOf('@') > plusIndex) {
    normalized = normalized.substring(0, plusIndex) + normalized.substring(normalized.indexOf('@'))
  }
  
  return normalized
}

/**
 * Normalize name for comparison
 */
export function normalizeName(name: string | undefined | null): string {
  if (!name) return ''
  return name.toLowerCase().trim().replace(/\s+/g, ' ')
}

/**
 * Normalize firm name for comparison
 */
export function normalizeFirmName(firm: string | undefined | null): string {
  if (!firm) return ''
  
  return firm
    .toLowerCase()
    .trim()
    // Remove common suffixes
    .replace(/\b(llc|inc|corp|corporation|ltd|limited|lp|llp|partners|ventures|capital|management)\b\.?/gi, '')
    // Remove special characters
    .replace(/[^\w\s]/g, '')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Calculate similarity score between two strings (0-100)
 */
export function stringSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0
  if (str1 === str2) return 100
  
  const s1 = str1.toLowerCase()
  const s2 = str2.toLowerCase()
  
  // Levenshtein distance-based similarity
  const maxLen = Math.max(s1.length, s2.length)
  if (maxLen === 0) return 100
  
  const distance = levenshteinDistance(s1, s2)
  return Math.round((1 - distance / maxLen) * 100)
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length
  const n = str2.length
  
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))
  
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
      }
    }
  }
  
  return dp[m][n]
}

/**
 * Find duplicate contacts in a list
 */
export function findDuplicates(
  contacts: Contact[],
  options: {
    checkEmail?: boolean
    checkNameFirm?: boolean
    checkLinkedIn?: boolean
    minConfidence?: number
  } = {}
): DuplicateGroup[] {
  const {
    checkEmail = true,
    checkNameFirm = true,
    checkLinkedIn = true,
    minConfidence = 80,
  } = options
  
  const groups: DuplicateGroup[] = []
  const processed = new Set<string>()
  
  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i]
    if (processed.has(contact.id)) continue
    
    const duplicates: Contact[] = []
    let bestMatchType: 'email' | 'name_firm' | 'linkedin' = 'email'
    let highestConfidence = 0
    
    for (let j = i + 1; j < contacts.length; j++) {
      const other = contacts[j]
      if (processed.has(other.id)) continue
      
      let matchType: 'email' | 'name_firm' | 'linkedin' | null = null
      let confidence = 0
      
      // Check email match
      if (checkEmail && contact.email && other.email) {
        const normalized1 = normalizeEmail(contact.email)
        const normalized2 = normalizeEmail(other.email)
        if (normalized1 === normalized2) {
          matchType = 'email'
          confidence = 100
        }
      }
      
      // Check name + firm match
      if (!matchType && checkNameFirm) {
        const fullName1 = `${normalizeName(contact.first_name)} ${normalizeName(contact.last_name)}`
        const fullName2 = `${normalizeName(other.first_name)} ${normalizeName(other.last_name)}`
        const firm1 = normalizeFirmName(contact.firm_name)
        const firm2 = normalizeFirmName(other.firm_name)
        
        if (fullName1.trim() && fullName2.trim() && firm1 && firm2) {
          const nameSimilarity = stringSimilarity(fullName1, fullName2)
          const firmSimilarity = stringSimilarity(firm1, firm2)
          
          // Both name and firm must be similar
          if (nameSimilarity >= 85 && firmSimilarity >= 85) {
            matchType = 'name_firm'
            confidence = Math.round((nameSimilarity + firmSimilarity) / 2)
          }
        }
      }
      
      // Check LinkedIn match
      if (!matchType && checkLinkedIn && contact.linkedin_url && other.linkedin_url) {
        const url1 = contact.linkedin_url.toLowerCase().replace(/\/$/, '')
        const url2 = other.linkedin_url.toLowerCase().replace(/\/$/, '')
        if (url1 === url2) {
          matchType = 'linkedin'
          confidence = 100
        }
      }
      
      // Add to duplicates if match found
      if (matchType && confidence >= minConfidence) {
        duplicates.push(other)
        processed.add(other.id)
        
        if (confidence > highestConfidence) {
          highestConfidence = confidence
          bestMatchType = matchType
        }
      }
    }
    
    // Create group if duplicates found
    if (duplicates.length > 0) {
      groups.push({
        primary: contact,
        duplicates,
        matchType: bestMatchType,
        confidence: highestConfidence,
      })
      processed.add(contact.id)
    }
  }
  
  return groups
}

/**
 * Find duplicates in database
 */
export async function findDatabaseDuplicates(options?: {
  limit?: number
}): Promise<DeduplicationResult> {
  const supabase = createClient()
  const limit = options?.limit || 1000
  
  logger.info('Finding database duplicates', { limit })
  
  const { data: contacts, error } = await supabase
    .from('contacts')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(limit)
  
  if (error) {
    logger.error('Failed to fetch contacts', { error })
    throw new Error(`Failed to fetch contacts: ${error.message}`)
  }
  
  const groups = findDuplicates(contacts as Contact[])
  
  logger.info('Duplicate detection complete', {
    processed: contacts.length,
    groupsFound: groups.length,
    totalDuplicates: groups.reduce((sum, g) => sum + g.duplicates.length, 0),
  })
  
  return {
    processed: contacts.length,
    duplicatesFound: groups.reduce((sum, g) => sum + g.duplicates.length, 0),
    groups,
  }
}

// ============================================
// DUPLICATE MERGING
// ============================================

/**
 * Merge duplicate contacts into one
 * Strategy: Keep most complete data, prefer newer updates
 */
export function mergeContacts(primary: Contact, duplicates: Contact[]): Contact {
  const allContacts = [primary, ...duplicates]
  
  // Sort by updated_at descending (newest first)
  allContacts.sort((a, b) => {
    const dateA = new Date(a.updated_at || a.created_at || 0)
    const dateB = new Date(b.updated_at || b.created_at || 0)
    return dateB.getTime() - dateA.getTime()
  })
  
  const merged: Contact = { id: primary.id, email: primary.email }
  
  // Fields to merge (prefer non-empty, newer values)
  const mergeFields = [
    'first_name', 'last_name', 'firm_name', 'title', 
    'phone', 'linkedin_url', 'website', 'notes'
  ]
  
  for (const field of mergeFields) {
    for (const contact of allContacts) {
      const value = contact[field]
      if (value && typeof value === 'string' && value.trim()) {
        merged[field] = value
        break
      }
    }
  }
  
  // Merge notes by combining unique content
  const allNotes = allContacts
    .map(c => c.notes)
    .filter(Boolean)
    .map(n => (n as string).trim())
    .filter((n, i, arr) => arr.indexOf(n) === i) // Unique
  
  if (allNotes.length > 1) {
    merged.notes = allNotes.join('\n\n---\n\n')
  }
  
  return merged
}

/**
 * Merge duplicate contacts in database
 */
export async function mergeDuplicatesInDatabase(
  primaryId: string,
  duplicateIds: string[]
): Promise<MergeResult> {
  const supabase = createClient()
  
  logger.info('Merging duplicates', { primaryId, duplicateIds })
  
  try {
    // Fetch all contacts
    const { data: contacts, error: fetchError } = await supabase
      .from('contacts')
      .select('*')
      .in('id', [primaryId, ...duplicateIds])
    
    if (fetchError) {
      throw new Error(`Failed to fetch contacts: ${fetchError.message}`)
    }
    
    const primary = contacts?.find(c => c.id === primaryId)
    const duplicates = contacts?.filter(c => duplicateIds.includes(c.id)) || []
    
    if (!primary) {
      throw new Error('Primary contact not found')
    }
    
    // Merge data
    const merged = mergeContacts(primary as Contact, duplicates as Contact[])
    
    // Update primary with merged data
    const { error: updateError } = await supabase
      .from('contacts')
      .update({
        first_name: merged.first_name,
        last_name: merged.last_name,
        firm_name: merged.firm_name,
        title: merged.title,
        phone: merged.phone,
        linkedin_url: merged.linkedin_url,
        website: merged.website,
        notes: merged.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', primaryId)
    
    if (updateError) {
      throw new Error(`Failed to update primary contact: ${updateError.message}`)
    }
    
    // Re-associate emails from duplicates to primary
    const { error: emailsError } = await supabase
      .from('emails')
      .update({ contact_id: primaryId })
      .in('contact_id', duplicateIds)
    
    if (emailsError) {
      logger.warn('Failed to re-associate emails', { error: emailsError })
    }
    
    // Delete duplicates
    const { error: deleteError } = await supabase
      .from('contacts')
      .delete()
      .in('id', duplicateIds)
    
    if (deleteError) {
      throw new Error(`Failed to delete duplicates: ${deleteError.message}`)
    }
    
    logger.info('Merge successful', { primaryId, mergedCount: duplicateIds.length })
    
    return {
      success: true,
      mergedContact: merged,
      removedIds: duplicateIds,
    }
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Merge failed', { error: message })
    return { success: false, error: message }
  }
}

// ============================================
// IMPORT DEDUPLICATION
// ============================================

/**
 * Check which contacts already exist before import
 */
export async function checkDuplicatesBeforeImport(
  newContacts: Array<{ email: string; first_name?: string; last_name?: string; firm_name?: string }>
): Promise<{
  unique: typeof newContacts
  duplicates: Array<{ contact: typeof newContacts[0]; existingId: string }>
}> {
  const supabase = createClient()
  
  const emails = newContacts.map(c => normalizeEmail(c.email)).filter(Boolean)
  
  if (emails.length === 0) {
    return { unique: newContacts, duplicates: [] }
  }
  
  // Fetch existing contacts with matching emails
  const { data: existing, error } = await supabase
    .from('contacts')
    .select('id, email')
    .in('email', emails)
  
  if (error) {
    logger.warn('Failed to check existing contacts', { error })
    // Fail open - allow import
    return { unique: newContacts, duplicates: [] }
  }
  
  const existingMap = new Map(
    (existing || []).map(c => [normalizeEmail(c.email), c.id])
  )
  
  const unique: typeof newContacts = []
  const duplicates: Array<{ contact: typeof newContacts[0]; existingId: string }> = []
  
  for (const contact of newContacts) {
    const normalizedEmail = normalizeEmail(contact.email)
    const existingId = existingMap.get(normalizedEmail)
    
    if (existingId) {
      duplicates.push({ contact, existingId })
    } else {
      unique.push(contact)
    }
  }
  
  logger.info('Import duplicate check complete', {
    total: newContacts.length,
    unique: unique.length,
    duplicates: duplicates.length,
  })
  
  return { unique, duplicates }
}

/**
 * Import contacts with deduplication
 */
export async function importContactsWithDeduplication(
  contacts: Array<{ email: string; [key: string]: unknown }>,
  options: {
    skipDuplicates?: boolean  // Skip duplicates entirely
    updateDuplicates?: boolean // Update existing with new data
    campaignId?: string
  } = {}
): Promise<{
  imported: number
  skipped: number
  updated: number
  errors: string[]
}> {
  const supabase = createClient()
  const { skipDuplicates = true, updateDuplicates = false, campaignId } = options
  
  logger.info('Importing contacts with deduplication', {
    total: contacts.length,
    skipDuplicates,
    updateDuplicates,
  })
  
  const result = {
    imported: 0,
    skipped: 0,
    updated: 0,
    errors: [] as string[],
  }
  
  const { unique, duplicates } = await checkDuplicatesBeforeImport(
    contacts.map(c => ({
      email: c.email as string,
      first_name: c.first_name as string | undefined,
      last_name: c.last_name as string | undefined,
      firm_name: c.firm_name as string | undefined,
    }))
  )
  
  // Import unique contacts
  if (unique.length > 0) {
    const toImport = contacts.filter(c => 
      unique.some(u => normalizeEmail(u.email) === normalizeEmail(c.email))
    )
    
    const { data, error } = await supabase
      .from('contacts')
      .insert(toImport.map(c => ({
        ...c,
        campaign_id: campaignId,
      })))
      .select('id')
    
    if (error) {
      result.errors.push(`Import error: ${error.message}`)
    } else {
      result.imported = data?.length || 0
    }
  }
  
  // Handle duplicates
  if (skipDuplicates) {
    result.skipped = duplicates.length
  } else if (updateDuplicates) {
    // Update existing contacts with new data
    for (const { contact, existingId } of duplicates) {
      const original = contacts.find(c => normalizeEmail(c.email) === normalizeEmail(contact.email))
      if (!original) continue
      
      const { error } = await supabase
        .from('contacts')
        .update({
          first_name: original.first_name,
          last_name: original.last_name,
          firm_name: original.firm_name,
          title: original.title,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingId)
      
      if (error) {
        result.errors.push(`Update error for ${contact.email}: ${error.message}`)
      } else {
        result.updated++
      }
    }
  }
  
  logger.info('Import complete', result)
  
  return result
}
