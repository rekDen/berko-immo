# Spezifikation: WEG-Buchhaltung und Jahresabrechnung (Hausgeldabrechnung)

| | |
|---|---|
| Version | 0.2 (Entwurf, ergänzt um Teil I: Buchhaltung) |
| Zielsystem | Berko KI Plattform (bestehende Codebasis) |
| Ablage im Repo | `docs/specs/hausgeldabrechnung-spec.md` |
| Umsetzung | Claude Code, meilensteinweise (Kapitel 11) |
| Fachliche Freigabe | ausstehend (offene Fragen in B13 und Kapitel 12) |

---

## 0. Arbeitsanweisungen für Claude Code

Lies dieses Kapitel vor jedem Meilenstein erneut.

**0.1 Vorgehen.** Diese Spezifikation legt fest, *was* das Modul leisten muss und nach welchen fachlichen Regeln es rechnet. *Wie* es in die Codebasis eingebaut wird, richtet sich nach den bestehenden Konventionen (Ordnerstruktur, ORM, Migrationstool, Auth, Rollen, UI-Komponenten, PDF-Erzeugung). Wo diese Spezifikation einer bestehenden Konvention widerspricht, gilt die Konvention; halte die Abweichung im Plan fest. Bereits vorhandene Entitäten (Objekt, Einheit, Eigentümer, Bankkonto, Buchung) werden wiederverwendet und nicht dupliziert. Arbeite genau einen Meilenstein nach dem anderen ab und stoppe nach jedem Meilenstein für ein Review.

**0.2 Fachliche Unklarheiten.** Die Regeln in Kapitel 5 sind verbindlich. Ist ein Sachverhalt dort nicht geregelt oder lässt er mehrere Auslegungen zu, triffst du keine eigene fachliche Entscheidung. Nimm die Frage in den Abschnitt „Offene Fragen“ des Plans auf und frage nach. Das gilt besonders für alles, was Beträge einzelner Eigentümer verändert.

**0.3 Harte Regeln.**

1. Geldbeträge sind ganzzahlige Cent-Werte (Typ `Cents`, Kapitel 6.1). Keine Gleitkommazahlen für Geld, kein `parseFloat` auf Beträgen, keine Rundung außer über die zentrale Verteilungsfunktion (5.11).
2. Der Rechenkern ist eine reine Funktionsbibliothek: keine Datenbank-, Netzwerk-, Datei- oder LLM-Zugriffe, keine Systemzeit, keine Zufallswerte. Gleiche Eingabe ergibt byte-identische Ausgabe.
3. Kein LLM berechnet, verändert oder „korrigiert“ Abrechnungsergebnisse (Kapitel 9).
4. Bestehende Migrationen werden nicht verändert. Jede neue mandantenbezogene Tabelle erhält RLS-Policies nach dem vorhandenen Muster.
5. Erwartungswerte für Golden-Tests werden niemals aus der eigenen Implementierung erzeugt oder an sie angepasst (Kapitel 10.2).
6. Importierte Bankumsätze sind unveränderlich. Korrekturen erfolgen ausschließlich über Buchungszeilen, nach der Jahressperre nur nach dokumentierter Entsperrung (B8.8).
7. KI-Vorschläge werden nie automatisch bestätigt (B8.3, Kapitel 9).

**0.4 Aufbau.** Teil I (Kapitel B1 bis B13) beschreibt die WEG-Buchhaltung mit Bankimport, Sollstellungen und Zahlungszuordnung. Teil II (Kapitel 1 bis 13) beschreibt die Jahresabrechnung, die auf den bestätigten Buchungen aus Teil I aufsetzt. Teil I wird zuerst umgesetzt; die Reihenfolge der Meilensteine steht in Kapitel 11. Die Stammdaten (Objekt, Einheiten, Eigentümer, Kostenarten, Verteilerschlüssel) sind in Kapitel 6.2 definiert und gelten für beide Teile, ebenso die harten Regeln aus 0.3 und die Rundungsfunktion aus 5.11.

---

# Teil I – WEG-Buchhaltung mit Bankimport und Zahlungszuordnung

## B1. Ziel

Die Buchhaltung führt für jede WEG die Bankkonten der Gemeinschaft, liest Kontoauszüge ein, ordnet jeden Bankumsatz fachlich zu und führt je Einheit ein Konto mit Sollstellungen (Hausgeld, Sonderumlagen, Abrechnungsergebnisse) und deren Ausgleich. Sie ist die Datengrundlage der Jahresabrechnung in Teil II und die Grundlage für ein späteres Mahnwesen.

Erfolgskriterien: Bei einer WEG mit gepflegten Zahlungsreferenzen werden Hausgeldeingänge weitgehend ohne manuellen Eingriff korrekt zugeordnet (Zielwert: mindestens 90 %). Der Verwalter bearbeitet nur noch eine Klärungsliste. Zu jedem Zeitpunkt ist je Einheit nachvollziehbar, was geschuldet, gezahlt und offen ist.

---

## B2. Rahmen

| Grundlage | Inhalt | Konsequenz im System |
|---|---|---|
| § 9a WEG | Die Gemeinschaft ist rechtsfähig und Inhaberin des Gemeinschaftsvermögens | Konten laufen auf den Namen der Gemeinschaft; jedes Konto gehört genau einer WEG |
| § 28 Abs. 1 WEG | Beschluss über Vorschüsse zur Kostentragung und zu den Rücklagen (Wirtschaftsplan) | Hausgeld-Sollstellungen aus dem Wirtschaftsplan (B7.2) |
| § 28 Abs. 2 WEG | Beschluss über Nachschüsse bzw. Anpassung der Vorschüsse | Sollstellung der Abrechnungsspitze nach Beschluss (B7.1) |
| §§ 366, 367 BGB | Anrechnung einer Zahlung auf mehrere Forderungen | Ausgleichsreihenfolge (B7.6) |
| ISO 20022 camt.053 | Standardformat elektronischer Kontoauszüge deutscher Banken | primäres Importformat (B5) |
| Grundsätze ordnungsmäßiger Buchführung | Nachvollziehbarkeit, Unveränderbarkeit, Vollständigkeit | unveränderliche Bankumsätze, Audit, Jahressperre |

Die WEG ist in der Regel nicht handelsrechtlich buchführungspflichtig. Das System orientiert sich dennoch an den genannten Grundsätzen, ohne eine formale Zertifizierung anzustreben. Wie in Teil II gilt: fachliche Abnahme vor dem Produktivbetrieb.

---

## B3. Umfang

### B3.1 Im MVP enthalten

Datei-Import von CAMT.053 (einzeln oder als ZIP), CSV-Import als Rückfallebene mit Mapping je Bank, Zuordnung der Auszüge zu Konten, Dublettenerkennung und Saldenkette, Buchungszeilen mit Aufteilung eines Umsatzes auf mehrere Positionen, Sollstellungen für Hausgeld, Sonderumlagen und Abrechnungsergebnisse, Offene-Posten-Verwaltung mit automatischem Ausgleich, regelbasierte und heuristische Zuordnung mit Lernfunktion, Behandlung von Rücklastschriften, Klärungsliste, Kontoblatt je Einheit, Offene-Posten-Liste, Journal, Eröffnungswerte für die Übernahme bestehender Gemeinschaften und die Jahressperre. KI-gestützte Vorschläge (Stufe 3 in B8.2) kommen zuletzt.

### B3.2 Nicht im MVP

- Automatischer Kontoabruf (EBICS, FinTS oder PSD2-Dienstleister). Die Adapter-Schnittstelle (B5.8) wird aber angelegt.
- SEPA-Lastschrifteinzug (pain.008) mit Mandatsverwaltung sowie Zahlungsausgang per Überweisungsdatei (pain.001). Rücklastschriften aus einem extern durchgeführten Einzug werden dagegen im MVP verarbeitet (B8.5).
- Mahnwesen; die Offene-Posten-Liste liefert dafür die Grundlage.
- Rechnungseingangsbuch mit Kreditoren-Fälligkeiten, DATEV-Export, Fremdwährungen.
- MT940. Das Format wurde von den deutschen Banken zugunsten von camt abgelöst und wird nur ergänzt, wenn ein Kunde es zwingend benötigt.

---

## B4. Glossar

| Fachbegriff | Bezeichner | Bedeutung |
|---|---|---|
| Importlauf | `ImportBatch` | eine hochgeladene Datei und ihr Verarbeitungsergebnis |
| Kontoauszug | `BankStatement` | Auszug eines Kontos mit Anfangs- und Schlusssaldo |
| Bankumsatz | `BankTransaction` | einzelne Zeile eines Auszugs, unveränderlich |
| Buchungszeile | `BookingLine` | fachliche Zuordnung eines Umsatzes oder eines Teilbetrags davon |
| Sollstellung / offener Posten | `Receivable` | Forderung der Gemeinschaft gegen einen Eigentümer (negativ: Guthaben) |
| Ausgleich | `PaymentAllocation` | Anrechnung einer Zahlung auf eine Sollstellung |
| Zahlerkonto | `PayerAccount` | bekannte IBAN, von der ein Eigentümer zahlt |
| Zahlungsreferenz | `PaymentReference` | eindeutige Referenz je Einheit für den Verwendungszweck |
| Zuordnungsregel | `AssignmentRule` | Regel „wenn ein Umsatz so aussieht, dann so buchen“ |
| Klärungskonto | Buchungsart `SUSPENSE` | vorläufige Zuordnung ungeklärter Umsätze |
| Rücklastschrift | Buchungsart `RETURNED_DEBIT` | zurückgegebene Lastschrift |
| Jahressperre | `YearLock` | Festschreibung eines Buchungsjahres |
| Eröffnungswerte | `OpeningBalanceSet` | Startwerte bei Übernahme einer Gemeinschaft |

---

## B5. Bankimport

### B5.1 Formate

CAMT.053 ist das primäre Format. Der Parser erkennt die Schemaversion am XML-Namespace und unterstützt mindestens `camt.053.001.02` und `camt.053.001.08`; weitere Versionen werden über dieselbe interne Abstraktion ergänzt. ZIP-Archive mit mehreren Auszügen werden entpackt und einzeln verarbeitet. Als Rückfallebene dient ein CSV-Import mit Mapping-Profil je Bank (B5.7).

