# Aufgabe: Frontend-Modul Dokumentenmanagement (React + TypeScript)

## Kontext

Backend ist bereits fertig: Tabellen `documents`, `document_categories`, 
`document_markers`, `document_batches`, `document_access_log`, RPC 
`get_visible_categories`, `search_documents`, `bulk_upload_documents`. 
Storage-Bucket `documents` (private).

## Zielgruppen
Drei UI-Modi je nach User-Rolle:
1. **Verwalter (Admin)**: volle Rechte, Upload, Marker-Verwaltung, 
   Massenupload, Sendungen, Audit-Log
2. **Beirat**: Lesen + Belegprüfung-spezifische UI 
   (Filter nach Wirtschaftsjahr, Marker)
3. **Eigentümer/Mieter/Dienstleister**: nur Lesen, vereinfachte UI

Die UI passt sich rollenabhängig an, ist aber **dieselbe Codebasis**.

## Designvorgaben

### Visuelle Sprache (an Berko AI anlehnen)
- Akzentfarbe **Orange** (`#F39200` oder ähnlich – in 
  `tailwind.config.ts` als `primary` definiert) für aktive Tabs, 
  Counter, primäre CTAs
- Sehr cleane, ruhige Grays, viel Weißraum
- Typografie: Sans-Serif (Inter ist fine)
- Counter-Badges: kleine, runde Pills mit Orange-Text auf hellem 
  Grund (siehe Screenshot 1)
- Gruppen-Header in `uppercase tracking-wide` mit Rollen-Hinweis in 
  Klammern in muted-foreground

### Reduktion, nicht Verspielung
Kein Glassmorphism, keine Gradients, keine Schatten-Spielereien. 
Berko AI-Zielgruppe sind Hausverwalter zwischen 35 und 65 – die 
brauchen Klarheit, nicht Style. **Funktional über dekorativ.**

## Routing-Struktur
/objekte/:propertyId/dokumente              → DocumentOverviewPage (Übersicht aus Screenshot 1)
/objekte/:propertyId/dokumente/:categoryId  → DocumentListPage (Liste in einer Kategorie)
/dokumente/:documentId                       → DocumentPreviewModal (Modal aus Screenshot 2)
/objekte/:propertyId/upload                  → BulkUploadPage (Verwalter-only)
/objekte/:propertyId/sendungen               → BatchManagementPage (Verwalter-only)

Tab-Navigation oben (siehe Screenshot 1): Übersicht | Dokumente | 
Nutzer | Vorgänge | Termine | Ansprechpartner | Kommunikation | FAQs. 
Nur "Dokumente" implementieren, Tabs als Links anlegen 
(andere Routen sind Platzhalter/disabled).

## Zu erstellende Komponenten

### 1. `<DocumentOverviewPage />` (Hauptscreen, Screenshot 1)

**Layout**:
- TabBar oben (Übersicht/Dokumente/...) – Dokumente ist aktiv (orange 
  Underline)
- SearchBar (full-width, gerundet, hellgrau bg, mit Search-Icon links 
  und Help-Icon rechts) – Live-Suche debounced 300ms via 
  `search_documents` RPC
- Kategorie-Grid aufgeteilt in Gruppen (EIGENTÜMERGEMEINSCHAFT, 
  OBJEKTBETREUUNG, OBJEKTTECHNIK, OBJEKTVERWALTUNG, RICHTLINIEN, 
  VERWALTUNGSBEIRAT, etc.)

**Pro Gruppe** (`<CategoryGroupSection />`):
- Header: Gruppen-Code in `uppercase`, Rollen-Hinweis in Klammern 
  daneben in muted (z.B. "EIGENTÜMERGEMEINSCHAFT *(Beirat, Eigentümer, 
  Bevollmächtigter)*")
- Collapse-Chevron rechts (default expanded)
- 4-Spalten-Grid (responsive: 4 → 2 → 1) mit Kategorie-Items

**Pro Kategorie** (`<CategoryTile />`):
- Klickbarer Bereich, links Kategorie-Name, rechts Counter-Badge in 
  Orange
- Hover: subtle bg-change
- Counter zeigt Anzahl der für **diesen User** sichtbaren Dokumente
- Klick → navigate zu `/objekte/:propertyId/dokumente/:categoryId`

**Datenquelle**: `useQuery(['categories', propertyId], () => 
supabase.rpc('get_visible_categories', { p_property_id: propertyId }))`. 
Das RPC liefert nur Kategorien zurück, in denen der User mind. 1 Doc 
sehen darf, plus den Counter – also keine Logik im Frontend zur 
Sichtbarkeit nötig.

