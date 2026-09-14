# Spezifikation: KI-Mietermatching

**Modul:** Berko KI Hausverwaltungssoftware
**Version:** 0.1 (Entwurf)
**Stack-Referenz:** NestJS (Backend), Next.js (Frontend), Supabase/PostgreSQL mit pgvector, Multi-Tenant via Row Level Security

---

## 1. Zielbild

Ein Hausverwalter legt pro Einheit ein **Wunschmieter-Profil** an (Kriterien + Gewichtung). Eingehende Mietinteressenten werden automatisch gegen dieses Profil gescort. In einer **Übersichtsliste** sieht der Verwalter alle Bewerber einer Einheit sortiert nach Match-Score, dargestellt als **Kreisdiagramm (0–100 %)**. Per Knopfdruck kann er einen Bewerber **zur Besichtigung einladen** oder **ablehnen** — jeweils mit einer automatisch generierten E-Mail auf Basis einer unter **Einstellungen** konfigurierbaren Textvorlage.

Nicht-Ziel dieser Version: automatische Zu-/Absage ohne menschliche Bestätigung. Die Auswahlentscheidung trifft in jedem Fall der Verwalter — das System schlägt vor und begründet, entscheidet aber nicht (siehe Abschnitt 7, AGG).

---

## 2. Datenmodell

Alle Tabellen `tenant_id`-partitioniert (RLS), Konvention passend zum bestehenden Supabase-Schema.

### 2.1 `desired_tenant_profile` (Wunschmieter-Profil, 1:1 mit Einheit)

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | uuid | PK |
| `unit_id` | uuid | FK → `units` |
| `min_net_income` | numeric | Mindest-Nettoeinkommen |
| `income_to_rent_ratio_min` | numeric | z. B. 3,0 = Einkommen mind. 3× Kaltmiete |
| `employment_types_accepted` | text[] | unbefristet, befristet, selbstständig, Rentner, Student (mit Bürgen) … |
| `household_size_min` / `_max` | int | |
| `pets_allowed` | boolean | |
| `smoking_allowed` | boolean | |
| `move_in_earliest` / `move_in_latest` | date | gewünschter Einzugszeitraum |
| `min_lease_duration_months` | int | optional |
| `schufa_required` | boolean | |
| `schufa_max_score_class` | text | z. B. "keine harten Negativmerkmale" |
| `required_documents` | text[] | Referenz auf Dokumentenkatalog (§ 2.3) |
| `weights` | jsonb | Gewichtung je Kriteriumsgruppe, Summe = 100 (siehe § 3.2) |
| `notes_internal` | text | interne Notiz, nicht Teil des Matchings |
| `created_by`, `updated_at` | | Audit |

**Wichtig:** Es dürfen **keine** Felder für geschützte Merkmale nach AGG existieren (Herkunft, Religion, Geschlecht, Alter als Ausschlusskriterium, Familienstand als Ausschlusskriterium etc.). Das Datenmodell erzwingt das strukturell — es gibt kein Feld, in das ein solches Kriterium eingetragen werden könnte.

### 2.2 `applicant` (Mietinteressent)

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | uuid | PK |
| `unit_id` | uuid | FK, Bewerbung bezieht sich auf eine Einheit |
| `source` | enum | `email`, `phone_anna`, `web_form`, `manual` |
| `first_name`, `last_name` | text | |
| `contact_email`, `contact_phone` | text | |
| `net_income` | numeric | aus Unterlagen extrahiert oder manuell erfasst |
| `employment_type` | text | |
| `household_size` | int | |
| `has_pets`, `is_smoker` | boolean | |
| `desired_move_in` | date | |
| `schufa_result` | jsonb | strukturiertes Ergebnis, falls Bonitätsauskunft vorliegt |
| `documents` | jsonb[] | Liste hochgeladener/erkannter Dokumente mit Typ + Storage-Referenz |
| `status` | enum | `new`, `scored`, `invited`, `rejected`, `withdrawn` |
| `created_at` | | Eingangszeitpunkt |

### 2.3 `applicant_document`

Referenziert einzelne Nachweise (Einkommensnachweis, SCHUFA, Mieterselbstauskunft, Personalausweiskopie *ohne* Auswertung sensibler Merkmale). Klassifikation läuft über die bestehende Dokumenten-KI-Pipeline (Docling) — hier wird nur strukturiert extrahiert, was zur Erfüllung der Kriterien in § 2.1 nötig ist.

