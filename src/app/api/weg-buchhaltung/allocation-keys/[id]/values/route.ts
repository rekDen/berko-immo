import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

// POST /api/weg-buchhaltung/allocation-keys/[id]/values
// Body: { unit_id, value, valid_from, valid_to? }
// Legt einen neuen Schlüsselwert an (Spec 5.3.2: Werte haben Gültigkeitszeiträume;
// eine Änderung endet den alten Wert nicht automatisch — das erledigt der Aufrufer
// vorher über PATCH .../allocation-key-values/[id] mit valid_to).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();
  const { id: keyId } = await params;

  const body = await request.json();
  if (!body.unit_id || body.value === undefined || body.value === null || !body.valid_from) {
    return badRequest("Pflichtfelder: unit_id, value, valid_from");
  }

  const { data, error } = await supabase
    .from("allocation_key_values")
    .insert({
      tenant_id: tenantId,
      created_by: user.id,
      key_id: keyId,
      unit_id: body.unit_id,
      value: body.value,
      valid_from: body.valid_from,
      valid_to: body.valid_to ?? null,
    })
    .select("id, key_id, unit_id, value, valid_from, valid_to, units ( unit_number )")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
