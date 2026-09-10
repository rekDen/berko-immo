-- ============================================================
-- Testdaten: Termine & Fristen pro Objekt
-- ============================================================
-- Voraussetzung: deadlines.property_id existiert (migration-deadlines-property.sql)
-- und seed-chemnitz.sql / seed-chemnitz-daniel.sql sind ausgeführt.
--
-- Erzeugt 3–5 hausverwaltungsrelevante Einträge pro Objekt
-- für beide Demo-Tenants.
-- ============================================================


-- ============================================================
-- Tenant: Sachsenhaus Verwaltung GmbH (seed-chemnitz)
-- a0000000-0000-0000-0000-000000000c01
-- ============================================================

-- ---------- WEG Kaßbergstraße 47 (5 Einträge) ----------
insert into deadlines (id, tenant_id, property_id, az, date, title, description, type, location, assigned_to, completed) values
  ('ee000000-0000-0000-0000-00000c011001', 'a0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c01',
   'WEG-2026-001', '2026-06-18', 'Ordentliche Eigentümerversammlung 2026',
   'Jahres-ETV mit Beschluss über Jahresabrechnung 2025, Wirtschaftsplan 2026 und Sonderumlage Fassadenanstrich.',
   'termin', 'Kanzleiräume Sachsenhaus Verwaltung, Theaterstraße 3', 'Verwaltung + Beirat', false),
  ('ee000000-0000-0000-0000-00000c011002', 'a0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c01',
   'WART-2026-014', '2026-09-12', 'Heizungs-Jahreswartung',
   'Wartung der Gas-Zentralheizung durch ChemnitzWärme GmbH gemäß Wartungsvertrag.',
   'termin', 'Heizraum Keller', 'ChemnitzWärme GmbH', false),
  ('ee000000-0000-0000-0000-00000c011003', 'a0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c01',
   'SCHO-2026-007', '2026-10-05', 'Schornsteinfeger – Feuerstättenschau',
   'Pflichtige Feuerstättenschau nach KÜO §15.', 'termin',
   'Heizraum + Steigschacht', 'Bezirksschornsteinfeger Müller', false),
  ('ee000000-0000-0000-0000-00000c011004', 'a0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c01',
   'FRIST-2026-018', '2026-07-18', 'Anfechtungsfrist ETV-Beschlüsse',
   'Frist von einem Monat nach Beschlussfassung gem. § 45 WEG. ETV vom 18.06.2026.',
   'frist', '', 'Verwaltung', false),
  ('ee000000-0000-0000-0000-00000c011005', 'a0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c01',
   'BEIRAT-2026-002', '2026-05-22', 'Beiratsbegehung – Fassadenplanung',
   'Vor-Ort-Termin mit Vorsitzendem Petzold und Stellv. Lehmann zur Vorabstimmung des Sanierungsumfangs.',
   'termin', 'Hofzugang Kaßbergstr. 47', 'Verwaltung + Beirat', false);

-- ---------- Miethaus Hainstraße 23 (4 Einträge) ----------
insert into deadlines (id, tenant_id, property_id, az, date, title, description, type, location, assigned_to, completed) values
  ('ee000000-0000-0000-0000-00000c022001', 'a0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c02',
   'BEG-2026-005', '2026-06-04', 'Begehung mit Eigentümerin Bauer KG',
   'Halbjährliche Objektbegehung gemäß MV-Verwaltungsvertrag, Prioritäten-Abgleich Fassadensanierung.',
   'termin', 'Hainstr. 23, vor Ort', 'Verwaltung + Bauer KG', false),
  ('ee000000-0000-0000-0000-00000c022002', 'a0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c02',
   'RWM-2026-003', '2026-08-15', 'Rauchmelder-Jahresprüfung',
   'Jährliche Funktions- und Sichtprüfung aller Rauchmelder gem. DIN 14676.',
   'termin', 'Alle Wohneinheiten M01–M06', 'Brandschutz Sachsen GmbH', false),
  ('ee000000-0000-0000-0000-00000c022003', 'a0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c02',
   'FRIST-NK-2025', '2026-12-31', 'Frist Nebenkostenabrechnung 2025',
   'Abrechnungsfrist nach § 556 Abs. 3 BGB – 12 Monate nach Ende des Abrechnungszeitraums.',
   'frist', '', 'Buchhaltung', false),
  ('ee000000-0000-0000-0000-00000c022004', 'a0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c02',
   'HEIZ-2025-A', '2025-12-15', 'Heizkostenverteiler-Ablesung 2025',
   'Jährliche Ablesung durch ista. Termin koordiniert für alle 6 Wohnungen.',
   'termin', 'Alle Mietwohnungen', 'ista Deutschland', true);

