-- ============================================================
-- MIGRATION: Modul „WEG-Buchhaltung" — Meilenstein B1 (Datenmodell)
-- ============================================================
-- Spezifikation: docs/specs/weg-buchhaltung-spec.md
-- Voraussetzung für: docs/specs/hausgeldabrechnung-spec.md (M1)
--
-- Enthält: Kontenplan + doppelte Buchführung (Kapitel 5.8), Bankkonten der
-- Gemeinschaft, Kostenarten/Verteilerschlüssel, Wirtschaftsplan, Sonderumlagen,
-- Buchungen (Transaction), Bank-Import-Läufe, Zuordnungsregeln.
--
-- Anpassungen ggü. der Spezifikation (Kapitel 0.1: bestehende Konvention
-- sticht, Abweichung wird hier vermerkt):
--   - Enum-Werte durchgängig lowercase snake_case statt UPPERCASE, wie im
--     Rest von supabase-schema.sql (z. B. 'asset' statt 'ASSET').
--   - `Account.linkedBankAccountId` aus dem Spec-Entwurf entfällt: das wäre
--     eine zirkuläre FK gewesen (Account -> CommunityBankAccount und zurück).
--     `community_bank_accounts.ledger_account_id` ist die einzige Richtung;
--     die Rückrichtung ist eine simple, indizierte Abfrage.
--   - Offene Fragen Q4/Q6/Q9 (siehe Spec Kapitel 11) sind hier mit dem dort
--     vorgesehenen "Standard bis zur Klärung" umgesetzt:
--       Q4: mehrere Rücklagenkonten je Objekt sind strukturell erlaubt
--           (kind = 'reserve' beliebig oft je property_id).
--       Q6: keine _select_external-Policies in diesem Migrationsschritt —
--           alles bleibt vorerst verwalterintern (tenant_admin/tenant_user).
--       Q9: schlanker WEG-spezifischer Kontenplan, kein SKR03/04-Import.
--   - `journal_entries`/`journal_entry_lines` sind bewusst ohne updated_at/
--     deleted_at modelliert: ein Buchungssatz wird nicht verändert oder
--     gelöscht, Korrekturen laufen über einen neuen, gegenläufigen Buchungssatz
--     (Standardpraxis doppelter Buchführung; hier zusätzlich technisch über
--     fehlende UPDATE/DELETE-Policies erzwungen, siehe RLS-Abschnitt unten).
--   - `CostType.costCenterId` ist als loses, unverknüpftes Feld angelegt
--     (kein CostCenter-Entität spezifiziert, `hausgeldabrechnung-spec.md`
--     3.2: Kostenstellen sind nach dem MVP der Hausgeldabrechnung).
--
-- Ausführung: Im Supabase-SQL-Editor des Projekts (wie alle bisherigen
-- migration-*.sql-Dateien dieses Repos) manuell ausführen. Diese Datei kann
-- nicht automatisiert von Claude Code ausgeführt werden (kein DATABASE_URL,
-- siehe hausgeldabrechnung-plan.md Abschnitt 6, Q6 / weg-buchhaltung-spec.md
-- Q5 — weiterhin ungeklärt, hier nur pragmatisch umschifft).
-- ============================================================


-- ============================================================
-- 1. KONTENPLAN — Account
-- ============================================================

create table accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  property_id uuid not null references properties(id),
  code text not null,
  name text not null,
  kind text not null
    check (kind in ('asset', 'liability', 'equity', 'expense', 'income')),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create unique index uq_accounts_property_code on accounts(property_id, code);
create index idx_accounts_tenant on accounts(tenant_id);
create index idx_accounts_property_kind on accounts(property_id, kind);

create trigger trg_accounts_updated_at before update on accounts
  for each row execute function set_updated_at();


-- ============================================================
-- 2. VERTEILERSCHLÜSSEL — AllocationKey / AllocationKeyValue
-- ============================================================

