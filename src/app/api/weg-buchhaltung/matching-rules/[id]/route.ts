import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

// PATCH /api/weg-buchhaltung/matching-rules/[id]
// Body: { pattern?, active?, target_unit_id?, target_owner_id?, target_cost_type_id? }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();
  const { id } = await params;

  const body = await request.json();
  const update: Record<string, unknown> = {};
  for (const field of ["pattern", "active", "target_unit_id", "target_owner_id", "target_cost_type_id"]) {
    if (field in body) update[field] = body[field];
  }
  if (Object.keys(update).length === 0) return badRequest("Keine Felder zum Aktualisieren übergeben");

  const { data, error } = await supabase
    .from("matching_rules")
    .update(update)
    .eq("id", id)
    .select(`
      id, pattern, active, target_unit_id, target_owner_id, target_cost_type_id,
      cost_types ( name ),
      units ( unit_number ),
      contacts ( first_name, last_name, company_name )
    `)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
