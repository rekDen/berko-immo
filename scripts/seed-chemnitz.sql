-- ============================================================
-- DEMO-DATEN: Hausverwaltung Chemnitz
-- ============================================================
-- Realistische Beispieldaten:
-- 1 Tenant, 4 Objekte, 21 Einheiten, ~20 Kontakte,
-- ~30 Rollen, 13 Verträge, 10 Vorgänge, 13 Kommunikationen
--
-- WICHTIG: Damit du diese Daten in der App siehst, verknüpfe
-- deinen User mit dem neuen Tenant (am Ende dieser Datei
-- auskommentiert vorbereitet).
-- ============================================================


-- ============================================================
-- TENANT
-- ============================================================

insert into tenants (id, name, slug) values
  ('a0000000-0000-0000-0000-000000000c01', 'Sachsenhaus Verwaltung GmbH', 'sachsenhaus-chemnitz');


-- ============================================================
-- KONTAKTE
-- ============================================================

-- ---- Eigentümer Kaßbergstraße 47 (WEG) ----

insert into contacts (id, tenant_id, type, salutation, academic_title, first_name, last_name, language, emails, phones, addresses, date_of_birth) values
  ('c0000000-0000-0000-0000-000000000c01',
   'a0000000-0000-0000-0000-000000000c01',
   'natural_person', 'herr', 'Dr.', 'Andreas', 'Petzold', 'de',
   '[{"type":"private","value":"a.petzold@gmx.de"}]',
   '[{"type":"mobile","value":"+4917123456789"},{"type":"landline","value":"+493715551234"}]',
   '[{"type":"residential","street":"Kaßbergstraße","house_number":"47","zip_code":"09112","city":"Chemnitz","country":"DE"}]',
   '1962-03-15');

insert into contacts (id, tenant_id, type, salutation, first_name, last_name, language, emails, phones, addresses, date_of_birth) values
  ('c0000000-0000-0000-0000-000000000c02',
   'a0000000-0000-0000-0000-000000000c01',
   'natural_person', 'frau', 'Sabine', 'Hoffmann', 'de',
   '[{"type":"private","value":"s.hoffmann@web.de"}]',
   '[{"type":"mobile","value":"+4915234567890"}]',
   '[{"type":"residential","street":"Kaßbergstraße","house_number":"47","zip_code":"09112","city":"Chemnitz","country":"DE"}]',
   '1971-08-22'),
  ('c0000000-0000-0000-0000-000000000c03',
   'a0000000-0000-0000-0000-000000000c01',
   'natural_person', 'eheleute', 'Heinrich und Margit', 'Wagner', 'de',
   '[{"type":"private","value":"wagner.familie@t-online.de"}]',
   '[{"type":"landline","value":"+493715559876"}]',
   '[{"type":"residential","street":"Kaßbergstraße","house_number":"47","zip_code":"09112","city":"Chemnitz","country":"DE"}]',
   '1955-11-08'),
  ('c0000000-0000-0000-0000-000000000c04',
   'a0000000-0000-0000-0000-000000000c01',
   'natural_person', 'herr', 'Christian', 'Uhlig', 'de',
   '[{"type":"private","value":"c.uhlig@gmail.com"},{"type":"business","value":"uhlig@uhlig-consulting.de"}]',
   '[{"type":"mobile","value":"+4917345678901"}]',
   '[{"type":"residential","street":"Albert-Köhler-Straße","house_number":"68","zip_code":"09122","city":"Chemnitz","country":"DE"}]',
   '1978-04-30'),
  ('c0000000-0000-0000-0000-000000000c05',
   'a0000000-0000-0000-0000-000000000c01',
   'natural_person', 'frau', 'Maria', 'Sokolova', 'ru',
   '[{"type":"private","value":"m.sokolova@mail.ru"}]',
   '[{"type":"mobile","value":"+4916045678901"}]',
   '[{"type":"residential","street":"Kaßbergstraße","house_number":"47","zip_code":"09112","city":"Chemnitz","country":"DE"}]',
   '1985-12-03'),
  ('c0000000-0000-0000-0000-000000000c06',
   'a0000000-0000-0000-0000-000000000c01',
   'natural_person', 'herr', 'Thomas', 'Lehmann', 'de',
   '[{"type":"private","value":"thomas.lehmann@gmx.de"}]',
   '[{"type":"mobile","value":"+4917656789012"}]',
   '[{"type":"residential","street":"Kaßbergstraße","house_number":"47","zip_code":"09112","city":"Chemnitz","country":"DE"}]',
   '1968-07-19');

insert into contacts (id, tenant_id, type, salutation, company_name, language, emails, phones, addresses, vat_id, tax_id) values
  ('c0000000-0000-0000-0000-000000000c07',
   'a0000000-0000-0000-0000-000000000c01',
   'legal_entity', 'firma', 'Schmidt Immobilien GmbH', 'de',
   '[{"type":"business","value":"info@schmidt-immo-chemnitz.de"}]',
   '[{"type":"landline","value":"+493715553300"}]',
   '[{"type":"business","street":"Reichsstraße","house_number":"15","zip_code":"09112","city":"Chemnitz","country":"DE"}]',
   'DE314159265', '231/123/45678');

-- ---- Mieter Kaßbergstraße W04 (Uhlig vermietet) ----

insert into contacts (id, tenant_id, type, salutation, first_name, last_name, language, emails, phones, addresses, date_of_birth) values
  ('c0000000-0000-0000-0000-000000000c08',
   'a0000000-0000-0000-0000-000000000c01',
   'natural_person', 'eheleute', 'Frank und Julia', 'Sturm', 'de',
   '[{"type":"private","value":"sturm.familie@gmx.net"}]',
   '[{"type":"mobile","value":"+4917789012345"}]',
   '[{"type":"residential","street":"Kaßbergstraße","house_number":"47","zip_code":"09112","city":"Chemnitz","country":"DE"}]',
   '1989-02-14');

-- ---- Eigentümerin Hainstraße 23 (Miethaus, Sonnenberg) ----

insert into contacts (id, tenant_id, type, salutation, company_name, language, emails, phones, addresses, vat_id) values
  ('c0000000-0000-0000-0000-000000000c09',
   'a0000000-0000-0000-0000-000000000c01',
   'legal_entity', 'firma', 'Bauer Vermögensverwaltung KG', 'de',
   '[{"type":"business","value":"verwaltung@bauer-vermoegen.de"}]',
   '[{"type":"landline","value":"+493715557788"}]',
   '[{"type":"business","street":"Theaterstraße","house_number":"3","zip_code":"09111","city":"Chemnitz","country":"DE"}]',
   'DE271828182');

-- ---- Mieter Hainstraße 23 ----