create table allocation_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  property_id uuid not null references properties(id),
  name text not null,
  type text not null
    check (type in ('co_ownership', 'area', 'unit_count', 'persons', 'consumption', 'custom')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index idx_allocation_keys_property on allocation_keys(property_id);

create trigger trg_allocation_keys_updated_at before update on allocation_keys
  for each row execute function set_updated_at();

create table allocation_key_values (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  key_id uuid not null references allocation_keys(id),
  unit_id uuid not null references units(id),
  value numeric(14,4) not null,
  valid_from date not null,
  valid_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  check (valid_to is null or valid_to >= valid_from)
);

create index idx_allocation_key_values_key on allocation_key_values(key_id);
create index idx_allocation_key_values_unit on allocation_key_values(unit_id);

create trigger trg_allocation_key_values_updated_at before update on allocation_key_values
  for each row execute function set_updated_at();


-- ============================================================
-- 3. KOSTENARTEN — CostType
-- ============================================================

create table cost_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  property_id uuid not null references properties(id),
  name text not null,
  direction text not null
    check (direction in ('expense', 'income')),
  allocation_key_id uuid references allocation_keys(id),
  is_heating boolean not null default false,
  allows_direct_charge boolean not null default false,
  apportionable boolean not null default false,
  betrkv_no int check (betrkv_no between 1 and 17),
  cost_center_id uuid,               -- lose, unverknüpft — s. Hinweis oben
  resolution_ref text,
  ledger_account_id uuid not null references accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index idx_cost_types_property on cost_types(property_id);
create unique index uq_cost_types_ledger_account on cost_types(ledger_account_id);

create trigger trg_cost_types_updated_at before update on cost_types
  for each row execute function set_updated_at();


-- ============================================================
-- 4. BANKKONTEN DER GEMEINSCHAFT — CommunityBankAccount / BalanceConfirmation
-- ============================================================
-- Achtung: nicht zu verwechseln mit der bestehenden Tabelle `bank_accounts`
-- (kontaktbezogene SEPA-Mandate von Eigentümern/Mietern, unverändert).

create table community_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  property_id uuid not null references properties(id),
  iban text not null,
  bic text,
  kind text not null
    check (kind in ('operating', 'reserve')),
  label text not null,
  ledger_account_id uuid not null references accounts(id),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index idx_community_bank_accounts_property on community_bank_accounts(property_id);
create unique index uq_community_bank_accounts_ledger_account on community_bank_accounts(ledger_account_id);

create trigger trg_community_bank_accounts_updated_at before update on community_bank_accounts
  for each row execute function set_updated_at();

create table balance_confirmations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  bank_account_id uuid not null references community_bank_accounts(id),
  date date not null,
  balance bigint not null,           -- Cents
  source text not null
    check (source in ('manual', 'import')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create unique index uq_balance_confirmations_account_date on balance_confirmations(bank_account_id, date);
create index idx_balance_confirmations_tenant on balance_confirmations(tenant_id);

create trigger trg_balance_confirmations_updated_at before update on balance_confirmations
  for each row execute function set_updated_at();


-- ============================================================
-- 5. WIRTSCHAFTSPLAN — EconomicPlan / PlanAdvance
-- ============================================================

create table economic_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  property_id uuid not null references properties(id),
  year int not null,
  resolution_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index idx_economic_plans_property_year on economic_plans(property_id, year);

create trigger trg_economic_plans_updated_at before update on economic_plans
  for each row execute function set_updated_at();

create table plan_advances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  plan_id uuid not null references economic_plans(id),
  unit_id uuid not null references units(id),
  monthly_operating bigint not null,  -- Cents
  monthly_reserve bigint not null,    -- Cents
  valid_from date not null,
  valid_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  check (valid_to is null or valid_to >= valid_from),
  check (monthly_operating >= 0 and monthly_reserve >= 0)
);

create index idx_plan_advances_plan on plan_advances(plan_id);
create index idx_plan_advances_unit on plan_advances(unit_id);

create trigger trg_plan_advances_updated_at before update on plan_advances
  for each row execute function set_updated_at();


-- ============================================================
-- 6. SONDERUMLAGEN — SpecialLevy / SpecialLevyUnit
-- ============================================================

create table special_levies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  property_id uuid not null references properties(id),
  resolution_date date not null,
  purpose text not null,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index idx_special_levies_property on special_levies(property_id);

create trigger trg_special_levies_updated_at before update on special_levies
  for each row execute function set_updated_at();

create table special_levy_units (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  levy_id uuid not null references special_levies(id),
  unit_id uuid not null references units(id),
  amount bigint not null,             -- Cents
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  check (amount >= 0)
);

create unique index uq_special_levy_units on special_levy_units(levy_id, unit_id);

create trigger trg_special_levy_units_updated_at before update on special_levy_units
  for each row execute function set_updated_at();


-- ============================================================
-- 7. BUCHUNGSSÄTZE — JournalEntry / JournalEntryLine
-- ============================================================
-- Append-only: keine updated_at-/deleted_at-Spalten, keine UPDATE/DELETE-
-- Policies (siehe RLS-Abschnitt). Korrekturen laufen über einen neuen,
-- gegenläufigen Buchungssatz, nicht über das Ändern eines bestehenden.
--
-- journal_entries.source_transaction_id verweist auf transactions(id);
-- da transactions.journal_entry_id umgekehrt auf journal_entries verweist,
-- wird die FK erst ganz unten per ALTER TABLE ergänzt, nachdem `transactions`
-- existiert (gleiches Muster wie contact_roles.contract_id -> contracts(id)
-- im Haupt-Schema).

create table journal_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  property_id uuid not null references properties(id),
  date date not null,
  description text not null,
  resolution_ref text,
  source_transaction_id uuid,         -- FK ergänzt am Ende der Datei
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index idx_journal_entries_property_date on journal_entries(property_id, date);
create index idx_journal_entries_source_transaction on journal_entries(source_transaction_id)
  where source_transaction_id is not null;

create table journal_entry_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  journal_entry_id uuid not null references journal_entries(id),
  account_id uuid not null references accounts(id),
  debit bigint,                       -- Cents; genau eines von debit/credit gesetzt
  credit bigint,
  cost_type_id uuid references cost_types(id),
  unit_id uuid references units(id),
  owner_id uuid references contacts(id),
  created_at timestamptz not null default now(),
  check (
    (debit is not null and credit is null and debit >= 0)
    or (debit is null and credit is not null and credit >= 0)
  )
);

