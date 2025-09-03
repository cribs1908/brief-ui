
# PRD — Brief AI (Spec Sheet Comparison App)

**Owner:** Leonardo / Team
**Product:** Brief AI
**Hosting:** Vercel (Next.js frontend + API routes)
**Auth:** Clerk
**Billing:** Polar
**DB & Storage:** Supabase (Postgres + Storage + RLS)
**AI Pipeline:** LangChain
**Parsing:** Tabula (tables) + Google Cloud OCR (Cloud Run worker)
**Normalization:** Synonym Map (workspace + global)

---

## 1. Overview

**Problem**
Technical buyers and engineers must compare specs across PDFs (chips, APIs, SaaS). These PDFs are long, inconsistent, and often use different words for the same fields. Today, teams manually copy data into Excel, wasting hours.

**Solution**
Brief AI provides a **chat-like interface** where users upload PDFs and type a prompt. The system automatically extracts specs, normalizes them, and generates comparison tables with AI-powered insights. With every upload, a *Synonym Map* improves, creating a compounding asset that ensures higher recall over time.

---

## 2. Goals

* **Speed:** Reduce comparison of 2–5 PDFs (20–30 pages each) from hours to <1 minute.
* **Accuracy:** Provide normalized values with confidence scores and provenance (page + bbox).
* **Learning:** Improve synonym mapping continuously from user uploads and overrides.
* **Scalability:** Handle multiple domains (chips, APIs, SaaS, networking, storage, energy).
* **Trust:** Ensure every value is traceable to its original source.
* **Monetization:** Subscription model via Polar (Pro + Enterprise).

---

## 3. Tech Stack (high-level responsibilities)

* **Frontend (Next.js, Vercel)**

  * Chat-like tab for prompt + PDF uploads.
  * SSE/WebSocket stream of job states and partial results.
  * Display of comparison tables and insights.
  * Export to CSV/XLSX/JSON.
* **Auth (Clerk)**

  * User sign-in, multi-workspace support.
  * Roles: Admin, Editor, Viewer.
* **Payments (Polar)**

  * Subscription management (Pro, Enterprise).
  * Webhooks update plan + quotas in Supabase.
* **DB/Storage (Supabase)**

  * Postgres: jobs, documents, artifacts, extractions, synonyms, results, overrides, audit logs.
  * Storage: PDF files, exported results.
  * Row-level security (multi-tenant).
* **OCR (Cloud Run Worker + Google Cloud OCR/Document AI)**

  * Detect scanned pages.
  * Extract text, bounding boxes, simple tabular structures.
* **Tabula**

  * Parse vector-based tables directly from PDF.
* **LangChain**

  * Orchestration for semantic extraction.
  * Apply domain profiles + synonym snapshot.
  * Generate `extractions_raw` with candidates, confidence, provenance.
* **Normalizer**

  * Convert units, resolve ranges, canonicalize enums/lists.
  * Save `extractions_norm`.
* **Synonym Map**

  * Maps variants → canonical fields.
  * Two layers: global (shared) and workspace (custom).
  * Continuously updated from successful matches, overrides, and recurring candidates.

---

## 4. Core Features (v1 scope)

1. **Chat tab**

   * Upload 2–5 PDFs per run (max 500 pages each).
   * Type a natural-language prompt (optional).
   * Receive real-time job progress + final table.

2. **Extraction Pipeline**

   * Detect page type: vector table vs image.
   * Use Tabula (tables) or OCR (scans).
   * LangChain extracts fields based on profile + synonyms.
   * Normalizer unifies units, ranges, enums.
   * Table built with provenance links.

3. **AI Insights**

   * Plain-language commentary (e.g., “Chip B is 3× faster”).
   * Highlight best/worst per column.

4. **Synonym Map**

   * Learns automatically with every run.
   * Workspace overrides → new synonym candidates.
   * Promotions to global if variant is consistent across runs/workspaces.

5. **Export**

   * CSV, XLSX, JSON download.

6. **Archive & Database Access**

   * Saved comparisons.
   * Search across previously uploaded specs (Pro/Enterprise).

7. **Enterprise-only**

   * Red Flag Scan (highlight missing specs or compliance issues).
   * On-prem/self-host option.

---

## 5. System Architecture

### 5.1 Flow of a Run

1. User (via frontend): creates run → uploads PDFs (signed URL Supabase).
2. Backend: marks job `UPLOADED` → queues parsing.
3. Parsing:

   * For each page: Tabula (if vector) → `artifacts.table`
   * Otherwise Cloud Run OCR → `artifacts.ocr_text`
4. Extraction: LangChain → `extractions_raw` (value\_raw, unit\_raw, source, confidence).
5. Normalization: → `extractions_norm` (canonical value + unit, notes, flags).
6. Build: generate `results` (columns, rows, highlights, exports).
7. Stream updates: SSE to frontend (phases, progress, partials).
8. Learning: update synonym map (workspace + global candidates).

### 5.2 State Machine

`CREATED → UPLOADED → CLASSIFYING → PARSING → EXTRACTING → NORMALIZING → BUILDING → READY`
Terminal: `FAILED`, `PARTIAL`, `CANCELLED`.

### 5.3 Error taxonomy

* `PARSE_TABLE_FAIL`, `OCR_FAIL`, `AMBIGUOUS_RANGE`, `UNIT_CONFLICT`, `TIMEOUT`, `SERVICE_RATE_LIMIT`.

---

## 6. Data Model (Supabase, conceptual)

* **workspaces** `{ id, name, plan, owner_id }`
* **users** `{ id, email, clerk_id }`
* **memberships** `{ workspace_id, user_id, role }`
* **runs** `{ id, workspace_id, status, domain, profile_version, synonym_version, prompt, created_at }`
* **documents** `{ id, run_id, filename, storage_path, pages, hash }`
* **artifacts** `{ id, document_id, page, type, payload, bbox }`
* **extractions\_raw** `{ id, document_id, field_id, value_raw, unit_raw, source, confidence }`
* **extractions\_norm** `{ id, document_id, field_id, value, unit, note, flags, provenance_ref, confidence }`
* **results** `{ id, run_id, columns, rows, highlights, exports }`
* **profiles** `{ id, domain, version, schema, units, rules, synonyms_seed }`
* **synonyms\_workspace** `{ id, workspace_id, field_id, variants, score }`
* **synonyms\_global** `{ id, field_id, variants, score }`
* **overrides** `{ id, run_id, field_id, value, unit, user_id, created_at }`
* **audit\_logs** `{ id, actor, action, target, metadata, created_at }`

---

## 7. Acceptance Criteria

* User can upload 2–5 PDFs and receive comparison table within 60s p95.
* Every extracted cell has: value, unit, confidence, provenance\_ref.
* Synonym map snapshot applied per run; updates after run completion.
* Export generates CSV/XLSX/JSON consistent with UI.
* Enterprise plan enables red flag scan + self-host toggle.

---

## 8. Risks & Mitigations

* **Variability of PDFs** → fallback OCR + heuristics.
* **High OCR/LLM cost** → caching by PDF hash, batching.
* **Cold start synonyms** → seed initial profiles; improve with usage.
* **Data privacy** → strict retention (delete raw PDFs after N days).
* **User trust** → provenance + confidence must be transparent.

---