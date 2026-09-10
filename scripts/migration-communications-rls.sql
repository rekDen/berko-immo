-- ============================================================
-- Migration: RLS-Policies für UPDATE/DELETE auf communications
-- ============================================================

drop policy if exists "communications_update_tenant" on communications;
drop policy if exists "communications_delete_tenant" on communications;

create policy "communications_update_tenant" on communications
  for update using (tenant_id = current_tenant_id() and is_tenant_admin());

create policy "communications_delete_tenant" on communications
  for delete using (tenant_id = current_tenant_id() and is_tenant_admin());
