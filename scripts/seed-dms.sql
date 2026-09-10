-- ============================================================
-- DMS Seed-Daten
-- Vollständige document_categories System-Taxonomie
-- Beispiel-Marker + 5 Test-Dokumente
-- ============================================================
-- Voraussetzung: Tenant + Property aus seed-crm.sql bereits vorhanden

-- ============================================================
-- GRUPPEN (parent_id = null)
-- ============================================================

insert into document_categories (id, parent_id, code, group_code, name_de, name_en, name_ru, level, allowed_roles, supports_fiscal_year, search_synonyms, sort_order) values
-- Gruppe 1: EIGENTÜMERGEMEINSCHAFT
('dc000000-0000-0000-0001-000000000000', null,
 'EIGENTUEMERGEMEINSCHAFT', 'EIGENTUEMERGEMEINSCHAFT',
 'Eigentümergemeinschaft', 'Owners Association', 'Объединение собственников',
 'property', '{beirat,owner,proxy}', false, '{}', 10),

-- Gruppe 2: OBJEKTBETREUUNG
('dc000000-0000-0000-0002-000000000000', null,
 'OBJEKTBETREUUNG', 'OBJEKTBETREUUNG',
 'Objektbetreuung', 'Property Management', 'Обслуживание объекта',
 'property', '{beirat,owner,tenant,proxy,service_provider}', false, '{}', 20),

-- Gruppe 3: OBJEKTTECHNIK
('dc000000-0000-0000-0003-000000000000', null,
 'OBJEKTTECHNIK', 'OBJEKTTECHNIK',
 'Objekttechnik', 'Building Technology', 'Техника здания',
 'property', '{beirat,owner,proxy,service_provider}', false, '{}', 30),

-- Gruppe 4: OBJEKTVERWALTUNG
('dc000000-0000-0000-0004-000000000000', null,
 'OBJEKTVERWALTUNG', 'OBJEKTVERWALTUNG',
 'Objektverwaltung', 'Property Administration', 'Управление объектом',
 'property', '{beirat,owner,proxy}', false, '{}', 40),

-- Gruppe 5: RICHTLINIEN
('dc000000-0000-0000-0005-000000000000', null,
 'RICHTLINIEN', 'RICHTLINIEN',
 'Richtlinien', 'Guidelines', 'Руководства',
 'property', '{beirat,owner,proxy,service_provider}', false, '{}', 50),

-- Gruppe 6: VERWALTUNGSBEIRAT
('dc000000-0000-0000-0006-000000000000', null,
 'VERWALTUNGSBEIRAT', 'VERWALTUNGSBEIRAT',
 'Verwaltungsbeirat', 'Advisory Board', 'Консультативный совет',
 'property', '{beirat}', true, '{}', 60),

-- Gruppe 7: EINHEIT_TECHNIK
('dc000000-0000-0000-0007-000000000000', null,
 'EINHEIT_TECHNIK', 'EINHEIT_TECHNIK',
 'Einheit – Technik', 'Unit – Technology', 'Единица – Техника',
 'unit', '{beirat,owner,tenant,proxy}', false, '{}', 70),

-- Gruppe 8: EINHEIT_DOKUMENTE
('dc000000-0000-0000-0008-000000000000', null,
 'EINHEIT_DOKUMENTE', 'EINHEIT_DOKUMENTE',
 'Einheit – Dokumente', 'Unit – Documents', 'Единица – Документы',
 'unit', '{beirat,owner,tenant,proxy}', false, '{}', 80),

-- Gruppe 9: VERTRAG_ABRECHNUNGEN
('dc000000-0000-0000-0009-000000000000', null,
 'VERTRAG_ABRECHNUNGEN', 'VERTRAG_ABRECHNUNGEN',
 'Vertrag – Abrechnungen', 'Contract – Statements', 'Договор – Расчёты',
 'contract', '{owner,tenant,proxy}', true, '{}', 90),

-- Gruppe 10: VERTRAG_KORRESPONDENZ
('dc000000-0000-0000-000a-000000000000', null,
 'VERTRAG_KORRESPONDENZ', 'VERTRAG_KORRESPONDENZ',
 'Vertrag – Korrespondenz', 'Contract – Correspondence', 'Договор – Переписка',
 'contract', '{owner,tenant,proxy}', false, '{}', 100);


-- ============================================================
-- UNTERKATEGORIEN: EIGENTÜMERGEMEINSCHAFT
-- ============================================================

