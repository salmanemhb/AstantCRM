// ============================================
// API SERVICE LAYER - VC OUTREACH CRM
// ============================================

import { createClient } from '@/lib/supabase/client'
import type { 
  Contact, 
  Campaign, 
  Email, 
  ContactCampaign,
  ConfidenceScore,
  RebuttalType 
} from '@/lib/types'

// Get Supabase URL for Edge Function calls
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// ============================================
// CONTACTS API
// ============================================

export interface PaginationOptions {
  page?: number
  limit?: number
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

export async function getContacts(options?: PaginationOptions): Promise<Contact[]> {
  const supabase = createClient()
  const limit = options?.limit || 500 // Default limit for safety
  const page = options?.page || 1
  const offset = (page - 1) * limit

  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw new Error(error.message)
  return data || []
}

export async function getContactsPaginated(options?: PaginationOptions): Promise<PaginatedResult<Contact>> {
  const supabase = createClient()
  const limit = options?.limit || 50
  const page = options?.page || 1
  const offset = (page - 1) * limit

  // Get total count
  const { count, error: countError } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })

  if (countError) throw new Error(countError.message)

  // Get paginated data
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw new Error(error.message)

  return {
    data: data || [],
    total: count || 0,
    page,
    limit,
    hasMore: offset + (data?.length || 0) < (count || 0),
  }
}

export async function getContact(id: string): Promise<Contact | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function createContact(contact: Omit<Contact, 'id' | 'created_at'>): Promise<Contact> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('contacts')
    .insert(contact)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function updateContact(id: string, updates: Partial<Contact>): Promise<Contact> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('contacts')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function deleteContact(id: string): Promise<void> {
  const supabase = createClient()
  
  // First, find any unified_threads that reference this contact as primary
  // and either update them or delete them
  const { data: threadsToClean, error: findThreadsError } = await supabase
    .from('unified_threads')
    .select('id')
    .eq('primary_contact_id', id)
  
  if (findThreadsError) {
    console.warn('[API] Failed to find unified_threads for contact:', findThreadsError)
  }
  
  // Delete orphaned unified_threads (they'll lose their primary contact)
  // The contact_campaigns will cascade delete, so these threads become orphaned
  if (threadsToClean && threadsToClean.length > 0) {
    const threadIds = threadsToClean.map(t => t.id)
    const { error: deleteThreadsError } = await supabase
      .from('unified_threads')
      .delete()
      .in('id', threadIds)
    
    if (deleteThreadsError) {
      console.warn('[API] Failed to delete orphaned unified_threads:', deleteThreadsError)
    }
  }
  
  // Now delete the contact (contact_campaigns will cascade)
  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
}

// ============================================
// CAMPAIGNS API
// ============================================

