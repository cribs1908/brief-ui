-- Schema minimo + RLS per Brief AI (multi-tenant)

create extension if not exists pgcrypto;

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text default 'pro',
  owner_id uuid,
  created_at timestamptz default now()
);

create table if not exists runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  status text not null default 'CREATED',
  domain text,
  profile_version text,
  synonym_version text,
  prompt text,
  created_at timestamptz default now()
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  filename text not null,
  storage_path text not null,
  pages int,
  hash text,
  created_at timestamptz default now()
);

create table if not exists artifacts (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  page int not null,
  type text not null, -- table | ocr_text
  payload jsonb,
  bbox jsonb,
  created_at timestamptz default now()
);

create table if not exists extractions_raw (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  field_id text,
  value_raw text,
  unit_raw text,
  source text,
  confidence numeric,
  provenance jsonb,
  created_at timestamptz default now()
);

create table if not exists extractions_norm (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  field_id text,
  value text,
  unit text,
  note text,
  flags jsonb,
  provenance_ref text,
  confidence numeric,
  created_at timestamptz default now()
);

create table if not exists results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  columns jsonb,
  rows jsonb,
  highlights jsonb,
  exports jsonb,
  created_at timestamptz default now()
);

create table if not exists overrides (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  field_id text,
  value text,
  unit text,
  user_id uuid,
  created_at timestamptz default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor text,
  action text,
  target text,
  metadata jsonb,
  created_at timestamptz default now()
);

-- Profiles per domini
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  domain text not null,
  version text not null,
  schema jsonb not null,
  units jsonb,
  rules jsonb,
  synonyms_seed jsonb,
  created_at timestamptz default now(),
  unique(domain, version)
);

-- Synonym Map - workspace specific
create table if not exists synonyms_workspace (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  field_id text not null,
  variants text[] not null,
  score numeric default 0.5,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(workspace_id, field_id)
);

-- Synonym Map - global (promoted from workspace)
create table if not exists synonyms_global (
  id uuid primary key default gen_random_uuid(),
  field_id text not null unique,
  variants text[] not null,
  score numeric default 0.5,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Chat messages for Q&A functionality
create table if not exists messages_new (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

-- Additional tables for new schema compatibility
create table if not exists runs_new (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  status text not null default 'CREATED',
  domain text,
  profile_version text,
  synonym_version text,
  prompt text,
  created_at timestamptz default now()
);

create table if not exists results_new (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs_new(id) on delete cascade,
  table_json jsonb,
  export_csv_path text,
  source_map_path text,
  created_at timestamptz default now()
);

-- RLS abilitata
alter table workspaces enable row level security;
alter table runs enable row level security;
alter table documents enable row level security;
alter table artifacts enable row level security;
alter table extractions_raw enable row level security;
alter table extractions_norm enable row level security;
alter table results enable row level security;
alter table overrides enable row level security;
alter table audit_logs enable row level security;
alter table profiles enable row level security;
alter table synonyms_workspace enable row level security;
alter table synonyms_global enable row level security;
alter table messages_new enable row level security;
alter table runs_new enable row level security;
alter table results_new enable row level security;
alter table learning_patterns enable row level security;
alter table synonym_discoveries enable row level security;
alter table accuracy_metrics enable row level security;

-- Policy semplici (da restringere con auth quando abiliteremo Clerk)
create policy if not exists ws_all on workspaces for all using (true) with check (true);
create policy if not exists runs_all on runs for all using (true) with check (true);
create policy if not exists docs_all on documents for all using (true) with check (true);
create policy if not exists art_all on artifacts for all using (true) with check (true);
create policy if not exists exr_all on extractions_raw for all using (true) with check (true);
create policy if not exists exn_all on extractions_norm for all using (true) with check (true);
create policy if not exists res_all on results for all using (true) with check (true);
create policy if not exists ov_all on overrides for all using (true) with check (true);
create policy if not exists au_all on audit_logs for all using (true) with check (true);
create policy if not exists prof_all on profiles for all using (true) with check (true);
create policy if not exists synw_all on synonyms_workspace for all using (true) with check (true);
create policy if not exists syng_all on synonyms_global for all using (true) with check (true);
create policy if not exists msg_all on messages_new for all using (true) with check (true);
create policy if not exists runs_new_all on runs_new for all using (true) with check (true);
create policy if not exists res_new_all on results_new for all using (true) with check (true);
create policy if not exists learning_all on learning_patterns for all using (true) with check (true);
create policy if not exists synonyms_discoveries_all on synonym_discoveries for all using (true) with check (true);
create policy if not exists accuracy_all on accuracy_metrics for all using (true) with check (true);

-- Learning System Tables for Continuous Improvement
create table if not exists learning_patterns (
  id uuid primary key default gen_random_uuid(),
  field_id text not null,
  domain text not null,
  pattern_strength numeric not null default 0,
  sample_values jsonb,
  common_keywords jsonb,
  confidence_avg numeric,
  occurrence_count integer default 1,
  document_id uuid,
  created_at timestamptz default now()
);

create table if not exists synonym_discoveries (
  id uuid primary key default gen_random_uuid(),
  field_id text not null,
  domain text not null,
  new_synonyms jsonb not null,
  source_quote text,
  confidence numeric,
  document_id uuid,
  approved boolean default false,
  created_at timestamptz default now()
);

create table if not exists accuracy_metrics (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  domain text not null,
  field_id text,
  extracted_value text,
  confidence numeric,
  validation_result text,
  improvement_applied boolean default false,
  created_at timestamptz default now()
);

-- Add foreign key constraints after both tables exist
alter table if exists messages_new add constraint if not exists messages_run_fk foreign key (run_id) references runs_new(id) on delete cascade;