### 2.4 `match_result` (Ergebnis pro Bewerber × Profil)

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | uuid | PK |
| `applicant_id` | uuid | FK |
| `desired_tenant_profile_id` | uuid | FK |
| `overall_score` | numeric(5,2) | 0.00–100.00, das im Kreis angezeigte x % |
| `criteria_breakdown` | jsonb | Array von `{ criterion, weight, applicant_value, target_value, sub_score, matched }` |
| `missing_documents` | text[] | fehlende Nachweise, die den Score drücken oder Unsicherheit erhöhen |
| `confidence` | numeric | Datenqualität/Vollständigkeit, s. § 3.3 |
| `computed_at` | timestamptz | |
| `model_version` | text | für Nachvollziehbarkeit bei Score-Änderungen durch Modell-Updates |

### 2.5 `matching_action` (Audit-Trail für Einladen/Ablehnen)

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | uuid | PK |
| `applicant_id` | uuid | FK |
| `action` | enum | `invited`, `rejected` |
| `template_id` | uuid | FK → `message_template`, welche Vorlage verwendet wurde |
| `rendered_message` | text | tatsächlich versendeter Text (Snapshot, unabhängig von späteren Vorlagenänderungen) |
| `performed_by` | uuid | Nutzer, der den Button gedrückt hat |
| `performed_at` | timestamptz | |

### 2.6 `message_template` (Einstellungen)

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | uuid | PK |
| `tenant_id` | uuid | Mandant (Hausverwaltung), nicht die Einheit |
| `type` | enum | `invitation`, `rejection` |
| `name` | text | z. B. "Standard-Absage freundlich" |
| `subject` | text | E-Mail-Betreff, mit Platzhaltern |
| `body` | text | Fließtext, mit Platzhaltern (§ 6.2) |
| `channel` | enum | `email`, `sms` (Telefon-Variante nutzt Anna, s. § 6.4) |
| `is_default` | boolean | Vorlage, die ohne weitere Auswahl vorgeschlagen wird |
| `active` | boolean | |

---

## 3. Matching-Algorithmus

### 3.1 Grundprinzip

Deterministisches, regelbasiertes Scoring pro Kriterium (kein Black-Box-LLM-Urteil über die Eignung einer Person). Ein LLM wird ausschließlich zur **Extraktion strukturierter Werte aus Dokumenten** eingesetzt (z. B. Nettoeinkommen aus einer Gehaltsabrechnung lesen), nicht zur Bewertungsentscheidung selbst. Das macht den Score nachvollziehbar, reproduzierbar und im Streitfall erklärbar.

### 3.2 Kriteriengruppen und Standard-Gewichtung

Der Verwalter kann die Gewichtung je Wunschmieter-Profil anpassen; Summe muss 100 ergeben. Vorbelegter Standard:

| Kriteriumsgruppe | Standardgewicht | Bewertungslogik |
|---|---|---|
| Einkommen / Miete-Verhältnis | 30 % | Stufenfunktion: volle Punktzahl ab Zielverhältnis, linear abfallend darunter, 0 Punkte unterhalb einer harten Untergrenze (z. B. < 2×) |
| Beschäftigungsart / Stabilität | 15 % | Volltreffer bei exakter Übereinstimmung mit `employment_types_accepted`; Teilpunkte nach definierter Nähe-Tabelle (z. B. befristet mit >12 Monaten Restlaufzeit = 70 % der Punkte) |
| SCHUFA / Bonität | 25 % | Binär + Abstufung: keine Negativmerkmale = volle Punktzahl, weiche Merkmale = Teilpunkte, harte Negativmerkmale = 0 und Warnhinweis |
| Haushaltsgröße passend zur Einheit | 10 % | Volltreffer im Zielkorridor, Teilpunkte außerhalb |
| Einzugstermin-Kompatibilität | 10 % | Überschneidung der Zeiträume, volle Punktzahl bei Deckung |
| Vollständigkeit der Unterlagen | 10 % | Anteil eingereichter Pflichtdokumente aus `required_documents` |

Explizit **kein** Kriterium: Name, Herkunft vermutet aus Name/Sprache, Alter als Ausschluss, Geschlecht, Familienstand als Nachteil, Kinderzahl als Nachteil, Behinderung. Haushaltsgröße wird ausschließlich als *Fläche-passt-zur-Personenzahl*-Kriterium behandelt, nie als "Familien unerwünscht".

### 3.3 Score-Berechnung

```
overall_score = Σ (sub_score_i × weight_i) / 100
```

`sub_score_i` liegt je Kriterium zwischen 0 und 100. Zusätzlich wird ein `confidence`-Wert mitgeführt: Fehlen Pflichtangaben (z. B. keine SCHUFA vorhanden), wird das betroffene Kriterium nicht mit 0, sondern mit einem neutralen Mittelwert bewertet **und** die Confidence sinkt — im UI erkennbar an einem Hinweis "Angaben unvollständig", nicht an einem künstlich niedrigen Score. Das verhindert, dass unvollständige Bewerbungen unfair schlecht dargestellt werden, obwohl vielleicht nur ein Dokument fehlt.