export async function getCampaigns(): Promise<Campaign[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data || []
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function createCampaign(campaign: Omit<Campaign, 'id' | 'created_at'>): Promise<Campaign> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('campaigns')
    .insert(campaign)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function updateCampaign(id: string, updates: Partial<Campaign>): Promise<Campaign> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('campaigns')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function deleteCampaign(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('campaigns')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
}

// ============================================
// EMAILS / QUEUE API
// ============================================

export interface QueueEmail extends Email {
  contact: Contact
  campaign: Campaign
}

export async function getEmailQueue(): Promise<QueueEmail[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('emails')
    .select(`
      *,
      contact_campaign:contact_campaigns (
        *,
        contact:contacts (*),
        campaign:campaigns (*)
      )
    `)
    .is('sent_at', null)
    .order('mutated_at', { ascending: false, nullsFirst: false })

  if (error) throw new Error(error.message)

  // Transform the nested data
  return (data || []).map(email => ({
    ...email,
    contact: email.contact_campaign?.contact,
    campaign: email.contact_campaign?.campaign,
  }))
}

export async function approveEmail(emailId: string): Promise<Email> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('emails')
    .update({ 
      approved: true,
      approved_at: new Date().toISOString()
    })
    .eq('id', emailId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function rejectEmail(emailId: string): Promise<void> {
  const supabase = createClient()
  // For now, we just delete rejected emails
  // Could add a "rejected" status instead
  const { error } = await supabase
    .from('emails')
    .delete()
    .eq('id', emailId)

  if (error) throw new Error(error.message)
}

/**
 * Safely delete emails and clean up associated storage files
 * @param emailIds - Array of email IDs to delete
 * @returns Object with deletion results
 */
export async function deleteEmailsWithCleanup(emailIds: string[]): Promise<{
  deleted: number
  storageCleanedUp: number
  errors: string[]
}> {
  if (!emailIds || emailIds.length === 0) {
    return { deleted: 0, storageCleanedUp: 0, errors: [] }
  }

  const supabase = createClient()
  const errors: string[] = []
  let storageCleanedUp = 0

  // First, get all attachment storage paths for these emails
  const { data: attachments, error: attachmentsError } = await supabase
    .from('email_attachments')
    .select('storage_path')
    .in('email_id', emailIds)

  if (attachmentsError) {
    console.warn('[API] Failed to fetch attachments for cleanup:', attachmentsError)
    errors.push(`Failed to fetch attachments: ${attachmentsError.message}`)
  }

  // Clean up storage files
  if (attachments && attachments.length > 0) {
    const storagePaths = attachments.map(a => a.storage_path).filter(Boolean)
    if (storagePaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('email-attachments')
        .remove(storagePaths)

      if (storageError) {
        console.warn('[API] Failed to delete some storage files:', storageError)
        errors.push(`Storage cleanup error: ${storageError.message}`)
      } else {
        storageCleanedUp = storagePaths.length
      }
    }
  }

  // Now delete the emails (attachments will cascade delete)
  const { error: deleteError, count } = await supabase
    .from('emails')
    .delete()
    .in('id', emailIds)

  if (deleteError) {
    throw new Error(`Failed to delete emails: ${deleteError.message}`)
  }

  return {
    deleted: count || emailIds.length,
    storageCleanedUp,
    errors,
  }
}

/**
 * Safely delete emails by contact_campaign_ids with storage cleanup
 */
export async function deleteEmailsByContactCampaigns(ccIds: string[]): Promise<{
  deleted: number
  storageCleanedUp: number
  errors: string[]
}> {
  if (!ccIds || ccIds.length === 0) {
    return { deleted: 0, storageCleanedUp: 0, errors: [] }
  }

  const supabase = createClient()

  // First get the email IDs
  const { data: emails, error: emailsError } = await supabase
    .from('emails')
    .select('id')
    .in('contact_campaign_id', ccIds)

  if (emailsError) {
    throw new Error(`Failed to fetch emails: ${emailsError.message}`)
  }

  if (!emails || emails.length === 0) {
    return { deleted: 0, storageCleanedUp: 0, errors: [] }
  }

  const emailIds = emails.map(e => e.id)
  return deleteEmailsWithCleanup(emailIds)
}

// ============================================
// EDGE FUNCTION CALLS
// ============================================

interface GenerateDraftRequest {
  contact_id: string
  campaign_id: string
  signature?: string
  config?: {
    mode?: 'quick' | 'smart'        // quick = no AI, smart = AI-assisted
    template_id?: string             // which template to use (default: jf-vc-intro-v1)
    sender_id?: string               // who is sending (default: jean-francois)
  }
}

interface GenerateDraftResponse {
  email_id: string
  subject: string
  body: string
  preview: {
    body: string
    signature: string
  }
  confidence: number
  template_used?: string
  template_name?: string
  modifications?: Array<{
    original: string
    replacement: string
    field: string
  }>
  philosophy?: string
}

/**
 * Personalize a template for a contact
 * 
 * PHILOSOPHY: This does NOT generate emails.
 * It takes a proven template and ONLY swaps specific words
 * (name, firm, investment focus) for each contact.
 * 
 * @param mode 'quick' = instant string replacement (recommended)
 *             'smart' = AI-assisted (for edge cases)
 */
export async function generateDraft(request: GenerateDraftRequest): Promise<GenerateDraftResponse> {
  const response = await fetch('/api/generate-claude', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contact_id: request.contact_id,
      campaign_id: request.campaign_id,
      signature: request.signature,
      config: {
        mode: request.config?.mode || 'quick',
        // Only send template_id and sender_id if explicitly provided
        // Otherwise, let the API use campaign settings
        ...(request.config?.template_id && { template_id: request.config.template_id }),
        ...(request.config?.sender_id && { sender_id: request.config.sender_id }),
      },
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to personalize template' }))
    throw new Error(error.message || error.error || 'Failed to personalize template')
  }

  return response.json()
}

interface RebuttalRequest {
  email_id: string
  rebuttal_type: RebuttalType
}

interface RebuttalResponse {
  email_id: string
  before: {
    context_p1: string
    value_p2: string
  }
  after: {
    context_p1: string
    value_p2: string
  }
  new_confidence: ConfidenceScore
}

export async function applyRebuttal(request: RebuttalRequest): Promise<RebuttalResponse> {
  // TODO: Implement rebuttal API endpoint
  // For now, throw a not implemented error
  throw new Error('Rebuttal functionality not yet implemented. Coming soon.')
}

interface SendDripRequest {
  email_id: string
}

interface SendDripResponse {
  success: boolean
  email_id: string
  sent_at: string
  message_id?: string
}

export async function sendEmail(request: SendDripRequest): Promise<SendDripResponse> {
  // Use the actual send-email API route
  const response = await fetch('/api/send-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to send email' }))
    throw new Error(error.error || 'Failed to send email')
  }

  return response.json()
}

