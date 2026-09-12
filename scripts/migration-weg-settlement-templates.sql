-- ============================================================
-- MIGRATION: Modul „WEG-Jahresabrechnung" — Kapitel 8.3 Erweiterung B
-- (pflegbare Vorlagen für Anschreiben und Beschlussvorlage)
-- ============================================================
-- Spec 8.3: "Anschreiben und Beschlussvorlage stammen aus pflegbaren
-- Vorlagen und sind nicht hart codiert." Eine Zeile je Vorlagenart und
-- Mandant (nicht je Objekt — die Vorlage ist ein wiederverwendbarer
-- Textbaustein, kein Abrechnungsdatum; objektspezifische Werte kommen über
-- Platzhalter aus dem jeweiligen `SettlementResult` zur Erzeugungszeit,
-- s. src/lib/weg-settlement/template.ts).
--
-- `subject` ist nur bei kind = 'anschreiben' sinnvoll befüllt (Titelzeile
-- des Anschreiben-PDFs); bei 'beschlussvorlage' bleibt es leer.
--
-- Ausführung: Im Supabase-SQL-Editor manuell ausführen.
-- ============================================================

create table weg_settlement_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  kind text not null check (kind in ('anschreiben', 'beschlussvorlage')),
  subject text,
  body text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  unique (tenant_id, kind)
);

alter table weg_settlement_templates enable row level security;

-- Lesen: eigener Mandant (jedes eingeloggte Mitglied darf die Vorlage sehen,
-- z. B. um eine Vorschau der Dokumente nachzuvollziehen).
create policy weg_settlement_templates_select on weg_settlement_templates
  for select to authenticated
  using (tenant_id = current_tenant_id());

-- Schreiben (insert/update/delete): eigener Mandant + Verwalterrolle, gleiches
-- Muster wie scripts/migration-dokumente.sql (folders_write/files_write).
create policy weg_settlement_templates_write on weg_settlement_templates
  for all to authenticated
  using (tenant_id = current_tenant_id() and is_tenant_admin())
  with check (tenant_id = current_tenant_id() and is_tenant_admin());

create trigger trg_weg_settlement_templates_updated_at
  before update on weg_settlement_templates
  for each row execute function set_updated_at();

-- Neue Dokumentkategorien, analog zu
-- scripts/migration-weg-settlement-document-categories.sql /
-- scripts/migration-weg-settlement-renter-export-category.sql.
insert into document_categories (id, parent_id, code, group_code, name_de, name_en, name_ru, level, allowed_roles, supports_fiscal_year, search_synonyms, sort_order) values
  ('dc000000-0000-0000-0014-000000000005', 'dc000000-0000-0000-0014-000000000000',
   'WEG_ABRECHNUNG.ANSCHREIBEN', 'WEG_ABRECHNUNG',
   'Anschreiben', 'Cover Letter', 'Сопроводительное письмо',
   'unit', '{beirat,owner,proxy}', true,
   '{Anschreiben,Begleitschreiben}', 5),
  ('dc000000-0000-0000-0014-000000000006', 'dc000000-0000-0000-0014-000000000000',
   'WEG_ABRECHNUNG.BESCHLUSSVORLAGE', 'WEG_ABRECHNUNG',
   'Beschlussvorlage', 'Resolution Draft', 'Проект решения',
   'property', '{beirat,owner,proxy}', true,
   '{Beschlussvorlage,Beschlusstext,Beschlussantrag}', 6)
on conflict (code) do nothing;
