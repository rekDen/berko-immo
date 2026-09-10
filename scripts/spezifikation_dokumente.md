# Spezifikation: Akturio-Modul „Dokumente"

**Version:** 1.0 (Entwurf)
**Stand:** Juli 2026
**Kontext:** Akturio (Supabase / Next.js), Supabase Storage. Eigenständige Dateiablage.

---

## 1. Ziel und Abgrenzung

Füge ein neues Modul unter dem Navigationspunkt **„Dokumente"** hinzu: eine freie,
Explorer-artige Dateiablage pro Mandant. Nutzer verwalten hier beliebige Dateien in
einem selbst angelegten Ordnerbaum — vergleichbar mit einer Cloud-Dateiablage
(Dropbox / Google Drive / Windows Explorer).

**In Scope (v1):**

- Dateien hochladen (per **Drag & Drop** und über einen Datei-Dialog)
- **Ganze Ordner** (inkl. Unterordner und enthaltener Dateien) hochladen — per
  **Drag & Drop** des Ordners oder über einen Ordner-Dialog; die Ordnerstruktur
  wird dabei automatisch nachgebildet
- Dateien **umbenennen** und **löschen**
- **Ordner und Unterordner** beliebiger Tiefe erstellen, umbenennen, löschen
- Dateien und Ordner per **Drag & Drop** verschieben
- Navigation im Ordnerbaum (Breadcrumb + Baum), Dateiliste je Ordner
- Vorschau / Download einzelner Dateien
- Namenssuche über Ordner und Dateien

**Out of Scope (v1):**

- Verknüpfung mit Immobilien, Objekten, Verträgen, Mietern o. Ä.
  Dieses Modul ist **bewusst domänenfrei** — es kennt keine Ebenen
  `property` / `unit` / `contract` und keine Dokumentkategorien-Taxonomie.
  Der bestehende immobilienbezogene DMS (`documents`, `document_categories`)
  bleibt davon **vollständig getrennt** (siehe §11).
- Versionierung / Dateihistorie, Kommentare, externe Freigabe-Links,
  Volltext-/Inhaltssuche, Papierkorb-Wiederherstellungs-UI (nur Soft-Delete
  im Datenmodell vorbereitet).

---

## 2. Architekturprinzipien (verbindlich)

1. **Eigene, entkoppelte Tabellen.** Das Modul nutzt **nicht** die bestehende
   `documents`-Tabelle (die ist an `property/unit/contract` und eine feste
   Kategorien-Taxonomie gebunden). Stattdessen zwei schlanke, domänenfreie
   Tabellen: `folders` (Ordnerbaum) und `files` (Dateien).

2. **Ordnername ≠ Speicherpfad.** Storage-Pfade nutzen ausschließlich UUIDs.
   Dadurch sind **Umbenennen** und **Verschieben** reine Metadaten-Updates —
   es wird nie eine Datei im Storage umkopiert.

3. **Baum über `parent_id`.** Ordner sind selbstreferenzierend; Wurzelordner
   haben `parent_id = null`. Dateien hängen an genau einem Ordner (`folder_id`,
   `null` = Wurzel).

4. **Multi-Tenant via Supabase RLS.** Alles ist über `tenant_id` isoliert,
   analog zum bestehenden Akturio-Schema (`current_tenant_id()`,
   `is_tenant_admin()`).

5. **Soft-Delete.** Löschen setzt `deleted_at`; die physische Storage-Bereinigung
   erfolgt asynchron. So bleibt versehentliches Löschen technisch reversibel.

---

## 3. Tech-Stack

| Schicht | Technologie |
|---|---|
| Datenbank | Supabase / PostgreSQL, RLS pro Mandant |
| Storage | Supabase Storage, privater Bucket (`documents`, bestehend) |
| Backend | Next.js Route Handler (`src/app/api/...`), `withAuth`, Supabase-Client |
| Frontend | Next.js / React (Ordnerbaum, Dateiliste, Drag & Drop) |
| Tests | Vitest (API-Handler, RLS-Zugriff), Golden-Path-Tests für Move/Rename |

