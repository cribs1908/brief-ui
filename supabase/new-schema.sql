-- Schema minimo per Brief AI (nuova struttura semplificata)
-- Sostituisce il complesso schema precedente con solo 4 tabelle

-- Estensioni necessarie
create extension if not exists pgcrypto;

-- ===== NUOVE TABELLE (solo 4) =====

-- Tabella runs semplificata
create table if not exists runs_new (
  id uuid primary key default gen_random_uuid(),
  user_id text not null, -- da Clerk
  workspace_id uuid, -- opzionale
  prompt text,
  status text not null default 'QUEUED' check (status in ('QUEUED', 'PROCESSING', 'READY', 'ERROR')),
  domain text default 'AUTO' check (domain in ('CHIP', 'SAAS', 'API', 'AUTO')),
  error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tabella documents semplificata
create table if not exists documents_new (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs_new(id) on delete cascade,
  filename text not null,
  storage_path text not null,
  pages int,
  ocr_used boolean default false,
  created_at timestamptz default now()
);

-- Tabella results per la tabella di comparazione
create table if not exists results_new (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs_new(id) on delete cascade,
  table_json jsonb not null, -- colonne/righe/units/best/worst/citations
  export_csv_path text,
  source_map_path text, -- JSON con testo-per-pagina e mappa {cell→(doc,page,quote)}
  created_at timestamptz default now(),
  unique(run_id)
);

-- Tabella messages per Q&A
create table if not exists messages_new (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs_new(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null, -- potrebbe anche essere jsonb se necessario
  created_at timestamptz default now()
);

-- ===== INDICI PER PERFORMANCE =====

create index if not exists idx_runs_new_user_id on runs_new(user_id);
create index if not exists idx_runs_new_workspace_id on runs_new(workspace_id);
create index if not exists idx_runs_new_status on runs_new(status);
create index if not exists idx_runs_new_created_at on runs_new(created_at desc);

create index if not exists idx_documents_new_run_id on documents_new(run_id);
create index if not exists idx_results_new_run_id on results_new(run_id);
create index if not exists idx_messages_new_run_id on messages_new(run_id);
create index if not exists idx_messages_new_created_at on messages_new(created_at);

-- ===== RLS (Row Level Security) =====

alter table runs_new enable row level security;
alter table documents_new enable row level security;
alter table results_new enable row level security;
alter table messages_new enable row level security;

-- Policy semplici - per ora permissive (da restringere con Clerk quando pronto)
-- Nota: se la policy esiste già, droppala prima manualmente
drop policy if exists runs_new_all on runs_new;
create policy runs_new_all on runs_new for all using (true) with check (true);

drop policy if exists documents_new_all on documents_new;
create policy documents_new_all on documents_new for all using (true) with check (true);

drop policy if exists results_new_all on results_new;
create policy results_new_all on results_new for all using (true) with check (true);

drop policy if exists messages_new_all on messages_new;
create policy messages_new_all on messages_new for all using (true) with check (true);

-- ===== FUNCTION PER AUTO-UPDATE updated_at =====

create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_runs_new_updated_at on runs_new;
create trigger update_runs_new_updated_at
  before update on runs_new
  for each row execute function update_updated_at_column();

-- ===== COMMENTI DELLA MIGRAZIONE =====

comment on table runs_new is 'Nuova tabella runs semplificata - sostituisce la complessa pipeline precedente';
comment on table documents_new is 'Documenti PDF caricati per ogni run - schema minimo';
comment on table results_new is 'Risultati della comparazione - tabella JSON + export paths';
comment on table messages_new is 'Chat/Q&A sui risultati - sistema di messaggi semplice';

comment on column runs_new.status is 'Stati semplificati: QUEUED → PROCESSING → READY | ERROR';
comment on column runs_new.domain is 'Dominio auto-detection o manuale: CHIP, SAAS, API, AUTO';
comment on column results_new.table_json is 'Tabella di comparazione completa in formato JSON';
comment on column results_new.source_map_path is 'Path al JSON con mappatura celle → sorgenti';
