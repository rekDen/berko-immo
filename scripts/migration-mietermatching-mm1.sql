-- MM1 (KI-Mietermatching) — Kern-Datenmodell: Wunschmieter-Profil, Bewerber
-- (manuelle Erfassung), Match-Ergebnis. Dokument-Upload/-Extraktion,
-- Einladen/Ablehnen, Vorlagen folgen mit MM2/MM3 in eigenen Migrationen.
-- Doku: docs/specs/Spezifikation_Mietermatching.md §2.1/§2.2/§2.4 (Teilmenge).
-- Additiv: drei neue Tabellen, keine Änderung an Bestandstabellen.
-- Im Supabase-SQL-Editor ausführen.

create table desired_tenant_profile (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  unit_id uuid not null references units(id),
  -- Zielmiete: in der Spec nicht explizit gelistet, aber für die
  -- Einkommen/Miete-Quote (§3.2) zwingend nötig — hier ergänzt.
  target_rent_cold numeric(10,2),
  min_net_income numeric(10,2),
  income_to_rent_ratio_min numeric(4,2) not null default 3.0,
  employment_types_accepted text[] not null default '{}',
  household_size_min int,
  household_size_max int,
  pets_allowed boolean,
  smoking_allowed boolean,
  move_in_earliest date,
  move_in_latest date,
  min_lease_duration_months int,
  schufa_required boolean not null default false,
  schufa_max_score_class text,
  required_documents text[] not null default '{}',
  weights jsonb not null default '{
    "income_ratio": 30, "employment": 15, "schufa": 25,
    "household_size": 10, "move_in": 10, "documents_completeness": 10
  }'::jsonb,
  notes_internal text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index uq_desired_tenant_profile_unit
  on desired_tenant_profile(unit_id) where deleted_at is null;
create index idx_desired_tenant_profile_tenant on desired_tenant_profile(tenant_id);

alter table desired_tenant_profile enable row level security;
create policy "desired_tenant_profile_select_tenant" on desired_tenant_profile
  for select using (tenant_id = current_tenant_id() and deleted_at is null);
create policy "desired_tenant_profile_insert_tenant" on desired_tenant_profile
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());
create policy "desired_tenant_profile_update_tenant" on desired_tenant_profile
  for update using (tenant_id = current_tenant_id() and is_tenant_admin());

create table applicant (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  unit_id uuid not null references units(id),
  source text not null default 'manual'
    check (source in ('email','phone_anna','web_form','manual')),
  first_name text not null,
  last_name text not null,
  contact_email text,
  contact_phone text,
  net_income numeric(10,2),
  employment_type text,
  household_size int,
  has_pets boolean,
  is_smoker boolean,
  desired_move_in date,
  -- Minimal strukturiert; volle SCHUFA-Anbindung ist offene Fachfrage
  -- (Spec §10) und nicht Teil von MM1. Form: { classification:
  -- 'none_negative' | 'soft_negative' | 'hard_negative' } | null.
  schufa_result jsonb,
  status text not null default 'new'
    check (status in ('new','scored','invited','rejected','withdrawn')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_applicant_tenant on applicant(tenant_id);
create index idx_applicant_unit on applicant(unit_id);

alter table applicant enable row level security;
create policy "applicant_select_tenant" on applicant
  for select using (tenant_id = current_tenant_id() and deleted_at is null);
create policy "applicant_insert_tenant" on applicant
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());
create policy "applicant_update_tenant" on applicant
  for update using (tenant_id = current_tenant_id() and is_tenant_admin());

-- Append-only (Spec §9: "match_result... append-only, neue Version statt
-- Überschreiben") — bewusst keine update-Policy.
create table match_result (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  applicant_id uuid not null references applicant(id),
  desired_tenant_profile_id uuid not null references desired_tenant_profile(id),
  overall_score numeric(5,2) not null,
  criteria_breakdown jsonb not null,
  missing_documents text[] not null default '{}',
  confidence numeric(4,3) not null,
  computed_at timestamptz not null default now(),
  model_version text not null default 'rule-based-v1'
);

create index idx_match_result_applicant on match_result(applicant_id, computed_at desc);
create index idx_match_result_tenant on match_result(tenant_id);

alter table match_result enable row level security;
create policy "match_result_select_tenant" on match_result
  for select using (tenant_id = current_tenant_id());
create policy "match_result_insert_tenant" on match_result
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());
