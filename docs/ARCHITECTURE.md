## Brief AI — Struttura e Architettura (stato attuale)

Questa pagina descrive in modo completo l'architettura e la struttura del progetto al momento dell'integrazione completa con **Clerk Auth + OCRmyPDF + Pipeline Production-Ready**. Il documento è allineato ai PRD in `main-prd.md` e `logic-prd.md`.

---

### 1. Panoramica
- Stack: **Next.js (App Router) + TypeScript** su Vercel/locale.
- **Auth**: **Clerk** per autenticazione e gestione utenti.
- UI: **Landing page** (per non autenticati) → **Chat premium** + tabs (Files, Archive, Settings) + tabella risultati (per autenticati).
- Backend: **API Routes Next.js** (serverless compatibili) con persistenza su **Supabase** (Postgres + Storage) e **SSE** per progress.
- Estrazione: **OCRmyPDF** (fallback: Google Document AI) → **Extraction (OpenAI gpt‑4o‑mini)** → **Normalizer** → **Synonym Map** → **Builder**.
- Storage PDF: **Supabase Storage** bucket privato `specsheets`.
- Multi‑tenant: path Storage e tabelle includono `workspace_id` (UUID format).

---

### 2. Frontend (UI)

#### 2.1 Architettura di Autenticazione
- **Landing Page** (non autenticati): Pagina nera con due pulsanti **Sign In** e **Sign Up** che reindirizzano a `/sign-in` e `/sign-up`.
- **Main App** (autenticati): Interfaccia completa con sidebar + chat + tabs.
- **Clerk Integration**: 
  - `<ClerkProvider>` wrappa l'intera app in `layout.tsx`.
  - `<SignedIn>` e `<SignedOut>` per conditional rendering.
  - `<UserButton>` sostituisce l'avatar nella sidebar.

#### 2.2 Pagine di Autenticazione
- `src/app/sign-in/[[...sign-in]]/page.tsx`: Pagina dedicata per login con styling personalizzato.
- `src/app/sign-up/[[...sign-up]]/page.tsx`: Pagina dedicata per registrazione con styling personalizzato.
- **Styling personalizzato**: Dark theme, font Geist Mono, colori allineati a `chat-ui-spec.md`.
- **Redirect**: Dopo logout → `https://trybriefai.com` (landing page Framer).

#### 2.3 Main App
- File principali:
  - `src/app/page.tsx`: interfaccia completa (sidebar + chat + tabs Files/Archive/Settings + Results), wiring client → API.
  - `src/app/globals.css`: tema scuro, token (panel, glass, btn, ecc.).
- **Sidebar**:
  - Pulsanti: Chat, Files, Archive, Settings (icone Phosphor). L'icona Chat riporta sempre al tab chat iniziale e resetta lo stato.
  - **UserButton** (Clerk) invece dell'avatar statico.
- **Chat** (Landing):
  - Upload 1–5 PDF (chips con nome) + prompt inline.
  - **Domain Detection** automatico: analizza prompt e nomi file per determinare dominio (Chip, SaaS, API).
  - Pulsante invio "premium" con gradient/stroke/shadow.
  - Animazione placeholder "Compare this two …" con caret.
  - Al submit: wiring `create → upload firmati → submit → events (SSE) → result`.
- **Results** (Tabella):
  - Struttura coerente con la UI (header con logo nome chat, Filter, Export CSV).
  - Corpo tabella scrollabile/elastic, overlay mini‑chat.
- **Files**: elenco mock PDF dell'utente con bottone "+" per aggiungere al confronto.
- **Archive**: elenco mock comparazioni archiviate (apre i risultati alla selezione).
- **Settings**: layout 2 colonne (menu sinistro + contenuti) con sezioni demo (Profile, Appearance, Security, ecc.).

Colori chiave: `#000000`, `#161616`, `#D9D9D9`, `#C0C0C0`. Componenti e stile coerenti con i PRD.

---

### 3. API Routes (server)

#### 3.1 Middleware di Protezione
- `src/middleware.ts`: **Clerk middleware** per protezione delle route con `createRouteMatcher`.
- Route pubbliche: `/`, `/sign-in/*`, `/sign-up/*`, `/api/billing/*`.
- Route protette: tutte le altre (richiedono autenticazione Clerk).

#### 3.2 Endpoints Principali
Percorsi in `src/app/api/chat/*`:

