import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";
import { APPLICANT_FIELDS, PROFILE_SCORING_FIELDS, rescoreApplicant } from "@/lib/mietermatching/rescoring";

const EDITABLE_FIELDS = [
  "first_name", "last_name", "contact_email", "contact_phone", "net_income", "employment_type",
  "household_size", "has_pets", "is_smoker", "desired_move_in", "schufa_result",
];

// GET /api/mietermatching/applicants/[id]
// Inkl. Profil, hochgeladenen Dokumenten und neuestem match_result mit
// vollem criteria_breakdown (Spec §5.2 Detailansicht).
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();
  const { id } = await params;

  const { data: applicant, error } = await supabase.from("applicant").select(APPLICANT_FIELDS).eq("id", id).single();
  if (error || !applicant) return badRequest("Bewerber nicht gefunden");

  const { data: profile } = await supabase
    .from("desired_tenant_profile")
    .select(PROFILE_SCORING_FIELDS)
    .eq("unit_id", applicant.unit_id)
    .maybeSingle();

  const { data: matchResult } = await supabase
    .from("match_result")
    .select("overall_score, confidence, criteria_breakdown, missing_documents, computed_at")
    .eq("applicant_id", id)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: documents } = await supabase
    .from("applicant_document")
    .select("id, doc_type, extraction_status, extracted_data, created_at, documents ( id, title, file_name, storage_path )")
    .eq("applicant_id", id)
    .order("created_at", { ascending: false });

  const { data: unit } = await supabase
    .from("units")
    .select("unit_number, properties ( name, street, house_number, zip_code, city )")
    .eq("id", applicant.unit_id)
    .single();

  const { data: matchingActions } = await supabase
    .from("matching_action")
    .select("id, action, rendered_subject, performed_at")
    .eq("applicant_id", id)
    .order("performed_at", { ascending: false });

  return NextResponse.json({
    ...applicant, profile: profile ?? null, match_result: matchResult ?? null, documents: documents ?? [],
    unit: unit ?? null, matching_actions: matchingActions ?? [],
  });
}

// PATCH /api/mietermatching/applicants/[id]
// Body: beliebige Teilmenge der Bewerberfelder. Berechnet den Score neu und
// legt eine neue match_result-Zeile an (append-only, Spec §9).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();
  const { id } = await params;

  const body = await request.json();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of EDITABLE_FIELDS) {
    if (field in body) update[field] = body[field];
  }

  const { data: applicant, error: updErr } = await supabase
    .from("applicant")
    .update(update)
    .eq("id", id)
    .select(APPLICANT_FIELDS)
    .single();
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  let matchResult;
  try {
    matchResult = await rescoreApplicant(supabase, tenantId, applicant);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Score-Berechnung fehlgeschlagen" }, { status: 500 });
  }

  return NextResponse.json({
    ...applicant, status: matchResult ? (applicant.status === "new" ? "scored" : applicant.status) : applicant.status,
    match_result: matchResult,
  });
}

// DELETE /api/mietermatching/applicants/[id] — soft delete, Status "withdrawn"
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();
  const { id } = await params;

  const { error } = await supabase
    .from("applicant")
    .update({ status: "withdrawn", deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