insert into contacts (id, tenant_id, type, salutation, first_name, last_name, language, emails, phones, addresses, date_of_birth) values
  ('c0000000-0000-0000-0000-000000000c0a',
   'a0000000-0000-0000-0000-000000000c01',
   'natural_person', 'eheleute', 'Andreas und Stefanie', 'Müller', 'de',
   '[{"type":"private","value":"a.s.mueller@gmx.de"}]',
   '[{"type":"mobile","value":"+4915890123456"}]',
   '[{"type":"residential","street":"Hainstraße","house_number":"23","zip_code":"09130","city":"Chemnitz","country":"DE"}]',
   '1982-09-25'),
  ('c0000000-0000-0000-0000-000000000c0b',
   'a0000000-0000-0000-0000-000000000c01',
   'natural_person', 'frau', 'Anna', 'Becker', 'de',
   '[{"type":"private","value":"anna.becker92@web.de"}]',
   '[{"type":"mobile","value":"+4916234567891"}]',
   '[{"type":"residential","street":"Hainstraße","house_number":"23","zip_code":"09130","city":"Chemnitz","country":"DE"}]',
   '1992-06-12'),
  ('c0000000-0000-0000-0000-000000000c0c',
   'a0000000-0000-0000-0000-000000000c01',
   'natural_person', 'herr', 'Mario', 'Pötzsch', 'de',
   '[{"type":"private","value":"m.poetzsch@t-online.de"}]',
   '[{"type":"landline","value":"+493715552020"}]',
   '[{"type":"residential","street":"Hainstraße","house_number":"23","zip_code":"09130","city":"Chemnitz","country":"DE"}]',
   '1965-01-30'),
  ('c0000000-0000-0000-0000-000000000c0d',
   'a0000000-0000-0000-0000-000000000c01',
   'natural_person', 'eheleute', 'Van Minh und Thuy Linh', 'Nguyen', 'de',
   '[{"type":"private","value":"vm.nguyen@gmail.com"}]',
   '[{"type":"mobile","value":"+4917890123459"}]',
   '[{"type":"residential","street":"Hainstraße","house_number":"23","zip_code":"09130","city":"Chemnitz","country":"DE"}]',
   '1984-05-17'),
  ('c0000000-0000-0000-0000-000000000c0e',
   'a0000000-0000-0000-0000-000000000c01',
   'natural_person', 'herr', 'Tim', 'Krause', 'de',
   '[{"type":"private","value":"tim.krause@outlook.de"}]',
   '[{"type":"mobile","value":"+4915123456780"}]',
   '[{"type":"residential","street":"Hainstraße","house_number":"23","zip_code":"09130","city":"Chemnitz","country":"DE"}]',
   '1995-11-20'),
  ('c0000000-0000-0000-0000-000000000c0f',
   'a0000000-0000-0000-0000-000000000c01',
   'natural_person', 'frau', 'Lisa', 'Schneider', 'de',
   '[{"type":"private","value":"lisa.schneider@web.de"}]',
   '[{"type":"mobile","value":"+4915623456781"}]',
   '[{"type":"residential","street":"Hainstraße","house_number":"23","zip_code":"09130","city":"Chemnitz","country":"DE"}]',
   '1996-04-08'),
  ('c0000000-0000-0000-0000-000000000c10',
   'a0000000-0000-0000-0000-000000000c01',
   'natural_person', 'frau', 'Hildegard', 'Klein', 'de',
   '[]',
   '[{"type":"landline","value":"+493715559090"}]',
   '[{"type":"residential","street":"Hainstraße","house_number":"23","zip_code":"09130","city":"Chemnitz","country":"DE"}]',
   '1939-03-25');

-- ---- Reichenhainer Str. 91 (TU-Nähe) ----

insert into contacts (id, tenant_id, type, salutation, academic_title, first_name, last_name, language, emails, phones, addresses, date_of_birth) values
  ('c0000000-0000-0000-0000-000000000c11',
   'a0000000-0000-0000-0000-000000000c01',
   'natural_person', 'frau', 'Dr.', 'Birgit', 'Walter', 'de',
   '[{"type":"private","value":"birgit.walter@web.de"}]',
   '[{"type":"mobile","value":"+4915234567892"}]',
   '[{"type":"residential","street":"Stollberger Straße","house_number":"112","zip_code":"09119","city":"Chemnitz","country":"DE"}]',
   '1973-09-14');

insert into contacts (id, tenant_id, type, salutation, company_name, language, emails, phones, addresses, vat_id) values
  ('c0000000-0000-0000-0000-000000000c12',
   'a0000000-0000-0000-0000-000000000c01',
   'legal_entity', 'firma', 'WGS Chemnitz Wohnungsgenossenschaft mbH', 'de',
   '[{"type":"business","value":"verwaltung@wgs-chemnitz.de"}]',
   '[{"type":"landline","value":"+493715557000"}]',
   '[{"type":"business","street":"Brückenstraße","house_number":"10","zip_code":"09111","city":"Chemnitz","country":"DE"}]',
   'DE161803398');

insert into contacts (id, tenant_id, type, salutation, first_name, last_name, language, emails, phones, addresses, date_of_birth) values
  ('c0000000-0000-0000-0000-000000000c13',
   'a0000000-0000-0000-0000-000000000c01',
   'natural_person', 'herr', 'Maximilian', 'Schulz', 'de',
   '[{"type":"private","value":"max.schulz@s.tu-chemnitz.de"}]',
   '[{"type":"mobile","value":"+4915611112222"}]',
   '[{"type":"residential","street":"Reichenhainer Straße","house_number":"91","zip_code":"09126","city":"Chemnitz","country":"DE"}]',
   '2001-07-22'),
  ('c0000000-0000-0000-0000-000000000c14',
   'a0000000-0000-0000-0000-000000000c01',
   'natural_person', 'frau', 'Aleksandra', 'Kowalski', 'de',
   '[{"type":"private","value":"a.kowalski@s.tu-chemnitz.de"}]',
   '[{"type":"mobile","value":"+4915622223333"}]',
   '[{"type":"residential","street":"Reichenhainer Straße","house_number":"91","zip_code":"09126","city":"Chemnitz","country":"DE"}]',
   '2002-02-18');

-- ---- Gewerbe Innere Klosterstraße 8 ----

insert into contacts (id, tenant_id, type, salutation, company_name, language, emails, phones, addresses) values
  ('c0000000-0000-0000-0000-000000000c15',
   'a0000000-0000-0000-0000-000000000c01',
   'legal_entity', 'firma', 'Café Sächsisch e.K. (Inh. Doreen Heidrich)', 'de',
   '[{"type":"business","value":"info@cafe-saechsisch.de"}]',
   '[{"type":"landline","value":"+493715554040"}]',
   '[{"type":"business","street":"Innere Klosterstraße","house_number":"8","zip_code":"09111","city":"Chemnitz","country":"DE"}]');

insert into contacts (id, tenant_id, type, salutation, company_name, language, emails, phones, addresses, vat_id) values
  ('c0000000-0000-0000-0000-000000000c16',
   'a0000000-0000-0000-0000-000000000c01',
   'legal_entity', 'firma', 'Richter & Partner Rechtsanwälte PartG mbB', 'de',
   '[{"type":"business","value":"kanzlei@richter-partner.de"}]',
   '[{"type":"landline","value":"+493715556060"}]',
   '[{"type":"business","street":"Innere Klosterstraße","house_number":"8","zip_code":"09111","city":"Chemnitz","country":"DE"}]',
   'DE141421356');

-- ---- Dienstleister ----