insert into document_categories (id, parent_id, code, group_code, name_de, name_en, name_ru, level, allowed_roles, supports_fiscal_year, search_synonyms, sort_order) values
('dc000000-0000-0000-0001-000000000001', 'dc000000-0000-0000-0001-000000000000',
 'EIGENTUEMERGEMEINSCHAFT.AUFTEILUNGSPLAENE', 'EIGENTUEMERGEMEINSCHAFT',
 'Aufteilungspläne', 'Division Plans', 'Планы раздела',
 'property', '{beirat,owner,proxy}', false,
 '{Aufteilungsplan,Grundriss,Raumaufteilung,floor plan}', 1),

('dc000000-0000-0000-0001-000000000002', 'dc000000-0000-0000-0001-000000000000',
 'EIGENTUEMERGEMEINSCHAFT.BAUHANDWERKERLISTEN', 'EIGENTUEMERGEMEINSCHAFT',
 'Bauhandwerkerlisten', 'Construction Workers Lists', 'Списки строителей',
 'property', '{beirat,owner,proxy}', false,
 '{Handwerker,Baufirma,Gewährleistung,Handwerkerliste}', 2),

('dc000000-0000-0000-0001-000000000003', 'dc000000-0000-0000-0001-000000000000',
 'EIGENTUEMERGEMEINSCHAFT.BESCHLUSS_SAMMLUNGEN', 'EIGENTUEMERGEMEINSCHAFT',
 'Beschluss-Sammlungen', 'Resolution Collections', 'Сборники решений',
 'property', '{beirat,owner,proxy}', true,
 '{Beschluss,Eigentümerversammlung,ETV,Abstimmung,resolution}', 3),

('dc000000-0000-0000-0001-000000000004', 'dc000000-0000-0000-0001-000000000000',
 'EIGENTUEMERGEMEINSCHAFT.PROTOKOLLE', 'EIGENTUEMERGEMEINSCHAFT',
 'Protokolle', 'Minutes', 'Протоколы',
 'property', '{beirat,owner,proxy}', true,
 '{Protokoll,Versammlungsprotokoll,Niederschrift,minutes,ETV-Protokoll}', 4),

('dc000000-0000-0000-0001-000000000005', 'dc000000-0000-0000-0001-000000000000',
 'EIGENTUEMERGEMEINSCHAFT.TEILUNGSERKLAERUNGEN', 'EIGENTUEMERGEMEINSCHAFT',
 'Teilungserklärungen', 'Declaration of Division', 'Декларация о разделе',
 'property', '{beirat,owner,proxy}', false,
 '{Teilungserklärung,TE,Gemeinschaftsordnung,declaration}', 5),

('dc000000-0000-0000-0001-000000000006', 'dc000000-0000-0000-0001-000000000000',
 'EIGENTUEMERGEMEINSCHAFT.VERKAUFSPROSPEKTE', 'EIGENTUEMERGEMEINSCHAFT',
 'Verkaufsprospekte', 'Sales Brochures', 'Продажные буклеты',
 'property', '{beirat,owner,proxy}', false,
 '{Exposé,Prospekt,Verkaufsunterlage,brochure}', 6),

('dc000000-0000-0000-0001-000000000007', 'dc000000-0000-0000-0001-000000000000',
 'EIGENTUEMERGEMEINSCHAFT.WOHNFLAECHENBERECHNUNGEN', 'EIGENTUEMERGEMEINSCHAFT',
 'Wohnflächenberechnungen', 'Living Area Calculations', 'Расчёты жилой площади',
 'property', '{beirat,owner,proxy}', false,
 '{Wohnfläche,Flächenberechnung,qm,Quadratmeter,area calculation}', 7);


-- ============================================================
-- UNTERKATEGORIEN: OBJEKTBETREUUNG
-- ============================================================

insert into document_categories (id, parent_id, code, group_code, name_de, name_en, name_ru, level, allowed_roles, supports_fiscal_year, search_synonyms, sort_order) values
('dc000000-0000-0000-0002-000000000001', 'dc000000-0000-0000-0002-000000000000',
 'OBJEKTBETREUUNG.ENERGIEAUSWEIS', 'OBJEKTBETREUUNG',
 'Energieausweis', 'Energy Certificate', 'Энергетический паспорт',
 'property', '{beirat,owner,tenant,proxy,service_provider}', false,
 '{Energieausweis,EnEV,GEG,Energieeffizienz,energy certificate}', 1),