create index idx_journal_entry_lines_entry on journal_entry_lines(journal_entry_id);
create index idx_journal_entry_lines_account on journal_entry_lines(account_id);
create index idx_journal_entry_lines_cost_type on journal_entry_lines(cost_type_id)
  where cost_type_id is not null;

-- Ausgeglichenheits-Invariante (Spec 5.8.2): Σ debit = Σ credit je Buchungssatz.
-- Als DEFERRABLE-Constraint-Trigger, damit eine Anwendung beide Zeilen eines
-- Buchungssatzes innerhalb derselben Transaktion einfügen kann, bevor am
-- COMMIT geprüft wird — kein einfacher CHECK möglich, da die Invariante über
-- mehrere Zeilen hinweg gilt.

create or replace function check_journal_entry_balanced() returns trigger as $$
declare
  v_entry_id uuid;
  v_debit bigint;
  v_credit bigint;
  v_line_count int;
begin
  v_entry_id := coalesce(new.journal_entry_id, old.journal_entry_id);

  select coalesce(sum(debit), 0), coalesce(sum(credit), 0), count(*)
    into v_debit, v_credit, v_line_count
    from journal_entry_lines
    where journal_entry_id = v_entry_id;

  if v_line_count > 0 and v_debit <> v_credit then
    raise exception 'Buchungssatz % ist nicht ausgeglichen: Soll % Cent <> Haben % Cent',
      v_entry_id, v_debit, v_credit;
  end if;

  return null;
end;
$$ language plpgsql;

create constraint trigger trg_journal_entry_lines_balanced
  after insert or update or delete on journal_entry_lines
  deferrable initially deferred
  for each row execute function check_journal_entry_balanced();


-- ============================================================
-- 8. BANK-IMPORT UND ZUORDNUNGSREGELN — BankStatementImport / MatchingRule
-- ============================================================

create table bank_statement_imports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  bank_account_id uuid not null references community_bank_accounts(id),
  file_name text not null,
  format text not null
    check (format in ('csv', 'camt053')),
  imported_at timestamptz not null default now(),
  imported_by uuid references auth.users(id),
  row_count int not null default 0,
  created_count int not null default 0,
  duplicate_count int not null default 0
);

create index idx_bank_statement_imports_account on bank_statement_imports(bank_account_id);

