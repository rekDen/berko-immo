-- ============================================================
-- Migration: Modul „Immobilienoptimierung" (Potenzialanalyse / Value-Add)
-- ============================================================
-- Erweitert properties/units um Analyse-Felder und legt die
-- domänenspezifischen Tabellen an (Maßnahmen-Katalog, Maßnahmen,
-- Szenarien, Kennzahlen-Snapshots, Regelwerk, Flächenkataster …).
-- Folgt dem bestehenden RLS-Muster (current_tenant_id()).
-- Idempotent: re-runnable.
-- ============================================================

-- ── Referenz: Gemeinde (global, vor properties.gemeinde_id) ──
create table if not exists gemeinde (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  bundesland  text,
  created_at  timestamptz not null default now()
);

-- ── A) Bestehende Tabellen erweitern ──
-- Nur wirklich neue Felder. Bestehende Spalten werden wiederverwendet:
--   is_monument → Denkmalschutz, energy_class → Energieklasse,
--   plot_area → Grundstücksfläche, living_area/total_area → Wohnfläche,
--   monthly_management_costs → nicht umlagefähige Kosten.
alter table properties
  add column if not exists erhaltungssatzung boolean default false,  -- Milieuschutz (≠ misuse_status/Zweckentfremdung)
  add column if not exists bodenrichtwert    numeric,
  add column if not exists objektfaktor      numeric,                -- Verkehrswert-Multiplikator
  add column if not exists bgf_qm            numeric,
  add column if not exists gemeinde_id       uuid references gemeinde(id);

alter table units
  add column if not exists status text default 'ist';                      -- ist|potenzial

-- ── B) Regelwerk (versioniert, gemeinde-/datumsbezogen) ──
create table if not exists regelwerk (
  id          uuid primary key default gen_random_uuid(),
  gemeinde_id uuid references gemeinde(id),
  regel_code  text not null,         -- kappungsgrenze|mietpreisbremse|modernisierung_deckel|
                                      -- zwevs|milieuschutz|umwandlungsverordnung
  parameter   jsonb not null,        -- z.B. {"kappung_pct": 15}
  gueltig_von date not null,
  gueltig_bis date,
  quelle      text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_regelwerk_gemeinde on regelwerk(gemeinde_id, regel_code);

-- ── Mietspiegel (ortsübliche Vergleichsmiete je Segment, Referenz) ──
create table if not exists mietspiegel (
  id                     uuid primary key default gen_random_uuid(),
  gemeinde_id            uuid references gemeinde(id),
  segment                jsonb,       -- Baujahr, Lage, Ausstattung
  vergleichsmiete_eur_qm numeric,
  gueltig_von            date,
  gueltig_bis            date
);
create index if not exists idx_mietspiegel_gemeinde on mietspiegel(gemeinde_id);

-- ── Maßnahmen-Katalog (Stammdaten, global) ──
create table if not exists massnahme_typ (
  code             text primary key,  -- z.B. 'werbeflaeche_giebel'
  kategorie        text not null,     -- mietertrag|zusatzerloes|flaeche|kosten|portfolio
  klasse           text not null,     -- quick_win|capex
  label            text not null,
  param_schema     jsonb,             -- erwartete Parameter
  constraint_codes text[]             -- welche Regeln zu prüfen sind
);

-- ── Baurechtliche Objektparameter ──
create table if not exists baurecht (
  property_id      uuid primary key references properties(id) on delete cascade,
  tenant_id        uuid not null references tenants(id),
  bplan            text,
  grz              numeric,
  gfz              numeric,
  geplante_bgf     numeric,
  statik_reserve   boolean,
  genehmigungslage jsonb
);

-- ── Flächenkataster: Potenzialflächen ──
create table if not exists potenzialflaeche (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id),
  property_id  uuid not null references properties(id) on delete cascade,
  art          text not null,         -- dg_unausgebaut|souterrain|giebel_werbung|dachflaeche_pv|
                                       -- dachflaeche_antenne|stellplatz|kellerlager|fahrradbox|garten
  flaeche_qm   numeric,
  menge        int,
  beschreibung text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_potenzialflaeche_tenant on potenzialflaeche(tenant_id);
create index if not exists idx_potenzialflaeche_property on potenzialflaeche(property_id);

-- ── Mietvertrag (analysebezogen, FK auf bestehende units) ──
create table if not exists mietvertrag (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id),
  unit_id         uuid not null references units(id) on delete cascade,
  mietart         text not null,      -- standard|index|staffel
  kaltmiete_eur   numeric not null,
  beginn          date,
  letzte_erhoehung date,
  leerstand       boolean default false,
  created_at      timestamptz not null default now()
);
create index if not exists idx_mietvertrag_tenant on mietvertrag(tenant_id);
create index if not exists idx_mietvertrag_unit on mietvertrag(unit_id);

