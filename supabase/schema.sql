-- ============================================
-- VC OUTREACH CRM - FINAL SUPABASE SCHEMA v1.2
-- AUTHORITATIVE - DO NOT MODIFY
-- ============================================

-- ENUM TYPES

CREATE TYPE confidence_score_enum AS ENUM ('green', 'yellow', 'red');

CREATE TYPE campaign_tone_enum AS ENUM (
  'direct',
  'warm',
  'technical',
  'visionary'
);

CREATE TYPE contact_stage_enum AS ENUM (
  'drafted',
  'approved',
  'sent',
  'opened',
  'replied',
  'passed',
  'meeting',
  'closed'
);

CREATE TYPE thread_status_enum AS ENUM (
  'active',
  'paused',
  'closed'
);

CREATE TYPE relationship_reference_mode_enum AS ENUM (
  'factual_only',
  'safe_reference',
  'do_not_reference'
);

CREATE TYPE ai_usage_rule_enum AS ENUM (
  'never_defensive',
  'never_emotional',
  'neutral_context_only'
);

CREATE TYPE media_asset_type_enum AS ENUM (
  'pitch_deck',
  'memo',
  'landing_page',
  'doc'
);

CREATE TYPE rebuttal_enum AS ENUM (
  'SOFTER_TONE',
  'MORE_TECHNICAL',
  'SHORTER',
  'CLARIFY_VALUE_PROP',
  'LESS_PITCHY'
);

CREATE TYPE engagement_event_enum AS ENUM (
  'sent',
  'opened',
  'clicked',
  'replied'
);

-- CONTACT LISTS (IMPORTED SPREADSHEETS)

CREATE TABLE contact_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL, -- 'csv', 'xlsx', 'xls'
  column_mapping JSONB NOT NULL, -- Maps original columns to our fields
  original_headers JSONB NOT NULL, -- Original column headers from file
  row_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- CONTACTS

CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_list_id UUID REFERENCES contact_lists(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  firm TEXT,
  role TEXT,
  geography TEXT,
  investment_focus TEXT,
  notes_private TEXT,
  raw_data JSONB, -- Store original row data for dynamic display
  created_at TIMESTAMPTZ DEFAULT now()
);

-- CAMPAIGNS

CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  prompt TEXT, -- User's description of the email they want
  template_subject TEXT, -- AI-generated subject template with placeholders
  template_body TEXT, -- AI-generated body template with placeholders
  global_context TEXT,
  cta TEXT,
  tone campaign_tone_enum DEFAULT 'warm',
  status TEXT DEFAULT 'draft', -- draft, ready, active
  contacts_count INTEGER DEFAULT 0,
  fallback_strategy TEXT,
  sender_id TEXT, -- Team member ID for campaign-level sender assignment
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- UNIFIED THREADS (DEALS)

CREATE TABLE unified_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_name TEXT NOT NULL,
  internal_deal_label TEXT,
  primary_contact_id UUID REFERENCES contacts(id),
  status thread_status_enum NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- CONTACT ↔ CAMPAIGN JOIN

CREATE TABLE contact_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  unified_thread_id UUID NOT NULL REFERENCES unified_threads(id) ON DELETE CASCADE,
  stage contact_stage_enum NOT NULL DEFAULT 'drafted',
  confidence_score confidence_score_enum NOT NULL,
  last_email_id UUID,
  sender_id TEXT, -- Team member ID for per-contact sender override
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT no_red_auto_advance CHECK (
    NOT (stage IN ('approved', 'sent') AND confidence_score = 'red')
  )
);

-- EMAILS (STRUCTURED JSON + AUDIT)

CREATE TABLE emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_campaign_id UUID NOT NULL REFERENCES contact_campaigns(id) ON DELETE CASCADE,

  original_body JSONB NOT NULL,
  current_body JSONB NOT NULL,

  subject TEXT NOT NULL,

  confidence_score confidence_score_enum NOT NULL,
  approved BOOLEAN NOT NULL DEFAULT false,
  approved_at TIMESTAMPTZ, -- Timestamp when email was approved

  last_rebuttal_enum rebuttal_enum,
  mutated_at TIMESTAMPTZ,

  sent_at TIMESTAMPTZ,

  CONSTRAINT send_requires_approval CHECK (
    NOT (sent_at IS NOT NULL AND approved = false)
  ),

  CONSTRAINT no_red_send CHECK (
    NOT (sent_at IS NOT NULL AND confidence_score = 'red')
  )
);

-- RELATIONSHIP MEMORY (TONE-LOCKED)

CREATE TABLE relationship_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  unified_thread_id UUID NOT NULL REFERENCES unified_threads(id) ON DELETE CASCADE,

  project_name TEXT,
  summary_factual TEXT NOT NULL,
  objections_factual TEXT,
  outcome TEXT,
  last_interaction_at TIMESTAMPTZ,

  reference_mode relationship_reference_mode_enum NOT NULL DEFAULT 'factual_only',
  ai_usage_rule ai_usage_rule_enum NOT NULL DEFAULT 'neutral_context_only'
);

-- MEDIA ASSETS (DELIVERABILITY)

CREATE TABLE media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  asset_type media_asset_type_enum NOT NULL,
  canonical_url TEXT NOT NULL,
  hosting_domain TEXT NOT NULL,
  checksum_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT unique_asset_per_campaign UNIQUE (campaign_id, asset_type)
);

-- ENGAGEMENT EVENTS

CREATE TABLE engagement_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unified_thread_id UUID NOT NULL REFERENCES unified_threads(id) ON DELETE CASCADE,
  email_id UUID REFERENCES emails(id),
  event_type engagement_event_enum NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT now(),
  metadata JSONB
);