create table matching_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  property_id uuid not null references properties(id),
  pattern jsonb not null default '{}',  -- { iban?: string, purposeContains?: string }
  target_unit_id uuid references units(id),
  target_owner_id uuid references contacts(id),
  target_cost_type_id uuid references cost_types(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index idx_matching_rules_property on matching_rules(property_id) where active;

create trigger trg_matching_rules_updated_at before update on matching_rules
  for each row execute function set_updated_at();


-- ============================================================
-- 9. BUCHUNGEN — Transaction
-- ============================================================

create table transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  bank_account_id uuid not null references community_bank_accounts(id),
  booking_date date not null,
  amount bigint not null,             -- Cents, mit Vorzeichen
  kind text not null
    check (kind in ('advance_payment', 'special_levy_payment', 'expense', 'income',
                    'internal_transfer', 'reserve_expense')),
  cost_type_id uuid references cost_types(id),
  unit_id uuid references units(id),
  owner_id uuid references contacts(id),
  direct_unit_id uuid references units(id),
  special_levy_id uuid references special_levies(id),
  purpose text,
  counterparty_iban text,
  resolution_ref text,
  labor_amount bigint,                -- Cents, § 35a
  par35a_category text
    check (par35a_category in ('household_employment', 'household_service', 'craftsman')),
  document_id uuid references documents(id),
  import_id uuid references bank_statement_imports(id),
  status text not null default 'suggested'
    check (status in ('suggested', 'confirmed')),
  source text not null
    check (source in ('bank_import', 'manual', 'ai')),
  matched_by_rule_id uuid references matching_rules(id),
  journal_entry_id uuid references journal_entries(id),  -- erst bei status = 'confirmed' gesetzt
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  check (status = 'confirmed' or journal_entry_id is null)
);

create index idx_transactions_bank_account_date on transactions(bank_account_id, booking_date);
create index idx_transactions_tenant_status on transactions(tenant_id, status);
create index idx_transactions_cost_type on transactions(cost_type_id) where cost_type_id is not null;
create index idx_transactions_special_levy on transactions(special_levy_id) where special_levy_id is not null;

create trigger trg_transactions_updated_at before update on transactions
  for each row execute function set_updated_at();

-- Rückverknüpfung journal_entries.source_transaction_id -> transactions.id
-- (siehe Hinweis in Abschnitt 7)
alter table journal_entries
  add constraint fk_journal_entries_source_transaction
  foreign key (source_transaction_id) references transactions(id);


-- ============================================================
-- 10. RLS
-- ============================================================
-- Muster wie im Haupt-Schema (hausgeldabrechnung-plan.md Abschnitt 5):
-- select/insert/update über current_tenant_id() + is_tenant_admin().
-- journal_entries/journal_entry_lines bekommen bewusst KEINE Update-Policy
-- (Append-only, s. Abschnitt 7) — Insert und Select genügen.
-- Keine _select_external-Policies in diesem Schritt (Offene Frage Q6,
-- „Standard bis zur Klärung": vorerst rein verwalterintern).

-- -- -- ACCOUNTS -- -- --
alter table accounts enable row level security;
create policy "accounts_select_tenant" on accounts
  for select using (tenant_id = current_tenant_id());
create policy "accounts_insert_tenant" on accounts
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());
create policy "accounts_update_tenant" on accounts
  for update using (tenant_id = current_tenant_id() and is_tenant_admin());

-- -- -- ALLOCATION_KEYS -- -- --
alter table allocation_keys enable row level security;
create policy "allocation_keys_select_tenant" on allocation_keys
  for select using (tenant_id = current_tenant_id());
create policy "allocation_keys_insert_tenant" on allocation_keys
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());
create policy "allocation_keys_update_tenant" on allocation_keys
  for update using (tenant_id = current_tenant_id() and is_tenant_admin());

-- -- -- ALLOCATION_KEY_VALUES -- -- --
alter table allocation_key_values enable row level security;
create policy "allocation_key_values_select_tenant" on allocation_key_values
  for select using (tenant_id = current_tenant_id());
create policy "allocation_key_values_insert_tenant" on allocation_key_values
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());
create policy "allocation_key_values_update_tenant" on allocation_key_values
  for update using (tenant_id = current_tenant_id() and is_tenant_admin());

-- -- -- COST_TYPES -- -- --
alter table cost_types enable row level security;
create policy "cost_types_select_tenant" on cost_types
  for select using (tenant_id = current_tenant_id());
create policy "cost_types_insert_tenant" on cost_types
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());
create policy "cost_types_update_tenant" on cost_types
  for update using (tenant_id = current_tenant_id() and is_tenant_admin());

