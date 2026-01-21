-- Add increment_daily_stat RPC function for atomic analytics updates
-- This function atomically increments a stat field in analytics_daily

CREATE OR REPLACE FUNCTION increment_daily_stat(
    p_date DATE,
    p_campaign_id UUID,
    p_field TEXT
)
RETURNS VOID AS $$
DECLARE
    v_record_exists BOOLEAN;
BEGIN
    -- Check if valid field (matches analytics_daily column names)
    IF p_field NOT IN ('emails_sent', 'emails_delivered', 'emails_opened', 'emails_clicked', 'emails_replied', 'emails_bounced', 'unique_opens', 'unique_clicks') THEN
        RAISE EXCEPTION 'Invalid field name: %', p_field;
    END IF;

    -- Check if record exists
    SELECT EXISTS (
        SELECT 1 FROM analytics_daily 
        WHERE date = p_date AND campaign_id IS NOT DISTINCT FROM p_campaign_id
    ) INTO v_record_exists;

    IF v_record_exists THEN
        -- Update existing record
        EXECUTE format('UPDATE analytics_daily SET %I = COALESCE(%I, 0) + 1, updated_at = NOW() WHERE date = $1 AND campaign_id IS NOT DISTINCT FROM $2', p_field, p_field)
        USING p_date, p_campaign_id;
    ELSE
        -- Insert new record with the field set to 1
        EXECUTE format('INSERT INTO analytics_daily (date, campaign_id, %I) VALUES ($1, $2, 1)', p_field)
        USING p_date, p_campaign_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION increment_daily_stat(DATE, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_daily_stat(DATE, UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION increment_daily_stat(DATE, UUID, TEXT) TO service_role;
