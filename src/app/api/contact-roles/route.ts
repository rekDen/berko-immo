import { NextRequest, NextResponse } from "next/server";
import { withAuth, unauthorized, badRequest } from "@/lib/supabase/api";

// POST /api/contact-roles
export async function POST(request: NextRequest) {
  const { supabase, user, tenantId } = await withAuth();
  if (!supabase || !user || !tenantId) return unauthorized();

  const body = await request.json();
  if (!body.contact_id || !body.role || !body.property_id) {
    return badRequest("Pflichtfelder: contact_id, role, property_id");
  }

  const { data, error } = await supabase
    .from("contact_roles")
    .insert({
      tenant_id: tenantId,
      created_by: user.id,
      contact_id: body.contact_id,
      property_id: body.property_id,
      unit_id: body.unit_id ?? null,
      role: body.role,
      valid_from: body.valid_from ?? new Date().toISOString().slice(0, 10),
      valid_to: body.valid_to ?? null,
      is_primary: body.is_primary ?? true,
      metadata: body.metadata ?? {},
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
