-- ============================================================
-- MIGRATION: Modul „WEG-Jahresabrechnung" — Kapitel 8.3 Erweiterung A
-- (CSV/XLSX-Export für vermietende Eigentümer)
-- ============================================================
-- Ergänzt die bestehende Gruppe `WEG_ABRECHNUNG`
-- (scripts/migration-weg-settlement-document-categories.sql) um eine vierte
-- Kategorie für den je Einheit erzeugten CSV/XLSX-Export (Kostenarten,
-- BetrKV-Nummer, Umlagefähigkeit, § 35a-Beträge, CO2-Kosten). Eine Kategorie
-- für beide Dateiformate (CSV und XLSX), da beide denselben fachlichen Zweck
-- und dieselbe Erzeugungslogik teilen — unterschieden werden sie nur über
-- `documents.file_name`/`mime_type`.
--
-- Ausführung: Im Supabase-SQL-Editor manuell ausführen.
-- ============================================================

insert into document_categories (id, parent_id, code, group_code, name_de, name_en, name_ru, level, allowed_roles, supports_fiscal_year, search_synonyms, sort_order) values
  ('dc000000-0000-0000-0014-000000000004', 'dc000000-0000-0000-0014-000000000000',
   'WEG_ABRECHNUNG.VERMIETER_EXPORT', 'WEG_ABRECHNUNG',
   'Vermieter-Export', 'Landlord Export', 'Экспорт для арендодателя',
   'unit', '{beirat,owner,proxy}', true,
   '{Vermieterexport,Werbungskosten,Steuerexport}', 4)
on conflict (code) do nothing;