**Empty State**: Wenn keine Kategorien → freundliche Message "Noch 
keine Dokumente hinterlegt" mit Upload-Button (nur für Verwalter).

### 2. `<DocumentListPage />`

Liste aller Dokumente einer Kategorie. Layout:
- Breadcrumb: `Objekte / [Objektname] / Dokumente / [Kategorie]`
- Filter-Bar: 
  - Dropdown Wirtschaftsjahr (wenn `category.supports_fiscal_year`)
  - Marker-Multi-Select (Chips, mandantenspezifisch)
  - Sortierung (Neueste / Älteste / A-Z)
- Tabelle/Liste der Dokumente: Titel, Größe, Hinzugefügt, Marker als 
  farbige Chips, Aktionen (Vorschau, Download, Löschen für Verwalter)
- Klick auf Zeile → Modal mit Vorschau

### 3. `<DocumentPreviewModal />` (Screenshot 2)

**Layout** (zwei-spaltig in Modal, full-screen mit Padding):
- Header: Titel links, X-Close rechts
- Links: PDF/Image-Viewer (~70% Breite)
  - Für PDFs: `react-pdf` oder native `<iframe>` mit Browser-Viewer
  - Für Bilder: `<img>` mit zoom
  - Für andere: Download-Hinweis
  - Toolbar: Seitennavigation, Zoom (+/-), Rotate, Print, Download, 
    Menu
- Rechts: `<DocumentPropertiesPanel />` (~30% Breite, hellgrau bg)
  - Eigenschaften (Label-Value-Liste): **Titel**, **Kategorie** (mit 
    Pfad: `Eigentümergemeinschaft » Protokolle`), **Größe**, 
    **Dateiname**, **Hinzugefügt**, **Hochgeladen von**
  - Marker-Chips (falls vorhanden)
  - Wirtschaftsjahr (falls gesetzt)
  - Großer **HERUNTERLADEN**-Button unten (Outline-Style, mit 
    Download-Icon)

**Audit**: Beim Öffnen automatisch `document_access_log` mit 
`action='preview'` schreiben, beim Download `action='download'`.

**Signed URLs**: Storage-Pfade nicht direkt verlinken – 
`supabase.storage.from('documents').createSignedUrl(path, 60)` für 
zeitlich limitierten Zugriff.

### 4. `<BulkUploadPage />` (nur Verwalter)

Drag-and-Drop-Zone für mehrere Dateien. Workflow:
1. Files droppen (Multi-File, max 100, je max 50MB)
2. Ziel-Kategorie wählen (Dropdown, nur Kategorien des aktuellen 
   property)
3. Optional: Wirtschaftsjahr, Marker
4. Bei Sendung (Mailing): Mapping-Modus wählen
   - **Auto-Match per Dateiname**: Pattern-Eingabe 
     (z.B. `Abrechnung_{year}_Einheit_{unit_number}.pdf`) → Preview 
     der Zuordnung in Tabelle
   - **CSV-Mapping**: Upload einer Mapping-CSV
5. Upload-Button → ruft `bulk_upload_documents` RPC auf
6. Progress-Bar mit Per-File-Status
7. Nach Abschluss: Zusammenfassung mit Erfolg/Fehler-Liste, 
   "Sendung als Batch speichern"-Option

UX: Beim Auto-Match unbedingt **Preview-Tabelle vor Upload** zeigen 
("Diese Datei wird Einheit X zugeordnet"). Verwalter müssen das 
bestätigen, sonst gibt's Chaos.

### 5. `<BatchManagementPage />` (nur Verwalter)