- `POST /api/chat/create`
  - Input: `{ workspaceId, files }`. Default `workspaceId='00000000-0000-0000-0000-000000000001'` (UUID demo).
  - Azioni: crea row in `runs`, genera **signed upload URLs** nel bucket `specsheets`:
    - Path: `workspace/{workspaceId}/runs/{runId}/documents/{docId}.pdf`.
  - **Error handling**: Verifica creazione run, logging dettagliato.
  - Output: `{ runId, uploadUrls: [{id, signedUrl, storagePath}], limits }`.

- `POST /api/chat/submit`
  - Input: `{ runId, workspaceId, prompt, files:[{id, storagePath}], useOcr, domain }`.
  - Azioni: **aggiorna** run (non più insert), inserisce in `documents`, porta `runs.status` a `UPLOADED`/`CLASSIFYING`.
  - **Error handling**: Verifica aggiornamento run, logging dettagliato.
  - Output: `{ ok: true, runId, useOcr, domain }`.

- `GET /api/chat/events?runId=...` (SSE)
  - **Timeout**: 5 minuti (`maxDuration = 300`).
  - Heartbeat ogni 15s.
  - **Pipeline Production-Ready**:
    1) `PARSING`: **Retry robusto** per fetch run (5 tentativi, exponential backoff), scarica PDF dal bucket.
    2) **OCR**: 
       - **OCRmyPDF** (primario): supporta PDF grandi, offline, no limiti API.
       - **Google Document AI** (fallback): se OCRmyPDF non disponibile.
       - **Mock data fallback**: se entrambi falliscono, continua con dati di test.
       - **Limiti**: Max 50 pagine per documento (OCR), 30 pagine per extraction.
    3) `EXTRACTING`: **OpenAI** (gpt‑4o‑mini) con **Domain Profiles** + **Synonym Map snapshot**.
    4) `NORMALIZING`: **Normalizer** completo con unit conversion, range handling, enum canonicalization.
    5) `BUILDING`: **Table Builder** con highlights, AI insights, export generation.
    6) `READY`: emette `finalResult` con insights.
  - **Error handling**: `.maybeSingle()` invece di `.single()` per evitare PGRST116, logging dettagliato.
  - Error taxonomy: `PIPELINE_ERROR`, `OCR_NOT_AVAILABLE`, `NO_DOCUMENTS`, ecc.

- `GET /api/chat/result?runId=...`
  - Restituisce la tabella (`results`) se presente; fallback mock altrimenti.

- `POST /api/chat/override`
  - Salva override (`overrides`) e aggiorna **Synonym Map** in real-time.
  - **Error handling**: `.maybeSingle()` per robustezza.

---

### 4. Librerie/Connettori

#### 4.1 Core Libraries
- `src/lib/supabase.ts` — factory client (admin/anon) + bucket name.
- `src/lib/env.ts` — loader/validator env + **OCR_ENGINE** selection.
- `src/lib/types.ts` — tipi (Run/Document/Artifacts/Extractions/Result/SSE) + **insights support**.
- `src/lib/client.ts` — helper client con **detailed logging** per SSE parsing.

#### 4.2 OCR Engines
- `src/lib/ocrmypdf.ts` — **NEW**: **OCRmyPDF** integration con:
  - Timeout e retry logic.
  - Cleanup automatico file temporanei.
  - Page splitting intelligente.
  - Check disponibilità runtime.
- `src/lib/ocr.ts` — **Google Document AI** con service account base64 (OCR fallback).

#### 4.3 AI Pipeline
- `src/lib/extract.ts` — **OpenAI** (gpt‑4o‑mini) extraction con:
  - **Domain-specific fields** (Chip, SaaS, API).
  - **Synonym snapshot** integration.
  - JSON strutturato + provenance tracking.
- `src/lib/normalizer.ts` — **NEW**: Normalizzazione completa:
  - Unit conversion (mA → A, MHz → Hz, ecc.).
  - Range handling (min/typ/max).
  - Enum canonicalization.
  - Outlier/ambiguity detection.
  - Flag system per quality tracking.

#### 4.4 Business Logic
- `src/lib/synonym-map.ts` — **NEW**: Synonym Map completo:
  - Workspace-specific + Global synonym management.
  - Learning signals (match_success, override_applied, candidate_seen).
  - Fuzzy matching + auto-seeding.
  - Real-time updates.
