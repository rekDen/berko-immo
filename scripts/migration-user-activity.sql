-- Login-Historie + Nutzungshistorie — additiv, zwei neue Tabellen, keine
-- Änderung an Bestandstabellen. Ermöglicht Tenant-Admins einzusehen, wer
-- sich wann von welcher IP-Adresse angemeldet und welche Module besucht hat.
-- Im Supabase-SQL-Editor ausführen.

-- 1. login_history: ein Eintrag je erfolgreichem Login.
create table login_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  user_id uuid not null references auth.users(id),
  ip_address text,
  user_agent text,
  logged_in_at timestamptz not null default now()
);

create index idx_login_history_tenant_user on login_history(tenant_id, user_id, logged_in_at desc);

alter table login_history enable row level security;
-- Nur Tenant-Admins dürfen die Historie einsehen (auch die eigene) — bewusst
-- restriktiver als das sonst übliche "select_tenant"-Muster, da es sich um
-- sicherheitsrelevante Audit-Daten (IP-Adressen) handelt.
create policy "login_history_select_admin" on login_history
  for select using (tenant_id = current_tenant_id() and is_tenant_admin());
-- Jeder Nutzer darf ausschließlich seinen eigenen Login protokollieren.
create policy "login_history_insert_self" on login_history
  for insert with check (tenant_id = current_tenant_id() and user_id = auth.uid());

-- 2. usage_history: ein Eintrag je Modul-Aufruf (Navigation zu einem
-- Top-Level-Bereich der App, clientseitig bei Pfadwechsel protokolliert).
create table usage_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  user_id uuid not null references auth.users(id),
  module text not null,
  path text not null,
  ip_address text,
  visited_at timestamptz not null default now()
);

create index idx_usage_history_tenant_user on usage_history(tenant_id, user_id, visited_at desc);

alter table usage_history enable row level security;
create policy "usage_history_select_admin" on usage_history
  for select using (tenant_id = current_tenant_id() and is_tenant_admin());
create policy "usage_history_insert_self" on usage_history
  for insert with check (tenant_id = current_tenant_id() and user_id = auth.uid());
