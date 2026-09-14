# KI-Mietermatching — Fortschritts-Log

Living-Dokument, analog zu `docs/specs/hausgeldabrechnung-plan.md`: wird nach
jedem Meilenstein aktualisiert. Kanonische Spec:
`docs/specs/Spezifikation_Mietermatching.md` (v0.1).

## 1. MM1 (Kern: Profil, Bewerber, Scoring, Übersicht/Detail) umgesetzt und live verifiziert — 2026-09-14

**Umsetzungsplan:** `/Users/dberkovi/.claude/plans/refactored-plotting-wind.md`
(Kontext, Nutzerentscheidungen, Fahrplan für MM2–MM4 dort dokumentiert).

**Nutzerentscheidungen:** erster Meilenstein = Datenmodell + Wunschmieter-
Profil-CRUD + manuelle Bewerber-Erfassung (kein Dokument-Upload) +
deterministisches Scoring + Übersicht/Detail mit Match-Kreis. RLS
mandantenweit (kein Pro-Objekt-Verwalter-Scoping, da im Schema nirgends
vorhanden). Score-Berechnung synchron im Request statt über eine `pgmq`-
Queue. Kalender-Verknüpfung (`{{besichtigungstermin}}`) und Anna-
Sprachintegration zurückgestellt — beide Module existieren im Code noch
nicht in einer dafür geeigneten Form.

**Migration** `scripts/migration-mietermatching-mm1.sql` — additiv, drei neue
Tabellen: `desired_tenant_profile` (1:1 je Einheit, inkl. eines eigenen
`target_rent_cold`-Felds — in der Spec §2.1 nicht gelistet, aber für die
Einkommen/Miete-Quote zwingend nötig, hier ergänzt), `applicant` (manuelle
Erfassung, `source`/`status`-Enums wie Spec §2.2), `match_result`
(append-only, keine Update-Policy — Spec §9: "neue Version statt
Überschreiben"). Alle drei mit Standard-RLS (`current_tenant_id()`,
`is_tenant_admin()`). **Ausgeführt, live verifiziert.**

**`src/lib/mietermatching/scoring.ts`** — reine Scoring-Engine, sechs
Kriterien aus Spec §3.2 (income_ratio, employment, schufa, household_size,
move_in, documents_completeness), gewichtete Summe `/100` (Gewichtungssumme
wird nicht hart auf 100 erzwungen, Effekt einer Abweichung bleibt sichtbar).
Fehlende Angaben liefern einen neutralen Score (50, bzw. 40 bei
`schufa_required` ohne Auskunft) statt 0 und senken stattdessen die
`confidence` (Spec §3.3). MM1-Vereinfachungen dokumentiert: `employment`
bewertet nur exakte Übereinstimmung (keine Restlaufzeit-Staffelung, da kein
entsprechendes Feld modelliert ist); `documents_completeness` liefert immer
einen neutralen Platzhalter-Score, da die Dokumentenerfassung erst mit MM2
kommt. 16 Vitest-Tests, alle grün.

**API-Routen** (`/api/mietermatching/profiles`, `/profiles/[id]`,
`/applicants`, `/applicants/[id]`): Profil-CRUD, Bewerber-Erfassung mit
synchroner Score-Berechnung direkt im POST (keine Queue), Bewerber-Update
mit Score-Neuberechnung als neue `match_result`-Zeile (append-only).

**UI:** `MatchCircle.tsx` (handgerollte SVG-Donut-Komponente — keine
Chart-Bibliothek im Repo vorhanden, verifiziert), `ProfileEditor.tsx`,
`ApplicantsSection.tsx` (Liste + Erfassungsformular), Bewerber-Detailseite
unter `/objekte/[propertyId]/einheiten/[unitId]/bewerber/[applicantId]`
(Kriterien-Breakdown mit Ziel-/Bewerberwert, Teil-Score, Gewichtung, Hinweis
bei fehlenden Angaben). Alles direkt in die bestehende Unit-Detailseite
integriert (App-Konvention `/objekte/[propertyId]/...`, nicht die
Spec-Route `/units/[unitId]/...`).

