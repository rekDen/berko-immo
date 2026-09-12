import type { CheckResult, SettlementInput, SettlementResult } from "./types";

/**
 * Prüfungen nach Kapitel 8.2. Implementiert ist die Teilmenge, die aus
 * `SettlementInput`/`SettlementResult` allein entscheidbar ist:
 *
 *   C01, C03, C04, C05, C06, C07, C08, C09, C11, C13, C14, C15, C17
 *
 * Bewusst NICHT implementiert (fehlende Eingabedaten in diesem Meilenstein,
 * s. hausgeldabrechnung-plan.md Abschnitt 9):
 *   - C02 (unbestätigte/nicht zugeordnete Buchungen): `SettlementInput`
 *     enthält per Vertrag bereits nur bestätigte Buchungen des Jahres — das
 *     sicherzustellen ist Aufgabe der I/O-Brücke (server-load.ts, M4), nicht
 *     des reinen Rechenkerns.
 *   - C10 (Einheit ohne Eigentümer zum Stichtag), C16 (Eigentümerwechsel im
 *     Jahr): erfordern `Ownership`-Zeiträume, die noch nicht Teil von
 *     `SettlementInput` sind.
 *   - C12 (Kostenart weicht > 20% / > 100€ vom Vorjahr ab): erfordert eine
 *     Vorjahres-Kostenart-Historie, die noch nicht Teil von `SettlementInput` ist.
 */
