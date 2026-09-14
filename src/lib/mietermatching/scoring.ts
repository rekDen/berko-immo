/**
 * KI-Mietermatching — deterministisches, regelbasiertes Scoring pro
 * Bewerber × Wunschmieter-Profil. Spec: Spezifikation_Mietermatching.md §3.
 * "Deterministisches, regelbasiertes Scoring pro Kriterium (kein
 * Black-Box-LLM-Urteil über die Eignung einer Person)."
 *
 * Reine Funktionen — keine DB-/Datei-/Netzwerkzugriffe. Der Aufrufer
 * (API-Route) lädt Profil und Bewerber und übergibt sie hier hinein.
 *
 * MM1-Vereinfachung, weiterhin offen:
 * - "employment" bewertet nur exakte Übereinstimmung mit den akzeptierten
 *   Beschäftigungsarten; die Spec-Nuance "befristet mit >12 Monaten
 *   Restlaufzeit = 70 %" bräuchte ein Restlaufzeit-Feld, das `applicant`
 *   aktuell nicht führt.
 *
 * Seit MM2: "documents_completeness" wertet echte hochgeladene
 * Bewerberunterlagen aus (s. `uploadedDocumentTypes`), statt wie in MM1
 * immer einen neutralen Platzhalter zu liefern.
 */

const CONFIDENCE_PENALTY_PER_MISSING = 0.15;

export type CriterionKey =
  | "income_ratio" | "employment" | "schufa"
  | "household_size" | "move_in" | "documents_completeness";

/** Feste Dokumenttypen für Bewerberunterlagen (Spec §2.3), s. auch
 * applicant_document.doc_type (migration-mietermatching-mm2.sql). */
export type ApplicantDocType = "income_proof" | "schufa" | "self_disclosure" | "other";

export const DOC_TYPE_LABELS: Record<ApplicantDocType, string> = {
  income_proof: "Einkommensnachweis",
  schufa: "SCHUFA-Auskunft",
  self_disclosure: "Mieterselbstauskunft",
  other: "Sonstige Unterlagen",
};

export interface CriterionResult {
  criterion: CriterionKey;
  weight: number;
  applicantValue: string | number | null;
  targetValue: string | number | null;
  subScore: number; // 0–100
  matched: boolean;
  note: string | null;
}

export interface DesiredTenantProfileForScoring {
  targetRentCold: number | null;
  incomeToRentRatioMin: number;
  employmentTypesAccepted: string[];
  householdSizeMin: number | null;
  householdSizeMax: number | null;
  moveInEarliest: string | null;
  moveInLatest: string | null;
  schufaRequired: boolean;
  /** Benötigte Dokumenttypen (Teilmenge von ApplicantDocType), vom Verwalter im Profil festgelegt. */
  requiredDocuments: ApplicantDocType[];
  weights: Partial<Record<CriterionKey, number>>;
}

export interface ApplicantForScoring {
  netIncome: number | null;
  employmentType: string | null;
  householdSize: number | null;
  desiredMoveIn: string | null;
  schufaResult: { classification: "none_negative" | "soft_negative" | "hard_negative" } | null;
  /** Dokumenttypen, für die der Bewerber bereits mindestens eine Unterlage hochgeladen hat. */
  uploadedDocumentTypes: ApplicantDocType[];
}

