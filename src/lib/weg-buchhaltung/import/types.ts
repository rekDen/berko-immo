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

// MB2 (Bankimport) — normalisierte Struktur für einen ganzen Kontoauszug,
// s. hausgeldabrechnung-spec.md B5.8 (Adapter-Schnittstelle) und B6 (BankTransaction-Felder).
export interface NormalizedEntry extends ParsedRow {
  valueDate: string | null;
  currency: string;
  counterpartyBic: string | null;
  /** `Refs/EndToEndId` — literal "NOTPROVIDED" wird bereits beim Parsen zu null normalisiert. */
  endToEndId: string | null;
  mandateId: string | null;
  /** `AcctSvcrRef` bzw. `Refs/AcctSvcrRef` — bevorzugter Bestandteil des Dedup-Keys, wenn eindeutig. */
  bankRef: string | null;
  bankTxCode: {
    domainCode: string | null;
    familyCode: string | null;
    subFamilyCode: string | null;
    proprietaryCode: string | null;
  } | null;
  returnReasonCode: string | null;
  isReversal: boolean;
  /** Gemeinsame ID für aus einer Sammelbuchung aufgeteilte Zeilen (B5.4). */
  batchParentId: string | null;
  /** true, wenn eine Sammelbuchung nicht aufgeteilt werden konnte (Summe der Einzelposten ≠ Gesamtbetrag). */
  needsManualSplit: boolean;
  /** Strukturierte Rohdaten des Eintrags, unveränderlich (B6: `raw: JSON`). */
  raw: unknown;
}

export interface RejectedEntry {
  reason: string;
  bookingDate: string | null;
  amount: number | null;
  currency: string | null;
}

export interface NormalizedStatement {
  iban: string | null;
  externalId: string | null;
  schemaVersion: "002" | "008" | "unknown";
  openingBalance: number | null;
  closingBalance: number | null;
  closingDate: string | null;
  entries: NormalizedEntry[];
  /** Abgelehnte Einträge desselben Auszugs, z. B. Währung ≠ EUR (BC06). */
  rejectedEntries: RejectedEntry[];
}

export interface RowWithDuplicateFlag extends NormalizedEntry {
  isDuplicate: boolean;
  dedupKey: string;
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

/** B8.2 Stufe 3 — nur für Zeilen ohne Stufe-2-Vorschlag berechnet (s. matching-ai.ts). */
export interface Stage3CostTypeSuggestion {
  costTypeId: string; costTypeName: string; confidence: number | null; reasoning: string | null;
}
export interface RowWithStage3 extends RowWithStage2 {
  stage3CostTypeSuggestion: Stage3CostTypeSuggestion | null;
}