`tsc --noEmit` und `eslint` clean auf allen neuen/geänderten Dateien
(einzige Lint-Treffer: die projektweit vorbestehende
`react-hooks/set-state-in-effect`-Warnung beim etablierten `useEffect(() =>
{ load(); }, [load])`-Muster, verifiziert gegen die unveränderte
Originaldatei — keine Regression).

**Live-Verifikation** (`koehler@berko.ai`, Einheit M01 im „Miethaus
Zschochersche Straße 15" — besser geeignet als eine WEG-Einheit, da
Mietermatching auf Mietobjekte zielt; Testpasswort für den Zugang temporär
per Service-Role gesetzt, da kein dokumentiertes Passwort für diesen
Testaccount vorlag):
- Profil angelegt (Zielmiete 1.000 €, Quote min. 3×, HH-Größe 1–2,
  Einzugszeitraum 01.10.–01.12.2026, nur „unbefristet" akzeptiert, SCHUFA
  nicht zwingend) → korrekt gespeichert und in der Übersicht dargestellt.
- Bewerber „Anna Perfekt" (Einkommen 3.500 €, unbefristet, HH 2, Einzug
  01.11.2026, SCHUFA ohne Negativmerkmale) → **95 %**, exakt der von den
  Unit-Tests erwartete Wert (alle Kriterien 100, `documents_completeness`
  MM1-Platzhalter 50).
- Bewerber „Max Unvollständig" (nur HH-Größe + Einzugstermin angegeben,
  Rest leer) → **60 %** mit Warnsymbol am Match-Kreis und Banner „Angaben
  unvollständig — Score mit reduzierter Konfidenz" in der Detailansicht;
  jedes fehlende Kriterium zeigt den erklärenden Hinweistext statt eines
  0-Scores — exakt der erwartete Wert.
- Bewerber „Peter Ausschluss" (Einkommen 1.500 € bei Zielmiete 1.000 €
  → Quote 1,5 unter der harten Untergrenze 2,0, selbstständig statt
  unbefristet, SCHUFA harte Negativmerkmale) → **25 %**, exakt der
  erwartete Wert.
- Übersichtsliste korrekt absteigend sortiert (95 % / 60 % / 25 %).
- Detailansicht zeigt für alle drei Bewerber den vollständigen
  Kriterien-Breakdown (Zielwert, Bewerberwert, Teil-Score, Gewichtung)
  korrekt.

Alle Testdaten vollständig entfernt (3 `applicant`, 3 `match_result`, 1
`desired_tenant_profile`), `.playwright-mcp`-Verzeichnis gelöscht, Dev-Server
gestoppt.

**MM1 ist damit abgeschlossen und live verifiziert.** Nächster Schritt laut
Fahrplan: MM2 (Dokument-Upload + KI-Extraktion, `applicant_document`) —
noch nicht begonnen, wartet auf Freigabe.

## 2. MM2 (Dokument-Upload + KI-Extraktion) umgesetzt und live verifiziert — 2026-09-14

**Migration** `scripts/migration-mietermatching-mm2.sql` — additiv: vier neue
Dokumentkategorien `MIETERMATCHING_DOKUMENTE.*` (Einkommensnachweis, SCHUFA,
Selbstauskunft, Sonstige; Level `unit`, `allowed_roles` bewusst leer — vor
Vertragsabschluss nicht für externe Portal-Rollen sichtbar) und die neue
Tabelle `applicant_document` (verknüpft eine `documents`-Zeile mit einem
Bewerber + gecachtem KI-Extraktionsergebnis, Standard-RLS).
**Kategorie-ID-Kollision bei der ersten Ausführung:** Gruppe `0014` war in der
Live-DB bereits durch eine nicht ins Repo zurückportierte `WEG_ABRECHNUNG`-
Migration belegt (bestätigt das in `hausgeldabrechnung-plan.md` dokumentierte
Problem, dass `supabase-schema.sql` nicht vollständig aktuell ist) — per
Service-Role-Introspektion den nächsten freien Gruppen-Code (`0015`) ermittelt
und die Migration + `CATEGORY_BY_DOC_TYPE`-Map in der Route entsprechend
korrigiert. **Danach ausgeführt, live verifiziert.**

