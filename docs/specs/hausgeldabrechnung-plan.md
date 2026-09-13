# Plan: Modul „WEG-Jahresabrechnung" — Meilenstein 0

| | |
|---|---|
| Bezieht sich auf | `scripts/hausgeldabrechnung-spec.md` (Version 0.1) |
| Meilenstein | M0 — Analyse und Plan |
| Status | **M0 abgeschlossen. Update 2026-09-12: Die hier empfohlene Vorab-Spezifikation ist inzwischen fertig umgesetzt — siehe Abschnitt 9.** |
| Datenbasis | Live-Introspektion des Supabase-Projekts `jrqwtoizjwigwrokhrut` (Service-Role, `select * limit 1` je Tabelle) am 2026-09-11, abgeglichen mit `supabase-schema.sql` und den `scripts/migration-*.sql`-Dateien |

> Hinweis zur Methodik: `supabase-schema.sql` ist **nicht vollständig aktuell**. Mehrere Migrationen (u. a. `migration-optimization.sql`, `migration-optimization-finanzierung.sql`, `migration-properties-stammdaten.sql`) wurden offenbar direkt im Supabase-SQL-Editor ausgeführt (siehe Kommentar in `migration-optimization-finanzierung.sql`: „Im Supabase SQL-Editor des Projekts … ausführen“) und sind in der eingecheckten Schemadatei nicht nachgezogen. Alle Aussagen unten zu vorhandenen Spalten beruhen deshalb auf der **Live-Introspektion**, nicht auf `supabase-schema.sql` allein. Diese Diskrepanz selbst ist ein Befund von M0 (siehe Offene Fragen, Q1).

---

## 1. Mapping der Entitäten (Kapitel 6) auf die bestehende Codebasis

Status-Legende: ✅ vorhanden/passend · 🟡 teilweise vorhanden, Lücke bleibt · ⛔ nicht vorhanden

| Spec-Entität (6.2) | Codebasis | Status | Bemerkung |
|---|---|---|---|
| `Property` | `properties` | ✅ | `id, tenant_id, name, street, house_number, zip_code, city, type, ...`. Zusätzlich bereits vorhanden: `is_weg boolean`, `monthly_reserve`, `monthly_operating_costs`, `monthly_management_costs` (siehe 2.3). `type` kennt bereits den Wert `'weg'`. |
| `Unit` (inkl. `coOwnershipShare`, `livingArea`) | `units` | ✅ | `mea numeric(10,4)` = `coOwnershipShare`, `area numeric(10,2)` = `livingArea`, `unit_number` = `number`. Kein eigenes `sortKey`-Feld — `unit_number` ist Freitext (z. B. „W01“, „M06“, „G03“); natürliche Sortierung (5.11 Regel 3) muss im Code erfolgen, nicht per DB-Spalte. `kind` fehlt 1:1 (DB-Enum ist `apartment/commercial/parking/storage/other` statt `APARTMENT/COMMERCIAL/PARKING/OTHER` — inhaltlich deckungsgleich, nur andere Schreibweise). |
| `Owner` | `contacts` (`type in ('natural_person','legal_entity')`) | ✅ | Keine eigene `Owner`-Tabelle nötig — die Codebasis modelliert „Eigentümer" grundsätzlich als Rolle (`contact_roles.role = 'owner'`) auf einem generischen `contacts`-Datensatz, nicht als eigene Entität. Für den Rechenkern reicht die Projektion `{id, name, postalAddress, email}` aus `contacts` + zugehöriger `addresses`/`emails` JSONB-Spalte. |
| `Ownership` | `contact_roles` (Rolle `owner`) | ✅ | `contact_id, unit_id, valid_from, valid_to` sind exakt vorhanden. `is_primary` (z. B. bei Ehepaaren/Miteigentümern) ist ein Bonus, den die Spec nicht kennt — im Mapping berücksichtigen (Miteigentümer mit `is_primary=false` sind trotzdem Adressat/Schuldner, s. 5.7). |
| `AllocationKey` / `AllocationKeyValue` | — | ⛔ | Keine Entsprechung. Nächstliegend ist `units.mea` (deckt nur `CO_OWNERSHIP` ab) und `units.area` (`AREA`). `UNIT_COUNT` ist implizit ableitbar. `PERSONS`, `CONSUMPTION`, `CUSTOM` sowie zeitlich gültige Werte (5.3.2) fehlen vollständig. **Neue Tabellen nötig.** |
| `CostType` | — | ⛔ | Keine Kostenarten-Verwaltung vorhanden. `document_categories` ist eine Dokumenten-Taxonomie, keine Buchungs-/Kostenartenkategorisierung, und ist außerdem eine globale System-Tabelle (nicht `tenant_id`-, geschweige denn `property_id`-spezifisch) — ungeeignet als Basis. **Neue Tabelle nötig**, inkl. `apportionable`, `betrkvNo`, `isHeating`, `allowsDirectCharge`. |
| `BankAccount` (objektbezogen, `kind: OPERATING\|RESERVE`) | `bank_accounts` | 🟡 | Tabelle existiert, ist aber **kontaktbezogen**: `contact_id uuid not null`, Zweck ist das SEPA-Mandat eines Eigentümers/Mieters für Lastschrifteinzug (siehe Verwendung in den Seed-Skripten: je Eigentümer ein Konto mit `sepa_mandate_*`). Es gibt weder `property_id` noch `kind`. Eine WEG-eigene Konto (Bewirtschaftungs-/Rücklagenkonto der Gemeinschaft) lässt sich darin nicht abbilden, ohne die bestehende Bedeutung zu verwässern. **Neue Tabelle empfohlen** (z. B. `community_bank_accounts`), bestehende `bank_accounts` bleibt unverändert für SEPA-Mandate. |
| `BalanceConfirmation` | — | ⛔ | Keine Kontoauszugssalden-Erfassung vorhanden. |
| `Transaction` (Buchungen) | — | ⛔ | **Zentraler Befund**: Es existiert keine Buchhaltung/Ledger-Tabelle. Weder `transactions`, `buchungen`, `bookings` noch ein Bankimport (CAMT.053 o. ä.) sind vorhanden (live geprüft — Tabellen existieren nicht). Details siehe Lückenanalyse Abschnitt 2. |
| `EconomicPlan` / `PlanAdvance` | `contracts` (`type = 'management_weg'`, Feld `hausgeld numeric(10,2)`) | 🟡 | Sehr schwache Entsprechung. `contracts.hausgeld` ist ein **einzelner** Betrag auf einem Verwaltervertrag, der an genau eine `contact_role_id` (i. d. R. eine beliebige Eigentümerrolle) hängt — kein strukturierter Wirtschaftsplan mit Soll-Vorschüssen **je Einheit**, keine Gültigkeitszeiträume für unterjährige Änderungen (5.4.6), keine Trennung Bewirtschaftung/Rücklage. In den Seed-Daten (`seed-chemnitz-daniel.sql`, `seed-leipzig-koehler.ts`) wird das Feld erkennbar nur repräsentativ befüllt, nicht operativ genutzt. **Neue Tabellen nötig.** Zusätzlich existieren am Objekt bereits `monthly_reserve` und `monthly_operating_costs` (property-weit, kein Bezug zur Einheit, keine Historie) — ebenfalls keine geeignete Grundlage, aber ggf. als Anfangswert für eine Migration der Bestandsdaten interessant. |
| `SpecialLevy` / `SpecialLevyUnit` | — | ⛔ | Keine Entsprechung. |
| `HeatingImport` / `HeatingImportUnit` | — | ⛔ | Keine Entsprechung. `units.heating_type` ist nur ein Freitextfeld zur Heizungsart, kein Kosten-/Verbrauchsimport. |
| `AssetItem` / `LiabilityItem` | — | ⛔ | Keine Entsprechung. |
| `Settlement` / `SettlementUnit` / `SettlementComment` / `CheckAcknowledgement` | — | ⛔ | Erwartungsgemäß neu — das ist der Kern des Moduls selbst. |
| Audit-Logging | `audit_log` + `log_audit()` | ✅ | Generische `audit_log`-Tabelle (`tenant_id, user_id, action, entity_type, entity_id, metadata`) mit RPC `log_audit()`. Direkt wiederverwendbar für Statuswechsel, Quittierungen, Exporte (8.1 letzter Satz). |

**Zusätzlich vorhandene, für das Modul potenziell relevante Nachbar-Entität:** `mietvertrag` (deutschbenannte, schlanke Tabelle: `id, tenant_id, unit_id, mietart, kaltmiete_eur, beginn, letzte_erhoehung, leerstand`), genutzt ausschließlich vom Bestandsentwicklungs-Modul (`src/lib/optimization`). Sie ist **nicht** dasselbe wie `contracts` (die reichere, contact-role-basierte Vertragstabelle) und hat keinen fachlichen Bezug zur Hausgeldabrechnung (Mietverhältnisse einzelner Einheiten, nicht WEG-Bewirtschaftung). Nur zur Einordnung erwähnt, damit keine Verwechslung mit `contracts` entsteht.

---

## 2. Lückenanalyse nach 3.3

Kapitel 3.3 der Spezifikation nennt als Voraussetzung: *Objekt, Einheiten mit MEA (ggf. Fläche), Eigentümer mit Eigentumszeiträumen, Bankkonten (Bewirtschaftung, Rücklage), Buchungen des Jahres mit Buchungstag und Zuordnung, beschlossener Wirtschaftsplan mit Vorschüssen je Einheit, Kontoauszugssalden zum 31.12.*

| Voraussetzung | Status | Befund |
|---|---|---|
| Objekt | ✅ vollständig | `properties`, inkl. `is_weg`-Flag zur Abgrenzung WEG/Miethaus |
| Einheiten mit MEA (ggf. Fläche) | ✅ vollständig | `units.mea`, `units.area` |
| Eigentümer mit Eigentumszeiträumen | ✅ vollständig | `contacts` + `contact_roles` (Rolle `owner`, `valid_from`/`valid_to`) |
| Bankkonten der Gemeinschaft (Bewirtschaftung, Rücklage) | 🟡 nicht in benötigter Form | `bank_accounts` ist personenbezogen (SEPA-Mandate), nicht objektbezogen mit `kind` |
| **Buchungen des Jahres mit Buchungstag und Zuordnung** | ⛔ **fehlt vollständig** | Keine Ledger-/Transaktionstabelle, kein Bankimport, kein Buchungsworkflow irgendeiner Art in der gesamten Codebasis |
| Beschlossener Wirtschaftsplan mit Vorschüssen je Einheit | ⛔ **fehlt im Kern** | Nur ein einzelnes `hausgeld`-Feld auf einem Verwaltervertrag, siehe oben — kein Wirtschaftsplan-Konzept |
| Kontoauszugssalden zum 31.12. | ⛔ fehlt vollständig | Keine Entsprechung |

