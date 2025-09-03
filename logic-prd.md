PRD Tecnico — Brief AI (Spec Sheet Comparison)

Owner: Leonardo / Team
Prodotto: Brief AI — AI-powered spec sheet comparison
Hosting: Vercel (Next.js App Router)

1. Overview

Brief AI è un’applicazione che permette di caricare più PDF di spec sheet (chips, API, SaaS, networking, ecc.) e generare una tabella comparativa normalizzata con AI Insights.

La logica principale si sviluppa su un flusso a stati:
CREATED → UPLOADED → PARSING (Tabula/OCR) → EXTRACTING (LangChain) → NORMALIZING (Synonym Map) → BUILDING (Table/Insights) → READY.

2. Obiettivi

Automazione completa del confronto di 2–5 PDF (fino a 200 pagine ciascuno).

Precisione e trasparenza: ogni cella deve avere valore, unità, confidenza e provenienza.

Miglioramento continuo: ogni upload arricchisce la Synonym Map (workspace + globale).

Scalabilità multi-dominio: pipeline generica, adattata via profili.

Enterprise ready: on-prem, red-flag scan, controllo dei dati.

3. Tech Stack e Ruoli
Frontend — Next.js (Vercel)

Responsabilità:

UI stile chat per prompt + upload PDF.

Invio job (/api/chat/submit).

Ascolto SSE (/api/chat/events).

Rendering tabella, highlight best/worst, AI insights.

Export CSV/XLSX/JSON.

Integrazione:

Usa Clerk per auth (getAuth() in server actions).

Passa userId, workspaceId, plan.

Blocca azioni se quote (da Polar) esaurite.

Auth — Clerk

Responsabilità:

Login/Signup.

Multi-workspace.

Ruoli (admin/editor/viewer).

Integrazione:

Middleware Next.js.

Ogni API route valida userId → workspaceId con RLS su Supabase.

Billing — Polar

Responsabilità:

Subscription (Pro, Enterprise).

Aggiornamento quote (jobs, pagine, OCR).

Integrazione:

Webhook → /api/billing/polar.

Aggiorna workspaces.plan e quote in Supabase.

Frontend mostra upgrade UI se piano limitato.

DB + Storage — Supabase

Responsabilità:

Database relazionale multi-tenant.

Storage PDF (upload/download via URL firmati).

RLS per isolamento per workspace.

Tabelle chiave:

workspaces, users, memberships

runs, documents, artifacts

extractions_raw, extractions_norm, results

profiles, synonyms_workspace, synonyms_global

overrides, audit_logs

Integrazione:

File upload → Supabase Storage.

Export results → Storage firmato.

Jobs, artifacts e synonyms in Postgres.

Parsing PDF — Tabula

Responsabilità:

Estrarre tabelle da PDF vettoriali.

Output JSON con celle e coordinate (bbox).

Integrazione:

Worker interno “Parse”.

Per pagina PDF: prova Tabula. Se fallisce → OCR.

Output in artifacts (type=table).

OCR — Cloud Run Worker + Google Cloud Document AI

Responsabilità:

Gestire pagine scansionate.

Output: testo + bounding box + tabelle base.

Integrazione:

Worker su Cloud Run che riceve PDF/page → chiama Google Cloud OCR → ritorna JSON.

Output in artifacts (type=ocr_text).

Sicurezza:

Invocazione autenticata (OIDC service-to-service).

Orchestrazione — LangChain

Responsabilità:

Estrarre campi semantici da artifacts (tabelle + testo OCR).

Usare profilo dominio + snapshot Synonym Map.

Output in extractions_raw.

Integrazione:

Definisce prompt strutturati.

Passa sinonimi (es. “Iout” = “Output Current”).

Genera confidenza, candidati alternativi, provenienza (page + bbox).

Normalizer

Responsabilità:

Uniformare unità (es. mA → A).

Gestire range (min/typ/max).

Canonicalizzare enum/list (es. “OAuth2” = “OAuth 2.0”).

Flag outlier/ambiguità.

Output: extractions_norm.

Synonym Map

Responsabilità:

Collegare varianti linguistiche → campo canonico.

Aggiornarsi ad ogni job (learning).

Workspace map: sinonimi specifici di team.

Global map: sinonimi promossi (cross-workspace).

Learning loop:

match_success → rafforza sinonimo.

override_applied → nuovo mapping forte.

candidate_seen → propone varianti deboli.

4. Flussi principali
Run (job) flow

/api/chat/create → crea run + URL firmati per upload.

Utente carica PDF → /api/chat/submit.

Stato UPLOADED → pipeline:

Parsing: Tabula/OCR → artifacts.

Extraction: LangChain → raw extractions.

Normalization: normalizer → norm extractions.

Build: results (table + highlights + insights).

Frontend ascolta /api/chat/events (SSE).

Stato finale = READY.

Override flow

Utente modifica cella tabella.

/api/chat/override salva override + aggiorna synonyms.

Learner aggiorna synonyms_workspace e propone global candidate.

Export flow

/api/chat/result → link a CSV/XLSX/JSON in Supabase Storage.

5. Contratti API (Next.js)
POST /api/chat/create

Body: { workspaceId }
Res: { runId, uploadUrls: [{id, signedUrl}], limits }

POST /api/chat/submit

Body: { runId, files: [{id, storagePath}], prompt }
Res: { ok: true }

GET /api/chat/events?runId=...

SSE stream → eventi status, progress, partialResult, finalResult.

GET /api/chat/result?runId=...

Res: { resultId, columns, rows, highlights, exports }

POST /api/chat/override

Body: { runId, fieldId, value, unit }
Res: { ok: true }

6. Acceptance Criteria

3 PDF (20 pagine) → tabella comparativa entro 60s p95.

Ogni valore ha confidenza + provenienza.

Synonym snapshot applicato per job.

Synonym map aggiornata dopo job.

Export coerente con tabella.

7. Rischi e mitigazioni

PDF eterogenei → fallback OCR.

Costi OCR/LLM → caching su hash PDF.

Sinonimi insufficienti → seed iniziale + learning loop.

Compliance enterprise → on-prem deploy + data retention policy.
