-- Missing tables for Brief AI production
-- Run this in your Supabase SQL Editor to fix the "table not found" errors

-- Create missing artifacts_new table
create table if not exists artifacts_new (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs_new(id) on delete cascade,
  document_id uuid not null references documents_new(id) on delete cascade,
  artifact_type text not null, -- ocr_text | table | raw_extraction
  content jsonb not null, -- OCR pages, extracted data, etc.
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- Create missing extractions_raw_new table
create table if not exists extractions_raw_new (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs_new(id) on delete cascade,
  document_id uuid not null references documents_new(id) on delete cascade,
  domain_type text not null,
  raw_data jsonb not null, -- Array of FieldExtraction objects
  extraction_prompt text,
  created_at timestamptz default now()
);

-- Create missing extractions_norm_new table  
create table if not exists extractions_norm_new (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs_new(id) on delete cascade,
  document_id uuid not null references documents_new(id) on delete cascade,
  domain_type text not null,
  normalized_data jsonb not null, -- Array of normalized extraction objects
  created_at timestamptz default now()
);

-- Add missing columns to results_new table
alter table results_new add column if not exists domain_type text;
alter table results_new add column if not exists comparison_table jsonb;
alter table results_new add column if not exists insights text[];
alter table results_new add column if not exists metadata jsonb default '{}';

-- Add missing columns to runs_new table for processing status
alter table runs_new add column if not exists started_at timestamptz;
alter table runs_new add column if not exists completed_at timestamptz;
alter table runs_new add column if not exists has_results boolean default false;
alter table runs_new add column if not exists error_message text;

-- Create indices for performance
create index if not exists idx_artifacts_new_run_id on artifacts_new(run_id);
create index if not exists idx_artifacts_new_document_id on artifacts_new(document_id);
create index if not exists idx_extractions_raw_new_run_id on extractions_raw_new(run_id);
create index if not exists idx_extractions_raw_new_document_id on extractions_raw_new(document_id);
create index if not exists idx_extractions_norm_new_run_id on extractions_norm_new(run_id);
create index if not exists idx_extractions_norm_new_document_id on extractions_norm_new(document_id);

-- Enable RLS on new tables
alter table artifacts_new enable row level security;
alter table extractions_raw_new enable row level security;
alter table extractions_norm_new enable row level security;

-- Create permissive policies (to be refined later with Clerk integration)
drop policy if exists artifacts_new_all on artifacts_new;
create policy artifacts_new_all on artifacts_new for all using (true) with check (true);

drop policy if exists extractions_raw_new_all on extractions_raw_new;
create policy extractions_raw_new_all on extractions_raw_new for all using (true) with check (true);

drop policy if exists extractions_norm_new_all on extractions_norm_new;
create policy extractions_norm_new_all on extractions_norm_new for all using (true) with check (true);

-- Add table comments
comment on table artifacts_new is 'OCR results, tables, and other processing artifacts';
comment on table extractions_raw_new is 'Raw AI field extraction results from OpenAI';
comment on table extractions_norm_new is 'Normalized and cleaned extraction data';
comment on column results_new.comparison_table is 'Complete comparison table with columns, rows, highlights';
comment on column results_new.insights is 'AI-generated insights about the comparison';