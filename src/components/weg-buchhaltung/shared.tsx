// Gemeinsame Typen, Formatierung und Styling-Konstanten für die
// Buchhaltungs-Sektionen unter src/app/(app)/objekte/[propertyId]/buchhaltung.
// Spiegelt die API-Antwortformen aus src/app/api/weg-buchhaltung/*.

export type Property = { id: string; name: string };
export type Unit = { id: string; unit_number: string; mea: number | null };
export type Owner = { id: string; name: string };

export type Reconciliation = {
  opening: { date: string; balance: number };
  latest: { date: string; balance: number };
  movementsSum: number | null;
  computedClosing: number | null;
  difference: number | null;
} | null;

export type BankAccount = {
  id: string; iban: string; bic: string | null; kind: "operating" | "reserve"; label: string;
  ledger_account_id: string; reconciliation: Reconciliation;
};

export type ChartAccount = { id: string; code: string; name: string; kind: string };

export type Transaction = {
  id: string; bank_account_id: string; booking_date: string; amount: number; kind: string;
  purpose: string | null; status: "suggested" | "confirmed"; cost_type_id: string | null;
  unit_id: string | null; journal_entry_id: string | null;
  cost_types: { name: string } | null;
  units: { unit_number: string } | null;
  community_bank_accounts: { label: string } | null;
};

export type AllocationKeyValue = {
  id: string;
  key_id: string;
  unit_id: string;
  value: number;
  valid_from: string;
  valid_to: string | null;
  units: { unit_number: string } | null;
};

export type AllocationKey = {
  id: string;
  name: string;
  type: string;
  values: AllocationKeyValue[];
};

export type CostType = {
  id: string;
  name: string;
  direction: "expense" | "income";
  allocation_key_id: string | null;
  is_heating: boolean;
  allows_direct_charge: boolean;
  apportionable: boolean;
  betrkv_no: number | null;
  resolution_ref: string | null;
  ledger_account_id: string;
  accounts: { code: string; name: string } | null;
};

export type PlanAdvance = {
  id: string; plan_id: string; unit_id: string; monthly_operating: number; monthly_reserve: number;
  valid_from: string; valid_to: string | null; units: { unit_number: string } | null;
};
export type EconomicPlan = { id: string; year: number; resolution_date: string; advances: PlanAdvance[] };

export type SpecialLevyUnit = {
  id: string; levy_id: string; unit_id: string; amount: number; paid: number;
  units: { unit_number: string } | null;
};
export type SpecialLevy = { id: string; resolution_date: string; purpose: string; due_date: string | null; units: SpecialLevyUnit[] };

export type MatchingRule = {
  id: string; pattern: { iban?: string; purposeContains?: string }; active: boolean;
  target_unit_id: string | null; target_owner_id: string | null; target_cost_type_id: string | null;
  cost_types: { name: string } | null;
  units: { unit_number: string } | null;
  contacts: { first_name: string | null; last_name: string | null; company_name: string | null } | null;
};

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

export const TX_KIND_LABELS: Record<string, string> = {
  advance_payment: "Vorschusszahlung", special_levy_payment: "Sonderumlage",
  expense: "Ausgabe", income: "Einnahme", internal_transfer: "Umbuchung", reserve_expense: "Rücklagenentnahme",
};

export const KEY_TYPE_LABELS: Record<string, string> = {
  co_ownership: "Miteigentumsanteile (MEA)",
  area: "Fläche",
  unit_count: "Einheitenanzahl",
  persons: "Personenzahl",
  consumption: "Verbrauch",
  custom: "Individuell",
};

export const inputCls =
  "text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-900 dark:border-gray-800 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30";
export const labelCls = "block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1";
export const cardCls = "rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800";

export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
      {children}
    </span>
  );
}
