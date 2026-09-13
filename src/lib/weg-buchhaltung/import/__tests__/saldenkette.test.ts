import { describe, expect, it } from "vitest";
import { checkSaldenkette } from "../saldenkette";

describe("checkSaldenkette", () => {
  it("meldet keine Warnung, wenn Anfangssaldo dem Schlusssaldo des Vorauszugs entspricht", () => {
    const warnings = checkSaldenkette({
      previousClosingBalance: 10000,
      statementOpeningBalance: 10000,
      statementClosingBalance: 10000,
      entryAmounts: [],
    });
    expect(warnings).toHaveLength(0);
  });

  it("meldet BC01, wenn Anfangssaldo vom Schlusssaldo des Vorauszugs abweicht", () => {
    const warnings = checkSaldenkette({
      previousClosingBalance: 10000,
      statementOpeningBalance: 9000,
      statementClosingBalance: 9000,
      entryAmounts: [],
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ code: "BC01", expected: 10000, actual: 9000 });
  });

  it("meldet keine Warnung, wenn Anfangssaldo + Umsätze den Schlusssaldo ergibt", () => {
    const warnings = checkSaldenkette({
      previousClosingBalance: null,
      statementOpeningBalance: 10000,
      statementClosingBalance: 8500,
      entryAmounts: [-2000, 500],
    });
    expect(warnings).toHaveLength(0);
  });

  it("meldet BC01, wenn Anfangssaldo + Umsätze nicht den Schlusssaldo ergibt", () => {
    const warnings = checkSaldenkette({
      previousClosingBalance: null,
      statementOpeningBalance: 10000,
      statementClosingBalance: 9000,
      entryAmounts: [-500],
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ expected: 9500, actual: 9000 });
  });

  it("löst keine Warnung aus, wenn benötigte Salden fehlen (z. B. CSV ohne Saldenangabe)", () => {
    const warnings = checkSaldenkette({
      previousClosingBalance: null,
      statementOpeningBalance: null,
      statementClosingBalance: null,
      entryAmounts: [-500, 1000],
    });
    expect(warnings).toHaveLength(0);
  });
});
