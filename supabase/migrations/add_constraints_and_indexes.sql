-- Migration: Add constraints and fixes from deep analysis round 3
-- Date: 2026-01-13

-- 1. Add partial unique index to prevent multiple unsent draft emails per contact_campaign
-- This allows sent emails to remain (sent_at IS NOT NULL) but prevents duplicate drafts
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_draft_per_contact_campaign 
ON emails (contact_campaign_id) 
WHERE sent_at IS NULL AND approved = false;

-- 2. Add index on emails.sent_at for filtering sent vs unsent
CREATE INDEX IF NOT EXISTS idx_emails_sent_at ON emails(sent_at);

-- 3. Add index on emails.approved for filtering approved status
CREATE INDEX IF NOT EXISTS idx_emails_approved ON emails(approved);

-- 4. Add index on contacts.email for duplicate detection
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);

-- 5. Add index on unified_threads.status for filtering
CREATE INDEX IF NOT EXISTS idx_unified_threads_status ON unified_threads(status);

-- 6. Add index on contact_campaigns.stage for filtering
CREATE INDEX IF NOT EXISTS idx_contact_campaigns_stage ON contact_campaigns(stage);
