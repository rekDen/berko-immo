import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { computeKeyWeights } from "../weights";
import type { AllocationKeyValueDef, EngineUnit } from "../types";

const units: EngineUnit[] = [{ id: "a", sortKey: "W01" }, { id: "b", sortKey: "W02" }];

function v(keyId: string, unitId: string, value: number, validFrom: string, validTo: string | null): AllocationKeyValueDef {
  return { keyId, unitId, value: new Decimal(value), validFrom, validTo };
}

describe("computeKeyWeights", () => {
  it("gibt das volle Jahresgewicht für einen ganzjährig gültigen Wert", () => {
    const values = [v("k1", "a", 125.5, "2026-01-01", null), v("k1", "b", 104, "2026-01-01", null)];
    const weights = computeKeyWeights(units, values, "k1", 2026);
    expect(weights.get("a")!.toNumber()).toBe(125.5);
    expect(weights.get("b")!.toNumber()).toBe(104);
  });

  it("gewichtet nach Gültigkeitstagen bei unterjähriger Änderung (5.3.2)", () => {
    // 2026 ist kein Schaltjahr (365 Tage). Wert 100 vom 01.01.-30.06. (181 Tage),
    // Wert 200 vom 01.07.-31.12. (184 Tage).
    const values = [
      v("k1", "a", 100, "2026-01-01", "2026-06-30"),
      v("k1", "a", 200, "2026-07-01", "2026-12-31"),
    ];
    const weights = computeKeyWeights(units, values, "k1", 2026);
    const expected = (100 * 181 + 200 * 184) / 365;
    expect(weights.get("a")!.toNumber()).toBeCloseTo(expected, 10);
  });

  it("berücksichtigt das Schaltjahr korrekt (366 Tage, S8)", () => {
    const values = [v("k1", "a", 1, "2028-01-01", null)]; // 2028 ist Schaltjahr
    const weights = computeKeyWeights(units, values, "k1", 2028);
    expect(weights.get("a")!.toNumber()).toBe(1);
  });

  it("Einheiten ohne Schlüsselwert erhalten Gewicht 0 (5.3.3)", () => {
    const values = [v("k1", "a", 100, "2026-01-01", null)];
    const weights = computeKeyWeights(units, values, "k1", 2026);
    expect(weights.get("b")!.toNumber()).toBe(0);
  });

  it("ignoriert Werte außerhalb des Jahres", () => {
    const values = [v("k1", "a", 100, "2025-01-01", "2025-12-31")];
    const weights = computeKeyWeights(units, values, "k1", 2026);
    expect(weights.get("a")!.toNumber()).toBe(0);
  });

  it("ignoriert Werte anderer Schlüssel", () => {
    const values = [v("other-key", "a", 999, "2026-01-01", null)];
    const weights = computeKeyWeights(units, values, "k1", 2026);
    expect(weights.get("a")!.toNumber()).toBe(0);
  });
});
