-- Add new columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS location_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS photo_sync_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS calendar_sync_enabled BOOLEAN DEFAULT false;

-- Update existing rows to have default values
UPDATE users
SET 
  location_enabled = false,
  photo_sync_enabled = false,
  calendar_sync_enabled = false
WHERE location_enabled IS NULL
   OR photo_sync_enabled IS NULL
   OR calendar_sync_enabled IS NULL; 