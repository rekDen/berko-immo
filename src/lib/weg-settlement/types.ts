import Decimal from "decimal.js";

/**
 * Spec Kapitel 6.1. Geld ausschließlich als ganzzahlige Cent (harte Regel
 * 0.3.1) — kein `parseFloat`, keine Rundung außer über `allocate()` (5.11).
 * Kein Branded-Type zur Laufzeit (TS-Typen existieren nicht im JS-Output),
 * `Number.isSafeInteger` wird an den Erzeugungsstellen geprüft, nicht hier.
 */
export type Cents = number;

/**
 * Gewichte, MEA, Flächen, Prozentsätze — Dezimalarithmetik statt `number`
 * (Spec 5.3.6), da Tageszahl-gewichtete Durchschnitte (5.3.2) sonst
 * Gleitkomma-Ungenauigkeiten einschleusen können.
 */
export type Dec = Decimal;

export const ENGINE_VERSION = "weg-settlement@0.1.0";

// ════════════════════════════════════════════════════════════════════════
// Stammdaten-Eingabetypen (Kapitel 6.2) — reine Plain Objects, keine DB-Zeilen.
// Die Zuordnung DB -> diese Typen ist Aufgabe eines künftigen server-load.ts
// (noch nicht Teil dieses Meilensteins, s. hausgeldabrechnung-plan.md Abschnitt 3).
// ════════════════════════════════════════════════════════════════════════

export type CostDirection = "expense" | "income";
export type AllocationKeyType = "co_ownership" | "area" | "unit_count" | "persons" | "consumption" | "custom";
export type Par35aCategory = "household_employment" | "household_service" | "craftsman";

export interface EngineUnit {
  id: string;
  sortKey: string; // Einheitennummer, natürlich sortiert (5.11.3)
}

export interface AllocationKeyDef {
  id: string;
  name: string;
  type: AllocationKeyType;
}

export interface AllocationKeyValueDef {
  keyId: string;
  unitId: string;
  value: Dec;
  validFrom: string; // ISO-Datum, inklusive
  validTo: string | null; // inklusive, null = unbegrenzt
}

export interface CostTypeDef {
  id: string;
  name: string;
  direction: CostDirection;
  allocationKeyId: string | null; // nur bei isHeating = true zulässigerweise null
  isHeating: boolean;
  allowsDirectCharge: boolean;
  apportionable: boolean;
  betrkvNo: number | null;
  resolutionRef: string | null;
}

/** Entspricht einer (ggf. teilweisen) `BookingLine` (Kapitel B6) einer bestätigten Buchung. */
export interface CostBooking {
  id: string; // Herkunfts-ID zur Nachvollziehbarkeit
  costTypeId: string;
  // Betrag mit Vorzeichen aus Sicht der Kostenart: im Normalfall >= 0, negativ
  // bei einer Gutschrift/Erstattung innerhalb einer Ausgaben-Kostenart (8.2 C17).
  amount: Cents;
  directUnitId?: string; // gesetzt bei Direktbelastung (5.3.5)
  laborAmount?: Cents; // § 35a Bruttolohnanteil dieser Buchung
  par35aCategory?: Par35aCategory;
}

export interface HeatingUnitAllocation {
  unitId: string;
  heating: Cents;
  hotWater: Cents;
  co2Cost?: Cents;
  co2LandlordSharePct?: Dec;
  laborAmount?: Cents;
}

export interface HeatingAllocationInput {
  costTypeId: string; // muss isHeating = true sein
  totalAmount: Cents; // Gesamtbetrag laut Messdienst-Abrechnung
  perUnit: HeatingUnitAllocation[];
  // Verwalter hat diese Differenz zwischen Σ perUnit und totalAmount explizit
  // als Rundungsdifferenz des Messdienstes bestätigt (5.5.2, C06). null = keine Bestätigung.
  confirmedRoundingDifference: Cents | null;
  // Pflicht, sobald die tatsächlich gezahlten Heizkosten (Kostenart-Buchungen)
  // vom Messdienst-Gesamtbetrag abweichen (5.5.3, C07).
  reconciliationNote: string | null;
}

export interface AdvanceSoll {
  unitId: string;
  operatingCents: Cents; // Σ Soll-Vorschuss Bewirtschaftung des Jahres (B7.2)
  reserveCents: Cents; // Σ Soll-Vorschuss Rücklage des Jahres
}

export interface BankAccountInput {
  id: string;
  kind: "operating" | "reserve";
  openingBalance: Cents;
  totalIn: Cents;
  totalOut: Cents;
  confirmedClosingBalance: Cents | null; // Kontoauszugssaldo 31.12., null = nicht erfasst (blockierend, C01)
}

export interface ReserveDevelopmentInput {
  bankAccountId: string;
  sollZufuehrung: Cents;
  istZufuehrung: Cents;
  entnahmen: { amount: Cents; resolutionRef: string | null }[];
  zinsen: Cents;
}

export interface SpecialLevyInput {
  id: string;
  purpose: string;
  unitAmounts: { unitId: string; soll: Cents; ist: Cents }[];
}

export interface OwnerReceivablesOpenInput {
  unitId: string;
  openAdvances: Cents;
  openSpecialLevies: Cents;
}

export interface AssetItemInput {
  label: string;
  amount: Cents | null;
  note?: string;
}

export interface LiabilityItemInput {
  label: string;
  amount: Cents;
}

