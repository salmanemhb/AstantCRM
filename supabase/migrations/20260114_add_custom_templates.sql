-- ============================================
-- CUSTOM EMAIL TEMPLATES
-- User-imported templates with AI-detected placeholders
-- ============================================

CREATE TABLE custom_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'investor', -- investor, partner, media, follow-up, event, client
  description TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  placeholders JSONB NOT NULL DEFAULT '[]', -- Array of placeholder names detected by AI
  created_by TEXT, -- team member id who created it
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for faster category lookups
CREATE INDEX idx_custom_templates_category ON custom_templates(category);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_custom_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER custom_templates_updated_at
  BEFORE UPDATE ON custom_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_custom_templates_updated_at();
