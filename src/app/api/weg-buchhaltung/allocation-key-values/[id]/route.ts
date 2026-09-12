import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

// PATCH /api/weg-buchhaltung/allocation-key-values/[id]
// Body: { value?, valid_from?, valid_to? } — z. B. um einen Wert zu korrigieren
// oder mit valid_to zu beenden, bevor ein neuer Wert für dieselbe Einheit beginnt.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();
  const { id } = await params;

  const body = await request.json();
  const update: Record<string, unknown> = {};
  if (body.value !== undefined) update.value = body.value;
  if (body.valid_from !== undefined) update.valid_from = body.valid_from;
  if (body.valid_to !== undefined) update.valid_to = body.valid_to;

  if (Object.keys(update).length === 0) return badRequest("Keine Felder zum Aktualisieren übergeben");

  const { data, error } = await supabase
    .from("allocation_key_values")
    .update(update)
    .eq("id", id)
    .select("id, key_id, unit_id, value, valid_from, valid_to, units ( unit_number )")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