### 3.4 Nachvollziehbarkeit

Jeder `match_result`-Datensatz speichert den vollständigen `criteria_breakdown`. Die Detailansicht (§ 5.2) macht daraus eine für den Verwalter lesbare Begründung — das ist zugleich die Grundlage, falls ein abgelehnter Bewerber nach dem Grund fragt.

---

## 4. Übersicht (Listenansicht)

**Route:** `/units/[unitId]/applicants`

- Tabellen-/Kartenansicht aller Bewerber einer Einheit, standardmäßig sortiert nach `overall_score` absteigend.
- Pro Zeile: Name, Eingangsdatum, Quelle (E-Mail/Anna/Formular/manuell), **Match-Kreis** (siehe § 5.1), Status-Badge (`Neu`, `Eingeladen`, `Abgelehnt`), zwei Buttons `Einladen` / `Ablehnen`.
- Filter: Status, Mindest-Score, fehlende Dokumente.
- Bulk-Aktion: mehrere Bewerber unterhalb eines Schwellwerts in einem Schritt ablehnen (mit Sammelbestätigung, § 6.3).
- Badge bei unvollständigen Unterlagen statt niedrigem Score (siehe § 3.3).

## 5. Detail- und Visualisierungskomponenten

### 5.1 Match-Kreis (Donut-Chart)

- Radialer Fortschrittsring, 0–100 %, Großanzeige der Zahl in der Mitte ("87 %").
- Farbcodierung nach Score-Band, z. B. ≥ 80 % Grün, 50–79 % Gelb/Amber, < 50 % Rot — Bänder als Tenant-Setting konfigurierbar, nicht hart codiert.
- Bei `confidence` unterhalb eines Schwellwerts: dezentes Warnsymbol am Ring ("Unterlagen unvollständig") statt Verfälschung der Prozentzahl.
- Komponente ist wiederverwendbar: kleine Variante für die Listenansicht, große Variante für die Detailseite.

### 5.2 Detailansicht / Kriterien-Breakdown

**Route:** `/units/[unitId]/applicants/[applicantId]`

- Großer Match-Kreis oben.
- Darunter Liste aller Kriteriumsgruppen aus `criteria_breakdown`, je Zeile: Kriterium, Zielwert, Wert des Bewerbers, Teil-Score, kleiner Balken oder Mini-Icon (✓ / ~ / ✗).
- Dokumentenbereich: eingereichte vs. fehlende Pflichtdokumente.
- Aktionsleiste unten: `Zur Besichtigung einladen`, `Ablehnen`, `Manuell bewerten` (überschreibt einzelne Kriterien mit Begründung, falls der Verwalter widersprechen will — überschreibt nie automatisch den historischen `match_result`, sondern legt eine neue Version an).

## 6. Aktionen: Einladen / Ablehnen

### 6.1 Ablauf

1. Verwalter klickt `Einladen` oder `Ablehnen` (Listen- oder Detailansicht).
2. System ermittelt die als `is_default` markierte Vorlage des passenden `type`; falls mehrere Vorlagen existieren, öffnet sich ein kompaktes Auswahl-Dropdown (keine Pflicht-Modal, falls nur eine Vorlage existiert).
3. Vorschau des gerenderten Textes mit befüllten Platzhaltern (§ 6.2) erscheint in einem Bestätigungsdialog — editierbar vor dem Versand.
4. Bei Bestätigung: Versand über den in der Vorlage hinterlegten Kanal, `applicant.status` wird aktualisiert, `matching_action` wird protokolliert.
5. Bei `Einladen`: optional direkte Erstellung eines Besichtigungstermins (Verknüpfung zum bestehenden Termin-/Kalendermodul), falls die Vorlage eine Terminangabe voraussetzt.

### 6.2 Platzhalter in Vorlagen

`{{vorname}}`, `{{nachname}}`, `{{einheit_adresse}}`, `{{einheit_bezeichnung}}`, `{{besichtigungstermin}}` (nur bei Einladung, aus Terminvorschlag oder manueller Eingabe), `{{verwalter_name}}`, `{{verwalter_telefon}}`, `{{firma_name}}`. Rendering serverseitig vor dem Versand; fehlende Platzhalterwerte lösen eine Warnung statt eines fehlerhaften Versands aus.

### 6.3 Bulk-Ablehnung

