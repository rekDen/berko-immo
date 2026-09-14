import type { SupabaseClient } from "@supabase/supabase-js";
import { computeMatchScore, type ApplicantDocType } from "./scoring";
import { applicantRowToScoring, profileRowToScoring } from "./db-mapping";

export const APPLICANT_FIELDS = `id, unit_id, source, first_name, last_name, contact_email, contact_phone, net_income,
  employment_type, household_size, has_pets, is_smoker, desired_move_in, schufa_result,
  status, created_at`;

export const PROFILE_SCORING_FIELDS = `id, target_rent_cold, income_to_rent_ratio_min, employment_types_accepted,
  household_size_min, household_size_max, move_in_earliest, move_in_latest,
  schufa_required, required_documents, weights`;

export interface ApplicantRow {
  id: string;
  unit_id: string;
  net_income: number | null;
  employment_type: string | null;
  household_size: number | null;
  desired_move_in: string | null;
  schufa_result: { classification: "none_negative" | "soft_negative" | "hard_negative" } | null;
  status: string;
}

/** Dokumenttypen, für die der Bewerber mindestens eine Unterlage hochgeladen
 * hat — unabhängig vom Extraktionsstatus (schon der Upload zählt für die
 * Vollständigkeitsprüfung, s. scoring.ts). */
export async function loadUploadedDocTypes(supabase: SupabaseClient, applicantId: string): Promise<ApplicantDocType[]> {
  const { data } = await supabase.from("applicant_document").select("doc_type").eq("applicant_id", applicantId);
  return [...new Set((data ?? []).map((d) => d.doc_type as ApplicantDocType))];
}

/**
 * Berechnet den Match-Score eines Bewerbers neu und legt eine neue
 * match_result-Zeile an (append-only, Spec §9: "neue Version statt
 * Überschreiben"). Aufrufer: Bewerber-Update, Dokument hochgeladen/gelöscht
 * — überall dort, wo sich scoring-relevante Daten geändert haben können.
 * Liefert `null`, wenn (noch) kein Wunschmieter-Profil für die Einheit existiert.
 */
export async function rescoreApplicant(supabase: SupabaseClient, tenantId: string, applicant: ApplicantRow) {
  const { data: profile } = await supabase
    .from("desired_tenant_profile").select(PROFILE_SCORING_FIELDS).eq("unit_id", applicant.unit_id).maybeSingle();
  if (!profile) return null;

  const uploadedDocumentTypes = await loadUploadedDocTypes(supabase, applicant.id);
  const scoring = computeMatchScore(profileRowToScoring(profile), applicantRowToScoring(applicant, uploadedDocumentTypes));

  const { data: matchResult, error } = await supabase
    .from("match_result")
    .insert({
      tenant_id: tenantId,
      applicant_id: applicant.id,
      desired_tenant_profile_id: profile.id,
      overall_score: scoring.overallScore,
      criteria_breakdown: scoring.criteriaBreakdown,
      missing_documents: scoring.missingDocuments,
      confidence: scoring.confidence,
    })
    .select("overall_score, confidence, criteria_breakdown, missing_documents, computed_at")
    .single();
  if (error) throw new Error(error.message);

  if (applicant.status === "new") {
    await supabase.from("applicant").update({ status: "scored" }).eq("id", applicant.id);
  }

  return matchResult;
}
