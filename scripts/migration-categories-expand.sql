-- ============================================================
-- Migration: zusätzliche Dokumentkategorien
-- ============================================================
-- Fügt 9 neue Gruppen mit insgesamt ~40 Unterkategorien hinzu.
-- Idempotent (ON CONFLICT DO NOTHING auf code).
-- ============================================================

-- ---------- Gruppen ----------
insert into document_categories (id, parent_id, code, group_code, name_de, name_en, name_ru, level, allowed_roles, supports_fiscal_year, search_synonyms, sort_order) values
  ('dc000000-0000-0000-000b-000000000000', null, 'FINANZEN', 'FINANZEN',
   'Finanzen', 'Finance', 'Финансы',
   'property', '{beirat,owner,proxy}', true, '{}', 110),
  ('dc000000-0000-0000-000c-000000000000', null, 'IMMOBILIE_DOKUMENTE', 'IMMOBILIE_DOKUMENTE',
   'Immobilie – Dokumente', 'Property Documents', 'Документы недвижимости',
   'property', '{beirat,owner,proxy}', false, '{}', 120),
  ('dc000000-0000-0000-000d-000000000000', null, 'TECHNIK_BERICHTE', 'TECHNIK_BERICHTE',
   'Technik – Berichte', 'Technical Reports', 'Технические отчёты',
   'property', '{beirat,owner,proxy,service_provider}', false, '{}', 130),
  ('dc000000-0000-0000-000e-000000000000', null, 'KOMMUNIKATION', 'KOMMUNIKATION',
   'Kommunikation', 'Communication', 'Коммуникация',
   'property', '{beirat,owner,proxy}', false, '{}', 140),
  ('dc000000-0000-0000-000f-000000000000', null, 'WEG_VERSAMMLUNG', 'WEG_VERSAMMLUNG',
   'WEG – Versammlung', 'WEG Meeting', 'Собрание собственников',
   'property', '{beirat,owner,proxy}', true, '{}', 150),
  ('dc000000-0000-0000-0010-000000000000', null, 'MIETER_DOKUMENTE', 'MIETER_DOKUMENTE',
   'Mieter – Dokumente', 'Tenant Documents', 'Документы арендатора',
   'contract', '{owner,tenant,proxy}', false, '{}', 160),
  ('dc000000-0000-0000-0011-000000000000', null, 'RECHTLICHES', 'RECHTLICHES',
   'Rechtliches', 'Legal', 'Юридические',
   'property', '{beirat,owner,proxy}', false, '{}', 170),
  ('dc000000-0000-0000-0012-000000000000', null, 'BEHOERDEN', 'BEHOERDEN',
   'Behörden', 'Authorities', 'Органы власти',
   'property', '{beirat,owner,proxy}', false, '{}', 180),
  ('dc000000-0000-0000-0013-000000000000', null, 'MANAGEMENT', 'MANAGEMENT',
   'Management', 'Management', 'Менеджмент',
   'property', '{beirat,owner,proxy}', true, '{}', 190)
on conflict (code) do nothing;


