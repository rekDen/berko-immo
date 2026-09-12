# Aufgabe: Dokumentenmanagement-Modul für Hausverwaltung (Supabase/Postgres)

## Kontext
Wir bauen ein DMS-Modul für Berko AI – eine SaaS-Plattform für deutsche 
Hausverwaltungen (WEG, MV, SE). Das Modul ergänzt das bereits 
bestehende CRM-Modul (contacts, properties, units, contact_roles, 
contracts). Datenbank ist Supabase (Postgres 15+) mit RLS, Storage über 
Supabase Storage. Frontend: React + TypeScript.

Das DMS ist ein zentrales Feature mit eigener Verkaufsstory: 
Hausverwalter laden Eigentümer/Mieter/Beiräte/Dienstleister ins Portal 
ein, alle sehen rollenbasiert genau die Dokumente, die für sie 
bestimmt sind. Das senkt Kosten (kein Druck/Versand) und ist USP gegen 
Wettbewerber.

## Kernanforderungen

### 1. Drei-Ebenen-Struktur (wohnungswirtschaftlich)
- **Objektebene** (`property`): Dokumente, die das ganze Objekt 
  betreffen (Energieausweis, Teilungserklärung, Versicherungen)
- **Einheitenebene** (`unit`): Personenunabhängige Dokumente zur 
  Wohnung (überleben Eigentümer-/Mieterwechsel)
- **Vertragsebene** (`contract`): Personenbezogene Dokumente 
  (Abrechnungen, Mahnungen) – nur Personen im Vertrag sehen sie

### 2. Vorgegebene Dokumentenkategorien (System-Taxonomie)
Festes Kategorie-Schema mit Gruppen → Unterkategorien. Jede 
(Unter-)Kategorie definiert:
- Auf welcher Ebene sie verwendet wird (property/unit/contract)
- Welche Rollen Lesezugriff haben (Default-Permissions)
- Such-Tags/Synonyme für die Suche (unsichtbar, mehrsprachig)

**Vollständiges Seed-Schema** (in `supabase/seed/document_categories.sql`):

EIGENTÜMERGEMEINSCHAFT (property-Ebene, Rollen: beirat, owner, proxy)

Aufteilungspläne
Bauhandwerkerlisten
Beschluss-Sammlungen
Protokolle
Teilungserklärungen
Verkaufsprospekte
Wohnflächenberechnungen

OBJEKTBETREUUNG (property, Rollen: beirat, owner, tenant, proxy, service_provider)

Energieausweis
Gebrauchsanweisungen
Hausordnung
Legionellenprüfung
Telekommunikation
Wartungsanleitungen

OBJEKTTECHNIK (property, Rollen: beirat, owner, proxy, service_provider)

Bescheinigungen
Dokumentationen
Energie
Gebäudetechnik
Leitungsführungspläne
Prüfberichte
Schließanlagen

OBJEKTVERWALTUNG (property, Rollen: beirat, owner, proxy)

Abnahmen
Bank
Dienstleistungsverträge
Gutachten
Mietverträge
Versicherungsunterlagen
Versorgungsverträge
Wartungsverträge

RICHTLINIEN (property, Rollen: beirat, owner, proxy, service_provider)

Allgemein
Behörden

VERWALTUNGSBEIRAT (property, Rollen: beirat) ← NUR Beirat!

Rechnungsprüfung
Schriftverkehr
Versammlungsvorbereitung

(Weitere Gruppen für unit-Ebene und contract-Ebene ergänzen:
EINHEIT_TECHNIK, EINHEIT_DOKUMENTE, VERTRAG_ABRECHNUNGEN,
VERTRAG_KORRESPONDENZ etc.)

Das Schema muss für Verwalter nicht änderbar sein, aber pro Mandant 
**Marker/Tags innerhalb einer Kategorie** sind erlaubt 
(siehe Anforderung 4).

### 3. Rollenbasierte Berechtigungen
Anknüpfung an `contact_roles` aus dem CRM-Modul. Sichtbarkeit:
- **Verwalter (Mandant-User)**: Volles Lese-/Schreibrecht in allen 
  Kategorien des Mandanten
- **Eigentümer**: Lesezugriff auf property+unit-Dokumente seiner 
  Einheit + contract-Dokumente seines Vertrags
- **Mieter**: Lesezugriff auf property-Dokumente (eingeschränkte 
  Kategorien) + unit-Dokumente seiner Einheit + eigene contract-Docs