### B5.2 Ablauf eines Imports

1. Datei hochladen und Hash bilden. Wurde dieselbe Datei bereits importiert, erscheint ein Hinweis, und es wird nichts doppelt angelegt.
2. Format erkennen, parsen und strukturell validieren. Eine fehlerhafte Datei wird vollständig abgelehnt, mit verständlicher Fehlermeldung.
3. Jeden enthaltenen Auszug über die IBAN einem Bankkonto des Mandanten zuordnen. Auszüge mit unbekannter IBAN werden abgelehnt und im Protokoll gemeldet; die übrigen Auszüge der Datei werden trotzdem verarbeitet.
4. Nur gebuchte Einträge übernehmen (`Sts` = `BOOK`); vorgemerkte Umsätze werden ignoriert.
5. Dubletten über den `dedupKey` erkennen und überspringen (B5.5).
6. Saldenkette prüfen (B5.6).
7. Schlusssaldo als `BalanceConfirmation` mit Quelle `STATEMENT` speichern.
8. Umsätze samt Rohdaten unveränderlich speichern.
9. Zuordnung anstoßen (B8).
10. Importprotokoll erzeugen: neue Umsätze, Dubletten, abgelehnte Auszüge, Warnungen.

Der Import ist idempotent: Ein erneuter Import derselben oder einer überlappenden Datei führt zum selben Datenstand.

### B5.3 Feldzuordnung CAMT.053

Pfade relativ zu `Stmt` bzw. `Ntry`. Unterschiede zwischen den Schemaversionen (z. B. `RltdPties/Dbtr/Nm` in .02 gegenüber `RltdPties/Dbtr/Pty/Nm` in .08) kapselt der Parser.

| Zielfeld | Quelle |
|---|---|
| Konto | `Acct/Id/IBAN` |
| Anfangssaldo | `Bal` mit `Tp/CdOrPrtry/Cd` = `PRCD` oder `OPBD` |
| Schlusssaldo | `Bal` mit `Tp/CdOrPrtry/Cd` = `CLBD`, inklusive Datum |
| Buchungstag / Valuta | `BookgDt/Dt` / `ValDt/Dt` |
| Betrag und Vorzeichen | `Amt` und `CdtDbtInd` (`CRDT` positiv, `DBIT` negativ); bei Einzelposten einer Sammelbuchung `TxDtls/Amt` |
| Währung | `Amt/@Ccy`, nur `EUR` zulässig |
| Gegenpartei | bei Eingang `RltdPties/Dbtr` und `DbtrAcct`, bei Ausgang `Cdtr` und `CdtrAcct` (Name, IBAN); BIC aus `RltdAgts` |
| Verwendungszweck | alle `RmtInf/Ustrd` zusammengefügt, zusätzlich `RmtInf/Strd/CdtrRefInf/Ref` |
| Ende-zu-Ende-Referenz | `Refs/EndToEndId` (`NOTPROVIDED` gilt als leer) |
| Mandatsreferenz | `Refs/MndtId` |
| Bankreferenz | `AcctSvcrRef` des Eintrags bzw. `Refs/AcctSvcrRef` |
| Transaktionscode | `BkTxCd/Domn` (Code, Familie, Unterfamilie) und `BkTxCd/Prtry/Cd` (deutscher Geschäftsvorfallcode) |
| Rückgabegrund | `RtrInf/Rsn/Cd` |
| Storno | `RvslInd` |

### B5.4 Sammelbuchungen

Enthält ein Eintrag mehrere Einzelposten (`NtryDtls` mit mehreren `TxDtls`), wird je Einzelposten ein eigener Bankumsatz mit Verweis auf den Sammelposten angelegt. Die Summe der Einzelposten muss dem Betrag des Eintrags entsprechen; andernfalls wird der Eintrag als ein einziger Umsatz übernommen und zur manuellen Aufteilung markiert. Liefert die Bank nur die Summe ohne Einzelposten, entsteht ein Umsatz, der in der Klärungsliste aufgeteilt wird. In Saldenkette und Kontenabstimmung zählt entweder der Sammelposten oder seine Einzelposten, nie beides.

### B5.5 Dublettenerkennung

Der `dedupKey` ist je Konto eindeutig. Bevorzugt wird die Bankreferenz (`AcctSvcrRef`), sofern die Bank sie eindeutig liefert. Andernfalls ist er ein Hash aus IBAN, Buchungstag, Betrag, Gegen-IBAN, Ende-zu-Ende-Referenz und Verwendungszweck, ergänzt um eine laufende Nummer für inhaltlich identische Umsätze am selben Tag. Zwei legitime, gleich aussehende Zahlungen am selben Tag bleiben so zwei Umsätze, während derselbe Umsatz aus einem überlappenden Auszug erkannt wird.

### B5.6 Saldenkette

Je Konto gilt: Der Anfangssaldo eines Auszugs entspricht dem Schlusssaldo des vorhergehenden Auszugs, und Anfangssaldo + Σ Umsätze des Auszugs = Schlusssaldo. Eine Verletzung ist beim Import eine Warnung (etwa bei einem fehlenden Auszug), blockiert aber die Jahressperre (BC01). Der Kontostand zum 31.12. ist der Schlusssaldo des letzten Auszugs mit Datum bis einschließlich 31.12., sofern die Kette bis dahin lückenlos ist und kein späterer Auszug Umsätze mit Buchungstag im alten Jahr enthält.

### B5.7 CSV-Rückfallebene

Ein Mapping-Profil je Bank legt Spaltenzuordnung, Datumsformat, Dezimaltrennzeichen, Vorzeichenlogik (eine Betragsspalte mit Vorzeichen oder getrennte Soll-/Haben-Spalten), Zeichensatz (häufig Windows-1252) und Kopfzeilen fest. CSV-Dateien enthalten meist keine Salden; der Kontostand zum 31.12. wird dann als `BalanceConfirmation` mit Quelle `MANUAL` erfasst. Dubletten werden über den Hash nach B5.5 erkannt.

### B5.8 Adapter-Schnittstelle

Alle Quellen liefern dieselbe normalisierte Struktur an dieselbe Pipeline, damit ein späterer automatischer Abruf keine Änderung an Zuordnung und Buchhaltung erfordert:

```ts
type NormalizedStatement = {
  iban: string; externalId: string;
  openingBalance: Cents; closingBalance: Cents; closingDate: string;
  entries: NormalizedEntry[];
};

interface StatementParser  { canParse(file: Uint8Array, fileName: string): boolean;
                             parse(file: Uint8Array): NormalizedStatement[]; }

interface StatementFetcher { fetch(iban: string, from: string, to: string): Promise<NormalizedStatement[]>; } // nach dem MVP
```

---

## B6. Datenmodell

Stammdaten (`Property`, `Unit`, `Owner`, `Ownership`, `CostType`, `AllocationKey`) sind in Kapitel 6.2 definiert. Die folgenden Entitäten gehören zur Buchhaltung und sind auch für Teil II maßgeblich. Bereits vorhandene Entitäten werden in M0 gemappt.

```ts
BankAccount         { id, propertyId, iban, bic?, bankName, accountHolder /* Name der Gemeinschaft */,
                      kind: 'OPERATING'|'RESERVE', openedAt, closedAt? }
UnitAccountAlias    { id, bankAccountId, unitId, virtualIban }            // virtuelle IBAN je Einheit, falls Bank das anbietet
PaymentReference    { id, unitId, reference /* eindeutig je Mandant */, validFrom, validTo? }

ImportBatch         { id, tenantId, source: 'CAMT053'|'CSV'|'API', fileId, fileHash,
                      importedBy, importedAt, summary: JSON }
BankStatement       { id, bankAccountId, importBatchId, externalId, sequenceNo?,
                      openingBalance: Cents, closingBalance: Cents, closingDate }
BankTransaction     { id, bankAccountId, bankStatementId?, importBatchId, dedupKey /* eindeutig je Konto */,
                      bookingDate, valueDate?, amount: Cents /* mit Vorzeichen */, currency: 'EUR',
                      counterpartyName?, counterpartyIban?, counterpartyBic?, remittanceInfo?,
                      endToEndId?, mandateId?, bankRef?, bankTxCode?, returnReasonCode?,
                      isReversal, batchParentId?, raw: JSON }              // unveränderlich
BalanceConfirmation { id, bankAccountId, date, balance: Cents, source: 'STATEMENT'|'MANUAL', bankStatementId? }

BookingLine         { id, propertyId, bankTransactionId, amount: Cents,
                      kind: /* Tabelle B8.1 */,
                      costTypeId?, unitId?, ownerId?, directUnitId?, specialLevyId?, settlementId?,
                      counterBookingLineId? /* Umbuchungspaar */, originalBookingLineId? /* Rücklastschrift */,
                      resolutionRef?, laborAmount?: Cents,
                      par35aCategory?: 'HOUSEHOLD_EMPLOYMENT'|'HOUSEHOLD_SERVICE'|'CRAFTSMAN',
                      documentId?, note?,
                      status: 'SUGGESTED'|'CONFIRMED'|'REVERSED',
                      source: 'RULE'|'HEURISTIC'|'AI'|'MANUAL', ruleId?, confidence?,
                      confirmedBy? /* userId oder 'AUTO' */, confirmedAt? }

EconomicPlan        { id, propertyId, label, resolutionDate, validFrom, validTo? /* offen = Fortgeltung beschlossen */,
                      dueDayOfMonth /* Standard 1 */ }
PlanAdvance         { id, planId, unitId, monthlyOperating: Cents, monthlyReserve: Cents, validFrom, validTo? }
SpecialLevy         { id, propertyId, resolutionDate, purpose, dueDate, reference }
SpecialLevyUnit     { id, levyId, unitId, amount: Cents }

Receivable          { id, propertyId, unitId, ownerId,
                      kind: 'ADVANCE'|'SPECIAL_LEVY'|'SETTLEMENT_BALANCE'|'OPENING'|'OTHER',
                      amount: Cents /* negativ = Guthaben des Eigentümers */,
                      components?: { operating: Cents; reserve: Cents },  // nur ADVANCE
                      dueDate, periodMonth?, sourceId?, legalBasis?,
                      status: 'OPEN'|'PARTIAL'|'SETTLED'|'CANCELLED', cancelledReason? }
PaymentAllocation   { id, bookingLineId, receivableId, amount: Cents,
                      components?: { operating: Cents; reserve: Cents },
                      createdBy /* userId oder 'AUTO' */, createdAt, reversedAt? }

PayerAccount        { id, propertyId, iban, ownerId, unitId?, validFrom, validTo?, confirmedBy }
AssignmentRule      { id, tenantId, propertyId?, name, priority, direction: 'IN'|'OUT'|'BOTH',
                      conditions: { iban?, nameContains?, remittanceContains?, bankTxCode?,
                                    amountMin?: Cents, amountMax?: Cents },
                      action: { kind, costTypeId?, unitId?, ownerId?,
                                splits?: Array<{ costTypeId: string; amount?: Cents; percent?: Dec }> },
                      autoConfirm: boolean, active: boolean }

YearLock            { id, propertyId, year, lockedAt, lockedBy, settlementId,
                      unlockedAt?, unlockedBy?, unlockReason? }
OpeningBalanceSet   { id, propertyId, cutoverDate, createdBy, confirmedAt?, confirmedBy? }
```

