# Spezifikation: Modul „WEG-Buchhaltung" (Vorstufe zur Jahresabrechnung)

| | |
|---|---|
| Version | 0.1 (Entwurf) |
| Zielsystem | Berko KI Plattform (bestehende Codebasis) |
| Ablage im Repo | `docs/specs/weg-buchhaltung-spec.md` |
| Verhältnis zu anderen Specs | Voraussetzung für `docs/specs/hausgeldabrechnung-spec.md` (siehe deren Kapitel 3.3 und `docs/specs/hausgeldabrechnung-plan.md`, Abschnitt 2). Dieses Modul liefert `CommunityBankAccount`, `BalanceConfirmation`, `Transaction`, `EconomicPlan`, `PlanAdvance`, `SpecialLevy`, `SpecialLevyUnit`, `CostType`, `AllocationKey`, `AllocationKeyValue` — Typnamen und Feldnamen sind bewusst nah an Kapitel 6.2 der Hausgeldabrechnung-Spec gehalten — sowie zusätzlich einen doppelten Buchführungskern (`Account`, `JournalEntry`, `JournalEntryLine`, Kapitel 5.8), auf dem die Zufluss-/Abfluss-Sicht für die Jahresabrechnung nur eine Auswertung ist. |
| Umsetzung | Claude Code, meilensteinweise |
| Fachliche Freigabe | ausstehend (offene Fragen in Kapitel 11) |

---

## 0. Arbeitsanweisungen für Claude Code

Lies dieses Kapitel vor jedem Meilenstein erneut. Es gilt zusätzlich zu Kapitel 0 der Hausgeldabrechnung-Spec, nicht anstelle davon.

**0.1 Vorgehen.** Diese Spezifikation legt fest, *was* das Modul leisten muss. *Wie* es eingebaut wird, richtet sich nach den bestehenden Konventionen der Codebasis (siehe `docs/specs/hausgeldabrechnung-plan.md` für die bereits erhobenen Fakten zu RLS-Mustern, Rollen, Migrations-Workflow und Test-Setup — diese gelten hier unverändert und werden nicht erneut erhoben). Bestehende Entitäten (`properties`, `units`, `contacts`, `contact_roles`) werden wiederverwendet, nicht dupliziert.

**0.2 Fachliche Unklarheiten.** Wie in der Hausgeldabrechnung-Spec: Ist ein Sachverhalt hier nicht geregelt, wird keine eigene fachliche Entscheidung getroffen, sondern die Frage im Abschnitt „Offene Fragen" (Kapitel 11) aufgenommen.

**0.3 Harte Regeln** (identisch zur Hausgeldabrechnung-Spec, hier verbindlich wiederholt, weil dieses Modul selbst Geldbeträge erzeugt und speichert):

1. Geldbeträge sind ganzzahlige Cent-Werte (Typ `Cents`). Keine Gleitkommazahlen für Geld, kein `parseFloat` auf Beträgen. DB-Typ `bigint`.
2. Import-Parser (CSV/CAMT.053) sind reine, deterministische Funktionen: gleiche Eingabedatei ergibt byte-identisches Parse-Ergebnis. Sie schreiben nicht selbst in die Datenbank — das übernimmt ein separater Schritt, damit ein Parse-Vorschau-Modus möglich ist, bevor irgendetwas gespeichert wird.
3. Kein LLM ordnet eine Buchung endgültig zu. KI-Vorschläge (`source = 'AI'`) erhalten immer `status = 'SUGGESTED'` und werden erst durch eine bestätigende Handlung eines Menschen zu `CONFIRMED` (Kapitel 9 der Hausgeldabrechnung-Spec gilt hier direkt mit).
4. Bestehende Migrationen werden nicht verändert. Jede neue mandantenbezogene Tabelle erhält RLS-Policies nach dem in `hausgeldabrechnung-plan.md` Abschnitt 5 dokumentierten Muster.
5. Diese Spezifikation entscheidet nicht über CAMT.053-Detailparsing-Regeln einzelner Banken; der Funktionsumfang beschränkt sich auf ein generisches, konfigurierbares Format plus CAMT.053 (Kapitel 3.1).

---

## 1. Ziel

Das Modul führt für eine Wohnungseigentümergemeinschaft (WEG) die laufende Buchhaltung: die Bankkonten der Gemeinschaft, die darauf gebuchten Zahlungen eines Jahres mit Zuordnung zu Kostenart, Einheit und ggf. Sonderumlage, sowie den beschlossenen Wirtschaftsplan mit den Soll-Vorschüssen je Einheit. Jede Buchung wird intern als ausgeglichener Buchungssatz (Soll/Haben, doppelte Buchführung, Kapitel 5.8) auf einem Kontenplan geführt; die für die WEG-Jahresabrechnung gesetzlich vorgeschriebene Einnahmen-Ausgaben-Sicht (§ 28 WEG, Zu- und Abflussprinzip, `hausgeldabrechnung-spec.md` Kapitel 5.1) ist eine Auswertung über diesem Kontenplan, kein zweites, separat gepflegtes Buch. Es ist weiterhin **kein** vollwertiges Handelsbilanz-/Jahresabschlusssystem (Kapitel 3.2), aber es liefert sowohl die für § 28 WEG nötige Datengrundlage als auch die Möglichkeit, das Objekt nach den Regeln doppelter Buchführung auszuwerten.

Erfolgskriterium: Für ein WEG-Objekt kann der Verwalter zum Jahresende sagen „alle Buchungen des Jahres sind erfasst und einer Kostenart zugeordnet, der Kontostand stimmt mit dem Kontoauszug überein, der Wirtschaftsplan des Jahres ist hinterlegt" — ohne Nebenrechnung in Excel. Ab diesem Punkt kann die Hausgeldabrechnung (M1 dort) rechnen.

---

## 2. Fachlicher Rahmen (Kurzreferenz)

**Beide Rechnungsarten sind möglich, aber nicht gleichrangig — sie stehen nicht nebeneinander, sondern übereinander:**