- **Beirat**: Wie Eigentümer + zusätzlich `VERWALTUNGSBEIRAT`-Gruppe 
  des Objekts
- **Bevollmächtigter (proxy)**: Erbt Rechte des Vollmachtgebers
- **Dienstleister**: Lesezugriff nur auf explizit freigegebene 
  Kategorien (Objektbetreuung, Objekttechnik – konfigurierbar)

Dokument-Sichtbarkeit = Schnittmenge aus:
- Kategorie erlaubt diese Rolle
- User hat aktive `contact_role` mit Bezug zu property/unit/contract 
  des Dokuments
- Dokument ist nicht als `internal_only` markiert

### 4. Marker/Unterordner innerhalb Kategorien
Verwalter können pro Kategorie eigene Marker (Tags) anlegen, z.B. 
in „Rechnungsprüfung" Marker je Kostenart („Strom", „Heizung", 
„Versicherung"). Beiräte können danach filtern. Marker sind 
mandantenspezifisch.

### 5. Wirtschaftsjahr-Zuordnung
In bestimmten Kategorien (Buchhaltung, Rechnungsprüfung, 
Versammlungsvorbereitung) erhält jedes Dokument ein 
`fiscal_year` (Integer). Filter im Frontend nach Jahr.

### 6. Massenupload + Sendungsfunktion
- Bulk-Upload mehrerer Dateien in eine Kategorie
- **Sendungsfunktion**: Verwalter lädt z.B. 50 Hausgeldabrechnungen 
  hoch → System ordnet automatisch jeder Einheit/jedem Vertrag das 
  richtige Dokument zu (über Dateinamens-Konvention, z.B. 
  `Abrechnung_2024_Einheit_W12.pdf` oder Mapping-CSV)
- Sendung wird als Gruppe gespeichert (`document_batches`), kann 
  komplett wieder gelöscht werden, falls fehlerhaft

### 7. Dokumentenvorschau
- PDF, Bilder, Word: Inline-Vorschau im Browser
- Eigenschaften-Panel rechts: Titel, Kategorie-Pfad, Größe, 
  Dateiname, Hinzugefügt-Datum, Hochgeladen von
- Download-Button (mit Audit-Log)

### 8. Verwalter-Übergabe (Objektübergabe)
Funktion zur kompletten Übergabe eines Objekts an einen 
Nachverwalter (anderer Mandant in Berko AI). Alle Dokumente, 
Kategorien-Marker, Verträge bleiben erhalten – nur `tenant_id` 
ändert sich. Audit-Log zwingend.

## Zu erstellende Artefakte

### 1. Migrations-SQL (`supabase/migrations/[timestamp]_dms_core.sql`)

**Tabellen:**

**`document_categories`** – System-Taxonomie (read-only für User)
- id, code (z.B. `EIGENTUEMERGEMEINSCHAFT.PROTOKOLLE`), 
  group_code, name_de, name_en, name_ru
- level: `property` | `unit` | `contract`
- allowed_roles (text[] – welche `contact_roles.role` lesen dürfen)
- supports_fiscal_year (bool)
- search_synonyms (text[]) – versteckte Suchbegriffe
- sort_order, parent_id (für Gruppe→Unterkategorie)

**`document_markers`** – Mandantenspezifische Marker innerhalb 
Kategorien
- id, tenant_id, category_id (FK), name, color
- created_by, created_at

**`documents`** – Eigentliche Dokumente
- id, tenant_id
- category_id (FK)
- level: `property` | `unit` | `contract` (denormalisiert für Performance)
- property_id, unit_id, contract_id (FKs, nullable je nach level)
- title, description
- storage_path (Supabase Storage), file_name, file_size, 
  mime_type, file_hash (sha256 für Duplikatprüfung)
- fiscal_year (int, nullable)
- markers (uuid[] – FK zu document_markers)
- visibility_override jsonb – feinere Rollen-Overrides falls nötig
- internal_only (bool – nur Verwalter sieht)
- batch_id (FK zu document_batches, nullable)
- uploaded_by, uploaded_at
- deleted_at, deleted_by (Soft-Delete)

**`document_batches`** – Sendungen / Massenupload-Gruppen
- id, tenant_id, name, description
- batch_type: `mass_upload` | `mailing` | `handover`
- target_category_id, target_level
- created_by, created_at
- status: `draft` | `processing` | `completed` | `partially_failed`