insert into contacts (id, tenant_id, type, salutation, first_name, last_name, language, emails, phones, addresses) values
  ('c0000000-0000-0000-0000-000000000c17',
   'a0000000-0000-0000-0000-000000000c01',
   'natural_person', 'herr', 'Bernd', 'Schulze', 'de',
   '[{"type":"business","value":"schulze@hausmeister-cz.de"}]',
   '[{"type":"mobile","value":"+4917744445555"}]',
   '[{"type":"business","street":"Bernsdorfer Straße","house_number":"148","zip_code":"09126","city":"Chemnitz","country":"DE"}]');

insert into contacts (id, tenant_id, type, salutation, company_name, language, emails, phones, addresses, vat_id) values
  ('c0000000-0000-0000-0000-000000000c18',
   'a0000000-0000-0000-0000-000000000c01',
   'legal_entity', 'firma', 'ChemnitzWärme GmbH', 'de',
   '[{"type":"business","value":"service@chemnitz-waerme.de"},{"type":"business","value":"notdienst@chemnitz-waerme.de"}]',
   '[{"type":"landline","value":"+493715558000"},{"type":"mobile","value":"+4917799990000"}]',
   '[{"type":"business","street":"Annaberger Straße","house_number":"240","zip_code":"09120","city":"Chemnitz","country":"DE"}]',
   'DE271828183');


-- ============================================================
-- OBJEKTE
-- ============================================================

insert into properties (id, tenant_id, name, street, house_number, zip_code, city, type, year_built, total_area, unit_count, gemarkung, flur, flurstueck, notes) values
  ('d0000000-0000-0000-0000-000000000c01',
   'a0000000-0000-0000-0000-000000000c01',
   'WEG Kaßbergstraße 47',
   'Kaßbergstraße', '47', '09112', 'Chemnitz',
   'weg', 1903, 612.50, 8,
   'Chemnitz', '142', '78/3',
   'Denkmalgeschütztes Jugendstilhaus, Kernsanierung 1998. Hofdurchfahrt zum Innenhof mit Gartenfläche. 8 WE, kein Aufzug. Gas-Zentralheizung, Bj. Heizung 2014.'),
  ('d0000000-0000-0000-0000-000000000c02',
   'a0000000-0000-0000-0000-000000000c01',
   'Miethaus Hainstraße 23',
   'Hainstraße', '23', '09130', 'Chemnitz',
   'miethaus', 1925, 480.00, 6,
   'Sonnenberg', '88', '15/2',
   '6 Mietwohnungen. Eigentümer: Bauer Vermögensverwaltung KG. Modernisierung 2014 (Fenster, Heizung). Fassade sanierungsbedürftig, Beschluss 2027 geplant.'),
  ('d0000000-0000-0000-0000-000000000c03',
   'a0000000-0000-0000-0000-000000000c01',
   'WEG Reichenhainer Straße 91',
   'Reichenhainer Straße', '91', '09126', 'Chemnitz',
   'weg', 1995, 295.00, 4,
   'Chemnitz', '203', '12/8',
   'Reihenhaus-WEG in TU-Nähe. 4 WE, alle vermietet (überwiegend Studenten der TU Chemnitz). Fernwärme-Anschluss eins.energie.'),
  ('d0000000-0000-0000-0000-000000000c04',
   'a0000000-0000-0000-0000-000000000c01',
   'Geschäftshaus Innere Klosterstraße 8',
   'Innere Klosterstraße', '8', '09111', 'Chemnitz',
   'gewerbe', 1908, 380.00, 3,
   'Chemnitz', '12', '4/1',
   'Geschäftshaus Innenstadt, denkmalgeschützt. EG: Gastronomie. 1.+2. OG: Büro. DG als Lager. Eigentümer: WGS Chemnitz mbH.');


-- ============================================================
-- EINHEITEN
-- ============================================================

-- Kaßbergstraße 47 (8 WE)
insert into units (id, tenant_id, property_id, unit_number, floor, type, area, room_count, mea, heating_type, location_description) values
  ('e0000000-0000-0000-0000-000000000c01', 'a0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c01', 'W01', 'EG links', 'apartment', 78.50, 3, 128.2500, 'Zentralheizung Gas', 'EG links, mit Gartenzugang'),
  ('e0000000-0000-0000-0000-000000000c02', 'a0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c01', 'W02', 'EG rechts', 'apartment', 65.00, 2.5, 106.1500, 'Zentralheizung Gas', 'EG rechts'),
  ('e0000000-0000-0000-0000-000000000c03', 'a0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c01', 'W03', '1. OG links', 'apartment', 92.30, 4, 150.8000, 'Zentralheizung Gas', '1. OG links, Erker zur Straße'),
  ('e0000000-0000-0000-0000-000000000c04', 'a0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c01', 'W04', '1. OG rechts', 'apartment', 80.20, 3, 131.0000, 'Zentralheizung Gas', '1. OG rechts'),
  ('e0000000-0000-0000-0000-000000000c05', 'a0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c01', 'W05', '2. OG links', 'apartment', 78.50, 3, 128.2500, 'Zentralheizung Gas', '2. OG links'),
  ('e0000000-0000-0000-0000-000000000c06', 'a0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c01', 'W06', '2. OG rechts', 'apartment', 65.00, 2.5, 106.1500, 'Zentralheizung Gas', '2. OG rechts'),
  ('e0000000-0000-0000-0000-000000000c07', 'a0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c01', 'W07', 'DG links', 'apartment', 72.00, 3, 117.7500, 'Zentralheizung Gas', 'DG links, mit Schräge'),
  ('e0000000-0000-0000-0000-000000000c08', 'a0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c01', 'W08', 'DG rechts', 'apartment', 81.00, 3, 132.4000, 'Zentralheizung Gas', 'DG rechts mit Dachterrasse');

-- Hainstraße 23 (6 ME)
insert into units (id, tenant_id, property_id, unit_number, floor, type, area, room_count, heating_type) values
  ('e0000000-0000-0000-0000-000000000c11', 'a0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c02', 'M01', 'EG', 'apartment', 75.00, 3, 'Zentralheizung Gas'),
  ('e0000000-0000-0000-0000-000000000c12', 'a0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c02', 'M02', '1. OG', 'apartment', 68.00, 2.5, 'Zentralheizung Gas'),
  ('e0000000-0000-0000-0000-000000000c13', 'a0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c02', 'M03', '2. OG', 'apartment', 75.00, 3, 'Zentralheizung Gas'),
  ('e0000000-0000-0000-0000-000000000c14', 'a0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c02', 'M04', '3. OG', 'apartment', 68.00, 2.5, 'Zentralheizung Gas'),
  ('e0000000-0000-0000-0000-000000000c15', 'a0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c02', 'M05', 'DG', 'apartment', 92.00, 4, 'Zentralheizung Gas'),
  ('e0000000-0000-0000-0000-000000000c16', 'a0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c02', 'M06', 'EG seitlich', 'apartment', 52.00, 2, 'Zentralheizung Gas');

