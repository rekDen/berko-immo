-- ============================================================
-- MIGRATION: Modul „WEG-Jahresabrechnung" — Meilenstein M1 (Datenmodell)
-- ============================================================
-- Spezifikation: scripts/hausgeldabrechnung-spec.md (Version 0.2, Kapitel 6.2, 8.1)
-- Plan: docs/specs/hausgeldabrechnung-plan.md
--
-- Enthält die in Kapitel 11, Zeile M1 genannten Entitäten: Settlement,
-- SettlementUnit, SettlementComment (Kommentare), CheckAcknowledgement
-- (Quittierungen), HeatingImport/HeatingImportUnit, AssetItem/LiabilityItem
-- (Vermögenspositionen). Stammdaten und Buchhaltung (Property, Unit, Owner,
-- AllocationKey, CostType, Transaction, EconomicPlan, Receivable, …) sind
-- bereits vorhanden, s. migration-weg-buchhaltung.sql und
-- migration-weg-buchhaltung-receivables.sql.
--
-- Anpassungen ggü. der Spezifikation (Kapitel 0.1):
--   - Enum-Werte lowercase snake_case statt UPPERCASE (Konvention des Repos).
--   - `HeatingImport` erhält zusätzlich `cost_type_id` (nicht in Spec 6.2
--     vorgesehen): Der Rechenkern (`src/lib/weg-settlement/engine.ts`,
--     `HeatingAllocationInput`) braucht eine eindeutige Zuordnung zur
--     Heizkosten-Kostenart, um sie von etwaigen anderen Ausgaben-Kostenarten
--     zu unterscheiden — die Spec setzt das implizit voraus (`isHeating`-Flag
--     auf genau einer Kostenart je Objekt), modelliert die Verknüpfung aber
--     nicht explizit als Fremdschlüssel.
--   - `settlement_comments`/`check_acknowledgements` sind bewusst append-only
--     (keine Update-/Delete-Policy), analog zu `journal_entries` — ein
--     Kommentar oder eine Quittierung wird nicht nachträglich verändert.
--   - Externe Sichtbarkeit (Beirat) ist für `settlements`/`settlement_comments`
--     bereits jetzt vorgesehen (nicht erst M6), weil Kapitel 8.1 das als
--     Kernregel des Status `REVIEW` beschreibt, nicht als reine UI-Frage.
--     `heating_imports`/`asset_items`/`liability_items` bleiben vorerst
--     verwalterintern (Offenlegung erfolgt über die PDF-Dokumente, M5/M6).
--
-- Ausführung: Im Supabase-SQL-Editor manuell ausführen (kein DATABASE_URL,
-- s. hausgeldabrechnung-plan.md Abschnitt 9.3, Q6).
-- ============================================================


-- ============================================================
-- 1. JAHRESABRECHNUNG — Settlement / SettlementUnit
-- ============================================================

