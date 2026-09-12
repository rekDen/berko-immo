import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

// PATCH /api/weg-buchhaltung/cost-types/[id]
// Editierbar: name, allocation_key_id, is_heating, allows_direct_charge,
// apportionable, betrkv_no, resolution_ref. `direction` und `ledger_account_id`
// sind bei Anlage fixiert (Kontenart würde sonst nicht mehr zur Kostenart passen).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();
  const { id } = await params;

  const body = await request.json();
  if (body.betrkv_no !== undefined && body.betrkv_no !== null && (body.betrkv_no < 1 || body.betrkv_no > 17)) {
    return badRequest("betrkv_no muss zwischen 1 und 17 liegen");
  }

  const update: Record<string, unknown> = {};
  for (const field of ["name", "allocation_key_id", "is_heating", "allows_direct_charge", "apportionable", "betrkv_no", "resolution_ref"]) {
    if (field in body) update[field] = body[field];
  }
  if (Object.keys(update).length === 0) return badRequest("Keine Felder zum Aktualisieren übergeben");

  const { data, error } = await supabase
    .from("cost_types")
    .update(update)
    .eq("id", id)
    .select("id, name, direction, allocation_key_id, is_heating, allows_direct_charge, apportionable, betrkv_no, resolution_ref, ledger_account_id, accounts ( code, name )")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
