# Aufgabe: CRM-Datenmodell für Hausverwaltung (Supabase/Postgres)

## Kontext
Wir bauen ein CRM-Modul für eine deutsche Hausverwaltung (Puux) als Teil 
einer größeren SaaS-Plattform. Die Datenbank ist Supabase (Postgres 15+) 
mit Row Level Security. Das Modell muss WEG-Verwaltung, Mietverwaltung 
und Sondereigentumsverwaltung gleichzeitig abbilden können.

## Kernanforderung
Eine Person kann mehrere Rollen gleichzeitig haben (z.B. Eigentümer in 
WEG A + Mieter in WEG B + Beirat + Bevollmächtigter). Das Modell muss 
diese n:m-Beziehungen sauber abbilden, ohne Daten zu duplizieren.

## Zu erstellende Artefakte

### 1. Migrations-SQL (`supabase/migrations/[timestamp]_crm_core.sql`)
Erstelle Tabellen mit:
- UUIDs als Primary Keys (`gen_random_uuid()`)
- `created_at`, `updated_at` mit Trigger
- `tenant_id` (uuid) auf jeder Tabelle für Mandantenfähigkeit
- Soft-Delete via `deleted_at`
- Sinnvolle Indizes (besonders auf Foreign Keys und Suchfelder)
- CHECK Constraints für Enums wo möglich

### 2. Tabellen (Mindestumfang)

**`contacts`** – Personen/Firmen-Stammdaten
- type: `natural_person` | `legal_entity`
- Anrede, Titel, Vor-/Nachname, Firmenname, Geburtsdatum
- Sprache (de/en/ru), Staatsangehörigkeit
- Kommunikation: E-Mails (jsonb-Array mit type+value), Telefone (jsonb)
- Adressen (jsonb-Array für Wohn-/Post-/Rechnungsadresse)
- Steuer-ID, USt-IdNr.
- GwG-Daten (Ausweisart, Nummer, gültig bis) – verschlüsselt/geschützt
- DSGVO-Einwilligungen (jsonb mit Zweck + Datum)
- `notes` (text)

**`properties`** – Liegenschaften
- Adresse, Gemarkung, Flur, Flurstück
- Typ: `weg` | `miethaus` | `sondereigentum` | `gewerbe` | `mixed`
- Baujahr, Gesamtwohnfläche, Anzahl Einheiten

**`units`** – Einheiten (Wohnungen/Gewerbe/Stellplätze)
- property_id (FK)
- Einheitennummer, Lage (Etage, Lage-Beschreibung)
- Typ: `apartment` | `commercial` | `parking` | `storage` | `other`
- Wohnfläche, Zimmeranzahl
- Miteigentumsanteil (MEA) als numeric(10,4)
- Grundbuchblatt, Grundbuch-Nr.
- Heizungsart, Zählernummern (jsonb)

**`contact_roles`** – Verknüpfungstabelle Person ↔ Einheit/Objekt
- contact_id (FK), unit_id (FK nullable), property_id (FK nullable)
- role: `owner` | `tenant` | `subtenant` | `beirat` | `proxy` | 
  `service_provider` | `caretaker` | `other`
- valid_from, valid_to (für Historie!)
- Rollen-spezifische Daten in `metadata` jsonb 
  (z.B. MEA bei owner, Mietbeginn bei tenant, Vollmachtumfang bei proxy)
- is_primary boolean (Hauptmieter vs. Mitmieter)

**`contracts`** – Verträge (Miet-/Verwaltungsverträge)
- contact_role_id (FK)
- type: `rental_residential` | `rental_commercial` | `management_weg` | 
  `management_mv` | `management_se`
- start_date, end_date, notice_period_months
- Befristung, Indexierung, Staffelmiete (jsonb)
- Kaltmiete, NK-VZ, HK-VZ, Hausgeld (separate numeric Felder)
- Kaution (Betrag, Art, Verwahrung)

**`bank_accounts`** – Bankverbindungen (separat wegen SEPA-Mandaten)
- contact_id (FK)
- IBAN (verschlüsselt empfohlen), BIC, Kontoinhaber
- SEPA-Mandatsreferenz, Mandat-Datum, Mandat-Status

**`tickets`** – Anliegen/Schadensmeldungen
- contact_id, unit_id, property_id (FKs)
- Titel, Beschreibung, Kategorie
- Status: `new` | `in_progress` | `waiting` | `resolved` | `closed`
- Priorität, Zuständiger (assignee_id), SLA-Daten
- created_by, resolved_at

**`communications`** – Kommunikationshistorie
- contact_id (FK), ticket_id (FK nullable)
- channel: `email` | `phone` | `letter` | `meeting` | `portal`
- direction: `inbound` | `outbound`
- subject, body, attachments (jsonb mit Storage-Pfaden)
- occurred_at

### 3. RLS-Policies
- Mandantentrennung via `tenant_id = auth.jwt() ->> 'tenant_id'`
- Basis-Policies für SELECT/INSERT/UPDATE/DELETE pro Tabelle
- Soft-Delete-Filter in SELECT-Policies

### 4. Hilfs-Views
- `v_active_owners` – aktuelle Eigentümer pro Einheit
- `v_active_tenants` – aktuelle Mieter pro Einheit  
- `v_contact_overview` – Person mit allen aktuellen Rollen aggregiert

### 5. TypeScript-Types
Generiere passende Types unter `src/types/crm.ts` für die Anwendung – 
nutze ggf. den Supabase-Type-Generator als Vorlage.

## Designprinzipien
- **Historie erhalten**: Rollen und Verträge mit `valid_from`/`valid_to`, 
  nie hart löschen
- **Flexibilität durch jsonb** für Felder mit variabler Struktur 
  (Adressen, Telefone, Rollen-Metadaten), aber **strukturierte Felder** 
  für alles, wonach gefiltert/gesucht/gerechnet wird
- **Deutscher Kontext**: Feldnamen englisch, aber Enums/Werte und 
  Kommentare können deutsche Begriffe enthalten wo etabliert (MEA, WEG, 
  Beirat, Hausgeld)
- **DSGVO-konform**: Sensible Felder markieren, GwG-Daten gesondert 
  behandeln, Lösch-/Anonymisierungspfad denken

## Nicht in diesem Schritt
- Buchhaltung/FIBU (separates Modul)
- Abrechnungen/Hausgeldabrechnung (separates Modul)
- Beschluss-Sammlung (separates Modul)

## Output-Format
1. Erst kurzer Plan (welche Dateien werden erstellt)
2. Dann Migrations-SQL als ein File
3. Dann TypeScript-Types
4. Zum Schluss Beispiel-Seed-Daten (3 Personen, 1 WEG mit 2 Einheiten, 
   typische Rollen) als separates SQL-File