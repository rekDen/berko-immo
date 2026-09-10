-- ============================================================
-- Migration: RLS-Policies für documents Storage-Bucket
-- ============================================================
-- VORAUSSETZUNG: Bucket "documents" muss bereits existieren
-- (Supabase Dashboard → Storage → New bucket → Name: documents, Public: aus)
--
-- Tenant-Isolation wird primär über RLS auf der documents-Tabelle
-- durchgesetzt. Storage-Policies sind deshalb bewusst minimal: jeder
-- authentifizierte Nutzer mit einem Tenant darf in den documents-
-- Bucket schreiben/lesen.
-- ============================================================

drop policy if exists "documents_storage_select" on storage.objects;
drop policy if exists "documents_storage_insert" on storage.objects;
drop policy if exists "documents_storage_update" on storage.objects;
drop policy if exists "documents_storage_delete" on storage.objects;


create policy "documents_storage_select" on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'documents'
    and current_tenant_id() is not null
  );


create policy "documents_storage_insert" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and current_tenant_id() is not null
  );


create policy "documents_storage_update" on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'documents'
    and current_tenant_id() is not null
  );


create policy "documents_storage_delete" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and current_tenant_id() is not null
  );
