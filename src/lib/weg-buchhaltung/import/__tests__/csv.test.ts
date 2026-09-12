import { describe, expect, it } from "vitest";
import { parseCsv } from "../csv";
import type { CsvMapping } from "../types";

const mapping: CsvMapping = {
  dateColumn: "Buchungstag",
  amountColumn: "Betrag",
  purposeColumn: "Verwendungszweck",
  counterpartyIbanColumn: "IBAN",
  dateFormat: "de",
  decimalSeparator: ",",
  delimiter: ";",
};

const csv = [
  "Buchungstag;Betrag;Verwendungszweck;IBAN",
  "05.03.2026;-920,00;Reparatur Dachrinne;DE12345678901234567890",
  "10.02.2026;-247,00;\"Hausmeister; Februar\";DE98765432109876543210",
].join("\n");

describe("parseCsv", () => {
  it("parst Datum, Betrag und Verwendungszweck korrekt", () => {
    const rows = parseCsv(csv, mapping);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      bookingDate: "2026-03-05",
      amount: -92000,
      purpose: "Reparatur Dachrinne",
      counterpartyIban: "DE12345678901234567890",
    });
  });

  it("behandelt quotierte Felder mit dem Trennzeichen darin", () => {
    const rows = parseCsv(csv, mapping);
    expect(rows[1].purpose).toBe("Hausmeister; Februar");
  });

  it("ist deterministisch", () => {
    expect(parseCsv(csv, mapping)).toEqual(parseCsv(csv, mapping));
  });

  it("wirft bei fehlender Spalte", () => {
    expect(() => parseCsv(csv, { ...mapping, dateColumn: "Unbekannt" })).toThrow();
  });

  it("ignoriert leere Zeilen", () => {
    const withBlank = csv + "\n\n";
    expect(parseCsv(withBlank, mapping)).toHaveLength(2);
  });
});
