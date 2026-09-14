import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

const PROFILE_FIELDS = `id, unit_id, target_rent_cold, min_net_income, income_to_rent_ratio_min,
  employment_types_accepted, household_size_min, household_size_max, pets_allowed,
  smoking_allowed, move_in_earliest, move_in_latest, min_lease_duration_months,
  schufa_required, schufa_max_score_class, required_documents, weights, notes_internal,
  created_at, updated_at`;

// GET /api/mietermatching/profiles?unit_id=...
// Spec: Spezifikation_Mietermatching.md §2.1 — 1:1 Wunschmieter-Profil je Einheit.
export async function GET(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const unitId = request.nextUrl.searchParams.get("unit_id");
  if (!unitId) return badRequest("Pflichtparameter: unit_id");

  const { data, error } = await supabase
    .from("desired_tenant_profile")
    .select(PROFILE_FIELDS)
    .eq("unit_id", unitId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/mietermatching/profiles
// Body: { unit_id, ...Profilfelder }. Ein Profil je Einheit (DB-Unique-Index).
export async function POST(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const body = await request.json();
  if (!body.unit_id) return badRequest("Pflichtfeld: unit_id");

  const { data, error } = await supabase
    .from("desired_tenant_profile")
    .insert({
      tenant_id: tenantId,
      created_by: user.id,
      unit_id: body.unit_id,
      target_rent_cold: body.target_rent_cold ?? null,
      min_net_income: body.min_net_income ?? null,
      income_to_rent_ratio_min: body.income_to_rent_ratio_min ?? 3.0,
      employment_types_accepted: body.employment_types_accepted ?? [],
      household_size_min: body.household_size_min ?? null,
      household_size_max: body.household_size_max ?? null,
      pets_allowed: body.pets_allowed ?? null,
      smoking_allowed: body.smoking_allowed ?? null,
      move_in_earliest: body.move_in_earliest ?? null,
      move_in_latest: body.move_in_latest ?? null,
      min_lease_duration_months: body.min_lease_duration_months ?? null,
      schufa_required: body.schufa_required ?? false,
      schufa_max_score_class: body.schufa_max_score_class ?? null,
      required_documents: body.required_documents ?? [],
      weights: body.weights ?? undefined, // DB-Default greift, wenn nicht mitgegeben
      notes_internal: body.notes_internal ?? null,
    })
    .select(PROFILE_FIELDS)
    .single();

  if (error) {
    if (error.code === "23505") return badRequest("Für diese Einheit existiert bereits ein Wunschmieter-Profil");
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
