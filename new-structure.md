# PRD — Backend “Brief AI” (versione semplificata, UI invariata)

## 0) Obiettivo

Fornire **un unico flusso semplice e robusto**: l’utente carica **fino a 4 PDF** (+ prompt) e ottiene **una tabella di comparison** accurata, con la possibilità di **fare domande all’AI** sulla tabella e sui PDF caricati.
Focus: affidabilità, tempi prevedibili, costi bassi, facilità di manutenzione. **Niente feature extra** oltre a upload → comparison → Q\&A.

---

## 1) Decisioni chiave (scelte semplici)

* **OCR/Text extraction**:
  **Strategy “text-first + OCR fallback”**

  1. Estrarre il testo direttamente dal PDF (se c’è il text layer).
  2. Se manca/è scarso, inviare il file a **OCRmyPDF** esposto come **microservizio Docker** (unico engine).
     *Motivo*: zero lock-in, qualità buona, integrazione via una semplice HTTP API. Niente più doppie integrazioni o runtime pesanti in serverless.

* **Modello AI**:
  **OpenAI “mini” multimodale per estrazione/normalizzazione & Q\&A** (es. *gpt-4o-mini / o4-mini*).
  *Motivo*: costo basso, output JSON strutturato affidabile, abbastanza contesto se lavoriamo per pagine/chunk.

* **Orchestrazione**:
  Next.js API (Vercel) invia un job a un **Worker** esterno (container su Railway/Fly/Cloud Run).
  *Motivo*: evitare limiti di runtime serverless durante parsing/OCR su PDF lunghi.

* **Persistenza**:
  Restiamo su **Supabase (Postgres + Storage)**, ma **schema minimo** (4 tabelle).
  *Motivo*: ridurre complessità ed errori.

* **Streaming stato**:
  **SSE “/events”** con stati essenziali: `QUEUED → PROCESSING → READY | ERROR`.

* **Limiti tecnici iniziali**:
  max **4 PDF/run**, **120 pagine/PDF**, **30 MB/PDF** (configurabili). Se superati → errore chiaro.

---

## 2) Cosa rimuoviamo dell’architettura attuale (per semplificare)

* ❌ **Document AI** come secondo engine (niente doppi provider).
* ❌ **Tabula** e tutta la logica per tabelle vettoriali.
* ❌ **Synonym Map** persistente e auto-learning continuo (teniamo un **piccolo seed statico** per dominio in codice).
* ❌ **Profiles avanzati** per dominio, **extractions\_raw / extractions\_norm**, **artifacts**, **overrides**, **audit\_logs**.
* ❌ **Normalizer complesso** (conversioni/flags avanzati).
* ❌ **RLS avanzata multi-tenant** in questa fase (manteniamo isolamento per `user_id/workspace_id` ma senza policy complesse).
* ❌ Pipeline “production-ready” a 5–6 step profondi.
* ❌ Limiti separati OCR vs extraction: usiamo **un’unica soglia di pagine** e un **unico flusso**.

---

## 3) Nuova architettura (panoramica)

**Componenti**

* **Next.js API (Vercel)**: endpoint leggeri, auth Clerk, firma upload, avvio job, SSE degli stati, fetch del risultato.
* **Worker (Docker)**: Node/Python in un container (Railway/Fly/Cloud Run). Fa: download PDF → text-first → OCR fallback (OCRmyPDF) → chunking → estrazione AI → allineamento campi → normalizzazione base → build tabella → salvataggio risultato.
* **Supabase**: Storage (PDF + JSON/CSV risultati), Postgres per 4 tabelle minime.

**Flusso**

1. `createRun` → genera **signed URLs** per upload su Storage.
2. Client carica i PDF.
3. `submitRun` → enqueue verso **Worker** (HTTP POST).
4. Worker elabora e scrive su Supabase; invia progress → Next.js inoltra via **SSE**.
5. `getResult` → ritorna la **tabella JSON** + link export CSV/JSON.
6. Q\&A: `chat` → contesto = **tabella** + **pagine rilevanti** (testo per-pagina salvato).

---

## 4) Modello dati (schema minimo)

**`runs`**

* `id` (uuid, pk)
* `user_id` (text) — da Clerk
* `workspace_id` (uuid | null) — opzionale
* `prompt` (text)
* `status` (enum: QUEUED|PROCESSING|READY|ERROR)
* `domain` (enum: CHIP|SAAS|API|AUTO)
* `error` (text | null)
* `created_at`, `updated_at`