-- ---------- FINANZEN ----------
insert into document_categories (id, parent_id, code, group_code, name_de, name_en, name_ru, level, allowed_roles, supports_fiscal_year, search_synonyms, sort_order) values
  ('dc000000-0000-0000-000b-000000000001', 'dc000000-0000-0000-000b-000000000000',
   'FINANZEN.RECHNUNGEN_EINGANG', 'FINANZEN',
   'Rechnungen (Eingang)', 'Incoming Invoices', 'Входящие счета',
   'property', '{beirat,owner,proxy}', true,
   '{Rechnung,Eingangsrechnung,Eingang,Rechnungseingang,invoice}', 1),
  ('dc000000-0000-0000-000b-000000000002', 'dc000000-0000-0000-000b-000000000000',
   'FINANZEN.RECHNUNGEN_AUSGANG', 'FINANZEN',
   'Rechnungen (Ausgang)', 'Outgoing Invoices', 'Исходящие счета',
   'property', '{beirat,owner,proxy}', true,
   '{Ausgangsrechnung,Ausgang,outgoing invoice}', 2),
  ('dc000000-0000-0000-000b-000000000003', 'dc000000-0000-0000-000b-000000000000',
   'FINANZEN.KONTOAUSZUEGE', 'FINANZEN',
   'Kontoauszüge', 'Bank Statements', 'Выписки со счёта',
   'property', '{beirat,owner,proxy}', true,
   '{Kontoauszug,Bankauszug,bank statement}', 3),
  ('dc000000-0000-0000-000b-000000000004', 'dc000000-0000-0000-000b-000000000000',
   'FINANZEN.ZAHLUNGSBELEGE', 'FINANZEN',
   'Zahlungsbelege', 'Payment Receipts', 'Платёжные документы',
   'property', '{beirat,owner,proxy}', true,
   '{Zahlungsbeleg,Quittung,Beleg,receipt}', 4),
  ('dc000000-0000-0000-000b-000000000005', 'dc000000-0000-0000-000b-000000000000',
   'FINANZEN.MAHNUNGEN', 'FINANZEN',
   'Mahnungen', 'Reminders', 'Напоминания об оплате',
   'property', '{beirat,owner,proxy}', false,
   '{Mahnung,Zahlungserinnerung,reminder,dunning}', 5),
  ('dc000000-0000-0000-000b-000000000006', 'dc000000-0000-0000-000b-000000000000',
   'FINANZEN.JAHRESABRECHNUNGEN', 'FINANZEN',
   'Jahresabrechnungen', 'Annual Statements', 'Годовые расчёты',
   'property', '{beirat,owner,proxy}', true,
   '{Jahresabrechnung,annual statement}', 6),
  ('dc000000-0000-0000-000b-000000000007', 'dc000000-0000-0000-000b-000000000000',
   'FINANZEN.WIRTSCHAFTSPLAENE', 'FINANZEN',
   'Wirtschaftspläne', 'Budget Plans', 'Хозяйственные планы',
   'property', '{beirat,owner,proxy}', true,
   '{Wirtschaftsplan,Budget,Haushaltsplan,budget plan}', 7),
  ('dc000000-0000-0000-000b-000000000008', 'dc000000-0000-0000-000b-000000000000',
   'FINANZEN.NEBENKOSTENABRECHNUNGEN', 'FINANZEN',
   'Nebenkostenabrechnungen', 'Operating Cost Statements', 'Расчёты эксплуатационных расходов',
   'property', '{beirat,owner,proxy}', true,
   '{Nebenkostenabrechnung,NK,Betriebskosten,BK}', 8)
on conflict (code) do nothing;


-- ---------- IMMOBILIE_DOKUMENTE ----------
insert into document_categories (id, parent_id, code, group_code, name_de, name_en, name_ru, level, allowed_roles, supports_fiscal_year, search_synonyms, sort_order) values
  ('dc000000-0000-0000-000c-000000000001', 'dc000000-0000-0000-000c-000000000000',
   'IMMOBILIE_DOKUMENTE.GRUNDBUCHAUSZUEGE', 'IMMOBILIE_DOKUMENTE',
   'Grundbuchauszüge', 'Land Register Excerpts', 'Выписки из земельного реестра',
   'property', '{beirat,owner,proxy}', false,
   '{Grundbuchauszug,Grundbuch,land register}', 1),
  ('dc000000-0000-0000-000c-000000000002', 'dc000000-0000-0000-000c-000000000000',
   'IMMOBILIE_DOKUMENTE.BAUPLAENE_GRUNDRISSE', 'IMMOBILIE_DOKUMENTE',
   'Baupläne / Grundrisse', 'Floor Plans / Blueprints', 'Чертежи и планы',
   'property', '{beirat,owner,proxy,service_provider}', false,
   '{Bauplan,Grundriss,Plan,floor plan,blueprint}', 2),
  ('dc000000-0000-0000-000c-000000000003', 'dc000000-0000-0000-000c-000000000000',
   'IMMOBILIE_DOKUMENTE.ABGESCHLOSSENHEITSBESCHEINIGUNG', 'IMMOBILIE_DOKUMENTE',
   'Abgeschlossenheitsbescheinigung', 'Self-Containment Certificate', 'Сертификат изолированности',
   'property', '{beirat,owner,proxy}', false,
   '{Abgeschlossenheit,Abgeschlossenheitsbescheinigung}', 3)
