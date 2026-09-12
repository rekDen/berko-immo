import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { allocate } from "../allocation";
import { ENGINE_VERSION } from "../types";

describe("Determinismus (Spec 0.3.2 / 10.1)", () => {
  it("allocate() liefert bei zweimaligem Aufruf mit identischer Eingabe ein byte-identisches Ergebnis", () => {
    const weights = [
      { unitId: "a", sortKey: "W01", weight: new Decimal(125.5) },
      { unitId: "b", sortKey: "W02", weight: new Decimal(104) },
      { unitId: "c", sortKey: "W03", weight: new Decimal(147) },
    ];
    const a = allocate(987654, weights);
    const b = allocate(987654, weights);
    expect([...a.entries()]).toEqual([...b.entries()]);
  });

  it("ENGINE_VERSION ist ein nicht-leerer String", () => {
    expect(typeof ENGINE_VERSION).toBe("string");
    expect(ENGINE_VERSION.length).toBeGreaterThan(0);
  });
});
