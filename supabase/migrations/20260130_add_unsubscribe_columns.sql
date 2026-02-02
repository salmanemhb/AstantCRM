-- Migration: Add unsubscribe columns to contacts table
-- Created: 2026-01-30

-- Add unsubscribe-related columns if they don't exist
DO $$ 
BEGIN
    -- Add unsubscribed boolean flag
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'contacts' AND column_name = 'unsubscribed') THEN
        ALTER TABLE contacts ADD COLUMN unsubscribed BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add unsubscribe preferences JSONB
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'contacts' AND column_name = 'unsubscribe_preferences') THEN
        ALTER TABLE contacts ADD COLUMN unsubscribe_preferences JSONB DEFAULT NULL;
    END IF;

    -- Add timezone column for time-based greetings
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'contacts' AND column_name = 'timezone') THEN
        ALTER TABLE contacts ADD COLUMN timezone TEXT DEFAULT NULL;
    END IF;

    -- Add location column for timezone detection
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'contacts' AND column_name = 'location') THEN
        ALTER TABLE contacts ADD COLUMN location TEXT DEFAULT NULL;
    END IF;
END $$;

-- Create index on unsubscribed for filtering
CREATE INDEX IF NOT EXISTS idx_contacts_unsubscribed ON contacts(unsubscribed);

-- Create index on email for deduplication lookups
CREATE INDEX IF NOT EXISTS idx_contacts_email_lower ON contacts(LOWER(email));

-- Add comment for documentation
COMMENT ON COLUMN contacts.unsubscribed IS 'Whether the contact has unsubscribed from all emails';
COMMENT ON COLUMN contacts.unsubscribe_preferences IS 'JSONB containing detailed unsubscribe preferences';
COMMENT ON COLUMN contacts.timezone IS 'IANA timezone string (e.g., America/New_York)';
COMMENT ON COLUMN contacts.location IS 'Location string for timezone detection';
