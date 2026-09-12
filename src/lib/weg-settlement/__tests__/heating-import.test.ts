import { describe, it, expect } from "vitest";
import { parseHeatingRows } from "../heating-import";

describe("parseHeatingRows", () => {
  it("erkennt Spalten case-insensitiv und parst Cent-Beträge", () => {
    const result = parseHeatingRows([
      { Einheit: "W01", Heizung: "100,00", Warmwasser: "20,00" },
      { Einheit: "W02", Heizung: "50,00", Warmwasser: "10,00" },
    ]);
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      { unitLabel: "W01", heating: 10000, hotWater: 2000, co2Cost: undefined, co2LandlordSharePct: undefined, laborAmount: undefined },
      { unitLabel: "W02", heating: 5000, hotWater: 1000, co2Cost: undefined, co2LandlordSharePct: undefined, laborAmount: undefined },
    ]);
    expect(result.total).toBe(18000);
  });

  it("akzeptiert alternative Spaltennamen (englisch, mit Unterstrich)", () => {
    const result = parseHeatingRows([{ unit_number: "W01", heating: "10.00", hot_water: "2.00" }]);
    expect(result.errors).toEqual([]);
    expect(result.rows[0].heating).toBe(1000);
  });

  it("verarbeitet numerische Zellen aus XLSX direkt (kein String)", () => {
    const result = parseHeatingRows([{ Einheit: "W01", Heizung: 123.45, Warmwasser: 6.5 }]);
    expect(result.errors).toEqual([]);
    expect(result.rows[0].heating).toBe(12345);
    expect(result.rows[0].hotWater).toBe(650);
  });

  it("meldet fehlende Pflichtspalten ohne Zeilen zu verarbeiten", () => {
    const result = parseHeatingRows([{ Foo: "bar" }]);
    expect(result.rows).toEqual([]);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("meldet Zeilen mit fehlender Einheit, verarbeitet den Rest trotzdem", () => {
    const result = parseHeatingRows([
      { Einheit: "", Heizung: "10,00", Warmwasser: "0,00" },
      { Einheit: "W02", Heizung: "10,00", Warmwasser: "0,00" },
    ]);
    expect(result.errors).toEqual(["Zeile 2: Einheit fehlt"]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].unitLabel).toBe("W02");
  });

  it("optionale Spalten (CO2, Vermieteranteil, Lohnanteil) werden korrekt übernommen", () => {
    const result = parseHeatingRows([
      { Einheit: "W01", Heizung: "100,00", Warmwasser: "0,00", CO2: "5,00", Vermieteranteil: "50", Lohnanteil: "20,00" },
    ]);
    expect(result.rows[0].co2Cost).toBe(500);
    expect(result.rows[0].co2LandlordSharePct?.toNumber()).toBe(50);
    expect(result.rows[0].laborAmount).toBe(2000);
  });

  it("meldet ungültige Beträge zeilenweise, ohne die restliche Datei abzubrechen", () => {
    const result = parseHeatingRows([
      { Einheit: "W01", Heizung: "nicht-numerisch", Warmwasser: "0,00" },
      { Einheit: "W02", Heizung: "10,00", Warmwasser: "0,00" },
    ]);
    expect(result.errors).toEqual(["Zeile 2: Ungültiger Betrag: nicht-numerisch"]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].unitLabel).toBe("W02");
  });

  it("liefert eine Fehlermeldung bei leerer Datei", () => {
    const result = parseHeatingRows([]);
    expect(result.errors.length).toBe(1);
    expect(result.rows).toEqual([]);
  });
});
