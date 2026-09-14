import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized } from "@/lib/supabase/api";

const PROFILE_FIELDS = `id, unit_id, target_rent_cold, min_net_income, income_to_rent_ratio_min,
  employment_types_accepted, household_size_min, household_size_max, pets_allowed,
  smoking_allowed, move_in_earliest, move_in_latest, min_lease_duration_months,
  schufa_required, schufa_max_score_class, required_documents, weights, notes_internal,
  created_at, updated_at`;

const EDITABLE_FIELDS = [
  "target_rent_cold", "min_net_income", "income_to_rent_ratio_min", "employment_types_accepted",
  "household_size_min", "household_size_max", "pets_allowed", "smoking_allowed",
  "move_in_earliest", "move_in_latest", "min_lease_duration_months", "schufa_required",
  "schufa_max_score_class", "required_documents", "weights", "notes_internal",
];

// PATCH /api/mietermatching/profiles/[id]
// Body: beliebige Teilmenge der Profilfelder. Summe der weights wird nicht hart
// erzwungen (Spec §3.2 verlangt Summe = 100), stattdessen als Warnung zurückgegeben.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();
  const { id } = await params;

  const body = await request.json();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of EDITABLE_FIELDS) {
    if (field in body) update[field] = body[field];
  }

  const { data, error } = await supabase
    .from("desired_tenant_profile")
    .update(update)
    .eq("id", id)
    .select(PROFILE_FIELDS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let weightsWarning: string | undefined;
  if (data.weights) {
    const sum = Object.values(data.weights as Record<string, number>).reduce((s, w) => s + (w ?? 0), 0);
    if (Math.round(sum) !== 100) weightsWarning = `Gewichtungssumme ist ${sum}, sollte 100 ergeben`;
  }

  return NextResponse.json(weightsWarning ? { ...data, weights_warning: weightsWarning } : data);
}

// DELETE /api/mietermatching/profiles/[id] — soft delete
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();
  const { id } = await params;

  const { error } = await supabase
    .from("desired_tenant_profile")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