-- ── Konkrete Maßnahme an einem Objekt ──
create table if not exists massnahme (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references tenants(id),
  property_id           uuid not null references properties(id) on delete cascade,
  typ_code              text not null references massnahme_typ(code),
  potenzialflaeche_id   uuid references potenzialflaeche(id) on delete set null,
  params                jsonb,
  invest_eur            numeric,
  ertragswirkung_pa_eur numeric,      -- ΔNOI
  -- berechnet & gecacht:
  werthebel_eur         numeric,
  amortisation_jahre    numeric,
  zulaessigkeit         text,         -- zulaessig|bedingt|gesperrt
  created_by            uuid references auth.users(id),
  created_at            timestamptz not null default now()
);
create index if not exists idx_massnahme_tenant on massnahme(tenant_id);
create index if not exists idx_massnahme_property on massnahme(property_id);

-- ── Szenarien ──
create table if not exists szenario (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id),
  property_id  uuid not null references properties(id) on delete cascade,
  name         text,
  ist_baseline boolean default false,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now()
);
create index if not exists idx_szenario_tenant on szenario(tenant_id);
create index if not exists idx_szenario_property on szenario(property_id);

create table if not exists szenario_massnahme (
  szenario_id  uuid not null references szenario(id) on delete cascade,
  massnahme_id uuid not null references massnahme(id) on delete cascade,
  tenant_id    uuid not null references tenants(id),
  primary key (szenario_id, massnahme_id)
);

-- ── Ergebnis-Snapshot je Szenario (reproduzierbar, auditierbar) ──
create table if not exists kennzahlen_snapshot (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references tenants(id),
  szenario_id           uuid references szenario(id) on delete cascade,
  noi_eur               numeric,
  faktor                numeric,
  verkehrswert_eur      numeric,
  bruttorendite         numeric,
  nettorendite          numeric,
  ek_rendite            numeric,
  irr                   numeric,
  aufteilungsgewinn_eur numeric,
  afa_effekt_eur        numeric,
  inputs                jsonb,        -- gespeicherte Engine-Inputs (Determinismus)
  berechnet_am          timestamptz not null default now(),
  engine_version        text
);
create index if not exists idx_snapshot_tenant on kennzahlen_snapshot(tenant_id);
create index if not exists idx_snapshot_szenario on kennzahlen_snapshot(szenario_id);

-- ── Portfolio (Tabellen angelegt, Befüllung spätere Phase) ──
create table if not exists standardpaket (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references tenants(id),
  name                   text,        -- 'Bad-Paket','Boden-Paket','Türen','Licht'
  kosten_pro_einheit_eur numeric,
  ertragswirkung_pa_eur  numeric
);
create table if not exists capex_plan (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id),
  jahr         int,
  property_id  uuid references properties(id) on delete cascade,
  massnahme_id uuid references massnahme(id) on delete set null,
  budget_eur   numeric,
  status       text
);

-- ============================================================
-- RLS
-- ============================================================

-- Mandanten-skalierte Tabellen
do $$
declare t text;
begin
  foreach t in array array[
    'baurecht','potenzialflaeche','mietvertrag','massnahme','szenario',
    'szenario_massnahme','kennzahlen_snapshot','standardpaket','capex_plan'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t||'_select', t);
    execute format('drop policy if exists %I on %I', t||'_insert', t);
    execute format('drop policy if exists %I on %I', t||'_update', t);
    execute format('drop policy if exists %I on %I', t||'_delete', t);
    execute format('create policy %I on %I for select using (tenant_id = current_tenant_id())', t||'_select', t);
    execute format('create policy %I on %I for insert with check (tenant_id = current_tenant_id())', t||'_insert', t);
    execute format('create policy %I on %I for update using (tenant_id = current_tenant_id())', t||'_update', t);
    execute format('create policy %I on %I for delete using (tenant_id = current_tenant_id())', t||'_delete', t);
  end loop;
end $$;

-- Globale Referenz-/Stammdaten: für alle authentifizierten User lesbar.
-- Schreiben erfolgt nur über Service-Role (umgeht RLS).
do $$
declare t text;
begin
  foreach t in array array['gemeinde','regelwerk','mietspiegel','massnahme_typ'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t||'_select_all', t);
    execute format('create policy %I on %I for select using (auth.role() = ''authenticated'')', t||'_select_all', t);
  end loop;
end $$;