on conflict (code) do nothing;


-- ---------- TECHNIK_BERICHTE ----------
insert into document_categories (id, parent_id, code, group_code, name_de, name_en, name_ru, level, allowed_roles, supports_fiscal_year, search_synonyms, sort_order) values
  ('dc000000-0000-0000-000d-000000000001', 'dc000000-0000-0000-000d-000000000000',
   'TECHNIK_BERICHTE.WARTUNGSPROTOKOLLE', 'TECHNIK_BERICHTE',
   'Wartungsprotokolle', 'Maintenance Logs', 'Протоколы обслуживания',
   'property', '{beirat,owner,proxy,service_provider}', true,
   '{Wartung,Wartungsprotokoll,maintenance log}', 1),
  ('dc000000-0000-0000-000d-000000000002', 'dc000000-0000-0000-000d-000000000000',
   'TECHNIK_BERICHTE.HANDWERKERRECHNUNGEN', 'TECHNIK_BERICHTE',
   'Handwerkerrechnungen', 'Tradesman Invoices', 'Счета мастеров',
   'property', '{beirat,owner,proxy}', true,
   '{Handwerker,Handwerkerrechnung,tradesman invoice}', 2),
  ('dc000000-0000-0000-000d-000000000003', 'dc000000-0000-0000-000d-000000000000',
   'TECHNIK_BERICHTE.MAENGELMELDUNGEN', 'TECHNIK_BERICHTE',
   'Mängelmeldungen', 'Defect Notices', 'Уведомления о дефектах',
   'property', '{beirat,owner,tenant,proxy,service_provider}', false,
   '{Mängel,Mangel,Mängelmeldung,defect notice}', 3),
  ('dc000000-0000-0000-000d-000000000004', 'dc000000-0000-0000-000d-000000000000',
   'TECHNIK_BERICHTE.REPARATURBERICHTE', 'TECHNIK_BERICHTE',
   'Reparaturberichte', 'Repair Reports', 'Отчёты о ремонте',
   'property', '{beirat,owner,proxy,service_provider}', false,
   '{Reparatur,Reparaturbericht,repair report}', 4),
  ('dc000000-0000-0000-000d-000000000005', 'dc000000-0000-0000-000d-000000000000',
   'TECHNIK_BERICHTE.GEWAEHRLEISTUNGSDOKUMENTE', 'TECHNIK_BERICHTE',
   'Gewährleistungsdokumente', 'Warranty Documents', 'Гарантийные документы',
   'property', '{beirat,owner,proxy}', false,
   '{Gewährleistung,Garantie,warranty}', 5)
on conflict (code) do nothing;


-- ---------- KOMMUNIKATION ----------
insert into document_categories (id, parent_id, code, group_code, name_de, name_en, name_ru, level, allowed_roles, supports_fiscal_year, search_synonyms, sort_order) values
  ('dc000000-0000-0000-000e-000000000001', 'dc000000-0000-0000-000e-000000000000',
   'KOMMUNIKATION.EMAILS', 'KOMMUNIKATION',
   'E-Mails mit Mietern / Eigentümern', 'Emails with Tenants / Owners', 'Письма арендаторам/собственникам',
   'property', '{beirat,owner,proxy}', false,
   '{Email,E-Mail,Mail,Korrespondenz}', 1),
  ('dc000000-0000-0000-000e-000000000002', 'dc000000-0000-0000-000e-000000000000',
   'KOMMUNIKATION.BRIEFE', 'KOMMUNIKATION',
   'Briefe', 'Letters', 'Письма',
   'property', '{beirat,owner,proxy}', false,
   '{Brief,Schreiben,letter}', 2),
  ('dc000000-0000-0000-000e-000000000003', 'dc000000-0000-0000-000e-000000000000',
   'KOMMUNIKATION.BESCHWERDEN', 'KOMMUNIKATION',
   'Beschwerden', 'Complaints', 'Жалобы',
   'property', '{beirat,owner,proxy}', false,
   '{Beschwerde,complaint}', 3),
  ('dc000000-0000-0000-000e-000000000004', 'dc000000-0000-0000-000e-000000000000',
   'KOMMUNIKATION.TELEFONNOTIZEN', 'KOMMUNIKATION',
   'Telefonnotizen / Gesprächsprotokolle', 'Phone Notes / Call Logs', 'Записи разговоров',
   'property', '{beirat,owner,proxy}', false,
   '{Telefonnotiz,Gesprächsprotokoll,phone note}', 4),
  ('dc000000-0000-0000-000e-000000000005', 'dc000000-0000-0000-000e-000000000000',
   'KOMMUNIKATION.BEHOERDENKOMMUNIKATION', 'KOMMUNIKATION',
   'Behördenkommunikation', 'Authority Communication', 'Переписка с органами',
   'property', '{beirat,owner,proxy}', false,
   '{Behördenkommunikation,Behörde,Amt,authority}', 5)