('dc000000-0000-0000-0002-000000000002', 'dc000000-0000-0000-0002-000000000000',
 'OBJEKTBETREUUNG.GEBRAUCHSANWEISUNGEN', 'OBJEKTBETREUUNG',
 'Gebrauchsanweisungen', 'User Manuals', 'Инструкции по эксплуатации',
 'property', '{beirat,owner,tenant,proxy,service_provider}', false,
 '{Bedienungsanleitung,Gebrauchsanweisung,Handbuch,manual}', 2),

('dc000000-0000-0000-0002-000000000003', 'dc000000-0000-0000-0002-000000000000',
 'OBJEKTBETREUUNG.HAUSORDNUNG', 'OBJEKTBETREUUNG',
 'Hausordnung', 'House Rules', 'Правила дома',
 'property', '{beirat,owner,tenant,proxy,service_provider}', false,
 '{Hausordnung,Regeln,Ordnung,house rules}', 3),

('dc000000-0000-0000-0002-000000000004', 'dc000000-0000-0000-0002-000000000000',
 'OBJEKTBETREUUNG.LEGIONELLENPRUEFUNG', 'OBJEKTBETREUUNG',
 'Legionellenprüfung', 'Legionella Testing', 'Проверка на легионеллу',
 'property', '{beirat,owner,tenant,proxy,service_provider}', true,
 '{Legionellen,Trinkwasser,Wasserprobe,legionella,Trinkwasserverordnung}', 4),

('dc000000-0000-0000-0002-000000000005', 'dc000000-0000-0000-0002-000000000000',
 'OBJEKTBETREUUNG.TELEKOMMUNIKATION', 'OBJEKTBETREUUNG',
 'Telekommunikation', 'Telecommunications', 'Телекоммуникации',
 'property', '{beirat,owner,tenant,proxy,service_provider}', false,
 '{Telefon,Internet,Kabel,Glasfaser,Telekom,Vodafone}', 5),

('dc000000-0000-0000-0002-000000000006', 'dc000000-0000-0000-0002-000000000000',
 'OBJEKTBETREUUNG.WARTUNGSANLEITUNGEN', 'OBJEKTBETREUUNG',
 'Wartungsanleitungen', 'Maintenance Manuals', 'Инструкции по обслуживанию',
 'property', '{beirat,owner,tenant,proxy,service_provider}', false,
 '{Wartung,Wartungsanleitung,Inspektion,maintenance}', 6);


-- ============================================================
-- UNTERKATEGORIEN: OBJEKTTECHNIK
-- ============================================================

insert into document_categories (id, parent_id, code, group_code, name_de, name_en, name_ru, level, allowed_roles, supports_fiscal_year, search_synonyms, sort_order) values
('dc000000-0000-0000-0003-000000000001', 'dc000000-0000-0000-0003-000000000000',
 'OBJEKTTECHNIK.BESCHEINIGUNGEN', 'OBJEKTTECHNIK',
 'Bescheinigungen', 'Certificates', 'Сертификаты',
 'property', '{beirat,owner,proxy,service_provider}', false,
 '{Bescheinigung,Zertifikat,Nachweis,certificate}', 1),

('dc000000-0000-0000-0003-000000000002', 'dc000000-0000-0000-0003-000000000000',
 'OBJEKTTECHNIK.DOKUMENTATIONEN', 'OBJEKTTECHNIK',
 'Dokumentationen', 'Technical Documentation', 'Техническая документация',
 'property', '{beirat,owner,proxy,service_provider}', false,
 '{Dokumentation,Baubeschreibung,Technische Unterlagen,documentation}', 2),

('dc000000-0000-0000-0003-000000000003', 'dc000000-0000-0000-0003-000000000000',
 'OBJEKTTECHNIK.ENERGIE', 'OBJEKTTECHNIK',
 'Energie', 'Energy', 'Энергетика',
 'property', '{beirat,owner,proxy,service_provider}', true,
 '{Energie,Strom,Gas,Heizung,Verbrauch,energy,Energiebericht}', 3),

('dc000000-0000-0000-0003-000000000004', 'dc000000-0000-0000-0003-000000000000',
 'OBJEKTTECHNIK.GEBAEUDETECHNIK', 'OBJEKTTECHNIK',
 'Gebäudetechnik', 'Building Services', 'Инженерные системы',
 'property', '{beirat,owner,proxy,service_provider}', false,
 '{Heizung,Lüftung,Sanitär,Aufzug,Fahrstuhl,HVAC,Gebäudetechnik}', 4),

