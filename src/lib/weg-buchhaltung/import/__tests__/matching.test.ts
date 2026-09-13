import { describe, expect, it } from "vitest";
import { applyMatchingRules, type MatchingRuleInput } from "../matching";
import type { RowWithDuplicateFlag } from "../types";

const row: RowWithDuplicateFlag = {
  bookingDate: "2026-03-05", amount: -24700, purpose: "Hausmeister Februar 2026",
  counterpartyIban: "DE12345678901234567890", counterpartyName: null, isDuplicate: false,
  dedupKey: "hash:test#0", valueDate: null, currency: "EUR", counterpartyBic: null,
  endToEndId: null, mandateId: null, bankRef: null, bankTxCode: null, returnReasonCode: null,
  isReversal: false, batchParentId: null, needsManualSplit: false, raw: null,
};

describe("applyMatchingRules", () => {
  it("wendet eine Regel per Verwendungszweck-Teilstring an", () => {
    const rules: MatchingRuleInput[] = [
      { id: "r1", pattern: { purposeContains: "hausmeister" }, targetUnitId: null, targetOwnerId: null, targetCostTypeId: "ct-hausmeister" },
    ];
    const [result] = applyMatchingRules([row], rules);
    expect(result.suggestedCostTypeId).toBe("ct-hausmeister");
    expect(result.matchedRuleId).toBe("r1");
  });

  it("wendet eine Regel per IBAN an", () => {
    const rules: MatchingRuleInput[] = [
      { id: "r2", pattern: { iban: "DE12345678901234567890" }, targetUnitId: null, targetOwnerId: "owner-1", targetCostTypeId: null },
    ];
    const [result] = applyMatchingRules([row], rules);
    expect(result.suggestedOwnerId).toBe("owner-1");
  });

  it("keine Regel trifft zu -> keine Vorschläge", () => {
    const rules: MatchingRuleInput[] = [
      { id: "r3", pattern: { purposeContains: "heizung" }, targetUnitId: null, targetOwnerId: null, targetCostTypeId: "ct-heizung" },
    ];
    const [result] = applyMatchingRules([row], rules);
    expect(result.suggestedCostTypeId).toBeNull();
    expect(result.matchedRuleId).toBeNull();
  });

  it("erste zutreffende Regel gewinnt (Reihenfolge der Liste)", () => {
    const rules: MatchingRuleInput[] = [
      { id: "first", pattern: { purposeContains: "hausmeister" }, targetUnitId: null, targetOwnerId: null, targetCostTypeId: "ct-a" },
      { id: "second", pattern: { purposeContains: "hausmeister" }, targetUnitId: null, targetOwnerId: null, targetCostTypeId: "ct-b" },
    ];
    const [result] = applyMatchingRules([row], rules);
    expect(result.matchedRuleId).toBe("first");
  });

  it("IBAN muss exakt passen, wenn angegeben (keine Teilstring-Logik)", () => {
    const rules: MatchingRuleInput[] = [
      { id: "r4", pattern: { iban: "DE00000000000000000000" }, targetUnitId: null, targetOwnerId: null, targetCostTypeId: "ct-x" },
    ];
    const [result] = applyMatchingRules([row], rules);
    expect(result.matchedRuleId).toBeNull();
  });
});