**Ergebnis: Die laufende WEG-Buchhaltung fehlt in wesentlichen Teilen.** Konkret fehlen die zwei Voraussetzungen, auf denen der komplette Rechenkern aufbaut (Kapitel 5.1–5.4 „Zu- und Abflussprinzip"): die **Buchungen** (`Transaction`) und der **Wirtschaftsplan** (`EconomicPlan`/`PlanAdvance`). Ohne diese beiden ist weder die Gesamtabrechnung (5.2) noch die Abrechnungsspitze (5.4, die zentrale Ausgabe des gesamten Moduls) berechenbar — es gibt schlicht keine Datenquelle für `K`, `E` oder `V`.

Das deckt sich mit der in Kapitel 3.3 der Spezifikation selbst vorgesehenen Eskalation:

> „Fehlt die Buchhaltung ganz oder in wesentlichen Teilen, endet M0 mit einer Lückenanalyse. Die Buchhaltung … wird dann in einer eigenen Spezifikation beschrieben und vor diesem Modul umgesetzt."

**Empfehlung:** Vor M1 dieser Spezifikation muss eine eigene Spezifikation „WEG-Buchhaltung" (Bankkonten der Gemeinschaft, Bankimport/CAMT.053 oder manuelle Erfassung, Buchungszuordnung, Wirtschaftsplan-Erfassung mit Beschluss) erstellt und umgesetzt werden. Diese sollte, soweit möglich, bereits die in Kapitel 6.2 vorgesehenen Typen `BankAccount`, `BalanceConfirmation`, `Transaction`, `EconomicPlan`, `PlanAdvance` übernehmen, da sie im Datenmodell dieser Spezifikation bereits sauber vorgedacht sind — das würde eine spätere Kompatibilität ohne Bruch sicherstellen. `SpecialLevy`/`SpecialLevyUnit` gehören inhaltlich eng zur Buchhaltung (Zahlungseingänge einer Sonderumlage) und sollten in derselben Vorab-Spezifikation mitgeplant werden.

Die übrigen MVP-Bestandteile (Heizkostenimport 5.5, § 35a 5.9, Umlagefähigkeit/CO2 5.10, Vermögensbericht 5.13 abzüglich der Kontostände) hängen nicht zwingend von der Buchhaltung ab und könnten das Datenmodell/den Rechenkern unabhängig davon vorbereiten — der Rechenkern insgesamt ist aber erst mit Buchhaltungsdaten sinnvoll end-to-end testbar (Golden-Tests S1–S9 brauchen `Transaction`-Fixtures, keine echte DB-Buchhaltung, siehe Abschnitt 6 unten — das M2 „Rechenkern ohne UI" ist davon nicht blockiert, nur M1 „Datenmodell/Migrationen/Seed" und alles ab M3/M4, was reale Buchungsdaten aus der DB liest).

---

## 3. Vorgeschlagener Ablageort für den Rechenkern

Die Codebasis hat mit `src/lib/optimization/` bereits **genau das Muster**, das Kapitel 7 der Spezifikation verlangt: eine reine, DB-freie Berechnungs-Engine, getrennt von einer I/O-Brücke.

```
src/lib/optimization/
  types.ts            — ENGINE_VERSION, Plain-Object-Typen (Objekt, Mietvertrag, EngineContext, …)
  engine.ts            — berechneSzenario(inputs, ctx) → deterministisches Ergebnis inkl. engine_version
  constraints.ts        — reine Regelprüfung
  kennzahlen.ts / priorisierung.ts / massnahmen.ts  — weitere reine Funktionen
  server-load.ts        — EINZIGER Ort mit Supabase-Zugriff: lädt DB-Zeilen → mappt auf Engine-Typen
  __tests__/
    fixtures.ts          — Test-Hilfsfunktionen (ctx(), massnahme())
    determinism.test.ts  — genau die Property „gleiche Eingabe → identischer Output" aus Spec 0.3.2
    constraints.test.ts
    massnahmen.test.ts
```

`server-load.ts` ist namentlich die Brücke aus Kapitel 7: „lädt DB-Zeilen und mappt in einen `EngineContext`, bleibt außerhalb der Engine, damit diese DB-frei & testbar bleibt" — wortwörtlich das, was die Spezifikation für `SettlementInput` verlangt.

**Empfehlung:** `src/lib/weg-settlement/` (Modulname nach Spec-Glossar, Kapitel 4) mit identischer interner Aufteilung:

```
src/lib/weg-settlement/
  types.ts        — Cents, Dec, alle Entitäten aus Kapitel 6.2 als Plain-Object-Typen
  engine.ts        — computeSettlement(), allocate(), runChecks() (Kapitel 7)
  allocation.ts    — allocate()-Implementierung isoliert (Kapitel 5.11), da property-based getestet
  checks.ts        — runChecks(), C01–C17 (Kapitel 8.2)
  server-load.ts    — Supabase → SettlementInput (nach Umsetzung der Buchhaltungs-Spec, s. Abschnitt 2)
  __tests__/
    fixtures.ts
    determinism.test.ts
    allocate.test.ts       — Property-based Tests + Beispiele aus 5.11
    ...
  fixtures/                — falls Golden-Fixtures hier statt in Repo-Root/fixtures liegen sollen (s. Abschnitt 6)
```

Kein eigenes `packages/`-Verzeichnis: Das Repo ist **kein Monorepo** (kein `workspaces` in `package.json`, keine `packages/`/`apps/`-Struktur), einzige Ausnahme ist `worker/` — ein eigenständiger Node-Service mit eigener `package.json` für die Ingestion-Pipeline (Dateien extrahieren/chunken/embedden), der `pg` direkt nutzt. Der Rechenkern gehört fachlich klar zur Next.js-App (Auswertung von App-Daten, PDF-Erzeugung im Next-Kontext) und hat keinen Grund, ein separater Service zu werden. `src/lib/<modul>/` ist damit sowohl die spec-konforme („eigenes Modul ohne Framework-/ORM-/HTTP-Abhängigkeiten") als auch die repo-konforme Wahl.

**I/O-Freiheit technisch absichern (Spec 0.3.2 / 7):** Es gibt aktuell **keine** ESLint-Regel oder einen Import-Check, der das für `src/lib/optimization/` bereits erzwingt — das Muster wird nur durch Konvention eingehalten, nicht technisch. Für `weg-settlement` sollte das nicht wiederholt werden, sondern (Vorschlag für M1/M2, hier nur benannt, nicht umgesetzt): eine gezielte ESLint-`no-restricted-imports`-Regel für `src/lib/weg-settlement/{engine,allocation,checks,types}.ts`, die Importe von `@supabase/*`, `next/*` u. Ä. verbietet, plus ein Test, der die Datei per Node-`fs` nach verbotenen Importen durchsucht (einfacher Grep-Test, keine neue Tooling-Abhängigkeit).

---

## 4. Vorhandener PDF-Mechanismus

Die Codebasis erzeugt PDFs bereits serverseitig für Exposés, siehe `src/lib/expose/pdf.tsx` + `src/app/api/expose/route.ts`:

- Bibliothek: **`@react-pdf/renderer`** (bereits Dependency, Version `^4.5.1`). PDFs werden als React-Komponentenbaum beschrieben (`Document`, `Page`, `View`, `Text`, `Image`, `StyleSheet.create(...)`), server-only (Kommentar im File: „Server-only — only imported by /api/expose route, never by client components").
- Rendering: `renderToBuffer(...)` aus `@react-pdf/renderer` in der API-Route, teils kombiniert mit **`pdf-lib`** (ebenfalls vorhanden, `^1.17.1`) für Nachbearbeitung (z. B. Zusammenführen).
- Persistenz: uneinheitlich — zwei parallele Systeme existieren:
  1. **Legacy** `folders`/`files` (aus `migration-dokumente.sql`): von `/api/expose/save/route.ts` genutzt, legt/sucht einen Ordner „Exposés" an und lädt die PDF-Datei in den Supabase-Storage-Bucket `documents` hoch, mit einem `files`-Datensatz.
  2. **Aktuelles DMS** `documents` / `document_categories` / `document_markers` / `document_batches` (aus `supabase-schema.sql`, beschrieben in `scripts/spezifikation_dokumente.md`): mandantenfähige Dokumenten-Taxonomie mit `level` (`property`/`unit`/`contract`), **`fiscal_year int`** (!), `markers`, `internal_only`, `batch_id` für Massenvorgänge, plus RLS-Sichtbarkeit über `category.allowed_roles` (Abschnitt 5).

**Bewertung für dieses Modul:** Das aktuelle DMS (`documents`/`document_categories`) passt inhaltlich sehr gut zu Kapitel 8.3 der Spec:
  - `fiscal_year` bildet das Abrechnungsjahr direkt ab.
  - `level = 'property'` passt für Gesamtabrechnung, Vermögensbericht, Anschreiben, Beschlussvorlage; `level = 'unit'` passt für die Einzelabrechnung je Einheit.
  - `document_batches` (`batch_type in ('mass_upload','mailing','handover')`) ist strukturell geeignet für das „Sammel-PDF/ZIP mit Einzeldateien" aus 8.3, ggf. um einen neuen `batch_type` erweitert.
  - `document_categories` ist allerdings eine **globale, schreibgeschützte Systemtabelle** ohne `tenant_id` — neue Kategorien für „Jahresabrechnung", „Einzelabrechnung", „Vermögensbericht" etc. müssten dort als neue globale Einträge ergänzt werden (analog zu den bestehenden Gruppen wie `OBJEKTVERWALTUNG`), nicht pro Mandant.

  **Empfehlung:** Settlement-PDFs über das aktuelle DMS ablegen (nicht über `folders`/`files`), mit neuen `document_categories`-Einträgen (Gruppe z. B. „WEG-ABRECHNUNG") und `supports_fiscal_year = true`. Das legacy `folders`/`files`-System nicht ausweiten. Diese Empfehlung als offene Frage an den Auftraggeber, da sie eine Konvention betrifft, die über dieses Modul hinausgeht (Q4).

---

## 5. Rollen- und RLS-Muster

**Auth-Rollen (`profiles.role`):** `tenant_admin | tenant_user | external`, check-constraint in `profiles`. Kein eigener Enum-Wert für „Beirat" oder „Eigentümer" auf dieser Ebene — das ist beabsichtigt und bereits gelöst über einen zweiten Mechanismus:

**Externe Zugänge (Eigentümer-/Beiratsportal) — bereits vorhanden:**
- `contacts.user_id uuid references auth.users(id)` verknüpft einen CRM-Kontakt optional mit einem echten Login.
- `contact_roles.role` kennt bereits `owner`, `tenant`, `subtenant`, `beirat`, `proxy`, `service_provider`, `caretaker`, `other` — **`beirat` existiert schon als Rolle**.
- RLS-Helper `user_has_role_on(p_property_id, p_unit_id, p_contract_id, p_required_roles)` (in `supabase-schema.sql`, Abschnitt „7a"): prüft, ob der eingeloggte User über `contacts.user_id = auth.uid()` eine aktive `contact_roles`-Zeile mit passender Rolle auf dem Objekt/der Einheit/dem Vertrag hat.
- Angewandt z. B. in `properties_select_external` (`user_has_role_on(p_property_id := id)`) und in der DMS-Sichtbarkeitsfunktion `user_can_see_document()` (Abschnitt 4 oben): Admin sieht alles im eigenen Mandanten; sonst nur, wenn `category.allowed_roles` die Rolle des Users aus `contact_roles` enthält und `internal_only = false`.

**Antwort auf Spec-Frage F8** („Gibt es eine Rolle für den Verwaltungsbeirat? M0 prüft"): **Ja, im Sinne von Sichtbarkeits-/Leserechten ist der Mechanismus bereits vorhanden** — ein Beiratsmitglied ist ein `contact` mit `user_id` (Login) und einer `contact_roles`-Zeile mit `role = 'beirat'` auf dem Objekt. Für `SettlementComment` (5.28, Beiratsprüfung in Status `REVIEW`) empfiehlt sich exakt dasselbe Muster: RLS-Policy auf `settlements`/`settlement_comments`, die entweder `is_tenant_admin()` oder `user_has_role_on(p_property_id, p_required_roles := ARRAY['beirat'])` erlaubt (Lesen + Kommentieren; Finalisieren bleibt admin-only). Es gibt aber **keine reine Beirats-Auth-Rolle** auf `profiles`-Ebene und keinen fertigen UI-Einstiegspunkt/Portal-Layout für externe Nutzer — ob ein Beirats-Login heute schon irgendwo in der UI nutzbar ist (eigenes Portal-Layout etc.), wurde in M0 nicht geprüft und wäre vor M6 zu klären.

**RLS-Standardmuster für neue mandantenbezogene Tabellen** (aus zahlreichen Beispielen in `supabase-schema.sql` abgeleitet, z. B. `contacts`, `properties`, `tickets`):
```sql
alter table <table> enable row level security;

create policy "<table>_select_tenant" on <table>
  for select using (tenant_id = current_tenant_id() and deleted_at is null);

create policy "<table>_insert_tenant" on <table>
  for insert with check (tenant_id = current_tenant_id() and is_tenant_admin());

create policy "<table>_update_tenant" on <table>
  for update using (tenant_id = current_tenant_id() and is_tenant_admin());
```
`current_tenant_id()` und `is_tenant_admin()` sind vorhandene `security definer`-Funktionen, die auf `profiles` joinen. Für Settlement-Tabellen mit Beirats-/Eigentümer-Lesezugriff kommt zusätzlich eine `_select_external`-Policy nach dem `properties_select_external`-Vorbild hinzu. Das erfüllt Spec-Harte-Regel 0.3.4 direkt.

**Rollenkonflikt zu beachten:** Der Spec-Begriff „Owner" als App-Rolle (Kapitel 6/8: Eigentümer als potenzieller Leser/Adressat) darf nicht mit `profiles.role` verwechselt werden — Eigentümer sind in dieser Codebasis grundsätzlich **externe** Nutzer über `contact_roles`, nie `tenant_user`/`tenant_admin`. Das ist konsistent mit der Spec (Verwalter = Anwender/`tenant_admin`, Eigentümer = Empfänger), aber im Plan explizit festzuhalten, damit M1 keine neue, parallele Rollenlogik erfindet.

---

## 6. Test-Setup

- **Framework:** Vitest (`vitest.config.ts`), `npm run test` = `vitest run`. Konfiguriert für `include: ["src/**/*.test.ts"]`, `environment: "node"`, Alias `@` → `src`.
- **Etabliertes Muster für reine Engines** (siehe Abschnitt 3): Tests liegen **co-located** in `<modul>/__tests__/*.test.ts`, nicht in einem zentralen `tests/`-Root. Eine `fixtures.ts` im selben Ordner stellt Test-Helfer bereit (`ctx()`, `massnahme()` bei `optimization`).
- **Determinismus-Test bereits als Vorbild vorhanden:** `src/lib/optimization/__tests__/determinism.test.ts` prüft exakt das, was Spec 0.3.2 und 10.1 für den Settlement-Rechenkern verlangt — zweimalige Berechnung derselben Eingabe, `expect(a).toEqual(b)`, sowie dass das Ergebnis eine `ENGINE_VERSION` trägt. Für `weg-settlement` 1:1 übertragbar.
- **Property-based Tests (10.1):** Aktuell **keine** Property-based-Test-Bibliothek (`fast-check` o. ä.) in `package.json` vorhanden — die Spec nennt „fast-check oder das vorhandene Framework"; da kein solches Framework existiert, müsste `fast-check` als neue Dev-Dependency ergänzt werden (M2-Entscheidung, hier nur als Lücke benannt, keine Installation in M0).
- **Golden-Tests (10.2):** Kein bestehendes Vorbild für die vorgeschlagene Struktur `fixtures/weg-settlement/<szenario>/{input.json,expected.json,README.md}` in der Codebasis; würde neu angelegt. Empfehlung: Root-Verzeichnis `fixtures/weg-settlement/` (parallel zu `src/`), da die Spec ausdrücklich von „Struktur je Szenario" mit `.json`-Dateien spricht, keinem TS-Modul — Trennung von Code sinnvoll. Alternativ `src/lib/weg-settlement/__fixtures__/` fürs engere Zusammenspiel mit Vitest-Includes; beides ist mit der aktuellen `vitest.config.ts` kompatibel (JSON-Import via `readFileSync`, kein Vitest-Include-Pattern-Wechsel nötig, da Tests selbst weiter unter `src/**/*.test.ts` liegen und die Fixtures nur lesen). **Offene Frage, welcher der beiden Orte bevorzugt wird (Q5).**
- **Integrationstests (10.3, RLS/Statusübergänge):** Kein bestehendes Beispiel für DB-/RLS-Integrationstests in der Codebasis gefunden (keine `supabase test`-Integration, kein Testcontainer-Setup sichtbar). Die Migrationen werden laut Konvention manuell im Supabase-SQL-Editor der Produktivinstanz ausgeführt (siehe Kommentar in `migration-optimization-finanzierung.sql`), es gibt **keine lokale/CI-Testdatenbank** und **keinen Mechanismus, mit dem Claude Code selbst DDL ausführen kann** (kein `DATABASE_URL`, keine `supabase link`-Verknüpfung im Projektverzeichnis). RLS-Tests aus 10.3 müssten entweder (a) manuell vom Auftraggeber gegen die Produktiv-/eine Staging-Instanz gefahren werden, oder (b) es wird zuerst eine lokale Supabase-Instanz (`supabase start`, CLI ist als `npx supabase` mit Version 2.117.0 nutzbar, aber nicht mit dem Projekt verknüpft) für Tests aufgesetzt. **Das ist eine Voraussetzung, die vor M1 geklärt werden sollte, nicht nur für dieses Modul (Q6).**

---

## 7. Offene Fragen

### 7.1 Fachliche Fragen aus Spec Kapitel 12 — Status nach M0

Alle neun Fragen (F1–F9) bleiben wie in der Spec vorgesehen beim Auftraggeber; M0 liefert nur dort zusätzliche Fakten, wo die Codebasis eine Antwort nahelegt:

| ID | Frage | Von M0 beigetragener Befund |
|---|---|---|
| F1–F6, F9 | — | Keine zusätzlichen Codebasis-Fakten; Standardwerte aus der Spec gelten unverändert. |
| F7 | Ist-Zuführung zur Rücklage ohne eigenes Rücklagenkonto? | Verschärft sich: Da aktuell **gar keine** objektbezogenen Bankkonten existieren (Abschnitt 2), ist F7 erst relevant, sobald die Buchhaltungs-Vorab-Spezifikation Rücklagenkonten überhaupt vorsieht. Bis dahin weiterhin blockierend für S7, wie in der Spec vermerkt. |
| F8 | Rolle für den Verwaltungsbeirat? | **Beantwortet, siehe Abschnitt 5**: Sichtbarkeits-/Kommentarrechte lassen sich mit dem vorhandenen `contact_roles`/`user_has_role_on()`-Muster abbilden (Rolle `beirat` existiert bereits). Kein eigenes UI-Portal geprüft. |

### 7.2 Neue, von M0 aufgeworfene Fragen

| ID | Frage | Warum das Claude Code nicht selbst entscheidet |
|---|---|---|
| Q1 | `supabase-schema.sql` ist nachweislich nicht deckungsgleich mit der Live-DB (Abschnitt „Methodik" oben). Soll M1 die Datei als Doku nachziehen (alle Spalten aus laufenden Migrationen ergänzen), oder gilt sie ohnehin nur als historischer Ausgangspunkt und die einzelnen `migration-*.sql`-Dateien sind die eigentliche Quelle der Wahrheit? | Betrifft die Projektkonvention insgesamt, nicht nur dieses Modul. |
| Q2 | Geld-Konvention: Das strukturell nächstverwandte Modul `src/lib/optimization` verwendet durchgängig **Float-EUR** (`kaltmiete_eur: number` etc.), nicht Integer-Cents. Spec-Regel 0.3.1 verlangt für dieses Modul zwingend `Cents`. Bestätigung erbeten, dass `weg-settlement` bewusst von der Nachbar-Engine abweicht (die Harte Regel sticht die „bestehende Konvention" aus 0.1) — und ob perspektivisch auch `optimization` auf Cents migriert werden soll (nicht Teil dieses Moduls, nur zur Kenntnis). | Berührt eine geldbezogene Harte Regel; laut 0.2 wird das nicht selbst entschieden. |
| Q3 | Namenskonvention: Spec Kapitel 4 verlangt englische Bezeichner. `src/lib/optimization` ist durchgehend deutsch benannt (`berechneSzenario`, `Objekt`, `Massnahme`, Property-Namen wie `kaltmiete_eur`). DB-Schema, API-Routen und die meisten übrigen Module (`contacts`, `properties`, `tickets`, `documents`, …) sind dagegen konsequent englisch. Bestätigung erbeten, dass `weg-settlement` dem **DB-/API-Standard** (Englisch) folgt statt dem Nachbarmodul `optimization`. | Auswirkung auf den kompletten Code des Moduls; besser vor M1 festlegen als nachträglich umbenennen. |
| Q4 | Dokumentenablage: Settlement-PDFs über das aktuelle DMS (`documents`/`document_categories`, mit neuer globaler Kategorie-Gruppe) statt über das ältere `folders`/`files`-System (aktuell nur vom Exposé-Feature genutzt)? Siehe Abschnitt 4. | Konvention mit Tragweite über dieses Modul hinaus (neue globale `document_categories`-Einträge sind nicht mandantenspezifisch). |
| Q5 | Ablageort der Golden-Fixtures: Repo-Root `fixtures/weg-settlement/…` oder `src/lib/weg-settlement/__fixtures__/…`? Siehe Abschnitt 6. | Reine Konventionsfrage ohne bestehendes Vorbild im Repo — bewusst offengelassen statt selbst entschieden. |
| Q6 | Es gibt aktuell keine Möglichkeit, DDL/Migrationen automatisiert (durch Claude Code oder CI) gegen die Datenbank auszuführen — das geschieht laut vorgefundener Konvention manuell im Supabase-SQL-Editor der Produktivinstanz, es existiert weder eine lokal verknüpfte Supabase-Instanz noch eine erkennbare Test-/Staging-Datenbank. Wie soll M1 (Migrationen) und wie sollen die RLS-Integrationstests aus 10.3 praktisch ausgeführt und verifiziert werden? | Das ist eine Infrastrukturentscheidung außerhalb dessen, was Claude Code im Rahmen der Spec entscheiden darf, und blockiert die *Definition of Done* von M1 direkt (M1 verlangt „Migrationen laufen, RLS-Tests grün" — ohne Ausführungsweg nicht objektiv nachweisbar). |
| Q7 | Reihenfolge/Scope der vorgelagerten Buchhaltungs-Spezifikation (Abschnitt 2): Soll sie **nur** das Minimum liefern, das dieses Modul braucht (WEG-Bankkonten, Buchungen, Wirtschaftsplan, Sonderumlagen), oder eine vollständige Objekt-Buchhaltung inkl. Bankimport/CAMT.053, die auch außerhalb der Jahresabrechnung nutzbar ist? Wer erstellt diese Spezifikation — Auftraggeber oder Claude Code in einer eigenen Sitzung? | Grundsatzentscheidung zum Projektzuschnitt, nicht Teil dieser Spec. |
| Q8 | `properties.monthly_reserve` / `monthly_operating_costs` / `monthly_management_costs` existieren bereits (property-weit, ohne Historie, ohne Unit-Bezug) und werden aktuell offenbar nicht vom UI der App befüllt/genutzt (in M0 keine Verwendung in `src/app` gefunden, nur die Spalten selbst live in der DB). Sollen diese Felder beim Aufbau von `EconomicPlan`/`PlanAdvance` als Migrationsquelle für Bestandsdaten dienen, oder werden sie ignoriert/perspektivisch entfernt? | Betrifft Altdaten-Migration, keine rein technische Entscheidung. |

---

## 8. Zusammenfassung / Empfehlung

M0 bestätigt: Objekt-, Einheiten- und Eigentümer-Stammdaten sind solide vorhanden und passen gut auf das Datenmodell aus Kapitel 6. Der Rechenkern hat mit `src/lib/optimization/` ein unmittelbares, bewährtes Vorbild für Ablage, Trennung von I/O und Determinismus-Tests. RLS- und Rollenmuster für Verwalter/Beirat/Eigentümer sind bereits etabliert und direkt übertragbar. Die PDF-Erzeugung ist technisch vorhanden; die Ablageentscheidung (DMS vs. Legacy-Dateisystem) ist nur eine Konventionsfrage.

**Die Buchhaltung — Buchungen und Wirtschaftsplan — fehlt jedoch vollständig.** Das ist exakt der in Kapitel 3.3 der Spezifikation vorgesehene Abbruchfall für M0. Empfehlung: Vor M1 dieser Spezifikation eine eigene, schlanke Spezifikation „WEG-Buchhaltung" erstellen (Bankkonten der Gemeinschaft, Buchungserfassung, Wirtschaftsplan mit Beschluss, Sonderumlagen), die die in Kapitel 6.2 bereits vorgedachten Typen übernimmt. M2 (reiner Rechenkern, Kapitel 5.1–5.13 als Funktionen mit synthetischen Test-Fixtures) ist davon unabhängig und könnte parallel begonnen werden, sobald Q2/Q3 (Geld-Typ, Namenskonvention) geklärt sind.

---

## 9. Update 2026-09-12 — Stand nach Umsetzung der Buchhaltungs-Vorab-Spezifikation

Zwischen der Review dieses Dokuments und heute wurde, wie in Abschnitt 2 empfohlen, `docs/specs/weg-buchhaltung-spec.md` erstellt und **vollständig umgesetzt** (Meilensteine B0–B7, inkl. Migration `scripts/migration-weg-buchhaltung.sql`, Rechenkern-Hilfsfunktionen `src/lib/weg-buchhaltung/`, API-Routen `src/app/api/weg-buchhaltung/*`, UI unter `/objekte/[propertyId]/buchhaltung`). Dieser Abschnitt schreibt die obigen Befunde fort, **ohne sie zu löschen** (Abschnitte 1–8 bleiben als historisches M0-Dokument stehen).

### 9.1 Zentraler Befund aus Abschnitt 2 ist aufgelöst

Die in Abschnitt 2 als blockierend identifizierte Lücke — keine Buchungen, kein Wirtschaftsplan — existiert nicht mehr. Es entscheidend abweichend von der ursprünglichen Empfehlung: **doppelte Buchführung als kanonisches Ledger**, EÜR als abgeleitete Sicht (Nutzerentscheidung während der Buchhaltungs-Spec, siehe `weg-buchhaltung-spec.md` Kapitel 2). Das liefert für den Rechenkern mehr Datenbasis als in Kapitel 6.2 der Hausgeldabrechnung-Spec vorgesehen (zusätzlich `Account`, `JournalEntry`, `JournalEntryLine`), aber alle dort verlangten Typen sind mit abgedeckt.

### 9.2 Aktualisierte Entitäten-Tabelle (ersetzt die Status-Spalte aus Abschnitt 1 für die betroffenen Zeilen)

| Spec-Entität (6.2) | Codebasis (Stand 2026-09-12) | Status |
|---|---|---|
| `AllocationKey` / `AllocationKeyValue` | `allocation_keys` / `allocation_key_values` (`weg-buchhaltung-spec.md` 6.3) | ✅ vorhanden |
| `CostType` | `cost_types`, verknüpft mit auto-angelegtem Ledger-`Account` (4000/8000-Kontenband) | ✅ vorhanden |
| `BankAccount` | `community_bank_accounts` (objektbezogen, `kind: operating\|reserve`), inkl. CAMT.053-/CSV-Import und Abgleich über `journal_entry_lines` | ✅ vorhanden |
| `BalanceConfirmation` | `balance_confirmations` | ✅ vorhanden |
| `Transaction` | `transactions` + `journal_entries`/`journal_entry_lines` (jede bestätigte Transaktion erzeugt einen ausgeglichenen Journal-Eintrag) | ✅ vorhanden |
| `EconomicPlan` / `PlanAdvance` | `economic_plans` / `plan_advances` (je Einheit, mit Gültigkeitszeiträumen für unterjährige Änderungen) | ✅ vorhanden |
| `SpecialLevy` / `SpecialLevyUnit` | `special_levies` / `special_levy_units` | ✅ vorhanden |
| `HeatingImport` / `HeatingImportUnit` | — | ⛔ weiterhin neu (Teil von M3 der Hausgeldabrechnung-Spec) |
| `AssetItem` / `LiabilityItem` | — | ⛔ weiterhin neu |
| `Settlement` / `SettlementUnit` / `SettlementComment` / `CheckAcknowledgement` | — | ⛔ weiterhin neu (Kern des Moduls selbst) |

Alle übrigen Zeilen aus Abschnitt 1 (`Property`, `Unit`, `Owner`, `Ownership`, Audit-Logging) sind unverändert gültig.

### 9.3 Offene Fragen — Status

- **Q2 (Cents statt Float)**: durch Präzedenzfall empirisch beantwortet. `weg-buchhaltung` verwendet durchgängig `Cents`/`bigint`, nie `float`/`parseFloat` (eigener `parseAmountToCents`-Parser). `weg-settlement` übernimmt dieselbe Konvention ohne weitere Rückfrage.
- **Q3 (englische Namenskonvention)**: ebenso durch Präzedenzfall beantwortet. `weg-buchhaltung` ist durchgehend englisch benannt (Tabellen, Felder, Modulcode). `weg-settlement` folgt derselben Linie.
- **Q1, Q4, Q5, Q7, Q8**: weiterhin offen, unverändert relevant.
- **Q6 (keine DDL-Ausführung durch Claude Code)**: weiterhin ungelöst — bestätigt während B1–B7: jede Migration wurde als `scripts/migration-*.sql` übergeben und vom Auftraggeber manuell im Supabase-SQL-Editor ausgeführt, danach per Service-Role-Introspektion verifiziert. Derselbe Workflow gilt für M1 dieses Moduls.
- **F7, F8**: unverändert.

### 9.4 Empfehlung für die Fortsetzung

Mit Q2/Q3 geklärt ist **M2 (reiner Rechenkern in `src/lib/weg-settlement/`, Kapitel 5+7 der Spec)** ohne weitere Vorbedingung startbar — er ist DB-frei und testbar rein mit synthetischen Fixtures. **M1 (Migrationen für `Settlement`/`SettlementUnit`/`SettlementComment`/`CheckAcknowledgement`, optional `HeatingImport*`/`AssetItem`/`LiabilityItem`)** kann parallel oder danach erfolgen; beide sind voneinander unabhängig, da der Rechenkern reine Funktionen auf Plain-Object-Typen sind und die Persistenz erst in M4 (Services/API) an ihn andockt.

### 9.5 Nachtrag 2026-09-12, später am selben Tag — Spec-Versionssprung entdeckt und Lücke geschlossen

Beim erneuten Lesen von `scripts/hausgeldabrechnung-spec.md` vor Beginn von M2 stellte sich heraus, dass die Datei zwischenzeitlich auf **Version 0.2** aktualisiert wurde und seither einen vollständigen kanonischen Teil I (Kapitel B1–B13) enthält — mit einem Offene-Posten-Modell (`Receivable`, `PaymentAllocation`, Ausgleichsreihenfolge B7.6/B7.7) und einer Jahressperre (`YearLock`, B9), das im tatsächlich gebauten `weg-buchhaltung`-Modul (B0–B7 nach `docs/specs/weg-buchhaltung-spec.md`) fehlte. Kapitel 7 der kanonischen Spec verlangt „die Sollstellungen und Ausgleiche nach B7" explizit als Eingabe für `computeSettlement` — ohne sie war M2 nicht spec-konform startbar.

Nach Rückfrage beim Auftraggeber (Empfehlung: nur die für M2 zwingend nötigen Lücken schließen, nicht die volle B1–B13-Parität) wurde nachgerüstet:

- `scripts/migration-weg-buchhaltung-receivables.sql` — `receivables`, `payment_allocations` (mit Ausgeglichenheits-Constraint-Triggern analog zum Journal-Muster), `year_locks`, RLS nach Standardmuster. **Wartet auf manuelle Ausführung im Supabase-SQL-Editor** (Q6 weiterhin ungelöst).
- `src/lib/weg-buchhaltung/rounding.ts`, `allocation-order.ts`, `advance-schedule.ts` — pure, deterministische Funktionen (Ausgleichsreihenfolge B7.6, proportionale Komponentenaufteilung B7.7, Sollstellungs-Generierung aus `PlanAdvance` B7.2), 21 Tests, alle grün.
- `src/lib/weg-buchhaltung/receivable-posting.ts` sowie Erweiterungen der Routen `economic-plans/[id]/advances`, `special-levies/[id]/units`, `transactions/[id]` — verdrahten Erzeugung und automatischen Ausgleich beim Bestätigen einer Zahlung.
- Neu: `GET/POST /api/weg-buchhaltung/year-locks`, `PATCH /api/weg-buchhaltung/year-locks/[id]`, `GET /api/weg-buchhaltung/receivables`.

Bewusst zurückgestellt (siehe `weg-buchhaltung-spec.md` Kapitel 9, Zeile B8): `BankStatement`/`BankTransaction`-Rohschicht, `PayerAccount`, `UnitAccountAlias`, `PaymentReference`, zweistufige `AssignmentRule`-Zuordnung mit Lernfunktion, `OpeningBalanceSet` — diese betreffen nur die Automatisierungsquote beim Import, nicht die Höhe dessen, was ein Eigentümer schuldet.

**Nächster Schritt, sobald die Migration ausgeführt und live verifiziert ist:** M2 (`src/lib/weg-settlement/`, beginnend mit `allocate()` nach Kapitel 5.11) tatsächlich beginnen.

### 9.6 Live-Verifikation 2026-09-12 — erfolgreich, B8-Nachtrag abgeschlossen

Migration vom Auftraggeber im Supabase-SQL-Editor ausgeführt und bestätigt (`receivables`, `payment_allocations`, `year_locks`, `is_year_locked()` alle live geprüft). Anschließend End-to-End im Browser gegen die echten Leipzig/Köhler-Testdaten (WEG Waldstraße 82, Einheit W01) getestet:

- **Sollstellungs-Erzeugung (B7.2/B7.3):** Neuer Vorschuss für W01 ab 2026-10-01 gesetzt → 13 `Receivable`-Zeilen (Oktober 2026 bis Oktober 2027) korrekt erzeugt, Eigentümer korrekt aus `contact_roles` aufgelöst, alter Vorschuss korrekt auf `valid_to = 2026-09-30` begrenzt.
- **Ausgleich, exakte Zahlung (B7.6/B7.7):** Zahlung über 415,00 € (= volle Monatsrate) wurde vollautomatisch der ältesten offenen Sollstellung (Oktober) zugeordnet, Komponenten 1:1 auf Bewirtschaftung/Rücklage übernommen, Status korrekt von `open` auf `settled` gewechselt (Trigger `refresh_receivable_status`).
- **Ausgleich mit Überlauf (B7.6.2):** Zahlung über 500,00 € deckte November (415,00 €, → `settled`) vollständig und floss mit dem Rest (85,00 €) anteilig in Dezember (→ `partial`), proportionale Aufteilung 63,49 €/21,51 € exakt gemäß `allocateProportional`.
- **Dabei ein echter Bug gefunden und behoben, bevor er in Produktion gelandet wäre:** Der Ausgleich war ursprünglich nur in der PATCH-Route (Bestätigen eines Entwurfs) verdrahtet, nicht im direkten POST-Pfad (sofort bestätigte Buchung) — dem einzigen Pfad, den die UI für „Neue Buchung“ tatsächlich nutzt. Zusätzlich hatte das UI-Formular gar kein Eigentümer-Feld. Behoben durch eine neue `resolveOwnerId()`-Hilfsfunktion (löst den Schuldner aus `contact_roles` zum Buchungstag auf), jetzt in beiden Bestätigungspfaden (POST und PATCH) verdrahtet.

Alle Testdaten (2 Test-Buchungen inkl. Buchungssätze, 1 Test-Wirtschaftsplan-Vorschuss inkl. 13 Sollstellungen und deren Ausgleiche) wurden anschließend rückstandsfrei entfernt und der ursprüngliche Datenstand von W01 wiederhergestellt (`valid_to` zurück auf `null`). `tsc --noEmit`, `eslint` und die volle Testsuite (69/69) sind grün.

Damit ist der B8-Nachtrag vollständig abgeschlossen.

### 9.7 M2 begonnen 2026-09-12 — `allocate()` fertig, Rest wartet auf Review

`src/lib/weg-settlement/` angelegt:

- `types.ts` — `Cents`, `Dec` (= `Decimal` aus neu hinzugefügter Dependency `decimal.js`, da Spec 5.3.6 Dezimalarithmetik für Gewichte verlangt und keine solche Bibliothek im Repo vorhanden war), `ENGINE_VERSION`.
- `allocation.ts` — `allocate()` nach Kapitel 5.11 und 7, inkl. `naturalCompare()` für den Sortierschlüssel-Tiebreak (5.11.3: „W2" vor „W10", nicht lexikographisch).
- Tests (18, alle grün): alle vier Beispiele aus 5.11 exakt nachgerechnet, beide Invarianten (Summe = Betrag, Abweichung < 1 Cent je Anteil), Determinismus, Reihenfolge-Unabhängigkeit, Tiebreak-Verhalten, `total = 0`, leere Gewichtsliste, Fehlerfall Gewichtssumme 0 (Spec 5.3.3), nicht-ganzzahliger Betrag, sowie ein handgerollter property-based Test (200 deterministisch geseedete Zufallsfälle, `mulberry32`-PRNG statt einer externen Bibliothek — `fast-check` weiterhin nicht installiert, s. Abschnitt 6).
- `tsc --noEmit`, `eslint`, volle Testsuite (87/87) grün.

**Bewusst noch nicht begonnen:** `computeSettlement()` (die zehn Rechenschritte aus Kapitel 7) und `runChecks()` (C01–C17, Kapitel 8.2). Das ist der eigentliche Kern des Moduls — er verarbeitet reale Buchungs-/Sollstellungsdaten zu dem Betrag, den ein Eigentümer zahlen oder erstattet bekommen soll, und verdient eine eigene Review-Runde vor der Umsetzung (Datenherkunft aus `weg-buchhaltung`, Sonderfälle wie Eigentümerwechsel/Heizkosten/Direktbelastung, Golden-Test-Fixtures S1–S9 nach Kapitel 10.2 — `expected.json` darf laut harter Regel 0.3.5 nicht selbst erzeugt werden).

**Nächster Schritt:** `computeSettlement()`/`runChecks()` in Angriff nehmen, beginnend mit dem einfachsten Golden-Szenario S1 (4 Einheiten, MEA-Schlüssel, keine Sonderfälle) als Leitplanke.

### 9.8 M2 fortgesetzt 2026-09-12 — `computeSettlement()` und `runChecks()` (Teilumfang)

Ergänzt in `src/lib/weg-settlement/`:

- `dates.ts` — reine Kalenderarithmetik (Schaltjahr, Tagesüberlappung), Grundlage für 5.3.2.
- `weights.ts` — `computeKeyWeights()`: Jahresgewicht je Einheit als tagesgenauer Dezimal-Durchschnitt über Gültigkeitszeiträume, inkl. Schaltjahr (S8).
- `distribution.ts` — `distributeCostType()` (5.3: Trennung Direktbelastung/gepoolter Anteil, Verteilung über `allocate()`, Nachvollziehbarkeit via `exactPerUnit`/`sourceBookingIds`) und `distributeLaborShares()` (5.9: § 35a-Lohnanteile, gruppiert nach Kategorie, mit demselben Schlüssel wie die zugehörige Kostenart).
- `engine.ts` — `computeSettlement()`: setzt die Rechenschritte aus Kapitel 7 um (Kostenart-Verteilung, Heizkosten laut Messdienst statt `allocate()` inkl. Überleitungsrechnung 5.5.3, K/E/R/V/S je Einheit, Infoblock mit § 35a/Umlagefähigkeit/CO2/offenen Sollstellungen, Kontenabstimmung 5.12, Rücklagenentwicklung 5.6, Vermögensbericht-Daten 5.13, Sonderumlagen-Report 5.8).
- `checks.ts` — `runChecks()`: **13 der 17 Prüfungen** aus 8.2 implementiert (C01, C03, C04, C05, C06, C07, C08, C09, C11, C13, C14, C15, C17). Bewusst nicht implementiert, da die nötigen Eingaben noch nicht Teil von `SettlementInput` sind: **C02** (Vertrag von `SettlementInput` schließt unbestätigte Buchungen per Definition aus — Aufgabe der I/O-Brücke, nicht des Rechenkerns), **C10**/**C16** (benötigen `Ownership`-Zeiträume), **C12** (benötigt Vorjahres-Kostenart-Historie).
- `fixtures/weg-settlement/S1/` — `input.json` + `README.md` für das Golden-Szenario S1 angelegt (von Claude Code gemäß Spec 10.2 zulässig). **`expected.json` fehlt bewusst** (harte Regel 0.3.5) — der Golden-Test für S1 ist damit als ausstehend markiert, nicht selbst befüllt.

**Tests (47 neu, alle grün, 116/116 im Gesamtrepo):** `weights.test.ts` (Tagesgewichtung inkl. Schaltjahr), `distribution.test.ts` (Direktbelastung, nicht freigegebene Direktbelastung, Gewichtssumme 0, negative Beträge, § 35a-Verteilung), `engine.test.ts` (ein von Hand nach den Spec-Formeln nachgerechnetes S1-artiges Beispiel — **ausdrücklich kein Ersatz für den Golden-Test-Korpus**, nur eine Entwickler-Verifikation der Formelumsetzung — plus gezielte Fehlerfall-Tests für C01/C03/C04/C09/C13/C17).

**Bewusst noch nicht umgesetzt:**
- Die vier fehlenden Prüfungen C02/C10/C12/C16 (s. o.) — nachrüstbar, sobald `SettlementInput` um `Ownership`-Zeiträume und eine Vorjahres-Kostenhistorie ergänzt wird (voraussichtlich mit `server-load.ts`, M4).
- `server-load.ts` (DB → `SettlementInput`) selbst — M2 ist laut Kapitel 11 explizit „ohne UI"/ohne DB-Anbindung; die Brücke von den `weg-buchhaltung`-Tabellen (insbesondere dem neuen `receivables`/`payment_allocations`-Modell aus Abschnitt 9.5/9.6) zu `SettlementInput` ist M4.
- Golden-Tests S2–S9 — benötigen jeweils `input.json` (kann Claude Code anlegen) und unabhängig geliefertes `expected.json` (kann Claude Code nicht anlegen, Regel 0.3.5).
- Property-based Tests für `allocate()` sind seit Abschnitt 9.7 vorhanden; für `computeSettlement()` insgesamt (z. B. „Σ K+Rücklage = Σ aller Ausgaben-Buchungen" als Invariante über zufällige Szenarien) noch nicht — wäre eine sinnvolle Ergänzung, aber kein Kapitel-10.1-Pflichtbestandteil (der bezieht sich namentlich auf `allocate()`).

**Nächster Schritt:** entweder (a) M2 als inhaltlich abgeschlossen betrachten und mit M1 (Migrationen für `Settlement`/`SettlementUnit`/`SettlementComment`/`CheckAcknowledgement`, optional `HeatingImport`/`AssetItem`/`LiabilityItem`) fortfahren, oder (b) zuerst `expected.json` für S1 vom Auftraggeber einholen, um den Rechenkern gegen einen echten Golden-Test abzusichern, bevor auf ihm aufgebaut wird. Beides schließt sich nicht aus — die Frage ist nur die Reihenfolge.

### 9.9 Golden-Test S1 — vorläufig abgehakt, ausdrücklich ohne unabhängige Prüfung (2026-09-12)

Auf Nachfrage entschied der Auftraggeber explizit: Variante 3 von 3 angebotenen Optionen — die formale unabhängige Verifikation vorerst überspringen, die von Claude Code von Hand nachgerechneten Werte als Übergangslösung übernehmen, um weiterzukommen, und dies vor einem echten Kundeneinsatz nachholen.

Umgesetzt:
- `fixtures/weg-settlement/S1/expected.json` — die von Hand nachgerechneten Werte aus Abschnitt 9.8, jetzt als Datei. **Ausdrücklich als vorläufig markiert** in `fixtures/weg-settlement/S1/README.md`: entstanden durch manuelle Nachrechnung (nicht durch Ausführen der Engine), aber ohne Prüfung durch eine unabhängige Stelle freigegeben — verletzt damit den Wortlaut der harten Regel 0.3.5, mit ausdrücklicher Zustimmung des Auftraggebers und dokumentiertem Vorbehalt („vor Produktiveinsatz nachholen").
- `src/lib/weg-settlement/__tests__/golden.test.ts` — liest alle Szenarien unter `fixtures/weg-settlement/`, führt `computeSettlement()` aus und vergleicht gegen `expected.json`; fehlt diese Datei für ein Szenario, wird der Test übersprungen (`it.skip`), nicht selbst befüllt. S1 läuft jetzt grün (117/117 Gesamttests).

**Wichtig für spätere Sitzungen:** Ein grüner S1-Test bestätigt nur, dass die Engine ihre eigene Auslegung der Spec in sich konsistent umsetzt — nicht, dass das Ergebnis fachlich korrekt ist. Dasselbe gilt für jedes künftige S2–S9-`expected.json`, falls auf demselben Weg erstellt. Vor Produktiveinsatz: unabhängige Nachrechnung durch Auftraggeber/WEG-Verwalter/Steuerberater einholen.

**Nächster Schritt:** M1 (Datenmodell der Abrechnung: `Settlement`, `SettlementUnit`, `SettlementComment`, `CheckAcknowledgement`, optional `HeatingImport`/`HeatingImportUnit`, `AssetItem`/`LiabilityItem`) beginnen.

### 9.10 M1 begonnen 2026-09-12 — Migration steht, wartet auf Ausführung

`scripts/migration-hausgeldabrechnung-m1.sql` erstellt, entsprechend Kapitel 11 Zeile M1 (alle dort genannten Entitäten, nicht nur `Settlement`/`SettlementUnit`):

- `settlements` / `settlement_units` — Statusmodell `draft → review → final → resolved`, plus `superseded`; Versionierung über `(property_id, year, version)`; `input_snapshot`/`result_snapshot`/`input_hash`/`engine_version` für Unveränderlichkeit ab `final` (8.1).
- `settlement_comments` — Beiratsprüfung, append-only (kein Update/Delete, analog `journal_entries`).
- `check_acknowledgements` — Quittierung einzelner Prüfungen (C01–C17), append-only, verwalterintern.
- `heating_imports` / `heating_import_units` — Messdienst-Import (5.5). **Abweichung ggü. Spec 6.2**: zusätzliches Feld `cost_type_id`, da der Rechenkern (`HeatingAllocationInput`) eine eindeutige Verknüpfung zur Heizkosten-Kostenart braucht, die die Spec nur implizit über das `isHeating`-Flag voraussetzt.
- `asset_items` / `liability_items` — Vermögensbericht (5.13), manuell erfasst.
- RLS: Standardmuster für alle acht Tabellen. **Abweichend von der `weg-buchhaltung`-Migration** (dort bewusst rein verwalterintern, Q6 „Standard bis Klärung"): `settlements`/`settlement_units`/`settlement_comments` erhalten hier bereits jetzt `_select_external`-Policies für die Rolle `beirat` (nur ab Status ungleich `draft`), weil Kapitel 8.1 Beirats-Sichtbarkeit als Kernregel des Status `REVIEW` beschreibt, nicht als reine UI-Frage, die erst M6 beträfe. `settlement_comments` erhält zusätzlich eine `_insert_external`-Policy, damit ein Beiratsmitglied selbst kommentieren kann. `heating_imports`/`asset_items`/`liability_items` bleiben bewusst verwalterintern (Offenlegung nur über die späteren PDF-Dokumente, M5/M6).

**Wartet auf Ausführung im Supabase-SQL-Editor** (Q6, weiterhin ungelöst) — danach folgt die Live-Verifikation (Introspektion + Playwright, wie bei `weg-buchhaltung`) und ein kurzes Seed für S1-artige Testdaten.

### 9.11 M1 live verifiziert 2026-09-12 — Migration ausgeführt, RLS-Tests grün

Migration vom Auftraggeber ausgeführt. Live geprüft:

- Alle acht Tabellen existieren und sind abfragbar (Service-Role-Introspektion).
- **Mandantentrennung:** Mit einer echten Session (`koehler@berko.ai`) angemeldet, sieht der Nutzer nur die `settlements`-Zeile des eigenen Mandanten (Objekt Waldstraße 82), nicht die eines zweiten, service-role-seitig angelegten Mandanten (Sachsenhaus Verwaltung GmbH).
- **Insert-Isolation:** Ein Insert-Versuch mit `tenant_id` des fremden Mandanten wird von RLS abgelehnt (`new row violates row-level security policy`); derselbe Insert mit der eigenen `tenant_id` gelingt.
- **Append-only-Verhalten:** `settlement_comments` und `check_acknowledgements` lassen sich anlegen, ein anschließender `UPDATE`-Versuch ändert 0 Zeilen (keine Update-Policy vorhanden, RLS blockiert still statt mit Fehler — erwartetes Postgres-Verhalten bei fehlender Policy für diese Operation).
- Testdaten wurden anschließend über den Service-Role-Client vollständig entfernt.

Nicht live getestet (wie schon bei `weg-buchhaltung`, gleicher Grund): die `_select_external`-Policies für die Rolle `beirat` — dafür bräuchte es einen echten zweiten Auth-User mit `contacts.user_id`-Verknüpfung und `contact_roles.role = 'beirat'`, was über den bestehenden Login hinausgeht. Syntaktisch sind die Policies gültig (die Migration lief fehlerfrei durch); die inhaltliche Prüfung folgt sinnvollerweise mit M6 (UI/Portal), wenn ein solcher Testnutzer ohnehin gebraucht wird.

M1 ist damit abgeschlossen. **Nächster Schritt:** M3 (Heizkostenimport, Prüfungen aus 8.2 — Datenmodell dafür existiert bereits aus M1) oder M4 (Services/API, Statusmodell, Snapshot, Kopplung an die Jahressperre aus `weg-buchhaltung`) — M4 ist voraussichtlich sinnvoller zuerst, da `server-load.ts` (DB → `SettlementInput`) die eigentliche Lücke zwischen dem fertigen Rechenkern (M2) und echten Daten ist.

### 9.12 M4 umgesetzt 2026-09-12 — Services/API, Statusmodell, `server-load.ts`

- `src/lib/weg-settlement/server-load.ts` — der einzige Ort mit Supabase-Zugriff in diesem Modul (Muster wie `src/lib/optimization/server-load.ts`): lädt `weg-buchhaltung`-Daten (Units, Verteilerschlüssel, Kostenarten, Buchungen, Receivables, Bankkonten/Kontenabstimmung, Sonderumlagen) sowie die neuen M1-Tabellen (`heating_imports`, `asset_items`, `liability_items`) und mappt sie auf `SettlementInput`. Vorzeichenkonvention: `CostBooking.amount = costType.direction === 'expense' ? -amount : amount`, unabhängig von der Buchungsart — bildet Normalfall und Gutschrift (C17) einheitlich ab.
- `src/lib/weg-settlement/serialize.ts` — `toPlain()`/`parseSettlementInput()`, gemeinsam genutzt von den API-Routen (jsonb-Snapshots) und dem Golden-Test-Loader (vorher dort dupliziert, jetzt zusammengeführt).
- API-Routen unter `src/app/api/weg-settlement/settlements/`: `POST` (lädt+berechnet+speichert als `draft`, versioniert bei bereits nicht-draft letzter Version), `GET` (Liste), `GET/PATCH [id]` (Detail inkl. frisch berechneter Prüfungen; Statusübergänge `draft→review→final→resolved` sowie `→superseded`), `POST [id]/comments`, `POST [id]/acknowledge`.
- `final`-Übergang: lehnt ab bei offenen blockierenden Prüfungen oder unquittierten Warnungen; koppelt an die Jahressperre der Buchhaltung (B9) — legt bei Erfolg einen `year_lock` an (dieselbe Vorbedingung wie `POST /api/weg-buchhaltung/year-locks`, hier dupliziert, um jene bereits getestete Route nicht anzufassen).
- `resolved`-Übergang: schreibt den Adressaten je Einheit zum Beschlussdatum fest (nicht mehr „aktueller" Eigentümer) und legt die Abrechnungsspitzen als `Receivable` (`kind = 'settlement_balance'`) an (B7.1).

**Live verifiziert** (Session-Client `koehler@berko.ai`, echte Buchhaltungsdaten WEG Waldstraße 82, danach vollständig bereinigt):
- `server-load.ts` gegen echte Daten: Kontenabstimmung korrekt (Anfangsbestand aus der 2025-12-31-Saldenbestätigung, Zugänge/Abgänge aus `journal_entry_lines`), Invariante Σ K = Σ Ausgaben-Kostenart-Buchungen hält.
- **Befund, kein Bug:** Der bestehende Wirtschaftsplan 2026 wurde vor dem B8-Nachtrag (Abschnitt 9.5) angelegt, hat also keine `Receivable`-Zeilen — `advancesSoll` (V) ist deshalb für alle Einheiten 0. Ein Backfill-Skript für Alt-`plan_advances` ohne zugehörige Receivables wäre bei Bedarf nachrüstbar, ist aber nicht Teil dieses Meilensteins.
- Vollständiger Statusdurchlauf `draft → review → final → resolved`: Jahressperre wird beim `final`-Übergang korrekt angelegt, alle 8 `settlement_units` erhalten beim `resolved`-Übergang korrekt eine `settlement_balance`-Receivable mit dem jeweiligen `balance`-Betrag.
- Ablehnungspfad geprüft: mit offenen blockierenden Prüfungen (C01, fehlender/abweichender Kontoauszugssaldo) simuliert — der `final`-Übergang würde korrekt abgelehnt.
- **Dabei einen echten, kleinen Gap gefunden und behoben:** `settlements`/`settlement_units` hatten in der M1-Migration keine DELETE-Policy — konsistent mit dem Append-only-Muster von `journal_entries`, aber inhaltlich falsch für `DRAFT`, das Kapitel 8.1 ausdrücklich „flüchtig" nennt. Ergänzt: `scripts/migration-hausgeldabrechnung-m1-draft-delete.sql` (DELETE nur für `status = 'draft'`, `review`/`final`/`resolved` bleiben unveränderlich). **Wartet auf Ausführung.**

`tsc --noEmit`, `eslint`, volle Testsuite (117/117) grün.

**Nächster Schritt:** Nach Ausführung der Draft-Delete-Migration ist M4 abgeschlossen. Danach M3 (Heizkostenimport-UI/-Workflow — Datenmodell existiert bereits) oder M5/M6 (Dokumente/Exporte, UI). Gegeben, dass noch keine Oberfläche existiert, dürfte M6 (geführter Ablauf) den größten sichtbaren Fortschritt bringen, ist aber auch der aufwändigste nächste Schritt — Rückfrage beim Auftraggeber sinnvoll, sobald diese Migration gelaufen ist.

### 9.13 Draft-Delete-Migration live verifiziert 2026-09-12

Ausgeführt und bestätigt: Ein `draft` lässt sich über die Session von `koehler@berko.ai` löschen (1 Zeile), derselbe Löschversuch auf einen `review`-Datensatz betrifft 0 Zeilen (RLS blockiert still, kein Fehler — erwartetes Verhalten bei fehlender Policy für diesen Status). Testdaten bereinigt.

**M4 ist damit vollständig abgeschlossen.** Offen aus Kapitel 11: M3 (Heizkostenimport-UI/-Workflow), M5 (Dokumente/Exporte), M6 (geführter UI-Ablauf) — keiner davon ist bisher begonnen.

### 9.14 M6 begonnen 2026-09-12 — erste UI-Oberfläche

Neuer Tab „Jahresabrechnung" (`src/components/dms/PropertyTabBar.tsx`) und Route `/objekte/[propertyId]/abrechnung`:

- `src/components/weg-settlement/shared.tsx` — Typen/Formatierung, spiegelt die API-Antwortformen.
- `SettlementsListSection.tsx` — Jahr wählen, „Berechnen" (ruft `POST .../settlements` auf, wählt das Ergebnis automatisch aus), Liste aller Versionen mit Status.
- `SettlementDetail.tsx` — Statusleiste mit kontextabhängigen Übergangs-Buttons (`Zur Prüfung freigeben` / `Finalisieren` / `Beschluss erfassen` / `Als überholt markieren`), Prüfungsliste mit Quittieren-Aktion für Warnungen, Einzelabrechnungstabelle (K/E/R/V/S je Einheit), Kontenabstimmungstabelle, Kommentarthread (Beiratsprüfung).
- `Finalisieren` ist clientseitig deaktiviert, solange blockierende Prüfungen offen sind oder Warnungen nicht quittiert wurden — spiegelt exakt die serverseitige Validierung in der PATCH-Route.

**Live verifiziert** (Playwright, `koehler@berko.ai`, WEG Waldstraße 82): Jahr 2026 berechnet → Entwurf erscheint in der Liste mit den live berechneten K-Beträgen je Einheit (identisch zu den zuvor per Skript verifizierten Werten) → Kommentar hinzugefügt und angezeigt → Übergang zu „In Prüfung" → „Finalisieren"-Button korrekt deaktiviert (2 blockierende C01-Befunde, da kein Kontoauszugssaldo zum 31.12.2026 erfasst ist). Testdaten anschließend vollständig entfernt. `tsc --noEmit`, volle Testsuite (117/117) grün.

**Bewusst noch nicht umgesetzt:** Heizkostenimport-Formular (M3), PDF-Export (M5), Vermögensbericht-/Rücklagen-Anzeige in der UI (Daten sind über die API bereits verfügbar, aber noch keine eigene Sektion in `SettlementDetail.tsx`), Kostenart-Aufschlüsselung (`costTypeBreakdowns`) wird von der API geliefert, aber noch nicht dargestellt.

**Nächster Schritt:** je nach Priorität — Vermögensbericht/Kostenart-Aufschlüsselung in der bestehenden UI ergänzen (kleine Erweiterung von `SettlementDetail.tsx`, keine neue Route), oder M5 (PDF-Export) als eigenständiges Stück beginnen.

### 9.15 M6-UI vervollständigt 2026-09-12 — alle Auswertungsdaten dargestellt

`SettlementDetail.tsx` um vier Abschnitte ergänzt: Kostenarten-Aufschlüsselung, Rücklagenentwicklung (mit Hinweis bei Soll-/Ist-Abweichung), Vermögensbericht (Kontostände, offene Forderungen, Verbindlichkeiten, sonstiges Vermögen — deutlich als „nicht Gegenstand des Beschlusses" gekennzeichnet, 5.13), Sonderumlagen. Dafür lädt die Komponente jetzt zusätzlich Kostenarten- und Bankkonten-Listen des Objekts (`propertyId` neu als Prop von der Seite durchgereicht) und löst `costTypeId`/`bankAccountId` zu lesbaren Namen auf, statt rohe UUIDs anzuzeigen.

**Live verifiziert** (Playwright, `koehler@berko.ai`, WEG Waldstraße 82): alle neuen Abschnitte zeigen korrekt aufgelöste Klarnamen („Bewirtschaftungskonto", „Hausmeister", „Instandhaltung" usw. statt UUIDs) und die tatsächlichen Beträge aus den echten Buchhaltungsdaten. Testdaten entfernt. `tsc --noEmit`, `eslint`, volle Testsuite (117/117) grün.

Damit ist die unter 9.14 offen gelassene Lücke geschlossen.

### 9.16 M5 umgesetzt 2026-09-12 — PDF-Export, wartet auf Kategorien-Migration

Ergänzt:

- **Kapitel-7-Nachtrag im Rechenkern:** `CostTypeBreakdown` trägt jetzt zusätzlich `keyTotalWeight` (Σ Schlüsselgewicht) und je Einheit `weight` (rohes Schlüsselgewicht) — Kapitel 7 verlangt explizit „Schlüsselgewicht und exakten Anteil je Einheit" als Nachvollziehbarkeits-Information, das fehlte bisher. `distribution.ts`, `engine.ts`, Tests und `fixtures/weg-settlement/S1/expected.json` entsprechend ergänzt (119/119 Tests grün).
- `src/lib/weg-settlement/pdf/` — drei `@react-pdf/renderer`-Vorlagen (Stilkonventionen gespiegelt von `src/lib/expose/pdf.tsx`): `GesamtabrechnungPDF`, `EinzelabrechnungPDF` (Kopf/Kostentabelle mit Schlüssel-Gesamtwert/Einheitswert/Anteil/Ergebnisblock K-E-R-V-S/Infoblock nach 8.3), `VermoegensberichtPDF`.
- `scripts/migration-weg-settlement-document-categories.sql` — neue DMS-Kategoriegruppe `WEG_ABRECHNUNG` mit drei Unterkategorien (Gesamtabrechnung/Einzelabrechnung/Vermögensbericht), analog zu `scripts/migration-categories-expand.sql`. Bewusst getrennt von der bereits bestehenden `VERTRAG_ABRECHNUNGEN.HAUSGELDABRECHNUNG` (contract-Ebene, manueller Upload) — die neuen Kategorien sind `unit`/`property`-Ebene, da `SettlementUnit` an `unitId` hängt, nicht an einen CRM-Vertrag.
- `POST /api/weg-settlement/settlements/[id]/documents` — erzeugt alle PDFs aus dem eingefrorenen Snapshot (nur ab Status `final`/`resolved`, s. 8.1), lädt sie in den `documents`-Storage-Bucket hoch und verlinkt sie über die DMS-Tabelle `documents` (nicht das Legacy-System), gruppiert über einen neuen `document_batches`-Eintrag. `GET` listet bereits erzeugte Dokumente.
- UI: neues `DocumentsPanel.tsx` in `SettlementDetail.tsx` — „PDFs erzeugen" (nur sichtbar/aktiv ab `final`), Liste erzeugter Dokumente mit „Öffnen" (signierte Storage-URL, Muster aus `DocumentPreviewModal.tsx`).

**Wartet auf Ausführung:** `scripts/migration-weg-settlement-document-categories.sql` im Supabase-SQL-Editor — danach folgt die Live-Verifikation (Draft → final schalten, PDFs erzeugen, öffnen, Inhalte gegenprüfen).

**Bewusst noch nicht umgesetzt** (aus Kapitel 8.3): Anschreiben und Beschlussvorlage aus pflegbaren Vorlagen, Sammel-PDF/ZIP-Bündelung, CSV/XLSX-Export für vermietende Eigentümer. Diese sind Erweiterungen desselben Musters, kein Neuaufbau — zurückgestellt, um M5 zunächst mit den drei Kern-Dokumenten (die Kapitel 8.3 explizit strukturell vorgibt) fertigzustellen und live zu verifizieren, statt alles auf einmal ungeprüft zu bauen.

### 9.17 M5 live verifiziert 2026-09-12 — vollständiger Durchlauf, ein Bug gefunden und behoben

Kategorien-Migration ausgeführt und bestätigt. Anschließend voller Durchlauf im Browser (`koehler@berko.ai`, WEG Waldstraße 82, echte Buchhaltungsdaten):

- Kontoauszugssalden zum 31.12.2026 realistisch gesetzt (passend zum tatsächlich berechneten Endbestand, nicht willkürlich) → C01 löst sich auf.
- Statusdurchlauf `draft → review → final` über die UI (Jahressperre wurde beim `final`-Übergang korrekt angelegt).
- „PDFs erzeugen" erzeugte alle 10 Dokumente (1 Gesamtabrechnung, 1 Vermögensbericht, 8 Einzelabrechnungen) fehlerfrei; DMS-Liste zeigt sie korrekt gruppiert.
- Gesamtabrechnung-PDF und eine Einzelabrechnung-PDF visuell geprüft (Playwright-Screenshot): Layout, echte Beträge, Adressat (Name + Anschrift aus `contacts`/`addresses`), Kostentabelle mit Schlüssel/Gesamtwert/Wert-Einheit/Anteil — alles korrekt und rechnerisch konsistent (z. B. Hausmeister 247,00 € × 125,5/980 = 31,63 € für Einheit W01, exakt wie angezeigt).
- Speicherpfad-Konvention `{propertyId}/unit/{unitId}/{categoryId}/{uuid}.pdf` für Einzelabrechnungen live bestätigt (eigene Erweiterung des beobachteten Musters, s. 9.16).
- Erneutes Erzeugen (zweiter Durchlauf) legt neue Dokumente an, ohne die vorherigen zu löschen — Historie bleibt erhalten (gewollt, kein Bug).

**Ein echter Rendering-Bug gefunden und behoben:** Die Formellabels „R = K − E" / „S = R − V" verwendeten das mathematische Minuszeichen (U+2212), das in der Helvetica-Standardschrift von `@react-pdf/renderer` nicht dargestellt wird (unsichtbares Zeichen). Behoben durch normalen Bindestrich „-"; per Screenshot-Vergleich vor/nach der Änderung bestätigt.

Alle Testdaten (20 `documents`-Zeilen inkl. Storage-Objekte, 2 `document_batches`, 1 `settlement` inkl. `settlement_units`, 1 `year_lock`, 2 `balance_confirmations`) anschließend vollständig entfernt. `tsc --noEmit`, volle Testsuite (119/119) grün.

**M5 (Kern-Dokumente) ist damit abgeschlossen und live verifiziert.** Offen aus Kapitel 8.3: Anschreiben/Beschlussvorlage-Vorlagen, Sammel-PDF/ZIP, CSV/XLSX-Export (s. o.). Offen aus Kapitel 11 insgesamt: M3 (Heizkostenimport-UI).

### 9.18 M3 umgesetzt 2026-09-12 — Heizkostenimport, wartet auf Ausführung

- `src/lib/weg-settlement/heating-import.ts` — reine Parser-Funktion `parseHeatingRows()` über bereits tabellarisierte Zeilen (Header-Alias-Erkennung case-insensitiv statt eines pflegbaren Mapping-Profils je Messdienst — bewusste Vereinfachung, s. u.). Sammelt Fehler zeilenweise statt beim ersten Fehler abzubrechen (neues Muster, das es im Repo noch nicht gab). **Dabei einen latenten Bug in der wiederverwendeten `parseAmountToCents`-Funktion gefunden**: Text ohne jede Ziffer wird stillschweigend zu 0 Cent, statt einen Fehler zu werfen — für Bank-CSV-Spalten unkritisch, für einen Dateiimport mit unbekannter Datenqualität aber riskant (eine verunglückte Zelle würde lautlos 0,00 € Heizkosten für eine Einheit ergeben). Nicht die geteilte, bereits getestete Funktion angefasst, sondern am eigenen Aufrufer eine Regex-Vorprüfung ergänzt. 8 neue Tests, alle grün.
- API-Routen `src/app/api/weg-settlement/heating-imports/` — `preview` (multipart, liest CSV/XLSX über die bereits vorhandene `xlsx`-Dependency, löst die Einheiten-Spalte gegen echte `unit_number` auf), `GET/POST` (Liste, Commit — `total_amount` ist bewusst ein **eigenständiges Eingabefeld** und wird nicht aus Σ Zeilen abgeleitet, sonst könnte die Abweichungsprüfung C06 nie auslösen), `[id]` `DELETE` (fehlerhaften Import verwerfen und neu hochladen).
- UI: `HeatingImportPanel.tsx` in `SettlementDetail.tsx` — Upload, Vorschau mit Zeilenfehlern, Eingabefeld „Gesamtbetrag laut Messdienst" mit Abweichungsanzeige, optionale Rundungsdifferenz-Bestätigung/Erläuterung (C06/C07), Liste bestehender Importe mit Löschen.
- **Weiterer RLS-Nachtrag nötig:** `heating_imports`/`heating_import_units` hatten in der M1-Migration ebenfalls keine DELETE-Policy (derselbe Fund wie bei `settlements` in 9.13) — hier ohne „flüchtig"-Einschränkung, da ein Verwalter eine falsch importierte Messdienst-Datei uneingeschränkt ersetzen können muss. Ergänzt: `scripts/migration-hausgeldabrechnung-m3-heating-delete.sql`.

**Bewusst vereinfacht ggü. Spec 5.5.5:** kein pflegbares Mapping-Profil je Messdienst (feste, aber großzügige Alias-Liste für Spaltennamen place dessen) — nachrüstbar, falls ein konkreter Messdienst-Export nicht erkannt wird.

### 9.19 M3 live verifiziert 2026-09-12 — Migration ausgeführt, ein echter Bug gefunden und behoben

Migration `scripts/migration-hausgeldabrechnung-m3-heating-delete.sql` ausgeführt. Anschließend voller Durchlauf im Browser (`koehler@berko.ai`, WEG Waldstraße 82): neue Kostenart „Heizung" (Konto 4040, Heizkosten-Kennzeichen) angelegt, eine Buchung über -960,00 € gebucht, eine 8-zeilige Test-CSV (`heizkosten-test.csv`, Heizung+Warmwasser je Einheit W01–W08, Σ 973,00 €) über `HeatingImportPanel` hochgeladen.

**Erster Durchlauf — Abweichung ohne Bestätigung:** Gesamtbetrag laut Messdienst auf 975,00 € gesetzt (bewusste 2,00 €-Abweichung zur Zeilensumme), ohne Rundungsdifferenz zu bestätigen oder eine Erläuterung einzutragen. Nach „Berechnen" erschienen wie erwartet C06 (Σ Einheitenbeträge ≠ Messdienst-Gesamtbetrag, unbestätigt) und C07 (Überleitungsdifferenz gezahlte Heizkosten ↔ Messdienst-Betrag, ohne Erläuterung) — zusätzlich aber auch **C08** („interner Fehler"), was so nicht sein sollte: C08 prüft eine Invariante, die nur für regulär über `allocate()` verteilte Kostenarten gilt, nicht für Heizkosten (dort ist `total` bewusst der Messdienst-Betrag, `perUnit`-Summe die Zeilensumme — eine Abweichung ist dort schon über C06 abgedeckt, kein Bug).

**Bug behoben:** `checks.ts` C08-Schleife überspringt jetzt Kostenarten mit `isHeating` (s. Codeausschnitt oben in dieser Datei bzw. `src/lib/weg-settlement/checks.ts:101`). Regressionstest in `engine.test.ts` ergänzt, der genau dieses Szenario nachbildet und `C06`/`C07` = ja, `C08` = nein erwartet. `tsc --noEmit` clean, volle Testsuite 59/59 grün.

**Zweiter Durchlauf — Abweichung korrekt bestätigt:** fehlerhaften Import gelöscht (DELETE-Policy aus 9.18 funktioniert), CSV erneut hochgeladen, diesmal Rundungsdifferenz mit -2,00 € bestätigt und eine Erläuterung eingetragen. Nach „Berechnen" zeigen die Prüfungen nur noch die zwei erwarteten C01 (unbestätigte Kontoauszugssalden, unabhängig vom Heizkostenimport) — C05, C06, C07, C08 lösen sich korrekt alle auf. Damit sind beide Zweige des Heizkosten-Abgleichs (unbestätigt → blockiert, bestätigt → frei) sowie der C08-Fix live bestätigt.

Alle Testdaten anschließend vollständig entfernt: `heating_imports`/`heating_import_units`-Zeile, `settlements`/`settlement_units`-Entwurf für 2026, die Test-Buchung samt Journalbuchung (zirkuläre FK `transactions.journal_entry_id` ↔ `journal_entries.source_transaction_id` beidseitig genullt vor dem Löschen, wie schon in 9.17 etabliert), die Kostenart „Heizung" und ihr Konto 4040, die lokale `heizkosten-test.csv` sowie `.playwright-mcp/`. `tsc --noEmit` und volle Testsuite (59/59) abschließend erneut grün.

**M3 ist damit abgeschlossen und live verifiziert.** Damit sind alle in Abschnitt 8 der Empfehlung genannten Kern-Meilensteine (M1–M6) umgesetzt und live geprüft. Weiterhin offen, bewusst zurückgestellt (Kapitel 8.3-Erweiterungen, s. 9.16): Anschreiben-/Beschlussvorlage-Vorlagen, Sammel-PDF/ZIP-Bündelung, CSV/XLSX-Export für vermietende Eigentümer.

### 9.20 Kapitel-8.3-Erweiterung A umgesetzt 2026-09-12 — CSV/XLSX-Export für vermietende Eigentümer, wartet auf Ausführung

Erste der drei zurückgestellten Kapitel-8.3-Erweiterungen (s. 9.16, 9.19). Reihenfolge-Entscheidung: diese zuerst, da vollständig aus bereits vorhandenen `SettlementResult`-Daten ableitbar (kein neues Datenmodell, kein Templating), danach Anschreiben/Beschlussvorlage (neues Templating-Konzept, s. u.), zuletzt Sammel-PDF/ZIP (bündelt die dann vollständige Dokumentmenge).

- `src/lib/weg-settlement/export/renter-export.ts` — reine Funktionen `buildRenterExportRows()` (eine Zeile je Ausgaben-Kostenart mit Betrag ≠ 0 für die Einheit, plus je eine Zeile pro § 35a-Kategorie und CO2-Position aus `UnitInfoBlock`), `renterExportToCsv()` (Semikolon-getrennt, Komma-Dezimaltrennung — bewusst deutsche Excel-Konvention für Doppelklick-Öffnen, da Zielgruppe deutschsprachige Vermieter/Steuerberater sind, anders als die Dateiimport-Konvention in 9.18, wo Mehrdeutigkeit beim Wiedereinlesen vermieden werden musste), `renterExportToXlsxBuffer()` (über die bereits vorhandene `xlsx`-Dependency). Bewusst eigene, von `types.ts` entkoppelte Eingabetypen (`RenterExportCostTypeBreakdown`, `RenterExportUnitInfo` mit `number` statt `Dec`), da der einzige Aufrufer (`documents/route.ts`) stets den bereits JSON-serialisierten `result_snapshot` übergibt, nicht frische Engine-Ergebnisse mit `Decimal`-Feldern. 8 neue Tests, alle grün (67/67 im gesamten Modul).
- `scripts/migration-weg-settlement-renter-export-category.sql` — vierte Unterkategorie `WEG_ABRECHNUNG.VERMIETER_EXPORT` (unit-Ebene), eine Kategorie für beide Dateiformate (CSV und XLSX teilen denselben fachlichen Zweck, Unterscheidung über `file_name`/`mime_type`).
- `POST /api/weg-settlement/settlements/[id]/documents` erweitert: erzeugt je Einheit zusätzlich zur Einzelabrechnung-PDF eine CSV- und eine XLSX-Datei desselben Vermieter-Exports und legt beide im selben `document_batches`-Vorgang ab. `saveDocument()` unterstützt jetzt beliebige MIME-Typen/Dateiendungen statt hart codiertem `application/pdf`.
- UI: `DocumentsPanel.tsx` — Beschriftungen von „PDFs erzeugen"/„PDFs können erst ab Status Final…" auf „Dokumente erzeugen"/„Dokumente können erst ab Status Final…" verallgemeinert, da der Button jetzt mehr als PDFs erzeugt. Keine neue UI-Fläche nötig — die bestehende Dokumentliste/„Öffnen"-Funktion (signierte Storage-URL) funktioniert unverändert für beliebige Dateitypen.

**Wartet auf Ausführung:** `scripts/migration-weg-settlement-renter-export-category.sql` im Supabase-SQL-Editor — danach folgt die Live-Verifikation (Dokumente erzeugen, CSV und XLSX öffnen, Inhalte gegen die Einzelabrechnung einer Einheit gegenprüfen).

### 9.21 Kapitel-8.3-Erweiterung A live verifiziert 2026-09-12 — CSV/XLSX-Export bestätigt

Migration ausgeführt. Voller Durchlauf im Browser (`koehler@berko.ai`, WEG Waldstraße 82, frische Abrechnung 2026 v1, da die vorherige Testabrechnung nach 9.19 bereits vollständig entfernt war):

- Kontoauszugssalden zum 31.12.2026 für beide Bankkonten passend zum berechneten Endbestand erfasst (Bewirtschaftungskonto 2.233,00 €, Rücklagenkonto 12.500,00 €) → C01 löst sich auf, „Stimmt überein".
- Statusdurchlauf `draft → review → final` über die UI.
- „Dokumente erzeugen" erzeugte alle 26 Dokumente fehlerfrei (1 Gesamtabrechnung, 1 Vermögensbericht, 8× Einzelabrechnung, 8× Vermieter-Export CSV, 8× Vermieter-Export XLSX), alle unter der Kategorie „Vermieter-Export" korrekt gruppiert in der Dokumentliste.
- CSV und XLSX für Einheit W01 heruntergeladen und Inhalt gegengeprüft: `Hausmeister;14;ja;31,63` und `Instandhaltung;;nein;117,82` (Semikolon/Komma wie vorgesehen in der CSV; als echte Zahlen 31.63/117.82 in der XLSX). Summe 31,63 € + 117,82 € = 149,45 € — exakt der in der Einzelabrechnung/„Einzelabrechnungen"-Tabelle angezeigte K-Wert für W01. Rechnerische Kontrolle: Hausmeister 247,00 € × 125,5/980 = 31,63 €, Instandhaltung 920,00 € × 125,5/980 = 117,82 € (MEA-Verteilung, Instandhaltung korrekt als „nein" markiert, da nicht umlagefähig/Direktbelastungs-Kostenart).

Keine Bugs gefunden. Alle Testdaten anschließend vollständig entfernt: 26 `documents`-Zeilen inkl. Storage-Objekte, 1 `document_batches`-Eintrag, 1 `year_lock`, 1 `settlement` inkl. `settlement_units`, 2 `balance_confirmations`. Dabei auch ein Alt-Fund aufgeräumt: `verify_m4.mjs` im Projekt-Root war ein liegengebliebenes Scratch-Skript aus der M4-Verifikation weiter oben in dieser Session (nie gelöscht) — jetzt entfernt. `tsc --noEmit` und volle Testsuite (67/67) abschließend erneut grün.

**Kapitel-8.3-Erweiterung A (CSV/XLSX-Export für vermietende Eigentümer) ist damit abgeschlossen und live verifiziert.** Offen: Erweiterung B (Anschreiben/Beschlussvorlage-Vorlagen, erfordert neues Templating-Konzept — Recherche ergab, dass die Codebasis noch kein pflegbares Platzhalter-Template-System besitzt, s. u.), Erweiterung C (Sammel-PDF/ZIP-Bündelung).

### 9.22 Kapitel-8.3-Erweiterung B umgesetzt 2026-09-12 — Anschreiben/Beschlussvorlage-Vorlagen, wartet auf Ausführung

Recherche vor Beginn (Explore-Agent): kein bestehendes Templating-Muster in der Codebasis — die E-Mail-Signatur (`profiles.signature_text`/`signature_html`) ist statischer Text ohne Platzhalter, keine Bibliothek wie Handlebars/Mustache vorhanden. Rückfrage an den Auftraggeber zum Ausgabeformat ergab: **beide Vorlagen als PDF** (statt Anschreiben als PDF + Beschlussvorlage als Klartext, oder beide als Klartext).

- `src/lib/weg-settlement/template.ts` — bewusst kein Templating-Framework, sondern eine minimale eigene Lösung: `renderTemplate()` (einfache `{{platzhalter}}`-Ersetzung per Regex, unbekannte Platzhalter bleiben sichtbar stehen als Tippfehler-Hilfe), `splitParagraphs()` (Leerzeilen trennen Absätze, einzelne Zeilenumbrüche werden zu Leerzeichen zusammengezogen, da `@react-pdf/renderer`s `Text` keinen harten Umbruch aus `\n` erzeugt), `buildAnschreibenVars()`/`buildBeschlussvorlageVars()` (reine Funktionen, die Cent-Beträge in fertige Platzhalter-Strings übersetzen), sowie eingebaute Default-Texte für beide Vorlagenarten. 11 neue Tests, alle grün.
- `scripts/migration-weg-settlement-templates.sql` — neue Tabelle `weg_settlement_templates` (eine Zeile je Mandant und Vorlagenart `anschreiben`/`beschlussvorlage`, `unique(tenant_id, kind)`), RLS nach dem Muster aus `scripts/migration-dokumente.sql` (`folders_write`/`files_write`): Lesen für jedes Mandantsmitglied, Schreiben nur mit `is_tenant_admin()`. Dazu zwei neue Dokumentkategorien `WEG_ABRECHNUNG.ANSCHREIBEN` (unit-Ebene) und `WEG_ABRECHNUNG.BESCHLUSSVORLAGE` (property-Ebene).
- `GET/PUT /api/weg-settlement/templates` — liefert gespeicherte Vorlagen ergänzt um die eingebauten Defaults für noch nicht angepasste Arten (ein Mandant ohne eigene Anpassung bekommt trotzdem sinnvollen Text statt einer leeren Vorlage); `PUT` upsertet eine Vorlagenart.
- UI: neue Sektion „Vorlagen · WEG-Jahresabrechnung" in `Einstellungen` (`src/app/(app)/einstellungen/page.tsx`), modelliert nach dem bestehenden Signatur-Editor (Textarea + Speichern-Button je Vorlagenart), mit Platzhalter-Hinweis je Vorlage.
- `src/lib/weg-settlement/pdf/AnschreibenPDF.tsx` (je Einheit, mit Adressat wie die Einzelabrechnung) und `BeschlussvorlagePDF.tsx` (Objekt-Ebene) — einfache Brief-Layouts nach denselben Stilkonventionen (`styles.ts`, `PageChrome.tsx`).
- `POST /api/weg-settlement/settlements/[id]/documents` erweitert: lädt die Mandanten-Vorlagen (oder Defaults) einmalig, erzeugt die Beschlussvorlage einmal je Abrechnung (Gesamtkosten = `overall.expenseTotal`, Gesamteinnahmen = Σ `advancePaymentsIst`+`specialLevyPaymentsIst`+`otherIncomeTotal`) und je Einheit ein Anschreiben (Abrechnungsspitze aus `unitResult.balance`, Vorzeichen bestimmt „Nachschuss"/„Guthaben"/„ausgeglichen").

**Wartet auf Ausführung:** `scripts/migration-weg-settlement-templates.sql` im Supabase-SQL-Editor — danach folgt die Live-Verifikation (Vorlage in Einstellungen anpassen, Dokumente erzeugen, Anschreiben/Beschlussvorlage-PDF öffnen und gegen die angepasste Vorlage sowie die tatsächlichen Abrechnungswerte prüfen).

### 9.23 Kapitel-8.3-Erweiterung B live verifiziert 2026-09-12 — Vorlagen bestätigt

Migration ausgeführt. In `Einstellungen` beide Vorlagen mit eindeutigen Testmarkern überschrieben (`TESTMARKER-ANSCHREIBEN` / `TESTMARKER-BESCHLUSS`), anschließend eine frische Abrechnung 2026 berechnet, Kontoauszugssalden gesetzt, auf `final` gestellt und „Dokumente erzeugen" geklickt.

- **Anschreiben (Einheit W01):** PDF enthält den angepassten Text mit korrekt ersetzten Platzhaltern — `{{jahr}}` → 2026, `{{objekt_name}}` → „WEG Waldstraße 82", `{{einheit}}` → „W01", `{{spitze_betrag}}` → „149,45 €" (exakt der K-Wert aus der Einzelabrechnung/9.20), `{{spitze_art}}` → „Nachschuss" (da Spitze > 0). Echter Adressat (Name + Anschrift aus `contacts`) korrekt im Kopf.
- **Beschlussvorlage:** Erster Versuch zeigte noch den Default-Text — Ursache war kein Code-Fehler, sondern ein Test-Ablauf-Artefakt (die zweite `textarea`-Eingabe traf nach dem ersten Speichern-Klick auf eine durch Re-Render veraltete Playwright-Referenz, bevor der eigene Tippvorgang im Component-State ankam). Nach erneutem Setzen bestätigte ein direkter DB-Read, dass die Zeile korrekt geschrieben wurde; nach erneutem „Dokumente erzeugen" zeigte das PDF den angepassten Text „TESTMARKER-BESCHLUSS Jahresabrechnung 2026 für WEG Waldstraße 82: Gesamtkosten 1.167,00 €, Gesamteinnahmen 0,00 €" — Gesamtkosten korrekt als Hausmeister (247 €) + Instandhaltung (920 €) = 1.167,00 €, Gesamteinnahmen korrekt 0,00 € (keine Zinserträge o. Ä. gebucht).
- `GET /api/weg-settlement/templates` liefert für nicht angepasste Vorlagenarten korrekt die eingebauten Defaults (vor der ersten Anpassung sichtbar geprüft).

Kein echter Bug in Code oder Migration gefunden. Alle Testdaten vollständig entfernt: 70 `documents`-Zeilen (zwei Erzeugungsdurchläufe) inkl. Storage-Objekte, 2 `document_batches`, 1 `year_lock`, 1 `settlement` inkl. `settlement_units`, 2 `balance_confirmations`, sowie beide Test-Vorlagen aus `weg_settlement_templates` (damit keine „TESTMARKER"-Texte als scheinbar echte Mandanten-Vorlage stehen bleiben). `tsc --noEmit` und volle Testsuite (78/78) abschließend erneut grün.

**Kapitel-8.3-Erweiterung B (Anschreiben/Beschlussvorlage-Vorlagen) ist damit abgeschlossen und live verifiziert.** Offen aus Kapitel 8.3: Erweiterung C (Sammel-PDF/ZIP-Bündelung) — mit Erweiterung B ist jetzt die vollständige Dokumentmenge (Gesamtabrechnung, Einzelabrechnungen, Vermögensbericht, Vermieter-Exporte, Anschreiben, Beschlussvorlage) vorhanden, die gebündelt werden kann.

### 9.24 Kapitel-8.3-Erweiterung C umgesetzt 2026-09-12 — Sammel-PDF/ZIP-Bündelung, wartet auf Ausführung

Letzte der drei zurückgestellten Kapitel-8.3-Erweiterungen — jetzt möglich, da mit Erweiterung B die vollständige Dokumentmenge existiert (s. 9.22/9.23).

- `src/lib/weg-settlement/bundle.ts` — zwei reine Funktionen: `mergePdfBuffers()` (fügt PDF-Buffer über `pdf-lib` in Reihenfolge zusammen, gleiches Muster wie das bereits bestehende Vorlagen-Merge in `src/app/api/expose/route.ts`), `buildZipBuffer()` (baut ein ZIP-Archiv über `jszip`, das bereits transitiv als Abhängigkeit des `xlsx`-Pakets vorhanden war — jetzt als `jszip@^3.10.1` explizit in `package.json` aufgenommen, da direkt importiert). 5 neue Tests, alle grün (83/83 im gesamten Modul).
- `scripts/migration-weg-settlement-bundle-category.sql` — zwei neue Unterkategorien `WEG_ABRECHNUNG.SAMMEL_PDF` und `WEG_ABRECHNUNG.ZIP_EXPORT` (beide property-Ebene).
- `POST /api/weg-settlement/settlements/[id]/documents` erweitert: sammelt beim Erzeugen jedes einzelnen Dokuments parallel dessen Buffer — PDFs für das Sammel-PDF (in der Reihenfolge Gesamtabrechnung → Vermögensbericht → Beschlussvorlage → je Einheit Einzelabrechnung + Anschreiben) und alle Dateien (inkl. CSV/XLSX) für das ZIP (Struktur: Property-Ebene-Dateien im Wurzelverzeichnis, `Einheiten/<Einheitennummer>/…` je Einheit). Einheiten werden dafür mit der bereits vorhandenen `naturalCompare()` (aus `allocation.ts`, bisher nur für Zuteilungs-Sortierung genutzt) nach Einheitennummer sortiert, damit beide Bündel eine nachvollziehbare Reihenfolge haben statt der zufälligen DB-Abfragereihenfolge. Am Ende werden Sammel-PDF und ZIP als zwei zusätzliche Dokumente gespeichert.

**Wartet auf Ausführung:** `scripts/migration-weg-settlement-bundle-category.sql` im Supabase-SQL-Editor — danach folgt die Live-Verifikation (Dokumente erzeugen, Sammel-PDF öffnen und Seitenzahl/-reihenfolge gegen die Einzeldokumente prüfen, ZIP herunterladen und Dateistruktur/Inhalte gegenprüfen).

### 9.25 Kapitel-8.3-Erweiterung C live verifiziert 2026-09-12 — Sammel-PDF und ZIP bestätigt

Migration ausgeführt. Frische Abrechnung 2026 berechnet, Kontoauszugssalden gesetzt, auf `final` gestellt, „Dokumente erzeugen" geklickt.

- **Sammel-PDF:** über die Storage-API heruntergeladen und mit `pdf-lib` geöffnet — 19 Seiten, exakt die erwartete Summe (Gesamtabrechnung 1 + Vermögensbericht 1 + Beschlussvorlage 1 + 8 Einheiten × (Einzelabrechnung + Anschreiben) = 3 + 16 = 19).
- **ZIP:** heruntergeladen und mit `unzip -l` aufgelistet — genau die erwartete Struktur: die drei Objekt-Ebene-PDFs im Wurzelverzeichnis, darunter `Einheiten/W01/` bis `Einheiten/W08/` in korrekter natürlicher Reihenfolge, jede mit Einzelabrechnung-PDF, Anschreiben-PDF, Vermieterexport-CSV und -XLSX (35 Dateien + 9 Verzeichniseinträge = 44 Einträge laut `unzip -l`). CSV-Inhalt für Einheit W01 aus dem ZIP entpackt und gegen die in 9.20 bereits verifizierten Werte geprüft (Hausmeister 31,63 €, Instandhaltung 117,82 €) — identisch.

Kein Bug gefunden. Alle Testdaten vollständig entfernt: 37 `documents`-Zeilen inkl. Storage-Objekte, 1 `document_batches`, 1 `year_lock`, 1 `settlement` inkl. `settlement_units`, 2 `balance_confirmations`. `tsc --noEmit` und volle Testsuite (83/83) abschließend erneut grün.

**Kapitel-8.3-Erweiterung C (Sammel-PDF/ZIP-Bündelung) ist damit abgeschlossen und live verifiziert.** Damit sind alle drei in 9.16 zurückgestellten Kapitel-8.3-Erweiterungen (A: CSV/XLSX-Export, B: Anschreiben/Beschlussvorlage-Vorlagen, C: Sammel-PDF/ZIP) umgesetzt und live geprüft. Kapitel 8.3 ist damit vollständig abgedeckt. Verbleibend aus dem Gesamtplan (Abschnitt 11 der ursprünglichen Empfehlung): M7 (KI-Funktionen — Stufe 3 der Zahlungszuordnung, K1 Belegerkennung, K3 Erläuterungsentwürfe), sowie die in Kapitel 12 als "nach dem MVP" markierten offenen Fachfragen (F5 Mehrhausanlagen/Kostenstellen).

### 9.26 M7 begonnen 2026-09-12 — Bestandsaufnahme und K3 (Erläuterungsentwürfe) umgesetzt

**Bestandsaufnahme vor Beginn:** M7 laut Spec-Meilensteintabelle umfasst "Stufe 3 der Zuordnung (B8.2), K1 und K3". Prüfung des tatsächlichen Stands von B8.2 (`src/lib/weg-buchhaltung/import/matching.ts`) ergab: nur ein vereinfachtes "Stufe 1" (deterministische `AssignmentRule`-Zuordnung nach IBAN/Verwendungszweck) existiert — die volle Spec-Stufe-1 (7 Teilregeln: Umbuchung, Rücklastschrift, virtuelle IBAN, Zahlungsreferenz, bekanntes Zahlerkonto, Zuordnungsregeln, Bankentgelte) und die gesamte Stufe 2 (Heuristik-Scoring) sind nicht gebaut. Spec-Stufe 3 ("KI … nur für Umsätze ohne Vorschlag aus Stufe 2") setzt eine funktionierende Stufe 2 voraus, die fehlt. Reihenfolge-Entscheidung analog zum Kapitel-8.3-Vorgehen: zuerst die von diesem Stand unabhängigen, sofort baubaren Teile (K3, dann K1), die Stufe-3-Zuordnung zuletzt — dafür wird vor Beginn eine bewusste Vereinfachung nötig sein (KI direkt nach der vorhandenen Stufe 1, ohne Stufe 2 dazwischen), die noch mit dem Auftraggeber abzustimmen ist.

Als Vorlage für die KI-Anbindung dient das bereits etablierte Muster aus `src/app/api/optimization/extract/route.ts` (Anthropic-`tool_use` mit erzwungenem `tool_choice`, JSON-Schema als Zielstruktur) bzw. `src/app/api/expose/route.ts`/`src/lib/ingestion/extract.ts` (freier Fließtext über `anthropic.messages.create()`), beide bereits produktiv genutzt — keine neue Integrationsart nötig.

**K3 umgesetzt** (Kapitel 9: "Für Warnungen wie C12 und für die Heizkosten-Überleitung entsteht ein Textentwurf … den der Verwalter bearbeitet"). Da C12 mangels Vorjahres-Kostenhistorie weiterhin nicht implementiert ist (s. 9.8), bewusst auf den einzigen aktuell verfügbaren Auslöser beschränkt: die Heizkosten-Überleitungsdifferenz (C07).

- `PATCH /api/weg-settlement/heating-imports/[id]` — neu: erlaubt das nachträgliche Ändern von `confirmed_difference`/`reconciliation_note` an einem bereits committeten Import, ohne die Datei erneut hochzuladen (bisher nur beim Erst-Upload möglich). Keine neue Migration nötig — die UPDATE-Policy für `heating_imports` existierte bereits aus M1.
- `POST /api/weg-settlement/heating-imports/[id]/explain` — neu, das eigentliche K3: lädt Messdienst-Gesamtbetrag, Σ Einheitenbeträge und die tatsächlich gebuchten Heizkosten-Transaktionen des Jahres (eigene, schlanke Abfrage statt des vollen Rechenkerns), berechnet Überleitungsdifferenz/Rundungsabweichung selbst nach und lässt Claude daraus einen 2-3-sätzigen deutschen Textentwurf verfassen. **Bewusst keine Eigentümerdaten übermittelt** (nur Objektname, Jahr, Messdienst, drei Centbeträge) — erfüllt die Spec-Vorgabe für K3 wörtlich. Der System-Prompt macht ausdrücklich klar, dass die KI den tatsächlichen Grund nicht kennt und nur plausible, allgemein übliche Ursachen als *Entwurf* nennt, den der Verwalter vor Verwendung prüft — keine erfundenen Fakten. Die Ausgabe wird nur zurückgegeben, nie selbst gespeichert; das Speichern bleibt ein bewusster Klick auf „Speichern" (PATCH), wodurch die Spec-Vorgabe "nie automatisch bestätigt" strukturell erfüllt ist, ohne einen separaten `status=SUGGESTED`-Datensatz zu benötigen.
- UI: `HeatingImportPanel.tsx` — Stift-Icon je bestehendem Import öffnet eine Inline-Bearbeitungszeile (Rundungsdifferenz + Erläuterung) mit einem „Textvorschlag (KI)"-Knopf, der das Textfeld vorbefüllt (nicht automatisch speichert).

`tsc --noEmit` clean, keine neuen Lint-Fehler (der vorbestehende `react-hooks/set-state-in-effect`-Fund im selben Muster wie in 9.20/9.22 betrifft eine unveränderte Zeile). Volle Testsuite weiterhin 83/83 grün (K3 fügt keine neue reine Rechenlogik hinzu, die isoliert testbar wäre — die Textgenerierung selbst ist ein LLM-Aufruf und wird live verifiziert, nicht unit-getestet, analog zu den bereits bestehenden KI-Routen `optimization/extract`, `expose`).

**Wartet auf Live-Verifikation** (kein neues Datenbankschema, daher keine Migration nötig): Heizkostenimport mit Überleitungsdifferenz anlegen, „Textvorschlag (KI)" auslösen, Text inhaltlich prüfen, speichern, C07-Auflösung in der Abrechnung bestätigen.

### 9.27 K3 live verifiziert 2026-09-12 — Textentwurf bestätigt

Testaufbau: Kostenart „Heizung" (Konto 4040) mit einer Buchung über -960,00 € angelegt, Heizkosten-CSV mit Σ 973,00 € importiert (Gesamtbetrag laut Messdienst ebenfalls 973,00 €, damit gezielt nur C07 auslöst, nicht C06) — Ergebnis nach „Berechnen": C01×2 (unabhängig) und C07 „Überleitungsdifferenz … (-1300 Cent) ohne Erläuterungstext", exakt wie erwartet (960 € gezahlt − 973 € Messdienst = -13,00 €).

Stift-Symbol geöffnet, „Textvorschlag (KI)" geklickt — Claude lieferte binnen weniger Sekunden einen sachlich korrekten, angemessen zurückhaltenden Entwurf: *„Die Heizkosten-Überleitungsdifferenz von -13,00 € ergibt sich vermutlich daraus, dass der Abrechnungszeitraum des Messdienstes Techem nicht deckungsgleich mit dem Kalenderjahr 2026 ist, wodurch sich Erfassung und tatsächlicher Zahlungsfluss zeitlich verschieben. Ebenso können Voraus- oder Endabrechnungen des Messdienstes sowie ein zeitlicher Versatz zwischen der Zahlung durch die WEG und der Rechnungsstellung durch Techem zu dieser Abweichung beitragen. Dieser Entwurfstext ist vor Verwendung durch den Verwalter zu prüfen […]"* — Betrag, Messdienst-Name und Jahr korrekt aus den übergebenen Zahlen übernommen, keine erfundenen Fakten, keine Eigentümerdaten, explizite Prüfaufforderung an den Verwalter wie im System-Prompt vorgegeben.

Text gespeichert (PATCH), neu berechnet: C07 löst sich korrekt auf, verbleibend nur die zwei erwarteten C01. Kein Bug gefunden. Alle Testdaten vollständig entfernt (Heizkostenimport + Einheiten, Settlement, Test-Transaktion + Journalbuchung, Kostenart „Heizung", Konto 4040). `tsc --noEmit` und volle Testsuite (83/83) abschließend erneut grün.

**K3 (Erläuterungsentwürfe) ist damit abgeschlossen und live verifiziert.** Nächster M7-Baustein: K1 (Belegerkennung).

### 9.28 K1 umgesetzt 2026-09-12 — Belegerkennung, wartet auf Live-Verifikation

Vor Beginn per Rückfrage geklärt: K1 setzt eine Möglichkeit voraus, einen Beleg an eine Buchung anzuhängen — die gab es noch nicht (`transactions.document_id` existierte als Spalte, aber ungenutzt). Empfehlung „auch die Anhänge-Fähigkeit mitbauen" bestätigt.

- `POST /api/weg-buchhaltung/extract-invoice` — neu, das eigentliche K1: lädt den Beleg aus dem Storage, ruft Claude mit `tool_use` und erzwungenem `tool_choice` auf (gleiches Muster wie `src/app/api/optimization/extract/route.ts`). **Kostenart wird über ein `enum` im Tool-Schema zwingend aus den tatsächlichen Ausgaben-Kostenarten der WEG gewählt** — Claude kann keine Kostenart erfinden, die es in diesem Objekt nicht gibt. Ausgabe: Kostenart-Vorschlag, BetrKV-Nummer, § 35a-Kategorie, Lohnanteil, Leistungszeitraum, Rechnungsbetrag und -nummer (letztere beide nur zur visuellen Gegenprüfung durch den Verwalter, nicht in die Buchung übernehmbar — der bestätigte Buchungsbetrag stammt bewusst weiterhin ausschließlich aus dem Bankumsatz, nicht aus einer möglicherweise falsch gelesenen Rechnungssumme).
- `PATCH /api/weg-buchhaltung/transactions/[id]` erweitert um `document_id`, `labor_amount`, `par35a_category` als zulässige Felder (bisher nur `cost_type_id`/`unit_id`/`owner_id`/`purpose`).
- UI: `TransactionsSection.tsx` — die bestehende „Entwurf — bestätigen"-Inline-Zeile erweitert um „Beleg anhängen" (lädt in den bestehenden Storage-Bucket `documents` unter der bereits vorhandenen DMS-Kategorie `FINANZEN.RECHNUNGEN_EINGANG`, registriert über die bestehende `POST /api/documents`-Route — keine neue Kategorie/Migration nötig) und „KI-Vorschlag aus Beleg", der die Vorschlagsfelder anzeigt und erst nach explizitem Klick auf „Übernehmen" in die editierbaren Formularfelder überträgt; gespeichert wird weiterhin erst mit „Bestätigen" (PATCH), wie bei K3 keine automatische Übernahme.

`tsc --noEmit` clean, keine neuen Lint-Fehler (der vorbestehende `react-hooks/set-state-in-effect`-Fund betrifft wie in 9.20/9.22/9.26 eine unveränderte Zeile). Volle Testsuite weiterhin grün (137/137 über `weg-settlement` + `weg-buchhaltung` zusammen) — K1 fügt keine neue reine Rechenlogik hinzu (Extraktion ist ein LLM-Aufruf, live verifiziert statt unit-getestet, analog zu K3/`optimization/extract`).

**Wartet auf Live-Verifikation:** Testrechnung als PDF anlegen, an eine Entwurfs-Buchung anhängen, „KI-Vorschlag aus Beleg" auslösen, Felder gegenprüfen, übernehmen, bestätigen, Buchungssatz/Kostenart-Zuordnung kontrollieren.

### 9.29 K1 live verifiziert 2026-09-12 — Belegerkennung bestätigt

Testaufbau: synthetische Rechnungs-PDF erzeugt (`pdf-lib`, Freitext-Layout) — „Hausmeisterservice Müller GmbH", Rechnungsnr. RG-2026-0042, Leistungszeitraum 01.02.–28.02.2026, Betrag 247,00 €. Dazu eine Entwurfs-Buchung (-247,00 €, Zweck „Hausmeisterservice Müller GmbH RG-2026-0042", noch ohne Kostenart) angelegt.

Ablauf im Browser: „Entwurf — bestätigen" geöffnet, Beleg über den neuen Datei-Input hochgeladen (Storage-Upload + `POST /api/documents` liefen wie erwartet, Dateiname erschien sofort in der Zeile), „KI-Vorschlag aus Beleg" geklickt. Ergebnis binnen weniger Sekunden:

- **Kostenart „Hausmeister"** korrekt aus der echten Kostenartenliste der WEG gewählt (nicht erfunden — das Tool-Schema erzwingt eine der tatsächlich vorhandenen IDs).
- **§ 35a: Haushaltsnahe Dienstleistung** — plausible Kategorisierung für Hausmeisterdienstleistungen.
- **BetrKV Nr. 3** — reine Anzeige-Information (wird nirgends übernommen/gespeichert, s. Designentscheidung unten), spielt für die Korrektheit der Buchung keine Rolle.
- **„Laut Beleg: 247,00 €"** — stimmt mit dem tatsächlichen Buchungsbetrag überein (Gegenprüfung für den Verwalter sichtbar).
- **Zeitraum 2026-02-01 – 2026-02-28, Rechnungsnr. RG-2026-0042** — korrekt aus dem Fließtext extrahiert.

„Übernehmen" geklickt: Kostenart-Auswahl und § 35a-Kategorie wurden korrekt ins Formular übertragen (Lohnanteil blieb leer, da im Beleg kein separater Lohnanteil ausgewiesen ist — korrektes Verhalten, nicht erfunden). „Bestätigen" geklickt: Buchung erfolgreich bestätigt. Direkter DB-Read danach bestätigt alle Felder korrekt gesetzt: `status=confirmed`, `cost_type_id` (Hausmeister), `document_id` (verknüpfter Beleg), `par35a_category=household_service`, `labor_amount=null`.

Kein Bug gefunden. Design-Entscheidung bestätigt sich als richtig: Der bestätigte Buchungsbetrag stammt weiterhin ausschließlich aus dem Bankumsatz (-247,00 €), nicht aus der von der KI gelesenen Rechnungssumme — Rechnungsbetrag, BetrKV-Nummer, Zeitraum und Rechnungsnummer sind bewusst nur Anzeige-/Gegenprüfinformation ohne Schreibpfad in die Buchung. Alle Testdaten vollständig entfernt (Test-Buchung, Journalbuchung, Beleg-Dokument samt Storage-Objekt, lokale Test-PDF). `tsc --noEmit` und volle Testsuite (137/137 über `weg-settlement` + `weg-buchhaltung`) abschließend erneut grün.

**K1 (Belegerkennung) ist damit abgeschlossen und live verifiziert.** Damit sind zwei der drei M7-Bausteine (K1, K3) umgesetzt und live geprüft. Verbleibend: Stufe 3 der Zahlungszuordnung — hierfür ist vor Baubeginn noch die in 9.26 aufgeworfene Scope-Frage zu klären (KI direkt nach der vorhandenen vereinfachten Stufe 1, ohne die in der Spec vorgesehene Stufe 2, oder Stufe 2 zuerst nachbauen).

### 9.30 B8.2 Stufe 2 (Heuristik) umgesetzt 2026-09-12 — wartet auf Ausführung

Auftrag: statt Stufe 3 direkt vereinfacht auf die vorhandene Stufe 1 aufzusetzen, zuerst die in der Spec vorgesehene Stufe 2 (Heuristik) nachbauen, damit Stufe 3 später wie in B8.2 beschrieben nur noch für Umsätze ohne Stufe-2-Vorschlag greift.

**Vorab geschlossene Lücke:** Für "Namensähnlichkeit zwischen Zahler und Eigentümer" (B8.2) fehlte der Name der Gegenpartei komplett — nur die IBAN wurde importiert. Ergänzt:
- `scripts/migration-weg-buchhaltung-stufe2.sql` — neue Spalte `transactions.counterparty_name`.
- CAMT.053-Parser (`camt053.ts`): liest zusätzlich `<Dbtr><Nm>`/`<Cdtr><Nm>` (je nach Richtung dieselbe Zuordnungslogik wie bei der IBAN).
- CSV-Import (`csv.ts`): neues optionales Mapping-Feld `counterpartyNameColumn`.
- Bestehende Tests (`camt053.test.ts`, `csv.test.ts`, `duplicates.test.ts`, `matching.test.ts`) entsprechend angepasst/erweitert.

**Kern von Stufe 2** — `src/lib/weg-buchhaltung/matching-heuristic.ts`, reine Funktionen:
- `nameSimilarity()` — Jaccard-Ähnlichkeit über normalisierte Wort-Tokens (Umlaute/Groß-Kleinschreibung neutralisiert).
- `purposeReferencesUnit()` — erkennt eine Einheitennummer unabhängig von Trennzeichen im Verwendungszweck.
- `computeStage2IncomingSuggestions()` — bewertet bei Eingängen jeden Eigentümer-Kandidaten der WEG nach den drei Spec-Kriterien (Namensähnlichkeit 0,45 · Betrag passt zu offener Sollstellung oder einem Vielfachen des Monatshausgelds 0,35 · Einheitennummer im Verwendungszweck 0,20), gefiltert auf den Standard-Anzeige-Schwellenwert 0,6, mit `highlight` ab 0,85 — exakt die in der Spec genannten Standardwerte.
- `computeStage2OutgoingSuggestion()` — bei Ausgängen: häufigste Kostenart der bisherigen Buchungen derselben Gegenpartei (IBAN-Historie), Score = Anteil an der Gesamthistorie.
- Bewusste Vereinfachung: "Monatsangaben im Verwendungszweck" fließen nicht als eigenes Gewicht ein (ein Monatsname unterscheidet nicht zwischen Eigentümern); das unterscheidungskräftige Signal (Einheitennummer) bleibt erhalten. 17 neue Tests, alle grün.

**Integration:** `POST /api/weg-buchhaltung/bank-accounts/[id]/import/preview` erweitert — nach Stufe 1 werden für unaufgelöste Zeilen (kein Regeltreffer, keine Dublette) Stufe-2-Vorschläge berechnet: bei Eingängen über eine neue `loadOwnerCandidates()`-Ladefunktion (Eigentümer der WEG zum aktuellen Datum, mit Monatshausgeld aus `plan_advances` und offenen Sollstellungen aus `receivables`), bei Ausgängen über die IBAN-Historie bestätigter Buchungen. Vereinfachung: Eigentümerschaft/Wirtschaftsplan werden zum heutigen Datum aufgelöst, nicht je Buchungstag der importierten Zeile — für einen nie automatisch bestätigten Vorschlag ausreichend genau.

**Dabei eine funktionale Lücke im bestehenden Commit-Pfad gefunden und behoben:** `POST .../import/commit` setzte für jeden Zufluss immer `kind: 'income'`, unabhängig davon, ob eine Einheit zugeordnet war — eine per Stufe 1 oder 2 einer Einheit zugeordnete Hausgeldzahlung wäre also nie als `advance_payment` gebucht worden und hätte nie den Sollstellungsausgleich (B7.6) oder die Ist-Zuführung zur Rücklage (B7.7) ausgelöst. Behoben: `kind` ist jetzt `advance_payment`, sobald eine `unitId` gesetzt ist (unabhängig davon, ob das durch Stufe 1, Stufe 2 oder manuelle Auswahl geschah). `counterparty_name` wird beim Commit ebenfalls jetzt mitgespeichert.

**UI:** `ImportPanel.tsx` — neue Spalte „Einheit" (Auswahl aus allen Einheiten der WEG, manuell überschreibbar), neues optionales CSV-Mapping-Feld „Spalte Name Gegenpartei", und für Zeilen ohne Stufe-1-Treffer eine Hinweiszeile mit den Stufe-2-Vorschlägen (Punktwert, Begründungstext, „Übernehmen"-Knopf je Kandidat) — nichts wird automatisch übernommen, jede Zuordnung bleibt ein bewusster Klick, wie es B8.3 für Stufe 2 verlangt ("werden nie automatisch bestätigt"). `TransactionsSection.tsx`/die Buchhaltungsseite reichen dafür `owners` (bereits vorhandene Property-Daten) zusätzlich an `ImportPanel` durch.

`tsc --noEmit` clean, keine neuen Lint-Fehler (der vorbestehende `react-hooks/set-state-in-effect`-Fund betrifft unveränderte Zeilen). Volle Testsuite 155/155 grün (17 neue Tests für die Heuristik, bestehende Import-Tests an das neue Feld angepasst).

**Wartet auf Ausführung:** `scripts/migration-weg-buchhaltung-stufe2.sql` im Supabase-SQL-Editor — danach folgt die Live-Verifikation (CAMT.053-Import mit einem noch unbekannten Zahler hochladen, Stufe-2-Vorschlag prüfen, übernehmen, Buchung bestätigen, `kind`/Sollstellungsausgleich kontrollieren).

### 9.31 B8.2 Stufe 2 live verifiziert 2026-09-12 — beide Zweige bestätigt

Migration ausgeführt. Testaufbau: eine frühere bestätigte Buchung (IBAN `DE22...6677`, Kostenart Hausmeister) angelegt, um eine Gegenpartei-Historie für den Ausgänge-Zweig zu haben. Synthetische CAMT.053-Datei mit zwei Einträgen selbst erzeugt:

- **Eingang** 409,80 € von „Stefan Krueger" (bewusst ohne Umlaut, zum Testen der Namensnormalisierung), Verwendungszweck „Hausgeld W01 September 2026" — der echte Eigentümer von W01 in dieser WEG heißt „Stefan Krüger".
- **Ausgang** -55,00 € an „Hausmeisterservice Müller GmbH", gleiche IBAN wie die vorbereitete Historie, Verwendungszweck „Zusatzauftrag Laubentfernung September".

Import-Vorschau zeigte für beide Zeilen korrekt keinen Stufe-1-Treffer, aber genau die erwarteten Stufe-2-Vorschläge:

- Eingang: „Übernehmen: W01 / Stefan Krüger" — 100 %, Begründung „Namensähnlichkeit zu „Stefan Krüger" (100 %) · Betrag entspricht einer offenen Sollstellung oder einem Vielfachen des Monatshausgelds · Einheit „W01" im Verwendungszweck erkannt". Die Namensnormalisierung (Krueger ↔ Krüger) griff korrekt.
- Ausgang: „Übernehmen: Hausmeister" — 100 %, Begründung „Einzige bisherige Buchung derselben Gegenpartei nutzte diese Kostenart".

Beide Vorschläge übernommen, Import committet, danach beide Entwürfe über die bestehende „Entwurf — bestätigen"-Funktion bestätigt:

- Der Hausmeister-Ausgang wurde korrekt gebucht, Bilanz-Bankkonto entsprechend belastet.
- Der Eingang wurde korrekt als `kind = 'advance_payment'` gespeichert (die in 9.30 behobene Lücke griff), mit `unit_id`/`owner_id` aus dem Stufe-2-Vorschlag. Nach Bestätigung: Bankkonto +409,80 €, Konto „1200 · Forderungen gegen Eigentümer" −409,80 € — der Zahlungsausgleichsversuch lief durch (kein Fehler), fand aber keine passende offene Sollstellung (für dieses Test-Objekt sind aktuell keine `receivables`-Zeilen für diesen Eigentümer angelegt — eine Eigenschaft der Testdaten, nicht der Stufe-2-Logik) und blieb daher als ungebundenes Guthaben stehen; das ist erwartetes Verhalten des bereits vorhandenen Ausgleichsmechanismus (B7.6.3), nicht Gegenstand dieses Meilensteins.

Kein Bug in der neuen Stufe-2-Logik gefunden. Alle Testdaten vollständig entfernt (2 neue Transaktionen samt Journalbuchungen, 1 vorbereitete Historien-Transaktion, lokale CAMT-Testdatei). `tsc --noEmit` und volle Testsuite (155/155) abschließend erneut grün.

**B8.2 Stufe 2 (Heuristik) ist damit abgeschlossen und live verifiziert — beide Zweige (Eingänge über Eigentümer-Scoring, Ausgänge über Gegenpartei-Historie) funktionieren wie in der Spec beschrieben.** Damit ist die Voraussetzung für Stufe 3 (KI, M7) erfüllt: sie kann jetzt wie in B8.2 vorgesehen ausschließlich für Umsätze greifen, für die weder Stufe 1 noch Stufe 2 einen Vorschlag liefern.

### 9.32 B8.2 Stufe 3 (KI-Zahlungszuordnung) umgesetzt und live verifiziert 2026-09-13 — M7 damit vollständig

Letzter Baustein von M7. Keine neue Migration nötig (keine neuen Spalten).

**Kern** — `src/lib/weg-buchhaltung/matching-ai.ts`, neue Funktion `suggestCostTypeStage3()`: ruft Claude (`claude-sonnet-5`) über das gleiche Tool-Use-Muster wie K1 (`extract-invoice/route.ts`) und die bestehende Optimierungs-Extraktion auf — `cost_type_id` ist im Tool-Schema als `enum` auf die tatsächlichen Kostenarten-IDs der WEG beschränkt, die KI kann also keine Kostenart erfinden. Bewusste Konsequenz aus dem Spec-Satz "Eigentümerlisten werden nicht übermittelt; der Namensabgleich bleibt deterministisch": Stufe 3 schlägt ausschließlich eine Kostenart vor, nie eine Eigentümerpartei — für Eingänge wie Ausgänge gleichermaßen. Eingabe an die KI: Verwendungszweck, Betrag, Richtung, bei Ausgängen zusätzlich der Name der Gegenpartei (bei Eingängen bewusst nicht, um keine Eigentümernamen zu übermitteln). Kandidatenliste wird vorab nach Richtung gefiltert (nur `income`- bzw. `expense`-Kostenarten). Ein API-Fehler oder eine leere/ungültige Antwort liefert `null` — der Import läuft ohne KI-Vorschlag weiter, nichts blockiert.

**Integration:** `POST .../import/preview` erweitert um einen dritten Berechnungsschritt nach Stufe 2 — für Zeilen, die weder einen Stufe-1-Treffer noch einen Stufe-2-Vorschlag haben, wird `suggestCostTypeStage3()` parallel (`Promise.all`) aufgerufen, mit der bereits geladenen Kostenartenliste der WEG. Rückgabetyp `RowWithStage3` (neu in `import/types.ts`) trägt zusätzlich `stage3CostTypeSuggestion: { costTypeId, costTypeName, confidence, reasoning } | null`.

**UI:** `ImportPanel.tsx` — eigene Hinweiszeile (violett, um sie optisch von der Stufe-2-Zeile (bernstein) zu unterscheiden) mit „Übernehmen"-Knopf, Konfidenzwert und Begründungssatz; erscheint nur, wenn weder ein Stufe-2-Eigentümer- noch -Kostenarten-Vorschlag vorliegt. Wie bei Stufe 2 wird nichts automatisch übernommen — jede Zuordnung bleibt ein bewusster Klick.

`tsc --noEmit` clean, `eslint` auf allen geänderten Dateien clean, volle Testsuite weiterhin 155/155 grün (keine neuen Tests nötig — `matching-ai.ts` ruft einen externen LLM auf und wird bewusst nicht unit-getestet, wie schon bei K1/der Optimierungs-Extraktion).

**Live-Verifikation:** Selbst erzeugte CAMT.053-Testdatei mit einem Ausgang (-742,30 €) an eine neue, bislang unbekannte Gegenpartei „Schmidt Hausservice GmbH" (keine IBAN-Historie, kein Stufe-2-Treffer möglich), Verwendungszweck „Rechnung 4471 Hausmeisterservice Treppenhausreinigung und Winterdienst September". Import-Vorschau zeigte korrekt keinen Stufe-1/2-Treffer, aber einen Stufe-3-Vorschlag: „Übernehmen: Hausmeister" · 95 % · Begründung „Rechnung eines Hausmeisterservice für Treppenhausreinigung und Winterdienst entspricht der Kostenart 'Hausmeister'." Vorschlag übernommen, Import committet. DB-Kontrolle danach: `kind = 'expense'`, `cost_type_id` = Hausmeister, `unit_id`/`owner_id` beide `null` (Stufe 3 hat wie vorgesehen keine Eigentümerzuordnung versucht), `status = 'suggested'` (reiner Entwurf, keine automatische Bestätigung). Kein Bug gefunden. Testtransaktion und lokale CAMT-Testdatei vollständig entfernt.

**Damit ist B8.2 (alle drei Stufen: Regeln, Heuristik, KI) sowie M7 insgesamt (K1 Belegerkennung, K3 Erläuterungsentwürfe, Stufe 3 KI-Zahlungszuordnung) abgeschlossen und live verifiziert.**

### 9.33 Gap-Audit gegen die kanonische Teil-I-Spec (MB1–MB6) 2026-09-13

Auf Wunsch des Auftraggebers ("dann lass es uns mal vollständig machen") wurde geprüft, wie weit die gebaute Buchhaltung (B0–B9, oben) gegenüber dem wörtlichen Meilenstein-Raster aus Kapitel 11 der kanonischen Spec (MB1–MB6) tatsächlich reicht. Befund (Explore-Agent, code-verifiziert): MB1 im Kern erfüllt (Datenmodell/RLS/Eröffnungswerte teilweise — `OpeningBalanceSet` fehlt ganz). MB2 (Bankimport) hatte deutliche Lücken (s. 9.34). MB3 (offene Posten) hat Hausgeld/Ausgleich/Teilzahlung solide, aber Eigentümerwechsel (B7.4) war komplett unimplementiert. MB4 hatte nur eine stark vereinfachte Stufe 1 (kein Umbuchungs-/Rücklastschrift-/virtuelle-IBAN-/PayerAccount-Erkennen), keine automatische Bestätigung, keine Lernfunktion. MB5 fehlten Klärungsliste, Kontoblatt-UI, Offene-Posten-Liste, Journal-Viewer, Eröffnungswerte-UI komplett. MB6 (Jahressperre) existierte nur als grobe Teilprüfung ohne echte Saldenketten-Prüfung.

Entscheidung mit dem Auftraggeber: Spec-Reihenfolge einhalten und mit MB2 beginnen (Grundlage für MB4/MB6), bestehendes Datenmodell erweitern statt auf die separaten `BankStatement`/`ImportBatch`/`BookingLine`-Entitäten der Spec umzustellen, synthetische Testdateien jetzt, echte anonymisierte Bankdateien folgen später vom Auftraggeber. MB3–MB6 werden nach MB2 jeweils in einem eigenen Planungsschritt konkretisiert, nicht im Voraus — konsistent mit "ein Meilenstein pro Sitzung, danach Stopp für Review".

### 9.34 MB2 (Bankimport) umgesetzt und live verifiziert 2026-09-13

**Migration** `scripts/migration-weg-buchhaltung-mb2.sql` — additiv: neue `transactions`-Spalten für den vollen CAMT.053-Feldkatalog (`counterparty_bic`, `end_to_end_id`, `mandate_id`, `bank_ref`, `bank_tx_code_domain/family/subfamily/proprietary`, `return_reason_code`, `is_reversal`, `batch_parent_id`, `needs_manual_split`, `dedup_key`, `raw` jsonb); `transactions.kind`-Constraint um `settlement_payment`/`returned_debit`/`suspense` erweitert (aus B8.1, vorgezogen für MB3/MB4, um keine zweite Migration für dieselbe Spalte zu brauchen); `bank_statement_imports.bank_account_id` nullable (eine Datei/ZIP kann mehrere Konten betreffen) plus `file_hash`, `rejected_statements`, `warnings`, `statement_summary`. **Ausgeführt, live verifiziert.**

**`src/lib/weg-buchhaltung/import/camt053.ts`** komplett restrukturiert: `parseCamt053()` liefert jetzt `NormalizedStatement[]` (mehrere `Stmt`-Elemente je Datei) statt einer flachen `ParsedRow[]`. Neu: Schemaversion-Erkennung (`.001.02`/`.001.08` über den Namespace), `Sts=BOOK`-Filter (`PDNG` wird ignoriert), Währungsprüfung (≠ EUR → `rejectedEntries`, BC06), `Bal`-Parsing (`OPBD`/`PRCD`/`CLBD` → Anfangs-/Schlusssaldo + Datum), Sammelbuchungs-Aufteilung (B5.4: mehrere `TxDtls` mit passender Summe → je eine Zeile mit gemeinsamer `batchParentId`; nicht passende Summe → eine Zeile mit `needsManualSplit: true`), Erfassung von BIC/Ende-zu-Ende-Referenz (`NOTPROVIDED` → `null`)/Mandatsreferenz/Bankreferenz/Bankgeschäftsvorfallcode/Rückgabegrund/Storno, strukturierte `raw`-Ablage je Zeile. `ParsedRow` bleibt unverändert (Abwärtskompatibilität für `matching.ts`/`matching-heuristic.ts`/`matching-ai.ts`).

**`src/lib/weg-buchhaltung/import/duplicates.ts`** neu gefasst (B5.5): `computeDedupKeys()` bevorzugt eine im Batch eindeutige Bankreferenz (`ref:...`), sonst ein Hash aus Konto-IBAN/Datum/Betrag/Gegen-IBAN/Ende-zu-Ende-Referenz/Verwendungszweck plus laufender Index je gleichem Hash (`hash:...#n`) — zwei legitime, identisch aussehende Zahlungen am selben Tag bleiben dadurch zwei Umsätze, wie B12 es explizit verlangt.

**Neu:** `saldenkette.ts` (B5.6, zwei Prüfungen: Anfangssaldo = Vorauszugs-Schlusssaldo, Anfangssaldo + Umsätze = Schlusssaldo — beide optional bei fehlenden Salden), `file-hash.ts` (SHA-256, Idempotenz nach B5.2), `zip.ts` (ZIP-Entpackung über die bereits vorhandene `jszip`-Abhängigkeit, bisher nur für Sammel-PDF-Export genutzt).

**IBAN-Kontoauflösung ohne URL-Strukturbruch:** `preview`/`commit`-Routen bleiben unter `bank-accounts/[id]/...`, aber `[id]` ist jetzt nur noch Auth-Scope und CSV-Fallback-Ziel. Jeder CAMT.053-Auszug wird über seine eigene IBAN gegen alle Konten der Property aufgelöst; unbekannte IBAN → Auszug wird abgelehnt und gemeldet (BC02), andere Auszüge derselben Datei laufen weiter. Response/Request sind jetzt nach Konto gruppiert (`statements[]`), nicht mehr eine flache `rows[]`. Commit schreibt jede Gruppe auf ihr eigenes Konto (nicht mehr blind auf die URL) und legt bei bekanntem Schlusssaldo automatisch eine `BalanceConfirmation` mit Quelle `'import'` an. Sicherheitsprüfung ergänzt: der Commit validiert, dass jedes in `statements[]` übergebene Konto tatsächlich zur Property des URL-Kontos gehört (verhindert, dass ein Client ein fremdes Konto unterschiebt).

**UI (`ImportPanel.tsx`):** ein Vorschau-Block je aufgelöstem Konto/Auszug, Banner für abgelehnte Auszüge und Saldenketten-Warnungen, Hinweis-Badge bei Sammelbuchungen, die nicht automatisch aufgeteilt werden konnten. ZIP als Upload-Option ergänzt.

**Bewusste Vereinfachungen (im Plan-Review-Dialog offengelegt):** `raw` speichert eine strukturierte JSON-Repräsentation, nicht die rohe XML-Zeichenkette; keine eigene `BankStatement`-Tabelle (Saldenpaare leben in `statement_summary` des Imports plus den ohnehin vorhandenen `balance_confirmations`); B5.8 (Adapter-Interface `StatementParser`/`StatementFetcher`) nicht als eigene Typhierarchie gebaut, da aktuell nur zwei Implementierungen ohne echten Fetcher existieren — CSV wird stattdessen direkt in der Route in die normalisierte Form gewrappt.

`tsc --noEmit` clean, `eslint` auf allen geänderten/neuen Dateien clean. Testsuite: 4 neue Dateien (`saldenkette.test.ts`, `zip.test.ts`, `file-hash.test.ts`, vollständig neu geschriebene `camt053.test.ts`), `duplicates.test.ts`/`matching.test.ts` an die neue Signatur angepasst — 179/179 grün (vorher 155).

**Live-Verifikation** (`koehler@berko.ai` / WEG Waldstraße 82, mehrere selbst erzeugte CAMT.053-Dateien):
- Sammelbuchung mit passender Summe → korrekt in zwei Zeilen mit gemeinsamer `batch_parent_id` aufgeteilt, je eigener Stufe-3-Vorschlag.
- Sammelbuchung mit nicht passender Summe → eine Zeile, `needs_manual_split = true`, Hinweis-Badge in der UI.
- `Sts=PDNG`-Eintrag → korrekt nicht importiert.
- Zwei identisch aussehende Zahlungen am selben Tag → beide blieben eigenständig (unterschiedliche `dedup_key`-Suffixe `#0`/`#1`), keine fälschliche Dublettenerkennung untereinander.
- Datei mit zwei `Stmt`-Elementen (eine bekannte IBAN, eine unbekannte) in einer Datei → unbekannte korrekt abgelehnt und mit Dateiname gemeldet, bekannte trotzdem verarbeitet **und auf das richtige Konto geschrieben, obwohl im Dropdown ein anderes Konto vorausgewählt war** — bestätigt, dass die Kontozuordnung tatsächlich der IBAN folgt, nicht mehr der URL.
- Bewusst gebrochene Saldenkette (Auszugs-Anfangssaldo ≠ vorhandener Schlusssaldo) → Warnung mit korrektem erwarteten/tatsächlichen Betrag angezeigt **und** nach Commit korrekt in `bank_statement_imports.warnings` persistiert (dabei eine echte Lücke gefunden und behoben, s. u.).
- Erneuter Import derselben Datei → Datei-Hash-Kurzschluss („bereits importiert“), nichts doppelt angelegt.
- ZIP mit zwei CAMT-Dateien (je ein anderes Konto) → beide korrekt extrahiert und auf ihr jeweiliges Konto aufgelöst.
- Automatisch angelegte `BalanceConfirmation` (Quelle `'import'`) wurde von der bereits vorhandenen Kontenabstimmungs-Anzeige sofort korrekt aufgegriffen (Differenzanzeige gegen die bestätigten Buchungen) — bestätigt die Integration in eine bereits bestehende Oberfläche ohne Anpassung an ihr.

**Dabei eine echte Lücke gefunden und behoben:** Die Commit-Route übernahm `rejectedStatements`/Saldenketten-Warnungen zunächst gar nicht in die neuen `bank_statement_imports`-Spalten (nur die Vorschau zeigte sie an) — das Importprotokoll (B5.2 Schritt 10) wäre nach dem Commit unvollständig gewesen. Behoben: Client sendet `rejectedStatements` und je Gruppe `saldenketteWarnings` beim Commit mit, die Route persistiert sie unverändert in `bank_statement_imports.rejected_statements`/`.warnings`. Live erneut verifiziert (s. o.).

Alle Testdaten vollständig entfernt (7 Testtransaktionen, 3 `bank_statement_imports`-Zeilen, 1 automatisch angelegte `balance_confirmation`, alle lokalen Test- und ZIP-Dateien).

**MB2 (Bankimport) ist damit abgeschlossen und live verifiziert.** Offen aus MB2 bewusst zurückgestellt: echte anonymisierte Mehrbanken-CAMT-Dateien (Sparkasse/Volksbank/Hausbank) für die volle B12-Parser-Konformität — liefert der Auftraggeber nach.

**Nächster Schritt:** MB3 (Sollstellungen/offene Posten) im Detail planen — zentrale bekannte Lücke ist Eigentümerwechsel (B7.4), aktuell 0 % umgesetzt.

**Wartet auf Ausführung:** `scripts/migration-hausgeldabrechnung-m3-heating-delete.sql` im Supabase-SQL-Editor — danach folgt die Live-Verifikation (Beispieldatei importieren, Prüfungen C05–C07 gezielt auslösen, Einzelabrechnung-PDF mit Heizkosten prüfen).