-- ---------- WEG Reichenhainer Str. 91 (5 Einträge) ----------
insert into deadlines (id, tenant_id, property_id, az, date, title, description, type, location, assigned_to, completed) values
  ('ee000000-0000-0000-0000-00000c033001', 'a0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c03',
   'WEG-2026-002', '2026-09-26', 'ETV 2026 Reichenhainer',
   'Ordentliche ETV. Schwerpunktthemen: Wirtschaftsplan 2026, Glasfaser-Anschluss, Beiratswahl.',
   'termin', 'Kanzleiräume Sachsenhaus', 'Verwaltung + Eigentümer', false),
  ('ee000000-0000-0000-0000-00000c033002', 'a0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c03',
   'TWV-2026-002', '2026-07-08', 'Legionellenprüfung Trinkwasser',
   'Jährliche systemische Untersuchung auf Legionellen gem. Trinkwasserverordnung.',
   'termin', 'Trinkwasserinstallation Keller', 'AquaLab Sachsen', false),
  ('ee000000-0000-0000-0000-00000c033003', 'a0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c03',
   'TEL-2026-001', '2026-05-15', 'Termin Telekom – Glasfaser-Hausanschluss',
   'Vor-Ort-Termin mit Telekom-Vertrieb zur Klärung der Hausanschlussvereinbarung.',
   'termin', 'Reichenhainer Str. 91', 'Verwaltung + Telekom', false),
  ('ee000000-0000-0000-0000-00000c033004', 'a0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c03',
   'FRIST-WP-2026', '2026-06-30', 'Frist: Wirtschaftsplan 2026 erstellen',
   'Wirtschaftsplan vor ETV verschicken. Mindestens 3 Wochen vor Versammlung.',
   'frist', '', 'Buchhaltung', false),
  ('ee000000-0000-0000-0000-00000c033005', 'a0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c03',
   'WART-FW-2026', '2026-10-22', 'Wartung Fernwärme-Übergabestation',
   'Jahreswartung der eins.energie-Übergabestation.',
   'termin', 'Heizraum', 'eins.energie Sachsen', false);

-- ---------- Geschäftshaus Klosterstraße 8 (4 Einträge) ----------
insert into deadlines (id, tenant_id, property_id, az, date, title, description, type, location, assigned_to, completed) values
  ('ee000000-0000-0000-0000-00000c044001', 'a0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c04',
   'BSCHU-2026-001', '2026-06-12', 'Brandschutz-Abnahme Café G01',
   'Wiederkehrende Brandschutzprüfung der gewerblich genutzten Erdgeschossfläche durch Sachverständigen.',
   'termin', 'Innere Klosterstr. 8 EG', 'Sachverständigenbüro Lehmann', false),
  ('ee000000-0000-0000-0000-00000c044002', 'a0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c04',
   'TUEV-AUF-2026', '2026-07-29', 'TÜV-Hauptprüfung Personenaufzug',
   'Wiederkehrende TÜV-Prüfung gem. Betriebssicherheitsverordnung.',
   'termin', 'Personenaufzug Treppenhaus', 'TÜV SÜD', false),
  ('ee000000-0000-0000-0000-00000c044003', 'a0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c04',
   'FRIST-MV-G02', '2026-06-30', 'Frist Mietanpassung Kanzlei G02',
   'Indexanpassung gem. Mietvertrag § 5 — Mitteilung bis spätestens 30.06. erforderlich.',
   'frist', '', 'Verwaltung', false),
  ('ee000000-0000-0000-0000-00000c044004', 'a0000000-0000-0000-0000-000000000c01', 'd0000000-0000-0000-0000-000000000c04',
   'BEG-MARK-2026', '2026-05-12', 'Begehung Café – Markisenmotor',
   'Nachschau nach Reparatur durch Markisenfirma Lehnert.',
   'termin', 'Café Sächsisch G01', 'Hausmeister Schulze', false);


-- ============================================================
-- Tenant: Sachsenhaus Verwaltung GmbH (Daniel) — seed-chemnitz-daniel
-- a0000000-0000-0000-0000-000000000d01
-- ============================================================