export interface PriorYearClosingInput {
  bankAccountId: string;
  closingBalance: Cents;
}

export interface SettlementInput {
  propertyId: string;
  year: number;
  units: EngineUnit[];
  allocationKeys: AllocationKeyDef[];
  allocationKeyValues: AllocationKeyValueDef[];
  costTypes: CostTypeDef[];
  costBookings: CostBooking[]; // alle bestätigten Kostenart-Buchungen des Jahres
  heatingAllocations: HeatingAllocationInput[];
  advances: AdvanceSoll[];
  advancePaymentsIst: Cents; // Ist-Hausgeldeingänge gesamt (5.2)
  specialLevyPaymentsIst: Cents; // Ist-Sonderumlage-Eingänge gesamt (5.2)
  internalTransfersNet: Cents; // Umbuchungen zwischen Gemeinschaftskonten, netto (5.2)
  priorYearSettlementPayments: Cents; // Zahlungen aus Vorjahresabrechnungen (5.2)
  bankAccounts: BankAccountInput[];
  priorYearClosings: PriorYearClosingInput[]; // für C11 (Anfangsbestand = Vorjahres-Endbestand)
  reserveDevelopments: ReserveDevelopmentInput[];
  specialLevies: SpecialLevyInput[];
  ownerReceivablesOpen: OwnerReceivablesOpenInput[];
  assetItems: AssetItemInput[];
  liabilityItems: LiabilityItemInput[];
}

// ════════════════════════════════════════════════════════════════════════
// Ergebnistypen
// ════════════════════════════════════════════════════════════════════════

export interface CostTypeBreakdown {
  costTypeId: string;
  direction: CostDirection;
  total: Cents;
  allocationKeyId: string | null;
  keyTotalWeight: Dec | null; // Σ Gewichte des Schlüssels ("Gesamtwert des Schlüssels", 8.3) — null bei Heizkosten/ohne Schlüssel
  perUnit: { unitId: string; weight: Dec | null; exactShare: Dec | null; amount: Cents }[];
  blockedZeroWeight: boolean; // Schlüssel-Gesamtgewicht 0, aber gepoolter Betrag != 0 (8.2 C04)
  directChargeErrors: string[]; // Buchungs-IDs: Direktbelastung auf nicht freigegebener Kostenart (8.2 C09)
}

export interface HeatingReconciliation {
  costTypeId: string;
  messdienstTotal: Cents;
  actualPaid: Cents; // Σ tatsächlich gezahlter Kostenart-Buchungen (5.5.3)
  difference: Cents; // actualPaid - messdienstTotal
  perUnitSumMismatch: Cents; // (Σ perUnit) - totalAmount, unbestätigt falls != confirmedRoundingDifference (C06)
}

export interface Par35aShare {
  category: Par35aCategory;
  amount: Cents;
}

export interface ApportionableShare {
  betrkvNo: number;
  amount: Cents;
}

export interface UnitInfoBlock {
  openAdvances: Cents;
  openSpecialLevies: Cents;
  par35a: Par35aShare[];
  apportionable: ApportionableShare[];
  nonApportionable: Cents;
  co2: { amount: Cents; landlordSharePct: Dec | null }[];
}

export interface UnitSettlement {
  unitId: string;
  costs: Cents; // K
  income: Cents; // E
  result: Cents; // R = K - E
  advancesSoll: Cents; // V
  balance: Cents; // S = R - V (> 0 Nachschuss, < 0 Guthaben)
  info: UnitInfoBlock;
}

export interface BankAccountReconciliation {
  bankAccountId: string;
  openingBalance: Cents;
  totalIn: Cents;
  totalOut: Cents;
  computedClosing: Cents;
  confirmedClosing: Cents | null;
  matches: boolean;
}

export interface ReserveDevelopmentResult {
  bankAccountId: string;
  openingBalance: Cents;
  sollZufuehrung: Cents;
  istZufuehrung: Cents;
  zufuehrungDifferenz: Cents;
  entnahmen: Cents;
  zinsen: Cents;
  computedClosing: Cents;
  confirmedClosing: Cents | null;
  matches: boolean;
}

export interface AssetReport {
  bankBalances: { bankAccountId: string; kind: "operating" | "reserve"; balance: Cents | null }[];
  reserves: ReserveDevelopmentResult[];
  receivablesTotal: Cents;
  liabilities: LiabilityItemInput[];
  otherAssets: AssetItemInput[];
}

export interface SpecialLevyReport {
  id: string;
  purpose: string;
  soll: Cents;
  ist: Cents;
  offen: Cents;
}

export interface SettlementResult {
  engineVersion: string;
  propertyId: string;
  year: number;
  costTypeBreakdowns: CostTypeBreakdown[];
  heatingReconciliations: HeatingReconciliation[];
  units: UnitSettlement[];
  bankReconciliations: BankAccountReconciliation[];
  reserveDevelopments: ReserveDevelopmentResult[];
  assetReport: AssetReport;
  specialLevies: SpecialLevyReport[];
  overall: {
    advancePaymentsIst: Cents;
    specialLevyPaymentsIst: Cents;
    otherIncomeTotal: Cents;
    expenseTotal: Cents;
    internalTransfersNet: Cents;
    priorYearSettlementPayments: Cents;
  };
}

export type CheckSeverity = "blocking" | "warning" | "info";

export interface CheckResult {
  id: string;
  severity: CheckSeverity;
  message: string;
  context?: Record<string, unknown>;
}
