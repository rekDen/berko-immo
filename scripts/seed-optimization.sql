-- ============================================================
-- Seed: Immobilienoptimierung — Maßnahmen-Katalog + Regelwerk Leipzig
-- Idempotent (on conflict). Im Supabase SQL-Editor ausführen
-- NACH scripts/migration-optimization.sql.
-- ============================================================

-- ── Gemeinde Leipzig ──
insert into gemeinde (id, name, bundesland) values
  ('e1000000-0000-0000-0000-000000000001', 'Leipzig', 'Sachsen')
on conflict (id) do update set name = excluded.name, bundesland = excluded.bundesland;

-- ── Maßnahmen-Katalog (Spec §5) ──
insert into massnahme_typ (code, kategorie, klasse, label, param_schema, constraint_codes) values
  ('vergleichsmiete',          'mietertrag',  'quick_win', 'Anhebung auf Vergleichsmiete',        '{"zielmiete_eur_qm":"number"}',                          array['kappungsgrenze','mietspiegel']),
  ('index_umstellung',         'mietertrag',  'quick_win', 'Umstellung auf Indexmiete',           '{"index_pct":"number"}',                                 array['index_deckel']),
  ('staffel_umstellung',       'mietertrag',  'quick_win', 'Umstellung auf Staffelmiete',         '{"staffeln":"array"}',                                   array['mietpreisbremse']),
  ('neuvermietung_sanierung',  'mietertrag',  'capex',     'Neuvermietung nach Sanierung',        '{"zielklientel":"string","capex_eur":"number","zielmiete_eur_qm":"number"}', array['mietpreisbremse','zwevs']),
  ('modernisierung',           'mietertrag',  'capex',     'Modernisierung (§559-Umlage)',        '{"capex_eur":"number","umlage_pct":"number","wohnflaeche_qm":"number","ausgangsmiete_eur_qm":"number"}', array['modernisierung_deckel','milieuschutz']),
  ('stellplatz_anlegen',       'zusatzerloes','quick_win', 'Stellplätze anlegen',                 '{"menge":"number","miete_pm_eur":"number","invest_eur":"number"}', array['baurecht']),
  ('werbeflaeche_giebel',      'zusatzerloes','quick_win', 'Werbefläche Giebel',                  '{"miete_pa_eur":"number"}',                              array['denkmal']),
  ('dachpacht_mobilfunk',      'zusatzerloes','quick_win', 'Dachpacht Mobilfunk',                 '{"pacht_pa_eur":"number"}',                              array['baurecht','statik']),
  ('pv_dachpacht',             'zusatzerloes','capex',     'PV-Dachpacht',                        '{"kwp":"number","capex_eur":"number","pacht_pa_eur":"number"}', array['baurecht']),
  ('pv_mieterstrom',           'zusatzerloes','capex',     'PV-Mieterstrom',                      '{"kwp":"number","capex_eur":"number","ertrag_pa_eur":"number"}', array['baurecht']),
  ('kellerlager',              'zusatzerloes','quick_win', 'Kellerlager vermieten',               '{"menge":"number","miete_pm_eur":"number"}',             array[]::text[]),
  ('fahrradbox',               'zusatzerloes','quick_win', 'Fahrradboxen',                        '{"menge":"number","miete_pm_eur":"number"}',             array[]::text[]),
  ('muenzwaschraum',           'zusatzerloes','quick_win', 'Münzwaschraum',                       '{"ertrag_pa_eur":"number","invest_eur":"number"}',       array[]::text[]),
  ('garten_parzelle',          'zusatzerloes','quick_win', 'Gartenparzellen',                     '{"menge":"number","miete_pm_eur":"number"}',             array['baurecht']),
  ('container_stellplatz',     'zusatzerloes','quick_win', 'Container-Stellplätze',               '{"menge":"number","miete_pm_eur":"number"}',             array['baurecht']),
  ('dg_ausbau',                'flaeche',     'capex',     'Dachgeschoss-Ausbau',                 '{"neue_flaeche_qm":"number","baukosten_qm_eur":"number","zielmiete_eur_qm":"number"}', array['baurecht','denkmal']),
  ('souterrain_ausbau',        'flaeche',     'capex',     'Souterrain-Ausbau',                   '{"neue_flaeche_qm":"number","baukosten_qm_eur":"number","zielmiete_eur_qm":"number"}', array['baurecht','denkmal']),
  ('grundriss_teilen',         'flaeche',     'capex',     'Grundriss teilen',                    '{"aus_einheit":"string","neue_einheiten":"number","invest_eur":"number","zusatzmiete_pa_eur":"number"}', array['baurecht']),
  ('balkonanbau',              'flaeche',     'capex',     'Balkonanbau',                         '{"menge":"number","kosten_eur":"number","zusatzmiete_pa_eur":"number"}', array['baurecht','statik']),
  ('umwidmung_gewerbe_wohnen', 'flaeche',     'capex',     'Umwidmung Gewerbe → Wohnen',          '{"flaeche_qm":"number","invest_eur":"number","zielmiete_eur_qm":"number"}', array['baurecht','milieuschutz']),
  ('nachverdichtung',          'flaeche',     'capex',     'Nachverdichtung',                     '{"neues_baufeld_qm":"number","invest_eur":"number","ertrag_pa_eur":"number"}', array['baurecht','grz_gfz']),
  ('aufteilung_etw',           'flaeche',     'capex',     'Aufteilung in ETW',                   '{"global_faktor":"number","einzel_faktor":"number","splitkosten_eur":"number"}', array['umwandlungsverordnung','weg']),
  ('betriebskosten_buendeln',  'kosten',      'quick_win', 'Betriebskosten bündeln',              '{"einsparung_pa_eur":"number"}',                         array[]::text[]),
  ('versorgerwechsel',         'kosten',      'quick_win', 'Versorgerwechsel',                    '{"einsparung_pa_eur":"number"}',                         array[]::text[]),
  ('leerstandsabbau',          'kosten',      'quick_win', 'Leerstandsabbau',                     '{"miete_pa_eur":"number"}',                              array[]::text[]),
  ('refinanzierung',           'kosten',      'quick_win', 'Refinanzierung',                      '{"darlehen_eur":"number","alt_zins_pct":"number","neu_zins_pct":"number"}', array[]::text[]),
  ('standardpaket_rollout',    'portfolio',   'capex',     'Standardpaket-Rollout',               '{"paket_id":"string","objekte":"array"}',                array[]::text[]),
  ('exit_vergleich',           'portfolio',   'analyse',   'Exit-Vergleich Paket vs. Einzel',     '{"paket_faktor":"number","einzel_faktor":"number"}',     array[]::text[])
