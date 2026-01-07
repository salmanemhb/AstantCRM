-- Migration: Add template columns to campaigns table
-- Run this in your Supabase SQL Editor

-- Add new columns for AI-powered email templates
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS prompt TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS template_subject TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS template_body TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS contacts_count INTEGER DEFAULT 0;

-- Make global_context and cta optional (they were required before)
ALTER TABLE campaigns ALTER COLUMN global_context DROP NOT NULL;
ALTER TABLE campaigns ALTER COLUMN cta DROP NOT NULL;
ALTER TABLE campaigns ALTER COLUMN tone DROP NOT NULL;

-- Set default tone
ALTER TABLE campaigns ALTER COLUMN tone SET DEFAULT 'warm';