Ein `Owner` kann eine Personenmehrheit sein (z. B. Ehepaar, Erbengemeinschaft). Schuldner einer Sollstellung ist die Eigentümerpartei laut `Ownership`, nicht eine einzelne Person daraus.

**Invarianten** (mit Tests abgesichert):

1. Ein Bankumsatz gilt als vollständig zugeordnet, wenn die Summe seiner bestätigten, nicht stornierten Buchungszeilen exakt seinem Betrag entspricht.
2. Σ Ausgleiche einer Buchungszeile ≤ Betrag der Buchungszeile.
3. Σ Ausgleiche einer Sollstellung ≤ Betrag der Sollstellung.
4. Bankumsätze, Kontoauszüge und bestätigte Eröffnungswerte werden nie verändert oder gelöscht.
5. Split-Vorlagen mit Prozentangaben werden über `allocate` (Teil II, 5.11) verteilt; die letzte Position erhält keinen „Rest per Subtraktion“ außerhalb dieser Funktion.

---

## B7. Sollstellungen und offene Posten

### B7.1 Quellen

| Art | Quelle | Schuldner | Fälligkeit |
|---|---|---|---|
| `ADVANCE` | Wirtschaftsplan (`PlanAdvance`) | Eigentümer am Fälligkeitstag | laut Plan, Standard Monatserster |
| `SPECIAL_LEVY` | Sonderumlage | Eigentümer am Fälligkeitstag | laut Beschluss |
| `SETTLEMENT_BALANCE` | Jahresabrechnung im Status `RESOLVED` (Teil II, 8.1) | Eigentümer am Beschlusstag | laut Beschluss |
| `OPENING` | Eröffnungswerte (B7.9) | laut Übernahme | Stichtag der Übernahme |
| `OTHER` | manuelle Einzelforderung mit Rechtsgrund (Pflichtfeld `legalBasis`) | erfasster Eigentümer | erfasst |

### B7.2 Hausgeld

Für jede Einheit und jeden Monat im Gültigkeitszeitraum eines Wirtschaftsplans entsteht eine Sollstellung mit den Komponenten Bewirtschaftung und Rücklage. Monate ohne gültigen Plan erhalten keine Sollstellung und lösen eine Warnung aus (BC08). Ein Plan gilt über sein Wirtschaftsjahr hinaus nur, wenn er mit offenem Ende erfasst ist, weil die Gemeinschaft seine Fortgeltung beschlossen hat. Sollstellungen werden für den gesamten Gültigkeitszeitraum im Voraus erzeugt, bei offenem Ende rollierend für zwölf Monate.

### B7.3 Planänderung

Wird ein neuer Plan oder eine geänderte Vorschusshöhe wirksam, werden Sollstellungen ab dem Wirksamkeitsdatum, auf die noch nichts angerechnet wurde, storniert (`CANCELLED` mit Grund) und neu erzeugt. Bereits ganz oder teilweise ausgeglichene Sollstellungen bleiben bestehen; die Differenz wird als Anpassungssollstellung mit gleicher Fälligkeit angelegt. Rückwirkende Änderungen werden genauso behandelt. Jede Neuberechnung wird protokolliert.

### B7.4 Eigentümerwechsel

Mit dem Eigentumsübergang werden nicht ausgeglichene Sollstellungen mit Fälligkeit ab dem Übergangstag auf den Erwerber umgestellt. Sollstellungen mit früherer Fälligkeit bleiben beim Veräußerer, auch wenn sie offen sind. Hat der Veräußerer bereits Sollstellungen nach dem Übergangstag bezahlt, wird das nicht automatisch umgehängt, sondern als Klärungsfall gemeldet.

### B7.5 Guthaben

Negative Sollstellungen (z. B. ein Guthaben aus der Abrechnungsspitze) sind Verbindlichkeiten gegenüber dem Eigentümer. Sie werden durch eine Auszahlung (Buchungsart `SETTLEMENT_PAYMENT`, ausgehend) oder durch Verrechnung mit fälligen Sollstellungen ausgeglichen (Teil II, F9).

### B7.6 Ausgleichsreihenfolge

Eine Zahlung wird so auf die offenen Sollstellungen der Eigentümerpartei angerechnet:

1. Enthält die Zahlung eine erkennbare Tilgungsbestimmung (etwa die Referenz einer Sonderumlage oder einen ausdrücklich genannten Monat), wird sie befolgt.
2. Sonst werden fällige Sollstellungen nach Fälligkeit bedient, die älteste zuerst; bei gleicher Fälligkeit in einer konfigurierbaren Reihenfolge der Arten. Hat der Eigentümer mehrere Einheiten in der WEG, gilt das einheitenübergreifend.
3. Ein verbleibender Betrag bleibt als ungebundenes Guthaben stehen und wird mit der nächsten fälligen Sollstellung ausgeglichen (BF6).

Ob diese Standardreihenfolge der gesetzlichen Anrechnungsregel des § 366 Abs. 2 BGB in allen Fällen entspricht, ist fachlich zu prüfen (BF1). Der Verwalter kann jeden automatischen Ausgleich manuell ändern; die Änderung wird protokolliert.

### B7.7 Teilzahlungen auf Hausgeld

Ein Ausgleich auf eine Hausgeld-Sollstellung wird mit `allocate` im Verhältnis der Komponenten auf Bewirtschaftung und Rücklage verteilt (BF2). Aus der Rücklagenkomponente der Ausgleiche ergibt sich die Ist-Zuführung zur Rücklage für Teil II, 5.6.

### B7.8 Kontoblatt

Je Einheit und Eigentümerpartei werden chronologisch Sollstellungen, Zahlungen, Ausgleiche, Stornos und der laufende Saldo angezeigt, filterbar nach Zeitraum und als PDF und CSV exportierbar.

### B7.9 Eröffnungswerte

Bei der Übernahme einer bestehenden Gemeinschaft erfasst der Verwalter zu einem Stichtag die Kontostände aller Gemeinschaftskonten, den Stand der Erhaltungsrücklage(n), offene Forderungen und Guthaben je Eigentümer (als Sollstellungen der Art `OPENING`) und laufende Sonderumlagen mit Restbeträgen. Nach der Bestätigung sind die Eröffnungswerte gesperrt. Empfohlener Stichtag ist der 01.01. des ersten abzurechnenden Jahres, mit nachträglichem Import der Bankumsätze ab diesem Tag. Hintergrund: Die Jahresabrechnung erstellt in der Regel der Verwalter, der bei ihrer Fälligkeit im Amt ist, bei einem Wechsel im Laufe des Jahres also für das ganze Jahr (BF8).

---

## B8. Zahlungszuordnung

### B8.1 Buchungsarten und ihre Wirkung

Jeder Bankumsatz wird vollständig in eine oder mehrere Buchungszeilen aufgeteilt.

| Buchungsart | Richtung | Pflichtfelder | Wirkung in der Jahresabrechnung (Teil II) |
|---|---|---|---|
| `ADVANCE_PAYMENT` | Eingang (Rückzahlung: Ausgang) | `unitId`, `ownerId` | Einnahme „Hausgeldzahlungen“, Ist-Zahlung der Einheit; Ausgleich nach B7.6 |
| `SPECIAL_LEVY_PAYMENT` | Eingang | `unitId`, `ownerId`, `specialLevyId` | Einnahme Sonderumlage (5.8) |
| `SETTLEMENT_PAYMENT` | Eingang oder Ausgang | `unitId`, `ownerId`, `settlementId` | Nachzahlung bzw. Auszahlung aus einer Vorjahresabrechnung; eigene Position, nicht erneut verteilt (5.2) |
| `EXPENSE` | Ausgang (Gutschrift: Eingang) | `costTypeId` | Ausgabe nach Kostenart, verteilt (5.3) |
| `INCOME` | Eingang | `costTypeId` mit `direction = INCOME` | sonstige Einnahme, verteilt |
| `RESERVE_EXPENSE` | Ausgang | `costTypeId`, `resolutionRef` | Entnahme aus der Rücklage (5.6) |
| `INTERNAL_TRANSFER` | beide | `counterBookingLineId` | neutral, Umbuchung (5.2) |
| `RETURNED_DEBIT` | Ausgang | `originalBookingLineId` | mindert die ursprüngliche Zahlung gleicher Art; Sollstellung wieder offen |
| `SUSPENSE` | beide | `note` | Klärungskonto; blockiert Jahressperre und Abrechnung |

Kosten, die auf einem Rücklagenkonto abgebucht werden, erhalten automatisch den Vorschlag `RESERVE_EXPENSE`, außer bei Umbuchungen.

### B8.2 Zuordnungsstufen

**Stufe 0 – Normalisierung.** IBANs ohne Leerzeichen und in Großbuchstaben, Namen normalisiert (Umlaute, Rechtsformzusätze, Reihenfolge Vor-/Nachname), Verwendungszweck ohne Zeilenumbrüche und ohne technische Präfixe.

**Stufe 1 – deterministische Regeln** in dieser Reihenfolge; die erste zutreffende Regel gewinnt:

1. *Umbuchung:* Gegen-IBAN ist ein Konto derselben WEG → `INTERNAL_TRANSFER`. Das Gegenstück (gleicher Betrag, umgekehrtes Vorzeichen, Buchungstag ±3 Bankarbeitstage) wird verknüpft.
2. *Rücklastschrift:* Rückgabegrund oder entsprechender Transaktionscode vorhanden → Verarbeitung nach B8.5.
3. *Virtuelle IBAN:* Zahlung auf eine einer Einheit zugeordnete virtuelle IBAN → Einheit steht fest.
4. *Zahlungsreferenz:* Der Verwendungszweck enthält die Referenz einer Einheit oder einer Sonderumlage. Abgleich ohne Beachtung von Groß-/Kleinschreibung, Leerzeichen und Bindestrichen. Das System erzeugt je Einheit eine eindeutige Referenz (konfigurierbares Format, Standard `HG-<Objektkürzel>-<Einheitennummer>`), die der Verwalter den Eigentümern mitteilt.
5. *Bekanntes Zahlerkonto:* Die Gegen-IBAN ist in dieser WEG genau einer Eigentümerpartei als `PayerAccount` zugeordnet → Eigentümer steht fest. Ist sie mehreren Parteien zugeordnet, greift diese Regel nicht.
6. *Zuordnungsregeln:* `AssignmentRule` nach Priorität, einschließlich Split-Vorlagen (z. B. ein Versorgerabschlag auf zwei Kostenarten).
7. *Bankentgelte und Zinsen:* anhand des Transaktionscodes auf die konfigurierte Kostenart.

Steht bei einem Eingang die Eigentümerpartei fest, erzeugt das System die Buchungszeile(n) und den Ausgleich nach B7.6.

**Stufe 2 – Heuristik** für verbliebene Umsätze. Bei Eingängen werden die Eigentümer der WEG bewertet nach Namensähnlichkeit zwischen Zahler und Eigentümer, Übereinstimmung des Betrags mit offenen Sollstellungen oder einem Vielfachen des Monatshausgelds sowie Einheitennummern und Monatsangaben im Verwendungszweck. Bei Ausgängen dient die bisherige Buchung derselben Gegenpartei als Vorschlag. Das Ergebnis ist eine Vorschlagsliste mit Punktwert zwischen 0 und 1; Schwellenwerte sind konfigurierbar (Standard: Anzeige ab 0,6, Hervorhebung ab 0,85).

**Stufe 3 – KI** (Meilenstein M7) nur für Umsätze ohne Vorschlag aus Stufe 2. Die Eingabe enthält Verwendungszweck, Betrag, Richtung, bei Ausgängen den Namen der Gegenpartei und die Kostenarten der WEG. Eigentümerlisten werden nicht übermittelt; der Namensabgleich bleibt deterministisch. Die Ausgabe wird gegen ein JSON-Schema validiert und nur als Vorschlag gespeichert.

### B8.3 Automatische Bestätigung

Automatisch bestätigt werden ausschließlich Ergebnisse aus Stufe 1, und nur bei Regeln, die dafür freigegeben sind. Standardmäßig freigegeben sind Umbuchungen, virtuelle IBANs, Zahlungsreferenzen und eindeutige Zahlerkonten. Benutzerdefinierte Regeln sind es nur, wenn der Verwalter `autoConfirm` aktiviert. Vorschläge aus Stufe 2 und 3 werden nie automatisch bestätigt. Automatisch bestätigte Buchungszeilen sind als solche gekennzeichnet und filterbar.

### B8.4 Lernen

Bestätigt der Verwalter die Zuordnung eines Eingangs von einer bisher unbekannten IBAN, bietet das System an, sie als Zahlerkonto zu speichern. Bei Ausgängen bietet es an, eine vorausgefüllte Zuordnungsregel anzulegen. Regeln und Zahlerkonten entstehen nie ohne Bestätigung.

### B8.5 Rücklastschriften

Ein Umsatz mit Rückgabegrund wird über Ende-zu-Ende- und Mandatsreferenz der ursprünglichen Buchungszeile zugeordnet. Die Rücklastschrift hebt den zugehörigen Ausgleich auf; die Sollstellung ist wieder offen. Enthält der Rückbuchungsbetrag Bankentgelte (Differenz zum Originalbetrag oder Angabe in `TxDtls/Chrgs`), wird die Differenz als eigene Buchungszeile auf die konfigurierte Kostenart für Bankentgelte gebucht. Eine Weiterbelastung an den Eigentümer erfolgt nur, wenn sie für die Gemeinschaft konfiguriert ist (BF3). Wird das Original nicht gefunden, geht der Umsatz in die Klärungsliste.

### B8.6 Klärungsliste

Die Klärungsliste zeigt alle Umsätze, die nicht vollständig bestätigt sind, sortiert nach Datum und filterbar nach WEG, Konto, Richtung und Betrag. Je Umsatz sieht der Verwalter Rohdaten, Vorschläge mit Begründung und Punktwert. Aktionen: Vorschlag bestätigen, anderen Vorschlag wählen, aufteilen, manuell zuordnen, Beleg anhängen oder mit Notiz auf das Klärungskonto buchen. Gleichartige Vorschläge derselben Regel lassen sich gesammelt bestätigen. Ein „Ignorieren“ gibt es nicht, weil jeder Umsatz für die Kontenabstimmung zugeordnet sein muss.

### B8.7 Belege

Ausgaben sollen einen Beleg haben (Warnung BC11). Die Belegerkennung (Teil II, K1) kann aus einer Rechnung Kostenart, § 35a-Kategorie und Lohnanteil vorschlagen und die Rechnung über Betrag, IBAN oder Rechnungsnummer im Verwendungszweck der passenden Zahlung zuordnen.

### B8.8 Korrekturen

Bankumsätze sind unveränderlich. Buchungszeilen können bis zur Jahressperre geändert werden; jede Änderung wird mit altem und neuem Stand protokolliert. Nach der Jahressperre ist eine Änderung nur nach einer Entsperrung möglich, die der Verwalter mit Begründung auslöst. Sie wird protokolliert, und die Jahresabrechnung erhält den Hinweis „Grundlage geändert“; eine Korrektur der Abrechnung erfolgt dann als neue Version (Teil II, 8.1).

---

## B9. Jahressperre und Übergabe an Teil II

Ein Buchungsjahr kann gesperrt werden, wenn alle Bankumsätze mit Buchungstag im Jahr vollständig bestätigt zugeordnet sind, keine Buchungszeile auf dem Klärungskonto steht, die Saldenkette aller Konten lückenlos ist und für jedes Konto ein Kontostand zum 31.12. vorliegt (B5.6 oder manuell). Die Sperre wird mit dem Statuswechsel der Jahresabrechnung auf `FINAL` gesetzt (Teil II, 8.1). Der Rechenkern liest ausschließlich bestätigte Buchungszeilen, Sollstellungen und Ausgleiche des Jahres. Beim Statuswechsel auf `RESOLVED` entstehen die Sollstellungen der Abrechnungsspitzen (B7.1).

---

## B10. Prüfungen

| ID | Prüfung | Schwere |
|---|---|---|
| BC01 | Saldenkette eines Kontos unterbrochen | Warnung beim Import, blockiert Jahressperre |
| BC02 | Auszug mit unbekannter IBAN | Auszug abgelehnt |
| BC03 | Dublette erkannt | Hinweis, übersprungen |
| BC04 | Umsatz nicht vollständig zugeordnet | blockiert Jahressperre |
| BC05 | Buchungszeilen auf dem Klärungskonto | blockiert Jahressperre |
| BC06 | Währung ungleich EUR | Umsatz abgelehnt |
| BC07 | Sollstellung ohne Eigentümer am Fälligkeitstag | blockierend für die Sollstellung |
| BC08 | Monate ohne gültigen Wirtschaftsplan | Warnung |
| BC09 | Umbuchung ohne Gegenstück auf dem anderen Konto | Warnung, blockiert Jahressperre |
| BC10 | Ausgabe vom Rücklagenkonto ohne Beschlussreferenz | Warnung |
| BC11 | Ausgabe ohne Beleg | Warnung |
| BC12 | ungebundenes Guthaben eines Eigentümers über konfigurierbarem Schwellenwert | Hinweis |
| BC13 | Zahlung des Veräußerers für Zeiträume nach dem Eigentumsübergang | Klärungsfall |

---

## B11. Auswertungen

Kontoblatt je Einheit (B7.8); Offene-Posten-Liste je WEG mit Altersstruktur (0–30, 31–60, 61–90, über 90 Tage), als Grundlage für ein späteres Mahnwesen; Journal aller Buchungszeilen mit Filter und CSV-Export; Kontenübersicht mit Saldenkette je Konto; Importprotokolle; optional ein Soll-Ist-Vergleich der Kosten gegen die Ansätze des Wirtschaftsplans, sofern der Plan Kostenansätze enthält.

---

## B12. Tests

**Parser.** Anonymisierte echte CAMT.053-Dateien mehrerer Banken, mindestens von einer Sparkasse, einer Volks- oder Raiffeisenbank und der Hausbank der ersten Kunden. Die Dateien liefert der Auftraggeber. Dazu synthetische Grenzfälle: Sammelbuchung mit und ohne Einzelposten, Rücklastschrift mit Entgelt, Storno, `NOTPROVIDED`, mehrteiliger Verwendungszweck, Umlaute, beide Schemaversionen.

**Import.** Überlappende Auszüge ohne Dubletten; zwei legitime gleiche Umsätze am selben Tag bleiben zwei; Lücke in der Saldenkette wird erkannt; gleiche Datei zweimal ergibt identischen Datenstand.

**Sollstellungen und Ausgleich.** Planänderung mit teilweise ausgeglichenen Sollstellungen, Eigentümerwechsel mit Rückstand beim Veräußerer, Teilzahlung mit Komponentenaufteilung, Überzahlung und spätere Verrechnung, Eigentümer mit zwei Einheiten zahlt die Summe, Tilgungsbestimmung für eine Sonderumlage, Rücklastschrift öffnet die Sollstellung wieder.

**Zuordnung.** Tabellengetriebene Fälle (Umsatz als Eingabe, erwartete Buchungszeilen und Ausgleiche als Ergebnis), mindestens 30, darunter Zahlung durch Dritte, Versorgerabschlag mit Split-Vorlage, Umbuchungspaar mit Datumsversatz, mehrdeutiges Zahlerkonto und Gutschrift eines Lieferanten. Erwartete Ergebnisse legt der Auftraggeber fest oder bestätigt sie.

