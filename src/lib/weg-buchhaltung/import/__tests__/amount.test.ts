import { describe, expect, it } from "vitest";
import { parseAmountToCents } from "../amount";

describe("parseAmountToCents", () => {
  it("parst deutsche Notation (Komma-Dezimal, Punkt-Tausender)", () => {
    expect(parseAmountToCents("19,99", ",")).toBe(1999);
    expect(parseAmountToCents("1.234,56", ",")).toBe(123456);
    expect(parseAmountToCents("-247,00", ",")).toBe(-24700);
  });

  it("parst ISO-Notation (Punkt-Dezimal, Komma-Tausender)", () => {
    expect(parseAmountToCents("19.99", ".")).toBe(1999);
    expect(parseAmountToCents("1,234.56", ".")).toBe(123456);
    expect(parseAmountToCents("-247.00", ".")).toBe(-24700);
  });

  it("behandelt geklammerte negative Beträge", () => {
    expect(parseAmountToCents("(19,99)", ",")).toBe(-1999);
  });

  it("ist deterministisch (keine Fließkomma-Rundungsfehler)", () => {
    // Klassischer Float-Fallstrick: 19.99 * 100 !== 1999 exakt in manchen Sprachen.
    for (let i = 0; i < 1000; i++) {
      const cents = i * 7 + 1; // beliebige Cent-Werte
      const euros = Math.floor(cents / 100);
      const rest = cents % 100;
      const raw = `${euros},${String(rest).padStart(2, "0")}`;
      expect(parseAmountToCents(raw, ",")).toBe(cents);
    }
  });

  it("wirft bei leerem Betrag", () => {
    expect(() => parseAmountToCents("", ",")).toThrow();
  });
});
