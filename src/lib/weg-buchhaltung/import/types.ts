// Reine Typen für den Bank-Import (weg-buchhaltung-spec.md 5.3.5, Kapitel 3.1).
// Keine DB-, Datei- oder Netzwerkzugriffe in diesem Modul — nur Parsing.

export interface ParsedRow {
  /** ISO-Datum (YYYY-MM-DD). */
  bookingDate: string;
  /** Cents, mit Vorzeichen (positiv = Zufluss, negativ = Abfluss). */
  amount: number;
  purpose: string | null;
  counterpartyIban: string | null;
  /** Name der Gegenpartei (Zahler bei Zufluss, Empfänger bei Abfluss) — für
   * B8.2 Stufe 2 (Namensähnlichkeit), s. hausgeldabrechnung-spec.md B8.2. */
  counterpartyName: string | null;
}

export interface CsvMapping {
  dateColumn: string;
  amountColumn: string;
  purposeColumn?: string;
  counterpartyIbanColumn?: string;
  counterpartyNameColumn?: string;
  /** 'iso' = YYYY-MM-DD, 'de' = DD.MM.YYYY */
  dateFormat: "iso" | "de";
  /** Dezimaltrennzeichen im Betrag, z. B. "1.234,56" (de) vs. "1234.56" (iso). */
  decimalSeparator: "," | ".";
  /** Spaltentrenner, Standard Semikolon (deutsche Bank-Exports) oder Komma. */
  delimiter?: "," | ";";
}

export interface ExistingSignature {
  bookingDate: string;
  amount: number;
  purposeHash: string;
}

export interface RowWithDuplicateFlag extends ParsedRow {
  isDuplicate: boolean;
}

export interface RowWithSuggestion extends RowWithDuplicateFlag {
  suggestedCostTypeId: string | null;
  suggestedUnitId: string | null;
  suggestedOwnerId: string | null;
  matchedRuleId: string | null;
}

/** B8.2 Stufe 2 — nur für Zeilen ohne Stufe-1-Treffer berechnet (s. matching-heuristic.ts). */
export interface Stage2OwnerSuggestion {
  ownerId: string; unitId: string; score: number; highlight: boolean; reasons: string[];
}
export interface Stage2CostTypeSuggestion {
  costTypeId: string; score: number; highlight: boolean; reasons: string[];
}
export interface RowWithStage2 extends RowWithSuggestion {
  stage2OwnerSuggestions: Stage2OwnerSuggestion[];
  stage2CostTypeSuggestion: Stage2CostTypeSuggestion | null;
}
