-- ============================================================
-- MIGRATION: Modul „WEG-Buchhaltung" — Nachtrag Offene Posten
-- ============================================================
-- Spezifikation: scripts/hausgeldabrechnung-spec.md (Version 0.2, Kapitel B6/B7)
-- Ergänzt scripts/migration-weg-buchhaltung.sql (bereits ausgeführt).
--
-- Hintergrund: Der kanonische Teil I (B1–B13) der Spec verlangt ein
-- Offene-Posten-Modell (Receivable/PaymentAllocation) sowie eine Jahressperre
-- (YearLock) als Vorbedingung für die Jahresabrechnung (Kapitel 7: „nur
-- Buchungszeilen mit Status CONFIRMED sowie die Sollstellungen und Ausgleiche
-- nach B7"). Das ursprünglich umgesetzte Modul (docs/specs/weg-buchhaltung-spec.md)
-- hatte dafür nur Transaction+JournalEntry — das reicht für die Buchhaltung
-- selbst, aber nicht als Eingabe für den Abrechnungs-Rechenkern. Dieser
-- Nachtrag schließt genau diese Lücke, ohne die übrigen, für die Abrechnung
-- nicht geldrelevanten B1–B13-Teile (BankStatement/BankTransaction-Rohschicht,
-- PayerAccount, virtuelle IBAN, Lernfunktion) nachzubauen.
--
-- Anpassungen ggü. der Spezifikation (Kapitel 0.1):
--   - `Receivable`/`PaymentAllocation` referenzieren direkt `transactions`
--     statt eines eigenen `BookingLine` (das gebaute Modul kennt keine
--     BookingLine-Zwischenschicht — eine bestätigte Transaction trägt bereits
--     unit_id/owner_id/kind, siehe migration-weg-buchhaltung.sql Abschnitt 9).
--   - `YearLock.settlement_id` ist bewusst ohne FK angelegt (die Tabelle
--     `settlements` existiert erst mit M1 der Hausgeldabrechnung-Spec) —
--     gleiches Muster wie journal_entries.source_transaction_id in der
--     Vorgänger-Migration (FK wird dort nachträglich per ALTER TABLE ergänzt,
--     hier: Nachtrag bei M1 vorzusehen, falls referenzielle Integrität
--     gewünscht ist).
--
-- Ausführung: Im Supabase-SQL-Editor manuell ausführen (kein DATABASE_URL,
-- siehe hausgeldabrechnung-plan.md Abschnitt 9.3, Q6).
-- ============================================================


-- ============================================================
-- 1. SOLLSTELLUNGEN — Receivable
-- ============================================================

create table receivables (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  property_id uuid not null references properties(id),
  unit_id uuid not null references units(id),
  owner_id uuid not null references contacts(id),
  kind text not null
    check (kind in ('advance', 'special_levy', 'settlement_balance', 'opening', 'other')),
  amount bigint not null,              -- Cents; negativ = Guthaben des Eigentümers
  components jsonb,                    -- { operating: Cents, reserve: Cents } — nur bei kind = 'advance'
  due_date date not null,
  period_month date,                   -- nur bei kind = 'advance': erster Tag des Monats
  source_plan_advance_id uuid references plan_advances(id),
  source_special_levy_unit_id uuid references special_levy_units(id),
  legal_basis text,                    -- Pflicht bei kind = 'other'
  status text not null default 'open'
    check (status in ('open', 'partial', 'settled', 'cancelled')),
  cancelled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  check (kind <> 'other' or legal_basis is not null),
  check (status <> 'cancelled' or cancelled_reason is not null)
);

create index idx_receivables_property_unit on receivables(property_id, unit_id);
create index idx_receivables_owner on receivables(owner_id);
create index idx_receivables_due_date on receivables(due_date);
create index idx_receivables_status on receivables(tenant_id, status);
create index idx_receivables_plan_advance on receivables(source_plan_advance_id)
  where source_plan_advance_id is not null;
create index idx_receivables_special_levy_unit on receivables(source_special_levy_unit_id)
  where source_special_levy_unit_id is not null;

create trigger trg_receivables_updated_at before update on receivables
  for each row execute function set_updated_at();


-- ============================================================
-- 2. AUSGLEICH — PaymentAllocation
-- ============================================================
-- Ordnet eine bestätigte Transaction (Zahlung) einer Receivable (Sollstellung)
-- zu, nach der Ausgleichsreihenfolge B7.6 (älteste Fälligkeit zuerst, sofern
-- keine erkennbare Tilgungsbestimmung vorliegt — Anwendungslogik, nicht DB).

create table payment_allocations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  transaction_id uuid not null references transactions(id),
  receivable_id uuid not null references receivables(id),
  amount bigint not null,              -- Cents, > 0
  components jsonb,                    -- { operating: Cents, reserve: Cents } — nur bei Receivable.kind = 'advance'
  created_by_kind text not null
    check (created_by_kind in ('auto', 'manual')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversed_by uuid references auth.users(id),
  check (amount > 0)
);

create index idx_payment_allocations_transaction on payment_allocations(transaction_id);
create index idx_payment_allocations_receivable on payment_allocations(receivable_id);

-- Invarianten aus B6 als DEFERRABLE-Constraint-Trigger (gelten über mehrere
-- Zeilen hinweg, kein einfacher CHECK möglich):
--   2. Σ Ausgleiche einer Transaction ≤ Betrag der Transaction (Beträge)
--   3. Σ Ausgleiche einer Receivable ≤ Betrag der Receivable (Beträge)

create or replace function check_payment_allocation_within_bounds() returns trigger as $$
declare
  v_transaction_id uuid;
  v_receivable_id uuid;
  v_tx_amount bigint;
  v_rec_amount bigint;
  v_allocated_tx bigint;
  v_allocated_rec bigint;
begin
  v_transaction_id := coalesce(new.transaction_id, old.transaction_id);
  v_receivable_id := coalesce(new.receivable_id, old.receivable_id);

  select amount into v_tx_amount from transactions where id = v_transaction_id;
  select amount into v_rec_amount from receivables where id = v_receivable_id;

  select coalesce(sum(amount), 0) into v_allocated_tx
    from payment_allocations
    where transaction_id = v_transaction_id and reversed_at is null;

  select coalesce(sum(amount), 0) into v_allocated_rec
    from payment_allocations
    where receivable_id = v_receivable_id and reversed_at is null;

  if v_allocated_tx > abs(v_tx_amount) then
    raise exception 'Ausgleiche von Transaction % überschreiten deren Betrag (% Cent > % Cent)',
      v_transaction_id, v_allocated_tx, abs(v_tx_amount);
  end if;

  if v_allocated_rec > abs(v_rec_amount) then
    raise exception 'Ausgleiche von Receivable % überschreiten deren Betrag (% Cent > % Cent)',
      v_receivable_id, v_allocated_rec, abs(v_rec_amount);
  end if;

  return null;
end;
$$ language plpgsql;

create constraint trigger trg_payment_allocations_within_bounds
  after insert or update on payment_allocations
  deferrable initially deferred
  for each row execute function check_payment_allocation_within_bounds();

-- Receivable.status anhand ihrer Ausgleiche nachführen (open/partial/settled).
create or replace function refresh_receivable_status() returns trigger as $$
declare
  v_receivable_id uuid;
  v_rec_amount bigint;
  v_allocated bigint;
begin
  v_receivable_id := coalesce(new.receivable_id, old.receivable_id);

  select amount into v_rec_amount from receivables where id = v_receivable_id;
  select coalesce(sum(amount), 0) into v_allocated
    from payment_allocations
    where receivable_id = v_receivable_id and reversed_at is null;

  update receivables
    set status = case
      when status = 'cancelled' then 'cancelled'
      when v_allocated = 0 then 'open'
      when v_allocated < abs(v_rec_amount) then 'partial'
      else 'settled'
    end
    where id = v_receivable_id;

  return null;
end;
$$ language plpgsql;

create trigger trg_payment_allocations_refresh_status
  after insert or update or delete on payment_allocations
  for each row execute function refresh_receivable_status();


-- ============================================================
-- 3. JAHRESSPERRE — YearLock
-- ============================================================
-- Vorbedingung für die Jahresabrechnung (B9). `settlement_id` ohne FK, siehe
-- Hinweis oben — die Tabelle `settlements` entsteht erst mit M1.

create table year_locks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  property_id uuid not null references properties(id),
  year int not null,
  locked_at timestamptz not null default now(),
  locked_by uuid references auth.users(id),
  settlement_id uuid,
  unlocked_at timestamptz,
  unlocked_by uuid references auth.users(id),
  unlock_reason text,
  created_at timestamptz not null default now(),
  check (unlocked_at is null or unlock_reason is not null)
);