create table settlements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  property_id uuid not null references properties(id),
  year int not null,
  version int not null default 1,
  status text not null default 'draft'
    check (status in ('draft', 'review', 'final', 'resolved', 'superseded')),
  input_snapshot jsonb,
  result_snapshot jsonb,
  input_hash text,
  engine_version text,
  finalized_at timestamptz,
  resolved_at timestamptz,
  resolution_date date,
  supersedes_id uuid references settlements(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create unique index uq_settlements_property_year_version on settlements(property_id, year, version);
create index idx_settlements_property_year on settlements(property_id, year);
create index idx_settlements_supersedes on settlements(supersedes_id) where supersedes_id is not null;

create trigger trg_settlements_updated_at before update on settlements
  for each row execute function set_updated_at();

create table settlement_units (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  settlement_id uuid not null references settlements(id),
  unit_id uuid not null references units(id),
  addressee_owner_id uuid references contacts(id),
  costs bigint not null,       -- K
  income bigint not null,      -- E
  advances_due bigint not null, -- V
  balance bigint not null,     -- S = (K - E) - V
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index uq_settlement_units on settlement_units(settlement_id, unit_id);
create index idx_settlement_units_unit on settlement_units(unit_id);

create trigger trg_settlement_units_updated_at before update on settlement_units
  for each row execute function set_updated_at();


-- ============================================================
-- 2. BEIRATSPRÜFUNG — SettlementComment
-- ============================================================
-- Append-only (kein Update/Delete) — ein Kommentar wird nicht nachträglich
-- verändert. Sichtbar/schreibbar für tenant-interne Nutzer und für Beirats-
-- mitglieder (contact_roles.role = 'beirat'), sobald der Status nicht mehr
-- 'draft' ist (Kapitel 8.1: draft = flüchtig, ab review liest/kommentiert
-- der Beirat).

create table settlement_comments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  settlement_id uuid not null references settlements(id),
  author_id uuid not null references auth.users(id),
  text text not null,
  created_at timestamptz not null default now()
);

create index idx_settlement_comments_settlement on settlement_comments(settlement_id);


-- ============================================================
-- 3. PRÜFUNGS-QUITTIERUNGEN — CheckAcknowledgement
-- ============================================================
-- Append-only. Verwalterintern (nur Verwalter finalisiert, s. Kapitel 8.1).

create table check_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  settlement_id uuid not null references settlements(id),
  check_id text not null,   -- 'C01'..'C17'
  user_id uuid not null references auth.users(id),
  note text,
  created_at timestamptz not null default now()
);

create index idx_check_acknowledgements_settlement on check_acknowledgements(settlement_id);


-- ============================================================
-- 4. HEIZKOSTENIMPORT — HeatingImport / HeatingImportUnit
-- ============================================================

create table heating_imports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  property_id uuid not null references properties(id),
  cost_type_id uuid not null references cost_types(id), -- s. Hinweis oben, Abweichung ggü. Spec 6.2
  year int not null,
  provider text not null,
  total_amount bigint not null, -- Cents, Gesamtbetrag laut Messdienst
  source_file_id uuid references documents(id),
  confirmed_difference bigint,  -- bestätigte Rundungsdifferenz (5.5.2, C06)
  reconciliation_note text,     -- Pflicht bei Überleitungsdifferenz (5.5.3, C07)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create unique index uq_heating_imports_property_year_costtype on heating_imports(property_id, year, cost_type_id);
create index idx_heating_imports_property_year on heating_imports(property_id, year);

create trigger trg_heating_imports_updated_at before update on heating_imports
  for each row execute function set_updated_at();

create table heating_import_units (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  import_id uuid not null references heating_imports(id),
  unit_id uuid not null references units(id),
  heating bigint not null,
  hot_water bigint not null,
  co2_cost bigint,
  co2_landlord_share_pct numeric(6,4),
  labor_amount bigint, -- § 35a
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (heating >= 0 and hot_water >= 0)
);

create unique index uq_heating_import_units on heating_import_units(import_id, unit_id);
create index idx_heating_import_units_unit on heating_import_units(unit_id);

create trigger trg_heating_import_units_updated_at before update on heating_import_units
  for each row execute function set_updated_at();


-- ============================================================
-- 5. VERMÖGENSBERICHT — AssetItem / LiabilityItem
-- ============================================================

create table asset_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  property_id uuid not null references properties(id),
  year int not null,
  label text not null,
  amount bigint,   -- Cents, optional (z. B. Brennstoffbestand ohne bezifferten Wert)
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index idx_asset_items_property_year on asset_items(property_id, year);

create trigger trg_asset_items_updated_at before update on asset_items
  for each row execute function set_updated_at();

create table liability_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  property_id uuid not null references properties(id),
  year int not null,
  label text not null,
  amount bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index idx_liability_items_property_year on liability_items(property_id, year);

create trigger trg_liability_items_updated_at before update on liability_items
  for each row execute function set_updated_at();


-- ============================================================
-- 6. RLS
-- ============================================================

-- -- -- SETTLEMENTS -- -- --
alter table settlements enable row level security;
create policy "settlements_select_tenant" on settlements
  for select using (tenant_id = current_tenant_id());
