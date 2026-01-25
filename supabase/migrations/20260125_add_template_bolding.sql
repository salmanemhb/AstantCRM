-- Add apply_bolding column to custom_templates table
-- This allows users to enable/disable the auto-bolding engine per template

ALTER TABLE custom_templates
ADD COLUMN IF NOT EXISTS apply_bolding BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN custom_templates.apply_bolding IS 'When true, the bolding engine will auto-bold keywords like names and companies. When false (default), only template markdown bold is preserved.';
