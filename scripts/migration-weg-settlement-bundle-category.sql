-- ============================================================
-- MIGRATION: Modul „WEG-Jahresabrechnung" — Kapitel 8.3 Erweiterung C
-- (Sammel-PDF und ZIP-Bündelung)
-- ============================================================
-- Spec 8.3: "Die Dokumente sind als Sammel-PDF und als ZIP mit Einzeldateien
-- verfügbar." Beide auf Objekt-Ebene, da sie über alle Einheiten hinweg
-- gebündelt sind (kein Bezug zu einer einzelnen Einheit).
--
-- Ausführung: Im Supabase-SQL-Editor manuell ausführen.
-- ============================================================

insert into document_categories (id, parent_id, code, group_code, name_de, name_en, name_ru, level, allowed_roles, supports_fiscal_year, search_synonyms, sort_order) values
  ('dc000000-0000-0000-0014-000000000007', 'dc000000-0000-0000-0014-000000000000',
   'WEG_ABRECHNUNG.SAMMEL_PDF', 'WEG_ABRECHNUNG',
   'Sammel-PDF', 'Combined PDF', 'Сводный PDF',
   'property', '{beirat,owner,proxy}', true,
   '{Sammelpdf,Gesamtdokument}', 7),
  ('dc000000-0000-0000-0014-000000000008', 'dc000000-0000-0000-0014-000000000000',
   'WEG_ABRECHNUNG.ZIP_EXPORT', 'WEG_ABRECHNUNG',
   'ZIP-Export', 'ZIP Export', 'ZIP-экспорт',
   'property', '{beirat,owner,proxy}', true,
   '{ZIP,Archiv,Sammelexport}', 8)
on conflict (code) do nothing;
