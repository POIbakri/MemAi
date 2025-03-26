-- Add missing columns to messages table
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS isError BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS isTyping BOOLEAN DEFAULT FALSE;

-- Update existing messages to have default values
UPDATE messages
SET isError = FALSE,
    reactions = '{}'::jsonb,
    isTyping = FALSE
WHERE isError IS NULL
   OR reactions IS NULL
   OR isTyping IS NULL; 