-- ---------- WEG Kaßbergstraße 47 ----------
insert into deadlines (id, tenant_id, property_id, az, date, title, description, type, location, assigned_to, completed) values
  ('ee000000-0000-0000-0000-00000d011001', 'a0000000-0000-0000-0000-000000000d01', 'd0000000-0000-0000-0000-000000000d01',
   'WEG-2026-001', '2026-06-18', 'Ordentliche Eigentümerversammlung 2026',
   'Jahres-ETV mit Beschluss über Jahresabrechnung 2025, Wirtschaftsplan 2026 und Sonderumlage Fassadenanstrich.',
   'termin', 'Kanzleiräume Sachsenhaus Verwaltung, Theaterstraße 3', 'Verwaltung + Beirat', false),
  ('ee000000-0000-0000-0000-00000d011002', 'a0000000-0000-0000-0000-000000000d01', 'd0000000-0000-0000-0000-000000000d01',
   'WART-2026-014', '2026-09-12', 'Heizungs-Jahreswartung',
   'Wartung der Gas-Zentralheizung durch ChemnitzWärme GmbH gemäß Wartungsvertrag.',
   'termin', 'Heizraum Keller', 'ChemnitzWärme GmbH', false),
  ('ee000000-0000-0000-0000-00000d011003', 'a0000000-0000-0000-0000-000000000d01', 'd0000000-0000-0000-0000-000000000d01',
   'SCHO-2026-007', '2026-10-05', 'Schornsteinfeger – Feuerstättenschau',
   'Pflichtige Feuerstättenschau nach KÜO §15.', 'termin',
   'Heizraum + Steigschacht', 'Bezirksschornsteinfeger Müller', false),
  ('ee000000-0000-0000-0000-00000d011004', 'a0000000-0000-0000-0000-000000000d01', 'd0000000-0000-0000-0000-000000000d01',
   'FRIST-2026-018', '2026-07-18', 'Anfechtungsfrist ETV-Beschlüsse',
   'Frist von einem Monat nach Beschlussfassung gem. § 45 WEG. ETV vom 18.06.2026.',
   'frist', '', 'Verwaltung', false),
  ('ee000000-0000-0000-0000-00000d011005', 'a0000000-0000-0000-0000-000000000d01', 'd0000000-0000-0000-0000-000000000d01',
   'BEIRAT-2026-002', '2026-05-22', 'Beiratsbegehung – Fassadenplanung',
   'Vor-Ort-Termin mit Vorsitzendem Petzold und Stellv. Lehmann zur Vorabstimmung des Sanierungsumfangs.',
   'termin', 'Hofzugang Kaßbergstr. 47', 'Verwaltung + Beirat', false);

-- ---------- Miethaus Hainstraße 23 ----------
insert into deadlines (id, tenant_id, property_id, az, date, title, description, type, location, assigned_to, completed) values
  ('ee000000-0000-0000-0000-00000d022001', 'a0000000-0000-0000-0000-000000000d01', 'd0000000-0000-0000-0000-000000000d02',
   'BEG-2026-005', '2026-06-04', 'Begehung mit Eigentümerin Bauer KG',
   'Halbjährliche Objektbegehung gemäß MV-Verwaltungsvertrag, Prioritäten-Abgleich Fassadensanierung.',
   'termin', 'Hainstr. 23, vor Ort', 'Verwaltung + Bauer KG', false),
  ('ee000000-0000-0000-0000-00000d022002', 'a0000000-0000-0000-0000-000000000d01', 'd0000000-0000-0000-0000-000000000d02',
   'RWM-2026-003', '2026-08-15', 'Rauchmelder-Jahresprüfung',
   'Jährliche Funktions- und Sichtprüfung aller Rauchmelder gem. DIN 14676.',
   'termin', 'Alle Wohneinheiten M01–M06', 'Brandschutz Sachsen GmbH', false),
  ('ee000000-0000-0000-0000-00000d022003', 'a0000000-0000-0000-0000-000000000d01', 'd0000000-0000-0000-0000-000000000d02',
   'FRIST-NK-2025', '2026-12-31', 'Frist Nebenkostenabrechnung 2025',
   'Abrechnungsfrist nach § 556 Abs. 3 BGB – 12 Monate nach Ende des Abrechnungszeitraums.',
   'frist', '', 'Buchhaltung', false),
  ('ee000000-0000-0000-0000-00000d022004', 'a0000000-0000-0000-0000-000000000d01', 'd0000000-0000-0000-0000-000000000d02',
   'HEIZ-2025-A', '2025-12-15', 'Heizkostenverteiler-Ablesung 2025',
   'Jährliche Ablesung durch ista. Termin koordiniert für alle 6 Wohnungen.',
   'termin', 'Alle Mietwohnungen', 'ista Deutschland', true);