('dc000000-0000-0000-0003-000000000005', 'dc000000-0000-0000-0003-000000000000',
 'OBJEKTTECHNIK.LEITUNGSFUEHRUNGSPLAENE', 'OBJEKTTECHNIK',
 'Leitungsführungspläne', 'Pipe Routing Plans', 'Планы трубопроводов',
 'property', '{beirat,owner,proxy,service_provider}', false,
 '{Leitungsplan,Rohrleitungsplan,Installationsplan,Versorgungsleitungen}', 5),

('dc000000-0000-0000-0003-000000000006', 'dc000000-0000-0000-0003-000000000000',
 'OBJEKTTECHNIK.PRUEFBERICHTE', 'OBJEKTTECHNIK',
 'Prüfberichte', 'Inspection Reports', 'Отчёты об инспекции',
 'property', '{beirat,owner,proxy,service_provider}', true,
 '{Prüfbericht,TÜV,Sachverständiger,Gutachten,inspection report}', 6),

('dc000000-0000-0000-0003-000000000007', 'dc000000-0000-0000-0003-000000000000',
 'OBJEKTTECHNIK.SCHLIESSANLAGEN', 'OBJEKTTECHNIK',
 'Schließanlagen', 'Locking Systems', 'Системы запирания',
 'property', '{beirat,owner,proxy,service_provider}', false,
 '{Schließanlage,Schlüssel,Schloss,Schließplan,locking system}', 7);


-- ============================================================
-- UNTERKATEGORIEN: OBJEKTVERWALTUNG
-- ============================================================

insert into document_categories (id, parent_id, code, group_code, name_de, name_en, name_ru, level, allowed_roles, supports_fiscal_year, search_synonyms, sort_order) values
('dc000000-0000-0000-0004-000000000001', 'dc000000-0000-0000-0004-000000000000',
 'OBJEKTVERWALTUNG.ABNAHMEN', 'OBJEKTVERWALTUNG',
 'Abnahmen', 'Acceptances', 'Приёмки',
 'property', '{beirat,owner,proxy}', false,
 '{Abnahme,Übergabe,Bauabnahme,acceptance}', 1),

('dc000000-0000-0000-0004-000000000002', 'dc000000-0000-0000-0004-000000000000',
 'OBJEKTVERWALTUNG.BANK', 'OBJEKTVERWALTUNG',
 'Bank', 'Banking', 'Банковское дело',
 'property', '{beirat,owner,proxy}', true,
 '{Bank,Konto,Kontoauszug,Hausgeldkonto,banking}', 2),

('dc000000-0000-0000-0004-000000000003', 'dc000000-0000-0000-0004-000000000000',
 'OBJEKTVERWALTUNG.DIENSTLEISTUNGSVERTRAEGE', 'OBJEKTVERWALTUNG',
 'Dienstleistungsverträge', 'Service Contracts', 'Договоры на обслуживание',
 'property', '{beirat,owner,proxy}', false,
 '{Dienstleistungsvertrag,Hausmeistervertrag,Reinigungsvertrag,service contract}', 3),

('dc000000-0000-0000-0004-000000000004', 'dc000000-0000-0000-0004-000000000000',
 'OBJEKTVERWALTUNG.GUTACHTEN', 'OBJEKTVERWALTUNG',
 'Gutachten', 'Expert Opinions', 'Экспертные заключения',
 'property', '{beirat,owner,proxy}', false,
 '{Gutachten,Sachverständiger,Bewertung,Schätzung,expert opinion}', 4),

('dc000000-0000-0000-0004-000000000005', 'dc000000-0000-0000-0004-000000000000',
 'OBJEKTVERWALTUNG.MIETVERTRAEGE', 'OBJEKTVERWALTUNG',
 'Mietverträge', 'Rental Agreements', 'Договоры аренды',
 'property', '{beirat,owner,proxy}', false,
 '{Mietvertrag,Miete,Pacht,rental agreement,lease}', 5),