**Eigenschaftsbasiert.** Invarianten aus B6 für zufällige Umsätze, Splits und Ausgleichsfolgen.

**Integration.** RLS: Mandant A sieht weder Konten noch Umsätze von Mandant B; Jahressperre nur bei erfüllten Voraussetzungen; KI-Vorschläge werden nie automatisch bestätigt.

---

## B13. Offene Fachfragen zur Buchhaltung

| ID | Frage | Standard bis zur Klärung |
|---|---|---|
| BF1 | Entspricht die Ausgleichsreihenfolge „älteste fällige zuerst“ in allen Fällen § 366 Abs. 2 BGB, oder braucht es eine differenziertere Reihenfolge? | älteste fällige zuerst |
| BF2 | Teilzahlungen: proportional auf Bewirtschaftung und Rücklage oder Bewirtschaftung zuerst? | proportional |
| BF3 | Rücklastschriftentgelte an den Eigentümer weiterbelasten (Beschlussgrundlage nötig) oder Kosten der Gemeinschaft? | Kosten der Gemeinschaft |
| BF4 | Welche Banken nutzen die ersten Kunden, und bieten sie virtuelle IBANs je Einheit an? | reiner Dateiimport |
| BF5 | Welcher automatische Abrufweg zuerst: EBICS oder ein PSD2-Dienstleister? | nach dem MVP |
| BF6 | Überzahlungen automatisch mit der nächsten Fälligkeit verrechnen oder vorher nachfragen? | automatisch |
| BF7 | Format der Zahlungsreferenz; nutzen Bestandskunden bereits eigene Referenzen, die übernommen werden müssen? | `HG-<Objektkürzel>-<Einheitennummer>` |
| BF8 | Übernahme bei Verwalterwechsel: Stichtag 01.01. bestätigen; werden Daten aus Altsoftware importiert oder manuell erfasst? | Stichtag 01.01., manuelle Erfassung |

---

# Teil II – WEG-Jahresabrechnung

## 1. Ziel

Das Modul erstellt für eine Wohnungseigentümergemeinschaft (WEG) aus den gebuchten Zahlungen eines Kalenderjahres die Jahresabrechnung nach § 28 WEG. Dazu gehören eine Gesamtabrechnung, Einzelabrechnungen je Einheit mit der beschlussrelevanten Abrechnungsspitze, ein Vermögensbericht sowie Zusatzausweise für vermietende Eigentümer. Anwender ist der WEG-Verwalter, der Verwaltungsbeirat prüft, die Eigentümer erhalten die Dokumente.

Erfolgskriterium: Für ein sauber gebuchtes Objekt erzeugt der Verwalter die vollständige Abrechnung in einem geführten Ablauf ohne Nebenrechnung in Excel, und jede Zahl ist bis auf die zugrunde liegenden Buchungen rückverfolgbar.

---

## 2. Rechtlicher Rahmen (Kurzreferenz)

| Norm | Inhalt | Konsequenz im System |
|---|---|---|
| § 28 Abs. 2 WEG | Jahresabrechnung nach Ende des Kalenderjahres; beschlossen wird über Nachschüsse bzw. die Anpassung der Vorschüsse | Ergebnis je Einheit ist die Abrechnungsspitze (5.4) |
| § 28 Abs. 4 WEG | Vermögensbericht: Stand der Erhaltungsrücklage und wesentliches Gemeinschaftsvermögen | eigenes Dokument (5.13) |
| § 16 Abs. 2 WEG | Kostenverteilung nach Miteigentumsanteilen, abweichende Verteilung per Beschluss | Verteilerschlüssel je Kostenart mit Beschlussreferenz (5.3) |
| § 19 Abs. 2 Nr. 4 WEG | Erhaltungsrücklage | Rücklagenkonten und -entwicklung (5.6) |
| HeizkostenV | verbrauchsabhängige Verteilung von Heizung und Warmwasser | Import des Messdienstergebnisses (5.5) |
| CO2KostAufG | Aufteilung der CO2-Kosten zwischen Vermieter und Mieter | Importfelder und Ausweis (5.10) |
| § 35a EStG | Steuerermäßigung für Arbeitskosten haushaltsnaher Leistungen | Lohnanteil je Buchung, Ausweis je Einheit (5.9) |
| § 2 BetrKV | Katalog umlagefähiger Betriebskosten | Kennzeichnung je Kostenart (5.10) |

Die rechtliche Einordnung in diesem Dokument ist ein technischer Entwurf und keine Rechtsberatung. Vor dem Produktivbetrieb wird sie von einer fachkundigen Person (erfahrener WEG-Verwalter oder Fachanwalt für WEG-Recht) abgenommen.

---

## 3. Umfang

### 3.1 Im MVP enthalten

Gesamtabrechnung mit Kontenabstimmung, Einzelabrechnungen mit Abrechnungsspitze, Entwicklung der Erhaltungsrücklage, Vermögensbericht, Import der Heizkostenergebnisse des Messdienstes, Ausweise nach § 35a EStG, Umlagefähigkeit und CO2-Kosten, Plausibilitätsprüfungen, Status-Workflow mit Versionierung und Snapshot, PDF-Dokumente sowie ein Export für vermietende Eigentümer.

### 3.2 Nicht im MVP

- Die Heizkostenverteilung selbst; sie übernimmt der Messdienst.
- Die Erstellung des Wirtschaftsplans; das Modul liest nur die beschlossenen Vorschüsse.
- Mehrhausanlagen mit Untergemeinschaften. Das Datenmodell darf das aber nicht verbauen, deshalb erhält jede Kostenart optional eine Kostenstelle.
- Gemeinschaften mit Umsatzsteueroption (gewerbliche Einheiten).
- Mahnwesen, Postversand und die Mieter-Nebenkostenabrechnung; für Letztere wird nur die Datengrundlage exportiert.

### 3.3 Voraussetzungen

Die Jahresabrechnung ist das Ergebnis einer laufenden WEG-Buchhaltung. Das Modul benötigt: Objekt, Einheiten mit Miteigentumsanteilen (und ggf. Fläche), Eigentümer mit Eigentumszeiträumen, Bankkonten (Bewirtschaftung, Rücklage), die Buchungen des Jahres mit Buchungstag und Zuordnung, den beschlossenen Wirtschaftsplan mit Vorschüssen je Einheit und die Kontoauszugssalden zum 31.12.

Diese Daten liefert die WEG-Buchhaltung aus Teil I. Meilenstein 0 prüft, welche Teile davon die Codebasis bereits abdeckt; vorhandene Funktionen werden gegen Teil I abgeglichen und nur um Fehlendes ergänzt.

---

## 4. Glossar

Bezeichner im Code sind englisch, dieses Glossar ist verbindlich. Hat die Codebasis für einen Begriff bereits einen etablierten Bezeichner, gilt dieser und wird im Plan vermerkt.

| Fachbegriff | Bezeichner | Bedeutung |
|---|---|---|
| Objekt / WEG | `Property` | die Eigentümergemeinschaft mit ihrer Liegenschaft |
| Einheit (Sondereigentum) | `Unit` | Wohnung, Gewerbe, Stellplatz |
| Miteigentumsanteil (MEA) | `coOwnershipShare` | Anteil am Gemeinschaftseigentum |
| Eigentümer | `Owner` | natürliche oder juristische Person |
| Eigentumszeitraum | `Ownership` | wer wann Eigentümer einer Einheit war |
| Verteilerschlüssel | `AllocationKey` | Regel zur Kostenverteilung |
| Kostenart | `CostType` | Ausgaben- oder Einnahmenposition |
| Wirtschaftsplan | `EconomicPlan` | beschlossene Vorschüsse des Jahres |
| Vorschuss (Hausgeld) | `Advance` | monatliche Soll-Zahlung je Einheit |
| Sonderumlage | `SpecialLevy` | gesondert beschlossene Zahlung |
| Erhaltungsrücklage | `MaintenanceReserve` | Rücklage der Gemeinschaft |
| Jahresabrechnung | `Settlement` | Gesamtergebnis eines Jahres |
| Gesamtabrechnung | `OverallStatement` | Einnahmen und Ausgaben der Gemeinschaft |
| Einzelabrechnung | `UnitStatement` | Ergebnis je Einheit |
| Abrechnungsspitze | `settlementBalance` | positiv = Nachschuss, negativ = Guthaben |
| Direktbelastung | `directCharge` | Kosten, die einer Einheit allein zugeordnet werden |
| Vermögensbericht | `AssetReport` | Bericht nach § 28 Abs. 4 WEG |
| Messdienst | `MeteringProvider` | Dienstleister für die Heizkostenabrechnung |

---

## 5. Fachliche Regeln (verbindlich)

### 5.1 Abrechnungsprinzip

Die Jahresabrechnung ist eine Einnahmen-Ausgaben-Rechnung nach dem Zu- und Abflussprinzip. Maßgeblich ist der Buchungstag der Zahlung auf einem Konto der Gemeinschaft im Kalenderjahr, also dasselbe Datum, auf dem der Kontoauszugssaldo beruht. Rechnungs- und Leistungsdatum sind unerheblich. Es gibt keine Rechnungsabgrenzung und keine offenen Forderungen oder Verbindlichkeiten als Kosten. Einzige Ausnahme sind die Heizkosten (5.5).

### 5.2 Gesamtabrechnung

Die Gesamtabrechnung zeigt je Bankkonto den Anfangsbestand zum 01.01., die Einnahmen, die Ausgaben, die Umbuchungen und den Endbestand zum 31.12. Die Einnahmen sind gegliedert in Hausgeldzahlungen (Ist), Sonderumlagezahlungen (Ist) und sonstige Einnahmen (z. B. Zinsen, Erstattungen, Nutzungsentgelte). Die Ausgaben sind nach Kostenart gegliedert, jeweils mit Angabe des Verteilerschlüssels. Umbuchungen zwischen Konten der Gemeinschaft (z. B. Bewirtschaftungskonto an Rücklagenkonto) sind weder Einnahme noch Ausgabe und werden gesondert gezeigt. Zahlungen aus Vorjahresabrechnungen (Nachzahlungen und Auszahlungen von Guthaben) werden als eigene Position gezeigt und nicht erneut verteilt. Dazu kommt die Heizkosten-Überleitung nach 5.5. Welche Buchungsart in welche Position fließt, regelt Tabelle B8.1.