Liste aller `document_batches`. Pro Batch:
- Name, Typ, Anzahl Dokumente, Erstellt-Datum, Status
- Aktionen: Anzeigen (zeigt alle Docs des Batches), 
  **Komplett zurücknehmen** (Confirm-Dialog: "X Dokumente werden 
  endgültig gelöscht"), als CSV exportieren

### 6. `<DocumentSearchResults />`

Wird in `DocumentOverviewPage` eingeblendet, sobald User in der 
SearchBar tippt (>= 2 Zeichen). Ersetzt das Kategorien-Grid.
- Liste mit highlighted matches
- Pro Treffer: Titel, Kategorie-Pfad, Snippet, Score
- Klick → öffnet Vorschau-Modal direkt

### 7. Shared / Util

- `<RoleGuard requiredRole="admin">{children}</RoleGuard>` – versteckt 
  Komponenten basierend auf User-Rolle (aus Supabase JWT/CRM 
  contact_roles)
- `useCurrentUserRole(propertyId)` – Hook, der höchste Rolle des Users 
  für ein property zurückgibt
- `formatFileSize(bytes)` – kB/MB/GB
- `formatDate(date, locale)` – mit i18n
- `getCategoryIcon(categoryCode)` – optional, kleine Icons pro Kategorie

## Internationalisierung

Alle UI-Strings über `react-i18next` mit Namespaces `dms.common`, 
`dms.categories`, `dms.upload`. Sprachen DE/EN/RU. **Standard ist DE**.

Kategorie-Namen kommen aus DB (`document_categories.name_de/en/ru`), 
nicht aus i18n-Files.

## State-Management

- Server-State: ausschließlich TanStack Query
- UI-State: useState/useReducer pro Komponente
- Kein Redux, kein Zustand, kein globaler State-Manager
- Cache-Keys konsequent: `['documents', propertyId, categoryId]`, 
  `['categories', propertyId]`, `['batches', propertyId]`
- Invalidation nach Mutationen (Upload, Delete) explizit

## Performance

- Liste mit > 100 Dokumenten: Virtualisierung mit `@tanstack/react-virtual`
- PDF-Vorschau: lazy-load (`React.lazy` für `react-pdf`)
- Bilder: `loading="lazy"`
- Suche: debounced 300ms
- Counter im Overview: aus RPC, nicht client-seitig zählen

## Accessibility

- Alle interaktiven Elemente keyboard-bedienbar
- ARIA-Labels für Icon-Only-Buttons
- Modal: Focus-Trap, ESC zum Schließen
- Kontraste WCAG AA (Orange auf Weiß checken!)
- Screenreader-Texte für Counter ("14 Dokumente in Kategorie 
  Protokolle")

## Fehlerbehandlung

- Globaler Error-Boundary
- Toast-Notifications via shadcn/ui `<Toaster />`
- Bei Upload-Fehlern: Per-File-Status, Retry-Button
- Bei Permission-Fehler: klarer Hinweis "Sie haben keinen Zugriff auf 
  dieses Dokument" + Kontakt-Link zum Verwalter
- Network-Errors: Retry mit exponential backoff über React Query

## Mobile

Responsive ab 320px. Auf Mobil:
- Grid → 1 Spalte
- Vorschau-Modal → vollbild, Properties-Panel als Bottom-Sheet
- Upload → vereinfacht (kein Drag-Drop, nur File-Picker)

## Testing

- Vitest + React Testing Library
- Pro Komponente mind. 1 Render-Test + 1 Interaktions-Test
- MSW für Supabase-Mocks
- E2E-Tests (Playwright) für die kritischen Flows: 
  Übersicht → Vorschau → Download, Massenupload mit Auto-Match

## Designprinzipien (zusammengefasst)
- **Wie HausPerfekt nur besser**: Hausverwalter kennen die 
  Strukturen – nicht neu erfinden, aber moderner und schneller
- **Zero-Configuration**: Verwalter loggt sich ein und kann sofort 
  hochladen, keine Setup-Schritte
- **Counter überall**: Hausverwalter wollen auf einen Blick sehen, 
  was wo liegt
- **Audit-Transparenz**: Jeder Zugriff geloggt, Verwalter kann das 
  einsehen (späteres Modul)

## Output-Format
1. Plan: Welche Dateien/Komponenten werden erstellt (Tree)
2. `tailwind.config.ts` Erweiterungen (primary color, etc.)
3. `src/types/dms.ts` (falls nicht aus Backend-Generator vorhanden)
4. Komponenten in `src/features/dms/` (eine Datei pro Komponente, 
   plus index.ts)
5. Hooks in `src/features/dms/hooks/`
6. Routing-Setup in `src/router.tsx`
7. i18n-Strings in `src/locales/{de,en,ru}/dms.json`
8. Storybook-Stories für die Hauptkomponenten (optional, falls SB 
   vorhanden)
9. README im Feature-Ordner mit Übersicht der Komponenten

## Nicht in diesem Schritt
- E-Signatur-UI
- Audit-Log-Viewer (separater Prompt)
- Verwalter-Übergabe-UI (separater Prompt – kritischer Flow, eigener 
  Sprint wert)
- Notification-Center
- Mobile App (React Native)