**Scoring-Engine erweitert** (`src/lib/mietermatching/scoring.ts`):
`documents_completeness` wertet jetzt echte `uploadedDocumentTypes` gegen
`profile.requiredDocuments` aus (Anteil vorhandener Pflichttypen × 100,
Hinweistext nennt die fehlenden Typen), statt wie in MM1 immer einen
neutralen Platzhalter zu liefern. `required_documents` ist jetzt eine feste
`ApplicantDocType[]`-Auswahl (Profil-Editor: Toggle-Buttons statt Freitext).
`missingDocuments` im `ScoringResult` sind jetzt die tatsächlich fehlenden
Typen. 18 Vitest-Tests (2 neue Fälle + 1 Fall auf 100 % korrigiert), alle grün.

**`src/lib/mietermatching/rescoring.ts`** (neu) — bündelt die zuvor in
`applicants/route.ts` und `[id]/route.ts` duplizierte Score-Neuberechnung
(`rescoreApplicant()`, `loadUploadedDocTypes()`), jetzt auch von den neuen
`applicant-documents`-Routen genutzt (Upload/Löschung eines Dokuments löst
automatisch eine Neuberechnung aus, append-only `match_result`).

**`src/lib/mietermatching/extract-applicant-document.ts`** (neu) — K1-Muster
(Anthropic Tool-Use, `tool_choice` erzwungen, System-Prompt verbietet
Erfinden von Fakten): extrahiert Nettoeinkommen, Beschäftigungsart,
Haushaltsgröße, SCHUFA-Einschätzung aus einer einzelnen Unterlage, je nach
`doc_type` im Prompt kontextualisiert.

**API-Routen** (`/api/mietermatching/applicant-documents`,
`/applicant-documents/[id]`, `/applicant-documents/[id]/extract`): Upload-
Metadaten anlegen (`documents`-Zeile level=`unit` + `applicant_document`-
Verknüpfung) + Rescoring; Soft-Delete inkl. Storage-Entfernung (wie
`/api/documents/[id]`) + Rescoring; KI-Extraktion cached das Ergebnis in
`applicant_document.extracted_data`, ändert aber nie automatisch den
Bewerber-Datensatz (harte Regel wie bei K1).

**UI:** `ApplicantDocumentsSection.tsx` (neu) — Dokumenttyp-Auswahl + Upload
(gleiches Client-Upload-Muster wie `TransactionsSection.tsx`), Liste mit
KI-Vorschlag-Button, Löschen, und bei vorhandener Extraktion eine
"Übernehmen"-Zeile. Bewerber-Detailseite bekam zusätzlich ein editierbares
Bewerberdaten-Formular (vorher read-only) — "Übernehmen" befüllt nur das
Formular, gespeichert wird erst über den regulären "Speichern"-Button
(PATCH `/applicants/[id]`, löst Rescoring aus). `ProfileEditor.tsx`:
"Benötigte Dokumente" von Freitext auf feste Toggle-Buttons umgestellt.

`tsc --noEmit` clean, `eslint` clean (einzige Treffer: dieselbe
projektweit vorbestehende `react-hooks/set-state-in-effect`-Warnung wie bei
MM1, keine Regression). Volle Testsuite (`weg-buchhaltung`, `weg-settlement`,
`mietermatching`): 197/197 grün.

**Live-Verifikation** (`koehler@berko.ai`, Einheit M01, neues Profil +
Bewerber „Anna Musterfrau" ohne Einkommensangabe, Pflichtdokument
„Einkommensnachweis"; Testpasswort wieder temporär per Service-Role gesetzt,
danach zurückgesetzt; Dev-Server ist während der Sitzung einmal abgestürzt
und wurde neu gestartet, ohne dass eine laufende Aktion verloren ging):
- Bewerber ohne Unterlagen → **45 %**, `documents_completeness` korrekt
  `0/100` mit Hinweis "Fehlt: Einkommensnachweis".