-- Reichenhainer 91 (4 WE)
insert into units (id, tenant_id, property_id, unit_number, floor, type, area, room_count, mea, heating_type) values
  ('e0000000-0000-0000-0000-000000000c21', 'a0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c03', 'W01', '1. OG', 'apartment', 72.50, 3, 245.0000, 'Fernwärme'),
  ('e0000000-0000-0000-0000-000000000c22', 'a0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c03', 'W02', '1. OG', 'apartment', 72.50, 3, 245.0000, 'Fernwärme'),
  ('e0000000-0000-0000-0000-000000000c23', 'a0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c03', 'W03', '2. OG', 'apartment', 75.00, 3, 255.0000, 'Fernwärme'),
  ('e0000000-0000-0000-0000-000000000c24', 'a0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c03', 'W04', '2. OG', 'apartment', 75.00, 3, 255.0000, 'Fernwärme');

-- Klosterstraße 8 (3 GE)
insert into units (id, tenant_id, property_id, unit_number, floor, type, area, location_description) values
  ('e0000000-0000-0000-0000-000000000c31', 'a0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c04', 'G01', 'EG', 'commercial', 145.00, 'EG, Gastronomie mit Schaufenster zur Klosterstraße'),
  ('e0000000-0000-0000-0000-000000000c32', 'a0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c04', 'G02', '1. OG', 'commercial', 130.00, '1. OG komplett, Bürofläche'),
  ('e0000000-0000-0000-0000-000000000c33', 'a0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c04', 'G03', '2. OG', 'commercial', 105.00, '2. OG, Bürofläche, teilbar');


-- ============================================================
-- ROLLEN (CONTACT_ROLES)
-- ============================================================

-- Kaßbergstr. Eigentümer
insert into contact_roles (id, tenant_id, contact_id, property_id, unit_id, role, valid_from, is_primary) values
  ('f0000000-0000-0000-0000-000000000c01', 'a0000000-0000-0000-0000-000000000c01', 'c0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c01', 'e0000000-0000-0000-0000-000000000c01', 'owner', '2010-04-15', true),
  ('f0000000-0000-0000-0000-000000000c02', 'a0000000-0000-0000-0000-000000000c01', 'c0000000-0000-0000-0000-000000000c02', 'd0000000-0000-0000-0000-000000000c01', 'e0000000-0000-0000-0000-000000000c02', 'owner', '2015-08-01', true),
  ('f0000000-0000-0000-0000-000000000c03', 'a0000000-0000-0000-0000-000000000c01', 'c0000000-0000-0000-0000-000000000c03', 'd0000000-0000-0000-0000-000000000c01', 'e0000000-0000-0000-0000-000000000c03', 'owner', '1999-11-20', true),
  ('f0000000-0000-0000-0000-000000000c04', 'a0000000-0000-0000-0000-000000000c01', 'c0000000-0000-0000-0000-000000000c04', 'd0000000-0000-0000-0000-000000000c01', 'e0000000-0000-0000-0000-000000000c04', 'owner', '2018-03-10', true),
  ('f0000000-0000-0000-0000-000000000c05', 'a0000000-0000-0000-0000-000000000c01', 'c0000000-0000-0000-0000-000000000c05', 'd0000000-0000-0000-0000-000000000c01', 'e0000000-0000-0000-0000-000000000c05', 'owner', '2021-06-01', true),
  ('f0000000-0000-0000-0000-000000000c06', 'a0000000-0000-0000-0000-000000000c01', 'c0000000-0000-0000-0000-000000000c06', 'd0000000-0000-0000-0000-000000000c01', 'e0000000-0000-0000-0000-000000000c06', 'owner', '2008-09-15', true),
  ('f0000000-0000-0000-0000-000000000c07', 'a0000000-0000-0000-0000-000000000c01', 'c0000000-0000-0000-0000-000000000c07', 'd0000000-0000-0000-0000-000000000c01', 'e0000000-0000-0000-0000-000000000c07', 'owner', '2017-01-12', true),
  ('f0000000-0000-0000-0000-000000000c08', 'a0000000-0000-0000-0000-000000000c01', 'c0000000-0000-0000-0000-000000000c07', 'd0000000-0000-0000-0000-000000000c01', 'e0000000-0000-0000-0000-000000000c08', 'owner', '2017-01-12', true);

-- Kaßbergstr. Beirat
insert into contact_roles (id, tenant_id, contact_id, property_id, role, valid_from, is_primary, metadata) values
  ('f0000000-0000-0000-0000-000000000c09', 'a0000000-0000-0000-0000-000000000c01', 'c0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c01', 'beirat', '2023-04-01', true, '{"position":"Vorsitzender"}'),
  ('f0000000-0000-0000-0000-000000000c0a', 'a0000000-0000-0000-0000-000000000c01', 'c0000000-0000-0000-0000-000000000c06', 'd0000000-0000-0000-0000-000000000c01', 'beirat', '2023-04-01', true, '{"position":"Stellvertreter"}');

-- Kaßbergstr. Mieter (W04)
insert into contact_roles (id, tenant_id, contact_id, property_id, unit_id, role, valid_from, is_primary) values
  ('f0000000-0000-0000-0000-000000000c0b', 'a0000000-0000-0000-0000-000000000c01', 'c0000000-0000-0000-0000-000000000c08', 'd0000000-0000-0000-0000-000000000c01', 'e0000000-0000-0000-0000-000000000c04', 'tenant', '2022-04-01', true);

-- Hainstr. Eigentümer
insert into contact_roles (id, tenant_id, contact_id, property_id, role, valid_from, is_primary) values
  ('f0000000-0000-0000-0000-000000000c10', 'a0000000-0000-0000-0000-000000000c01', 'c0000000-0000-0000-0000-000000000c09', 'd0000000-0000-0000-0000-000000000c02', 'owner', '2008-05-15', true);

-- Hainstr. Mieter
insert into contact_roles (id, tenant_id, contact_id, property_id, unit_id, role, valid_from, is_primary) values
  ('f0000000-0000-0000-0000-000000000c11', 'a0000000-0000-0000-0000-000000000c01', 'c0000000-0000-0000-0000-000000000c0a', 'd0000000-0000-0000-0000-000000000c02', 'e0000000-0000-0000-0000-000000000c11', 'tenant', '2019-09-01', true),
  ('f0000000-0000-0000-0000-000000000c12', 'a0000000-0000-0000-0000-000000000c01', 'c0000000-0000-0000-0000-000000000c0b', 'd0000000-0000-0000-0000-000000000c02', 'e0000000-0000-0000-0000-000000000c12', 'tenant', '2021-01-15', true),
  ('f0000000-0000-0000-0000-000000000c13', 'a0000000-0000-0000-0000-000000000c01', 'c0000000-0000-0000-0000-000000000c0c', 'd0000000-0000-0000-0000-000000000c02', 'e0000000-0000-0000-0000-000000000c13', 'tenant', '2010-03-01', true),
  ('f0000000-0000-0000-0000-000000000c14', 'a0000000-0000-0000-0000-000000000c01', 'c0000000-0000-0000-0000-000000000c0d', 'd0000000-0000-0000-0000-000000000c02', 'e0000000-0000-0000-0000-000000000c14', 'tenant', '2020-07-01', true),
  ('f0000000-0000-0000-0000-000000000c15', 'a0000000-0000-0000-0000-000000000c01', 'c0000000-0000-0000-0000-000000000c0e', 'd0000000-0000-0000-0000-000000000c02', 'e0000000-0000-0000-0000-000000000c15', 'tenant', '2023-10-01', true),
  ('f0000000-0000-0000-0000-000000000c16', 'a0000000-0000-0000-0000-000000000c01', 'c0000000-0000-0000-0000-000000000c0f', 'd0000000-0000-0000-0000-000000000c02', 'e0000000-0000-0000-0000-000000000c15', 'tenant', '2023-10-01', false),
  ('f0000000-0000-0000-0000-000000000c17', 'a0000000-0000-0000-0000-000000000c01', 'c0000000-0000-0000-0000-000000000c10', 'd0000000-0000-0000-0000-000000000c02', 'e0000000-0000-0000-0000-000000000c16', 'tenant', '1985-04-01', true);

