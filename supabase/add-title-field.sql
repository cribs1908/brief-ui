-- Add title field to runs_new table for comparison archive functionality
-- This field stores user-editable comparison titles for the archive tab

alter table runs_new add column if not exists title text;

-- Add comment for documentation
comment on column runs_new.title is 'User-editable comparison title for archive display';

-- Create index for faster title searches/sorts  
create index if not exists idx_runs_new_title on runs_new(title);