**`documents`**

* `id` (uuid, pk)
* `run_id` (uuid, fk)
* `filename` (text)
* `storage_path` (text)
* `pages` (int | null)
* `ocr_used` (bool default false)

**`results`**

* `id` (uuid, pk)
* `run_id` (uuid, fk, unique)
* `table_json` (jsonb)  ← colonne/righe/units/best/worst/citations
* `export_csv_path` (text | null)
* `source_map_path` (text | null)  ← JSON con testo-per-pagina e mappa {cell→(doc,page,quote)} salvato in Storage

**`messages`** (per Q\&A sul risultato)

* `id` (uuid, pk)
* `run_id` (uuid, fk)
* `role` (enum: user|assistant|system)
* `content` (text / jsonb)
* `created_at`

> **Cancellate** tutte le altre tabelle dell’impianto precedente.

**Storage (Supabase)**

* Bucket privato `specsheets/`

  * `workspace/{workspaceId}/runs/{runId}/documents/{docId}.pdf`
  * `workspace/{workspaceId}/runs/{runId}/result/table.json`
  * `workspace/{workspaceId}/runs/{runId}/result/table.csv`
  * `workspace/{workspaceId}/runs/{runId}/result/source_map.json`

---

## 5) Endpoints (Next.js API)

* `POST /api/chat/create`
  **in**: `{ workspaceId? }`
  **out**: `{ runId, uploadUrls: [{id, signedUrl, storagePath}], maxFiles:4, maxSizeMb:30 }`

* `POST /api/chat/submit`
  **in**: `{ runId, prompt, domain:"AUTO"|... , files:[{id, storagePath}] }`
  **azione**: set `runs.status="QUEUED"`, POST al Worker (`/jobs/compare`). **No business logic qui.**
  **out**: `{ ok:true }`

* `GET /api/chat/events?runId=...` (SSE)
  **payload**: `{ status, progress, message }` fino a `READY|ERROR`.

* `GET /api/chat/result?runId=...`
  **out**: `{ table, exportCsvUrl, citationsAvailable:true }`

* `POST /api/chat/qna`
  **in**: `{ runId, message }`
  **azione**: recupera `table_json` + parti rilevanti di `source_map.json` → chiama modello AI → salva in `messages`.
  **out**: `{ reply }`

* **Listing per Files/Archive (riuso UI attuale)**

  * `GET /api/files` → ritorna `documents` ultimi n con link view/download.
  * `GET /api/comparisons` → ritorna `runs` READY con metadata (prompt, created\_at).

---

## 6) Worker: pipeline semplice (dettaglio)

**Input**: `{ runId, prompt, domain, files:[{storage_path, filename}] }`

**Step A — Fetch & Preprocess**

1. Scarica PDF da Storage.
2. Per ogni PDF, tenta **estrazione testo** (pdfminer/pdfjs in container).
3. Se il testo è < soglia (es. < 2000 char) **→ OCRmyPDF** (stesso file, stesso path “-ocr.pdf”), poi ri-estrai testo.
4. Salva **testo per pagina** in una struttura:
   `pages[pageNumber] = { text, charCount }`.

**Step B — Domain & Field seed**

* Se `domain="AUTO"`, fai un prompt rapido al modello **solo sul sommario** (prime 3 pagine) per classificare in `CHIP|SAAS|API`.
* Carica da codice un **piccolo seed** per dominio (20–40 campi comuni con sinonimi e unità preferite). *File JSON in repo*.

**Step C — Candidate extraction (per pagine, cheap)**

* Per ogni **pagina**, chiedi al modello **economico** di estrarre **coppie campo→valore** solo dai **field seed** + pattern numerici (JSON compatto con page ref).
* Unisci i candidati per documento: per ogni campo tieni la **miglior occorrenza** (regole: confidenza del modello, presenza unità, prossimità ai sinonimi, preferisci spec tables, ecc.).

**Step D — Alignment & Normalization (leggera)**

* Costruisci l’**insieme unione** dei campi emersi su tutti i documenti.
* Per ogni campo+documento:

  * normalizza unità **sulla base del seed** (conversioni semplici: mA↔A, MHz↔Hz, %, booleani).
  * tieni `value`, `unit`, `page`, `quote` (brevi 1-2 frasi).

**Step E — Build comparison table (single pass “smart”)**

