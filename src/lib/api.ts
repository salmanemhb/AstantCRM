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

export async function getContacts(): Promise<Contact[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data || []
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
    .order('created_at', { ascending: false })

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

// ============================================
// EDGE FUNCTION CALLS
// ============================================

interface GenerateDraftRequest {
  contact_id: string
  campaign_id: string
  signature: string
}

interface GenerateDraftResponse {
  email_id: string
  subject: string
  preview: {
    greeting: string
    context_p1: string
    value_p2: string
    cta: string
    signature: string
  }
  confidence: ConfidenceScore
}

export async function generateDraft(request: GenerateDraftRequest): Promise<GenerateDraftResponse> {
  // Use our local API endpoint instead of Supabase Edge Function
  const response = await fetch('/api/generate-draft', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to generate draft' }))
    throw new Error(error.message || error.error || 'Failed to generate draft')
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
  const response = await fetch(`${SUPABASE_URL}/functions/v1/rebuttal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to apply rebuttal')
  }

  return response.json()
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
  const response = await fetch(`${SUPABASE_URL}/functions/v1/send-drip`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to send email')
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
