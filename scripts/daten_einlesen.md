# Claude Code Prompt: Modul „Daten einlesen" (Ingestion-Pipeline mit Dual-Indexierung)

## Kontext

Du arbeitest in einer bestehenden Next.js-App (App Router, TypeScript) mit Supabase als Backend (Postgres, pgvector, Storage, Auth mit RLS-basierter Multi-Tenancy). Analysiere zuerst die bestehende Projektstruktur, Auth-/Tenant-Logik und vorhandene Supabase-Migrations, bevor du Code schreibst. Integriere dich in bestehende Konventionen (Ordnerstruktur, Naming, UI-Komponenten-Bibliothek), statt parallele Strukturen aufzubauen.

## Ziel

Implementiere ein neues Modul **„Daten einlesen"**, mit dem sämtliches Wissen aus mehreren Quellen in **zwei Suchindizes** in Supabase indexiert wird:

1. **Relationaler Volltextindex** (Postgres `tsvector` mit `german`-Konfiguration) für Stichwort-/Keyword-Suche
2. **Vektorindex** (pgvector, `vector(1024)`, HNSW) für semantische Suche

Beide Indizes werden aus derselben Chunk-Tabelle gespeist (eine Tabelle, zwei Index-Spalten) — kein doppeltes Datenmodell.

## Datenquellen (Konnektoren)

Implementiere eine erweiterbare Konnektor-Abstraktion (`SourceConnector`-Interface), sodass neue Quellen später ohne Pipeline-Änderung hinzugefügt werden können. Zum Start:

1. **Drag-&-Drop-Dateiupload** in der UI (mehrere Dateien gleichzeitig, Fortschrittsanzeige pro Datei)
2. **Supabase Storage**: bestehende Buckets/Ordner als Quelle auswählen und indexieren
3. **Supabase Postgres selbst**: ausgewählte Tabellen/Spalten der eigenen Datenbank als Wissensquelle indexieren (konfigurierbar: welche Tabellen, welche Text-Spalten, welche Spalte als Titel/Metadatum). Änderungserkennung über `updated_at`-Spalten oder Trigger
4. **Google Drive**: OAuth2-Anbindung, Ordnerauswahl, initialer Sync + inkrementeller Sync via Drive Push Notifications (Webhooks); Fallback auf Changes-API-Polling
5. **Dropbox**: OAuth2-Anbindung, Ordnerauswahl, Sync via Dropbox Webhooks + `/files/list_folder/continue`-Cursor
6. **WebDAV** (eigenes Dateisystem / NAS): Host, Pfad, Credentials konfigurierbar; Sync per Polling mit ETag-/Last-Modified-Vergleich

Das Datenmodell muss so angelegt sein, dass später **IMAP-Postfächer** als weitere Quelle ergänzt werden können (Felder `source_type` generisch halten).

## Architektur: Pipeline mit pgmq

Verwende **pgmq** (Supabase-native Postgres-Queue-Extension) — KEIN Redis/BullMQ. Drei getrennte Queues, damit jede Stage unabhängig skaliert und Retries isoliert bleiben:

```
Quelle → [Ingest] → Storage + documents-Eintrag
              ↓ pgmq: extract_queue
       [Extraction] → Text/OCR
              ↓ pgmq: chunk_queue
       [Chunking] → strukturbewusste Segmente
              ↓ pgmq: embed_queue
       [Embedding] → IONOS bge-m3 (Batch)
              ↓
       Upsert in chunks (tsvector + vector)
```

- **Worker**: eigenständiger Node/TypeScript-Worker-Service (separates Package/Verzeichnis im Monorepo, z. B. `apps/ingestion-worker` oder `worker/`), der die drei Queues mit parallelen Consumer-Loops pollt. Nutzt `pgmq.read()` mit Visibility-Timeout, `pgmq.delete()` bei Erfolg, automatischer Retry über Visibility-Timeout bei Fehler, Dead-Letter-Verhalten nach N Zustellversuchen (Read-Count prüfen, dann in `failed_jobs`-Tabelle verschieben).
- Next.js-API-Routes dürfen NUR enqueuen (schnelle Operationen), niemals Parsing/OCR/Embedding synchron ausführen.
- **Idempotenz**: SHA-256-Content-Hash pro Dokument in `documents.content_hash`. Bei erneutem Sync mit identischem Hash: Pipeline komplett überspringen.
- **Re-Ingestion**: Bei geändertem Hash alte Chunks des Dokuments löschen und neu erzeugen (`document_version` hochzählen für Nachvollziehbarkeit).

