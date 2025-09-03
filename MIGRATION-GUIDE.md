# Guida alla Migrazione - Brief AI (Nuova Struttura Semplificata)

Questa guida ti accompagna nella migrazione dall'architettura attuale complessa alla nuova struttura semplificata secondo `new-structure.md`.

## 📋 Panoramica dei Cambiamenti

### Architettura Vecchia ❌
- 12+ tabelle database complesse
- Pipeline multi-step: CREATED → UPLOADED → CLASSIFYING → PARSING → EXTRACTING → NORMALIZING → BUILDING → READY
- Processing interno in Next.js API Routes
- Multipli engine OCR integrati
- Tabula, Synonym Map persistente, Profiles avanzati

### Architettura Nuova ✅
- Solo 4 tabelle: `runs_new`, `documents_new`, `results_new`, `messages_new`
- Stati SSE semplici: QUEUED → PROCESSING → READY | ERROR
- Worker esterno per processing
- Solo OCRmyPDF come microservizio
- Schema minimo, logica semplificata

## 🗄️ 1. Migrazione Database

### Passo 1: Applicare il nuovo schema

```bash
# 1. Eseguire il nuovo schema su Supabase
cd brief-ui
psql -h your-db-host -d your-db -f supabase/new-schema.sql
```

Il nuovo schema crea 4 tabelle con suffisso `_new`:
- `runs_new`
- `documents_new` 
- `results_new`
- `messages_new`

### Passo 2: Migrare i dati esistenti (opzionale)

Se hai run esistenti da migrare:

```sql
-- Migrazione runs
INSERT INTO runs_new (id, user_id, workspace_id, prompt, status, domain, created_at, updated_at)
SELECT 
  id, 
  'migrated-user' as user_id, -- TODO: mappare con dati Clerk reali
  workspace_id,
  prompt,
  CASE 
    WHEN status = 'READY' THEN 'READY'
    WHEN status IN ('FAILED', 'PARTIAL', 'CANCELLED') THEN 'ERROR' 
    ELSE 'QUEUED'
  END as status,
  COALESCE(domain, 'AUTO') as domain,
  created_at,
  created_at as updated_at
FROM runs 
WHERE status = 'READY'; -- Solo run completati

-- Migrazione documents
INSERT INTO documents_new (id, run_id, filename, storage_path, pages, ocr_used)
SELECT 
  d.id,
  d.run_id, 
  d.filename,
  d.storage_path,
  d.pages,
  false as ocr_used
FROM documents d 
JOIN runs_new r ON d.run_id = r.id;

-- Migrazione results (con trasformazione)
INSERT INTO results_new (run_id, table_json, created_at)
SELECT 
  run_id,
  jsonb_build_object(
    'columns', COALESCE(columns, '[]'::jsonb),
    'rows', COALESCE(rows, '[]'::jsonb),
    'highlights', COALESCE(highlights, '{}'::jsonb)
  ) as table_json,
  created_at
FROM results r
JOIN runs_new rn ON r.run_id = rn.id;
```

## 🔧 2. Configurazione Servizi

### Passo 1: Configurare le variabili d'ambiente

```bash
# Creare file .env nella root del progetto Brief
cd /Users/leonardocribari/Desktop/Brief
cp worker/env.example .env

# Editare .env con i tuoi valori reali:
# - SUPABASE_URL
# - SUPABASE_SERVICE_ROLE_KEY  
# - OPENAI_API_KEY
```

### Passo 2: Aggiornare la configurazione Next.js

Aggiungere al tuo `.env.local` in `brief-ui/`:

```bash
# Worker esterno
WORKER_BASE_URL=http://localhost:3001

# OCR microservizio  
OCR_API_URL=http://localhost:3002

# Limiti configurabili
MAX_FILES_PER_RUN=4
MAX_PAGES_PER_PDF=120
MAX_MB_PER_PDF=30
```

### Passo 3: Avviare i servizi

```bash
# Dalla root del progetto Brief
./setup-services.sh
```

Questo script:
1. Controlla che Docker sia running
2. Crea il file .env se mancante
3. Builda i container OCR e Worker
4. Avvia i servizi con docker-compose
5. Verifica che siano healthy