### 5.3 Verteilerschlüssel

Schlüsseltypen: `CO_OWNERSHIP` (MEA), `AREA`, `UNIT_COUNT`, `PERSONS`, `CONSUMPTION`, `CUSTOM`. Daneben gibt es die Direktbelastung.

1. Jede Kostenart (außer Heizkosten, 5.5) hat genau einen Schlüssel. Standard ist `CO_OWNERSHIP`. Für abweichende Schlüssel wird eine Beschluss- oder Vereinbarungsreferenz hinterlegt; fehlt sie, gibt es eine Warnung.
2. Schlüsselwerte haben Gültigkeitszeiträume (Datumsgrenzen inklusive). Das Jahresgewicht einer Einheit ist Σ (Wert × Gültigkeitstage im Jahr) / Tage des Jahres (365 bzw. 366).
3. Einheiten ohne Schlüsselwert haben das Gewicht 0. Kosten ungleich 0 auf einem Schlüssel mit Gesamtgewicht 0 sind ein blockierender Fehler.
4. `CONSUMPTION` verwendet einen importierten Jahresverbrauch je Einheit (z. B. Kaltwasser, sofern nicht über den Messdienst abgerechnet).
5. Direktbelastung: Eine Buchung mit `directUnitId` wird zu 100 % dieser Einheit zugeordnet. Das ist nur bei Kostenarten mit `allowsDirectCharge = true` zulässig, andernfalls blockierender Fehler.
6. Gewichtsarithmetik erfolgt mit einer Dezimalbibliothek (6.1), nicht mit `number`.

### 5.4 Einzelabrechnung und Abrechnungsspitze

Je Einheit gilt:

```
K = Σ Anteile der Einheit an allen Ausgaben-Kostenarten der Bewirtschaftung
    (inkl. Heizkosten laut Messdienst und Direktbelastungen)
E = Σ Anteile der Einheit an verteilten Einnahmen-Kostenarten
R = K − E                        Kostenergebnis
V = Σ Soll-Vorschüsse Bewirtschaftung laut Wirtschaftsplan für das Jahr
S = R − V                        Abrechnungsspitze (S > 0 Nachschuss, S < 0 Guthaben)
```

1. V ist der Soll-Betrag laut Wirtschaftsplan, nicht die tatsächliche Zahlung. Ist-Zahlungen und Rückstände beeinflussen S nicht; offene Vorschüsse bleiben eigenständige Forderungen aus dem Wirtschaftsplan.
2. Rücklagenbeiträge laut Wirtschaftsplan sind weder in K noch in V enthalten. Sie erscheinen ausschließlich in der Rücklagenentwicklung (5.6).
3. Aus der Rücklage finanzierte Ausgaben sind nicht in K enthalten (Standard, siehe F1).
4. Sonderumlagen sind weder in K noch in V enthalten (Standard, siehe F2).
5. Unterhalb des Ergebnisblocks steht ein Informationsblock, der deutlich als „nicht Gegenstand des Beschlusses“ gekennzeichnet ist: Ist-Zahlungen im Jahr, offene Vorschüsse mit Schuldner, Rücklagenausweis, § 35a-Ausweis, umlagefähige Kosten und CO2-Kosten.
6. Ändert sich der Wirtschaftsplan unterjährig, ergibt sich V aus der Summe der monatlichen Soll-Beträge nach ihrer Gültigkeit (Fälligkeit siehe F6).

### 5.5 Heizkosten

1. Kostenarten mit `isHeating = true` werden nicht per Schlüssel verteilt. Die Anteile je Einheit (Heizung und Warmwasser) werden aus dem Messdienst-Import übernommen.
2. Die Summe der importierten Einheitenbeträge muss dem Gesamtbetrag laut Messdienst-Abrechnung entsprechen. Eine Abweichung ist blockierend, solange der Verwalter sie nicht ausdrücklich als Rundungsdifferenz des Messdienstes bestätigt hat.
3. In der Gesamtabrechnung erscheinen nach 5.1 die tatsächlich gezahlten Heizkosten (Brennstoff, Fernwärme, Wartung, Messdienst usw.). Die Differenz zwischen diesen Zahlungen und dem Gesamtbetrag laut Messdienst (etwa durch Brennstoffbestände oder abweichende Abrechnungszeiträume des Versorgers) wird als Überleitungsrechnung ausgewiesen. Ist die Differenz ungleich 0, ist ein Erläuterungstext des Verwalters Pflicht.
4. Einheiten ohne Heizung (z. B. Stellplätze) erhalten im Import den Wert 0.
5. Der Import liest CSV oder XLSX mit einem konfigurierbaren Spalten-Mapping je Messdienst (Reihenfolge der Anbieter siehe F4).

### 5.6 Erhaltungsrücklage

Je Rücklage wird eine Entwicklung ausgewiesen: Anfangsbestand, Soll-Zuführungen laut Wirtschaftsplan, Ist-Zuführungen, Entnahmen mit Beschlussreferenz, Zinsen und Erträge, Endbestand. Die Differenz zwischen Soll- und Ist-Zuführung wird als rückständige Zuführung gezeigt. Wird die Rücklage auf einem eigenen Konto geführt, muss der Endbestand dem Kontostand entsprechen (Ermittlung der Ist-Zuführung und Umgang mit Abweichungen siehe F7). Ein Anteil je Einheit wird nur informativ nach MEA ausgewiesen, mit dem Hinweis, dass die Rücklage Vermögen der Gemeinschaft ist.

### 5.7 Eigentümerwechsel

1. Ein Eigentumszeitraum beginnt mit dem Eigentumsübergang (Eintragung im Grundbuch), nicht mit dem Besitzübergang laut Kaufvertrag.
2. Die Einzelabrechnung wird je Einheit erstellt, nicht je Eigentümerzeitraum. Schuldner der Abrechnungsspitze ist, wer zum Zeitpunkt des Beschlusses Eigentümer ist. Im Entwurf wird der aktuelle Eigentümer als Adressat angezeigt; beim Statuswechsel auf `RESOLVED` wird der Adressat anhand des Beschlussdatums festgeschrieben.
3. Rückständige Vorschüsse schuldet, wer zum jeweiligen Fälligkeitszeitpunkt Eigentümer war. Sie werden im Informationsblock mit diesem Schuldner ausgewiesen und nie auf den Erwerber übertragen.
4. Die Abrechnungsspitze wird nicht automatisch zeitanteilig aufgeteilt. Eine rein informative Aufteilung ist optional für später vorgesehen (F3).

### 5.8 Sonderumlagen

Standard im MVP: Jede Sonderumlage erhält einen eigenen Abschnitt mit Beschluss, Soll je Einheit, Ist-Zahlungen, Verwendung (zugeordnete Ausgaben) und Restbetrag. Sie ist nicht Teil der Abrechnungsspitze (F2).

### 5.9 Ausweis nach § 35a EStG

1. Eine Buchung kann einen Lohnanteil (brutto) und eine Kategorie tragen: `HOUSEHOLD_EMPLOYMENT`, `HOUSEHOLD_SERVICE` oder `CRAFTSMAN`.
2. Der Anteil je Einheit ergibt sich aus der Verteilung des Lohnanteils mit demselben Schlüssel wie die Kostenart, über die Funktion aus 5.11.
3. Der Ausweis je Einheit ist nach Kategorie gegliedert und enthält den Hinweis, dass die steuerliche Würdigung beim Eigentümer liegt.
4. Lohnanteile in den Heizkosten können optional aus dem Messdienst-Import übernommen werden (F4).

### 5.10 Umlagefähigkeit und CO2-Kosten

1. Jede Kostenart trägt `apportionable: boolean` und `betrkvNo: 1..17 | null`. Die Werte pflegt der Verwalter; das System setzt sie nicht eigenmächtig.
2. Je Einheit werden die umlagefähigen Kosten gegliedert nach BetrKV-Nummer sowie die Summe der nicht umlagefähigen Kosten ausgewiesen.
3. CO2-Kosten und Vermieteranteil (in Prozent) werden je Einheit aus dem Messdienst-Import übernommen und ausgewiesen. Eine eigene Stufenberechnung gibt es im MVP nicht.

### 5.11 Rundung und Verteilung

Alle Verteilungen laufen über eine zentrale Funktion `allocate`:

1. Exakten Anteil je Einheit berechnen: Betrag × Gewicht / Σ Gewichte (dezimal, ungerundet).
2. Auf ganze Cent abrunden. Bei negativen Beträgen wird mit dem Absolutbetrag gerechnet und das Vorzeichen anschließend wieder gesetzt.
3. Die verbleibenden Restcents werden nach dem größten Nachkommarest verteilt (Hare-Niemeyer). Bei Gleichstand erhält die Einheit mit dem kleineren Sortierschlüssel (Einheitennummer, natürlich sortiert) den Cent.
4. Invarianten: Σ Anteile = Betrag exakt; jeder Anteil weicht um weniger als 1 Cent vom exakten Anteil ab.

Beispiele:

| Betrag | Gewichte | Ergebnis |
|---|---|---|
| 100,00 € | MEA 250 / 250 / 300 / 200 | 25,00 / 25,00 / 30,00 / 20,00 |
| 100,00 € | 1 / 1 / 1 | 33,34 / 33,33 / 33,33 |
| 0,02 € | 1 / 1 / 1 | 0,01 / 0,01 / 0,00 |
| −100,00 € | 1 / 1 / 1 | −33,34 / −33,33 / −33,33 |

Verteilt wird je Kostenart. Die Summen je Einheit sind Summen der bereits gerundeten Anteile.

### 5.12 Kontenabstimmung

Je Bankkonto muss gelten: Anfangsbestand + Σ Eingänge − Σ Ausgänge = Endbestand, und der Endbestand entspricht dem Kontoauszugssaldo zum 31.12. (aus dem Import nach B5.6, andernfalls manuell erfasst). Liegt eine Vorjahresabrechnung vor, entspricht der Anfangsbestand deren Endbestand. Jede Abweichung ist blockierend.