create index idx_year_locks_property_year on year_locks(property_id, year);
-- höchstens eine aktive (nicht entsperrte) Sperre je Objekt+Jahr
create unique index uq_year_locks_active on year_locks(property_id, year) where unlocked_at is null;

-- Hilfsfunktion: ist ein Buchungsjahr aktuell gesperrt?
create or replace function is_year_locked(p_property_id uuid, p_year int) returns boolean as $$
  select exists (
    select 1 from year_locks
    where property_id = p_property_id and year = p_year and unlocked_at is null
  );
$$ language sql stable;


-- ============================================================
-- 4. RLS
-- ============================================================
-- Muster wie in migration-weg-buchhaltung.sql: select/insert/update über
-- current_tenant_id() + is_tenant_admin(). Keine _select_external-Policies
-- (unverändert Q6 „Standard bis zur Klärung": vorerst rein verwalterintern).
-- payment_allocations bekommt bewusst keine UPDATE-Policy für `amount`
-- (Storno über reversed_at/reversed_by statt Wertänderung) — bis auf
-- reversed_at/reversed_by ist die Zeile nach dem Anlegen unveränderlich;
-- das wird hier nicht per Spalten-Grant erzwungen (Supabase-RLS kennt keine
-- spaltenweise Einschränkung ohne View), sondern nur durch Anwendungslogik.

-- -- -- RECEIVABLES -- -- --
alter table receivables enable row level security;
create policy "receivables_select_tenant" on receivables
  for select using (tenant_id = current_tenant_id());
create policy "receivables_insert_tenant" on receivables
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());
create policy "receivables_update_tenant" on receivables
  for update using (tenant_id = current_tenant_id() and is_tenant_admin());

-- -- -- PAYMENT_ALLOCATIONS -- -- --
alter table payment_allocations enable row level security;
create policy "payment_allocations_select_tenant" on payment_allocations
  for select using (tenant_id = current_tenant_id());
create policy "payment_allocations_insert_tenant" on payment_allocations
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());
create policy "payment_allocations_update_tenant" on payment_allocations
  for update using (tenant_id = current_tenant_id() and is_tenant_admin());

-- -- -- YEAR_LOCKS -- -- --
alter table year_locks enable row level security;
create policy "year_locks_select_tenant" on year_locks
  for select using (tenant_id = current_tenant_id());
create policy "year_locks_insert_tenant" on year_locks
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());
create policy "year_locks_update_tenant" on year_locks
  for update using (tenant_id = current_tenant_id() and is_tenant_admin());