## 🚀 3. Test della Nuova Architettura

### Test Rapido

```bash
# 1. Verificare che i servizi siano running
curl http://localhost:3001/health  # Worker
curl http://localhost:3002/health  # OCR Service

# 2. Avviare Next.js dev server 
cd brief-ui
npm run dev

# 3. Aprire http://localhost:3000 e testare:
#    - Upload di 2-3 PDF di test
#    - Verificare che lo stato cambi: QUEUED → PROCESSING → READY
#    - Controllare che la tabella venga generata
#    - Testare la funzione Q&A
```

### Test Completo E2E

1. **Test Upload**: Caricare 2 PDF di specsheet diversi
2. **Test Processing**: Verificare tramite SSE che lo stato cambi correttamente
3. **Test Risultati**: Verificare che la tabella JSON sia ben formattata
4. **Test Q&A**: Fare domande sui risultati e verificare le risposte
5. **Test Export**: Verificare che i link CSV funzionino

## 📊 4. Monitoraggio e Debugging

### Log dei Servizi

```bash
# Vedere tutti i log
docker-compose logs -f

# Log del solo Worker
docker-compose logs -f brief-worker

# Log del solo OCR
docker-compose logs -f ocr-service
```

### Debug Run Specifico

```sql
-- Verificare stato di un run
SELECT * FROM runs_new WHERE id = 'your-run-id';

-- Verificare documenti associati
SELECT * FROM documents_new WHERE run_id = 'your-run-id';

-- Verificare risultati
SELECT table_json FROM results_new WHERE run_id = 'your-run-id';

-- Verificare messaggi Q&A
SELECT * FROM messages_new WHERE run_id = 'your-run-id' ORDER BY created_at;
```

### Metriche Comuni

- **Tempo medio processing**: 2 PDF × 60 pagine = 40-120s
- **Tempo massimo**: 4 PDF × 120 pagine = 3-7 min
- **Rate limiting**: Worker gestisce 1 job alla volta
- **OCR fallback**: Se text extraction < 2000 chars

## 🔄 5. Rollback (se necessario)

Se devi tornare alla vecchia architettura:

```bash
# 1. Fermare i nuovi servizi
docker-compose down

# 2. Nel database, continuare a usare le tabelle originali
# (le nuove tabelle _new non interferiscono)

# 3. Ripristinare le vecchie variabili d'ambiente

# 4. Riavviare con la vecchia configurazione
```

## ⚠️ 6. Note Importanti

### Limitazioni Temporanee

1. **Auth Clerk**: Gli endpoint usano `temp-user-id` placeholder. Da integrare con Clerk reale.
2. **RLS**: Policy permissive temporanee. Da restringere con user_id reale.
3. **Error Handling**: Errori base, da migliorare per production.

### Performance

- **Worker**: Elabora 1 job alla volta. Per scalare, aggiungi più istanze.
- **OCR**: Timeout 5 minuti per PDF. Regolabile via env vars.
- **Database**: Usa connessioni pooled per performance.

### Sicurezza

- **API Keys**: Assicurati che siano in env vars sicure
- **Storage**: Bucket Supabase con policy RLS appropriate
- **Network**: I servizi comunicano via rete interna Docker

## 📞 7. Support

Per problemi:

1. **Controllare logs**: `docker-compose logs -f`
2. **Verificare health**: endpoint `/health` su entrambi i servizi  
3. **Testare OCR**: `curl -X POST http://localhost:3002/check`
4. **Database**: Verificare le query delle nuove tabelle

## ✅ 8. Checklist Migrazione

- [ ] Nuovo schema database applicato
- [ ] Variabili d'ambiente configurate  
- [ ] Servizi Docker running e healthy
- [ ] Test upload PDF completato con successo
- [ ] SSE eventi ricevuti correttamente
- [ ] Tabella risultati generata
- [ ] Q&A funzionale
- [ ] Export CSV/JSON funzionale
- [ ] Integrazione Clerk (se necessaria)
- [ ] RLS policies aggiornate per production

La migrazione è completa quando tutti i punti della checklist sono verificati! 🎉
