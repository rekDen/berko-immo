import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { computeSettlement } from "../engine";
import { runChecks } from "../checks";
import type { SettlementInput } from "../types";

/**
 * WICHTIG: Dies ist ein von Claude Code von Hand nach den Formeln aus Kapitel
 * 5.2/5.3/5.4 nachgerechnetes Beispiel (Struktur angelehnt an Golden-Szenario
 * S1: 4 Einheiten, MEA 250/250/300/200, drei Kostenarten nach MEA + eine nach
 * Einheiten), KEIN Ersatz für den offiziellen Golden-Test-Korpus. Die
 * `expected.json`-Werte für S1–S9 in `fixtures/weg-settlement/` müssen laut
 * harter Regel 0.3.5 unabhängig nachgerechnet oder aus echten Abrechnungen
 * stammen — sie werden hier nicht erzeugt.
 */
function baseInput(): SettlementInput {
  return {
    propertyId: "p1",
    year: 2026,
    units: [
      { id: "a", sortKey: "W01" },
      { id: "b", sortKey: "W02" },
      { id: "c", sortKey: "W03" },
      { id: "d", sortKey: "W04" },
    ],
    allocationKeys: [
      { id: "mea", name: "MEA", type: "co_ownership" },
      { id: "unitcount", name: "Pro Einheit", type: "unit_count" },
    ],
    allocationKeyValues: [
      { keyId: "mea", unitId: "a", value: new Decimal(250), validFrom: "2026-01-01", validTo: null },
      { keyId: "mea", unitId: "b", value: new Decimal(250), validFrom: "2026-01-01", validTo: null },
      { keyId: "mea", unitId: "c", value: new Decimal(300), validFrom: "2026-01-01", validTo: null },
      { keyId: "mea", unitId: "d", value: new Decimal(200), validFrom: "2026-01-01", validTo: null },
      { keyId: "unitcount", unitId: "a", value: new Decimal(1), validFrom: "2026-01-01", validTo: null },
      { keyId: "unitcount", unitId: "b", value: new Decimal(1), validFrom: "2026-01-01", validTo: null },
      { keyId: "unitcount", unitId: "c", value: new Decimal(1), validFrom: "2026-01-01", validTo: null },
      { keyId: "unitcount", unitId: "d", value: new Decimal(1), validFrom: "2026-01-01", validTo: null },
    ],
    costTypes: [
      { id: "hausmeister", name: "Hausmeister", direction: "expense", allocationKeyId: "mea", isHeating: false, allowsDirectCharge: false, apportionable: true, betrkvNo: 14, resolutionRef: null },
      { id: "versicherung", name: "Versicherung", direction: "expense", allocationKeyId: "mea", isHeating: false, allowsDirectCharge: false, apportionable: true, betrkvNo: 13, resolutionRef: null },
      { id: "verwaltung", name: "Verwaltervergütung", direction: "expense", allocationKeyId: "unitcount", isHeating: false, allowsDirectCharge: false, apportionable: false, betrkvNo: null, resolutionRef: "Beschluss ETV 2025-11-15 TOP 4" },
      { id: "zinsen", name: "Zinserträge", direction: "income", allocationKeyId: "mea", isHeating: false, allowsDirectCharge: false, apportionable: false, betrkvNo: null, resolutionRef: null },
    ],
    costBookings: [
      { id: "bk-hm", costTypeId: "hausmeister", amount: 10000 },
      { id: "bk-vs", costTypeId: "versicherung", amount: 5000 },
      { id: "bk-vw", costTypeId: "verwaltung", amount: 4000 },
      { id: "bk-zi", costTypeId: "zinsen", amount: 1000 },
    ],
    heatingAllocations: [],
    advances: [
      { unitId: "a", operatingCents: 4000, reserveCents: 0 },
      { unitId: "b", operatingCents: 4000, reserveCents: 0 },
      { unitId: "c", operatingCents: 5000, reserveCents: 0 },
      { unitId: "d", operatingCents: 3500, reserveCents: 0 },
    ],
    advancePaymentsIst: 16500,
    specialLevyPaymentsIst: 0,
    internalTransfersNet: 0,
    priorYearSettlementPayments: 0,
    bankAccounts: [
      { id: "bank-op", kind: "operating", openingBalance: 100000, totalIn: 20000, totalOut: 19000, confirmedClosingBalance: 101000 },
    ],
    priorYearClosings: [],
    reserveDevelopments: [],
    specialLevies: [],
    ownerReceivablesOpen: [],
    assetItems: [],
    liabilityItems: [],
  };
}

