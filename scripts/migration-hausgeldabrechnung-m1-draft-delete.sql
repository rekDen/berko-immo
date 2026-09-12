-- ============================================================
-- MIGRATION: Modul „WEG-Jahresabrechnung" — Nachtrag: DRAFT löschbar
-- ============================================================
-- Ergänzt scripts/migration-hausgeldabrechnung-m1.sql (bereits ausgeführt).
--
-- Hintergrund: Spec Kapitel 8.1 nennt DRAFT-Ergebnisse ausdrücklich
-- „flüchtig" ("DRAFT: jederzeit neu berechenbar, Ergebnisse sind flüchtig").
-- Die M1-Migration hatte für `settlements`/`settlement_units` keine
-- DELETE-Policy vorgesehen (analog zum bewussten Append-only-Muster von
-- `journal_entries`) — das widerspricht aber "flüchtig": ein Verwalter muss
-- eine verunglückte Neuberechnung im Entwurf verwerfen können, ohne dass sie
-- als Karteileiche liegen bleibt. Ab `review` bleibt alles unveränderlich
-- (kein DELETE erlaubt) — das ist weiterhin durch das Fehlen einer
-- entsprechenden Policy für andere Status sichergestellt.
--
-- Ausführung: Im Supabase-SQL-Editor manuell ausführen.
-- ============================================================

create policy "settlements_delete_draft" on settlements
  for delete using (tenant_id = current_tenant_id() and is_tenant_admin() and status = 'draft');

create policy "settlement_units_delete_draft" on settlement_units
  for delete using (
    tenant_id = current_tenant_id() and is_tenant_admin()
    and exists (select 1 from settlements s where s.id = settlement_units.settlement_id and s.status = 'draft')
  );