('dc000000-0000-0000-0004-000000000006', 'dc000000-0000-0000-0004-000000000000',
 'OBJEKTVERWALTUNG.VERSICHERUNGSUNTERLAGEN', 'OBJEKTVERWALTUNG',
 'Versicherungsunterlagen', 'Insurance Documents', 'Страховые документы',
 'property', '{beirat,owner,proxy}', true,
 '{Versicherung,Police,Schaden,Haftpflicht,Gebäudeversicherung,insurance}', 6),

('dc000000-0000-0000-0004-000000000007', 'dc000000-0000-0000-0004-000000000000',
 'OBJEKTVERWALTUNG.VERSORGUNGSVERTRAEGE', 'OBJEKTVERWALTUNG',
 'Versorgungsverträge', 'Utility Contracts', 'Договоры поставки',
 'property', '{beirat,owner,proxy}', false,
 '{Versorgungsvertrag,Strom,Gas,Wasser,Fernwärme,utility contract}', 7),

('dc000000-0000-0000-0004-000000000008', 'dc000000-0000-0000-0004-000000000000',
 'OBJEKTVERWALTUNG.WARTUNGSVERTRAEGE', 'OBJEKTVERWALTUNG',
 'Wartungsverträge', 'Maintenance Contracts', 'Договоры обслуживания',
 'property', '{beirat,owner,proxy}', false,
 '{Wartungsvertrag,Wartung,Instandhaltung,maintenance contract}', 8);


-- ============================================================
-- UNTERKATEGORIEN: RICHTLINIEN
-- ============================================================

insert into document_categories (id, parent_id, code, group_code, name_de, name_en, name_ru, level, allowed_roles, supports_fiscal_year, search_synonyms, sort_order) values
('dc000000-0000-0000-0005-000000000001', 'dc000000-0000-0000-0005-000000000000',
 'RICHTLINIEN.ALLGEMEIN', 'RICHTLINIEN',
 'Allgemein', 'General', 'Общие',
 'property', '{beirat,owner,proxy,service_provider}', false,
 '{Richtlinie,Vorgabe,Regel,guideline}', 1),

('dc000000-0000-0000-0005-000000000002', 'dc000000-0000-0000-0005-000000000000',
 'RICHTLINIEN.BEHOERDEN', 'RICHTLINIEN',
 'Behörden', 'Authorities', 'Органы власти',
 'property', '{beirat,owner,proxy,service_provider}', false,
 '{Behörde,Amt,Bauamt,Ordnungsamt,Genehmigung,authority,permit}', 2);


-- ============================================================
-- UNTERKATEGORIEN: VERWALTUNGSBEIRAT
-- ============================================================

insert into document_categories (id, parent_id, code, group_code, name_de, name_en, name_ru, level, allowed_roles, supports_fiscal_year, search_synonyms, sort_order) values
('dc000000-0000-0000-0006-000000000001', 'dc000000-0000-0000-0006-000000000000',
 'VERWALTUNGSBEIRAT.RECHNUNGSPRUEFUNG', 'VERWALTUNGSBEIRAT',
 'Rechnungsprüfung', 'Invoice Audit', 'Проверка счетов',
 'property', '{beirat}', true,
 '{Rechnungsprüfung,Belegprüfung,Prüfungsbericht,invoice audit,Belege}', 1),

('dc000000-0000-0000-0006-000000000002', 'dc000000-0000-0000-0006-000000000000',
 'VERWALTUNGSBEIRAT.SCHRIFTVERKEHR', 'VERWALTUNGSBEIRAT',
 'Schriftverkehr', 'Correspondence', 'Переписка',
 'property', '{beirat}', false,
 '{Schriftverkehr,Brief,Korrespondenz,Schreiben,correspondence}', 2),

('dc000000-0000-0000-0006-000000000003', 'dc000000-0000-0000-0006-000000000000',
 'VERWALTUNGSBEIRAT.VERSAMMLUNGSVORBEREITUNG', 'VERWALTUNGSBEIRAT',
 'Versammlungsvorbereitung', 'Meeting Preparation', 'Подготовка к собранию',
 'property', '{beirat}', true,
 '{Versammlung,ETV,Tagesordnung,Einladung,Vorbereitung,meeting preparation}', 3);


-- ============================================================
-- UNTERKATEGORIEN: EINHEIT_TECHNIK
-- ============================================================

