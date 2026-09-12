-- ============================================================
-- MIGRATION: Modul „WEG-Jahresabrechnung" — Meilenstein M3 (Heizkostenimport löschbar)
-- ============================================================
-- Ergänzt scripts/migration-hausgeldabrechnung-m1.sql (bereits ausgeführt).
--
-- Hintergrund: Die M1-Migration sah für `heating_imports`/`heating_import_units`
-- keine DELETE-Policy vor. Anders als bei `journal_entries` (bewusst append-
-- only, Buchführungsgrundsatz) gibt es hier keinen fachlichen Grund, einen
-- fehlerhaften Import unlöschbar zu machen — ein Verwalter muss eine falsch
-- hochgeladene Messdienst-Datei ersetzen können (neuer Import derselben
-- Kostenart/Jahr scheitert sonst an der Unique-Constraint aus M1). Zusätzlich
-- braucht die API-Route einen Weg, einen verwaisten Import-Kopf zu entfernen,
-- falls das Einfügen der Einheiten-Zeilen fehlschlägt (kein DB-Transaktions-
-- RPC verfügbar, s. hausgeldabrechnung-plan.md Q6).
--
-- Ausführung: Im Supabase-SQL-Editor manuell ausführen.
-- ============================================================

create policy "heating_imports_delete_tenant" on heating_imports
  for delete using (tenant_id = current_tenant_id() and is_tenant_admin());

create policy "heating_import_units_delete_tenant" on heating_import_units
  for delete using (tenant_id = current_tenant_id() and is_tenant_admin());