describe("computeSettlement — Grundfall (S1-artig)", () => {
  it("verteilt jede Kostenart korrekt und bildet K/E/R/V/S je Einheit", () => {
    const result = computeSettlement(baseInput());

    const byUnit = new Map(result.units.map((u) => [u.unitId, u]));
    expect(byUnit.get("a")).toMatchObject({ costs: 4750, income: 250, result: 4500, advancesSoll: 4000, balance: 500 });
    expect(byUnit.get("b")).toMatchObject({ costs: 4750, income: 250, result: 4500, advancesSoll: 4000, balance: 500 });
    expect(byUnit.get("c")).toMatchObject({ costs: 5500, income: 300, result: 5200, advancesSoll: 5000, balance: 200 });
    expect(byUnit.get("d")).toMatchObject({ costs: 4000, income: 200, result: 3800, advancesSoll: 3500, balance: 300 });
  });

  it("liefert Schlüsselgewicht je Einheit und Gesamtgewicht je Kostenart (Nachvollziehbarkeit)", () => {
    const result = computeSettlement(baseInput());
    const hausmeister = result.costTypeBreakdowns.find((b) => b.costTypeId === "hausmeister")!;
    expect(hausmeister.keyTotalWeight?.toNumber()).toBe(1000);
    expect(hausmeister.perUnit.find((p) => p.unitId === "c")!.weight?.toNumber()).toBe(300);

    const verwaltung = result.costTypeBreakdowns.find((b) => b.costTypeId === "verwaltung")!;
    expect(verwaltung.keyTotalWeight?.toNumber()).toBe(4);
  });

  it("Σ K über alle Einheiten entspricht der Summe aller Ausgaben-Kostenarten", () => {
    const result = computeSettlement(baseInput());
    const totalK = result.units.reduce((s, u) => s + u.costs, 0);
    expect(totalK).toBe(10000 + 5000 + 4000);
  });

  it("gruppiert umlagefähige Kosten nach BetrKV-Nummer im Infoblock (5.10)", () => {
    const result = computeSettlement(baseInput());
    const a = result.units.find((u) => u.unitId === "a")!;
    expect(a.info.apportionable).toEqual(expect.arrayContaining([
      { betrkvNo: 14, amount: 2500 },
      { betrkvNo: 13, amount: 1250 },
    ]));
    expect(a.info.nonApportionable).toBe(1000); // Verwaltervergütung
  });

  it("Kontenabstimmung stimmt bei konsistenten Eingaben (5.12)", () => {
    const result = computeSettlement(baseInput());
    expect(result.bankReconciliations[0].matches).toBe(true);
    expect(result.bankReconciliations[0].computedClosing).toBe(101000);
  });

  it("liefert keine Prüfungsbefunde bei sauberen Eingaben", () => {
    const input = baseInput();
    const result = computeSettlement(input);
    expect(runChecks(input, result)).toEqual([]);
  });

  it("ist deterministisch (gleiche Eingabe -> identisches Ergebnis)", () => {
    const input = baseInput();
    const r1 = computeSettlement(input);
    const r2 = computeSettlement(input);
    expect(r1).toEqual(r2);
  });
});

describe("computeSettlement — Direktbelastung (S6-artig)", () => {
  it("addiert eine Direktbelastung zu 100% zur genannten Einheit", () => {
    const input = baseInput();
    input.costTypes = input.costTypes.map((c) => (c.id === "hausmeister" ? { ...c, allowsDirectCharge: true } : c));
    input.costBookings.push({ id: "bk-direct", costTypeId: "hausmeister", amount: 2000, directUnitId: "a" });

    const result = computeSettlement(input);
    const a = result.units.find((u) => u.unitId === "a")!;
    // ursprünglich 2500 (Anteil an 10000) + 2000 direkt = 4500 nur für Hausmeister,
    // + 1250 (Versicherung) + 1000 (Verwaltung) = 6750
    expect(a.costs).toBe(2500 + 2000 + 1250 + 1000);
  });
});

