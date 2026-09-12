# Aufgabe: Frontend-Modul CRM für Hausverwaltung (React + TypeScript)

## Kontext
Frontend für das Berko AI-CRM-Modul. Stack identisch zum DMS-Modul:
- React 18 + TypeScript
- Vite
- TailwindCSS + shadcn/ui
- TanStack Query für Server-State
- React Router v6
- Supabase Client (`@supabase/supabase-js`)
- react-i18next (DE/EN/RU)
- lucide-react für Icons
- react-hook-form + zod für Formulare

Backend ist fertig: Tabellen `contacts`, `properties`, `units`, 
`contact_roles`, `contracts`, `bank_accounts`, `tickets`, 
`communications`, plus Views `v_active_owners`, `v_active_tenants`, 
`v_contact_overview`. RLS via `tenant_id` aktiv.

Zielgruppe: Verwalter (Mandant-User). Eigentümer/Mieter haben **kein** 
CRM-Zugriff – die sehen nur das DMS-Portal.

## Zielsetzung
Das CRM ist das tägliche Arbeitswerkzeug des Verwalters. Er muss in 
3 Klicks zu jeder Person, jedem Vertrag, jedem Vorgang kommen. UX-Ziel: 
**schneller als HausPerfekt PRO, übersichtlicher als Domus**.

## Designvorgaben

### Visuelle Sprache
Identisch zum DMS-Modul:
- Akzentfarbe Orange (`primary` aus `tailwind.config.ts`)
- Cleane Grays, viel Weißraum
- Counter als kleine Pills mit Orange-Text
- Sans-Serif (Inter), `uppercase tracking-wide` für Section-Header
- Keine Spielereien – Verwalter wollen Effizienz

### Density
CRM-Listen werden täglich genutzt → **kompakter** als das DMS. 
Tabellen mit 8-10px vertikalem Padding, nicht 16px. Hausverwalter 
verwalten oft 200+ Einheiten und wollen viel auf einen Bildschirm.

## Routing-Struktur
/crm                                    → CRMDashboard
/crm/kontakte                           → ContactListPage
/crm/kontakte/:contactId                → ContactDetailPage
/crm/kontakte/neu                       → ContactCreatePage
/crm/objekte                            → PropertyListPage
/crm/objekte/:propertyId                → PropertyDetailPage (mit Sub-Tabs)
/crm/objekte/:propertyId/einheiten/:unitId → UnitDetailPage
/crm/vertraege                          → ContractListPage
/crm/vertraege/:contractId              → ContractDetailPage
/crm/vorgaenge                          → TicketListPage
/crm/vorgaenge/:ticketId                → TicketDetailPage
/crm/kommunikation                      → CommunicationListPage

Globale Navigation links (Sidebar): Dashboard, Kontakte, Objekte, 
Verträge, Vorgänge, Kommunikation, Dokumente (Link ins DMS), 
Einstellungen.

## Zu erstellende Komponenten

### 1. `<CRMDashboard />` (Startseite)

KPI-Tiles oben (4 Spalten, responsive):
- Aktive Verträge
- Offene Vorgänge (mit Trend ↑↓)
- Überfällige Hausgelder/Mieten (Anzahl + Summe)
- Demnächst auslaufende Verträge (nächste 90 Tage)

Darunter zwei Spalten:
- **Letzte Vorgänge**: 10 neueste Tickets, klickbar
- **Letzte Kommunikation**: 10 neueste Communications-Einträge

Ganz unten: **Schnellzugriffe** (Buttons) – Neuer Kontakt, Neuer 
Vertrag, Neuer Vorgang, Massen-Mailing.

Datenquelle: `useQuery(['crm', 'dashboard'])` mit eigenem RPC 
`get_crm_dashboard()` – nicht 5 separate Queries, das wird zu langsam.

### 2. `<ContactListPage />`

Hauptansicht für Personenverwaltung. Layout:

