// Gemeinsame Typen, Formatierung und Styling-Konstanten für die
// Jahresabrechnungs-Sektionen unter src/app/(app)/objekte/[propertyId]/abrechnung.
// Spiegelt die API-Antwortformen aus src/app/api/weg-settlement/*.

export type SettlementStatus = "draft" | "review" | "final" | "resolved" | "superseded";

export type SettlementListItem = {
  id: string;
  year: number;
  version: number;
  status: SettlementStatus;
  engine_version: string | null;
  finalized_at: string | null;
  resolved_at: string | null;
  resolution_date: string | null;
  supersedes_id: string | null;
  created_at: string;
};

export type CheckSeverity = "blocking" | "warning" | "info";
export type CheckResult = { id: string; severity: CheckSeverity; message: string; context?: Record<string, unknown> };

export type SettlementUnitRow = {
  unit_id: string;
  addressee_owner_id: string | null;
  costs: number;
  income: number;
  advances_due: number;
  balance: number;
  units: { unit_number: string } | null;
};

export type SettlementComment = { id: string; author_id: string; text: string; created_at: string };
export type CheckAcknowledgement = { id: string; check_id: string; user_id: string; note: string | null; created_at: string };

export type CostTypeBreakdown = {
  costTypeId: string;
  direction: "expense" | "income";
  total: number;
  allocationKeyId: string | null;
  perUnit: { unitId: string; exactShare: number | null; amount: number }[];
  blockedZeroWeight: boolean;
  directChargeErrors: string[];
};

export type BankAccountReconciliation = {
  bankAccountId: string; openingBalance: number; totalIn: number; totalOut: number;
  computedClosing: number; confirmedClosing: number | null; matches: boolean;
};

export type ReserveDevelopmentResult = {
  bankAccountId: string; openingBalance: number; sollZufuehrung: number; istZufuehrung: number;
  zufuehrungDifferenz: number; entnahmen: number; zinsen: number;
  computedClosing: number; confirmedClosing: number | null; matches: boolean;
};

export type AssetReportView = {
  bankBalances: { bankAccountId: string; kind: "operating" | "reserve"; balance: number | null }[];
  reserves: ReserveDevelopmentResult[];
  receivablesTotal: number;
  liabilities: { label: string; amount: number }[];
  otherAssets: { label: string; amount: number | null; note?: string }[];
};

export type SpecialLevyReportView = { id: string; purpose: string; soll: number; ist: number; offen: number };

export type SettlementResultView = {
  engineVersion: string;
  propertyId: string;
  year: number;
  costTypeBreakdowns: CostTypeBreakdown[];
  bankReconciliations: BankAccountReconciliation[];
  reserveDevelopments: ReserveDevelopmentResult[];
  assetReport: AssetReportView;
  specialLevies: SpecialLevyReportView[];
  overall: {
    advancePaymentsIst: number; specialLevyPaymentsIst: number; otherIncomeTotal: number;
    expenseTotal: number; internalTransfersNet: number; priorYearSettlementPayments: number;
  };
};

export type SettlementDetailResponse = {
  settlement: SettlementListItem & { property_id: string; result_snapshot: SettlementResultView | null };
  units: SettlementUnitRow[];
  comments: SettlementComment[];
  acknowledgements: CheckAcknowledgement[];
  checks: CheckResult[];
};

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

export const STATUS_LABELS: Record<SettlementStatus, string> = {
  draft: "Entwurf", review: "In Prüfung", final: "Final", resolved: "Beschlossen", superseded: "Überholt",
};

export const STATUS_ORDER: SettlementStatus[] = ["draft", "review", "final", "resolved"];

export const SEVERITY_LABELS: Record<CheckSeverity, string> = { blocking: "Blockierend", warning: "Warnung", info: "Hinweis" };

export const SEVERITY_CLASSES: Record<CheckSeverity, string> = {
  blocking: "bg-red-500/15 text-red-600 dark:text-red-400",
  warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  info: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
};

export const STATUS_CLASSES: Record<SettlementStatus, string> = {
  draft: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  review: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  final: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  resolved: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  superseded: "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 line-through",
};

export const inputCls =
  "text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-900 dark:border-gray-800 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30";
export const labelCls = "block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1";
export const cardCls = "rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800";

export function StatusBadge({ status }: { status: SettlementStatus }) {
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASSES[status]}`}>{STATUS_LABELS[status]}</span>;
}

export function SeverityBadge({ severity }: { severity: CheckSeverity }) {
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_CLASSES[severity]}`}>{SEVERITY_LABELS[severity]}</span>;
}