**`document_access_log`** – Audit
- id, document_id, contact_id (oder user_id), action 
  (`view` | `download` | `preview`), ip, user_agent, occurred_at

**`document_handovers`** – Verwalter-Übergaben
- id, property_id, from_tenant_id, to_tenant_id
- status: `requested` | `approved` | `completed` | `cancelled`
- requested_by, approved_by, completed_at
- snapshot jsonb (Schnappschuss zum Zeitpunkt der Übergabe)

**`document_shares`** – Optional: zeitlich befristete externe Links
- id, document_id, token (unique), expires_at, password_hash, 
  created_by, access_count, max_access

### 2. RLS-Policies
Kritischer Teil. Helper-Function:

```sql
create or replace function user_can_see_document(doc_id uuid)
returns boolean language plpgsql security definer as $$
-- Prüft:
-- 1. tenant_id matcht ODER User ist Mandant-Admin
-- 2. User hat aktive contact_role auf property/unit/contract des Docs
-- 3. category.allowed_roles enthält eine der User-Rollen
-- 4. internal_only = false (außer Mandant-User)
-- 5. deleted_at is null
$$;
```

Policies für SELECT/INSERT/UPDATE/DELETE entsprechend.

### 3. Storage-Bucket-Konfiguration
- Bucket `documents` (private)
- Pfadschema: `{tenant_id}/{property_id}/{level}/{category_code}/{document_id}.{ext}`
- Storage-RLS analog zu Datenbank-RLS (über Storage Policies)

### 4. Edge Functions / RPC

**`bulk_upload_documents`** – nimmt Datei-Array + Mapping entgegen, 
ordnet automatisch zu, erstellt batch + documents

**`mass_delete_batch`** – komplette Sendung rückgängig machen

**`handover_property`** – Objektübergabe mit Snapshot

**`search_documents`** – Volltextsuche über title + description + 
category.search_synonyms (mit Postgres `tsvector`/GIN-Index, deutsch)

**`get_visible_categories`** – gibt für aktuellen User nur die 
Kategorien zurück, in denen er mindestens 1 Dokument sehen darf, 
inkl. Anzahl (für die UI aus dem Screenshot)

### 5. TypeScript-Types
Unter `src/types/dms.ts`. Inkl. Helper-Types wie 
`DocumentWithCategory`, `CategoryTreeNode`, `DocumentVisibility`.

### 6. Seed-Daten
- Vollständige `document_categories` (alle Gruppen + Unterkategorien 
  aus Anforderung 2, inkl. Synonyme)
- Beispiel-Marker für „Rechnungsprüfung"
- 1 Test-Property mit 5 Dokumenten verteilt über Ebenen

## Designprinzipien
- **System-Taxonomie ist heilig**: Kategorien fest, nicht 
  user-erweiterbar – nur Marker sind flexibel
- **Mehrsprachigkeit vorbereiten**: Kategorie-Namen DE/EN/RU 
  (Berko's Sprachen)
- **Performance**: Index auf 
  `(tenant_id, property_id, category_id)`, 
  `(tenant_id, contract_id)`, GIN auf search_synonyms
- **DSGVO**: Dokumente bei Vertrags-/Rolle-Ende nicht automatisch 
  löschen, aber Sichtbarkeit endet sofort. Lösch-/
  Anonymisierungspfad explizit.
- **Audit-First**: Jeder Lese-/Download-Zugriff geloggt 
  (Beleg gegenüber Beirat/Eigentümer)
- **Kein Dateispeicher in DB**: Files in Supabase Storage, DB nur 
  Metadaten

## UI-Anforderungen (für späteren Frontend-Prompt)
Übersichts-Screen aus Image 1 nachbauen: Gruppen-Header mit 
Rollen-Hinweis in Klammern, Grid aus Kategorien mit Counter rechts, 
collapse-bar Gruppen, Suchfeld oben.

## Nicht in diesem Schritt
- Frontend-Komponenten (separater Prompt)
- E-Mail-Versand bei Sendungen (separates Notification-Modul)
- E-Signatur (separates Modul)
- OCR / Volltext-Indexierung von PDF-Inhalten (Phase 2)

## Output-Format
1. Plan: Welche Dateien werden erstellt
2. Migrations-SQL als ein File
3. RLS-Policies als separates File
4. Edge Functions / RPC-Funktionen
5. TypeScript-Types
6. Seed-Daten (Kategorien + Beispieldaten) als separates File