Sammelbestätigung zeigt Anzahl betroffener Bewerber und die verwendete Vorlage; Einzel-Snapshots werden dennoch pro Bewerber in `matching_action` gespeichert (kein gemeinsamer Datensatz), damit jede Absage einzeln nachvollziehbar bleibt.

### 6.4 Sonderfall Telefon-Bewerber

Ist `applicant.source = phone_anna`, kann die Einladung/Absage zusätzlich als Sprachnachricht/Rückruf über die bestehende Anna-Integration ausgelöst werden (gleiche Vorlage, Text-zu-Sprache). Details dazu sind Teil des bestehenden Voice-Agent-Moduls und hier nur als Schnittstellenpunkt referenziert, nicht neu spezifiziert.

## 7. Einstellungen

**Route:** `/settings/message-templates`

- CRUD für `message_template`: Liste nach `type` gruppiert, ein Eintrag pro Zeile mit Name, Kanal, Standard-Badge.
- Editor mit Betreff- und Textfeld, Platzhalter-Einfügehilfe (Klick fügt `{{platzhalter}}` an Cursorposition ein), Live-Vorschau mit Beispieldaten.
- Mindestens eine Vorlage je `type` muss als `is_default` markiert sein — UI verhindert das Löschen der letzten verbleibenden Vorlage eines Typs.
- Zusätzlich in den Einstellungen: Konfiguration der Kriteriengewichtung als Tenant-weiter Standard (wird beim Anlegen eines neuen Wunschmieter-Profils vorbelegt, bleibt pro Einheit überschreibbar) sowie die Score-Farbbänder aus § 5.1.

## 8. AGG-Konformität (Querschnittsthema)

- Das Datenmodell enthält strukturell keine Felder für geschützte Merkmale (§ 2.1).
- Das Matching bewertet ausschließlich sachliche, wirtschaftliche Kriterien (Einkommen, Bonität, Haushaltsgröße im Verhältnis zur Wohnfläche, Einzugstermin, Vollständigkeit der Unterlagen).
- Die Endentscheidung liegt beim Menschen: Das System schlägt vor, lehnt oder lädt aber nie automatisch ohne Klick eines Verwalters ein.
- Jede Ablehnung ist über `criteria_breakdown` und `matching_action` nachvollziehbar begründbar.
- Empfehlung: rechtliche Prüfung der finalen Kriterienliste und Standardtexte vor Produktivsetzung, insbesondere der Rejection-Templates (keine Formulierungen, die auf ein anderes als das dokumentierte Kriterium schließen lassen).

## 9. Nicht-funktionale Anforderungen

- **Multi-Tenant:** Alle neuen Tabellen mit RLS-Policies analog zum bestehenden Schema; `desired_tenant_profile` und `applicant` zusätzlich auf Objekt-/Einheitenebene eingeschränkt, sodass ein Verwalter nur Bewerbungen seiner eigenen Objekte sieht.
- **Nachvollziehbarkeit:** `match_result` und `matching_action` sind append-only (neue Version statt Überschreiben) für Revisionssicherheit.
- **Performance:** Score-Neuberechnung läuft asynchron (Queue-Job) nach jedem neuen/aktualisierten Dokument eines Bewerbers, nicht synchron im Request-Pfad.
- **Nachvollziehbare Kosten:** Score-Berechnung selbst ist regelbasiert und damit credit-frei; nur die Dokumenten-Extraktion und ggf. das KI-Matching-Scoring aus dem Angebot (2 Credits je Interessent, siehe Angebotsdokument) fällt unter das Credit-Modell — das deckt die LLM-gestützte Extraktion aus Bewerbungsunterlagen.
- **Internationalisierung:** Alle Vorlagen und UI-Texte deutschsprachig, Struktur lässt spätere Mehrsprachigkeit zu (kein Hardcoding in Views).

## 10. Offene Punkte / Annahmen

- Woher stammt die Ziel-Fläche/Zimmerzahl der Einheit für den Haushaltsgrößen-Abgleich — Verknüpfung zu bestehendem `units`-Objekt wird vorausgesetzt, aber nicht neu spezifiziert.
- Ob eine automatisierte SCHUFA-Abfrage angebunden wird (z. B. Schufa-Ident/CHECK24-API) oder Bewerber ihre eigene Auskunft hochladen, ist offen und beeinflusst § 2.3/3.2 (Bonität) direkt.
- Score-Farbbänder und Standardgewichtung (§ 3.2) sind Vorschlagswerte und sollten vor Umsetzung mit einem Pilotkunden (z. B. HONESTA) validiert werden.
- Terminbuchung bei „Einladen" (§ 6.1 Punkt 5) setzt ein bestehendes oder neu zu bauendes Kalendermodul voraus — hier nur als Schnittstelle angenommen.