- Selbst erzeugte, synthetische Gehaltsabrechnung (PDF via `pdf-lib`,
  Netto 2.800,00 €, „unbefristet") hochgeladen → **55 %**,
  `documents_completeness` korrekt auf `100/100` gesprungen (Upload allein
  zählt schon, unabhängig von der Extraktion) — exakt der erwartete Delta
  von +10 Punkten (Gewicht 10 %).
- „KI-Vorschlag" → Claude erkannte korrekt „Einkommen: 2800.00 €" und
  „Beschäftigung: unbefristet" aus dem PDF, ließ Haushaltsgröße/SCHUFA
  korrekt leer (nicht im Dokument enthalten, keine Erfindung).
- „Übernehmen" → Formularfelder befüllt, Score zu diesem Zeitpunkt noch
  unverändert (keine automatische Übernahme).
- „Speichern" → Score sprang korrekt auf **57 %** (Einkommen/Miete-Quote
  2,8 von Ziel 3,0 → 80/100, Beschäftigung 0/100 da im Testprofil keine
  akzeptierte Beschäftigungsart ausgewählt war — beides exakt nach
  Rechenformel nachgerechnet und bestätigt).

Alle Testdaten vollständig entfernt (1 `applicant`, 1 `applicant_document`
inkl. Storage-Datei, 3 `match_result`, 1 `desired_tenant_profile`), lokales
Test-PDF und `.playwright-mcp`-Verzeichnis gelöscht, Dev-Server gestoppt.

**MM2 ist damit abgeschlossen und live verifiziert.** Nächster Schritt laut
Fahrplan: MM3 (`message_template`-CRUD, Einladen/Ablehnen-Flow,
`matching_action`-Audit, Bulk-Ablehnung) — noch nicht begonnen, wartet auf
Freigabe.

## 3. MM3 (Einladen/Ablehnen, Vorlagen, Audit) umgesetzt und live verifiziert — 2026-09-14

**Migration** `scripts/migration-mietermatching-mm3.sql` — additiv, zwei neue
Tabellen: `message_template` (Spec §2.6, `type` invitation/rejection,
`channel` email/sms, `is_default`/`active`) und `matching_action` (Spec §2.5,
append-only Audit-Trail wie `match_result` — keine Update-Policy;
`template_id` mit `on delete set null`, damit eine spätere Vorlagen-Löschung
den historischen Snapshot in `rendered_subject`/`rendered_message` nicht
mitreißt). `applicant.status` unterstützte `invited`/`rejected` bereits seit
MM1, keine Änderung dort nötig.

**`src/lib/mietermatching/message-templates.ts`** (neu, isomorph) —
`buildApplicantMessageVars()`, `findUnfilledPlaceholders()` (Spec §6.2:
"fehlende Platzhalterwerte lösen eine Warnung statt eines fehlerhaften
Versands aus") sowie eingebaute Standardtexte für Einladung/Ablehnung, die
greifen, solange der Mandant keine eigene Default-Vorlage angelegt hat.
`renderTemplate()` wird von `src/lib/weg-settlement/template.ts`
reexportiert statt dupliziert — dort bereits als reine, domänenlose
`{{key}}`-Ersetzung vorhanden. 5 neue Vitest-Tests.

**`src/lib/mietermatching/send-matching-action.ts`** (neu, server-only) —
bündelt SMTP-Versand (nodemailer + `getImapCredentials()`, gleiches Konto
wie beim regulären E-Mail-Versand des Verwalters), `matching_action`-Insert
und `applicant.status`-Update; von der Einzel- und der Bulk-Route geteilt.

**API-Routen:** `/api/mietermatching/message-templates` (+ `/[id]`) für
CRUD — Setzen von `is_default` entfernt den Default-Status bei allen
anderen Vorlagen desselben `type`; Löschen der letzten Vorlage eines Typs
ist serverseitig blockiert (Spec §7), nicht nur clientseitig.
`/api/mietermatching/applicants/[id]/matching-action` versendet exakt den
vom Verwalter im Dialog geprüften/editierten Text (kein Server-seitiges
Neu-Rendern) und protokolliert ihn. `/api/mietermatching/applicants/bulk-reject`
rendert dagegen serverseitig je Bewerber (keine Einzel-Bearbeitung
vorgesehen, Spec §6.3), ein Audit-Snapshot pro Bewerber trotz gemeinsamer
Vorlage. `GET .../applicants/[id]` liefert jetzt zusätzlich `unit`
(für Einheiten-Bezeichnung/-Adresse in den Platzhaltern) und
`matching_actions` (Verlauf).

**UI:** `MessageTemplatesSection.tsx`, eingebettet in die bestehende
`/einstellungen`-Seite als neue Karte „Vorlagen · Mietermatching" (App-
Konvention: eine gemeinsame Einstellungen-Seite statt der Spec-Route
`/settings/message-templates` — wie schon die WEG-Anschreiben-Vorlagen dort
verortet). `MatchingActionPanel.tsx` auf der Bewerber-Detailseite: rendert
die Default- oder gewählte Vorlage clientseitig (dieselben reinen
Funktionen wie im Vorlagen-Editor), Betreff/Text bleiben vor dem Versand
editierbar, Warnhinweis bei unbefüllten Platzhaltern, Besichtigungstermin
als freies Textfeld (Kalender-Verknüpfung weiterhin zurückgestellt, s. MM1).
`ApplicantsSection.tsx`: Mehrfachauswahl-Checkboxen + Sammelbestätigung mit
Anzeige der verwendeten Vorlage (Spec §6.3).

