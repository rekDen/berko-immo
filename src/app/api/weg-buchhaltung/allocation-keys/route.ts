import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

const KEY_TYPES = ["co_ownership", "area", "unit_count", "persons", "consumption", "custom"];

// GET /api/weg-buchhaltung/allocation-keys?property_id=...
// Liefert Verteilerschlüssel inkl. ihrer Werte je Einheit (Spec 5.3, 5.8).
export async function GET(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const propertyId = request.nextUrl.searchParams.get("property_id");
  if (!propertyId) return badRequest("Pflichtparameter: property_id");

  const { data: keys, error: keysErr } = await supabase
    .from("allocation_keys")
    .select("id, name, type, created_at")
    .eq("property_id", propertyId)
    .order("name");
  if (keysErr) return NextResponse.json({ error: keysErr.message }, { status: 500 });

  const { data: values, error: valuesErr } = await supabase
    .from("allocation_key_values")
    .select("id, key_id, unit_id, value, valid_from, valid_to, units ( unit_number )")
    .in("key_id", (keys ?? []).map((k) => k.id));
  if (valuesErr) return NextResponse.json({ error: valuesErr.message }, { status: 500 });

  const result = (keys ?? []).map((k) => ({
    ...k,
    values: (values ?? [])
      .filter((v) => v.key_id === k.id)
      .sort((a, b) =>
        ((a.units as unknown as { unit_number: string } | null)?.unit_number ?? "").localeCompare(
          (b.units as unknown as { unit_number: string } | null)?.unit_number ?? "",
          undefined,
          { numeric: true }
        )
      ),
  }));

  return NextResponse.json(result);
}

// POST /api/weg-buchhaltung/allocation-keys
// Body: { property_id, name, type }
export async function POST(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const body = await request.json();
  if (!body.property_id || !body.name || !body.type) {
    return badRequest("Pflichtfelder: property_id, name, type");
  }
  if (!KEY_TYPES.includes(body.type)) return badRequest(`type muss einer von ${KEY_TYPES.join(", ")} sein`);

  const { data, error } = await supabase
    .from("allocation_keys")
    .insert({
      tenant_id: tenantId,
      created_by: user.id,
      property_id: body.property_id,
      name: body.name,
      type: body.type,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ...data, values: [] }, { status: 201 });
}
