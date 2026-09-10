# Ingestion Worker

Verarbeitet die Ingestion-Pipeline: `extract → chunk → embed` via pgmq.

## Env-Variablen

| Variable | Pflicht | Beschreibung |
|---|---|---|
| `SUPABASE_URL` | ✓ | Supabase-Projekt-URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | Service-Role-Key (umgeht RLS) |
| `DATABASE_URL` | ✓ | Direkte Postgres-URL für pgmq |
| `IONOS_API_KEY` | ✓ | IONOS AI Model Hub — Key (aus dem IONOS Cloud-Dashboard) |
| `IONOS_API_SECRET` | ✓ | IONOS AI Model Hub — Secret; zusammen ergeben sie den Bearer-Token `Base64(key:secret)` |
| `IONOS_EMBED_MODEL` | – | Embedding-Modell (default: `BAAI/bge-m3`) |
| `IONOS_EMBED_URL` | – | IONOS Base-URL |
| `IONOS_EMBED_DIM` | – | Vektor-Dimension (default: 1024) |
| `EXTRACT_CONCURRENCY` | – | Parallele Extraktion (default: 3) |
| `CHUNK_CONCURRENCY` | – | Paralleles Chunking (default: 5) |
| `EMBED_CONCURRENCY` | – | Paralleles Embedding (default: 3) |
| `EMBED_BATCH_SIZE` | – | Chunks pro IONOS-Request (default: 20) |
| `MAX_RETRIES` | – | Dead-Letter nach N Retries (default: 5) |
| `VISIBILITY_TIMEOUT_SEC` | – | pgmq Visibility-Timeout (default: 60) |
| `POLL_INTERVAL_MS` | – | Polling-Intervall bei leerer Queue (default: 2000) |
| `SCHEDULER_INTERVAL_MS` | – | Sync-Scheduler-Intervall (default: 60000) |

## Lokal starten

```bash
cd worker
npm install
npm run worker
```

## Docker

```bash
docker build -t ingestion-worker .
docker run --env-file ../.env.local ingestion-worker
```

## Neue Quelle hinzufügen

1. Interface `SourceConnector` in `src/connectors/interface.ts` implementieren
2. Konnektor-Datei anlegen (`src/connectors/meine-quelle.ts`)
3. In `src/consumer.ts` unter `connectors`-Map registrieren
4. `source_type`-Check-Constraint in der Migration erweitern

## Queue-Verhalten

- `extract_queue` → Rohtext aus Datei extrahieren
- `chunk_queue` → Text in Chunks aufteilen
- `embed_queue` → Chunks embedden + in `ingest_chunks` schreiben
- Visibility-Timeout: falls Worker abstürzt, wird Job nach `VISIBILITY_TIMEOUT_SEC` automatisch re-gelesen
- Nach `MAX_RETRIES` Fehlern → `ingest_failed_jobs` (Dead-Letter) + Dokument-Status `failed`
