// ============================================
// TYPE DEFINITIONS - VC OUTREACH CRM
// ============================================

// Enum types matching database
export type ConfidenceScore = 'green' | 'yellow' | 'red'
export type CampaignTone = 'direct' | 'warm' | 'technical' | 'visionary'
export type ContactStage = 'drafted' | 'approved' | 'sent' | 'opened' | 'replied' | 'passed' | 'meeting' | 'closed'
export type ThreadStatus = 'active' | 'paused' | 'closed'
export type ReferenceMode = 'factual_only' | 'safe_reference' | 'do_not_reference'
export type RebuttalType = 'SOFTER_TONE' | 'MORE_TECHNICAL' | 'SHORTER' | 'CLARIFY_VALUE_PROP' | 'LESS_PITCHY'
export type MediaAssetType = 'pitch_deck' | 'memo' | 'landing_page' | 'doc'
export type EngagementEventType = 'sent' | 'opened' | 'clicked' | 'replied'

// Database entities

// Contact List (Imported Spreadsheet)
export interface ContactList {
  id: string
  name: string
  file_name: string
  file_type: 'csv' | 'xlsx' | 'xls'
  column_mapping: Record<string, string> // Maps original columns to our fields
  original_headers: string[] // Original column headers from file
  row_count: number
  filter_columns?: Record<string, string[]> // Auto-detected filterable columns with unique values
  created_at: string
  // Joined
  contacts?: Contact[]
}

export interface Contact {
  id: string
  contact_list_id: string | null
  first_name: string
  last_name: string
  email: string
  firm: string | null
  role: string | null
  geography: string | null
  investment_focus: string | null
  notes_private: string | null
  raw_data: Record<string, any> | null // Original row data for dynamic display
  created_at: string
  // Joined
  contact_list?: ContactList
}

export interface Campaign {
  id: string
  name: string
  prompt?: string | null
  template_subject?: string | null
  template_body?: string | null
  global_context?: string | null
  cta?: string | null
  tone?: CampaignTone | null
  status?: string
  contacts_count?: number
  fallback_strategy?: string | null
  created_by?: string | null
  sender_id?: string | null
  template_id?: string | null
  created_at: string
}

export interface UnifiedThread {
  id: string
  firm_name: string
  internal_deal_label: string | null
  primary_contact_id: string | null
  status: ThreadStatus
  created_at: string
}

export interface ContactCampaign {
  id: string
  contact_id: string
  campaign_id: string
  unified_thread_id: string
  stage: ContactStage
  confidence_score: ConfidenceScore
  last_email_id: string | null
  sender_id?: string | null
  updated_at: string
  // Joined relations
  contact?: Contact
  campaign?: Campaign
  unified_thread?: UnifiedThread
}

export interface EmailJsonBody {
  greeting: string
  context_p1: string
  value_p2: string
  cta: string
  signature: string
  signatureMemberId?: string  // Team member ID for signature (jean-francois, fahd, marcos)
  bannerEnabled?: boolean     // Whether to show the email banner at top
}

export interface Email {
  id: string
  contact_campaign_id: string
  original_body: EmailJsonBody
  current_body: EmailJsonBody
  subject: string
  confidence_score: ConfidenceScore
  approved: boolean
  last_rebuttal_enum: RebuttalType | null
  mutated_at: string | null
  sent_at: string | null
  // Joined relations
  contact_campaign?: ContactCampaign
}

export interface RelationshipMemory {
  id: string
  contact_id: string
  unified_thread_id: string
  project_name: string | null
  summary_factual: string
  objections_factual: string | null
  outcome: string | null
  last_interaction_at: string | null
  reference_mode: ReferenceMode
  ai_usage_rule: string
}

export interface MediaAsset {
  id: string
  campaign_id: string
  asset_type: MediaAssetType
  canonical_url: string
  hosting_domain: string
  checksum_hash: string
  active: boolean
  created_at: string
}

export interface EngagementEvent {
  id: string
  unified_thread_id: string
  email_id: string | null
  event_type: EngagementEventType
  timestamp: string
  metadata: Record<string, any> | null
}

// API response types
export interface GenerateDraftResponse {
  success: boolean
  email_id?: string
  confidence_score?: ConfidenceScore
  confidence_reason?: string
  email_preview?: EmailJsonBody
  error?: string
}

export interface RebuttalResponse {
  success: boolean
  email_id?: string
  rebuttal_applied?: RebuttalType
  previous_body?: EmailJsonBody
  current_body?: EmailJsonBody
  error?: string
}

export interface SendDripResponse {
  success: boolean
  email_id?: string
  sent_to?: string
  sent_at?: string
  message_id?: string
  dry_run?: boolean
  error?: string
}

// Queue item for Tinder UI
export interface QueueItem {
  email: Email
  contact: Contact
  campaign: Campaign
  thread: UnifiedThread
}

// Email attachment type
export interface EmailAttachment {
  id: string
  email_id: string
  file_name: string
  file_size: number
  file_type: string
  storage_path: string
  public_url?: string
  created_at: string
}

// Signature configuration
export interface SignatureConfig {
  name: string
  title?: string
  company: string
  phone?: string
  email?: string
  linkedin?: string
  website?: string
}