---

## 4. Datenmodell

### 4.1 Ordner

```sql
create table folders (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id),
  parent_id   uuid references folders(id) on delete cascade,  -- null = Wurzel
  name        text not null,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id),
  deleted_at  timestamptz,
  deleted_by  uuid references auth.users(id)
);

-- Kein doppelter Ordnername innerhalb desselben Elternordners (nur aktive)
create unique index uq_folders_sibling_name
  on folders (tenant_id, parent_id, lower(name))
  where deleted_at is null;

create index idx_folders_tenant_parent on folders (tenant_id, parent_id);
```

> `parent_id ... on delete cascade`: das physische Löschen eines Ordners entfernt
> Unterordner mit. Im Normalbetrieb wird jedoch **soft-deleted** (siehe §8).

### 4.2 Dateien

```sql
create table files (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id),
  folder_id     uuid references folders(id) on delete cascade,  -- null = Wurzel
  name          text not null,          -- Anzeigename inkl. Endung (umbenennbar)
  storage_path  text not null,          -- {tenant_id}/files/{file_id}.{ext}
  file_size     bigint,
  mime_type     text,
  file_hash     text,                   -- optional, Dedupe / Integrität
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id),
  deleted_at    timestamptz,
  deleted_by    uuid references auth.users(id)
);

create unique index uq_files_sibling_name
  on files (tenant_id, folder_id, lower(name))
  where deleted_at is null;

create index idx_files_tenant_folder on files (tenant_id, folder_id);
create index idx_files_hash on files (file_hash) where file_hash is not null;
```

### 4.3 Pfadschema im Storage

```
{tenant_id}/files/{file_id}.{ext}
```

- Flach je Mandant, ohne Ordnerstruktur im Storage — die Ordnerhierarchie lebt
  ausschließlich in der DB (`folders.parent_id`, `files.folder_id`).
- Deckt sich mit der bestehenden Storage-RLS: erstes Pfadsegment = `tenant_id`
  (siehe `migration-storage-bucket.sql`), daher ist **kein neuer Bucket nötig**.

---

## 5. Kernfunktionen

### 5.1 Ordner

| Funktion | Verhalten |
|---|---|
| **Erstellen** | Neuer `folders`-Datensatz mit `parent_id` = aktueller Ordner (oder `null`). Bei Namenskonflikt → Fehler bzw. automatisches Suffix „(2)". |
| **Unterordner** | Identisch zu „Erstellen", nur mit gesetztem `parent_id`. Beliebige Tiefe. |
| **Umbenennen** | `UPDATE folders SET name = ...` — reines Metadaten-Update, kein Storage-Zugriff. Unique-Index verhindert Duplikate. |
| **Verschieben** | `UPDATE folders SET parent_id = ...` (Drag & Drop). Zyklus-Schutz: Ziel darf kein Nachfahre sein (§7.2). |
| **Löschen** | Soft-Delete: `deleted_at` auf Ordner **und** rekursiv auf alle Unterordner + enthaltene Dateien setzen. |

### 5.2 Dateien

| Funktion | Verhalten |
|---|---|
| **Hochladen** | Datei → Storage (`{tenant_id}/files/{uuid}.{ext}`), dann `files`-Datensatz mit `folder_id` des aktuellen Ordners. Mehrfachauswahl + Drag & Drop mehrerer Dateien gleichzeitig. |
| **Umbenennen** | `UPDATE files SET name = ...` — nur Anzeigename, `storage_path` bleibt unverändert. |
| **Verschieben** | `UPDATE files SET folder_id = ...` (Drag & Drop in Zielordner). |
| **Löschen** | Soft-Delete (`deleted_at`); physische Storage-Löschung asynchron. |
| **Download / Vorschau** | Signierte Storage-URL (kurzlebig) über den Route Handler. |

### 5.3 Ordner-Upload (rekursiv)

Neben einzelnen Dateien kann ein **kompletter Ordner samt Unterordnern und
Dateien** in einem Vorgang hochgeladen werden. Die Ordnerstruktur des Quell-
Ordners wird unterhalb des Zielordners im Modul **nachgebildet**.

