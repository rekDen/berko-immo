// Style-Konstanten, konsistent mit src/components/weg-buchhaltung/shared.tsx
// (App-weites Muster) — hier separat gehalten, um keine Modul-Grenze
// zwischen Mietermatching und WEG-Buchhaltung durch einen Cross-Import zu
// verwischen.
export const inputCls =
  "text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 dark:bg-gray-900 dark:border-gray-800 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30";
export const labelCls = "block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1";
export const cardCls = "rounded-xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800";

export const STATUS_LABELS: Record<string, string> = {
  new: "Neu",
  scored: "Bewertet",
  invited: "Eingeladen",
  rejected: "Abgelehnt",
  withdrawn: "Zurückgezogen",
};

export const SOURCE_LABELS: Record<string, string> = {
  email: "E-Mail",
  phone_anna: "Telefon (Anna)",
  web_form: "Web-Formular",
  manual: "Manuell",
};

export interface Profile {
  id: string;
  unit_id: string;
  target_rent_cold: number | null;
  min_net_income: number | null;
  income_to_rent_ratio_min: number;
  employment_types_accepted: string[];
  household_size_min: number | null;
  household_size_max: number | null;
  pets_allowed: boolean | null;
  smoking_allowed: boolean | null;
  move_in_earliest: string | null;
  move_in_latest: string | null;
  min_lease_duration_months: number | null;
  schufa_required: boolean;
  schufa_max_score_class: string | null;
  required_documents: string[];
  weights: Record<string, number>;
  notes_internal: string | null;
}

export interface CriterionResult {
  criterion: string;
  weight: number;
  applicantValue: string | number | null;
  targetValue: string | number | null;
  subScore: number;
  matched: boolean;
  note: string | null;
}

export interface MatchResult {
  overall_score: number;
  confidence: number;
  criteria_breakdown?: CriterionResult[];
  missing_documents?: string[];
  computed_at: string;
}

export interface Applicant {
  id: string;
  unit_id: string;
  source: string;
  first_name: string;
  last_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  net_income: number | null;
  employment_type: string | null;
  household_size: number | null;
  has_pets: boolean | null;
  is_smoker: boolean | null;
  desired_move_in: string | null;
  schufa_result: { classification: "none_negative" | "soft_negative" | "hard_negative" } | null;
  status: string;
  created_at: string;
  match_result: MatchResult | null;
}

export const CRITERION_LABELS: Record<string, string> = {
  income_ratio: "Einkommen / Miete-Verhältnis",
  employment: "Beschäftigungsart",
  schufa: "SCHUFA / Bonität",
  household_size: "Haushaltsgröße",
  move_in: "Einzugstermin",
  documents_completeness: "Vollständigkeit der Unterlagen",
};
