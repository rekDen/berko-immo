import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

// GET /api/weg-buchhaltung/matching-rules?property_id=...
// Deterministische Zuordnungsregeln (weg-buchhaltung-spec.md 5.7) —
// werden beim Import zuerst angewendet, bevor je ein KI-Vorschlag entsteht.
export async function GET(request: NextRequest) {
  const { supabase, user } = await withAuth();
  if (!supabase || !user) return unauthorized();

  const propertyId = request.nextUrl.searchParams.get("property_id");
  if (!propertyId) return badRequest("Pflichtparameter: property_id");

  const { data, error } = await supabase
    .from("matching_rules")
    .select(`
      id, pattern, active, target_unit_id, target_owner_id, target_cost_type_id,
      cost_types ( name ),
      units ( unit_number ),
      contacts ( first_name, last_name, company_name )
    `)
    .eq("property_id", propertyId)
    .order("active", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/weg-buchhaltung/matching-rules
// Body: { property_id, pattern: { iban?, purposeContains? }, target_unit_id?,
//         target_owner_id?, target_cost_type_id? }
// Mindestens ein Muster-Kriterium und mindestens ein Ziel sind erforderlich.
export async function POST(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const body = await request.json();
  if (!body.property_id || !body.pattern) return badRequest("Pflichtfelder: property_id, pattern");
  if (!body.pattern.iban && !body.pattern.purposeContains) {
    return badRequest("pattern benötigt mindestens iban oder purposeContains");
  }
  if (!body.target_unit_id && !body.target_owner_id && !body.target_cost_type_id) {
    return badRequest("Mindestens ein Ziel erforderlich: target_unit_id, target_owner_id oder target_cost_type_id");
  }

  const { data, error } = await supabase
    .from("matching_rules")
    .insert({
      tenant_id: tenantId,
      created_by: user.id,
      property_id: body.property_id,
      pattern: body.pattern,
      target_unit_id: body.target_unit_id ?? null,
      target_owner_id: body.target_owner_id ?? null,
      target_cost_type_id: body.target_cost_type_id ?? null,
      active: true,
    })
    .select(`
      id, pattern, active, target_unit_id, target_owner_id, target_cost_type_id,
      cost_types ( name ),
      units ( unit_number ),
      contacts ( first_name, last_name, company_name )
    `)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
