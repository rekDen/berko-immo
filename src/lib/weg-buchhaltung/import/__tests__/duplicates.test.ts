import { describe, expect, it } from "vitest";
import { computeDedupKeys, markDuplicates, purposeHash } from "../duplicates";
import type { NormalizedEntry } from "../types";

function entry(overrides: Partial<NormalizedEntry> = {}): NormalizedEntry {
  return {
    bookingDate: "2026-03-05",
    amount: -92000,
    purpose: "Reparatur Dachrinne",
    counterpartyIban: null,
    counterpartyName: null,
    valueDate: null,
    currency: "EUR",
    counterpartyBic: null,
    endToEndId: null,
    mandateId: null,
    bankRef: null,
    bankTxCode: null,
    returnReasonCode: null,
    isReversal: false,
    batchParentId: null,
    needsManualSplit: false,
    raw: null,
    ...overrides,
  };
}

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
  it("erkennt einen bestehenden Dedup-Key als Duplikat", () => {
    const [result] = markDuplicates([entry()], null, new Set(computeDedupKeys([entry()], null)));
    expect(result.isDuplicate).toBe(true);
  });

  it("markiert keine Duplikate bei abweichendem Betrag", () => {
    const existingKeys = new Set(computeDedupKeys([entry({ amount: -92001 })], null));
    const [result] = markDuplicates([entry()], null, existingKeys);
    expect(result.isDuplicate).toBe(false);
  });

  it("markiert keine Duplikate bei abweichendem Datum", () => {
    const existingKeys = new Set(computeDedupKeys([entry({ bookingDate: "2026-03-06" })], null));
    const [result] = markDuplicates([entry()], null, existingKeys);
    expect(result.isDuplicate).toBe(false);
  });

  it("liefert isDuplicate=false ohne bestehende Schlüssel", () => {
    const [result] = markDuplicates([entry()], null, new Set());
    expect(result.isDuplicate).toBe(false);
  });

  it("bevorzugt eine im Batch eindeutige Bankreferenz als Schlüssel", () => {
    const keys = computeDedupKeys([entry({ bankRef: "REF-1" })], null);
    expect(keys[0]).toBe("ref:REF-1");
  });

  it("fällt auf den Hash-Schlüssel zurück, wenn die Bankreferenz im Batch mehrfach vorkommt", () => {
    const keys = computeDedupKeys(
      [entry({ bankRef: "REF-DUP", amount: -100 }), entry({ bankRef: "REF-DUP", amount: -200 })],
      null,
    );
    expect(keys[0]).toMatch(/^hash:/);
    expect(keys[1]).toMatch(/^hash:/);
  });

  it("gibt zwei identisch aussehenden Zahlungen am selben Tag unterschiedliche Schlüssel, beide bleiben eigenständig", () => {
    const twins = [entry(), entry()];
    const keys = computeDedupKeys(twins, null);
    expect(keys[0]).not.toBe(keys[1]);
    const [r0, r1] = markDuplicates(twins, null, new Set());
    expect(r0.isDuplicate).toBe(false);
    expect(r1.isDuplicate).toBe(false);
  });

  it("erkennt bei einem überlappenden Re-Import beide zuvor gesehenen Zwillings-Zahlungen als Duplikate", () => {
    const twins = [entry(), entry()];
    const existingKeys = new Set(computeDedupKeys(twins, null));
    const [r0, r1] = markDuplicates(twins, null, existingKeys);
    expect(r0.isDuplicate).toBe(true);
    expect(r1.isDuplicate).toBe(true);
  });
});
