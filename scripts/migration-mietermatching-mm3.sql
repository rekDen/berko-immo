-- MM3 (KI-Mietermatching) — Einladen/Ablehnen mit E-Mail-Vorlagen und
-- Audit-Trail. Additiv: zwei neue Tabellen, keine Änderung an
-- Bestandstabellen/-spalten. `applicant.status` unterstützt 'invited'/
-- 'rejected' bereits seit MM1 (migration-mietermatching-mm1.sql).
-- Doku: docs/specs/Spezifikation_Mietermatching.md §2.5/§2.6/§6/§7.
-- Im Supabase-SQL-Editor ausführen.

create table message_template (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  type text not null check (type in ('invitation', 'rejection')),
  name text not null,
  subject text not null,
  body text not null,
  channel text not null default 'email' check (channel in ('email', 'sms')),
  is_default boolean not null default false,
  active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_message_template_tenant on message_template(tenant_id, type);

alter table message_template enable row level security;
create policy "message_template_select_tenant" on message_template
  for select using (tenant_id = current_tenant_id());
create policy "message_template_insert_tenant" on message_template
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());
create policy "message_template_update_tenant" on message_template
  for update using (tenant_id = current_tenant_id() and is_tenant_admin());
create policy "message_template_delete_tenant" on message_template
  for delete using (tenant_id = current_tenant_id() and is_tenant_admin());

-- Append-only Audit-Trail (Spec §9, wie match_result) — bewusst keine
-- update-Policy. template_id "on delete set null": eine spätere Löschung
-- der Vorlage darf den historischen Snapshot (rendered_subject/_message)
-- nicht mitreißen.
create table matching_action (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  applicant_id uuid not null references applicant(id),
  action text not null check (action in ('invited', 'rejected')),
  template_id uuid references message_template(id) on delete set null,
  rendered_subject text,
  rendered_message text not null,
  performed_by uuid references profiles(id),
  performed_at timestamptz not null default now()
);

create index idx_matching_action_applicant on matching_action(applicant_id, performed_at desc);
create index idx_matching_action_tenant on matching_action(tenant_id);

alter table matching_action enable row level security;
create policy "matching_action_select_tenant" on matching_action
  for select using (tenant_id = current_tenant_id());
create policy "matching_action_insert_tenant" on matching_action
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());
