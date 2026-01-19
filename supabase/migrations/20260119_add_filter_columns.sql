-- ============================================
-- ADD FILTER COLUMNS TO CONTACT LISTS
-- Stores auto-detected filterable columns and their unique values
-- ============================================

-- Add filter_columns JSONB to contact_lists
-- Structure: { "Column Name": ["Value1", "Value2", ...], ... }
ALTER TABLE contact_lists 
ADD COLUMN IF NOT EXISTS filter_columns JSONB DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN contact_lists.filter_columns IS 
  'Auto-detected filterable columns from import. Format: {"Column": ["Value1", "Value2"]}';

-- Index for faster filtering queries
CREATE INDEX IF NOT EXISTS idx_contact_lists_filter_columns 
ON contact_lists USING GIN (filter_columns);