`tsc --noEmit` clean. `eslint` clean bis auf zwei Treffer: die bekannte
`react-hooks/set-state-in-effect`-Warnung (jetzt auch in
`MessageTemplatesSection.tsx`, gleiches etabliertes Muster wie überall sonst)
und ein `react/no-unescaped-entities`-Fund in der Sammelbestätigung (echter,
neuer Fund — behoben durch `&quot;`-Escaping). Volle Testsuite: 202/202 grün.

**Live-Verifikation** (`koehler@berko.ai`, Einheit M01 — Testaccount hat
bereits eine konfigurierte IMAP/SMTP-Verbindung, echter Mailversand also
ohne Zusatzaufwand testbar):
- Eigene Ablehnungs-Vorlage „Standard-Absage freundlich" in den
  Einstellungen angelegt und als Standard markiert → korrekt gespeichert
  und in der Liste mit Stern-Markierung dargestellt.
- Bewerberin „Lisa Einladung" (E-Mail = Testaccount selbst) → Dialog
  „Zur Besichtigung einladen" nutzte mangels eigener Einladungs-Vorlage
  korrekt den eingebauten Standardtext, Betreff/Text vollständig mit
  Bewerber-, Einheiten- (inkl. korrekter Adresse "Zschochersche Straße 15,
  04229 Leipzig") und Verwalterdaten ("Köhler") vorbefüllt; unbefüllter
  `{{besichtigungstermin}}`-Platzhalter korrekt als Warnung markiert, nach
  Eingabe verschwunden. Nach Versand: Status korrekt auf „Eingeladen",
  Verlaufszeile „Zuletzt eingeladen am 14.9.2026", `matching_action`-Zeile
  mit exaktem Snapshot von Betreff/Text und `template_id = null` (Standard-
  text) persistiert.
- Bewerber „Tom Bulkablehnung" per Mehrfachauswahl + Sammelbestätigung
  abgelehnt → Bestätigungsdialog nannte korrekt die verwendete Vorlage
  „Standard-Absage freundlich"; nach Bestätigung Status korrekt auf
  „Abgelehnt", `matching_action`-Zeile mit `template_id` der benutzerdefi­
  nierten Vorlage und exakt dem eigenen Vorlagentext (Platzhalter korrekt
  ersetzt) persistiert.
- Beide E-Mails tatsächlich per SMTP zugestellt und per IMAP-Sync wieder im
  Posteingang des Testaccounts aufgetaucht (Badge „E-Mails 1" in der
  Navigation) — bestätigt echten Versand, nicht nur einen simulierten
  Erfolg.

Alle Testdaten vollständig entfernt (2 `applicant`, 2 `match_result`, 2
`matching_action`, 1 `desired_tenant_profile`, 1 `message_template`, 2
Test-E-Mails aus der `emails`-Tabelle), `.playwright-mcp`-Verzeichnis
gelöscht, Testpasswort zurückgesetzt, Dev-Server gestoppt.

**MM3 ist damit abgeschlossen und live verifiziert. Damit ist der in
MM1–MM3 geplante Kernumfang von KI-Mietermatching vollständig umgesetzt.**
Offen laut Fahrplan (MM4 und "Später"-Punkte, s. Plan-Datei): konfigurier­
bare Kriteriengewichtung/Score-Farbbänder als Tenant-Standard, Filter
(Status/Mindest-Score/fehlende Dokumente), "Manuell bewerten"-Override,
echte Besichtigungstermin-Verknüpfung (braucht Kalendermodul), Anna-
Sprachaktion, automatisierte SCHUFA-Abfrage — keines davon begonnen,
wartet auf Freigabe.

## 4. Öffentliches Bewerbungsformular + Kriteriengewichtung je Einheit umgesetzt und live verifiziert — 2026-09-14

Auf Nutzerwunsch zwei Ergänzungen zum bestehenden Kern, **ohne neue
Migration** — beide nutzen ausschließlich bereits vorhandene Spalten/Tabellen
(`desired_tenant_profile.weights`, `applicant`/`applicant_document`/
`documents` inkl. `source='web_form'`, seit MM1/MM2 vorhanden).

**1. Kriteriengewichtung je Einheit (UI für ein bereits bestehendes Feld):**
`ProfileEditor.tsx` bekam einen neuen Abschnitt „Gewichtung der Kriterien"
mit sechs Zahlenfeldern (eines je `CriterionKey` aus `scoring.ts`,
Labels aus dem bereits vorhandenen `CRITERION_LABELS`), Live-Summenanzeige
mit Warnfarbe bei ≠ 100 %, Vorbelegung mit den bisherigen Hartcode-Defaults
(30/15/25/10/10/10) falls das Profil noch keine eigene Gewichtung hat.
Read-only-Ansicht zeigt die aktive Gewichtung als eine Zeile. Keine
Backend-Änderung nötig — `PATCH /api/mietermatching/profiles/[id]` nahm
`weights` bereits seit MM1 entgegen.

**2. Öffentliches Bewerbungsformular (Spec-Idee erweitert um Self-Service,
in der ursprünglichen Spezifikation nicht vorgesehen, aber vom Auftraggeber
gewünscht):**
- **Middleware** (`src/middleware.ts`): `/bewerbung` und
  `/api/public/mietermatching` von der Auth-Pflicht ausgenommen — analog zum
  bestehenden `/api/leads`-Präzedenzfall für einen echten öffentlichen
  Endpunkt in dieser Codebasis.
- **Link-Schema:** `/bewerbung/<unitId>` — die Einheiten-UUID dient direkt
  als unrateanbarer Zugriffsschlüssel (kein zusätzliches Token-System
  gebaut; konsistent mit der übrigen App, die UUIDs bereits als einzige
  Objektreferenz verwendet). Ein Verwalter kopiert den Link über den neuen
  Button „Bewerbungslink kopieren" (`ApplicantsSection.tsx`, nur aktiv, wenn
  ein Wunschmieter-Profil existiert).