* Chiamata al modello (unica) con:

  * **schema target** (lista campi allineati),
  * **valori per documento**,
  * **regole “best/worst”** (es. maggiore-è-meglio o minore-è-meglio dal seed).
* Output: `{ columns, rows }` + `highlights` (3–5 bullet), sempre **JSON valido**.
* Genera **CSV** e **source\_map.json** (mappa cella→doc/page/quote).
* Scrivi `results` + file su Storage, set `runs.status="READY"`.

**Errori** → set `runs.status="ERROR"` con `error`.

**Performance target (indicativi)**

* 2 PDF × 60 pagine: 40–120s.
* 4 PDF × 120 pagine: 3–7 min (dipende dall’OCR).
* Costi AI contenuti (estrazione per pagina = cheap, finale = 1 call).

---

## 7) Prompting (linee guida)

* **Per pagina (candidati)**:
  “From this single page text, extract values for the following normalized fields if present … Return compact JSON `{field_id, value, unit, confidence, quote}`. If absent, omit. Do not guess.”

* **Allineamento finale**:
  “Given candidates per document and the normalized field seed (with preferred units), build a comparison table that: … Always include `page` and `quote` for each filled cell in a separate `source_map` object.”

* **Q\&A**:
  “Answer using only the `table_json` and the provided `relevant_pages` texts. If uncertain, say what’s missing. When citing, reference doc label and page.”

---

## 8) Sicurezza & limiti

* Autenticazione **Clerk** su tutte le route (tranne landing).
* RLS semplice per `runs.user_id = auth.uid` (o mapping Clerk).
* **Validazione** upload: tipo MIME PDF, dimensione, numero file ≤ 4.
* **Sanitizzazione** prompt (lunghezza max).
* **Timeout** Worker per job (es. 12 min), retry 1 volta solo se errore temporaneo.
* **Quota** per utente (run/giorno) configurabile.

---

## 9) Variabili d’ambiente (ridotte)

* `OPENAI_API_KEY`
* `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET=specsheets`
* `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
* `WORKER_BASE_URL` (es. [https://brief-worker.yourdomain.com](https://brief-worker.yourdomain.com))
* `OCR_API_URL` (esposto dal container OCRmyPDF)

*(Niente `DOC_AI_*`, niente `TABULA_*`.)*

---

## 10) Migrazione dall’attuale

1. **DB**: crea nuove 4 tabelle; droppa le tabelle extra o lasciale in “legacy” (ma non più usate).
2. **API Next.js**:

   * Mantieni `/create`, `/submit`, `/events`, `/result`, **/qna** (nuovo).
   * Rimuovi codice per **Document AI**, **Tabula**, **Synonym Map** persistente, **Normalizer** avanzato.
3. **Worker**: nuovo repo/container con tre moduli:

   * `extract_text` (pdf → pages text, OCR fallback via OCRmyPDF microservizio)
   * `build_candidates` (per pagina)
   * `assemble_table` (allineamento + output finale + export)
4. **UI**: nessun cambiamento. (Gli endpoint e i payload restano compatibili, “results.table\_json” mantiene struttura simile; la mini-chat usa `/qna`.)
5. **SSE**: inviare stati semplici; rimuovere i sottostati dettagliati.

---

## 11) Test plan (essenziale)

* **Unit**:

  * PDF con text layer vs scansionato → verifica OCR fallback.
  * Conversioni unità base (mA↔A, MHz↔Hz, boolean).
* **E2E**:

  * 2×PDF 20 pagine → risultato < 90s, CSV coerente, citations presenti.
  * 4×PDF 100+ pagine → risultato < 7 min, senza timeout.
  * Q\&A: domande su valori specifici → risposta con riferimenti (doc/page).
* **Errori**:

  * PDF non valido / oversize / >4 file → messaggio chiaro.
  * Interruzione OCR → status `ERROR` con motivo.

---

## 12) Roadmap minima post-MVP

* Cache dei testi per pagina (riuso in nuovi run con stessi file hash).
* Seed domini estendibile via JSON nel DB (senza riattivare sistemi complessi).
* Export **XLSX** opzionale.
* Rate limiting per utente.

---

### TL;DR (in una riga)

Tagliamo tutto ciò che è “complesso e fragile” e teniamo **un worker con OCRmyPDF come fallback**, **estrazione AI in due passaggi leggeri**, **quattro tabelle totali**, **SSE semplice** — stessa UI, backend finalmente lineare e mantenibile.
ttiv
