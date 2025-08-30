-- Add clerk_user_id column to workspaces table
-- Run this in your Supabase SQL editor

ALTER TABLE workspaces 
ADD COLUMN clerk_user_id text;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_workspaces_clerk_user_id 
ON workspaces(clerk_user_id);

-- Optional: Update existing demo workspace with a test clerk user id
-- UPDATE workspaces 
-- SET clerk_user_id = 'demo-clerk-user' 
-- WHERE id = '00000000-0000-0000-0000-000000000001';

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'workspaces' 
AND column_name = 'clerk_user_id';