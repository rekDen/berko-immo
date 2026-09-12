# S1 — Grundfall

Spec `scripts/hausgeldabrechnung-spec.md`, Kapitel 10.2, Golden-Szenario S1.

## Sachverhalt

4 Einheiten, MEA 250/250/300/200 (Σ 1000). Drei Ausgaben-Kostenarten nach MEA
(Hausmeister 100,00 €, Versicherung 50,00 €), eine nach Einheiten
(Verwaltervergütung 40,00 €, abweichender Schlüssel mit Beschlussreferenz).
Eine Einnahmen-Kostenart nach MEA (Zinserträge 10,00 €). Keine Heizkosten,
keine Sonderumlagen, kein Eigentümerwechsel, keine Direktbelastung — der
einfachste Fall, auf dem alle anderen S-Szenarien aufbauen.

Soll-Vorschüsse (Bewirtschaftung) je Einheit: 40,00 € / 40,00 € / 50,00 € /
35,00 €. Ein Bankkonto (Bewirtschaftung), Anfangsbestand 1.000,00 €,
Zugänge 200,00 €, Abgänge 190,00 €, bestätigter Saldo 31.12. 1.010,00 €.

## Format

`input.json` folgt `SettlementInput` aus `src/lib/weg-settlement/types.ts`.
Dezimalwerte (`AllocationKeyValueDef.value`) sind hier als plain `number`
kodiert — ein künftiger Loader wandelt sie beim Einlesen in `Decimal` um
(reine JSON-Repräsentation, keine Decimal-Serialisierung).

## Status — `expected.json` ist VORLÄUFIG, nicht unabhängig verifiziert

Harte Regel 0.3.5 verlangt eigentlich, dass `expected.json` aus einer
unabhängigen Nachrechnung oder einer anonymisierten realen Abrechnung stammt,
nicht aus der eigenen Implementierung. Das ist hier **nicht** erfüllt:
`expected.json` wurde von Claude Code von Hand nach den Formeln aus Kapitel
5.2–5.4 nachgerechnet (nicht durch Ausführen der Engine erzeugt), aber vom
Auftraggeber ausdrücklich ohne Prüfung durch eine unabhängige Stelle
freigegeben, um zunächst weiterzukommen („skip formalness for now, revisit
before real customer use", 2026-09-12).

**Bevor dieses Modul für eine echte Abrechnung produktiv eingesetzt wird,
muss `expected.json` durch eine unabhängige Nachrechnung (Auftraggeber,
WEG-Verwalter oder Steuerberater) ersetzt oder bestätigt werden.** Bis dahin
beweist ein grüner Test für S1 nur, dass die Engine ihre eigene Spezifikation
in sich konsistent umsetzt — nicht, dass das Ergebnis fachlich korrekt ist.

Derselbe Vorbehalt gilt für jedes künftige S2–S9-`expected.json`, das auf
dieselbe Weise entsteht.
