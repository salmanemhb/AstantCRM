-- Migration: Disable RLS or add permissive policies for development
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard)

-- Option 1: Disable RLS entirely (for development only)
ALTER TABLE contact_lists DISABLE ROW LEVEL SECURITY;
ALTER TABLE contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns DISABLE ROW LEVEL SECURITY;
ALTER TABLE contact_campaigns DISABLE ROW LEVEL SECURITY;
ALTER TABLE emails DISABLE ROW LEVEL SECURITY;
ALTER TABLE unified_threads DISABLE ROW LEVEL SECURITY;
ALTER TABLE relationship_memory DISABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets DISABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_events DISABLE ROW LEVEL SECURITY;

-- Option 2: If you want to keep RLS enabled, use these permissive policies instead
-- Uncomment and run these if you prefer to keep RLS on

/*
-- Allow all operations for anon users (development)
CREATE POLICY "Allow all for anon" ON contact_lists FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON campaigns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON contact_campaigns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON emails FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON unified_threads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON relationship_memory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON media_assets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON engagement_events FOR ALL USING (true) WITH CHECK (true);
*/