on conflict (code) do nothing;


-- ---------- WEG_VERSAMMLUNG ----------
insert into document_categories (id, parent_id, code, group_code, name_de, name_en, name_ru, level, allowed_roles, supports_fiscal_year, search_synonyms, sort_order) values
  ('dc000000-0000-0000-000f-000000000001', 'dc000000-0000-0000-000f-000000000000',
   'WEG_VERSAMMLUNG.PROTOKOLLE', 'WEG_VERSAMMLUNG',
   'Eigentümerversammlungsprotokolle', 'Owners Meeting Minutes', 'Протоколы собраний',
   'property', '{beirat,owner,proxy}', true,
   '{ETV,Versammlungsprotokoll,Eigentümerversammlung,minutes}', 1),
  ('dc000000-0000-0000-000f-000000000002', 'dc000000-0000-0000-000f-000000000000',
   'WEG_VERSAMMLUNG.TEILNEHMERLISTEN', 'WEG_VERSAMMLUNG',
   'Teilnehmerlisten', 'Attendance Lists', 'Списки участников',
   'property', '{beirat,owner,proxy}', true,
   '{Teilnehmerliste,Anwesenheitsliste,attendance}', 2),
  ('dc000000-0000-0000-000f-000000000003', 'dc000000-0000-0000-000f-000000000000',
   'WEG_VERSAMMLUNG.VOLLMACHTEN', 'WEG_VERSAMMLUNG',
   'Vollmachten', 'Powers of Attorney', 'Доверенности',
   'property', '{beirat,owner,proxy}', true,
   '{Vollmacht,Stimmrechtsvollmacht,power of attorney}', 3),
  ('dc000000-0000-0000-000f-000000000004', 'dc000000-0000-0000-000f-000000000000',
   'WEG_VERSAMMLUNG.ABSTIMMUNGSERGEBNISSE', 'WEG_VERSAMMLUNG',
   'Abstimmungsergebnisse', 'Voting Results', 'Результаты голосования',
   'property', '{beirat,owner,proxy}', true,
   '{Abstimmung,Beschluss,Abstimmungsergebnis,voting}', 4)
on conflict (code) do nothing;


-- ---------- MIETER_DOKUMENTE ----------
insert into document_categories (id, parent_id, code, group_code, name_de, name_en, name_ru, level, allowed_roles, supports_fiscal_year, search_synonyms, sort_order) values
  ('dc000000-0000-0000-0010-000000000001', 'dc000000-0000-0000-0010-000000000000',
   'MIETER_DOKUMENTE.SELBSTAUSKUNFT', 'MIETER_DOKUMENTE',
   'Selbstauskunft (Mieter)', 'Tenant Self-Disclosure', 'Самораскрытие арендатора',
   'contract', '{owner,proxy}', false,
   '{Selbstauskunft,Mieterselbstauskunft,self-disclosure}', 1),
  ('dc000000-0000-0000-0010-000000000002', 'dc000000-0000-0000-0010-000000000000',
   'MIETER_DOKUMENTE.SCHUFA_AUSKUNFT', 'MIETER_DOKUMENTE',
   'SCHUFA-Auskunft', 'SCHUFA Credit Report', 'Кредитный отчёт SCHUFA',
   'contract', '{owner,proxy}', false,
   '{SCHUFA,Bonität,credit report}', 2),
  ('dc000000-0000-0000-0010-000000000003', 'dc000000-0000-0000-0010-000000000000',
   'MIETER_DOKUMENTE.KAUTIONSNACHWEISE', 'MIETER_DOKUMENTE',
   'Kautionsnachweise', 'Deposit Receipts', 'Подтверждение депозита',
   'contract', '{owner,tenant,proxy}', false,
   '{Kaution,Kautionsnachweis,Mietkaution,deposit}', 3)
