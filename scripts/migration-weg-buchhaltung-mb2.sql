-- MB2 (Bankimport) — Nachrüstung gegen hausgeldabrechnung-spec.md B5.
-- Additiv: keine bestehende Zeile wird ungültig, alle neuen Spalten sind
-- nullable bzw. defaulted. Im Supabase-SQL-Editor ausführen.

-- 1. transactions: neue Felder aus dem CAMT.053-Feldkatalog (B5.3), Sammel-
--    buchungs-/Dublettenlogik (B5.4/B5.5) und Rohdaten-Ablage (B6).
alter table transactions
  add column if not exists counterparty_bic text,
  add column if not exists end_to_end_id text,
  add column if not exists mandate_id text,
  add column if not exists bank_ref text,
  add column if not exists bank_tx_code_domain text,
  add column if not exists bank_tx_code_family text,
  add column if not exists bank_tx_code_subfamily text,
  add column if not exists bank_tx_code_proprietary text,
  add column if not exists return_reason_code text,
  add column if not exists is_reversal boolean not null default false,
  add column if not exists batch_parent_id text,
  add column if not exists needs_manual_split boolean not null default false,
  add column if not exists dedup_key text,
  add column if not exists raw jsonb;

create unique index if not exists uq_transactions_bank_account_dedup_key
  on transactions(bank_account_id, dedup_key) where dedup_key is not null;

create index if not exists idx_transactions_batch_parent
  on transactions(batch_parent_id) where batch_parent_id is not null;

-- 2. transactions.kind: um die B8.1-Buchungsarten ergänzen, die erst ab MB3/
--    MB4 gebraucht werden (Guthaben-Auszahlung, Rücklastschrift, Klärungs-
--    konto) — hier mitgezogen, um für dieselbe Spalte keine zweite Migration
--    zu brauchen. Verifiziert: der Constraint-Name folgt Postgres' Standard-
--    benennung (<tabelle>_<spalte>_check), da er im Original ohne expliziten
--    Namen angelegt wurde (migration-weg-buchhaltung.sql).
alter table transactions drop constraint if exists transactions_kind_check;
alter table transactions add constraint transactions_kind_check
  check (kind in ('advance_payment', 'special_levy_payment', 'expense', 'income',
                   'internal_transfer', 'reserve_expense',
                   'settlement_payment', 'returned_debit', 'suspense'));

-- 3. bank_statement_imports: datei-/mandantenweit statt zwingend einem
--    Konto zugeordnet (eine Datei/ZIP kann mehrere Stmt-Elemente = mehrere
--    Konten enthalten), plus Datei-Hash (Idempotenz, B5.2 Schritt 1) und
--    Importprotokoll-Felder (abgelehnte Auszüge, Warnungen, Statement-
--    Zusammenfassung — B5.2 Schritt 10).
alter table bank_statement_imports
  alter column bank_account_id drop not null,
  add column if not exists file_hash text,
  add column if not exists rejected_statements jsonb not null default '[]',
  add column if not exists warnings jsonb not null default '[]',
  add column if not exists statement_summary jsonb not null default '[]';

create unique index if not exists uq_bank_statement_imports_tenant_file_hash
  on bank_statement_imports(tenant_id, file_hash) where file_hash is not null;

-- balance_confirmations.source enthält bereits 'manual' und 'import' (s.
-- migration-weg-buchhaltung.sql) — keine Änderung nötig, der Commit-Pfad
-- nutzt ab MB2 tatsächlich 'import' statt nur 'manual'.