- `src/lib/profiles.ts` — **NEW**: Domain Profiles:
  - Campo definitions per SaaS, API, Chip.
  - Validation rules.
  - Field suggestions.
- `src/lib/builder.ts` — **NEW**: Table Builder:
  - Column generation dinamica.
  - Best/worst detection.
  - Outlier highlighting.
  - AI insights generation.
  - Export con signed URLs (CSV/JSON to Supabase Storage).

#### 4.5 Legacy
- `src/lib/tabula.ts` — connettore Tabula (non usato ora; errore se `TABULA_BASE_URL` mancante quando attivo).

---

### 5. Persistenza (Supabase)

#### 5.1 Storage
- Bucket Storage: `specsheets` (privato)
  - Path: `workspace/{workspaceId}/runs/{runId}/documents/{docId}.pdf`.

#### 5.2 Database Schema
Tabelle e RLS: aggiornate in `supabase/migrations.sql`.

**Core Tables:**
- `workspaces` `{id(UUID), name, plan, owner_id}`
- `runs` `{id(UUID), workspace_id(UUID), status, domain, prompt, created_at}`
- `documents` `{id(UUID), run_id(UUID), filename, storage_path, pages, hash}`
- `artifacts` `{id(UUID), document_id(UUID), page, type, payload, bbox}`
- `extractions_raw` `{id(UUID), document_id(UUID), field_id, value_raw, unit_raw, source, confidence, provenance}`
- `extractions_norm` `{id(UUID), document_id(UUID), field_id, value, unit, note, flags, provenance_ref, confidence}`
- `results` `{id(UUID), run_id(UUID), columns, rows, highlights, exports, insights}`
- `overrides` `{id(UUID), run_id(UUID), field_id, value, unit, user_id}`
- `audit_logs` `{id(UUID), actor, action, target, metadata}`

**NEW Business Logic Tables:**
- `profiles` `{id(UUID), domain, version, schema, units, rules, synonyms_seed}` — Domain profiles storage.
- `synonyms_workspace` `{id(UUID), workspace_id(UUID), field_id, variants, score}` — Workspace-specific synonyms.
- `synonyms_global` `{id(UUID), field_id, variants, score}` — Global promoted synonyms.

**Demo Data:**
- Demo workspace: `00000000-0000-0000-0000-000000000001` (creato via `create-demo-workspace.sql`).

Nota: RLS permissive ora (true) per demo; Clerk isolation attivabile.

---

### 6. Variabili d'Ambiente (.env.local)

#### 6.1 Authentication
- **Clerk**: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`.

#### 6.2 Database & Storage
- **Supabase**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET=specsheets`.

#### 6.3 AI Services
- **OpenAI**: `OPENAI_API_KEY`, `OPENAI_MODEL=gpt-4o-mini`.

#### 6.4 OCR Configuration
- **Engine Selection**: `OCR_ENGINE=ocrmypdf|docai` (default: `ocrmypdf`).
- **OCRmyPDF**: Richiede solo installazione locale (`pip install ocrmypdf`).
- **Document AI** (fallback): `DOC_AI_ENABLED=true|false`, `GCP_PROJECT_ID`, `GCP_LOCATION`, `GCP_PROCESSOR_ID`, `GCP_SERVICE_ACCOUNT_JSON_BASE64`.

#### 6.5 Legacy
- **Tabula** (futuro): `TABULA_BASE_URL=http://localhost:8001`.

**Error Handling**: Se una env critica manca, le routes rispondono 503 con messaggio chiaro + logging dettagliato.

---

### 7. Flusso end‑to‑end (Production-Ready)

#### 7.1 Authentication Flow
1) Utente visita app → **Landing Page** se non autenticato.
2) Click **Sign In/Sign Up** → Clerk authentication pages (`/sign-in`, `/sign-up`).
3) Successo → **Main App** con `<UserButton>` per profile management.
4) Logout → Redirect a `https://trybriefai.com`.

#### 7.2 Comparison Pipeline
1) **Create**: Client crea run → **/api/chat/create** con error handling + logging.
2) **Upload**: Client esegue **PUT** firmati su Storage per i PDF.
3) **Submit**: Client chiama **/api/chat/submit** con `{runId, files, prompt, domain}` + 1s wait.
4) **Processing**: Client apre SSE **/api/chat/events** con retry logic:
   - **OCRmyPDF** primary → **Document AI** fallback → **Mock data** fallback.
   - **Domain detection** + **Synonym snapshot** + **Normalization** + **Table building**.