-- -- -- COMMUNITY_BANK_ACCOUNTS -- -- --
alter table community_bank_accounts enable row level security;
create policy "community_bank_accounts_select_tenant" on community_bank_accounts
  for select using (tenant_id = current_tenant_id());
create policy "community_bank_accounts_insert_tenant" on community_bank_accounts
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());
create policy "community_bank_accounts_update_tenant" on community_bank_accounts
  for update using (tenant_id = current_tenant_id() and is_tenant_admin());

-- -- -- BALANCE_CONFIRMATIONS -- -- --
alter table balance_confirmations enable row level security;
create policy "balance_confirmations_select_tenant" on balance_confirmations
  for select using (tenant_id = current_tenant_id());
create policy "balance_confirmations_insert_tenant" on balance_confirmations
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());
create policy "balance_confirmations_update_tenant" on balance_confirmations
  for update using (tenant_id = current_tenant_id() and is_tenant_admin());

-- -- -- ECONOMIC_PLANS -- -- --
alter table economic_plans enable row level security;
create policy "economic_plans_select_tenant" on economic_plans
  for select using (tenant_id = current_tenant_id());
create policy "economic_plans_insert_tenant" on economic_plans
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());
create policy "economic_plans_update_tenant" on economic_plans
  for update using (tenant_id = current_tenant_id() and is_tenant_admin());

-- -- -- PLAN_ADVANCES -- -- --
alter table plan_advances enable row level security;
create policy "plan_advances_select_tenant" on plan_advances
  for select using (tenant_id = current_tenant_id());
create policy "plan_advances_insert_tenant" on plan_advances
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());
create policy "plan_advances_update_tenant" on plan_advances
  for update using (tenant_id = current_tenant_id() and is_tenant_admin());

-- -- -- SPECIAL_LEVIES -- -- --
alter table special_levies enable row level security;
create policy "special_levies_select_tenant" on special_levies
  for select using (tenant_id = current_tenant_id());
create policy "special_levies_insert_tenant" on special_levies
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());
create policy "special_levies_update_tenant" on special_levies
  for update using (tenant_id = current_tenant_id() and is_tenant_admin());

-- -- -- SPECIAL_LEVY_UNITS -- -- --
alter table special_levy_units enable row level security;
create policy "special_levy_units_select_tenant" on special_levy_units
  for select using (tenant_id = current_tenant_id());
create policy "special_levy_units_insert_tenant" on special_levy_units
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());
create policy "special_levy_units_update_tenant" on special_levy_units
  for update using (tenant_id = current_tenant_id() and is_tenant_admin());

-- -- -- JOURNAL_ENTRIES (append-only: keine Update-Policy) -- -- --
alter table journal_entries enable row level security;
create policy "journal_entries_select_tenant" on journal_entries
  for select using (tenant_id = current_tenant_id());
create policy "journal_entries_insert_tenant" on journal_entries
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());

-- -- -- JOURNAL_ENTRY_LINES (append-only: keine Update-Policy) -- -- --
alter table journal_entry_lines enable row level security;
create policy "journal_entry_lines_select_tenant" on journal_entry_lines
  for select using (tenant_id = current_tenant_id());
create policy "journal_entry_lines_insert_tenant" on journal_entry_lines
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());

-- -- -- BANK_STATEMENT_IMPORTS -- -- --
alter table bank_statement_imports enable row level security;
create policy "bank_statement_imports_select_tenant" on bank_statement_imports
  for select using (tenant_id = current_tenant_id());
create policy "bank_statement_imports_insert_tenant" on bank_statement_imports
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());

-- -- -- MATCHING_RULES -- -- --
alter table matching_rules enable row level security;
create policy "matching_rules_select_tenant" on matching_rules
  for select using (tenant_id = current_tenant_id());
create policy "matching_rules_insert_tenant" on matching_rules
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());
create policy "matching_rules_update_tenant" on matching_rules
  for update using (tenant_id = current_tenant_id() and is_tenant_admin());

-- -- -- TRANSACTIONS -- -- --
alter table transactions enable row level security;
create policy "transactions_select_tenant" on transactions
  for select using (tenant_id = current_tenant_id());
create policy "transactions_insert_tenant" on transactions
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());
create policy "transactions_update_tenant" on transactions
  for update using (tenant_id = current_tenant_id() and is_tenant_admin());