1. **Doppelte Buchführung** (Soll/Haben, Kontenplan, `JournalEntry`/`JournalEntryLine`) ist das kanonische Speichermodell. Jede Buchung wird als ausgeglichener Buchungssatz erfasst (Σ Soll = Σ Haben), auf einem Kontenplan aus Bestandskonten (Bankkonten, Rücklage, Forderungen, Verbindlichkeiten) und Erfolgskonten (Aufwand je Kostenart, Ertrag). Das ermöglicht Bilanz und GuV für die Gemeinschaft bzw. den Verwalter, unabhängig von der WEG-Jahresabrechnung.
2. **Einnahmen-Ausgaben-Rechnung / Zufluss-Abfluss-Prinzip** — wie von § 28 WEG für die Jahresabrechnung **zwingend vorgeschrieben** (`hausgeldabrechnung-spec.md` 5.1) — ist daraus eine **abgeleitete Sicht**, kein zweites, unabhängig gepflegtes Buch: Sie entsteht durch Filtern der Buchungszeilen, die ein Bankkonto der Gemeinschaft berühren, gruppiert nach Kostenart/Erfolgskonto. Kontenabstimmung (`hausgeldabrechnung-spec.md` 5.12: Anfangsbestand + Eingänge − Ausgänge = Endbestand = Kontoauszugssaldo) ist dann eine Eigenschaft, die für das Bankkonto als Bestandskonto im Kontenplan gelten muss, keine eigene Regel.

