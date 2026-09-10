-- ============================================================
-- Erweiterte Testdaten: 20 weitere Objekte mit Kontakten,
-- Vorgängen, Verträgen und Terminen
-- Tenant: Michael Müller (a0000000-0000-0000-0000-000000000d01)
-- ============================================================

-- UUID-Schema:
--   Properties  : da000000-0000-0000-0000-0000000000XX  (01-20)
--   Contacts    : ca000000-0000-0000-0000-0000000000XX
--   Roles       : fa000000-0000-0000-0000-0000000000XX
--   Contracts   : ac000000-0000-0000-0000-0000000000XX
--   Tickets     : bd000000-0000-0000-0000-0000000000XX
--   Deadlines   : ed000000-0000-0000-0000-0000000000XX
-- ============================================================


-- ============================================================
-- OBJEKTE (20)
-- ============================================================
insert into properties (id, tenant_id, name, street, house_number, zip_code, city, type,
  year_built, total_area, unit_count, managed_since, notes) values

-- Chemnitz (10)
('da000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000d01',
 'WEG Äußere Dresdner Str. 44', 'Äußere Dresdner Straße', '44', '09114', 'Chemnitz',
 'weg', 1955, 548.00, 7, '2021-01-01', '7 WE, Plattenbau-Sanierung 2002, Fernwärme'),

('da000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000d01',
 'Miethaus Karl-Marx-Str. 112', 'Karl-Marx-Straße', '112', '09111', 'Chemnitz',
 'miethaus', 1908, 420.00, 5, '2019-06-01', 'Altbau Innenstadt, Erdgeschoss gewerblich vermietet'),

('da000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000d01',
 'WEG Fürstenstr. 18', 'Fürstenstraße', '18', '09130', 'Chemnitz',
 'weg', 1927, 612.00, 8, '2020-03-01', 'Sonnenberg, denkmalgeschützt, laufende Sanierungsmaßnahmen'),

('da000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000d01',
 'Geschäftshaus Zwickauer Str. 63', 'Zwickauer Straße', '63', '09113', 'Chemnitz',
 'gewerbe', 1998, 890.00, 4, '2022-01-01', '4 Gewerbeeinheiten, Einzelhandel + Büro'),

('da000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000d01',
 'Miethaus Stollberger Str. 44', 'Stollberger Straße', '44', '09119', 'Chemnitz',
 'miethaus', 1975, 380.00, 6, '2018-09-01', 'Plattenbau-Sanierung 2010, ruhige Lage'),

('da000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000d01',
 'WEG Lutherstr. 27', 'Lutherstraße', '27', '09126', 'Chemnitz',
 'weg', 1935, 490.00, 6, '2023-02-01', 'Gründerzeithaus, vollsaniert 2015'),

('da000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000d01',
 'Sondereigentum Hartmannstr. 12 WE5', 'Hartmannstraße', '12', '09111', 'Chemnitz',
 'sondereigentum', 1912, 78.00, 1, '2024-01-01', '3-Zimmer-Wohnung, Citylage, vermietet'),

('da000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000d01',
 'Miethaus Bernsdorfer Str. 120', 'Bernsdorfer Straße', '120', '09126', 'Chemnitz',
 'miethaus', 1961, 510.00, 8, '2017-04-01', 'Plattenbau, vollvermietet, Hausmeister Schulze'),

('da000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000d01',
 'WEG Zschopauer Str. 78', 'Zschopauer Straße', '78', '09123', 'Chemnitz',
 'weg', 1988, 720.00, 10, '2016-07-01', '10 WE, Neubaugebiet, Aufzug vorhanden'),

('da000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000d01',
 'Mixed Rosa-Luxemburg-Str. 11', 'Rosa-Luxemburg-Straße', '11', '09126', 'Chemnitz',
 'mixed', 1920, 680.00, 9, '2020-11-01', 'EG Gewerbe, OG 8 Wohnungen, Altbau'),

-- Leipzig (10)
('da000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000d01',
 'Miethaus Carolastr. 25', 'Carolastraße', '25', '04105', 'Leipzig',
 'miethaus', 1902, 540.00, 7, '2019-01-01', 'Gründerzeit, Wilhelminisches Viertel, Dachausbau geplant'),

('da000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000d01',
 'WEG Karl-Liebknecht-Str. 102', 'Karl-Liebknecht-Straße', '102', '04275', 'Leipzig',
 'weg', 1930, 780.00, 10, '2021-05-01', 'Connewitz, studentisch geprägt, 10 WE'),

('da000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000d01',
 'Miethaus Lützner Str. 198', 'Lützner Straße', '198', '04179', 'Leipzig',
 'miethaus', 1928, 460.00, 6, '2018-03-01', 'Lindenau, energetische Sanierung 2014'),

('da000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000d01',
 'Geschäftshaus Eisenbahnstr. 47', 'Eisenbahnstraße', '47', '04315', 'Leipzig',
 'gewerbe', 2005, 1200.00, 6, '2022-08-01', 'Reudnitz, 6 Gewerbeeinheiten, Aufzug'),

('da000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000d01',
 'WEG Goethestr. 14', 'Goethestraße', '14', '04109', 'Leipzig',
 'weg', 1895, 860.00, 12, '2020-09-01', 'Zentrum-West, denkmalgeschützt, 12 WE + 2 GE'),

('da000000-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000d01',
 'Miethaus Riemannstr. 8', 'Riemannstraße', '8', '04107', 'Leipzig',
 'miethaus', 1910, 480.00, 6, '2017-12-01', 'Südvorstadt, Altbau vollsaniert 2012'),