create policy "settlements_select_external" on settlements
  for select using (status <> 'draft' and user_has_role_on(p_property_id := property_id, p_required_roles := array['beirat']));
create policy "settlements_insert_tenant" on settlements
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());
create policy "settlements_update_tenant" on settlements
  for update using (tenant_id = current_tenant_id() and is_tenant_admin());

-- -- -- SETTLEMENT_UNITS -- -- --
alter table settlement_units enable row level security;
create policy "settlement_units_select_tenant" on settlement_units
  for select using (tenant_id = current_tenant_id());
create policy "settlement_units_select_external" on settlement_units
  for select using (
    exists (
      select 1 from settlements s
      where s.id = settlement_units.settlement_id
        and s.status <> 'draft'
        and user_has_role_on(p_property_id := s.property_id, p_required_roles := array['beirat'])
    )
  );
create policy "settlement_units_insert_tenant" on settlement_units
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());
create policy "settlement_units_update_tenant" on settlement_units
  for update using (tenant_id = current_tenant_id() and is_tenant_admin());

-- -- -- SETTLEMENT_COMMENTS (append-only) -- -- --
alter table settlement_comments enable row level security;
create policy "settlement_comments_select_tenant" on settlement_comments
  for select using (tenant_id = current_tenant_id());
create policy "settlement_comments_select_external" on settlement_comments
  for select using (
    exists (
      select 1 from settlements s
      where s.id = settlement_comments.settlement_id
        and s.status <> 'draft'
        and user_has_role_on(p_property_id := s.property_id, p_required_roles := array['beirat'])
    )
  );
create policy "settlement_comments_insert_tenant" on settlement_comments
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin() and author_id = auth.uid());
create policy "settlement_comments_insert_external" on settlement_comments
  for insert with check (
    tenant_id = current_tenant_id()
    and author_id = auth.uid()
    and exists (
      select 1 from settlements s
      where s.id = settlement_comments.settlement_id
        and s.status <> 'draft'
        and user_has_role_on(p_property_id := s.property_id, p_required_roles := array['beirat'])
    )
  );

-- -- -- CHECK_ACKNOWLEDGEMENTS (append-only, verwalterintern) -- -- --
alter table check_acknowledgements enable row level security;
create policy "check_acknowledgements_select_tenant" on check_acknowledgements
  for select using (tenant_id = current_tenant_id());
create policy "check_acknowledgements_insert_tenant" on check_acknowledgements
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin() and user_id = auth.uid());

-- -- -- HEATING_IMPORTS -- -- --
alter table heating_imports enable row level security;
create policy "heating_imports_select_tenant" on heating_imports
  for select using (tenant_id = current_tenant_id());
create policy "heating_imports_insert_tenant" on heating_imports
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());
create policy "heating_imports_update_tenant" on heating_imports
  for update using (tenant_id = current_tenant_id() and is_tenant_admin());

-- -- -- HEATING_IMPORT_UNITS -- -- --
alter table heating_import_units enable row level security;
create policy "heating_import_units_select_tenant" on heating_import_units
  for select using (tenant_id = current_tenant_id());
create policy "heating_import_units_insert_tenant" on heating_import_units
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());
create policy "heating_import_units_update_tenant" on heating_import_units
  for update using (tenant_id = current_tenant_id() and is_tenant_admin());

-- -- -- ASSET_ITEMS -- -- --
alter table asset_items enable row level security;
create policy "asset_items_select_tenant" on asset_items
  for select using (tenant_id = current_tenant_id());
create policy "asset_items_insert_tenant" on asset_items
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());
create policy "asset_items_update_tenant" on asset_items
  for update using (tenant_id = current_tenant_id() and is_tenant_admin());

-- -- -- LIABILITY_ITEMS -- -- --
alter table liability_items enable row level security;
create policy "liability_items_select_tenant" on liability_items
  for select using (tenant_id = current_tenant_id());
create policy "liability_items_insert_tenant" on liability_items
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());
create policy "liability_items_update_tenant" on liability_items
  for update using (tenant_id = current_tenant_id() and is_tenant_admin());
