-- ============================================================
-- Migration: documents Storage-Bucket + RLS-Policies
-- ============================================================

-- Bucket anlegen (privat — nicht öffentlich zugänglich)
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;


-- ============================================================
-- RLS-Policies auf storage.objects
-- ============================================================
-- Pfadschema:
--   {tenant_id}/property/{category_id}/{uuid}.{ext}
--   {tenant_id}/unit/{category_id}/{uuid}.{ext}
--   contracts/{contract_id}/{category_id}/{uuid}.{ext}
--
-- Für Property/Unit: erstes Pfadsegment = tenant_id
-- Für Contract: erstes Segment 'contracts', tenant-Zugehörigkeit
--   wird über die documents-Tabelle (RLS) geprüft.

drop policy if exists "documents_storage_select" on storage.objects;
drop policy if exists "documents_storage_insert" on storage.objects;
drop policy if exists "documents_storage_update" on storage.objects;
drop policy if exists "documents_storage_delete" on storage.objects;


-- SELECT: Nutzer dürfen Dateien aus ihrem Tenant lesen
create policy "documents_storage_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (
      -- {tenant_id}/...
      (split_part(name, '/', 1))::uuid = current_tenant_id()
      -- contracts/{contract_id}/... → über documents-Tabelle (RLS auf documents prüft tenant)
      or (
        split_part(name, '/', 1) = 'contracts'
        and exists (
          select 1 from documents d
          where d.storage_path = storage.objects.name
        )
      )
    )
  );


-- INSERT: Nutzer dürfen in den eigenen Tenant-Pfad hochladen (nur Verwalter/Admin)
create policy "documents_storage_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and is_tenant_admin()
    and (
      (split_part(name, '/', 1))::uuid = current_tenant_id()
      or split_part(name, '/', 1) = 'contracts'
    )
  );


-- UPDATE: nur eigener Tenant
create policy "documents_storage_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and is_tenant_admin()
    and (
      (split_part(name, '/', 1))::uuid = current_tenant_id()
      or split_part(name, '/', 1) = 'contracts'
    )
  );


-- DELETE: nur eigener Tenant
create policy "documents_storage_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and is_tenant_admin()
    and (
      (split_part(name, '/', 1))::uuid = current_tenant_id()
      or split_part(name, '/', 1) = 'contracts'
    )
  );
