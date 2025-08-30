-- Create demo workspace for testing
-- Run this in your Supabase SQL editor

INSERT INTO workspaces (id, name, plan, owner_id, created_at) 
VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Demo Workspace', 
    'free', 
    'demo-user',
    now()
) 
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    updated_at = now();

-- Verify the workspace was created
SELECT * FROM workspaces WHERE id = '00000000-0000-0000-0000-000000000001';