## Extraction

- PDF: Textextraktion; wenn extrahierter Text leer/zu kurz (Scan-Verdacht) → OCR-Pfad
- OCR: über IONOS AI Model Hub OCR-Modell (OpenAI-kompatible API) — als austauschbaren Provider kapseln
- DOCX, XLSX, TXT, MD, HTML, EML: passende Parser (mammoth, xlsx/SheetJS, etc.)
- E-Mail-Formate (EML): Body + Header (From/To/Subject/Date) als Metadaten extrahieren
- Nicht unterstützte Formate: Dokument mit Status `unsupported` markieren, nicht die Queue blockieren

## Chunking-Strategie (kritisch für Retrieval-Qualität)

- **Strukturbewusstes Recursive-Splitting** (selbst implementiert in TS, KEINE LangChain-Abhängigkeit): Trennzeichen-Priorität `\n\n` (Absätze) → Satzenden → Wörter als Fallback
- **Rechtstexte/Verträge**: entlang von §-Absätzen, nummerierten Klauseln und Überschriften splitten; eine Klausel darf nicht mitten im Chunk enden
- **Tabellarische Inhalte**: zeilen-/abschnittsweise, Tabellenzeilen nicht auseinanderreißen
- **Zielgröße**: 300–600 Tokens pro Chunk (bei Rechtstexten obere Grenze), 10–15 % Overlap
- Token-Zählung mit einem leichtgewichtigen Tokenizer (Näherung ausreichend)
- Pro Chunk Metadaten mitführen: `section_title` (z. B. „§ 4 Zahlungsbedingungen"), `chunk_index`, `source_type`, `document_date`

## Embedding: IONOS AI Model Hub

- Modell: **`BAAI/bge-m3`** (multilingual, 1024 Dimensionen)
- Endpoint: OpenAI-kompatibel, `POST https://openai.inference.de-txl.ionos.com/v1/embeddings`
- API-Key aus Environment-Variable (`IONOS_API_KEY`), niemals hardcoden
- **Batch-Calls**: 20–50 Chunks pro Request bündeln
- Rate-Limit-Handling: Exponential Backoff bei 429/5xx
- Provider hinter einem `EmbeddingProvider`-Interface kapseln (Modell/Anbieter später austauschbar, Dimension konfigurierbar)

## Datenmodell (Supabase-Migration erstellen)

```sql
-- Extensions
create extension if not exists vector;
create extension if not exists pgmq;

-- Quellen-Konfiguration
create table ingestion_sources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  source_type text not null check (source_type in
    ('upload','supabase_storage','supabase_table','gdrive','dropbox','webdav','imap')),
  name text not null,
  config jsonb not null default '{}',   -- Pfade, Ordner-IDs, Tabellen-Mapping etc.
  credential_ref text,                  -- Verweis auf Supabase Vault Secret, NIE Klartext
  sync_interval_minutes int default 15,
  last_synced_at timestamptz,
  status text default 'active',
  created_at timestamptz default now()
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  source_id uuid references ingestion_sources(id),
  source_type text not null,
  external_id text,                     -- Drive-File-ID, Dropbox-Pfad, Storage-Pfad, UID...
  title text,
  mime_type text,
  storage_path text,                    -- Original in Supabase Storage
  content_hash text not null,
  document_version int default 1,
  document_date date,
  status text default 'pending',        -- pending|extracting|chunking|embedding|indexed|failed|unsupported
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (source_id, external_id)
);

create table chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  tenant_id uuid not null,              -- bewusst denormalisiert für RLS-Performance
  chunk_index int not null,
  content text not null,
  token_count int,
  section_title text,
  source_type text,
  document_date date,
  embedding vector(1024),
  fts tsvector generated always as (to_tsvector('german', content)) stored,
  created_at timestamptz default now()
);

create index chunks_embedding_idx on chunks using hnsw (embedding vector_cosine_ops);
create index chunks_fts_idx on chunks using gin (fts);
create index chunks_tenant_idx on chunks (tenant_id);

-- Queues
select pgmq.create('extract_queue');
select pgmq.create('chunk_queue');
select pgmq.create('embed_queue');

create table failed_jobs (
  id uuid primary key default gen_random_uuid(),
  queue_name text not null,
  message jsonb not null,
  error_message text,
  failed_at timestamptz default now()
);
```

- **RLS aktivieren** auf `ingestion_sources`, `documents`, `chunks` mit Tenant-Isolation nach dem bestehenden Muster der App (analysiere vorhandene Policies und übernimm das Pattern). `tenant_id` liegt bewusst denormalisiert auf `chunks`, damit die Policy direkt im Index-Scan filtert statt über Joins.
- **Hybrid-Search-Funktion** als Postgres-Function anlegen: kombiniert Vektor-Ähnlichkeit (Cosine) und `ts_rank` über Reciprocal Rank Fusion (RRF), mit `tenant_id`-Parameter, `match_count` und optionalen Filtern (`source_type`, Datumsbereich).

## Credentials & Sicherheit

- Alle Quell-Credentials (WebDAV-Passwörter, OAuth-Refresh-Tokens) ausschließlich in **Supabase Vault**, referenziert über `credential_ref` — niemals in normalen Tabellen, auch nicht selbst verschlüsselt
- OAuth-Flows (Drive, Dropbox) über Next.js-API-Routes mit State-Parameter/CSRF-Schutz
- Worker nutzt Service-Role-Key nur serverseitig; UI ausschließlich über RLS-geschützte Anon/Auth-Clients
- Uploads: MIME-Type- und Größenvalidierung serverseitig, nicht nur im Client

## UI (Modul „Daten einlesen")

Neue Route/Seite im bestehenden App-Layout mit:

1. **Quellen-Übersicht**: Liste aller konfigurierten Quellen mit Status, letztem Sync, Dokument-Anzahl, Buttons „Jetzt synchronisieren" / „Pausieren" / „Entfernen"
2. **Quelle hinzufügen**: Dialog/Wizard je Quellentyp (OAuth-Button für Drive/Dropbox, Formular für WebDAV, Tabellen-/Spalten-Auswahl für Supabase-Postgres, Bucket-/Ordner-Auswahl für Storage)
3. **Drag-&-Drop-Zone**: Multi-File-Upload mit Fortschritt pro Datei, direkt in die Pipeline
4. **Dokumenten-Status-Tabelle**: alle Dokumente mit Pipeline-Status (pending → extracting → chunking → embedding → indexed / failed), Fehlermeldungen einsehbar, Retry-Button für fehlgeschlagene Dokumente, Filter nach Quelle/Status
5. Statusaktualisierung via Supabase Realtime auf der `documents`-Tabelle (kein Polling in der UI)

Verwende die in der App bereits vorhandene Komponenten-Bibliothek und Design-Sprache. UI-Texte auf Deutsch.

## Worker-Service

- Eigenes Verzeichnis mit eigenem `package.json`, startbar via `npm run worker` (lokal) und als Container deploybar (Dockerfile mitliefern)
- Drei Consumer-Loops (extract, chunk, embed) mit konfigurierbarer Parallelität (env: `EXTRACT_CONCURRENCY` etc.)
- Sync-Scheduler: Cron-Loop, der fällige `ingestion_sources` (nach `last_synced_at` + `sync_interval_minutes`) prüft und Sync-Jobs enqueued
- Graceful Shutdown (laufende Jobs zu Ende verarbeiten, Visibility-Timeout respektieren)
- Strukturiertes Logging (Dokument-ID, Stage, Dauer, Tenant)

## Vorgehen

1. Analysiere zuerst die bestehende Codebasis: Projektstruktur, Supabase-Client-Setup, Auth-/Tenant-Muster, vorhandene Migrations, UI-Komponenten
2. Lege die Migration an und erkläre kurz die Entscheidungen
3. Baue den Worker-Service (Konnektoren zunächst: Upload, Supabase Storage, WebDAV; danach Drive, Dropbox, Supabase-Tabellen)
4. Baue die UI
5. Schreibe für Chunking und Hybrid-Search-Funktion Unit-/Integrationstests (bestehendes Test-Setup nutzen, z. B. Vitest)
6. Dokumentiere in einer `README.md` des Moduls: Env-Variablen, Queue-Verhalten, wie man eine neue Quelle als Konnektor ergänzt

Frage nach, bevor du Annahmen über die bestehende Tenant-/Auth-Struktur triffst, statt sie zu raten.
