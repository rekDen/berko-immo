import type { ApplicantDocType, ApplicantForScoring, DesiredTenantProfileForScoring } from "./scoring";

/** Wandelt eine `desired_tenant_profile`-DB-Zeile (snake_case) in die
 * camelCase-Eingabe der reinen Scoring-Funktion um. */
export function profileRowToScoring(row: {
  target_rent_cold: number | null;
  income_to_rent_ratio_min: number;
  employment_types_accepted: string[];
  household_size_min: number | null;
  household_size_max: number | null;
  move_in_earliest: string | null;
  move_in_latest: string | null;
  schufa_required: boolean;
  required_documents: ApplicantDocType[];
  weights: Record<string, number>;
}): DesiredTenantProfileForScoring {
  return {
    targetRentCold: row.target_rent_cold,
    incomeToRentRatioMin: row.income_to_rent_ratio_min,
    employmentTypesAccepted: row.employment_types_accepted,
    householdSizeMin: row.household_size_min,
    householdSizeMax: row.household_size_max,
    moveInEarliest: row.move_in_earliest,
    moveInLatest: row.move_in_latest,
    schufaRequired: row.schufa_required,
    requiredDocuments: row.required_documents,
    weights: row.weights,
  };
}

/** Wandelt eine `applicant`-DB-Zeile (snake_case) plus die bereits
 * hochgeladenen Dokumenttypen (aus `applicant_document`) in die
 * camelCase-Eingabe der reinen Scoring-Funktion um. */
export function applicantRowToScoring(
  row: {
    net_income: number | null;
    employment_type: string | null;
    household_size: number | null;
    desired_move_in: string | null;
    schufa_result: { classification: "none_negative" | "soft_negative" | "hard_negative" } | null;
  },
  uploadedDocumentTypes: ApplicantDocType[],
): ApplicantForScoring {
  return {
    netIncome: row.net_income,
    employmentType: row.employment_type,
    householdSize: row.household_size,
    desiredMoveIn: row.desired_move_in,
    schufaResult: row.schufa_result,
    uploadedDocumentTypes,
  };
}
