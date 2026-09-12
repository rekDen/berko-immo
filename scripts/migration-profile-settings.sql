-- ============================================================
-- MIGRATION: Profil-Einstellungen (Vor-/Nachname, Signatur)
-- ============================================================
-- Ergänzt die profiles-Tabelle um getrennte Vor-/Nachnamen-Felder
-- sowie eine E-Mail-Signatur (HTML + Klartext).
-- firm_name existiert bereits und wird für "Firmenname bearbeiten" verwendet.
-- ============================================================

alter table profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists signature_html text,
  add column if not exists signature_text text;