- **`GET /api/public/mietermatching/[unitId]`** (kein Auth, `createAdminClient()`):
  liefert nur, was ein Bewerber zum Ausfüllen braucht (Objekt-/Einheiten­
  bezeichnung, akzeptierte Beschäftigungsarten, Haushaltsgrößen-/Einzugs­
  korridor, Pflichtdokumente) — bewusst **ohne** `tenant_id`, Gewichtung,
  Score-Schwellenwerte oder andere interne Felder. 404, wenn kein aktives
  Profil existiert.
- **`POST /api/public/mietermatching/[unitId]/apply`** (kein Auth):
  `multipart/form-data` mit Textfeldern + optional einer Datei je
  Dokumenttyp (`doc_income_proof` usw.). `tenant_id` wird ausschließlich
  serverseitig aus der Einheit abgeleitet, nie aus dem Request übernommen.
  Validiert Dateityp (PDF/PNG/JPEG) und Größe (max. 10 MB) vor dem Upload;
  ein einzelner fehlgeschlagener Datei-Upload blockiert die restliche
  Bewerbung nicht. Legt `applicant` (`source='web_form'`), `documents`
  (Level `unit`, gleiche Kategorien wie MM2) und `applicant_document` an,
  berechnet danach den Score über den bestehenden `rescoreApplicant()`-
  Helfer. Antwort ist bewusst nur `{ ok: true }` — der Bewerber sieht nie
  seinen eigenen Score oder das Kriterien-Breakdown, das bleibt
  Verwalter-intern (kein Widerspruch zur Spec, die das nirgends für
  Bewerber vorsieht).
