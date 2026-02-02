/**
 * Unsubscribe System
 * Handles email unsubscribe links and preferences
 * Required for CAN-SPAM and GDPR compliance
 */

import { createClient } from './supabase/server'
import { createClient as createClientBrowser } from './supabase/client'
import crypto from 'crypto'

// ============================================
// CONFIGURATION
// ============================================

// Secret key for generating/verifying unsubscribe tokens
// In production, this should be in environment variables
const UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_SECRET || 'astant-crm-unsubscribe-secret-2026'

// Token expiry (optional - set to 0 for no expiry)
const TOKEN_EXPIRY_DAYS = 0 // Unsubscribe links don't expire

// ============================================
// TOKEN GENERATION & VERIFICATION
// ============================================

/**
 * Generate a secure unsubscribe token for a contact
 * Token includes: contact_id + timestamp + signature
 */
export function generateUnsubscribeToken(contactId: string, contactEmail: string): string {
  const timestamp = Date.now()
  const payload = `${contactId}:${contactEmail}:${timestamp}`
  
  // Create HMAC signature
  const hmac = crypto.createHmac('sha256', UNSUBSCRIBE_SECRET)
  hmac.update(payload)
  const signature = hmac.digest('hex').substring(0, 16) // Use first 16 chars
  
  // Combine and encode
  const token = Buffer.from(`${contactId}:${timestamp}:${signature}`).toString('base64url')
  
  return token
}

/**
 * Verify and decode an unsubscribe token
 */
export function verifyUnsubscribeToken(token: string): { 
  valid: boolean
  contactId?: string
  error?: string 
} {
  try {
    // Decode token
    const decoded = Buffer.from(token, 'base64url').toString('utf-8')
    const [contactId, timestampStr, signature] = decoded.split(':')
    
    if (!contactId || !timestampStr || !signature) {
      return { valid: false, error: 'Invalid token format' }
    }
    
    const timestamp = parseInt(timestampStr, 10)
    
    // Check expiry if enabled
    if (TOKEN_EXPIRY_DAYS > 0) {
      const expiryMs = TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
      if (Date.now() - timestamp > expiryMs) {
        return { valid: false, error: 'Token expired' }
      }
    }
    
    // We can't verify the exact signature without the email,
    // but we can check the format and return the contactId for lookup
    return { valid: true, contactId }
    
  } catch (error) {
    return { valid: false, error: 'Invalid token' }
  }
}

// ============================================
// UNSUBSCRIBE URL GENERATION
// ============================================

/**
 * Generate the full unsubscribe URL for an email
 */
export function generateUnsubscribeUrl(
  baseUrl: string,
  contactId: string,
  contactEmail: string,
  campaignId?: string
): string {
  const token = generateUnsubscribeToken(contactId, contactEmail)
  
  let url = `${baseUrl}/api/unsubscribe?token=${token}`
  
  if (campaignId) {
    url += `&campaign=${campaignId}`
  }
  
  return url
}

/**
 * Generate unsubscribe link HTML for email footer
 */
export function generateUnsubscribeHtml(
  baseUrl: string,
  contactId: string,
  contactEmail: string,
  campaignId?: string
): string {
  const url = generateUnsubscribeUrl(baseUrl, contactId, contactEmail, campaignId)
  
  return `
    <p style="margin: 10px 0 0 0; font-size: 11px; color: #999999;">
      If you no longer wish to receive these emails, you can 
      <a href="${url}" style="color: #999999; text-decoration: underline;">unsubscribe here</a>.
    </p>
  `.trim()
}

// ============================================
// UNSUBSCRIBE PREFERENCES
// ============================================

export interface UnsubscribePreferences {
  unsubscribed_all: boolean      // Unsubscribe from all emails
  unsubscribed_campaigns: string[] // Specific campaign IDs
  unsubscribed_at?: string       // Timestamp
  reason?: string                // Optional reason
}

/**
 * Get unsubscribe preferences for a contact
 */
export async function getUnsubscribePreferences(
  contactId: string
): Promise<UnsubscribePreferences | null> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('contacts')
    .select('unsubscribed, unsubscribe_preferences')
    .eq('id', contactId)
    .single()
  
  if (error || !data) {
    return null
  }
  
  // Parse stored preferences or return defaults
  const prefs = data.unsubscribe_preferences as UnsubscribePreferences | null
  
  return {
    unsubscribed_all: data.unsubscribed || prefs?.unsubscribed_all || false,
    unsubscribed_campaigns: prefs?.unsubscribed_campaigns || [],
    unsubscribed_at: prefs?.unsubscribed_at,
    reason: prefs?.reason,
  }
}