// ============================================
// DASHBOARD STATS
// ============================================

export interface DashboardStats {
  totalContacts: number
  activeCampaigns: number
  pendingEmails: number
  sentThisWeek: number
  emailsByConfidence: {
    green: number
    yellow: number
    red: number
  }
  recentActivity: {
    type: 'sent' | 'approved' | 'generated'
    contactName: string
    timestamp: string
  }[]
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = createClient()
  
  // Run queries in parallel
  const [
    contactsResult,
    campaignsResult,
    pendingEmailsResult,
    sentEmailsResult,
    confidenceResult,
  ] = await Promise.all([
    supabase.from('contacts').select('id', { count: 'exact', head: true }),
    supabase.from('campaigns').select('id', { count: 'exact', head: true }),
    supabase.from('emails').select('id', { count: 'exact', head: true }).is('sent_at', null),
    supabase.from('emails').select('id', { count: 'exact', head: true })
      .gte('sent_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    supabase.from('emails').select('confidence_score').is('sent_at', null),
  ])

  // Count by confidence
  const emailsByConfidence = { green: 0, yellow: 0, red: 0 }
  if (confidenceResult.data) {
    confidenceResult.data.forEach((e: { confidence_score: ConfidenceScore }) => {
      emailsByConfidence[e.confidence_score]++
    })
  }

  return {
    totalContacts: contactsResult.count || 0,
    activeCampaigns: campaignsResult.count || 0,
    pendingEmails: pendingEmailsResult.count || 0,
    sentThisWeek: sentEmailsResult.count || 0,
    emailsByConfidence,
    recentActivity: [], // Could fetch from engagement_events
  }
}

// ============================================
// CONTACT CAMPAIGNS (for generating drafts)
// ============================================

export async function addContactToCampaign(
  contactId: string, 
  campaignId: string
): Promise<ContactCampaign> {
  const supabase = createClient()
  
  // First create a unified thread for this contact/campaign
  const { data: thread, error: threadError } = await supabase
    .from('unified_threads')
    .insert({
      firm_name: 'TBD', // Will be updated from contact data
      status: 'active',
    })
    .select()
    .single()

  if (threadError) throw new Error(threadError.message)

  // Then create the contact_campaign record
  const { data, error } = await supabase
    .from('contact_campaigns')
    .insert({
      contact_id: contactId,
      campaign_id: campaignId,
      unified_thread_id: thread.id,
      stage: 'drafted',
      confidence_score: 'yellow', // Default until AI evaluates
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function getContactCampaigns(contactId: string): Promise<ContactCampaign[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('contact_campaigns')
    .select(`
      *,
      campaign:campaigns (*),
      unified_thread:unified_threads (*)
    `)
    .eq('contact_id', contactId)

  if (error) throw new Error(error.message)
  return data || []
}

// ============================================
// MAIL MERGE API (FAST - NO AI CALLS)
// Use this for bulk operations
// ============================================

interface MailMergeRequest {
  contact_id: string
  campaign_id: string
  template_id?: string
}

interface MailMergeResponse {
  success: boolean
  email_id: string
  subject: string
  body: string
  template_used: string
  engine: string
}

export async function generateDraftFast(request: MailMergeRequest): Promise<MailMergeResponse> {
  const response = await fetch('/api/generate-claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contact_id: request.contact_id,
      campaign_id: request.campaign_id,
      config: {
        template_id: request.template_id || 'vc-intro',
      },
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to generate' }))
    throw new Error(error.error || 'Email generation failed')
  }

  const data = await response.json()
  return {
    success: true,
    email_id: data.email_id,
    subject: data.subject,
    body: data.body,
    template_used: data.template_id || 'default',
    engine: 'claude',
  }
}

interface BatchMailMergeRequest {
  campaign_id: string
  contact_ids?: string[]
  template_id?: string
  limit?: number
}

interface BatchMailMergeResponse {
  success: boolean
  stats: {
    total: number
    successful: number
    failed: number
    processingTime: string
  }
  saved_emails: number
  failed: Array<{ contactId: string; error: string }>
}

export async function generateDraftsBatch(request: BatchMailMergeRequest): Promise<BatchMailMergeResponse> {
  const response = await fetch('/api/batch-generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      campaign_id: request.campaign_id,
      contact_ids: request.contact_ids,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Batch failed' }))
    throw new Error(error.error || 'Batch email generation failed')
  }

  const data = await response.json()
  return {
    success: data.success,
    stats: {
      total: data.result?.total || 0,
      successful: data.result?.generated || 0,
      failed: data.result?.failed || 0,
      processingTime: 'N/A',
    },
    saved_emails: data.result?.generated || 0,
    failed: data.result?.details?.failed || [],
  }
}

export async function getMailMergeTemplates(): Promise<Array<{
  id: string
  name: string
  category: string
  description: string
  sender: string
  required_fields: string[]
}>> {
  // Return static template list from template-personalization
  const { MASTER_TEMPLATES } = await import('./template-personalization')
  
  return MASTER_TEMPLATES.map((template) => ({
    id: template.id,
    name: template.name,
    category: template.category || 'general',
    description: template.description || '',
    sender: template.author || 'jean-francois',
    required_fields: template.placeholders?.filter(p => p.required).map(p => p.field) || ['first_name', 'firm'],
  }))
}

// ============================================
// BULK EMAIL SENDING (Resend)
// ============================================

interface BulkSendRequest {
  campaign_id: string
  email_ids?: string[]
  filter?: 'approved' | 'all'
  sender_id?: string
  dry_run?: boolean
}

interface BulkSendResponse {
  success: boolean
  stats: {
    total: number
    sent: number
    failed: number
    skipped: number
    errors: Array<{ email_id: string; error: string }>
    message_ids: string[]
  }
}

export async function sendBulkEmails(request: BulkSendRequest): Promise<BulkSendResponse> {
  const response = await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'bulk',
      ...request,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Bulk send failed' }))
    throw new Error(error.error || 'Failed to send bulk emails')
  }

  return response.json()
}

export async function sendBulkDryRun(campaign_id: string, filter: 'approved' | 'all' = 'approved') {
  return sendBulkEmails({ campaign_id, filter, dry_run: true })
}
