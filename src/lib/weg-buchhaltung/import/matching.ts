import type { RowWithDuplicateFlag, RowWithSuggestion } from "./types";

export interface MatchingRuleInput {
  id: string;
  pattern: { iban?: string; purposeContains?: string };
  targetUnitId: string | null;
  targetOwnerId: string | null;
  targetCostTypeId: string | null;
}

/**
 * Wendet deterministische Zuordnungsregeln an (weg-buchhaltung-spec.md 5.7,
 * K2 Teil 1 aus hausgeldabrechnung-spec.md Kapitel 9): feste Regeln zuerst,
 * bevor überhaupt ein LLM gefragt würde. Reine Funktion — die erste
 * zutreffende Regel gewinnt (Regel-Reihenfolge wie übergeben).
 */
export function applyMatchingRules(
  rows: RowWithDuplicateFlag[],
  rules: MatchingRuleInput[]
): RowWithSuggestion[] {
  return rows.map((row) => {
    const match = rules.find((rule) => {
      const ibanMatches = rule.pattern.iban
        ? row.counterpartyIban?.toUpperCase() === rule.pattern.iban.toUpperCase()
        : false;
      const purposeMatches = rule.pattern.purposeContains
        ? (row.purpose ?? "").toLowerCase().includes(rule.pattern.purposeContains.toLowerCase())
        : false;
      // Eine Regel greift, wenn mindestens eines ihrer angegebenen Kriterien passt
      // und kein angegebenes Kriterium widerspricht.
      if (rule.pattern.iban && !ibanMatches) return false;
      if (rule.pattern.purposeContains && !purposeMatches) return false;
      return Boolean(rule.pattern.iban || rule.pattern.purposeContains);
    });

    return {
      ...row,
      suggestedCostTypeId: match?.targetCostTypeId ?? null,
      suggestedUnitId: match?.targetUnitId ?? null,
      suggestedOwnerId: match?.targetOwnerId ?? null,
      matchedRuleId: match?.id ?? null,
    };
  });
}