**Toolbar oben**:
- Suchfeld (full-width, debounced 300ms) – sucht in Name, E-Mail, 
  Telefon, Adresse über Postgres FTS-Index
- Filter-Dropdown: Rolle (Eigentümer/Mieter/Beirat/...), Objekt, 
  Status (aktiv/ehemalig)
- Toggle: Personen / Firmen / Beide
- Button rechts: **+ Neuer Kontakt** (Orange, primary CTA)

**Tabelle** (virtualisiert mit `@tanstack/react-virtual` ab 100+ Zeilen):
| Avatar | Name | Rollen (Chips) | Objekte | Telefon | E-Mail | Status |

- Avatar: Initialen in farbigem Kreis (deterministisch aus Name)
- Rollen als kleine Chips (z.B. „Eigentümer", „Beirat") – multiple 
  möglich
- Objekte: bis zu 2 als Chips, dann „+3 weitere"
- Klick auf Zeile → ContactDetailPage
- Hover: Quick-Actions rechts (Anrufen via `tel:`, Mailen via 
  `mailto:`, Bearbeiten)

**Bulk-Actions**: Checkboxen links, dann oben „X ausgewählt" mit 
Aktionen: Massen-E-Mail, Export CSV, Tag setzen.

### 3. `<ContactDetailPage />`

Zweispaltiges Layout:

**Linke Spalte (~30%)**: Profil-Card
- Avatar groß, Name fett, Sprache + Staatsangehörigkeit klein darunter
- Stamm-Adresse, abweichende Postanschrift falls vorhanden
- Kommunikation: alle E-Mails und Telefone als klickbare Items 
  (mailto:, tel:)
- Geburtsdatum + Alter
- Steuer-ID, USt-IdNr. (falls vorhanden, mit Copy-Button)
- DSGVO-Status (Einwilligungen visualisiert)
- GwG-Status (Badge: identifiziert / ausstehend / abgelaufen)

**Rechte Spalte (~70%)**: Tab-Bereich
- **Übersicht**: Aktivitäts-Timeline (Mix aus Tickets, Communications, 
  Vertrags-Events) chronologisch
- **Rollen**: Tabelle aller `contact_roles` mit Objekt/Einheit, 
  Rolle, Zeitraum (von/bis). Zeile klickbar → Vertrag/Einheit. 
  Button **+ Rolle hinzufügen**.
