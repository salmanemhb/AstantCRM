-- ============================================
-- ANALYTICS TABLES MIGRATION
-- Run in Supabase SQL Editor
-- ============================================

-- Add new event types to existing enum
DO $$ BEGIN
  ALTER TYPE engagement_event_enum ADD VALUE IF NOT EXISTS 'delivered';
  ALTER TYPE engagement_event_enum ADD VALUE IF NOT EXISTS 'bounced';
  ALTER TYPE engagement_event_enum ADD VALUE IF NOT EXISTS 'complained';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- DAILY AGGREGATED METRICS
-- ============================================

CREATE TABLE IF NOT EXISTS analytics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  
  -- Email counts
  emails_sent INTEGER DEFAULT 0,
  emails_delivered INTEGER DEFAULT 0,
  emails_opened INTEGER DEFAULT 0,
  emails_clicked INTEGER DEFAULT 0,
  emails_replied INTEGER DEFAULT 0,
  emails_bounced INTEGER DEFAULT 0,
  
  -- Unique counts (deduplicated)
  unique_opens INTEGER DEFAULT 0,
  unique_clicks INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT unique_daily_campaign UNIQUE(date, campaign_id)
);

-- Index for fast date-range queries
CREATE INDEX IF NOT EXISTS idx_analytics_daily_date ON analytics_daily(date);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_campaign ON analytics_daily(campaign_id);

-- ============================================
-- CONTACT ENGAGEMENT SCORES
-- ============================================

CREATE TABLE IF NOT EXISTS contact_engagement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE UNIQUE,
  
  -- Engagement score (0-100)
  engagement_score INTEGER DEFAULT 0 CHECK (engagement_score >= 0 AND engagement_score <= 100),
  
  -- Lifetime counts
  total_emails_sent INTEGER DEFAULT 0,
  total_opens INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  total_replies INTEGER DEFAULT 0,
  total_bounces INTEGER DEFAULT 0,
  
  -- Timestamps for recency
  last_email_at TIMESTAMPTZ,
  last_open_at TIMESTAMPTZ,
  last_click_at TIMESTAMPTZ,
  last_reply_at TIMESTAMPTZ,
  
  -- Computed tier based on score
  tier TEXT GENERATED ALWAYS AS (
    CASE 
      WHEN engagement_score >= 80 THEN 'hot'
      WHEN engagement_score >= 50 THEN 'warm'
      WHEN engagement_score >= 20 THEN 'cool'
      ELSE 'cold'
    END
  ) STORED,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for finding hot contacts
CREATE INDEX IF NOT EXISTS idx_contact_engagement_score ON contact_engagement(engagement_score DESC);
CREATE INDEX IF NOT EXISTS idx_contact_engagement_tier ON contact_engagement(tier);

-- ============================================
-- LINK CLICK TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS email_link_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID REFERENCES emails(id) ON DELETE CASCADE,
  
  original_url TEXT NOT NULL,
  click_count INTEGER DEFAULT 1,
  
  first_clicked_at TIMESTAMPTZ DEFAULT now(),
  last_clicked_at TIMESTAMPTZ DEFAULT now(),
  
  -- User agent info for device tracking
  user_agent TEXT,
  ip_country TEXT,
  
  CONSTRAINT unique_email_url UNIQUE(email_id, original_url)
);

CREATE INDEX IF NOT EXISTS idx_link_clicks_email ON email_link_clicks(email_id);

-- ============================================
-- EMAIL TRACKING METADATA
-- Store Resend message IDs for webhook correlation
-- ============================================

ALTER TABLE emails ADD COLUMN IF NOT EXISTS resend_message_id TEXT;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS bounced_at TIMESTAMPTZ;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS bounce_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_emails_resend_id ON emails(resend_message_id);

-- ============================================
-- HELPER FUNCTION: Update engagement score
-- ============================================

CREATE OR REPLACE FUNCTION update_engagement_score(p_contact_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_score INTEGER;
  v_days_since_activity INTEGER;
  v_engagement RECORD;
BEGIN
  -- Get current engagement data
  SELECT * INTO v_engagement FROM contact_engagement WHERE contact_id = p_contact_id;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- Base score from actions
  v_score := 0;
  v_score := v_score + (v_engagement.total_opens * 5);    -- 5 pts per open
  v_score := v_score + (v_engagement.total_clicks * 15);   -- 15 pts per click
  v_score := v_score + (v_engagement.total_replies * 30);  -- 30 pts per reply
  
  -- Recency bonus
  v_days_since_activity := EXTRACT(DAY FROM (NOW() - COALESCE(
    v_engagement.last_reply_at,
    v_engagement.last_click_at,
    v_engagement.last_open_at,
    v_engagement.last_email_at
  )));
  
  IF v_days_since_activity < 7 THEN
    v_score := v_score + 20;
  ELSIF v_days_since_activity < 30 THEN
    v_score := v_score + 10;
  END IF;
  
  -- Cap at 100
  v_score := LEAST(v_score, 100);
  
  -- Update the score
  UPDATE contact_engagement 
  SET engagement_score = v_score, updated_at = NOW()
  WHERE contact_id = p_contact_id;
  
  RETURN v_score;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: Auto-create engagement record on email send
-- ============================================

CREATE OR REPLACE FUNCTION ensure_contact_engagement()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert engagement record if not exists
  INSERT INTO contact_engagement (contact_id, last_email_at, total_emails_sent)
  VALUES (
    (SELECT contact_id FROM contact_campaigns WHERE id = NEW.contact_campaign_id),
    NEW.sent_at,
    1
  )
  ON CONFLICT (contact_id) DO UPDATE SET
    total_emails_sent = contact_engagement.total_emails_sent + 1,
    last_email_at = NEW.sent_at,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_email_sent_engagement ON emails;
CREATE TRIGGER trigger_email_sent_engagement
  AFTER UPDATE OF sent_at ON emails
  FOR EACH ROW
  WHEN (OLD.sent_at IS NULL AND NEW.sent_at IS NOT NULL)
  EXECUTE FUNCTION ensure_contact_engagement();

-- ============================================
-- SUMMARY VIEW: Campaign Analytics
-- ============================================

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
  COUNT(DISTINCT CASE WHEN cc.stage = 'replied' THEN cc.id END) as replied_contacts,
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
    THEN ROUND(100.0 * COUNT(DISTINCT CASE WHEN cc.stage = 'replied' THEN cc.id END) / 
         COUNT(DISTINCT CASE WHEN e.sent_at IS NOT NULL THEN e.id END), 1)
    ELSE 0 END as reply_rate

FROM campaigns c
LEFT JOIN contact_campaigns cc ON cc.campaign_id = c.id
LEFT JOIN emails e ON e.contact_campaign_id = cc.id
GROUP BY c.id, c.name, c.status, c.created_at;

COMMENT ON VIEW campaign_analytics IS 'Pre-aggregated campaign metrics for dashboard';
