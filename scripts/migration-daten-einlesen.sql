-- ============================================================
-- Migration: Modul „Daten einlesen" (Ingestion-Pipeline)
-- ============================================================
-- Dual-Index: Postgres tsvector (Keyword) + pgvector 1024-dim (Semantisch)
-- Queue: pgmq (drei Stufen: extract → chunk → embed)
-- Tabellen-Prefix ingest_ zur Abgrenzung vom bestehenden documents-Table.
-- RLS folgt dem Muster aus migration-optimization.sql (current_tenant_id()).
-- Idempotent / re-runnable.
-- ============================================================

-- Extensions (idempotent)
create extension if not exists vector;
create extension if not exists pgmq;

-- ─────────────────────────────────────────────
-- 1. Quellen-Konfiguration
-- ─────────────────────────────────────────────
create table if not exists ingestion_sources (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references tenants(id) on delete cascade,
  source_type          text not null check (source_type in
                         ('upload','supabase_storage','supabase_table','gdrive','dropbox','webdav','imap')),
  name                 text not null,
  config               jsonb not null default '{}',
  credential_ref       text,                   -- Supabase Vault Secret-Name, NIE Klartext
  sync_interval_minutes int default 15,
  last_synced_at       timestamptz,
  status               text not null default 'active' check (status in ('active','paused','error')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_ingestion_sources_tenant on ingestion_sources(tenant_id);

-- ─────────────────────────────────────────────
-- 2. Dokument-Tracking (ingest_documents)
-- Präfix ingest_ da bereits eine documents-Tabelle für DMS existiert.
-- ─────────────────────────────────────────────
create table if not exists ingest_documents (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  source_id        uuid references ingestion_sources(id) on delete set null,
  source_type      text not null,
  external_id      text,            -- Drive-ID, Dropbox-Pfad, Storage-Key etc.
  title            text,
  mime_type        text,
  storage_path     text,            -- Original in Supabase Storage
  content_hash     text not null,   -- SHA-256, verhindert Doppelverarbeitung
  document_version int not null default 1,
  document_date    date,
  status           text not null default 'pending'
                   check (status in
                     ('pending','extracting','chunking','embedding','indexed','failed','unsupported')),
  error_message    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (source_id, external_id)
);

create index if not exists idx_ingest_documents_tenant  on ingest_documents(tenant_id);
create index if not exists idx_ingest_documents_source  on ingest_documents(source_id);
create index if not exists idx_ingest_documents_status  on ingest_documents(status);
create index if not exists idx_ingest_documents_hash    on ingest_documents(content_hash);

-- ─────────────────────────────────────────────
-- 3. Chunks (dual-index: vector + tsvector)
-- ─────────────────────────────────────────────
create table if not exists ingest_chunks (
  id             uuid primary key default gen_random_uuid(),
  document_id    uuid not null references ingest_documents(id) on delete cascade,
  tenant_id      uuid not null references tenants(id) on delete cascade,  -- denormalisiert für RLS
  chunk_index    int  not null,
  content        text not null,
  token_count    int,
  section_title  text,
  source_type    text,
  document_date  date,
  embedding      vector(1024),
  fts            tsvector generated always as (to_tsvector('german', content)) stored,
  created_at     timestamptz not null default now()
);

create index if not exists idx_ingest_chunks_embedding
  on ingest_chunks using hnsw (embedding vector_cosine_ops);
create index if not exists idx_ingest_chunks_fts
  on ingest_chunks using gin (fts);
create index if not exists idx_ingest_chunks_tenant
  on ingest_chunks (tenant_id);
create index if not exists idx_ingest_chunks_document
  on ingest_chunks (document_id);

-- ─────────────────────────────────────────────
-- 4. Dead-Letter / Failed Jobs
-- ─────────────────────────────────────────────
create table if not exists ingest_failed_jobs (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid references tenants(id) on delete cascade,
  queue_name    text not null,
  message       jsonb not null,
  error_message text,
  failed_at     timestamptz not null default now()
);

create index if not exists idx_ingest_failed_jobs_tenant on ingest_failed_jobs(tenant_id);

-- ─────────────────────────────────────────────
-- 5. pgmq Queues (idempotent via do-Block)
-- ─────────────────────────────────────────────
do $$
begin
  perform pgmq.create('extract_queue') where not exists (
    select 1 from pgmq.list_queues() where queue_name = 'extract_queue'
  );
  perform pgmq.create('chunk_queue') where not exists (
    select 1 from pgmq.list_queues() where queue_name = 'chunk_queue'
  );
  perform pgmq.create('embed_queue') where not exists (
    select 1 from pgmq.list_queues() where queue_name = 'embed_queue'
  );
exception when others then
  -- pgmq-Extension noch nicht aktiviert – im Supabase-Dashboard aktivieren
  raise notice 'pgmq nicht verfügbar: %', sqlerrm;
end $$;

-- ─────────────────────────────────────────────
-- 6. RLS aktivieren & Policies anlegen
-- Folgt exakt dem Muster aus migration-optimization.sql
-- ─────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'ingestion_sources', 'ingest_documents', 'ingest_chunks', 'ingest_failed_jobs'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);

    -- select
    execute format(
      'create policy %I on %I for select using (tenant_id = current_tenant_id())',
      t||'_select', t
    );
    -- insert
    execute format(
      'create policy %I on %I for insert with check (tenant_id = current_tenant_id())',
      t||'_insert', t
    );
    -- update
    execute format(
      'create policy %I on %I for update using (tenant_id = current_tenant_id())',
      t||'_update', t
    );
    -- delete
    execute format(
      'create policy %I on %I for delete using (tenant_id = current_tenant_id())',
      t||'_delete', t
    );
  end loop;
exception when duplicate_object then
  null;  -- Policies existieren bereits
end $$;

-- ─────────────────────────────────────────────
-- 7. Hybrid-Search-Funktion (RRF: Vector + FTS)
-- ─────────────────────────────────────────────
create or replace function ingest_hybrid_search(
  p_tenant_id    uuid,
  p_query_text   text,
  p_query_vector vector(1024),
  p_match_count  int default 10,
  p_source_type  text default null,
  p_date_from    date default null,
  p_date_to      date default null
)
returns table (
  id            uuid,
  document_id   uuid,
  chunk_index   int,
  content       text,
  section_title text,
  source_type   text,
  document_date date,
  rrf_score     float
)
language sql stable
as $$
  with
  -- Vector-Kandidaten (Cosine-Similarity, Top-60)
  vec_ranked as (
    select
      c.id,
      c.document_id,
      c.chunk_index,
      c.content,
      c.section_title,
      c.source_type,
      c.document_date,
      row_number() over (order by c.embedding <=> p_query_vector) as rank
    from ingest_chunks c
    where c.tenant_id = p_tenant_id
      and c.embedding is not null
      and (p_source_type is null or c.source_type = p_source_type)
      and (p_date_from   is null or c.document_date >= p_date_from)
      and (p_date_to     is null or c.document_date <= p_date_to)
    order by c.embedding <=> p_query_vector
    limit 60
  ),
  -- FTS-Kandidaten (ts_rank, Top-60)
  fts_ranked as (
    select
      c.id,
      c.document_id,
      c.chunk_index,
      c.content,
      c.section_title,
      c.source_type,
      c.document_date,
      row_number() over (order by ts_rank(c.fts, websearch_to_tsquery('german', p_query_text)) desc) as rank
    from ingest_chunks c
    where c.tenant_id = p_tenant_id
      and c.fts @@ websearch_to_tsquery('german', p_query_text)
      and (p_source_type is null or c.source_type = p_source_type)
      and (p_date_from   is null or c.document_date >= p_date_from)
      and (p_date_to     is null or c.document_date <= p_date_to)
    order by ts_rank(c.fts, websearch_to_tsquery('german', p_query_text)) desc
    limit 60
  ),
  -- Reciprocal Rank Fusion (k=60)
  combined as (
    select
      coalesce(v.id, f.id)                         as id,
      coalesce(v.document_id, f.document_id)       as document_id,
      coalesce(v.chunk_index, f.chunk_index)       as chunk_index,
      coalesce(v.content, f.content)               as content,
      coalesce(v.section_title, f.section_title)   as section_title,
      coalesce(v.source_type, f.source_type)       as source_type,
      coalesce(v.document_date, f.document_date)   as document_date,
      coalesce(1.0 / (60 + v.rank), 0) +
      coalesce(1.0 / (60 + f.rank), 0)            as rrf_score
    from vec_ranked v
    full outer join fts_ranked f on f.id = v.id
  )
  select *
  from combined
  order by rrf_score desc
  limit p_match_count;
$$;

-- ─────────────────────────────────────────────
-- 8. Hilfsfunktion: alle indexierbaren public-Tabellen auflisten
-- security definer damit information_schema auch für anon/auth erreichbar ist.
-- ─────────────────────────────────────────────
create or replace function get_ingestion_tables()
returns table (
  table_name   text,
  text_columns text[],
  row_estimate bigint
)
language sql security definer stable as $$
  select
    t.table_name::text,
    array_agg(c.column_name::text order by c.ordinal_position) as text_columns,
    coalesce(
      (select reltuples::bigint from pg_class where relname = t.table_name limit 1), 0
    ) as row_estimate
  from information_schema.tables t
  join information_schema.columns c
    on c.table_schema = t.table_schema and c.table_name = t.table_name
  where t.table_schema = 'public'
    and t.table_type = 'BASE TABLE'
    and c.data_type in ('text','varchar','character varying','char','bpchar','name')
    and t.table_name not in (
      'ingest_documents','ingest_chunks','ingest_failed_jobs','ingestion_sources',
      'schema_migrations'
    )
  group by t.table_name
  order by t.table_name
$$;

-- ─────────────────────────────────────────────
-- 9. updated_at Trigger
-- ─────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['ingestion_sources','ingest_documents'] loop
    execute format(
      'create trigger %I before update on %I for each row execute function set_updated_at()',
      'trg_'||t||'_updated_at', t
    );
  end loop;
exception when duplicate_object then null;
end $$;