('da000000-0000-0000-0000-000000000017', 'a0000000-0000-0000-0000-000000000d01',
 'WEG Hofer Str. 23', 'Hofer Straße', '23', '04299', 'Leipzig',
 'weg', 1978, 560.00, 8, '2023-06-01', 'Anger-Crottendorf, 8 WE, Tiefgarage'),

('da000000-0000-0000-0000-000000000018', 'a0000000-0000-0000-0000-000000000d01',
 'Miethaus Plagwitzer Str. 67', 'Plagwitzer Straße', '67', '04229', 'Leipzig',
 'miethaus', 1920, 620.00, 9, '2016-02-01', 'Plagwitz, Hochwassergebiet, Versicherung anpassen'),

('da000000-0000-0000-0000-000000000019', 'a0000000-0000-0000-0000-000000000d01',
 'Geschäftshaus Mockauer Str. 22', 'Mockauer Straße', '22', '04357', 'Leipzig',
 'gewerbe', 1994, 750.00, 5, '2024-03-01', 'Mockau, Logistik/Büro, neue Verwaltungsübernahme'),

('da000000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0000-000000000d01',
 'WEG Bornaische Str. 54', 'Bornaische Straße', '54', '04277', 'Leipzig',
 'weg', 1956, 660.00, 9, '2019-08-01', 'Südvorstadt, Plattenbau-Sanierung 2008, Aufzug');


-- ============================================================
-- KONTAKTE (15 neue)
-- ============================================================
insert into contacts (id, tenant_id, type, salutation, first_name, last_name,
  language, emails, phones, date_of_birth) values

('ca000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000d01',
 'natural_person', 'herr', 'Ralf', 'Zimmermann', 'de',
 '[{"type":"private","value":"r.zimmermann@gmx.de"}]',
 '[{"type":"mobile","value":"+4917611111001"}]', '1968-04-12'),

('ca000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000d01',
 'natural_person', 'frau', 'Karin', 'Neumann', 'de',
 '[{"type":"private","value":"karin.neumann@web.de"}]',
 '[{"type":"mobile","value":"+4917611111002"}]', '1975-09-03'),

('ca000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000d01',
 'natural_person', 'herr', 'Stefan', 'Braun', 'de',
 '[{"type":"private","value":"s.braun@outlook.de"}]',
 '[{"type":"landline","value":"+4934112345001"}]', '1959-02-28'),

('ca000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000d01',
 'natural_person', 'frau', 'Petra', 'Schulz', 'de',
 '[{"type":"private","value":"petra.schulz@t-online.de"}]',
 '[{"type":"mobile","value":"+4917611111004"}]', '1982-07-15'),

('ca000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000d01',
 'natural_person', 'herr', 'Klaus', 'Hoffmann', 'de',
 '[{"type":"private","value":"k.hoffmann@gmx.net"}]',
 '[{"type":"mobile","value":"+4917611111005"}]', '1951-11-20'),

('ca000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000d01',
 'natural_person', 'frau', 'Monika', 'Fischer', 'de',
 '[{"type":"private","value":"monika.fischer@web.de"}]',
 '[{"type":"mobile","value":"+4917611111006"}]', '1970-06-08'),

('ca000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000d01',
 'natural_person', 'herr', 'Jürgen', 'Meyer', 'de',
 '[{"type":"private","value":"j.meyer@gmx.de"}]',
 '[{"type":"landline","value":"+4934112345007"}]', '1963-03-17'),

('ca000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000d01',
 'natural_person', 'frau', 'Sandra', 'Krause', 'de',
 '[{"type":"private","value":"sandra.krause@yahoo.de"}]',
 '[{"type":"mobile","value":"+4917611111008"}]', '1988-12-01'),

('ca000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000d01',
 'natural_person', 'herr', 'Tobias', 'Richter', 'de',
 '[{"type":"private","value":"t.richter@gmail.com"}]',
 '[{"type":"mobile","value":"+4917611111009"}]', '1992-05-22'),

('ca000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000d01',
 'natural_person', 'frau', 'Anja', 'Becker', 'de',
 '[{"type":"private","value":"anja.becker@web.de"}]',
 '[{"type":"mobile","value":"+4917611111010"}]', '1985-08-30'),

('ca000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000d01',
 'natural_person', 'herr', 'Markus', 'Wolf', 'de',
 '[{"type":"private","value":"m.wolf@gmx.de"}]',
 '[{"type":"mobile","value":"+4917611111011"}]', '1977-01-14'),

('ca000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000d01',
 'natural_person', 'frau', 'Heike', 'Schäfer', 'de',
 '[{"type":"private","value":"heike.schaefer@t-online.de"}]',
 '[{"type":"landline","value":"+4934112345012"}]', '1955-10-06'),

('ca000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000d01',
 'natural_person', 'herr', 'Frank', 'Schneider', 'de',
 '[{"type":"private","value":"frank.schneider@gmx.de"}]',
 '[{"type":"mobile","value":"+4917611111013"}]', '1980-03-25'),

('ca000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000d01',
 'natural_person', 'frau', 'Nicole', 'Vogel', 'de',
 '[{"type":"private","value":"n.vogel@outlook.de"}]',
 '[{"type":"mobile","value":"+4917611111014"}]', '1990-07-19');

insert into contacts (id, tenant_id, type, salutation, company_name, language, emails, phones) values
('ca000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000d01',
 'legal_entity', 'firma', 'Müller Immobilien GbR', 'de',
 '[{"type":"business","value":"info@mueller-immobilien.de"}]',
 '[{"type":"landline","value":"+4934122334455"}]');