### 5.13 Vermögensbericht

Der Vermögensbericht enthält die Kontostände aller Gemeinschaftskonten zum 31.12., den Stand der Erhaltungsrücklage(n) aus 5.6, die Forderungen der Gemeinschaft gegen Eigentümer (offene Vorschüsse und Sonderumlagen, summiert), bekannte Verbindlichkeiten zum Stichtag (manuelle Eingabe) und sonstiges wesentliches Gemeinschaftsvermögen (Positionen mit Freitext, z. B. Brennstoffvorrat, Inventar). Er ist kein Gegenstand des Beschlusses und wird entsprechend gekennzeichnet.

---

## 6. Datenmodell

### 6.1 Typen

```ts
// Geld: ganzzahlige Cent, Prüfung mit Number.isSafeInteger bei jeder Erzeugung. DB-Typ: bigint.
type Cents = number & { readonly __brand: 'Cents' };

// Gewichte, MEA, Flächen, Prozentsätze: Dezimaltyp (decimal.js oder vorhandene Bibliothek). DB-Typ: numeric.
type Dec = Decimal;
```

### 6.2 Entitäten

Entitäten, die in der Codebasis bereits existieren, werden in M0 gemappt und nur um fehlende Felder ergänzt.

```ts
Property           { id, tenantId, name, address }
Unit               { id, propertyId, number, sortKey, kind: 'APARTMENT'|'COMMERCIAL'|'PARKING'|'OTHER',
                     coOwnershipShare: Dec, livingArea?: Dec }
Owner              { id, tenantId, name, postalAddress, email? }        // auch Personenmehrheit (B6)
Ownership          { id, unitId, ownerId, validFrom, validTo? }        // validFrom = Grundbucheintragung

AllocationKey      { id, propertyId, name, type: 'CO_OWNERSHIP'|'AREA'|'UNIT_COUNT'|'PERSONS'|'CONSUMPTION'|'CUSTOM' }
AllocationKeyValue { id, keyId, unitId, value: Dec, validFrom, validTo? }

CostType           { id, propertyId, name, direction: 'EXPENSE'|'INCOME', allocationKeyId?,
                     isHeating, allowsDirectCharge, apportionable, betrkvNo?, costCenterId?,
                     resolutionRef? }

// BankAccount, BalanceConfirmation, BookingLine, Receivable, PaymentAllocation,
// EconomicPlan, PlanAdvance, SpecialLevy, SpecialLevyUnit: definiert in Kapitel B6 (maßgeblich).

HeatingImport      { id, propertyId, year, provider, totalAmount: Cents, sourceFileId,
                     confirmedDifference?: Cents, reconciliationNote? }
HeatingImportUnit  { id, importId, unitId, heating: Cents, hotWater: Cents,
                     co2Cost?: Cents, co2LandlordSharePct?: Dec, laborAmount?: Cents }

AssetItem          { id, propertyId, year, label, amount?: Cents, note? }   // Vermögensbericht, manuell
LiabilityItem      { id, propertyId, year, label, amount: Cents }

Settlement         { id, propertyId, year, version, status: 'DRAFT'|'REVIEW'|'FINAL'|'RESOLVED'|'SUPERSEDED',
                     inputSnapshot: JSON, resultSnapshot: JSON, inputHash, engineVersion,
                     finalizedAt?, resolvedAt?, resolutionDate?, supersedesId? }
SettlementUnit     { id, settlementId, unitId, addresseeOwnerId, costs: Cents, income: Cents,
                     advancesDue: Cents, balance: Cents }              // denormalisiert für Listen
SettlementComment  { id, settlementId, authorId, text, createdAt }    // Beiratsprüfung
CheckAcknowledgement { id, settlementId, checkId, userId, note, createdAt }
```

Audit-Logging nutzt das vorhandene Muster der Codebasis.

---

## 7. Rechenkern

**Ablage:** eigenes Paket oder Modul ohne Framework-, ORM- oder HTTP-Abhängigkeiten, z. B. `packages/weg-settlement-engine` oder `src/modules/weg-settlement/engine`. M0 entscheidet anhand der Repo-Struktur. Die I/O-Freiheit wird technisch abgesichert (Lint-Regel oder Import-Check im Test).

**Schnittstelle:**

```ts
export const ENGINE_VERSION: string;

export function computeSettlement(input: SettlementInput): SettlementResult;

export function allocate(
  total: Cents,
  weights: ReadonlyArray<{ unitId: string; sortKey: string; weight: Dec }>
): ReadonlyMap<string, Cents>;

export function runChecks(input: SettlementInput, result: SettlementResult): CheckResult[];
```

`SettlementInput` enthält alle Daten aus Kapitel 6 und B6 für ein Objekt und ein Jahr (nur Buchungszeilen mit Status `CONFIRMED` sowie die Sollstellungen und Ausgleiche nach B7), optional das Ergebnis der Vorjahresabrechnung (Anfangsbestände, Vorjahresvergleich) und den Stichtag für die Adressatenbestimmung. Die Eingabe wird intern kanonisch sortiert, damit die Reihenfolge der Arrays das Ergebnis nicht beeinflusst.

**Rechenschritte:**

1. Buchungen des Jahres filtern (Buchungstag im Jahr).
2. Kontenabstimmung (5.12).
3. Gesamtabrechnung aggregieren (5.2).
4. Schlüsselgewichte je Einheit berechnen (5.3).
5. Je Ausgaben-Kostenart verteilen (5.11); Direktbelastungen und Heizkosten (5.5) einsetzen.
6. Einnahmen-Kostenarten verteilen.
7. Soll-Vorschüsse je Einheit aus den Hausgeld-Sollstellungen des Jahres übernehmen (B7.2, Komponente Bewirtschaftung).
8. Abrechnungsspitze je Einheit bilden (5.4).
9. Rücklagenentwicklung (5.6), Sonderumlagen (5.8) und Daten für den Vermögensbericht (5.13) ermitteln.
10. Zusatzausweise nach 5.9 und 5.10 erzeugen.
11. Prüfungen ausführen (8.2).

**Nachvollziehbarkeit:** Jeder Betrag im Ergebnis trägt eine Herkunft, mindestens die Liste der zugrunde liegenden Buchungs-IDs je Kostenart sowie Schlüsselgewicht und exakten Anteil je Einheit.

---

## 8. Ablauf, Status, Prüfungen, Dokumente

### 8.1 Statusmodell

`DRAFT` → `REVIEW` → `FINAL` → `RESOLVED`; jede Version kann durch eine neue Version ersetzt werden (`SUPERSEDED`).

- `DRAFT`: jederzeit neu berechenbar, Ergebnisse sind flüchtig.
- `REVIEW`: Snapshot eingefroren; der Beirat kann lesen und kommentieren.
- `FINAL`: nur möglich, wenn keine blockierende Prüfung offen ist und alle Warnungen quittiert sind. Eingabe, Ergebnis, `engineVersion` und `inputHash` werden unveränderlich gespeichert. PDFs werden ausschließlich aus dem Snapshot erzeugt. Zugleich wird das Jahr in der Buchhaltung gesperrt (B9).
- `RESOLVED`: Beschlussdatum und Fälligkeit werden erfasst, Adressaten festgeschrieben. Die Abrechnungsspitzen werden als Sollstellungen der Art `SETTLEMENT_BALANCE` angelegt (B7.1).

Ändern sich Buchungen eines Jahres, dessen Abrechnung mindestens im Status `REVIEW` ist, zeigt das System über den Hash-Vergleich den Hinweis „Grundlage geändert“. Eine Korrektur erfolgt nur als neue Version. Der Verwalter erstellt und finalisiert; der Beirat liest und kommentiert (F8). Jeder Statuswechsel, jede Quittierung und jeder Export wird protokolliert.

### 8.2 Prüfungen

Schwellenwerte sind konfigurierbar.

| ID | Prüfung | Schwere |
|---|---|---|
| C01 | Kontenabstimmung stimmt nicht (5.12) | blockierend |
| C02 | unbestätigte oder nicht zugeordnete Buchungen im Jahr | blockierend |
| C03 | Ausgaben-/Einnahmen-Kostenart ohne Schlüssel (außer Heizkosten) | blockierend |
| C04 | Beträge auf Schlüssel mit Gesamtgewicht 0 | blockierend |
| C05 | Heizkosten gebucht, aber kein Messdienst-Import | blockierend |
| C06 | Summe Messdienst-Import ≠ Gesamtbetrag und nicht bestätigt | blockierend |
| C07 | Heizkosten-Überleitungsdifferenz ohne Erläuterung | blockierend |
| C08 | Σ Einzelanteile ≠ Gesamtbetrag einer Kostenart (interner Fehler) | blockierend |
| C09 | Direktbelastung auf nicht freigegebener Kostenart | blockierend |
| C10 | Einheit ohne Eigentümer zum Stichtag | blockierend |
| C11 | Anfangsbestand ≠ Endbestand der Vorjahresabrechnung | blockierend |
| C12 | Kostenart weicht um mehr als 20 % und mehr als 100 € vom Vorjahr ab | Warnung |
| C13 | abweichender Schlüssel ohne Beschlussreferenz | Warnung |
| C14 | § 35a-Kategorie ohne Lohnanteil oder Lohnanteil ohne Kategorie | Warnung |
| C15 | Rücklage negativ oder Entnahme ohne Beschlussreferenz | Warnung |
| C16 | Eigentümerwechsel im Jahr (Hinweis auf Adressat und Rückstände) | Hinweis |
| C17 | negative Ausgabe (Gutschrift) in einer Kostenart | Hinweis |

### 8.3 Dokumente und Exporte

Erzeugt werden die Gesamtabrechnung, eine Einzelabrechnung je Einheit mit der Anschrift des Adressaten, der Vermögensbericht mit Rücklagenentwicklung, ein Anschreiben und ein Text für die Beschlussvorlage. Anschreiben und Beschlussvorlage stammen aus pflegbaren Vorlagen und sind nicht hart codiert. Die Dokumente sind als Sammel-PDF und als ZIP mit Einzeldateien verfügbar. Für vermietende Eigentümer gibt es einen CSV/XLSX-Export je Einheit mit Kostenarten, BetrKV-Nummer, Umlagefähigkeit, § 35a-Beträgen und CO2-Kosten. Die PDF-Erzeugung nutzt den vorhandenen Mechanismus der Codebasis.