- **`src/app/bewerbung/[unitId]/page.tsx`** (neu, öffentlich, kein
  App-Layout/Sidebar): eigenständige Seite im Login-Seiten-Stil,
  zeigt Objekt-/Einheitenbezeichnung und -adresse, Formular mit
  Pflichtfeldern (Vorname, Nachname, E-Mail) + optionalen Feldern
  (Telefon, Einkommen, Beschäftigungsart — Auswahl auf die im Profil
  akzeptierten Arten eingeschränkt, falls welche hinterlegt sind,
  Haushaltsgröße, Einzugstermin) sowie je benötigtem Dokumenttyp einen
  Datei-Upload. Nach Absenden eine Erfolgsseite ohne jede Score-Angabe.
- `CATEGORY_BY_DOC_TYPE` (Dokumenttyp → `document_categories.id`-Mapping)
  aus der bestehenden authentifizierten Upload-Route in eine gemeinsame
  Datei `src/lib/mietermatching/document-categories.ts` extrahiert, damit
  die neue öffentliche Route dieselbe Zuordnung nutzt statt sie zu
  duplizieren.

`tsc --noEmit` clean. `eslint` clean bis auf die bereits bekannte, projekt­
weit vorbestehende `react-hooks/set-state-in-effect`-Warnung (keine neuen
Treffer). Volle Testsuite weiterhin 202/202 grün (an der Scoring-Logik
selbst hat sich nichts geändert, nur an der Dateneingabe).

**Live-Verifikation** (`koehler@berko.ai`, Einheit M01):
- Gewichtung auf 50/10/10/10/10/10 (Einkommen/Beschäftigung/SCHUFA/
  Haushaltsgröße/Einzug/Dokumente) gesetzt, Summenanzeige zeigte korrekt
  „100 %", nach Speichern in der Übersicht exakt so dargestellt.
- Öffentlicher Endpunkt **ohne jegliche Auth-Cookies** per `curl` verifiziert
  (HTTP 200 sowohl für die Seite als auch für `GET
  /api/public/mietermatching/[unitId]`, Antwort enthielt nachweislich keine
  internen Felder) — bestätigt, dass die Middleware-Ausnahme tatsächlich für
  nicht angemeldete Aufrufer greift, nicht nur für eingeloggte Nutzer.
- Bewerbungsformular vollständig ausgefüllt („Max Bewerber", Netto 2.900 €,
  unbefristet, HH-Größe 2) inkl. Upload einer selbst erzeugten
  Gehaltsabrechnung (PDF via `pdf-lib`) für „Einkommensnachweis" →
  Erfolgsseite korrekt angezeigt.
- Als Verwalter geprüft: Bewerber korrekt mit Quelle „Web-Formular"
  angelegt, Dokument korrekt als „Einkommensnachweis" hochgeladen und der
  Einheit zugeordnet, Score **75 %** — exakt der von Hand nachgerechnete
  erwartete Wert unter der neuen 50/10/10/10/10/10-Gewichtung (Einkommen/
  Miete-Verhältnis 90/100 × 50 % + Beschäftigung 0/100 × 10 % + SCHUFA
  50/100 × 10 % + Haushaltsgröße 100/100 × 10 % + Einzug 50/100 × 10 % +
  Vollständigkeit 100/100 × 10 % = 75).

Alle Testdaten vollständig entfernt (1 `applicant`, 1 `applicant_document`
inkl. Storage-Datei, 1 `match_result`, 1 `desired_tenant_profile`), lokale
Test-PDFs und `.playwright-mcp`-Verzeichnis gelöscht, Testpasswort
zurückgesetzt, Dev-Server gestoppt.

**Beide Ergänzungen sind damit abgeschlossen und live verifiziert.**