on conflict (code) do update set
  kategorie = excluded.kategorie, klasse = excluded.klasse, label = excluded.label,
  param_schema = excluded.param_schema, constraint_codes = excluded.constraint_codes;

-- ── Regelwerk Leipzig (Spec §7.3) ──
-- Geltungsdaten vor Produktivnahme gegen aktuelle Sächsische Verordnungslage validieren.
insert into regelwerk (id, gemeinde_id, regel_code, parameter, gueltig_von, gueltig_bis, quelle) values
  ('e1000000-0000-0000-0000-0000000a0001', 'e1000000-0000-0000-0000-000000000001',
   'kappungsgrenze', '{"kappung_pct":15}', '2024-07-01', '2027-06-30',
   'Sächsische Kappungsgrenzenverordnung'),
  ('e1000000-0000-0000-0000-0000000a0002', 'e1000000-0000-0000-0000-000000000001',
   'mietpreisbremse', '{"aufschlag_pct":10}', '2026-01-01', '2027-06-30',
   'Sächsische Mietpreisbegrenzungsverordnung'),
  ('e1000000-0000-0000-0000-0000000a0003', 'e1000000-0000-0000-0000-000000000001',
   'modernisierung_deckel', '{"umlage_pct":8,"deckel_eur_qm_6j":3,"deckel_unter_7eur":2}',
   '2019-01-01', null, '§559 BGB')
on conflict (id) do update set
  parameter = excluded.parameter, gueltig_von = excluded.gueltig_von,
  gueltig_bis = excluded.gueltig_bis, quelle = excluded.quelle;