Die Einzelabrechnung besteht aus einem Kopf (Objekt, Einheit, MEA, Zeitraum, Adressat), einer Kostentabelle (Kostenart, Gesamtbetrag, Schlüssel, Gesamtwert des Schlüssels, Wert der Einheit, Anteil der Einheit), dem hervorgehobenen Ergebnisblock mit K, E, R, V und S sowie dem klar abgesetzten Informationsblock aus 5.4.

---

## 9. KI-Funktionen

Der Rechenkern ist deterministisch. KI unterstützt nur vorgelagert bei der Datenerfassung und nachgelagert bei Texten. Jede KI-Ausgabe wird als Vorschlag gespeichert (`status = 'SUGGESTED'`, `source = 'AI'`, Modellkennung, Konfidenz) und erst durch Bestätigung eines Menschen zu `CONFIRMED`. Der Rechenkern verarbeitet ausschließlich bestätigte Daten; unbestätigte Vorschläge lösen Prüfung C02 aus.

- **K1 Belegerkennung:** Aus einer Rechnung werden Kostenart, BetrKV-Nummer, § 35a-Kategorie, Lohnanteil, Leistungszeitraum und Betrag vorgeschlagen. Die vorhandene Dokumenten-KI der Plattform wird genutzt.
- **K2 Zahlungszuordnung:** beschrieben in Kapitel B8; die KI bildet dort ausschließlich Stufe 3.
- **K3 Erläuterungsentwürfe:** Für Warnungen wie C12 und für die Heizkosten-Überleitung entsteht ein Textentwurf auf Basis aggregierter Ergebnisse, den der Verwalter bearbeitet.
- **K4 (nach dem MVP):** Beantwortung von Eigentümerfragen zur Abrechnung auf Basis des Snapshots.

LLM-Aufrufe laufen ausschließlich über den vorhandenen, DSGVO-konform konfigurierten Zugang. Prompts enthalten nur die jeweils nötigen Daten; für K3 werden keine Eigentümerdaten übermittelt.

---

## 10. Tests

### 10.1 Rechenkern

Property-based Tests (fast-check oder das vorhandene Framework) für `allocate` mit zufälligen Beträgen (inklusive negativ, 0 und 1 Cent) und Gewichten: Σ Anteile = Betrag, Abweichung jedes Anteils unter 1 Cent, Determinismus, Unabhängigkeit von der Eingabereihenfolge. Dazu Unit-Tests für die Beispiele aus 5.11 und für die tagesgenaue Gewichtung inklusive Schaltjahr.

### 10.2 Golden-Tests

Struktur je Szenario: `fixtures/weg-settlement/<szenario>/input.json`, `expected.json` und `README.md` mit dem Sachverhalt. Claude Code darf `input.json` und `README.md` anlegen. `expected.json` stammt ausschließlich aus einer unabhängigen Quelle, also einer manuellen Nachrechnung oder einer anonymisierten realen Abrechnung aus etablierter Verwaltersoftware. Fehlt `expected.json`, wird der Test als ausstehend markiert und nicht selbst befüllt.

Mindestszenarien:

| ID | Sachverhalt |
|---|---|
| S1 | Grundfall: 4 Einheiten, MEA 250/250/300/200, drei Kostenarten nach MEA, eine nach Einheiten |
| S2 | Beträge, die Restcents erzeugen |
| S3 | Eigentümerwechsel zum 01.07. mit Vorschussrückstand beim Veräußerer |
| S4 | Änderung des Wirtschaftsplans zum 01.04. |
| S5 | Heizkosten mit Messdienst-Import, Stellplatz ohne Heizung, Überleitungsdifferenz |
| S6 | Direktbelastung einer Einheit |
| S7 | Rücklagenentnahme für eine Maßnahme mit Beschlussreferenz |
| S8 | Personenschlüssel mit Änderung im Jahr, Schaltjahr |
| S9 | Sonderumlage mit teilweiser Zahlung |

### 10.3 Integration

RLS: Mandant A kann Abrechnungen von Mandant B weder lesen noch erzeugen. Statusübergänge inklusive verbotener Übergänge. Unveränderlichkeit des Snapshots ab `FINAL`. Erneute PDF-Erzeugung aus demselben Snapshot liefert inhaltlich identische Dokumente.

---

## 11. Meilensteine

Reihenfolge: M0, dann Teil I (MB1 bis MB6), dann Teil II (M1 bis M7). Nach jedem Meilenstein Stopp für Review.

| M | Inhalt | Definition of Done |
|---|---|---|
| M0 | Analyse und Plan für beide Teile: Codebasis lesen, Stammdaten (6.2) und Buchhaltungsentitäten (B6) auf Vorhandenes mappen, Lückenanalyse gegen Teil I, Ablageort des Rechenkerns, PDF-Mechanismus, Rollen, RLS-Muster, Test-Setup, offene Fragen | `docs/specs/hausgeldabrechnung-plan.md` liegt vor, kein Produktivcode |
| MB1 | Datenmodell der Buchhaltung und fehlende Stammdaten: Migrationen, RLS, Eröffnungswerte (B7.9), Seed-Daten | Migrationen laufen, RLS-Tests grün |
| MB2 | Bankimport: CAMT.053-Parser (.02 und .08), Kontozuordnung, Sammelbuchungen, Dubletten, Saldenkette, Importprotokoll, CSV-Rückfallebene | Parser-Tests mit echten anonymisierten Dateien grün, Import idempotent |
| MB3 | Sollstellungen und offene Posten: Hausgeld, Sonderumlagen, Planänderung, Eigentümerwechsel, Ausgleich, Kontoblatt-Daten | alle Sollstellungs- und Ausgleichstests aus B12 grün |
| MB4 | Zuordnung Stufe 1 und 2, automatische Bestätigung, Lernfunktion, Rücklastschriften | tabellengetriebene Zuordnungstests grün |
| MB5 | Oberflächen: Import, Klärungsliste, Kontoblatt, Offene-Posten-Liste, Journal, Regelverwaltung, Eröffnungswerte | End-to-End: Import einer Monatsdatei bis zur vollständigen Zuordnung |
| MB6 | Jahressperre und Übergabe an Teil II | Sperre nur bei erfüllten Voraussetzungen (Test), Entsperrung protokolliert |
| M1 | Datenmodell der Abrechnung (Settlement, SettlementUnit, HeatingImport, Kommentare, Quittierungen, Vermögenspositionen), Seed-Daten für S1 | Migrationen laufen, RLS-Tests grün |
| M2 | Rechenkern: 5.1 bis 5.13 ohne UI, Property-Tests, Golden-Tests S1–S9 (soweit `expected.json` vorliegt) | alle Tests grün, I/O-Freiheit technisch abgesichert |
| M3 | Heizkostenimport mit Spalten-Mapping, Prüfungen aus 8.2 | Import einer Beispieldatei, jede Prüfung mit eigenem Test |
| M4 | Services und API, Statusmodell, Snapshot, Versionierung, Audit, Kopplung an die Jahressperre | Statusübergänge getestet, Snapshot ab `FINAL` unveränderlich |
| M5 | Dokumente und Exporte | PDFs für S1 und S5 vom Auftraggeber manuell abgenommen |
| M6 | UI: geführter Ablauf (Jahr wählen, Prüfungen, Vorschau, Review, Finalisieren, Beschluss erfassen) | End-to-End-Durchlauf mit S1 |
| M7 | KI-Funktionen: Stufe 3 der Zuordnung (B8.2), K1 und K3 | Test belegt: Vorschläge fließen nie ohne Bestätigung in Buchhaltung oder Berechnung |

---

## 12. Offene Fachfragen

Diese Fragen entscheidet der Auftraggeber, nicht Claude Code. Bis zur Klärung gilt der jeweils genannte Standard. Fragen zur Buchhaltung stehen in B13.

| ID | Frage | Standard bis zur Klärung |
|---|---|---|
| F1 | Werden aus der Rücklage finanzierte Maßnahmen in der Einzelabrechnung verteilt? | nein, nur in der Rücklagenentwicklung |
| F2 | Werden Sonderumlagen in die Abrechnungsspitze einbezogen? | nein, eigener Abschnitt |
| F3 | Ist bei Eigentümerwechsel eine informative zeitanteilige Aufteilung gewünscht? | nein |
| F4 | Welche Messdienste und Dateiformate zuerst; liefern sie § 35a- und CO2-Daten? | generisches CSV-Mapping |
| F5 | Wann werden Mehrhausanlagen und Kostenstellen umgesetzt? | nach dem MVP |
| F6 | Fälligkeit der Vorschüsse: zum Monatsersten oder abweichend? | Monatserster |
| F7 | Ist-Zuführung zur Rücklage: Standard ist die Rücklagenkomponente der Hausgeldausgleiche (B7.7). Wie wird eine Abweichung zum tatsächlich auf das Rücklagenkonto umgebuchten Betrag behandelt? | Differenz als Abstimmungsposten ausweisen |
| F8 | Gibt es eine Rolle für den Verwaltungsbeirat? | M0 prüft |
| F9 | Wie werden Guthaben behandelt (Auszahlung oder Verrechnung mit künftigen Vorschüssen)? | Auszahlung, Text in Beschlussvorlage pflegbar |

---

## 13. Ergänzung für `CLAUDE.md`

```md
## Module WEG-Buchhaltung und WEG-Jahresabrechnung
- Spezifikation (verbindlich): docs/specs/hausgeldabrechnung-spec.md (Teil I Buchhaltung, Teil II Abrechnung)
- Plan und Fortschritt: docs/specs/hausgeldabrechnung-plan.md
- Geld ausschließlich als Integer-Cent (Typ Cents), niemals Float.
- Bankumsätze sind unveränderlich; Korrekturen nur über Buchungszeilen.
- Rechenkern der Abrechnung ohne I/O, ohne LLM, deterministisch.
- KI-Vorschläge werden nie automatisch bestätigt.
- Fachliche Unklarheit: Frage stellen, nicht selbst entscheiden.
- expected.json in Golden-Fixtures niemals selbst erzeugen oder anpassen.
- Ein Meilenstein pro Sitzung, danach Stopp für Review.
```