5) **Results**: A `READY` client legge **/api/chat/result** con insights + export links.
6) **UI**: Mostra tabella con highlights + mini‑chat overlay.

---

### 8. Testing e Deployment

#### 8.1 Setup Locale
```bash
# 1. Install OCRmyPDF
pip install ocrmypdf
# or use provided script: ./install-ocrmypdf.sh

# 2. Environment
cp .env.example .env.local
# Add Clerk, Supabase, OpenAI keys

# 3. Database
# Run create-demo-workspace.sql in Supabase SQL Editor

# 4. Start
export PATH="/path/to/ocrmypdf/bin:$PATH"
npm run dev
```

#### 8.2 Test Flow
- **Authentication**: Sign up/in flows, UserButton functionality.
- **OCR Selection**: Test OCRmyPDF primary + Document AI fallback.
- **Pipeline**: Upload 2–5 PDF → see Extracting → Normalizing → Building → Table.
- **Database**: Verify `runs`, `documents`, `extractions_*`, `results`, `synonyms_*`.
- **Error Handling**: Test race conditions, missing files, OCR failures.

#### 8.3 Debug Tools
- **Browser Console**: Detailed SSE event logging.
- **Server Logs**: Pipeline step tracking con progress messages.
- **Test Scripts**: `test-backend.js`, `test-ocrmypdf.js`, `debug-path.js`.

---

### 9. Monitoring & Operatività

#### 9.1 Error Handling
- **Race condition protection**: Retry logic con exponential backoff.
- **Database robustness**: `.maybeSingle()` instead of `.single()`.
- **OCR resilience**: Multi-engine fallback + mock data.
- **Timeout management**: 5-minute pipeline timeout + step-level timeouts.

#### 9.2 Logging & Debugging
- **SSE Events**: Detailed client/server event logging.
- **Pipeline Progress**: Real-time step tracking con progress percentages.
- **Error Taxonomy**: Specific error codes per failure type.
- **Performance**: Pipeline execution time tracking.

#### 9.3 Scaling Considerations
- **OCRmyPDF**: Local processing, no API limits.
- **Document limits**: 50 pages OCR, 30 pages extraction per document.
- **Retry policies**: Configurable backoff + attempt limits.
- **Storage**: Versioned paths per workspace/run.

---

### 10. Prossimi Step (Roadmap)

#### 10.1 Enhanced Features
- **Tabula Integration**: Re-enable per tabelle vettoriali (primary) + OCR fallback.
- **Advanced Profiles**: Custom field definitions per workspace.
- **Export Enhancement**: XLSX generation + advanced formatting.
- **Synonym Learning**: Auto-promotion workspace → global synonyms.

#### 10.2 Infrastructure
- **Polar Integration**: Payment processing + subscription management.
- **Advanced RLS**: Full Clerk-based workspace isolation.
- **Performance**: Caching layer + batch processing.
- **Enterprise**: Self-hosting + compliance features.

#### 10.3 UI/UX
- **Real-time Collaboration**: Multi-user workspace support.
- **Advanced Filters**: Table filtering + sorting + search.
- **Export Templates**: Customizable output formats.
- **Mobile Responsive**: Tablet/phone optimization.

---

### 11. Architecture Decisions & Rationale

#### 11.1 OCRmyPDF over Document AI
- **Reliability**: Battle-tested on millions of PDFs.
- **Cost**: No API costs, offline processing.
- **Performance**: Better handling of large documents.
- **Maintenance**: Simpler deployment, fewer dependencies.

#### 11.2 Clerk over Custom Auth
- **Developer Experience**: Pre-built UI components + middleware.
- **Security**: Enterprise-grade auth + session management.
- **Features**: Multi-factor, social login, user management.
- **Scalability**: Handles user lifecycle + workspace management.

#### 11.3 Supabase over Custom Backend
- **Development Speed**: Instant APIs + real-time subscriptions.
- **Postgres**: Full SQL capabilities + JSON support.
- **Storage**: Integrated file storage + signed URLs.
- **RLS**: Row-level security for multi-tenancy.

#### 11.4 Domain-Driven Design
- **Profiles**: Domain-specific field definitions (Chip/SaaS/API).
- **Synonym Maps**: Context-aware field mapping + learning.
- **Normalization**: Domain-specific unit conversion + validation.
- **Export**: Format-specific output generation.