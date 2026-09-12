import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

// PATCH /api/weg-buchhaltung/plan-advances/[id]
// Body: { monthly_operating?, monthly_reserve?, valid_from?, valid_to? }
// Für Korrekturen bzw. um einen Vorschuss manuell zu beenden.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();
  const { id } = await params;

  const body = await request.json();
  const update: Record<string, unknown> = {};
  for (const field of ["monthly_operating", "monthly_reserve", "valid_from", "valid_to"]) {
    if (field in body) update[field] = body[field];
  }
  if (Object.keys(update).length === 0) return badRequest("Keine Felder zum Aktualisieren übergeben");

  const { data, error } = await supabase
    .from("plan_advances")
    .update(update)
    .eq("id", id)
    .select("id, plan_id, unit_id, monthly_operating, monthly_reserve, valid_from, valid_to, units ( unit_number )")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
