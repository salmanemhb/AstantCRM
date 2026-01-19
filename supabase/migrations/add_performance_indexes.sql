-- Add indexes for common query patterns
-- This improves performance for JOINs and WHERE clauses

-- Index on contact_campaigns for campaign lookups with contact
CREATE INDEX IF NOT EXISTS idx_contact_campaigns_campaign_contact 
ON contact_campaigns(campaign_id, contact_id);

-- Index on contact_campaigns for stage filtering
CREATE INDEX IF NOT EXISTS idx_contact_campaigns_stage 
ON contact_campaigns(stage);

-- Index on emails for contact_campaign lookups
CREATE INDEX IF NOT EXISTS idx_emails_contact_campaign 
ON emails(contact_campaign_id);

-- Index on emails for approved status filtering
CREATE INDEX IF NOT EXISTS idx_emails_approved 
ON emails(approved) WHERE approved = true;

-- Index on engagement_events for email lookups
CREATE INDEX IF NOT EXISTS idx_engagement_events_email 
ON engagement_events(email_id);

-- Index on contacts for list lookups
CREATE INDEX IF NOT EXISTS idx_contacts_list 
ON contacts(contact_list_id);

-- Index on relationship_memory for contact lookups
CREATE INDEX IF NOT EXISTS idx_relationship_memory_contact 
ON relationship_memory(contact_id);