- **Verträge**: Aktuelle und historische Verträge (eigener Sub-Tab 
  „Aktiv / Beendet")
- **Bankverbindungen**: Liste mit IBAN (maskiert, mit Reveal-Button), 
  SEPA-Mandat-Status. Sensitive Daten nur bei Klick sichtbar + 
  Audit-Log-Eintrag.
- **Vorgänge**: Tickets, bei denen dieser Kontakt beteiligt ist
- **Kommunikation**: alle Communications mit diesem Kontakt
- **Dokumente**: Deep-Link ins DMS, gefiltert auf diesen Kontakt
- **Notizen**: freie Notizen mit Markdown-Support, Verwalter-intern

Header der Page: Breadcrumb, Name groß, Action-Buttons rechts 
(Bearbeiten, Mailen, Anrufen, ...-Menü mit Löschen/Anonymisieren).

### 4. `<ContactCreatePage />` / `<ContactEditDrawer />`

Wizard mit react-hook-form + zod:
1. Personentyp (natürliche Person / juristische Person)
2. Stammdaten (Name, Anrede, Geburtsdatum, Sprache, ...)
3. Kommunikation (E-Mails, Telefone – dynamische Listen mit Add/Remove)
4. Adressen (Wohn-/Post-/Rechnung – mit Adress-Autocomplete via 
   Google Places oder Nominatim)
5. Optional: Steuer-ID, GwG-Daten, DSGVO-Einwilligungen
6. Optional: erste Rolle direkt anlegen (z.B. „Eigentümer in Objekt X")

Auf Mobile als Drawer von rechts, auf Desktop als eigene Page.

**Validierung**: 
- IBAN-Validierung (z.B. via `iban` npm-package)
- Steuer-ID 11-stellig
- E-Mail RFC-konform
- Telefon: libphonenumber-js mit DE-Default

### 5. `<PropertyListPage />` und `<PropertyDetailPage />`

**ListPage**: Tabelle aller Objekte des Mandanten
| Adresse | Typ (WEG/MV/SE) | Einheiten (Anzahl) | Aktive Verträge | Offene Vorgänge | Verwaltungsbeginn |

**DetailPage**: Sub-Tab-Layout
- **Stammdaten**: Adresse, Gemarkung/Flur/Flurstück, Baujahr, 
  Gesamtwohnfläche, Anzahl Einheiten, Heizungsart, Verwaltungsvertrag
- **Einheiten**: Tabelle aller Units mit Eigentümer, Mieter, MEA, 
  Wohnfläche, Status. Klick → UnitDetailPage
- **Eigentümer**: Liste aller aktiven Eigentümer (aus 
  `v_active_owners`)
- **Mieter**: Liste aller aktiven Mieter (aus `v_active_tenants`)
- **Beirat**: aktuelle Beiräte mit Amtszeit
- **Dienstleister**: alle service_provider mit aktiver Rolle
- **Versorgung**: Versorger-Verträge (Strom/Gas/Wasser/Wärme), 
  Zähler-Übersicht
- **Versicherungen**: aktive Policen
- **Vorgänge**: alle Tickets dieses Objekts
- **Dokumente**: Deep-Link ins DMS gefiltert auf dieses Objekt

Header: Adresse groß, Objekt-Typ als Badge, Action-Menü rechts.

### 6. `<UnitDetailPage />`

Ähnlich PropertyDetailPage, aber auf Einheit fokussiert:
- Stammdaten der Einheit (Lage, Wohnfläche, MEA, Zimmer, Zähler-Nrn)
- Aktueller Eigentümer (aus aktivem `contact_role` mit `role=owner`)
- Aktueller Mieter (falls vermietet)
- **Historie**: alle bisherigen Eigentümer und Mieter chronologisch 
  (kritisches Feature – aus `contact_roles` mit `valid_from/to`)
- Aktuelle und vergangene Verträge
- Vorgänge bezogen auf diese Einheit

### 7. `<ContractListPage />` / `<ContractDetailPage />`

**ListPage**: Tabelle aller Verträge
| Vertragsart | Mieter/Eigentümer | Objekt/Einheit | Beginn | Ende | Kaltmiete/Hausgeld | Status |

Filter: Aktiv/Beendet/Auslaufend, Vertragsart, Objekt.

**DetailPage**:
- Vertragsdaten (Beginn/Ende/Kündigungsfrist/Indexierung)
- Beteiligte Personen (Hauptmieter, Mitmieter, Bürge, ...)
- Finanzielle Konditionen (Kaltmiete, NK-VZ, HK-VZ, Hausgeld, Kaution)
- Bankverbindung des Vertragspartners
- Sondervereinbarungen
- Dokumente (Deep-Link ins DMS, gefiltert auf contract_id)
- Aktivitäts-Timeline

Action-Buttons: Kündigung erfassen, Mietanpassung, Vertrag drucken, 
Beenden.

### 8. `<TicketListPage />` / `<TicketDetailPage />`

**ListPage**: Kanban-View ODER Listen-View (Toggle)
- Kanban-Spalten: Neu / In Bearbeitung / Wartend / Erledigt
- Cards: Titel, Objekt/Einheit, Priorität, Zuständiger, Alter
- Drag-and-Drop zwischen Spalten (mit `@dnd-kit/core`)
- Filter: Objekt, Kategorie, Zuständiger, Priorität

**DetailPage**:
- Beschreibung, Status, Priorität, SLA-Counter
- Zuständigkeit (assignee, mit Wechsel-Funktion)
- Bezogen auf: Kontakt + Objekt + Einheit (Links)
- Aktivitäts-Stream: Statuswechsel, Kommentare, eingehende Mails
- Kommentar-Editor unten (intern vs. an Kontakt sichtbar)
- Anhänge (PDF/Bilder, in Supabase Storage)
- Eskalations-Optionen

### 9. `<CommunicationListPage />`

Globale Liste aller Communications, filterbar nach:
- Channel (E-Mail/Telefon/Brief/Meeting/Portal)
- Direction (eingehend/ausgehend)
- Kontakt
- Zeitraum

Detail: Modal mit kompletter Nachricht + Anhängen + Kontext-Links.

**Outbound-Mail komponieren**: Editor mit Vorlagen 
(Mahnung, Einladung ETV, etc.), Empfänger-Picker, Anhang aus DMS 
auswählen.

### 10. Shared Components

- `<RoleChip role="owner" />` – farbcodierte Rollen-Chips konsistent 
  in der ganzen App
- `<PersonAvatar contact={c} size="md" />` – Avatar mit Initialen
- `<AddressDisplay address={...} format="single-line | multi-line" />`
- `<IBANField value={...} masked={true} />` – maskierte IBAN-Anzeige 
  mit Reveal + Audit
- `<DateRange from={...} to={...} />` – „seit 12.05.2024" / 
  „01.01.2020 – 31.12.2024" formatiert
- `<TimelineEntry icon={...} title={...} timestamp={...}>` – Einträge 
  in Aktivitäts-Streams
- `<ConsentStatus consents={...} />` – DSGVO-Einwilligungs-Visualisierung
- `<DataPrivacyBadge level="public | sensitive | restricted" />`

### 11. Shared Hooks

- `useContact(id)`, `useContacts(filters)`
- `useProperty(id)`, `useProperties()`
- `useContract(id)`, `useContractsByContact(contactId)`
- `useActiveRoles(contactId)` – aktuelle Rollen einer Person
- `useTicket(id)`, `useTickets(filters)`
- `useCommunications(filters)`
- `useCurrentTenant()` – Mandant-Info aus JWT
- `useDebounceValue(value, ms)`

## Datenmodell-Anbindung

### TypeScript-Types
Generiert aus Supabase Schema via `supabase gen types typescript`. 
In `src/types/database.ts`. Domain-Types darüber in `src/types/crm.ts`:
- `Contact`, `ContactWithRoles`
- `Property`, `PropertyWithStats`
- `Unit`, `UnitWithCurrentOccupants`
- `Contract`, `ContractWithParties`
- `Ticket`, `TicketWithContext`

### Sensible Daten
- IBAN, GwG-Ausweisdaten: nur on-demand laden (eigener API-Call), nie 
  in Listen
- Beim Anzeigen Audit-Log-Eintrag erzeugen via RPC 
  `log_sensitive_access`
- DSGVO-Anzeige in DetailPage: Welche Einwilligungen liegen vor?

## State-Management

Wie im DMS:
- TanStack Query für Server-State
- Cache-Keys: `['contacts', filters]`, `['contact', id]`, 
  `['property', id, 'units']`, etc.
- Optimistic Updates bei Status-Wechseln (Tickets, Vertragsende)
- Invalidation nach Mutationen explizit

**Wichtig**: Bei Mutationen, die Rollen/Verträge ändern, **mehrere** 
Query-Keys invalidieren (Person + Property + Unit gleichzeitig).

## Performance

- Listen > 100 Einträge: Virtualisierung
- Suche: debounced 300ms, Postgres FTS auf serverseitig
- Lazy-Load Tabs in DetailPages (Tab-Inhalt nur laden, wenn aktiv)
- Prefetch der wahrscheinlichsten nächsten Seite (z.B. bei Hover über 
  Listen-Zeile)
- Pagination: Cursor-basiert ab 1000+ Datensätzen, sonst 50er-Pages

## Internationalisierung

- Namespaces: `crm.common`, `crm.contacts`, `crm.properties`, 
  `crm.contracts`, `crm.tickets`, `crm.roles`
- Sprachen DE/EN/RU, Default DE
- Datumsformate via `date-fns` mit DE-Locale
- Währung: Euro mit DE-Format (`Intl.NumberFormat`)
- Adressformat: deutsche Konvention (Straße Hausnr., PLZ Ort)

## Accessibility

- Tabellen mit korrektem `<th scope="col">`, sortable Headers via 
  `aria-sort`
- Form-Inputs mit `<label>`, Fehler via `aria-describedby`
- Modals/Drawer: Focus-Trap, ESC, Click-Outside
- Keyboard-Shortcuts: 
  - `g k` → Kontakte, `g o` → Objekte, `g v` → Vorgänge (vimium-Style)
  - `n` auf Listenseiten → Neuer Eintrag
  - `/` → Fokus auf Suchfeld

## Fehlerbehandlung

- Globaler Error-Boundary mit Fehler-Page (nicht weißer Bildschirm)
- Toast-Notifications via shadcn/ui Toaster
- Bei 403/RLS-Fehler: klare Meldung „Sie haben keinen Zugriff auf 
  diesen Datensatz"
- Bei Validierungsfehler: Feld-spezifisch mit zod-Error-Mapping auf 
  Deutsch
- Network-Errors: Retry mit exponential backoff

## Mobile / Tablet

Verwalter sind oft im Außendienst (Begehungen, ETVs).
- Responsive ab 640px ernsthaft, ab 320px funktional
- DetailPages: Tabs werden zu Akkordeons auf Mobile
- Tabellen: horizontal scrollbar oder Card-View auf Mobile
- Kanban: nur auf Tablet+, auf Mobile Listen-View

## Testing

- Vitest + React Testing Library: Komponenten-Tests
- MSW für Supabase-Mocks
- E2E mit Playwright für die kritischen Flows:
  - Kontakt anlegen → Rolle zuweisen → Vertrag erstellen
  - Eigentümerwechsel an Einheit dokumentieren
  - Ticket eröffnen → bearbeiten → schließen
  - DSGVO-Auskunft generieren

## Designprinzipien (zusammengefasst)
- **Tagesgeschäft first**: Was der Verwalter 50× pro Tag macht 
  (Kontakt suchen, Vorgang öffnen) muss in 2 Klicks gehen
- **Historie ist heilig**: nichts wird gelöscht, alles ist 
  zeitlich versioniert. UI muss das transparent machen.
- **Sensible Daten geschützt**: IBAN/GwG immer maskiert per Default, 
  Reveal nur mit Audit
- **Cross-Linking konsequent**: Person → Vertrag → Einheit → Objekt → 
  Vorgänge → Dokumente. Jede Entity ist von jeder anderen erreichbar.
- **Bulk-Operationen**: Verwalter haben oft 50+ Vorgänge gleichzeitig 
  (Mietanpassung, Mahnung) – Bulk-Actions in jeder Listenseite

## Output-Format
1. Plan: Komponenten-Tree, welche Dateien wo
2. Routing-Setup in `src/router.tsx` (nur CRM-Routen, DMS schon da)
3. Komponenten in `src/features/crm/` (eine Datei pro Komponente, 
   nach Subfeature gruppiert: contacts/, properties/, contracts/, 
   tickets/, communications/, dashboard/, shared/)
4. Hooks in `src/features/crm/hooks/`
5. Types in `src/types/crm.ts`
6. i18n-Strings in `src/locales/{de,en,ru}/crm.json`
7. zod-Schemas in `src/features/crm/schemas/`
8. README im Feature-Ordner

## Nicht in diesem Schritt
- Buchhaltung/FIBU-Frontend (eigenes Modul)
- Hausgeld-/NK-Abrechnungs-UI (eigenes Modul)
- Beschluss-Manager (eigenes Modul)
- ETV-Planung mit Einladungs-Workflow (eigenes Modul, hängt eng am DMS)
- Mass-Mailing-Editor (Teil des späteren Notification-Moduls)
- Mobile App (React Native später)