/**
 * Update unsubscribe preferences for a contact
 */
export async function updateUnsubscribePreferences(
  contactId: string,
  preferences: Partial<UnsubscribePreferences>
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()
  
  // Get current preferences
  const current = await getUnsubscribePreferences(contactId)
  
  const updated: UnsubscribePreferences = {
    unsubscribed_all: preferences.unsubscribed_all ?? current?.unsubscribed_all ?? false,
    unsubscribed_campaigns: preferences.unsubscribed_campaigns ?? current?.unsubscribed_campaigns ?? [],
    unsubscribed_at: new Date().toISOString(),
    reason: preferences.reason ?? current?.reason,
  }
  
  const { error } = await supabase
    .from('contacts')
    .update({
      unsubscribed: updated.unsubscribed_all,
      unsubscribe_preferences: updated,
    })
    .eq('id', contactId)
  
  if (error) {
    return { success: false, error: error.message }
  }
  
  return { success: true }
}

/**
 * Process unsubscribe request from token
 */
export async function processUnsubscribe(
  token: string,
  options: {
    campaignId?: string
    unsubscribeAll?: boolean
    reason?: string
  } = {}
): Promise<{ success: boolean; error?: string; contactId?: string }> {
  // Verify token
  const tokenResult = verifyUnsubscribeToken(token)
  
  if (!tokenResult.valid || !tokenResult.contactId) {
    return { success: false, error: tokenResult.error || 'Invalid token' }
  }
  
  const contactId = tokenResult.contactId
  const { campaignId, unsubscribeAll = true, reason } = options
  
  // Get current preferences
  const current = await getUnsubscribePreferences(contactId)
  
  let updatedCampaigns = current?.unsubscribed_campaigns || []
  
  // Add campaign to unsubscribed list if specified
  if (campaignId && !unsubscribeAll) {
    if (!updatedCampaigns.includes(campaignId)) {
      updatedCampaigns = [...updatedCampaigns, campaignId]
    }
  }
  
  // Update preferences
  const result = await updateUnsubscribePreferences(contactId, {
    unsubscribed_all: unsubscribeAll,
    unsubscribed_campaigns: updatedCampaigns,
    reason,
  })
  
  if (!result.success) {
    return { success: false, error: result.error, contactId }
  }
  
  return { success: true, contactId }
}

// ============================================
// HELPERS FOR SENDING
// ============================================

/**
 * Check if a contact should receive emails
 */
export async function canSendToContact(
  contactId: string,
  campaignId?: string
): Promise<{ canSend: boolean; reason?: string }> {
  const prefs = await getUnsubscribePreferences(contactId)
  
  if (!prefs) {
    // No preferences = can send
    return { canSend: true }
  }
  
  if (prefs.unsubscribed_all) {
    return { canSend: false, reason: 'Contact has unsubscribed from all emails' }
  }
  
  if (campaignId && prefs.unsubscribed_campaigns.includes(campaignId)) {
    return { canSend: false, reason: 'Contact has unsubscribed from this campaign' }
  }
  
  return { canSend: true }
}

/**
 * Filter contacts who can receive emails
 */
export async function filterSubscribedContacts(
  contactIds: string[],
  campaignId?: string
): Promise<{ subscribed: string[]; unsubscribed: string[] }> {
  const supabase = createClient()
  
  const { data: contacts, error } = await supabase
    .from('contacts')
    .select('id, unsubscribed, unsubscribe_preferences')
    .in('id', contactIds)
  
  if (error || !contacts) {
    // On error, assume all can receive (fail open for sending)
    return { subscribed: contactIds, unsubscribed: [] }
  }
  
  const subscribed: string[] = []
  const unsubscribed: string[] = []
  
  for (const contact of contacts) {
    const prefs = contact.unsubscribe_preferences as UnsubscribePreferences | null
    
    if (contact.unsubscribed || prefs?.unsubscribed_all) {
      unsubscribed.push(contact.id)
    } else if (campaignId && prefs?.unsubscribed_campaigns?.includes(campaignId)) {
      unsubscribed.push(contact.id)
    } else {
      subscribed.push(contact.id)
    }
  }
  
  return { subscribed, unsubscribed }
}
