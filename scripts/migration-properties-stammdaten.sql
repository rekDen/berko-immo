-- ============================================================
-- Migration: erweiterte Stammdaten für properties
-- ============================================================

alter table properties
  -- 1. Identifikation
  add column if not exists usage_type text
    check (usage_type is null or usage_type in ('residential', 'commercial', 'mixed')),
  add column if not exists last_renovation_year int,
  add column if not exists last_renovation_notes text,

  -- 2. Adressdaten
  add column if not exists state text,
  add column if not exists country text default 'DE',
  add column if not exists location_description text,

  -- 3. Flächen & Größen (zusätzlich zu total_area / unit_count)
  add column if not exists living_area numeric(10,2),
  add column if not exists usable_area numeric(10,2),
  add column if not exists plot_area numeric(10,2),
  add column if not exists room_count numeric(4,1),
  add column if not exists bathroom_count int,
  add column if not exists floor text,

  -- 4. Eigentumsverhältnisse (zusätzlich zu gemarkung/flur/flurstueck)
  add column if not exists land_register_volume text,
  add column if not exists land_register_sheet text,
  add column if not exists is_weg boolean,

  -- 5. Technische Ausstattung
  add column if not exists heating_type text,
  add column if not exists energy_class text,
  add column if not exists energy_certificate jsonb,
  add column if not exists has_elevator boolean,
  add column if not exists parking_spaces int,
  add column if not exists has_balcony boolean,
  add column if not exists has_terrace boolean,
  add column if not exists is_furnished boolean,

  -- 6. Miet- & Nutzungsdaten
  add column if not exists rental_status text
    check (rental_status is null or rental_status in ('free', 'rented', 'airbnb', 'mixed')),
  add column if not exists short_term_rental_allowed boolean,

  -- 7. Betriebs- & Kostenstruktur
  add column if not exists monthly_reserve numeric(10,2),
  add column if not exists monthly_operating_costs numeric(10,2),
  add column if not exists monthly_management_costs numeric(10,2),

  -- 8. Versicherungen (Array von { type, provider, policy_number, premium, expires_at })
  add column if not exists insurances jsonb not null default '[]',

  -- 9. Rechtliche & behördliche Daten
  add column if not exists building_permit_info text,
  add column if not exists usage_change_info text,
  add column if not exists misuse_status text,
  add column if not exists is_monument boolean;

-- WEG-Flag aus existierendem type ableiten, wo noch nicht gesetzt
update properties
  set is_weg = (type = 'weg')
where is_weg is null;
