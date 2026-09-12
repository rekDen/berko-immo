-- ============================================================
-- MIGRATION: Modul „WEG-Jahresabrechnung" — Meilenstein M5 (Dokumentkategorien)
-- ============================================================
-- Ergänzt `document_categories` um eine neue Gruppe für die vom Rechenkern
-- erzeugten Abrechnungs-PDFs, analog zu scripts/migration-categories-expand.sql
-- (gleiches ID-Namensschema, nächster freie Gruppen-Slot 0014).
--
-- Empfehlung aus hausgeldabrechnung-plan.md Abschnitt 4: Settlement-PDFs über
-- das aktuelle DMS (documents/document_categories), nicht über das Legacy-
-- System folders/files.
--
-- Hinweis zur Abgrenzung: Es existiert bereits eine ähnliche Kategorie
-- `VERTRAG_ABRECHNUNGEN.HAUSGELDABRECHNUNG` (level = 'contract', s.
-- scripts/seed-dms.sql) für manuell hochgeladene Abrechnungen je Vertrag.
-- Die hier neu angelegten Kategorien sind bewusst getrennt und auf
-- `level = 'unit'` bzw. `'property'` ausgelegt, weil `SettlementUnit`
-- (Kapitel 6.2) direkt an `unitId`, nicht an einen CRM-`contract`, gebunden
-- ist — nicht jede Einheit hat zwingend einen zugehörigen Vertrag. Beide
-- Kategorien können nebeneinander bestehen (unterschiedlicher Zweck: manueller
-- Upload vs. vom System erzeugtes, autoritatives Abrechnungsdokument).
--
-- Ausführung: Im Supabase-SQL-Editor manuell ausführen.
-- ============================================================

insert into document_categories (id, parent_id, code, group_code, name_de, name_en, name_ru, level, allowed_roles, supports_fiscal_year, search_synonyms, sort_order) values
  ('dc000000-0000-0000-0014-000000000000', null, 'WEG_ABRECHNUNG', 'WEG_ABRECHNUNG',
   'WEG-Jahresabrechnung', 'WEG Annual Statement', 'Годовой расчёт ТСЖ',
   'property', '{beirat,owner,proxy}', true, '{}', 200)
on conflict (code) do nothing;

insert into document_categories (id, parent_id, code, group_code, name_de, name_en, name_ru, level, allowed_roles, supports_fiscal_year, search_synonyms, sort_order) values
  ('dc000000-0000-0000-0014-000000000001', 'dc000000-0000-0000-0014-000000000000',
   'WEG_ABRECHNUNG.GESAMTABRECHNUNG', 'WEG_ABRECHNUNG',
   'Gesamtabrechnung', 'Overall Statement', 'Общий расчёт',
   'property', '{beirat,owner,proxy}', true,
   '{Gesamtabrechnung,Jahresabrechnung}', 1),
  ('dc000000-0000-0000-0014-000000000002', 'dc000000-0000-0000-0014-000000000000',
   'WEG_ABRECHNUNG.EINZELABRECHNUNG', 'WEG_ABRECHNUNG',
   'Einzelabrechnung', 'Unit Statement', 'Индивидуальный расчёт',
   'unit', '{beirat,owner,proxy}', true,
   '{Einzelabrechnung,Hausgeldabrechnung,Abrechnungsspitze}', 2),
  ('dc000000-0000-0000-0014-000000000003', 'dc000000-0000-0000-0014-000000000000',
   'WEG_ABRECHNUNG.VERMOEGENSBERICHT', 'WEG_ABRECHNUNG',
   'Vermögensbericht', 'Asset Report', 'Отчёт об имуществе',
   'property', '{beirat,owner,proxy}', true,
   '{Vermögensbericht,Vermögensstatus,Rücklagenbericht}', 3)
on conflict (code) do nothing;
