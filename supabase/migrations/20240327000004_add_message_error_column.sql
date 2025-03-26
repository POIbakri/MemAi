-- Add isError column to messages table
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS isError BOOLEAN DEFAULT FALSE;

-- Update existing messages to have isError set to false
UPDATE messages
SET isError = FALSE
WHERE isError IS NULL; 