insert into document_categories (id, parent_id, code, group_code, name_de, name_en, name_ru, level, allowed_roles, supports_fiscal_year, search_synonyms, sort_order) values
('dc000000-0000-0000-0007-000000000001', 'dc000000-0000-0000-0007-000000000000',
 'EINHEIT_TECHNIK.GRUNDRISSE', 'EINHEIT_TECHNIK',
 'Grundrisse', 'Floor Plans', 'Планы этажей',
 'unit', '{beirat,owner,tenant,proxy}', false,
 '{Grundriss,Raumplan,Wohnungsplan,floor plan}', 1),

('dc000000-0000-0000-0007-000000000002', 'dc000000-0000-0000-0007-000000000000',
 'EINHEIT_TECHNIK.ZAEHLERSTAENDE', 'EINHEIT_TECHNIK',
 'Zählerstände', 'Meter Readings', 'Показания счётчиков',
 'unit', '{beirat,owner,tenant,proxy}', true,
 '{Zählerstand,Zähler,Ablesung,Strom,Wasser,Gas,meter reading}', 2),

('dc000000-0000-0000-0007-000000000003', 'dc000000-0000-0000-0007-000000000000',
 'EINHEIT_TECHNIK.RENOVIERUNGEN', 'EINHEIT_TECHNIK',
 'Renovierungen', 'Renovations', 'Ремонтные работы',
 'unit', '{beirat,owner,tenant,proxy}', false,
 '{Renovierung,Umbau,Sanierung,Modernisierung,renovation}', 3);


-- ============================================================
-- UNTERKATEGORIEN: EINHEIT_DOKUMENTE
-- ============================================================

insert into document_categories (id, parent_id, code, group_code, name_de, name_en, name_ru, level, allowed_roles, supports_fiscal_year, search_synonyms, sort_order) values
('dc000000-0000-0000-0008-000000000001', 'dc000000-0000-0000-0008-000000000000',
 'EINHEIT_DOKUMENTE.UEBERGABEPROTOKOLLE', 'EINHEIT_DOKUMENTE',
 'Übergabeprotokolle', 'Handover Protocols', 'Протоколы передачи',
 'unit', '{beirat,owner,tenant,proxy}', false,
 '{Übergabeprotokoll,Wohnungsübergabe,Einzug,Auszug,handover protocol}', 1),

('dc000000-0000-0000-0008-000000000002', 'dc000000-0000-0000-0008-000000000000',
 'EINHEIT_DOKUMENTE.FOTOS', 'EINHEIT_DOKUMENTE',
 'Fotos', 'Photos', 'Фотографии',
 'unit', '{beirat,owner,tenant,proxy}', false,
 '{Foto,Bild,Zustandsdokumentation,photo}', 2),

('dc000000-0000-0000-0008-000000000003', 'dc000000-0000-0000-0008-000000000000',
 'EINHEIT_DOKUMENTE.SONSTIGES', 'EINHEIT_DOKUMENTE',
 'Sonstiges', 'Other', 'Прочее',
 'unit', '{beirat,owner,tenant,proxy}', false,
 '{Sonstiges,Diverses,miscellaneous}', 3);


-- ============================================================
-- UNTERKATEGORIEN: VERTRAG_ABRECHNUNGEN
-- ============================================================

insert into document_categories (id, parent_id, code, group_code, name_de, name_en, name_ru, level, allowed_roles, supports_fiscal_year, search_synonyms, sort_order) values
('dc000000-0000-0000-0009-000000000001', 'dc000000-0000-0000-0009-000000000000',
 'VERTRAG_ABRECHNUNGEN.HAUSGELDABRECHNUNG', 'VERTRAG_ABRECHNUNGEN',
 'Hausgeldabrechnung', 'Service Charge Statement', 'Расчёт платы за обслуживание',
 'contract', '{owner,proxy}', true,
 '{Hausgeldabrechnung,Jahresabrechnung,Einzelabrechnung,Wohngeldabrechnung,service charge}', 1),

('dc000000-0000-0000-0009-000000000002', 'dc000000-0000-0000-0009-000000000000',
 'VERTRAG_ABRECHNUNGEN.BETRIEBSKOSTENABRECHNUNG', 'VERTRAG_ABRECHNUNGEN',
 'Betriebskostenabrechnung', 'Operating Cost Statement', 'Расчёт эксплуатационных расходов',
 'contract', '{tenant,proxy}', true,
 '{Betriebskostenabrechnung,Nebenkostenabrechnung,BKA,NK-Abrechnung,operating costs}', 2),