describe("runChecks — Fehlerfälle", () => {
  it("C03: Kostenart ohne Schlüssel", () => {
    const input = baseInput();
    input.costTypes = input.costTypes.map((c) => (c.id === "hausmeister" ? { ...c, allocationKeyId: null } : c));
    const result = computeSettlement(input);
    const checks = runChecks(input, result);
    expect(checks.some((c) => c.id === "C03")).toBe(true);
  });

  it("C04: Schlüssel mit Gesamtgewicht 0 bei Betrag != 0", () => {
    const input = baseInput();
    input.allocationKeyValues = input.allocationKeyValues.filter((v) => v.keyId !== "unitcount");
    const result = computeSettlement(input);
    const checks = runChecks(input, result);
    expect(checks.some((c) => c.id === "C04")).toBe(true);
  });

  it("C01: fehlender Kontoauszugssaldo blockiert", () => {
    const input = baseInput();
    input.bankAccounts[0].confirmedClosingBalance = null;
    const result = computeSettlement(input);
    const checks = runChecks(input, result);
    expect(checks.some((c) => c.id === "C01" && c.severity === "blocking")).toBe(true);
  });

  it("C09: Direktbelastung auf nicht freigegebener Kostenart", () => {
    const input = baseInput();
    input.costBookings.push({ id: "bk-direct", costTypeId: "hausmeister", amount: 500, directUnitId: "a" });
    const result = computeSettlement(input); // allowsDirectCharge bleibt false
    const checks = runChecks(input, result);
    expect(checks.some((c) => c.id === "C09")).toBe(true);
  });

  it("C17: negative Ausgabe wird als Hinweis gemeldet, nicht blockierend", () => {
    const input = baseInput();
    input.costBookings.push({ id: "bk-credit", costTypeId: "hausmeister", amount: -300 });
    const result = computeSettlement(input);
    const checks = runChecks(input, result);
    const c17 = checks.find((c) => c.id === "C17");
    expect(c17).toBeDefined();
    expect(c17!.severity).toBe("info");
  });

  it("C13: abweichender Schlüssel ohne Beschlussreferenz", () => {
    const input = baseInput();
    input.costTypes = input.costTypes.map((c) => (c.id === "verwaltung" ? { ...c, resolutionRef: null } : c));
    const result = computeSettlement(input);
    const checks = runChecks(input, result);
    expect(checks.some((c) => c.id === "C13" && c.severity === "warning")).toBe(true);
  });

  it("C06/C07 feuern bei Heizkosten-Abweichung, C08 (interner Fehler) NICHT — Regressionstest", () => {
    // Gefunden bei der M3-Live-Verifikation: total (Messdienst) und Σ perUnit
    // (Zeilensumme) dürfen sich bei Heizkosten bewusst unterscheiden — das ist
    // exakt der Fall, den C06 abdeckt, kein interner Bug (C08).
    const input = baseInput();
    input.costTypes.push({
      id: "heizung", name: "Heizung", direction: "expense", allocationKeyId: null,
      isHeating: true, allowsDirectCharge: false, apportionable: true, betrkvNo: 4, resolutionRef: null,
    });
    input.costBookings.push({ id: "bk-heizung", costTypeId: "heizung", amount: 96000 });
    input.heatingAllocations.push({
      costTypeId: "heizung",
      totalAmount: 97500,
      perUnit: [
        { unitId: "a", heating: 10000, hotWater: 2500 },
        { unitId: "b", heating: 9000, hotWater: 2000 },
        { unitId: "c", heating: 12000, hotWater: 3000 },
        { unitId: "d", heating: 9500, hotWater: 2200 },
      ], // Σ = 97300, weicht bewusst von totalAmount (97500) ab
      confirmedRoundingDifference: null,
      reconciliationNote: null,
    });

    const result = computeSettlement(input);
    const checks = runChecks(input, result);
    expect(checks.some((c) => c.id === "C06")).toBe(true);
    expect(checks.some((c) => c.id === "C07")).toBe(true);
    expect(checks.some((c) => c.id === "C08")).toBe(false);
  });
});