export function runChecks(input: SettlementInput, result: SettlementResult): CheckResult[] {
  const checks: CheckResult[] = [];
  const costTypeById = new Map(input.costTypes.map((c) => [c.id, c]));
  const keyById = new Map(input.allocationKeys.map((k) => [k.id, k]));

  // C01 — Kontenabstimmung stimmt nicht (5.12)
  for (const rec of result.bankReconciliations) {
    if (rec.confirmedClosing === null) {
      checks.push({
        id: "C01", severity: "blocking",
        message: `Konto ${rec.bankAccountId}: kein bestätigter Kontoauszugssaldo zum 31.12. erfasst`,
        context: { bankAccountId: rec.bankAccountId },
      });
    } else if (!rec.matches) {
      checks.push({
        id: "C01", severity: "blocking",
        message: `Konto ${rec.bankAccountId}: berechneter Endbestand (${rec.computedClosing}) weicht vom bestätigten Saldo (${rec.confirmedClosing}) ab`,
        context: { bankAccountId: rec.bankAccountId, computedClosing: rec.computedClosing, confirmedClosing: rec.confirmedClosing },
      });
    }
  }

  // C03 — Ausgaben-/Einnahmen-Kostenart ohne Schlüssel (außer Heizkosten)
  for (const costType of input.costTypes) {
    if (!costType.isHeating && !costType.allocationKeyId) {
      checks.push({
        id: "C03", severity: "blocking",
        message: `Kostenart „${costType.name}" hat keinen Verteilerschlüssel`,
        context: { costTypeId: costType.id },
      });
    }
  }

  // C04 — Beträge auf Schlüssel mit Gesamtgewicht 0
  for (const breakdown of result.costTypeBreakdowns) {
    if (breakdown.blockedZeroWeight) {
      checks.push({
        id: "C04", severity: "blocking",
        message: `Kostenart ${breakdown.costTypeId}: Verteilerschlüssel hat Gesamtgewicht 0, aber der zu verteilende Betrag ist ungleich 0`,
        context: { costTypeId: breakdown.costTypeId },
      });
    }
  }

  // C05/C06/C07 — Heizkosten
  const heatingCostTypeIds = new Set(input.costTypes.filter((c) => c.isHeating).map((c) => c.id));
  const heatingImportedIds = new Set(input.heatingAllocations.map((h) => h.costTypeId));
  for (const id of heatingCostTypeIds) {
    const hasBookings = input.costBookings.some((b) => b.costTypeId === id);
    if (hasBookings && !heatingImportedIds.has(id)) {
      checks.push({ id: "C05", severity: "blocking", message: `Heizkosten (Kostenart ${id}) gebucht, aber kein Messdienst-Import vorhanden`, context: { costTypeId: id } });
    }
  }
  for (const rec of result.heatingReconciliations) {
    const source = input.heatingAllocations.find((h) => h.costTypeId === rec.costTypeId);
    const confirmed = source?.confirmedRoundingDifference ?? null;
    if (rec.perUnitSumMismatch !== 0 && rec.perUnitSumMismatch !== confirmed) {
      checks.push({
        id: "C06", severity: "blocking",
        message: `Heizkosten ${rec.costTypeId}: Σ Einheitenbeträge weicht vom Messdienst-Gesamtbetrag ab (${rec.perUnitSumMismatch} Cent) und ist nicht als Rundungsdifferenz bestätigt`,
        context: { costTypeId: rec.costTypeId, mismatch: rec.perUnitSumMismatch },
      });
    }
    if (rec.difference !== 0 && !source?.reconciliationNote) {
      checks.push({
        id: "C07", severity: "blocking",
        message: `Heizkosten ${rec.costTypeId}: Überleitungsdifferenz zwischen gezahlten Heizkosten und Messdienst-Betrag (${rec.difference} Cent) ohne Erläuterungstext`,
        context: { costTypeId: rec.costTypeId, difference: rec.difference },
      });
    }
  }

  // C08 — Σ Einzelanteile ≠ Gesamtbetrag einer Kostenart (interner Fehler)
  // Gilt nur für normal per allocate() verteilte Kostenarten: dort hält die
  // Gleichheit durch allocate()s eigene Invariante immer, ein Verstoß wäre ein
  // echter interner Bug. Bei Heizkosten ist `total` bewusst der Messdienst-
  // Gesamtbetrag, während `perUnit` die Zeilensumme ist — eine Abweichung
  // dort ist keine Buggy-Situation, sondern bereits über C06 abgedeckt.
  for (const breakdown of result.costTypeBreakdowns) {
    if (breakdown.blockedZeroWeight) continue; // hier ist per C04 bereits klar, dass nichts verteilt wurde
    if (costTypeById.get(breakdown.costTypeId)?.isHeating) continue;
    const sum = breakdown.perUnit.reduce((s, p) => s + p.amount, 0);
    if (sum !== breakdown.total) {
      checks.push({
        id: "C08", severity: "blocking",
        message: `Kostenart ${breakdown.costTypeId}: Summe der Einzelanteile (${sum}) weicht vom Gesamtbetrag (${breakdown.total}) ab — interner Fehler`,
        context: { costTypeId: breakdown.costTypeId, sum, total: breakdown.total },
      });
    }
  }

  // C09 — Direktbelastung auf nicht freigegebener Kostenart
  for (const breakdown of result.costTypeBreakdowns) {
    for (const bookingId of breakdown.directChargeErrors) {
      checks.push({
        id: "C09", severity: "blocking",
        message: `Buchung ${bookingId}: Direktbelastung auf Kostenart ${breakdown.costTypeId}, die das nicht zulässt`,
        context: { costTypeId: breakdown.costTypeId, bookingId },
      });
    }
  }

  // C11 — Anfangsbestand ≠ Endbestand der Vorjahresabrechnung
  const priorClosingByAccount = new Map(input.priorYearClosings.map((p) => [p.bankAccountId, p.closingBalance]));
  for (const bank of input.bankAccounts) {
    const priorClosing = priorClosingByAccount.get(bank.id);
    if (priorClosing !== undefined && priorClosing !== bank.openingBalance) {
      checks.push({
        id: "C11", severity: "blocking",
        message: `Konto ${bank.id}: Anfangsbestand (${bank.openingBalance}) entspricht nicht dem Endbestand der Vorjahresabrechnung (${priorClosing})`,
        context: { bankAccountId: bank.id, openingBalance: bank.openingBalance, priorClosing },
      });
    }
  }

  // C13 — abweichender Schlüssel ohne Beschlussreferenz
  for (const costType of input.costTypes) {
    if (costType.isHeating || !costType.allocationKeyId) continue;
    const key = keyById.get(costType.allocationKeyId);
    if (key && key.type !== "co_ownership" && !costType.resolutionRef) {
      checks.push({
        id: "C13", severity: "warning",
        message: `Kostenart „${costType.name}" nutzt einen abweichenden Schlüssel (${key.type}) ohne Beschluss-/Vereinbarungsreferenz`,
        context: { costTypeId: costType.id, allocationKeyType: key.type },
      });
    }
  }

  // C14 — § 35a-Kategorie ohne Lohnanteil oder Lohnanteil ohne Kategorie
  for (const booking of input.costBookings) {
    const hasLabor = (booking.laborAmount ?? 0) > 0;
    const hasCategory = booking.par35aCategory !== undefined;
    if (hasLabor !== hasCategory) {
      checks.push({
        id: "C14", severity: "warning",
        message: hasLabor
          ? `Buchung ${booking.id}: Lohnanteil ohne § 35a-Kategorie`
          : `Buchung ${booking.id}: § 35a-Kategorie ohne Lohnanteil`,
        context: { bookingId: booking.id },
      });
    }
  }

  // C15 — Rücklage negativ oder Entnahme ohne Beschlussreferenz
  for (const rd of result.reserveDevelopments) {
    if (rd.computedClosing < 0) {
      checks.push({ id: "C15", severity: "warning", message: `Rücklagenkonto ${rd.bankAccountId}: berechneter Bestand ist negativ`, context: { bankAccountId: rd.bankAccountId } });
    }
  }
  for (const rd of input.reserveDevelopments) {
    for (const entnahme of rd.entnahmen) {
      if (!entnahme.resolutionRef) {
        checks.push({ id: "C15", severity: "warning", message: `Rücklagenkonto ${rd.bankAccountId}: Entnahme ohne Beschlussreferenz`, context: { bankAccountId: rd.bankAccountId, amount: entnahme.amount } });
      }
    }
  }

  // C17 — negative Ausgabe (Gutschrift) in einer Kostenart
  for (const booking of input.costBookings) {
    const costType = costTypeById.get(booking.costTypeId);
    if (costType?.direction === "expense" && booking.amount < 0) {
      checks.push({
        id: "C17", severity: "info",
        message: `Buchung ${booking.id}: negative Ausgabe (Gutschrift) in Kostenart „${costType.name}"`,
        context: { bookingId: booking.id, costTypeId: costType.id, amount: booking.amount },
      });
    }
  }

  return checks;
}