('dc000000-0000-0000-0009-000000000003', 'dc000000-0000-0000-0009-000000000000',
 'VERTRAG_ABRECHNUNGEN.WIRTSCHAFTSPLAN', 'VERTRAG_ABRECHNUNGEN',
 'Wirtschaftsplan', 'Budget Plan', 'Хозяйственный план',
 'contract', '{owner,proxy}', true,
 '{Wirtschaftsplan,Budget,Haushaltsplan,Einzelwirtschaftsplan,budget plan}', 3),

('dc000000-0000-0000-0009-000000000004', 'dc000000-0000-0000-0009-000000000000',
 'VERTRAG_ABRECHNUNGEN.MAHNUNGEN', 'VERTRAG_ABRECHNUNGEN',
 'Mahnungen', 'Payment Reminders', 'Напоминания об оплате',
 'contract', '{owner,tenant,proxy}', false,
 '{Mahnung,Zahlungserinnerung,Verzug,Rückstand,payment reminder,dunning}', 4);


-- ============================================================
-- UNTERKATEGORIEN: VERTRAG_KORRESPONDENZ
-- ============================================================

insert into document_categories (id, parent_id, code, group_code, name_de, name_en, name_ru, level, allowed_roles, supports_fiscal_year, search_synonyms, sort_order) values
('dc000000-0000-0000-000a-000000000001', 'dc000000-0000-0000-000a-000000000000',
 'VERTRAG_KORRESPONDENZ.MIETVERTRAG', 'VERTRAG_KORRESPONDENZ',
 'Mietvertrag', 'Lease Agreement', 'Договор аренды',
 'contract', '{owner,tenant,proxy}', false,
 '{Mietvertrag,Vertrag,Nachtrag,Zusatzvereinbarung,lease agreement}', 1),

('dc000000-0000-0000-000a-000000000002', 'dc000000-0000-0000-000a-000000000000',
 'VERTRAG_KORRESPONDENZ.KUENDIGUNG', 'VERTRAG_KORRESPONDENZ',
 'Kündigung', 'Termination', 'Расторжение',
 'contract', '{owner,tenant,proxy}', false,
 '{Kündigung,Aufhebung,Vertragsende,termination,notice}', 2),

('dc000000-0000-0000-000a-000000000003', 'dc000000-0000-0000-000a-000000000000',
 'VERTRAG_KORRESPONDENZ.MIETERHOEHUNG', 'VERTRAG_KORRESPONDENZ',
 'Mieterhöhung', 'Rent Increase', 'Повышение арендной платы',
 'contract', '{owner,tenant,proxy}', false,
 '{Mieterhöhung,Mietanpassung,Indexanpassung,Staffelmiete,rent increase}', 3),

('dc000000-0000-0000-000a-000000000004', 'dc000000-0000-0000-000a-000000000000',
 'VERTRAG_KORRESPONDENZ.ALLGEMEIN', 'VERTRAG_KORRESPONDENZ',
 'Allgemeine Korrespondenz', 'General Correspondence', 'Общая переписка',
 'contract', '{owner,tenant,proxy}', false,
 '{Schreiben,Brief,Korrespondenz,Mitteilung,correspondence,letter}', 4);


-- ============================================================
-- BEISPIEL-MARKER für Rechnungsprüfung
-- ============================================================

insert into document_markers (id, tenant_id, category_id, name, color) values
('de000000-0000-0000-0000-000000000001',
 'a0000000-0000-0000-0000-000000000001',
 'dc000000-0000-0000-0006-000000000001',
 'Strom', '#3B82F6'),

('de000000-0000-0000-0000-000000000002',
 'a0000000-0000-0000-0000-000000000001',
 'dc000000-0000-0000-0006-000000000001',
 'Heizung', '#EF4444'),

('de000000-0000-0000-0000-000000000003',
 'a0000000-0000-0000-0000-000000000001',
 'dc000000-0000-0000-0006-000000000001',
 'Versicherung', '#10B981'),

('de000000-0000-0000-0000-000000000004',
 'a0000000-0000-0000-0000-000000000001',
 'dc000000-0000-0000-0006-000000000001',
 'Reinigung', '#F59E0B'),

('de000000-0000-0000-0000-000000000005',
 'a0000000-0000-0000-0000-000000000001',
 'dc000000-0000-0000-0006-000000000001',
 'Aufzug', '#8B5CF6');


-- ============================================================
-- 5 TEST-DOKUMENTE (verteilt über Ebenen)
-- ============================================================

