-- ============================================
-- PIPELINE STAGE MIGRATION
-- Adds pipeline stage column and fixes analytics
-- Run in Supabase SQL Editor AFTER the main analytics migration
-- ============================================

-- Add pipeline_stage column to contact_campaigns
ALTER TABLE contact_campaigns 
ADD COLUMN IF NOT EXISTS pipeline_stage TEXT DEFAULT 'sent';

-- Add constraint for valid stages
ALTER TABLE contact_campaigns 
DROP CONSTRAINT IF EXISTS valid_pipeline_stage;

ALTER TABLE contact_campaigns
ADD CONSTRAINT valid_pipeline_stage 
CHECK (pipeline_stage IN ('sent', 'opened', 'replied', 'interested', 'meeting', 'closed', 'not_interested'));

-- Index for fast filtering by stage
CREATE INDEX IF NOT EXISTS idx_contact_campaigns_stage 
ON contact_campaigns(pipeline_stage);

-- Create a function to auto-update stage on email events
CREATE OR REPLACE FUNCTION update_pipeline_stage_on_open()
RETURNS TRIGGER AS $$
BEGIN
  -- When an email is opened, update stage to 'opened' if currently 'sent'
  UPDATE contact_campaigns
  SET pipeline_stage = 'opened'
  WHERE id = NEW.contact_campaign_id
    AND pipeline_stage = 'sent';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update on email open
DROP TRIGGER IF EXISTS trigger_auto_stage_opened ON emails;
CREATE TRIGGER trigger_auto_stage_opened
  AFTER UPDATE OF opened_at ON emails
  FOR EACH ROW
  WHEN (OLD.opened_at IS NULL AND NEW.opened_at IS NOT NULL)
  EXECUTE FUNCTION update_pipeline_stage_on_open();

-- Update existing records: set stage based on current email status
UPDATE contact_campaigns cc
SET pipeline_stage = CASE 
  WHEN EXISTS (
    SELECT 1 FROM emails e 
    WHERE e.contact_campaign_id = cc.id 
    AND e.opened_at IS NOT NULL
  ) THEN 'opened'
  ELSE 'sent'
END
WHERE pipeline_stage IS NULL OR pipeline_stage = 'sent';

-- Recreate the campaign_analytics view with correct stage column
CREATE OR REPLACE VIEW campaign_analytics AS
SELECT 
  c.id,
  c.name,
  c.status,
  c.created_at,
  COUNT(DISTINCT cc.id) as total_contacts,
  COUNT(DISTINCT e.id) as total_emails,
  COUNT(DISTINCT CASE WHEN e.approved = true THEN e.id END) as approved_emails,
  COUNT(DISTINCT CASE WHEN e.sent_at IS NOT NULL THEN e.id END) as sent_emails,
  COUNT(DISTINCT CASE WHEN e.opened_at IS NOT NULL THEN e.id END) as opened_emails,
  COUNT(DISTINCT CASE WHEN e.clicked_at IS NOT NULL THEN e.id END) as clicked_emails,
  COUNT(DISTINCT CASE WHEN cc.pipeline_stage = 'replied' THEN cc.id END) as replied_contacts,
  COUNT(DISTINCT CASE WHEN e.bounced_at IS NOT NULL THEN e.id END) as bounced_emails,
  
  -- Rates (as percentages)
  CASE WHEN COUNT(DISTINCT CASE WHEN e.sent_at IS NOT NULL THEN e.id END) > 0 
    THEN ROUND(100.0 * COUNT(DISTINCT CASE WHEN e.opened_at IS NOT NULL THEN e.id END) / 
         COUNT(DISTINCT CASE WHEN e.sent_at IS NOT NULL THEN e.id END), 1)
    ELSE 0 END as open_rate,
    
  CASE WHEN COUNT(DISTINCT CASE WHEN e.sent_at IS NOT NULL THEN e.id END) > 0 
    THEN ROUND(100.0 * COUNT(DISTINCT CASE WHEN e.clicked_at IS NOT NULL THEN e.id END) / 
         COUNT(DISTINCT CASE WHEN e.sent_at IS NOT NULL THEN e.id END), 1)
    ELSE 0 END as click_rate,
    
  CASE WHEN COUNT(DISTINCT CASE WHEN e.sent_at IS NOT NULL THEN e.id END) > 0 
    THEN ROUND(100.0 * COUNT(DISTINCT CASE WHEN cc.pipeline_stage = 'replied' THEN cc.id END) / 
         COUNT(DISTINCT CASE WHEN e.sent_at IS NOT NULL THEN e.id END), 1)
    ELSE 0 END as reply_rate

FROM campaigns c
LEFT JOIN contact_campaigns cc ON cc.campaign_id = c.id
LEFT JOIN emails e ON e.contact_campaign_id = cc.id
GROUP BY c.id, c.name, c.status, c.created_at;
