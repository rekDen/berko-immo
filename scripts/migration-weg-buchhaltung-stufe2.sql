-- ============================================================
-- MIGRATION: Modul „WEG-Buchhaltung" — B8.2 Stufe 2 (Heuristik)
-- ============================================================
-- Spec B8.2 Stufe 2 verlangt u. a. "Namensähnlichkeit zwischen Zahler und
-- Eigentümer" — dafür fehlte bisher der Name der Gegenpartei, nur die IBAN
-- wurde erfasst (`transactions.counterparty_iban`, s.
-- scripts/migration-weg-buchhaltung.sql). Diese Migration ergänzt das
-- fehlende Feld.
--
-- Ausführung: Im Supabase-SQL-Editor manuell ausführen.
-- ============================================================

alter table transactions
  add column if not exists counterparty_name text;