-- Dokument 1: Teilungserklärung (property-Ebene)
insert into documents (id, tenant_id, category_id, level, property_id, title, storage_path, file_name, file_size, mime_type, uploaded_by) values
('dd000000-0000-0000-0000-000000000001',
 'a0000000-0000-0000-0000-000000000001',
 'dc000000-0000-0000-0001-000000000005',
 'property',
 'd0000000-0000-0000-0000-000000000001',
 'Teilungserklärung Kastanienallee 7a',
 'a0000000-0000-0000-0000-000000000001/d0000000-0000-0000-0000-000000000001/property/EIGENTUEMERGEMEINSCHAFT.TEILUNGSERKLAERUNGEN/dd000000-0000-0000-0000-000000000001.pdf',
 'Teilungserklaerung_Kastanienallee7a.pdf',
 2456789, 'application/pdf', null);

-- Dokument 2: Energieausweis (property-Ebene)
insert into documents (id, tenant_id, category_id, level, property_id, title, storage_path, file_name, file_size, mime_type, uploaded_by) values
('dd000000-0000-0000-0000-000000000002',
 'a0000000-0000-0000-0000-000000000001',
 'dc000000-0000-0000-0002-000000000001',
 'property',
 'd0000000-0000-0000-0000-000000000001',
 'Energieausweis 2023',
 'a0000000-0000-0000-0000-000000000001/d0000000-0000-0000-0000-000000000001/property/OBJEKTBETREUUNG.ENERGIEAUSWEIS/dd000000-0000-0000-0000-000000000002.pdf',
 'Energieausweis_2023.pdf',
 845000, 'application/pdf', null);

-- Dokument 3: Grundriss W01 (unit-Ebene)
insert into documents (id, tenant_id, category_id, level, property_id, unit_id, title, storage_path, file_name, file_size, mime_type, uploaded_by) values
('dd000000-0000-0000-0000-000000000003',
 'a0000000-0000-0000-0000-000000000001',
 'dc000000-0000-0000-0007-000000000001',
 'unit',
 'd0000000-0000-0000-0000-000000000001',
 'e0000000-0000-0000-0000-000000000001',
 'Grundriss W01 – 1. OG links',
 'a0000000-0000-0000-0000-000000000001/d0000000-0000-0000-0000-000000000001/unit/EINHEIT_TECHNIK.GRUNDRISSE/dd000000-0000-0000-0000-000000000003.pdf',
 'Grundriss_W01.pdf',
 1234567, 'application/pdf', null);

-- Dokument 4: Hausgeldabrechnung 2024 (contract-Ebene, Bergmann)
insert into documents (id, tenant_id, category_id, level, property_id, contract_id, title, fiscal_year, storage_path, file_name, file_size, mime_type, uploaded_by) values
('dd000000-0000-0000-0000-000000000004',
 'a0000000-0000-0000-0000-000000000001',
 'dc000000-0000-0000-0009-000000000001',
 'contract',
 'd0000000-0000-0000-0000-000000000001',
 'aa000000-0000-0000-0000-000000000001',
 'Hausgeldabrechnung 2024 – Bergmann W01',
 2024,
 'a0000000-0000-0000-0000-000000000001/d0000000-0000-0000-0000-000000000001/contract/VERTRAG_ABRECHNUNGEN.HAUSGELDABRECHNUNG/dd000000-0000-0000-0000-000000000004.pdf',
 'Hausgeldabrechnung_2024_W01_Bergmann.pdf',
 567890, 'application/pdf', null);

-- Dokument 5: Mietvertrag Weber (contract-Ebene, internal_only = false)
insert into documents (id, tenant_id, category_id, level, property_id, contract_id, title, storage_path, file_name, file_size, mime_type, uploaded_by) values
('dd000000-0000-0000-0000-000000000005',
 'a0000000-0000-0000-0000-000000000001',
 'dc000000-0000-0000-000a-000000000001',
 'contract',
 'd0000000-0000-0000-0000-000000000001',
 'aa000000-0000-0000-0000-000000000002',
 'Mietvertrag Weber – W02',
 'a0000000-0000-0000-0000-000000000001/d0000000-0000-0000-0000-000000000001/contract/VERTRAG_KORRESPONDENZ.MIETVERTRAG/dd000000-0000-0000-0000-000000000005.pdf',
 'Mietvertrag_Weber_W02.pdf',
 1890000, 'application/pdf', null);