on conflict (code) do nothing;


-- ---------- RECHTLICHES ----------
insert into document_categories (id, parent_id, code, group_code, name_de, name_en, name_ru, level, allowed_roles, supports_fiscal_year, search_synonyms, sort_order) values
  ('dc000000-0000-0000-0011-000000000001', 'dc000000-0000-0000-0011-000000000000',
   'RECHTLICHES.MAHNBESCHEIDE', 'RECHTLICHES',
   'Mahnbescheide', 'Default Notices', 'Судебные приказы',
   'property', '{beirat,owner,proxy}', false,
   '{Mahnbescheid,Vollstreckungsbescheid,default notice}', 1),
  ('dc000000-0000-0000-0011-000000000002', 'dc000000-0000-0000-0011-000000000000',
   'RECHTLICHES.KLAGESCHRIFTEN', 'RECHTLICHES',
   'Klageschriften', 'Statements of Claim', 'Исковые заявления',
   'property', '{beirat,owner,proxy}', false,
   '{Klage,Klageschrift,statement of claim}', 2),
  ('dc000000-0000-0000-0011-000000000003', 'dc000000-0000-0000-0011-000000000000',
   'RECHTLICHES.ANWALTSSCHREIBEN', 'RECHTLICHES',
   'Anwaltsschreiben', 'Attorney Letters', 'Письма адвоката',
   'property', '{beirat,owner,proxy}', false,
   '{Anwaltsschreiben,Anwalt,attorney letter}', 3),
  ('dc000000-0000-0000-0011-000000000004', 'dc000000-0000-0000-0011-000000000000',
   'RECHTLICHES.GERICHTSURTEILE', 'RECHTLICHES',
   'Gerichtsurteile', 'Court Judgments', 'Решения суда',
   'property', '{beirat,owner,proxy}', false,
   '{Urteil,Gerichtsurteil,court judgment}', 4),
  ('dc000000-0000-0000-0011-000000000005', 'dc000000-0000-0000-0011-000000000000',
   'RECHTLICHES.VERGLEICHSVEREINBARUNGEN', 'RECHTLICHES',
   'Vergleichsvereinbarungen', 'Settlement Agreements', 'Мировые соглашения',
   'property', '{beirat,owner,proxy}', false,
   '{Vergleich,Vereinbarung,settlement}', 5)
on conflict (code) do nothing;