**Ablauf:**

1. **Quelle erfassen.** Zwei Wege im Browser (siehe „Implementierungsdetails"):
   - **Datei-Dialog:** `<input type="file" webkitdirectory>` liefert alle Dateien
     eines gewählten Ordners inkl. Unterordnern; jede Datei trägt ihren relativen
     Pfad in `webkitRelativePath` (z. B. `Projekt/Anlagen/foto.jpg`).
   - **Drag & Drop:** über `DataTransferItem.webkitGetAsEntry()` wird der abgelegte
     `FileSystemDirectoryEntry` **rekursiv** durchlaufen; für jede Datei entsteht
     ein relativer Pfad.
2. **Struktur ableiten.** Aus den relativen Pfaden werden die benötigten
   Ordner-Ebenen bestimmt (Verzeichnis-Präfixe, dedupliziert).
3. **Ordner sicherstellen.** Der Client legt die Pfad-Segmente an bzw. verwendet
   vorhandene gleichnamige Ordner wieder (Merge, idempotent) — über den Endpunkt
   `POST /api/folders/ensure-path` (§6), der einen Pfad relativ zu einem
   Zielordner auflöst und die `folder_id` des Blattordners zurückgibt.
4. **Dateien hochladen.** Jede Datei wird mit der ermittelten `folder_id` ihres
   Elternordners hochgeladen (bestehender `POST /api/files/upload`).

**Regeln:**

- Bestehende gleichnamige Ordner werden **zusammengeführt**, nicht dupliziert.
- **Leere (Unter-)Ordner bleiben erhalten** — ein Verzeichnis wird auch dann
  angelegt, wenn es keine Dateien enthält.
- Namenskonflikt bei Dateien wie beim Einzel-Upload (§13): Fehler bzw. „(2)"-Suffix.
- Fortschritt wird über alle Dateien hinweg angezeigt; einzelne Fehlschläge
  brechen den Gesamtvorgang **nicht** ab (Retry pro Datei).
- Verborgene System-Dateien werden übersprungen: `.DS_Store`, `Thumbs.db`,
  `desktop.ini` sowie macOS-Resource-Forks (`._*`).

**Implementierungsdetails (verbindlich):**

1. **Entries synchron erfassen.** `DataTransferItem.webkitGetAsEntry()` **muss im
   Drop-Handler synchron** aufgerufen werden — `dataTransfer` wird nach dem ersten
   `await` ungültig. Die erhaltenen `FileSystemEntry`-Objekte bleiben danach gültig
   und werden anschließend asynchron abgearbeitet.
2. **Reihenfolge im Drop-Handler.** Zuerst interner Move prüfen
   (`dataTransfer.getData("application/x-dokument")`), sonst Entries einsammeln
   (externer Ordner-/Datei-Drop), sonst Fallback auf `dataTransfer.files`
   (Browser ohne Entry-API → flacher Datei-Upload ohne Struktur).
3. **Rekursive Traversierung.**
   - Datei-Entry → `entry.file()` (Callback → Promise) → `POST /api/files/upload`
     mit der `folder_id` des Elternordners.
   - Verzeichnis-Entry → `ensure-path([entry.name])` unter dem Elternordner, dann
     Kinder rekursiv.
   - `directoryReader.readEntries()` liefert nur **Batches** (~100 Einträge);
     bis zur leeren Antwort weiterlesen.
4. **Dialog-Weg (`webkitdirectory`).** Pro Datei das Verzeichnis-Präfix aus
   `webkitRelativePath` nehmen und via `ensure-path` auflösen; die Zuordnung
   Pfad → `folder_id` **cachen**, sodass pro Ordner nur **ein** `ensure-path`-Aufruf
   erfolgt (nicht pro Datei). Das nicht-standardisierte Attribut `webkitdirectory`
   wird in React per `ref.setAttribute(...)` gesetzt.
5. **Fehlerbehandlung.** Jeder `fetch` (Upload **und** `ensure-path`) läuft in
   `try/catch`; Netzwerkfehler landen im UI-Fehlerbanner statt als
   `unhandledRejection`. Ein einzelner Datei-Fehlschlag bricht den Gesamtvorgang
   nicht ab.

```
onDrop(targetFolderId):
  if internalMove: move(...); return
  entries = [ item.webkitGetAsEntry() for item in dataTransfer.items ]   # SYNCHRON
  await uploadEntries(entries, targetFolderId)

walkEntry(entry, parentId):
  if entry.isFile:
    if isJunk(entry.name): return
    file = await entry.file()
    await upload(file, parentId)
  else if entry.isDirectory:
    folderId = await ensurePath(parentId, [entry.name])     # merge/idempotent
    for child in await readAllEntries(entry):               # readEntries batchweise
      await walkEntry(child, folderId)
```

### 5.4 Drag & Drop (verbindliche Fälle)

1. **Dateien vom Desktop** in den Ordnerbereich → Upload in den aktuellen bzw.
   den Ziel-Ordner (Drop-Target hebt sich visuell hervor).
2. **Ordner vom Desktop** in den Ordnerbereich → rekursiver Ordner-Upload (§5.3)
   unterhalb des Ziel-Ordners.
3. **Datei(en) im Explorer** auf einen anderen Ordner ziehen → Verschieben.
4. **Ordner im Explorer** auf einen anderen Ordner ziehen → als Unterordner einhängen.
5. Drop auf Breadcrumb-Segment oder „Wurzel" → in die jeweilige Ebene verschieben.

---

## 6. API-Endpunkte (Next.js Route Handler)

Muster wie bestehende Handler in `src/app/api/documents` (`withAuth`, RLS über
Supabase-Client, `createAdminClient` nur wo nötig).

```
# Ordner
GET    /api/folders?parent_id=            Kinder eines Ordners (null = Wurzel)
GET    /api/folders/tree                  gesamter Baum (für Navigations-Sidebar)
POST   /api/folders                       Ordner anlegen { name, parent_id }
POST   /api/folders/ensure-path           Pfad auflösen/anlegen { parent_id, segments: string[] }
                                           → { folder_id } des Blattordners (Merge, idempotent)
PATCH  /api/folders/:id                   umbenennen { name } | verschieben { parent_id }
DELETE /api/folders/:id                   Soft-Delete (rekursiv)

# Dateien
GET    /api/files?folder_id=              Dateien eines Ordners
POST   /api/files/upload                  Upload → Storage + files-Datensatz
PATCH  /api/files/:id                     umbenennen { name } | verschieben { folder_id }
DELETE /api/files/:id                     Soft-Delete
GET    /api/files/:id/download            signierte, kurzlebige Download-URL

# Suche
GET    /api/documents/search?q=           Namenssuche über folders + files (Mandant)
```

**Validierungen (serverseitig):**
- Name nicht leer, keine Pfadtrenner (`/`, `\`), Längenlimit.
- `parent_id` / `folder_id` gehören demselben Mandanten.
- Verschiebe-Zyklus-Prüfung für Ordner (§7.2).
- Namenskonflikt → `409` mit Vorschlag „(2)".
- `ensure-path { parent_id, segments[] }`: jedes `segments`-Element wird wie ein
  Ordnername validiert. Der Endpunkt läuft **Segment für Segment** ab `parent_id`:
  1. Geschwister-Ordner der aktuellen Ebene laden und den Namen
     **case-insensitiv** vergleichen (deckungsgleich mit dem Unique-Index auf
     `lower(name)`); gefunden → dessen `id` wird neuer Elternknoten.
  2. Sonst anlegen; bei Unique-Verletzung (`23505`, paralleler Upload legte
     denselben Ordner an) erneut suchen und den vorhandenen verwenden.
  Dadurch ist der Aufruf **idempotent** und race-fest; Rückgabe ist die
  `folder_id` des Blattordners.

---

## 7. RLS & Integrität

### 7.1 Row Level Security

```sql
alter table folders enable row level security;
alter table files   enable row level security;

-- Lesen: eigener Mandant, nicht gelöscht
create policy folders_select on folders for select to authenticated
  using (tenant_id = current_tenant_id() and deleted_at is null);
create policy files_select on files for select to authenticated
  using (tenant_id = current_tenant_id() and deleted_at is null);

-- Schreiben (insert/update/delete): Mandant + Tenant-Admin, analog Storage-Policy
create policy folders_write on folders for all to authenticated
  using (tenant_id = current_tenant_id() and is_tenant_admin())
  with check (tenant_id = current_tenant_id() and is_tenant_admin());
create policy files_write on files for all to authenticated
  using (tenant_id = current_tenant_id() and is_tenant_admin())
  with check (tenant_id = current_tenant_id() and is_tenant_admin());
```

> Rollenmodell an das bestehende Schema angleichen: falls auch Nicht-Admins
> hochladen dürfen sollen, `is_tenant_admin()` gegen die passende Rollenprüfung
> tauschen. Storage-RLS (`documents`-Bucket) deckt den Pfad bereits über
> `tenant_id` ab.

### 7.2 Zyklus-Schutz beim Ordner-Verschieben

Beim `PATCH /api/folders/:id { parent_id }` sicherstellen, dass `parent_id` weder
der Ordner selbst noch einer seiner Nachfahren ist (rekursive `WITH RECURSIVE`-
Abfrage oder Baum-Prüfung im Handler). Verstoß → `400`.

---

## 8. Löschverhalten

- **Soft-Delete** setzt `deleted_at` / `deleted_by`. Bei Ordnern rekursiv auf
  Unterordner und enthaltene Dateien anwenden (rekursive Query oder Trigger).
- Gelöschte Objekte verschwinden aus allen Standard-Queries (RLS `deleted_at is null`).
- **Storage-Bereinigung** asynchron: )

---

## 9. Frontend (Next.js / React)

Route: `src/app/(app)/dokumente/`

1. **Zweispaltiges Explorer-Layout:** links Ordnerbaum (aufklappbar), rechts
   Dateiliste des gewählten Ordners.
2. **Breadcrumb** über der Dateiliste (Wurzel › Ordner › Unterordner …).
3. **Toolbar:** „Neuer Ordner", „Dateien hochladen", „Ordner hochladen",
   Suchfeld, Ansichtsumschaltung (Liste / Kacheln).
   - „Dateien hochladen": `<input type="file" multiple>`.
   - „Ordner hochladen": `<input type="file" webkitdirectory>` (Ordnerwahl inkl.
     Unterordner).
4. **Drag & Drop:**
   - Desktop-**Dateien** → Upload-Zone (ganzer Dateibereich als Drop-Target,
     Overlay „Zum Hochladen ablegen").
   - Desktop-**Ordner** → rekursiver Ordner-Upload: der abgelegte Verzeichnis-
     Eintrag wird per `webkitGetAsEntry()` durchlaufen, die Struktur über
     `ensure-path` nachgebildet, Dateien in ihre Zielordner geladen (§5.3).
   - Zeilen/Kacheln auf Ordner (Baum oder Liste) ziehen → Verschieben, mit
     Hover-Highlight des Drop-Ziels.
5. **Kontextmenü / Zeilenaktionen:** Umbenennen (Inline-Edit), Verschieben,
   Herunterladen, Löschen. Mehrfachauswahl für Batch-Verschieben/-Löschen.
6. **Upload-Fortschritt:** pro Datei über den gesamten (auch mehrstufigen)
   Upload-Vorgang hinweg, mit Fehler-Retry je Datei.
7. **Optimistic UI** für Rename/Move (Rollback bei Serverfehler).

Empfohlene Bibliothek für Drag & Drop: bestehende Projektkonvention prüfen;
sonst native HTML5 Drag-and-Drop-Events plus Datei-`drop` und
`DataTransferItem.webkitGetAsEntry()` für den rekursiven Ordner-Upload
(keine zusätzliche Abhängigkeit zwingend nötig).

---

## 10. Teststrategie

- **API-Handler (Vitest):** Anlegen/Umbenennen/Verschieben/Löschen für Ordner
  und Dateien; Namenskonflikt (`409`), Zyklus-Schutz (`400`), Cross-Tenant-Zugriff
  (`403`/leer).
- **Soft-Delete-Rekursion:** Ordner mit Unterbaum löschen → alle Nachfahren
  `deleted_at` gesetzt, nichts mehr sichtbar.
- **Rename/Move ohne Storage-Bewegung:** Assert, dass `storage_path` unverändert
  bleibt.
- **`ensure-path` / Ordner-Upload:** verschachtelter Pfad wird korrekt angelegt;
  wiederholter Aufruf mit gleichem Pfad legt **nicht** doppelt an (idempotent);
  Merge in vorhandenen gleichnamigen Ordner (auch bei abweichender Groß-/
  Kleinschreibung); leere (Unter-)Ordner bleiben erhalten; System-Dateien
  (`.DS_Store`, `Thumbs.db`, `desktop.ini`, `._*`) werden übersprungen;
  paralleler Upload desselben Pfads (`23505`) erzeugt keine Duplikate.
- **RLS:** Zugriff eines fremden Mandanten liefert keine Zeilen; Upload in
  fremden Tenant-Pfad wird durch Storage-Policy blockiert.

---

## 11. Verhältnis zum bestehenden DMS (`documents`)

Das immobilienbezogene DMS (`documents`, `document_categories`, `document_markers`,
`document_batches`, `document_handovers`) bleibt **unberührt**. Es unterscheidet sich
bewusst:

| | Modul „Dokumente" (dieses Dokument) | DMS `documents` |
|---|---|---|
| Struktur | freier Ordnerbaum (`folders`) | feste Kategorie-Taxonomie |
| Bezug | domänenfrei, nur Mandant | `property` / `unit` / `contract` |
| Zweck | allgemeine Dateiablage | strukturierte Objektunterlagen |

Beide teilen sich lediglich den privaten Storage-Bucket `documents` (getrennte
Pfad-Präfixe: `.../files/...` vs. `.../property|unit|contract/...`). Keine
gemeinsamen Tabellen, keine Fremdschlüssel zwischen den Modulen.

---

## 12. Umsetzungs-Roadmap

**Phase 1 — MVP:** Tabellen `folders` / `files` + RLS, Storage-Upload, Ordner-CRUD,
Datei-CRUD (inkl. Umbenennen/Löschen), Explorer-UI mit Baum + Liste, Drag & Drop
für Upload und Verschieben, **rekursiver Ordner-Upload** (`ensure-path` + Datei-Dialog
`webkitdirectory` + Drag & Drop ganzer Ordner).

**Phase 2 — Komfort:** Mehrfachauswahl/Batch, Suche, Kachelansicht,
Sortierung/`sort_order`, Optimistic UI, Upload-Retry.

**Phase 3 — Lifecycle:** Papierkorb-UI (Wiederherstellen), asynchrone
Storage-Bereinigung, Dedupe über `file_hash`, optional Vorschau-Thumbnails.

---

## 13. Offene Punkte / Annahmen

- **Berechtigung:** Dürfen nur Tenant-Admins schreiben (wie Storage-Policy) oder
  auch weitere Rollen? RLS entsprechend anpassen.
- **Namenskonflikt-Strategie:** Fehler vs. automatisches „(2)"-Suffix final festlegen.
- **Upload-Größenlimit / erlaubte MIME-Typen** definieren.
- **Storage-Bucket:** Wiederverwendung von `documents` vs. eigener Bucket `files`
  — v1 nutzt `documents` mit Pfad-Präfix `files/`.
- **Ordner-Upload — Browser-Support:** `webkitdirectory` und
  `webkitGetAsEntry()` werden von allen aktuellen Desktop-Browsern unterstützt,
  auf Mobil-Browsern jedoch nur eingeschränkt. Fallback: normaler Mehrfach-Datei-
  Upload ohne Struktur. Sehr große Ordner ggf. in Batches / mit Parallelitäts-
  Begrenzung hochladen.