-- Reichenhainer Eigentümer
insert into contact_roles (id, tenant_id, contact_id, property_id, unit_id, role, valid_from, is_primary) values
  ('f0000000-0000-0000-0000-000000000c20', 'a0000000-0000-0000-0000-000000000c01', 'c0000000-0000-0000-0000-000000000c11', 'd0000000-0000-0000-0000-000000000c03', 'e0000000-0000-0000-0000-000000000c21', 'owner', '2014-08-01', true),
  ('f0000000-0000-0000-0000-000000000c21', 'a0000000-0000-0000-0000-000000000c01', 'c0000000-0000-0000-0000-000000000c11', 'd0000000-0000-0000-0000-000000000c03', 'e0000000-0000-0000-0000-000000000c22', 'owner', '2016-06-01', true),
  ('f0000000-0000-0000-0000-000000000c22', 'a0000000-0000-0000-0000-000000000c01', 'c0000000-0000-0000-0000-000000000c12', 'd0000000-0000-0000-0000-000000000c03', 'e0000000-0000-0000-0000-000000000c23', 'owner', '2010-01-01', true),
  ('f0000000-0000-0000-0000-000000000c23', 'a0000000-0000-0000-0000-000000000c01', 'c0000000-0000-0000-0000-000000000c12', 'd0000000-0000-0000-0000-000000000c03', 'e0000000-0000-0000-0000-000000000c24', 'owner', '2010-01-01', true);

-- Reichenhainer Mieter
insert into contact_roles (id, tenant_id, contact_id, property_id, unit_id, role, valid_from, is_primary) values
  ('f0000000-0000-0000-0000-000000000c24', 'a0000000-0000-0000-0000-000000000c01', 'c0000000-0000-0000-0000-000000000c13', 'd0000000-0000-0000-0000-000000000c03', 'e0000000-0000-0000-0000-000000000c21', 'tenant', '2023-10-01', true),
  ('f0000000-0000-0000-0000-000000000c25', 'a0000000-0000-0000-0000-000000000c01', 'c0000000-0000-0000-0000-000000000c14', 'd0000000-0000-0000-0000-000000000c03', 'e0000000-0000-0000-0000-000000000c22', 'tenant', '2024-04-01', true);

-- Klosterstr. Eigentümer + Gewerbemieter
insert into contact_roles (id, tenant_id, contact_id, property_id, role, valid_from, is_primary) values
  ('f0000000-0000-0000-0000-000000000c30', 'a0000000-0000-0000-0000-000000000c01', 'c0000000-0000-0000-0000-000000000c12', 'd0000000-0000-0000-0000-000000000c04', 'owner', '2005-12-01', true);

insert into contact_roles (id, tenant_id, contact_id, property_id, unit_id, role, valid_from, is_primary) values
  ('f0000000-0000-0000-0000-000000000c31', 'a0000000-0000-0000-0000-000000000c01', 'c0000000-0000-0000-0000-000000000c15', 'd0000000-0000-0000-0000-000000000c04', 'e0000000-0000-0000-0000-000000000c31', 'tenant', '2018-05-01', true),
  ('f0000000-0000-0000-0000-000000000c32', 'a0000000-0000-0000-0000-000000000c01', 'c0000000-0000-0000-0000-000000000c16', 'd0000000-0000-0000-0000-000000000c04', 'e0000000-0000-0000-0000-000000000c32', 'tenant', '2012-09-01', true);

-- Dienstleister
insert into contact_roles (id, tenant_id, contact_id, property_id, role, valid_from, is_primary, metadata) values
  ('f0000000-0000-0000-0000-000000000c40', 'a0000000-0000-0000-0000-000000000c01', 'c0000000-0000-0000-0000-000000000c17', 'd0000000-0000-0000-0000-000000000c01', 'caretaker', '2018-01-01', true, '{"scope":"Hausmeister komplett, 2x/Woche"}'),
  ('f0000000-0000-0000-0000-000000000c41', 'a0000000-0000-0000-0000-000000000c01', 'c0000000-0000-0000-0000-000000000c17', 'd0000000-0000-0000-0000-000000000c02', 'caretaker', '2020-06-01', true, '{"scope":"Hausmeister komplett, 1x/Woche"}'),
  ('f0000000-0000-0000-0000-000000000c42', 'a0000000-0000-0000-0000-000000000c01', 'c0000000-0000-0000-0000-000000000c18', 'd0000000-0000-0000-0000-000000000c01', 'service_provider', '2015-03-01', true, '{"scope":"Heizungswartung & Notdienst 24/7"}'),
  ('f0000000-0000-0000-0000-000000000c43', 'a0000000-0000-0000-0000-000000000c01', 'c0000000-0000-0000-0000-000000000c18', 'd0000000-0000-0000-0000-000000000c02', 'service_provider', '2017-09-01', true, '{"scope":"Heizungswartung & Notdienst 24/7"}');


-- ============================================================
-- VERTRÄGE
-- ============================================================

-- WEG-Verwaltung
insert into contracts (id, tenant_id, contact_role_id, type, start_date, notice_period_months, hausgeld) values
  ('aa000000-0000-0000-0000-000000000c01', 'a0000000-0000-0000-0000-000000000c01', 'f0000000-0000-0000-0000-000000000c01', 'management_weg', '2020-01-01', 6, 312.00),
  ('aa000000-0000-0000-0000-000000000c02', 'a0000000-0000-0000-0000-000000000c01', 'f0000000-0000-0000-0000-000000000c20', 'management_weg', '2018-04-01', 6, 198.00);

-- Mietverwaltungs-Vertrag (Hainstr.)
insert into contracts (id, tenant_id, contact_role_id, type, start_date, notice_period_months) values
  ('aa000000-0000-0000-0000-000000000c03', 'a0000000-0000-0000-0000-000000000c01', 'f0000000-0000-0000-0000-000000000c10', 'management_mv', '2015-01-01', 12);

