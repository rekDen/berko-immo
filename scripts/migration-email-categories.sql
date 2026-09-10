-- ============================================================
-- Migration: E-Mail-Kategorien für Hausverwaltung
-- ============================================================
-- Entfernt: gericht, mandant, gegner
-- Neu: objektbezogen, mieterkommunikation, finanzen, schaeden,
--      vertraege, weg, behoerden, dienstleister, termine
-- Bleibt: intern, newsletter
-- ============================================================

-- 1. Alte Werte auf NULL setzen (keine saubere automatische Zuordnung)
update emails
  set category = null,
      ai_categorized = false
where category in ('gericht', 'mandant', 'gegner');

-- 2. Alten Check-Constraint entfernen
alter table emails drop constraint if exists emails_category_check;

-- 3. Neuen Check-Constraint setzen
alter table emails
  add constraint emails_category_check
  check (category in (
    'objektbezogen',
    'mieterkommunikation',
    'finanzen',
    'schaeden',
    'vertraege',
    'weg',
    'behoerden',
    'dienstleister',
    'termine',
    'intern',
    'newsletter'
  ));
