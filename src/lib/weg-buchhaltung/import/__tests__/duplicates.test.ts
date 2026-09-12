import { describe, expect, it } from "vitest";
import { markDuplicates, purposeHash } from "../duplicates";
import type { ParsedRow } from "../types";

const row: ParsedRow = { bookingDate: "2026-03-05", amount: -92000, purpose: "Reparatur Dachrinne", counterpartyIban: null, counterpartyName: null };

describe("purposeHash", () => {
  it("normalisiert Groß-/Kleinschreibung und Whitespace", () => {
    expect(purposeHash("Reparatur  Dachrinne")).toBe(purposeHash("reparatur dachrinne"));
    expect(purposeHash(" Reparatur Dachrinne ")).toBe(purposeHash("Reparatur Dachrinne"));
  });

  it("ist deterministisch", () => {
    expect(purposeHash("x")).toBe(purposeHash("x"));
  });
});

describe("markDuplicates", () => {
  it("erkennt exakte Kombination aus Datum, Betrag und Verwendungszweck als Duplikat", () => {
    const existing = [{ bookingDate: row.bookingDate, amount: row.amount, purposeHash: purposeHash(row.purpose) }];
    const [result] = markDuplicates([row], existing);
    expect(result.isDuplicate).toBe(true);
  });

  it("markiert keine Duplikate bei abweichendem Betrag", () => {
    const existing = [{ bookingDate: row.bookingDate, amount: row.amount + 1, purposeHash: purposeHash(row.purpose) }];
    const [result] = markDuplicates([row], existing);
    expect(result.isDuplicate).toBe(false);
  });

  it("markiert keine Duplikate bei abweichendem Datum", () => {
    const existing = [{ bookingDate: "2026-03-06", amount: row.amount, purposeHash: purposeHash(row.purpose) }];
    const [result] = markDuplicates([row], existing);
    expect(result.isDuplicate).toBe(false);
  });

  it("liefert isDuplicate=false ohne bestehende Signaturen", () => {
    const [result] = markDuplicates([row], []);
    expect(result.isDuplicate).toBe(false);
  });
});
