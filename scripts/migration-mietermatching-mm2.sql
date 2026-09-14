-- MM2 (KI-Mietermatching) — Dokument-Upload + KI-Extraktion für Bewerber-
-- unterlagen. Additiv: eine neue Tabelle, vier neue Dokumentkategorien,
-- keine Änderung an Bestandstabellen/-spalten.
-- Doku: docs/specs/Spezifikation_Mietermatching.md §2.3.
-- Im Supabase-SQL-Editor ausführen.

-- 1. Dokumentkategorien für Bewerberunterlagen (Antrags-/Bewerbungsstadium,
--    d. h. VOR einem Mietvertrag — deshalb eigene Gruppe statt der
--    bestehenden MIETER_DOKUMENTE-Gruppe, die level='contract' ist und einen
--    bereits unterschriebenen Vertrag voraussetzt; ein Bewerber hat noch
--    keinen. level='unit' passt, da applicant.unit_id immer gesetzt ist.
--    allowed_roles bewusst leer — Bewerberunterlagen (Einkommen, SCHUFA)
--    sind vor Vertragsabschluss nicht für externe Portal-Rollen sichtbar.
insert into document_categories (id, parent_id, code, group_code, name_de, name_en, name_ru, level, allowed_roles, supports_fiscal_year, search_synonyms, sort_order) values
  ('dc000000-0000-0000-0015-000000000000', null, 'MIETERMATCHING_DOKUMENTE', 'MIETERMATCHING_DOKUMENTE',
   'Mietermatching – Bewerberunterlagen', 'Tenant Matching – Applicant Documents', 'Подбор арендаторов – документы заявителя',
   'unit', '{}', false, '{}', 200)
on conflict (code) do nothing;

insert into document_categories (id, parent_id, code, group_code, name_de, name_en, name_ru, level, allowed_roles, supports_fiscal_year, search_synonyms, sort_order) values
  ('dc000000-0000-0000-0015-000000000001', 'dc000000-0000-0000-0015-000000000000',
   'MIETERMATCHING_DOKUMENTE.EINKOMMENSNACHWEIS', 'MIETERMATCHING_DOKUMENTE',
   'Einkommensnachweis (Bewerber)', 'Income Proof (Applicant)', 'Подтверждение дохода (заявитель)',
   'unit', '{}', false, '{Einkommensnachweis,Gehaltsabrechnung,Verdienstbescheinigung,income proof}', 1),
  ('dc000000-0000-0000-0015-000000000002', 'dc000000-0000-0000-0015-000000000000',
   'MIETERMATCHING_DOKUMENTE.SCHUFA_AUSKUNFT', 'MIETERMATCHING_DOKUMENTE',
   'SCHUFA-Auskunft (Bewerber)', 'SCHUFA Credit Report (Applicant)', 'Кредитный отчёт SCHUFA (заявитель)',
   'unit', '{}', false, '{SCHUFA,Bonität,credit report}', 2),
  ('dc000000-0000-0000-0015-000000000003', 'dc000000-0000-0000-0015-000000000000',
   'MIETERMATCHING_DOKUMENTE.SELBSTAUSKUNFT', 'MIETERMATCHING_DOKUMENTE',
   'Mieterselbstauskunft (Bewerber)', 'Tenant Self-Disclosure (Applicant)', 'Самораскрытие арендатора (заявитель)',
   'unit', '{}', false, '{Selbstauskunft,Mieterselbstauskunft,self-disclosure}', 3),
  ('dc000000-0000-0000-0015-000000000004', 'dc000000-0000-0000-0015-000000000000',
   'MIETERMATCHING_DOKUMENTE.SONSTIGE', 'MIETERMATCHING_DOKUMENTE',
   'Sonstige Bewerberunterlagen', 'Other Applicant Documents', 'Прочие документы заявителя',
   'unit', '{}', false, '{}', 4)
on conflict (code) do nothing;

-- 2. applicant_document: verknüpft eine generische documents-Zeile (die
--    selbst keinen Bewerberbezug kennt) mit einem konkreten Bewerber, plus
--    dem gecachten KI-Extraktionsergebnis (nur Vorschlag, s. extract-Route —
--    wird nie automatisch in applicant übernommen, harte Regel wie bei K1).
create table applicant_document (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  applicant_id uuid not null references applicant(id),
  document_id uuid not null references documents(id),
  doc_type text not null check (doc_type in ('income_proof', 'schufa', 'self_disclosure', 'other')),
  extraction_status text not null default 'pending' check (extraction_status in ('pending', 'extracted', 'failed')),
  extracted_data jsonb,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index idx_applicant_document_applicant on applicant_document(applicant_id);
create index idx_applicant_document_tenant on applicant_document(tenant_id);

alter table applicant_document enable row level security;
create policy "applicant_document_select_tenant" on applicant_document
  for select using (tenant_id = current_tenant_id());
create policy "applicant_document_insert_tenant" on applicant_document
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());
create policy "applicant_document_update_tenant" on applicant_document
  for update using (tenant_id = current_tenant_id() and is_tenant_admin());
create policy "applicant_document_delete_tenant" on applicant_document
  for delete using (tenant_id = current_tenant_id() and is_tenant_admin());