-- Mietverträge Hainstr.
insert into contracts (id, tenant_id, contact_role_id, type, start_date, cold_rent, operating_costs_prepayment, heating_costs_prepayment, deposit_amount, deposit_type) values
  ('aa000000-0000-0000-0000-000000000c04', 'a0000000-0000-0000-0000-000000000c01', 'f0000000-0000-0000-0000-000000000c11', 'rental_residential', '2019-09-01', 525.00, 95.00, 75.00, 1575.00, 'Barkaution'),
  ('aa000000-0000-0000-0000-000000000c05', 'a0000000-0000-0000-0000-000000000c01', 'f0000000-0000-0000-0000-000000000c12', 'rental_residential', '2021-01-15', 480.00, 85.00, 65.00, 1440.00, 'Barkaution'),
  ('aa000000-0000-0000-0000-000000000c06', 'a0000000-0000-0000-0000-000000000c01', 'f0000000-0000-0000-0000-000000000c13', 'rental_residential', '2010-03-01', 460.00, 95.00, 75.00, 1380.00, 'Barkaution'),
  ('aa000000-0000-0000-0000-000000000c07', 'a0000000-0000-0000-0000-000000000c01', 'f0000000-0000-0000-0000-000000000c14', 'rental_residential', '2020-07-01', 490.00, 85.00, 65.00, 1470.00, 'Bürgschaft'),
  ('aa000000-0000-0000-0000-000000000c08', 'a0000000-0000-0000-0000-000000000c01', 'f0000000-0000-0000-0000-000000000c15', 'rental_residential', '2023-10-01', 720.00, 110.00, 90.00, 2160.00, 'Barkaution'),
  ('aa000000-0000-0000-0000-000000000c09', 'a0000000-0000-0000-0000-000000000c01', 'f0000000-0000-0000-0000-000000000c17', 'rental_residential', '1985-04-01', 285.00, 65.00, 55.00, 855.00, 'Sparbuch');

-- Mietverträge Reichenhainer
insert into contracts (id, tenant_id, contact_role_id, type, start_date, cold_rent, operating_costs_prepayment, heating_costs_prepayment, deposit_amount, deposit_type) values
  ('aa000000-0000-0000-0000-000000000c0a', 'a0000000-0000-0000-0000-000000000c01', 'f0000000-0000-0000-0000-000000000c24', 'rental_residential', '2023-10-01', 510.00, 95.00, 80.00, 1530.00, 'Barkaution'),
  ('aa000000-0000-0000-0000-000000000c0b', 'a0000000-0000-0000-0000-000000000c01', 'f0000000-0000-0000-0000-000000000c25', 'rental_residential', '2024-04-01', 525.00, 95.00, 80.00, 1575.00, 'Barkaution');

-- Gewerbemietverträge Klosterstr.
insert into contracts (id, tenant_id, contact_role_id, type, start_date, end_date, is_fixed_term, cold_rent, operating_costs_prepayment, heating_costs_prepayment, deposit_amount, deposit_type) values
  ('aa000000-0000-0000-0000-000000000c0c', 'a0000000-0000-0000-0000-000000000c01', 'f0000000-0000-0000-0000-000000000c31', 'rental_commercial', '2018-05-01', '2028-04-30', true, 1850.00, 280.00, 180.00, 5550.00, 'Bürgschaft'),
  ('aa000000-0000-0000-0000-000000000c0d', 'a0000000-0000-0000-0000-000000000c01', 'f0000000-0000-0000-0000-000000000c32', 'rental_commercial', '2012-09-01', null, false, 1620.00, 250.00, 165.00, 4860.00, 'Bürgschaft');


-- ============================================================
-- BANKVERBINDUNGEN
-- ============================================================

insert into bank_accounts (id, tenant_id, contact_id, iban, bic, account_holder, sepa_mandate_reference, sepa_mandate_date, sepa_mandate_status) values
  ('b0000000-0000-0000-0000-000000000c01', 'a0000000-0000-0000-0000-000000000c01', 'c0000000-0000-0000-0000-000000000c01', 'DE87870500003012345678', 'CHEKDE81XXX', 'Dr. Andreas Petzold', 'SEPA-PETZOLD-2020', '2020-01-15', 'active'),
  ('b0000000-0000-0000-0000-000000000c02', 'a0000000-0000-0000-0000-000000000c01', 'c0000000-0000-0000-0000-000000000c02', 'DE32870500003011112222', 'CHEKDE81XXX', 'Sabine Hoffmann', 'SEPA-HOFFMANN-2020', '2020-02-01', 'active'),
  ('b0000000-0000-0000-0000-000000000c03', 'a0000000-0000-0000-0000-000000000c01', 'c0000000-0000-0000-0000-000000000c0a', 'DE45120300001234567891', 'BYLADEM1001', 'Andreas Müller', 'SEPA-MUELLER-2019', '2019-09-01', 'active'),
  ('b0000000-0000-0000-0000-000000000c04', 'a0000000-0000-0000-0000-000000000c01', 'c0000000-0000-0000-0000-000000000c09', 'DE19850503000123456000', 'OSDDDE81XXX', 'Bauer Vermögensverwaltung KG', null, null, null);


-- ============================================================
-- VORGÄNGE
-- ============================================================