Begründung für diese Reihenfolge (kanonisches Doppik-Ledger, EÜR als View) statt zwei getrennter Modelle: Zwei unabhängig gepflegte Bücher (ein einfaches Zufluss-/Abfluss-Log und separat ein Soll/Haben-Journal) könnten auseinanderlaufen und müssten gegeneinander abgestimmt werden — das widerspricht der Nachvollziehbarkeit, die `hausgeldabrechnung-spec.md` überall verlangt (z. B. Kapitel 7 „Jeder Betrag im Ergebnis trägt eine Herkunft"). Mit einem einzigen Ledger gibt es nur eine Quelle der Wahrheit. Diese Architekturentscheidung ist unten als Q7 zur Bestätigung offen, da sie erheblichen Mehraufwand gegenüber der ursprünglichen Fassung dieser Spezifikation bedeutet (siehe Kapitel 5.8 und Offene Fragen).

---

## 3. Umfang

Kein MVP: Dieses Modul wird als vollständig funktionsfähige Software gebaut, nicht als abgespeckte Erstversion. „Nicht im Funktionsumfang" unten sind deshalb keine MVP-Kürzungen, sondern bewusste, fachlich begründete Grenzen (entweder weil es außerhalb dessen liegt, was eine WEG-Verwaltung tatsächlich braucht, weil es eine eigene, größere regulatorische Integration wäre, oder weil es der Auftraggeber in `hausgeldabrechnung-spec.md` bereits explizit ausgeschlossen hat).

### 3.1 Funktionsumfang

- Bankkonten der Gemeinschaft je Objekt (Bewirtschaftung, Rücklage — mehrere Rücklagenkonten je Objekt werden unterstützt, z. B. allgemeine Rücklage + zweckgebundene Rücklage).
- Kontoauszugssaldo-Erfassung zu einem Stichtag (mindestens 31.12., beliebig oft unterjährig für laufende Kontrolle).
- Kostenarten-Katalog je Objekt (`CostType`) und Verteilerschlüssel (`AllocationKey`/`AllocationKeyValue`) — **Hinweis:** Diese beiden Entitäten standen ursprünglich in Kapitel 6.2 der Hausgeldabrechnung-Spec; sie werden hier angesiedelt, weil eine Buchung schon beim Erfassen einer Kostenart und optional eines Schlüssels bedarf, lange bevor eine Jahresabrechnung läuft. Siehe Offene Frage Q1.
- **Kontenplan** je Objekt (`Account`): Bestandskonten (Bankkonten, Rücklagen, Forderungen, Verbindlichkeiten) und Erfolgskonten (ein Konto je `CostType`, siehe Kapitel 5.8).
- **Doppelte Buchführung, vollständig**: jede Buchung ein ausgeglichener Buchungssatz (`JournalEntry`/`JournalEntryLine`, Σ Soll = Σ Haben), siehe Kapitel 5.8. Neben der automatischen Erzeugung aus einfachen Zahlungen (5.8.3) ist auch die freie Erfassung eines Buchungssatzes per UI möglich (Umbuchungen, Korrekturbuchungen, Rückstellungen — 5.8.4), nicht nur die automatische Ableitung aus einer Zahlung.
- **Bilanz- und GuV-Report je Objekt**, aus dem Kontenplan erzeugt: Bestände je Konto zu einem Stichtag, Gewinn-/Verlustrechnung je Kostenart für einen Zeitraum, abstimmbar mit der Einnahmen-Ausgaben-Sicht (Kapitel 5.8.5). Das ist Teil des Funktionsumfangs, kein späterer Ausbauschritt (siehe Kapitel 9, B7).
- Buchungserfassung: manuell (Formular) und per Datei-Import (CSV, generisches Spalten-Mapping, sowie CAMT.053). Eine manuelle Erfassung „eine Zahlung" erzeugt automatisch den passenden Buchungssatz (Bankkonto ./. Kostenart) — der Anwender muss für den alltäglichen Fall nicht in Soll/Haben denken, kann es aber (vorheriger Punkt) für Sonderfälle.
- Zuordnung je Buchung: Kostenart, Einheit (bei Direktbelastung oder Vorschusszahlung), Eigentümer, Sonderumlage — analog zu `Transaction` aus Kapitel 6.2 der Hausgeldabrechnung-Spec.
- Status-Workflow je Buchung: `SUGGESTED` (Import/KI-Vorschlag) → `CONFIRMED` (durch den Verwalter bestätigt). Nur `CONFIRMED`-Buchungen sind Eingabe für die Jahresabrechnung und werden Teil des Kontenplans (Kapitel 5.8.3).
- Wirtschaftsplan (`EconomicPlan`) mit Soll-Vorschüssen je Einheit (`PlanAdvance`), inkl. unterjähriger Änderung (Gültigkeitszeitraum), mit Beschlussdatum.
- Sonderumlage (`SpecialLevy`/`SpecialLevyUnit`): Soll je Einheit, Zuordnung eingehender Zahlungen.
- Deterministische Regelzuordnung (K2, Teil 1): feste Regeln (IBAN-Historie, Verwendungszweck-Muster) ordnen Buchungen automatisch zu, bevor ein LLM überhaupt gefragt wird — siehe `hausgeldabrechnung-spec.md` Kapitel 9, K2.
- **Einnahmen-Ausgaben-Sicht** (Zufluss-/Abfluss-Report je Bankkonto) als abgeleitete Auswertung über den Buchungssätzen — das ist die Sicht, die die Hausgeldabrechnung als `SettlementInput` konsumiert (Kapitel 2, 5.8.5).

### 3.2 Bewusst außerhalb des Funktionsumfangs

- Rechnungsabgrenzung (Rechnungs-/Leistungsdatum bleibt für die WEG-Jahresabrechnung irrelevant, `hausgeldabrechnung-spec.md` 5.1 — das gilt unverändert, auch wenn im Kontenplan technisch Forderungs-/Verbindlichkeiten-Konten existieren, siehe Kapitel 5.8.3). Grund: gesetzliche Vorgabe der Hausgeldabrechnung-Spec, keine Verkürzung dieses Moduls.
- Formeller HGB-Jahresabschluss-Workflow (Eröffnungsbilanz, förmlicher Konten-Abschluss zum 31.12., Publizitätspflichten) für die WEG selbst — WEGs sind nicht bilanzierungspflichtig, ein solcher Workflow hätte keinen fachlichen Nutzen für dieses Modul. **Ausdrücklich nicht Teil dieser Spezifikation**, und bewusst getrennt zu halten: die eigene, HGB-pflichtige Buchhaltung des Verwaltungsunternehmens selbst (objektübergreifend, Honorareinnahmen, eigene Kosten) — das wäre ein eigenständiges, deutlich größeres System mit eigener Spezifikation, nicht Teil dieses Moduls (im Review bestätigt).
- Automatischer Live-Bankabgleich (PSD2/FinTS-Kontoabruf in Echtzeit). Grund: das ist keine fachliche Vereinfachung, sondern eine eigene regulatorische/technische Integration (Anbindung an einen lizenzierten Kontoinformationsdienst, TPP-Registrierung) mit eigenem Aufwand unabhängig von diesem Modul. Datei-Import (CSV/CAMT.053) deckt den fachlichen Bedarf vollständig ab.
- Mahnwesen — bereits in `hausgeldabrechnung-spec.md` Kapitel 3.2 explizit ausgeschlossen; dieses Modul übernimmt diese Grenze, verkürzt sie nicht zusätzlich.
- Mehrhausanlagen mit Untergemeinschaften / objektübergreifende Konzernbuchhaltung — `hausgeldabrechnung-spec.md` Kapitel 3.2 schließt das ebenfalls aus (das Datenmodell darf es aber nicht verbauen, siehe `costCenterId?` auf `CostType`); dieses Modul übernimmt dieselbe Grenze.
- LLM-gestützte automatische Buchung ohne Bestätigung (harte Regel 0.3.3) — keine Verkürzung, sondern eine der harten Regeln, die für dieses Modul gilt wie für die Hausgeldabrechnung selbst.

### 3.3 Voraussetzungen

Bereits vorhanden und durch `docs/specs/hausgeldabrechnung-plan.md` (Abschnitt 1/2) bestätigt: `properties`, `units` (mit `mea`, `area`), `contacts` + `contact_roles` (Eigentümer mit Zeiträumen). Keine weitere Lückenanalyse nötig — M0 der Hausgeldabrechnung-Spec deckt das bereits ab.

---

## 4. Glossar

Wie in `hausgeldabrechnung-spec.md` Kapitel 4: Bezeichner im Code sind englisch, etablierte Bezeichner der Codebasis haben Vorrang.

| Fachbegriff | Bezeichner | Bedeutung |
|---|---|---|
| Bankkonto der Gemeinschaft | `CommunityBankAccount` | Bewirtschaftungs- oder Rücklagenkonto eines Objekts (Achtung: **nicht** identisch mit der bestehenden Tabelle `bank_accounts`, die kontaktbezogene SEPA-Mandate abbildet — siehe Kapitel 6.1) |
| Kontoauszugssaldo | `BalanceConfirmation` | vom Verwalter erfasster/importierter Saldo zu einem Stichtag |
| Buchung | `Transaction` | einzelne Zahlung auf einem Gemeinschaftskonto |
| Kostenart | `CostType` | Ausgaben- oder Einnahmenposition |
| Verteilerschlüssel | `AllocationKey` / `AllocationKeyValue` | Regel bzw. Wert zur Kostenverteilung je Einheit |
| Wirtschaftsplan | `EconomicPlan` | beschlossene Vorschüsse eines Jahres |
| Vorschuss (Hausgeld) | `PlanAdvance` | monatlicher Soll-Betrag je Einheit |
| Sonderumlage | `SpecialLevy` / `SpecialLevyUnit` | gesondert beschlossene Zahlung, Soll je Einheit |
| Import-Lauf | `BankStatementImport` | ein Vorgang „Datei X wurde am Y importiert, Z Buchungen erzeugt" |
| Zuordnungsregel | `MatchingRule` | deterministische Regel, die eine Buchung anhand IBAN/Verwendungszweck vorschlägt |
| Konto (Kontenplan) | `Account` | Sachkonto im Kontenplan: Bestandskonto (Bank, Rücklage, Forderungen, Verbindlichkeiten) oder Erfolgskonto (Aufwand/Ertrag je Kostenart) |
| Kontenplan | — (Menge aller `Account` eines Objekts) | die Gesamtheit der Sachkonten eines Objekts |
| Buchungssatz | `JournalEntry` | ausgeglichener Beleg: eine wirtschaftliche Buchung, bestehend aus mindestens zwei `JournalEntryLine` |
| Buchungszeile | `JournalEntryLine` | eine Soll- oder Haben-Position eines `JournalEntry` auf genau einem `Account` |

---

## 5. Fachliche Regeln (verbindlich)

### 5.1 Bankkonten

1. Jedes WEG-Objekt (`properties.is_weg = true`) hat mindestens ein Bewirtschaftungskonto. Rücklagenkonten sind optional (0..n je Objekt, für den Fall mehrerer Rücklagen, z. B. allgemeine Rücklage + zweckgebundene Rücklage).
2. Ein Konto gehört genau einem Objekt. Gemeinschaftskonten mehrerer Objekte (Sammelkonten) sind nicht Teil des Funktionsumfangs (3.2).

### 5.2 Kontoauszugssalden

1. Für jedes Konto wird mindestens der Saldo zum 31.12. jedes abzurechnenden Jahres erfasst (`BalanceConfirmation`). Weitere Stichtage sind für laufende Kontrolle erlaubt.
2. Existiert eine `BalanceConfirmation` zum 31.12. des Vorjahres, ist das der verbindliche Anfangsbestand des Folgejahres (identisch zur Regel in `hausgeldabrechnung-spec.md` 5.12).

### 5.3 Buchungserfassung und -zuordnung

1. Jede Buchung trägt Buchungstag, Betrag (mit Vorzeichen, `Cents`), und optional eine Zuordnung: Kostenart, Einheit, Eigentümer, Sonderumlage (genau wie `Transaction` in Kapitel 6.2 der Hausgeldabrechnung-Spec).
2. Eine Buchung ohne Kostenart ist zulässig, solange sie `SUGGESTED` ist. Eine `CONFIRMED`-Buchung mit `kind = 'EXPENSE'` oder `'INCOME'` ohne Kostenart ist ein Fehler (entspricht Prüfung C02 aus `hausgeldabrechnung-spec.md` 8.2, die dieses Modul mit vorbereitet, aber nicht selbst ausführt — Prüfungen bleiben Teil des Rechenkerns der Hausgeldabrechnung).
3. Import (CSV/CAMT.053) erzeugt ausschließlich `status = 'SUGGESTED'`-Buchungen, nie direkt `CONFIRMED`. Eine Vorschau vor dem Speichern ist Pflicht (harte Regel 0.3.2).
4. Duplikaterkennung beim Import: Gleiche Kombination aus Konto, Buchungstag, Betrag und Verwendungszweck-Hash wird nicht zweimal angelegt, sondern als „bereits vorhanden" markiert und übersprungen.

### 5.4 Kostenarten und Verteilerschlüssel

Übernimmt unverändert die Regeln aus `hausgeldabrechnung-spec.md` 5.3 (Schlüsseltypen, Gültigkeitszeiträume, Gewicht 0 blockiert, Direktbelastung, Dezimalarithmetik). Dieses Modul ist nur für **Erfassung/Verwaltung** der Kostenarten und Schlüsselwerte zuständig; die **Verteilung selbst** (`allocate()`) bleibt Teil des Rechenkerns der Hausgeldabrechnung-Spec (Kapitel 7 dort) und wird hier nicht dupliziert.

### 5.5 Wirtschaftsplan

1. Ein `EconomicPlan` gehört zu einem Objekt und einem Jahr, mit Beschlussdatum.
2. `PlanAdvance` je Einheit trägt getrennt `monthlyOperating` (Bewirtschaftung) und `monthlyReserve` (Rücklage) sowie einen Gültigkeitszeitraum, damit unterjährige Anpassungen (`hausgeldabrechnung-spec.md` 5.4.6) abbildbar sind.
3. Ein Objekt kann mehrere `EconomicPlan`-Versionen für dasselbe Jahr haben (z. B. Ursprungsplan + Anpassungsbeschluss); nur eine ist zu jedem Zeitpunkt gültig. Modellierung: neue `PlanAdvance`-Zeile mit neuem `validFrom`, alte Zeile bekommt `validTo` (gesetzt), kein Löschen historischer Werte.

### 5.6 Sonderumlagen

Übernimmt `hausgeldabrechnung-spec.md` 5.8 unverändert: Beschluss, Soll je Einheit, Ist-Zahlungen (über zugeordnete `Transaction`s mit `specialLevyId`), Verwendung, Restbetrag.

### 5.7 Zuordnungsregeln (K2, deterministischer Teil)

1. Eine `MatchingRule` besteht aus einem Muster (IBAN des Gegenkontos und/oder Verwendungszweck-Teilstring) und einem Ziel (Einheit, Eigentümer oder Kostenart).
2. Regeln werden je Objekt gepflegt und beim Import zuerst angewendet, bevor eine KI-Zuordnung vorgeschlagen wird. Eine Regel, die zweifelsfrei zutrifft, darf direkt `status = 'SUGGESTED'` mit hoher Konfidenz erzeugen — niemals `CONFIRMED` (harte Regel 0.3.3 gilt weiter; die Bestätigung bleibt am Menschen).

### 5.8 Doppelte Buchführung (Kontenplan und Buchungssätze)

1. **Kontenplan je Objekt.** Jedes Objekt hat einen eigenen Satz `Account`. Mindestens: ein Bestandskonto je `CommunityBankAccount` (automatisch angelegt, wenn das Bankkonto angelegt wird), ein Bestandskonto „Forderungen gegen Eigentümer" und eines „Verbindlichkeiten", sowie ein Erfolgskonto je `CostType` (automatisch angelegt, wenn die Kostenart angelegt wird — `CostType.ledgerAccountId` verweist darauf). Eigenkapital-/Rücklagenkonten werden als Bestandskonto geführt, nicht als GuV-Position.
2. **Jede Buchung ist ein `JournalEntry` mit mindestens zwei `JournalEntryLine`.** Für jede Zeile gilt: entweder `debit` oder `credit` ist gesetzt (nie beide, nie keines), beide als `Cents`, `debit`/`credit` ≥ 0. Invariante je `JournalEntry`: Σ `debit` aller Zeilen = Σ `credit` aller Zeilen. Ein unausgeglichener `JournalEntry` darf nicht gespeichert werden (technisch erzwungen, nicht nur Konvention — Vorschlag: Check-Constraint oder Trigger, Details Teil von B1, Kapitel 6.3).
3. **Die einfache Buchungserfassung (5.3) ist eine Vereinfachung, kein Alternativmodell.** Wenn der Verwalter „Heizöl 800 € vom Bewirtschaftungskonto bezahlt" erfasst, erzeugt das System automatisch einen `JournalEntry` mit zwei Zeilen: `credit` 800 € auf dem Bestandskonto des Bankkontos, `debit` 800 € auf dem Erfolgskonto der Kostenart „Heizöl". `Transaction` (Kapitel 6.3) bleibt als Objekt bestehen — sie referenziert den erzeugten `JournalEntry` (`Transaction.journalEntryId`) und bleibt die Form, die der Rechenkern der Hausgeldabrechnung als `SettlementInput` liest (Kompatibilität mit der bereits abgestimmten Hausgeldabrechnung-Spec, siehe Kapitel 10).
4. **Buchungen, die keine einzelne Zahlung sind** (z. B. eine reine Umbuchung zwischen zwei Rücklagenkonten, eine manuelle Korrekturbuchung, eine Abgrenzung) werden als direkter `JournalEntry` ohne zugehörige `Transaction` erfasst — das ist der Fall, in dem die doppelte Buchführung über die einfache Zahlungserfassung hinausgeht.
5. **Die Einnahmen-Ausgaben-Sicht für § 28 WEG** entsteht durch Auswertung aller `JournalEntryLine`, die ein Bestandskonto vom Typ „Bankkonto der Gemeinschaft" berühren, im Zeitraum eines Kalenderjahres, gruppiert nach dem gegengebuchten Erfolgskonto (= Kostenart). Das ist keine neue Regel, sondern eine Projektion; die inhaltlichen Regeln (Zu-/Abflussprinzip, keine Rechnungsabgrenzung) bleiben `hausgeldabrechnung-spec.md` 5.1–5.13 vorbehalten und werden hier nicht verändert.
6. **Rundung/Geldarithmetik**: identisch zu harter Regel 0.3.1 — `Cents`, keine Fließkommazahlen, auch nicht für Kontensalden.

---

## 6. Datenmodell

### 6.1 Verhältnis zu bestehenden Tabellen

Die bestehende Tabelle `bank_accounts` (`contact_id` verpflichtend, für SEPA-Mandate von Eigentümern/Mietern) bleibt **unverändert**. Das neue `CommunityBankAccount` aus dieser Spezifikation bekommt einen eigenen Tabellennamen, um Verwechslung zu vermeiden — Vorschlag für die DB-Tabelle: `community_bank_accounts` (siehe `hausgeldabrechnung-plan.md`, Abschnitt 1). Endgültiger Name ist Teil von B1 dieses Moduls, hier nur als Platzhalter verwendet.

### 6.2 Typen

Wie in `hausgeldabrechnung-spec.md` 6.1: `Cents` (ganzzahliger Cent-Betrag, `bigint` in der DB), `Dec` (Dezimaltyp für Gewichte/Prozentsätze, `numeric` in der DB).

### 6.3 Entitäten

```ts
// ── Kontenplan / doppelte Buchführung (Kapitel 5.8) ─────────────────────────
Account               { id, tenantId, propertyId, code, name,
                       kind: 'ASSET'|'LIABILITY'|'EQUITY'|'EXPENSE'|'INCOME',
                       // ASSET: Bankkonto/Rücklage/Forderungen — LIABILITY: Verbindlichkeiten
                       // EXPENSE/INCOME: Erfolgskonto, i. d. R. 1:1 zu einer CostType
                       linkedBankAccountId?, closedAt? }

JournalEntry           { id, tenantId, propertyId, date, description,
                       resolutionRef?, sourceTransactionId?,
                       createdBy, createdAt }
JournalEntryLine       { id, journalEntryId, accountId, debit?: Cents, credit?: Cents,
                       costTypeId?, unitId?, ownerId? }   // costTypeId/unitId/ownerId nur auf Erfolgskonto-Zeilen relevant

// ── Bankkonten und Kostenarten ───────────────────────────────────────────────
CommunityBankAccount { id, tenantId, propertyId, iban, bic, kind: 'OPERATING'|'RESERVE', label,
                       ledgerAccountId, closedAt? }
BalanceConfirmation  { id, bankAccountId, date, balance: Cents, source: 'MANUAL'|'IMPORT' }

CostType             { id, tenantId, propertyId, name, direction: 'EXPENSE'|'INCOME', allocationKeyId?,
                       isHeating, allowsDirectCharge, apportionable, betrkvNo?, costCenterId?,
                       resolutionRef?, ledgerAccountId }

AllocationKey         { id, tenantId, propertyId, name,
                       type: 'CO_OWNERSHIP'|'AREA'|'UNIT_COUNT'|'PERSONS'|'CONSUMPTION'|'CUSTOM' }
AllocationKeyValue    { id, keyId, unitId, value: Dec, validFrom, validTo? }

BankStatementImport   { id, tenantId, bankAccountId, fileName, format: 'CSV'|'CAMT053', importedAt,
                       importedBy, rowCount, createdCount, duplicateCount }

Transaction           { id, tenantId, bankAccountId, bookingDate, amount: Cents,
                       kind: 'ADVANCE_PAYMENT'|'SPECIAL_LEVY_PAYMENT'|'EXPENSE'|'INCOME'
                            |'INTERNAL_TRANSFER'|'RESERVE_EXPENSE',
                       costTypeId?, unitId?, ownerId?, directUnitId?, specialLevyId?,
                       purpose?, counterpartyIban?, resolutionRef?, laborAmount?: Cents,
                       par35aCategory?: 'HOUSEHOLD_EMPLOYMENT'|'HOUSEHOLD_SERVICE'|'CRAFTSMAN',
                       documentId?, importId?, status: 'SUGGESTED'|'CONFIRMED',
                       source: 'BANK_IMPORT'|'MANUAL'|'AI', matchedByRuleId?,
                       journalEntryId }   // gesetzt erst bei CONFIRMED — SUGGESTED-Buchungen haben noch keinen Buchungssatz (5.8.3)

MatchingRule           { id, tenantId, propertyId, pattern: { iban?: string, purposeContains?: string },
                       targetUnitId?, targetOwnerId?, targetCostTypeId?, active }

EconomicPlan           { id, tenantId, propertyId, year, resolutionDate }
PlanAdvance            { id, planId, unitId, monthlyOperating: Cents, monthlyReserve: Cents,
                       validFrom, validTo? }

SpecialLevy             { id, tenantId, propertyId, resolutionDate, purpose, dueDate }
SpecialLevyUnit         { id, levyId, unitId, amount: Cents }
```

`Transaction`, `CostType`, `EconomicPlan`, `PlanAdvance`, `SpecialLevy`, `SpecialLevyUnit` sind — bewusst — inhaltlich identisch zu `hausgeldabrechnung-spec.md` Kapitel 6.2, mit Ausnahme von `propertyId`/`tenantId` statt `BankAccount.propertyId` (dort ursprünglich ohne `tenantId`, hier ergänzt, da jede neue Tabelle nach dem RLS-Muster `tenant_id` braucht) und den hier neu ergänzten Feldern `journalEntryId` (Transaction) bzw. `ledgerAccountId` (CostType). `Account`, `JournalEntry`, `JournalEntryLine`, `BankStatementImport` und `MatchingRule` sind komplett neu, die Hausgeldabrechnung-Spec kannte sie nicht, weil sie außerhalb ihres ursprünglichen Scopes lagen.

Audit-Logging nutzt wie im übrigen System `audit_log` + `log_audit()`.

---

## 7. RLS und Rollen

Es gelten die in `docs/specs/hausgeldabrechnung-plan.md` Abschnitt 5 dokumentierten Muster unverändert:

- `_select_tenant` / `_insert_tenant` / `_update_tenant`-Policies über `current_tenant_id()` und `is_tenant_admin()` für alle neuen Tabellen.
- Für `EconomicPlan`, `SpecialLevy` und ggf. `BalanceConfirmation` (Dinge, die ein Eigentümer/Beirat lesen dürfen sollte, sobald sie beschlossen sind) zusätzlich eine `_select_external`-Policy nach dem `properties_select_external`-Vorbild (`user_has_role_on(p_property_id := property_id, p_required_roles := ARRAY['owner','beirat'])`), damit Eigentümer perspektivisch ihren eigenen Wirtschaftsplan und Sonderumlagen einsehen können, ohne dass dafür ein eigener Mechanismus erfunden wird.
- `Transaction`, `CommunityBankAccount`, `Account`, `JournalEntry`, `JournalEntryLine` bleiben **verwalterintern** (nur `tenant_admin`/`tenant_user`, keine externe Sichtbarkeit) — einzelne Kontobewegungen und Buchungssätze gehen Eigentümer nichts an, nur die daraus abgeleiteten Ergebnisse der Jahresabrechnung. Der Bilanz-/GuV-Report (Kapitel 9, B7) ist ebenfalls verwalterintern, nicht eigentümersichtbar, sofern nicht ausdrücklich anders entschieden.

---

## 8. Tests

Wie im übrigen System: Vitest, co-located `__tests__`. Für dieses Modul konkret:

- **Parser-Tests** für CSV/CAMT.053-Import: feste Beispieldateien → deterministisches Parse-Ergebnis (harte Regel 0.3.2), inkl. Duplikaterkennung (5.3.4).
- **MatchingRule-Tests**: gegebene Regeln + Buchungen → erwartete Vorschläge, inkl. Fall „keine Regel trifft zu".
- **Buchungssatz-Invarianten (neu durch 5.8)**: eine reine Funktion `postJournalEntry(...)`, die aus einer einfachen Buchung (Bankkonto, Betrag, Kostenart) den `JournalEntry` mit seinen `JournalEntryLine`s erzeugt, gehört — wie `allocate()` in der Hausgeldabrechnung-Spec — in einen kleinen, DB-freien Kern mit eigenen Tests: Σ `debit` = Σ `credit` für jeden erzeugten Beleg, für negative Beträge (Gutschriften/Stornos) ebenso, Determinismus (gleiche Eingabe → identischer Buchungssatz). Vorschlag für die Ablage: `src/lib/weg-bookkeeping/posting.ts` nach demselben Muster wie `src/lib/optimization`/`src/lib/weg-settlement` (siehe `hausgeldabrechnung-plan.md` Abschnitt 3) — hier nur benannt, die tatsächliche Modulstruktur ist Teil von B1.
- **RLS-Integrationstests**: wie in `hausgeldabrechnung-plan.md` Abschnitt 6 beschrieben — hier gilt dieselbe offene Frage zum Ausführungsweg (siehe Offene Frage Q5 unten, identisch zu Q6 der Hausgeldabrechnung-Spec).

---

## 9. Meilensteine (Vorschlag)

| M | Inhalt | Definition of Done |
|---|---|---|
| B0 | Diese Spezifikation final abstimmen (Offene Fragen Kapitel 11 klären) | Freigabe durch Auftraggeber |
| B1 | Datenmodell: Migrationen (inkl. Kontenplan `Account`, `JournalEntry`, `JournalEntryLine` mit Ausgeglichenheits-Constraint), RLS, Seed-Daten für ein Beispielobjekt | Migrationen laufen (manuell im SQL-Editor, siehe Q5), RLS-Tests grün, ein unausgeglichener `JournalEntry` lässt sich nicht speichern (DB-seitig erzwungen, Test belegt es) |
| B2 | Kostenarten- und Verteilerschlüssel-Verwaltung (UI + API), automatische Erfolgskonto-Anlage je Kostenart | Kostenart anlegen (inkl. `ledgerAccountId`), Schlüsselwert je Einheit pflegen, funktioniert end-to-end |
| B3 | Manuelle Buchungserfassung (UI + API) inkl. automatischer Buchungssatz-Erzeugung, Kontoauszugssaldo-Erfassung | Buchung anlegen/bestätigen erzeugt einen ausgeglichenen `JournalEntry`, Kontenabstimmung wird live angezeigt |
| B4 | CSV- und CAMT.053-Import, Duplikaterkennung, Vorschau vor Speichern | Import einer Beispieldatei je Format, Duplikate werden erkannt, nichts wird ungeprüft `CONFIRMED`, kein `JournalEntry` vor Bestätigung |
| B5 | Wirtschaftsplan- und Sonderumlage-Erfassung (UI + API) | Wirtschaftsplan mit Vorschüssen je Einheit anlegen, inkl. unterjähriger Änderung |
| B6 | Deterministische Zuordnungsregeln (`MatchingRule`) | Regel anlegen, Import wendet sie an, Test belegt Vorrang vor KI-Vorschlag |
| B7 | Bilanz-/GuV-Auswertung über den Kontenplan, freie Buchungssatz-Erfassung per UI (Kapitel 5.8.4) | Für ein Beispielobjekt liefert der Report Bestände je Konto und eine GuV je Kostenart, abstimmbar mit der Einnahmen-Ausgaben-Sicht; ein freier Buchungssatz (z. B. Umbuchung zwischen zwei Rücklagenkonten) lässt sich ohne zugrundeliegende `Transaction` erfassen |
| B8 (Nachtrag, 2026-09-12) | Offene-Posten-Modell nachgerüstet: `Receivable`/`PaymentAllocation` (Sollstellungen aus `PlanAdvance`/`SpecialLevyUnit`, Ausgleich nach B7.6/B7.7 des kanonischen `scripts/hausgeldabrechnung-spec.md` v0.2), `YearLock` (B9-Vorbedingung). Auslöser: der kanonische Teil I (B1–B13) in `scripts/hausgeldabrechnung-spec.md` wurde nach B0–B7 auf Version 0.2 aktualisiert und verlangt in Kapitel 7 explizit „die Sollstellungen und Ausgleiche nach B7" als Eingabe für `computeSettlement` — das fehlte bis dahin vollständig. Bewusst **nicht** nachgebaut: `BankStatement`/`BankTransaction`-Rohschicht, `PayerAccount`, `UnitAccountAlias`, `PaymentReference`, zweistufige `AssignmentRule`-Zuordnung mit Lernfunktion, `OpeningBalanceSet` — diese verändern nicht, was ein Eigentümer schuldet, nur die Automatisierungsquote beim Import. | Migration `scripts/migration-weg-buchhaltung-receivables.sql` liegt vor; `pickAllocationTargets`/`splitAdvancePayment`/`generateAdvanceMonths` sind pure, deterministische Funktionen mit Tests (21 Fälle, alle grün); Erzeugung/Ausgleich sind in die bestehenden Routen (`economic-plans/[id]/advances`, `special-levies/[id]/units`, `transactions/[id]`) verdrahtet |

Nach B3 (mindestens: Buchungen erfassbar, Buchungssätze werden erzeugt, Kontenabstimmung) kann `hausgeldabrechnung-spec.md` M1 realistisch beginnen; B4–B7 können parallel zu M2/M3 der Hausgeldabrechnung-Spec laufen — B7 ist von den anderen Milestones unabhängig und blockiert nichts in der Hausgeldabrechnung-Spec, ist aber wie B1–B6 Teil des vollständigen Funktionsumfangs dieses Moduls, nicht optional. B8 (Nachtrag) ist Vorbedingung für M2 der Hausgeldabrechnung-Spec, da Kapitel 7 dort `Receivable`/`PaymentAllocation` als Eingabe verlangt.

---

## 10. Verhältnis zu `hausgeldabrechnung-spec.md` — Cross-Referenz-Tabelle

| Dort (Kapitel 6.2) | Hier (Kapitel 6.3) | Änderung |
|---|---|---|
| `BankAccount { id, propertyId, iban, kind }` | `CommunityBankAccount { id, tenantId, propertyId, iban, bic, kind, label, ledgerAccountId, closedAt? }` | umbenannt (Kollision mit bestehender Tabelle `bank_accounts`), `tenantId` und `ledgerAccountId` ergänzt |
| `BalanceConfirmation` | unverändert | — |
| `CostType`, `AllocationKey`, `AllocationKeyValue` | übernommen, aber hier statt dort angesiedelt; `CostType` um `ledgerAccountId` ergänzt | Eigentümerschaft verschoben (Offene Frage Q1), Verknüpfung zum Kontenplan neu (Kapitel 5.8) |
| `Transaction` | übernommen, `purpose`, `counterpartyIban`, `importId`, `matchedByRuleId`, `journalEntryId` ergänzt | Erweiterung für Import/Matching und doppelte Buchführung, keine Breaking Changes gegenüber der Ursprungsdefinition |
| `EconomicPlan`, `PlanAdvance` | unverändert | — |
| `SpecialLevy`, `SpecialLevyUnit` | unverändert | — |
| — | `BankStatementImport`, `MatchingRule` | neu, außerhalb des ursprünglichen Scopes |
| — | `Account`, `JournalEntry`, `JournalEntryLine` | komplett neu — Kontenplan und doppelte Buchführung (Kapitel 5.8), von der Hausgeldabrechnung-Spec nicht vorgesehen, da diese nur die Zufluss-/Abfluss-Sicht (`Transaction`) als Eingabe braucht und weiterhin unverändert nur diese konsumiert |

**Konsequenz für `hausgeldabrechnung-spec.md`:** Sollte Q1 zugunsten „CostType/AllocationKey gehören hierher" entschieden werden, wäre Kapitel 6.2 der Hausgeldabrechnung-Spec redaktionell anzupassen (diese drei Typen dort streichen, auf dieses Dokument verweisen). Das wird hier nur benannt, nicht durchgeführt — Änderungen an der bereits stehenden Spec entscheidet der Auftraggeber.

---

## 11. Offene Fragen

| ID | Frage | Warum das nicht selbst entschieden wird |
|---|---|---|
| Q1 | Sollen `CostType`/`AllocationKey`/`AllocationKeyValue` wirklich hier (Buchhaltung) angesiedelt werden statt wie ursprünglich in der Hausgeldabrechnung-Spec? Konsequenz: die andere Spec müsste redaktionell angepasst werden (Kapitel 10 oben). | Ändert eine bereits abgestimmte Spezifikation; Eigentümerschafts-/Scope-Frage. |
| Q2 | Generisches CSV-Spalten-Mapping und CAMT.053 sind beide Teil des Funktionsumfangs (Q3 unten) — offen bleibt nur die Priorität: welche(s) Bank(en)/Hausverwaltersoftware-Exportformat(e) zuerst (Sparkasse, Volksbank, Haussoftware-Export)? | Entspricht F4 aus `hausgeldabrechnung-spec.md` (Messdienst-Frage), hier das Pendant für Bankimporte — Produktentscheidung. |
| ~~Q3~~ | ~~Ist ein automatischer Datei-Import überhaupt Teil des Funktionsumfangs, oder reicht zunächst reine manuelle Buchungserfassung?~~ | **Entschieden (Review):** Ja, Import ist von Anfang an Teil des Funktionsumfangs (B4), nicht optional. Reihenfolge B3 vor B4 bleibt (manuelle Erfassung zuerst technisch fundiert, dann Import darauf aufgesetzt), das ist Umsetzungsreihenfolge, keine Scope-Frage mehr. |
| Q4 | Rücklagenkonten: reicht ein einzelnes `CommunityBankAccount` mit `kind = 'RESERVE'` je Objekt, oder müssen mehrere Rücklagen (z. B. allgemeine + zweckgebundene Rücklage) von Anfang an unterstützt werden? Berührt F7 aus `hausgeldabrechnung-spec.md` (Ist-Zuführung ohne eigenes Rücklagenkonto). | Modellierungsentscheidung mit Auswirkung auf Kapitel 6.3 (`CommunityBankAccount` vs. eine `MaintenanceReserve`-Entität analog zu Kapitel 6.2 der Hausgeldabrechnung-Spec, die dort erwähnt, aber nicht als eigene Tabelle modelliert ist). |
| Q5 | Identisch zu Q6 der Hausgeldabrechnung-Spec: Wie werden Migrationen und RLS-Integrationstests für dieses Modul praktisch ausgeführt (kein `DATABASE_URL`, keine verknüpfte lokale/Staging-Supabase-Instanz)? | Infrastrukturentscheidung, blockiert B1 objektiv nachweisbar. |
| Q6 | Sollen Eigentümer (extern, über `contact_roles`) ihren eigenen Wirtschaftsplan/Sonderumlagen-Stand schon in diesem Modul einsehen können (Kapitel 7, `_select_external`-Vorschlag), oder bleibt das rein verwalterintern und die externe Sicht kommt erst mit der fertigen Jahresabrechnung (M6 der Hausgeldabrechnung-Spec)? | Scope-Entscheidung mit UI-Konsequenzen, die über dieses Dokument hinausgehen. |
| ~~Q7~~ | ~~Architektur bestätigen: doppelte Buchführung als kanonisches Ledger, Zufluss-/Abfluss-Sicht als abgeleiteter Report darüber?~~ | **Entschieden (Review):** Ja — „soll beides möglich sein: EÜR und doppelte Buchführung" bestätigt. |
| ~~Q8~~ | ~~Wie tief muss „doppelte Buchführung möglich" wirklich gehen — nur stille Erfassung, oder auch ein Bilanz-/GuV-Report?~~ | **Entschieden (Review):** „Kein MVP, sondern voll funktionstüchtige Software" — Bilanz-/GuV-Report (B7) ist Teil des Funktionsumfangs, ebenso die freie Buchungssatz-Erfassung per UI (5.8.4), nicht nur die automatische Ableitung aus Zahlungen. |
| Q9 | Kontenrahmen: ein schlanker, WEG-spezifischer Kontenplan (nur die in Kapitel 5.8.1 genannten Konten: Bank/Rücklage/Forderungen/Verbindlichkeiten + ein Erfolgskonto je Kostenart), oder Anlehnung an einen Standard-Kontenrahmen wie SKR03/SKR04 (mit fester Kontonummern-Systematik, wie sie Steuerberater/DATEV-Schnittstellen erwarten)? | Betrifft mögliche spätere DATEV-/Steuerberater-Exportfähigkeit — Produkt-/Partnerentscheidung, keine rein technische Wahl. |
| ~~Q10~~ | ~~Betrifft „voll funktionstüchtig" auch die eigene, HGB-pflichtige Buchhaltung des Verwaltungsunternehmens selbst (objektübergreifend), oder nur die WEG-interne Doppik je Objekt?~~ | **Entschieden (Review):** Nur WEG-interne Doppik je Objekt (wie in Kapitel 5.8 spezifiziert). Die Eigenbuchhaltung des Verwaltungsunternehmens ist ausdrücklich **nicht** Teil dieser Spezifikation (Kapitel 3.2) und würde, falls je gewünscht, eine eigene, separate Spezifikation erhalten. |

---

*Entwurf. Wartet auf Review/Freigabe, bevor B1 beginnt.*
