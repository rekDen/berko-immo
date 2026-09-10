-- ============================================================
-- CRM Seed-Daten
-- 1 Tenant, 3 Kontakte, 1 WEG-Objekt, 2 Einheiten,
-- Rollen (Eigentümer, Mieter, Beirat), 2 Verträge, 1 Ticket
-- ============================================================

-- Tenant
insert into tenants (id, name, slug) values
  ('a0000000-0000-0000-0000-000000000001', 'Hausverwaltung Müller GmbH', 'mueller-hv');

-- Kontakt 1: Eigentümer (natürliche Person)
insert into contacts (id, tenant_id, type, salutation, first_name, last_name, language, emails, phones, addresses) values
  ('c0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001',
   'natural_person', 'herr', 'Klaus', 'Bergmann', 'de',
   '[{"type":"private","value":"k.bergmann@example.de"}]',
   '[{"type":"mobile","value":"+4917612345678"}]',
   '[{"type":"residential","street":"Hauptstraße","house_number":"12","zip_code":"10115","city":"Berlin","country":"DE"}]'
  );

-- Kontakt 2: Eigentümerin + Beirätin (natürliche Person)
insert into contacts (id, tenant_id, type, salutation, first_name, last_name, language, emails, phones, addresses) values
  ('c0000000-0000-0000-0000-000000000002',
   'a0000000-0000-0000-0000-000000000001',
   'natural_person', 'frau', 'Anna', 'Petrov', 'ru',
   '[{"type":"private","value":"a.petrov@example.de"}]',
   '[{"type":"mobile","value":"+4915198765432"}]',
   '[{"type":"residential","street":"Schönhauser Allee","house_number":"45","zip_code":"10437","city":"Berlin","country":"DE"}]'
  );

-- Kontakt 3: Mieter (natürliche Person)
insert into contacts (id, tenant_id, type, salutation, first_name, last_name, language, emails, phones, addresses) values
  ('c0000000-0000-0000-0000-000000000003',
   'a0000000-0000-0000-0000-000000000001',
   'natural_person', 'herr', 'Thomas', 'Weber', 'de',
   '[{"type":"private","value":"t.weber@example.de"},{"type":"business","value":"weber@firma.de"}]',
   '[{"type":"mobile","value":"+4917655443322"},{"type":"landline","value":"+493012345600"}]',
   '[{"type":"residential","street":"Kastanienallee","house_number":"7a","zip_code":"10435","city":"Berlin","country":"DE"}]'
  );

-- Property: WEG-Objekt
insert into properties (id, tenant_id, name, street, house_number, zip_code, city, type, year_built, total_area, unit_count) values
  ('d0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001',
   'Kastanienallee 7a', 'Kastanienallee', '7a', '10435', 'Berlin',
   'weg', 1928, 320.50, 6
  );

-- Unit 1: Wohnung W01 (Eigentümer Bergmann)
insert into units (id, tenant_id, property_id, unit_number, floor, type, area, room_count, mea, heating_type) values
  ('e0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001',
   'd0000000-0000-0000-0000-000000000001',
   'W01', '1. OG links', 'apartment', 85.30, 3, 152.5000, 'Zentralheizung Gas'
  );

-- Unit 2: Wohnung W02 (Eigentümerin Petrov, vermietet an Weber)
insert into units (id, tenant_id, property_id, unit_number, floor, type, area, room_count, mea, heating_type) values
  ('e0000000-0000-0000-0000-000000000002',
   'a0000000-0000-0000-0000-000000000001',
   'd0000000-0000-0000-0000-000000000001',
   'W02', '1. OG rechts', 'apartment', 72.00, 2.5, 128.0000, 'Zentralheizung Gas'
  );

-- Rolle: Bergmann = Eigentümer von W01
insert into contact_roles (id, tenant_id, contact_id, property_id, unit_id, role, valid_from, is_primary) values
  ('f0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001',
   'd0000000-0000-0000-0000-000000000001',
   'e0000000-0000-0000-0000-000000000001',
   'owner', '2018-06-01', true
  );

-- Rolle: Petrov = Eigentümerin von W02
insert into contact_roles (id, tenant_id, contact_id, property_id, unit_id, role, valid_from, is_primary) values
  ('f0000000-0000-0000-0000-000000000002',
   'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000002',
   'd0000000-0000-0000-0000-000000000001',
   'e0000000-0000-0000-0000-000000000002',
   'owner', '2020-03-15', true
  );

-- Rolle: Petrov = Beirätin des Objekts
insert into contact_roles (id, tenant_id, contact_id, property_id, unit_id, role, valid_from, is_primary) values
  ('f0000000-0000-0000-0000-000000000003',
   'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000002',
   'd0000000-0000-0000-0000-000000000001',
   null,
   'beirat', '2023-01-01', true
  );

-- Rolle: Weber = Mieter von W02
insert into contact_roles (id, tenant_id, contact_id, property_id, unit_id, role, valid_from, is_primary) values
  ('f0000000-0000-0000-0000-000000000004',
   'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000003',
   'd0000000-0000-0000-0000-000000000001',
   'e0000000-0000-0000-0000-000000000002',
   'tenant', '2021-07-01', true
  );

-- Vertrag 1: WEG-Verwaltungsvertrag (Objekt-Ebene, Rolle Bergmann als Referenz)
insert into contracts (id, tenant_id, contact_role_id, type, start_date, notice_period_months, hausgeld) values
  ('aa000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000001',
   'management_weg', '2019-01-01', 6, 285.00
  );

-- Vertrag 2: Mietvertrag Weber in W02
insert into contracts (id, tenant_id, contact_role_id, type, start_date, cold_rent, operating_costs_prepayment, heating_costs_prepayment, deposit_amount, deposit_type) values
  ('aa000000-0000-0000-0000-000000000002',
   'a0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000004',
   'rental_residential', '2021-07-01', 680.00, 120.00, 85.00, 2040.00, 'Barkaution'
  );

-- Bankverbindung Bergmann
insert into bank_accounts (id, tenant_id, contact_id, iban, bic, account_holder, sepa_mandate_reference, sepa_mandate_date, sepa_mandate_status) values
  ('b0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001',
   'DE89370400440532013000', 'COBADEFFXXX', 'Klaus Bergmann',
   'SEPA-2019-001', '2019-01-15', 'active'
  );

-- Ticket: Schadensmeldung Weber (Wasserschaden in W02)
insert into tickets (id, tenant_id, contact_id, unit_id, property_id, title, description, category, status, priority) values
  ('bb000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000003',
   'e0000000-0000-0000-0000-000000000002',
   'd0000000-0000-0000-0000-000000000001',
   'Wasserschaden Badezimmer W02',
   'Undichte Stelle an der Badezimmerdecke, Wasser tropft bei Regen. Bitte um schnelle Besichtigung.',
   'Schadensmeldung', 'new', 'high'
  );

-- Kommunikation: E-Mail zum Ticket
insert into communications (id, tenant_id, contact_id, ticket_id, channel, direction, subject, body, occurred_at) values
  ('cc000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000003',
   'bb000000-0000-0000-0000-000000000001',
   'email', 'inbound',
   'Wasserschaden im Bad',
   'Sehr geehrte Hausverwaltung, seit gestern tropft Wasser von der Decke im Badezimmer. Die Stelle befindet sich direkt über der Dusche. Bitte veranlassen Sie eine zeitnahe Besichtigung. Mit freundlichen Grüßen, Thomas Weber',
   '2026-05-01T09:15:00+02:00'
  );
