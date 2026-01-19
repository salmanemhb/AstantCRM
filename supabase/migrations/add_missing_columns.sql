-- Migration: Add missing columns identified in deep analysis
-- Date: 2026-01-13

-- 1. Add approved_at to emails table (used in api.ts approveEmail function)
ALTER TABLE emails ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- 2. Add sender_id to campaigns table (used for campaign-level sender assignment)
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS sender_id TEXT;

-- 3. Add sender_id to contact_campaigns table (used for per-contact sender override)
ALTER TABLE contact_campaigns ADD COLUMN IF NOT EXISTS sender_id TEXT;

-- 4. Add email_attachments table if it doesn't exist (may already exist from add_email_attachments.sql)
CREATE TABLE IF NOT EXISTS email_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Create index on email_attachments for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_attachments_email_id ON email_attachments(email_id);

-- 6. Create index on emails.contact_campaign_id for faster joins
CREATE INDEX IF NOT EXISTS idx_emails_contact_campaign_id ON emails(contact_campaign_id);

-- 7. Create index on contact_campaigns.campaign_id for faster campaign filtering  
CREATE INDEX IF NOT EXISTS idx_contact_campaigns_campaign_id ON contact_campaigns(campaign_id);

-- 8. Create index on contact_campaigns.contact_id for faster contact lookups
CREATE INDEX IF NOT EXISTS idx_contact_campaigns_contact_id ON contact_campaigns(contact_id);

-- Disable RLS for development (matching existing pattern)
ALTER TABLE email_attachments DISABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Allow all for anon" ON email_attachments FOR ALL USING (true) WITH CHECK (true);