-- ============================================================
-- ROLLEN (je Objekt 1 Eigentümer, einige auch mit Mieter)
-- ============================================================
insert into contact_roles (id, tenant_id, contact_id, property_id, role, valid_from, is_primary) values
('fa000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000001', 'owner', '2021-01-01', true),
('fa000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000002', 'da000000-0000-0000-0000-000000000002', 'owner', '2019-06-01', true),
('fa000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000003', 'da000000-0000-0000-0000-000000000003', 'owner', '2020-03-01', true),
('fa000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000015', 'da000000-0000-0000-0000-000000000004', 'owner', '2022-01-01', true),
('fa000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000004', 'da000000-0000-0000-0000-000000000005', 'owner', '2018-09-01', true),
('fa000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000005', 'da000000-0000-0000-0000-000000000006', 'owner', '2023-02-01', true),
('fa000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000006', 'da000000-0000-0000-0000-000000000007', 'owner', '2024-01-01', true),
('fa000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000007', 'da000000-0000-0000-0000-000000000008', 'owner', '2017-04-01', true),
('fa000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000008', 'da000000-0000-0000-0000-000000000009', 'owner', '2016-07-01', true),
('fa000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000015', 'da000000-0000-0000-0000-000000000010', 'owner', '2020-11-01', true),
('fa000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000009', 'da000000-0000-0000-0000-000000000011', 'owner', '2019-01-01', true),
('fa000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000010', 'da000000-0000-0000-0000-000000000012', 'owner', '2021-05-01', true),
('fa000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000011', 'da000000-0000-0000-0000-000000000013', 'owner', '2018-03-01', true),
('fa000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000015', 'da000000-0000-0000-0000-000000000014', 'owner', '2022-08-01', true),
('fa000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000012', 'da000000-0000-0000-0000-000000000015', 'owner', '2020-09-01', true),
('fa000000-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000013', 'da000000-0000-0000-0000-000000000016', 'owner', '2017-12-01', true),
('fa000000-0000-0000-0000-000000000017', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000017', 'owner', '2023-06-01', true),
('fa000000-0000-0000-0000-000000000018', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000014', 'da000000-0000-0000-0000-000000000018', 'owner', '2016-02-01', true),
('fa000000-0000-0000-0000-000000000019', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000015', 'da000000-0000-0000-0000-000000000019', 'owner', '2024-03-01', true),
('fa000000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000003', 'da000000-0000-0000-0000-000000000020', 'owner', '2019-08-01', true);

-- Mieter für Sondereigentum + einige Mietwohnungen
insert into contact_roles (id, tenant_id, contact_id, property_id, role, valid_from, is_primary) values
('fa000000-0000-0000-0000-000000000021', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000008', 'da000000-0000-0000-0000-000000000007', 'tenant', '2024-02-01', true),
('fa000000-0000-0000-0000-000000000022', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000009', 'da000000-0000-0000-0000-000000000002', 'tenant', '2022-03-01', true),
('fa000000-0000-0000-0000-000000000023', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000010', 'da000000-0000-0000-0000-000000000011', 'tenant', '2020-04-01', true),
('fa000000-0000-0000-0000-000000000024', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000013', 'da000000-0000-0000-0000-000000000016', 'tenant', '2021-07-01', true);

-- Beiräte für WEGs
insert into contact_roles (id, tenant_id, contact_id, property_id, role, valid_from, is_primary, metadata) values
('fa000000-0000-0000-0000-000000000025', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000002', 'da000000-0000-0000-0000-000000000003', 'beirat', '2023-04-01', true, '{"position":"Vorsitzende"}'),
('fa000000-0000-0000-0000-000000000026', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000004', 'da000000-0000-0000-0000-000000000012', 'beirat', '2022-06-01', true, '{"position":"Vorsitzende"}'),
('fa000000-0000-0000-0000-000000000027', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000011', 'da000000-0000-0000-0000-000000000015', 'beirat', '2021-04-01', true, '{"position":"Vorsitzender"}');


-- ============================================================
-- VERTRÄGE (20 — je 1 pro Objekt)
-- ============================================================
insert into contracts (id, tenant_id, contact_role_id, type, start_date,
  cold_rent, operating_costs_prepayment, heating_costs_prepayment,
  hausgeld, deposit_amount, deposit_type, notice_period_months) values

('ac000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000d01', 'fa000000-0000-0000-0000-000000000001', 'management_weg', '2021-01-01', null, null, null, 240.00, null, null, 6),
('ac000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000d01', 'fa000000-0000-0000-0000-000000000002', 'management_mv', '2019-06-01', null, null, null, null, null, null, 12),
('ac000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000d01', 'fa000000-0000-0000-0000-000000000003', 'management_weg', '2020-03-01', null, null, null, 295.00, null, null, 6),
('ac000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000d01', 'fa000000-0000-0000-0000-000000000004', 'rental_commercial', '2022-01-01', 2400.00, 380.00, 220.00, null, 7200.00, 'Bürgschaft', 3),
('ac000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000d01', 'fa000000-0000-0000-0000-000000000005', 'management_mv', '2018-09-01', null, null, null, null, null, null, 12),
('ac000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000d01', 'fa000000-0000-0000-0000-000000000006', 'management_weg', '2023-02-01', null, null, null, 312.00, null, null, 6),
('ac000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000d01', 'fa000000-0000-0000-0000-000000000021', 'rental_residential', '2024-02-01', 720.00, 110.00, 90.00, null, 2160.00, 'Barkaution', 3),
('ac000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000d01', 'fa000000-0000-0000-0000-000000000008', 'management_mv', '2017-04-01', null, null, null, null, null, null, 12),
('ac000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000d01', 'fa000000-0000-0000-0000-000000000009', 'management_weg', '2016-07-01', null, null, null, 198.00, null, null, 6),
('ac000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000d01', 'fa000000-0000-0000-0000-000000000010', 'management_mv', '2020-11-01', null, null, null, null, null, null, 12),
('ac000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000d01', 'fa000000-0000-0000-0000-000000000023', 'rental_residential', '2020-04-01', 680.00, 120.00, 95.00, null, 2040.00, 'Barkaution', 3),
('ac000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000d01', 'fa000000-0000-0000-0000-000000000012', 'management_weg', '2021-05-01', null, null, null, 225.00, null, null, 6),
('ac000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000d01', 'fa000000-0000-0000-0000-000000000013', 'management_mv', '2018-03-01', null, null, null, null, null, null, 12),
('ac000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000d01', 'fa000000-0000-0000-0000-000000000014', 'rental_commercial', '2022-08-01', 3200.00, 520.00, 310.00, null, 9600.00, 'Bürgschaft', 6),
('ac000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000d01', 'fa000000-0000-0000-0000-000000000015', 'management_weg', '2020-09-01', null, null, null, 340.00, null, null, 6),
('ac000000-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000d01', 'fa000000-0000-0000-0000-000000000024', 'rental_residential', '2021-07-01', 590.00, 95.00, 75.00, null, 1770.00, 'Barkaution', 3),
('ac000000-0000-0000-0000-000000000017', 'a0000000-0000-0000-0000-000000000d01', 'fa000000-0000-0000-0000-000000000017', 'management_weg', '2023-06-01', null, null, null, 280.00, null, null, 6),
('ac000000-0000-0000-0000-000000000018', 'a0000000-0000-0000-0000-000000000d01', 'fa000000-0000-0000-0000-000000000018', 'management_mv', '2016-02-01', null, null, null, null, null, null, 12),
('ac000000-0000-0000-0000-000000000019', 'a0000000-0000-0000-0000-000000000d01', 'fa000000-0000-0000-0000-000000000019', 'management_mv', '2024-03-01', null, null, null, null, null, null, 12),
('ac000000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0000-000000000d01', 'fa000000-0000-0000-0000-000000000020', 'management_weg', '2019-08-01', null, null, null, 210.00, null, null, 6);


-- ============================================================
-- VORGÄNGE (40 — 2 pro Objekt)
-- ============================================================
insert into tickets (id, tenant_id, contact_id, property_id, title, description,
  category, status, priority, created_at) values

('bd000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000001', 'Aufzug außer Betrieb', 'Aufzug seit 3 Tagen defekt, Techniker beauftragt.', 'Reparatur', 'in_progress', 'high', '2026-04-10T08:00:00+02:00'),
('bd000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000001', 'Hausgeld-Rückstand EG links', 'Eigentümer schuldet 2 Monate Hausgeld.', 'Forderung', 'new', 'normal', '2026-04-28T09:00:00+02:00'),

('bd000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000002', 'da000000-0000-0000-0000-000000000002', 'Schimmel EG Wohnung', 'Mieter Richter meldet Schimmel in der Küche.', 'Mängelanzeige', 'waiting', 'high', '2026-04-15T10:00:00+02:00'),
('bd000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000009', 'da000000-0000-0000-0000-000000000002', 'Kündigung Mieter Richter', 'Fristgerechte Kündigung zum 31.07.', 'Mieterkommunikation', 'new', 'normal', '2026-05-01T11:00:00+02:00'),

('bd000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000003', 'da000000-0000-0000-0000-000000000003', 'Beschluss Fassadensanierung anfechten?', 'Eigentümer Braun zweifelt an der Beschlussfassung.', 'WEG-Versammlung', 'new', 'normal', '2026-04-20T14:00:00+02:00'),
('bd000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000002', 'da000000-0000-0000-0000-000000000003', 'Dachrinne verstopft Hofseite', 'Wasser läuft an der Fassade herunter.', 'Schadensmeldung', 'in_progress', 'high', '2026-05-02T08:30:00+02:00'),

('bd000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000015', 'da000000-0000-0000-0000-000000000004', 'Gewerberaummiete anpassen', 'Indexanpassung nach VPI fällig.', 'Vertragsanpassung', 'new', 'normal', '2026-04-25T10:00:00+02:00'),
('bd000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000015', 'da000000-0000-0000-0000-000000000004', 'Stellplatz-Anfrage Mieter EG', 'Mieter fragt nach 2 Stellplätzen im Hof.', 'Mieterkommunikation', 'closed', 'low', '2026-03-18T09:00:00+02:00'),

('bd000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000004', 'da000000-0000-0000-0000-000000000005', 'Heizung WE 3 kalt', 'Heizkörper bleibt kalt, Ventil defekt.', 'Heizung', 'resolved', 'urgent', '2026-03-05T07:00:00+02:00'),
('bd000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000004', 'da000000-0000-0000-0000-000000000005', 'Nebenkostenabrechnung 2024 Einspruch', 'Mieterin Schulz bestreitet Wasserkosten.', 'Beschwerde', 'waiting', 'normal', '2026-04-12T14:00:00+02:00'),

('bd000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000005', 'da000000-0000-0000-0000-000000000006', 'Jahresabrechnung 2025 vorbereiten', 'Alle Belege bei Buchhalter eingereicht.', 'Finanzen', 'in_progress', 'normal', '2026-04-01T09:00:00+02:00'),
('bd000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000005', 'da000000-0000-0000-0000-000000000006', 'Klingel defekt', 'Klingelanlage OG 2 ausgefallen.', 'Reparatur', 'closed', 'low', '2026-02-20T11:00:00+02:00'),

('bd000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000008', 'da000000-0000-0000-0000-000000000007', 'Anfrage Haltung Haustier', 'Mieterin Krause möchte Hund halten.', 'Mieterkommunikation', 'new', 'low', '2026-05-03T10:00:00+02:00'),
('bd000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000006', 'da000000-0000-0000-0000-000000000007', 'Mieterhöhung nach Modernisierung', 'Fenster wurden erneuert, Erhöhung möglich.', 'Vertragsanpassung', 'new', 'normal', '2026-04-22T09:00:00+02:00'),

('bd000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000007', 'da000000-0000-0000-0000-000000000008', 'Einbruch Keller WE 5', 'Kellerverschlag aufgebrochen, Schaden ~400 EUR.', 'Schadensmeldung', 'in_progress', 'high', '2026-04-30T06:00:00+02:00'),
('bd000000-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000007', 'da000000-0000-0000-0000-000000000008', 'Mülltonnen falsch befüllt', 'Gelbe Tonne wird mit Restmüll befüllt.', 'Hausordnung', 'resolved', 'low', '2026-03-10T09:00:00+02:00'),

('bd000000-0000-0000-0000-000000000017', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000008', 'da000000-0000-0000-0000-000000000009', 'ETV Beschlussvorbereitung', 'Tagesordnung und Unterlagen für ETV im Herbst.', 'WEG-Versammlung', 'new', 'normal', '2026-05-01T10:00:00+02:00'),
('bd000000-0000-0000-0000-000000000018', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000008', 'da000000-0000-0000-0000-000000000009', 'Tiefgarage: Tor klemmt', 'Garagentor schließt nicht mehr vollständig.', 'Reparatur', 'in_progress', 'high', '2026-04-18T07:30:00+02:00'),

('bd000000-0000-0000-0000-000000000019', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000015', 'da000000-0000-0000-0000-000000000010', 'Gewerbe leer – Nachmieter suchen', 'EG-Fläche 180 m² seit Januar leer.', 'Vermietung', 'in_progress', 'high', '2026-02-01T09:00:00+02:00'),
('bd000000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000015', 'da000000-0000-0000-0000-000000000010', 'Fassade: Graffiti entfernen', 'Graffiti an der Hofmauer.', 'Hausordnung', 'closed', 'normal', '2026-03-22T10:00:00+02:00'),

('bd000000-0000-0000-0000-000000000021', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000010', 'da000000-0000-0000-0000-000000000011', 'Dachausbau genehmigung Anfrage', 'Eigentümer möchte Dachgeschoss ausbauen.', 'Behörden', 'waiting', 'normal', '2026-04-05T09:00:00+02:00'),
('bd000000-0000-0000-0000-000000000022', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000009', 'da000000-0000-0000-0000-000000000011', 'Briefkasten WE 4 defekt', 'Schloss klemmt.', 'Reparatur', 'resolved', 'low', '2026-03-28T11:00:00+02:00'),

('bd000000-0000-0000-0000-000000000023', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000004', 'da000000-0000-0000-0000-000000000012', 'Eigentümerversammlung vorbereiten', 'Jahres-ETV im September, Beschlussvorlagen erstellen.', 'WEG-Versammlung', 'new', 'normal', '2026-05-01T09:00:00+02:00'),
('bd000000-0000-0000-0000-000000000024', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000010', 'da000000-0000-0000-0000-000000000012', 'Lärmbeschwerden WE 7', 'Nachbar beschwert sich über Lärm nach 22 Uhr.', 'Beschwerde', 'new', 'normal', '2026-05-04T13:00:00+02:00'),

('bd000000-0000-0000-0000-000000000025', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000011', 'da000000-0000-0000-0000-000000000013', 'Fenster undicht OG 2', 'Zugluft und Kondenswasser bei Mieterin.', 'Mängelanzeige', 'in_progress', 'normal', '2026-04-14T10:00:00+02:00'),
('bd000000-0000-0000-0000-000000000026', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000011', 'da000000-0000-0000-0000-000000000013', 'Mietzahlung März fehlt', 'Kein Eingang März-Miete.', 'Forderung', 'resolved', 'high', '2026-04-05T09:00:00+02:00'),

('bd000000-0000-0000-0000-000000000027', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000015', 'da000000-0000-0000-0000-000000000014', 'Sprinkleranlage prüfen', 'Jährliche Pflichtprüfung nach ASR A2.2.', 'Reparatur', 'new', 'normal', '2026-05-05T09:00:00+02:00'),
('bd000000-0000-0000-0000-000000000028', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000015', 'da000000-0000-0000-0000-000000000014', 'Mietvertrag Bürofläche 3. OG', 'Neuer Mieter zieht zum 01.08. ein.', 'Vermietung', 'in_progress', 'normal', '2026-04-10T09:00:00+02:00'),

('bd000000-0000-0000-0000-000000000029', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000011', 'da000000-0000-0000-0000-000000000015', 'Sonderumlage Dachsanierung beschließen', '12 Eigentümer, Budget 85.000 EUR.', 'WEG-Versammlung', 'new', 'high', '2026-04-28T09:00:00+02:00'),
('bd000000-0000-0000-0000-000000000030', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000012', 'da000000-0000-0000-0000-000000000015', 'Rauchwarnmelder WE 11 fehlt', 'Beim letzten Check nicht auffindbar.', 'Reparatur', 'closed', 'normal', '2026-03-15T11:00:00+02:00'),

('bd000000-0000-0000-0000-000000000031', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000013', 'da000000-0000-0000-0000-000000000016', 'Grundsteuer-Bescheid 2026 prüfen', 'Erhöhung 18%, Einspruchsfrist beachten.', 'Finanzen', 'new', 'normal', '2026-05-02T09:00:00+02:00'),
('bd000000-0000-0000-0000-000000000032', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000013', 'da000000-0000-0000-0000-000000000016', 'Übergabe WE 4 nach Auszug', 'Mieter ausgezogen, Übergabeprotokoll erstellen.', 'Mieterkommunikation', 'in_progress', 'normal', '2026-05-05T10:00:00+02:00'),

('bd000000-0000-0000-0000-000000000033', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000017', 'Tiefgaragen-Tor – Wartung', 'Wartungsintervall überschritten.', 'Reparatur', 'new', 'normal', '2026-04-25T09:00:00+02:00'),
('bd000000-0000-0000-0000-000000000034', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000017', 'Beiratsbescheinigung Rechnungsprüfung', 'Beirat bittet um Belegliste Q1.', 'WEG-Versammlung', 'waiting', 'low', '2026-04-10T11:00:00+02:00'),

('bd000000-0000-0000-0000-000000000035', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000014', 'da000000-0000-0000-0000-000000000018', 'Hochwasserschutz prüfen', 'Objekt in gefährdeter Zone, Kellerabdichtung.', 'Schadensmeldung', 'waiting', 'normal', '2026-04-08T09:00:00+02:00'),
('bd000000-0000-0000-0000-000000000036', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000014', 'da000000-0000-0000-0000-000000000018', 'Betriebskostenabrechnung 2024', 'Nachzahlungen für 5 von 9 Mietern.', 'Finanzen', 'in_progress', 'normal', '2026-04-20T09:00:00+02:00'),

('bd000000-0000-0000-0000-000000000037', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000015', 'da000000-0000-0000-0000-000000000019', 'Objektübernahme Stammdaten prüfen', 'Neue Verwaltung – alle Unterlagen sichten.', 'Verwaltung', 'in_progress', 'high', '2026-03-01T09:00:00+02:00'),
('bd000000-0000-0000-0000-000000000038', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000015', 'da000000-0000-0000-0000-000000000019', 'Heizungsanlage defekt EG', 'Gastherme ausgefallen, Notdienst gerufen.', 'Heizung', 'resolved', 'urgent', '2026-04-03T06:00:00+02:00'),

('bd000000-0000-0000-0000-000000000039', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000003', 'da000000-0000-0000-0000-000000000020', 'WEG Beschluss Treppenhaus streichen', 'Budget 6.500 EUR, Abstimmung läuft.', 'WEG-Versammlung', 'new', 'normal', '2026-04-30T10:00:00+02:00'),
('bd000000-0000-0000-0000-000000000040', 'a0000000-0000-0000-0000-000000000d01', 'ca000000-0000-0000-0000-000000000003', 'da000000-0000-0000-0000-000000000020', 'Schornsteinfeger-Bescheid', 'Kehrbescheinigung für Q3/2026 ausstehend.', 'Reparatur', 'new', 'low', '2026-05-01T09:00:00+02:00');

-- resolved_at für erledigte Tickets
update tickets set resolved_at = '2026-03-08T15:00:00+02:00' where id = 'bd000000-0000-0000-0000-000000000009';
update tickets set resolved_at = '2026-03-12T10:00:00+02:00' where id = 'bd000000-0000-0000-0000-000000000016';
update tickets set resolved_at = '2026-03-30T14:00:00+02:00' where id = 'bd000000-0000-0000-0000-000000000022';
update tickets set resolved_at = '2026-04-08T11:00:00+02:00' where id = 'bd000000-0000-0000-0000-000000000026';
update tickets set resolved_at = '2026-03-18T09:00:00+02:00' where id = 'bd000000-0000-0000-0000-000000000030';
update tickets set resolved_at = '2026-04-05T16:00:00+02:00' where id = 'bd000000-0000-0000-0000-000000000038';


-- ============================================================
-- TERMINE & FRISTEN (50 — ca. 2-3 pro Objekt)
-- ============================================================
insert into deadlines (id, tenant_id, property_id, az, date, title, description,
  type, location, assigned_to, completed) values

('ed000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000001', 'WEG-2026-A01', '2026-09-18', 'ETV 2026 Äußere Dresdner Str.', 'Jahres-ETV, Wirtschaftsplan + Aufzugsreparatur auf Tagesordnung.', 'termin', 'Büro Sachsenhaus', 'Verwaltung', false),
('ed000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000001', 'WART-A01-2026', '2026-08-12', 'Aufzug – TÜV-Jahresprüfung', 'Wiederkehrende Prüfung nach BetrSichV.', 'termin', 'Aufzug Treppenhaus', 'TÜV Rheinland', false),
('ed000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000001', 'FRIST-A01-HG', '2026-12-31', 'Frist Hausgeld Jahresabrechnung 2025', 'Abrechnungsfrist WEG.', 'frist', '', 'Buchhaltung', false),

('ed000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000002', 'BEG-A02-2026', '2026-06-10', 'Begehung Miethaus Karl-Marx-Str.', 'Kontrolle Schimmelschaden EG + Kellerfeuchte.', 'termin', 'Karl-Marx-Str. 112', 'Verwaltung + Sachverständiger', false),
('ed000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000002', 'FRIST-A02-NK', '2026-12-31', 'Frist Nebenkostenabrechnung 2025', 'Gesetzliche Abrechnungsfrist § 556 BGB.', 'frist', '', 'Buchhaltung', false),

('ed000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000003', 'WEG-2026-A03', '2026-07-14', 'ETV Fürstenstr. 18 – Sonderumlage Dach', 'Beschluss Sanierungsmaßnahmen Hauptdach.', 'termin', 'Kanzleiräume Sachsenhaus', 'Verwaltung + Beirat', false),
('ed000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000003', 'FRIST-A03-ANF', '2026-08-14', 'Anfechtungsfrist ETV-Beschlüsse Fürstenstr.', '1 Monat nach ETV vom 14.07.', 'frist', '', 'Verwaltung', false),
('ed000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000003', 'SCHO-A03-2026', '2026-10-15', 'Schornsteinfeger Jahreskehrung', 'Pflichtprüfung gem. KÜO.', 'termin', 'Heizraum', 'Bezirksschornsteinfeger', false),

('ed000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000004', 'FRIST-A04-MIETE', '2026-06-30', 'Frist Indexanpassung Gewerbe', 'Mitteilungsfrist lt. Mietvertrag § 5.', 'frist', '', 'Verwaltung', false),
('ed000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000004', 'BSCHU-A04-2026', '2026-09-08', 'Brandschutzprüfung Geschäftshaus', 'Wiederkehrende Prüfung durch Sachverständigen.', 'termin', 'Alle Etagen', 'BSP Sachsen GmbH', false),

('ed000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000005', 'HEIZ-A05-2026', '2026-09-20', 'Heizungs-Jahreswartung', 'Wartung Zentralheizung vor Heizsaison.', 'termin', 'Heizraum', 'Heizungsbau Krause', false),
('ed000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000005', 'FRIST-A05-NK', '2026-12-31', 'Frist Nebenkostenabrechnung 2025', '', 'frist', '', 'Buchhaltung', false),

('ed000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000006', 'WEG-2026-A06', '2026-09-04', 'ETV Lutherstr. 27', 'Jahresabrechnung + Verwaltungsvertrag Verlängerung.', 'termin', 'Gemeinschaftsraum', 'Verwaltung + Eigentümer', false),
('ed000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000006', 'RWM-A06-2026', '2026-07-22', 'Rauchmelder-Jahresprüfung', 'DIN 14676, alle 6 Einheiten.', 'termin', 'Alle WE', 'Brandschutz Chemnitz', false),

('ed000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000007', 'BEG-A07-2026', '2026-06-20', 'Begehung Sondereigentum', 'Prüfung Schimmelrisiko nach Fenstertausch.', 'termin', 'Hartmannstr. 12 WE5', 'Verwaltung', false),
('ed000000-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000007', 'FRIST-A07-MIETE', '2026-09-30', 'Mieterhöhung prüfen (3-Jahres-Frist)', 'Letzte Erhöhung war Sep. 2023.', 'frist', '', 'Verwaltung', false),

('ed000000-0000-0000-0000-000000000017', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000008', 'HEIZ-A08-2026', '2026-09-25', 'Heizungs-Jahreswartung', 'Plattenbau-Zentralheizung.', 'termin', 'Heizraum Keller', 'Heizungsbau Krause', false),
('ed000000-0000-0000-0000-000000000018', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000008', 'FRIST-A08-NK', '2026-12-31', 'Frist Nebenkostenabrechnung 2025', '', 'frist', '', 'Buchhaltung', false),

('ed000000-0000-0000-0000-000000000019', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000009', 'WEG-2026-A09', '2026-10-02', 'ETV Zschopauer Str. 78', '10-Parteien-WEG, Wirtschaftsplan + Aufzug auf TO.', 'termin', 'Büro Sachsenhaus', 'Verwaltung', false),
('ed000000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000009', 'TWV-A09-2026', '2026-07-16', 'Legionellenprüfung Trinkwasser', 'Pflichtprüfung nach TrinkwV.', 'termin', 'Wasserleitungen Keller', 'AquaLab Leipzig', false),
('ed000000-0000-0000-0000-000000000021', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000009', 'AUFZUG-A09-2026', '2026-08-19', 'TÜV-Prüfung Aufzug', 'Hauptprüfung nach BetrSichV.', 'termin', 'Aufzug Treppenhaus', 'TÜV SÜD', false),

('ed000000-0000-0000-0000-000000000022', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000010', 'FRIST-A10-LEER', '2026-07-01', 'Entscheidung Leerstand EG bis wann', 'Spätestens Zielentscheidung Nachmieter.', 'frist', '', 'Verwaltung', false),
('ed000000-0000-0000-0000-000000000023', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000010', 'HEIZ-A10-2026', '2026-10-08', 'Heizungs-Jahreswartung', '', 'termin', 'Heizraum', 'Heizungsbau Krause', false),

('ed000000-0000-0000-0000-000000000024', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000011', 'FRIST-A11-DACH', '2026-09-30', 'Frist Entscheidung Dachausbau', 'Genehmigungsantrag bis Oktober stellen.', 'frist', '', 'Verwaltung', false),
('ed000000-0000-0000-0000-000000000025', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000011', 'RWM-A11-2026', '2026-08-20', 'Rauchmelder-Jahresprüfung', 'Alle 7 Wohnungen.', 'termin', 'Carolastr. 25', 'Brandschutz Leipzig', false),

('ed000000-0000-0000-0000-000000000026', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000012', 'WEG-2026-A12', '2026-09-25', 'ETV Karl-Liebknecht-Str. 102', 'Schwerpunkt: Wirtschaftsplan 2027, Glasfaser.', 'termin', 'Büro Sachsenhaus', 'Verwaltung', false),
('ed000000-0000-0000-0000-000000000027', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000012', 'FRIST-A12-WP', '2026-08-31', 'Wirtschaftsplan 2027 erstellen', 'Mindestens 3 Wochen vor ETV.', 'frist', '', 'Buchhaltung', false),

('ed000000-0000-0000-0000-000000000028', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000013', 'HEIZ-A13-2026', '2026-09-30', 'Heizungs-Jahreswartung', '', 'termin', 'Heizraum Lützner Str.', 'Heizungsbau Krause', false),
('ed000000-0000-0000-0000-000000000029', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000013', 'FRIST-A13-NK', '2026-12-31', 'Frist Nebenkostenabrechnung 2025', '', 'frist', '', 'Buchhaltung', false),

('ed000000-0000-0000-0000-000000000030', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000014', 'BSCHU-A14-2026', '2026-07-03', 'Brandschutzprüfung', 'Jährliche Prüfung aller Brandschutzbauteile.', 'termin', 'Eisenbahnstr. 47', 'BSP Sachsen GmbH', false),
('ed000000-0000-0000-0000-000000000031', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000014', 'FRIST-A14-MIETE', '2026-07-31', 'Mietvertrag Neubüro – Einzug August', 'Alle Unterlagen vor Einzug sicherstellen.', 'frist', '', 'Verwaltung', false),

('ed000000-0000-0000-0000-000000000032', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000015', 'WEG-2026-A15', '2026-06-18', 'ETV Goethestr. 14 Leipzig', 'Dachsanierung Sonderumlage + Wirtschaftsplan.', 'termin', 'Hotel Mercure Leipzig', 'Verwaltung', false),
('ed000000-0000-0000-0000-000000000033', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000015', 'FRIST-A15-ANF', '2026-07-18', 'Anfechtungsfrist ETV Goethestr.', '1 Monat nach ETV 18.06.', 'frist', '', 'Verwaltung', false),
('ed000000-0000-0000-0000-000000000034', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000015', 'RWM-A15-2026', '2026-08-05', 'Rauchmelder-Jahresprüfung', '12 Wohnungen + 2 Gewerbe.', 'termin', 'Goethestr. 14', 'Brandschutz Leipzig', false),

('ed000000-0000-0000-0000-000000000035', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000016', 'HEIZ-A16-2026', '2026-10-05', 'Heizungs-Jahreswartung', '', 'termin', 'Heizraum Riemannstr.', 'Heizungsbau Krause', false),
('ed000000-0000-0000-0000-000000000036', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000016', 'FRIST-A16-GS', '2026-06-02', 'Frist Einspruch Grundsteuer 2026', '1 Monat nach Bescheiddatum 02.05.', 'frist', '', 'Verwaltung', false),

('ed000000-0000-0000-0000-000000000037', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000017', 'WEG-2026-A17', '2026-10-09', 'ETV Hofer Str. 23 Leipzig', 'Wirtschaftsplan 2027, Tiefgaragen-Tor.', 'termin', 'Büro Sachsenhaus', 'Verwaltung', false),
('ed000000-0000-0000-0000-000000000038', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000017', 'FRIST-A17-WP', '2026-09-14', 'Wirtschaftsplan 2027 fertig', 'Mindestens 3 Wochen vor ETV.', 'frist', '', 'Buchhaltung', false),

('ed000000-0000-0000-0000-000000000039', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000018', 'TWV-A18-2026', '2026-07-22', 'Legionellenprüfung', 'Pflicht nach TrinkwV.', 'termin', 'Plagwitzer Str. 67', 'AquaLab Leipzig', false),
('ed000000-0000-0000-0000-000000000040', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000018', 'FRIST-A18-VERS', '2026-08-01', 'Versicherungspolice prüfen – Hochwasser', 'Überprüfung Elementarschadenklausel.', 'frist', '', 'Verwaltung', false),

('ed000000-0000-0000-0000-000000000041', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000019', 'BSCHU-A19-2026', '2026-06-25', 'Brandschutzbegehung Neuverwaltung', 'Erstbegehung nach Übernahme.', 'termin', 'Mockauer Str. 22', 'BSP Sachsen GmbH', false),
('ed000000-0000-0000-0000-000000000042', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000019', 'HEIZ-A19-2026', '2026-10-12', 'Heizungs-Jahreswartung', '', 'termin', 'Heizraum Mockau', 'Heizungsbau Leipzig', false),

('ed000000-0000-0000-0000-000000000043', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000020', 'WEG-2026-A20', '2026-09-17', 'ETV Bornaische Str. 54', 'Treppenhaus-Renovierung + Wirtschaftsplan.', 'termin', 'Büro Sachsenhaus', 'Verwaltung', false),
('ed000000-0000-0000-0000-000000000044', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000020', 'SCHO-A20-2026', '2026-10-20', 'Schornsteinfeger Jahreskehrung', '', 'termin', 'Heizraum Bornaische Str.', 'Bezirksschornsteinfeger', false),
('ed000000-0000-0000-0000-000000000045', 'a0000000-0000-0000-0000-000000000d01', 'da000000-0000-0000-0000-000000000020', 'FRIST-A20-ANF', '2026-10-17', 'Anfechtungsfrist ETV Bornaische Str.', '1 Monat nach ETV 17.09.', 'frist', '', 'Verwaltung', false);
