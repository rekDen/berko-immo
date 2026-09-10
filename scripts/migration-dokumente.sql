-- ============================================================
-- Migration: Modul „Dokumente" — freie Dateiablage (Ordnerbaum + Dateien)
-- Siehe scripts/spezifikation_dokumente.md
-- ============================================================
-- Domänenfrei: KEIN Bezug zu property/unit/contract, keine Kategorien.
-- Nutzt den bestehenden privaten Storage-Bucket `documents`
-- (Pfad-Präfix {tenant_id}/files/...).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabellen
-- ------------------------------------------------------------

create table if not exists folders (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id),
  parent_id   uuid references folders(id) on delete cascade,  -- null = Wurzel
  name        text not null,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id),
  deleted_at  timestamptz,
  deleted_by  uuid references auth.users(id)
);

create table if not exists files (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id),
  folder_id     uuid references folders(id) on delete cascade,  -- null = Wurzel
  name          text not null,          -- Anzeigename inkl. Endung (umbenennbar)
  storage_path  text not null,          -- {tenant_id}/files/{file_id}.{ext}
  file_size     bigint,
  mime_type     text,
  file_hash     text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id),
  deleted_at    timestamptz,
  deleted_by    uuid references auth.users(id)
);

-- ------------------------------------------------------------
-- 2. Indizes
-- ------------------------------------------------------------

-- Kein doppelter Name unter demselben Elternteil (nur aktive Objekte).
-- coalesce, weil NULL-parent (Wurzel) sonst nicht durch unique erfasst wird.
create unique index if not exists uq_folders_sibling_name
  on folders (tenant_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name))
  where deleted_at is null;

create unique index if not exists uq_files_sibling_name
  on files (tenant_id, coalesce(folder_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name))
  where deleted_at is null;

create index if not exists idx_folders_tenant_parent on folders (tenant_id, parent_id);
create index if not exists idx_files_tenant_folder on files (tenant_id, folder_id);
create index if not exists idx_files_hash on files (file_hash) where file_hash is not null;

-- ------------------------------------------------------------
-- 3. updated_at-Trigger (nutzt bestehende set_updated_at())
-- ------------------------------------------------------------

drop trigger if exists trg_folders_updated_at on folders;
create trigger trg_folders_updated_at before update on folders
  for each row execute function set_updated_at();

drop trigger if exists trg_files_updated_at on files;
create trigger trg_files_updated_at before update on files
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- 4. RLS
-- ------------------------------------------------------------

alter table folders enable row level security;
alter table files   enable row level security;

drop policy if exists folders_select on folders;
drop policy if exists folders_write  on folders;
drop policy if exists files_select   on files;
drop policy if exists files_write    on files;

-- Lesen: eigener Mandant, nicht gelöscht
create policy folders_select on folders for select to authenticated
  using (tenant_id = current_tenant_id() and deleted_at is null);
create policy files_select on files for select to authenticated
  using (tenant_id = current_tenant_id() and deleted_at is null);

-- Schreiben (insert/update/delete): eigener Mandant + Verwalterrolle
create policy folders_write on folders for all to authenticated
  using (tenant_id = current_tenant_id() and is_tenant_admin())
  with check (tenant_id = current_tenant_id() and is_tenant_admin());
create policy files_write on files for all to authenticated
  using (tenant_id = current_tenant_id() and is_tenant_admin())
  with check (tenant_id = current_tenant_id() and is_tenant_admin());

-- ------------------------------------------------------------
-- 5. Hilfsfunktionen
-- ------------------------------------------------------------

-- true, wenn p_candidate der Ordner selbst oder ein Nachfahre von p_folder ist.
-- Genutzt für den Zyklus-Schutz beim Verschieben von Ordnern.
create or replace function dokumente_is_self_or_descendant(p_folder uuid, p_candidate uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  with recursive tree as (
    select p_folder as id
    union all
    select f.id from folders f join tree t on f.parent_id = t.id
    where f.deleted_at is null
  )
  select exists (select 1 from tree where id = p_candidate);
$$;

-- Rekursiver Soft-Delete: Ordner + alle Unterordner + enthaltene Dateien.
-- Tenant-Prüfung erfolgt im API-Handler vor dem Aufruf.
create or replace function dokumente_soft_delete_folder(p_folder uuid, p_user uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_ids uuid[];
begin
  with recursive tree as (
    select id from folders where id = p_folder
    union all
    select f.id from folders f join tree t on f.parent_id = t.id
  )
  select array_agg(id) into v_ids from tree;

  update files
    set deleted_at = now(), deleted_by = p_user
    where folder_id = any(v_ids) and deleted_at is null;

  update folders
    set deleted_at = now(), deleted_by = p_user
    where id = any(v_ids) and deleted_at is null;
end;
$$;

-- ------------------------------------------------------------
-- 6. Realtime (optional, für Live-Aktualisierung im Explorer)
-- ------------------------------------------------------------

do $$ begin
  alter publication supabase_realtime add table folders;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table files;
exception when duplicate_object then null;
end $$;