insert into tickets (id, tenant_id, contact_id, unit_id, property_id, title, description, category, status, priority, created_at) values
  ('bb000000-0000-0000-0000-000000000c01',
   'a0000000-0000-0000-0000-000000000c01',
   'c0000000-0000-0000-0000-000000000c08',
   'e0000000-0000-0000-0000-000000000c04',
   'd0000000-0000-0000-0000-000000000c01',
   'Heizungsausfall W04 – komplett kalt',
   'Seit 06.05. abend heizt W04 nicht mehr. Heizkörper bleiben kalt, Vorlauf rauscht. Außentemperatur in Chemnitz 4°C. Familie mit Kleinkind. ChemnitzWärme verständigen.',
   'Heizung', 'in_progress', 'urgent',
   '2026-05-07T07:42:00+02:00'),
  ('bb000000-0000-0000-0000-000000000c02',
   'a0000000-0000-0000-0000-000000000c01',
   'c0000000-0000-0000-0000-000000000c0b',
   'e0000000-0000-0000-0000-000000000c12',
   'd0000000-0000-0000-0000-000000000c02',
   'Wasserfleck Decke Bad M02',
   'Nasse Stelle an der Badezimmerdecke M02. Vermutlich Leitung von M03 darüber. Frau Becker hört nachts Tropfgeräusch. Hausmeister Schulze prüft.',
   'Schadensmeldung', 'in_progress', 'high',
   '2026-05-03T14:20:00+02:00'),
  ('bb000000-0000-0000-0000-000000000c03',
   'a0000000-0000-0000-0000-000000000c01',
   'c0000000-0000-0000-0000-000000000c06',
   'e0000000-0000-0000-0000-000000000c06',
   'd0000000-0000-0000-0000-000000000c01',
   'Wiederholter nächtlicher Lärm aus W04',
   'Hr. Lehmann (W06) beschwert sich über laute Musik aus W04 (Mieter Sturm) zwischen 23:00 und 02:00, mehrfach in der Vorwoche. Bittet um schriftliche Ermahnung.',
   'Beschwerde', 'new', 'normal',
   '2026-05-04T10:15:00+02:00'),
  ('bb000000-0000-0000-0000-000000000c04',
   'a0000000-0000-0000-0000-000000000c01',
   'c0000000-0000-0000-0000-000000000c0d',
   'e0000000-0000-0000-0000-000000000c14',
   'd0000000-0000-0000-0000-000000000c02',
   'Mietminderung 15% wegen Schimmel im Schlafzimmer',
   'Familie Nguyen meldet Schimmel an der Außenwand des Schlafzimmers (Nordseite). Anwaltsschreiben mit Mietminderung 15% angekündigt. Sachverständigentermin nötig.',
   'Mängelanzeige', 'waiting', 'normal',
   '2026-04-28T16:00:00+02:00'),
  ('bb000000-0000-0000-0000-000000000c05',
   'a0000000-0000-0000-0000-000000000c01',
   'c0000000-0000-0000-0000-000000000c05',
   'e0000000-0000-0000-0000-000000000c05',
   'd0000000-0000-0000-0000-000000000c01',
   'Hausgeld-Rückstand W05 (3 Monate)',
   'Frau Sokolova schuldet Hausgeld März-Mai 2026 (3 × 312 € = 936 €). 1. Mahnung am 15.04. versendet, keine Reaktion. 2. Mahnung vorbereiten.',
   'Forderung', 'in_progress', 'normal',
   '2026-04-30T09:00:00+02:00'),
  ('bb000000-0000-0000-0000-000000000c06',
   'a0000000-0000-0000-0000-000000000c01',
   'c0000000-0000-0000-0000-000000000c01',
   null,
   'd0000000-0000-0000-0000-000000000c01',
   'ETV 2026 Kaßbergstr. – Beschlussvorlagen erstellen',
   'Ordentliche Eigentümerversammlung 18.06.2026 in der Kanzlei. Beschlussvorlagen: (1) Jahresabrechnung 2025, (2) Wirtschaftsplan 2026, (3) Sonderumlage Fassadenanstrich (geschätzt 18.000 €), (4) Beiratsneuwahl.',
   'WEG-Versammlung', 'new', 'low',
   '2026-04-25T14:30:00+02:00'),
  ('bb000000-0000-0000-0000-000000000c07',
   'a0000000-0000-0000-0000-000000000c01',
   'c0000000-0000-0000-0000-000000000c0c',
   null,
   'd0000000-0000-0000-0000-000000000c02',
   'Treppenhausbeleuchtung Hainstr. 1.+2. OG defekt',
   'Bewegungsmelder reagiert nicht. Hr. Pötzsch im Dunkeln auf Treppe. Schulze beauftragt.',
   'Reparatur', 'resolved', 'low',
   '2026-04-22T18:45:00+02:00'),
  ('bb000000-0000-0000-0000-000000000c08',
   'a0000000-0000-0000-0000-000000000c01',
   'c0000000-0000-0000-0000-000000000c02',
   null,
   'd0000000-0000-0000-0000-000000000c01',
   'Sperrmüll im Hof Kaßbergstr.',
   'Frau Hoffmann meldet, dass jemand alte Möbel im Innenhof abgestellt hat. Verursacher unbekannt. Entsorgung beauftragen, Kosten ggf. umlegen.',
   'Hausordnung', 'new', 'normal',
   '2026-05-05T11:00:00+02:00'),
  ('bb000000-0000-0000-0000-000000000c09',
   'a0000000-0000-0000-0000-000000000c01',
   'c0000000-0000-0000-0000-000000000c11',
   null,
   'd0000000-0000-0000-0000-000000000c03',
   'Telekom Glasfaserausbau Reichenhainer',
   'Telekom plant Glasfaserausbau im Bereich Reichenhainer Str. Eigentümer-Zustimmung erforderlich. Termin mit Telekom-Vertrieb 15.05.',
   'Modernisierung', 'waiting', 'low',
   '2026-04-15T10:00:00+02:00'),
  ('bb000000-0000-0000-0000-000000000c0a',
   'a0000000-0000-0000-0000-000000000c01',
   'c0000000-0000-0000-0000-000000000c15',
   'e0000000-0000-0000-0000-000000000c31',
   'd0000000-0000-0000-0000-000000000c04',
   'Markisenmotor Café defekt',
   'Frau Heidrich meldet, dass die Markise vor dem Café Sächsisch nicht mehr ausfährt. Laut MV § 12 Mietersache. Klärung Kostenträger.',
   'Reparatur', 'closed', 'low',
   '2026-04-10T15:30:00+02:00');

-- resolved_at für erledigte Tickets
update tickets set resolved_at = '2026-04-23T16:00:00+02:00' where id = 'bb000000-0000-0000-0000-000000000c07';
update tickets set resolved_at = '2026-04-12T11:00:00+02:00' where id = 'bb000000-0000-0000-0000-000000000c0a';


-- ============================================================
-- KOMMUNIKATIONEN
-- ============================================================

-- Heizungsausfall (Vorgang 1)
insert into communications (id, tenant_id, contact_id, ticket_id, channel, direction, subject, body, occurred_at) values
  ('cc000000-0000-0000-0000-000000000c01',
   'a0000000-0000-0000-0000-000000000c01',
   'c0000000-0000-0000-0000-000000000c08',
   'bb000000-0000-0000-0000-000000000c01',
   'phone', 'inbound', 'Heizung kalt seit gestern Abend',
   'Hr. Sturm rief 07:35. Wohnung kalt, Kind 2 Jahre. Bittet dringend um Reparatur. Zugesagt: Rückruf nach Kontakt mit ChemnitzWärme.',
   '2026-05-07T07:35:00+02:00'),
  ('cc000000-0000-0000-0000-000000000c02',
   'a0000000-0000-0000-0000-000000000c01',
   'c0000000-0000-0000-0000-000000000c18',
   'bb000000-0000-0000-0000-000000000c01',
   'phone', 'outbound', 'Notdienst Kaßbergstr. 47',
   'Anruf ChemnitzWärme Notdienst, Frau Bach nimmt auf. Techniker innerhalb 4 h vor Ort. Auftragsnr.: CW-2026-0507-12.',
   '2026-05-07T07:50:00+02:00'),
  ('cc000000-0000-0000-0000-000000000c03',
   'a0000000-0000-0000-0000-000000000c01',
   'c0000000-0000-0000-0000-000000000c08',
   'bb000000-0000-0000-0000-000000000c01',
   'email', 'outbound', 'WG: Notdienst beauftragt',
   'Sehr geehrte Familie Sturm,\n\nwie telefonisch besprochen kommt heute zwischen 11 und 13 Uhr ein Techniker von ChemnitzWärme. Bitte zu Hause sein.\n\nAuftragsnummer: CW-2026-0507-12\n\nMit freundlichen Grüßen\nSachsenhaus Verwaltung GmbH',
   '2026-05-07T07:55:00+02:00');