-- ---------- WEG Reichenhainer Str. 91 ----------
insert into deadlines (id, tenant_id, property_id, az, date, title, description, type, location, assigned_to, completed) values
  ('ee000000-0000-0000-0000-00000d033001', 'a0000000-0000-0000-0000-000000000d01', 'd0000000-0000-0000-0000-000000000d03',
   'WEG-2026-002', '2026-09-26', 'ETV 2026 Reichenhainer',
   'Ordentliche ETV. Schwerpunktthemen: Wirtschaftsplan 2026, Glasfaser-Anschluss, Beiratswahl.',
   'termin', 'Kanzleiräume Sachsenhaus', 'Verwaltung + Eigentümer', false),
  ('ee000000-0000-0000-0000-00000d033002', 'a0000000-0000-0000-0000-000000000d01', 'd0000000-0000-0000-0000-000000000d03',
   'TWV-2026-002', '2026-07-08', 'Legionellenprüfung Trinkwasser',
   'Jährliche systemische Untersuchung auf Legionellen gem. Trinkwasserverordnung.',
   'termin', 'Trinkwasserinstallation Keller', 'AquaLab Sachsen', false),
  ('ee000000-0000-0000-0000-00000d033003', 'a0000000-0000-0000-0000-000000000d01', 'd0000000-0000-0000-0000-000000000d03',
   'TEL-2026-001', '2026-05-15', 'Termin Telekom – Glasfaser-Hausanschluss',
   'Vor-Ort-Termin mit Telekom-Vertrieb zur Klärung der Hausanschlussvereinbarung.',
   'termin', 'Reichenhainer Str. 91', 'Verwaltung + Telekom', false),
  ('ee000000-0000-0000-0000-00000d033004', 'a0000000-0000-0000-0000-000000000d01', 'd0000000-0000-0000-0000-000000000d03',
   'FRIST-WP-2026', '2026-06-30', 'Frist: Wirtschaftsplan 2026 erstellen',
   'Wirtschaftsplan vor ETV verschicken. Mindestens 3 Wochen vor Versammlung.',
   'frist', '', 'Buchhaltung', false),
  ('ee000000-0000-0000-0000-00000d033005', 'a0000000-0000-0000-0000-000000000d01', 'd0000000-0000-0000-0000-000000000d03',
   'WART-FW-2026', '2026-10-22', 'Wartung Fernwärme-Übergabestation',
   'Jahreswartung der eins.energie-Übergabestation.',
   'termin', 'Heizraum', 'eins.energie Sachsen', false);

-- ---------- Geschäftshaus Klosterstraße 8 ----------
insert into deadlines (id, tenant_id, property_id, az, date, title, description, type, location, assigned_to, completed) values
  ('ee000000-0000-0000-0000-00000d044001', 'a0000000-0000-0000-0000-000000000d01', 'd0000000-0000-0000-0000-000000000d04',
   'BSCHU-2026-001', '2026-06-12', 'Brandschutz-Abnahme Café G01',
   'Wiederkehrende Brandschutzprüfung der gewerblich genutzten Erdgeschossfläche durch Sachverständigen.',
   'termin', 'Innere Klosterstr. 8 EG', 'Sachverständigenbüro Lehmann', false),
  ('ee000000-0000-0000-0000-00000d044002', 'a0000000-0000-0000-0000-000000000d01', 'd0000000-0000-0000-0000-000000000d04',
   'TUEV-AUF-2026', '2026-07-29', 'TÜV-Hauptprüfung Personenaufzug',
   'Wiederkehrende TÜV-Prüfung gem. Betriebssicherheitsverordnung.',
   'termin', 'Personenaufzug Treppenhaus', 'TÜV SÜD', false),
  ('ee000000-0000-0000-0000-00000d044003', 'a0000000-0000-0000-0000-000000000d01', 'd0000000-0000-0000-0000-000000000d04',
   'FRIST-MV-G02', '2026-06-30', 'Frist Mietanpassung Kanzlei G02',
   'Indexanpassung gem. Mietvertrag § 5 — Mitteilung bis spätestens 30.06. erforderlich.',
   'frist', '', 'Verwaltung', false),
  ('ee000000-0000-0000-0000-00000d044004', 'a0000000-0000-0000-0000-000000000d01', 'd0000000-0000-0000-0000-000000000d04',
   'BEG-MARK-2026', '2026-05-12', 'Begehung Café – Markisenmotor',
   'Nachschau nach Reparatur durch Markisenfirma Lehnert.',
   'termin', 'Café Sächsisch G01', 'Hausmeister Schulze', false);
