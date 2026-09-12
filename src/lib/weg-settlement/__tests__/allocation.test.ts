import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { allocate, naturalCompare, type AllocationWeight } from "../allocation";

function w(unitId: string, sortKey: string, weight: number): AllocationWeight {
  return { unitId, sortKey, weight: new Decimal(weight) };
}

describe("allocate — Beispiele aus Spec 5.11", () => {
  it("100,00 € bei MEA 250/250/300/200 -> 25,00/25,00/30,00/20,00", () => {
    const weights = [w("a", "1", 250), w("b", "2", 250), w("c", "3", 300), w("d", "4", 200)];
    const result = allocate(10000, weights);
    expect(result.get("a")).toBe(2500);
    expect(result.get("b")).toBe(2500);
    expect(result.get("c")).toBe(3000);
    expect(result.get("d")).toBe(2000);
  });

  it("100,00 € bei 1/1/1 -> 33,34/33,33/33,33", () => {
    const weights = [w("a", "1", 1), w("b", "2", 1), w("c", "3", 1)];
    const result = allocate(10000, weights);
    expect(result.get("a")).toBe(3334);
    expect(result.get("b")).toBe(3333);
    expect(result.get("c")).toBe(3333);
  });

  it("0,02 € bei 1/1/1 -> 0,01/0,01/0,00", () => {
    const weights = [w("a", "1", 1), w("b", "2", 1), w("c", "3", 1)];
    const result = allocate(2, weights);
    expect(result.get("a")).toBe(1);
    expect(result.get("b")).toBe(1);
    expect(result.get("c")).toBe(0);
  });

  it("-100,00 € bei 1/1/1 -> -33,34/-33,33/-33,33", () => {
    const weights = [w("a", "1", 1), w("b", "2", 1), w("c", "3", 1)];
    const result = allocate(-10000, weights);
    expect(result.get("a")).toBe(-3334);
    expect(result.get("b")).toBe(-3333);
    expect(result.get("c")).toBe(-3333);
  });
});

describe("allocate — Invarianten und Randfälle", () => {
  it("Σ Anteile = Betrag exakt (auch bei krummen Gewichten)", () => {
    const weights = [w("a", "1", 125.5), w("b", "2", 104), w("c", "3", 147), w("d", "4", 129.5), w("e", "5", 125.5), w("f", "6", 104), w("g", "7", 114.5), w("h", "8", 130)];
    const result = allocate(123456, weights);
    const sum = [...result.values()].reduce((s, v) => s + v, 0);
    expect(sum).toBe(123456);
  });

  it("jeder Anteil weicht um weniger als 1 Cent vom exakten Anteil ab", () => {
    const weights = [w("a", "1", 3), w("b", "2", 7), w("c", "3", 1)];
    const total = 1000;
    const sumWeights = 11;
    const result = allocate(total, weights);
    for (const wt of weights) {
      const exact = (total * wt.weight.toNumber()) / sumWeights;
      const got = result.get(wt.unitId)!;
      expect(Math.abs(got - exact)).toBeLessThan(1);
    }
  });

  it("ist deterministisch (gleiche Eingabe -> identische Ausgabe)", () => {
    const weights = [w("a", "1", 3), w("b", "2", 7), w("c", "3", 1)];
    const r1 = allocate(1000, weights);
    const r2 = allocate(1000, weights);
    expect([...r1.entries()]).toEqual([...r2.entries()]);
  });

  it("ist unabhängig von der Reihenfolge der Eingabe-Gewichte", () => {
    const weights = [w("a", "1", 3), w("b", "2", 7), w("c", "3", 1)];
    const shuffled = [weights[2], weights[0], weights[1]];
    const r1 = allocate(1000, weights);
    const r2 = allocate(1000, shuffled);
    expect(new Map([...r2.entries()].sort())).toEqual(new Map([...r1.entries()].sort()));
  });

  it("bei Gleichstand der Nachkommareste gewinnt der kleinere (natürlich sortierte) Sortierschlüssel", () => {
    // 3 gleiche Gewichte, sortKeys bewusst nicht alphabetisch: "W2" vor "W10"
    const weights = [w("ten", "W10", 1), w("two", "W2", 1), w("one", "W1", 1)];
    const result = allocate(2, weights); // 2 Cent auf 3 gleiche Gewichte -> 2 Einheiten je +1
    expect(result.get("one")).toBe(1);
    expect(result.get("two")).toBe(1);
    expect(result.get("ten")).toBe(0);
  });

  it("total = 0 ergibt 0 für jede Einheit, unabhängig vom Gewicht", () => {
    const weights = [w("a", "1", 5), w("b", "2", 0)];
    const result = allocate(0, weights);
    expect(result.get("a")).toBe(0);
    expect(result.get("b")).toBe(0);
  });

  it("leere Gewichtsliste ergibt eine leere Map", () => {
    expect(allocate(1000, []).size).toBe(0);
  });

  it("wirft bei Gewichtssumme 0 und Betrag ungleich 0 (Spec 5.3.3)", () => {
    const weights = [w("a", "1", 0), w("b", "2", 0)];
    expect(() => allocate(100, weights)).toThrow(/Summe der Gewichte ist 0/);
  });

  it("wirft bei nicht-ganzzahligem Betrag", () => {
    expect(() => allocate(10.5, [w("a", "1", 1)])).toThrow(/ganzzahliger Cent-Betrag/);
  });

  it("property-based: viele zufällige, aber deterministisch geseedete Fälle erfüllen beide Invarianten", () => {
    // Einfacher seeded PRNG (mulberry32) statt einer externen Property-Test-
    // Bibliothek (keine vorhanden, siehe hausgeldabrechnung-plan.md Abschnitt 6) —
    // deterministisch reproduzierbar, kein Math.random().
    function mulberry32(seed: number) {
      let a = seed;
      return () => {
        a |= 0; a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    const rand = mulberry32(42);

    for (let trial = 0; trial < 200; trial++) {
      const n = 1 + Math.floor(rand() * 8);
      const weights: AllocationWeight[] = [];
      let sumWeights = 0;
      for (let i = 0; i < n; i++) {
        const weight = Math.floor(rand() * 300);
        sumWeights += weight;
        weights.push(w(`u${i}`, `U${i}`, weight));
      }
      if (sumWeights === 0) continue; // ausgeschlossener Fall, s. eigener Test oben

      const total = Math.floor(rand() * 200001) - 100000; // inkl. negativ und 0

      const result = allocate(total, weights);
      const sum = [...result.values()].reduce((s, v) => s + v, 0);
      expect(sum).toBe(total);

      for (const wt of weights) {
        const exact = (total * wt.weight.toNumber()) / sumWeights;
        const got = result.get(wt.unitId)!;
        expect(Math.abs(got - exact)).toBeLessThan(1);
      }
    }
  });
});

describe("naturalCompare", () => {
  it("sortiert numerisch statt lexikographisch", () => {
    expect(["W10", "W2", "W1"].sort(naturalCompare)).toEqual(["W1", "W2", "W10"]);
  });

  it("ist stabil für identische Strings", () => {
    expect(naturalCompare("W1", "W1")).toBe(0);
  });
});