-- Wasserschaden
insert into communications (id, tenant_id, contact_id, ticket_id, channel, direction, subject, body, occurred_at) values
  ('cc000000-0000-0000-0000-000000000c04',
   'a0000000-0000-0000-0000-000000000c01',
   'c0000000-0000-0000-0000-000000000c0b',
   'bb000000-0000-0000-0000-000000000c02',
   'email', 'inbound', 'Wasserfleck im Bad',
   'Hallo, an unserer Badezimmerdecke ist seit gestern ein dunkler Fleck. Heute Morgen feucht. Können Sie das prüfen lassen?\n\nGrüße A. Becker',
   '2026-05-03T14:18:00+02:00'),
  ('cc000000-0000-0000-0000-000000000c05',
   'a0000000-0000-0000-0000-000000000c01',
   'c0000000-0000-0000-0000-000000000c17',
   'bb000000-0000-0000-0000-000000000c02',
   'phone', 'outbound', 'Auftrag Wasserschaden M02',
   'Telefonat Schulze. Termin Hainstr. 23 morgen 9:00, Erstprüfung. Mit Pötzsch (M03) Zugang abklären.',
   '2026-05-03T14:35:00+02:00');

-- Lärmbeschwerde
insert into communications (id, tenant_id, contact_id, ticket_id, channel, direction, subject, body, occurred_at) values
  ('cc000000-0000-0000-0000-000000000c06',
   'a0000000-0000-0000-0000-000000000c01',
   'c0000000-0000-0000-0000-000000000c06',
   'bb000000-0000-0000-0000-000000000c03',
   'letter', 'inbound', 'Ruhestörung W04',
   'Schriftliche Beschwerde von Hr. Lehmann mit Datum/Uhrzeit-Liste. Auszug aus seinem Kalender mit 5 Vorfällen letzte Woche. Bittet um Ermahnung an Familie Sturm.',
   '2026-05-04T10:15:00+02:00');

-- Mietminderung Schimmel
insert into communications (id, tenant_id, contact_id, ticket_id, channel, direction, subject, body, occurred_at) values
  ('cc000000-0000-0000-0000-000000000c07',
   'a0000000-0000-0000-0000-000000000c01',
   'c0000000-0000-0000-0000-000000000c0d',
   'bb000000-0000-0000-0000-000000000c04',
   'letter', 'inbound', 'Schimmelmängelanzeige & Mietminderung',
   'Anwaltsschreiben Kanzlei Lemke (vertritt Familie Nguyen). Mängelanzeige nach § 536 BGB. Mietminderung 15% rückwirkend ab März 2026. Frist zur Mangelbeseitigung 14 Tage.',
   '2026-04-28T15:45:00+02:00'),
  ('cc000000-0000-0000-0000-000000000c08',
   'a0000000-0000-0000-0000-000000000c01',
   'c0000000-0000-0000-0000-000000000c09',
   'bb000000-0000-0000-0000-000000000c04',
   'email', 'outbound', 'Mängelanzeige Hainstr. M04 – Eigentümerinformation',
   'Sehr geehrte Damen und Herren,\n\nwir informieren Sie über eine Mängelanzeige bzgl. Wohnung M04 (Familie Nguyen). Schimmel an der Außenwand Schlafzimmer. Anwaltsschreiben mit Mietminderung 15% liegt vor.\n\nWir empfehlen einen Sachverständigentermin (~600 € Kosten).\n\nMit freundlichen Grüßen',
   '2026-04-29T09:00:00+02:00');

-- Hausgeld-Rückstand
insert into communications (id, tenant_id, contact_id, ticket_id, channel, direction, subject, body, occurred_at) values
  ('cc000000-0000-0000-0000-000000000c09',
   'a0000000-0000-0000-0000-000000000c01',
   'c0000000-0000-0000-0000-000000000c05',
   'bb000000-0000-0000-0000-000000000c05',
   'letter', 'outbound', '1. Mahnung Hausgeld März-April',
   'Erste Mahnung per Einschreiben am 15.04.2026. Forderung 624,00 € + 5,00 € Mahngebühr. Frist 14 Tage.',
   '2026-04-15T11:00:00+02:00');

-- Treppenhauslicht
insert into communications (id, tenant_id, contact_id, ticket_id, channel, direction, subject, body, occurred_at) values
  ('cc000000-0000-0000-0000-000000000c0a',
   'a0000000-0000-0000-0000-000000000c01',
   'c0000000-0000-0000-0000-000000000c0c',
   'bb000000-0000-0000-0000-000000000c07',
   'phone', 'inbound', 'Treppenhauslicht geht nicht',
   'Hr. Pötzsch meldet defekten Bewegungsmelder. Auftrag an Schulze. 24 h später behoben (Sensor + 2 LED-Lampen, 47 €).',
   '2026-04-22T18:45:00+02:00');

-- Café-Markise
insert into communications (id, tenant_id, contact_id, ticket_id, channel, direction, subject, body, occurred_at) values
  ('cc000000-0000-0000-0000-000000000c0b',
   'a0000000-0000-0000-0000-000000000c01',
   'c0000000-0000-0000-0000-000000000c15',
   'bb000000-0000-0000-0000-000000000c0a',
   'meeting', 'inbound', 'Vor-Ort-Termin Markise Café',
   'Persönlicher Termin mit Frau Heidrich. Klärung: Markise gehört nach MV § 12 zur Mietsache, Reparatur Mietersache. Frau Heidrich beauftragt Markisenfirma Lehnert direkt. Erledigt.',
   '2026-04-12T10:30:00+02:00');

-- Glasfaser
insert into communications (id, tenant_id, contact_id, ticket_id, channel, direction, subject, body, occurred_at) values
  ('cc000000-0000-0000-0000-000000000c0c',
   'a0000000-0000-0000-0000-000000000c01',
   'c0000000-0000-0000-0000-000000000c11',
   'bb000000-0000-0000-0000-000000000c09',
   'email', 'inbound', 'Telekom Glasfaserausbau – Zustimmung Eigentümer',
   'Frau Dr. Walter fragt nach dem Stand des Telekom-Termins. Würde der Glasfaserverlegung zustimmen, möchte aber wissen, ob WGS Chemnitz ebenfalls unterschreibt.',
   '2026-04-25T16:20:00+02:00');

-- Standalone-Kommunikation (kein Ticket)
insert into communications (id, tenant_id, contact_id, channel, direction, subject, body, occurred_at) values
  ('cc000000-0000-0000-0000-000000000c0d',
   'a0000000-0000-0000-0000-000000000c01',
   'c0000000-0000-0000-0000-000000000c09',
   'phone', 'inbound', 'M01 nach Auszug Müller frei?',
   'Bauer KG fragt, ob Familie Müller wirklich kündigt. Stand: Kündigung zum 31.07.2026 vorgemerkt. Nachmietersuche soll Anfang Juni starten.',
   '2026-05-02T11:00:00+02:00');


-- ============================================================
-- USER MIT TENANT VERKNÜPFEN
-- ============================================================
-- Damit du diese Daten in der App siehst, musst du eingeloggt sein
-- und folgenden Befehl manuell ausführen (NACH erfolgreicher Registrierung):
--
-- update profiles
-- set tenant_id = 'a0000000-0000-0000-0000-000000000c01',
--     role = 'tenant_admin'
-- where id = auth.uid();
--
-- Oder direkt mit deiner User-ID (zu finden über: select id from auth.users):
--
-- update profiles
-- set tenant_id = 'a0000000-0000-0000-0000-000000000c01',
--     role = 'tenant_admin'
-- where id = 'DEINE-USER-ID-HIER';
