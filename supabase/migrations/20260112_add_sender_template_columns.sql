-- Migration: Add sender_id and template_id columns to campaigns
-- Date: 2026-01-12

-- Add sender_id column
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS sender_id TEXT DEFAULT 'jean-francois';

-- Add template_id column  
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS template_id TEXT;

-- Add sender_id to contact_campaigns for per-contact sender override
ALTER TABLE contact_campaigns
ADD COLUMN IF NOT EXISTS sender_id TEXT;

-- Make unified_thread_id optional in contact_campaigns (for local campaign creation)
ALTER TABLE contact_campaigns
ALTER COLUMN unified_thread_id DROP NOT NULL;

-- Make confidence_score optional with default
ALTER TABLE contact_campaigns
ALTER COLUMN confidence_score SET DEFAULT 'yellow';

-- Allow emails without confidence score initially
ALTER TABLE emails
ALTER COLUMN confidence_score SET DEFAULT 'yellow';

-- Drop constraints that prevent flexible workflow
ALTER TABLE emails DROP CONSTRAINT IF EXISTS send_requires_approval;
ALTER TABLE emails DROP CONSTRAINT IF EXISTS no_red_send;
ALTER TABLE contact_campaigns DROP CONSTRAINT IF EXISTS no_red_auto_advance;