-- ---------- BEHOERDEN ----------
insert into document_categories (id, parent_id, code, group_code, name_de, name_en, name_ru, level, allowed_roles, supports_fiscal_year, search_synonyms, sort_order) values
  ('dc000000-0000-0000-0012-000000000001', 'dc000000-0000-0000-0012-000000000000',
   'BEHOERDEN.BAUGENEHMIGUNGEN', 'BEHOERDEN',
   'Baugenehmigungen', 'Building Permits', 'Разрешения на строительство',
   'property', '{beirat,owner,proxy}', false,
   '{Baugenehmigung,building permit}', 1),
  ('dc000000-0000-0000-0012-000000000002', 'dc000000-0000-0000-0012-000000000000',
   'BEHOERDEN.NUTZUNGSAENDERUNGEN', 'BEHOERDEN',
   'Nutzungsänderungen', 'Use Changes', 'Изменения назначения',
   'property', '{beirat,owner,proxy}', false,
   '{Nutzungsänderung,Umnutzung,use change}', 2),
  ('dc000000-0000-0000-0012-000000000003', 'dc000000-0000-0000-0012-000000000000',
   'BEHOERDEN.MELDUNGEN', 'BEHOERDEN',
   'Meldungen an Behörden', 'Authority Reports', 'Уведомления органам',
   'property', '{beirat,owner,proxy}', false,
   '{Meldung,Anzeige,Behördenmeldung,authority report}', 3),
  ('dc000000-0000-0000-0012-000000000004', 'dc000000-0000-0000-0012-000000000000',
   'BEHOERDEN.BRANDSCHUTZAUFLAGEN', 'BEHOERDEN',
   'Brandschutzauflagen', 'Fire Safety Requirements', 'Требования пожарной безопасности',
   'property', '{beirat,owner,proxy,service_provider}', false,
   '{Brandschutz,Brandschutzauflage,fire safety}', 4),
  ('dc000000-0000-0000-0012-000000000005', 'dc000000-0000-0000-0012-000000000000',
   'BEHOERDEN.ZWECKENTFREMDUNGSGENEHMIGUNGEN', 'BEHOERDEN',
   'Zweckentfremdungsgenehmigungen', 'Reallocation Permits', 'Разрешения на перепрофилирование',
   'property', '{beirat,owner,proxy}', false,
   '{Zweckentfremdung,Zweckentfremdungsgenehmigung}', 5)
on conflict (code) do nothing;


-- ---------- MANAGEMENT ----------
insert into document_categories (id, parent_id, code, group_code, name_de, name_en, name_ru, level, allowed_roles, supports_fiscal_year, search_synonyms, sort_order) values
  ('dc000000-0000-0000-0013-000000000001', 'dc000000-0000-0000-0013-000000000000',
   'MANAGEMENT.KPI_REPORTS', 'MANAGEMENT',
   'KPI-Reports', 'KPI Reports', 'Отчёты KPI',
   'property', '{beirat,owner,proxy}', true,
   '{KPI,Kennzahlen,Report}', 1),
  ('dc000000-0000-0000-0013-000000000002', 'dc000000-0000-0000-0013-000000000000',
   'MANAGEMENT.AUSLASTUNGSBERICHTE', 'MANAGEMENT',
   'Auslastungsberichte', 'Occupancy Reports', 'Отчёты о заполняемости',
   'property', '{beirat,owner,proxy}', true,
   '{Auslastung,Belegung,Leerstand,occupancy}', 2),
  ('dc000000-0000-0000-0013-000000000003', 'dc000000-0000-0000-0013-000000000000',
   'MANAGEMENT.CASHFLOW_ANALYSEN', 'MANAGEMENT',
   'Cashflow-Analysen', 'Cashflow Analyses', 'Анализ денежного потока',
   'property', '{beirat,owner,proxy}', true,
   '{Cashflow,Geldfluss,cash flow}', 3),
  ('dc000000-0000-0000-0013-000000000004', 'dc000000-0000-0000-0013-000000000000',
   'MANAGEMENT.OBJEKTBEWERTUNGEN', 'MANAGEMENT',
   'Objektbewertungen', 'Property Valuations', 'Оценки объектов',
   'property', '{beirat,owner,proxy}', false,
   '{Bewertung,Wertgutachten,Verkehrswert,valuation}', 4),
  ('dc000000-0000-0000-0013-000000000005', 'dc000000-0000-0000-0013-000000000000',
   'MANAGEMENT.INTERNE_NOTIZEN', 'MANAGEMENT',
   'Interne Notizen', 'Internal Notes', 'Внутренние заметки',
   'property', '{beirat,proxy}', false,
   '{Interne Notiz,Notiz,internal note}', 5),
  ('dc000000-0000-0000-0013-000000000006', 'dc000000-0000-0000-0013-000000000000',
   'MANAGEMENT.STRATEGIEDOKUMENTE', 'MANAGEMENT',
   'Strategiedokumente', 'Strategy Documents', 'Стратегические документы',
   'property', '{beirat,owner,proxy}', false,
   '{Strategie,Strategiepapier,strategy}', 6)
on conflict (code) do nothing;
