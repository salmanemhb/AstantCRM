-- ============================================
-- DISABLE RLS ON ANALYTICS TABLES
-- These tables need to be accessible for webhook and API updates
-- ============================================

-- Disable RLS on analytics tables
ALTER TABLE IF EXISTS analytics_daily DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS contact_engagement DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS email_link_clicks DISABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate
DROP POLICY IF EXISTS "Allow all for anon" ON analytics_daily;
DROP POLICY IF EXISTS "Allow all for anon" ON contact_engagement;
DROP POLICY IF EXISTS "Allow all for anon" ON email_link_clicks;

-- Create permissive policies just in case RLS gets re-enabled
CREATE POLICY "Allow all for anon" ON analytics_daily FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON contact_engagement FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON email_link_clicks FOR ALL USING (true) WITH CHECK (true);