export interface ScoringResult {
  overallScore: number;
  confidence: number;
  criteriaBreakdown: CriterionResult[];
  missingDocuments: ApplicantDocType[];
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function scoreIncomeRatio(profile: DesiredTenantProfileForScoring, applicant: ApplicantForScoring): CriterionResult {
  const weight = profile.weights.income_ratio ?? 0;
  if (applicant.netIncome === null || profile.targetRentCold === null || profile.targetRentCold <= 0) {
    return {
      criterion: "income_ratio", weight, applicantValue: applicant.netIncome, targetValue: profile.targetRentCold,
      subScore: 50, matched: false, note: "Nettoeinkommen oder Zielmiete fehlt",
    };
  }
  const ratio = applicant.netIncome / profile.targetRentCold;
  const target = profile.incomeToRentRatioMin;
  const hardFloor = target * (2 / 3);
  let subScore: number;
  if (ratio >= target) subScore = 100;
  else if (ratio <= hardFloor) subScore = 0;
  else subScore = ((ratio - hardFloor) / (target - hardFloor)) * 100;
  return {
    criterion: "income_ratio", weight,
    applicantValue: Math.round(ratio * 100) / 100, targetValue: target,
    subScore: Math.round(subScore), matched: ratio >= target, note: null,
  };
}

function scoreEmployment(profile: DesiredTenantProfileForScoring, applicant: ApplicantForScoring): CriterionResult {
  const weight = profile.weights.employment ?? 0;
  if (!applicant.employmentType) {
    return {
      criterion: "employment", weight, applicantValue: null, targetValue: profile.employmentTypesAccepted.join(", "),
      subScore: 50, matched: false, note: "Keine Angabe zur Beschäftigungsart",
    };
  }
  const matched = profile.employmentTypesAccepted.includes(applicant.employmentType);
  return {
    criterion: "employment", weight,
    applicantValue: applicant.employmentType, targetValue: profile.employmentTypesAccepted.join(", "),
    subScore: matched ? 100 : 0, matched, note: null,
  };
}

function scoreSchufa(profile: DesiredTenantProfileForScoring, applicant: ApplicantForScoring): CriterionResult {
  const weight = profile.weights.schufa ?? 0;
  if (!applicant.schufaResult) {
    return {
      criterion: "schufa", weight, applicantValue: null, targetValue: profile.schufaRequired ? "erforderlich" : "optional",
      subScore: profile.schufaRequired ? 40 : 50, matched: false, note: "Keine SCHUFA-Auskunft vorliegend",
    };
  }
  const map: Record<string, number> = { none_negative: 100, soft_negative: 50, hard_negative: 0 };
  const subScore = map[applicant.schufaResult.classification] ?? 50;
  return {
    criterion: "schufa", weight,
    applicantValue: applicant.schufaResult.classification, targetValue: "none_negative",
    subScore, matched: applicant.schufaResult.classification === "none_negative", note: null,
  };
}

function scoreHouseholdSize(profile: DesiredTenantProfileForScoring, applicant: ApplicantForScoring): CriterionResult {
  const weight = profile.weights.household_size ?? 0;
  const { householdSizeMin: min, householdSizeMax: max } = profile;
  const targetValue = min !== null || max !== null ? `${min ?? "–"}–${max ?? "–"}` : null;
  if (applicant.householdSize === null) {
    return {
      criterion: "household_size", weight, applicantValue: null, targetValue,
      subScore: 50, matched: false, note: "Keine Angabe zur Haushaltsgröße",
    };
  }
  if (min === null && max === null) {
    return { criterion: "household_size", weight, applicantValue: applicant.householdSize, targetValue, subScore: 100, matched: true, note: null };
  }
  const size = applicant.householdSize;
  let diff = 0;
  if (min !== null && size < min) diff = min - size;
  if (max !== null && size > max) diff = size - max;
  const subScore = diff === 0 ? 100 : clamp(100 - diff * 25, 0, 100);
  return { criterion: "household_size", weight, applicantValue: size, targetValue, subScore: Math.round(subScore), matched: diff === 0, note: null };
}

const MOVE_IN_TOLERANCE_DAYS = 30;

function scoreMoveIn(profile: DesiredTenantProfileForScoring, applicant: ApplicantForScoring): CriterionResult {
  const weight = profile.weights.move_in ?? 0;
  const { moveInEarliest, moveInLatest } = profile;
  const targetValue = moveInEarliest || moveInLatest ? `${moveInEarliest ?? "–"} – ${moveInLatest ?? "–"}` : null;
  if (!applicant.desiredMoveIn) {
    return {
      criterion: "move_in", weight, applicantValue: null, targetValue,
      subScore: 50, matched: false, note: "Kein Wunsch-Einzugstermin angegeben",
    };
  }
  if (!moveInEarliest && !moveInLatest) {
    return { criterion: "move_in", weight, applicantValue: applicant.desiredMoveIn, targetValue, subScore: 100, matched: true, note: null };
  }
  const desired = new Date(applicant.desiredMoveIn).getTime();
  const earliest = moveInEarliest ? new Date(moveInEarliest).getTime() : -Infinity;
  const latest = moveInLatest ? new Date(moveInLatest).getTime() : Infinity;
  let diffDays = 0;
  if (desired < earliest) diffDays = (earliest - desired) / 86_400_000;
  if (desired > latest) diffDays = (desired - latest) / 86_400_000;
  const subScore = diffDays === 0 ? 100 : clamp(100 - (diffDays / MOVE_IN_TOLERANCE_DAYS) * 100, 0, 100);
  return {
    criterion: "move_in", weight, applicantValue: applicant.desiredMoveIn, targetValue,
    subScore: Math.round(subScore), matched: diffDays === 0, note: null,
  };
}

function scoreDocumentsCompleteness(profile: DesiredTenantProfileForScoring, applicant: ApplicantForScoring): CriterionResult {
  const weight = profile.weights.documents_completeness ?? 0;
  const required = profile.requiredDocuments;
  if (required.length === 0) {
    return {
      criterion: "documents_completeness", weight, applicantValue: null, targetValue: null,
      subScore: 100, matched: true, note: null,
    };
  }
  const uploaded = new Set(applicant.uploadedDocumentTypes);
  const missing = required.filter((d) => !uploaded.has(d));
  const subScore = ((required.length - missing.length) / required.length) * 100;
  return {
    criterion: "documents_completeness", weight,
    applicantValue: `${required.length - missing.length}/${required.length}`,
    targetValue: required.map((d) => DOC_TYPE_LABELS[d]).join(", "),
    subScore: Math.round(subScore), matched: missing.length === 0,
    note: missing.length > 0 ? `Fehlt: ${missing.map((d) => DOC_TYPE_LABELS[d]).join(", ")}` : null,
  };
}

export function computeMatchScore(
  profile: DesiredTenantProfileForScoring,
  applicant: ApplicantForScoring,
): ScoringResult {
  const criteriaBreakdown: CriterionResult[] = [
    scoreIncomeRatio(profile, applicant),
    scoreEmployment(profile, applicant),
    scoreSchufa(profile, applicant),
    scoreHouseholdSize(profile, applicant),
    scoreMoveIn(profile, applicant),
    scoreDocumentsCompleteness(profile, applicant),
  ];

  // Bewusst durch 100 geteilt, nicht durch die tatsächliche Gewichtssumme:
  // weicht die Summe der konfigurierten Gewichte von 100 ab, bleibt der
  // Effekt sichtbar (z. B. max. erreichbarer Score < 100 bei Untergewicht)
  // statt künstlich auf 0–100 renormiert zu werden.
  const weightedSum = criteriaBreakdown.reduce((sum, c) => sum + c.subScore * c.weight, 0);
  const overallScore = weightedSum / 100;

  const missingCount = criteriaBreakdown.filter((c) => c.note !== null).length;
  const confidence = clamp(1 - missingCount * CONFIDENCE_PENALTY_PER_MISSING, 0, 1);

  const uploaded = new Set(applicant.uploadedDocumentTypes);
  const missingDocuments = profile.requiredDocuments.filter((d) => !uploaded.has(d));

  return {
    overallScore: Math.round(overallScore * 100) / 100,
    confidence: Math.round(confidence * 1000) / 1000,
    criteriaBreakdown,
    missingDocuments,
  };
}
